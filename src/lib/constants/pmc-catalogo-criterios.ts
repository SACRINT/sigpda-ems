/**
 * src/lib/constants/pmc-catalogo-criterios.ts
 *
 * Catálogo Canónico Institucional de Criterios y Ámbitos de Mejora Continua (PMC)
 * para el Bachillerato General Estatal (BGE) en Puebla — Ciclo Escolar 2026-2027.
 *
 * Cobertura Completa de los 18 Temas Oficiales en las 3 Categorías Canónicas:
 * (Lineamientos para la Planeación de la Mejora Continua en Educación Media Superior, SEP/SEMS/DGB/MCCEMS)
 * - Categoría 1: Desarrollo académico y aprendizaje (10 temas)
 * - Categoría 2: Gestión y administración escolar (5 temas)
 * - Categoría 3: Desarrollo socioemocional y prevención de la violencia en la escuela (3 temas)
 */

import type { PmcProject, PmcMetaInstitucional, PmcIndicadoresAcademicos, PmcStaffMember } from '@/types/pmc';

export interface CriterioCatalogItem {
  id: string;
  areaObligatoriaId?: 'area-1-indicadores' | 'area-2-desempeno-docente' | 'area-3-vinculacion' | 'area-4-violencia';
  nombre: string;
  categoria: 'Desarrollo académico y aprendizaje' | 'Gestión y administración escolar' | 'Desarrollo socioemocional y prevención de la violencia en la escuela';
  categoriaNumero: '1' | '2' | '3';
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
  // ══════════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 1: DESARROLLO ACADÉMICO Y APRENDIZAJE (10 TEMAS OFICIALES)
  // ══════════════════════════════════════════════════════════════════════════════

  // 1.1 Formación y actualización docente
  {
    id: 'cat1-formacion-actualizacion-docente',
    nombre: 'Formación y actualización docente',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'FORMACIÓN Y ACTUALIZACIÓN DOCENTE',
    descripcion: 'Capacitación continua y situada en progresiones de aprendizaje, metodologías sociocríticas y evaluación formativa.',
    enfoque_mccems: 'Apropiación del enfoque pedagógico de la NEM, transversalidad curricular y diseño de instrumentos formativos.',
    formula_creaa_sugerida: 'Capacitar y actualizar al 100% de la plantilla ({TOTAL_DOCENTES} docentes) del {ESCUELA} durante el ciclo escolar {CICLO}, mediante la participación en talleres colegiados y cursos sobre progresiones del MCCEMS en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico de necesidades de formación pedagógica e inscripción a trayectos formativos de COSFAC en septiembre de 2026.',
      '2. Desarrollo de microtalleres colegiados de réplica en sesiones de CTE sobre evaluación formativa y secuencias didácticas (noviembre 2026 - marzo 2027).',
      '3. Coloquio interno de intercambio de experiencias docentes y sistematización de evidencias de aula en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Consejo Técnico Académico (Presidentes de Academia)',
    entregable_oficial: 'Constancias de cursos de actualización docente, minutas de réplica colegiada en CTE y portafolio de evidencias de aplicación áulica',
    subcategorias_vinculadas: ['FORMACIÓN Y ACTUALIZACIÓN DOCENTE', 'TRABAJO COLEGIADO', 'PROPUESTAS PEDAGÓGICAS'],
    diagnostico_justificacion: 'La consolidación del MCCEMS exige actualizar las prácticas docentes tradicionales hacia el diseño de situaciones de aprendizaje contextualizadas, fortaleciendo el dominio de progresiones de los {TOTAL_DOCENTES} docentes del plantel.',
    criterios_31_41: {
      accion_especifica: 'Participación en cursos oficiales de actualización docente y círculos de estudio entre pares.',
      finalidad: 'Elevar la pertinencia didáctica y la calidad de la mediación pedagógica en el aula.',
      necesidad: 'Armonizar los criterios de planeación y evaluación formativa entre todas las áreas de conocimiento.',
      proceso_evaluacion: 'Rúbrica de evaluación de secuencias didácticas y constancias con valor curricular.',
      estrategias_seguimiento: 'Revisión bimestral de avances en la acreditación de trayectos formativos en CTE.',
      observaciones: 'Aprovechar las ofertas formativas institucionales gratuitas promovidas por la SEP Puebla y COSFAC.',
    },
  },

  // 1.2 Propuestas pedagógicas
  {
    id: 'cat1-propuestas-pedagogicas',
    nombre: 'Propuestas pedagógicas',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'PROPUESTAS PEDAGÓGICAS',
    descripcion: 'Innovación metodológica a través de proyectos formativos interdisciplinares, Aprendizaje Basado en Proyectos (ABP) y enfoque STEAM.',
    enfoque_mccems: 'Articulación activa entre los recursos sociocognitivos y las áreas de conocimiento mediante problemáticas contextualizadas.',
    formula_creaa_sugerida: 'Diseñar e instrumentar al menos 2 propuestas pedagógicas transversales e interdisciplinares por semestre en las academias del {ESCUELA} durante el ciclo escolar {CICLO}, impactando en los {MATRICULA} aprendientes en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Codiseño interdisciplinar de proyectos formativos integradores durante la fase intensiva de CTE de septiembre de 2026.',
      '2. Implementación áulica de metodologías sociocríticas orientadas a la solución de retos comunitarios (octubre 2026 - marzo 2027).',
      '3. Jornada de exposición de productos de aprendizaje auténticos y evaluación formativa interdisciplinar en enero y junio de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Colegiado Docente de Academias Disciplinares',
    entregable_oficial: 'Portafolio de propuestas didácticas transversales validadas, rúbricas de evaluación interdisciplinar y muestras de productos estudiantiles',
    subcategorias_vinculadas: ['PROPUESTAS PEDAGÓGICAS', 'TRABAJO COLEGIADO', 'PLANEACIÓN DIDÁCTICA'],
    diagnostico_justificacion: 'Superar la fragmentación de asignaturas y fomentar el aprendizaje situado en la matrícula de {MATRICULA} estudiantes, vinculando los contenidos escolares con la realidad productiva y social de {LOCALIDAD}.',
    criterios_31_41: {
      accion_especifica: 'Diseño de secuencias didácticas integradoras entre áreas sociocognitivas y áreas de conocimiento.',
      finalidad: 'Desarrollar el pensamiento complejo y la aplicación práctica del conocimiento en situaciones reales.',
      necesidad: 'Incrementar la motivación y el aprovechamiento escolar mediante experiencias formativas significativas.',
      proceso_evaluacion: 'Evaluación colegiada de proyectos con rúbricas analíticas y matrices de valoración auténtica.',
      estrategias_seguimiento: 'Cortes semestrales en Consejo Técnico Escolar para ajustar la articulación curricular.',
      observaciones: 'Fomentar la coevaluación entre aprendientes para reforzar la metacognición.',
    },
  },

