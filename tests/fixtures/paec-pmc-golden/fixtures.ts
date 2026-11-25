/**
 * tests/fixtures/paec-pmc-golden/fixtures.ts
 *
 * Fixtures limpios y anonimizados para congelar el contrato golden de
 * PMC (DOCX oficial, DOCX Maestro, PDF oficial, Quality Gate + QA Semántico)
 * y PAEC (DOCX oficial, PDF oficial, Quality Gate + QA Semántico).
 * Cero dependencias de base de datos o red para ejecución determinista en CI.
 */

import type { PmcProject } from '@/types/pmc';
import type { PmcDocxMaestroOptions, PmcProjectMasterData } from '@/lib/pmc-docx-maestro-builder';
import type { PaecProject, PlanOperativoRow } from '@/types/paec';
import { PMC_NOMBRES_CATEGORIAS } from '@/lib/constants/pmc-categorias';

const [
  CAT_DESARROLLO_ACADEMICO,
  CAT_GESTION_ADMINISTRACION,
  CAT_DESARROLLO_SOCIOEMOCIONAL,
] = PMC_NOMBRES_CATEGORIAS;

export const GOLDEN_PMC_PROJECT: PmcProject = {
  id: '00000000-0000-4000-8000-000000000101',
  teacher_id: '00000000-0000-4000-8000-000000000001',
  school_name: 'Bachillerato General Oficial "Sierra Norte Modelo"',
  school_cct: '21EBH0999Z',
  municipality: 'Zacatlán',
  locality: 'San Miguel Tenango',
  school_zone: '086',
  director_name: 'Mtra. Elena Morales Castro',
  supervisor_name: 'Mtro. Ricardo Domínguez Silva',
  ciclo_escolar: '2026-2027',
  subsystem: 'Bachillerato General Estatal',
  total_staff: 6,
  status: 'completed',
  current_step: 4,
  staff_data: [
    { nombre: 'Mtra. Elena Morales Castro', cargo: 'Directora', funcion: 'Gestión escolar y acompañamiento docente', antiguedad: 12, formacion: 'Maestría en Gestión Educativa', horas_base: 40 },
    { nombre: 'Ing. Carlos Ramírez Vega', cargo: 'Docente', funcion: 'Pensamiento Matemático y Física', antiguedad: 8, formacion: 'Ingeniería Industrial', horas_base: 30 },
    { nombre: 'Lic. Sofía Hernández Cruz', cargo: 'Docente', funcion: 'Lengua y Comunicación e Inglés', antiguedad: 6, formacion: 'Licenciatura en Letras', horas_base: 25 },
    { nombre: 'Biol. Arturo López Paredes', cargo: 'Docente', funcion: 'Ciencias Naturales y Laboratorio', antiguedad: 9, formacion: 'Licenciatura en Biología', horas_base: 25 },
    { nombre: 'Lic. Patricia Torres Aguilar', cargo: 'Docente', funcion: 'Ciencias Sociales y Humanidades', antiguedad: 7, formacion: 'Licenciatura en Historia', horas_base: 20 },
    { nombre: 'Psic. Mariana Vázquez León', cargo: 'Orientadora Educativa', funcion: 'Tutoría y formación socioemocional', antiguedad: 5, formacion: 'Licenciatura en Psicología', horas_base: 20 },
  ],
  indicadores_academicos: {
    matricula: 145,
    matriculaAnterior: 152,
    matriculaInicioCicloAnterior: 160,
    matricula_meta: 150,
    totalAlumnosF11: 152,
    aprobados: 130,
    regulares: 112,
    irregulares: 18,
    reprobados: 14,
    bajas: 8,
    bajasDefinitivas: 8,
    existenciaFin: 152,
    porcentajes: {
      aprobados: 85.5,
      regulares: 73.7,
      irregulares: 11.8,
      reprobados: 9.2,
      bajas: 5.3,
    },
    aprobacion_ant: 85.5,
    aprobacion_meta: 90.5,
    reprobacion_ant: 9.2,
    reprobacion_meta: 4.2,
    abandono_ant: 5.0,
    abandono_meta: 3.5,
    et_ant: 91.0,
    et_meta: 95.0,
    promedio_f11: 8.2,
    promedio_meta: 8.6,
    metas_confirmadas: true,
    reprobacionPorMateria: [
      { materia: 'Pensamiento Matemático I', n: 50, reprobados: 8, porcentaje: 16.0, porcentajeAprobacion: 84.0, metaSugerida: 10.0, metaUsuario: 10.0, metaConfirmada: true },
      { materia: 'Ciencias Naturales I', n: 50, reprobados: 5, porcentaje: 10.0, porcentajeAprobacion: 90.0, metaSugerida: 5.0, metaUsuario: 5.0, metaConfirmada: true },
    ],
  },
  foda: {
    fortalezas:
      '• Planta docente consolidada de 6 profesionales con trabajo colegiado activo en CTE.\n• Seguimiento puntual de asistencia y registro oportuno en formato F11.\n• Vinculación activa con el Proyecto Escolar Comunitario (PEC) en la localidad.',
    oportunidades:
      '• Convenios de colaboración con el Instituto Tecnológico Superior de la Sierra Norte y centros de salud municipales.\n• Programas de formación continua COSFAC disponibles para la totalidad del colectivo.\n• Apoyo constante del Comité de Padres de Familia en mantenimiento preventivo.',
    debilidades:
      '• Rezago de ingreso en Pensamiento Matemático I (16.0% de reprobación en el último cierre F11).\n• Cobertura parcial de equipamiento de laboratorio y conectividad inalámbrica en dos aulas.\n• Falta de estandarización en instrumentos de evaluación formativa entre academias.',
    amenazas:
      '• Traslados prolongados desde comunidades serranas durante temporada de lluvias.\n• Presión económica familiar que incentiva la incorporación laboral temprana de estudiantes de 5° semestre.\n• Factores psicosociales de riesgo en el entorno juvenil fuera del horario escolar.',
    cruzado: {
      fo: 'Estrategia FO (Ofensiva): Aprovechar la planta docente consolidada y los convenios con el Tecnológico de la Sierra Norte para impulsar tutorías STEM y ferias científicas vinculadas al PEC.',
      do: 'Estrategia DO (Reorientación): Emplear los cursos COSFAC y el apoyo del Comité de Padres para reducir el rezago en Pensamiento Matemático I y rehabilitar el laboratorio escolar.',
      fa: 'Estrategia FA (Defensiva): Movilizar el seguimiento puntual de asistencia y la orientación educativa como sistema de alertas tempranas frente a traslados difíciles y deserción laboral.',
      da: 'Estrategia DA (Supervivencia): Implementar asesorías flexibles sabatinas y comunicación quincenal con familias para evitar que el rezago matemático combinado con presiones económicas derive en abandono escolar.',
    },
  },
  categorias_priorizadas: [
    {
      id: '1',
      nombre: CAT_DESARROLLO_ACADEMICO,
      temas: [
        'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
        'Formación y actualización docente',
        'Planeación didáctica',
      ],
    },
    {
      id: '2',
      nombre: CAT_GESTION_ADMINISTRACION,
      temas: [
        'Seguimiento al desempeño docente en el aula',
        'Gestión y administración de recursos, equipamiento y servicios',
      ],
    },
    {
      id: '3',
      nombre: CAT_DESARROLLO_SOCIOEMOCIONAL,
      temas: [
        'Estrategias, programas y/o proyectos sobre violencia',
        'Ámbitos de formación socioemocional (Currículum Ampliado)',
      ],
    },
  ],
  diagnostico_comunidad:
    'El plantel atiende a 145 estudiantes de 5 localidades rurales del municipio de Zacatlán, con economía basada en agricultura familiar, fruticultura y comercio local. Existen redes solidarias comunitarias y vínculos activos con autoridades auxiliares.',
  normativa: {
    marco_legal: 'Artículo 3° Constitucional, Ley General de Educación y Acuerdo Secretarial 09/08/23 (MCCEMS).',
    lineamientos_sems: 'Lineamientos del Programa de Mejora Continua (PMC) SEP Puebla 2026-2027.',
  },
  diagnostico_generado: {
    presentacion:
      'El Programa de Mejora Continua (PMC) 2026-2027 del Bachillerato General Oficial "Sierra Norte Modelo" (CCT 21EBH0999Z) constituye el instrumento rector de planeación participativa colegiada bajo los principios de la Nueva Escuela Mexicana y el MCCEMS.',
    contexto:
      'Ubicado en San Miguel Tenango, Zacatlán, el plantel atiende a 145 aprendientes con una planta de 6 profesionales comprometidos. El entorno territorial demanda estrategias educativas pertinentes que articulen ciencia, ciudadanía y arraigo comunitario.',
    analisis_indicadores:
      'En el cierre del ciclo anterior (F11 y 911), la aprobación fue de 85.5% (130 de 152 estudiantes), la reprobación de 9.2% (14 alumnos), el abandono de 5.0% y la eficiencia terminal de 91.0%. Se propone elevar la aprobación a 90.5%, disminuir la reprobación a 4.2%, bajar el abandono a 3.5% y alcanzar 95.0% de eficiencia terminal.',
    sintesis_foda:
      'El análisis FODA cruzado orienta cuatro ejes de acción: Estrategia FO para potenciar el trabajo colegiado junto con convenios de educación superior; Estrategia DO para abatir el rezago en Pensamiento Matemático I mediante capacitación COSFAC; Estrategia FA para activar alertas tempranas ante traslados complejos; y Estrategia DA para acompañar oportunamente a estudiantes en riesgo económico.',
    priorizacion:
      'El colectivo priorizó tres categorías normativas: Desarrollo académico y aprendizaje, Gestión y administración escolar, y Desarrollo socioemocional y prevención de la violencia en la escuela.',
  },
  plan_accion: {
    metas_institucionales: [
      {
        categoria: CAT_DESARROLLO_ACADEMICO,
        tema: 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
        diagnostico_meta: 'En el cierre F11 anterior se registró 85.5% de aprobación y 9.2% de reprobación, con mayor incidencia en Pensamiento Matemático I (16.0%).',
        meta: 'Elevar la aprobación escolar del 85.5% al 90.5% y reducir la reprobación del 9.2% al 4.2% en la matrícula de 145 estudiantes al cierre del ciclo escolar 2026-2027 (julio 2027).',
        estrategia: 'Implementar asesorías focalizadas semanales por corte de evaluación, tutoría entre pares y seguimiento quincenal de alumnos en alerta temprana.',
        linea_base: '85.5% aprobación, 9.2% reprobación, 5.0% abandono y 91.0% eficiencia terminal (F11/911 ciclo previo).',
        personal_designado: 'Ing. Carlos Ramírez Vega y Mtra. Elena Morales Castro',
        entregable: 'Actas de seguimiento por corte, bitácoras de asesoría y concentrado F11 de cierre.',
        periodo_inicio: 'Agosto 2026',
        periodo_fin: 'Julio 2027',
        accion_especifica: 'Sesiones de nivelación y monitoreo por corte',
        finalidad: 'Asegurar la acreditación oportuna y trayectoria completa',
        proceso_evaluacion: 'Corte bimestral con contraste F11',
      },
      {
        categoria: CAT_DESARROLLO_ACADEMICO,
        tema: 'Formación y actualización docente',
        diagnostico_meta: 'El 67% del colectivo completó cursos COSFAC en el ciclo previo; se requiere cobertura total en evaluación formativa MCCEMS.',
        meta: 'Lograr que el 100% de la planta docente (6 profesionales) acredite al menos 2 cursos oficiales COSFAC de actualización didáctica MCCEMS entre septiembre 2026 y junio 2027.',
        estrategia: 'Calendarizar formación continua colegiada y socializar evidencias aplicadas en sesiones ordinarias de CTE.',
        linea_base: '67% de docentes con constancia COSFAC vigente.',
        personal_designado: 'Mtra. Elena Morales Castro y Lic. Sofía Hernández Cruz',
        entregable: 'Constancias oficiales COSFAC y relatorías de transferencia áulica en CTE.',
        periodo_inicio: 'Septiembre 2026',
        periodo_fin: 'Junio 2027',
        accion_especifica: 'Inscripción y seguimiento de cursos COSFAC',
        finalidad: 'Fortalecer la práctica pedagógica colegiada',
        proceso_evaluacion: 'Verificación semestral de constancias',
      },
      {
        categoria: CAT_GESTION_ADMINISTRACION,
        tema: 'Seguimiento al desempeño docente en el aula',
        diagnostico_meta: 'El acompañamiento áulico previo cubrió el 60% de los grupos de forma heterogénea.',
        meta: 'Ejecutar el 100% de las visitas de observación formativa áulica (al menos 2 por docente al semestre) en los 6 grupos durante el ciclo escolar 2026-2027.',
        estrategia: 'Aplicar rúbrica consensuada de acompañamiento pedagógico y devolución constructiva individual en un plazo máximo de 5 días hábiles.',
        linea_base: '60% de cobertura en observaciones de aula en el ciclo anterior.',
        personal_designado: 'Mtra. Elena Morales Castro',
        entregable: 'Guías de observación áulica firmadas y acuerdos de mejora docente.',
        periodo_inicio: 'Septiembre 2026',
        periodo_fin: 'Junio 2027',
        accion_especifica: 'Rondas programadas de observación y retroalimentación',
        finalidad: 'Elevar la coherencia entre planeación y práctica en aula',
        proceso_evaluacion: 'Registro por corte de observaciones y compromisos',
      },
      {
        categoria: CAT_GESTION_ADMINISTRACION,
        tema: 'Gestión y administración de recursos, equipamiento y servicios',
        diagnostico_meta: 'Dos aulas presentan conectividad intermitente y el laboratorio requiere mantenimiento preventivo.',
        meta: 'Ejecutar el 100% del programa anual de mantenimiento preventivo en 6 aulas y 1 laboratorio de ciencias antes de mayo 2027 con participación del Comité de Padres.',
        estrategia: 'Gestionar insumos ante autoridades municipales y programar 3 jornadas comunitarias de rehabilitación física.',
        linea_base: '70% de espacios en condiciones óptimas de operación.',
        personal_designado: 'Mtra. Elena Morales Castro y Biol. Arturo López Paredes',
        entregable: 'Bitácoras de mantenimiento, inventario actualizado y evidencia fotográfica.',
        periodo_inicio: 'Octubre 2026',
        periodo_fin: 'Mayo 2027',
        accion_especifica: 'Jornadas programadas de rehabilitación y inventario',
        finalidad: 'Garantizar entornos dignos y seguros para el aprendizaje',
        proceso_evaluacion: 'Lista de verificación trimestral de infraestructura',
      },
      {
        categoria: CAT_DESARROLLO_SOCIOEMOCIONAL,
        tema: 'Estrategias, programas y/o proyectos sobre violencia',
        diagnostico_meta: 'Se registraron 4 incidentes menores de conflicto verbal en el ciclo previo sin taller preventivo permanente.',
        meta: 'Realizar 6 talleres formativos de cultura de paz y prevención de la violencia con el 100% de la matrícula (145 estudiantes) y padres de familia entre septiembre 2026 y junio 2027.',
        estrategia: 'Articular sesiones de Orientación Educativa con DIF Municipal y protocolos estatales de convivencia pacífica.',
        linea_base: '4 incidentes menores reportados y 1 charla anual previa.',
        personal_designado: 'Psic. Mariana Vázquez León y Lic. Patricia Torres Aguilar',
        entregable: 'Listas de asistencia, carteles preventivos y bitácora de convivencia escolar.',
        periodo_inicio: 'Septiembre 2026',
        periodo_fin: 'Junio 2027',
        accion_especifica: 'Talleres participativos y difusión de protocolos',
        finalidad: 'Consolidar entornos escolares libres de violencia',
        proceso_evaluacion: 'Encuesta pre/post de clima escolar',
      },
      {
        categoria: CAT_DESARROLLO_SOCIOEMOCIONAL,
        tema: 'Ámbitos de formación socioemocional (Currículum Ampliado)',
        diagnostico_meta: 'La participación estudiantil en actividades deportivas y artísticas comunitarias alcanzó 65% de la matrícula.',
        meta: 'Integrar al 100% de los 145 estudiantes en al menos 4 jornadas de ámbitos socioemocionales y bienestar integral vinculadas al PAEC durante el ciclo escolar 2026-2027.',
        estrategia: 'Organizar clubes de actividad física, expresión artística y autocuidado con calendarización semestral.',
        linea_base: '65% de participación estudiantil en actividades del Currículum Ampliado.',
        personal_designado: 'Psic. Mariana Vázquez León y Biol. Arturo López Paredes',
        entregable: 'Programas de jornadas, listas de participación y portafolio de evidencias.',
        periodo_inicio: 'Septiembre 2026',
        periodo_fin: 'Julio 2027',
        accion_especifica: 'Clubes y jornadas semestrales de bienestar integral',
        finalidad: 'Fortalecer el desarrollo socioemocional y sentido de pertenencia',
        proceso_evaluacion: 'Control de asistencia y rúbrica de participación',
      },
    ],
    metas_personales: [
      {
        nombre: 'Mtra. Elena Morales Castro',
        cargo: 'Directora',
        meta_individual: 'Realizar 12 observaciones formativas áulicas y coordinar el 100% de las sesiones de seguimiento de indicadores F11 al cierre del ciclo 2026-2027.',
        estrategia: 'Cronograma semestral de acompañamiento áulico y tableros de alerta temprana.',
        entregable: 'Expediente de acompañamiento directivo y actas de CTE.',
        periodo: 'Agosto 2026 - Julio 2027',
      },
      {
        nombre: 'Ing. Carlos Ramírez Vega',
        cargo: 'Docente',
        meta_individual: 'Reducir la reprobación en Pensamiento Matemático I del 16.0% al 10.0% mediante asesorías semanales durante el ciclo 2026-2027.',
        estrategia: 'Talleres de resolución de problemas contextualizados y evaluación formativa por corte.',
        entregable: 'Lista de asesorías y concentrado de calificaciones por corte.',
        periodo: 'Agosto 2026 - Julio 2027',
      },
      {
        nombre: 'Lic. Sofía Hernández Cruz',
        cargo: 'Docente',
        meta_individual: 'Alcanzar 94% de aprobación en Lengua y Comunicación mediante círculos de lectura crítica y producción escrita al cierre de julio 2027.',
        estrategia: 'Rúbricas analíticas de redacción y portafolio de textos comunitarios.',
        entregable: 'Antología estudiantil y registros de evaluación formativa.',
        periodo: 'Agosto 2026 - Julio 2027',
      },
      {
        nombre: 'Biol. Arturo López Paredes',
        cargo: 'Docente',
        meta_individual: 'Ejecutar 100% de las prácticas de laboratorio programadas y reducir a 5% la reprobación en Ciencias Naturales durante el ciclo 2026-2027.',
        estrategia: 'Prácticas experimentales situadas con bitácora científica.',
        entregable: 'Manual de prácticas ejecutadas y reportes de laboratorio.',
        periodo: 'Agosto 2026 - Julio 2027',
      },
      {
        nombre: 'Lic. Patricia Torres Aguilar',
        cargo: 'Docente',
        meta_individual: 'Coordinar 2 muestras comunitarias de memoria histórica con participación del 100% de sus grupos entre octubre 2026 y junio 2027.',
        estrategia: 'Investigación documental local y debate ciudadano en aula.',
        entregable: 'Catálogo de productos estudiantiles y listas de cotejo.',
        periodo: 'Octubre 2026 - Junio 2027',
      },
      {
        nombre: 'Psic. Mariana Vázquez León',
        cargo: 'Orientadora Educativa',
        meta_individual: 'Dar seguimiento personalizado al 100% de estudiantes en alerta temprana e impartir 6 talleres de convivencia pacífica durante 2026-2027.',
        estrategia: 'Entrevistas de orientación, canalización oportuna y escuela para padres.',
        entregable: 'Bitácora confidencial de tutoría y evidencias de talleres.',
        periodo: 'Agosto 2026 - Julio 2027',
      },
    ],
  },
};

