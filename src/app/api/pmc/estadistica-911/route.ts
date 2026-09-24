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

    let ingested;
    try {
      ingested = await ingestDocument(buffer, {
        filename: file.name,
        mimeType: file.type,
        enableOcr: true,
        teacherId: teacher.id,
      });
    } catch (ingestErr: unknown) {
      logger.error('[pmc-911] Document ingestion failed:', ingestErr);
      const ingestMsg = ingestErr instanceof Error ? ingestErr.message : 'Formato no soportado';
      return NextResponse.json(
        { error: `No se pudo procesar el archivo: ${ingestMsg}` },
        { status: 400 }
      );
    }

    const documentText = ingested.markdown || ingested.fullText;
    if (!documentText || documentText.trim().length < 40) {
      return NextResponse.json(
        { error: 'El documento no contiene texto legible ni datos extraíbles.' },
        { status: 400 }
      );
    }

    const isPremium = await resolveUserIsPremium(teacher.id);
    const systemPrompt = ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildEstadistica911ExtractionPrompt(documentText);

    const aiRaw = await generateWithRotation(
      systemPrompt,
      userPrompt,
      teacher.id,
      isPremium,
      { temperature: 0.1, jsonMode: true }
    );

    const parsed = parseAIResponse(aiRaw, Estadistica911ExtractSchema, {
      contextName: 'pmc-911-extraction',
    });

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

    return NextResponse.json({
      success: true,
      filename: file.name,
      data: finalData,
      warnings: parsed.warnings,
    });
  } catch (err: unknown) {
    logger.error('[pmc-911] Unhandled error:', err);
    const errMsg = err instanceof Error ? err.message : 'Error interno del servidor al procesar la Estadística 911.';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
