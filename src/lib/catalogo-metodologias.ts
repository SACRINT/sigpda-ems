/**
 * Catálogo Oficial de Metodologías Activas para SIGPDA-EMS
 * Basado en el Marco Curricular Común de la Educación Media Superior (MCCEMS 2025 / NEM)
 * y especificaciones para Bachilleratos Tecnológicos (CECyTE, DGETI) y BGE en Puebla.
 */

export interface MetodologiaActiva {
  id: string;
  nombre: string;
  nombreCorto: string;
  definicion: string;
  fases: string[];
  asignaturasRecomendadas: string[];
  tipoEvidenciaSugerida: string;
  rolEstudiante: string;
  rolDocente: string;
  ejemploContextualizadoPuebla: string;
}

export const CATALOGO_METODOLOGIAS_ACTIVAS: MetodologiaActiva[] = [
  {
    id: "abp",
    nombre: "Aprendizaje Basado en Proyectos (ABP)",
    nombreCorto: "ABP",
    definicion: "Estrategia integradora en la que los estudiantes planean, ejecutan y evalúan un proyecto auténtico que responde a una necesidad o problemática real comunitaria, articulado de manera natural con el PAEC.",
    fases: [
      "1. Pregunta detonadora y definición del reto comunitario",
      "2. Planificación colaborativa, roles y cronograma",
      "3. Indagación, recolección de datos y trabajo de campo",
      "4. Construcción y refinamiento del producto integrador",
      "5. Difusión comunitaria, evaluación formativa y metacognición"
    ],
    asignaturasRecomendadas: [
      "Lengua y Comunicación",
      "Ciencias Sociales",
      "Humanidades",
      "Proyectos Comunitarios PAEC / PIPS",
      "Conciencia Histórica"
    ],
    tipoEvidenciaSugerida: "Prototipo, campaña comunitaria, gaceta escolar, video-documental o producto artesanal con memoria técnica.",
    rolEstudiante: "Investigador y gestor de soluciones para su comunidad escolar o local.",
    rolDocente: "Asesor metodológico y facilitador de vinculación con la comunidad.",
    ejemploContextualizadoPuebla: "Diseño y ejecución de un sistema escolar de separación y aprovechamiento de residuos orgánicos para huertos familiares en la Sierra Norte o Mixteca Poblana."
  },
  {
    id: "steam",
    nombre: "Enfoque STEAM (Ciencia, Tecnología, Ingeniería, Artes y Matemáticas)",
    nombreCorto: "STEAM",
    definicion: "Metodología interdisciplinaria centrada en la indagación empírica, el modelado matemático, el diseño técnico y la creatividad artística para formular soluciones a fenómenos y problemas físicos, ecológicos o técnicos.",
    fases: [
      "1. Planteamiento de la incógnita empírica o fenómeno a investigar",
      "2. Modelado conceptual, formulación matemática y diseño creativo",
      "3. Experimentación en laboratorio/campo y prototipado físico/digital",
      "4. Análisis estadístico de datos, calibración y optimización",
      "5. Exposición técnica del prototipo y defensa de resultados"
    ],
    asignaturasRecomendadas: [
      "Pensamiento Matemático",
      "La Materia y sus Interacciones",
      "Conservación de la Energía y sus Interacciones",
      "Módulos Tecnológicos",
      "Cultura Digital"
    ],
    tipoEvidenciaSugerida: "Prototipo funcional, reporte experimental de laboratorio, modelo 3D, gráfico matemático interactivo o simulación técnica.",
    rolEstudiante: "Diseñador, experimentador y analista de datos empíricos.",
    rolDocente: "Guía de experimentación, seguridad en taller y rigor científico.",
    ejemploContextualizadoPuebla: "Cálculo de eficiencia térmica y construcción a escala de una estufa ahorradora de leña usando materiales de la región y modelado algebraico lineal."
  },
  {
    id: "abr",
    nombre: "Aprendizaje Basado en Retos (ABR)",
    nombreCorto: "ABR / Retos",
    definicion: "Enfoque pedagógico activo que confronta al estudiante con un desafío técnico o social de corta/mediana duración, real y apremiante, que exige una solución tangible directamente aplicable a su vida diaria o especialidad técnica.",
    fases: [
      "1. Enganche con el reto del entorno productivo o cotidiano",
      "2. Preguntas guía, investigación técnica y delimitación",
      "3. Desarrollo colaborativo de la solución o código/formato",
      "4. Validación y prueba piloto en condiciones reales",
      "5. Publicación de la solución y retroalimentación colectiva"
    ],
    asignaturasRecomendadas: [
      "Módulos Profesionales (Programación, Electrónica, Mecatrónica, Gestión)",
      "Cultura Digital",
      "Habilidades para la Vida y el Trabajo (HVyT)",
      "Pensamiento Matemático"
    ],
    tipoEvidenciaSugerida: "Aplicación o script funcional, base de datos estructurada, manual técnico, propuesta de optimización de costos o proceso logístico.",
    rolEstudiante: "Solucionador ágil de problemas prácticos con mentalidad técnica.",
    rolDocente: "Líder de proyecto que plantea las restricciones de calidad y contexto.",
    ejemploContextualizadoPuebla: "Creación de una aplicación o base de datos en hoja de cálculo automatizada para el control de inventario de una cooperativa cafetalera o comercio local."
  },
  {
    id: "estudio_casos",
    nombre: "Estudio de Casos Situados",
    nombreCorto: "Casos Situados",
    definicion: "Análisis exhaustivo y deliberativo de una situación o dilema real (técnico, ético, legal, económico o comunitario), donde no existe una única respuesta correcta y los alumnos deben argumentar basándose en evidencias y normativas.",
    fases: [
      "1. Presentación de la narrativa o expediente del caso real",
      "2. Identificación del dilema central, variables e implicaciones",
      "3. Búsqueda y contrastación de evidencias, leyes o fundamentos",
      "4. Debate estructurado por equipos defendiendo alternativas",
      "5. Dictamen final razonado y conclusiones transferibles"
    ],
    asignaturasRecomendadas: [
      "Ciencias Sociales",
      "Humanidades",
      "Formación Socioemocional",
      "Conciencia Histórica",
      "Administración y Formación Laboral"
    ],
    tipoEvidenciaSugerida: "Informe de dictamen, árbol de toma de decisiones, matriz FODA analítica o minuta de resolución de conflicto laboral/comunitario.",
    rolEstudiante: "Analista crítico, mediador y tomador de decisiones informadas.",
    rolDocente: "Moderador socrático que desafía suposiciones y profundiza el análisis.",
    ejemploContextualizadoPuebla: "Estudio de un caso real sobre desabasto de agua potable en una junta auxiliar: análisis de distribución, derechos comunitarios y balance costo-beneficio."
  },
  {
    id: "aula_invertida",
    nombre: "Aula Invertida (Flipped Classroom)",
    nombreCorto: "Aula Invertida",
    definicion: "Modelo pedagógico donde la transferencia inicial de conceptos se realiza fuera del aula mediante materiales breves y accesibles (videos, guías visuales o audios), liberando el 100% del tiempo presencial para resolución activa de dudas, talleres prácticos y discusión guiada.",
    fases: [
      "1. Exploración previa autónoma con material detonador (asíncrono)",
      "2. Diagnóstico rápido presencial (pregunta socrática o quiz)",
      "3. Taller activo intensivo en el aula con trabajo colaborativo",
      "4. Resolución de casos y acompañamiento docente personalizado",
      "5. Mini-reto de consolidación y autoevaluación formativa"
    ],
    asignaturasRecomendadas: [
      "Pensamiento Matemático",
      "Lengua Extranjera (Inglés)",
      "Química / Física teórica",
      "Cultura Digital"
    ],
    tipoEvidenciaSugerida: "Hoja de trabajo práctica resuelta en equipo, mapa mental colaborativo en pizarrón o resolución de ejercicios complejos comentados.",
    rolEstudiante: "Protagonista responsable de su ritmo de estudio y participante activo en taller.",
    rolDocente: "Coach pedagógico que atiende dudas específicas en tiempo real.",
    ejemploContextualizadoPuebla: "Revisión previa de un tutorial corto en celular sobre factorización; en clase, resolución grupal de problemas de optimización de terrenos de cultivo en Cholula."
  },
  {
    id: "aprendizaje_servicio",
    nombre: "Aprendizaje-Servicio (ApS)",
    nombreCorto: "ApS",
    definicion: "Propuesta educativa que combina procesos de aprendizaje formal y de servicio a la comunidad en un solo proyecto bien articulado, donde los estudiantes aprenden al trabajar sobre necesidades reales del entorno con la finalidad de mejorarlo.",
    fases: [
      "1. Diagnóstico participativo de necesidades con actores comunitarios",
      "2. Diseño técnico del servicio articulado con los aprendizajes de la UAC",
      "3. Implementación directa del servicio en la escuela o localidad",
      "4. Evaluación del impacto social y los aprendizajes curriculares",
      "5. Reconocimiento público, testimonio comunitario y celebración"
    ],
    asignaturasRecomendadas: [
      "Formación para el Trabajo",
      "Ciencias Sociales",
      "Humanidades",
      "Proyectos PAEC / PIPS",
      "Cultura Digital"
    ],
    tipoEvidenciaSugerida: "Informe de impacto social, bitácora de servicio comunitario, testimonio en video de beneficiarios o manual de mantenimiento entregado a la comunidad.",
    rolEstudiante: "Ciudadano solidario y profesional técnico en formación.",
    rolDocente: "Enlace institucional entre el plantel y las autoridades locales.",
    ejemploContextualizadoPuebla: "Taller de alfabetización digital y trámites gubernamentales básicos impartido por alumnos de bachillerato a adultos mayores de su comunidad."
  },
  {
    id: "gamificacion",
    nombre: "Gamificación Pedagógica (Game-Based Learning)",
    nombreCorto: "Gamificación",
    definicion: "Integración de mecánicas, dinámicas y elementos de diseño de juegos (misiones, desafíos, niveles, insignias y retroalimentación inmediata) en entornos de aprendizaje para potenciar la motivación intrínseca, la concentración y la resiliencia ante el error.",
    fases: [
      "1. Presentación de la narrativa de la misión y reglas claras del juego",
      "2. Superación de retos individuales y colaborativos por estaciones",
      "3. Desbloqueo de niveles mediante evidencias de aprendizaje",
      "4. Retroalimentación inmediata y acumulación de puntos de maestría",
      "5. Desbriefing metacognitivo: ¿qué aprendimos durante la misión?"
    ],
    asignaturasRecomendadas: [
      "Lengua y Comunicación",
      "Pensamiento Matemático",
      "Lengua Extranjera (Inglés)",
      "Cultura Digital",
      "Biología y Ecología"
    ],
    tipoEvidenciaSugerida: "Portafolio de misiones superadas, tablero de resolución de problemas, bitácora de desafíos o escape room educativo resuelto.",
    rolEstudiante: "Jugador estratégico que aprende explorando y superando obstáculos.",
    rolDocente: "Game master que diseña retos con estricto andamiaje pedagógico.",
    ejemploContextualizadoPuebla: "Escape room educativo en el aula sobre las propiedades periódicas de los elementos: descifrar códigos químicos para 'abrir el laboratorio'."
  },
  {
    id: "practica_laboratorio",
    nombre: "Prácticas de Laboratorio / Taller (Estilo Manual Tecnológico)",
    nombreCorto: "Práctica de Taller",
    definicion: "Estructura rigurosa y procedimental propia de los bachilleratos tecnológicos (CECyTE, DGETI, CBTis) donde el estudiante ejecuta un protocolo técnico paso a paso, analiza el flujo lógico, previene errores frecuentes y elabora un reporte formal con evidencias auténticas.",
    fases: [
      "1. Objetivo general y diagrama de flujo conceptual del proceso",
      "2. Verificación de insumos, herramientas, software y normas de seguridad",
      "3. Procedimiento guiado paso a paso (hands-on) con resultados esperados",
      "4. Análisis de errores frecuentes y acciones correctivas (troubleshooting)",
      "5. Reporte formal de práctica con evidencias, cuestionario y rúbrica"
    ],
    asignaturasRecomendadas: [
      "Módulos Profesionales y Especialidades Técnicas (todos los submódulos)",
      "Laboratorio de Ciencias Naturales (Física, Química, Biología)",
      "Cultura Digital",
      "Dibujo Técnico y Mecatrónica"
    ],
    tipoEvidenciaSugerida: "Reporte de práctica con capturas de pantalla o fotos del prototipo, código fuente documentado, tabla de mediciones y rúbrica analítica calificada.",
    rolEstudiante: "Técnico en formación con disciplina operativa y rigor de análisis.",
    rolDocente: "Instructor técnico y supervisor de calidad y seguridad industrial.",
    ejemploContextualizadoPuebla: "Práctica guiada de detección de fallas en circuitos eléctricos residenciales o programación de un script de análisis de datos para un negocio local."
  },
  {
    id: "abproblemas",
    nombre: "Aprendizaje Basado en Problemas (ABProblemas)",
    nombreCorto: "ABProblemas",
    definicion: "Estrategia didáctica inductiva centrada en el análisis, indagación y resolución colaborativa de situaciones problemáticas complejas y abiertas del entorno, donde el aprendizaje surge del proceso mismo de resolución y no de la transmisión previa de contenidos.",
    fases: [
      "1. Delimitación y clarificación de la situación problema (¿qué sabemos? ¿qué necesitamos saber?)",
      "2. Identificación de necesidades de aprendizaje y activación de saberes previos",
      "3. Búsqueda autónoma e indagación de información técnica, científica o normativa",
      "4. Formulación, contraste y deliberación colectiva de propuestas de solución",
      "5. Presentación argumentada de la resolución y reflexión metacognitiva del proceso"
    ],
    asignaturasRecomendadas: [
      "Pensamiento Matemático",
      "Cultura Digital",
      "Ciencias Sociales",
      "Conservación de la Energía y sus Interacciones",
      "Humanidades"
    ],
    tipoEvidenciaSugerida: "Informe de resolución del problema con modelado cuantitativo o conceptual, árbol de causas-efectos y propuesta comunitaria viable con criterios de factibilidad.",
    rolEstudiante: "Agente resolutor autónomo, analista crítico y deliberador en equipo ante situaciones abiertas sin solución única.",
    rolDocente: "Tutor facilitador del proceso, diseñador del problema detonante auténtico y mediador metacognitivo sin revelar la solución.",
    ejemploContextualizadoPuebla: "Modelación matemática y propuesta técnica para reducir el desabasto hídrico en colonias periurbanas de Tehuacán, o análisis de costos y rutas para mejorar el transporte escolar en municipios de la Sierra Norte de Puebla."
  },
  {
    id: "indagacion",
    nombre: "Aprendizaje Basado en Indagación (ABI)",
    nombreCorto: "Indagación (ABI)",
    definicion: "Metodología fundamentada en la investigación científica escolar donde los estudiantes construyen conocimiento respondiendo preguntas investigables mediante experimentación empírica, recolección sistemática de datos y contrastación de hipótesis con evidencia observable.",
    fases: [
      "1. Focalización: formulación de preguntas investigables a partir de un fenómeno observable",
      "2. Diseño del plan de indagación o protocolo experimental (materiales, variables, controles)",
      "3. Experimentación, recolección y registro sistemático de datos con instrumentos de medición",
      "4. Análisis de resultados, contrastación empírica de hipótesis y formalización conceptual",
      "5. Comunicación de conclusiones científicas, argumentación con evidencia y evaluación del proceso"
    ],
    asignaturasRecomendadas: [
      "La Materia y sus Interacciones",
      "Conservación de la Energía y sus Interacciones",
      "Ecosistemas: Interacciones, Energía y Dinámica",
      "Física",
      "Química",
      "Biología"
    ],
    tipoEvidenciaSugerida: "Bitácora científica de laboratorio o campo con registro fotográfico o esquemático, gráficas de dispersión o tablas de datos y reporte de contrastación empírica con conclusiones argumentadas.",
    rolEstudiante: "Científico escolar, observador riguroso y constructor de explicaciones basadas en evidencia empírica recolectada por el propio equipo.",
    rolDocente: "Guía de la indagación empírica, supervisor de seguridad en laboratorio/campo y promotor del escepticismo metodológico y el pensamiento científico.",
    ejemploContextualizadoPuebla: "Indagación experimental sobre la degradación de suelos agrícolas en Huejotzingo, monitoreo de calidad hídrica con tiras de pH y turbidímetros artesanales en afluentes del río Atoyac, o estudio de biodiversidad en parcelas de la Sierra Negra de Puebla."
  }
];

export const METODOLOGIAS_MAP: Record<string, MetodologiaActiva> = CATALOGO_METODOLOGIAS_ACTIVAS.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<string, MetodologiaActiva>
);

export function obtenerMetodologiaPorId(id: string): MetodologiaActiva | undefined {
  return METODOLOGIAS_MAP[id.toLowerCase().trim()];
}

export function obtenerMetodologiasPorArea(area: string): MetodologiaActiva[] {
  const areaNorm = area.toLowerCase().trim();
  return CATALOGO_METODOLOGIAS_ACTIVAS.filter(m =>
    m.asignaturasRecomendadas.some(a => a.toLowerCase().includes(areaNorm) || areaNorm.includes(a.toLowerCase()))
  );
}