  // 1.3 Trabajo colegiado
  {
    id: 'cat1-trabajo-colegiado',
    nombre: 'Trabajo colegiado',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'TRABAJO COLEGIADO',
    descripcion: 'Espacios de diálogo profesional reflexivo entre docentes y directivos para la toma de decisiones pedagógicas y académicas.',
    enfoque_mccems: 'Funcionamiento coordinado de academias disciplinares y Consejo Técnico Escolar para el seguimiento de metas CREAA.',
    formula_creaa_sugerida: 'Consolidar el 100% de las 8 sesiones ordinarias de trabajo colegiado y academias en el {ESCUELA} durante el ciclo escolar {CICLO}, para dar seguimiento a progresiones de aprendizaje y nivelación de aprendientes en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Instalación formal de las academias por campo de conocimiento y calendario de sesiones ordinarias en septiembre de 2026.',
      '2. Análisis colegiado de resultados de evaluaciones diagnósticas y cortes bimestrales de reprobación F11C (noviembre 2026 - marzo 2027).',
      '3. Evaluación anual del plan de mejora académica y presentación de acuerdos de continuidad para el siguiente ciclo en junio de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Presidentes de Academia Disciplinar',
    entregable_oficial: 'Actas y minutas oficiales de reuniones colegiadas de academia y CTE con concentrado de acuerdos de intervención pedagógica',
    subcategorias_vinculadas: ['TRABAJO COLEGIADO', 'FORMACIÓN Y ACTUALIZACIÓN DOCENTE', 'INDICADORES ACADÉMICOS'],
    diagnostico_justificacion: 'Asegurar la toma de acuerdos colegiados estructurados ante los índices de reprobación ({REPROBACION}%) detectados en el ciclo anterior, unificando criterios pedagógicos de los {TOTAL_DOCENTES} integrantes del personal docente.',
    criterios_31_41: {
      accion_especifica: 'Reuniones mensuales de academia disciplinar y sesiones de Consejo Técnico Escolar.',
      finalidad: 'Homologar criterios de evaluación, dosificación curricular y atención a la diversidad del aula.',
      necesidad: 'Garantizar el trabajo coordinado de la planta docente en torno a metas académicas comunes.',
      proceso_evaluacion: 'Lista de cotejo de cumplimiento de acuerdos colegiados y minutas de seguimiento.',
      estrategias_seguimiento: 'Seguimiento quincenal a la ejecución de compromisos asumidos en el seno del CTE.',
      observaciones: 'Garantizar la participación equitativa de todos los docentes frente a grupo.',
    },
  },

  // 1.4 Proyecto Escolar Comunitario (PEC)
  {
    id: 'cat1-proyecto-escolar-comunitario',
    nombre: 'Proyecto Escolar Comunitario (PEC)',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'PROYECTO ESCOLAR COMUNITARIO (PEC)',
    descripcion: 'Articulación pedagógica integral entre el aula, la escuela y la comunidad para incidir en problemas del entorno territorial.',
    enfoque_mccems: 'Metodología PAEC/PEC con participación activa de aprendientes, docentes, familias y autoridades locales.',
    formula_creaa_sugerida: 'Diseñar e instrumentar el 100% de 1 Proyecto Escolar Comunitario (PEC) transversal con los {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO}, impactando positivamente en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico participativo con la comunidad escolar y selección de la problemática comunitaria eje en septiembre de 2026.',
      '2. Integración de metas curriculares de las asignaturas con las actividades de campo del proyecto (octubre 2026 - abril 2027).',
      '3. Muestra comunitaria abierta con presentación de resultados y rendición de cuentas a la comunidad en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director), Coordinador del PEC ({RESPONSABLE_VINCULACION}) y Colectivo Docente',
    entregable_oficial: 'Documento rector del Proyecto Escolar Comunitario, bitácora de campo, informe de impacto social y memoria fotográfica validada',
    subcategorias_vinculadas: ['PROYECTO ESCOLAR COMUNITARIO (PEC)', 'PROPUESTAS PEDAGÓGICAS', 'TRABAJO COLEGIADO'],
    diagnostico_justificacion: 'Fomentar la responsabilidad social y el sentido de identidad de los {MATRICULA} aprendientes, vinculando la teoría científica y humanística con la solución de necesidades reales de la población de {LOCALIDAD}.',
    criterios_31_41: {
      accion_especifica: 'Ejecución de proyectos de impacto ecológico, cultural o de salud comunitaria.',
      finalidad: 'Formar ciudadanas y ciudadanos comprometidos con el bienestar de su entorno territorial.',
      necesidad: 'Vincular el aprendizaje escolar con el desarrollo socioeconómico y cultural de la comunidad.',
      proceso_evaluacion: 'Rúbricas de evaluación del proyecto comunitario y coevaluación participativa con actores locales.',
      estrategias_seguimiento: 'Cortes bimestrales en Consejo Técnico Escolar para verificar la marcha del proyecto.',
      observaciones: 'Mantener comunicación permanente con autoridades auxiliares y comités comunitarios.',
    },
  },

  // 1.5 Movimiento Nacional por la Alfabetización y la Educación (MONAE)
  {
    id: 'cat1-monae',
    nombre: 'Movimiento Nacional por la Alfabetización y la Educación (MONAE)',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'MOVIMIENTO NACIONAL POR LA ALFABETIZACIÓN Y LA EDUCACIÓN (MONAE)',
    descripcion: 'Participación cívica y servicio social de estudiantes de EMS como asesores educativos para alfabetizar o certificar primaria/secundaria.',
    enfoque_mccems: 'Compromiso social de la Nueva Escuela Mexicana para la erradicación del rezago educativo en adultos del territorio.',
    formula_creaa_sugerida: 'Incorporar al 100% de los estudiantes de semestres avanzados del {ESCUELA} en brigadas del MONAE durante el ciclo escolar {CICLO}, atendiendo a personas en condición de rezago educativo en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Coordinación institucional y capacitación de aprendientes con el Instituto Estatal para la Educación de los Adultos (IEEA) en octubre de 2026.',
      '2. Censo y conformación de círculos de estudio en la comunidad para alfabetización y acreditación (noviembre 2026 - marzo 2027).',
      '3. Evaluación de aprendices certificados y liberación formal de constancias de servicio social MONAE en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Responsable del Programa MONAE / Servicio Social ({RESPONSABLE_VINCULACION})',
    entregable_oficial: 'Padrón de aprendientes brigadistas registrados, bitácoras de círculos de alfabetización y constancias de acreditación de beneficiarios',
    subcategorias_vinculadas: ['MOVIMIENTO NACIONAL POR LA ALFABETIZACIÓN Y LA EDUCACIÓN (MONAE)', 'PROYECTO ESCOLAR COMUNITARIO (PEC)', 'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS'],
    diagnostico_justificacion: 'Contribuir activamente a la disminución del analfabetismo y rezago de educación básica en los hogares de {LOCALIDAD}, fortaleciendo la solidaridad cívica de los aprendientes del bachillerato.',
    criterios_31_41: {
      accion_especifica: 'Asesorías educativas personalizadas impartidas por aprendientes a personas adultas.',
      finalidad: 'Abatir el rezago educativo en la localidad y sensibilizar a la juventud en el servicio comunitario.',
      necesidad: 'Reducir las brechas educativas de la población adulta en la zona de influencia del plantel.',
      proceso_evaluacion: 'Módulo de exámenes acreditados y reportes emitidos por el IEEA.',
      estrategias_seguimiento: 'Revisión mensual del número de usuarios atendidos y módulos avanzados.',
      observaciones: 'Articular la labor con el trámite de acreditación del servicio social estudiantil.',
    },
  },

