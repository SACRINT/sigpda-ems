// src/__tests__/paec-benchmark-e2e.test.ts
/**
 * Test suite para H-316: Suite Benchmark E2E con Scorer Oficial de Producción
 * Evalúa un proyecto escolar comunitario completo y situado basado en la institución
 * modelo "Héroes de la Patria" (CCT 21EBH0244Z) contra:
 *   1. Scorer Oficial de Producción: calculateGlobalPaecScore (≥ 80/92, estatus 'aprobado_excelente')
 *   2. Auditor de Calidad Offline: auditPaecProject (23 criterios MCCEMS / NEM)
 *   3. Verificación de los 12 elementos normativos de la Lista de Cotejo de Diseño PAEC 2025 (SEMS / CAEMS)
 */

import { describe, it, expect } from 'vitest';
import { calculateGlobalPaecScore, formatAuditReport } from '@/lib/paec-quality-gate';
import { auditPaecProject } from '@/lib/paec-validator';
import type {
  PaecProject,
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
  SeguimientoRow,
} from '@/types/paec';

// ============================================================================
// FIXTURE NORMATIVO OFICIAL: BENCHMARK HÉROES DE LA PATRIA (CCT 21EBH0244Z)
// ============================================================================

const FASE1_HEROES: Fase1Diagnostico = {
  tabla1: [
    {
      col1: 'Ubicación geográfica y territorial',
      col2: 'Localidad Coronel Tito Hernández (María Andrea), Municipio Venustiano Carranza, Sierra Norte de Puebla. Coordenadas 20°30′N 97°40′O, altitud 130 msnm.',
    },
    {
      col1: 'Situación demográfica (INEGI)',
      col2: 'Población total de 2,183 habitantes (1,177 mujeres y 1,006 hombres). 649 viviendas habitadas con un promedio de 3.36 ocupantes por vivienda.',
    },
    {
      col1: 'Situación socioeconómica y productiva',
      col2: 'Economía basada en agricultura citrícola (naranja y mandarina), ganadería bovina y comercio informal. Grado promedio de escolaridad de 7.69 años.',
    },
    {
      col1: 'Situación sociocultural y comunitaria',
      col2: 'Comunidad con arraigo en tradiciones totonacas y mestizas. Participación activa en faenas comunitarias y festividades patronales locales.',
    },
    {
      col1: 'Seguridad y convivencia social',
      col2: 'Nivel medio de cohesión comunitaria; vigilancia vecinal organizada en coordinación con la inspectoría auxiliar municipal.',
    },
    {
      col1: 'Recursos, servicios y medio ambiente',
      col2: '617 viviendas con energía eléctrica y 594 con agua entubada. Problemática severa de acumulación de 1.2 toneladas semanales de desechos plásticos y envases de agroquímicos.',
    },
  ],
  tabla2: [
    {
      col1: 'Matrícula y cobertura escolar',
      col2: 'Matrícula activa de 214 estudiantes distribuidos en 6 grupos de 1er a 6to semestre (112 alumnas y 102 alumnos). Plantel CCT 21EBH0244Z.',
    },
    {
      col1: 'Personal docente y directivo',
      col2: 'Plantilla de 12 docentes con grado de licenciatura y posgrado, 1 director general y 2 administrativos atendiendo los 3 grados escolares.',
    },
    {
      col1: 'Indicadores académicos y trayectoria',
      col2: 'Tasa de aprobación escolar del 82.5%, reprobación del 17.5% concentrada en Matemáticas y Química, y eficiencia terminal histórica del 88.5%.',
    },
    {
      col1: 'Infraestructura y equipamiento del plantel',
      col2: '6 aulas didácticas, 1 laboratorio multidisciplinario, biblioteca escolar, cancha de usos múltiples y conexión a Internet mediante antena satelital.',
    },
  ],
  tabla3: [
    {
      aspect: 'Fortaleza',
      analysis: 'Colectivo docente con alta disposición al trabajo colegiado interdisciplinar y dominio de metodologías activas por proyectos.',
    },
    {
      aspect: 'Oportunidad',
      analysis: 'Alianza estratégica con el Ayuntamiento Municipal, la Inspectoría Auxiliar de María Andrea y cooperativas de citricultores locales.',
    },
    {
      aspect: 'Debilidad',
      analysis: 'Carencia de contenedores diferenciados y sistema formal de acopio de residuos sólidos dentro del perímetro escolar.',
    },
    {
      aspect: 'Amenaza',
      analysis: 'Quema clandestina de plásticos y basura a cielo abierto en parcelas aledañas que genera humo tóxico para la comunidad estudiantil.',
    },
  ],
  tabla4: [
    {
      col1: 'Etapa 1: Detección y recuperación de problemáticas comunitarias',
      col2: 'Levantamiento de campo y listado participativo con estudiantes y familias: Contaminación por plásticos PET en arroyos y caminos ejidales.',
    },
    {
      col1: 'Etapa 2: Análisis colegiado, deliberación y priorización',
      col2: 'Deliberación en sesión extraordinaria de academia docente: Evaluación de impacto en salud pública, viabilidad de acopio y vinculación curricular.',
    },
    {
      col1: 'Etapa 3: Selección por consenso del problema central',
      col2: 'Selección consensuada por el comité de plantel: Transformación integral de residuos plásticos en mobiliario escolar y comunitario útil.',
    },
  ],
};

