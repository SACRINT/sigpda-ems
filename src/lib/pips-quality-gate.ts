// src/lib/pips-quality-gate.ts
/**
 * Quality Gate Oficial PIPS (Programa Institucional de Prácticas y Supervisión)
 * SIGPDA-EMS · MCCEMS Puebla 2026-2027
 *
 * Sistema de auditoría técnica y pedagógica para proyectos de supervisión escolar zonal,
 * evaluando cobertura, diagnóstico territorial, metas, cronograma de acompañamiento y
 * rendición de cuentas conforme a la Guía Oficial de Supervisión Escolar de la SEMS / MCCEMS.
 */

import type {
  PipsProject,
  PipsQualityAudit,
  PipsAuditCriterion,
  PipsPlantele,
  PipsProblematica,
  PipsObjetivo,
  PipsCronogramaActividad,
} from '@/types/pips';

export const PIPS_DIMENSIONS = {
  DIM1: 'Dimensión 1: Identificación Zonal y Equipo Supervisor',
  DIM2: 'Dimensión 2: Reflexión Retrospectiva y Diagnóstico Zonal',
  DIM3: 'Dimensión 3: Censo y Matrícula de Planteles',
  DIM4: 'Dimensión 4: Objetivos y Metas de Supervisión',
  DIM5: 'Dimensión 5: Cronograma de Acompañamiento Técnico-Pedagógico',
  DIM6: 'Dimensión 6: Evaluación, Indicadores y Rendición de Cuentas',
} as const;

function hasText(val: unknown, minLength = 3): boolean {
  return typeof val === 'string' && val.trim().length >= minLength;
}

// ── Criterios Individuales ──────────────────────────────────────────────────

function evalC1_IdentificacionZonal(p: PipsProject): PipsAuditCriterion {
  const fields = [
    p.zona_clave,
    p.zona_nombre,
    p.supervisor_name,
    p.municipio_sede,
    p.municipios_atiende,
    p.ciclo_escolar,
    p.subsistema,
  ];
  const filled = fields.filter(f => hasText(f)).length;
  const hasPresentation = hasText(p.presentacion_supervisor, 40);

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Datos de identificación de la zona escolar incompletos.';

  if (filled >= 7 && hasPresentation) {
    score = 10;
    status = 'pass';
    feedback = 'Identificación zonal completa con clave oficial, municipios de cobertura y presentación del supervisor.';
  } else if (filled >= 4) {
    score = 5;
    status = 'warning';
    feedback = 'Identificación zonal parcial. Se requiere completar datos de sede, subsistema o presentación institucional.';
  }

  return {
    id: 'PIPS-C1',
    dimension: PIPS_DIMENSIONS.DIM1,
    name: 'Identificación Zonal y Encuadre Institucional',
    description: 'Verifica clave y nombre de zona, supervisor titular, municipios atendidos y presentación oficial.',
    weight: 10,
    maxScore: 10,
    score,
    status,
    feedback,
    evidenceFound: `${filled}/7 campos zonales registrados. Presentación: ${hasPresentation ? 'Sí' : 'No'}.`,
  };
}

function evalC2_ReflexionRetrospectiva(p: PipsProject): PipsAuditCriterion {
  const hasReflexion = hasText(p.reflexion_pips_anterior, 30);
  const hasFortalezas = hasText(p.fortalezas_anterior, 20);
  const hasAreas = hasText(p.areas_oportunidad_anterior, 20);
  const count = [hasReflexion, hasFortalezas, hasAreas].filter(Boolean).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Sin balance retrospectivo del ciclo escolar anterior.';

  if (count === 3) {
    score = 10;
    status = 'pass';
    feedback = 'Reflexión retrospectiva exhaustiva con fortalezas y áreas de oportunidad delimitadas.';
  } else if (count >= 1 || p.pips_anterior_realizado) {
    score = 5;
    status = 'warning';
    feedback = 'Análisis del ciclo previo incompleto. Se recomienda detallar áreas de oportunidad y logros consolidados.';
  }

  return {
    id: 'PIPS-C2',
    dimension: PIPS_DIMENSIONS.DIM2,
    name: 'Reflexión Retrospectiva del Ciclo Previo',
    description: 'Valora el balance crítico del PIPS anterior, identificando aprendizajes institucionales y áreas de mejora.',
    weight: 10,
    maxScore: 10,
    score,
    status,
    feedback,
    evidenceFound: `${count}/3 secciones retrospectivas completadas.`,
  };
}

