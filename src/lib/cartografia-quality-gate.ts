/**
 * cartografia-quality-gate.ts
 * Quality Gate y Evaluador Oficial de Calidad de la Cartografía de Zona Escolar
 * SIGPDA-EMS · MCCEMS Puebla Ciclo Escolar 2026-2027
 * 
 * Evalúa los 5 Momentos Oficiales y la Memoria Pedagógica con base en la rúbrica institucional.
 */

import type { CartografiaZonaProject } from '@/types/cartografia';
import { formatZoneMetric } from '@/lib/zone-metric-format';

export interface CartografiaAuditCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  score: number;
  status: 'pass' | 'warning' | 'fail';
  feedback: string;
}

export interface CartografiaQualityReport {
  totalScore: number;
  maxScore: number;
  percentage: number;
  status: 'EXCELENTE' | 'SATISFACTORIO' | 'EN_DESARROLLO' | 'REQUIERE_REVISION';
  criteria: CartografiaAuditCriterion[];
  strengths: string[];
  recommendations: string[];
}

function hasText(val: unknown, minLen = 10): boolean {
  return typeof val === 'string' && val.trim().length >= minLen;
}

export function auditCartografiaProject(project: CartografiaZonaProject): CartografiaQualityReport {
  const criteria: CartografiaAuditCriterion[] = [];
  const strengths: string[] = [];
  const recommendations: string[] = [];

  // C1: Momento 1 - Conocer (15 pts)
  const numPlanteles = project.momento1Conocer?.planteles?.length || 0;
  const matTotal = project.momento1Conocer?.matriculaTotalZona || 0;
  if (numPlanteles >= 5 && matTotal > 0 && hasText(project.momento1Conocer?.caracterizacionInicial, 20)) {
    criteria.push({
      id: 'CART-C1',
      name: 'Momento 1: Conocer — Mapeo Inicial del Territorio',
      description: 'Identificación de los planteles de la zona escolar, CCTs, matrícula y municipios de cobertura.',
      weight: 15,
      score: 15,
      status: 'pass',
      feedback: `Excelente caracterización inicial: ${numPlanteles} planteles y ${matTotal} estudiantes registrados.`,
    });
    strengths.push(`Padrón completo de ${numPlanteles} planteles con identificación territorial.`);
  } else if (numPlanteles >= 1) {
    criteria.push({
      id: 'CART-C1',
      name: 'Momento 1: Conocer — Mapeo Inicial del Territorio',
      description: 'Identificación de los planteles de la zona escolar, CCTs, matrícula y municipios de cobertura.',
      weight: 15,
      score: 10,
      status: 'warning',
      feedback: 'Padrón de planteles incompleto o con descripción territorial breve.',
    });
    recommendations.push('Completar la información de matrícula y caracterización de todos los planteles de la zona.');
  } else {
    criteria.push({
      id: 'CART-C1',
      name: 'Momento 1: Conocer — Mapeo Inicial del Territorio',
      description: 'Identificación de los planteles de la zona escolar, CCTs, matrícula y municipios de cobertura.',
      weight: 15,
      score: 0,
      status: 'fail',
      feedback: 'No se identificaron planteles en la zona escolar.',
    });
  }

  // C2: Momento 2 - Organizar (20 pts: Capa Cuantitativa + Capa Cualitativa)
  const cCuant = project.momento2Organizar?.capaCuantitativa;
  const cCual = project.momento2Organizar?.capaCualitativa;
  const hasCuant = Boolean(cCuant && cCuant.promedioAbandonoZona > 0 && (cCuant.promedioEficienciaZona ?? 0) > 0);
  const hasCual = Boolean(cCual && cCual.problematicasComunes?.length > 0);

  if (hasCuant && hasCual) {
    criteria.push({
      id: 'CART-C2',
      name: 'Momento 2: Organizar — Evidencias Multidimensionales (Cuantitativa + Cualitativa)',
      description: 'Cruce e integración de estadísticas 911/F11 y problemáticas contextuadas de los proyectos PAEC.',
      weight: 20,
      score: 20,
      status: 'pass',
      feedback: `Articulación sólida: Capa cuantitativa (Abandono ${formatZoneMetric(cCuant?.promedioAbandonoZona, { pct: true })}, Eficiencia ${formatZoneMetric(cCuant?.promedioEficienciaZona, { pct: true })}) y problemáticas cualitativas PAEC vinculadas.`,
    });
    strengths.push('Integración rigurosa de datos cuantitativos (911/F11) con el contexto comunitario PAEC.');
  } else if (hasCuant || hasCual) {
    criteria.push({
      id: 'CART-C2',
      name: 'Momento 2: Organizar — Evidencias Multidimensionales (Cuantitativa + Cualitativa)',
      description: 'Cruce e integración de estadísticas 911/F11 y problemáticas contextuadas de los proyectos PAEC.',
      weight: 20,
      score: 12,
      status: 'warning',
      feedback: 'Presencia parcial de datos: falta consolidar plenamente la capa cuantitativa o la cualitativa.',
    });
    recommendations.push('Asegurar que la matriz de zona incluya tanto las estadísticas 911/F11 como las problemáticas de los PAEC.');
  } else {
    criteria.push({
      id: 'CART-C2',
      name: 'Momento 2: Organizar — Evidencias Multidimensionales (Cuantitativa + Cualitativa)',
      description: 'Cruce e integración de estadísticas 911/F11 y problemáticas contextuadas de los proyectos PAEC.',
      weight: 20,
      score: 0,
      status: 'fail',
      feedback: 'Ausencia de datos cuantitativos 911/F11 y diagnósticos cualitativos.',
    });
  }

  // C3: Momento 3 - Ubicar (15 pts)
  const m3 = project.momento3Ubicar;
  const hasAliados = (m3?.recursosAliados?.length || 0) >= 2;
  const hasTerritorio = hasText(m3?.descripcionTerritorial, 30) && hasText(m3?.movilidadTransporte, 20);

  if (hasAliados && hasTerritorio) {
    criteria.push({
      id: 'CART-C3',
      name: 'Momento 3: Ubicar — Mapeo Escuela-Territorio y Aliados Comunitarios',
      description: 'Georreferenciación, análisis de movilidad, conectividad e identificación de aliados comunitarios.',
      weight: 15,
      score: 15,
      status: 'pass',
      feedback: `Mapeo situado completo con ${m3.recursosAliados.length} aliados estratégicos y diagnóstico de movilidad territorial.`,
    });
    strengths.push('Identificación clara de recursos comunitarios y factores de movilidad territorial.');
  } else if (hasTerritorio || hasAliados) {
    criteria.push({
      id: 'CART-C3',
      name: 'Momento 3: Ubicar — Mapeo Escuela-Territorio y Aliados Comunitarios',
      description: 'Georreferenciación, análisis de movilidad, conectividad e identificación de aliados comunitarios.',
      weight: 15,
      score: 9,
      status: 'warning',
      feedback: 'Mapeo territorial presente pero requiere detallar más aliados o factores de conectividad.',
    });
  } else {
    criteria.push({
      id: 'CART-C3',
      name: 'Momento 3: Ubicar — Mapeo Escuela-Territorio y Aliados Comunitarios',
      description: 'Georreferenciación, análisis de movilidad, conectividad e identificación de aliados comunitarios.',
      weight: 15,
      score: 0,
      status: 'fail',
      feedback: 'No se incluye la descripción territorial ni los aliados comunitarios.',
    });
  }

  // C4: Momento 4 - Analizar (Triangulación de 4 Perspectivas) (15 pts)
  const tri = project.momento4Analizar?.triangulacion;
  const has4Perspectivas =
    hasText(tri?.directivos, 15) &&
    hasText(tri?.docentes, 15) &&
    hasText(tri?.alumnosFamilias, 15) &&
    hasText(tri?.supervisionAtp, 15);

  if (has4Perspectivas) {
    criteria.push({
      id: 'CART-C4',
      name: 'Momento 4: Analizar — Triangulación de Perspectivas y Autonomía',
      description: 'Cruce de miradas entre directivos, docentes, alumnos/familias y supervisión para evitar sesgos.',
      weight: 15,
      score: 15,
      status: 'pass',
      feedback: 'Triangulación integral cumplida con las 4 perspectivas clave de la comunidad escolar.',
    });
    strengths.push('Metodología de triangulación exhaustiva que equilibra la voz institucional y la comunitaria.');
  } else if (tri && (hasText(tri?.directivos, 10) || hasText(tri?.docentes, 10))) {
    criteria.push({
      id: 'CART-C4',
      name: 'Momento 4: Analizar — Triangulación de Perspectivas y Autonomía',
      description: 'Cruce de miradas entre directivos, docentes, alumnos/familias y supervisión para evitar sesgos.',
      weight: 15,
      score: 8,
      status: 'warning',
      feedback: 'Triangulación incompleta: faltan las voces de alumnos/familias o de la supervisión.',
    });
    recommendations.push('Incorporar activamente la perspectiva de los estudiantes, familias y equipo de ATP.');
  } else {
    criteria.push({
      id: 'CART-C4',
      name: 'Momento 4: Analizar — Triangulación de Perspectivas y Autonomía',
      description: 'Cruce de miradas entre directivos, docentes, alumnos/familias y supervisión para evitar sesgos.',
      weight: 15,
      score: 0,
      status: 'fail',
      feedback: 'No se implementó la metodología de triangulación de perspectivas.',
    });
  }

  // C5: Momento 5 - Decidir (Meta General con Fórmula CREAA) (15 pts)
  const metaGen = project.momento5Decidir?.metaGeneralZona || '';
  const creaaRegex = /^(reducir|disminuir|incrementar|aumentar|lograr|alcanzar|consolidar|implementar|fortalecer|garantizar)\b.*(\d+%|\d+\s*(alumnos|estudiantes|planteles)).*(en|durante|mediante|a través de).*(2026|2027|ciclo escolar)/i;
  const isCreaaValid = creaaRegex.test(metaGen) || (metaGen.length > 50 && /\d+%/.test(metaGen));

  if (isCreaaValid && hasText(metaGen, 40)) {
    criteria.push({
      id: 'CART-C5',
      name: 'Momento 5: Decidir — Meta General de Zona con Fórmula CREAA',
      description: 'Formulación sintáctica oficial: [VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO].',
      weight: 15,
      score: 15,
      status: 'pass',
      feedback: 'Meta general de zona formulada con estricta observancia de la sintaxis CREAA de la SEMS / MCCEMS.',
    });
    strengths.push('Meta general de zona alineada a la política estatal CREAA con metas cuantificables.');
  } else if (hasText(metaGen, 20)) {
    criteria.push({
      id: 'CART-C5',
      name: 'Momento 5: Decidir — Meta General de Zona con Fórmula CREAA',
      description: 'Formulación sintáctica oficial: [VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO].',
      weight: 15,
      score: 8,
      status: 'warning',
      feedback: 'La meta general está redactada pero carece de la estructura sintáctica completa de la fórmula CREAA.',
    });
    recommendations.push('Reescribir la meta general con la fórmula: [VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO].');
  } else {
    criteria.push({
      id: 'CART-C5',
      name: 'Momento 5: Decidir — Meta General de Zona con Fórmula CREAA',
      description: 'Formulación sintáctica oficial: [VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO].',
      weight: 15,
      score: 0,
      status: 'fail',
      feedback: 'No se definió la meta general de la zona escolar.',
    });
  }

  // C6: Momento 5 - 3 Líneas de Acción Oficiales MCCEMS (10 pts)
  const lineas = project.momento5Decidir?.lineasAccion || [];
  if (lineas.length >= 3 && lineas.every((l) => l.accionesEspecificas?.length >= 2 && hasText(l.entregables, 5))) {
    criteria.push({
      id: 'CART-C6',
      name: 'Momento 5: Decidir — 3 Líneas de Acción Oficiales MCCEMS',
      description: 'Presencia de las 3 líneas oficiales: L1 (Diagnóstico/EDIEMS), L2 (Articulación PAEC), L3 (Encuentros y Retención).',
      weight: 10,
      score: 10,
      status: 'pass',
      feedback: 'Las 3 líneas de acción oficiales están completamente desarrolladas con cronograma y entregables.',
    });
    strengths.push('Alineación exacta a las 3 líneas de acción prioritarias establecidas por la SEMS / MCCEMS.');
  } else if (lineas.length >= 1) {
    criteria.push({
      id: 'CART-C6',
      name: 'Momento 5: Decidir — 3 Líneas de Acción Oficiales MCCEMS',
      description: 'Presencia de las 3 líneas oficiales: L1 (Diagnóstico/EDIEMS), L2 (Articulación PAEC), L3 (Encuentros y Retención).',
      weight: 10,
      score: 6,
      status: 'warning',
      feedback: 'Faltan líneas de acción o están incompletas en sus acciones o entregables.',
    });
  } else {
    criteria.push({
      id: 'CART-C6',
      name: 'Momento 5: Decidir — 3 Líneas de Acción Oficiales MCCEMS',
      description: 'Presencia de las 3 líneas oficiales: L1 (Diagnóstico/EDIEMS), L2 (Articulación PAEC), L3 (Encuentros y Retención).',
      weight: 10,
      score: 0,
      status: 'fail',
      feedback: 'No se especificaron las líneas de acción de zona.',
    });
  }

  // C7: Memoria Pedagógica y Trascendencia (10 pts)
  const mem = project.memoriaPedagogica;
  const hasMemoria =
    mem &&
    hasText(mem.queLogramos, 20) &&
    hasText(mem.comoLoLogramos, 20) &&
    hasText(mem.queAprendimos, 20);

  if (hasMemoria) {
    criteria.push({
      id: 'CART-C7',
      name: 'Memoria Pedagógica — ¿Qué logramos?, ¿Cómo lo logramos?, ¿Qué aprendimos?',
      description: 'Sistematización de la autonomía profesional, adaptaciones de aula e indicadores de cambio.',
      weight: 10,
      score: 10,
      status: 'pass',
      feedback: 'Memoria pedagógica viva y reflexiva con las tres interrogantes oficiales plenamente desarrolladas.',
    });
    strengths.push('Construcción de memoria pedagógica reflexiva que trasciende el dato administrativo.');
  } else if (mem && (hasText(mem.queLogramos, 10) || hasText(mem.queAprendimos, 10))) {
    criteria.push({
      id: 'CART-C7',
      name: 'Memoria Pedagógica — ¿Qué logramos?, ¿Cómo lo logramos?, ¿Qué aprendimos?',
      description: 'Sistematización de la autonomía profesional, adaptaciones de aula e indicadores de cambio.',
      weight: 10,
      score: 5,
      status: 'warning',
      feedback: 'Memoria pedagógica presente pero requiere profundizar en las lecciones aprendidas.',
    });
  } else {
    criteria.push({
      id: 'CART-C7',
      name: 'Memoria Pedagógica — ¿Qué logramos?, ¿Cómo lo logramos?, ¿Qué aprendimos?',
      description: 'Sistematización de la autonomía profesional, adaptaciones de aula e indicadores de cambio.',
      weight: 10,
      score: 0,
      status: 'fail',
      feedback: 'No se incluye la Memoria Pedagógica de la Cartografía.',
    });
  }

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxScore = criteria.reduce((sum, c) => sum + c.weight, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);

  let status: CartografiaQualityReport['status'] = 'REQUIERE_REVISION';
  if (percentage >= 85) status = 'EXCELENTE';
  else if (percentage >= 70) status = 'SATISFACTORIO';
  else if (percentage >= 50) status = 'EN_DESARROLLO';

  return {
    totalScore,
    maxScore,
    percentage,
    status,
    criteria,
    strengths,
    recommendations,
  };
}
