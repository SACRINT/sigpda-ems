// src/lib/pmc-meta-deduplicator.ts
/**
 * Single Source of Truth (SSoT) para la deduplicación y consolidación silenciosa
 * de metas institucionales del Programa de Mejora Continua (PMC).
 * 
 * Resuelve H-150:
 * 1. Normalización estricta (minúsculas, sin acentos ni puntuación, sin prefijos redundantes).
 * 2. Similitud semántica por solapamiento de tokens y concordancia de indicadores clave.
 * 3. Precedencia obligatoria de metas capturadas en indicadores_academicos.*_meta sobre texto generado por IA.
 * 4. Fusión y descarte silencioso sin interrupciones ni prompts en UI.
 */

import type { PmcMetaInstitucional, PmcIndicadoresAcademicos } from '@/types/pmc';

/**
 * Normaliza el texto de una meta para comparación léxica y semántica.
 */
export function normalizeMetaText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos/acentos
    .replace(/\[continuidad[^\]]*\]/gi, '') // Quitar prefijo de continuidad
    .replace(/[^a-z0-9\s]/g, ' ') // Quitar puntuación
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'que', 'los', 'del', 'las', 'por', 'un', 'para', 'con',
  'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'le', 'ya', 'o', 'este',
  'si', 'porque', 'esta', 'son', 'entre', 'sobre', 'tambien', 'me', 'hasta', 'hay', 'donde',
  'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros',
  'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mi', 'antes', 'algunos', 'unos', 'yo', 'otro',
  'otras', 'otra', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual',
  'sea', 'poco', 'ella', 'estar', 'haber', 'estas', 'estaba', 'estamos', 'estan', 'estando',
  'meta', 'lograr', 'implementar', 'desarrollar', 'fortalecer', 'realizar', 'alcanzar'
]);

/**
 * Calcula el índice de similitud Jaccard sobre el conjunto de palabras clave de dos textos.
 */
export function computeMetaSimilarity(textA?: string | null, textB?: string | null): number {
  const normA = normalizeMetaText(textA);
  const normB = normalizeMetaText(textB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w)));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w)));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export type MetaTopicKey =
  | 'abandono'
  | 'aprobacion_reprobacion'
  | 'eficiencia_egreso'
  | 'formacion_docente'
  | 'socioemocional'
  | 'convivencia_violencia'
  | 'infraestructura'
  | 'vinculacion_comunitaria'
  | 'general';

/**
 * Determina el ámbito semántico real de una meta evaluando categoría, tema, redacción y estrategia.
 * Corrige discrepancias de miscategorización (ej. metas de abandono bajo 'Trabajo colegiado').
 */
export function detectMetaTopic(meta: PmcMetaInstitucional): MetaTopicKey {
  const fullText = normalizeMetaText(
    `${meta.categoria || ''} ${meta.nombre_categoria || ''} ${meta.tema || ''} ${meta.meta || ''} ${meta.estrategia || ''}`
  );

  if (fullText.includes('abandono') || fullText.includes('desercion') || fullText.includes('permanencia')) {
    return 'abandono';
  }
  if (
    fullText.includes('reprobacion') ||
    fullText.includes('aprobacion') ||
    fullText.includes('aprovechamiento') ||
    fullText.includes('rezago academico') ||
    fullText.includes('evaluacion diagnostica')
  ) {
    return 'aprobacion_reprobacion';
  }
  if (
    fullText.includes('eficiencia terminal') ||
    fullText.includes('egresado') ||
    fullText.includes('titulacion') ||
    fullText.includes('egreso') ||
    fullText.includes('graduacion')
  ) {
    return 'eficiencia_egreso';
  }
  if (
    fullText.includes('formacion docente') ||
    fullText.includes('actualizacion docente') ||
    fullText.includes('capacitacion docente') ||
    fullText.includes('desempeno docente') ||
    fullText.includes('competencias docentes') ||
    fullText.includes('trabajo colegiado')
  ) {
    return 'formacion_docente';
  }
  if (
    fullText.includes('socioemocional') ||
    fullText.includes('habilidades socioemocionales') ||
    fullText.includes('bienestar') ||
    fullText.includes('tutoria') ||
    fullText.includes('salud mental')
  ) {
    return 'socioemocional';
  }
  if (
    fullText.includes('violencia') ||
    fullText.includes('convivencia') ||
    fullText.includes('paz') ||
    fullText.includes('acoso') ||
    fullText.includes('clima escolar')
  ) {
    return 'convivencia_violencia';
  }
  if (
    fullText.includes('infraestructura') ||
    fullText.includes('equipamiento') ||
    fullText.includes('aulas') ||
    fullText.includes('computo') ||
    fullText.includes('talleres') ||
    fullText.includes('sanitarios')
  ) {
    return 'infraestructura';
  }
  if (
    fullText.includes('paec') ||
    fullText.includes('comunitari') ||
    fullText.includes('vinculacion') ||
    fullText.includes('telesecundaria')
  ) {
    return 'vinculacion_comunitaria';
  }
  return 'general';
}

