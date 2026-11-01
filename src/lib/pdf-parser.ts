import type { PdfParseResult } from '@/types/pdf-extraction';
import type { KeyActivity } from '@/types/planning';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PdfProgramExtractSchema } from '@/lib/ai-schemas';
import { removeHyphens } from '@/lib/text-utils';
import { getProgramByUacAndSemester } from '@/lib/db/programs-catalog';

/**
 * Distribución determinista de horas y cortes para N progresiones sumando 54h (18h por Corte).
 */
export function distributeProgressionHoursAndCorte(
  index: number,
  totalProgressions: number,
  totalHours: number = 54
): { hours: number; corte: 'Corte 1' | 'Corte 2' | 'Corte 3' } {
  if (totalProgressions === 8 && totalHours === 54) {
    const hoursList = [6, 6, 6, 6, 6, 6, 9, 9];
    const cortesList: Array<'Corte 1' | 'Corte 2' | 'Corte 3'> = [
      'Corte 1', 'Corte 1', 'Corte 1',
      'Corte 2', 'Corte 2', 'Corte 2',
      'Corte 3', 'Corte 3',
    ];
    return {
      hours: hoursList[index] ?? 6,
      corte: cortesList[index] ?? 'Corte 3',
    };
  }
  if (totalProgressions === 7 && totalHours === 54) {
    const hoursList = [9, 9, 6, 6, 6, 9, 9];
    const cortesList: Array<'Corte 1' | 'Corte 2' | 'Corte 3'> = [
      'Corte 1', 'Corte 1',
      'Corte 2', 'Corte 2', 'Corte 2',
      'Corte 3', 'Corte 3',
    ];
    return {
      hours: hoursList[index] ?? 6,
      corte: cortesList[index] ?? 'Corte 3',
    };
  }
  const base = Math.floor(totalHours / Math.max(1, totalProgressions));
  const rem = totalHours % Math.max(1, totalProgressions);
  const hours = base + (index < rem ? 1 : 0);
  const corteNum = Math.min(3, Math.floor((index * 3) / Math.max(1, totalProgressions)) + 1) as 1 | 2 | 3;
  return { hours, corte: `Corte ${corteNum}` };
}

/**
 * Limpia introducciones genéricas ("El Taller de..., considera los mismos aprendizajes de trayectoria...")
 * y conserva únicamente los enunciados reales de Aprendizajes de trayectoria.
 */
export function cleanLearningOutcomeText(rawOutcome: string): string {
  if (!rawOutcome) return '';
  const cleaned = removeHyphens(rawOutcome).replace(/\s+/g, ' ').trim();
  // Si contiene viñetas (• o ●), extraer desde la primera viñeta
  const bulletIdx = cleaned.search(/[•●▪]/);
  if (bulletIdx !== -1) {
    return cleaned.slice(bulletIdx).trim();
  }
  // Eliminar párrafo introductorio de acuerdo secretarial si va seguido de dos puntos
  const withoutIntro = cleaned.replace(
    /^.*?(?:se presentan a continuaci[óo]n|considera los siguientes aprendizajes de trayectoria)\s*:\s*/i,
    ''
  ).trim();
  return withoutIntro || cleaned;
}

/**
 * Extractor determinista multilínea para programas oficiales MCCEMS de Progresiones (5.º y 6.º semestre).
 * Soporta encabezados partidos en varias líneas ("Progresión\n6:"), extrae el párrafo completo hasta
 * la tabla de Metas/Categorías/Subcategorías, y recupera los Aprendizajes de trayectoria reales.
 */