function evalC3_CensoPlanteles(p: PipsProject): PipsAuditCriterion {
  const planteles = (Array.isArray(p.planteles_json) ? p.planteles_json : []) as PipsPlantele[];
  const total = planteles.length;
  const withCct = planteles.filter(pl => hasText(pl.cct, 8)).length;
  const withMatricula = planteles.filter(pl => typeof pl.total === 'number' && pl.total > 0).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No hay planteles censados en la zona escolar.';

  if (total >= 1 && withCct === total && withMatricula === total) {
    score = 15;
    status = 'pass';
    feedback = `Censo zonal completo: ${total} planteles con CCT oficial y matrícula desagregada por género.`;
  } else if (total >= 1) {
    score = 8;
    status = 'warning';
    feedback = `Censo con ${total} planteles, pero algunos carecen de CCT normativo o desglose de matrícula.`;
  }

  return {
    id: 'PIPS-C3',
    dimension: PIPS_DIMENSIONS.DIM3,
    name: 'Censo y Matrícula Desagregada de Planteles',
    description: 'Constata el inventario oficial de centros escolares, CCTs, localidades y matrícula (hombres, mujeres, total).',
    weight: 15,
    maxScore: 15,
    score,
    status,
    feedback,
    evidenceFound: `${total} planteles registrados (${withCct} con CCT válido, ${withMatricula} con matrícula total).`,
  };
}

function evalC4_DiagnosticoYProblematicas(p: PipsProject): PipsAuditCriterion {
  const diagLen = (p.diagnostico_contexto || '').trim().length;
  const probs = (Array.isArray(p.problematicas_json) ? p.problematicas_json : []) as PipsProblematica[];
  const totalProbs = probs.length;
  const withPrioridad = probs.filter(pr => ['alta', 'media', 'baja'].includes(pr.prioridad)).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Diagnóstico contextual zonal y matriz de problemáticas ausentes.';

  if (diagLen >= 200 && totalProbs >= 2 && withPrioridad >= totalProbs) {
    score = 15;
    status = 'pass';
    feedback = 'Diagnóstico territorial robusto y matriz de problemáticas jerarquizada por nivel de prioridad.';
  } else if (diagLen >= 50 || totalProbs >= 1) {
    score = 8;
    status = 'warning';
    feedback = 'Diagnóstico o problemáticas preliminares. Se requiere priorizar formalmente las situaciones críticas.';
  }

  return {
    id: 'PIPS-C4',
    dimension: PIPS_DIMENSIONS.DIM2,
    name: 'Diagnóstico Territorial y Jerarquización de Problemáticas',
    description: 'Evalúa la fundamentación del contexto zonal y la clasificación de problemáticas prioritarias.',
    weight: 15,
    maxScore: 15,
    score,
    status,
    feedback,
    evidenceFound: `${diagLen} caracteres en diagnóstico; ${totalProbs} problemáticas zonales jerarquizadas.`,
  };
}

function evalC5_ObjetivosYMetas(p: PipsProject): PipsAuditCriterion {
  const hasGeneral = hasText(p.objetivo_general, 20);
  const especificos = (Array.isArray(p.objetivos_especificos_json) ? p.objetivos_especificos_json : []) as PipsObjetivo[];
  const totalEsp = especificos.length;

  let totalMetas = 0;
  let metasCompletas = 0;
  for (const obj of especificos) {
    if (Array.isArray(obj.metas)) {
      totalMetas += obj.metas.length;
      metasCompletas += obj.metas.filter(m => hasText(m.meta, 10) && hasText(m.indicador, 5) && hasText(m.responsable, 3)).length;
    }
  }

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Objetivos y metas de supervisión no estructurados.';

  if (hasGeneral && totalEsp >= 2 && metasCompletas >= 2) {
    score = 20;
    status = 'pass';
    feedback = 'Estructura teleológica impecable: objetivo general, objetivos específicos y metas con indicadores y responsables.';
  } else if (hasGeneral && totalEsp >= 1) {
    score = 10;
    status = 'warning';
    feedback = 'Objetivos presentes pero con metas o indicadores incompletos en los objetivos específicos.';
  }

  return {
    id: 'PIPS-C5',
    dimension: PIPS_DIMENSIONS.DIM4,
    name: 'Objetivos de Supervisión y Metas Operativas',
    description: 'Verifica la formulación del objetivo general y objetivos específicos con metas, indicadores y responsables.',
    weight: 20,
    maxScore: 20,
    score,
    status,
    feedback,
    evidenceFound: `Obj. General: ${hasGeneral ? 'Sí' : 'No'}; ${totalEsp} Obj. Específicos con ${totalMetas} metas (${metasCompletas} completas).`,
  };
}

