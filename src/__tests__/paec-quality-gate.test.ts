// src/__tests__/paec-quality-gate.test.ts
/**
 * Tests unitarios para paec-quality-gate.ts
 * Fase 12A · SIGPDA-EMS
 *
 * Sin mocking: 23 funciones evaluateCriterio* completamente puras.
 * REGLA: score baseline para input null/vacio = 1 (Likert fail), NO 0.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCriterio1,
  evaluateCriterio2,
  evaluateCriterio5,
  evaluateCriterio8,
  evaluateCriterio11,
  evaluateCriterio13,
  evaluateCriterio15,
  evaluateCriterio19,
  evaluateCriterio21,
  validatePaecStepResult,
  calculateGlobalPaecScore,
  formatAuditReport,
  DIMENSIONS,
} from '@/lib/paec-quality-gate';
import type {
  Fase1Diagnostico,
  Fase2Justificacion,
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PaecProject,
  PaecGobernanza,
} from '@/types/paec';

// ============================================================================
// FIXTURES
// ============================================================================

// ── Dim 1: Diagnostico ───────────────────────────────────────────────────────

const FASE1_COMPLETA: Fase1Diagnostico = {
  tabla1: [
    { col1: 'Ubicacion geografica', col2: 'El plantel se encuentra en la periferia sur de la ciudad de Puebla, zona semiurbana con acceso limitado a transporte publico.' },
    { col1: 'Perfil socioeconomico', col2: 'El 65% de los estudiantes provienen de familias de ingreso bajo con empleo informal como principal fuente de recursos.' },
    { col1: 'Contexto cultural', col2: 'Fuerte presencia de tradicion artesanal local en textiles y ceramica, representando un potencial de vinculacion comunitaria.' },
    { col1: 'Salud comunitaria', col2: 'Alta incidencia de diabetes y obesidad en adultos mayores de la comunidad, oportunidad para proyecto de huerta escolar-comunitaria.' },
  ],
  tabla2: [
    { col1: 'Matricula actual', col2: 'El plantel cuenta con 347 estudiantes distribuidos en 12 grupos de 1er a 6to semestre con una proporcion 48/52 hombres/mujeres.' },
    { col1: 'Plantilla docente', col2: '24 docentes activos de los cuales el 75% son titulares y el 25% son interinos con contratos por asignatura.' },
    { col1: 'Indicadores de logro', col2: 'La tasa de aprobacion al primer corte fue de 74%, con reprobacion de 26% concentrada en Matematicas y Quimica.' },
  ],
  tabla3: [
    { aspect: 'Fortaleza', analysis: 'Cuerpo docente comprometido con actualizacion permanente y participacion activa en el CTE.' },
    { aspect: 'Oportunidad', analysis: 'Red de aliados comunitarios: DIF municipal, Clinica de Salud local y Asociacion de Artesanos.' },
    { aspect: 'Debilidad', analysis: 'Infraestructura de laboratorios con equipamiento desactualizado que limita la ensenanza experimental.' },
    { aspect: 'Amenaza', analysis: 'Incremento del trabajo informal juvenile que compite con la asistencia regular y genera ausentismo creciente.' },
  ],
  tabla4: [
    { col1: 'Diagnostico inicial', col2: 'Levantamiento de datos mediante encuesta a estudiantes, padres y docentes sobre necesidades comunitarias percibidas.' },
    { col1: 'Analisis colectivo', col2: 'Sesion de CTE extraordinario para sistematizar resultados del diagnostico y priorizar problematicas comunitarias.' },
  ],
};

const FASE2_COMPLETA: Fase2Justificacion = {
  projectName: 'Huerta Escolar-Comunitaria para la Seguridad Alimentaria Local',
  introduction:
    'Este proyecto de plantel responde a la problematica de inseguridad alimentaria identificada en el diagnostico comunitario, ' +
    'vinculando el aprendizaje curricular con la transformacion real del entorno inmediato de la escuela. ' +
    'Los estudiantes de la comunidad participan activamente en el diseno, implementacion y evaluacion de la Huerta Escolar-Comunitaria, ' +
    'convirtiendo el territorio del plantel en un laboratorio vivo de aprendizaje situado. ' +
    'La iniciativa busca generar impacto medible en tres dimensiones interconectadas: educativa, social y productiva, ' +
    'articulando los saberes curriculares con las necesidades reales de las familias del entorno escolar.',
  pilares: ['Sustentabilidad ambiental', 'Salud y bienestar comunitario', 'Emprendimiento social juvenil'],
  proposito: {
    educativo:
      'Desarrollar competencias transversales de investigacion, trabajo colaborativo y pensamiento critico mediante la implementacion practica de conocimientos de Biologia, Quimica y Matematicas en el cultivo organico.',
    social:
      'Contribuir a la seguridad alimentaria de 50 familias de la comunidad a traves de la produccion y distribucion de hortalizas organicas libres de agroquimicos.',
    funcional:
      'Establecer un modelo de negocio escolar sostenible que genere ingresos para el mantenimiento del huerto y la adquisicion de materiales para el plantel.',
  },
  alcance: {
    metas: [
      'Instalar 8 camas de cultivo operativas para Enero 2027',
      'Capacitar a 120 estudiantes en tecnicas de agricultura organica',
      'Entregar 200 kg de hortalizas a familias beneficiarias al finalizar el semestre A',
    ],
    participantes: ['Estudiantes de 2do y 4to semestre', 'Docentes de Biologia y Matematicas', 'Familias de la comunidad', 'DIF Municipal'],
    recursos: ['Espacio fisico disponible en patio trasero del plantel', 'Semillas donadas por Asociacion de Agricultores', 'Herramientas gestionadas via convenio con DIF'],
  },
};

const MAPEO_COMPLETO: MapeoRow[] = [
  { semester: 1, uacName: 'Matematicas I', topic: 'Sistemas de medicion y geometria aplicada al diseno de camas de cultivo', linking: 'Calculo de area, perimetro y volumen para dimensionar las camas de siembra' },
  { semester: 1, uacName: 'Lenguaje y Comunicacion I', topic: 'Elaboracion de informes tecnicos y exposicion oral', linking: 'Reporte de avance del proyecto y presentacion a la comunidad' },
  { semester: 1, uacName: 'Conciencia Historica I', topic: 'Identidad comunitaria y patrimonio cultural local', linking: 'Contextualizar el proyecto en la historia agricola de la comunidad' },
  { semester: 2, uacName: 'Biologia I', topic: 'Ecosistemas, ciclos biogeoquimicos y agricultura organica', linking: 'Comprension de los procesos naturales que sustentan el cultivo organico sostenible' },
  { semester: 2, uacName: 'Quimica I', topic: 'Reacciones quimicas y propiedades del suelo', linking: 'Analisis del pH del suelo y seleccion de abonos organicos adecuados' },
  { semester: 2, uacName: 'Ciencias Naturales II', topic: 'Nutricion vegetal y fotosintesis', linking: 'Base biologica para la produccion organica sostenible del huerto escolar' },
  { semester: 3, uacName: 'Matematicas III', topic: 'Estadistica descriptiva y analisis de datos', linking: 'Registro y analisis de variables de crecimiento vegetal y produccion' },
  { semester: 3, uacName: 'Ciencias Sociales I', topic: 'Organizacion comunitaria y redes de apoyo social', linking: 'Mapeo de actores comunitarios aliados del proyecto y redes de cooperacion' },
  { semester: 3, uacName: 'Salud Comunitaria', topic: 'Alimentacion saludable y seguridad alimentaria', linking: 'Vinculacion directa entre produccion del huerto y mejora nutricional familiar' },
  { semester: 4, uacName: 'Emprendimiento Social', topic: 'Modelos de negocio social y economia solidaria', linking: 'Diseno del modelo de distribucion comunitaria de hortalizas organicas' },
  { semester: 4, uacName: 'Matematicas IV', topic: 'Costos, presupuestos y analisis financiero basico', linking: 'Control financiero del proyecto: insumos, produccion y margen de distribucion' },
  { semester: 4, uacName: 'Lenguaje y Comunicacion III', topic: 'Comunicacion persuasiva y difusion de proyectos', linking: 'Elaboracion del informe final y materiales de difusion del impacto comunitario' },
  { semester: 3, uacName: 'Humanidades II', topic: 'Etica ambiental y responsabilidad comunitaria', linking: 'Marco axiologico del proyecto: sustentabilidad como valor formativo central' },
  { semester: 4, uacName: 'Cultura Digital', topic: 'Registro digital y sistematizacion de datos del proyecto', linking: 'Bitacora digital del huerto, fotografias de evidencia y reportes de produccion' },
];

const CRONOGRAMA_COMPLETO: CronogramaRow[] = [
  {
    phase: 'Fase I: Diagnostico y Diseno',
    objective: 'Diagnosticar el espacio disponible y disenar el layout de la huerta escolar',
    macroActivities: 'Levantamiento topografico del patio, analisis de suelo, diseno participativo con estudiantes',
    responsibleSubjects: 'Matematicas I, Biologia I',
    semesterInvolved: '1er y 2do semestre',
  },
  {
    phase: 'Fase II: Implementacion',
    objective: 'Construir las camas de cultivo e iniciar el proceso de siembra organica',
    macroActivities: 'Construccion de camas, preparacion del suelo, siembra inicial de hortalizas seleccionadas',
    responsibleSubjects: 'Quimica I, Biologia I, Educacion Fisica',
    semesterInvolved: '1er al 4to semestre',
  },
  {
    phase: 'Fase III: Seguimiento y Cosecha',
    objective: 'Monitorear el crecimiento, registrar datos y realizar la primera cosecha comunitaria',
    macroActivities: 'Bitacoras de monitoreo, analisis estadistico de datos de produccion, cosecha y distribucion',
    responsibleSubjects: 'Matematicas III, Biologia II, Lenguaje y Comunicacion',
    semesterInvolved: '3er al 6to semestre',
  },
  {
    phase: 'Fase IV: Distribucion Comunitaria',
    objective: 'Distribuir hortalizas organicas a familias beneficiarias e impactar la seguridad alimentaria local',
    macroActivities: 'Logistica de distribucion, registro de beneficiarios, testimonios de impacto comunitario',
    responsibleSubjects: 'Emprendimiento Social, Lenguaje y Comunicacion III',
    semesterInvolved: '4to al 6to semestre',
  },
  {
    phase: 'Fase V: Evaluacion de Impacto',
    objective: 'Medir el impacto educativo, social y productivo del proyecto con indicadores verificables',
    macroActivities: 'Encuesta de impacto, analisis de indicadores academicos, presentacion a directivos y CTE',
    responsibleSubjects: 'Matematicas IV, Ciencias Sociales I, Humanidades II',
    semesterInvolved: '5to y 6to semestre',
  },
  {
    phase: 'Fase VI: Sistematizacion y Transferencia',
    objective: 'Sistematizar la experiencia y transferirla como modelo replicable a otras escuelas de la zona',
    macroActivities: 'Elaboracion del informe final, presentacion en foro zonal, publicacion digital del modelo',
    responsibleSubjects: 'Lenguaje y Comunicacion III, Cultura Digital, Humanidades II',
    semesterInvolved: '6to semestre',
  },
];

// ── Dim 5: Detalle Curricular ─────────────────────────────────────────────────

const DETALLE_CURRICULAR: DetalleCurricularRow[] = [
  {
    semester: 1,
    uacName: 'Matematicas I',
    progressionsOrPurposes: 'Progresion P1.3: El estudiante aplica razonamiento espacial para resolver problemas practicos de medicion y geometria en contextos reales.',
    projectPhases: 'Fase I: Diseno de camas de cultivo',
    curricularJustification: 'La geometria aplicada permite a los estudiantes calcular dimensiones optimas de las camas de siembra con criterio matematico formal.',
  },
  {
    semester: 2,
    uacName: 'Biologia I',
    progressionsOrPurposes: 'Progresion P2.1: El estudiante comprende los ciclos biogeoquimicos y su papel en el equilibrio de los ecosistemas locales.',
    projectPhases: 'Fase I y II: Analisis de suelo e implementacion del huerto',
    curricularJustification: 'El estudio de ecosistemas proporciona el marco teorico para la agricultura organica sostenible y la conservacion del suelo.',
  },
  {
    semester: 3,
    uacName: 'Matematicas III',
    progressionsOrPurposes: 'Progresion P3.2: El estudiante usa estadistica descriptiva para analizar, interpretar y comunicar datos de fenomenos naturales y sociales.',
    projectPhases: 'Fase III: Seguimiento y registro de produccion',
    curricularJustification: 'La estadistica descriptiva es la herramienta metodologica central para el monitoreo cientifico de la produccion agricola.',
  },
];

// ── Dim 8: Gobernanza ────────────────────────────────────────────────────────

const GOBERNANZA_COMPLETA: PaecGobernanza = {
  calendario: [
    {
      tipo: 'Reunion de CTE',
      frecuencia: 'Mensual',
      participantes: 'Todos los docentes del plantel y directivos',
      objetivo: 'Seguimiento de indicadores y ajuste de estrategias del proyecto',
      evidencia: 'Minuta firmada y lista de asistencia',
    },
    {
      tipo: 'Reunion con padres de familia',
      frecuencia: 'Bimestral',
      participantes: 'Padres de familia, estudiantes y directivos',
      objetivo: 'Informar sobre avances del proyecto y gestionar apoyos comunitarios',
      evidencia: 'Fotografias y acta de acuerdos',
    },
    {
      tipo: 'Reunion de aliados comunitarios',
      frecuencia: 'Trimestral',
      participantes: 'DIF Municipal, Asociacion de Agricultores, directivos y responsables del proyecto',
      objetivo: 'Coordinar aportes de recursos y validar el impacto comunitario',
      evidencia: 'Oficio de acuerdos y fotografia de reunion',
    },
  ],
  metodologiaEvaluacion: {
    ambitos: ['Logro academico de los estudiantes', 'Impacto comunitario medible', 'Produccion agricola real y cuantificable'],
    preguntasGuiaNem: {
      dondeEstamos: 'El 74% de aprobacion inicial indica rezago en Matematicas y Quimica que el proyecto busca revertir mediante aprendizaje contextualizado.',
      haciaDondeVamos: 'Lograr 85% de aprobacion, producir 200 kg de hortalizas y capacitar a 120 estudiantes en agricultura organica al finalizar el semestre A.',
      comoSuperamos: 'Mediante la integracion curricular real y el acompanamiento pedagogico sistematico con evidencias verificables de impacto.',
    },
  },
};

// ── Proyecto completo para calculateGlobalPaecScore ──────────────────────────

const COMPLETE_PAEC_PROJECT: PaecProject = {
  id: 'paec-test-complete',
  teacherId: 'teacher-001',
  projectName: 'Huerta Escolar-Comunitaria para la Seguridad Alimentaria Local',
  problemStatement: 'Inseguridad alimentaria e indicadores bajos de logro academico en comunidad periurbana.',
  cycleType: 'A',
  currentStep: 9,
  communityContext: {
    location: 'Zona semiurbana sur de Puebla',
    demographics: '65% familias de bajo ingreso con empleo informal',
    economy: 'Artesania textil y ceramica como actividad complementaria al trabajo informal',
  },
  schoolContext: {
    cct: '21EBH0001X',
    schoolName: 'Bachillerato Estatal 001',
    municipality: 'Puebla, Pue.',
    enrollment: '347',
    teacherCount: '24',
  },
  fase1Diagnostico: FASE1_COMPLETA,
  fase2Justificacion: FASE2_COMPLETA,
  fase2Mapeo: MAPEO_COMPLETO,
  fase2Cronograma: CRONOGRAMA_COMPLETO,
  fase2DetalleCurricular: DETALLE_CURRICULAR,
  fase2PlanOperativo: null,
  fase2Anexos: null,
  fase3PlanOperativoA: null,
  fase3PlanOperativoB: null,
  fase3Implementacion: null,
  fase4Gobernanza: GOBERNANZA_COMPLETA,
  fase4InformeSupervision: null,
  qualityAudit: null,
  status: 'completed',
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-09-01'),
};

const EMPTY_PAEC_PROJECT: PaecProject = {
  id: 'paec-test-empty',
  teacherId: 'teacher-002',
  projectName: '',
  problemStatement: '',
  cycleType: 'A',
  currentStep: 1,
  communityContext: {},
  schoolContext: {},
  fase1Diagnostico: null,
  fase2Justificacion: null,
  fase2Mapeo: null,
  fase2Cronograma: null,
  fase2DetalleCurricular: null,
  fase2PlanOperativo: null,
  fase2Anexos: null,
  fase3PlanOperativoA: null,
  fase3PlanOperativoB: null,
  fase3Implementacion: null,
  fase4Gobernanza: null,
  fase4InformeSupervision: null,
  qualityAudit: null,
  status: 'draft',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
};

// ============================================================================
// TESTS
// ============================================================================

describe('paec-quality-gate — criterios individuales', () => {

  // ── Dimension 1: Diagnostico (C1-C4) ────────────────────────────────────

  it('C1: null -> score=1, status=fail (Dim 1)', () => {
    const result = evaluateCriterio1(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM1);
    expect(result.id).toBe(1);
  });

  it('C1: fase1 con 4 filas en tabla1 -> score >= 3 (Dim 1)', () => {
    const result = evaluateCriterio1(FASE1_COMPLETA);
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(['pass', 'warning']).toContain(result.status);
  });

  it('C2: null -> score=1, status=fail (Dim 1)', () => {
    const result = evaluateCriterio2(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.id).toBe(2);
  });

  // ── Dimension 2: Justificacion (C5-C7) ──────────────────────────────────

  it('C5: null -> score=1, status=fail (Dim 2)', () => {
    const result = evaluateCriterio5(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM2);
    expect(result.id).toBe(5);
  });

  it('C5: Fase2 completa con nombre, introduccion y pilares -> status pass (Dim 2)', () => {
    const result = evaluateCriterio5(FASE2_COMPLETA);
    expect(result.status).toBe('pass');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  // ── Dimension 3: Mapeo Curricular (C8-C10) ──────────────────────────────

  it('C8: null -> score=1, status=fail (Dim 3)', () => {
    const result = evaluateCriterio8(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM3);
    expect(result.id).toBe(8);
  });

  it('C8: mapeo con 5 materias distintas -> status pass (Dim 3)', () => {
    const result = evaluateCriterio8(MAPEO_COMPLETO);
    expect(result.status).toBe('pass');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  // ── Dimension 4: Cronograma (C11-C12) ───────────────────────────────────

  it('C11: null -> score=1, status=fail (Dim 4)', () => {
    const result = evaluateCriterio11(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM4);
    expect(result.id).toBe(11);
  });

  it('C11: cronograma con 3 fases completas -> status pass (Dim 4)', () => {
    const result = evaluateCriterio11(CRONOGRAMA_COMPLETO);
    expect(result.status).toBe('pass');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  // ── Dimension 5: Detalle Curricular (C13-C14) ───────────────────────────

  it('C13: null -> score=1, status=fail (Dim 5)', () => {
    const result = evaluateCriterio13(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM5);
    expect(result.id).toBe(13);
  });

  // ── Dimension 6: Plan Operativo (C15-C18) ───────────────────────────────

  it('C15: null planA y undefined legacy -> score=1, status=fail (Dim 6)', () => {
    const result = evaluateCriterio15(null, undefined);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM6);
    expect(result.id).toBe(15);
  });

  // ── Dimension 7: Implementacion (C19-C20) ───────────────────────────────

  it('C19: null impl y null legacy -> score=1, status=fail (Dim 7)', () => {
    const result = evaluateCriterio19(null, null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM7);
    expect(result.id).toBe(19);
  });

  // ── Dimension 8: Gobernanza (C21-C23) ───────────────────────────────────

  it('C21: null -> score=1, status=fail (Dim 8)', () => {
    const result = evaluateCriterio21(null);
    expect(result.score).toBe(1);
    expect(result.status).toBe('fail');
    expect(result.dimension).toBe(DIMENSIONS.DIM8);
    expect(result.id).toBe(21);
  });

});

describe('paec-quality-gate — calculateGlobalPaecScore', () => {

  it('proyecto vacio -> estatus requiere_ajustes y score < 70', () => {
    const audit = calculateGlobalPaecScore(EMPTY_PAEC_PROJECT);
    expect(audit.estatus).toBe('requiere_ajustes');
    expect(audit.score).toBeLessThan(70);
    expect(audit.criterios).toHaveLength(23);
    // Todo en fail -> todos los scores son 1 (Likert baseline)
    for (const c of audit.criterios) {
      expect(c.score).toBeGreaterThanOrEqual(1);
    }
  });

  it('proyecto con datos diagnostico + justificacion + mapeo + cronograma -> score mejorado vs proyecto vacio', () => {
    const auditEmpty = calculateGlobalPaecScore(EMPTY_PAEC_PROJECT);
    const auditRich = calculateGlobalPaecScore(COMPLETE_PAEC_PROJECT);
    expect(auditRich.score).toBeGreaterThan(auditEmpty.score);
    expect(auditRich.summary!.passedCount).toBeGreaterThan(0);
  });

  it('formatAuditReport genera Markdown con PAEC y porcentaje', () => {
    const audit = calculateGlobalPaecScore(COMPLETE_PAEC_PROJECT);
    const report = formatAuditReport(audit);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(100);
    expect(report).toContain('%');
  });

});

describe('paec-quality-gate — validatePaecStepResult (Pasos 1-9)', () => {

  it('Paso 1: evalua diagnostico correctamente (C1-C4)', () => {
    const audit = validatePaecStepResult(1, FASE1_COMPLETA);
    expect(audit.criterios).toHaveLength(4);
    expect(audit.criterios.map(c => c.id)).toEqual([1, 2, 3, 4]);
    expect(audit.score).toBeGreaterThanOrEqual(70);
  });

  it('Paso 2: evalua justificacion correctamente (C5-C7)', () => {
    const audit = validatePaecStepResult(2, FASE2_COMPLETA);
    expect(audit.criterios).toHaveLength(3);
    expect(audit.criterios.map(c => c.id)).toEqual([5, 6, 7]);
    expect(audit.score).toBeGreaterThan(0);
  });

  it('Paso 3: evalua mapeo curricular tanto directo como envuelto en objeto (C8-C10)', () => {
    const auditArray = validatePaecStepResult(3, MAPEO_COMPLETO);
    const auditObj = validatePaecStepResult(3, { mapeo: MAPEO_COMPLETO });
    expect(auditArray.criterios).toHaveLength(3);
    expect(auditObj.criterios).toHaveLength(3);
    expect(auditArray.criterios.map(c => c.id)).toEqual([8, 9, 10]);
  });

  it('Paso 4: evalua cronograma bimestral (C11-C12)', () => {
    const audit = validatePaecStepResult(4, { cronograma: CRONOGRAMA_COMPLETO });
    expect(audit.criterios).toHaveLength(2);
    expect(audit.criterios.map(c => c.id)).toEqual([11, 12]);
  });

  it('Paso 5: evalua detalle curricular (C13-C14)', () => {
    const audit = validatePaecStepResult(5, { detalleCurricular: DETALLE_CURRICULAR });
    expect(audit.criterios).toHaveLength(2);
    expect(audit.criterios.map(c => c.id)).toEqual([13, 14]);
  });

  it('Paso 6: evalua plan operativo Semestre A (C15, C17, C18)', () => {
    const audit = validatePaecStepResult(6, { semestreA: [] });
    expect(audit.criterios).toHaveLength(3);
    expect(audit.criterios.map(c => c.id)).toEqual([15, 17, 18]);
  });

  it('Paso 7: evalua plan operativo Semestre B (C16, C17, C18)', () => {
    const audit = validatePaecStepResult(7, { semestreB: [] });
    expect(audit.criterios).toHaveLength(3);
    expect(audit.criterios.map(c => c.id)).toEqual([16, 17, 18]);
  });

  it('Paso 8: evalua formalizacion e implementacion (C19-C20)', () => {
    const audit = validatePaecStepResult(8, {
      cartaInvitacion: {
        asunto: 'Invitacion',
        fecha: '2026-09-01',
        destinatarios: 'Comunidad',
        cuerpo: 'Texto',
        fechaReunion: '2026-09-05',
        hora: '10:00',
        lugar: 'Plantel',
        objetivos: ['Objetivo 1'],
        firmante: 'Director',
        cargo: 'Director',
      },
      minutaArranque: {
        cct: '21EBH0001X',
        fecha: '2026-09-05',
        tipoReunion: 'Inicio',
        acuerdos: [],
        firmas: [],
      },
      oficiosAliados: [],
    });
    expect(audit.criterios).toHaveLength(2);
    expect(audit.criterios.map(c => c.id)).toEqual([19, 20]);
  });

  it('Paso 9: evalua gobernanza escolar e informe de supervision (C21-C23)', () => {
    const audit = validatePaecStepResult(9, {
      gobernanza: GOBERNANZA_COMPLETA,
      informeSupervision: {
        resumenEjecutivo: 'Resumen del proyecto',
        metasVsLogros: [],
        analisisPrePost: {
          participacionTotal: 'Alta',
          alcanceComunitario: 'Medio',
          cambioConocimientos: 'Notable',
          desarrolloCompetencias: 'Optimo',
        },
        evidencias: ['Foto 1'],
        obstaculos: [],
        sostenibilidad: ['Plan de continuidad'],
      },
    });
    expect(audit.criterios).toHaveLength(3);
    expect(audit.criterios.map(c => c.id)).toEqual([21, 22, 23]);
  });

  it('calculateGlobalPaecScore con payload legacy snake_case evalua correctamente sin errores de tipo', () => {
    const legacyProject = {
      fase1_diagnostico: FASE1_COMPLETA,
      fase2_justificacion: FASE2_COMPLETA,
      fase2_mapeo: MAPEO_COMPLETO,
      fase2_cronograma: CRONOGRAMA_COMPLETO,
      fase2_detalle_curricular: DETALLE_CURRICULAR,
      fase4_gobernanza: GOBERNANZA_COMPLETA,
    };
    const audit = calculateGlobalPaecScore(legacyProject);
    expect(audit.criterios).toHaveLength(23);
    expect(audit.score).toBeGreaterThan(50);
  });

});