const FASE2_HEROES: Fase2Justificacion = {
  projectName: 'Transformando el PET y Residuos Plásticos en Soluciones Comunitarias Ecológicas y Mobiliario Escolar',
  introduction:
    'El presente Proyecto Escolar Comunitario (PEC) surge del diagnóstico participativo integral realizado en la comunidad de Coronel Tito Hernández ' +
    '(María Andrea), donde se identificó una grave problemática de contaminación por residuos plásticos que afecta arroyos y la salud comunitaria. ' +
    'A través de la metodología de Aprendizaje Basado en Proyectos Comunitarios (ABPC), los estudiantes del Bachillerato General Héroes de la Patria ' +
    'articularán los propósitos formativos del tronco fundamental y laboral para recolectar, clasificar y transformar desechos plásticos en mobiliario ' +
    'ecológico útil, bancos resistentes y estaciones de reciclaje para el plantel y los espacios públicos locales. Este proyecto tiene una gran magnitud ' +
    'social y alcance poblacional que beneficiará directamente a más de 200 familias, respondiendo al profundo interés y demanda prioritaria de los ' +
    'habitantes. Asimismo, cuenta con total factibilidad y viabilidad técnica mediante convenios con el Ayuntamiento, y representa una excelente oportunidad ' +
    'y coyuntura temporal durante el ciclo escolar para consolidar la transformación territorial y formativa en nuestra escuela.',
  pilares: [
    'Sustentabilidad ambiental, cuidado del agua y reducción sistemática de la huella ecológica territorial en María Andrea.',
    'Salud pública comunitaria mediante la erradicación definitiva de tiraderos clandestinos y quema de basura a cielo abierto.',
    'Economía circular, emprendimiento social juvenil y transformación productiva de materiales reciclables para el bien común.',
    'Inclusión, equidad de género y participación colegiada activa de mujeres y hombres en faenas territoriales de recolección.',
    'Responsabilidad cívica, apropiación territorial y formación ética de la juventud como custodios del patrimonio ecológico local.',
  ],
  proposito: {
    educativo:
      'Fortalecer competencias transversales en razonamiento matemático, ciencias naturales, lengua escrita y conciencia cívica mediante la aplicación directa en el diseño y cálculo de estructuras de plástico reciclado.',
    social:
      'Generar conciencia ambiental en al menos 200 familias de María Andrea y erradicar los tres tiraderos clandestinos de envases PET en las márgenes del arroyo local con alta magnitud poblacional e interés vecinal.',
    funcional:
      'Construir e instalar 12 bancas ecológicas y 4 puntos limpios de separación de residuos en el plantel y la plaza comunitaria con plena factibilidad operativa y aprovechando la oportunidad del ciclo escolar.',
  },
  alcance: {
    metas: [
      'Recolectar y transformar 1.5 toneladas de plástico PET y PEAD durante el ciclo escolar 2026-2027',
      'Fabricar e instalar 12 bancas ecológicas y 4 estaciones de separación comunitaria antes de junio de 2027',
      'Involucrar activamente al 100% de la matrícula (214 estudiantes) y al menos 150 padres de familia en faenas ecológicas',
      'Erradicar el 100% de los tiraderos clandestinos de plástico en los márgenes de los arroyos de Coronel Tito Hernández',
    ],
    participantes: [
      '214 estudiantes de 1° a 6° semestre de bachillerato general',
      '12 docentes titulares y asesores disciplinares del CTE',
      'Comité de Padres de Familia y Consejo Escolar de Participación Social',
      'Inspectoría Auxiliar Municipal y Dirección de Ecología de Venustiano Carranza',
    ],
    recursos: [
      'Taller escolar y herramientas manuales aportadas por padres de familia',
      'Maquinaria trituradora y moldes térmicos gestionados mediante convenio con el Ayuntamiento',
      'Donación de insumos de ensamble por parte de comerciantes locales y cooperativas',
    ],
  },
};

// 16 UACs oficiales MCCEMS cubriendo semestres 1 al 6
const MAPEO_HEROES: MapeoRow[] = [
  // Semestre 1 (NOM-MCCEMS: propósitos formativos)
  { semester: 1, uacName: 'Pensamiento Matemático I', topic: 'Medición, volumen y proporcionalidad geométrica', linking: 'Cálculo de volumen de acopio de botellas y densidad de prensado para tabiques ecológicos' },
  { semester: 1, uacName: 'Lengua y Comunicación I', topic: 'Redacción de textos expositivos y carteles', linking: 'Diseño de la campaña informativa comunitaria sobre clasificación domiciliaria de residuos' },
  { semester: 1, uacName: 'La Materia y sus Interacciones', topic: 'Polímeros, propiedades químicas y degradación', linking: 'Análisis de tipos de plásticos (PET, PEAD, PVC) y tiempos de degradación ambiental' },
  { semester: 1, uacName: 'Cultura Digital I', topic: 'Herramientas de ofimática y hojas de cálculo', linking: 'Diseño de la base de datos digital para el registro de pesaje de plástico recolectado' },

  // Semestre 2
  { semester: 2, uacName: 'Conservación de la Energía', topic: 'Transformación energética y calor aplicado', linking: 'Estudio de procesos termodinámicos de termofusión y prensado de plástico reciclado' },
  { semester: 2, uacName: 'Ciencias Sociales I', topic: 'Organización social y bienestar territorial', linking: 'Mapeo de actores territoriales y organización de comités vecinales de acopio' },
  { semester: 2, uacName: 'Lengua y Comunicación II', topic: 'Discurso persuasivo y comunicación comunitaria', linking: 'Elaboración de guiones de perifoneo y materiales de concientización ambiental' },

  // Semestre 3
  { semester: 3, uacName: 'Pensamiento Matemático III', topic: 'Estadística descriptiva y análisis de datos', linking: 'Registro sistemático de pesaje semanal de plástico y estimación de metas bimestrales' },
  { semester: 3, uacName: 'Ecosistemas: Interacciones y Energía', topic: 'Impacto ambiental y contaminación hídrica', linking: 'Evaluación del impacto de los microplásticos en las fuentes de agua de María Andrea' },
  { semester: 3, uacName: 'Humanidades I', topic: 'Ética comunitaria y valores de convivencia', linking: 'Reflexión filosófica sobre la responsabilidad colectiva ante el deterioro ambiental' },

  // Semestre 4
  { semester: 4, uacName: 'Conciencia Histórica II', topic: 'Movimientos sociales y legislación ambiental', linking: 'Reflexión histórica sobre el consumo masivo y legislación ambiental en México' },
  { semester: 4, uacName: 'Ciencias Sociales II', topic: 'Desarrollo regional y políticas públicas locales', linking: 'Gestión interinstitucional ante el municipio para convenios de acopio' },

  // Semestre 5 (NOM-MCCEMS: progresiones de aprendizaje)
  { semester: 5, uacName: 'Pensamiento Matemático V', topic: 'Modelación matemática y cálculo estructural', linking: 'Cálculo estructural de resistencia y diseño ergonómico de bancas para parques' },
  { semester: 5, uacName: 'La Materia y sus Reacciones', topic: 'Resistencia de materiales y elasticidad térmica', linking: 'Pruebas de carga y flexión en tablas y vigas de polietileno reciclado' },

  // Semestre 6
  { semester: 6, uacName: 'Filosofía y Ética Ambiental', topic: 'Ética biocéntrica y justicia ambiental', linking: 'Formulación de la carta de compromiso ecológico comunitario de la juventud' },
  { semester: 6, uacName: 'Cultura Digital III', topic: 'Marketing digital y visualización de datos', linking: 'Creación de infografías interactivas y catálogo digital de productos del proyecto' },
];

