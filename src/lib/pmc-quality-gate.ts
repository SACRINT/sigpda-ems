// src/lib/pmc-quality-gate.ts
/**
 * Quality Gate Oficial PMC (Programa de Mejora Continua)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Implementación de la Rúbrica y Matriz de Validación Institucional
 * para evaluar la calidad, coherencia y completitud técnica de los
 * proyectos PMC conforme a los lineamientos oficiales de la DBEPA.
 */

import type {
  PmcProject,
  PmcQualityAudit,
  PmcAuditCriterion,
  PmcIndicadoresAcademicos,
  PmcFodaData,
  PmcCategoriaPriorizada,
  PmcPlanAccion,
  PmcStaffMember,
  PmcDiagnosticoGenerado,
} from '@/types/pmc';

export const PMC_DIMENSIONS = {
  DIM1: 'Dimensión 1: Identificación y Organización Escolar',
  DIM2: 'Dimensión 2: Diagnóstico Integral e Indicadores Académicos',
  DIM3: 'Dimensión 3: Análisis Situacional FODA y Priorización',
  DIM4: 'Dimensión 4: Plan de Acción y Metas Institucionales',
  DIM5: 'Dimensión 5: Corresponsabilidad y Metas del Personal',
} as const;

function hasText(val: unknown, minLength = 3): boolean {
  return typeof val === 'string' && val.trim().length >= minLength;
}

function hasNumber(val: unknown): boolean {
  return typeof val === 'number' && !isNaN(val);
}

// ── Criterios Individuales ──────────────────────────────────────────────────

function evalC1_Identificacion(p: PmcProject): PmcAuditCriterion {
  const fields = [
    p.school_name,
    p.school_cct,
    p.school_zone,
    p.municipality,
    p.director_name,
    p.ciclo_escolar,
  ];
  const filled = fields.filter(f => hasText(f)).length;
  const isCctValid = typeof p.school_cct === 'string' && /^[0-9]{2}[A-Z]{3}[0-9]{4}[A-Z0-9]$/i.test(p.school_cct.trim());

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Datos de identificación del plantel incompletos.';

  if (filled >= 6 && isCctValid) {
    score = 8;
    status = 'pass';
    feedback = 'Cédula institucional completa con CCT normativo válido y autoridades identificadas.';
  } else if (filled >= 4) {
    score = 5;
    status = 'warning';
    feedback = isCctValid
      ? 'Faltan campos de identificación escolar (zona, municipio o director).'
      : 'CCT no cumple con la nomenclatura oficial SEP (10 caracteres alfanuméricos).';
  }

  return {
    id: 'PMC-C1',
    dimension: PMC_DIMENSIONS.DIM1,
    name: 'Identificación Institucional y CCT Oficial',
    description: 'Verifica registro completo de escuela, CCT de 10 dígitos, zona escolar, municipio y directivos.',
    weight: 8,
    maxScore: 8,
    score,
    status,
    feedback,
    evidenceFound: `${filled}/6 campos completados. CCT: ${p.school_cct || 'No registrado'}.`,
  };
}

function evalC2_Plantilla(p: PmcProject): PmcAuditCriterion {
  const staff = (Array.isArray(p.staff_data) ? p.staff_data : []) as PmcStaffMember[];
  const total = staff.length;
  const withCargo = staff.filter(s => hasText(s.nombre) && hasText(s.cargo)).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No se ha registrado la plantilla de personal de la institución.';

  if (total >= 5 && withCargo >= total * 0.8) {
    score = 8;
    status = 'pass';
    feedback = 'Plantilla del personal escolar debidamente estructurada con nombres y cargos asignados.';
  } else if (total >= 1) {
    score = 4;
    status = 'warning';
    feedback = 'Plantilla escolar con registro mínimo. Se recomienda registrar la totalidad del equipo docente y directivo.';
  }

  return {
    id: 'PMC-C2',
    dimension: PMC_DIMENSIONS.DIM1,
    name: 'Plantilla Docente y Administrativa',
    description: 'Verifica el censo del colectivo escolar con funciones y cargos operativos definidos.',
    weight: 8,
    maxScore: 8,
    score,
    status,
    feedback,
    evidenceFound: `${total} integrantes en plantilla (${withCargo} con función completa).`,
  };
}

