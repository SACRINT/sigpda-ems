import type { PdfParseResult } from '@/types/pdf-extraction';
import type { KeyActivity } from '@/types/planning';
import { callGeminiPool } from '@/lib/gemini';
import { ingestDocument } from '@/lib/document-ingestion';

/**
 * Universal document extraction and structuring for Curricular Programs (PDF, Word .docx, etc.):
 * 1. ingestDocument   → native DocumentIngestionEngine (pdfjs spatial layout, OCR fallback, or mammoth docx)
 * 2. Gemini Flash Lite → structures full extracted markdown into UAC fields
 */
export async function parsePdfBuffer(buffer: Buffer, filename?: string, targetSemester?: number): Promise<PdfParseResult> {
  const errors: string[] = [];

  // ── STEP 1: Ingest document into structured Markdown ──────────────────────
  let rawText = '';
  try {
    const doc = await ingestDocument(buffer, { filename, enableOcr: true });
    rawText = doc.markdown;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    console.error('[pdf-parser] Document ingestion failed:', msg);
    errors.push('No se pudo procesar el documento. El archivo puede estar dañado o con contraseña.');
  }

  if (!rawText || rawText.trim().length < 50) {
    return {
      success: false,
      confidence: 'failed',
      data: buildEmptyData(),
      rawText: '',
      errors: errors.length ? errors : [
        'El documento no contiene texto extraíble ni legible por OCR. Por favor captura los datos manualmente.',
      ],
    };
  }

  // ── STEP 2: Use callGeminiPool to structure the complete extracted text ────────
  try {
    const structured = await structureWithGemini(rawText, targetSemester);
    return structured;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[pdf-parser] Gemini structuring failed:', msg);

    // Return partial data — let user complete manually
    return {
      success: false,
      confidence: 'failed',
      data: buildEmptyData(),
      rawText,
      errors: [
        `No se pudieron estructurar los datos automáticamente: ${msg}. Por favor completa los campos manualmente.`,
      ],
    };
  }
}

// ─── Gemini text structuring ─────────────────────────────────────────────────

