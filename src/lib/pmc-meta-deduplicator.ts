// src/lib/pmc-meta-deduplicator.ts
/**
 * Single Source of Truth (SSoT) para la deduplicación y consolidación silenciosa
 * de metas institucionales del Programa de Mejora Continua (PMC).
 * 
 * Resuelve H-150 / H-153 / H-154:
 * 1. Normalización estricta (minúsculas, sin acentos ni puntuación, sin prefijos redundantes).
 * 2. Similitud semántica por solapamiento de tokens Jaccard (umbral canónico = 0.70).
 * 3. Precedencia obligatoria de metas capturadas en indicadores_academicos.*_meta sobre texto generado por IA:
 *    - Preservación estricta de líneas base y rangos cuantitativos "del X% al Y%" (el target a alinear es Y%, nunca X%).
 *    - Protección contra alteración de metas no asociadas (ej. metas de seguimiento de egresados al 80% quedan intactas).
 * 4. Deduplicación no destructiva:
 *    - Fusión exclusiva de metas duplicadas comprobadas (abandono escolar institucional, textos equivalentes o continuidad explícita).
 *    - Prohibida la fusión indiscriminada por mera concordancia de ámbito general.
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

/**
 * Determina si dos textos de metas refieren a niveles de desempeño de evaluación distintos
 * (ej. "nivel bueno" vs "nivel excelente", "insuficiente" vs "elemental").
 * En tales casos, NO deben fusionarse como duplicados aunque compartan el resto del texto.
 */
export function hasDistinctEvaluationLevels(textA?: string | null, textB?: string | null): boolean {
  if (!textA || !textB) return false;
  const normA = textA.toLowerCase();
  const normB = textB.toLowerCase();
  const levels = ['insuficiente', 'elemental', 'bueno', 'excelente'];
  const levelsA = levels.filter(l => normA.includes(l));
  const levelsB = levels.filter(l => normB.includes(l));

  if (levelsA.length > 0 && levelsB.length > 0) {
    const setA = new Set(levelsA);
    const setB = new Set(levelsB);
    if (setA.size !== setB.size || [...setA].some(l => !setB.has(l))) {
      return true;
    }
  }
  return false;
}

export type MetaTopicKey =
  | 'abandono'
  | 'reprobacion'
  | 'aprobacion'
  | 'eficiencia_terminal'
  | 'seguimiento_egresados'
  | 'formacion_docente'
  | 'socioemocional'
  | 'convivencia_violencia'
  | 'infraestructura'
  | 'vinculacion_comunitaria'
  | 'general';

/**
 * Determina si una meta trata inequívocamente sobre la tasa de abandono / deserción escolar.
 */
export function isAbandonoGoal(meta: PmcMetaInstitucional): boolean {
  const normMeta = normalizeMetaText(meta.meta || '');
  if (normMeta.includes('abandono') || normMeta.includes('desercion')) {
    return true;
  }
  const normTema = normalizeMetaText(meta.tema || '');
  if (normTema && !normTema.includes('reprobacion') && (normTema.includes('abandono') || normTema.includes('desercion'))) {
    return true;
  }
  return false;
}

/**
 * Determina si una meta trata inequívocamente sobre la tasa de reprobación escolar.
 */
export function isReprobacionGoal(meta: PmcMetaInstitucional): boolean {
  const normMeta = normalizeMetaText(meta.meta || '');
  if (normMeta.includes('reprobacion') || normMeta.includes('indice de reprobacion') || normMeta.includes('tasa de reprobacion')) {
    return true;
  }
  const normTema = normalizeMetaText(meta.tema || '');
  if (normTema && !normTema.includes('abandono') && (normTema.includes('reprobacion') || normTema.includes('indice de reprobacion'))) {
    return true;
  }
  return false;
}

/**
 * Determina si una meta trata inequívocamente sobre la tasa de aprobación escolar institucional.
 * Excluye metas de rendimiento académico general o de semestres específicos para evitar sobreescrituras indebidas.
 */