function evalC3_Indicadores(p: PmcProject): PmcAuditCriterion {
  const ind = (p.indicadores_academicos || {}) as PmcIndicadoresAcademicos;
  const countMetrics = [
    hasNumber(ind.aprobacion_ant),
    hasNumber(ind.reprobacion_ant),
    hasNumber(ind.abandono_ant),
    hasNumber(ind.et_ant),
    hasNumber(ind.matricula),
  ].filter(Boolean).length;

  const hasTargets = hasNumber(ind.aprobacion_meta) && hasNumber(ind.abandono_meta);

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Sin indicadores cuantitativos de rendimiento escolar.';

  if (countMetrics >= 5 && hasTargets) {
    score = 10;
    status = 'pass';
    feedback = 'Indicadores históricos de aprobación, deserción y matrícula completos con metas cuantificables.';
  } else if (countMetrics >= 3) {
    score = 6;
    status = 'warning';
    feedback = 'Indicadores básicos presentes, pero faltan metas proyectadas o métricas de eficiencia terminal.';
  }

  return {
    id: 'PMC-C3',
    dimension: PMC_DIMENSIONS.DIM2,
    name: 'Indicadores Académicos y Línea Base',
    description: 'Valora matrícula, índices históricos de aprobación, reprobación, abandono y eficiencia terminal con metas.',
    weight: 10,
    maxScore: 10,
    score,
    status,
    feedback,
    evidenceFound: `${countMetrics}/5 indicadores históricos registrados. Metas proyectadas: ${hasTargets ? 'Sí' : 'No'}.`,
  };
}

function evalC4_DiagnosticoComunidad(p: PmcProject): PmcAuditCriterion {
  const diag = p.diagnostico_comunidad || '';
  const len = diag.trim().length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Diagnóstico comunitario ausente o insuficiente.';

  if (len >= 300) {
    score = 10;
    status = 'pass';
    feedback = 'Diagnóstico socioeducativo y comunitario amplio, con descripción del contexto local y entorno.';
  } else if (len >= 80) {
    score = 5;
    status = 'warning';
    feedback = 'Diagnóstico comunitario breve. Conviene profundizar en características socioeconómicas y familiares.';
  }

  return {
    id: 'PMC-C4',
    dimension: PMC_DIMENSIONS.DIM2,
    name: 'Diagnóstico Socioeducativo y Contexto Territorial',
    description: 'Evalúa la fundamentación del contexto sociocultural, económico y territorial del plantel.',
    weight: 10,
    maxScore: 10,
    score,
    status,
    feedback,
    evidenceFound: `${len} caracteres en la narrativa de diagnóstico comunitario.`,
  };
}

function evalC5_Foda(p: PmcProject): PmcAuditCriterion {
  const foda = (p.foda || {}) as PmcFodaData;
  const f = hasText(foda.fortalezas, 15);
  const o = hasText(foda.oportunidades, 15);
  const d = hasText(foda.debilidades, 15);
  const a = hasText(foda.amenazas, 15);
  const count = [f, o, d, a].filter(Boolean).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Matriz FODA incompleta o ausente.';

  if (count === 4) {
    score = 10;
    status = 'pass';
    feedback = 'Matriz FODA integral con los cuatro cuadrantes desarrollados con sustancia técnica.';
  } else if (count >= 2) {
    score = 5;
    status = 'warning';
    feedback = `FODA parcial (${count}/4 cuadrantes). Requiere completar factores internos y externos.`;
  }

  return {
    id: 'PMC-C5',
    dimension: PMC_DIMENSIONS.DIM3,
    name: 'Matriz Situacional FODA',
    description: 'Verifica el análisis de factores internos (F/D) y externos (O/A) de la institución.',
    weight: 10,
    maxScore: 10,
    score,
    status,
    feedback,
    evidenceFound: `${count}/4 cuadrantes FODA debidamente redactados.`,
  };
}

