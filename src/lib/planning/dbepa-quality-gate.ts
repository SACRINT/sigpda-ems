import type { GeneratedPlanningContent } from '@/types/planning';
import { resolveSemesterWeeks } from '@/lib/guide-engine/content-budget';
import { validateRetoSituado44 } from '@/lib/planning/quality-pipeline';

export type DBEPACriterionStatus = 'cumple' | 'parcial' | 'no_cumple';
export type DBEPASemaforo = 'verde' | 'amarillo' | 'rojo';

export interface DBEPACriterion {
  id: string;
  numero: number;
  label: string;
  status: DBEPACriterionStatus;
  puntos: number;
  maxPuntos: number;
  detalle: string;
  recomendacion: string;
}

export interface DBEPAAudit {
  score: number;
  semaforo: DBEPASemaforo;
  passed: number;
  total: number;
  criteria: DBEPACriterion[];
  resumen: string;
  evaluadoEn: string;
}

type Rec = Record<string, unknown>;

const asRec = (value: unknown): Rec =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {};
const asArr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asStr = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asNum = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};
const hasText = (value: unknown, min = 1): boolean => asStr(value).length >= min;
const hasPlaceholder = (value: unknown): boolean =>
  /\[(completar|insertar|pendiente|texto)\]|\bTODO\b/i.test(asStr(value));

function statusFromRatio(ratio: number): DBEPACriterionStatus {
  if (ratio >= 0.99) return 'cumple';
  if (ratio > 0) return 'parcial';
  return 'no_cumple';
}

function makeCriterion(
  numero: number,
  id: string,
  label: string,
  ratio: number,
  detalle: string,
  recomendacion: string
): DBEPACriterion {
  const status = statusFromRatio(ratio);
  const maxPuntos = 1;
  const puntos = status === 'cumple' ? maxPuntos : status === 'parcial' ? 0.5 : 0;
  return { id, numero, label, status, puntos, maxPuntos, detalle, recomendacion };
}