export function isAprobacionGoal(meta: PmcMetaInstitucional): boolean {
  const normMeta = normalizeMetaText(meta.meta || '');
  if (
    (normMeta.includes('aprobacion') || normMeta.includes('tasa de aprobacion') || normMeta.includes('indice de aprobacion')) &&
    !normMeta.includes('reprobacion') &&
    !normMeta.includes('rendimiento academico')
  ) {
    return true;
  }
  const normTema = normalizeMetaText(meta.tema || '');
  if (normTema && !normTema.includes('reprobacion') && (normTema.includes('aprobacion') || normTema.includes('tasa de aprobacion'))) {
    return true;
  }
  return false;
}

/**
 * Determina si una meta trata inequívocamente sobre la eficiencia terminal.
 */
export function isEficienciaTerminalGoal(meta: PmcMetaInstitucional): boolean {
  const normMeta = normalizeMetaText(meta.meta || '');
  if (normMeta.includes('eficiencia terminal')) {
    return true;
  }
  const normTema = normalizeMetaText(meta.tema || '');
  if (normTema && !normTema.includes('abandono') && !normTema.includes('reprobacion') && normTema.includes('eficiencia terminal')) {
    return true;
  }
  return false;
}

/**
 * Determina el ámbito semántico específico de una meta evaluando categoría, tema y redacción.
 */
export function detectMetaTopic(meta: PmcMetaInstitucional): MetaTopicKey {
  // Primero clasificar por la redacción de la meta (más específico)
  const metaText = normalizeMetaText(meta.meta || '');
  if (metaText.includes('abandono') || metaText.includes('desercion')) {
    return 'abandono';
  }
  if (metaText.includes('reprobacion')) {
    return 'reprobacion';
  }
  if (metaText.includes('aprobacion') && !metaText.includes('reprobacion')) {
    return 'aprobacion';
  }
  if (metaText.includes('eficiencia terminal')) {
    return 'eficiencia_terminal';
  }
  if (metaText.includes('egresad') || metaText.includes('egreso') || metaText.includes('titulacion')) {
    return 'seguimiento_egresados';
  }
  if (
    metaText.includes('formacion docente') ||
    metaText.includes('actualizacion docente') ||
    metaText.includes('capacitacion docente') ||
    metaText.includes('desempeno docente') ||
    metaText.includes('cosfac') ||
    metaText.includes('academia')
  ) {
    return 'formacion_docente';
  }
  if (
    metaText.includes('violencia') ||
    metaText.includes('cultura de paz') ||
    metaText.includes('acoso') ||
    metaText.includes('mediacion')
  ) {
    return 'convivencia_violencia';
  }
  if (
    metaText.includes('socioemocional') ||
    metaText.includes('bienestar') ||
    metaText.includes('salud mental') ||
    metaText.includes('salud emocional') ||
    metaText.includes('vida saludable') ||
    metaText.includes('alcohol') ||
    metaText.includes('sustancias')
  ) {
    return 'socioemocional';
  }
  if (
    metaText.includes('infraestructura') ||
    metaText.includes('mantenimiento') ||
    metaText.includes('equipamiento') ||
    metaText.includes('aulas') ||
    metaText.includes('computo') ||
    metaText.includes('sanitarios')
  ) {
    return 'infraestructura';
  }
  if (
    metaText.includes('paec') ||
    metaText.includes('comunitari') ||
    metaText.includes('vinculacion')
  ) {
    return 'vinculacion_comunitaria';
  }

  // Si no se clasificó por la meta, evaluar tema y categoría excluyendo el tema compuesto genérico
  const contextText = normalizeMetaText(
    `${meta.categoria || ''} ${meta.nombre_categoria || ''} ${meta.tema || ''}`
  );
  const isCompositeTema = contextText.includes('reprobacion') && contextText.includes('abandono');

  if (!isCompositeTema) {
    if (contextText.includes('abandono') || contextText.includes('desercion')) {
      return 'abandono';
    }
    if (contextText.includes('reprobacion')) {
      return 'reprobacion';
    }
    if (contextText.includes('aprobacion')) {
      return 'aprobacion';
    }
    if (contextText.includes('eficiencia terminal')) {
      return 'eficiencia_terminal';
    }
  }

  if (contextText.includes('egresad') || contextText.includes('egreso') || contextText.includes('titulacion')) {
    return 'seguimiento_egresados';
  }
  if (
    contextText.includes('formacion docente') ||
    contextText.includes('actualizacion docente') ||
    contextText.includes('capacitacion docente') ||
    contextText.includes('desempeno docente') ||
    contextText.includes('cosfac') ||
    contextText.includes('academia')
  ) {
    return 'formacion_docente';
  }
  if (
    contextText.includes('violencia') ||
    contextText.includes('cultura de paz') ||
    contextText.includes('acoso') ||
    contextText.includes('mediacion')
  ) {
    return 'convivencia_violencia';
  }
  if (
    contextText.includes('socioemocional') ||
    contextText.includes('bienestar') ||
    contextText.includes('salud mental') ||
    contextText.includes('salud emocional') ||
    contextText.includes('vida saludable') ||
    contextText.includes('alcohol') ||
    contextText.includes('sustancias')
  ) {
    return 'socioemocional';
  }
  if (
    contextText.includes('infraestructura') ||
    contextText.includes('mantenimiento') ||
    contextText.includes('equipamiento') ||
    contextText.includes('aulas') ||
    contextText.includes('computo') ||
    contextText.includes('sanitarios')
  ) {
    return 'infraestructura';
  }
  if (
    contextText.includes('paec') ||
    contextText.includes('comunitari') ||
    contextText.includes('vinculacion')
  ) {
    return 'vinculacion_comunitaria';
  }
  return 'general';
}

