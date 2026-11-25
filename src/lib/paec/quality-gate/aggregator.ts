import type {
  PaecProject,
  PaecAuditCriterion,
  PaecQualityAudit,
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
  PaecImplementacion,
  AnexosData,
  PaecGobernanza,
  PaecInformeSupervision,
  PlanOperativoData,
} from '@/types/paec';
import {
  evaluateCriterio1,
  evaluateCriterio2,
  evaluateCriterio3,
  evaluateCriterio4,
  evaluateCriterio5,
  evaluateCriterio6,
  evaluateCriterio7,
  evaluateCriterio8,
  evaluateCriterio9,
  evaluateCriterio10,
} from './criteria-1-10';
import {
  evaluateCriterio11,
  evaluateCriterio12,
  evaluateCriterio13,
  evaluateCriterio14,
  evaluateCriterio15,
  evaluateCriterio16,
  evaluateCriterio17,
  evaluateCriterio18,
} from './criteria-11-18';
import {
  evaluateCriterio19,
  evaluateCriterio20,
  evaluateCriterio21,
  evaluateCriterio22,
  evaluateCriterio23,
} from './criteria-19-23';

export function validatePaecStepResult(step: number, data: unknown): PaecQualityAudit {
  const criterios: PaecAuditCriterion[] = [];
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

  switch (step) {
    case 1: {
      const fase1 = data as Fase1Diagnostico;
      criterios.push(evaluateCriterio1(fase1));
      criterios.push(evaluateCriterio2(fase1));
      criterios.push(evaluateCriterio3(fase1));
      criterios.push(evaluateCriterio4(fase1));
      break;
    }

    case 2: {
      const fase2 = data as Fase2Justificacion;
      criterios.push(evaluateCriterio5(fase2));
      criterios.push(evaluateCriterio6(fase2));
      criterios.push(evaluateCriterio7(fase2));
      break;
    }

    case 3: {
      const mapeo = (Array.isArray(data) ? data : (record?.mapeo as MapeoRow[] | undefined) || []) as MapeoRow[];
      criterios.push(evaluateCriterio8(mapeo));
      criterios.push(evaluateCriterio9(mapeo));
      criterios.push(evaluateCriterio10(mapeo));
      break;
    }

    case 4: {
      const cronograma = (Array.isArray(data) ? data : (record?.cronograma as CronogramaRow[] | undefined) || []) as CronogramaRow[];
      criterios.push(evaluateCriterio11(cronograma));
      criterios.push(evaluateCriterio12(cronograma));
      break;
    }

    case 5: {
      const detalle = (Array.isArray(data) ? data : (record?.detalleCurricular as DetalleCurricularRow[] | undefined) || []) as DetalleCurricularRow[];
      criterios.push(evaluateCriterio13(detalle));
      criterios.push(evaluateCriterio14(detalle));
      break;
    }

    case 6: {
      const rowsA = (Array.isArray(data) ? data : (record?.semestreA as PlanOperativoRow[] | undefined) || []) as PlanOperativoRow[];
      criterios.push(evaluateCriterio15(rowsA));
      criterios.push(evaluateCriterio17(rowsA, null, null, 6));
      criterios.push(evaluateCriterio18(rowsA, null));
      break;
    }

    case 7: {
      const rowsB = (Array.isArray(data) ? data : (record?.semestreB as PlanOperativoRow[] | undefined) || []) as PlanOperativoRow[];
      criterios.push(evaluateCriterio16(rowsB));
      criterios.push(evaluateCriterio17(null, rowsB, null, 7));
      criterios.push(evaluateCriterio18(null, rowsB));
      break;
    }

    case 8: {
      const impl = data as PaecImplementacion;
      const anexos = ((record?.anexos as AnexosData | undefined) || (data as AnexosData));
      criterios.push(evaluateCriterio19(impl, anexos));
      criterios.push(evaluateCriterio20(anexos));
      break;
    }

    case 9: {
      const gob = ((record?.gobernanza as PaecGobernanza | undefined) || (data as PaecGobernanza));
      const inf = ((record?.informeSupervision as PaecInformeSupervision | undefined) || (data as PaecInformeSupervision));
      criterios.push(evaluateCriterio21(gob));
      criterios.push(evaluateCriterio22(inf));
      criterios.push(evaluateCriterio23(inf));
      break;
    }

    default:
      break;
  }

  const maxPoints = criterios.length * 4;
  const rawScore = criterios.reduce((sum, c) => sum + c.score, 0);
  const score = maxPoints > 0 ? Math.round((rawScore / maxPoints) * 100) : 0;

  const passedCount = criterios.filter(c => c.status === 'pass').length;
  const warningCount = criterios.filter(c => c.status === 'warning').length;
  const failedCount = criterios.filter(c => c.status === 'fail').length;

  let estatus: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes' = 'requiere_ajustes';
  if (score >= 85) estatus = 'aprobado_excelente';
  else if (score >= 70) estatus = 'aprobado';

  return {
    score,
    criterios,
    estatus,
    criteria: criterios,
    totalScore: rawScore,
    percentage: score,
    status: estatus,
    summary: {
      passedCount,
      warningCount,
      failedCount,
    },
    updatedAt: new Date().toISOString(),
  };
}