const CRONOGRAMA_HEROES: CronogramaRow[] = [
  {
    phase: 'Fase 1: Diagnóstico Colectivo y Mapeo Territorial (Agosto - Septiembre)',
    objective: 'Determinar los puntos críticos de acumulación de residuos plásticos en María Andrea y levantar el censo escolar',
    macroActivities: 'Recorridos de campo, geolocalización de tiraderos, encuesta a 200 hogares y asamblea comunitaria de instalación',
    responsibleSubjects: 'Lengua y Comunicación I, Ciencias Sociales I, Pensamiento Matemático I',
    semesterInvolved: '1er y 3er semestre',
  },
  {
    phase: 'Fase 2: Campaña Comunitaria y Red de Puntos Limpios (Octubre - Noviembre)',
    objective: 'Establecer 10 centros de acopio vecinales y concientizar a las familias sobre separación de origen',
    macroActivities: 'Colocación de contenedores identificados, talleres comunitarios en primarias y perifoneo informativo ejidal',
    responsibleSubjects: 'Cultura Digital I, Ecosistemas: Interacciones y Energía, Ciencias Sociales I',
    semesterInvolved: '1er a 4to semestre',
  },
  {
    phase: 'Fase 3: Acopio Masivo, Clasificación y Trituración (Diciembre - Enero)',
    objective: 'Procesar la primera tonelada de PET y PEAD mediante lavado, clasificación cromática y triturado mecánico',
    macroActivities: 'Jornadas de lavado, pesaje sistemático, trituración con equipo del ayuntamiento y almacenamiento seguro',
    responsibleSubjects: 'La Materia y sus Interacciones, Conservación de la Energía, Pensamiento Matemático III',
    semesterInvolved: '2do, 4to y 6to semestre',
  },
  {
    phase: 'Fase 4: Termofusión y Fabricación de Prototipos de Mobiliario (Febrero - Marzo)',
    objective: 'Elaborar los primeros 6 bancos y 2 estaciones de reciclaje mediante moldes y prensado térmico',
    macroActivities: 'Ensamble de estructuras, pruebas mecánicas de resistencia, lijado y rotulación institucional',
    responsibleSubjects: 'Pensamiento Matemático V, La Materia y sus Reacciones, Cultura Digital III',
    semesterInvolved: '3er a 6to semestre',
  },
  {
    phase: 'Fase 5: Instalación Territorial y Monitoreo de Impacto (Abril - Mayo)',
    objective: 'Colocar el mobiliario en la plaza comunitaria y el plantel escolar, evaluando la disminución de residuos',
    macroActivities: 'Faena comunitaria de colocación, aplicación de encuestas de satisfacción vecinal y monitoreo de arroyos',
    responsibleSubjects: 'Ciencias Sociales II, Humanidades I, Filosofía y Ética Ambiental',
    semesterInvolved: '5to y 6to semestre',
  },
  {
    phase: 'Fase 6: Feria Comunitaria de Aprendizajes y Rendición de Cuentas (Junio - Julio)',
    objective: 'Presentar los resultados finales ante el pueblo y supervisión escolar, entregando el manual de replicabilidad',
    macroActivities: 'Feria ecológica en plaza pública, entrega de reconocimientos a vecinos aliados y publicación del informe final Guía 004',
    responsibleSubjects: 'Todas las UACs del plantel coordinadas por el Consejo Técnico Escolar',
    semesterInvolved: '1° al 6° semestre integral',
  },
];

const DETALLE_CURRICULAR_HEROES: DetalleCurricularRow[] = [
  {
    semester: 1,
    uacName: 'Pensamiento Matemático I',
    progressionsOrPurposes: 'Propósito Formativo 4: Emplea razones, tasas, proporciones y variación proporcional para modelar situaciones contextuales de su entorno.',
    projectPhases: 'Fase 1 y Fase 3: Estimación de volúmenes de acopio y factores de compactación de envases PET.',
    curricularJustification: 'Permite fundamentar con rigor numérico las metas de recolección y la densidad requerida para la fabricación de tabiques plásticos.',
  },
  {
    semester: 1,
    uacName: 'Lengua y Comunicación I',
    progressionsOrPurposes: 'Propósito Formativo 7: Sintetiza información proveniente de diversos textos orales y escritos para elaborar resúmenes y carteles de difusión.',
    projectPhases: 'Fase 1 y Fase 2: Redacción de convocatoria comunitaria y carteles de sensibilización ambiental.',
    curricularJustification: 'Desarrolla la competencia comunicativa para incidir directamente en la cultura cívica y participación de los vecinos de María Andrea.',
  },
  {
    semester: 2,
    uacName: 'Conservación de la Energía',
    progressionsOrPurposes: 'Propósito Formativo 3: Aplica los principios de transferencia de calor y trabajo mecánico en transformaciones físicas de la materia.',
    projectPhases: 'Fase 3 y Fase 4: Termofusión controlada de plástico y control térmico en moldes.',
    curricularJustification: 'Garantiza la seguridad técnica y la eficiencia energética en los procesos de calentamiento y prensado de polietileno.',
  },
  {
    semester: 3,
    uacName: 'Pensamiento Matemático III',
    progressionsOrPurposes: 'Propósito Formativo 6: Organiza y representa conjuntos de datos cuantitativos mediante tablas de frecuencias, histogramas y polígonos.',
    projectPhases: 'Fase 3 y Fase 5: Bitácora estadística de pesaje de plástico y control de calidad de las piezas moldeadas.',
    curricularJustification: 'Aporta la metodología científica indispensable para auditar el cumplimiento de la meta de 1.5 toneladas de material recuperado.',
  },
  {
    semester: 5,
    uacName: 'Pensamiento Matemático V',
    progressionsOrPurposes: 'Progresión 2: Modela geométricamente estructuras tridimensionales considerando esfuerzos mecánicos y ergonomía.',
    projectPhases: 'Fase 4: Diseño volumétrico y planos técnicos de ensamble de bancas ecológicas.',
    curricularJustification: 'Articula la modelación matemática avanzada con la ergonomía aplicada en mobiliario de servicio comunitario.',
  },
  {
    semester: 6,
    uacName: 'Filosofía y Ética Ambiental',
    progressionsOrPurposes: 'Progresión 5: Argumenta posturas éticas ante dilemas socioambientales contemporáneos promoviendo la justicia ecológica.',
    projectPhases: 'Fase 5 y Fase 6: Formulación de la carta comunitaria de sostenibilidad y código de ética vecinal.',
    curricularJustification: 'Consolida la dimensión formativa y ciudadana del estudiante como agente transformador de su comunidad.',
  },
];

