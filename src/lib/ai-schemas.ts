import { z } from 'zod';

// ============================================================================
// 1. SECUENCIA DIDÁCTICA SCHEMAS
// ============================================================================

export const SecuenciaSesionSchema = z.object({
  sessionNum: z.coerce.number().default(1),
  totalSessions: z.coerce.number().optional(),
  phase: z.preprocess((val) => {
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower.includes('apert')) return 'Apertura';
      if (lower.includes('cierr')) return 'Cierre';
      return 'Desarrollo';
    }
    return 'Desarrollo';
  }, z.enum(['Apertura', 'Desarrollo', 'Cierre'])),
  title: z.string().min(1, 'El título de la sesión es requerido'),
  teachingActivity: z.string().min(1, 'La actividad docente es requerida'),
  learningActivity: z.string().min(1, 'La actividad de aprendizaje es requerida'),
  evidence: z.string().min(1, 'La evidencia de aprendizaje es requerida'),
  evaluation: z.string().min(1, 'El instrumento de evaluación es requerido'),
});

export type SecuenciaSesionDTO = z.infer<typeof SecuenciaSesionSchema>;

export const SecuenciaResponseSchema = z.preprocess((input) => {
  if (Array.isArray(input)) {
    return { sessions: input };
  }
  if (input && typeof input === 'object') {
    const obj = input as Record<string, any>;
    const list = obj.sessions || obj.sesiones || obj.secuencia || obj.activities || obj.rows;
    if (Array.isArray(list)) {
      return { sessions: list };
    }
    const anyArr = Object.values(obj).find((v) => Array.isArray(v));
    if (anyArr) {
      return { sessions: anyArr };
    }
  }
  return input;
}, z.object({
  sessions: z.array(SecuenciaSesionSchema).min(1, 'Debe generarse al menos una sesión didáctica válida'),
}));

export type SecuenciaResponseDTO = z.infer<typeof SecuenciaResponseSchema>;


// ============================================================================
// 2. PAEC (PROYECTO ACADÉMICO ESCOLAR COMUNITARIO) SCHEMAS
// ============================================================================

// PASO 1: Diagnóstico Comunitario y Escolar
const TableRow2ColsSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    return {
      col1: String(val.col1 || val.aspecto || val.etapa || val.area || val.campo || ''),
      col2: String(val.col2 || val.descripcion || val.detalle || val.analisis || ''),
    };
  }
  return val;
}, z.object({
  col1: z.string().min(1, 'Columna 1 requerida'),
  col2: z.string().min(1, 'Columna 2 requerida'),
}));

const FODARowSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    return {
      aspect: String(val.aspect || val.aspecto || val.col1 || ''),
      analysis: String(val.analysis || val.analisis || val.col2 || ''),
    };
  }
  return val;
}, z.object({
  aspect: z.string().min(1, 'Aspecto FODA requerido'),
  analysis: z.string().min(1, 'Análisis FODA requerido'),
}));

export const PaecPaso1Schema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      tabla1: input.tabla1 || input.tabla1_caracteristicas || input.diagnosticoComunidad || [],
      tabla2: input.tabla2 || input.tabla2_educativo || input.diagnosticoEscolar || [],
      tabla3: input.tabla3 || input.tabla3_foda || input.foda || [],
      tabla4: input.tabla4 || input.tabla4_seleccion || input.procesoSeleccion || [],
    };
  }
  return input;
}, z.object({
  tabla1: z.array(TableRow2ColsSchema).min(1, 'La tabla 1 de diagnóstico de comunidad debe contener registros'),
  tabla2: z.array(TableRow2ColsSchema).min(1, 'La tabla 2 de diagnóstico escolar debe contener registros'),
  tabla3: z.array(FODARowSchema).min(1, 'La tabla 3 de FODA debe contener registros'),
  tabla4: z.array(TableRow2ColsSchema).min(1, 'La tabla 4 de proceso de selección debe contener registros'),
}));

// PASO 2: Justificación y Fundamentación Estratégica
export const PaecPaso2Schema = z.object({
  projectName: z.string().min(5, 'Nombre del proyecto demasiado corto'),
  introduction: z.string().min(20, 'La introducción debe fundamentar pedagógicamente el proyecto'),
  pilares: z.array(z.string().min(1)).min(3, 'Debe incluir al menos 3 pilares estratégicos'),
  proposito: z.object({
    educativo: z.string().min(10, 'Propósito educativo requerido'),
    social: z.string().min(10, 'Propósito social requerido'),
    funcional: z.string().min(10, 'Propósito funcional requerido'),
  }),
  alcance: z.object({
    metas: z.array(z.string().min(1)).min(1, 'Debe incluir al menos 1 meta'),
    participantes: z.array(z.string().min(1)).min(1, 'Debe incluir participantes'),
    recursos: z.array(z.string().min(1)).min(1, 'Debe incluir recursos'),
  }),
});

// PASO 3: Mapeo Curricular de UACs
const MapeoRowSchema = z.object({
  semester: z.coerce.number().min(1).max(6),
  uacName: z.string().min(1, 'Nombre de la UAC requerido'),
  topic: z.string().default('Contenido formativo'),
  linking: z.string().min(5, 'La vinculación comunitaria de la UAC es requerida'),
});

