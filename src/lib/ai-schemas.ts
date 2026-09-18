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
  procesoPensamiento: z.enum([
    'asombro',
    'problematizacion',
    'traduccion',
    'conceptualizacion',
    'razonamiento',
    'indagacion',
    'reflexion',
    'transferencia',
  ]).optional(),
  utilidadReal: z.string().optional(),
  garantiaDualOffline: z.string().optional(),
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

export const PaecPaso6PlanSchema = z.preprocess((input: any) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const list = input.semestreA || input.planSemestreA || input.activities || input.actividades || input.rows || input.planOperativo;
    if (Array.isArray(list)) return list;
    const anyArr = Object.values(input).find((v) => Array.isArray(v));
    if (anyArr) return anyArr;
  }
  return input;
}, z.array(PlanOperativoRowSchema).min(1, 'Debe incluir al menos una actividad para el Semestre A'));

export const PaecPaso7PlanSchema = z.preprocess((input: any) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const list = input.semestreB || input.planSemestreB || input.activities || input.actividades || input.rows || input.planOperativo;
    if (Array.isArray(list)) return list;
    const anyArr = Object.values(input).find((v) => Array.isArray(v));
    if (anyArr) return anyArr;
  }
  return input;
}, z.array(PlanOperativoRowSchema).min(1, 'Debe incluir al menos una actividad para el Semestre B'));

export const PaecPaso6FullSchema = z.object({
  semestreA: z.array(PlanOperativoRowSchema),
  semestreB: z.array(PlanOperativoRowSchema),
});