export function extractDeterministicMccemsProgram(
  rawText: string,
  targetSemester?: number
): {
  uacName: string;
  semester: number;
  totalHours: number;
  learningOutcome: string;
  activities: Array<KeyActivity & {
    description?: string;
    corte?: string;
    categorias?: string[];
    subcategorias?: string[];
    metas?: string[];
    contenidoFormativo?: string;
  }>;
  contenidosFormativos: Array<{
    numero?: number;
    proposito: string;
    progresion?: string;
    categorias?: string[];
    subcategorias?: string[];
    metas?: string[];
    contenidos: string[];
  }>;
} | null {
  if (!rawText || rawText.length < 100) return null;

  const text = rawText.replace(/\u200b/g, '').replace(/\r\n/g, '\n');

  // 1. Extraer Aprendizajes de trayectoria reales (saltando introducción genérica)
  let learningOutcome = '';
  const loMatch = text.match(
    /II\.\s*Aprendizajes\s+de\s+trayectoria([\s\S]*?)(?:III\.\s*Progresiones|Progresiones\s+de\s+[Aa]prendizaje)/i
  );
  if (loMatch) {
    const loBlock = loMatch[1];
    const bullets = loBlock.split(/[●•▪]/).map(s => removeHyphens(s).replace(/\s+/g, ' ').trim()).filter(s => s.length > 20);
    if (bullets.length > 1) {
      // El primer fragmento antes del primer bullet suele ser el párrafo introductorio ("El Taller de...")
      const authenticBullets = bullets.filter(
        b => !/se presentan a continuaci[óo]n\s*:?$|considera los mismos aprendizajes|considera los siguientes aprendizajes/i.test(b)
      );
      learningOutcome = authenticBullets.map(b => `• ${b}`).join(' ');
    } else {
      learningOutcome = cleanLearningOutcomeText(loBlock);
    }
  }

  // 2. Localizar la sección III. Progresiones de aprendizaje
  let progSection = text;
  const sec3Match = text.match(/(?:III\.\s*Progresiones[\s\S]*?|(?:^|\n)\s*Progresiones\s+de\s+[Aa]prendizaje\s*\n)([\s\S]*)/i);
  if (sec3Match) {
    progSection = sec3Match[1];
  }
  const sec4Idx = progSection.search(/\n\s*IV\.\s*Transversalidad|\n\s*Dosificaci[óo]n\s+sugerida/i);
  if (sec4Idx !== -1) {
    progSection = progSection.slice(0, sec4Idx);
  }

  // 3. Detectar cada "Progresión N:" permitiendo saltos de línea entre "Progresión" y el número
  const progRegex = /(?:^|\n)\s*(?:#+\s*|\*\*)*Progresi[óo]n\s*(?:\n\s*)*(\d{1,2})\s*(?:\*\*)*\s*[:.]?\s*/gi;
  const matches = Array.from(progSection.matchAll(progRegex));
  if (matches.length < 3) {
    return null;
  }

  const byOrder = new Map<number, {
    description: string;
    categorias: string[];
    subcategorias: string[];
    metas: string[];
  }>();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const order = parseInt(m[1], 10);
    if (isNaN(order) || order < 1 || order > 20 || byOrder.has(order)) continue;

    const startIdx = (m.index ?? 0) + m[0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? progSection.length) : progSection.length;
    const chunk = progSection.slice(startIdx, endIdx);

    // Separar el texto de la progresión de la tabla de Metas / Categorías / Subcategorías
    const tableStop = chunk.search(
      /\n\s*(?:\|\s*)?(?:\*\*)?(?:Metas\b|Conceptos?\s+central(?:es)?\b|Categor[íi]as\b|Etapa\s+de\s+la\s+progresi[óo]n\b|Contenidos\s+centrales\b)/i
    );
    const rawDescPart = tableStop !== -1 ? chunk.slice(0, tableStop) : chunk;
    const metaPart = tableStop !== -1 ? chunk.slice(tableStop) : '';

    // Limpiar números de página sueltos o encabezados repetidos de UAC dentro del bloque
    const descLines = rawDescPart
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^\d{1,3}$/.test(l) && !/^(?:Taller de |Dibujo T[ée]cnico )/i.test(l));

    const description = removeHyphens(descLines.join(' ')).replace(/\s+/g, ' ').trim();
    if (description.length < 25) continue;

    const categorias: string[] = [];
    const subcategorias: string[] = [];
    const metas: string[] = [];

    for (const cm of metaPart.matchAll(/C\d\s*\.\s*[^\n|]+/g)) {
      const val = removeHyphens(cm[0]).replace(/\s+/g, ' ').trim();
      if (val && !categorias.includes(val) && val.length < 120) categorias.push(val);
    }
    for (const sm of metaPart.matchAll(/S\d\s*[\.\s]\s*[^\n|]+/g)) {
      const val = removeHyphens(sm[0]).replace(/\s+/g, ' ').trim();
      if (val && !subcategorias.includes(val) && val.length < 140) subcategorias.push(val);
    }
    for (const mm of metaPart.matchAll(/(?:C\d)?M\d\s*\.\s*[^\n|]+/g)) {
      const val = removeHyphens(mm[0]).replace(/\s+/g, ' ').trim();
      if (val && !metas.includes(val) && val.length > 10) metas.push(val);
    }

    byOrder.set(order, { description, categorias, subcategorias, metas });
  }

  if (byOrder.size < 3) return null;

  // Inferir nombre de UAC y semestre
  let uacName = '';
  const uacMatch = text.match(/(?:Taller\s+de\s+Pensamiento\s+Variacional\s+(?:I{1,2})|Dibujo\s+T[ée]cnico\s+(?:I{1,2})|[A-ZÁÉÍÓÚÑ][^\n]{5,70}\s+(?:I{1,2}|V|VI))\b/);
  if (uacMatch) {
    uacName = removeHyphens(uacMatch[0]).replace(/\s+/g, ' ').trim();
  }
  const semester = targetSemester || (/\b(?:II|VI|Sexto\s+Semestre)\b/i.test(uacName || text.slice(0, 1500)) ? 6 : 5);
  const totalHours = 54;

  const sortedOrders = Array.from(byOrder.keys()).sort((a, b) => a - b);
  const totalN = sortedOrders.length;

  const activities = sortedOrders.map((ord, idx) => {
    const item = byOrder.get(ord)!;
    const { hours, corte } = distributeProgressionHoursAndCorte(idx, totalN, totalHours);
    const fullProgName = `Progresión ${ord}: ${item.description}`;
    const cfParts: string[] = [];
    if (item.categorias.length > 0) cfParts.push(`Categorías: ${item.categorias.join('; ')}`);
    if (item.subcategorias.length > 0) cfParts.push(`Subcategorías: ${item.subcategorias.join('; ')}`);
    if (item.metas.length > 0) cfParts.push(`Metas: ${item.metas.join(' ')}`);
    const contenidoFormativo = cfParts.join(' | ');

    return {
      order: ord,
      name: fullProgName,
      description: item.description,
      hours,
      corte,
      categorias: item.categorias,
      subcategorias: item.subcategorias,
      metas: item.metas,
      contenidoFormativo,
    };
  });

  const contenidosFormativos = activities.map(a => ({
    numero: a.order,
    proposito: a.name,
    progresion: a.name,
    categorias: a.categorias,
    subcategorias: a.subcategorias,
    metas: a.metas,
    contenidos: [
      ...(a.categorias || []).map(c => `Categoría: ${c}`),
      ...(a.subcategorias || []).map(s => `Subcategoría: ${s}`),
      ...(a.metas || []).map(m => `Meta: ${m}`),
    ],
  }));

  return {
    uacName,
    semester,
    totalHours,
    learningOutcome,
    activities,
    contenidosFormativos,
  };
}

