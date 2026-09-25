import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT,
  buildEstadistica911ExtractionPrompt,
  Estadistica911ExtractSchema,
} from '@/lib/prompts/estadistica-911-extraction';
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

    // Coherencia matemática en indicadores escolares (abandono escolar)
    // Nota H-039: La Eficiencia Terminal es un indicador GENERACIONAL oficial (% egresados sobre alumnos de
    // nuevo ingreso de la cohorte que inició 3 años antes, ej. Generación 2023-2026). NUNCA debe recalcularse
    // dividiendo egresados entre la matrícula total vigente del plantel (en escuelas multigrado subvalúa a ~30%).
    // Se preserva con máxima fidelidad el porcentaje oficial impreso en el documento 911.
    if (finalData.matricula && finalData.matricula > 0) {
      if (finalData.bajasDefinitivas && finalData.bajasDefinitivas > 0 && (!finalData.abandonoPorcentaje || finalData.abandonoPorcentaje === 0)) {
        finalData.abandonoPorcentaje = Number(((finalData.bajasDefinitivas / finalData.matricula) * 100).toFixed(1));
      }
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      data: finalData,
      warnings: parsed.warnings,
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