  // 1.6 Clubes de lectura
  {
    id: 'cat1-clubes-lectura',
    nombre: 'Clubes de lectura',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'CLUBES DE LECTURA',
    descripcion: 'Promoción del hábito lector, comprensión crítica de textos, tertulias literarias y producción escrita comunitaria.',
    enfoque_mccems: 'Fortalecimiento del recurso sociocognitivo de Lengua y Comunicación mediante el goce estético y reflexivo de la lectura.',
    formula_creaa_sugerida: 'Consolidar el funcionamiento de al menos 1 Club de Lectura por grupo atendiendo a los {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO}, realizando círculos quincenales de lectura en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Selección consensuada del acervo literario y conformación de los clubes de lectura en septiembre de 2026.',
      '2. Realización quincenal de tertulias dialógicas, cafés literarios y elaboración de reseñas críticas (octubre 2026 - abril 2027).',
      '3. Organización del Maratón Escolar de Lectura y publicación de la gaceta literaria escolar en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Academia de Lengua y Comunicación',
    entregable_oficial: 'Bitácora de sesiones del Club de Lectura, compendio de reseñas literarias estudiantiles y gaceta escolar de fomento lector',
    subcategorias_vinculadas: ['CLUBES DE LECTURA', 'PROPUESTAS PEDAGÓGICAS', 'ORIENTACIÓN Y TUTORÍA'],
    diagnostico_justificacion: 'Atender la debilidad en comprensión lectora identificada en la evaluación diagnóstica EDIEMS y fomentar hábitos intelectuales autónomos en los {MATRICULA} aprendientes del bachillerato.',
    criterios_31_41: {
      accion_especifica: 'Lectura comentada quincenal y producción de textos creativos y analíticos.',
      finalidad: 'Mejorar la fluidez, comprensión inferencial y capacidad crítica en la lengua escrita.',
      necesidad: 'Subsanar el bajo nivel de competencia comunicativa que repercute en todas las áreas de aprendizaje.',
      proceso_evaluacion: 'Rúbricas de comprensión lectora y portafolios de reseñas escritas.',
      estrategias_seguimiento: 'Cortes bimestrales en CTE para registrar el número de libros y textos leídos por alumno.',
      observaciones: 'Vincular los textos seleccionados con temas de interés juvenil y valores de cultura de paz.',
    },
  },