/**
 * Valida si una categoría institucional está correctamente alineada con el topic evaluado.
 */
export function isCategoryAlignedWithTopic(categoria: string | undefined, topic: MetaTopicKey): boolean {
  if (!categoria) return false;
  const norm = normalizeMetaText(categoria);
  if (topic === 'abandono') {
    return norm.includes('permanencia') || norm.includes('abandono') || norm.includes('desercion') || norm.includes('aprendizaje');
  }
  if (topic === 'aprobacion' || topic === 'reprobacion') {
    return norm.includes('academico') || norm.includes('aprendizaje') || norm.includes('aprobacion') || norm.includes('reprobacion');
  }
  if (topic === 'eficiencia_terminal' || topic === 'seguimiento_egresados') {
    return norm.includes('egreso') || norm.includes('eficiencia') || norm.includes('terminal') || norm.includes('administracion') || norm.includes('gestion');
  }
  if (topic === 'formacion_docente') {
    return norm.includes('docente') || norm.includes('formacion') || norm.includes('actualizacion') || norm.includes('gestion') || norm.includes('aprendizaje');
  }
  if (topic === 'socioemocional' || topic === 'convivencia_violencia') {
    return norm.includes('socioemocional') || norm.includes('convivencia') || norm.includes('violencia') || norm.includes('paz');
  }
  return true;
}

/**
 * Aplica la regla de precedencia obligatoria con salvaguardas estrictas:
 * 1. Prohibido modificar cifras salvo cuando la meta sea inequívocamente del indicador correspondiente.
 * 2. Solo modifica si la meta contradice *_meta (no si es un rango válido o seguimiento de egresados).
 * 3. Preserva la línea base en rangos "de X% a Y%" / "del X% al Y%" (el target a alinear es Y%, nunca X%).
 * 4. Jamás modifica metas de egresados (ej. "80% de egresados" debe quedar intacto).
 */