function evalC6_Categorias(p: PmcProject): PmcAuditCriterion {
  const cats = (Array.isArray(p.categorias_priorizadas) ? p.categorias_priorizadas : []) as PmcCategoriaPriorizada[];
  const count = cats.length;
  const totalTemas = cats.reduce((acc, c) => acc + (Array.isArray(c.temas) ? c.temas.length : 0), 0);

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No se han seleccionado categorías prioritarias de intervención escolar.';

  if (count >= 2 && totalTemas >= 2) {
    score = 8;
    status = 'pass';
    feedback = 'Categorías y temas prioritarios delimitados conforme a los ámbitos de mejora continua.';
  } else if (count >= 1) {
    score = 4;
    status = 'warning';
    feedback = 'Se cuenta con 1 categoría priorizada. Se recomienda seleccionar al menos 2 categorías estratégicas.';
  }

  return {
    id: 'PMC-C6',
    dimension: PMC_DIMENSIONS.DIM3,
    name: 'Priorización de Categorías y Ámbitos de Intervención',
    description: 'Constata la selección focalizada de categorías y temas prioritarios para la mejora escolar.',
    weight: 8,
    maxScore: 8,
    score,
    status,
    feedback,
    evidenceFound: `${count} categorías priorizadas con ${totalTemas} temas de intervención.`,
  };
}

function evalC7_DiagnosticoGenerado(p: PmcProject): PmcAuditCriterion {
  const dg = (p.diagnostico_generado || {}) as PmcDiagnosticoGenerado;
  const parts = [
    hasText(dg.presentacion, 40),
    hasText(dg.contexto, 40),
    hasText(dg.analisis_indicadores, 40),
    hasText(dg.sintesis_foda, 40),
    hasText(dg.priorizacion, 40),
  ].filter(Boolean).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Síntesis diagnóstica formal pendiente de integración.';

  if (parts >= 4) {
    score = 8;
    status = 'pass';
    feedback = 'Diagnóstico narrativo consolidado con presentación, indicadores, FODA y justificación de prioridades.';
  } else if (parts >= 2) {
    score = 4;
    status = 'warning';
    feedback = 'Diagnóstico narrativo en desarrollo. Faltan secciones de articulación o análisis de indicadores.';
  }

  return {
    id: 'PMC-C7',
    dimension: PMC_DIMENSIONS.DIM3,
    name: 'Articulación y Narrativa del Diagnóstico Institucional',
    description: 'Evalúa la coherencia narrativa entre diagnóstico, análisis cuantitativo y prioridades.',
    weight: 8,
    maxScore: 8,
    score,
    status,
    feedback,
    evidenceFound: `${parts}/5 secciones diagnósticas consolidadas.`,
  };
}

function evalC8_MetasInstitucionales(p: PmcProject): PmcAuditCriterion {
  const plan = (p.plan_accion || {}) as PmcPlanAccion;
  const metas = (Array.isArray(plan.metas_institucionales) ? plan.metas_institucionales : []);
  const count = metas.length;

  const VERB_REGEX = /^(aumentar|incrementar|reducir|disminuir|elevar|consolidar|fortalecer|mejorar|lograr|garantizar|promover|atender|desarrollar|implementar)/i;
  const PERCENT_REGEX = /[0-9]+(\.[0-9]+)?%|[0-9]+\s*(alumnos|estudiantes|puntos)/i;
  const POBLACION_REGEX = /(alumnos?|estudiantes?|jóvenes|comunidad|docentes?|plantel)/i;
  const ESTRATEGIA_REGEX = /(mediante|a través de|implementando|desarrollando|articulando|con base en|con apoyo)/i;
  const PERIODO_REGEX = /(ciclo|2026|2027|semestre|escolar|puebla|término)/i;

  const creaaCompliant = metas.filter(m => {
    const text = m.meta || '';
    const hasVerb = VERB_REGEX.test(text.trim());
    const hasNum = PERCENT_REGEX.test(text);
    const hasPoblacion = POBLACION_REGEX.test(text);
    const hasEstrategia = ESTRATEGIA_REGEX.test(text) || (hasText(m.estrategia, 20));
    const hasPeriodo = PERIODO_REGEX.test(text) || (hasText(m.periodo_fin, 3));
    return hasVerb && hasNum && hasPoblacion && hasEstrategia && hasPeriodo;
  }).length;

  const validMetas = metas.filter(m =>
    hasText(m.meta, 15) &&
    hasText(m.estrategia, 15) &&
    hasText(m.entregable, 5)
  ).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No hay metas institucionales estructuradas en el plan de acción.';

  if (count >= 2 && validMetas >= 2 && creaaCompliant >= 1) {
    score = 14;
    status = 'pass';
    feedback = `Metas institucionales formuladas con fórmula oficial CREAA ([VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO]) y entregables verificables.`;
  } else if (count >= 2 && validMetas >= 2) {
    score = 8;
    status = 'warning';
    feedback = 'Metas institucionales completas pero sin cumplimiento estricto de la fórmula oficial CREAA ([VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO]).';
  } else if (count >= 1) {
    score = 6;
    status = 'warning';
    feedback = 'Metas institucionales presentes pero con descripción incompleta de estrategia o entregables.';
  }

  return {
    id: 'PMC-C8',
    dimension: PMC_DIMENSIONS.DIM4,
    name: 'Metas Institucionales CREAA y Entregables Técnicos',
    description: 'Valora la formulación de metas con la fórmula sintáctica CREAA, estrategias situadas y productos verificables.',
    weight: 14,
    maxScore: 14,
    score,
    status,
    feedback,
    evidenceFound: `${count} metas institucionales registradas (${validMetas} con ficha técnica completa, ${creaaCompliant} con fórmula CREAA estricta).`,
  };
}

