/**
 * anexo12-validator.ts — Gate determinista de conformidad con el Anexo 12 USICAMM.
 *
 * No usa IA: valida la estructura y los datos duros de una planeación ya
 * generada. Se ejecuta después del parseo y antes de persistir; el reporte se
 * guarda en `content_json.anexo12Audit` para que la UI, el PDF y el DOCX
 * muestren el semáforo de conformidad.
 *
 * Severidad:
 *  - critical: impide considerar la planeación "conforme".
 *  - warning: recomendación de calidad; no invalida por sí sola.
 */

export type Anexo12Severity = 'critical' | 'warning';

export interface Anexo12Check {
  id: string;
  label: string;
  ok: boolean;
  severity: Anexo12Severity;
  detail?: string;
}

export interface Anexo12Report {
  ok: boolean;
  score: number;
  passed: number;
  total: number;
  criticalFailures: number;
  warningFailures: number;
  checks: Anexo12Check[];
  evaluatedAt: string;
}

export interface Anexo12Context {
  uacName?: string;
  semester?: number;
  component?: string;
  subsystem?: string;
  weeklyHours?: number;
  totalHours?: number;
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

export function validateAnexo12(content: unknown, context: Anexo12Context = {}): Anexo12Report {
  const root = asRec(content);
  const sectionI = asRec(root.sectionI);
  const sectionII = asRec(root.sectionII);
  const sectionIV = asRec(root.sectionIV);
  const sectionV = asRec(root.sectionV);
  const sectionVI = asRec(root.sectionVI);

  const checks: Anexo12Check[] = [];
  const add = (
    id: string,
    label: string,
    ok: boolean,
    severity: Anexo12Severity = 'critical',
    detail?: string
  ): void => {
    checks.push({ id, label, ok, severity, ...(detail ? { detail } : {}) });
  };

  const uacName = asStr(sectionI.uacName) || context.uacName || '';
  const component = asStr(sectionI.component) || context.component || '';
  const subsystem = asStr(sectionI.subsystem) || context.subsystem || '';
  const totalHours = asNum(sectionI.totalHours) || context.totalHours || 0;
  const weeklyHours =
    asNum(sectionI.totalHoursWeekly) ||
    context.weeklyHours ||
    (totalHours > 0 ? Math.round(totalHours / 18) : 0);
  const isLaboral = /laboral|formaci[oó]n para el trabajo|capacitaci[oó]n/i.test(component);

  // ── I. Datos generales ─────────────────────────────────────────────────────
  add('i_uac', 'UAC / asignatura identificada', hasText(uacName, 5), 'critical', uacName);
  add('i_docente', 'Nombre del docente', hasText(sectionI.teacherName, 5));
  add('i_plantel', 'Nombre del plantel', hasText(sectionI.schoolName, 3));
  add('i_semestre', 'Semestre entre 1 y 6', asNum(sectionI.semester) >= 1 && asNum(sectionI.semester) <= 6);
  add('i_componente', 'Componente curricular declarado', hasText(component, 3), 'critical', component);
  add('i_subsistema', 'Subsistema declarado', hasText(subsystem, 3), 'warning', subsystem);
  add('i_grupos', 'Grupos atendidos', hasText(sectionI.groups, 1));
  add('i_carga_horaria', 'Carga horaria total > 0', totalHours > 0, 'critical', `${totalHours} h`);
  add('i_periodo', 'Periodo / ciclo escolar', hasText(sectionI.applicationPeriod) || hasText(sectionI.schoolYear), 'warning');

  // ── II. Intención curricular ───────────────────────────────────────────────
  add('ii_proposito', 'Propósito formativo (≥ 40 caracteres)', hasText(sectionII.purpose, 40));
  add('ii_aprendizajes', 'Aprendizajes de trayectoria / resultados', asArr(sectionII.learningOutcomes).some((x) => hasText(x, 5)));
  const keyActivities = asArr(sectionII.activities);
  add('ii_actividades_clave', 'Actividades clave / progresiones (≥ 3)', keyActivities.length >= 3, 'critical', `${keyActivities.length}`);
  add('ii_paec', 'Vinculación PAEC/PEC explícita', hasText(sectionII.paecConnection, 20), 'warning');

  const reto = asRec(sectionII.retoSituado);
  const retoValidacion = asRec(reto.validacion);
  const retoScore = asNum(retoValidacion.score);
  const retoCompleto =
    hasText(reto.verboInfinitivo, 3) &&
    hasText(reto.contextoLocal, 5) &&
    hasText(reto.problematicaReal, 10) &&
    hasText(reto.propositoCurricular, 10);
  add(
    'ii_reto_situado_4_4',
    'Reto Situado 4/4 (verbo, contexto, problema real, alineación)',
    retoScore === 4 || (retoScore === 0 && retoCompleto),
    'critical',
    retoScore ? `score=${retoScore}` : undefined
  );

  const diagnostico = asRec(sectionII.diagnosticoSituado3D);
  add(
    'ii_diagnostico_3d',
    'Diagnóstico situado 3D (territorio, praxis juvenil, aula/EDIEMS-BAP)',
    hasText(diagnostico.dimensionTerritorial, 10) &&
      hasText(diagnostico.dimensionPraxisJuvenil, 10) &&
      hasText(diagnostico.dimensionAulaEdiems, 10),
    'warning'
  );

  // ── III. Transversalidad ───────────────────────────────────────────────────
  add(
    'iii_transversalidad',
    'Transversalidad / producto integrador',
    asArr(sectionIII(root).fundamentalCurriculum).length > 0 ||
      asArr(sectionIII(root).expandedCurriculum).length > 0 ||
      hasText(sectionIII(root).productoIntegrador, 10),
    'warning'
  );

  // ── IV. Secuencia didáctica ────────────────────────────────────────────────
  const secuencia = asArr(sectionIV.activities);
  add('iv_secuencia', 'Actividades de la secuencia (≥ 3)', secuencia.length >= 3, 'critical', `${secuencia.length}`);
  add('iv_metodologia', 'Metodología activa declarada', secuencia.some((a) => hasText(asRec(a).methodology, 3)), 'warning');

  const fasesCompletas = secuencia.every((activity) => {
    const a = asRec(activity);
    return (
      hasText(asRec(a.apertura).activities, 10) &&
      hasText(asRec(a.ejecucion).activities, 10) &&
      hasText(asRec(a.conclusion).activities, 10)
    );
  });
  add('iv_fases', 'Apertura / desarrollo / cierre en cada actividad', secuencia.length > 0 && fasesCompletas, 'critical');

  const saberesCompletos = secuencia.every((activity) => {
    const saberes = asRec(asRec(activity).saberes);
    return (
      hasText(saberes.saber, 5) &&
      hasText(saberes.saberHacer, 5) &&
      hasText(saberes.saberSer, 5)
    );
  });
  add('iv_tres_saberes', 'Tres saberes (conocer, hacer, ser) en cada actividad', secuencia.length > 0 && saberesCompletos, 'critical');

  const procesos = asArr(sectionIV.procesosPensamiento);
  add('iv_procesos', 'Procesos de pensamiento (≥ 3)', procesos.length >= 3, 'warning', `${procesos.length}`);

  const horasSecuencia = secuencia.reduce<number>((acc, activity) => acc + asNum(asRec(activity).hours), 0);
  add(
    'iv_horas',
    'Horas de la secuencia coinciden con la carga total (±1)',
    totalHours > 0 && Math.abs(horasSecuencia - totalHours) <= 1,
    'warning',
    `${horasSecuencia} h vs ${totalHours} h`
  );

  if (isLaboral) {
    add('iv_laboral_3_actividades', 'Formación laboral: exactamente 3 Actividades Clave', secuencia.length === 3, 'critical', `${secuencia.length}`);
    add('iv_laboral_54h', 'Formación laboral BGE: 54 h (3 × 18 h)', Math.abs(totalHours - 54) <= 1, 'warning', `${totalHours} h`);
  }

  // ── V. Evaluación ──────────────────────────────────────────────────────────
  const evaluations = asArr(sectionV.evaluations);
  add('v_evaluaciones', 'Evaluaciones (≥ 3: diagnóstica, formativa, sumativa)', evaluations.length >= 3, 'critical', `${evaluations.length}`);

  const ponderacion = evaluations.reduce<number>(
    (acc, ev) => acc + asNum(asRec(ev).percentage ?? asRec(ev).weighting),
    0
  );
  add('v_ponderacion_100', 'Ponderaciones suman 100% (±1)', Math.abs(ponderacion - 100) <= 1, 'critical', `${ponderacion}%`);

  const momentos = evaluations.map((ev) => asStr(asRec(ev).moment ?? asRec(ev).type).toLowerCase());
  add(
    'v_momentos',
    'Incluye evaluación diagnóstica, formativa y sumativa',
    ['diagn', 'format', 'sumat'].every((needle) => momentos.some((m) => m.includes(needle))),
    'critical'
  );
  add('v_agentes', 'Cada evaluación declara agente evaluador', evaluations.length > 0 && evaluations.every((ev) => hasText(asRec(ev).agent, 3)), 'critical');
  add('v_evidencias', 'Cada evaluación declara evidencia/producto', evaluations.length > 0 && evaluations.every((ev) => hasText(asRec(ev).evidence, 5)), 'critical');
  add('v_instrumentos', 'Cada evaluación declara instrumento', evaluations.length > 0 && evaluations.every((ev) => hasText(asRec(ev).instrument, 3)), 'critical');
  add('v_acuerdo', 'Acuerdo de acreditación / evaluación', hasText(sectionV.evaluationAgreement, 20), 'warning');

  const bitacora = asRec(sectionV.bitacora502030);
  const bitacoraPresente = Object.keys(bitacora).length > 0;
  add('v_bitacora', 'Bitácora 50-20-30 presente', bitacoraPresente, 'critical');
  add(
    'v_bitacora_criterios',
    'Bitácora: criterio 50%, evidencia colectiva 20%, individual 30% y ticket',
    hasText(bitacora.criterioProceso50, 10) &&
      hasText(bitacora.evidenciaColectiva20, 5) &&
      hasText(bitacora.evidenciaIndividual30, 5) &&
      hasText(bitacora.ticketSalidaPregunta, 5),
    'critical'
  );
  const filas = asArr(bitacora.filasEstudiantes);
  add('v_bitacora_filas', 'Bitácora con al menos un estudiante registrado', filas.length >= 1, 'warning', `${filas.length}`);

  // ── VI. Recursos ───────────────────────────────────────────────────────────
  add('vi_estudiante', 'Materiales del estudiante', asArr(sectionVI.studentMaterials).length > 0, 'warning');
  add('vi_docente', 'Materiales del docente', asArr(sectionVI.teacherMaterials).length > 0, 'warning');
  add('vi_espacios', 'Espacios de aprendizaje', asArr(sectionVI.spaces).length > 0, 'warning');
  add('vi_digital', 'Recursos digitales', asArr(sectionVI.digital).length > 0, 'warning');
  add('vi_referencias', 'Fuentes de consulta', asArr(sectionVI.references).length > 0, 'warning');

  // ── VII. Firmas / validación ───────────────────────────────────────────────
  add('vii_firmas', 'Sección de firmas / validación institucional', 'sectionVII' in root, 'warning');

  // ── Integridad transversal ─────────────────────────────────────────────────
  const serialized = JSON.stringify(content ?? {});
  add(
    'x_placeholders',
    'Sin placeholders ([completar], [insertar], [pendiente], TODO)',
    !/\[(completar|insertar|pendiente|texto)\]|\bTODO\b/i.test(serialized),
    'critical'
  );
  add(
    'x_recursos_curados',
    'Sin recursos de búsqueda genérica (google/youtube results)',
    !/google\.[a-z.]+\/search|youtube\.[a-z.]+\/results/i.test(serialized),
    'critical'
  );
  add(
    'x_carga_semanal',
    'Carga semanal coherente (1 a 5 h para BGE)',
    weeklyHours >= 1 && weeklyHours <= 5,
    'warning',
    `${weeklyHours} h/semana`
  );

  const passed = checks.filter((check) => check.ok).length;
  const criticalFailures = checks.filter((check) => !check.ok && check.severity === 'critical').length;
  const warningFailures = checks.filter((check) => !check.ok && check.severity === 'warning').length;
  const total = checks.length;

  return {
    ok: criticalFailures === 0,
    score: total > 0 ? Math.round((passed / total) * 100) : 0,
    passed,
    total,
    criticalFailures,
    warningFailures,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}

function sectionIII(root: Rec): Rec {
  return asRec(root.sectionIII);
}