export const PaecPaso3Schema = z.preprocess((input: any) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const list = input.mapeo || input.uacs || input.rows || input.fase2Mapeo;
    if (Array.isArray(list)) return list;
    const anyArr = Object.values(input).find((v) => Array.isArray(v));
    if (anyArr) return anyArr;
  }
  return input;
}, z.array(MapeoRowSchema).min(1, 'Debe incluir al menos una UAC mapeada'));

// PASO 4: Cronograma en 6 Fases
const CronogramaRowSchema = z.object({
  phase: z.string().min(1, 'Fase requerida'),
  objective: z.string().min(5, 'Objetivo de la fase requerido'),
  bimonthlyGoal: z.string().optional(),
  macroActivities: z.string().min(5, 'Actividades macro requeridas'),
  responsibleSubjects: z.string().min(1, 'Asignaturas responsables requeridas'),
  semesterInvolved: z.string().min(1, 'Semestres involucrados requeridos'),
});

export const PaecPaso4Schema = z.preprocess((input: any) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const list = input.cronograma || input.fases || input.rows || input.fase2Cronograma;
    if (Array.isArray(list)) return list;
    const anyArr = Object.values(input).find((v) => Array.isArray(v));
    if (anyArr) return anyArr;
  }
  return input;
}, z.array(CronogramaRowSchema).min(4, 'El cronograma debe contener al menos 4 fases'));

// PASO 5: Detalle Curricular y Articulación por Semestre
const DetalleCurricularRowSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    return {
      semester: Number(val.semester || 1),
      uacName: String(val.uacName || val.uac || ''),
      progressionsOrPurposes: String(val.progressionsOrPurposes || val.progressions || val.proposito || val.progresion || ''),
      projectPhases: String(val.projectPhases || val.projectPhase || val.fases || ''),
      curricularJustification: String(val.curricularJustification || val.justification || val.justificacion || ''),
    };
  }
  return val;
}, z.object({
  semester: z.coerce.number().min(1).max(6),
  uacName: z.string().min(1, 'Nombre de la UAC requerido'),
  progressionsOrPurposes: z.string().min(5, 'Progresión o propósito formativo requerido'),
  projectPhases: z.string().min(1, 'Fases del proyecto requeridas'),
  curricularJustification: z.string().min(5, 'Justificación curricular requerida'),
}));

export const PaecPaso5Schema = z.preprocess((input: any) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const list = input.detalleCurricular || input.detalle || input.rows || input.fase2DetalleCurricular;
    if (Array.isArray(list)) return list;
    const anyArr = Object.values(input).find((v) => Array.isArray(v));
    if (anyArr) return anyArr;
  }
  return input;
}, z.array(DetalleCurricularRowSchema).min(1, 'Debe incluir al menos un registro de articulación curricular'));

// PASO 6: Plan Operativo Detallado (8 Columnas)
export const PlanOperativoRowSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object') {
    return {
      phase: String(val.phase || val.fase || ''),
      activity: String(val.activity || val.actividad || ''),
      uac: String(val.uac || val.uacName || ''),
      progression: String(val.progression || val.progresion || val.proposito || ''),
      strategy: String(val.strategy || val.estrategia || ''),
      week: String(val.week || val.semana || ''),
      responsibles: String(val.responsibles || val.responsible || val.responsable || ''),
      evaluationInstrument: String(val.evaluationInstrument || val.instrumento || val.evaluacion || ''),
    };
  }
  return val;
}, z.object({
  phase: z.string().min(1, 'Fase requerida'),
  activity: z.string().min(5, 'Actividad operativa requerida'),
  uac: z.string().min(1, 'UAC requerida'),
  progression: z.string().min(1, 'Progresión o propósito requerido'),
  strategy: z.string().min(1, 'Estrategia metodológica requerida'),
  week: z.string().min(1, 'Semana de aplicación requerida'),
  responsibles: z.string().min(1, 'Docente o responsable requerido'),
  evaluationInstrument: z.string().min(1, 'Instrumento de evaluación requerido'),
}));

export const PaecPaso6BlockSchema = z.preprocess((input: any) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const list = input.activities || input.actividades || input.rows || input.planOperativo;
    if (Array.isArray(list)) return list;
    const anyArr = Object.values(input).find((v) => Array.isArray(v));
    if (anyArr) return anyArr;
  }
  return input;
}, z.array(PlanOperativoRowSchema).min(1, 'El bloque debe contener al menos 1 actividad operativa'));

export const PaecPaso6FullSchema = z.object({
  semestreA: z.array(PlanOperativoRowSchema),
  semestreB: z.array(PlanOperativoRowSchema),
});

