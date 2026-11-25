/**
 * salvage-and-dedupe.ts — Deduplicación semántica, extracción determinista de supervisor/zona y salvamento defensivo JSON.
 */

import type { PmcPlanElement, PmcPreviousExtractDTO } from '@/lib/prompts/pmc-extraction';
import { calculateWordOverlap } from '../plan-element-normalizer';
import { normalizeStaffName, isValidStaffName } from '../staff-reconciler';
import { logger } from '@/lib/logger';
import { jsonrepair } from 'jsonrepair';

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
    if (!s.nombre || !isValidStaffName(s.nombre)) continue;
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
  const zoneRegex = /(?:SUPERVISOR(?:A)?\s+ESCOLAR(?:\s+DE\s+LA)?\s+ZONA\s*[:\s]*|SUPERVISI[ÓO]N\s+ESCOLAR\s+(?:DE\s+LA\s+ZONA\s+)?|ZONA\s+ESCOLAR\s*[:\s]*|ZONA\s*[:\s]*)(\d{2,4}[A-Za-z]?)/i;
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
        const lineText = lines[j];
        const cells = lineText.includes('|')
          ? lineText.split('|').map((c) => c.replace(/⟦T\d+·R\d+·C\d+⟧/g, '').trim()).filter(Boolean)
          : [lineText];

        for (const candidate of cells) {
          if (/(?:Director|Plantel|Zona|BGE|CCT|Bachillerato|Autoriz|Vo\.?\s*Bo)/i.test(candidate)) continue;
          if (/^(?:LIC\.|ING\.|MTRO\.|MTRA\.|PROFR\.|PROFRA\.|C\.)\s+[A-ZÁÉÍÓÚÑ\s]{4,45}$/i.test(candidate)) {
            candidates.push(candidate);
          }
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

    let parsed: unknown = null;
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
      const pObj = parsed as Record<string, unknown>;
      if (typeof pObj.schoolName === 'string' && pObj.schoolName.trim()) {
        result.schoolName = pObj.schoolName.trim();
      }
      if (typeof pObj.directorName === 'string' && pObj.directorName.trim()) {
        result.directorName = pObj.directorName.trim();
      }

      const rawElems: unknown[] = Array.isArray(pObj.elementos_plan)
        ? pObj.elementos_plan
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
        const eo = e as Record<string, unknown>;
        const textoOrig = String(eo.texto_original || eo.meta || eo.actividad || eo.descripcion || '').trim();
        if (!textoOrig) continue;
        const textoNorm = String(eo.texto_normalizado || textoOrig).trim();
        const tipoLower = String(eo.tipo || 'meta').toLowerCase().trim();
        const validTipo = ['meta', 'actividad', 'estrategia', 'indicador', 'responsable', 'evidencia', 'cronograma', 'otro'].includes(tipoLower)
          ? tipoLower
          : tipoLower.includes('actividad') ? 'actividad' : 'meta';

        result.elementos.push({
          tipo: validTipo as PmcPlanElement['tipo'],
          numero_origen: Number(eo.numero_origen) || null,
          celda_ref: typeof eo.celda_ref === 'string' ? eo.celda_ref : null,
          texto_original: textoOrig,
          texto_normalizado: textoNorm,
          categoria: typeof eo.categoria === 'string' ? eo.categoria : '',
          tema: typeof eo.tema === 'string' ? eo.tema : '',
          responsable: typeof eo.responsable === 'string' ? eo.responsable : '',
          periodo: typeof eo.periodo === 'string' ? eo.periodo : '',
          ubicacion: typeof eo.ubicacion === 'object' && eo.ubicacion ? (eo.ubicacion as PmcPlanElement['ubicacion']) : {},
          requiere_revision: Boolean(eo.requiere_revision),
          motivos_revision: Array.isArray(eo.motivos_revision) ? (eo.motivos_revision as string[]) : [],
        });
      }

      if (Array.isArray(pObj.metas_institucionales_previas)) {
        for (const m of pObj.metas_institucionales_previas) {
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
          const mo = m as Record<string, unknown>;
          const metaText = String(mo.meta || mo.texto_original || '').trim();
          if (!metaText) continue;
          result.metas.push({
            numero_origen: Number(mo.numero_origen) || null,
            categoria: typeof mo.categoria === 'string' ? mo.categoria : '',
            tema: typeof mo.tema === 'string' ? mo.tema : '',
            meta: metaText,
            linea_base: typeof mo.linea_base === 'string' ? mo.linea_base : '',
            estrategia: typeof mo.estrategia === 'string' ? mo.estrategia : '',
            responsable: typeof mo.responsable === 'string' ? mo.responsable : '',
            entregable: typeof mo.entregable === 'string' ? mo.entregable : '',
            periodo: typeof mo.periodo === 'string' ? mo.periodo : '',
          });
        }
      }

      if (Array.isArray(pObj.staffData)) {
        for (const s of pObj.staffData) {
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
          if (typeof s !== 'object') continue;
          const so = s as Record<string, unknown>;
          if (!so.nombre) continue;
          result.staff.push({
            nombre: String(so.nombre).trim(),
            cargo: so.cargo ? String(so.cargo).trim() : 'Docente',
            meta_individual: so.meta_individual ? String(so.meta_individual).trim() : '',
            metas_individuales: Array.isArray(so.metas_individuales)
              ? (so.metas_individuales as NonNullable<PmcPreviousExtractDTO['staffData']>[number]['metas_individuales'])
              : [],
          });
        }
      }
    }
  } catch (err) {
    logger.warn('[salvagePlanElementsFromRaw] Error en salvamento defensivo:', err);
  }

  return result;
}