export function applyIndicatorPrecedence<T extends PmcMetaInstitucional>(
  meta: T,
  indicadores?: PmcIndicadoresAcademicos | null
): T {
  if (!indicadores) return { ...meta };
  const updated = { ...meta };
  const text = updated.meta || '';

  // 1. Abandono escolar
  if (isAbandonoGoal(updated) && indicadores.abandono_meta !== undefined && indicadores.abandono_meta !== null) {
    const target = Number(indicadores.abandono_meta);
    if (!Number.isNaN(target)) {
      const rangeMatch = text.match(/(del?\s+\d+(?:\.\d+)?%\s+al?\s+)(\d+(?:\.\d+)?%)/i);
      if (rangeMatch) {
        const currentTargetVal = parseFloat(rangeMatch[2]);
        if (currentTargetVal !== target) {
          updated.meta = text.replace(rangeMatch[0], `${rangeMatch[1]}${target}%`);
        }
      } else if (/al\s+0%|a\s+0%|en\s+un\s+0%/i.test(text)) {
        updated.meta = text.replace(/al\s+0%|a\s+0%|en\s+un\s+0%/gi, `al ${target}%`);
      } else if (!text.includes(`${target}%`) && /\bal\s+\d+(?:\.\d+)?%/i.test(text)) {
        updated.meta = text.replace(/\bal\s+\d+(?:\.\d+)?%/i, `al ${target}%`);
      }

      if (indicadores.abandono_ant !== undefined && indicadores.abandono_ant !== null && (!updated.linea_base || updated.linea_base.includes('N/D'))) {
        updated.linea_base = `Abandono línea base: ${indicadores.abandono_ant}%, meta proyectada: ${target}%`;
      }
    }
  }

  // 2. Reprobación escolar
  if (isReprobacionGoal(updated) && indicadores.reprobacion_meta !== undefined && indicadores.reprobacion_meta !== null) {
    const target = Number(indicadores.reprobacion_meta);
    if (!Number.isNaN(target)) {
      const rangeMatch = text.match(/(del?\s+\d+(?:\.\d+)?%\s+al?\s+)(\d+(?:\.\d+)?%)/i);
      if (rangeMatch) {
        const currentTargetVal = parseFloat(rangeMatch[2]);
        if (currentTargetVal !== target) {
          updated.meta = text.replace(rangeMatch[0], `${rangeMatch[1]}${target}%`);
        }
      } else if (/al\s+0%|a\s+0%/i.test(text)) {
        updated.meta = text.replace(/al\s+0%|a\s+0%/gi, `al ${target}%`);
      }
    }
  }

  // 3. Aprobación escolar
  if (isAprobacionGoal(updated) && indicadores.aprobacion_meta !== undefined && indicadores.aprobacion_meta !== null) {
    const target = Number(indicadores.aprobacion_meta);
    if (!Number.isNaN(target)) {
      const rangeMatch = text.match(/(del?\s+\d+(?:\.\d+)?%\s+al?\s+)(\d+(?:\.\d+)?%)/i);
      if (rangeMatch) {
        const currentTargetVal = parseFloat(rangeMatch[2]);
        if (currentTargetVal !== target) {
          updated.meta = text.replace(rangeMatch[0], `${rangeMatch[1]}${target}%`);
        }
      } else if (!text.includes(`${target}%`) && /\bal\s+\d+(?:\.\d+)?%/i.test(text)) {
        updated.meta = text.replace(/\bal\s+\d+(?:\.\d+)?%/i, `al ${target}%`);
      }
    }
  }

  // 4. Eficiencia Terminal (SÓLO si la meta habla explícitamente de "eficiencia terminal")
  if (isEficienciaTerminalGoal(updated) && indicadores.et_meta !== undefined && indicadores.et_meta !== null) {
    const target = Number(indicadores.et_meta);
    if (!Number.isNaN(target)) {
      const rangeMatch = text.match(/(del?\s+\d+(?:\.\d+)?%\s+al?\s+)(\d+(?:\.\d+)?%)/i);
      if (rangeMatch) {
        const currentTargetVal = parseFloat(rangeMatch[2]);
        if (currentTargetVal !== target) {
          updated.meta = text.replace(rangeMatch[0], `${rangeMatch[1]}${target}%`);
        }
      } else if (!text.includes(`${target}%`) && /\bal\s+\d+(?:\.\d+)?%/i.test(text)) {
        updated.meta = text.replace(/\bal\s+\d+(?:\.\d+)?%/i, `al ${target}%`);
      }
    }
  }

  return updated;
}