function evalC9_ResponsablesYFechas(p: PmcProject): PmcAuditCriterion {
  const plan = (p.plan_accion || {}) as PmcPlanAccion;
  const metas = (Array.isArray(plan.metas_institucionales) ? plan.metas_institucionales : []);
  const count = metas.length;

  const withResponsable = metas.filter(m => hasText(m.personal_designado, 3)).length;
  const withPeriodo = metas.filter(m => hasText(m.periodo_inicio) || hasText(m.periodo_fin)).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Sin responsables ni periodos calendarizados en las metas institucionales.';

  if (count >= 2 && withResponsable >= count * 0.8 && withPeriodo >= count * 0.8) {
    score = 10;
    status = 'pass';
    feedback = 'Asignación rigurosa de personal responsable y ventanas temporales de ejecución para cada meta.';
  } else if (withResponsable > 0 || withPeriodo > 0) {
    score = 5;
    status = 'warning';
    feedback = 'Asignación temporal o de responsables parcial. Es indispensable designar líderes para cada meta.';
  }

  return {
    id: 'PMC-C9',
    dimension: PMC_DIMENSIONS.DIM4,
    name: 'Asignación de Responsabilidades y Temporalidad',
    description: 'Verifica que cada meta cuente con un responsable designado y fechas límite de cumplimiento.',
    weight: 10,
    maxScore: 10,
    score,
    status,
    feedback,
    evidenceFound: `${withResponsable}/${count} con responsable asignado; ${withPeriodo}/${count} con periodo definido.`,
  };
}

function evalC10_MetasPersonal(p: PmcProject): PmcAuditCriterion {
  const plan = (p.plan_accion || {}) as PmcPlanAccion;
  const metasPers = (Array.isArray(plan.metas_personales) ? plan.metas_personales : []);
  const count = metasPers.length;

  const withDetails = metasPers.filter(m =>
    hasText(m.nombre, 3) &&
    hasText(m.meta_individual, 10) &&
    hasText(m.entregable, 3)
  ).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No se han formulado metas individuales de corresponsabilidad docente/directiva.';

  if (count >= 3 && withDetails >= count * 0.8) {
    score = 14;
    status = 'pass';
    feedback = 'Excelente corresponsabilidad del personal con metas individuales alineadas a los objetivos del PMC.';
  } else if (count >= 1) {
    score = 7;
    status = 'warning';
    feedback = 'Metas personales preliminares. Se recomienda incorporar metas para la totalidad del personal clave.';
  }

  return {
    id: 'PMC-C10',
    dimension: PMC_DIMENSIONS.DIM5,
    name: 'Corresponsabilidad y Metas Individuales del Personal',
    description: 'Evalúa el compromiso individual de docentes y directivos vinculado al proyecto escolar de mejora.',
    weight: 14,
    maxScore: 14,
    score,
    status,
    feedback,
    evidenceFound: `${count} metas personales registradas (${withDetails} completas con entregable).`,
  };
}

