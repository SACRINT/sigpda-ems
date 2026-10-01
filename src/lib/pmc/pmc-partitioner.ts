/**
 * pmc-partitioner.ts
 *
 * Utilidades deterministas para particionado estructural y cálculo de cobertura
 * real en documentos de PMC previo (>40 actividades/metas sin truncar, H-216).
 */

import type { PmcPlanElement, PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';
import {
  PMC_EXTRACTION_SYSTEM_PROMPT,
  buildPmcExtractionPrompt,
  buildPmcChunkExtractionPrompt,
  PmcPreviousExtractSchema,
} from '@/lib/prompts/pmc-extraction';
import {
  calculateWordOverlap,
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
} from './plan-element-normalizer';
import { normalizeStaffName } from './staff-reconciler';
import { generateWithRotation } from '@/lib/ai-provider';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { withTimeoutBudget, correctiveRetry } from '@/lib/ai-resilience';
import { logger } from '@/lib/logger';
import { jsonrepair } from 'jsonrepair';

/**
 * Localiza la sección acotada del Plan de Acción en el documento,
 * excluyendo el índice inicial (TOC) y la sección final de firmas / aprobación (H-298).
 */
export function findPlanActionSection(documentText: string): { planText: string; startIndex: number; endIndex: number } {
  if (!documentText) return { planText: '', startIndex: -1, endIndex: -1 };

  // 1. Encontrar todos los candidatos que contengan PLAN DE ACCIÓN / PLAN DE ACCION
  const regex = /PLAN\s+DE\s+ACC[IÍ][ÓO]N/gi;
  const matches = [...documentText.matchAll(regex)];

  let startIdx = -1;

  for (const m of matches) {
    const idx = m.index ?? -1;
    if (idx === -1) continue;

    // Verificar contexto previo (descartar si es "TUTORIAL" o si es una frase en minúsculas en medio de un párrafo)
    const prevText = documentText.slice(Math.max(0, idx - 60), idx);
    if (/TUTORIAL/i.test(prevText)) continue;
    if (/\b(?:elaborar|diseñar|aplicar|ejecutar|un|el|este)\s+$/i.test(prevText)) {
      // Es una mención en una frase como "elaborar un plan de acción", no un encabezado
      continue;
    }

    // Descartar si la línea tiene puntos suspensivos o comas de relleno de índice
    const lineEnd = documentText.indexOf('\n', idx + 1);
    const line = documentText.slice(Math.max(0, idx - 20), lineEnd !== -1 ? lineEnd : idx + 300);
    if (/[\.·…]{3,}|,{3,}/.test(line)) continue;

    // Descartar si es parte de un índice TOC seguido inmediatamente por otras secciones de índice
    const next500 = documentText.slice(idx, idx + 500);
    if (/(?:\d+[\.\)\-\s]+(?:Participantes|Aprobaci[óo]n|PRESENTACI[ÓO]N|DIAGN[ÓO]STICO))/i.test(next500)) {
      continue;
    }

    // Verificar que contenga contenido real de plan (categoría, tema, meta, tabla) en los siguientes 2500 caracteres
    const next2500 = documentText.slice(idx, idx + 2500);
    if (!/(?:CATEGOR[IÍ]A|META|TEMA|OBJETIVO|\|)/i.test(next2500)) {
      continue;
    }

    startIdx = idx;
    break;
  }

  if (startIdx === -1) {
    // Si ningún candidato cumplió los filtros estrictos, buscar la última ocurrencia como fallback
    const lastIdx = documentText.lastIndexOf('PLAN DE ACCI');
    if (lastIdx !== -1 && lastIdx > 500) {
      startIdx = lastIdx;
    }
  }

  if (startIdx === -1) {
    return { planText: documentText, startIndex: 0, endIndex: documentText.length };
  }

  const textFromPlan = documentText.slice(startIdx);

  // 2. Encontrar fin del plan: tabla de firmas / aprobación / personal participante / anexos
  const endRegex = /(?:^|\n)[*_#\s]*(?:\d+[\.\)\-]\s*)?(?:APROBACI[ÓO]N\s+DEL\s+PMC|PERSONAL\s+PARTICIPANTE|FIRMAS\s+DE\s+AUTORIZACI[ÓO]N|FIRMAS\s+DE\s+CONFORMIDAD|DIRECTORIO\s+DEL\s+PLANTEL)/i;
  const endMatch = textFromPlan.search(endRegex);

  const endIndex = endMatch !== -1 ? startIdx + endMatch : documentText.length;
  return {
    planText: documentText.slice(startIdx, endIndex),
    startIndex: startIdx,
    endIndex,
  };
}

/**
 * Cuenta filas de datos reales de tablas markdown dentro de la sección acotada del 'PLAN DE ACCIÓN' (H-293, H-298).
 * Identifica líneas iniciadas y terminadas por '|', excluyendo separadores (|---|) y filas de encabezado.
 */
export function countPlanTableRows(documentText: string): number {
  if (!documentText) return 0;

  const { planText } = findPlanActionSection(documentText);
  const textToScan = planText && planText.length > 100 ? planText : documentText;

  const lines = textToScan.split(/\r?\n/);
  let dataRowCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;

    // Separadores markdown tipo |---|---|---|
    if (/^\|[\s\-:|]+\|$/.test(line)) continue;

    // Fila de encabezado: si la línea siguiente es un separador de tabla, es encabezado
    const nextLine = (lines[i + 1] || '').trim();
    if (/^\|[\s\-:|]+\|$/.test(nextLine)) continue;

    // Descartar filas vacías de tabla | | | |
    const cells = line.split('|').slice(1, -1).map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;

    dataRowCount++;
  }

  return dataRowCount;
}

/**
 * Conteo determinista de actividades/metas esperadas a partir del texto del documento.
 * No depende de totales_detectados de la IA.
 * En documentos con tablas markdown del plan de acción cuenta filas reales; si no, aplica heurístico acotado (H-293, H-298).
 */
