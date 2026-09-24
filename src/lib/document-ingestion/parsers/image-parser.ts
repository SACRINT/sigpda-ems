/**
 * image-parser.ts
 * Parser para imágenes documentales (fotografías o escaneos en JPG, PNG, WEBP)
 * mediante OCR Multimodal de alta fidelidad con Gemini Flash Lite.
 */

import { generateMultimodalWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import type { IngestedDocument } from '../types';

export async function parseImageDocumentWithGemini(
  buffer: Buffer,
  mimeType: string = 'image/jpeg',
  teacherId?: string
): Promise<IngestedDocument> {
  const base64Data = buffer.toString('base64');

  const systemInstruction = `Eres un transcriptor y analizador documental de alta fidelidad especializado en documentos de Educación Media Superior de México (SEP, SEMS, NEM, formatos F11 y Estadística 911).
Tu tarea es leer y transcribir con máxima precisión esta imagen fotográfica o escaneo a formato Markdown limpio y estructurado.
- Respeta encabezados con #, ##, ###.
- Convierte tablas a formato Markdown | Columna | Columna |.
- Preserva con exactitud todos los números, porcentajes, ciclos escolares, nombres de asignaturas, CCT y nombres de planteles.
- Si es un formato oficial 911 o F11, transcribe los datos de matrícula, altas, bajas, aprobados, reprobados y promedios.
- NO resumas ni inventes datos; transcribe todo lo visible.`;

  const userPrompt = `Transcribe íntegramente todos los datos y tablas de esta imagen documental a Markdown estructurado oficial.`;

  // Normalizar mimeType común
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType || 'image/jpeg';

  const isPremium = await resolveUserIsPremium(teacherId);
  const markdownResult = await generateMultimodalWithRotation(
    systemInstruction,
    userPrompt,
    {
      mimeType: normalizedMime,
      data: base64Data,
    },
    teacherId,
    isPremium
  );

  const cleanMarkdown = markdownResult.trim();

  return {
    markdown: cleanMarkdown,
    fullText: cleanMarkdown.replace(/[#*`|_\-]/g, ' ').replace(/\s+/g, ' ').trim(),
    totalPages: 1,
    pages: [
      {
        pageNumber: 1,
        rawText: cleanMarkdown,
        markdown: cleanMarkdown,
      },
    ],
    metadata: {
      format: 'image',
      wordCount: cleanMarkdown.split(/\s+/).filter(Boolean).length,
      charCount: cleanMarkdown.length,
      ocrApplied: true,
      modelUsed: 'gemini-3.5-flash-lite',
    },
  };
}