// ── Auditoría Global ────────────────────────────────────────────────────────

export function calculateGlobalPmcScore(project: PmcProject): PmcQualityAudit {
  const criteria: PmcAuditCriterion[] = [
    evalC1_Identificacion(project),
    evalC2_Plantilla(project),
    evalC3_Indicadores(project),
    evalC4_DiagnosticoComunidad(project),
    evalC5_Foda(project),
    evalC6_Categorias(project),
    evalC7_DiagnosticoGenerado(project),
    evalC8_MetasInstitucionales(project),
    evalC9_ResponsablesYFechas(project),
    evalC10_MetasPersonal(project),
  ];

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxPossibleScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const percentage = Math.round((totalScore / maxPossibleScore) * 100);

  const passedCriteria = criteria.filter(c => c.status === 'pass').length;
  const warningCriteria = criteria.filter(c => c.status === 'warning').length;
  const failedCriteria = criteria.filter(c => c.status === 'fail').length;

  let overallStatus: PmcQualityAudit['overallStatus'] = 'REQUIERE_REVISION';
  if (percentage >= 85 && failedCriteria === 0) {
    overallStatus = 'EXCELENTE';
  } else if (percentage >= 70) {
    overallStatus = 'SATISFACTORIO';
  } else if (percentage >= 50) {
    overallStatus = 'EN_DESARROLLO';
  }

  // Desglose por dimensiones
  const dimensionScores: PmcQualityAudit['dimensionScores'] = {};
  for (const c of criteria) {
    if (!dimensionScores[c.dimension]) {
      dimensionScores[c.dimension] = { score: 0, maxScore: 0, percentage: 0 };
    }
    dimensionScores[c.dimension].score += c.score;
    dimensionScores[c.dimension].maxScore += c.maxScore;
  }
  for (const dim of Object.keys(dimensionScores)) {
    const ds = dimensionScores[dim];
    ds.percentage = ds.maxScore > 0 ? Math.round((ds.score / ds.maxScore) * 100) : 0;
  }

  const strengths = criteria
    .filter(c => c.status === 'pass')
    .map(c => `${c.name}: ${c.feedback}`);

  const criticalRecommendations = criteria
    .filter(c => c.status !== 'pass')
    .map(c => `${c.name}: ${c.feedback}`);

  return {
    totalScore,
    maxPossibleScore,
    percentage,
    overallStatus,
    passedCriteria,
    warningCriteria,
    failedCriteria,
    criteria,
    dimensionScores,
    strengths,
    criticalRecommendations,
    auditedAt: new Date().toISOString(),
  };
}

export const auditPmcProject = calculateGlobalPmcScore;

export function formatPmcAuditReport(audit: PmcQualityAudit): string {
  const lines: string[] = [
    `=== DICTAMEN TÉCNICO DE CALIDAD PMC — DBEPA PUEBLA ===`,
    `Calificación Global: ${audit.percentage}/100 (${audit.totalScore}/${audit.maxPossibleScore} pts)`,
    `Estatus Oficial: ${audit.overallStatus}`,
    `Criterios: ${audit.passedCriteria} Aprobados | ${audit.warningCriteria} Con Observación | ${audit.failedCriteria} No Acreditados`,
    `Fecha de Evaluación: ${new Date(audit.auditedAt).toLocaleString('es-MX')}`,
    '',
    `--- DESGLOSE POR DIMENSIONES NORMATIVAS ---`,
  ];

  for (const [dim, scores] of Object.entries(audit.dimensionScores)) {
    lines.push(`• ${dim}: ${scores.score}/${scores.maxScore} pts (${scores.percentage}%)`);
  }

  if (audit.criticalRecommendations.length > 0) {
    lines.push('', '--- RECOMENDACIONES DE MEJORA PRIORITARIAS ---');
    audit.criticalRecommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}
