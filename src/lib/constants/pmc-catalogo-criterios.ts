/**
 * src/lib/constants/pmc-catalogo-criterios.ts
 *
 * Catálogo Canónico Institucional de Criterios y Ámbitos de Mejora Continua (PMC)
 * para el Bachillerato General Estatal (BGE) en Puebla — Ciclo Escolar 2026-2027.
 *
 * Basado en:
 * - Lineamientos para la Planeación de la Mejora Continua (SEMS / DGB / MCCEMS)
 * - Formato Oficial 5.1 y 5.2 de Planeación de la Mejora Continua
 * - Manual de Lineamientos de Acompañamiento Pedagógico y Vinculación Institucional SEP Puebla
 */

import type { PmcProject, PmcMetaInstitucional, PmcIndicadoresAcademicos, PmcStaffMember } from '@/types/pmc';

export interface CriterioCatalogItem {
  id: string;
  areaObligatoriaId?: 'area-1-indicadores' | 'area-2-desempeno-docente' | 'area-3-vinculacion' | 'area-4-violencia';
  nombre: string;
  categoria: string;
  subcategoria: string;
  descripcion: string;
  enfoque_mccems: string;
  formula_creaa_sugerida: string;
  estrategia_etapas: string[];
  responsable_tipo: string;
  entregable_oficial: string;
  subcategorias_vinculadas: string[];
  diagnostico_justificacion: string;
  criterios_31_41: {
    accion_especifica: string;
    finalidad: string;
    necesidad: string;
    proceso_evaluacion: string;
    estrategias_seguimiento: string;
    observaciones: string;
  };
}