export type PaecProjectInput = Partial<PaecProject> & {
  fase1_diagnostico?: Fase1Diagnostico | null;
  fase2_justificacion?: Fase2Justificacion | null;
  fase2_mapeo?: MapeoRow[] | null;
  fase2_cronograma?: CronogramaRow[] | null;
  fase2_detalle_curricular?: DetalleCurricularRow[] | null;
  fase3_plan_operativo_a?: PlanOperativoRow[] | null;
  fase3_plan_operativo_b?: PlanOperativoRow[] | null;
  fase2_plan_operativo?: PlanOperativoData | null;
  fase3_implementacion?: PaecImplementacion | null;
  fase2_anexos?: AnexosData | null;
  fase4_gobernanza?: PaecGobernanza | null;
  fase4_informe_supervision?: PaecInformeSupervision | null;
};

/**
 * Calcula la auditoría global completa (los 23 criterios normativos) sobre un proyecto PAEC.
 * 
 * @param project Proyecto PAEC con los datos consolidados de todas las fases
 * @returns PaecQualityAudit con la evaluación completa de los 23 criterios y dictamen final
 */
export function calculateGlobalPaecScore(project: PaecProjectInput): PaecQualityAudit {
  // Normalizar acceso a campos camelCase o snake_case
  const fase1 = project.fase1Diagnostico || project.fase1_diagnostico;
  const fase2 = project.fase2Justificacion || project.fase2_justificacion;
  const mapeo = project.fase2Mapeo || project.fase2_mapeo;
  const cronograma = project.fase2Cronograma || project.fase2_cronograma;
  const detalle = project.fase2DetalleCurricular || project.fase2_detalle_curricular;
  const planA = project.fase3PlanOperativoA || project.fase3_plan_operativo_a;
  const planB = project.fase3PlanOperativoB || project.fase3_plan_operativo_b;
  const planLegacy = project.fase2PlanOperativo || project.fase2_plan_operativo;
  const impl = project.fase3Implementacion || project.fase3_implementacion;
  const anexos = project.fase2Anexos || project.fase2_anexos || (impl as { anexos?: AnexosData } | null | undefined)?.anexos;
  const gobernanza = project.fase4Gobernanza || project.fase4_gobernanza;
  const informe = project.fase4InformeSupervision || project.fase4_informe_supervision;

  const criterios: PaecAuditCriterion[] = [
    // Dimensión 1 (1-4)
    evaluateCriterio1(fase1),
    evaluateCriterio2(fase1),
    evaluateCriterio3(fase1),
    evaluateCriterio4(fase1),

    // Dimensión 2 (5-7)
    evaluateCriterio5(fase2),
    evaluateCriterio6(fase2),
    evaluateCriterio7(fase2),

    // Dimensión 3 (8-10)
    evaluateCriterio8(mapeo),
    evaluateCriterio9(mapeo),
    evaluateCriterio10(mapeo),

    // Dimensión 4 (11-12)
    evaluateCriterio11(cronograma),
    evaluateCriterio12(cronograma),

    // Dimensión 5 (13-14)
    evaluateCriterio13(detalle),
    evaluateCriterio14(detalle),

    // Dimensión 6 (15-18)
    evaluateCriterio15(planA, planLegacy),
    evaluateCriterio16(planB, planLegacy),
    evaluateCriterio17(planA, planB, planLegacy),
    evaluateCriterio18(planA, planB, planLegacy),

    // Dimensión 7 (19-20)
    evaluateCriterio19(impl, anexos),
    evaluateCriterio20(anexos),

    // Dimensión 8 (21-23)
    evaluateCriterio21(gobernanza),
    evaluateCriterio22(informe),
    evaluateCriterio23(informe),
  ];

  // Máximo 92 puntos (23 criterios * 4)
  const totalMaxPoints = 23 * 4;
  const totalRawScore = criterios.reduce((acc, c) => acc + c.score, 0);
  const score = Math.round((totalRawScore / totalMaxPoints) * 100);

  const passedCount = criterios.filter(c => c.status === 'pass').length;
  const warningCount = criterios.filter(c => c.status === 'warning').length;
  const failedCount = criterios.filter(c => c.status === 'fail').length;

  let estatus: 'aprobado_excelente' | 'aprobado' | 'requiere_ajustes' = 'requiere_ajustes';
  if (score >= 85) estatus = 'aprobado_excelente';
  else if (score >= 70) estatus = 'aprobado';

  return {
    score,
    criterios,
    estatus,
    criteria: criterios,
    totalScore: totalRawScore,
    percentage: score,
    status: estatus,
    summary: {
      passedCount,
      warningCount,
      failedCount,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Formatea la auditoría en un reporte legible para Supervisión Escolar.
 * Genera un dictamen formal en formato Markdown con tabla de evaluación,
 * desglose por dimensión y sellos institucionales.
 * 
 * @param audit Resultado de la auditoría oficial
 * @returns Texto en formato Markdown con el reporte oficial
 */
export function formatAuditReport(audit: PaecQualityAudit, schoolZone?: string): string {
  const zonaNumReporte = (schoolZone ?? '').match(/\d{2,4}/)?.[0] ?? null;
  const supervisionDictamen = zonaNumReporte
    ? `SUPERVISIÓN ESCOLAR ZONA ${zonaNumReporte}`
    : 'SUPERVISIÓN ESCOLAR (ZONA NO REGISTRADA)';
  const dateStr = audit.updatedAt
    ? new Date(audit.updatedAt).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('es-MX');

  const dictamenBadge =
    audit.estatus === 'aprobado_excelente'
      ? '🟢 DICTAMEN: APROBADO EXCELENTE (CUMPLIMIENTO PLENO)'
      : audit.estatus === 'aprobado'
      ? '🟡 DICTAMEN: APROBADO CON OBSERVACIONES MENORES'
      : '🔴 DICTAMEN: REQUIERE AJUSTES PREVIOS A VALIDACIÓN';

  let report = `# REPORTE OFICIAL DE AUDITORÍA DE CALIDAD PAEC-PEC 2025\n`;
  report += `**Subsecretaría de Educación Media Superior | SEMS - COSFAC**\n`;
  report += `*Fecha de Evaluación:* ${dateStr}\n\n`;

  report += `---\n\n`;
  report += `### RESULTADO GLOBAL DEL PROYECTO\n\n`;
  report += `| Métrica Normativa | Valor Obtenido |\n`;
  report += `| :--- | :--- |\n`;
  report += `| **Puntaje Global Ponderado** | **${audit.score} / 100** |\n`;
  report += `| **Puntos Brutos de Rúbrica** | **${audit.totalScore ?? audit.criterios.reduce((s, c) => s + c.score, 0)} / 92** |\n`;
  report += `| **Estatus Técnico Oficial** | ${dictamenBadge} |\n`;
  report += `| **Criterios Acreditados (Pass)** | ${audit.summary?.passedCount ?? audit.criterios.filter(c => c.status === 'pass').length} de 23 |\n`;
  report += `| **Criterios con Observación (Warning)** | ${audit.summary?.warningCount ?? audit.criterios.filter(c => c.status === 'warning').length} de 23 |\n`;
  report += `| **Criterios Deficientes / Omisos (Fail)** | ${audit.summary?.failedCount ?? audit.criterios.filter(c => c.status === 'fail').length} de 23 |\n\n`;

  report += `---\n\n`;
  report += `### DESGLOSE DE EVALUACIÓN POR DIMENSIÓN Y CRITERIO\n\n`;

  // Agrupar por dimensión
  const dimensionsMap = new Map<string, PaecAuditCriterion[]>();
  for (const c of audit.criterios) {
    const list = dimensionsMap.get(c.dimension) || [];
    list.push(c);
    dimensionsMap.set(c.dimension, list);
  }

  for (const [dimName, criteriaList] of dimensionsMap.entries()) {
    const dimScore = criteriaList.reduce((s, c) => s + c.score, 0);
    const dimMax = criteriaList.length * 4;
    const dimPct = Math.round((dimScore / dimMax) * 100);

    report += `#### ${dimName} (${dimPct}% — ${dimScore}/${dimMax} pts)\n\n`;
    report += `| No. | Criterio de Rúbrica | Pts (1-4) | Estatus | Evidencia Encontrada |\n`;
    report += `| :---: | :--- | :---: | :---: | :--- |\n`;

    for (const c of criteriaList) {
      const statusIcon = c.status === 'pass' ? '✅ Pass' : c.status === 'warning' ? '⚠️ Advertencia' : '❌ Requiere';
      report += `| **C${c.id}** | ${c.name} | **${c.score}/4** | ${statusIcon} | ${c.evidenceFound} |\n`;
    }
    report += `\n`;

    // Retroalimentación detallada de criterios con observación o no conformes
    const needsAttention = criteriaList.filter(c => c.score < 4);
    if (needsAttention.length > 0) {
      report += `*Observaciones y Recomendaciones Técnicas:*\n`;
      for (const c of needsAttention) {
        report += `- **C${c.id} (${c.score}/4):** ${c.feedback}\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n\n`;
  report += `### DICTAMEN TÉCNICO Y FIRMAS DE CONFORMIDAD\n\n`;
  report += `El presente reporte certifica que el Proyecto Escolar Comunitario ha sido auditado contra los 23 criterios de la Rúbrica Oficial PAEC-PEC 2025 del Marco Curricular Común de la Educación Media Superior (NEM).\n\n`;
  report += `\`\`\`\n`;
  report += `____________________________________          ____________________________________\n`;
  report += `     COORDINACIÓN PAEC DE PLANTEL                  ${supervisionDictamen.padEnd(33, ' ')}   \n`;
  report += `     Validación Colegiada Docente                   Sello y Dictamen de Aprobación \n`;
  report += `\`\`\`\n`;

  return report;
}

