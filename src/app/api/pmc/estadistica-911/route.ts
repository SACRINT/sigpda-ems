import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium, logActivity } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT,
  buildEstadistica911ExtractionPrompt,
  Estadistica911ExtractSchema,
  Estadistica911ExtractDTO,
} from '@/lib/prompts/estadistica-911-extraction';
import { parseConcentrado911Layout } from '@/lib/concentrado-911-calculator';
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
    const requestedMomento = (formData.get('momento') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede el tamaño máximo permitido de 10 MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 0. Parser determinista por coordenadas corre ANTES que cualquier IA (H-220 / B-001)
    try {
      const layoutResult = await parseConcentrado911Layout(buffer, {
        filename: file.name,
        momento: requestedMomento,
      });

      if (!layoutResult.isScanned && (layoutResult.existencia || layoutResult.matriculaInicio || layoutResult.matriculaInicioFinDoc)) {
        const warnings = [...layoutResult.warnings];
        if (layoutResult.tipoReporte === 'fin') {
          if (!layoutResult.existencia) warnings.push('Falta existencia en la fila GENERAL del concentrado de fin.');
          if (layoutResult.bajas === null) warnings.push('Falta total de bajas en el concentrado de fin.');
        } else if (layoutResult.tipoReporte === 'inicio') {
          if (!layoutResult.matriculaInicio) warnings.push('Falta matrícula de inicio en el concentrado.');
        }

        const data: Estadistica911ExtractDTO = {
          cicloEscolar: layoutResult.cicloEscolar || '',
          schoolName: layoutResult.schoolName || '',
          schoolCct: layoutResult.schoolCct || '',
          directorName: '',
          supervisorName: '',
          tipoReporte: layoutResult.tipoReporte,
          momento: (requestedMomento || (layoutResult.tipoReporte === 'fin' ? 'fin_anterior' : 'inicio_actual')) as Estadistica911ExtractDTO['momento'],
          matriculaInicio: layoutResult.matriculaInicio ?? layoutResult.matriculaInicioFinDoc,
          altas: layoutResult.altas,
          bajas: layoutResult.bajas,
          existencia: layoutResult.existencia,
          regulares: layoutResult.regulares,
          irregulares: layoutResult.irregulares,
          totalDocentes: layoutResult.totalDocentes,
          docentesHombres: null,
          docentesMujeres: null,
          totalGrupos: layoutResult.totalGrupos,
          gruposPorGrado: {},
          observaciones: '',
        };

        if (typeof logActivity === 'function') {
          try {
            await logActivity({
              teacherEmail: session.user.email,
              action: 'ingest_document',
              entityType: '911',
              entityId: file.name,
              providerUsed: 'concentrado-911-calculator',
              success: true,
              errorMsg: warnings.length > 0 ? warnings.join('; ') : undefined,
            });
          } catch {
            // logging no bloqueante
          }
        }

        return NextResponse.json({
          success: true,
          filename: file.name,
          data,
          warnings,
        });
      }
    } catch (err) {
      logger.warn('[pmc-911] Falló parser determinista de coordenadas, procediendo a OCR/IA:', err);
    }

    // Strangler Fig: Delegación al Orquestador Central si la bandera está activa
    if (isFeatureEnabled('PMC_ORCHESTRATOR_V2')) {
      try {
        const isPremium = await resolveUserIsPremium(teacher.id);
        const result = await pmcOrchestrator.ingestDocument('911', buffer, {
          filename: file.name,
          mimeType: file.type,
          teacherId: teacher.id,
          requestedMomento,
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
      logger.error('[pmc-911] Document ingestion failed:', ingestErr);
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
    const systemPrompt = ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildEstadistica911ExtractionPrompt(documentText);

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

    let parsed = parseAIResponse(aiRaw, Estadistica911ExtractSchema, {
      contextName: 'pmc-911-extraction',
      repairNullStrings: true,
    });

    if (!parsed.success) {
      parsed = await correctiveRetry({
        systemPrompt,
        previousRaw: aiRaw,
        zodIssues: parsed.error || '',
        schema: Estadistica911ExtractSchema,
        callAI: (sys, user, remaining) =>
          withTimeoutBudget(
            generateWithRotation(sys, user, teacher.id, isPremium, { temperature: 0, jsonMode: true }),
            remaining
          ),
        deadline,
        contextName: 'pmc-911',
      });
    }

    if (!parsed.success) {
      logger.error('[pmc-911] AI response parsing failed:', parsed.error);
      return NextResponse.json(
        { error: `No se pudieron estructurar los datos de Estadística 911: ${parsed.error}` },
        { status: 422 }
      );
    }

    const finalData = {
      ...parsed.data,
      ...(requestedMomento ? { momento: requestedMomento } : {}),
    };

    const warnings = [...(parsed.warnings || []), 'requiere_revision: true (extraído vía OCR/IA de respaldo)'];

    if (typeof logActivity === 'function') {
      try {
        const approxTokens = Math.round((systemPrompt.length + userPrompt.length + aiRaw.length) / 4);
        await logActivity({
          teacherEmail: session.user.email,
          action: 'ingest_document',
          entityType: '911',
          entityId: file.name,
          providerUsed: 'gemini',
          modelUsed: 'gemini-flash-rotation',
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
      data: finalData,
      warnings,
    });
  } catch (err: unknown) {
    logger.error('[pmc-911] Unhandled error:', err);
    if (isUpstreamAIError(err)) {
      return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
    }
    const errMsg = err instanceof Error ? err.message : 'Error interno del servidor al procesar la Estadística 911.';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