  // 1.7 Indicadores académicos (reprobación, eficiencia terminal y abandono escolar) [ÁREA OBLIGATORIA 1]
  {
    id: 'area-1-indicadores',
    areaObligatoriaId: 'area-1-indicadores',
    nombre: 'Indicadores académicos (reprobación, eficiencia terminal y abandono escolar)',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'INDICADORES ACADÉMICOS',
    descripcion: 'Monitoreo, regularización y fortalecimiento de los índices de aprobación, retención y aprovechamiento escolar.',
    enfoque_mccems: 'Articulación de los recursos sociocognitivos (Pensamiento Matemático, Lengua y Comunicación) para abatir el rezago escolar temprano.',
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

  // 1.8 Orientación y Tutoría
  {
    id: 'cat1-orientacion-tutoria',
    nombre: 'Orientación y Tutoría',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'ORIENTACIÓN Y TUTORÍA',
    descripcion: 'Sistema tutorial grupal e individualizado para el acompañamiento integral, prevención del abandono y canalización oportuna.',
    enfoque_mccems: 'Monitoreo de alertas tempranas de deserción y fortalecimiento de factores protectores en la trayectoria escolar.',
    formula_creaa_sugerida: 'Atender mediante el Plan de Acción Tutorial al 100% de los estudiantes con riesgo de rezago o deserción del {ESCUELA} durante el ciclo escolar {CICLO}, aplicando bitácoras de tutoría y entrevistas familiares en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico integral de ingreso y designación de tutores grupales en septiembre de 2026.',
      '2. Sesiones semanales de tutoría grupal y seguimiento personalizado a casos de alerta temprana en semanas 6 y 12 (octubre 2026 - marzo 2027).',
      '3. Corte semestral de impacto del acompañamiento tutorial en la reducción del abandono escolar en enero y junio de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director), Coordinación de Tutorías ({RESPONSABLE_TUTORIA}) y Tutores Grupales',
    entregable_oficial: 'Plan de Acción Tutorial institucional, bitácoras grupales e individuales de tutoría y concentrado de alertas tempranas atendidas',
    subcategorias_vinculadas: ['ORIENTACIÓN Y TUTORÍA', 'INDICADORES ACADÉMICOS', 'ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)'],
    diagnostico_justificacion: 'Contener los factores de riesgo de deserción y reprobación escolar, brindando acompañamiento formativo sistemático a los aprendientes de los diferentes semestres del plantel.',
    criterios_31_41: {
      accion_especifica: 'Tutorías grupales e individuales y vinculación proactiva con madres y padres de familia.',
      finalidad: 'Garantizar la permanencia y conclusión oportuna de la trayectoria escolar de cada aprendiente.',
      necesidad: 'Prevenir el abandono derivado de problemas académicos, socioemocionales o de integración grupal.',
      proceso_evaluacion: 'Matriz de seguimiento tutorial y registros de asistencia y permanencia en control escolar.',
      estrategias_seguimiento: 'Reuniones mensuales de la red de tutores con la dirección escolar en el marco del CTE.',
      observaciones: 'Mantener estricta confidencialidad y trato ético en la información sensible de los estudiantes.',
    },
  },

  // 1.9 Planeación didáctica
  {
    id: 'cat1-planeacion-didactica',
    nombre: 'Planeación didáctica',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'PLANEACIÓN DIDÁCTICA',
    descripcion: 'Codiseño curricular, estructuración de progresiones, situaciones didácticas contextualizadas y evaluación formativa.',
    enfoque_mccems: 'Alineación de planes de clase a los programas sintéticos y analíticos del MCCEMS con enfoque formativo no parcelado.',
    formula_creaa_sugerida: 'Garantizar que el 100% de la plantilla docente ({TOTAL_DOCENTES} docentes) del {ESCUELA} cuente con planeaciones didácticas validadas institucionalmente en cada periodo semestral del ciclo {CICLO} en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Taller de codiseño curricular y armonización de secuencias didácticas por progresiones en septiembre de 2026.',
      '2. Entrega y revisión colegiada de planeaciones con retroalimentación técnica en Consejo Académico (septiembre 2026 y febrero 2027).',
      '3. Integración del repositorio institucional de planeaciones y rúbricas de evaluación formativa en junio de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director del Plantel) y Consejo Técnico Académico',
    entregable_oficial: 'Concentrado de planeaciones didácticas validadas por el Consejo Académico, listas de cotejo de progresiones y repositorio digital institucional',
    subcategorias_vinculadas: ['PLANEACIÓN DIDÁCTICA', 'TRABAJO COLEGIADO', 'FORMACIÓN Y ACTUALIZACIÓN DOCENTE'],
    diagnostico_justificacion: 'Asegurar que la totalidad de los {TOTAL_DOCENTES} docentes cuente con una guía didáctica estructurada y contextualizada, garantizando que los procesos de enseñanza respondan a los aprendizajes de trayectoria de la NEM.',
    criterios_31_41: {
      accion_especifica: 'Codiseño y validación colegiada de secuencias didácticas basadas en progresiones de aprendizaje.',
      finalidad: 'Asegurar la congruencia pedagógica entre objetivos curriculares, actividades y evaluación formativa.',
      necesidad: 'Evitar la improvisación y garantizar que la enseñanza esté orientada a metas de aprendizaje explícitas.',
      proceso_evaluacion: 'Instrumento colegiado de validación de planeación didáctica con criterios NEM.',
      estrategias_seguimiento: 'Cortes semestrales de entrega y revisión previa al inicio de cada periodo escolar.',
      observaciones: 'El Consejo Académico emitirá recomendaciones constructivas para la mejora de secuencias didácticas.',
    },
  },

  // 1.10 Otras actividades académicas (proyectos escolares, p. ej.)
  {
    id: 'cat1-otras-actividades-academicas',
    nombre: 'Otras actividades académicas (proyectos escolares, p. ej.)',
    categoria: 'Desarrollo académico y aprendizaje',
    categoriaNumero: '1',
    subcategoria: 'OTRAS ACTIVIDADES ACADÉMICAS',
    descripcion: 'Eventos científicos, humanísticos, tecnológicos, exposiciones escolares y concursos académicos interdisciplinares.',
    enfoque_mccems: 'Difusión de la cultura científica, tecnológica y humanística a través de actividades complementarias extracurriculares.',
    formula_creaa_sugerida: 'Organizar y ejecutar 2 demostraciones de competencias académicas (Feria de Ciencias y Muestra Humanística) en el {ESCUELA} durante el ciclo escolar {CICLO}, involucrando a los {MATRICULA} estudiantes en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Publicación de convocatorias institucionales y conformación de equipos de trabajo disciplinar en octubre de 2026.',
      '2. Asesoría docente para la formulación de proyectos, experimentos y ensayos estudiantiles (noviembre 2026 - marzo 2027).',
      '3. Muestra pública de proyectos en las instalaciones del plantel con participación de la comunidad en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité Organizador de Muestras Académicas',
    entregable_oficial: 'Programa oficial del evento, memoria gráfica de proyectos expuestos, bitácora de evaluación y reconocimientos a aprendientes',
    subcategorias_vinculadas: ['OTRAS ACTIVIDADES ACADÉMICAS', 'PROPUESTAS PEDAGÓGICAS', 'TRABAJO COLEGIADO'],
    diagnostico_justificacion: 'Estimular la creatividad, el rigor metodológico y la expresión oral y escrita de los {MATRICULA} estudiantes en foros escolares públicos que fortalezcan su vocación académica.',
    criterios_31_41: {
      accion_especifica: 'Exposición y divulgación de proyectos escolares científicos, tecnológicos y humanísticos.',
      finalidad: 'Fomentar la curiosidad intelectual, el trabajo colaborativo y la comunicación efectiva de saberes.',
      necesidad: 'Brindar espacios extracurriculares que reconozcan el talento y las competencias transversales del alumnado.',
      proceso_evaluacion: 'Rúbrica de evaluación de proyectos y coevaluación del público asistente.',
      estrategias_seguimiento: 'Cronograma de hitos de entrega de avances ante el comité de academia.',
      observaciones: 'Invitar a padres de familia y escuelas secundarias de la zona para enriquecer la experiencia.',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 2: GESTIÓN Y ADMINISTRACIÓN ESCOLAR (5 TEMAS OFICIALES)
  // ══════════════════════════════════════════════════════════════════════════════

  // 2.0 Área Obligatoria 3 Formato 5.1: Vinculación con centros educativos, empresas, fundaciones o instituciones públicas
  {
    id: 'area-3-vinculacion',
    areaObligatoriaId: 'area-3-vinculacion',
    nombre: 'Vinculación con centros educativos, empresas, fundaciones o instituciones públicas',
    categoria: 'Gestión y administración escolar',
    categoriaNumero: '2',
    subcategoria: 'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS',
    descripcion: 'Articulación estratégica con secundarias alimentadoras, instituciones de educación superior, empresas de la región y dependencias públicas.',
    enfoque_mccems: 'Articulación integral escuela-comunidad-sector productivo para facilitar el tránsito educativo y la inserción sociolaboral.',
    formula_creaa_sugerida: 'Consolidar la vinculación estratégica del {ESCUELA} con al menos {NUM_CONVENIOS} instituciones educativas de nivel superior, empresas de la región y dependencias públicas durante el ciclo escolar {CICLO} en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Mapeo territorial de oportunidades de vinculación académica, productiva y de servicio comunitario en septiembre de 2026.',
      '2. Concertación y formalización de convenios de colaboración para orientación vocacional, prácticas y proyectos de impacto social (octubre 2026 - febrero 2027).',
      '3. Seguimiento bimestral de compromisos interinstitucionales y evaluación del impacto en la trayectoria de los aprendientes en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Responsable de Vinculación ({RESPONSABLE_VINCULACION})',
    entregable_oficial: 'Expediente oficial con convenios y cartas compromiso firmadas, bitácora de seguimiento interinstitucional y evidencias de vinculación comunitaria y vocacional',
    subcategorias_vinculadas: ['VINCULACIÓN CON INSTITUCIONES EDUCATIVAS', 'VINCULACIÓN CON EL SECTOR PRODUCTIVO', 'PROYECTO ESCOLAR COMUNITARIO (PEC)'],
    diagnostico_justificacion: 'Fortalecer el tránsito fluido hacia la educación superior y acercar a los aprendientes al entorno laboral de {MUNICIPIO}, complementando la formación en aula con experiencias reales en la comunidad.',
    criterios_31_41: {
      accion_especifica: 'Formalización de convenios, ferias vocacionales y visitas formativas interinstitucionales.',
      finalidad: 'Ampliar los horizontes formativos, vocacionales y socioproductivos del estudiantado.',
      necesidad: 'Garantizar que el plantel cuente con alianzas formales que respalden el egreso y la permanencia escolar.',
      proceso_evaluacion: 'Número de convenios activos suscritos y encuestas de satisfacción con aliados institucionales.',
      estrategias_seguimiento: 'Cortes bimestrales en Consejo Técnico Escolar para evaluar acuerdos vigentes.',
      observaciones: 'Asegurar que todas las actividades cumplan rigurosamente con los protocolos de seguridad de aprendientes menores de edad.',
    },
  },

  // 2.1 Vinculación con instituciones educativas
  {
    id: 'cat2-vinculacion-instituciones-educativas',
    nombre: 'Vinculación con instituciones educativas',
    categoria: 'Gestión y administración escolar',
    categoriaNumero: '2',
    subcategoria: 'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS',
    descripcion: 'Articulación institucional con secundarias de la zona para captación escolar y con educación superior para orientación vocacional.',
    enfoque_mccems: 'Tránsito fluido entre niveles educativos y fortalecimiento de trayectorias formativas continuas.',
    formula_creaa_sugerida: 'Establecer acuerdos de colaboración académica con al menos 3 instituciones educativas (2 secundarias alimentadoras y 1 de educación superior regional) para el {ESCUELA} durante el ciclo {CICLO} en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Jornadas de visita a secundarias y telesecundarias de la microrregión para difusión de la oferta educativa (octubre-noviembre 2026).',
      '2. Expo profesiográfica y visitas guiadas con universidades e institutos tecnológicos de la zona (febrero-marzo 2027).',
      '3. Firma de cartas compromiso y balance del incremento en la matrícula de nuevo ingreso en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Responsable de Vinculación Institucional ({RESPONSABLE_VINCULACION})',
    entregable_oficial: 'Convenios de vinculación académica firmados, bitácora de visitas a secundarias y reporte de aspirantes registrados para nuevo ingreso',
    subcategorias_vinculadas: ['VINCULACIÓN CON INSTITUCIONES EDUCATIVAS', 'ORIENTACIÓN EDUCATIVA', 'INDICADORES ACADÉMICOS'],
    diagnostico_justificacion: 'Asegurar el flujo de captación de nuevo ingreso en la microrregión para atender la meta de matrícula de {MATRICULA} alumnos y vincular a los egresados con opciones reales de estudios universitarios.',
    criterios_31_41: {
      accion_especifica: 'Jornadas de difusión escolar, visitas profesiográficas y formalización de cartas de intención educativa.',
      finalidad: 'Consolidar la matrícula de nuevo ingreso y apoyar la elección vocacional de los aprendientes de 6° semestre.',
      necesidad: 'Evitar la desinformación vocacional y garantizar el relevo generacional en la matrícula del plantel.',
      proceso_evaluacion: 'Conteo de solicitudes de ingreso de secundarias asociadas y encuestas de satisfacción vocacional.',
      estrategias_seguimiento: 'Seguimiento bimestral con directores de secundarias de la zona y universidades regionales.',
      observaciones: 'Coordinar con la Supervisión Escolar de la zona para no duplicar esfuerzos territoriales.',
    },
  },

  // 2.2 Vinculación con empresas, fundaciones e instituciones públicas
  {
    id: 'cat2-vinculacion-empresas-fundaciones',
    nombre: 'Vinculación con empresas, fundaciones e instituciones públicas',
    categoria: 'Gestión y administración escolar',
    categoriaNumero: '2',
    subcategoria: 'VINCULACIÓN CON EMPRESAS, FUNDACIONES E INSTITUCIONES PÚBLICAS',
    descripcion: 'Alianzas multisectoriales con dependencias de gobierno, sector productivo, asociaciones civiles y comités comunitarios.',
    enfoque_mccems: 'Inserción del bachillerato en la dinámica socioproductiva de la región mediante servicio social y proyectos formativos.',
    formula_creaa_sugerida: 'Formalizar al menos 2 convenios de vinculación con el sector productivo local, fundaciones o dependencias públicas (DIF municipal o salud) para el {ESCUELA} durante el ciclo escolar {CICLO} en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico de oportunidades de vinculación productiva y social en el entorno municipal en septiembre de 2026.',
      '2. Concertación y firma de convenios para prácticas formativas, servicio social y donación de insumos (noviembre 2026 - febrero 2027).',
      '3. Informe conjunto de resultados y evaluación de beneficios obtenidos para la comunidad escolar en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité Escolar de Vinculación y Gestión Comunitaria',
    entregable_oficial: 'Convenios de colaboración interinstitucional, cartas de intención vigentes y bitácora de actividades conjuntas realizadas',
    subcategorias_vinculadas: ['VINCULACIÓN CON EMPRESAS, FUNDACIONES E INSTITUCIONES PÚBLICAS', 'PROYECTO ESCOLAR COMUNITARIO (PEC)'],
    diagnostico_justificacion: 'Vincular el aprendizaje formativo de los estudiantes con las realidades laborales y de servicio público de {LOCALIDAD}, gestionando apoyos complementarios para beneficio del inmueble y los aprendientes.',
    criterios_31_41: {
      accion_especifica: 'Acuerdos de colaboración para visitas industriales, servicio social solidario y gestión de donativos.',
      finalidad: 'Acercar a los aprendientes a entornos profesionales y robustecer los recursos disponibles para la escuela.',
      necesidad: 'Diversificar los espacios de práctica formativa y fortalecer la relación escuela-sector productivo.',
      proceso_evaluacion: 'Evaluación de satisfacción de empresas e instituciones colaboradoras e informe de apoyos gestionados.',
      estrategias_seguimiento: 'Revisiones trimestrales de cumplimiento de las cláusulas de los convenios firmados.',
      observaciones: 'Asegurar que todas las actividades cumplan rigurosamente con los protocolos de seguridad para estudiantes menores de edad.',
    },
  },

  // 2.3 Gestión y administración de recursos, equipamiento y servicios
  {
    id: 'cat2-gestion-recursos-equipamiento',
    nombre: 'Gestión y administración de recursos, equipamiento y servicios',
    categoria: 'Gestión y administración escolar',
    categoriaNumero: '2',
    subcategoria: 'GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS',
    descripcion: 'Mantenimiento, dignificación física de aulas, sanitarios, áreas deportivas, laboratorios y equipamiento tecnológico del plantel.',
    enfoque_mccems: 'Espacios dignos, higiénicos, accesibles y seguros como condición indispensable para el ejercicio efectivo del derecho a la educación.',
    formula_creaa_sugerida: 'Gestionar y ejecutar el mantenimiento correctivo y preventivo del 100% de los espacios educativos y mobiliario del {ESCUELA} durante el ciclo escolar {CICLO}, coordinando faenas con el Comité de Padres de Familia en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Levantamiento de inventario físico y diagnóstico de necesidades prioritarias de infraestructura en septiembre de 2026.',
      '2. Gestión de insumos y recursos ante instancias municipales y comités escolares (octubre 2026 - enero 2027).',
      '3. Jornadas comunitarias de mantenimiento escolar y faenas en periodos intersemestrales (enero y junio de 2027).',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité de Infraestructura y Mantenimiento Escolar',
    entregable_oficial: 'Inventario físico actualizado, actas de entrega-recepción de mantenimiento escolar y reporte financiero de obras comprobado',
    subcategorias_vinculadas: ['GESTIÓN Y ADMINISTRACIÓN DE RECURSOS, EQUIPAMIENTOS Y SERVICIOS', 'PROYECTO ESCOLAR COMUNITARIO (PEC)'],
    diagnostico_justificacion: 'Garantizar condiciones físicas dignas y operativas en aulas, baños y áreas exteriores para los {MATRICULA} estudiantes y {TOTAL_DOCENTES} integrantes del personal del plantel en {LOCALIDAD}.',
    criterios_31_41: {
      accion_especifica: 'Faenas de rehabilitación, impermeabilización, mantenimiento hidrosanitario y optimización de conectividad.',
      finalidad: 'Proveer un entorno seguro, limpio y tecnológicamente equipado para la actividad educativa cotidiana.',
      necesidad: 'Subsanar el desgaste por uso del inmueble y evitar riesgos de seguridad para la comunidad escolar.',
      proceso_evaluacion: 'Cédula de inspección física de instalaciones escolares y actas de comités de padres.',
      estrategias_seguimiento: 'Cortes trimestrales en asambleas de la Asociación de Madres y Padres de Familia.',
      observaciones: 'Priorizar reparaciones críticas de instalaciones eléctricas y sanitarias sobre obras ornamentales.',
    },
  },

  // 2.4 Seguimiento al desempeño docente en el aula [ÁREA OBLIGATORIA 2]
  {
    id: 'area-2-desempeno-docente',
    areaObligatoriaId: 'area-2-desempeno-docente',
    nombre: 'Seguimiento al desempeño docente en el aula',
    categoria: 'Gestión y administración escolar',
    categoriaNumero: '2',
    subcategoria: 'SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA',
    descripcion: 'Acompañamiento pedagógico directivo no punitivo, observación reflexiva de clases y retroalimentación formativa de la práctica docente.',
    enfoque_mccems: 'Verificación del trabajo por progresiones de aprendizaje, transversalidad curricular y aplicación de la evaluación formativa auténtica en el aula.',
    formula_creaa_sugerida: 'Realizar el acompañamiento pedagógico y seguimiento al desempeño docente en el aula al 100% de la plantilla ({TOTAL_DOCENTES} docentes) del {ESCUELA} durante el ciclo escolar {CICLO}, aplicando al menos 2 visitas de observación formativa por semestre en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
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

  // 2.5 Seguimiento de egresados
  {
    id: 'cat2-seguimiento-egresados',
    nombre: 'Seguimiento de egresados',
    categoria: 'Gestión y administración escolar',
    categoriaNumero: '2',
    subcategoria: 'SEGUIMIENTO DE EGRESADOS',
    descripcion: 'Padrón, monitoreo de continuidad en educación superior e inserción sociolaboral de generaciones graduadas.',
    enfoque_mccems: 'Evaluación de la pertinencia formativa y del perfil de egreso del bachillerato estatal en el contexto regional.',
    formula_creaa_sugerida: 'Integrar y actualizar el padrón de seguimiento al 100% de los egresados de la generación previa del {ESCUELA} durante el ciclo {CICLO}, identificando su continuidad universitaria o laboral en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diseño y difusión digital del formulario de contacto y trayectoria para egresados en septiembre-octubre de 2026.',
      '2. Sistematización de datos sobre ingreso a universidades, carreras elegidas o incorporación al sector productivo (noviembre 2026 - febrero 2027).',
      '3. Análisis de indicadores de inserción en el Consejo Académico para retroalimentar la oferta orientadora del plantel en abril de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Responsable de Control Escolar y Seguimiento de Egresados',
    entregable_oficial: 'Directorio estadístico de egresados, reporte analítico de absorción en educación superior y recomendaciones colegiadas de actualización curricular',
    subcategorias_vinculadas: ['SEGUIMIENTO DE EGRESADOS', 'ORIENTACIÓN EDUCATIVA', 'INDICADORES ACADÉMICOS'],
    diagnostico_justificacion: 'Evaluar objetivamente si la preparación ofrecida en el bachillerato facilita el ingreso de los jóvenes a carreras de nivel superior en Puebla y la región o su vinculación laboral formal.',
    criterios_31_41: {
      accion_especifica: 'Encuestas de seguimiento a exalumnos, análisis de bases de datos y encuentros de egresados.',
      finalidad: 'Retroalimentar el plan de estudios y la orientación profesiográfica con base en la experiencia de egreso.',
      necesidad: 'Conocer el destino académico y laboral de las y los graduados para medir el impacto institucional del plantel.',
      proceso_evaluacion: 'Reporte cuantitativo de tasas de inserción y continuidad formativa universitaria.',
      estrategias_seguimiento: 'Cortes semestrales de actualización del directorio telefónico y electrónico de egresados.',
      observaciones: 'Mantener comunicación respetuosa y ética protegiendo los datos personales conforme a la ley.',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 3: DESARROLLO SOCIOEMOCIONAL Y PREVENCIÓN DE LA VIOLENCIA (3 TEMAS)
  // ══════════════════════════════════════════════════════════════════════════════

  // 3.1 Ámbitos de formación socioemocional (Currículum Ampliado)
  {
    id: 'cat3-ambitos-socioemocionales',
    nombre: 'Ámbitos de formación socioemocional (Currículum Ampliado)',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    categoriaNumero: '3',
    subcategoria: 'ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)',
    descripcion: 'Práctica y colaboración ciudadana, Educación para la salud, Integridad, Actividades físicas, deporte y Artes.',
    enfoque_mccems: 'Formación integral del aprendiente mediante el desarrollo de habilidades intrapersonales e interpersonales para la vida.',
    formula_creaa_sugerida: 'Implementar al menos 4 proyectos formativos de los Ámbitos de Formación Socioemocional beneficiando al 100% de los {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO} en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Diagnóstico de bienestar socioemocional y planeación de actividades del currículum ampliado en septiembre de 2026.',
      '2. Ejecución bimestral de eventos deportivos, ferias de salud integral, muestras artísticas y jornadas cívicas (octubre 2026 - marzo 2027).',
      '3. Festival de talentos, convivencia escolar armónica y autoevaluación de competencias socioemocionales en mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité de Formación Socioemocional ({RESPONSABLE_TUTORIA})',
    entregable_oficial: 'Plan anual de los Ámbitos de Formación Socioemocional, bitácora de actividades desarrolladas y registros fotográficos con listas de aprendientes',
    subcategorias_vinculadas: ['ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)', 'ORIENTACIÓN Y TUTORÍA', 'PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA'],
    diagnostico_justificacion: 'Atender el bienestar integral y la salud mental de los {MATRICULA} aprendientes, previniendo conductas de riesgo y fortaleciendo su autoestima y sentido de comunidad en {LOCALIDAD}.',
    criterios_31_41: {
      accion_especifica: 'Jornadas de vida saludable, torneos deportivos de integración, clubes artísticos y voluntariado ciudadano.',
      finalidad: 'Desarrollar la resiliencia, empatía, autorregulación y compromiso social de la comunidad estudiantil.',
      necesidad: 'Equilibrar la formación académica formal con el desarrollo humano, emocional y corporal de las juventudes.',
      proceso_evaluacion: 'Instrumentos de autopercepción de habilidades socioemocionales y rúbricas de participación activa.',
      estrategias_seguimiento: 'Cortes bimestrales en CTE para evaluar el clima institucional y bienestar escolar.',
      observaciones: 'Involucrar a docentes de todas las áreas para que integren micro-actividades socioemocionales en clase.',
    },
  },

  // 3.2 Estrategias, programas y/o proyectos sobre violencia [ÁREA OBLIGATORIA 4]
  {
    id: 'area-4-violencia',
    areaObligatoriaId: 'area-4-violencia',
    nombre: 'Estrategias, programas y/o proyectos sobre violencia',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    categoriaNumero: '3',
    subcategoria: 'PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA',
    descripcion: 'Protocolos de convivencia escolar, erradicación de violencia de género, resolución pacífica de conflictos y cultura de paz.',
    enfoque_mccems: 'Construcción de escuelas como comunidades de paz, inclusión y cero tolerancia al acoso escolar o discriminación.',
    formula_creaa_sugerida: 'Implementar el 100% de las acciones del Protocolo de Convivencia Pacífica y Prevención de la Violencia en los {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO}, mediante jornadas de mediación y cultura de paz en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Difusión masiva de protocolos de seguridad y conformación del Comité de Paz y Mediación Escolar en septiembre de 2026.',
      '2. Talleres bimestrales sobre prevención de acoso cibernético, resolución pacífica de desacuerdos e inclusión (octubre 2026 - febrero 2027).',
      '3. Foro estudiantil de derechos humanos, cultura de paz y evaluación del clima de convivencia en abril y mayo de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Comité de Convivencia y Seguridad Escolar ({RESPONSABLE_TUTORIA})',
    entregable_oficial: 'Protocolo de convivencia adaptado y firmado, actas del Comité de Paz, bitácora de mediación de conflictos y relatorías de talleres',
    subcategorias_vinculadas: ['PREVENCIÓN DE LA VIOLENCIA EN LA ESCUELA', 'ÁMBITOS DE FORMACIÓN SOCIOEMOCIONAL (CURRÍCULUM AMPLIADO)', 'ORIENTACIÓN Y TUTORÍA'],
    diagnostico_justificacion: 'Salvaguardar la integridad de los {MATRICULA} estudiantes y generar un ambiente libre de hostigamiento o agresiones, fortaleciendo el diálogo y la resolución no violenta de conflictos en el plantel.',
    criterios_31_41: {
      accion_especifica: 'Instalación de mesas de mediación dialógica, talleres socioformativos y buzones escolares de convivencia.',
      finalidad: 'Garantizar un entorno educativo libre de violencia, basado en el respeto irrestricto a la dignidad humana.',
      necesidad: 'Prevenir conductas de riesgo psicosocial y acoso escolar que deterioren el aprendizaje y la permanencia.',
      proceso_evaluacion: 'Encuestas semestrales de clima escolar y bitácora de incidencias canalizadas y resueltas.',
      estrategias_seguimiento: 'Reuniones mensuales de monitoreo del Comité de Seguridad Escolar con reporte al Consejo Técnico.',
      observaciones: 'Coordinación inmediata con instancias del DIF o salud mental ante situaciones de riesgo grave.',
    },
  },

  // 3.3 Orientación educativa
  {
    id: 'cat3-orientacion-educativa',
    nombre: 'Orientación educativa',
    categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
    categoriaNumero: '3',
    subcategoria: 'ORIENTACIÓN EDUCATIVA',
    descripcion: 'Orientación psicopedagógica, vocacional y acompañamiento en la formulación del proyecto de vida del estudiantado.',
    enfoque_mccems: 'Maduración personal, toma responsable de decisiones vocacionales y definición de metas a corto, mediano y largo plazo.',
    formula_creaa_sugerida: 'Brindar orientación psicopedagógica y vocacional al 100% de los {MATRICULA} estudiantes del {ESCUELA} durante el ciclo escolar {CICLO}, consolidando su proyecto de vida y plan vocacional en {LOCALIDAD}, {MUNICIPIO}, Puebla.',
    estrategia_etapas: [
      '1. Aplicación de pruebas psicométricas y de estilos de aprendizaje para diagnóstico vocacional en septiembre-octubre de 2026.',
      '2. Talleres grupales sobre toma de decisiones, plan de carrera y proyecto de vida (noviembre 2026 - febrero 2027).',
      '3. Asesorías individuales profesiográficas y expo-vocacional con instituciones de nivel superior en marzo y abril de 2027.',
    ],
    responsable_tipo: '{DIRECTOR} (Director) y Orientador(a) Educativo(a) / Tutor del Plantel ({RESPONSABLE_TUTORIA})',
    entregable_oficial: 'Programa anual de Orientación Educativa, concentrado de perfiles vocacionales y bitácora de entrevistas individuales de asesoría',
    subcategorias_vinculadas: ['ORIENTACIÓN EDUCATIVA', 'ORIENTACIÓN Y TUTORÍA', 'VINCULACIÓN CON INSTITUCIONES EDUCATIVAS'],
    diagnostico_justificacion: 'Orientar a los {MATRICULA} aprendientes en su autoconocimiento y toma de decisiones profesionales, reduciendo la incertidumbre vocacional y la deserción en los semestres de egreso.',
    criterios_31_41: {
      accion_especifica: 'Aplicación de baterías de intereses vocacionales, asesoría profesiográfica y talleres de proyecto de vida.',
      finalidad: 'Acompañar a cada estudiante en la construcción consciente y motivada de su futuro profesional y laboral.',
      necesidad: 'Evitar elecciones vocacionales erróneas y dotar al estudiantado de herramientas para enfrentar el egreso escolar.',
      proceso_evaluacion: 'Portafolio del proyecto de vida de cada estudiante y encuestas de claridad vocacional.',
      estrategias_seguimiento: 'Cortes semestrales de seguimiento individualizado con reporte al Consejo Técnico Escolar.',
      observaciones: 'Vincular estrechamente la orientación vocacional con las instituciones de educación superior de la región.',
    },
  },
] as const;

/**
 * Busca un elemento del catálogo canónico por id, nombre exacto o aproximación semántica.
 */
export function findCriterioCatalogItem(temaOrId: string): CriterioCatalogItem | undefined {
  if (!temaOrId || !temaOrId.trim()) return undefined;
  const clean = temaOrId.trim().toLowerCase();

  // 1. Coincidencia exacta por ID
  const byId = CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id.toLowerCase() === clean);
  if (byId) return byId;

  // 2. Coincidencia por areaObligatoriaId
  const byArea = CATALOGO_BASE_CRITERIOS_PMC.find(c => c.areaObligatoriaId && c.areaObligatoriaId.toLowerCase() === clean);
  if (byArea) return byArea;

  // 3. Coincidencia exacta por nombre
  const byNameExact = CATALOGO_BASE_CRITERIOS_PMC.find(c => c.nombre.toLowerCase() === clean);
  if (byNameExact) return byNameExact;

  // 4. Coincidencias semánticas clave
  if (clean.includes('desempeño docente') || clean.includes('observación') || clean.includes('acompañamiento pedagógico')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'area-2-desempeno-docente');
  }
  if (clean.includes('centros educativos') || clean === 'area-3-vinculacion' || clean.includes('vinculación con centros')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'area-3-vinculacion');
  }
  if (clean.includes('vinculación con empresas') || clean.includes('empresas, fundaciones')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat2-vinculacion-empresas-fundaciones');
  }
  if (clean.includes('vinculación con instituciones') || clean.includes('instituciones educativas')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat2-vinculacion-instituciones-educativas');
  }
  if (clean.includes('vinculación') || clean.includes('convenio')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'area-3-vinculacion');
  }
  if (clean.includes('violencia') || clean.includes('cultura de paz') || clean.includes('paz')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'area-4-violencia');
  }
  if (clean.includes('indicador') || clean.includes('aprobaci') || clean.includes('reprobaci') || clean.includes('abandono') || clean.includes('eficiencia')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'area-1-indicadores');
  }
  if (clean.includes('formación y actualización') || clean.includes('capacitación docente')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-formacion-actualizacion-docente');
  }
  if (clean.includes('propuestas pedagógicas') || clean.includes('innovación didáctica')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-propuestas-pedagogicas');
  }
  if (clean.includes('trabajo colegiado') || clean.includes('academias')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-trabajo-colegiado');
  }
  if (clean.includes('proyecto escolar comunitario') || clean.includes('pec') || clean.includes('paec')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-proyecto-escolar-comunitario');
  }
  if (clean.includes('monae') || clean.includes('alfabetización')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-monae');
  }
  if (clean.includes('clubes de lectura') || clean.includes('lectura')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-clubes-lectura');
  }
  if (clean.includes('orientación y tutoría') || clean.includes('tutoría') || clean.includes('tutoria')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-orientacion-tutoria');
  }
  if (clean.includes('planeación didáctica') || clean.includes('planeacion')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-planeacion-didactica');
  }
  if (clean.includes('otras actividades académicas') || clean.includes('feria de ciencias')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat1-otras-actividades-academicas');
  }
  if (clean.includes('recursos, equipamiento') || clean.includes('infraestructura') || clean.includes('mantenimiento')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat2-gestion-recursos-equipamiento');
  }
  if (clean.includes('egresados')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat2-seguimiento-egresados');
  }
  if (clean.includes('ámbitos de formación socioemocional') || clean.includes('currículum ampliado') || clean.includes('socioemocional')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat3-ambitos-socioemocionales');
  }
  if (clean.includes('orientación educativa') || clean.includes('orientacion educativa')) {
    return CATALOGO_BASE_CRITERIOS_PMC.find(c => c.id === 'cat3-orientacion-educativa');
  }