// PASO 7: Portafolio de Anexos Técnicos (6 Anexos)
const Anexo1MinutaSchema = z.object({
  cct: z.string().default(''),
  fecha: z.string().default(''),
  tipoReunion: z.string().default('Instalación del Comité Escolar Comunitario'),
  acuerdos: z.array(z.object({
    no: z.coerce.number().default(1),
    acuerdo: z.string().min(1),
    responsable: z.string().min(1),
    fechaLimite: z.string().default(''),
    estatus: z.string().default('Cumplido'),
  })).min(1),
  firmas: z.array(z.object({
    cargo: z.string().min(1),
    nombre: z.string().min(1),
  })).min(1),
});

const Anexo2SeguimientoRowSchema = z.object({
  semana: z.string().default(''),
  fase: z.string().default(''),
  uac: z.string().default(''),
  metaOperativa: z.string().min(1),
  evidencia: z.string().min(1),
  avancePorcentaje: z.coerce.number().default(100),
  semaforo: z.enum(['verde', 'amarillo', 'rojo']).or(
    z.string().transform((s) => {
      const lower = s.toLowerCase();
      if (lower.includes('amarill')) return 'amarillo' as const;
      if (lower.includes('roj')) return 'rojo' as const;
      return 'verde' as const;
    })
  ),
});

const Anexo3ReporteMensualSchema = z.object({
  periodo: z.string().default(''),
  resumenEjecutivo: z.string().default(''),
  logros: z.array(z.string().min(1)).default([]),
  dificultades: z.array(z.string().min(1)).default([]),
  accionesAjuste: z.array(z.string().min(1)).default([]),
});

const ReactivoInstrumentoSchema = z.object({
  reactivo: z.string().min(1),
  dimension: z.string().min(1),
});

const InstrumentoEvaluacionGenericoSchema = z.object({
  titulo: z.string().default('Instrumento de Evaluación'),
  tipoAplicacion: z.string().default('FINAL'),
  reactivos: z.array(ReactivoInstrumentoSchema).min(1),
  escala: z.record(z.string(), z.string()).optional(),
});

export const PaecPaso7Schema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      anexo1Minuta: input.anexo1Minuta || input.anexo1 || input.minuta || {},
      anexo2Seguimiento: input.anexo2Seguimiento || input.anexo2 || input.seguimiento || [],
      anexo3ReporteMensual: input.anexo3ReporteMensual || input.anexo3 || input.reporteMensual || {},
      anexo4ImpactoComunidad: input.anexo4ImpactoComunidad || input.anexo4 || input.impactoComunidad || {},
      anexo5AutoevaluacionEstudiantes: input.anexo5AutoevaluacionEstudiantes || input.anexo5 || input.autoevaluacion || {},
      anexo6EvaluacionColegiado: input.anexo6EvaluacionColegiado || input.anexo6 || input.evaluacionColegiado || {},
    };
  }
  return input;
}, z.object({
  anexo1Minuta: Anexo1MinutaSchema,
  anexo2Seguimiento: z.array(Anexo2SeguimientoRowSchema).min(1, 'Debe incluir seguimiento semanal'),
  anexo3ReporteMensual: Anexo3ReporteMensualSchema,
  anexo4ImpactoComunidad: InstrumentoEvaluacionGenericoSchema,
  anexo5AutoevaluacionEstudiantes: InstrumentoEvaluacionGenericoSchema,
  anexo6EvaluacionColegiado: InstrumentoEvaluacionGenericoSchema,
}));

// ============================================================================
// 3. PMC (PROGRAMA DE MEJORA CONTINUA) SCHEMAS
// ============================================================================

export const PmcDiagnosticoSchema = z.object({
  presentacion: z.string().min(10, 'La presentación del PMC es requerida'),
  contexto: z.string().min(10, 'El contexto comunitario y escolar es requerido'),
  analisis_indicadores: z.string().min(10, 'El análisis de indicadores es requerido'),
  sintesis_foda: z.string().min(10, 'La síntesis FODA es requerida'),
  priorizacion: z.string().min(10, 'La priorización de problemas es requerida'),
});

const PmcMetaInstitucionalSchema = z.object({
  categoria: z.string().default('1'),
  nombre_categoria: z.string().default(''),
  tema: z.string().min(1, 'Tema institucional requerido'),
  diagnostico_meta: z.string().min(1, 'Diagnóstico de la meta requerido'),
  meta: z.string().min(5, 'Meta SMART requerida'),
  estrategia: z.string().min(5, 'Estrategia requerida'),
  linea_base: z.string().default(''),
  personal_designado: z.string().default(''),
  entregable: z.string().min(1, 'Entregable requerido'),
  periodo_inicio: z.string().default(''),
  periodo_fin: z.string().default(''),
});

const PmcMetaPersonalSchema = z.object({
  nombre: z.string().min(1, 'Nombre del personal requerido'),
  cargo: z.string().min(1, 'Cargo del personal requerido'),
  meta_individual: z.string().min(5, 'Meta individual requerida'),
  estrategia: z.string().min(1, 'Estrategia requerida'),
  entregable: z.string().min(1, 'Entregable requerido'),
  periodo: z.string().default(''),
});

export const PmcPlanAccionSchema = z.object({
  metas_institucionales: z.array(PmcMetaInstitucionalSchema).min(1, 'Debe incluir al menos una meta institucional'),
  metas_personales: z.array(PmcMetaPersonalSchema).default([]),
});