export const GOLDEN_PMC_MAESTRO_PROJECT: PmcProjectMasterData = {
  ...GOLDEN_PMC_PROJECT,
  teacher_id: GOLDEN_PMC_PROJECT.teacher_id ?? '00000000-0000-4000-8000-000000000001',
  indicadores_academicos: GOLDEN_PMC_PROJECT.indicadores_academicos as Record<string, unknown>,
  foda: GOLDEN_PMC_PROJECT.foda as Record<string, unknown>,
  categorias_priorizadas: GOLDEN_PMC_PROJECT.categorias_priorizadas as unknown[],
  normativa: GOLDEN_PMC_PROJECT.normativa as Record<string, unknown>,
  diagnostico_generado: GOLDEN_PMC_PROJECT.diagnostico_generado as Record<string, unknown>,
  plan_accion: GOLDEN_PMC_PROJECT.plan_accion as Record<string, unknown>,
  staff_data: GOLDEN_PMC_PROJECT.staff_data as unknown[],
};

export const GOLDEN_PMC_MAESTRO_OPTIONS: PmcDocxMaestroOptions = {
  catalogoMetas: [
    {
      id: 'meta-cat-1',
      nombre: 'Indicadores académicos (aprobación, reprobación, abandono y eficiencia terminal)',
      categoria: CAT_DESARROLLO_ACADEMICO,
      subcategoria: 'Trayectoria escolar',
      articulos: ['Art. 3° Constitucional', 'Acuerdo 09/08/23'],
      vigencia: true,
      aplicabilidad_nivel: 'obligatoria',
      aplicabilidad_justificacion: 'Eje central de seguimiento F11 y 911.',
      evidencia: 'Concentrados F11 y estadísticas 911',
      orden_display: 1,
    },
    {
      id: 'meta-cat-2',
      nombre: 'Seguimiento al desempeño docente en el aula',
      categoria: CAT_GESTION_ADMINISTRACION,
      subcategoria: 'Acompañamiento pedagógico',
      articulos: ['Lineamientos PMC SEMS Puebla'],
      vigencia: true,
      aplicabilidad_nivel: 'obligatoria',
      aplicabilidad_justificacion: 'Garantiza mejora continua en práctica docente.',
      evidencia: 'Guías de observación áulica',
      orden_display: 2,
    },
  ],
  personal: [
    { id: 'staff-1', nombre: 'Elena', apellido_paterno: 'Morales', apellido_materno: 'Castro', cargo: 'Directora', horas_base: 40, activo: true },
    { id: 'staff-2', nombre: 'Carlos', apellido_paterno: 'Ramírez', apellido_materno: 'Vega', cargo: 'Docente', horas_base: 30, activo: true },
    { id: 'staff-3', nombre: 'Sofía', apellido_paterno: 'Hernández', apellido_materno: 'Cruz', cargo: 'Docente', horas_base: 25, activo: true },
  ],
};

