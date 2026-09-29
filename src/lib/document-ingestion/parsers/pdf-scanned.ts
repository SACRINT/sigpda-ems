/**
 * pdf-scanned.ts
 * Parser para PDFs escaneados o fotocopias mediante OCR Multimodal con Gemini Flash Lite.
 * Utiliza estrictamente gemini-3.5-flash-lite / gemini-3.1-flash-lite con el pool de llaves en rotación.
 */

import { generateMultimodalWithRotation, resolveUserIsPremium, logActivity } from '@/lib/ai-provider';
import type { IngestedDocument } from '../types';

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
  let markdownResult: string;
  try {
    markdownResult = await generateMultimodalWithRotation(
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
    if (teacherEmail) {
      try {
        await logActivity({
          teacherEmail,
          action: 'ingest_document',
          entityType: 'pdf_scanned',
          entityId: filename,
          providerUsed: 'gemini',
          modelUsed: 'gemini-3.5-flash-lite',
          success: false,
          errorMsg: err instanceof Error ? err.message : String(err),
        });
      } catch { /* Logging never interrupts ingestion */ }
    }
    throw err;
  }

  const cleanMarkdown = markdownResult.trim();

  if (teacherEmail) {
    try {
      await logActivity({
        teacherEmail,
        action: 'ingest_document',
        entityType: 'pdf_scanned',
        entityId: filename,
        providerUsed: 'gemini',
        modelUsed: 'gemini-3.5-flash-lite',
        tokensApprox: Math.ceil(cleanMarkdown.length / 4),
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
      modelUsed: 'gemini-3.5-flash-lite',
    },
  };
}