/**
 * Deduplica silenciosamente un arreglo de metas institucionales, resolviendo:
 * - Duplicados exactos.
 * - Duplicados semánticos genuinos (metas equivalentes con similitud Jaccard >= threshold).
 * - Fusión conservadora de metas de abandono escolar institucional.
 * - Precedencia de indicadores_academicos.*_meta sin corromper metas independientes.
 */
export function deduplicateMetasInstitucionales<T extends PmcMetaInstitucional>(
  metas: T[],
  indicadores?: PmcIndicadoresAcademicos | null,
  similarityThreshold = 0.70
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

      // 1. Coincidencia exacta de texto normalizado
      if (normalizeMetaText(existing.meta) === normalizeMetaText(meta.meta)) {
        matchIdx = i;
        break;
      }

      // 2. Coincidencia por continuidad_de explícita
      if (
        (meta.continuidad_de && existing.continuidad_de && normalizeMetaText(meta.continuidad_de) === normalizeMetaText(existing.continuidad_de)) ||
        (meta.continuidad_de && normalizeMetaText(existing.meta) === normalizeMetaText(meta.continuidad_de)) ||
        (existing.continuidad_de && normalizeMetaText(meta.meta) === normalizeMetaText(existing.continuidad_de))
      ) {
        matchIdx = i;
        break;
      }

      // 3. Fusión de meta duplicada de Abandono Escolar:
      // En un PMC sólo existe una meta cuantitativa institucional para abatimiento del abandono.
      if (isAbandonoGoal(existing) && isAbandonoGoal(meta)) {
        matchIdx = i;
        break;
      }

      // 4. Coincidencia por similitud textual alta (Jaccard >= similarityThreshold) CON tema alineado
      const sim = computeMetaSimilarity(existing.meta, meta.meta);
      if (
        sim >= similarityThreshold &&
        existing.tema &&
        meta.tema &&
        normalizeMetaText(existing.tema) === normalizeMetaText(meta.tema) &&
        !hasDistinctEvaluationLevels(existing.meta, meta.meta)
      ) {
        matchIdx = i;
        break;
      }

      // 5. Coincidencia de tema idéntico y estrategia clonada alta (salvo que tengan niveles de desempeño distintos)
      if (
        existing.tema &&
        meta.tema &&
        normalizeMetaText(existing.tema) === normalizeMetaText(meta.tema) &&
        !hasDistinctEvaluationLevels(existing.meta, meta.meta)
      ) {
        if (computeMetaSimilarity(existing.estrategia, meta.estrategia) >= 0.70) {
          matchIdx = i;
          break;
        }
      }
    }

    if (matchIdx >= 0) {
      const existing = result[matchIdx];
      const isMetaContinuity = Boolean(meta.continuidad_de || meta.meta?.includes('[Continuidad'));
      const isExistingContinuity = Boolean(existing.continuidad_de || existing.meta?.includes('[Continuidad'));

      const chosenMetaText = isExistingContinuity
        ? existing.meta
        : (isMetaContinuity ? meta.meta : existing.meta);

      const merged: T = {
        ...existing,
        continuidad_de: existing.continuidad_de || meta.continuidad_de,
        meta: chosenMetaText,
        estrategia:
          (meta.estrategia?.length ?? 0) > (existing.estrategia?.length ?? 0)
            ? meta.estrategia
            : existing.estrategia,
        linea_base:
          existing.linea_base && !existing.linea_base.includes('N/D')
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
        tema: isCategoryAlignedWithTopic(meta.categoria, metaTopic) ? (meta.tema || existing.tema) : (existing.tema || meta.tema),
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
