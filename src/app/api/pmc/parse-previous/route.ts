import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  PMC_EXTRACTION_SYSTEM_PROMPT,
  buildPmcExtractionPrompt,
  PmcPreviousExtractSchema,
} from '@/lib/prompts/pmc-extraction';
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

    // Deadline global de 90s por request para prevenir saturación y errores 504 de Vercel (D-001)
    const deadline = Date.now() + 90000;

    // 1. Ingesta documental (PDF con OCR o DOCX con Mammoth)
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

    // 2. Extracción asistida por IA con clave rotativa
    const isPremium = await resolveUserIsPremium(teacher.id);
    const systemPrompt = PMC_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildPmcExtractionPrompt(documentText);

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

    // 3. Parseo y validación de respuesta JSON
    const parsed = parseAIResponse(aiRaw, PmcPreviousExtractSchema, {
      contextName: 'pmc-parse-previous',
      repairNullStrings: true,
    });

    if (!parsed.success) {
      logger.error('[pmc-parse-previous] AI response parsing failed:', parsed.error);
      return NextResponse.json(
        { error: `No se pudieron estructurar los datos del PMC anterior: ${parsed.error}` },
        { status: 422 }
      );
    }

    // Normalizar categorías y temas canónicos de la PMC (Lineamientos Oficiales Cuadro 2)
    const normalizedStaff = parsed.data.staffData?.map((staff) => ({
      ...staff,
      metas_individuales: staff.metas_individuales?.map((meta) => {
        const catNorm = normalizePmcCategoria(meta.categoria);
        const temaNorm = normalizePmcTema(meta.tema, catNorm);
        return {
          ...meta,
          categoria: catNorm,
          tema: temaNorm,
        };
      }) || [],
    })) || [];

    const finalData = {
      ...parsed.data,
      staffData: normalizedStaff,
    };

    return NextResponse.json({
      success: true,
      filename: file.name,
      data: finalData,
      warnings: parsed.warnings,
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
