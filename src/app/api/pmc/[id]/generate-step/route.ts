import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium, logActivity } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { getNormativaForGenerator, getStructuredNormativaForGenerator } from '@/lib/normativa-context';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PmcDiagnosticoSchema, PmcPlanAccionSchema } from '@/lib/ai-schemas';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { extractIdempotencyKey, checkIdempotencyKey, createIdempotencyKey } from '@/lib/idempotency';
import { buildPmcDiagnosticoPrompt, buildPmcPlanAccionPrompt } from '@/lib/prompts/pmc-prompts';
import type { PmcProject, PmcStatisticalContext } from '@/types/pmc';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };
type StepType = 'normativa' | 'diagnostico' | 'plan_accion';

// ─── Normativa dinámica desde BD (via normativa-context.ts) ──────────────────
// La normativa ya no es hardcodeada. Se lee de normativa_articulos en Neon.
// Fallback automático si la BD está vacía (ver getNormativaFallback en normativa-context.ts).

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeStr(val: unknown, fallback = 'N/D'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

function parseJson<T = unknown>(val: unknown): T | Record<string, never> {
  if (!val) return {} as Record<string, never>;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return {} as Record<string, never>;
  }
}



// ─── Route ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    // PASO 1 — Gate de suscripción institucional en PMC
    const subStatus = await getSubscriptionStatus(teacher.id, teacher.email);
    if (!subStatus.hasActiveSubscription && !subStatus.isAdmin) {
      return NextResponse.json(
        {
          error:
            'Se requiere una suscripción activa o institucional para generar componentes del Plan de Mejora Continua (PMC) con IA.',
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const db = sql();

    const [project] = await db`
      SELECT *
      FROM pmc_projects
      WHERE id = ${id}
        AND teacher_id = ${teacher.id}
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const body = await request.json() as { step?: string };
    const step = body.step as StepType | undefined;

    if (!step || !['normativa', 'diagnostico', 'plan_accion'].includes(step)) {
      return NextResponse.json(
        { error: "El paso debe ser 'normativa', 'diagnostico' o 'plan_accion'" },
        { status: 400 }
      );
    }

    // Mejora #24: Verificación de Idempotencia y Deduplicación
    const idempotencyKey = extractIdempotencyKey(request);
    const cachedResult = await checkIdempotencyKey(
      idempotencyKey,
      teacher.id,
      `/api/pmc/${id}/generate-step?step=${step}`
    );
    if (cachedResult) {
      return NextResponse.json(cachedResult, {
        headers: { 'X-Idempotency-Hit': 'true' },
      });
    }

    const now = new Date().toISOString();
    const libraryContext = await getUserLibraryContext(teacher.email);

    // ── NORMATIVA (dinámica desde BD) ────────────────────────────────────────
    if (step === 'normativa') {
      // Lee artículos desde normativa_articulos; usa fallback si BD está vacía
      const normativaTexto = await getNormativaForGenerator('pmc');
      const normativaEstructurada = await getStructuredNormativaForGenerator('pmc');

      // Construye el objeto JSON que se guarda en pmc_projects.normativa
      // (mantiene la misma estructura que esperan el DOCX y el frontend)
      const normativaJson = {
        titulo: 'Marco Normativo',
        descripcion:
          'El presente Plan de Mejora Continua (PMC) se sustenta en el siguiente marco jurídico y normativo vigente para el Bachillerato General del Estado de Puebla (BGE), en el marco del MCCEMS y la Subsecretaría de Educación Media Superior.',
        // Bloque de texto completo para IA
        texto_normativo: normativaTexto,
        // Lista estructurada para DOCX y UI
        documentos: normativaEstructurada,
        // Metadatos de trazabilidad
        fuente: 'BD normativa_articulos — catálogo curado',
        generado_en: now,
      };

      const [updated] = await db`
        UPDATE pmc_projects
        SET normativa = ${JSON.stringify(normativaJson)},
            current_step = GREATEST(current_step, 2),
            updated_at = ${now}
        WHERE id = ${id}
          AND teacher_id = ${teacher.id}
        RETURNING *
      `;
      const responsePayload = { success: true, step, data: normativaJson, project: updated };
      if (idempotencyKey) {
        await createIdempotencyKey(
          idempotencyKey,
          teacher.id,
          `/api/pmc/${id}/generate-step?step=${step}`,
          responsePayload
        );
      }
      return NextResponse.json(responsePayload);
    }

    // ── DIAGNÓSTICO ──────────────────────────────────────────────────────────
    if (step === 'diagnostico') {
      const indic = parseJson<{
        aprobacion_ant?: number;
        reprobacion_ant?: number;
        abandono_ant?: number;
        et_ant?: number;
        aprobacion_meta?: number;
        abandono_meta?: number;
        et_meta?: number;
        matricula?: number;
        statistical_context?: PmcStatisticalContext;
      }>(project.indicadores_academicos);

      const rawStats = project.statistical_context ? parseJson<PmcStatisticalContext>(project.statistical_context) : undefined;
      const statisticalContext: PmcStatisticalContext | undefined = (rawStats && 'plantel' in rawStats)
        ? (rawStats as PmcStatisticalContext)
        : (indic?.statistical_context?.plantel ? indic.statistical_context : undefined);

      const prompt = buildPmcDiagnosticoPrompt(project as unknown as PmcProject, statisticalContext, libraryContext);

      const isPremium = await resolveUserIsPremium(teacher.id);
      const rawText = await generateWithRotation(
        'Eres un asistente experto en planeación educativa para el BGE de Puebla. Responde siempre con JSON válido y bien formado.',
        prompt,
        teacher.id,
        isPremium,
        { jsonMode: true }
      );
      if (!rawText) {
        throw new Error('Respuesta vacía del proveedor de IA');
      }

      let parsedDiag: z.infer<typeof PmcDiagnosticoSchema>;
      let fodaWarning: string | undefined = undefined;

      const parseResult = parseAIResponse(rawText, PmcDiagnosticoSchema, { contextName: 'pmc_diagnostico' });
      if (parseResult.success) {
        parsedDiag = parseResult.data;
      } else {
        logger.warn('Initial PMC diagnostico parsing failed, attempting flexible regex fallback:', {
          error: parseResult.error,
        });

        const extractField = (pattern: RegExp): string => {
          const m = rawText.match(pattern);
          return m && m[1] ? m[1].replace(/["}\]\\]/g, '').trim() : '';
        };

        const pres = extractField(/(?:"presentacion"|presentación|1\.)\s*[:=\-]\s*"?([\s\S]*?)(?=(?:"contexto"|contexto|2\.)|$)/i);
        const cont = extractField(/(?:"contexto"|contexto|2\.)\s*[:=\-]\s*"?([\s\S]*?)(?=(?:"analisis_indicadores"|análisis|3\.)|$)/i);
        const ind = extractField(/(?:"analisis_indicadores"|analisis_indicadores|3\.)\s*[:=\-]\s*"?([\s\S]*?)(?=(?:"sintesis_foda"|síntesis|foda|4\.)|$)/i);
        const fodaExtracted = extractField(/(?:"sintesis_foda"|sintesis_foda|foda|4\.)\s*[:=\-]\s*"?([\s\S]*?)(?=(?:"priorizacion"|priorización|5\.)|$)/i);
        const prio = extractField(/(?:"priorizacion"|priorizacion|5\.)\s*[:=\-]\s*"?([\s\S]*?)(?=$|")/i);

        if (pres.length >= 10 && cont.length >= 10 && fodaExtracted.length >= 10) {
          parsedDiag = {
            presentacion: pres,
            contexto: cont,
            analisis_indicadores: ind.length >= 10 ? ind : 'Análisis de indicadores académicos del ciclo escolar anterior.',
            sintesis_foda: fodaExtracted,
            priorizacion: prio.length >= 10 ? prio : 'Priorización de objetivos orientados a la retención y aprovechamiento.',
          };
          logger.info('PMC diagnostico recovered successfully via flexible regex fallback');
        } else {
          // Si no se pudieron aislar las 5 claves, guardar texto crudo y advertencia
          fodaWarning = 'El FODA necesita revisión manual (la respuesta de IA no devolvió el formato estándar pero se preservó el texto generado).';
          logger.warn('PMC FODA fallback activated: raw text preserved with manual review flag');
          parsedDiag = {
            presentacion: pres.length >= 10 ? pres : `Presentación oficial del PMC — Plantel ${safeStr(project.school_name)} (Ciclo ${safeStr(project.ciclo_escolar)}).`,
            contexto: cont.length >= 10 ? cont : safeStr(project.diagnostico_comunidad, 'Diagnóstico contextual escolar e institucional.'),
            analisis_indicadores: ind.length >= 10 ? ind : `Indicadores base: Aprobación ${indic.aprobacion_ant ?? 'N/D'}%, Reprobación ${indic.reprobacion_ant ?? 'N/D'}%, Abandono ${indic.abandono_ant ?? 'N/D'}%.`,
            sintesis_foda: rawText.length > 50 ? rawText.substring(0, 1500) : 'El análisis FODA necesita revisión manual por parte del colectivo docente.',
            priorizacion: prio.length >= 10 ? prio : 'Priorización colegiada pendiente de confirmación en el Consejo Técnico Escolar.',
          };
        }
      }

      const [updated] = await db`
        UPDATE pmc_projects
        SET diagnostico_generado = ${JSON.stringify(parsedDiag)},
            current_step = GREATEST(current_step, 3),
            updated_at = ${now}
        WHERE id = ${id}
          AND teacher_id = ${teacher.id}
        RETURNING *
      `;
      await logActivity({ teacherEmail: teacher.email, action: 'generate_pmc_diagnostico', entityType: 'pmc', entityId: id, success: true });
      const responsePayload = {
        success: true,
        step,
        diagnostico_generado: parsedDiag,
        warning: fodaWarning,
        project: updated,
      };
      if (idempotencyKey) {
        await createIdempotencyKey(
          idempotencyKey,
          teacher.id,
          `/api/pmc/${id}/generate-step?step=${step}`,
          responsePayload
        );
      }
      return NextResponse.json(responsePayload);
    }

    // ── PLAN DE ACCIÓN ───────────────────────────────────────────────────────
    if (step === 'plan_accion') {
      const indic = parseJson<{
        aprobacion_ant?: number;
        reprobacion_ant?: number;
        abandono_ant?: number;
        et_ant?: number;
        aprobacion_meta?: number;
        abandono_meta?: number;
        et_meta?: number;
        statistical_context?: PmcStatisticalContext;
      }>(project.indicadores_academicos);

      const staffData = parseJson<{ nombre?: string; cargo?: string }[]>(project.staff_data);
      const MAX_STAFF = subStatus.isAdmin ? 100 : 35;
      const isStaffTruncated = Array.isArray(staffData) && staffData.length > MAX_STAFF;
      if (isStaffTruncated) {
        logger.warn('Truncated staff list for PMC generation to prevent token overflow', {
          total: staffData.length,
          capped: MAX_STAFF,
          teacherEmail: teacher.email,
        });
      }

      const rawStats = project.statistical_context ? parseJson<PmcStatisticalContext>(project.statistical_context) : undefined;
      const statisticalContext: PmcStatisticalContext | undefined = (rawStats && 'plantel' in rawStats)
        ? (rawStats as PmcStatisticalContext)
        : (indic?.statistical_context?.plantel ? indic.statistical_context : undefined);

      const prompt = buildPmcPlanAccionPrompt(project as unknown as PmcProject, statisticalContext, libraryContext);

      const isPremium = await resolveUserIsPremium(teacher.id);
      const rawText = await generateWithRotation(
        'Eres un asistente experto en planeación educativa para el BGE de Puebla. Responde siempre con JSON válido y bien formado. Nunca omitas metas institucionales para los temas indicados.',
        prompt,
        teacher.id,
        isPremium,
        { jsonMode: true }
      );
      if (!rawText) {
        throw new Error('Respuesta vacía del proveedor de IA');
      }

      const parseResult = parseAIResponse(rawText, PmcPlanAccionSchema, { contextName: 'pmc_plan_accion' });
      if (!parseResult.success) {
        logger.error('Failed to parse PMC plan_accion:', parseResult.error);
        return NextResponse.json(
          { error: `Error al validar estructura de plan de acción PMC: ${parseResult.error}` },
          { status: 500 }
        );
      }
      const parsedPlan = parseResult.data;

      const [updated] = await db`
        UPDATE pmc_projects
        SET plan_accion = ${JSON.stringify(parsedPlan)},
            current_step = GREATEST(current_step, 4),
            updated_at = ${now}
        WHERE id = ${id}
          AND teacher_id = ${teacher.id}
        RETURNING *
      `;
      await logActivity({ teacherEmail: teacher.email, action: 'generate_pmc_plan_accion', entityType: 'pmc', entityId: id, success: true });
      const responsePayload = { success: true, step, plan_accion: parsedPlan, project: updated };
      if (idempotencyKey) {
        await createIdempotencyKey(
          idempotencyKey,
          teacher.id,
          `/api/pmc/${id}/generate-step?step=${step}`,
          responsePayload
        );
      }
      return NextResponse.json(responsePayload);
    }

    return NextResponse.json({ error: 'Paso no reconocido' }, { status: 400 });
  } catch (error) {
    logger.error('PMC generate-step error:', { error });
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