function buildGoldenPaecPlanRows(semester: 'A' | 'B'): PlanOperativoRow[] {
  const isA = semester === 'A';
  const uacs = isA
    ? [
        { name: 'Pensamiento Matemático I', sem: 1, progPrefix: 'Propósito Formativo' },
        { name: 'Lengua y Comunicación I', sem: 1, progPrefix: 'Propósito Formativo' },
        { name: 'Ciencias Naturales, Experimentales y Tecnología I', sem: 1, progPrefix: 'Propósito Formativo' },
        { name: 'Ciencias Sociales I', sem: 1, progPrefix: 'Propósito Formativo' },
        { name: 'Pensamiento Matemático III', sem: 3, progPrefix: 'Propósito Formativo' },
        { name: 'Conciencia Histórica II', sem: 5, progPrefix: 'Progresión' },
      ]
    : [
        { name: 'Pensamiento Matemático II', sem: 2, progPrefix: 'Propósito Formativo' },
        { name: 'Lengua y Comunicación II', sem: 2, progPrefix: 'Propósito Formativo' },
        { name: 'Ciencias Naturales, Experimentales y Tecnología II', sem: 2, progPrefix: 'Propósito Formativo' },
        { name: 'Ciencias Sociales II', sem: 2, progPrefix: 'Propósito Formativo' },
        { name: 'Conciencia Histórica I', sem: 4, progPrefix: 'Propósito Formativo' },
        { name: 'Conciencia Histórica III', sem: 6, progPrefix: 'Progresión' },
      ];

  const phases = [
    { wStart: 1, wEnd: 5, label: 'Fase 1: Sensibilización y Diagnóstico Situado' },
    { wStart: 6, wEnd: 11, label: 'Fase 2: Diseño e Implementación Comunitaria' },
    { wStart: 12, wEnd: 16, label: 'Fase 3: Evaluación, Difusión y Cierre Territorial' },
  ];

  const strategies = [
    'Aprendizaje Basado en Proyectos Comunitarios (ABPC)',
    'Aprendizaje Basado en Problemas (ABP)',
    'Indagación Científica Situada',
    'Estudio de Casos Locales',
    'Aprendizaje Servicio (AS)',
    'Debate Sociohistórico Estructurado',
  ];

  const instruments = [
    'Rúbrica analítica de desempeño comunitario',
    'Lista de cotejo de bitácora de campo',
    'Guía de observación y portafolio de evidencias',
    'Rúbrica holística de producto integrador',
  ];

  const rows: PlanOperativoRow[] = [];
  for (let week = 1; week <= 16; week++) {
    const phaseObj = phases.find((p) => week >= p.wStart && week <= p.wEnd) ?? phases[2];
    const uac = uacs[(week - 1) % uacs.length];
    const num = ((week - 1) % 7) + 1;
    rows.push({
      phase: phaseObj.label,
      uac: uac.name,
      activity:
        week === 16
          ? `Feria Comunitaria de Cierre (${semester}): socialización de resultados hídricos, entrega de informe a autoridades auxiliares de San Miguel Tenango y evaluación participativa del impacto.`
          : `Actividad territorial semana ${week} (${semester}) desde ${uac.name}: levantamiento, análisis de datos locales y elaboración de evidencia aplicada para la conservación del agua comunitaria.`,
      progression: `${uac.progPrefix} ${num}: Aplica saberes disciplinares de ${uac.name} al diagnóstico y solución sustentable del uso del agua en la comunidad escolar.`,
      strategy: strategies[(week - 1) % strategies.length],
      week: `Semana ${week}`,
      responsibles: `Docente titular de ${uac.name} y equipos estudiantiles de ${uac.sem}° semestre`,
      evaluationInstrument: instruments[(week - 1) % instruments.length],
    });
  }
  return rows;
}

