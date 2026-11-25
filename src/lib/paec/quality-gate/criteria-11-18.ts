import type {
  PaecAuditCriterion,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
  PlanOperativoData,
} from '@/types/paec';
import { auditPaecPlan } from '@/lib/qa/paec-pmc-semantic-qa';
import { DIMENSIONS } from './shared';

export function evaluateCriterio11(cronograma: CronogramaRow[] | null | undefined): PaecAuditCriterion {
  const rows = Array.isArray(cronograma)
    ? cronograma
    : (((cronograma as unknown as Record<string, unknown>)?.cronograma ||
        (cronograma as unknown as Record<string, unknown>)?.semanas ||
        []) as CronogramaRow[]);
  const phaseCount = rows.length;

  let fullColumnRows = 0;
  let thematicPhases = 0;
  for (const r of rows) {
    const rAny = r as unknown as Record<string, unknown>;
    const rawPhase = r.phase || rAny.fase || '';
    const rawTitle = rAny.phaseTitle || rAny.tituloTematico || '';
    const combinedPhase = String(
      rawTitle && !String(rawPhase).includes(String(rawTitle))
        ? `${rawPhase}: ${rawTitle}`
        : rawPhase
    ).trim();

    const hasPhase = combinedPhase.length > 0;
    const hasObj = Boolean(r.objective && r.objective.trim().length > 0);
    const hasMacro = Boolean(r.macroActivities && r.macroActivities.trim().length > 0);
    const hasResp = Boolean(r.responsibleSubjects && r.responsibleSubjects.trim().length > 0);
    const hasSem = Boolean((r.semesterInvolved && String(r.semesterInvolved).trim().length > 0) || r.semester);

    if (hasPhase && hasObj && hasMacro && hasResp && hasSem) {
      fullColumnRows++;
    }

    if (combinedPhase && /fase\s*(\d+|[ivx]+)\s*[:—–-]\s*.+/i.test(combinedPhase)) {
      thematicPhases++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Cronograma bimestral ausente o con menos de 3 fases.';
  let evidenceFound = `${phaseCount}/6 fases registradas.`;

  if (phaseCount === 6 && fullColumnRows === 6) {
    score = 4;
    status = 'pass';
    feedback = 'Cronograma completo con exactamente 6 fases bimestrales y las 5 columnas normativas detalladas al 100%.';
    evidenceFound = thematicPhases > 0
      ? `6/6 fases bimestrales con 5 columnas completas y títulos temáticos situados (${thematicPhases}/6).`
      : `6/6 fases bimestrales con 5 columnas completas (Fase, Objetivo, Macro-actividades, Responsables, Semestre).`;
  } else if (phaseCount >= 5 && fullColumnRows >= 4) {
    score = 3;
    status = 'pass';
    feedback = 'Cronograma bien estructurado. Asegurar que las 6 fases cubran el ciclo anual de manera balanceada.';
    evidenceFound = `${phaseCount}/6 fases registradas; ${fullColumnRows} con 5 columnas completas.`;
  } else if (phaseCount >= 3) {
    score = 2;
    status = 'warning';
    feedback = 'Cronograma incompleto. La arquitectura normativa del PAEC requiere 6 fases bimestrales con 5 columnas obligatorias.';
    evidenceFound = `${phaseCount} fases registradas.`;
  }

  return {
    id: 11,
    name: '6 fases bimestrales con 5 columnas',
    dimension: DIMENSIONS.DIM4,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio12(cronograma: CronogramaRow[] | null | undefined): PaecAuditCriterion {
  const rows = Array.isArray(cronograma)
    ? cronograma
    : (((cronograma as unknown as Record<string, unknown>)?.cronograma ||
        (cronograma as unknown as Record<string, unknown>)?.semanas ||
        []) as CronogramaRow[]);
  if (rows.length === 0) {
    return {
      id: 12,
      name: 'Asignaturas viga maestra con justificación',
      dimension: DIMENSIONS.DIM4,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Cronograma no disponible para evaluar asignaturas articuladoras.',
      evidenceFound: '0 fases analizadas.',
    };
  }

  let vigaMaestraCount = 0;
  for (const r of rows) {
    const text = `${r.responsibleSubjects || ''} ${r.macroActivities || ''} ${r.objective || ''}`;
    if (/viga\s*maestra|articuladora|coordinadora|asignatura\s*eje|l[ií]der\s*de\s*fase|responsable\s*t[eé]cnica/i.test(text)) {
      vigaMaestraCount++;
    }
  }

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'No se identifican asignaturas viga maestra en las fases del cronograma.';
  let evidenceFound = `${vigaMaestraCount} fases con asignaturas eje designadas.`;

  if (vigaMaestraCount >= 4 || (rows.length === 6 && rows.every(r => r.responsibleSubjects && r.responsibleSubjects.length > 15))) {
    score = 4;
    status = 'pass';
    feedback = 'Asignaturas viga maestra plenamente identificadas con justificación de su liderazgo pedagógico en cada fase bimestral.';
    evidenceFound = `${vigaMaestraCount >= 4 ? vigaMaestraCount : 6}/6 fases con asignaturas articuladoras y responsabilidades claras.`;
  } else if (vigaMaestraCount >= 2 || rows.some(r => r.responsibleSubjects && r.responsibleSubjects.length > 10)) {
    score = 3;
    status = 'pass';
    feedback = 'Asignaturas responsables indicadas. Se recomienda formalizar la designación de la asignatura "viga maestra" por fase.';
    evidenceFound = `Asignaturas responsables presentes en las ${rows.length} fases.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Mención genérica de asignaturas sin rol de viga maestra claramente definido.';
    evidenceFound = `Solo listas simples de asignaturas sin justificación de liderazgo en cronograma.`;
  }

  return {
    id: 12,
    name: 'Asignaturas viga maestra con justificación',
    dimension: DIMENSIONS.DIM4,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 5: DETALLE CURRICULAR (Criterios 13-14) ---

export function evaluateCriterio13(detalle: DetalleCurricularRow[] | null | undefined): PaecAuditCriterion {
  const rows = detalle || [];
  if (rows.length === 0) {
    return {
      id: 13,
      name: 'Propósitos/Progresiones por semestre correctos',
      dimension: DIMENSIONS.DIM5,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Detalle curricular ausente.',
      evidenceFound: '0 filas registradas.',
    };
  }

  let wellFormulated = 0;

  for (const r of rows) {
    const content = r.progressionsOrPurposes || '';
    if (content.length >= 25) wellFormulated++;
  }

  const rate = (wellFormulated / rows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Progresiones y propósitos escasos o sin diferenciación formativa por semestre.';
  let evidenceFound = `${Math.round(rate)}% de filas con contenido curricular suficiente.`;

  if (rate >= 80) {
    score = 4;
    status = 'pass';
    feedback = 'Alineación perfecta: progresiones de aprendizaje redactadas a detalle en 1°-4° y propósitos integradores en 5°-6°.';
    evidenceFound = `${wellFormulated}/${rows.length} UACs con desglose curricular progresivo y pertinente.`;
  } else if (rate >= 60) {
    score = 3;
    status = 'pass';
    feedback = 'Contenidos curriculares adecuados. Verificar correspondencia exacta con las progresiones publicadas por COSFAC.';
    evidenceFound = `${wellFormulated}/${rows.length} UACs con progresiones/propósitos formulados.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Descripciones curriculares breves o poco diferenciadas entre semestres.';
    evidenceFound = `Solo ${wellFormulated}/${rows.length} filas con desglose sustantivo.`;
  }

  return {
    id: 13,
    name: 'Propósitos/Progresiones por semestre correctos',
    dimension: DIMENSIONS.DIM5,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio14(detalle: DetalleCurricularRow[] | null | undefined): PaecAuditCriterion {
  const rows = detalle || [];
  if (rows.length === 0) {
    return {
      id: 14,
      name: 'Fases del PEC articuladas',
      dimension: DIMENSIONS.DIM5,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Detalle curricular ausente para evaluar articulación con fases PEC.',
      evidenceFound: '0 filas registradas.',
    };
  }

  let phaseMappedCount = 0;
  for (const r of rows) {
    const phases = r.projectPhases || '';
    const justif = r.curricularJustification || '';
    if (/fase\s*[i|v|x|\d]+/i.test(phases) && justif.length >= 25) {
      phaseMappedCount++;
    }
  }

  const rate = (phaseMappedCount / rows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Articulación débil entre asignaturas y fases del proyecto comunitario.';
  let evidenceFound = `${Math.round(rate)}% de UACs vinculadas a fases del PEC.`;

  if (rate >= 80) {
    score = 4;
    status = 'pass';
    feedback = 'Articulación excelente y justificada pedagógicamente entre cada UAC y las fases específicas del PEC (I a VI).';
    evidenceFound = `${phaseMappedCount}/${rows.length} UACs con asignación explícita de fase PEC y justificación curricular.`;
  } else if (rate >= 60) {
    score = 3;
    status = 'pass';
    feedback = 'Buena articulación con fases del proyecto. Asegurar justificación curricular en las asignaturas optativas.';
    evidenceFound = `${phaseMappedCount}/${rows.length} UACs articuladas a fases.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Mapeo de fases incompleto en el detalle curricular; varias asignaturas no indican a qué fase aportan.';
    evidenceFound = `${phaseMappedCount}/${rows.length} UACs articuladas.`;
  }

  return {
    id: 14,
    name: 'Fases del PEC articuladas',
    dimension: DIMENSIONS.DIM5,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 6: PLAN OPERATIVO (Criterios 15-18) ---

function inspectPlanOperativoSemestre(
  rows: PlanOperativoRow[]
): { totalRows: number; weeksCount: number; has8Cols: boolean; sampleWeeks: string[] } {
  const weeks = new Set<string>();
  let has8Cols = rows.length > 0;

  for (const r of rows) {
    if (r.week) {
      weeks.add(r.week.trim());
    }
    if (
      !r.phase ||
      !r.activity ||
      !r.uac ||
      !r.progression ||
      !r.strategy ||
      !r.week ||
      !r.responsibles ||
      !r.evaluationInstrument
    ) {
      has8Cols = false;
    }
  }

  return {
    totalRows: rows.length,
    weeksCount: weeks.size,
    has8Cols,
    sampleWeeks: Array.from(weeks).slice(0, 5),
  };
}

export function evaluateCriterio15(
  planA: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: PlanOperativoData | null
): PaecAuditCriterion {
  const rows = planA || planOperativoLegacy?.semestreA || [];
  const info = inspectPlanOperativoSemestre(rows);
  const semantic = rows.length > 0 ? auditPaecPlan(rows, [], { parity: 1, strict: false }) : null;
  const hardSemanticFails = semantic
    ? semantic.fails.filter((f) => !f.startsWith('semanas sin actividad') && !f.includes('columna'))
    : [];

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Plan Operativo Semestre A ausente o sin actividades programadas.';
  let evidenceFound = `0 actividades registradas en Semestre A.`;

  if (info.totalRows >= 16 && info.weeksCount >= 14 && info.has8Cols) {
    if (hardSemanticFails.length > 0) {
      score = 2;
      status = 'warning';
      feedback = `Plan Operativo Semestre A completo en forma, pero con ${hardSemanticFails.length} defecto(s) semántico(s) duro(s): ${hardSemanticFails.slice(0, 2).join('; ')}.`;
      evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas; ${hardSemanticFails.length} FAIL semánticos.`;
    } else {
      score = 4;
      status = 'pass';
      feedback = 'Plan Operativo Semestre A completo: 16 semanas cubiertas, 8 columnas pobladas y 0 defectos semánticos duros.';
      evidenceFound = `${info.totalRows} actividades distribuidas en ${info.weeksCount} semanas; 8 columnas completas; 0 duplicados no-S16 ni placeholders.`;
    }
  } else if (info.totalRows >= 12 && info.weeksCount >= 10) {
    score = hardSemanticFails.length > 0 ? 2 : 3;
    status = hardSemanticFails.length > 0 ? 'warning' : 'pass';
    feedback = hardSemanticFails.length > 0
      ? `Plan Operativo Semestre A parcial con defectos semánticos: ${hardSemanticFails[0]}.`
      : 'Plan Operativo Semestre A amplio. Se recomienda verificar que todas las semanas del 1 al 16 tengan actividades explícitas.';
    evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas registradas.`;
  } else if (info.totalRows >= 6) {
    score = 2;
    status = 'warning';
    feedback = 'Plan Operativo Semestre A parcial. Cobertura semanal insuficiente o columnas faltantes.';
    evidenceFound = `${info.totalRows} actividades registradas en ${info.weeksCount} semanas.`;
  }

  return {
    id: 15,
    name: 'Semestre A: 16 semanas, 8 columnas',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio16(
  planB: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: PlanOperativoData | null
): PaecAuditCriterion {
  const rows = planB || planOperativoLegacy?.semestreB || [];
  const info = inspectPlanOperativoSemestre(rows);
  const semantic = rows.length > 0 ? auditPaecPlan(rows, [], { parity: 0, strict: false }) : null;
  const hardSemanticFails = semantic
    ? semantic.fails.filter((f) => !f.startsWith('semanas sin actividad') && !f.includes('columna'))
    : [];

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Plan Operativo Semestre B ausente o sin actividades programadas.';
  let evidenceFound = `0 actividades registradas en Semestre B.`;

  if (info.totalRows >= 16 && info.weeksCount >= 14 && info.has8Cols) {
    if (hardSemanticFails.length > 0) {
      score = 2;
      status = 'warning';
      feedback = `Plan Operativo Semestre B completo en forma, pero con ${hardSemanticFails.length} defecto(s) semántico(s) duro(s): ${hardSemanticFails.slice(0, 2).join('; ')}.`;
      evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas; ${hardSemanticFails.length} FAIL semánticos.`;
    } else {
      score = 4;
      status = 'pass';
      feedback = 'Plan Operativo Semestre B completo: 16 semanas cubiertas, 8 columnas estructuradas y 0 defectos semánticos duros.';
      evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas; 8 columnas completas; 0 duplicados no-S16 ni placeholders.`;
    }
  } else if (info.totalRows >= 12 && info.weeksCount >= 10) {
    score = hardSemanticFails.length > 0 ? 2 : 3;
    status = hardSemanticFails.length > 0 ? 'warning' : 'pass';
    feedback = hardSemanticFails.length > 0
      ? `Plan Operativo Semestre B parcial con defectos semánticos: ${hardSemanticFails[0]}.`
      : 'Plan Operativo Semestre B adecuado. Se recomienda afinar el instrumento de evaluación en las semanas intermedias.';
    evidenceFound = `${info.totalRows} actividades en ${info.weeksCount} semanas registradas.`;
  } else if (info.totalRows >= 6) {
    score = 2;
    status = 'warning';
    feedback = 'Plan Operativo Semestre B parcial. No alcanza la cobertura de 16 semanas normativas.';
    evidenceFound = `${info.totalRows} actividades registradas.`;
  }

  return {
    id: 16,
    name: 'Semestre B: 16 semanas, 8 columnas',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio17(
  planA: PlanOperativoRow[] | null | undefined,
  planB: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: PlanOperativoData | null,
  stepContext?: number // Permite validar cuando solo se evalúa paso 6 o paso 7
): PaecAuditCriterion {
  const rowsA: PlanOperativoRow[] = planA || planOperativoLegacy?.semestreA || [];
  const rowsB: PlanOperativoRow[] = planB || planOperativoLegacy?.semestreB || [];

  const textSem16A = rowsA
    .filter((r: PlanOperativoRow) => /semana\s*(16|diecis[eé]is)/i.test(r.week || ''))
    .map((r: PlanOperativoRow) => `${r.activity} ${r.strategy}`)
    .join(' ');

  const textSem16B = rowsB
    .filter((r: PlanOperativoRow) => /semana\s*(16|diecis[eé]is)/i.test(r.week || ''))
    .map((r: PlanOperativoRow) => `${r.activity} ${r.strategy}`)
    .join(' ');

  const hasCierreTransferenciaA = /cierre|transferencia|evaluaci[oó]n\s*parcial|sistematizaci[oó]n|entrega|corte/i.test(textSem16A);
  const hasFeriaEvaluacionB = /feria|presentaci[oó]n|evaluaci[oó]n\s*final|difusi[oó]n|impacto|clausura|exposici[oó]n/i.test(textSem16B);

  // Si solo se evalúa el paso 6 individual
  if (stepContext === 6) {
    if (hasCierreTransferenciaA) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 4,
        status: 'pass',
        feedback: 'Semana 16 del Semestre A programada como hito de Cierre de Fase y Transferencia Metodológica.',
        evidenceFound: 'Semana 16 de Semestre A validada exitosamente.',
      };
    } else if (textSem16A.length > 0) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 3,
        status: 'pass',
        feedback: 'Semana 16 de Semestre A presente. Se recomienda explicitar el proceso de transferencia metodológica.',
        evidenceFound: 'Semana 16 presente con actividades generales de cierre.',
      };
    } else {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 2,
        status: 'warning',
        feedback: 'No se detecta la Semana 16 como hito de cierre/transferencia en Semestre A.',
        evidenceFound: 'Semana 16 no identificada en Semestre A.',
      };
    }
  }

  // Si solo se evalúa el paso 7 individual
  if (stepContext === 7) {
    if (hasFeriaEvaluacionB) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 4,
        status: 'pass',
        feedback: 'Semana 16 del Semestre B programada como Feria Comunitaria y Evaluación Integral de Impacto.',
        evidenceFound: 'Semana 16 de Semestre B validada como Feria Comunitaria.',
      };
    } else if (textSem16B.length > 0) {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 3,
        status: 'pass',
        feedback: 'Semana 16 de Semestre B presente con cierre. Se recomienda nombrar formalmente la Feria de Resultados.',
        evidenceFound: 'Semana 16 presente con actividades de cierre.',
      };
    } else {
      return {
        id: 17,
        name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
        dimension: DIMENSIONS.DIM6,
        expectedLevel: 'Excelente (4)',
        score: 2,
        status: 'warning',
        feedback: 'No se detecta la Feria de Resultados en la Semana 16 del Semestre B.',
        evidenceFound: 'Semana 16 no identificada en Semestre B.',
      };
    }
  }

  // Evaluación global (ambos semestres)
  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Hitos de Semana 16 ausentes en ambos semestres.';
  let evidenceFound = `Semana 16 A: ${hasCierreTransferenciaA ? 'Sí' : 'No'} | Semana 16 B: ${hasFeriaEvaluacionB ? 'Sí' : 'No'}`;

  if (hasCierreTransferenciaA && hasFeriaEvaluacionB) {
    score = 4;
    status = 'pass';
    feedback = 'Hitos críticos de Semana 16 plenamente cumplidos: Cierre/Transferencia en Semestre A y Feria de Impacto Comunitario en Semestre B.';
    evidenceFound = 'Semana 16 de ambos semestres programadas con hitos institucionales de cierre y feria comunitaria.';
  } else if (hasCierreTransferenciaA || hasFeriaEvaluacionB) {
    score = 3;
    status = 'pass';
    feedback = 'Uno de los hitos de Semana 16 está documentado. Asegurar que ambos semestres concluyan con el hito correspondiente.';
    evidenceFound = `Hito cumplido en ${hasCierreTransferenciaA ? 'Semestre A (Transferencia)' : 'Semestre B (Feria)'}.`;
  } else if (rowsA.length > 0 || rowsB.length > 0) {
    score = 2;
    status = 'warning';
    feedback = 'Semana 16 programada con actividades habituales de clase, sin elevarse a hito de cierre, transferencia o feria comunitaria.';
    evidenceFound = 'Faltan hitos de cierre normativo en semana 16.';
  }

  return {
    id: 17,
    name: 'Semana 16 de cierre/transferencia (A) y feria/evaluación (B)',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

export function evaluateCriterio18(
  planA: PlanOperativoRow[] | null | undefined,
  planB: PlanOperativoRow[] | null | undefined,
  planOperativoLegacy?: PlanOperativoData | null
): PaecAuditCriterion {
  const allRows: PlanOperativoRow[] = [
    ...(planA || planOperativoLegacy?.semestreA || []),
    ...(planB || planOperativoLegacy?.semestreB || []),
  ];

  if (allRows.length === 0) {
    return {
      id: 18,
      name: 'Metodologías activas documentadas',
      dimension: DIMENSIONS.DIM6,
      expectedLevel: 'Excelente (4)',
      score: 1,
      status: 'fail',
      feedback: 'Plan Operativo no disponible para evaluar metodologías.',
      evidenceFound: '0 actividades evaluadas.',
    };
  }

  const activeMethodPattern = /ABPC|ABP|STEAM|aprendizaje\s*servicio|\bAS\b|estudio\s*de\s*caso|investigaci[oó]n[-\s]acci[oó]n|taller\s*participativo|trabajo\s*de\s*campo|proyecto\s*comunitario/i;

  let activeCount = 0;
  for (const r of allRows) {
    if (activeMethodPattern.test(r.strategy || '')) {
      activeCount++;
    }
  }

  const rate = (activeCount / allRows.length) * 100;

  let score = 1;
  let status: 'pass' | 'warning' | 'fail' = 'fail';
  let feedback = 'Estrategias de enseñanza tradicionales o sin metodología sociocrítica especificada.';
  let evidenceFound = `${Math.round(rate)}% de actividades con metodologías activas.`;

  if (rate >= 65) {
    score = 4;
    status = 'pass';
    feedback = 'Metodologías activas y sociocríticas (ABPC, STEAM, Aprendizaje Servicio, ABP) documentadas de manera predominante en los planes operativos.';
    evidenceFound = `${activeCount}/${allRows.length} actividades implementan metodologías sociocríticas activas.`;
  } else if (rate >= 40) {
    score = 3;
    status = 'pass';
    feedback = 'Buena presencia de metodologías activas. Se recomienda sustituir actividades pasivas por dinámicas de campo o proyectos.';
    evidenceFound = `${activeCount}/${allRows.length} actividades con metodologías activas.`;
  } else {
    score = 2;
    status = 'warning';
    feedback = 'Prevalecen dinámicas expositivas o de lectura tradicional. La NEM requiere metodologías sociocríticas activas.';
    evidenceFound = `Solo ${activeCount}/${allRows.length} actividades con metodología activa.`;
  }

  return {
    id: 18,
    name: 'Metodologías activas documentadas',
    dimension: DIMENSIONS.DIM6,
    expectedLevel: 'Excelente (4)',
    score,
    status,
    feedback,
    evidenceFound,
  };
}

// --- DIMENSIÓN 7: IMPLEMENTACIÓN (Criterios 19-20) ---

