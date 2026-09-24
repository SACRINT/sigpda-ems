import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  PAEC_EXTRACTION_SYSTEM_PROMPT,
  buildPaecExtractionPrompt,
  PaecPreviousExtractSchema,
} from '@/lib/prompts/paec-extraction';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  paecOrchestrator,
  PaecOrchestratorError,
} from '@/lib/paec/orchestrator';
import {
  withTimeoutBudget,
  isUpstreamAIError,
  AI_OUTAGE_USER_MESSAGE,
} from '@/lib/ai-resilience';

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

    // ── Strangler Fig: Delegación al Orquestador PAEC V2 (Nivel 1) ───────────
    if (isFeatureEnabled('PAEC_ORCHESTRATOR_V2')) {
      try {
        const result = await paecOrchestrator.ingestPrevious(buffer, {
          filename: file.name,
          mimeType: file.type,
          teacherId: teacher.id,
        });
        return NextResponse.json(result);
      } catch (err: unknown) {
        if (err instanceof PaecOrchestratorError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // ── Flujo Legacy (cuando PAEC_ORCHESTRATOR_V2 = false) ────────────────────
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
        90000
      );
    } catch (ingestErr: unknown) {
      logger.error('[paec-parse-previous] Document ingestion failed:', ingestErr);
      if (isUpstreamAIError(ingestErr)) {
        return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
      }
      const ingestMsg = ingestErr instanceof Error ? ingestErr.message : 'Formato no soportado';
      return NextResponse.json(
        { error: `No se pudo procesar el archivo: ${ingestMsg}` },
        { status: 400 }
      );
    }

    const documentText = ingested?.markdown || ingested?.fullText;
    if (!documentText || documentText.trim().length < 40) {
      return NextResponse.json(
        { error: 'El documento no contiene texto legible ni datos extraíbles.' },
        { status: 400 }
      );
    }

    // 2. Extracción asistida por IA con clave rotativa
    const isPremium = await resolveUserIsPremium(teacher.id);
    const systemPrompt = PAEC_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildPaecExtractionPrompt(documentText);

    const aiRaw = await withTimeoutBudget(
      generateWithRotation(
        systemPrompt,
        userPrompt,
        teacher.id,
        isPremium,
        { temperature: 0.1, jsonMode: true }
      ),
      90000
    );

    // 3. Parseo y validación de respuesta JSON
    const parsed = parseAIResponse(aiRaw, PaecPreviousExtractSchema, {
      contextName: 'paec-parse-previous',
    });

    if (!parsed.success) {
      logger.error('[paec-parse-previous] AI response parsing failed:', parsed.error);
      return NextResponse.json(
        { error: `No se pudieron estructurar los datos del PAEC anterior: ${parsed.error}` },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      data: parsed.data,
      warnings: parsed.warnings,
    });
  } catch (err: unknown) {
    logger.error('[paec-parse-previous] Unhandled error:', err);
    if (isUpstreamAIError(err)) {
      return NextResponse.json({ error: AI_OUTAGE_USER_MESSAGE }, { status: 503 });
    }
    const errMsg = err instanceof Error ? err.message : 'Error interno del servidor al procesar el PAEC anterior.';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
