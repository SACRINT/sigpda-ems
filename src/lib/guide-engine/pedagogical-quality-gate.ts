/**
 * pedagogical-quality-gate.ts — Auditoría Cognitiva de Bloom y Diseño Universal BAP
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Realiza una auditoría pedagógica multidimensional sobre el contenido del libro
 * y la planeación:
 * 1. Distribución Cognitiva de la Taxonomía de Bloom (LOTS vs HOTS).
 * 2. Inclusión NEM y mitigación de Barreras para el Aprendizaje y la Participación (BAP/DUA).
 * 3. Dictamen cualitativo y semáforo institucional (A+, A, B, C, D).
 */

import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { normalizeUnicode } from '@/lib/utils/normalize';

export interface BloomDistribution {
  recordar: number;    // %
  comprender: number;  // %
  aplicar: number;     // %
  analizar: number;    // %
  evaluar: number;     // %
  crear: number;       // %
  dominantLevel: string;
  hotsPercentage: number; // Nivel 4-6 (Analizar, Evaluar, Crear)
  hasHigherOrderSkills: boolean;
}

export interface PedagogicalAuditResult {
  bloomDistribution: BloomDistribution;
  bapInclusivityScore: number; // 0 - 100
  bapStrengths: string[];
  bapRecommendations: string[];
  pedagogicalHealthGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  summary: string;
}

// Diccionario de verbos operativos por nivel taxonómico de Bloom (español educativo)
const BLOOM_VERB_LEVELS: Record<keyof Omit<BloomDistribution, 'dominantLevel' | 'hotsPercentage' | 'hasHigherOrderSkills'>, string[]> = {
  recordar: [
    'identifica', 'define', 'menciona', 'enlista', 'reconoce', 'recuerda', 'describe',
    'nombra', 'reproduce', 'localiza', 'memoriza', 'cita', 'repite'
  ],
  comprender: [
    'explica', 'interpreta', 'clasifica', 'resume', 'distingue', 'ejemplifica',
    'parafrasea', 'comprende', 'ilustra', 'asocia', 'discute', 'predice'
  ],
  aplicar: [
    'calcula', 'resuelve', 'aplica', 'demuestra', 'opera', 'utiliza', 'ejecuta',
    'implementa', 'manipula', 'construye', 'grafica', 'tabula', 'mide', 'emplea'
  ],
  analizar: [
    'analiza', 'compara', 'contrasta', 'descompone', 'examina', 'diferencia',
    'relaciona', 'cuestiona', 'diagnostica', 'investiga', 'deduce', 'organiza'
  ],
  evaluar: [
    'evalua', 'evalúa', 'valora', 'juzga', 'justifica', 'argumenta', 'critica',
    'valida', 'defiende', 'selecciona', 'contrasta', 'audita', 'revisa'
  ],
  crear: [
    'disena', 'diseña', 'formula', 'propone', 'crea', 'construye', 'integra',
    'elabora', 'plantea', 'innova', 'desarrolla', 'proyecta', 'estructura'
  ],
};

/**
 * Audita el equilibrio cognitivo según la Taxonomía de Bloom
 */
