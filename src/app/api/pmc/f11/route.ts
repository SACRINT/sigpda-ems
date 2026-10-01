import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium, logActivity } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  F11_EXTRACTION_SYSTEM_PROMPT,
  buildF11ExtractionPrompt,
  F11ExtractSchema,
  F11ExtractDTO,
} from '@/lib/prompts/f11-extraction';
import { parseF11Layout, calcularPromedioGeneralF11 } from '@/lib/f11-layout-calculator';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { correctiveRetry } from '@/lib/ai-resilience';
import {
  pmcOrchestrator,
  PmcOrchestratorError,
  isUpstreamAIError,
  AI_OUTAGE_USER_MESSAGE,
  withTimeoutBudget,
} from '@/lib/pmc/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = (formData.get('file') as File) || (formData.get('pdf') as File);

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo permitido de 10 MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. El parser determinista por coordenadas corre ANTES que la IA (Regla Anti-Fabricación B-001 / H-219)
    try {
      const layoutResult = await parseF11Layout(buffer);
      if (layoutResult && layoutResult.totalAlumnos >= 1) {
        const enrichedSchool = layoutResult.schoolName;
        let enrichedCct = layoutResult.schoolCct;
        const enrichedDirector = layoutResult.directorName;
        const enrichedCiclo = layoutResult.cicloEscolar;

        // Si falta CCT o nombre de escuela, intento rápido no bloqueante de enriquecimiento textual
        if (!enrichedSchool || !enrichedCct) {
          try {
            const lightIngest = await ingestDocument(buffer, {
              filename: file.name,
              mimeType: file.type,
              enableOcr: false,
              teacherId: teacher.id,
              teacherEmail: session.user.email,
            });
            const text = (lightIngest?.markdown || lightIngest?.fullText || '');
            if (!enrichedCct) {
              const cctM = text.match(/\b\d{2}[A-Z]{3}\d{4}[A-Z]\b/);
              if (cctM) enrichedCct = cctM[0];
            }
          } catch {
            // continuar con metadatos del parser
          }
        }

        const data: F11ExtractDTO = {
          cicloEscolar: enrichedCiclo || '',
          schoolName: enrichedSchool || '',
          schoolCct: enrichedCct || '',
          directorName: enrichedDirector || '',
          totalAlumnos: layoutResult.totalAlumnos,
          totalDocentes: null,
          totalGrupos: Object.keys(layoutResult.grupos).length,
          promedioGeneral: layoutResult.promedioGeneral,
          aprobadosPorcentaje: layoutResult.porcentajes.aprobados,
          reprobadosPorcentaje: layoutResult.porcentajes.reprobados,
          regulares: layoutResult.regulares,
          irregulares: layoutResult.irregulares,
          aprobados: layoutResult.aprobados,
          reprobados: layoutResult.reprobados,
          bajas: layoutResult.bajas,
          sinCalificacion: layoutResult.bajas,
          porcentajes: layoutResult.porcentajes,
          listaAlumnos: layoutResult.alumnos.map(a => ({
            curp: a.curp,
            nombre: a.nombre,
            nia: a.nia,
            grupo: a.grupo,
            promedio: a.promedioGeneral,
            situacion: a.situacion,
            clase: a.clase,
            materiasCinco: a.materiasCinco,
          })),
          reprobacionPorMateria: layoutResult.materias.map(m => ({
            materia: m.materia,
            n: m.n,
            reprobados: m.reprobados,
            porcentaje: m.reprobacion_actual,
            porcentajeAprobacion: m.aprobacion_actual,
            metaSugerida: m.reprobacion_meta_sugerida,
            metaConfirmada: false,
            detallePorGrupo: m.detallePorGrupo,
          })),
          promediosPorAsignatura: layoutResult.promediosPorAsignatura,
          cobertura: {
            alumnosDetectados: layoutResult.totalAlumnos,
            alumnosConCalificacion: layoutResult.totalConCalificacion,
            gruposDetectados: Object.keys(layoutResult.grupos).length,
          },
          docentes: [],
          docentesPorAsignatura: [],
          observaciones: '',
        };

        if (typeof logActivity === 'function') {
          try {
            await logActivity({
              teacherEmail: session.user.email,
              action: 'ingest_document',
              entityType: 'f11',
              entityId: file.name,
              providerUsed: 'f11-layout-calculator',
              success: true,
              errorMsg: layoutResult.warnings.length > 0 ? layoutResult.warnings.join('; ') : undefined,
            });
          } catch {
            // logging no bloqueante
          }
        }

        return NextResponse.json({
          success: true,
          filename: file.name,
          data,
          warnings: layoutResult.warnings,
        });
      }
    } catch (layoutErr) {
      logger.warn('[pmc-f11] Falló parser determinista de coordenadas, procediendo a fallback OCR/IA:', layoutErr);
    }

    // Strangler Fig: Delegación al Orquestador Central si la bandera está activa
    if (isFeatureEnabled('PMC_ORCHESTRATOR_V2')) {
      try {
        const isPremium = await resolveUserIsPremium(teacher.id);
        const result = await pmcOrchestrator.ingestDocument('f11', buffer, {
          filename: file.name,
          mimeType: file.type,
          teacherId: teacher.id,
          isPremium,
        });
        return NextResponse.json(result);
      } catch (err: unknown) {
        if (err instanceof PmcOrchestratorError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // Deadline global de 90s por request para prevenir saturación y errores 504 de Vercel (D-001)
    const deadline = Date.now() + 90000;

    let ingested;
    try {
      ingested = await withTimeoutBudget(
        ingestDocument(buffer, {
          filename: file.name,
          mimeType: file.type,
          enableOcr: true,
          teacherId: teacher.id,
          teacherEmail: session.user.email,
        }),
        Math.max(1, deadline - Date.now())
      );
    } catch (ingestErr: unknown) {
      logger.error('[pmc-f11] Document ingestion failed:', ingestErr);
      if (isUpstreamAIError(ingestErr)) {
        return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
      }
      const ingestMsg = ingestErr instanceof Error ? ingestErr.message : 'Formato no soportado';
      return NextResponse.json(
        { error: `No se pudo procesar el archivo: ${ingestMsg}` },
        { status: 400 }
      );
    }

    if (!ingested || (!ingested.fullText && !ingested.markdown)) {
      return NextResponse.json(
        { error: 'El documento no contiene texto legible ni datos extraíbles.' },
        { status: 400 }
      );
    }

    const documentText = (ingested.markdown || ingested.fullText || '').trim();
    if (documentText.length < 40) {
      return NextResponse.json(
        { error: 'El documento no contiene texto legible ni datos extraíbles.' },
        { status: 400 }
      );
    }

    const isPremium = await resolveUserIsPremium(teacher.id);
    const systemPrompt = F11_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildF11ExtractionPrompt(documentText);

    const aiRaw = await withTimeoutBudget(
      generateWithRotation(
        systemPrompt,
        userPrompt,
        teacher.id,
        isPremium,
        { temperature: 0.1, jsonMode: true }
      ),
      Math.max(1, deadline - Date.now())
    );

    let parsed = parseAIResponse(aiRaw, F11ExtractSchema, {
      contextName: 'pmc-f11-extraction',
      repairNullStrings: true,
    });

    if (!parsed.success) {
      parsed = await correctiveRetry({
        systemPrompt,
        previousRaw: aiRaw,
        zodIssues: parsed.error || '',
        schema: F11ExtractSchema,
        callAI: (sys, user, remaining) =>
          withTimeoutBudget(
            generateWithRotation(sys, user, teacher.id, isPremium, { temperature: 0, jsonMode: true }),
            remaining
          ),
        deadline,
        contextName: 'pmc-f11',
      });
    }

    if (!parsed.success) {
      logger.error('[pmc-f11] AI response parsing failed:', parsed.error);
      return NextResponse.json(
        { error: `No se pudieron estructurar los datos del F11: ${parsed.error}` },
        { status: 422 }
      );
    }

    // H-269: Única fuente de verdad para promedioGeneral (SSOT)
    // Si listaAlumnos está poblada, derivar determinísticamente con la misma semántica del parser oficial
    if (parsed.data.listaAlumnos && parsed.data.listaAlumnos.length > 0) {
      const derivedPromedio = calcularPromedioGeneralF11(parsed.data.listaAlumnos);
      if (derivedPromedio !== null) {
        parsed.data.promedioGeneral = derivedPromedio;
      }

      // H-F11-OCR-001: Recalcular conteos de clasificación determinísticamente desde listaAlumnos
      // La IA puede devolver la lista pero no calcular los totales — los derivamos aquí para garantizar consistencia
      const total = parsed.data.listaAlumnos.length;
      const regulares = parsed.data.listaAlumnos.filter(a => a.clase === 'REGULAR').length;
      const irregulares = parsed.data.listaAlumnos.filter(a => a.clase === 'IRREGULAR').length;
      const reprobados = parsed.data.listaAlumnos.filter(a => a.clase === 'REPROBADO').length;
      const bajas = parsed.data.listaAlumnos.filter(a => a.clase === 'BAJA').length;
      const aprobados = regulares + irregulares;

      if (total > 0) {
        parsed.data.regulares = regulares;
        parsed.data.irregulares = irregulares;
        parsed.data.reprobados = reprobados;
        parsed.data.bajas = bajas;
        parsed.data.aprobados = aprobados;
        parsed.data.totalAlumnos = parsed.data.totalAlumnos ?? total;

        const t = parsed.data.totalAlumnos ?? total;
        parsed.data.aprobadosPorcentaje = Number(((aprobados / t) * 100).toFixed(1));
        parsed.data.reprobadosPorcentaje = Number(((reprobados / t) * 100).toFixed(1));
        parsed.data.porcentajes = {
          aprobados: Number(((aprobados / t) * 100).toFixed(1)),
          regulares: Number(((regulares / t) * 100).toFixed(1)),
          irregulares: Number(((irregulares / t) * 100).toFixed(1)),
          reprobados: Number(((reprobados / t) * 100).toFixed(1)),
          bajas: Number(((bajas / t) * 100).toFixed(1)),
        };
      }
    }

    const warnings = [...(parsed.warnings || []), 'requiere_revision: true (extraído vía OCR/IA de respaldo)'];

    if (typeof logActivity === 'function') {
      try {
        const approxTokens = Math.round((systemPrompt.length + userPrompt.length + aiRaw.length) / 4);
        await logActivity({
          teacherEmail: session.user.email,
          action: 'ingest_document',
          entityType: 'f11',
          entityId: file.name,
          tokensApprox: approxTokens,
          success: true,
          errorMsg: undefined, // H-268: No registrar warnings en errorMsg cuando success es true
        });
      } catch {
        // logging no bloqueante
      }
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      data: parsed.data,
      warnings,
    });
  } catch (err: unknown) {
    logger.error('[pmc-f11] Unhandled error:', err);
    if (isUpstreamAIError(err)) {
      return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
    }
    const errMsg = err instanceof Error ? err.message : 'Error interno del servidor al procesar el F11.';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