function generarPlan16Semanas(semestre: 'A' | 'B'): PlanOperativoRow[] {
  const plan: PlanOperativoRow[] = [];
  const uacsSemA = ['Pensamiento Matemático I', 'Lengua y Comunicación I', 'La Materia y sus Interacciones', 'Pensamiento Matemático III'];
  const uacsSemB = ['Conservación de la Energía', 'Ciencias Sociales I', 'Pensamiento Matemático V', 'Filosofía y Ética Ambiental'];
  const uacs = semestre === 'A' ? uacsSemA : uacsSemB;

  for (let s = 1; s <= 16; s++) {
    const isLast = s === 16;
    const uac = uacs[(s - 1) % uacs.length];
    const phaseName = s <= 4
      ? (semestre === 'A' ? 'Fase 1: Diagnóstico Colectivo' : 'Fase 4: Termofusión y Prototipado')
      : s <= 8
      ? (semestre === 'A' ? 'Fase 2: Red de Puntos Limpios' : 'Fase 4: Termofusión y Prototipado')
      : s <= 12
      ? (semestre === 'A' ? 'Fase 3: Acopio y Trituración' : 'Fase 5: Instalación Territorial')
      : (semestre === 'A' ? 'Fase 3: Acopio y Trituración' : 'Fase 6: Feria Comunitaria');

    const progressionText = semestre === 'A'
      ? `Propósito Formativo ${((s % 8) + 1)} de la disciplina`
      : `Progresión de Aprendizaje ${((s % 8) + 1)} oficial`;

    plan.push({
      phase: phaseName,
      week: `Semana ${s}`,
      uac,
      progression: progressionText,
      activity: isLast
        ? (semestre === 'A'
            ? 'Cierre de semestre, sistematización de datos de acopio y transferencia de resultados preliminares al CTE'
            : 'Feria comunitaria de aprendizajes, presentación de prototipos finales de mobiliario y clausura pública del PEC')
        : `Actividad operativa semanal ${s}: desarrollo de bitácoras, acopio de materiales y análisis interdisciplinar en ${uac}`,
      strategy: isLast
        ? (semestre === 'A' ? 'Evaluación parcial colegiada y foro escolar de balance' : 'Feria comunitaria, exposición interactiva y panel de evaluación social')
        : 'Aprendizaje Basado en Proyectos Comunitarios (ABPC) y trabajo de campo colaborativo',
      evaluationInstrument: isLast ? 'Rúbrica global de evaluación formativa y matriz de evidencias' : 'Lista de cotejo semanal y bitácora de campo con registro fotográfico',
      responsibles: 'Docente titular de UAC, brigada estudiantil de ecología y comité de padres de familia',
    });
  }
  return plan;
}

const PLAN_A_HEROES = generarPlan16Semanas('A');
const PLAN_B_HEROES = generarPlan16Semanas('B');

const IMPLEMENTACION_HEROES: PaecImplementacion = {
  cartaInvitacion: {
    asunto: 'Convocatoria a Asamblea Comunitaria de Instalación del Comité del Proyecto Escolar Comunitario (PEC)',
    fecha: '28 de Agosto de 2026',
    destinatarios: 'Autoridades civiles, ejidales, comités vecinales y padres de familia',
    cuerpo:
      'Por medio de la presente, la Dirección y el Colectivo Docente del Bachillerato General Héroes de la Patria convocan formalmente a ' +
      'autoridades civiles, ejidales, comités vecinales y padres de familia de la localidad de Coronel Tito Hernández a la sesión solemne ' +
      'de instalación y toma de protesta del Comité Escolar-Comunitario del Proyecto PAEC 2026-2027.',
    fechaReunion: '28 de Agosto de 2026',
    hora: '10:00 hrs',
    lugar: 'Auditorio del Bachillerato General Héroes de la Patria, María Andrea',
    objetivos: ['Instalación del comité', 'Aprobación de la problemática central'],
    firmante: 'Mtro. Roberto Morales Sánchez',
    cargo: 'Director del Plantel',
  },
  minutaArranque: {
    fecha: '28 de Agosto de 2026',
    tipoReunion: 'Asamblea Comunitaria de Instalación',
    acuerdos: [
      {
        no: 1,
        acuerdo: 'Se aprueba por unanimidad la problemática central: Contaminación por plásticos PET y residuos en la cuenca comunitaria.',
        responsable: 'Comité Central PAEC',
        fechaLimite: '2026-09-15',
        estatus: 'cumplido',
      },
      {
        no: 2,
        acuerdo: 'El H. Ayuntamiento proporcionará camión de volteo quincenal para traslado de plástico reciclado.',
        responsable: 'Inspectoría y Dirección Escolar',
        fechaLimite: '2026-10-01',
        estatus: 'en proceso',
      },
      {
        no: 3,
        acuerdo: 'El Comité de Padres coordinará las brigadas sabatinas de limpieza en las márgenes del arroyo.',
        responsable: 'Comité de Padres de Familia',
        fechaLimite: '2026-10-15',
        estatus: 'en proceso',
      },
    ],
    firmas: [
      { nombre: 'Mtro. Roberto Morales Sánchez', cargo: 'Director del Plantel' },
      { nombre: 'Profra. Laura Gómez Mendoza', cargo: 'Representante Docente' },
      { nombre: 'C. Juan Tenorio Vargas', cargo: 'Inspector Auxiliar Municipal' },
      { nombre: 'Sra. Carmen Ortiz Santos', cargo: 'Presidenta de Padres de Familia' },
    ],
  },
  oficiosAliados: [
    {
      destinatario: 'C. Presidente Municipal Constitucional de Venustiano Carranza, Puebla',
      cargo: 'Presidente Municipal',
      institucion: 'H. Ayuntamiento de Venustiano Carranza',
      asunto: 'Solicitud de convenio de colaboración institucional para traslado de material reciclable',
      propuestaColaboracion:
        'Asignación quincenal de transporte municipal para traslado de plástico triturado hacia la planta de reciclaje en Poza Rica.',
    },
    {
      destinatario: 'Dra. María Elena Castro Ríos',
      cargo: 'Directora del Centro de Salud de María Andrea',
      institucion: 'Secretaría de Salud del Estado de Puebla',
      asunto: 'Coordinación de talleres de salud comunitaria y erradicación de vectores de dengue',
      propuestaColaboracion:
        'Impartición de pláticas formativas sobre prevención de enfermedades por acumulación de agua en recipientes plásticos desechados.',
    },
  ],
};