export function auditBloomTaxonomy(textbook: ActiveWorkTextbook): BloomDistribution {
  // Extraer texto representativo de acciones pedagógicas
  const textCorpus = normalizeUnicode([
    textbook.missions.map(m => `${m.title} ${m.sessionFocus} ${m.iDoSection?.stepByStepDemo || ''} ${m.weDoSection?.guidedPractice || ''} ${m.youDoSection?.autonomousChallenge || ''}`).join(' '),
    textbook.projectSection ? `${textbook.projectSection.artifactName} ${(textbook.projectSection.learningObjectives || []).join(' ')} ${(textbook.projectSection.executionSteps || []).join(' ')}` : '',
    textbook.evaluationSection?.rubric?.map(r => r.criterion).join(' ') || '',
  ].join(' '));

  const counts: Record<string, number> = {
    recordar: 0,
    comprender: 0,
    aplicar: 0,
    analizar: 0,
    evaluar: 0,
    crear: 0,
  };

  for (const [level, verbs] of Object.entries(BLOOM_VERB_LEVELS)) {
    for (const verb of verbs) {
      const regex = new RegExp(`\\b${verb}\\w*\\b`, 'g');
      const matches = textCorpus.match(regex);
      if (matches) {
        counts[level] += matches.length;
      }
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  const recordar = Math.round((counts.recordar / total) * 100);
  const comprender = Math.round((counts.comprender / total) * 100);
  const aplicar = Math.round((counts.aplicar / total) * 100);
  const analizar = Math.round((counts.analizar / total) * 100);
  const evaluar = Math.round((counts.evaluar / total) * 100);
  const crear = Math.round((counts.crear / total) * 100);

  const hotsPercentage = analizar + evaluar + crear;

  // Determinar nivel dominante
  let dominantLevel = 'aplicar';
  let maxCount = -1;
  for (const [lvl, val] of Object.entries(counts)) {
    if (val > maxCount) {
      maxCount = val;
      dominantLevel = lvl;
    }
  }

  return {
    recordar,
    comprender,
    aplicar,
    analizar,
    evaluar,
    crear,
    dominantLevel: dominantLevel.toUpperCase(),
    hotsPercentage,
    hasHigherOrderSkills: hotsPercentage >= 25,
  };
}

/**
 * Audita la atención a Barreras para el Aprendizaje y la Participación (BAP) y Diseño Universal para el Aprendizaje (DUA)
 */
export function auditBapInclusivity(textbook: ActiveWorkTextbook): {
  score: number;
  strengths: string[];
  recommendations: string[];
} {
  const strengths: string[] = [];
  const recommendations: string[] = [];
  let score = 50; // Base score

  // 1. DUA Principio 1: Múltiples formas de representación (analogías físicas + gráficos)
  const hasAnalogies = textbook.missions.every(m => Boolean(m.conceptZero?.physicalAnalogy && m.conceptZero.physicalAnalogy.length > 20));
  if (hasAnalogies) {
    score += 15;
    strengths.push('Analogías contextuales y físicas en el 100% de las misiones para estudiantes con estilos no verbales.');
  } else {
    recommendations.push('Reforzar las analogías intuitivas en Concepto Cero para apoyar a alumnos que requieren anclajes concretos.');
  }

  // 2. DUA Principio 2: Múltiples formas de acción y expresión (Desafíos escalonados)
  const hasTiered = Boolean(textbook.evaluationSection?.tieredExercises && textbook.evaluationSection.tieredExercises.length >= 3);
  if (hasTiered) {
    score += 15;
    strengths.push('Evaluación escalonada en 3 niveles de complejidad (Básico, Intermedio, Avanzado) para atender distintos ritmos de aprendizaje.');
  } else {
    recommendations.push('Incorporar ejercicios escalonados multinivel para evitar la frustración de estudiantes en rezago y el estancamiento de alumnos avanzados.');
  }

  // 3. Andamiaje y prevención de errores frecuentes (Troubleshooting)
  const hasTroubleshooting = textbook.missions.some(m => Array.isArray(m.troubleshooting) && m.troubleshooting.length > 0);
  if (hasTroubleshooting) {
    score += 10;
    strengths.push('Secciones de resolución de errores comunes (Troubleshooting) para fomentar la autorregulación.');
  } else {
    recommendations.push('Incluir advertencias de errores habituales en las misiones para andamiar el trabajo autónomo.');
  }

  // 4. Proyecto Integrador con utilidad social situada (Sentido y pertinencia NEM)
  if (textbook.projectSection?.communityUtility && textbook.projectSection.communityUtility.length > 15) {
    score += 10;
    strengths.push('Proyecto integrador con beneficio comunitario explícito vinculado al entorno regional de Puebla.');
  }

  const finalScore = Math.min(100, Math.max(0, score));

  return {
    score: finalScore,
    strengths,
    recommendations,
  };
}

/**
 * Ejecuta la auditoría pedagógica integral del libro de trabajo
 */
export function runPedagogicalAudit(textbook: ActiveWorkTextbook): PedagogicalAuditResult {
  const bloom = auditBloomTaxonomy(textbook);
  const bap = auditBapInclusivity(textbook);

  // Calcular calificación integral de salud pedagógica
  // 50% Bloom HOTS balance + 50% BAP Inclusivity
  const combined = Math.round((bloom.hotsPercentage * 1.2) * 0.4 + (bap.score * 0.6));

  let pedagogicalHealthGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  if (combined >= 90) pedagogicalHealthGrade = 'A+';
  else if (combined >= 80) pedagogicalHealthGrade = 'A';
  else if (combined >= 70) pedagogicalHealthGrade = 'B';
  else if (combined >= 60) pedagogicalHealthGrade = 'C';
  else pedagogicalHealthGrade = 'D';

  const summary = `Dictamen Pedagógico: Nivel Dominante ${bloom.dominantLevel} con ${bloom.hotsPercentage}% de habilidades de orden superior (HOTS). Índice de Inclusión DUA/BAP: ${bap.score}/100. Grado institucional: ${pedagogicalHealthGrade}.`;

  return {
    bloomDistribution: bloom,
    bapInclusivityScore: bap.score,
    bapStrengths: bap.strengths,
    bapRecommendations: bap.recommendations,
    pedagogicalHealthGrade,
    summary,
  };
}