function evalC6_CronogramaAcompanamiento(p: PipsProject): PipsAuditCriterion {
  const crono = (Array.isArray(p.cronograma_json) ? p.cronograma_json : []) as PipsCronogramaActividad[];
  const total = crono.length;

  const validActs = crono.filter(a =>
    hasText(a.actividad, 10) &&
    hasText(a.responsable, 3) &&
    hasText(a.mes, 2)
  ).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Cronograma de visitas y asesoría técnica ausente.';

  if (total >= 4 && validActs >= total * 0.8) {
    score = 15;
    status = 'pass';
    feedback = 'Cronograma de acompañamiento técnico-pedagógico calendarizado con responsables y meses de visita.';
  } else if (total >= 1) {
    score = 8;
    status = 'warning';
    feedback = 'Cronograma preliminar. Se recomienda calendarizar actividades a lo largo de todo el ciclo escolar.';
  }

  return {
    id: 'PIPS-C6',
    dimension: PIPS_DIMENSIONS.DIM5,
    name: 'Cronograma de Acompañamiento Técnico-Pedagógico',
    description: 'Valora la programación sistemática de visitas, asesorías, reuniones de directores y acompañamiento.',
    weight: 15,
    maxScore: 15,
    score,
    status,
    feedback,
    evidenceFound: `${total} actividades calendarizadas (${validActs} con responsable y mes programado).`,
  };
}

function evalC7_EvaluacionEInstrumentos(p: PipsProject): PipsAuditCriterion {
  const evalData = (Array.isArray(p.evaluacion_json) ? p.evaluacion_json : []);
  const total = evalData.length;

  const validItems = evalData.filter(e =>
    hasText(e.indicador, 5) &&
    hasText(e.meta, 5) &&
    hasText(e.instrumento, 5)
  ).length;

  let score = 0;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Sin instrumentos de evaluación ni indicadores de seguimiento zonal.';

  if (total >= 2 && validItems >= 2) {
    score = 15;
    status = 'pass';
    feedback = 'Sistema de evaluación zonal integral con indicadores medibles e instrumentos de verificación claros.';
  } else if (total >= 1) {
    score = 8;
    status = 'warning';
    feedback = 'Instrumentos de evaluación preliminares. Se recomienda especificar instrumentos formales de seguimiento.';
  }

  return {
    id: 'PIPS-C7',
    dimension: PIPS_DIMENSIONS.DIM6,
    name: 'Monitoreo, Semáforos e Instrumentos de Evaluación',
    description: 'Evalúa la definición de indicadores, metas cuantitativas e instrumentos para el seguimiento de la supervisión.',
    weight: 15,
    maxScore: 15,
    score,
    status,
    feedback,
    evidenceFound: `${total} mecanismos de evaluación definidos (${validItems} con instrumento formal).`,
  };
}

// ── Auditoría Global ────────────────────────────────────────────────────────

export function calculateGlobalPipsScore(project: PipsProject): PipsQualityAudit {
  const criteria: PipsAuditCriterion[] = [
    evalC1_IdentificacionZonal(project),
    evalC2_ReflexionRetrospectiva(project),
    evalC3_CensoPlanteles(project),
    evalC4_DiagnosticoYProblematicas(project),
    evalC5_ObjetivosYMetas(project),
    evalC6_CronogramaAcompanamiento(project),
    evalC7_EvaluacionEInstrumentos(project),
  ];

  const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
  const maxPossibleScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);
  const percentage = Math.round((totalScore / maxPossibleScore) * 100);

  const passedCriteria = criteria.filter(c => c.status === 'pass').length;
  const warningCriteria = criteria.filter(c => c.status === 'warning').length;
  const failedCriteria = criteria.filter(c => c.status === 'fail').length;

  let overallStatus: PipsQualityAudit['overallStatus'] = 'REQUIERE_REVISION';
  if (percentage >= 85 && failedCriteria === 0) {
    overallStatus = 'EXCELENTE';
  } else if (percentage >= 70) {
    overallStatus = 'SATISFACTORIO';
  } else if (percentage >= 50) {
    overallStatus = 'EN_DESARROLLO';
  }

  // Desglose por dimensiones
  const dimensionScores: PipsQualityAudit['dimensionScores'] = {};
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

export function formatPipsAuditReport(audit: PipsQualityAudit): string {
  const lines: string[] = [
    `=== DICTAMEN TÉCNICO DE CALIDAD PIPS — SUPERVISIÓN ESCOLAR MCCEMS ===`,
    `Calificación Global: ${audit.percentage}/100 (${audit.totalScore}/${audit.maxPossibleScore} pts)`,
    `Estatus Oficial: ${audit.overallStatus}`,
    `Criterios: ${audit.passedCriteria} Aprobados | ${audit.warningCriteria} Con Observación | ${audit.failedCriteria} No Acreditados`,
    `Fecha de Evaluación: ${new Date(audit.auditedAt).toLocaleString('es-MX')}`,
    '',
    `--- DESGLOSE POR DIMENSIONES DE SUPERVISIÓN ---`,
  ];

  for (const [dim, scores] of Object.entries(audit.dimensionScores)) {
    lines.push(`• ${dim}: ${scores.score}/${scores.maxScore} pts (${scores.percentage}%)`);
  }

  if (audit.criticalRecommendations.length > 0) {
    lines.push('', '--- RECOMENDACIONES DE MEJORA ZONAL ---');
    audit.criticalRecommendations.forEach((rec, idx) => {
      lines.push(`${idx + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}