export const CATALOGO_BASE_CRITERIOS_PMC: readonly CriterioCatalogItem[] = [
  // ── 1. ÁREA OBLIGATORIA 1: INDICADORES ACADÉMICOS ───────────────────────────
  {
    id: 'area-1-indicadores',
    areaObligatoriaId: 'area-1-indicadores',
    nombre: 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'INDICADORES ACADÉMICOS',
    descripcion: 'Monitoreo, regularización y fortalecimiento de los índices de aprobación, retención y aprovechamiento escolar.',
    enfoque_mccems: 'Articulación de los recursos sociocognitivos (Pensamiento Matemático, Lengua y Comunicación, Conciencia Histórica, Cultura Digital) para abatir el rezago escolar temprano.',
    formula_creaa_sugerida: 'Incrementar en un {META_APROBACION_INCREMENTO}% la tasa de aprobación escolar en los {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO}, implementando asesorías académicas focalizadas y círculos de nivelación en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico inicial EDIEMS y ESA del 31 de agosto al 4 de septiembre de 2026 para identificar aprendientes en riesgo de reprobación.',
      '2. Implementación de asesorías disciplinares sabatinas y vespertinas para asignaturas críticas con corte de seguimiento post-test del 30 de noviembre al 4 de diciembre de 2026.',
      '3. Evaluación formativa continua y jornadas de nivelación intersemestral con corte de avance del 8 al 12 de marzo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Colegiado Docente de Recursos Sociocognitivos',
    entregable_oficial: 'Reporte semestral de seguimiento estadístico F11C, listas de asistencia a asesorías académicas y concentrado de evaluación diagnóstica',
    subcategorias_vinculadas: ['INDICADORES ACADÉMICOS', 'TRABAJO COLEGIADO', 'ORIENTACIÓN Y TUTORÍA'],
    diagnostico_justificacion: 'Atender la tasa de reprobación detectada en los cortes de control escolar del ciclo previo ({REPROBACION}% reprobación inicial). Se evidencia rezago en Pensamiento Matemático y Lengua y Comunicación en la matrícula de {MATRICULA} estudiantes.',
    criterios_31_41: {
      accion_especifica: 'Despliegue de círculos de estudio guiados y tutorías académicas disciplinares focalizadas.',
      finalidad: 'Elevar la acreditación escolar y garantizar la permanencia de aprendientes con barreras de aprendizaje.',
      necesidad: 'Disminuir los índices de rezago en asignaturas sociocognitivas fundamentales detectados en F11C.',
      proceso_evaluacion: 'Cortes bimestrales en sesiones de CTE mediante listas de cotejo de evidencias y pruebas diagnósticas.',
      estrategias_seguimiento: 'Monitoreo quincenal del libro de calificaciones y alertas tempranas en semanas 6 y 12.',
      observaciones: 'Coordinación estrecha con tutores de grupo y padres de familia de estudiantes en riesgo.',
    },
  },

  // ── 2. ÁREA OBLIGATORIA 2: SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA ─────────
  {
    id: 'area-2-desempeno-docente',
    areaObligatoriaId: 'area-2-desempeno-docente',
    nombre: 'Seguimiento al desempeño docente en el aula',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA',
    descripcion: 'Acompañamiento técnico-pedagógico directivo no punitivo, observación reflexiva de clases y retroalimentación formativa de la práctica docente.',
    enfoque_mccems: 'Verificación del trabajo por progresiones de aprendizaje, transversalidad curricular y aplicación de la evaluación formativa auténtica en el aula.',
    formula_creaa_sugerida: 'Realizar el acompañamiento pedagógico y seguimiento al desempeño docente en el aula al 100% de la plantilla ({TOTAL_DOCENTES} docentes) del {ESCUELA} durante el ciclo escolar {CICLO}, aplicando al menos 2 visitas de observación formativa por semestre bajo el enfoque del MCCEMS en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Socialización de la rúbrica institucional de observación formativa y cronograma concertado de visitas áulicas durante la sesión de CTE de septiembre de 2026.',
      '2. Ejecución del primer ciclo de observación en aula y sesiones individuales de retroalimentación pedagógica y codiseño (octubre-noviembre 2026).',
      '3. Desarrollo del segundo ciclo de acompañamiento áulico y taller colegiado de sistematización de buenas prácticas de evaluación formativa (marzo-mayo 2027).',
    ],
    responsable_tipo: '{DIRECTOR} (Director del Plantel) y Consejo Técnico Académico (Presidentes de Academia)',
    entregable_oficial: 'Expediente institucional con instrumentos de observación áulica formativa firmados, bitácora de acuerdos de mejora pedagógica y reporte semestral de seguimiento directivo',
    subcategorias_vinculadas: ['SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA', 'TRABAJO COLEGIADO', 'FORMACIÓN Y ACTUALIZACIÓN DOCENTE', 'PLANEACIÓN DIDÁCTICA'],
    diagnostico_justificacion: 'La adopción del Marco Curricular Común de la EMS requiere consolidar el tránsito de la enseñanza tradicional al enfoque de progresiones y evaluación formativa. En el ciclo previo se careció de un cronograma formal de visitas y retroalimentación sistemática para los {TOTAL_DOCENTES} docentes del plantel.',
    criterios_31_41: {
      accion_especifica: 'Visitas planificadas de acompañamiento en aula con retroalimentación dialógica reflexiva posterior.',
      finalidad: 'Fortalecer las competencias didácticas docentes para la mediación pedagógica situada y el uso de progresiones.',
      necesidad: 'Garantizar que la planeación didáctica se traslade eficazmente a ambientes de aprendizaje activos y formativos.',
      proceso_evaluacion: 'Rúbrica oficial de observación de práctica pedagógica y portafolio de evidencias de clase.',
      estrategias_seguimiento: 'Cortes semestrales de balance en Consejo Técnico Escolar y minutas de diálogo profesional.',
      observaciones: 'El proceso es estrictamente formativo y orientador, excluyendo cualquier sentido punitivo o laboral.',
    },
  },

  // ── 3. ÁREA OBLIGATORIA 3: VINCULACIÓN CON CENTROS EDUCATIVOS Y EMPRESAS ──────
  {
    id: 'area-3-vinculacion',
    areaObligatoriaId: 'area-3-vinculacion',
    nombre: 'Vinculación con centros educativos, empresas, fundaciones o instituciones públicas',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS',
    descripcion: 'Articulación interinstitucional con secundarias alimentadoras, centros de educación superior, sectores productivos y dependencias gubernamentales.',
    enfoque_mccems: 'Apertura de la escuela a la comunidad para captación de aprendientes, orientación vocacional superior y proyectos formativos de impacto social (PEC/PAEC).',
    formula_creaa_sugerida: 'Establecer y consolidar el 100% de {NUM_CONVENIOS} acuerdos de vinculación estratégica (con secundarias alimentadoras, instituciones de educación superior de la región y sector productivo o DIF municipal) para el {ESCUELA} durante el ciclo escolar {CICLO}, impulsando la captación de matrícula y la orientación vocacional en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Jornada de acercamiento y firma de convenios de colaboración con secundarias y telesecundarias alimentadoras de la zona (octubre-noviembre 2026) para difusión de la oferta educativa hacia la captación de nuevo ingreso.',
      '2. Organización de la Feria Vocacional y visitas guiadas con institutos tecnológicos y universidades regionales (febrero-marzo 2027) para orientación de aprendientes de 4° y 6° semestre.',
      '3. Coordinación de brigadas de servicio comunitario y proyectos PAEC con el DIF municipal, dependencias públicas y comercios locales (enero-mayo 2027).',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité Escolar de Vinculación y Proyectos Comunitarios ({RESPONSABLE_VINCULACION})',
    entregable_oficial: 'Carpeta de convenios y cartas compromiso interinstitucionales vigentes, bitácora de la jornada profesiográfica y memoria de actividades conjuntas con listas de participación',
    subcategorias_vinculadas: ['VINCULACIÓN CON INSTITUCIONES EDUCATIVAS', 'VINCULACIÓN CON EMPRESAS, FUNDACIONES E INSTITUCIONES PÚBLICAS', 'PROYECTO ESCOLAR COMUNITARIO (PEC)', 'ORIENTACIÓN EDUCATIVA'],
    diagnostico_justificacion: 'El plantel requiere asegurar la captación de estudiantes provenientes de secundarias de la microrregión y vincular a los egresados con opciones de educación superior y proyectos comunitarios de impacto real en {LOCALIDAD}, mitigando el aislamiento institucional.',
    criterios_31_41: {
      accion_especifica: 'Formalización de convenios marco de colaboración educativa y vinculación productiva-social.',
      finalidad: 'Ampliar las oportunidades formativas, de servicio social y de continuidad universitaria para el alumnado.',
      necesidad: 'Fortalecer el flujo de nuevo ingreso escolar y orientar con certidumbre el egreso hacia el nivel superior.',
      proceso_evaluacion: 'Matriz semestral de seguimiento al cumplimiento de compromisos y encuestas de satisfacción estudiantil.',
      estrategias_seguimiento: 'Revisiones bimestrales de avance en los convenios y validación ante la Supervisión Escolar.',
      observaciones: 'Involucrar activamente a la Sociedad de Padres de Familia y autoridades locales en las gestiones.',
    },
  },

  // ── 4. ÁREA OBLIGATORIA 4: ESTRATEGIAS SOBRE VIOLENCIA ESCOLAR ────────────────
  {
    id: 'area-4-violencia',
    areaObligatoriaId: 'area-4-violencia',
    nombre: 'Estrategias, programas y/o proyectos sobre violencia',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    subcategoria: 'PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA',
    descripcion: 'Implementación de protocolos institucionales de prevención, atención y erradicación de la violencia, fomento de la cultura de paz y resolución no violenta de conflictos.',
    enfoque_mccems: 'Desarrollo de los Ámbitos de Formación Socioemocional (Currículum Ampliado: Práctica y colaboración ciudadana, Educación para la salud, Integridad y Cultura de paz).',
    formula_creaa_sugerida: 'Implementar el 100% de las acciones del Protocolo de Convivencia Pacífica y Prevención de la Violencia en la matrícula de {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO}, mediante jornadas de mediación escolar y talleres socioemocionales en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Difusión de protocolos de seguridad escolar y conformación del Comité de Paz y Mediación Escolar en septiembre de 2026.',
      '2. Talleres bimestrales de habilidades socioemocionales, prevención del acoso escolar y uso responsable de redes sociales (octubre 2026 - febrero 2027).',
      '3. Jornadas de convivencia escolar armónica y foro estudiantil sobre derechos humanos e inclusión en abril y mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité de Convivencia Escolar / Tutor del Plantel ({RESPONSABLE_TUTORIA})',
    entregable_oficial: 'Protocolo de convivencia escolar adaptado y firmado, bitácora de mediación de conflictos y relatorías de talleres con listas de asistencia',
    subcategorias_vinculadas: ['PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA', 'ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)', 'ORIENTACIÓN Y TUTORÍA'],
    diagnostico_justificacion: 'Salvaguardar la integridad física, psicológica y emocional de los {MATRICULA} aprendientes, previniendo conductas de riesgo, acoso cibernético o violencia interpersonal mediante un clima de respeto y empatía.',
    criterios_31_41: {
      accion_especifica: 'Instalación de buzones de convivencia pacífica, círculos restaurativos y talleres de habilidades para la vida.',
      finalidad: 'Consolidar un entorno seguro, inclusivo y propicio para el aprendizaje colaborativo libre de violencia.',
      necesidad: 'Prevenir factores de riesgo psicosocial que afecten la permanencia escolar y el bienestar estudiantil.',
      proceso_evaluacion: 'Encuestas de clima escolar semestrales y registro estadístico de incidencias atendidas.',
      estrategias_seguimiento: 'Cortes mensuales del Comité de Seguridad y Convivencia Escolar reportados al CTE.',
      observaciones: 'Canalización oportuna a instancias especializadas (DIF, Centros de Salud) cuando el caso lo amerite.',
    },
  },

  // ── 5. TEMAS INSTITUCIONALES ADICIONALES ────────────────────────────────────
  {
    id: 'tema-infraestructura-recursos',
    nombre: 'Gestión y administración de recursos, equipamiento y servicios',
    categoria: 'Gestión y administración escolar',
    subcategoria: 'GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS',
    descripcion: 'Mantenimiento preventivo y correctivo de aulas, sanitarios, áreas comunes y equipamiento de tecnologías de la información.',
    enfoque_mccems: 'Dignificación de los espacios escolares para asegurar ambientes formativos confortables, seguros y saludables.',
    formula_creaa_sugerida: 'Gestionar y ejecutar el mantenimiento correctivo y preventivo del 100% de los espacios educativos y mobiliario del {ESCUELA} durante el ciclo escolar {CICLO}, mediante la coordinación con el Comité de Padres de Familia y autoridades locales en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Levantamiento de inventario físico y diagnóstico de necesidades de infraestructura en septiembre de 2026.',
      '2. Gestión de recursos y materiales ante instancias municipales y comités comunitarios (octubre 2026 - enero 2027).',
      '3. Jornadas comunitarias de mantenimiento escolar y faenas en periodos intersemestrales (enero y junio de 2027).',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité de Infraestructura Escolar',
    entregable_oficial: 'Inventario físico actualizado, actas de entrega-recepción de mantenimiento escolar y bitácora fotográfica de obras concluidas',
    subcategorias_vinculadas: ['GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS', 'PROYECTO ESCOLAR COMUNITARIO (PEC)'],
    diagnostico_justificacion: 'La infraestructura del plantel requiere mantenimiento constante en techumbres, sanitarios e instalaciones eléctricas para salvaguardar la seguridad de los {MATRICULA} estudiantes y del personal docente.',
    criterios_31_41: {
      accion_especifica: 'Faenas comunitarias de rehabilitación de pintura, impermeabilización y optimización de conectividad.',
      finalidad: 'Ofrecer instalaciones dignas, seguras y funcionales que favorezcan el desarrollo de las actividades académicas.',
      necesidad: 'Subsanar el desgaste natural del inmueble escolar y garantizar servicios básicos continuos.',
      proceso_evaluacion: 'Lista de verificación de condiciones físicas de seguridad e higiene escolar.',
      estrategias_seguimiento: 'Cortes trimestrales de avance en asambleas de padres de familia y comités escolares.',
      observaciones: 'Priorizar la adquisición de insumos con proveedores locales para apoyar la economía de la comunidad.',
    },
  },
  {
    id: 'tema-pec-comunitario',
    nombre: 'Proyecto Escolar Comunitario (PEC)',
    categoria: 'Desarrollo académico y aprendizaje',
    subcategoria: 'PROYECTO ESCOLAR COMUNITARIO (PEC)',
    descripcion: 'Desarrollo de proyectos formativos integradores vinculados a la transformación socioecológica y cultural de la comunidad.',
    enfoque_mccems: 'Articulación de los saberes áulicos con las problemáticas reales del entorno bajo la metodología de la Nueva Escuela Mexicana.',
    formula_creaa_sugerida: 'Diseñar e instrumentar el 100% de 1 Proyecto Escolar Comunitario (PEC) transversal con la participación de los {MATRICULA} aprendientes del {ESCUELA} durante el ciclo escolar {CICLO}, impactando favorablemente en la comunidad de {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico comunitario participativo con aprendientes y actores locales durante septiembre de 2026.',
      '2. Integración de progresiones interdisciplinares en las planeaciones docentes para el desarrollo del proyecto (octubre 2026 - marzo 2027).',
      '3. Muestra comunitaria y exposición pública de resultados del PEC en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director), Coordinador del PEC y Colectivo Docente',
    entregable_oficial: 'Documento rector del Proyecto Escolar Comunitario, bitácoras de campo y memoria gráfica de la muestra comunitaria',
    subcategorias_vinculadas: ['PROYECTO ESCOLAR COMUNITARIO (PEC)', 'PROPUESTAS PEDAGÓGICAS', 'TRABAJO COLEGIADO'],
    diagnostico_justificacion: 'Fomentar el sentido de pertenencia y compromiso social en el estudiantado, vinculando la teoría curricular con la solución de necesidades de la localidad.',
    criterios_31_41: {
      accion_especifica: 'Implementación de huertos escolares sustentables o campañas de reforestación y saneamiento local.',
      finalidad: 'Generar aprendizaje situado y compromiso cívico en el marco de la Nueva Escuela Mexicana.',
      necesidad: 'Superar la desvinculación histórica entre el conocimiento escolar y los desafíos territoriales de la comunidad.',
      proceso_evaluacion: 'Rúbrica de evaluación de proyectos socioformativos y coevaluación comunitaria.',
      estrategias_seguimiento: 'Monitoreo en sesiones ordinarias de Consejo Técnico Escolar.',
      observaciones: 'Coordinación con autoridades auxiliares y comités de barrio para asegurar la viabilidad.',
    },
  },
] as const;