// PASO 7 / 8: Portafolio de Anexos Técnicos e Implementación Territorial
export const Anexo1MinutaSchema = z.object({
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

export const Anexo2SeguimientoRowSchema = z.object({
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

export const Anexo3ReporteMensualSchema = z.object({
  periodo: z.string().default(''),
  resumenEjecutivo: z.string().default(''),
  logros: z.array(z.string().min(1)).default([]),
  dificultades: z.array(z.string().min(1)).default([]),
  accionesAjuste: z.array(z.string().min(1)).default([]),
});

export const ReactivoInstrumentoSchema = z.object({
  reactivo: z.string().min(1),
  dimension: z.string().min(1),
});

export const InstrumentoEvaluacionGenericoSchema = z.object({
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

// PASO 8: Implementación Territorial, Oficios y Anexos
export const CartaInvitacionSchema = z.object({
  asunto: z.string().default('Convocatoria a Asamblea General PAEC-PEC'),
  fecha: z.string().default(''),
  destinatarios: z.string().default('Comunidad Escolar y Vecinal'),
  cuerpo: z.string().min(10, 'Cuerpo de la carta requerido'),
  fechaReunion: z.string().default(''),
  hora: z.string().default(''),
  lugar: z.string().default(''),
  objetivos: z.array(z.string()).default([]),
  firmante: z.string().default('Dirección Escolar'),
  cargo: z.string().default('Director'),
});

export const OficioAliadoSchema = z.object({
  destinatario: z.string().min(1, 'Destinatario requerido'),
  cargo: z.string().default(''),
  institucion: z.string().default(''),
  asunto: z.string().min(1, 'Asunto requerido'),
  propuestaColaboracion: z.string().min(10, 'Propuesta de colaboración requerida'),
});

export const SesionLanzamientoSchema = z.object({
  fecha: z.string().default(''),
  dinamica: z.string().default(''),
  participantes: z.string().default(''),
  acuerdosEstudiantiles: z.array(z.string()).default([]),
}).optional();

export const PaecPaso8ImplementacionSchema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      cartaInvitacion: input.cartaInvitacion || input.carta || {},
      minutaArranque: input.minutaArranque || input.minuta || input.anexo1Minuta || {},
      oficiosAliados: input.oficiosAliados || input.oficios || [],
      sesionLanzamiento: input.sesionLanzamiento || undefined,
      anexos: input.anexos || {
        anexo1Minuta: input.anexo1Minuta || input.minutaArranque || {},
        anexo2Seguimiento: input.anexo2Seguimiento || [],
        anexo3ReporteMensual: input.anexo3ReporteMensual || {},
        anexo4ImpactoComunidad: input.anexo4ImpactoComunidad || {},
        anexo5AutoevaluacionEstudiantes: input.anexo5AutoevaluacionEstudiantes || {},
        anexo6EvaluacionColegiado: input.anexo6EvaluacionColegiado || {},
      },
    };
  }
  return input;
}, z.object({
  cartaInvitacion: CartaInvitacionSchema,
  minutaArranque: Anexo1MinutaSchema,
  oficiosAliados: z.array(OficioAliadoSchema).min(1, 'Debe incluir al menos un oficio para aliados'),
  sesionLanzamiento: SesionLanzamientoSchema,
  anexos: PaecPaso7Schema.optional(),
}));

// PASO 9: Gobernanza Escolar e Informe de Rendición de Cuentas (Supervisión 004)
export const CalendarioItemSchema = z.object({
  tipo: z.string().min(1, 'Tipo de comité o nivel de gobernanza requerido'),
  frecuencia: z.string().default('Bimestral'),
  participantes: z.string().min(1, 'Participantes requeridos'),
  objetivo: z.string().min(5, 'Objetivo de la sesión requerido'),
  evidencia: z.string().default('Minuta de reunión'),
});

export const MetodologiaEvaluacionSchema = z.object({
  ambitos: z.array(z.string()).min(1, 'Debe incluir al menos un ámbito formativo'),
  preguntasGuiaNem: z.object({
    dondeEstamos: z.string().min(5, 'Respuesta requerida para ¿Dónde estamos?'),
    haciaDondeVamos: z.string().min(5, 'Respuesta requerida para ¿Hacia dónde vamos?'),
    comoSuperamos: z.string().min(5, 'Respuesta requerida para ¿Cómo superamos las brechas?'),
  }),
});

export const MetaLogroRowSchema = z.object({
  meta: z.string().min(1, 'Meta requerida'),
  indicador: z.string().default('Porcentaje de cumplimiento'),
  programado: z.string().default('100%'),
  alcanzado: z.string().default('100%'),
  porcentaje: z.coerce.number().default(100),
  estatus: z.string().default('Cumplida'),
});

export const InformeSupervisionSchema = z.object({
  resumenEjecutivo: z.string().min(20, 'Resumen ejecutivo de rendición de cuentas requerido'),
  metasVsLogros: z.array(MetaLogroRowSchema).min(1, 'Debe incluir metas vs logros'),
  analisisPrePost: z.object({
    participacionTotal: z.string().default(''),
    alcanceComunitario: z.string().default(''),
    cambioConocimientos: z.string().default(''),
    desarrolloCompetencias: z.string().default(''),
  }),
  evidencias: z.array(z.string()).default([]),
  obstaculos: z.array(z.object({
    dificultad: z.string().default(''),
    solucion: z.string().default(''),
  })).default([]),
  sostenibilidad: z.array(z.string()).default([]),
  firmas: z.object({
    responsableInforme: z.string().default('Coordinador PAEC'),
    autoridadEscolar: z.string().default('Director del Plantel'),
  }).optional(),
});

export const PaecPaso9GobernanzaSchema = z.preprocess((input: any) => {
  if (input && typeof input === 'object') {
    return {
      gobernanza: input.gobernanza || {
        calendario: input.calendario || [],
        metodologiaEvaluacion: input.metodologiaEvaluacion || input.evaluacion || {},
      },
      informeSupervision: input.informeSupervision || input.informe || input.supervision || {},
    };
  }
  return input;
}, z.object({
  gobernanza: z.object({
    calendario: z.array(CalendarioItemSchema).min(2, 'Debe incluir al menos 2 niveles en el calendario de gobernanza'),
    metodologiaEvaluacion: MetodologiaEvaluacionSchema,
  }),
  informeSupervision: InformeSupervisionSchema,
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

// ============================================================================
// 4. PROGRAMAS CURRICULARES (PDF EXTRACTION)
// ============================================================================

export const PdfProgramExtractSchema = z.object({
  uacName: z.string().default(''),
  semester: z.coerce.number().optional().default(1),
  learningOutcome: z.string().default(''),
  totalHours: z.coerce.number().default(54),
  activities: z.array(z.object({
    name: z.string().default(''),
    hours: z.coerce.number().optional().default(18),
    order: z.coerce.number().optional().default(1),
  })).default([]),
  evidences: z.array(z.string()).default([]),
  contenidosFormativos: z.array(z.object({
    proposito: z.string().default(''),
    contenidos: z.array(z.string()).default([]),
  })).optional(),
});

export type PdfProgramExtractDTO = z.infer<typeof PdfProgramExtractSchema>;

// ============================================================================
// 5. PAEC DOCUMENT EXTRACTION
// ============================================================================

export const PaecExtractedDocSchema = z.object({
  projectName: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  problem: z.string().nullable().optional(),
  studentContext: z.string().nullable().optional(),
  schoolName: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  cct: z.string().nullable().optional(),
  planOperativo: z.array(z.object({
    asignatura: z.string().default(''),
    actividad: z.string().default(''),
    propositoFormativo: z.string().optional().default(''),
    estrategiaDidactica: z.string().optional().default(''),
    semana: z.string().optional().default(''),
    fase: z.string().optional().default(''),
    progresion: z.string().optional().default(''),
  })).default([]),
});

export type PaecExtractedDocDTO = z.infer<typeof PaecExtractedDocSchema>;

// ============================================================================
// 6. HORARIOS SOLVER PARAMS
// ============================================================================

export const HorarioSolverParamsSchema = z.object({
  grupos: z.array(z.any()).min(1, 'Se requiere al menos un grupo'),
  docentes: z.array(z.any()).min(1, 'Se requiere al menos un docente'),
  cargas: z.array(z.any()).min(1, 'Se requieren cargas horarias'),
  dias: z.array(z.string()).optional(),
  bloquesPorDia: z.number().optional(),
  bloqueReceso: z.number().optional(),
  horasSemanales: z.number().optional(),
});

export type HorarioSolverParamsDTO = z.infer<typeof HorarioSolverParamsSchema>;

// ============================================================================
// 6.B. RETO SITUADO, DIAGNÓSTICO 3D, 8 PROCESOS Y BITÁCORA 50-20-30
// ============================================================================

export const RetoSituadoSchema = z.object({
  titulo: z.string().default('Reto Situado de Aprendizaje'),
  verboInfinitivo: z.string().min(1, 'Verbo en infinitivo requerido'),
  contextoLocal: z.string().min(1, 'Contexto local requerido'),
  problematicaReal: z.string().min(1, 'Problemática real requerida'),
  propositoCurricular: z.string().min(1, 'Propósito curricular requerido'),
  retoCompleto: z.string().min(10, 'Redacción del reto situado requerida'),
  validacion: z.object({
    hasInfinitiveVerb: z.boolean().default(true),
    hasLocalContext: z.boolean().default(true),
    hasRealProblem: z.boolean().default(true),
    hasCurricularAlignment: z.boolean().default(true),
    score: z.number().default(4),
    feedback: z.array(z.string()).default([]),
    isApproved: z.boolean().default(true),
    repairedText: z.string().optional(),
  }).optional(),
});

export type RetoSituadoDTO = z.infer<typeof RetoSituadoSchema>;

export const DiagnosticoSituado3DSchema = z.object({
  dimensionTerritorial: z.string().default(''),
  dimensionPraxisJuvenil: z.string().default(''),
  dimensionAulaEdiems: z.string().default(''),
});

export type DiagnosticoSituado3DDTO = z.infer<typeof DiagnosticoSituado3DSchema>;

export const ProcesoPensamientoFaseSchema = z.object({
  proceso: z.enum([
    'asombro',
    'problematizacion',
    'traduccion',
    'conceptualizacion',
    'razonamiento',
    'indagacion',
    'reflexion',
    'transferencia',
  ]),
  descripcion: z.string().default(''),
  actividadEstudiante: z.string().default(''),
  utilidadReal: z.string().default(''),
  garantiaDualOffline: z.string().default(''),
});

export type ProcesoPensamientoFaseDTO = z.infer<typeof ProcesoPensamientoFaseSchema>;

export const BitacoraEstudianteRowSchema = z.object({
  no: z.coerce.number().default(1),
  nombreEstudiante: z.string().min(1, 'Nombre del estudiante requerido'),
  participativo: z.boolean().default(true),
  dialogante: z.boolean().default(true),
  cuestionador: z.boolean().default(false),
  apoyo: z.boolean().default(true),
  evidenciaColectivaCalificacion: z.coerce.number().default(9),
  evidenciaIndividualCalificacion: z.coerce.number().default(8.5),
  notasAcompanamiento: z.string().default(''),
});

export type BitacoraEstudianteRowDTO = z.infer<typeof BitacoraEstudianteRowSchema>;

export const Bitacora502030Schema = z.object({
  uacName: z.string().default(''),
  corteEvaluativo: z.enum(['Corte 1', 'Corte 2', 'Corte 3']).default('Corte 1'),
  criterioProceso50: z.string().default(''),
  evidenciaColectiva20: z.string().default(''),
  evidenciaIndividual30: z.string().default(''),
  ticketSalidaPregunta: z.string().default(''),
  filasEstudiantes: z.array(BitacoraEstudianteRowSchema).default([]),
});

export type Bitacora502030DTO = z.infer<typeof Bitacora502030Schema>;

// ============================================================================
// 7. PLANEACIÓN DIDÁCTICA COMPLETA (GENERATED PLANNING CONTENT)
// ============================================================================

export const PlanningContentSchema = z.object({
  sectionI: z.record(z.string(), z.any()),
  sectionII: z.record(z.string(), z.any()),
  sectionIII: z.record(z.string(), z.any()).optional().default({}),
  sectionIV: z.record(z.string(), z.any()),
  sectionV: z.record(z.string(), z.any()).optional().default({}),
}).passthrough();

export type PlanningContentDTO = z.infer<typeof PlanningContentSchema>;

// ============================================================================
// 8. EVALUACIÓN Y AUDITORÍA DE PLANEACIONES (23 CRITERIOS NEM)
// ============================================================================

export const PlaneacionEvaluacionSchema = z.object({
  criterios: z.array(z.object({
    id: z.string(),
    cumple: z.preprocess((val) => {
      const s = String(val || '').toUpperCase().trim();
      if (s === 'SI' || s === 'SÍ') return 'SI';
      if (s === 'NO') return 'NO';
      return 'PARCIAL';
    }, z.enum(['SI', 'PARCIAL', 'NO'])),
    evidencia: z.string().default(''),
    retroalimentacion: z.string().default(''),
  })).default([]),
  puntosFuertes: z.array(z.string()).optional(),
  mejorasUrgentes: z.array(z.string()).optional(),
  observacionesExtendidas: z.string().optional(),
  alineacionPaecPec: z.string().optional(),
  retroalimentacionDocente: z.string().optional(),
  analisis_integral: z.string().optional(),
}).passthrough();

export type PlaneacionEvaluacionDTO = z.infer<typeof PlaneacionEvaluacionSchema>;

// ============================================================================
// 9. ASISTENTE INTELIGENTE DE HORARIOS (COMANDOS Y RESTRICCIONES)
// ============================================================================

export const ScheduleAssistantResponseSchema = z.object({
  explicacion: z.string().default(''),
  acciones: z.array(z.object({
    tipo: z.string(),
    bloqueosDocentes: z.array(z.any()).optional(),
    bloqueosGrupos: z.array(z.any()).optional(),
    restriccionDistribucion: z.enum(['MAX_1_HR_DIA', 'BLOQUES_DOBLES_CONTINUOS']).optional(),
    asignatura: z.string().optional(),
    grupoId: z.string().optional(),
    docenteId: z.string().optional(),
    diaOrigen: z.number().optional(),
    periodoOrigen: z.number().optional(),
    diaDestino: z.number().optional(),
    periodoDestino: z.number().optional(),
    origen: z.any().optional(),
    destino: z.any().optional(),
    dias: z.array(z.number()).optional(),
    periodos: z.array(z.any()).optional(),
    intermedias: z.boolean().optional(),
  })).default([]),
  factible: z.boolean().default(true),
  advertencia: z.string().optional(),
});

export type ScheduleAssistantResponseDTO = z.infer<typeof ScheduleAssistantResponseSchema>;

// ============================================================================
// 10. OPTIMIZACIÓN Y BALANCE DE HORARIOS
// ============================================================================

export const ScheduleOptimizationSchema = z.preprocess((input) => {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.sugerencias)) return obj.sugerencias;
    if (Array.isArray(obj.diagnosticos)) return obj.diagnosticos;
    return [input];
  }
  return [];
}, z.array(z.object({
  diagnostico_general: z.string().default('Horario analizado.'),
  score_balance: z.coerce.number().default(85),
  puntos_fuertes: z.array(z.string()).default([]),
  areas_mejora: z.array(z.string()).default([]),
})));

export type ScheduleOptimizationDTO = z.infer<typeof ScheduleOptimizationSchema>;

// ============================================================================
// 11. CARTOGRAFÍA DE ZONA ESCOLAR SCHEMAS (DBEPA PUEBLA MCCEMS 2026-2027)
// ============================================================================

export const RecursoComunitarioSchema = z.object({
  nombre: z.string().default('Recurso Comunitario'),
  tipo: z.preprocess((val) => {
    const s = String(val || '').toLowerCase();
    if (s.includes('salud')) return 'salud';
    if (s.includes('depor')) return 'deportivo';
    if (s.includes('cultur')) return 'cultural';
    if (s.includes('produc')) return 'productivo';
    if (s.includes('educa')) return 'educativo';
    return 'comunitario';
  }, z.enum(['salud', 'deportivo', 'cultural', 'productivo', 'educativo', 'comunitario'])).default('comunitario'),
  ubicacion: z.string().default('Comunidad de la Zona'),
  vinculacionPedagogica: z.string().default('Vinculación con proyectos formativos y comunitarios.'),
});

export const CartografiaMomento3Schema = z.preprocess((input) => {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    return obj.momento3Ubicar || obj.momento3 || obj.ubicar || input;
  }
  return input;
}, z.object({
  descripcionTerritorial: z.string().min(1, 'La descripción territorial es requerida'),
  comunidadesProcedencia: z.array(z.string()).default([]),
  movilidadTransporte: z.string().default('Acceso y movilidad estándar en la región.'),
  conectividadInfraestructura: z.string().default('Infraestructura y conectividad de zona escolar.'),
  recursosAliados: z.array(RecursoComunitarioSchema).default([]),
  mapaContextual: z.string().default('Distribución espacial de planteles y nodos comunitarios.'),
}));

export type CartografiaMomento3DTO = z.infer<typeof CartografiaMomento3Schema>;

export const TriangulacionPerspectivasSchema = z.object({
  directivos: z.string().default('Visión de gestión y clima escolar.'),
  docentes: z.string().default('Retos en aula y adaptaciones pedagógicas.'),
  alumnosFamilias: z.string().default('Pertinencia social y condiciones del entorno.'),
  supervisionAtp: z.string().default('Acompañamiento situado y asesoría pedagógica.'),
});

export const CartografiaMomento4Schema = z.preprocess((input) => {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    return obj.momento4Analizar || obj.momento4 || obj.analizar || input;
  }
  return input;
}, z.object({
  triangulacion: TriangulacionPerspectivasSchema,
  patronesRecurrentes: z.array(z.string()).default([]),
  retosPedagogicosCreaa: z.array(z.string()).default([]),
  acuerdosAutonomiaConsejo: z.array(z.string()).default([]),
}));