  // 5. Coincidencia parcial por inclusión de texto
  return CATALOGO_BASE_CRITERIOS_PMC.find(c => clean.includes(c.nombre.toLowerCase()) || c.nombre.toLowerCase().includes(clean));
}

/**
 * Función de síntesis dinámica: toma un criterio/área de cualquiera de los 18 temas
 * y los datos reales del plantel, produciendo una meta institucional contextualizada,
 * rigurosa, oficial y libre de placeholders genéricos.
 */
export function synthesizeContextualizedMeta(
  criterioIdOrTema: string,
  project?: Partial<PmcProject> | null
): PmcMetaInstitucional {
  const item = findCriterioCatalogItem(criterioIdOrTema) || CATALOGO_BASE_CRITERIOS_PMC[0];

  const escuela = (project?.school_name || 'Bachillerato General Oficial').replace(/"/g, '“');
  const localidad = project?.locality || 'la localidad';
  const municipio = project?.municipality || 'el municipio';
  const ciclo = project?.ciclo_escolar || '2026-2027';
  const director = project?.director_name || 'Director del Plantel';

  const staff = Array.isArray(project?.staff_data) ? (project.staff_data as PmcStaffMember[]) : [];
  const totalDocentes = staff.length > 0
    ? staff.length
    : (typeof project?.total_staff === 'number' && project.total_staff > 0 ? project.total_staff : undefined);

  const indic = (project?.indicadores_academicos as PmcIndicadoresAcademicos) || {};
  const matricula = typeof indic.matricula === 'number' && indic.matricula > 0 ? indic.matricula : undefined;
  const reprobacion = typeof indic.reprobacion_ant === 'number' && indic.reprobacion_ant >= 0 ? indic.reprobacion_ant : undefined;
  const metaInc = reprobacion !== undefined ? Math.max(3, Math.min(8, Math.round(reprobacion * 0.4) || 5)) : undefined;

  const primerDocente = staff.find(s => s?.nombre && s?.nombre !== director)?.nombre || 'Colectivo Docente';
  const orientador = staff.find(s => /orienta|tutor|psic/i.test(`${s?.cargo || ''} ${s?.funcion || ''}`))?.nombre || 'Tutor del Plantel';

  const replacePlaceholders = (text: string): string => {
    let result = text
      .replace(/{ESCUELA}/g, escuela)
      .replace(/{LOCALIDAD}/g, localidad)
      .replace(/{MUNICIPIO}/g, municipio)
      .replace(/{CICLO}/g, ciclo)
      .replace(/{DIRECTOR}/g, director)
      .replace(/{RESPONSABLE_VINCULACION}/g, primerDocente)
      .replace(/{RESPONSABLE_TUTORIA}/g, orientador);

    // Reemplazo no fabricado de personal docente
    if (totalDocentes !== undefined) {
      result = result.replace(/{TOTAL_DOCENTES}/g, String(totalDocentes));
    } else {
      result = result
        .replace(/\s*\({TOTAL_DOCENTES}\s*docentes\)/gi, '')
        .replace(/los\s+{TOTAL_DOCENTES}\s+docentes/gi, 'las y los docentes')
        .replace(/los\s+{TOTAL_DOCENTES}\s+integrantes/gi, 'el personal')
        .replace(/{TOTAL_DOCENTES}/g, 'N/D');
    }

    // Reemplazo no fabricado de matrícula
    if (matricula !== undefined) {
      result = result.replace(/{MATRICULA}/g, String(matricula));
    } else {
      result = result
        .replace(/los\s+{MATRICULA}\s+estudiantes/gi, 'las y los estudiantes')
        .replace(/los\s+{MATRICULA}\s+aprendientes/gi, 'las y los aprendientes')
        .replace(/la\s+matrícula\s+de\s+{MATRICULA}\s+alumnos/gi, 'la matrícula estudiantil')
        .replace(/matrícula\s+de\s+{MATRICULA}\s+estudiantes/gi, 'matrícula escolar')
        .replace(/{MATRICULA}/g, 'N/D');
    }

    // Reemplazo no fabricado de reprobación
    if (reprobacion !== undefined) {
      result = result.replace(/{REPROBACION}/g, String(reprobacion));
    } else {
      result = result
        .replace(/\s*\({REPROBACION}%\s*reprobación\s*inicial\)/gi, '')
        .replace(/\s*\({REPROBACION}%\)/gi, '')
        .replace(/{REPROBACION}/g, 'N/D');
    }

    // Reemplazo no fabricado de meta de incremento
    if (metaInc !== undefined) {
      result = result.replace(/{META_APROBACION_INCREMENTO}/g, String(metaInc));
    } else {
      result = result.replace(/{META_APROBACION_INCREMENTO}/g, '5');
    }

    // Reemplazo no fabricado de convenios
    result = result
      .replace(/al\s+menos\s+{NUM_CONVENIOS}\s+instituciones/gi, 'instituciones')
      .replace(/{NUM_CONVENIOS}/g, 'N/D');

    return result;
  };

  const metaFinal = replacePlaceholders(item.formula_creaa_sugerida);
  const estrategiaFinal = item.estrategia_etapas.map(replacePlaceholders).join(' ');
  const personalFinal = replacePlaceholders(item.responsable_tipo);
  const justificacionFinal = replacePlaceholders(item.diagnostico_justificacion);

  return {
    categoria: item.categoriaNumero,
    nombre_categoria: item.categoria,
    tema: item.nombre,
    meta: metaFinal,
    estrategia: estrategiaFinal,
    linea_base: matricula !== undefined
      ? `Línea base institucional ciclo anterior: Matrícula ${matricula} estudiantes en ${localidad}, Puebla.`
      : `Línea base institucional ciclo anterior: Matrícula pendiente de registro en ${localidad}, Puebla.`,
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

/**
 * Enriquecedor universal: toma una meta institucional (existente o parcialmente vacía)
 * y rellena cualquier campo faltante o con valor genérico usando el catálogo canónico correspondiente.
 */
export function enrichMetaWithCatalogBase(
  meta: PmcMetaInstitucional,
  project?: Partial<PmcProject> | null
): PmcMetaInstitucional {
  const temaOrCat = meta.tema || meta.nombre_categoria || '';
  const item = findCriterioCatalogItem(temaOrCat);
  if (!item) return meta;

  const fallback = synthesizeContextualizedMeta(item.id, project);

  const isGeneric = (val: string | undefined | null): boolean => {
    if (!val || !val.trim()) return true;
    const lower = val.trim().toLowerCase();
    return (
      lower.includes('pendiente de definición') ||
      lower.includes('acción institucional') ||
      lower.includes('meta en proceso') ||
      lower.includes('colectivo escolar') ||
      lower.includes('reporte de seguimiento') ||
      lower.includes('cortes en consejo técnico')
    );
  };

  return {
    ...meta,
    categoria: meta.categoria || fallback.categoria,
    nombre_categoria: meta.nombre_categoria || fallback.nombre_categoria,
    tema: meta.tema || fallback.tema,
    meta: isGeneric(meta.meta) ? fallback.meta : meta.meta,
    estrategia: isGeneric(meta.estrategia) ? fallback.estrategia : meta.estrategia,
    personal_designado: isGeneric(meta.personal_designado) ? fallback.personal_designado : meta.personal_designado,
    entregable: isGeneric(meta.entregable) ? fallback.entregable : meta.entregable,
    linea_base: isGeneric(meta.linea_base) ? fallback.linea_base : meta.linea_base,
    diagnostico_meta: isGeneric(meta.diagnostico_meta) ? fallback.diagnostico_meta : meta.diagnostico_meta,
    necesidad: isGeneric(meta.necesidad) ? fallback.necesidad : meta.necesidad,
    accion_especifica: isGeneric(meta.accion_especifica) ? fallback.accion_especifica : meta.accion_especifica,
    finalidad: isGeneric(meta.finalidad) ? fallback.finalidad : meta.finalidad,
    proceso_evaluacion: isGeneric(meta.proceso_evaluacion) ? fallback.proceso_evaluacion : meta.proceso_evaluacion,
    subcategorias_vinculadas:
      Array.isArray(meta.subcategorias_vinculadas) && meta.subcategorias_vinculadas.length > 0
        ? meta.subcategorias_vinculadas
        : fallback.subcategorias_vinculadas,
    estrategias_seguimiento: isGeneric(meta.estrategias_seguimiento) ? fallback.estrategias_seguimiento : meta.estrategias_seguimiento,
    observaciones: isGeneric(meta.observaciones) ? fallback.observaciones : meta.observaciones,
  };
}
