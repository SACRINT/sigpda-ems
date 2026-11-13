/**
 * Quality Validator Agent
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Agente de Validación de Calidad del motor editorial.
 * Evalúa los outputs de los 4 redactores concurrentes (foundation, lab, project, evaluation)
 * y decide si el libro de trabajo del bloque es aceptable o si requiere reintentos dirigidos.
 */

import type { WriterOutput } from './writers/writer-contract';

export interface QualityValidatorInput {
  writerOutputs: WriterOutput[];
  subsystem: 'bge' | 'bt';
  targetWords: { min: number; ideal: number; max: number };
}

export interface QualityValidatorOutput {
  accepted: boolean;
  qualityScore: number;
  qualityWarning: boolean;
  failedWriters: ('foundation' | 'lab' | 'project' | 'evaluation')[];
  retryableWriters: ('foundation' | 'lab' | 'project' | 'evaluation')[];
  totalWordCount: number;
  /** Mínimo formal del bloque (sin tolerancia). */
  minRequiredWords: number;
  /** Mínimo editorial aceptable (90% del formal) para absorber variaciones de tokenización. */
  editorialMinWords: number;
  /** true si el volumen está dentro de la tolerancia editorial, aunque no alcance el mínimo formal. */
  withinEditorialTolerance: boolean;
  warnings: string[];
}

/**
 * Tolerancia editorial única del motor: un bloque puede aceptarse si alcanza
 * al menos el 90% del mínimo formal. Evita que el validador contradiga el gate
 * final del orquestador (que ya aplica esta misma tolerancia).
 */
export const EDITORIAL_TOLERANCE_RATIO = 0.9;

const PLACEHOLDER_REGEX = /\[completar\]|\[escribe aquí\]|\[placeholder\]|\[aquí escribe\]|\[texto\]|\[insertar\]|\[pendiente\]|\[tbd\]|\[\s*\.\.\.\s*\]/i;

const WEIGHTS: Record<'foundation' | 'lab' | 'project' | 'evaluation', number> = {
  foundation: 0.30,
  lab: 0.30,
  project: 0.25,
  evaluation: 0.15,
};

export function validateBlockGuideQuality(input: QualityValidatorInput): QualityValidatorOutput {
  const warnings: string[] = [];
  const failedWriters: ('foundation' | 'lab' | 'project' | 'evaluation')[] = [];
  const retryableWriters: ('foundation' | 'lab' | 'project' | 'evaluation')[] = [];
  const writersWithPlaceholders: ('foundation' | 'lab' | 'project' | 'evaluation')[] = [];

  const minRequiredWords =
    input.targetWords?.min || (input.subsystem === 'bt' ? Math.round(25000 / 3) : Math.round(17500 / 3));

  // 1. Calcular wordCount total acumulado de todos los writers
  let totalWordCount = 0;
  let weightedScoreSum = 0;
  let weightSum = 0;
  let passingWritersCount = 0;

  for (const out of input.writerOutputs) {
    totalWordCount += out.wordCount || 0;
    const weight = WEIGHTS[out.type] || 0.25;
    weightedScoreSum += (out.qualityScore || 0) * weight;
    weightSum += weight;

    if (out.qualityScore >= 70) {
      passingWritersCount++;
    } else {
      failedWriters.push(out.type);
      warnings.push(`El redactor "${out.type}" obtuvo un puntaje insuficiente (${out.qualityScore}/100)`);
    }

    // Comprobar si hay placeholders residuales en la sección generada
    const rawContent = JSON.stringify(out.section);
    if (PLACEHOLDER_REGEX.test(rawContent)) {
      writersWithPlaceholders.push(out.type);
      warnings.push(`El redactor "${out.type}" contiene texto incompleto o marcadores [...]`);
    }

    if (out.warnings && out.warnings.length > 0) {
      warnings.push(...out.warnings.map((w) => `[${out.type}] ${w}`));
    }
  }

  // Normalizar qualityScore final con promedio ponderado
  const finalQualityScore = weightSum > 0 ? Math.round(weightedScoreSum / weightSum) : 0;

  let accepted = true;
  let qualityWarning = false;

  // 2. Verificar que al menos 3 de 4 writers tengan qualityScore >= 70
  if (passingWritersCount < 3) {
    accepted = false;
    qualityWarning = true;
    warnings.push(`Solo ${passingWritersCount} de 4 redactores alcanzaron el umbral mínimo de calidad (>= 70)`);
  }

  // 3. Reglas de decisión por extensión de palabras.
  // El gate formal exige minRequiredWords, pero la política editorial acepta
  // hasta un 10% por debajo para no descartar libros íntegros de alta calidad.
  const halfMin = minRequiredWords * 0.5;
  const editorialMinWords = Math.round(minRequiredWords * EDITORIAL_TOLERANCE_RATIO);
  const withinEditorialTolerance = totalWordCount >= editorialMinWords;

  if (totalWordCount < halfMin) {
    // Si el libro tiene menos del 50% del mínimo, es demasiado corto para ser rescatable
    accepted = false;
    qualityWarning = true;
    warnings.push(
      `Extensión crítica (${totalWordCount} palabras): inferior al 50% de la meta mínima (${minRequiredWords} palabras). No se reintenta automáticamente.`
    );
  } else if (!withinEditorialTolerance) {
    // Entre 50% y 89.99%: déficit real, reintentar los writers con menor volumen.
    accepted = false;
    qualityWarning = true;
    warnings.push(
      `Extensión insuficiente (${totalWordCount}/${minRequiredWords} palabras; mínimo editorial ${editorialMinWords}). Se programa reintento del redactor con menor puntaje.`
    );

    // Priorizar reintentos en orden de menor volumen de palabras generado
    const sortedByWords = [...input.writerOutputs].sort(
      (a, b) => (a.wordCount || 0) - (b.wordCount || 0)
    );
    for (const w of sortedByWords) {
      if (!retryableWriters.includes(w.type)) {
        retryableWriters.push(w.type);
      }
    }
  } else if (totalWordCount < minRequiredWords) {
    // Dentro de la tolerancia editorial (90-99.99%): se acepta con advertencia.
    qualityWarning = true;
    warnings.push(
      `Extensión por debajo del mínimo formal (${totalWordCount}/${minRequiredWords} palabras), pero dentro de la tolerancia editorial del 90% (${editorialMinWords}). Se acepta con advertencia.`
    );
  }

  // Los placeholders son un fallo de integridad independiente del volumen:
  // deben reintentarse incluso si el bloque está dentro de la tolerancia.
  if (writersWithPlaceholders.length > 0) {
    accepted = false;
    qualityWarning = true;
    for (const wType of writersWithPlaceholders) {
      if (!retryableWriters.includes(wType)) {
        retryableWriters.push(wType);
      }
    }
    warnings.push(
      `Se reintentarán los redactores con placeholders: ${writersWithPlaceholders.join(', ')}`
    );
  }

  // Si falló por score y no está en retryable por palabras, agregar los que fallaron
  if (!accepted && retryableWriters.length === 0 && totalWordCount >= halfMin) {
    for (const f of failedWriters) {
      if (!retryableWriters.includes(f)) {
        retryableWriters.push(f);
      }
    }
  }

  return {
    accepted,
    qualityScore: Math.min(100, Math.max(0, finalQualityScore)),
    qualityWarning,
    failedWriters,
    retryableWriters,
    totalWordCount,
    minRequiredWords,
    editorialMinWords,
    withinEditorialTolerance,
    warnings,
  };
}

