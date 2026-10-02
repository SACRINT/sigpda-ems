import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { resolveUserIsPremium } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import {
  normalizePmcCategoria,
  normalizePmcTema,
} from '@/lib/constants/pmc-categorias';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  pmcOrchestrator,
  PmcOrchestratorError,
  isUpstreamAIError,
  AI_OUTAGE_USER_MESSAGE,
  withTimeoutBudget,
} from '@/lib/pmc/orchestrator';

import { reconcilePmcStaff } from '@/lib/pmc/staff-reconciler';
import {
  validateNormalizedText,
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
  calculatePmcCoverage,
  cleanPmcPlaceholders,
  correctInvertedMetricGoals,
} from '@/lib/pmc/plan-element-normalizer';
import { synthesizeSituatedFoda } from '@/lib/pmc/pmc-foda-synthesizer';
import { extractPmcPreviousWithPartitioning } from '@/lib/pmc/pmc-partitioner';
import type { PmcIndicadoresAcademicos } from '@/types/pmc';

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
    const bypassCache = formData.get('bypassCache') === 'true' || formData.get('refresh') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    // Validación de tamaño máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo permitido de 10 MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Strangler Fig: Delegación al Orquestador Central si la bandera está activa
    if (isFeatureEnabled('PMC_ORCHESTRATOR_V2')) {
      try {
        const isPremium = await resolveUserIsPremium(teacher.id);
        const result = await pmcOrchestrator.ingestDocument('previous', buffer, {
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

    // Deadline global de 110s por request para prevenir saturación y errores 504 de Vercel (maxDuration 120)
    const deadline = Date.now() + 110000;

    // 1. Ingesta documental (PDF con OCR o DOCX con Mammoth)
    let ingested;
    try {
      ingested = await withTimeoutBudget(
        ingestDocument(buffer, {
          filename: file.name,
          mimeType: file.type,
          enableOcr: true,
          teacherId: teacher.id,
          teacherEmail: session.user.email,
          bypassCache,
        }),
        Math.max(1, deadline - Date.now())
      );
    } catch (ingestErr: unknown) {
      logger.error('[pmc-parse-previous] Document ingestion failed:', ingestErr);
      if (isUpstreamAIError(ingestErr)) {
        return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
      }
      const ingestMsg = ingestErr instanceof Error ? ingestErr.message : 'Formato no soportado';
      return NextResponse.json(
        { error: `No se pudo procesar el archivo: ${ingestMsg}` },
        { status: 400 }
      );
    }

    const documentText = (ingested?.markdown || ingested?.fullText || '').trim();
    if (!ingested || (!ingested.fullText && !ingested.markdown) || documentText.length < 40) {
      return NextResponse.json(
        { error: 'El documento no contiene texto legible ni datos extraíbles.' },
        { status: 400 }
      );
    }

    // 2. Extracción asistida por IA con clave rotativa, particionado estructural y cobertura determinista (H-216)
    const isPremium = await resolveUserIsPremium(teacher.id);
    const extractionResult = await extractPmcPreviousWithPartitioning({
      documentText,
      teacherId: teacher.id,
      isPremium,
      deadline,
      contextName: 'pmc-parse-previous',
    });

    const parsed = {
      data: extractionResult.data,
      warnings: extractionResult.warnings,
    };

    if (!parsed.warnings) {
      parsed.warnings = [];
    }

    // B3 - Invariante numérico del lado servidor (Cero fabricación B-001), auto-corrección de métricas invertidas y limpieza de placeholders
    const validatedElementos = (parsed.data.elementos_plan || []).map((elem) => {
      const cleanedNorm = cleanPmcPlaceholders(elem.texto_normalizado);
      const metricFix = correctInvertedMetricGoals(cleanedNorm || elem.texto_normalizado);
      const targetNorm = metricFix.text;
      const val = validateNormalizedText(elem.texto_original, targetNorm);
      if (!val.ok) {
        parsed.warnings.push(
          `Normalización rechazada por invariantes de datos: faltan cifras [${val.faltantes.join(', ')}] en ${elem.tipo}. Se conserva texto original.`
        );
        return {
          ...elem,
          texto_normalizado: cleanPmcPlaceholders(elem.texto_original),
          requiere_revision: true,
        };
      }
      if (metricFix.wasCorrected && metricFix.reason) {
        parsed.warnings.push(`[Auto-corrección pedagógica]: ${metricFix.reason}`);
      }
      return {
        ...elem,
        texto_normalizado: targetNorm,
      };
    });

    const finalElementos = validatedElementos.length > 0
      ? validatedElementos
      : deriveElementosFromMetasPrevias(parsed.data.metas_institucionales_previas);

    // Reconciliación arquitectónica de plantilla: consolida staffData, participantes, directorName y elementosPlan
    const reconciledStaff = reconcilePmcStaff({
      extractedStaff: parsed.data.staffData,
      participantes: parsed.data.participantes,
      directorName: parsed.data.directorName,
      targetTotalStaff: parsed.data.totalStaff,
      cicloEscolar: parsed.data.cicloEscolar,
      elementosPlan: finalElementos,
      allowEmptyPadding: false, // Al extraer de PMC previo, solo conservar trabajadores humanos reales identificados
    });

    // Consolidar metas individuales de la plantilla hacia finalElementos si no están presentes
    const existingElementTexts = new Set(
      finalElementos.map((e) => (e.texto_normalizado || e.texto_original || '').trim().toLowerCase())
    );

    for (const staffMember of reconciledStaff.staff) {
      const metas = staffMember.metas_individuales && staffMember.metas_individuales.length > 0
        ? staffMember.metas_individuales
        : (staffMember.meta_individual ? [{ meta: staffMember.meta_individual, categoria: '', tema: '', estrategia: '', entregable: '', periodo: '' }] : []);

      for (const m of metas) {
        const metaText = cleanPmcPlaceholders(m.meta);
        if (metaText && !existingElementTexts.has(metaText.toLowerCase())) {
          existingElementTexts.add(metaText.toLowerCase());
          finalElementos.push({
            tipo: 'meta',
            texto_original: metaText,
            texto_normalizado: metaText,
            categoria: m.categoria || 'Desarrollo académico y aprendizaje',
            tema: m.tema || 'Mejora continua',
            responsable: staffMember.nombre,
            periodo: m.periodo || 'Ciclo escolar 2026-2027',
            ubicacion: {},
            requiere_revision: false,
          });
        }
      }
    }

    // B1 - Derivar metas_institucionales_previas a partir de elementos_plan
    const derivedMetas = deriveMetasPreviasFromElementos(
      finalElementos,
      parsed.data.metas_institucionales_previas
    );

    const normalizedMetasPrevias = derivedMetas.map((m) => {
      const catNorm = normalizePmcCategoria(m.categoria);
      const temaNorm = normalizePmcTema(m.tema, catNorm);
      return {
        ...m,
        meta: cleanPmcPlaceholders(m.meta),
        estrategia: cleanPmcPlaceholders(m.estrategia),
        categoria: catNorm,
        tema: temaNorm,
      };
    });

    const normalizedElementosPlan = finalElementos.map((elem) => {
      const catNorm = normalizePmcCategoria(elem.categoria);
      const temaNorm = normalizePmcTema(elem.tema, catNorm);
      let textNorm = cleanPmcPlaceholders(elem.texto_normalizado);
      if (elem.tipo === 'meta') {
        const metricFix = correctInvertedMetricGoals(textNorm);
        textNorm = metricFix.text;
      }
      return {
        ...elem,
        texto_normalizado: textNorm,
        categoria: catNorm,
        tema: temaNorm,
      };
    });

    // Consolidar categorías priorizadas (desde la extracción explícita o desde las metas encontradas)
    const categoriasMap = new Map<string, Set<string>>();
    for (const cp of parsed.data.categorias_priorizadas || []) {
      if (cp && cp.categoria) {
        const catNorm = normalizePmcCategoria(cp.categoria);
        if (!categoriasMap.has(catNorm)) {
          categoriasMap.set(catNorm, new Set());
        }
        for (const t of cp.temas || []) {
          const tNorm = normalizePmcTema(t, catNorm);
          if (tNorm) categoriasMap.get(catNorm)!.add(tNorm);
        }
      }
    }
    for (const m of normalizedMetasPrevias) {
      if (m.categoria) {
        if (!categoriasMap.has(m.categoria)) {
          categoriasMap.set(m.categoria, new Set());
        }
        if (m.tema) {
          categoriasMap.get(m.categoria)!.add(m.tema);
        }
      }
    }

    const reconciledCategoriasPriorizadas = Array.from(categoriasMap.entries()).map(
      ([categoria, temasSet]) => ({
        categoria,
        temas: Array.from(temasSet),
      })
    );

    const synthesizedFoda = synthesizeSituatedFoda({
      schoolName: parsed.data.schoolName,
      schoolCct: parsed.data.schoolCct,
      municipality: parsed.data.municipality,
      locality: parsed.data.locality,
      totalStaff: reconciledStaff.totalStaff,
      rawFoda: parsed.data.foda,
      indicadores: (parsed.data.indicadores as unknown as PmcIndicadoresAcademicos) ?? undefined,
      diagnosticoComunidad: parsed.data.diagnosticoComunidad,
    });

    const finalData = {
      ...parsed.data,
      totalStaff: reconciledStaff.totalStaff,
      staffData: reconciledStaff.staff,
      participantes: parsed.data.participantes || [],
      elementos_plan: normalizedElementosPlan,
      metas_institucionales_previas: normalizedMetasPrevias,
      categorias_priorizadas: reconciledCategoriasPriorizadas,
      foda: synthesizedFoda,
    };

    const actividadesExtraidas = normalizedElementosPlan.filter((e) => e.tipo === 'actividad').length;
    const totalExtraidos = normalizedElementosPlan.length;
    const coverage = calculatePmcCoverage(
      parsed.data.totales_detectados,
      normalizedMetasPrevias.length,
      totalExtraidos,
      extractionResult.expectedActivities
    );

    if (coverage.parcial) {
      const faltantes = Math.max(0, extractionResult.expectedActivities - totalExtraidos);
      parsed.warnings.push(
        `Cobertura ${totalExtraidos}/${extractionResult.expectedActivities} (${Math.round((coverage.ratio || 0) * 100)}%): faltan ${faltantes > 0 ? faltantes : 'algunas'} metas/actividades por estructurar. Revise antes de generar.`
      );
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      data: {
        ...finalData,
        cobertura_incompleta: coverage.parcial,
      },
      warnings: parsed.warnings,
      coverage: {
        ...coverage,
        truncado: extractionResult.truncado,
      },
    });
  } catch (err: unknown) {
    logger.error('[pmc-parse-previous] Unhandled error:', err);
    if (isUpstreamAIError(err)) {
      return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
    }
    const errMsg = err instanceof Error ? err.message : 'Error interno del servidor al procesar el PMC anterior.';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