/**
 * Universal document extraction and structuring for Curricular Programs (PDF, Word .docx, etc.):
 * 1. ingestDocument   → native DocumentIngestionEngine (pdfjs spatial layout, OCR fallback, or mammoth docx)
 * 2. AI Provider (Gemini / Claude / Multi-provider) → structures full extracted markdown into UAC fields
 */
export async function parsePdfBuffer(buffer: Buffer, filename?: string, targetSemester?: number, teacherId?: string): Promise<PdfParseResult> {
  const errors: string[] = [];

  // ── STEP 1: Ingest document into structured Markdown ──────────────────────
  let rawText = '';
  try {
    const doc = await ingestDocument(buffer, { filename, enableOcr: true, teacherId });
    rawText = doc.markdown;
  } catch (err) {
    logger.error('[pdf-parser] Document ingestion failed:', err instanceof Error ? err.message : err);
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

  // ── STEP 1.5: Deterministic MCCEMS Progresiones Extractor + Catalog Lookup ──
  const deterministicMccems = extractDeterministicMccemsProgram(rawText, targetSemester);
  if (deterministicMccems && deterministicMccems.activities.length >= 4) {
    let finalActivities = deterministicMccems.activities;
    let finalLearningOutcome = deterministicMccems.learningOutcome;
    const finalContenidosFormativos = deterministicMccems.contenidosFormativos;
    let finalUacName = deterministicMccems.uacName;
    const sem = targetSemester || deterministicMccems.semester;

    // Si existe en programs_catalog para 5.º/6.º semestre, enriquecer con datos oficiales canónicos
    if (finalUacName && process.env.DATABASE_URL) {
      try {
        const catProg = await getProgramByUacAndSemester(finalUacName, sem);
        if (catProg) {
          finalUacName = catProg.uac_name || finalUacName;
          if (catProg.learning_outcome && catProg.learning_outcome.length > 40) {
            finalLearningOutcome = cleanLearningOutcomeText(catProg.learning_outcome);
          }
          const catActs = Array.isArray(catProg.activities) ? catProg.activities : [];
          if (catActs.length >= 4) {
            finalActivities = catActs.map((a: Record<string, unknown>, idx: number) => {
              const ord = Number(a.order) || idx + 1;
              const desc = String(a.description || a.name || '').replace(/^Progresi[óo]n\s*\d+\s*[:.]?\s*/i, '').trim();
              const fullProgName = /^Progresi[óo]n\s*\d+/i.test(String(a.name || ''))
                ? String(a.name)
                : `Progresión ${ord}: ${desc}`;
              const { hours, corte } = distributeProgressionHoursAndCorte(idx, catActs.length, catProg.total_hours || 54);
              return {
                order: ord,
                name: fullProgName,
                description: desc,
                hours: Number(a.hours) || hours,
                corte: String(a.corte || corte),
                categorias: Array.isArray(a.categorias) ? (a.categorias as string[]) : undefined,
                subcategorias: Array.isArray(a.subcategorias) ? (a.subcategorias as string[]) : undefined,
                metas: Array.isArray(a.metas) ? (a.metas as string[]) : undefined,
                contenidoFormativo: typeof a.contenidoFormativo === 'string' ? a.contenidoFormativo : undefined,
              };
            });
          }
        }
      } catch (catErr) {
        logger.warn('[pdf-parser] Optional catalog enrichment skipped:', catErr);
      }
    }

    return {
      success: true,
      confidence: 'high',
      data: {
        uacName: finalUacName,
        learningOutcome: finalLearningOutcome,
        totalHours: deterministicMccems.totalHours || 54,
        activities: finalActivities,
        evidences: [],
        contenidosFormativos: finalContenidosFormativos,
        parseConfidence: 'high',
      },
      rawText,
      errors: [],
    };
  }

  // ── STEP 2: Use AI Provider to structure the complete extracted text ────────
  try {
    const structured = await structureWithAI(rawText, targetSemester, teacherId);
    return structured;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    logger.error('[pdf-parser] AI structuring failed:', err);

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

// ─── AI text structuring ─────────────────────────────────────────────────────

async function structureWithAI(rawText: string, targetSemester?: number, teacherId?: string): Promise<PdfParseResult> {
  // Use complete extracted text (no arbitrary truncation - Gemini Flash Lite has 1M context)
  const systemInstruction = `Eres un experto en programas de estudio del bachillerato de la Nueva Escuela Mexicana en Puebla (MCCEMS). Responde exclusivamente con JSON válido, sin markdown ni explicaciones.`;

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
3. DETECCIÓN DE ACTIVIDADES / PROPÓSITOS / PROGRESIONES:
   - Si es una UAC de Formación Laboral, extrae las "Actividades Clave" verbatim.
   - Si es una UAC de 5.º o 6.º semestre bajo el modelo de Progresiones (MCCEMS 2023), extrae TODAS las "Progresiones de Aprendizaje" completas (ej. Progresión 1 a 7 u 8 según el PDF oficial, incluso si el encabezado "Progresión\n6:" está partido en dos líneas). NUNCA trunques al primer renglón; copia el párrafo íntegro de cada progresión. En "learningOutcome", extrae los puntos (viñetas) de "II. Aprendizajes de trayectoria", omitiendo el párrafo introductorio genérico ("El Taller de..., al formar parte...").
   - Si es una UAC de Currículum Fundamental o Ampliado (1.º a 4.º semestre), extrae cada uno de los "Propósitos formativos" y asóciales sus "Contenidos Formativos" (temas o contenidos específicos) verbatim en el campo "contenidosFormativos".
4. Si hay múltiples UACs o programas en el texto, extrae únicamente la información de la primera.
5. Responde exclusivamente con el JSON, sin agregar explicaciones ni markdown.

TEXTO DEL PROGRAMA:
${rawText}`;

  const isPremium = await resolveUserIsPremium(teacherId);
  const rawJsonText = await generateWithRotation(
    systemInstruction,
    prompt,
    teacherId,
    isPremium,
    { jsonMode: true }
  );
  const parseResult = parseAIResponse(rawJsonText, PdfProgramExtractSchema, { contextName: 'pdf_program_extract' });
  if (!parseResult.success) {
    throw new Error(`Error estructurando programa con IA: ${parseResult.error}`);
  }
  const parsed = parseResult.data;

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