/**
 * Aplica la regla de precedencia obligatoria:
 * Si los indicadores académicos capturados tienen metas cuantitativas fijadas (ej. abandono_meta = 3),
 * cualquier texto alucinado o inconsistente generado por la IA (ej. "al 0%") se alinea a la meta oficial.
 */
export function applyIndicatorPrecedence<T extends PmcMetaInstitucional>(
  meta: T,
  indicadores?: PmcIndicadoresAcademicos | null
): T {
  if (!indicadores) return { ...meta };
  const topic = detectMetaTopic(meta);
  const updated = { ...meta };

  if (topic === 'abandono' && indicadores.abandono_meta !== undefined && indicadores.abandono_meta !== null) {
    const target = Number(indicadores.abandono_meta);
    if (!Number.isNaN(target)) {
      if (updated.meta) {
        // Reemplazar contradicciones como "al 0%", "a 0%", o discrepancias numéricas
        if (updated.meta.includes('0%') || updated.meta.includes('al 0') || !updated.meta.includes(`${target}%`)) {
          if (/al\s+0%|a\s+0%|en\s+un\s+0%/i.test(updated.meta)) {
            updated.meta = updated.meta.replace(/al\s+0%|a\s+0%|en\s+un\s+0%/gi, `al ${target}%`);
          } else {
            updated.meta = updated.meta.replace(/(\d+(\.\d+)?%)/, `${target}%`);
          }
        }
      }
      if (indicadores.abandono_ant !== undefined && indicadores.abandono_ant !== null) {
        updated.linea_base = `Abandono línea base: ${indicadores.abandono_ant}%, meta proyectada: ${target}%`;
      }
    }
  } else if (topic === 'aprobacion_reprobacion') {
    if (indicadores.aprobacion_meta !== undefined && indicadores.aprobacion_meta !== null) {
      const target = Number(indicadores.aprobacion_meta);
      if (!Number.isNaN(target) && updated.meta && updated.meta.toLowerCase().includes('aprobaci')) {
        updated.meta = updated.meta.replace(/(\d+(\.\d+)?%)/, `${target}%`);
      }
    } else if (indicadores.reprobacion_meta !== undefined && indicadores.reprobacion_meta !== null) {
      const target = Number(indicadores.reprobacion_meta);
      if (!Number.isNaN(target) && updated.meta && updated.meta.toLowerCase().includes('reprobaci')) {
        updated.meta = updated.meta.replace(/(\d+(\.\d+)?%)/, `${target}%`);
      }
    }
  } else if (topic === 'eficiencia_egreso' && indicadores.et_meta !== undefined && indicadores.et_meta !== null) {
    const target = Number(indicadores.et_meta);
    if (!Number.isNaN(target) && updated.meta) {
      updated.meta = updated.meta.replace(/(\d+(\.\d+)?%)/, `${target}%`);
    }
  }

  return updated as T;
}

/**
 * Deduplica silenciosamente un arreglo de metas institucionales, resolviendo:
 * - Duplicados exactos.
 * - Duplicados semánticos (mismo tema o alta similitud Jaccard >= threshold).
 * - Conflictos con indicadores oficiales (precedencia de indicadores_academicos.*_meta).
 * - Fusión de campos complementarios entre meta de continuidad y meta IA.
 */