/**
 * Función de síntesis dinámica: toma un criterio/área y los datos reales del plantel,
 * produciendo una meta institucional contextualizada, rigurosa y libre de placeholders genéricos.
 */
export function synthesizeContextualizedMeta(
  criterioIdOrTema: string,
  project?: Partial<PmcProject> | null
): PmcMetaInstitucional {
  const normTema = (criterioIdOrTema || '').trim().toLowerCase();

  // Buscar en el catálogo canónico por id o por coincidencia léxica
  const item = CATALOGO_BASE_CRITERIOS_PMC.find(c => {
    if (c.id.toLowerCase() === normTema) return true;
    if (c.areaObligatoriaId && normTema.includes(c.areaObligatoriaId.toLowerCase())) return true;
    if (c.nombre.toLowerCase().includes(normTema)) return true;
    if (normTema.includes(c.nombre.toLowerCase())) return true;
    return false;
  }) || CATALOGO_BASE_CRITERIOS_PMC[0];

  // Resolver variables del plantel
  const escuela = (project?.school_name || 'Bachillerato General Oficial').replace(/"/g, '“');
  const localidad = project?.locality || 'la localidad';
  const municipio = project?.municipality || 'el municipio';
  const ciclo = project?.ciclo_escolar || '2026-2027';
  const director = project?.director_name || 'Director del Plantel';

  const staff = Array.isArray(project?.staff_data) ? (project.staff_data as PmcStaffMember[]) : [];
  const totalDocentes = staff.length > 0 ? staff.length : 14;

  const indic = (project?.indicadores_academicos as PmcIndicadoresAcademicos) || {};
  const matricula = indic.matricula || 170;
  const reprobacion = indic.reprobacion_ant !== undefined ? indic.reprobacion_ant : 15;
  const metaInc = Math.max(3, Math.min(8, Math.round(reprobacion * 0.4) || 5));

  // Asignar personal docente real si está disponible
  const primerDocente = staff.find(s => s?.nombre && s?.nombre !== director)?.nombre || 'Colectivo Docente';
  const orientador = staff.find(s => /orienta|tutor|psic/i.test(`${s?.cargo || ''} ${s?.funcion || ''}`))?.nombre || 'Tutor del Plantel';

  const replacePlaceholders = (text: string): string => {
    return text
      .replace(/{ESCUELA}/g, escuela)
      .replace(/{LOCALIDAD}/g, localidad)
      .replace(/{MUNICIPIO}/g, municipio)
      .replace(/{CICLO}/g, ciclo)
      .replace(/{DIRECTOR}/g, director)
      .replace(/{TOTAL_DOCENTES}/g, String(totalDocentes))
      .replace(/{MATRICULA}/g, String(matricula))
      .replace(/{REPROBACION}/g, String(reprobacion))
      .replace(/{META_APROBACION_INCREMENTO}/g, String(metaInc))
      .replace(/{NUM_CONVENIOS}/g, '4')
      .replace(/{RESPONSABLE_VINCULACION}/g, primerDocente)
      .replace(/{RESPONSABLE_TUTORIA}/g, orientador);
  };

  const metaFinal = replacePlaceholders(item.formula_creaa_sugerida);
  const estrategiaFinal = item.estrategia_etapas.map(replacePlaceholders).join(' ');
  const personalFinal = replacePlaceholders(item.responsable_tipo);
  const justificacionFinal = replacePlaceholders(item.diagnostico_justificacion);

  return {
    categoria: item.categoria === 'Desarrollo académico y aprendizaje' ? '1' : item.categoria === 'Gestión y administración escolar' ? '2' : '3',
    nombre_categoria: item.categoria,
    tema: item.nombre,
    meta: metaFinal,
    estrategia: estrategiaFinal,
    linea_base: `Línea base institucional ciclo anterior: Matrícula ${matricula} estudiantes en ${localidad}, Puebla.`,
    personal_designado: personalFinal,
    entregable: item.entregable_oficial,
    periodo_inicio: '08/2026',
    periodo_fin: '06/2027',
    diagnostico_meta: justificacionFinal,
    necesidad: replacePlaceholders(item.criterios_31_41.necesidad),
    accion_especifica: replacePlaceholders(item.criterios_31_41.accion_especifica),
    finalidad: replacePlaceholders(item.criterios_31_41.finalidad),
    proceso_evaluacion: replacePlaceholders(item.criterios_31_41.proceso_evaluacion),
    subcategorias_vinculadas: [...item.subcategorias_vinculadas],
    estrategias_seguimiento: replacePlaceholders(item.criterios_31_41.estrategias_seguimiento),
    observaciones: replacePlaceholders(item.criterios_31_41.observaciones),
  };
}