async function structureWithGemini(rawText: string, targetSemester?: number): Promise<PdfParseResult> {
  // Use complete extracted text (no arbitrary truncation - Gemini Flash Lite has 1M context)
  const systemInstruction = `Eres un experto en programas de estudio del bachillerato de la Nueva Escuela Mexicana en Puebla (MCCEMS/DBEPA). Responde exclusivamente con JSON válido, sin markdown ni explicaciones.`;

  const semesterDirective = targetSemester
    ? `ATENCIÓN: Este documento oficial contiene programas de estudio para múltiples semestres. Extrae EXCLUSIVAMENTE el programa correspondiente al Semestre ${targetSemester} (ejemplo: si targetSemester es 3, extrae los datos de 3er semestre / Pensamiento Matemático III / UAC III).`
    : `Si el documento contiene programas de múltiples semestres o UACs, extrae el primer programa completo y reporta el semestre correspondiente en el campo "semester".`;

  const prompt = `Analiza el siguiente texto extraído de un programa de estudios oficial y extrae los datos en formato JSON exacto:
${semesterDirective}

{
  "uacName": "Nombre completo de la UAC (Unidad de Aprendizaje Curricular) tal como aparece literalmente en el documento",
  "semester": número entero del semestre (1 a 6),
  "learningOutcome": "Resultado de aprendizaje completo tal como aparece en el documento",
  "totalHours": número entero de horas totales de la carga horaria de la UAC,
  "activities": [
    { "name": "Nombre literal de la Actividad Clave o del Propósito Formativo X", "hours": número de horas dosificadas, "order": 1 }
  ],
  "evidences": ["evidencia o producto esperado literal del programa"],
  "contenidosFormativos": [
    {
      "proposito": "Nombre literal y exacto del Propósito Formativo X",
      "contenidos": [
        "Tema o contenido formativo 1",
        "Tema o contenido formativo 2"
      ]
    }
  ]
}

REGLAS ABSOLUTAS DE EXTRACCIÓN Y CALIDAD:
1. COPIA VERBATIM (LITERAL): Copia el nombre de la UAC, el Resultado de aprendizaje, los Propósitos Formativos / Actividades Clave, los Contenidos Formativos (temas) y las Evidencias EXACTAMENTE palabra por palabra, tal como aparecen escritos en el documento original.
2. PROHIBIDO PARAFRASEAR: Queda estrictamente prohibido resumir, acortar, simplificar, reescribir, traducir o inventar palabras. El texto extraído debe ser idéntico al del programa original.
3. DETECCIÓN DE ACTIVIDADES / PROPÓSITOS:
   - Si es una UAC de Formación Laboral, extrae las "Actividades Clave" verbatim.
   - Si es una UAC de Currículum Fundamental o Ampliado (como Pensamiento Matemático, Ciencias, Lengua, etc.), extrae cada uno de los "Propósitos formativos" y asóciales sus "Contenidos Formativos" (temas o contenidos específicos) verbatim en el campo "contenidosFormativos".
4. Si hay múltiples UACs o programas en el texto, extrae únicamente la información de la primera.
5. Responde exclusivamente con el JSON, sin agregar explicaciones ni markdown.

TEXTO DEL PROGRAMA:
${rawText}`;

  const rawJsonText = await callGeminiPool(systemInstruction, prompt);
  const cleanJson = rawJsonText
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  const parsed = JSON.parse(cleanJson);

  const activities: KeyActivity[] = Array.isArray(parsed.activities)
    ? parsed.activities
        .filter((a: { name?: string }) => a?.name)
        .map((a: { name: string; hours?: number; order?: number }, i: number) => ({
          name: removeHyphens(String(a.name).trim()),
          hours: Number(a.hours) || Math.round((parsed.totalHours || 54) / 3),
          order: Number(a.order) || i + 1,
        }))
    : [];

  const finalActivities =
    activities.length > 0
      ? activities
      : [
          { name: '', hours: 18, order: 1 },
          { name: '', hours: 18, order: 2 },
          { name: '', hours: 18, order: 3 },
        ];

  const evidences = Array.isArray(parsed.evidences)
    ? parsed.evidences.filter((e: string) => e?.length > 3).slice(0, 8)
    : [];

  const data = {
    uacName: parsed.uacName ? removeHyphens(String(parsed.uacName).trim()) : '',
    learningOutcome: parsed.learningOutcome ? removeHyphens(String(parsed.learningOutcome).trim()) : '',
    totalHours: Number(parsed.totalHours) || 54,
    activities: finalActivities,
    evidences: evidences.map((e: string) => removeHyphens(e)),
    contenidosFormativos: Array.isArray(parsed.contenidosFormativos) ? parsed.contenidosFormativos : undefined,
    parseConfidence: 'high' as const,
  };

  const hasData = !!(data.uacName && data.totalHours > 0);

  return {
    success: hasData,
    confidence: hasData ? 'high' : 'low',
    data,
    rawText,
    errors: hasData
      ? []
      : ['Algunos datos no se pudieron extraer. Por favor revisa y completa los campos.'],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEmptyData() {
  return {
    uacName: '',
    learningOutcome: '',
    totalHours: 54,
    activities: [
      { name: '', hours: 18, order: 1 },
      { name: '', hours: 18, order: 2 },
      { name: '', hours: 18, order: 3 },
    ],
    evidences: [] as string[],
    parseConfidence: 'failed' as const,
  };
}

function removeHyphens(text: string): string {
  if (!text) return '';
  return text
    // Replace soft hyphens
    .replace(/\u00ad/g, '')
    // Replace standard hyphen followed by newline and optional spaces
    .replace(/([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s*[\r\n]\s*([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)/g, '$1$2')
    // Replace standard hyphen followed by spaces
    .replace(/([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)-\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ]+)/g, '$1$2');
}