export function countDeterministicExpectedActivities(documentText: string): number {
  if (!documentText) return 0;

  // Acotar la sección del Plan de Acción excluyendo TOC y firmas finales (H-298)
  const { planText } = findPlanActionSection(documentText);
  const textToScan = planText && planText.length > 200 ? planText : documentText;

  // H-293: Conteo de filas reales de tablas markdown en el Plan de Acción
  const planTableRows = countPlanTableRows(documentText);
  if (planTableRows > 0) {
    return planTableRows;
  }

  // 1. Conteo determinista por bloques temáticos y ámbitos del plan
  const matchAmbitos = (
    textToScan.match(
      /(?:Ámbito\s*\/\s*Categoría|Tema:|__\*Reprobación|\*Reprobación|REPROBACIÓN|FORMACIÓN Y ACTUALIZACIÓN|Otras [Aa]ctividades)/gi
    ) || []
  ).length;

  const matchMetaKeywords = (
    textToScan.match(/(?:^|\n)[*_#\s]*(?:Meta\(s\)|Meta:?)/gi) || []
  ).length;

  const matchColon = (
    textToScan.match(/(?:^|\n)[*_#\s]*(?:\d+[\.\-]\s*)?Actividad(?:es)?\s*[:\(\-]/gi) || []
  ).length;

  const matchResponsables = (
    textToScan.match(/(?:ING\.|LIC\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.)\s+[A-ZÁÉÍÓÚÑ]/gi) || []
  ).length;

  const heuristico = Math.max(matchAmbitos, matchMetaKeywords + matchColon, matchResponsables);
  return heuristico > 0 ? heuristico : 1;
}

/**
 * Verifica si una respuesta textual de la IA llegó truncada (no cerró su bloque JSON).
 */
export function checkRawIsTruncated(rawText: string): boolean {
  if (!rawText || !rawText.trim()) return false;
  const trimmed = rawText.trim();
  // Quitar cercas markdown al final si existen
  const stripped = trimmed.replace(/```\s*$/i, '').trim();
  // Un JSON válido de objeto o arreglo debe terminar en } o ]
  return !stripped.endsWith('}') && !stripped.endsWith(']');
}

/**
 * Particiona el documento Markdown respetando fronteras estructurales
 * (sección de plan de acción, categorías, firmas, encabezados, docentes, actividades).
 */
export function partitionMarkdownDocument(
  markdown: string,
  minChunkSize = 8000,
  maxChunkSize = 16000
): string[] {
  if (!markdown || markdown.length <= maxChunkSize) {
    return [markdown];
  }

  const chunks: string[] = [];
  let remaining = markdown;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }

    const windowStart = Math.min(minChunkSize, remaining.length - 1);
    const windowEnd = Math.min(maxChunkSize, remaining.length);
    const searchWindow = remaining.slice(windowStart, windowEnd);

    // Patrones de corte en orden jerárquico de prioridad estructural (H-298)
    const structuralPatterns = [
      /\n(?=[*_#\s]*(?:(?:6\.\s*)?PLAN\s+DE\s+ACCI[ÓO]N\b|Categor[íi]a\s*\d+:))/gi,
      /\n(?=[*_#\s]*(?:APROBACI[ÓO]N\s+DEL\s+PMC|PERSONAL\s+PARTICIPANTE|FIRMAS\s+DE\s+AUTORIZACI[ÓO]N))/gi,
      /\n(?=#+\s)/g,
      /\n(?=__\*(?:Reprobaci[oó]n|Actividades|ACCIÓN))/gi,
      /\n(?=(?:__)?(?:\d+[\.\-]\s*)?Actividad(?:es)?:?)/gi,
      /\n(?=(?:ING\.|LIC\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.|DOCENTE|DIRECTOR)\s+[A-ZÁÉÍÓÚÑ])/g,
      /\n(?=\|[^\n]+\|\n\|[\s\-:|]+\|)/g,
      /\n(?=\|)/g,
      /\n\n/g,
      /\n/g,
    ];

    let bestSplitIndex = -1;
    for (const pattern of structuralPatterns) {
      const matches = [...searchWindow.matchAll(pattern)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        bestSplitIndex = windowStart + lastMatch.index!;
        break;
      }
    }

    if (bestSplitIndex === -1) {
      bestSplitIndex = Math.min(maxChunkSize, remaining.length);
    }

    const chunk = remaining.slice(0, bestSplitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(bestSplitIndex).trim();
  }

  // H-301: Propagación de cabeceras de tabla markdown a todos los subfragmentos derivados
  // Garantiza que escuelas masivas (15-15-15 o 20-20-20) mantengan columnas legibles en cada lote
  const tableHeaderMatch = markdown.match(/^([^\n]*\|[^\n]*\r?\n\|[\s\-:|]+\|\r?\n)/m);
  const tableHeader = tableHeaderMatch ? tableHeaderMatch[1] : '';

  if (tableHeader && chunks.length > 1) {
    for (let i = 1; i < chunks.length; i++) {
      if (!chunks[i].includes('---')) {
        chunks[i] = `${tableHeader}${chunks[i]}`;
      }
    }
  }

  return chunks.length > 0 ? chunks : [markdown];
}

/**
 * Deduplica elementos del plan de acción basándose en texto normalizado idéntico o solapamiento estricto bidireccional.
 * H-294: No fusiona elementos si sus responsables son distintos (evita colapso de actividades idénticas entre docentes).
 */
export function deduplicatePlanElements(elements: PmcPlanElement[]): PmcPlanElement[] {
  const result: PmcPlanElement[] = [];

  for (const elem of elements) {
    const textA = (elem.texto_normalizado || elem.texto_original || '').trim();
    if (!textA) continue;

    const exists = result.some((existing) => {
      // No fusionar elementos si explícitamente tienen tipos distintos (meta vs actividad)
      if (elem.tipo && existing.tipo && elem.tipo !== existing.tipo) return false;

      // H-294: Clave incluye responsable. Si ambos tienen responsable y difieren, NO son el mismo elemento
      const respA = normalizeStaffName(elem.responsable);
      const respB = normalizeStaffName(existing.responsable);
      if (respA && respB && respA !== respB) return false;

      const textB = (existing.texto_normalizado || existing.texto_original || '').trim();
      if (textA.toLowerCase() === textB.toLowerCase()) return true;
      const lenRatio = Math.min(textA.length, textB.length) / Math.max(textA.length, textB.length);
      // H-231: Umbral estricto para evitar colisión de metas diferentes con formato similar
      if (lenRatio >= 0.92 && calculateWordOverlap(textA, textB) >= 0.95) return true;
      return false;
    });

    if (!exists) {
      result.push(elem);
    }
  }

  return result;
}

/**
 * Deduplica metas previas basándose en redacción idéntica o solapamiento estricto bidireccional.
 * H-294: No fusiona metas si sus responsables son distintos.
 */
export function deduplicateMetasPrevias<
  T extends {
    meta?: string | null;
    texto_original?: string | null;
    categoria?: string | null;
    responsable?: string | null;
    personal_designado?: string | null;
  }
>(metas: T[]): T[] {
  const result: T[] = [];

  for (const m of metas) {
    const textA = (m.meta || m.texto_original || '').trim();
    if (!textA) continue;

    const exists = result.some((existing) => {
      // No fusionar metas si tienen categorías explícitamente distintas
      if (
        m.categoria &&
        existing.categoria &&
        m.categoria.trim().toLowerCase() !== existing.categoria.trim().toLowerCase()
      ) {
        return false;
      }

      // H-294: Clave incluye responsable normalizado
      const respA = normalizeStaffName(m.responsable || m.personal_designado);
      const respB = normalizeStaffName(existing.responsable || existing.personal_designado);
      if (respA && respB && respA !== respB) return false;

      const textB = (existing.meta || existing.texto_original || '').trim();
      if (textA.toLowerCase() === textB.toLowerCase()) return true;
      const lenRatio = Math.min(textA.length, textB.length) / Math.max(textA.length, textB.length);
      // H-231: Umbral estricto para evitar colisión de metas
      if (lenRatio >= 0.92 && calculateWordOverlap(textA, textB) >= 0.95) return true;
      return false;
    });

    if (!exists) {
      result.push(m);
    }
  }

  return result;
}

/**
 * Deduplica personal escolar por nombre normalizado (H-294).
 */
export function deduplicateStaffData<T extends { nombre?: string | null }>(staff: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const s of staff) {
    const norm = normalizeStaffName(s.nombre);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    result.push(s);
  }
  return result;
}

/**
 * Respaldo determinista de alta precisión para Zona Escolar y Supervisor(a) Escolar.
 * Busca patrones oficiales de supervisión y firmas al pie del documento si el LLM omitió la extracción.
 */
export function extractDeterministicSupervisorAndZone(
  documentText: string,
  directorName?: string | null
): { supervisorName?: string; schoolZone?: string } {
  const result: { supervisorName?: string; schoolZone?: string } = {};
  if (!documentText) return result;

  // 1. Zona Escolar: buscar menciones explícitas de supervisión escolar o zona escolar
  const zoneRegex = /(?:SUPERVISOR(?:A)?\s+ESCOLAR(?:\s+DE\s+LA)?\s+ZONA\s*[:\s]*|SUPERVISI[ÓO]N\s+ESCOLAR\s+(?:DE\s+LA\s+ZONA\s+)?|ZONA\s+ESCOLAR\s*[:\s]*)(\d{2,4}[A-Za-z]?)/i;
  const zoneMatch = documentText.match(zoneRegex);
  if (zoneMatch && zoneMatch[1]) {
    result.schoolZone = zoneMatch[1].trim();
  }

  // 2. Supervisor(a) Escolar: buscar en proximidad a "SUPERVISOR(A) ESCOLAR"
  const stripAccents = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

  const lines = documentText.split(/\r?\n/).map((l) => l.replace(/\\/g, '').trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (/SUPERVISOR(?:A)?\s+ESCOLAR/i.test(lines[i])) {
      const candidates: string[] = [];
      for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 4); j++) {
        if (j === i) continue;
        const candidate = lines[j];
        if (/(?:Director|Plantel|Zona|BGE|CCT|Bachillerato|Autoriz|Vo\.?\s*Bo)/i.test(candidate)) continue;
        if (/^(?:LIC\.|ING\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.|C\.)\s+[A-ZÁÉÍÓÚÑ\s]{4,45}$/i.test(candidate)) {
          candidates.push(candidate);
        }
      }
      const filtered = candidates.filter((c) => {
        if (!directorName) return true;
        const normC = stripAccents(c);
        const normD = stripAccents(directorName);
        return !normC.includes(normD) && !normD.includes(normC);
      });
      if (filtered.length > 0) {
        result.supervisorName = filtered[0].replace(/^(?:LIC\.|ING\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.|C\.)\s*/i, '').trim();
        break;
      }
    }
  }

  return result;
}

/**
 * Salvamento defensivo de elementos del plan, metas y personal a partir de texto crudo de IA
 * cuando el bloque completo no supera la validación Zod estricta (H-300).
 */
export function salvagePlanElementsFromRaw(rawText: string): {
  elementos: PmcPlanElement[];
  metas: NonNullable<PmcPreviousExtractDTO['metas_institucionales_previas']>;
  staff: NonNullable<PmcPreviousExtractDTO['staffData']>;
  schoolName?: string;
  directorName?: string;
} {
  const result: {
    elementos: PmcPlanElement[];
    metas: NonNullable<PmcPreviousExtractDTO['metas_institucionales_previas']>;
    staff: NonNullable<PmcPreviousExtractDTO['staffData']>;
    schoolName?: string;
    directorName?: string;
  } = { elementos: [], metas: [], staff: [] };

  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return result;

  try {
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed: any = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        parsed = JSON.parse(jsonrepair(cleaned));
      } catch {
        // Fallback defensivo: recuperación de objetos/arreglos truncados
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > 0) {
          try {
            parsed = JSON.parse(jsonrepair(cleaned.slice(0, lastBrace + 1) + ']}'));
          } catch {
            try {
              parsed = JSON.parse(jsonrepair(cleaned.slice(0, lastBrace + 1)));
            } catch {
              // Fallback adicional
            }
          }
        }
      }
    }

    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.schoolName === 'string' && parsed.schoolName.trim()) {
        result.schoolName = parsed.schoolName.trim();
      }
      if (typeof parsed.directorName === 'string' && parsed.directorName.trim()) {
        result.directorName = parsed.directorName.trim();
      }

      const rawElems = Array.isArray(parsed.elementos_plan)
        ? parsed.elementos_plan
        : Array.isArray(parsed)
        ? parsed
        : [];

      for (const e of rawElems) {
        if (!e) continue;
        if (typeof e === 'string' && e.trim()) {
          result.elementos.push({
            tipo: 'meta',
            numero_origen: null,
            celda_ref: null,
            texto_original: e.trim(),
            texto_normalizado: e.trim(),
            categoria: '',
            tema: '',
            responsable: '',
            periodo: '',
            ubicacion: {},
            requiere_revision: false,
            motivos_revision: [],
          });
          continue;
        }
        if (typeof e !== 'object') continue;
        const textoOrig = String(e.texto_original || e.meta || e.actividad || e.descripcion || '').trim();
        if (!textoOrig) continue;
        const textoNorm = String(e.texto_normalizado || textoOrig).trim();
        const tipoLower = String(e.tipo || 'meta').toLowerCase().trim();
        const validTipo = ['meta', 'actividad', 'estrategia', 'indicador', 'responsable', 'evidencia', 'cronograma', 'otro'].includes(tipoLower)
          ? tipoLower
          : tipoLower.includes('actividad') ? 'actividad' : 'meta';

        result.elementos.push({
          tipo: validTipo as any,
          numero_origen: Number(e.numero_origen) || null,
          celda_ref: e.celda_ref || null,
          texto_original: textoOrig,
          texto_normalizado: textoNorm,
          categoria: e.categoria || '',
          tema: e.tema || '',
          responsable: e.responsable || '',
          periodo: e.periodo || '',
          ubicacion: typeof e.ubicacion === 'object' && e.ubicacion ? e.ubicacion : {},
          requiere_revision: Boolean(e.requiere_revision),
          motivos_revision: Array.isArray(e.motivos_revision) ? e.motivos_revision : [],
        });
      }

      if (Array.isArray(parsed.metas_institucionales_previas)) {
        for (const m of parsed.metas_institucionales_previas) {
          if (!m) continue;
          if (typeof m === 'string' && m.trim()) {
            result.metas.push({
              numero_origen: null,
              categoria: '',
              tema: '',
              meta: m.trim(),
              linea_base: '',
              estrategia: '',
              responsable: '',
              entregable: '',
              periodo: '',
            });
            continue;
          }
          if (typeof m !== 'object') continue;
          const metaText = String(m.meta || m.texto_original || '').trim();
          if (!metaText) continue;
          result.metas.push({
            numero_origen: Number(m.numero_origen) || null,
            categoria: m.categoria || null,
            tema: m.tema || null,
            meta: metaText,
            linea_base: m.linea_base || null,
            estrategia: m.estrategia || null,
            responsable: m.responsable || null,
            entregable: m.entregable || null,
            periodo: m.periodo || null,
          });
        }
      }

      if (Array.isArray(parsed.staffData)) {
        for (const s of parsed.staffData) {
          if (!s) continue;
          if (typeof s === 'string' && s.trim()) {
            result.staff.push({
              nombre: s.trim(),
              cargo: 'Docente',
              meta_individual: '',
              metas_individuales: [],
            });
            continue;
          }
          if (typeof s !== 'object' || !s.nombre) continue;
          result.staff.push({
            nombre: String(s.nombre).trim(),
            cargo: s.cargo ? String(s.cargo).trim() : 'Docente',
            meta_individual: s.meta_individual ? String(s.meta_individual).trim() : '',
            metas_individuales: Array.isArray(s.metas_individuales) ? s.metas_individuales : [],
          });
        }
      }
    }
  } catch (err) {
    logger.warn('[salvagePlanElementsFromRaw] Error en salvamento defensivo:', err);
  }

  return result;
}

export interface PartitionedExtractionResult {
  success: boolean;
  data: PmcPreviousExtractDTO;
  warnings: string[];
  truncado: boolean;
  expectedActivities: number;
}

/**
 * Orquesta la extracción de PMC previo con particionado estructural y reintento en caso de
 * truncado o cobertura inferior al 90% (H-216).
 */
export async function extractPmcPreviousWithPartitioning(options: {
  documentText: string;
  teacherId?: string;
  isPremium?: boolean;
  deadline: number;
  contextName?: string;
}): Promise<PartitionedExtractionResult> {
  const { documentText, teacherId, isPremium = false, deadline, contextName = 'pmc-parse-previous' } = options;
  const warnings: string[] = [];
  const expectedActivities = countDeterministicExpectedActivities(documentText);

  // 1. Detección de particionado estructural respetando el Plan de Acción
  const { planText, startIndex, endIndex } = findPlanActionSection(documentText);
  const hasDistinctPlan = startIndex > 500 && planText.length > 500 && startIndex < documentText.length - 500;

  let chunks: string[] = [];
  if (hasDistinctPlan && (documentText.length > 15000 || expectedActivities >= 12)) {
    // Particionado estructural de alta fidelidad:
    // Trozo 1: Portada, Metadatos Institucionales, Diagnóstico Comunitario, FODA, Metas Generales (PLANEA) y Firmas / Aprobación final
    const tailText = endIndex !== -1 && endIndex < documentText.length ? documentText.slice(endIndex).trim() : '';
    const contextChunk = (documentText.slice(0, startIndex) + (tailText ? `\n\n# APROBACIÓN Y FIRMAS DEL PLANTEL\n${tailText}` : '')).trim();
    // Trozo 2..N: Sección especializada del Plan de Acción
    // Fragmentos balanceados (< 10,000 caracteres) respetando filas de tabla para evitar timeouts y saturación de tokens (document-extraction-engine)
    if (planText.length > 9000) {
      const planChunks = partitionMarkdownDocument(planText, 5000, 9500);
      chunks = [contextChunk, ...planChunks];
    } else {
      chunks = [contextChunk, planText.trim()];
    }
  } else if (documentText.length > 10000 || expectedActivities >= 12) {
    chunks = partitionMarkdownDocument(documentText, 5000, 9500);
  } else {
    chunks = [documentText];
  }

  let combinedData: PmcPreviousExtractDTO | null = null;
  let isTruncated = false;

  const extractSinglePass = async (textChunk: string, maxTokens = 32768) => {
    const systemPrompt = PMC_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildPmcExtractionPrompt(textChunk);

    const remainingBudget = Math.max(1, deadline - Date.now());
    const raw = await withTimeoutBudget(
      generateWithRotation(systemPrompt, userPrompt, teacherId, isPremium, {
        temperature: 0.1,
        jsonMode: true,
        maxTokens,
      }),
      remainingBudget
    );

    const truncated = checkRawIsTruncated(raw);

    let parsed = parseAIResponse(raw, PmcPreviousExtractSchema, {
      contextName,
      repairNullStrings: true,
    });

    if (!parsed.success) {
      parsed = await correctiveRetry({
        systemPrompt,
        previousRaw: raw,
        zodIssues: parsed.error || '',
        schema: PmcPreviousExtractSchema,
        callAI: (sys, user, remaining) =>
          withTimeoutBudget(
            generateWithRotation(sys, user, teacherId, isPremium, {
              temperature: 0,
              jsonMode: true,
              maxTokens,
            }),
            remaining
          ),
        deadline,
        contextName,
      });
    }

    return { parsed, raw, truncated };
  };

  const extractChunkPass = async (
    textChunk: string,
    chunkIndex: number,
    totalChunks: number,
    isInitialChunkWithContext = false,
    maxTokens = 32768
  ) => {
    const systemPrompt = PMC_EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = isInitialChunkWithContext
      ? buildPmcExtractionPrompt(textChunk)
      : buildPmcChunkExtractionPrompt(textChunk, chunkIndex, totalChunks);

    const remainingBudget = Math.max(1, deadline - Date.now());
    const raw = await withTimeoutBudget(
      generateWithRotation(systemPrompt, userPrompt, teacherId, isPremium, {
        temperature: 0.1,
        jsonMode: true,
        maxTokens,
      }),
      remainingBudget
    );

    const truncated = checkRawIsTruncated(raw);

    let parsed = parseAIResponse(raw, PmcPreviousExtractSchema, {
      contextName: `${contextName}-chunk-${chunkIndex + 1}`,
      repairNullStrings: true,
    });

    let finalRaw = raw;
    if (!parsed.success && Date.now() < deadline - 5000) {
      let retryRaw = '';
      parsed = await correctiveRetry({
        systemPrompt,
        previousRaw: raw,
        zodIssues: parsed.error || '',
        schema: PmcPreviousExtractSchema,
        callAI: async (sys, user, remaining) => {
          retryRaw = await withTimeoutBudget(
            generateWithRotation(sys, user, teacherId, isPremium, {
              temperature: 0,
              jsonMode: true,
              maxTokens,
            }),
            remaining
          );
          return retryRaw;
        },
        deadline,
        contextName: `${contextName}-chunk-${chunkIndex + 1}-retry`,
      });
      if (retryRaw) {
        finalRaw = retryRaw;
      }
    }

    return { parsed, raw: finalRaw, truncated };
  };

  // 1ª Pasada (Directa o por trozos)
  if (chunks.length === 1) {
    const res = await extractSinglePass(chunks[0], 32768);
    isTruncated = res.truncated;

    if (res.parsed.success) {
      combinedData = res.parsed.data;
      if (res.parsed.warnings) warnings.push(...res.parsed.warnings);

      // Enriquecer deterministamente zona y supervisor si no fueron detectados por la IA
      const isMeaningful = (val?: string | null) =>
        Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));
      const detZoneSup = extractDeterministicSupervisorAndZone(documentText, combinedData.directorName);
      if (!isMeaningful(combinedData.schoolZone) && detZoneSup.schoolZone) {
        combinedData.schoolZone = detZoneSup.schoolZone;
      }
      if (!isMeaningful(combinedData.supervisorName) && detZoneSup.supervisorName) {
        combinedData.supervisorName = detZoneSup.supervisorName;
      }
    } else {
      throw new Error(`No se pudieron estructurar los datos del PMC anterior: ${res.parsed.error}`);
    }

    // Comprobar si hubo truncado o cobertura insuficiente
    const extraidos = (combinedData.elementos_plan || []).length;
    const ratio = expectedActivities > 0 ? extraidos / expectedActivities : 1.0;

    // Si la 1ª pasada truncó o la cobertura es < 0.9 y hay más de 15 actividades esperadas, reintentar particionando
    if ((isTruncated || ratio < 0.9) && expectedActivities >= 15 && documentText.length > 20000) {
      // H-284: Evitar zona muerta entre 20k y 24k chars usando ventanas menores (8k-16k)
      const targetMaxChunk = Math.min(16000, Math.max(10000, Math.floor(documentText.length / 2) + 500));
      const targetMinChunk = Math.min(8000, Math.floor(targetMaxChunk * 0.7));
      let subChunks = partitionMarkdownDocument(documentText, targetMinChunk, targetMaxChunk);
      if (subChunks.length <= 1 && documentText.length > 10000) {
        const midPoint = Math.floor(documentText.length / 2);
        const splitIdx = documentText.indexOf('\n\n', midPoint);
        const cut = splitIdx !== -1 && splitIdx < midPoint + 2000 ? splitIdx : midPoint;
        subChunks = [documentText.slice(0, cut), documentText.slice(cut)];
      }

      logger.info(
        `[${contextName}] ⚠️ Cobertura insuficiente (${extraidos}/${expectedActivities}, ratio=${ratio.toFixed(2)}) o truncado=${isTruncated}. Activando particionado estructural en ${subChunks.length} trozos.`
      );
      warnings.push(
        `Activado particionado estructural por truncamiento o cobertura preliminar ${extraidos}/${expectedActivities}.`
      );

      if (subChunks.length > 1) {
        const accumulatedElementos: PmcPlanElement[] = [
          ...(combinedData.elementos_plan || []),
        ];
        const accumulatedMetas = [
          ...(combinedData.metas_institucionales_previas || []),
        ];
        const accumulatedStaff = [...(combinedData.staffData || [])];
        const accumulatedParticipantes = [...(combinedData.participantes || [])];

        // H-294: Ejecución concurrente con Promise.allSettled respetando presupuesto
        const chunkPromises = subChunks.map((chunk, i) =>
          extractChunkPass(chunk, i, subChunks.length, false)
        );
        const settled = await Promise.allSettled(chunkPromises);

        for (let i = 0; i < settled.length; i++) {
          const s = settled[i];
          if (s.status === 'fulfilled') {
            const subRes = s.value;
            if (subRes.truncated) isTruncated = true;
            if (subRes.parsed.success) {
              const subCount = (subRes.parsed.data.elementos_plan || []).length;
              if (subCount === 0 && subRes.raw && subRes.raw.includes('elementos_plan')) {
                const salvaged = salvagePlanElementsFromRaw(subRes.raw);
                if (salvaged.elementos.length > 0) {
                  accumulatedElementos.push(...salvaged.elementos);
                }
                if (salvaged.metas.length > 0) {
                  accumulatedMetas.push(...salvaged.metas);
                }
              } else if (subRes.parsed.data.elementos_plan) {
                accumulatedElementos.push(...subRes.parsed.data.elementos_plan);
              }
              if (subRes.parsed.data.metas_institucionales_previas) {
                accumulatedMetas.push(...subRes.parsed.data.metas_institucionales_previas);
              }
              if (subRes.parsed.data.staffData) {
                accumulatedStaff.push(...subRes.parsed.data.staffData);
              }
              if (subRes.parsed.data.participantes) {
                accumulatedParticipantes.push(...subRes.parsed.data.participantes);
              }
            } else {
              logger.warn(`[${contextName}] Error parseando subtrozo ${i + 1}: ${subRes.parsed.error}. Aplicando salvamento defensivo.`);
              const salvaged = salvagePlanElementsFromRaw(subRes.raw);
              if (salvaged.elementos.length > 0) {
                accumulatedElementos.push(...salvaged.elementos);
              }
              if (salvaged.metas.length > 0) {
                accumulatedMetas.push(...salvaged.metas);
              }
              if (salvaged.staff.length > 0) {
                accumulatedStaff.push(...salvaged.staff);
              }
            }
          } else {
            logger.warn(`[${contextName}] Falló promesa de subtrozo ${i + 1}:`, s.reason);
            warnings.push(`Fragmento ${i + 1} no completó su extracción a tiempo.`);
          }
        }

        if (accumulatedElementos.length === 0 && accumulatedMetas.length > 0) {
          accumulatedElementos.push(...deriveElementosFromMetasPrevias(accumulatedMetas));
        } else if (accumulatedMetas.length === 0 && accumulatedElementos.length > 0) {
          accumulatedMetas.push(...deriveMetasPreviasFromElementos(accumulatedElementos));
        }

        combinedData.elementos_plan = deduplicatePlanElements(accumulatedElementos);
        combinedData.metas_institucionales_previas = deduplicateMetasPrevias(accumulatedMetas);
        combinedData.staffData = deduplicateStaffData(accumulatedStaff);
        combinedData.participantes = [...accumulatedParticipantes];

        const isMeaningful = (val?: string | null) =>
          Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));
        const detZoneSup = extractDeterministicSupervisorAndZone(documentText, combinedData.directorName);
        if (!isMeaningful(combinedData.schoolZone) && detZoneSup.schoolZone) {
          combinedData.schoolZone = detZoneSup.schoolZone;
        }
        if (!isMeaningful(combinedData.supervisorName) && detZoneSup.supervisorName) {
          combinedData.supervisorName = detZoneSup.supervisorName;
        }
      }
    }
  } else {
    // Particionado inicial (texto extenso o estructurado en Plan de Acción)
    // Ejecución secuencial controlada para garantizar presupuesto completo y evitar colisiones de red
    const settled: PromiseSettledResult<any>[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (Date.now() >= deadline - 4000) {
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
        settled.push({ status: 'rejected', reason: new Error('Deadline reached') });
        break;
      }
      try {
        const res = await extractChunkPass(chunks[i], i, chunks.length, i === 0);
        settled.push({ status: 'fulfilled', value: res });
      } catch (err) {
        logger.warn(`[${contextName}] Falló trozo inicial ${i + 1}:`, err);
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
        settled.push({ status: 'rejected', reason: err });
      }
    }

    const accumulatedElementos: PmcPlanElement[] = [];
    const accumulatedMetas: NonNullable<PmcPreviousExtractDTO['metas_institucionales_previas']> = [];
    const accumulatedStaff: NonNullable<PmcPreviousExtractDTO['staffData']> = [];
    const accumulatedParticipantes: NonNullable<PmcPreviousExtractDTO['participantes']> = [];

    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === 'fulfilled') {
        const chunkRes = s.value;
        if (chunkRes.truncated) isTruncated = true;
        if (chunkRes.parsed.success) {
          const isMeaningful = (val?: string | null) =>
            Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));

          if (!combinedData) {
            combinedData = chunkRes.parsed.data;
          } else {
            // Fusión bidireccional de metadatos institucionales entre fragmentos
            if (!isMeaningful(combinedData.schoolName) && isMeaningful(chunkRes.parsed.data.schoolName)) {
              combinedData.schoolName = chunkRes.parsed.data.schoolName;
            }
            if (!isMeaningful(combinedData.schoolCct) && isMeaningful(chunkRes.parsed.data.schoolCct)) {
              combinedData.schoolCct = chunkRes.parsed.data.schoolCct;
            }
            if (!isMeaningful(combinedData.schoolZone) && isMeaningful(chunkRes.parsed.data.schoolZone)) {
              combinedData.schoolZone = chunkRes.parsed.data.schoolZone;
            }
            if (!isMeaningful(combinedData.supervisorName) && isMeaningful(chunkRes.parsed.data.supervisorName)) {
              combinedData.supervisorName = chunkRes.parsed.data.supervisorName;
            }
            if (!isMeaningful(combinedData.directorName) && isMeaningful(chunkRes.parsed.data.directorName)) {
              combinedData.directorName = chunkRes.parsed.data.directorName;
            }
            if (!isMeaningful(combinedData.municipality) && isMeaningful(chunkRes.parsed.data.municipality)) {
              combinedData.municipality = chunkRes.parsed.data.municipality;
            }
            if (!isMeaningful(combinedData.locality) && isMeaningful(chunkRes.parsed.data.locality)) {
              combinedData.locality = chunkRes.parsed.data.locality;
            }
            if (chunkRes.parsed.data.foda) {
              if (!combinedData.foda) combinedData.foda = {};
              const cf = chunkRes.parsed.data.foda;
              if (cf.fortalezas && !combinedData.foda.fortalezas) combinedData.foda.fortalezas = cf.fortalezas;
              if (cf.oportunidades && !combinedData.foda.oportunidades) combinedData.foda.oportunidades = cf.oportunidades;
              if (cf.debilidades && !combinedData.foda.debilidades) combinedData.foda.debilidades = cf.debilidades;
              if (cf.amenazas && !combinedData.foda.amenazas) combinedData.foda.amenazas = cf.amenazas;
            }
            if (i === 0 && combinedData) {
              const prev: PmcPreviousExtractDTO = combinedData;
              combinedData = {
                ...chunkRes.parsed.data,
                ...prev,
                elementos_plan: prev.elementos_plan,
                metas_institucionales_previas: prev.metas_institucionales_previas,
              };
            }
          }
          const elemCount = (chunkRes.parsed.data.elementos_plan || []).length;
          if (elemCount === 0 && chunkRes.raw && chunkRes.raw.includes('elementos_plan')) {
            const salvaged = salvagePlanElementsFromRaw(chunkRes.raw);
            if (salvaged.elementos.length > 0) {
              accumulatedElementos.push(...salvaged.elementos);
            }
            if (salvaged.metas.length > 0) {
              accumulatedMetas.push(...salvaged.metas);
            }
          } else if (chunkRes.parsed.data.elementos_plan) {
            accumulatedElementos.push(...chunkRes.parsed.data.elementos_plan);
          }
          if (chunkRes.parsed.data.metas_institucionales_previas) {
            accumulatedMetas.push(...chunkRes.parsed.data.metas_institucionales_previas);
          }
          if (chunkRes.parsed.data.staffData) {
            accumulatedStaff.push(...chunkRes.parsed.data.staffData);
          }
          if (chunkRes.parsed.data.participantes) {
            accumulatedParticipantes.push(...chunkRes.parsed.data.participantes);
          }
        } else {
          logger.warn(`[${contextName}] Fragmento inicial ${i + 1} no superó Zod estricto: ${chunkRes.parsed.error}. Aplicando salvamento defensivo.`);
          const salvaged = salvagePlanElementsFromRaw(chunkRes.raw);
          if (salvaged.elementos.length > 0) {
            accumulatedElementos.push(...salvaged.elementos);
          }
          if (salvaged.metas.length > 0) {
            accumulatedMetas.push(...salvaged.metas);
          }
          if (salvaged.staff.length > 0) {
            accumulatedStaff.push(...salvaged.staff);
          }
          if (salvaged.schoolName && combinedData && !combinedData.schoolName) {
            combinedData.schoolName = salvaged.schoolName;
          }
          if (salvaged.directorName && combinedData && !combinedData.directorName) {
            combinedData.directorName = salvaged.directorName;
          }
          if (salvaged.elementos.length === 0 && salvaged.metas.length === 0) {
            warnings.push(`Fragmento ${i + 1} presentó anomalías de formato y no pudo estructurar sus metas.`);
          }
        }
      } else {
        logger.warn(`[${contextName}] Falló trozo inicial ${i + 1}:`, s.reason);
        warnings.push(`Fragmento inicial ${i + 1} no completó a tiempo.`);
      }
    }

    if (!combinedData) {
      throw new Error('No se pudo extraer ningún fragmento estructurado del PMC anterior.');
    }

    // Sincronización bidireccional determinista entre elementos_plan y metas_institucionales_previas
    if (accumulatedElementos.length === 0 && accumulatedMetas.length > 0) {
      accumulatedElementos.push(...deriveElementosFromMetasPrevias(accumulatedMetas));
    } else if (accumulatedMetas.length === 0 && accumulatedElementos.length > 0) {
      accumulatedMetas.push(...deriveMetasPreviasFromElementos(accumulatedElementos));
    }

    combinedData.elementos_plan = deduplicatePlanElements(accumulatedElementos);
    combinedData.metas_institucionales_previas = deduplicateMetasPrevias(accumulatedMetas);
    combinedData.staffData = deduplicateStaffData([...(combinedData.staffData || []), ...accumulatedStaff]);
    combinedData.participantes = [...(combinedData.participantes || []), ...accumulatedParticipantes];

    // Respaldo determinista final para schoolZone y supervisorName
    const isMeaningful = (val?: string | null) =>
      Boolean(val && val.trim() && !/^(?:\(Sin detectar\)|Sin detectar|null|undefined|n\/a)$/i.test(val.trim()));
    const detZoneSup = extractDeterministicSupervisorAndZone(documentText, combinedData.directorName);
    if (!isMeaningful(combinedData.schoolZone) && detZoneSup.schoolZone) {
      combinedData.schoolZone = detZoneSup.schoolZone;
    }
    if (!isMeaningful(combinedData.supervisorName) && detZoneSup.supervisorName) {
      combinedData.supervisorName = detZoneSup.supervisorName;
    }
  }

  // H-295: Bucle de completitud (gap-fill) si la extracción quedó por debajo del 90%
  let currentExtraidos = (combinedData.elementos_plan || []).length;
  const effectiveExpected = Math.max(
    expectedActivities,
    combinedData.totales_detectados?.actividades || 0,
    combinedData.totales_detectados?.metas || 0
  );

  let gapRound = 0;
  const MAX_GAP_ROUNDS = 2;

  while (
    currentExtraidos < 0.9 * effectiveExpected &&
    effectiveExpected >= 10 &&
    Date.now() < deadline - 10000 &&
    gapRound < MAX_GAP_ROUNDS
  ) {
    gapRound++;
    const missingCount = Math.max(1, effectiveExpected - currentExtraidos);
    logger.info(
      `[${contextName}] 🔄 Iniciando ronda ${gapRound} de gap-fill. Extraídos: ${currentExtraidos}/${effectiveExpected} (faltan ~${missingCount}). Tiempo restante: ${deadline - Date.now()}ms`
    );

    const alreadyExtractedList = (combinedData.elementos_plan || [])
      .map(
        (e, idx) =>
          `${idx + 1}. [${e.tipo || 'elemento'}] ${e.responsable ? `(${e.responsable}) ` : ''}${(
            e.texto_original ||
            e.texto_normalizado ||
            ''
          ).slice(0, 100)}`
      )
      .slice(0, 60)
      .join('\n');

    const gapFillUserPrompt = `Ya se han extraído exitosamente los siguientes ${currentExtraidos} elementos del plan:
"""
${alreadyExtractedList}
"""
Sin embargo, el documento indica un total de aproximadamente ${effectiveExpected} metas/actividades (faltan alrededor de ${missingCount} por estructurar).

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 180000)}
"""

Tu tarea es extraer ÚNICAMENTE los elementos, metas o actividades FALTANTES que NO aparezcan en la lista anterior.
Devuelve el JSON con la misma estructura (elementos_plan y metas_institucionales_previas). No repitas los que ya están en la lista previa.`;

    try {
      const remainingBudget = Math.max(1, deadline - Date.now() - 3000);
      const gapRaw = await withTimeoutBudget(
        generateWithRotation(PMC_EXTRACTION_SYSTEM_PROMPT, gapFillUserPrompt, teacherId, isPremium, {
          temperature: 0.1,
          jsonMode: true,
          maxTokens: 16384,
        }),
        remainingBudget
      );

      const parsedGap = parseAIResponse(gapRaw, PmcPreviousExtractSchema, {
        contextName: `${contextName}-gapfill-${gapRound}`,
        repairNullStrings: true,
      });

      let newElements = (parsedGap.success && parsedGap.data.elementos_plan) ? parsedGap.data.elementos_plan : [];
      let newMetas = (parsedGap.success && parsedGap.data.metas_institucionales_previas) ? parsedGap.data.metas_institucionales_previas : [];

      if (newElements.length === 0 && gapRaw) {
        const salvagedGap = salvagePlanElementsFromRaw(gapRaw);
        if (salvagedGap.elementos.length > 0) {
          newElements = salvagedGap.elementos;
          newMetas = salvagedGap.metas;
        }
      }

      if (newElements.length > 0) {
        const mergedElements = [...(combinedData.elementos_plan || []), ...newElements];
        const mergedMetas = [...(combinedData.metas_institucionales_previas || []), ...newMetas];

        combinedData.elementos_plan = deduplicatePlanElements(mergedElements);
        combinedData.metas_institucionales_previas = deduplicateMetasPrevias(mergedMetas);

        const newCount = combinedData.elementos_plan.length;
        logger.info(
          `[${contextName}] ✅ Ronda ${gapRound} de gap-fill completada: +${newCount - currentExtraidos} nuevos elementos (total ahora: ${newCount}/${effectiveExpected}).`
        );

        if (newCount <= currentExtraidos) {
          // No se descubrieron elementos nuevos
          break;
        }
        currentExtraidos = newCount;
      } else {
        logger.info(`[${contextName}] Ronda ${gapRound} de gap-fill no arrojó nuevos elementos.`);
        break;
      }
    } catch (gapErr) {
      logger.warn(`[${contextName}] Error en ronda ${gapRound} de gap-fill:`, gapErr);
      break;
    }
  }

  return {
    success: true,
    data: combinedData,
    warnings,
    truncado: isTruncated,
    expectedActivities,
  };
}