export interface SemestralValidationInput {
  subsystem: 'bge' | 'bt';
  totalWords: number;
  blockBooks: {
    blockIndex: number;
    totalWords: number;
    qualityScore: number;
    qualityWarning: boolean;
  }[];
}

export interface SemestralValidationOutput {
  accepted: boolean;
  qualityScore: number;
  qualityWarning: boolean;
  totalWords: number;
  macroMinWords: number;
  warnings: string[];
}

/**
 * Valida la calidad pedagógica y volumen macro del Compendio Semestral consolidado.
 * Aplica el umbral oficial completo (>= 25,000 BT / >= 17,500 BGE).
 */
export function validateSemestralGuideQuality(
  input: SemestralValidationInput
): SemestralValidationOutput {
  const macroMinWords = input.subsystem === 'bt' ? 25000 : 17500;
  const warnings: string[] = [];

  const avgScore =
    input.blockBooks.length > 0
      ? Math.round(
          input.blockBooks.reduce((acc, b) => acc + (b.qualityScore || 0), 0) /
            input.blockBooks.length
        )
      : 0;

  let accepted = true;
  let qualityWarning = false;

  // 1. Verificación de umbral macro semestral
  if (input.totalWords < macroMinWords) {
    accepted = false;
    qualityWarning = true;
    warnings.push(
      `Compendio semestral con volumen inferior a la meta oficial (${input.totalWords}/${macroMinWords} palabras).`
    );
  }

  // 2. Verificar advertencias de calidad heredadas de los bloques
  const flaggedBlocks = input.blockBooks.filter((b) => b.qualityWarning);
  if (flaggedBlocks.length > 0) {
    qualityWarning = true;
    warnings.push(
      `Existen ${flaggedBlocks.length} bloque(s) con advertencias activas de calidad pedagógica.`
    );
  }

  let finalScore = avgScore;
  if (!accepted) {
    const ratio = Math.min(1, input.totalWords / macroMinWords);
    finalScore = Math.round(avgScore * 0.7 + ratio * 100 * 0.3);
  } else if (qualityWarning) {
    finalScore = Math.max(0, avgScore - 10); // Penalización por bloques con advertencias
  }

  return {
    accepted,
    qualityScore: Math.min(100, Math.max(0, finalScore)),
    qualityWarning,
    totalWords: input.totalWords,
    macroMinWords,
    warnings,
  };
}