const PLAN_A = buildGoldenPaecPlanRows('A');
const PLAN_B = buildGoldenPaecPlanRows('B');

export const GOLDEN_PAEC_PROJECT: PaecProject = {
  id: '00000000-0000-4000-8000-000000000201',
  teacherId: '00000000-0000-4000-8000-000000000001',
  projectName: 'Cuidemos Nuestra Cuenca: Gestión Sostenible del Agua en San Miguel Tenango',
  problemStatement:
    'Escasez estacional de agua potable y contaminación de escurrimientos locales por manejo inadecuado de residuos sólidos en la comunidad de San Miguel Tenango, afectando el bienestar familiar y la higiene escolar.',
  cycleType: 'annual',
  currentStep: 9,
  status: 'completed',
  createdAt: new Date('2026-08-15T12:00:00.000Z'),
  updatedAt: new Date('2026-08-20T12:00:00.000Z'),
  communityContext: {
    location: 'San Miguel Tenango, Zacatlán, Puebla',
    demographics: '2,850 habitantes distribuidos en 5 barrios rurales con alta cohesión comunitaria.',
    economy: 'Agricultura de temporal, cultivo de manzana y comercio regional.',
    traditions: 'Faenas comunitarias mensuales, asambleas ejidales y festividades culturales serranas.',
    security: 'Entorno rural tranquilo con organización vecinal preventiva.',
    environment: 'Microcuenca de bosque de niebla con estrés hídrico en temporada de estiaje (marzo-mayo).',
  },
  schoolContext: {
    cct: '21EBH0999Z',
    schoolName: 'Bachillerato General Oficial "Sierra Norte Modelo"',
    municipality: 'Zacatlán',
    locality: 'San Miguel Tenango',
    schoolZone: '086',
    enrollment: '145 estudiantes',
    teacherCount: '6 docentes',
    indicators: 'Aprobación 85.5%, Reprobación 9.2%, Abandono 5.0%, Eficiencia Terminal 91.0%.',
    previousPrograms: 'Jornadas de reforestación escolar y separación básica de residuos.',
    facilities: '6 aulas, 1 laboratorio de ciencias, cisterna de 10,000 litros y plaza cívica.',
    schoolType: 'general',
  },
  fase1Diagnostico: {
    tabla1: [
      { col1: 'Ubicación y población', col2: 'San Miguel Tenango, Zacatlán, con 2,850 habitantes y 5 barrios rurales.' },
      { col1: 'Problemática hídrica', col2: 'Disminución del 35% en caudal durante marzo-mayo y 2 puntos críticos de arrastre de residuos.' },
      { col1: 'Actores aliados', col2: 'Presidencia Auxiliar, Comité de Agua Potable y 3 escuelas básicas de la localidad.' },
    ],
    tabla2: [
      { col1: 'Matrícula y planta', col2: '145 estudiantes en 6 grupos atendidos por 6 profesionales de educación media superior.' },
      { col1: 'Infraestructura hídrica', col2: 'Cisterna de 10,000 L con potencial para instalar captación pluvial en 220 m² de techumbre.' },
      { col1: 'Desempeño escolar', col2: 'Aprobación de 85.5% con oportunidad de contextualizar matemáticas y ciencias al entorno.' },
    ],
    tabla3: [
      { aspect: 'Fortalezas', analysis: 'Colectivo docente articulado en CTE, laboratorio funcional y cultura previa de faenas comunitarias.' },
      { aspect: 'Oportunidades', analysis: 'Disposición del Comité de Agua Potable y del Instituto Tecnológico local para asesoría técnica.' },
      { aspect: 'Debilidades', analysis: 'Ausencia de registro sistemático de consumo escolar de agua y de filtros caseros demostrativos.' },
      { aspect: 'Amenazas', analysis: 'Prolongación de estiaje regional y tiraderos informales en barrancas colindantes.' },
      { aspect: 'Estrategias FO/DO/FA/DA', analysis: 'FO: Vincular laboratorio y Tecnológico para monitoreo hídrico. DO: Instalar medición escolar con apoyo vecinal. FA: Campañas preventivas antes de marzo. DA: Protocolo de ahorro y reforestación comunitaria.' },
    ],
    tabla4: [
      { col1: 'Etapa 1: Consulta', col2: 'Aplicación de 80 encuestas domiciliarias y recorrido diagnóstico por la microcuenca.' },
      { col1: 'Etapa 2: Priorización', col2: 'Asamblea colegiada con matriz de pertinencia que seleccionó la gestión sostenible del agua.' },
    ],
  },
  fase2Justificacion: {
    projectName: 'Cuidemos Nuestra Cuenca: Gestión Sostenible del Agua en San Miguel Tenango',
    introduction:
      'El Proyecto Escolar Comunitario articula los propósitos formativos y progresiones del MCCEMS con la gestión sostenible del agua en San Miguel Tenango, promoviendo aprendizaje situado, corresponsabilidad ambiental y transformación social.',
    pilares: [
      'Identidad y arraigo territorial en la Sierra Norte de Puebla',
      'Responsabilidad ciudadana y cuidado sustentable del agua',
      'Participación comunitaria horizontal entre escuela y familias',
      'Interdisciplinariedad entre recursos sociocognitivos y áreas de conocimiento',
    ],
    proposito: {
      educativo: 'Movilizar saberes matemáticos, científicos, comunicativos e históricos en la solución de problemas hídricos reales.',
      social: 'Sensibilizar a 120 familias de San Miguel Tenango sobre ahorro de agua y manejo responsable de residuos.',
      funcional: 'Implementar un prototipo escolar de captación pluvial y un sistema comunitario de monitoreo de consumo.',
    },
    alcance: {
      metas: [
        'Reducir en 25% el consumo desperdiciado de agua en el plantel durante el ciclo 2026-2027.',
        'Involucrar al 100% de los 145 estudiantes y al menos 120 familias en las jornadas comunitarias.',
        'Instalar 1 sistema piloto de captación pluvial y entregar 1 diagnóstico hídrico comunitario.',
      ],
      participantes: ['145 estudiantes de 1° a 6° semestre', '6 docentes y directora', 'Comité de Padres y Comité de Agua'],
      recursos: ['Laboratorio escolar', 'Instrumentos de medición y encuestas', 'Materiales reciclados y apoyo municipal'],
    },
  },
  fase2Mapeo: [
    { semester: 1, uacName: 'Pensamiento Matemático I', topic: 'Estadística descriptiva de consumo hídrico', linking: 'Tablas y gráficas de consumo escolar y familiar' },
    { semester: 1, uacName: 'Lengua y Comunicación I', topic: 'Textos informativos y campañas comunitarias', linking: 'Redacción de boletines y guiones de sensibilización' },
    { semester: 1, uacName: 'Ciencias Naturales, Experimentales y Tecnología I', topic: 'Propiedades y calidad del agua', linking: 'Pruebas básicas de pH, turbidez y filtración' },
    { semester: 1, uacName: 'Ciencias Sociales I', topic: 'Derecho humano al agua y organización comunitaria', linking: 'Mapeo de actores e instituciones locales' },
    { semester: 3, uacName: 'Pensamiento Matemático III', topic: 'Modelación de captación pluvial', linking: 'Cálculo de áreas de techumbre y volúmenes de almacenamiento' },
    { semester: 5, uacName: 'Conciencia Histórica II', topic: 'Transformación territorial y recursos naturales', linking: 'Memoria histórica del manejo del agua en la región' },
    { semester: 2, uacName: 'Pensamiento Matemático II', topic: 'Proporcionalidad y ahorro doméstico', linking: 'Proyección de ahorros mensuales por hogar' },
    { semester: 2, uacName: 'Lengua y Comunicación II', topic: 'Argumentación y difusión comunitaria', linking: 'Informe ejecutivo y cartel científico para feria' },
    { semester: 2, uacName: 'Ciencias Naturales, Experimentales y Tecnología II', topic: 'Ciclos biogeoquímicos y conservación', linking: 'Evaluación de impacto de reforestación en escurrimientos' },
    { semester: 2, uacName: 'Ciencias Sociales II', topic: 'Políticas públicas locales y sostenibilidad', linking: 'Propuesta ciudadana ante Presidencia Auxiliar' },
    { semester: 4, uacName: 'Conciencia Histórica I', topic: 'Usos tradicionales del territorio', linking: 'Entrevistas a adultos mayores sobre manantiales locales' },
    { semester: 6, uacName: 'Conciencia Histórica III', topic: 'Sustentabilidad contemporánea y ciudadanía', linking: 'Evaluación crítica de acuerdos comunitarios del agua' },
  ],
  fase2Cronograma: [
    { phase: 'Bimestre 1 (Ago-Sep)', objective: 'Diagnóstico participativo', macroActivities: 'Encuestas domiciliarias y medición base de agua', responsibleSubjects: 'Pensamiento Matemático I, Ciencias Sociales I', semesterInvolved: 'Semestre A (1°, 3°, 5°)' },
    { phase: 'Bimestre 2 (Oct-Nov)', objective: 'Diseño técnico comunitario', macroActivities: 'Análisis de calidad de agua y cálculo de captación pluvial', responsibleSubjects: 'Ciencias Naturales I, Pensamiento Matemático III', semesterInvolved: 'Semestre A (1°, 3°, 5°)' },
    { phase: 'Bimestre 3 (Dic-Ene)', objective: 'Socialización de avances Sem A', macroActivities: 'Feria comunitaria de resultados y ajuste operativo', responsibleSubjects: 'Lengua y Comunicación I, Conciencia Histórica II', semesterInvolved: 'Semestre A (1°, 3°, 5°)' },
    { phase: 'Bimestre 4 (Feb-Mar)', objective: 'Implementación piloto Sem B', macroActivities: 'Instalación demostrativa y jornadas de limpieza preventiva', responsibleSubjects: 'Ciencias Naturales II, Pensamiento Matemático II', semesterInvolved: 'Semestre B (2°, 4°, 6°)' },
    { phase: 'Bimestre 5 (Abr-May)', objective: 'Monitoreo en estiaje', macroActivities: 'Seguimiento de ahorro escolar y talleres familiares', responsibleSubjects: 'Ciencias Sociales II, Conciencia Histórica I', semesterInvolved: 'Semestre B (2°, 4°, 6°)' },
    { phase: 'Bimestre 6 (Jun-Jul)', objective: 'Evaluación e informe final', macroActivities: 'Feria anual de rendición de cuentas y entrega de informe', responsibleSubjects: 'Lengua y Comunicación II, Conciencia Histórica III', semesterInvolved: 'Semestre B (2°, 4°, 6°)' },
  ],
  fase2DetalleCurricular: [
    { semester: 1, uacName: 'Pensamiento Matemático I', progressionsOrPurposes: 'Propósito Formativo 1 y 2: Recolecta, organiza e interpreta datos comunitarios de consumo de agua.', projectPhases: 'Fase 1 y Fase 2', curricularJustification: 'Vincula estadística descriptiva con mediciones reales del plantel.' },
    { semester: 1, uacName: 'Ciencias Naturales, Experimentales y Tecnología I', progressionsOrPurposes: 'Propósito Formativo 3: Analiza propiedades fisicoquímicas de mezclas y calidad hídrica.', projectPhases: 'Fase 1 y Fase 2', curricularJustification: 'Permite evaluar turbidez y pH en muestras locales.' },
    { semester: 5, uacName: 'Conciencia Histórica II', progressionsOrPurposes: 'Progresión 4: Analiza procesos sociohistóricos que transforman el territorio y los bienes comunes.', projectPhases: 'Fase 2 y Fase 3', curricularJustification: 'Documenta la evolución histórica del abastecimiento local.' },
  ],
  fase2PlanOperativo: { semestreA: PLAN_A, semestreB: PLAN_B },
  fase3PlanOperativoA: PLAN_A,
  fase3PlanOperativoB: PLAN_B,
  fase3Implementacion: {
    cartaInvitacion: {
      asunto: 'Invitación a instalación del Comité Escolar y Comunitario del PAEC 2026-2027',
      fecha: '2026-08-25',
      destinatarios: 'Madres, padres de familia, Comité de Agua Potable y Presidencia Auxiliar',
      cuerpo: 'Por medio de la presente se invita a participar en la sesión de arranque del Proyecto Escolar Comunitario orientado al cuidado del agua en San Miguel Tenango.',
      fechaReunion: '2026-09-02',
      hora: '10:00 horas',
      lugar: 'Plaza cívica del Bachillerato General Oficial "Sierra Norte Modelo"',
      objetivos: ['Presentar el diagnóstico hídrico comunitario', 'Definir comisiones mixtas de trabajo', 'Calendarizar las jornadas semestrales'],
      firmante: 'Mtra. Elena Morales Castro',
      cargo: 'Directora del Plantel',
    },
    minutaArranque: {
      cct: '21EBH0999Z',
      fecha: '2026-09-02',
      tipoReunion: 'Sesión ordinaria de instalación PAEC',
      acuerdos: [
        { no: 1, acuerdo: 'Integrar comité mixto de monitoreo de consumo escolar', responsable: 'Ing. Carlos Ramírez Vega', fechaLimite: '2026-09-18', estatus: 'Acordado' },
        { no: 2, acuerdo: 'Gestionar asesoría técnica de captación pluvial', responsable: 'Biol. Arturo López Paredes', fechaLimite: '2026-10-05', estatus: 'Acordado' },
      ],
      firmas: [
        { cargo: 'Directora', nombre: 'Mtra. Elena Morales Castro' },
        { cargo: 'Coordinador PAEC', nombre: 'Ing. Carlos Ramírez Vega' },
      ],
    },
    oficiosAliados: [
      { destinatario: 'C. Presidente Auxiliar', cargo: 'Autoridad Local', institucion: 'Presidencia Auxiliar de San Miguel Tenango', asunto: 'Colaboración en jornadas de limpieza y difusión', propuestaColaboracion: 'Facilitar difusión comunitaria y préstamo de herramienta para faenas.' },
      { destinatario: 'Presidente del Comité de Agua', cargo: 'Representante Comunitario', institucion: 'Comité de Agua Potable Local', asunto: 'Acompañamiento técnico en diagnóstico', propuestaColaboracion: 'Compartir datos de estiaje y validar recomendaciones de ahorro.' },
      { destinatario: 'Dirección Académica', cargo: 'Vinculación Superior', institucion: 'Instituto Tecnológico Superior de la Sierra Norte', asunto: 'Asesoría de captación pluvial', propuestaColaboracion: 'Impartir taller técnico a estudiantes de 3° y 5° semestre.' },
    ],
    sesionLanzamiento: {
      fecha: '2026-09-04',
      dinamica: 'Asamblea estudiantil participativa con mapeo de microcuenca',
      participantes: '145 estudiantes y 6 docentes',
      acuerdosEstudiantiles: ['Formar brigadas de monitoreo por grupo', 'Documentar evidencias semanales en bitácora'],
    },
  },
  fase2Anexos: {
    anexo1Minuta: {
      cct: '21EBH0999Z',
      fecha: '2026-09-15',
      tipoReunion: 'Seguimiento mensual de colegiado PAEC',
      acuerdos: [
        { no: 1, acuerdo: 'Validar instrumentos de encuesta hídrica domiciliaria', responsable: 'Lic. Sofía Hernández Cruz', fechaLimite: '2026-09-25', estatus: 'Cumplido' },
      ],
      firmas: [{ cargo: 'Directora', nombre: 'Mtra. Elena Morales Castro' }],
    },
    anexo2Seguimiento: [
      { semana: 'Semana 4', fase: 'Fase 1', uac: 'Pensamiento Matemático I', metaOperativa: 'Encuestar 80 viviendas', evidencia: 'Base de datos y gráficas', avancePorcentaje: 100, semaforo: 'verde' },
      { semana: 'Semana 10', fase: 'Fase 2', uac: 'Ciencias Naturales, Experimentales y Tecnología I', metaOperativa: 'Analizar 6 muestras locales', evidencia: 'Bitácora de laboratorio', avancePorcentaje: 90, semaforo: 'verde' },
    ],
    anexo3ReporteMensual: {
      periodo: 'Septiembre - Octubre 2026',
      resumenEjecutivo: 'Avance conforme a cronograma con alta participación estudiantil y respaldo del Comité de Agua.',
      logros: ['100% de encuestas aplicadas', 'Instalación de brigadas estudiantiles'],
      dificultades: ['Lluvias intensas reprogramaron un recorrido de campo'],
      accionesAjuste: ['Reprogramación en horario matutino con acompañamiento docente'],
    },
    anexo4ImpactoComunidad: {
      titulo: 'Encuesta de Percepción e Impacto Comunitario del Agua',
      tipoAplicacion: 'PRE/POST',
      reactivos: [
        { reactivo: 'El proyecto escolar contribuye a mejorar hábitos de ahorro de agua en mi hogar.', dimension: 'Impacto ambiental' },
        { reactivo: 'La comunicación entre el bachillerato y la comunidad ha sido clara y útil.', dimension: 'Vinculación' },
      ],
      escala: { '1': 'Totalmente en desacuerdo', '2': 'En desacuerdo', '3': 'De acuerdo', '4': 'Totalmente de acuerdo' },
    },
    anexo5AutoevaluacionEstudiantes: {
      titulo: 'Autoevaluación de Aprendizaje Situado Estudiantil',
      tipoAplicacion: 'FINAL',
      reactivos: [
        { reactivo: 'Apliqué contenidos de mis asignaturas para analizar la problemática local del agua.', dimension: 'Aprendizaje situado' },
        { reactivo: 'Participé con responsabilidad en el trabajo colaborativo de mi brigada.', dimension: 'Trabajo colaborativo' },
      ],
      escala: { '1': 'Nunca', '2': 'A veces', '3': 'Casi siempre', '4': 'Siempre' },
    },
    anexo6EvaluacionColegiado: {
      titulo: 'Evaluación Colegiada Docente del PAEC',
      tipoAplicacion: 'FINAL',
      reactivos: [
        { reactivo: 'Las actividades del Plan Operativo se articularon con los cortes de evaluación.', dimension: 'Alineación curricular' },
        { reactivo: 'Los productos integradores evidenciaron aprendizaje significativo.', dimension: 'Pertinencia pedagógica' },
      ],
      escala: { '1': 'Insuficiente', '2': 'Regular', '3': 'Bueno', '4': 'Excelente' },
    },
  },
  fase4Gobernanza: {
    calendario: [
      { tipo: 'Reunión de CTE PAEC', frecuencia: 'Mensual', participantes: 'Directora y 6 docentes', objetivo: 'Evaluar avances y ajustar actividades por corte', evidencia: 'Minuta firmada y lista de asistencia' },
      { tipo: 'Asamblea con Comité Comunitario', frecuencia: 'Bimestral', participantes: 'Comité de Agua, padres y brigadas', objetivo: 'Rendir cuentas y coordinar faenas', evidencia: 'Acta comunitaria y memoria fotográfica' },
    ],
    metodologiaEvaluacion: {
      ambitos: ['Aprendizaje curricular situado', 'Participación estudiantil', 'Impacto comunitario medible', 'Sostenibilidad'],
      preguntasGuiaNem: {
        dondeEstamos: 'Contamos con diagnóstico hídrico cuantificado y participación activa de los 6 grupos.',
        haciaDondeVamos: 'Consolidar el ahorro de 25% de agua escolar y replicar filtros comunitarios.',
        comoSuperamos: 'Mediante acompañamiento colegiado, vinculación con el Tecnológico y evaluación continua.',
      },
    },
  },
  fase4InformeSupervision: {
    resumenEjecutivo:
      'El proyecto PAEC "Cuidemos Nuestra Cuenca" alcanzó las metas programadas en los Semestres A y B con participación de los 145 estudiantes, articulando 12 UAC y generando impacto verificable en el uso responsable del agua en San Miguel Tenango.',
    metasVsLogros: [
      { meta: 'Reducir 25% el desperdicio de agua escolar', indicador: '% de reducción medida en cisterna', programado: '25%', alcanzado: '27%', porcentaje: 100, estatus: 'Cumplido' },
      { meta: 'Involucrar a 120 familias en talleres', indicador: 'Familias participantes', programado: '120', alcanzado: '126', porcentaje: 100, estatus: 'Cumplido' },
    ],
    analisisPrePost: {
      participacionTotal: '145 estudiantes (100%) y 126 familias participantes.',
      alcanceComunitario: '5 barrios rurales de San Miguel Tenango.',
      cambioConocimientos: 'Incremento de 42% en prácticas domésticas de ahorro documentadas.',
      desarrolloCompetencias: 'Fortalecimiento en análisis de datos, indagación experimental y comunicación ciudadana.',
    },
    evidencias: ['Diagnóstico hídrico comunitario', 'Prototipo piloto de captación pluvial', 'Memorias de Ferias Comunitarias A y B'],
    obstaculos: [{ dificultad: 'Lluvias intensas en octubre', solucion: 'Reprogramación de recorridos en bloques matutinos' }],
    sostenibilidad: ['Mantenimiento semestral integrado al PMC', 'Comité estudiantil permanente de cuidado del agua'],
    firmas: {
      responsableInforme: 'Ing. Carlos Ramírez Vega',
      autoridadEscolar: 'Mtra. Elena Morales Castro',
    },
  },
  qualityAudit: null,
};