export function evaluateDBEPA(
  content: GeneratedPlanningContent | null | undefined,
  meta?: { uacName?: string; semester?: number; subsystem?: string }
): DBEPAAudit {
  const root = asRec(content);
  const s1 = asRec(root.sectionI);
  const s2 = asRec(root.sectionII);
  const s3 = asRec(root.sectionIII);
  const s4 = asRec(root.sectionIV);
  const s5 = asRec(root.sectionV);
  const activities = asArr(s4.activities);
  const evaluations = asArr(s5.evaluations);
  const criteria: DBEPACriterion[] = [];

  // 1. Datos institucionales completos
  const institutionalFields = [
    s1.teacherName,
    s1.schoolName,
    s1.cct,
    s1.schoolZone,
    s1.municipality,
    s1.groups,
    s1.applicationPeriod || s1.schoolYear,
  ];
  const institutionalComplete = institutionalFields.filter((value) => hasText(value, 2)).length;
  criteria.push(
    makeCriterion(
      1,
      'datos_institucionales',
      'Datos institucionales y del grupo',
      institutionalComplete / institutionalFields.length,
      `${institutionalComplete} de ${institutionalFields.length} campos institucionales completos.`,
      'Completa docente, plantel, CCT, zona escolar, municipio, grupos y periodo de aplicación.'
    )
  );

  // 2. Carga horaria y dosificación
  const totalHours = asNum(s1.totalHours);
  const subsystem = meta?.subsystem || asStr(s1.subsystem);
  const semesterWeeks = subsystem
    ? resolveSemesterWeeks(subsystem)
    : totalHours >= 60 && totalHours % 16 === 0 && totalHours % 18 !== 0
      ? 16
      : 18;
  const weeklyHours = asNum(s1.totalHoursWeekly) || (totalHours > 0 ? Math.round(totalHours / semesterWeeks) : 0);
  const activitiesHours = activities.reduce<number>((sum, act) => sum + asNum(asRec(act).hours), 0);
  const expectedTotal = weeklyHours > 0 ? weeklyHours * semesterWeeks : 0;
  const hoursOk =
    totalHours > 0 &&
    weeklyHours > 0 &&
    (Math.abs(totalHours - expectedTotal) <= 1 || (totalHours === 64 && weeklyHours === 4)) &&
    (activities.length === 0 || Math.abs(activitiesHours - totalHours) <= 1);
  const hoursPartial = totalHours > 0 && (weeklyHours > 0 || activitiesHours > 0);
  criteria.push(
    makeCriterion(
      2,
      'carga_horaria',
      'Carga horaria y dosificación semestral',
      hoursOk ? 1 : hoursPartial ? 0.5 : 0,
      `${totalHours} h totales; ${weeklyHours} h/semana; ${activitiesHours} h en la secuencia.`,
      `Verifica que las horas totales correspondan a ${semesterWeeks} semanas y que la suma de actividades coincida.`
    )
  );

  // 3. Propósito formativo
  const purpose = asStr(s2.purpose);
  const purposeOk = purpose.length >= 40 && !hasPlaceholder(purpose);
  criteria.push(
    makeCriterion(
      3,
      'proposito_formativo',
      'Propósito formativo explícito y situado',
      purposeOk ? 1 : purpose.length >= 20 ? 0.5 : 0,
      purposeOk ? `${purpose.length} caracteres.` : 'Propósito ausente, breve o con placeholders.',
      'Redacta un propósito de al menos 40 caracteres que articule el aprendizaje con el contexto.'
    )
  );

  // 4. Aprendizajes de trayectoria
  const learningOutcomes = asArr(s2.learningOutcomes).filter((item) => hasText(item, 10));
  criteria.push(
    makeCriterion(
      4,
      'aprendizajes_trayectoria',
      'Aprendizajes de trayectoria / resultados',
      learningOutcomes.length >= 1 ? 1 : asArr(s2.learningOutcomes).length > 0 ? 0.5 : 0,
      `${learningOutcomes.length} aprendizaje(s) con desarrollo suficiente.`,
      'Declara al menos un aprendizaje de trayectoria o resultado de aprendizaje verificable.'
    )
  );

  // 5. Reto situado 4/4
  const retoValidation = validateRetoSituado44(
    asRec(s2.retoSituado) as unknown as Parameters<typeof validateRetoSituado44>[0],
    {
      uacName: asStr(s1.uacName) || meta?.uacName,
    }
  );
  criteria.push(
    makeCriterion(
      5,
      'reto_situado',
      'Reto situado 4/4',
      retoValidation.score / 4,
      `Cumple ${retoValidation.score} de 4 criterios del reto situado.`,
      'Asegura verbo en infinitivo, contexto local, problemática real y alineación curricular.'
    )
  );

  // 6. Diagnóstico situado 3D
  const diagnostico = asRec(s2.diagnosticoSituado3D);
  const diagnosticDimensions = [
    diagnostico.dimensionTerritorial,
    diagnostico.dimensionPraxisJuvenil,
    diagnostico.dimensionAulaEdiems,
  ];
  const diagnosticComplete = diagnosticDimensions.filter((value) => hasText(value, 10)).length;
  criteria.push(
    makeCriterion(
      6,
      'diagnostico_3d',
      'Diagnóstico situado 3D',
      diagnosticComplete / 3,
      `${diagnosticComplete} de 3 dimensiones desarrolladas.`,
      'Desarrolla las dimensiones territorial, de praxis juvenil y de aula/EDIEMS-BAP.'
    )
  );

  // 7. Transversalidad / producto integrador
  const fundamental = asArr(s3.fundamentalCurriculum);
  const expanded = asArr(s3.expandedCurriculum);
  const producto = hasText(s3.productoIntegrador, 10);
  const transversalOk = fundamental.length > 0 || expanded.length > 0 || producto;
  criteria.push(
    makeCriterion(
      7,
      'transversalidad',
      'Transversalidad y producto integrador',
      transversalOk ? 1 : 0,
      fundamental.length + expanded.length > 0
        ? `${fundamental.length + expanded.length} vínculo(s) de transversalidad.`
        : producto
          ? 'Producto integrador declarado sin vínculos de transversalidad.'
          : 'Sin transversalidad ni producto integrador.',
      'Vincula la UAC con el currículum fundamental/ampliado o declara un producto integrador.'
    )
  );

  // 8. Secuencia con apertura, desarrollo y cierre
  const phasesComplete = activities.filter((raw) => {
    const act = asRec(raw);
    return (
      hasText(asRec(act.apertura).activities, 10) &&
      hasText(asRec(act.ejecucion).activities, 10) &&
      hasText(asRec(act.conclusion).activities, 10)
    );
  }).length;
  const sequenceRatio =
    activities.length === 0 ? 0 : (phasesComplete / activities.length) * (activities.length >= 3 ? 1 : 0.5);
  criteria.push(
    makeCriterion(
      8,
      'secuencia_fases',
      'Secuencia didáctica con Apertura, Desarrollo y Cierre',
      sequenceRatio,
      `${phasesComplete} de ${activities.length} actividades con las tres fases completas.`,
      'Completa las tres fases en cada actividad y asegura al menos tres actividades o progresiones.'
    )
  );

  // 9. Tres saberes
  const saberesComplete = activities.filter((raw) => {
    const saberes = asRec(asRec(raw).saberes);
    return (
      hasText(saberes.saber, 5) &&
      hasText(saberes.saberHacer, 5) &&
      hasText(saberes.saberSer, 5)
    );
  }).length;
  criteria.push(
    makeCriterion(
      9,
      'tres_saberes',
      'Tres saberes en cada actividad',
      activities.length === 0 ? 0 : saberesComplete / activities.length,
      `${saberesComplete} de ${activities.length} actividades con Saber, Saber Hacer y Saber Ser.`,
      'Explicita la taxonomía de los tres saberes en cada actividad de la secuencia.'
    )
  );

  // 10. Evaluación integral y ponderación
  const moments = evaluations.map((raw) => {
    const rec = asRec(raw);
    return `${asStr(rec.type)} ${asStr(rec.moment)} ${asStr(rec.name)}`.toLowerCase();
  });
  const hasDiagnostic = moments.some((m) => m.includes('diagn'));
  const hasFormative = moments.some((m) => m.includes('format'));
  const hasSummative = moments.some((m) => m.includes('sumat'));
  const weighting = evaluations.reduce<number>(
    (sum, raw) => sum + asNum(asRec(raw).percentage ?? asRec(raw).weighting),
    0
  );
  const evaluationOk =
    evaluations.length >= 3 && hasDiagnostic && hasFormative && hasSummative && Math.abs(weighting - 100) <= 1;
  const evaluationPartial =
    evaluations.length >= 2 && (Math.abs(weighting - 100) <= 1 || (hasDiagnostic && hasFormative));
  criteria.push(
    makeCriterion(
      10,
      'evaluacion_integral',
      'Evaluación diagnóstica, formativa y sumativa (100%)',
      evaluationOk ? 1 : evaluationPartial ? 0.5 : 0,
      `${evaluations.length} instrumentos; ponderación ${weighting}%.`,
      'Incluye los tres momentos evaluativos y normaliza las ponderaciones para sumar 100%.'
    )
  );

  // 11. Instrumentos y evidencias diversificados
  const withEvidence = evaluations.filter((raw) => hasText(asRec(raw).evidence, 5)).length;
  const withInstrument = evaluations.filter((raw) => hasText(asRec(raw).instrument, 3)).length;
  const distinctInstruments = new Set(
    evaluations.map((raw) => asStr(asRec(raw).instrument).toLowerCase()).filter(Boolean)
  ).size;
  const evidenceOk =
    evaluations.length > 0 &&
    withEvidence === evaluations.length &&
    withInstrument === evaluations.length &&
    distinctInstruments >= 2;
  const evidencePartial = evaluations.length > 0 && withEvidence === evaluations.length;
  criteria.push(
    makeCriterion(
      11,
      'instrumentos_evidencias',
      'Evidencias e instrumentos diversificados',
      evidenceOk ? 1 : evidencePartial ? 0.5 : 0,
      `${withEvidence}/${evaluations.length} con evidencia; ${withInstrument}/${evaluations.length} con instrumento; ${distinctInstruments} instrumento(s) distintos.`,
      'Declara evidencia e instrumento en cada evaluación y diversifica al menos dos instrumentos.'
    )
  );

  // 12. Vinculación PAEC/PEC
  const paecConnection = asStr(s2.paecConnection);
  const paecProject = asStr(s1.paecProjectName) || asStr(asRec(s1.paecOperationalActivity).actividad);
  const paecOk = paecConnection.length >= 20 && Boolean(paecProject);
  criteria.push(
    makeCriterion(
      12,
      'vinculacion_paec',
      'Vinculación con el PAEC/PEC',
      paecOk ? 1 : paecConnection.length >= 20 ? 0.5 : 0,
      paecConnection.length >= 20
        ? 'Vinculación curricular explícita; proyecto operativo no declarado.'
        : 'Sin vinculación explícita con el PAEC/PEC.',
      'Conecta la planeación con el proyecto y la problemática comunitaria del PAEC/PEC.'
    )
  );

  const puntos = criteria.reduce((sum, criterion) => sum + criterion.puntos, 0);
  const total = criteria.length;
  const score = Math.round((puntos / total) * 100);
  const semaforo: DBEPASemaforo = score >= 80 ? 'verde' : score >= 60 ? 'amarillo' : 'rojo';
  const passed = criteria.filter((criterion) => criterion.status === 'cumple').length;

  return {
    score,
    semaforo,
    passed,
    total,
    criteria,
    resumen:
      semaforo === 'verde'
        ? 'Planeación lista para validación DBEPA.'
        : semaforo === 'amarillo'
          ? 'Planeación con observaciones; requiere ajustes antes de validación.'
          : 'Planeación incompleta; no cumple los mínimos DBEPA.',
    evaluadoEn: new Date().toISOString(),
  };
}