export type CartografiaMomento4DTO = z.infer<typeof CartografiaMomento4Schema>;

export const LineaAccionOficialSchema = z.object({
  numero: z.preprocess((val) => {
    const n = Number(val);
    if (n === 2) return 2;
    if (n === 3) return 3;
    return 1;
  }, z.union([z.literal(1), z.literal(2), z.literal(3)])).default(1),
  titulo: z.string().default('Línea de Acción'),
  accionesEspecificas: z.array(z.string()).default([]),
  recursos: z.array(z.string()).default([]),
  responsables: z.string().default('Supervisión y Colectivos Docentes'),
  entregables: z.string().default('Evidencias de acompañamiento'),
  estrategiaSeguimiento: z.string().default('Sesiones de Consejo Técnico y visitas situadas'),
  periodoEjecucion: z.string().default('Ciclo Escolar 2026-2027'),
});

export const CartografiaMomento5Schema = z.preprocess((input) => {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    return obj.momento5Decidir || obj.momento5 || obj.decidir || input;
  }
  return input;
}, z.object({
  metaGeneralZona: z.string().min(1, 'La meta general de zona con fórmula CREAA es requerida'),
  indicadoresCreaaAsociados: z.array(z.string()).default([]),
  lineasAccion: z.array(LineaAccionOficialSchema).default([]),
  compromisosSupervision: z.array(z.string()).default([]),
}));