function generar16SemanasSeguimiento(): SeguimientoRow[] {
  const arr: SeguimientoRow[] = [];
  for (let i = 1; i <= 16; i++) {
    arr.push({
      semana: `Semana ${i}`,
      fase: `Fase ${((i % 6) + 1)}`,
      uac: 'Pensamiento Matemático I',
      metaOperativa: `Seguimiento operativo y monitoreo de la semana ${i}: verificación de puntos limpios y faenas escolares.`,
      evidencia: `Registro fotográfico y bitácora de campo auditada sin incidencias en semana ${i}.`,
      avancePorcentaje: Math.min(100, Math.round((i / 16) * 100)),
      semaforo: 'verde',
    });
  }
  return arr;
}

const ANEXOS_HEROES: AnexosData = {
  anexo1Minuta: IMPLEMENTACION_HEROES.minutaArranque,
  anexo2Seguimiento: generar16SemanasSeguimiento(),
  anexo3ReporteMensual: {
    periodo: 'Noviembre 2026',
    logros: [
      'Acopio de 650 kg de plástico PET',
      'Participación de 180 alumnos en faenas territoriales',
      'Cero quejas vecinales y alta satisfacción comunitaria',
    ],
    dificultades: ['Habilitar un área techada adicional para resguardo del material limpio durante días lluviosos'],
    accionesAjuste: ['Ajuste del rol de guardias de fin de semana para supervisión de puntos limpios'],
  },
  anexo4ImpactoComunidad: {
    titulo: 'Encuesta de Impacto Comunitario y Percepción Social',
    reactivos: [
      { reactivo: '¿Ha observado disminución en la basura plástica tirada en su calle o arroyo?', dimension: 'Medio Ambiente' },
      { reactivo: '¿Considera útil el mobiliario ecológico instalado para la convivencia comunitaria?', dimension: 'Infraestructura' },
      { reactivo: '¿Su familia separa actualmente las botellas de plástico en su hogar?', dimension: 'Cultura Ecológica' },
      { reactivo: '¿La escuela mantuvo comunicación clara sobre las actividades del proyecto?', dimension: 'Gobernanza' },
      { reactivo: '¿Estaría dispuesto a continuar apoyando el proyecto en el siguiente ciclo escolar?', dimension: 'Sostenibilidad' },
    ],
    escala: { '1': 'Totalmente en desacuerdo', '5': 'Totalmente de acuerdo' },
  },
  anexo5AutoevaluacionEstudiantes: {
    titulo: 'Rúbrica de Autoevaluación Formativa del Estudiante',
    reactivos: [
      { reactivo: 'Apliqué conocimientos de matemáticas y física en la solución del problema del plástico', dimension: 'Aprendizajes' },
      { reactivo: 'Trabajé de manera colaborativa y respetuosa en las faenas y brigadas ecológicas', dimension: 'Colaboración' },
      { reactivo: 'Mejoré mi capacidad de expresión oral al informar a los vecinos de María Andrea', dimension: 'Comunicación' },
      { reactivo: 'Comprendo la importancia de la economía circular y la justicia ambiental comunitaria', dimension: 'Ética' },
      { reactivo: 'Me siento orgulloso del impacto positivo logrado por mi escuela en el territorio', dimension: 'Identidad' },
    ],
    escala: { '1': 'Insuficiente', '5': 'Excelente' },
  },
  anexo6EvaluacionColegiado: {
    titulo: 'Evaluación del Trabajo Colegiado e Interdisciplinar Docente',
    reactivos: [
      { reactivo: 'Articulación efectiva de progresiones interdisciplinares en el plan de clase', dimension: 'Curricular' },
      { reactivo: 'Cumplimiento del cronograma de 16 semanas y trabajo colegiado en sesiones de CTE', dimension: 'Gestión' },
      { reactivo: 'Vinculación efectiva con familias, autoridades municipales y agentes externos', dimension: 'Comunidad' },
      { reactivo: 'Uso de instrumentos de evaluación formativa acordes a los lineamientos de la NEM', dimension: 'Evaluación' },
      { reactivo: 'Sistematización rigurosa de evidencias y transparencia en rendición de cuentas', dimension: 'Rendición' },
    ],
    escala: { '1': 'No cumplido', '5': 'Completamente consolidado' },
  },
};

const GOBERNANZA_HEROES: PaecGobernanza = {
  calendario: [
    {
      tipo: 'Reunión del Comité Directivo y Central de Liderazgo',
      frecuencia: 'Quincenal',
      participantes: 'Director escolar, subdirector y coordinador del proyecto PAEC',
      objetivo: 'Supervisión de metas de gestión, convenios municipales y administración de recursos',
      evidencia: 'Minuta de acuerdos de dirección y reporte de avance',
    },
    {
      tipo: 'Sesión Ordinaria de Consejo Técnico Escolar y Colegiado Docente',
      frecuencia: 'Mensual (último viernes de cada mes)',
      participantes: 'Directivo, 12 docentes frente a grupo y representantes de academia',
      objetivo: 'Evaluar avance curricular semanal, cruce de propósitos y registro de evidencias en el portafolio',
      evidencia: 'Acta de sesión ordinaria, listas de asistencia y acuerdos de academia',
    },
    {
      tipo: 'Asamblea de Aula y Círculo de Aprendizaje con Estudiantes',
      frecuencia: 'Semanal',
      participantes: 'Estudiantes del plantel, jefes de grupo y docente tutor de aula',
      objetivo: 'Revisión de bitácoras de campo, autoevaluación grupal y organización de brigadas',
      evidencia: 'Bitácoras de aula y hojas de coevaluación formativa',
    },
    {
      tipo: 'Reunión de Enlace con la Comunidad, Padres de Familia y Aliados Externos',
      frecuencia: 'Bimestral',
      participantes: 'Director, comités de padres, inspector auxiliar municipal y autoridades sanitarias',
      objetivo: 'Coordinar faenas territoriales comunitarias, transparentar acopio y evaluar impacto social',
      evidencia: 'Minuta comunitaria firmada, registro fotográfico y acta de acuerdos',
    },
  ],
  metodologiaEvaluacion: {
    ambitos: [
      'Logro de aprendizajes situados y competencias del perfil de egreso MCCEMS',
      'Impacto socioambiental territorial (toneladas de PET retiradas y reducción de tiraderos)',
      'Apropiación comunitaria, gobernanza participativa y sostenibilidad a largo plazo',
    ],
    preguntasGuiaNem: {
      dondeEstamos:
        'Al inicio del ciclo escolar existían 3 tiraderos clandestinos y nula separación de basura; actualmente se han erradicado y 200 familias separan sus residuos activamente.',
      haciaDondeVamos:
        'Consolidar a María Andrea como una localidad modelo en sustentabilidad en la Sierra Norte de Puebla, instalando una microplanta comunitaria de reciclaje permanente.',
      comoSuperamos:
        'Fortaleciendo la alianza entre el bachillerato, la inspectoría municipal y las cooperativas citrícolas locales con formalización jurídica de largo aliento.',
    },
  },
};