export function deduplicateMetasInstitucionales<T extends PmcMetaInstitucional>(
  metas: T[],
  indicadores?: PmcIndicadoresAcademicos | null,
  similarityThreshold = 0.55
): T[] {
  if (!Array.isArray(metas) || metas.length === 0) return [];

  const result: T[] = [];

  for (const rawMeta of metas) {
    if (!rawMeta || !rawMeta.meta?.trim()) continue;
    const meta = applyIndicatorPrecedence(rawMeta, indicadores);
    const metaTopic = detectMetaTopic(meta);

    let matchIdx = -1;

    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      const existingTopic = detectMetaTopic(existing);

      // 1. Coincidencia exacta de texto normalizado
      if (normalizeMetaText(existing.meta) === normalizeMetaText(meta.meta)) {
        matchIdx = i;
        break;
      }

      // 2. Coincidencia por continuidad_de estructural
      if (
        (meta.continuidad_de && existing.continuidad_de && meta.continuidad_de === existing.continuidad_de) ||
        (meta.continuidad_de && normalizeMetaText(existing.meta) === normalizeMetaText(meta.continuidad_de)) ||
        (existing.continuidad_de && normalizeMetaText(meta.meta) === normalizeMetaText(existing.continuidad_de))
      ) {
        matchIdx = i;
        break;
      }

      // 3. Coincidencia en tópico clave de indicador oficial
      const isHardIndicator = [
        'abandono',
        'eficiencia_egreso',
        'formacion_docente',
        'socioemocional',
        'convivencia_violencia',
      ].includes(metaTopic);

      if (isHardIndicator && existingTopic === metaTopic) {
        matchIdx = i;
        break;
      }

      // 4. Coincidencia por similitud textual alta
      const sim = computeMetaSimilarity(existing.meta, meta.meta);
      if (sim >= similarityThreshold) {
        matchIdx = i;
        break;
      }

      // 5. Coincidencia de tema y estrategia clonada
      if (existing.tema && meta.tema && normalizeMetaText(existing.tema) === normalizeMetaText(meta.tema)) {
        if (computeMetaSimilarity(existing.estrategia, meta.estrategia) >= 0.7) {
          matchIdx = i;
          break;
        }
      }
    }

    if (matchIdx >= 0) {
      // Fusión silenciosa: mantener la versión más completa y enriquecer campos vacíos
      const existing = result[matchIdx];
      const isMetaContinuity = Boolean(meta.continuidad_de || meta.meta?.includes('[Continuidad'));
      const isExistingContinuity = Boolean(existing.continuidad_de || existing.meta?.includes('[Continuidad'));

function isCategoryAlignedWithTopic(categoria: string | undefined, topic: MetaTopicKey): boolean {
  if (!categoria) return false;
  const norm = normalizeMetaText(categoria);
  if (topic === 'abandono') {
    return norm.includes('permanencia') || norm.includes('abandono') || norm.includes('desercion');
  }
  if (topic === 'aprobacion_reprobacion') {
    return norm.includes('academico') || norm.includes('aprendizaje') || norm.includes('aprobacion') || norm.includes('reprobacion');
  }
  if (topic === 'eficiencia_egreso') {
    return norm.includes('egreso') || norm.includes('eficiencia') || norm.includes('terminal');
  }
  if (topic === 'formacion_docente') {
    return norm.includes('docente') || norm.includes('formacion') || norm.includes('actualizacion');
  }
  if (topic === 'socioemocional' || topic === 'convivencia_violencia') {
    return norm.includes('socioemocional') || norm.includes('convivencia') || norm.includes('violencia') || norm.includes('paz');
  }
  return true;
}

      const merged: T = {
        ...existing,
        continuidad_de: existing.continuidad_de || meta.continuidad_de,
        meta: isMetaContinuity && !isExistingContinuity ? meta.meta : existing.meta,
        estrategia:
          (meta.estrategia?.length ?? 0) > (existing.estrategia?.length ?? 0)
            ? meta.estrategia
            : existing.estrategia,
        linea_base:
          existing.linea_base && existing.linea_base !== 'N/D'
            ? existing.linea_base
            : meta.linea_base || existing.linea_base,
        entregable:
          (meta.entregable?.length ?? 0) > (existing.entregable?.length ?? 0)
            ? meta.entregable
            : existing.entregable,
        personal_designado: existing.personal_designado || meta.personal_designado,
        categoria:
          isCategoryAlignedWithTopic(meta.categoria, metaTopic)
            ? meta.categoria
            : (isCategoryAlignedWithTopic(existing.categoria, metaTopic)
                ? existing.categoria
                : meta.categoria || existing.categoria),
        nombre_categoria:
          isCategoryAlignedWithTopic(meta.nombre_categoria, metaTopic)
            ? meta.nombre_categoria
            : (isCategoryAlignedWithTopic(existing.nombre_categoria, metaTopic)
                ? existing.nombre_categoria
                : meta.nombre_categoria || existing.nombre_categoria),
        tema: existing.tema || meta.tema,
        diagnostico_meta: existing.diagnostico_meta || meta.diagnostico_meta,
        periodo_inicio: existing.periodo_inicio || meta.periodo_inicio,
        periodo_fin: existing.periodo_fin || meta.periodo_fin,
      };

      result[matchIdx] = applyIndicatorPrecedence(merged, indicadores);
    } else {
      result.push(meta);
    }
  }

  return result;
}