export type CartografiaMomento5DTO = z.infer<typeof CartografiaMomento5Schema>;

export const IndicadoresCambioSchema = z.object({
  proceso: z.string().default('Transformación en la planeación y evaluación formativa.'),
  creaa: z.string().default('Impacto positivo en indicadores CREAA.'),
  impactoTerritorial: z.string().default('Fortalecimiento del vínculo escuela-comunidad.'),
});

export const CartografiaMemoriaSchema = z.preprocess((input) => {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    return obj.memoriaPedagogica || obj.memoria || input;
  }
  return input;
}, z.object({
  queLogramos: z.string().min(1, 'La respuesta a ¿Qué logramos? es requerida'),
  comoLoLogramos: z.string().min(1, 'La respuesta a ¿Cómo lo logramos? es requerida'),
  queAprendimos: z.string().min(1, 'La respuesta a ¿Qué aprendimos? es requerida'),
  indicadoresCambio: IndicadoresCambioSchema.default({
    proceso: 'Transformación en la planeación y evaluación formativa.',
    creaa: 'Impacto positivo en indicadores CREAA.',
    impactoTerritorial: 'Fortalecimiento del vínculo escuela-comunidad.',
  }),
  hojaDeRutaProximoCiclo: z.array(z.string()).default([]),
}));

export type CartografiaMemoriaDTO = z.infer<typeof CartografiaMemoriaSchema>;