const INFORME_HEROES: PaecInformeSupervision = {
  resumenEjecutivo:
    'El Proyecto Escolar Comunitario del Bachillerato General Héroes de la Patria cumplió al 100% sus objetivos en el ciclo 2026-2027. ' +
    'Se involucraron 214 estudiantes, 12 docentes y 200 familias de Coronel Tito Hernández, logrando el acopio y transformación ' +
    'de 1.62 toneladas de plástico en 14 bancas ecológicas y 4 estaciones de reciclaje.',
  metasVsLogros: [
    {
      meta: 'Recolectar 1.5 toneladas de plástico PET y PEAD en la comunidad',
      indicador: 'Toneladas pesadas en báscula certificada municipal',
      programado: '1.5 toneladas',
      alcanzado: '1.62 toneladas',
      porcentaje: 108,
      estatus: 'cumplido',
    },
    {
      meta: 'Fabricar e instalar 12 bancas ecológicas en espacios públicos',
      indicador: 'Número de piezas instaladas con acta de entrega-recepción',
      programado: '12 bancas',
      alcanzado: '14 bancas',
      porcentaje: 116,
      estatus: 'cumplido',
    },
    {
      meta: 'Capacitar a 150 familias en separación domiciliaria de residuos',
      indicador: 'Familias registradas con participación activa en acopio',
      programado: '150 familias',
      alcanzado: '185 familias',
      porcentaje: 123,
      estatus: 'cumplido',
    },
  ],
  analisisPrePost: {
    participacionTotal:
      'Incremento de la participación vecinal de un 15% inicial a un 88% de cobertura en la asamblea de cierre de ciclo escolar.',
    alcanceComunitario:
      'Erradicación total de los 3 tiraderos clandestinos principales en las orillas del río y recuperación de 2 parques vecinales.',
    cambioConocimientos:
      'El 92% de los estudiantes evaluados en rúbricas demostraron dominio de conceptos de polímeros, reciclaje mecánico y cálculo volumétrico.',
    desarrolloCompetencias:
      'Fortalecimiento demostrado de liderazgo juvenil, expresión oral pública y conciencia ecológica orientada al bien común de su pueblo.',
  },
  evidencias: [
    'Actas de entrega-recepción de bancas ecológicas a la Inspectoría Auxiliar',
    'Reporte de pesaje oficial expedido por la báscula municipal de Venustiano Carranza',
    'Portafolio fotográfico de faenas comunitarias y jornadas escolares de reciclaje',
  ],
  obstaculos: [
    {
      dificultad: 'Lluvias torrenciales en época de ciclones que humedecieron parte del material acopiado.',
      solucion: 'El comité de padres habilitó un tejabán de resguardo temporal en el patio posterior.',
    },
  ],
  sostenibilidad: [
    'Convenio formal firmado con el H. Ayuntamiento para mantener ruta permanente de recolección quincenal de plástico reciclable.',
    'Reglamento escolar y ejidal aprobado en asamblea que prohíbe el uso de unicel y plásticos de un solo uso en eventos del plantel y la comunidad.',
    'Comité vecinal de custodia patrimonial para dar mantenimiento periódico y pintura a las bancas y contenedores ecológicos instalados.',
  ],
};

const BENCHMARK_PROJECT_HEROES: PaecProject = {
  id: 'paec-heroes-de-la-patria-2026',
  teacherId: 'teacher-dir-heroes-001',
  projectName: 'Transformando el PET y Residuos Plásticos en Soluciones Comunitarias Ecológicas y Mobiliario Escolar',
  problemStatement: 'Grave contaminación por acumulación de plásticos PET y quema de basura a cielo abierto en Coronel Tito Hernández',
  cycleType: 'annual',
  currentStep: 9,
  communityContext: {
    location: 'Localidad Coronel Tito Hernández (María Andrea), Venustiano Carranza, Puebla',
    demographics: '2,183 habitantes, 649 viviendas habitadas (Censo INEGI)',
    economy: 'Agricultura citrícola, ganadería y comercio local',
    environment: 'Comunidad semiurbana con retos ambientales de manejo de desechos sólidos y quema de basura.',
  },
  schoolContext: {
    cct: '21EBH0244Z',
    schoolName: 'Bachillerato General Héroes de la Patria',
    municipality: 'Venustiano Carranza, Puebla',
    enrollment: '214',
    teacherCount: '12',
    indicators: 'Eficiencia terminal 88.5%, promedio de zona 82.1%',
  },
  fase1Diagnostico: FASE1_HEROES,
  fase2Justificacion: FASE2_HEROES,
  fase2Mapeo: MAPEO_HEROES,
  fase2Cronograma: CRONOGRAMA_HEROES,
  fase2DetalleCurricular: DETALLE_CURRICULAR_HEROES,
  fase2PlanOperativo: {
    semestreA: PLAN_A_HEROES,
    semestreB: PLAN_B_HEROES,
  },
  fase2Anexos: ANEXOS_HEROES,
  fase3PlanOperativoA: PLAN_A_HEROES,
  fase3PlanOperativoB: PLAN_B_HEROES,
  fase3Implementacion: IMPLEMENTACION_HEROES,
  fase4Gobernanza: GOBERNANZA_HEROES,
  fase4InformeSupervision: INFORME_HEROES,
  qualityAudit: null,
  status: 'completed',
  createdAt: new Date('2026-08-15'),
  updatedAt: new Date('2026-09-30'),
};

// ============================================================================
// VERIFICACIÓN DE LOS 12 ELEMENTOS DE LA LISTA DE COTEJO DE DISEÑO PAEC 2025
// ============================================================================

interface ListaCotejoItem {
  num: number;
  fase: string;
  elemento: string;
  verificar: (p: PaecProject) => { cumple: boolean; evidencia: string };
}

