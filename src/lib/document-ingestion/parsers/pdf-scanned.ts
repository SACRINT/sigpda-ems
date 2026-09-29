/**
 * pdf-scanned.ts
 * Parser para PDFs escaneados o fotocopias mediante OCR Multimodal con Gemini Flash Lite.
 * Utiliza estrictamente gemini-3.5-flash-lite / gemini-3.1-flash-lite con el pool de llaves en rotación.
 */

import {
  generateMultimodalWithMetadata,
  resolveUserIsPremium,
  logActivity,
  type AiTokenUsage,
  type MultimodalCallResult,
} from '@/lib/ai-provider';
import type { IngestedDocument } from '../types';

function resolveTokenApprox(usage: AiTokenUsage | undefined, fallbackText: string): number {
  const promptTokens = usage?.promptTokenCount ?? 0;
  const candidateTokens = usage?.candidatesTokenCount ?? 0;
  if (promptTokens + candidateTokens > 0) return promptTokens + candidateTokens;
  if (typeof usage?.totalTokenCount === 'number' && usage.totalTokenCount > 0) return usage.totalTokenCount;
  return Math.ceil(fallbackText.length / 4);
}

export async function parseScannedPdfWithGemini(
  buffer: Buffer,
  teacherId?: string,
  teacherEmail?: string,
  filename?: string
): Promise<IngestedDocument> {
  const base64Data = buffer.toString('base64');

  const systemInstruction = `Eres un transcriptor y analizador documental de alta fidelidad especializado en documentos de Educación Media Superior de México (SEP, SEMS, NEM, PAEC).
Tu tarea es leer y transcribir con máxima precisión este documento escaneado o fotocopiado a formato Markdown limpio y estructurado.
- Respeta encabezados con #, ##, ###.
- Convierte tablas a formato Markdown | Columna | Columna |.
- Preserva listas y datos institucionales (CCT, nombres de planteles, asignaturas, problemáticas comunitarias).
- NO inventes ni resumas contenido; transcribe todo el texto visible.`;

  const userPrompt = `Transcribe íntegramente todo el contenido de este documento PDF escaneado a Markdown estructurado oficial.`;

  const isPremium = await resolveUserIsPremium(teacherId);
  let completion: MultimodalCallResult;
  try {
    completion = await generateMultimodalWithMetadata(
      systemInstruction,
      userPrompt,
      {
        mimeType: 'application/pdf',
        data: base64Data,
      },
      teacherId,
      isPremium
    );
  } catch (err: unknown) {
    const failure = err as Error & { provider?: string; model?: string };
    if (teacherEmail) {
      try {
        await logActivity({
          teacherEmail,
          action: 'ingest_document',
          entityType: 'pdf_scanned',
          entityId: filename,
          providerUsed: failure.provider,
          modelUsed: failure.model,
          success: false,
          errorMsg: failure instanceof Error ? failure.message : String(err),
        });
      } catch { /* Logging never interrupts ingestion */ }
    }
    throw err;
  }

  const cleanMarkdown = completion.text.trim();

  if (teacherEmail) {
    try {
      await logActivity({
        teacherEmail,
        action: 'ingest_document',
        entityType: 'pdf_scanned',
        entityId: filename,
        providerUsed: completion.provider,
        modelUsed: completion.model,
        tokensApprox: resolveTokenApprox(completion.usage, cleanMarkdown),
        success: true,
      });
    } catch { /* Logging never interrupts ingestion */ }
  }

  return {
    markdown: cleanMarkdown,
    fullText: cleanMarkdown.replace(/[#*`|_\-]/g, ' ').replace(/\s+/g, ' ').trim(),
    totalPages: 1, // En OCR consolidado multimodal se entrega como flujo estructurado unificado
    pages: [
      {
        pageNumber: 1,
        rawText: cleanMarkdown,
        markdown: cleanMarkdown,
      },
    ],
    metadata: {
      format: 'pdf-scanned',
      wordCount: cleanMarkdown.split(/\s+/).filter(Boolean).length,
      charCount: cleanMarkdown.length,
      ocrApplied: true,
      modelUsed: completion.model,
    },
  };
}