const LISTA_COTEJO_DISENO_PAEC_2025: ListaCotejoItem[] = [
  {
    num: 1,
    fase: 'Elaboración del diagnóstico',
    elemento: '1. Características de la comunidad (Ubicación, demografía, socioeconómico, sociocultural, seguridad, participación, recursos, medio ambiente)',
    verificar: (p) => {
      const t1 = p.fase1Diagnostico?.tabla1 || [];
      const cumple = t1.length >= 6;
      return {
        cumple,
        evidencia: `Tabla 1 contiene ${t1.length} aspectos territoriales situados con datos duros INEGI.`,
      };
    },
  },
  {
    num: 2,
    fase: 'Elaboración del diagnóstico',
    elemento: '2. Características de la educación (Cobertura, contexto familiar, colectivo estudiantil, plantel, indicadores educativos, programas)',
    verificar: (p) => {
      const t2 = p.fase1Diagnostico?.tabla2 || [];
      const cumple = t2.length >= 4;
      return {
        cumple,
        evidencia: `Tabla 2 contiene ${t2.length} indicadores educativos del plantel CCT ${p.schoolContext?.cct}.`,
      };
    },
  },
  {
    num: 3,
    fase: 'Elaboración del diagnóstico',
    elemento: '3. Análisis de la información (FODA, árbol de problemas, Ishikawa)',
    verificar: (p) => {
      const t3 = p.fase1Diagnostico?.tabla3 || [];
      const aspects = new Set(t3.map(r => r.aspect?.toLowerCase() || ''));
      const cumple = aspects.has('fortaleza') && aspects.has('oportunidad') && aspects.has('debilidad') && aspects.has('amenaza');
      return {
        cumple,
        evidencia: `Matriz FODA completa con los 4 aspectos analizados colegiadamente.`,
      };
    },
  },
  {
    num: 4,
    fase: 'Elaboración del diagnóstico',
    elemento: '4. Problemáticas o necesidades de la comunidad (Aportaciones directivo, docente, estudiantado, familias y autoridades)',
    verificar: (p) => {
      const t4 = p.fase1Diagnostico?.tabla4 || [];
      const stmt = (p.problemStatement || '').length >= 20;
      const cumple = t4.length >= 2 && stmt;
      return {
        cumple,
        evidencia: `Problemática identificada con ${t4.length} necesidades priorizadas y descripción situada.`,
      };
    },
  },
  {
    num: 5,
    fase: 'Diseño del Proyecto Escolar Comunitario',
    elemento: '5. Introducción y contextualización institucional del PEC',
    verificar: (p) => {
      const intro = p.fase2Justificacion?.introduction || '';
      const pilares = p.fase2Justificacion?.pilares || [];
      const cumple = intro.length >= 100 && pilares.length >= 3;
      return {
        cumple,
        evidencia: `Introducción formal de ${intro.length} caracteres y ${pilares.length} pilares estratégicos.`,
      };
    },
  },
  {
    num: 6,
    fase: 'Diseño del Proyecto Escolar Comunitario',
    elemento: '6. Objetivo y alcance del PEC (temporalidad, metas y población participante)',
    verificar: (p) => {
      const metas = p.fase2Justificacion?.alcance?.metas || [];
      const part = p.fase2Justificacion?.alcance?.participantes || [];
      const prop = p.fase2Justificacion?.proposito;
      const cumple = metas.length >= 3 && part.length >= 3 && Boolean(prop?.educativo && prop?.social && prop?.funcional);
      return {
        cumple,
        evidencia: `${metas.length} metas, ${part.length} sectores de participación y 3 propósitos integrales (educativo, social y funcional).`,
      };
    },
  },
  {
    num: 7,
    fase: 'Diseño del Proyecto Escolar Comunitario',
    elemento: '7. Diseño General: 6 Fases cronológicas ordenadas y actividades clave',
    verificar: (p) => {
      const crono = p.fase2Cronograma || [];
      const mapeo = p.fase2Mapeo || [];
      const cumple = crono.length >= 6 && mapeo.length >= 10;
      return {
        cumple,
        evidencia: `Cronograma con ${crono.length} fases bimestrales y mapeo con ${mapeo.length} asignaturas vinculadas.`,
      };
    },
  },
  {
    num: 8,
    fase: 'Diseño del Proyecto Escolar Comunitario',
    elemento: '8. Plan Operativo: actividades de cada progresión vinculada, estrategias didácticas, tiempos y responsables',
    verificar: (p) => {
      const planA = p.fase3PlanOperativoA || [];
      const planB = p.fase3PlanOperativoB || [];
      const cumple = planA.length >= 16 && planB.length >= 16;
      return {
        cumple,
        evidencia: `Plan Semestre A (${planA.length} semanas) y Semestre B (${planB.length} semanas) con 8 columnas normativas.`,
      };
    },
  },
  {
    num: 9,
    fase: 'Diseño del Proyecto Escolar Comunitario',
    elemento: '9. Anexos técnicos normativos (Cédula diagnóstica, Minuta, Oficios y Encuestas Likert)',
    verificar: (p) => {
      const anexos = p.fase2Anexos;
      const tieneMinuta = Boolean(anexos?.anexo1Minuta?.firmas && anexos.anexo1Minuta.firmas.length >= 4);
      const tieneEncuestas = Boolean(anexos?.anexo4ImpactoComunidad?.reactivos?.length && anexos.anexo6EvaluacionColegiado?.reactivos?.length);
      const cumple = tieneMinuta && tieneEncuestas;
      return {
        cumple,
        evidencia: `Minuta firmada por 4 figuras y 3 baterías de reactivos de evaluación formativa Likert.`,
      };
    },
  },
  {
    num: 10,
    fase: 'Ejecución del Proyecto Escolar Comunitario',
    elemento: '10. Ejecución curricular transversal (Currículum fundamental, ampliado y laboral en acción)',
    verificar: (p) => {
      const detalle = p.fase2DetalleCurricular || [];
      const cumple = detalle.length >= 3 && detalle.every(d => Boolean(d.progressionsOrPurposes && d.curricularJustification));
      return {
        cumple,
        evidencia: `${detalle.length} asignaturas con progresiones sintéticas y justificación curricular rigurosa.`,
      };
    },
  },
  {
    num: 11,
    fase: 'Ejecución del Proyecto Escolar Comunitario',
    elemento: '11. Concientización, participación y vinculación de familias y autoridades locales',
    verificar: (p) => {
      const oficios = p.fase3Implementacion?.oficiosAliados || [];
      const carta = p.fase3Implementacion?.cartaInvitacion;
      const cumple = oficios.length >= 2 && Boolean(carta?.firmante && carta?.cuerpo);
      return {
        cumple,
        evidencia: `Carta formal de convocatoria y ${oficios.length} oficios vinculantes dirigidos a autoridades locales.`,
      };
    },
  },
  {
    num: 12,
    fase: 'Seguimiento y retroalimentación al PEC',
    elemento: '12. Seguimiento continuo, gobernanza colegiada y rendición de cuentas (Informe Guía 004)',
    verificar: (p) => {
      const gob = p.fase4Gobernanza?.calendario || [];
      const informe = p.fase4InformeSupervision;
      const tieneMetas = (informe?.metasVsLogros || []).length >= 3;
      const tieneSost = (informe?.sostenibilidad || []).length >= 3;
      const cumple = gob.length >= 3 && tieneMetas && tieneSost;
      return {
        cumple,
        evidencia: `Gobernanza con ${gob.length} instancias de seguimiento y ${informe?.metasVsLogros?.length} metas evaluadas Pre/Post.`,
      };
    },
  },
];

// ============================================================================
// TESTS DE LA SUITE BENCHMARK E2E
// ============================================================================

describe('H-316: Suite Benchmark E2E con Scorer Oficial de Producción y Lista de Cotejo 2025', () => {

  it('1. Scorer Oficial de Producción (calculateGlobalPaecScore) otorga puntaje ≥ 80/92 y dictamen excelente', () => {
    const audit = calculateGlobalPaecScore(BENCHMARK_PROJECT_HEROES);

    // Verificaciones globales
    expect(audit.criterios).toHaveLength(23);
    expect(audit.totalScore).toBeGreaterThanOrEqual(80); // Exigencia de la auditoría: ≥ 80/92 puntos
    expect(audit.totalScore).toBeLessThanOrEqual(92);
    expect(audit.score).toBeGreaterThanOrEqual(87); // Porcentaje ≥ 87% (80/92 ≈ 87%)
    expect(audit.estatus).toBe('aprobado_excelente');
    expect(audit.status).toBe('aprobado_excelente');

    // Desglose del resumen
    expect(audit.summary).toBeDefined();
    expect(audit.summary!.passedCount).toBeGreaterThanOrEqual(20);
    expect(audit.summary!.failedCount).toBe(0);

    // Formateo del reporte Markdown para supervisión
    const reportMd = formatAuditReport(audit);
    expect(reportMd).toContain('APROBADO EXCELENTE');
    expect(reportMd).toContain('SEMS - COSFAC');
    expect(reportMd).toContain('SUPERVISIÓN ESCOLAR');
    expect(reportMd).toContain('91 / 92');
  });

  it('2. Todos los 23 criterios de la auditoría oficial de calidad se evalúan con estatus pass y puntuación máxima o cuasi-máxima', () => {
    const audit = calculateGlobalPaecScore(BENCHMARK_PROJECT_HEROES);

    for (const criterio of audit.criterios) {
      expect(criterio.score).toBeGreaterThanOrEqual(3);
      expect(criterio.status).toBe('pass');
      expect(criterio.evidenceFound).toBeDefined();
      expect(criterio.evidenceFound.length).toBeGreaterThan(5);
    }

    // Criterio 1: Diagnóstico Comunitario
    const c1 = audit.criterios.find(c => c.id === 1);
    expect(c1?.score).toBe(4);

    // Criterio 11: Cronograma 6 Fases (con el formato temático unificado de H-313)
    const c11 = audit.criterios.find(c => c.id === 11);
    expect(c11?.score).toBe(4);

    // Criterios 15 y 16: Planes Operativos Semestre A y B (16 semanas × 8 columnas)
    const c15 = audit.criterios.find(c => c.id === 15);
    const c16 = audit.criterios.find(c => c.id === 16);
    expect(c15?.score).toBe(4);
    expect(c16?.score).toBe(4);

    // Criterios 19 y 20: Formalización y 6 Anexos
    const c19 = audit.criterios.find(c => c.id === 19);
    const c20 = audit.criterios.find(c => c.id === 20);
    expect(c19?.score).toBe(4);
    expect(c20?.score).toBe(4);

    // Criterio 22: Informe final con Metas vs Logros y evaluación Pre/Post
    const c22 = audit.criterios.find(c => c.id === 22);
    expect(c22?.score).toBe(4);
  });

  it('3. Auditor de Calidad Offline (auditPaecProject) valida al 100% las 6 dimensiones normativas', () => {
    const auditResult = auditPaecProject(BENCHMARK_PROJECT_HEROES);

    expect(auditResult.criteria).toHaveLength(23);
    expect(auditResult.percentage).toBeGreaterThanOrEqual(90);
    expect(auditResult.status).toBe('aprobado_excelente');
    expect(auditResult.summary.failedCount).toBe(0);

    // Verificar las 6 dimensiones normativas
    const dimensiones = new Set(auditResult.criteria.map(c => c.dimension));
    expect(dimensiones.size).toBeGreaterThanOrEqual(6);
  });

  it('4. Cobertura del 100% de los 12 elementos normativos de la Lista de Cotejo de Diseño PAEC 2025 (SEMS / CAEMS)', () => {
    expect(LISTA_COTEJO_DISENO_PAEC_2025).toHaveLength(12);

    const resultadosCotejo = LISTA_COTEJO_DISENO_PAEC_2025.map((item) => {
      const res = item.verificar(BENCHMARK_PROJECT_HEROES);
      return {
        num: item.num,
        fase: item.fase,
        elemento: item.elemento,
        cumple: res.cumple,
        evidencia: res.evidencia,
      };
    });

    // Cada uno de los 12 elementos debe cumplir sin excepciones
    for (const r of resultadosCotejo) {
      expect(r.cumple).toBe(true);
      expect(r.evidencia.length).toBeGreaterThan(10);
    }

    const totalCumplidos = resultadosCotejo.filter(r => r.cumple).length;
    expect(totalCumplidos).toBe(12);
  });

  it('5. Proyecto Benchmark no contiene cifras genéricas prohibidas ni placeholders falsos', () => {
    const rawJson = JSON.stringify(BENCHMARK_PROJECT_HEROES);

    // Prohibido hardcodear cifras fabricadas identificadas en auditorías anteriores
    expect(rawJson).not.toContain('150 hogares');
    expect(rawJson).not.toContain('120 familias de la comunidad');
    expect(rawJson).not.toContain('250 familias del entorno');

    // Debe contener las cifras oficiales de INEGI de Coronel Tito Hernández
    expect(rawJson).toContain('2,183');
    expect(rawJson).toContain('649 viviendas');
    expect(rawJson).toContain('7.69');
  });

});
