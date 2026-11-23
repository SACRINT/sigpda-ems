/**
 * disciplinary-adapters/index.ts — Matriz de Estrategias Disciplinares Dinámicas (17 dominios)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Resuelve de forma determinista el perfil disciplinar de cualquier UAC (400+ programas BGE/BT)
 * para inyectar en el Generador de Planeaciones (build-prompt.ts) y en los 4 Escritores
 * del Libro de Texto (foundation, lab, project, evaluation):
 *   1. Enfoque pedagógico y epistemológico propio del área/componente.
 *   2. Equipo físico e instrumental permitido (alineado con catálogos 512x512 y SVG).
 *   3. Herramientas digitales y simuladores pertinentes (CERO contaminación cruzada).
 *   4. Términos y objetos estrictamente prohibidos de otras disciplinas.
 *   5. Ejemplo canónico (Few-Shot) de Secuencia Didáctica situado en la disciplina.
 *   6. Metadatos declarativos para prompts de writers (cuantitativo, normativa NOM/ISO, seguridad, bitácora, checklist).
 */

export type DisciplinaryDomainId =
  | 'pensamiento_matematico'
  | 'ciencias_fisica_ingenieria'
  | 'ciencias_quimica_biologia_ambiental'
  | 'lengua_comunicacion_literatura'
  | 'lengua_extranjera_ingles'
  | 'lengua_extranjera_general'
  | 'conciencia_historica_ciencias_sociales'
  | 'humanidades_filosofia_logica_etica'
  | 'cultura_digital_programacion_ti'
  | 'dibujo_tecnico_diseno_arquitectura'
  | 'actividades_fisicas_deportivas_salud'
  | 'artes_educacion_artistica_cultural'
  | 'socioemocional_tutoria_educacion_integral'
  | 'formacion_laboral_servicios_gestion_turismo'
  | 'formacion_laboral_salud_clinica'
  | 'formacion_laboral_industrial_agro_salud'
  | 'indagacion_interdisciplinaria_general';

export type EpistemologicalFamily =
  | 'cuantitativa_experimental'
  | 'humanistica_comunicativa_social'
  | 'computacional_algoritmica'
  | 'corporal_motriz'
  | 'tecnica_laboral';

export interface DisciplinaryAdapter {
  id: DisciplinaryDomainId;
  displayName: string;
  epistemologicalApproach: string;
  allowedPhysicalEquipment: string[];
  allowedDigitalTools: string[];
  forbiddenCrossDomainTerms: string[];
  workbookVoiceDirective: string;
  fewShotExampleBlock: string;
}

export interface DisciplinaryAdapterV2 extends DisciplinaryAdapter {
  family: EpistemologicalFamily;
  workedExampleDirective: string;
  defaultTableColumns: string[];
  keyFormulaOrRuleDirective: string;
  /** Si la disciplina exige datos numéricos/cuantitativos explícitos en ejemplos y práctica. */
  requiresQuantitativeData: boolean;
  /** Si la disciplina exige normas técnicas/sanitarias explícitas (NOM/ISO/SSA/STPS/NIF) en proyecto y criterios. */
  requiresNormativeStandards: boolean;
  /** Si la disciplina involucra protocolos de seguridad física, EPP, laboratorio o bioseguridad clínica. */
  requiresLabSafety: boolean;
  /** Enfoque pedagógico descriptivo por disciplina para los writers. */
  approachDescriptor: string;
  /** Etiqueta natural del espacio práctico para la Misión 2 (evita "Laboratorio/Taller" en humanidades). */
  practiceSpaceLabel: string;
  /** Directiva de criterios de aceptación para Misión Proyecto (evita NOM/ISO en humanidades). */
  projectAcceptanceDirective: string;
  /** Plantilla de bitácora/registro del proyecto adaptada a la disciplina. */
  projectLogTemplate: string;
  /** Ejemplo de especificaciones de proyecto para el esquema JSON del prompt. */
  projectSpecsExample: [string, string];
  /** Categorías de lista de verificación en Misión Evaluación (elimina "Seguridad" en humanidades). */
  evaluationChecklistCategories: [string, string, string];
  /** Ítem de ejemplo de lista de verificación coherente con la disciplina. */
  evaluationChecklistExample: { item: string; category: string };
}

type DisciplinaryAdapterV2MetaKeys =
  | 'family'
  | 'workedExampleDirective'
  | 'defaultTableColumns'
  | 'keyFormulaOrRuleDirective'
  | 'requiresQuantitativeData'
  | 'requiresNormativeStandards'
  | 'requiresLabSafety'
  | 'approachDescriptor'
  | 'practiceSpaceLabel'
  | 'projectAcceptanceDirective'
  | 'projectLogTemplate'
  | 'projectSpecsExample'
  | 'evaluationChecklistCategories'
  | 'evaluationChecklistExample';

type DisciplinaryAdapterBase = Omit<DisciplinaryAdapterV2, DisciplinaryAdapterV2MetaKeys>;

const ADAPTERS_BASE: Record<DisciplinaryDomainId, DisciplinaryAdapterBase> = {
  pensamiento_matematico: {
    id: 'pensamiento_matematico',
    displayName: 'Pensamiento Matemático, Variacional y Estadístico',
    epistemologicalApproach:
      'Modelación matemática de fenómenos reales de variación, optimización, incertidumbre y geometría analítica; tránsito entre registros algebraico, tabular, gráfico y verbal.',
    allowedPhysicalEquipment: [
      'Calculadora científica',
      'Juego de geometría y compás de precisión',
      'Cinta métrica / flexómetro para medición de campo',
      'Dados poliédricos y urnas estadísticas',
      'Papel milimétrico y bitácora de tabulación',
    ],
    allowedDigitalTools: [
      'GeoGebra Dinámico',
      'Desmos Graphing Calculator',
      'Hoja de cálculo estadística',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar',
      'cuchillo de chef',
      'cautín',
      'matraz erlenmeyer',
      'mechero bunsen',
    ],
    workbookVoiceDirective:
      'Desarrolla demostraciones paso a paso con tasas de cambio, tabulaciones numéricas reales, gráficas en el plano cartesiano y modelación algebraica contextualizada.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Pensamiento Matemático / Variacional | 18h | Corte 1):
  APERTURA (3h):
  - Fenómeno Situado (1.5h): Análisis de la variación del nivel de captación pluvial y caudal de riego en la comunidad. Registro de datos iniciales y formulación de conjeturas sobre razones de cambio.
  - Activación Diagnóstica (1.5h): Identificación de variables dependientes e independientes y representación gráfica preliminar en cuaderno cuadriculado.
  DESARROLLO (12h):
  - Tabulación y Modelación (4h): Construcción de tablas de variación promedio e instantánea a partir de mediciones reales con cinta métrica y cronómetro.
  - Visualización en GeoGebra (4h): Trazado de rectas secantes y aproximación a la recta tangente; contraste entre modelo lineal y cuadrático.
  - Resolución Cooperativa PAEC (4h): Optimización de dimensiones de captación o costos comunitarios mediante modelos algebraicos y límites.
  CIERRE (3h):
  - Socialización de Modelos (2h): Defensa del modelo matemático ante el grupo con gráficas e interpretación de pendientes.
  - Evaluación Formativa y Metacognición (1h): Rúbrica de modelación matemática y autoevaluación de procedimientos.`,
  },

  ciencias_fisica_ingenieria: {
    id: 'ciencias_fisica_ingenieria',
    displayName: 'Ciencias Naturales y Experimentales: Física, Energía y Mecánica',
    epistemologicalApproach:
      'Indagación experimental de fenómenos mecánicos, termodinámicos, electromagnéticos y ondulatorios mediante medición empírica, control de variables y análisis de incertidumbre.',
    allowedPhysicalEquipment: [
      'Multímetro digital',
      'Dinamómetro tubular',
      'Vernier / calibrador pie de rey',
      'Cronómetro digital',
      'Riel de aire / plano inclinado',
      'Termómetro infrarrojo o digital',
      'Fuente de poder CD y protoboard',
    ],
    allowedDigitalTools: [
      'PhET Interactive Simulations (Física)',
      'Phyphox (Sensores del Smartphone)',
      'Tracker Video Analysis',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar',
      'cuchillo de chef',
      'espátula de repostería',
      'balanza romana',
    ],
    workbookVoiceDirective:
      'Incluye diagramas de cuerpo libre, unidades del Sistema Internacional (SI), despeje de ecuaciones físicas, tablas de mediciones experimentales y cálculo de error porcentual.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Ciencias Naturales / Física | 18h | Corte 1):
  APERTURA (3h):
  - Fenómeno Observable (1.5h): Observación de pérdidas de energía mecánica y térmica en sistemas de bombeo o transporte local. Planteamiento de hipótesis cuantitativas.
  - Sondeo de Saberes Previos (1.5h): Diagnóstico sobre fuerzas, trabajo mecánico y conservación de la energía.
  DESARROLLO (12h):
  - Práctica Experimental con Sensores (4h): Medición de aceleración, tiempo y desplazamiento usando cronómetro, cinta métrica y sensores Phyphox.
  - Simulación y Contraste Teórico (4h): Modelado en PhET y cálculo de energía cinética, potencial y potencia disipada.
  - Prototipo Comunitario PAEC (4h): Diseño y prueba de un dispositivo de aprovechamiento energético o mecánico documentado en bitácora.
  CIERRE (3h):
  - Demostración Experimental (2h): Presentación de curvas experimentales y sustentación técnica.
  - Evaluación y Bitácora (1h): Verificación mediante rúbrica de laboratorio y ticket de salida.`,
  },

  ciencias_quimica_biologia_ambiental: {
    id: 'ciencias_quimica_biologia_ambiental',
    displayName: 'Ciencias Naturales: Química, Biología, Ecología y Salud Ambiental',
    epistemologicalApproach:
      'Indagación de sistemas vivos, reacciones químicas, ciclos biogeoquímicos, metabolismo y sustentabilidad ambiental mediante observación microscópica y experimentación segura.',
    allowedPhysicalEquipment: [
      'Microscopio óptico compuesto',
      'Matraz Erlenmeyer y vaso de precipitados',
      'Probeta graduada y pipeta volumétrica',
      'Balanza analítica / báscula digital de precisión',
      'Tiras reactivas de pH y termómetro de laboratorio',
      'Bata de algodón, gafas de seguridad y guantes de nitrilo',
    ],
    allowedDigitalTools: [
      'PhET Interactive Simulations (Química/Biología)',
      'iNaturalist / Biodiversidad Mexicana',
      'PubChem / Tabla Periódica Interactiva',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar de cocina',
      'cuchillo cebollero',
      'esmeriladora angular',
      'router cnc',
      'balanza romana',
    ],
    workbookVoiceDirective:
      'Estructura prácticas de laboratorio con medidas de bioseguridad, reacciones o procesos biológicos detallados, estequiometría o análisis ecológico y tablas de observación.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Química / Biología / Ecología | 18h | Corte 1):
  APERTURA (3h):
  - Fenómeno Ambiental Situado (1.5h): Análisis de calidad del agua, suelo o biodiversidad en la localidad del plantel; formulación de preguntas investigables.
  - Diagnóstico Conceptual (1.5h): Recuperación de saberes sobre materia, enlaces químicos, célula o ecosistemas.
  DESARROLLO (12h):
  - Práctica de Laboratorio / Campo (4h): Medición de pH, temperatura, observación en microscopio óptico o muestreo ecológico con registro en bitácora.
  - Análisis Cuantitativo y Estequiométrico (4h): Interpretación de concentraciones, reacciones o índices de diversidad biológica.
  - Intervención PAEC (4h): Diseño de protocolo de biorremediación, compostaje escolar o monitoreo de salud comunitaria.
  CIERRE (3h):
  - Reporte Científico y Socialización (2h): Exposición de hallazgos con evidencia empírica ante la comunidad escolar.
  - Evaluación Formativa (1h): Lista de cotejo de bioseguridad y rúbrica de informe científico.`,
  },

  lengua_comunicacion_literatura: {
    id: 'lengua_comunicacion_literatura',
    displayName: 'Lengua y Comunicación, Lectura, Expresión Oral y Literatura',
    epistemologicalApproach:
      'Práctica social del lenguaje, comprensión lectora crítica, producción de textos argumentativos/ensayísticos, análisis del discurso, apreciación literaria y oralidad formal.',
    allowedPhysicalEquipment: [
      'Antología de textos y corpus hemerográfico',
      'Fichas de trabajo bibliográficas y hemerográficas',
      'Bitácora de escritura y portafolio de redacción',
      'Grabadora de voz / micrófono para crónica o podcast escolar',
      'Diccionario etimológico y de sinónimos',
    ],
    allowedDigitalTools: [
      'Diccionario de la Lengua Española (RAE) / Corpus CORPES',
      'Perusall / Lectura Social y Anotación Textual',
      'ZoteroBib / Gestor de Referencias APA',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'cautín',
      'matraz',
      'tabla de cortar',
      'cuchillo',
      'plano cartesiano para tabulación',
      'osciloscopio',
    ],
    workbookVoiceDirective:
      'Enfoca los ejercicios en análisis de textos modelo, identificación de tesis y argumentos, redacción guiada en borradores sucesivos, conectores discursivos y producción oral/escrita.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Lengua y Comunicación / Literatura | 18h | Corte 1):
  APERTURA (3h):
  - Situación Comunicativa Real (1.5h): Lectura comentada de crónicas y testimonios locales sobre la problemática comunitaria del PAEC.
  - Exploración Diagnóstica (1.5h): Identificación de intención comunicativa, estructura textual y voces narrativas.
  DESARROLLO (12h):
  - Taller de Análisis Crítico (4h): Subrayado estructural, elaboración de fichas de comentario y matriz comparativa de fuentes primarias y secundarias.
  - Proceso de Escritura Planificada (4h): Redacción de borrador de ensayo o crónica comunitaria cuidando coherencia, cohesión y citación APA.
  - Revisión entre Pares y Oralidad (4h): Coevaluación de borradores y preparación de círculo de lectura o foro de debate escolar.
  CIERRE (3h):
  - Publicación y Foro Oral (2h): Presentación pública de las crónicas o ensayos ante el grupo y difusión en gaceta escolar.
  - Evaluación Formativa (1h): Rúbrica de producción escrita y expresión oral.`,
  },

  lengua_extranjera_ingles: {
    id: 'lengua_extranjera_ingles',
    displayName: 'Lengua Extranjera (Inglés)',
    epistemologicalApproach:
      'Enfoque comunicativo por tareas (Task-Based Language Teaching - MCER A1-B1) desarrollando las 4 habilidades lingüísticas (Listening, Speaking, Reading, Writing) en contextos situados.',
    allowedPhysicalEquipment: [
      'Flashcards de vocabulario y estructuras gramaticales',
      'Guion de role-play y tarjetas de diálogo situado',
      'Reproductor de audio / bocina para comprensión auditiva',
      'Bitácora bilingüe (Vocabulary & Grammar Journal)',
    ],
    allowedDigitalTools: [
      'Cambridge English Write & Improve / British Council LearnEnglish',
      'WordReference / Oxford Learner’s Dictionaries',
      'Vocaroo / Grabador de pronunciación para Speaking',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'tabla de cortar',
      'matraz',
      'plano cartesiano',
      'osciloscopio',
    ],
    workbookVoiceDirective:
      'Combina explicaciones claras en español con textos modelo, diálogos situados, tablas gramaticales (Affirmative/Negative/Interrogative), vocabulario contextualizado y ejercicios en inglés.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Inglés | 18h | Corte 1):
  APERTURA (3h):
  - Communicative Trigger (1.5h): Presentación de un diálogo o infografía en inglés sobre hábitos saludables y vida comunitaria (PAEC).
  - Lexical & Diagnostic Activation (1.5h): Brainstorming de vocabulario clave y estructuras comunicativas previas.
  DESARROLLO (12h):
  - Language Focus & Modeling (4h): Análisis inductivo de patrones gramaticales en contexto real y práctica de pronunciación (Listening & Drilling).
  - Guided Collaborative Practice (4h): Redacción colaborativa de perfiles, entrevistas o folletos informativos bilingües sobre la comunidad.
  - Role-Play & Task Production (4h): Simulación de diálogos situados en parejas con retroalimentación formativa.
  CIERRE (3h):
  - Oral Showcase (2h): Presentación oral del proyecto comunicativo en inglés vinculada al PAEC.
  - Self-Assessment & Rubric (1h): Evaluación de las 4 habilidades (Reading, Writing, Listening, Speaking).`,
  },

  lengua_extranjera_general: {
    id: 'lengua_extranjera_general',
    displayName: 'Lengua Extranjera Adicional (Enfoque Comunicativo MCER)',
    epistemologicalApproach:
      'Enfoque comunicativo por tareas (MCER A1-B1) en el idioma objetivo de la UAC, desarrollando comprensión auditiva, comprensión lectora, producción oral y escrita en contextos cotidianos y comunitarios.',
    allowedPhysicalEquipment: [
      'Tarjetas de vocabulario y estructuras gramaticales en la lengua meta',
      'Guion de diálogo situado y juego de roles comunicativo',
      'Reproductor de audio para ejercicios de comprensión auditiva',
      'Bitácora bilingüe de vocabulario y gramática en contexto',
    ],
    allowedDigitalTools: [
      'Diccionarios bilingües de referencia (WordReference / Larousse / Linguee)',
      'Portales educativos oficiales del idioma objetivo (TV5MONDE / Institut Français / Deutsche Welle según la UAC)',
      'Grabador de audio para práctica de pronunciación y expresión oral',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'tabla de cortar',
      'matraz',
      'plano cartesiano',
      'osciloscopio',
    ],
    workbookVoiceDirective:
      'Combina explicaciones claras en español con textos modelo, diálogos situados, tablas gramaticales (afirmativa, negativa e interrogativa) y ejercicios redactados estrictamente en la lengua meta de la UAC (nunca sustituyas el idioma de la asignatura por inglés ni por otra lengua ajena).',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Lengua Extranjera Adicional | 18h | Corte 1):
  APERTURA (3h):
  - Detonador Comunicativo (1.5h): Presentación de un diálogo o cartel breve en la lengua meta sobre la vida cotidiana y el proyecto PAEC.
  - Activación Léxica (1.5h): Recuperación de vocabulario conocido y expresiones funcionales básicas.
  DESARROLLO (12h):
  - Análisis Gramatical Inductivo (4h): Observación de estructuras comunicativas en contexto real y práctica guiada de pronunciación.
  - Producción Escrita Colaborativa (4h): Redacción en equipo de presentaciones, entrevistas o folletos informativos en la lengua meta.
  - Interacción Oral Situada (4h): Simulación de diálogos cotidianos en parejas con retroalimentación entre pares.
  CIERRE (3h):
  - Muestra Comunicativa Oral (2h): Presentación del producto comunicativo en la lengua meta vinculado al PAEC.
  - Evaluación Formativa (1h): Rúbrica de las 4 habilidades lingüísticas (comprensión auditiva, lectura, escritura y oralidad).`,
  },

  conciencia_historica_ciencias_sociales: {
    id: 'conciencia_historica_ciencias_sociales',
    displayName: 'Conciencia Histórica, Ciencias Sociales, Economía y Derecho',
    epistemologicalApproach:
      'Pensamiento crítico histórico y social: análisis de fuentes primarias/secundarias, multicausalidad, cambio y permanencia, estructura socioeconómica, marco jurídico y derechos humanos.',
    allowedPhysicalEquipment: [
      'Fuentes primarias documentales y archivo hemerográfico',
      'Mapas históricos, geográficos y socioeconómicos de Puebla y México',
      'Constitución Política y compendio de legislación / Derechos Humanos',
      'Cédulas de entrevista e instrumentos de diagnóstico comunitario',
      'Línea del tiempo mural y fichas de análisis historiográfico',
    ],
    allowedDigitalTools: [
      'INEGI Mapa Digital de México / Indicadores Demográficos',
      'Mediateca INAH / Memórica México',
      'KnightLab TimelineJS (Líneas del Tiempo Interactivas)',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'tabla de cortar',
      'cuchillo',
      'matraz',
      'cautín',
      'osciloscopio',
    ],
    workbookVoiceDirective:
      'Presenta análisis crítico de procesos históricos, indicadores socioeconómicos reales (INEGI/CONEVAL), marcos legales vigentes, matrices de causas-consecuencias y estudios de caso regionales.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Conciencia Histórica / Ciencias Sociales | 18h | Corte 1):
  APERTURA (3h):
  - Problematización del Presente (1.5h): Análisis de cómo la problemática comunitaria del PAEC tiene raíces históricas, económicas y jurídicas en la región.
  - Recuperación de Saberes (1.5h): Lluvia de ideas estructurada sobre actores sociales, instituciones y procesos históricos locales.
  DESARROLLO (12h):
  - Crítica de Fuentes y Datos (4h): Contraste de fuentes documentales, estadísticas del INEGI y testimonios de historia oral comunitaria.
  - Matriz de Multicausalidad (4h): Elaboración de líneas del tiempo analíticas y cuadros comparativos de dimensiones políticas, económicas y sociales.
  - Investigación Situada PAEC (4h): Diagnóstico socioeconómico o jurídico de la comunidad con propuestas de participación ciudadana.
  CIERRE (3h):
  - Mesa de Análisis Público (2h): Debate fundamentado de hallazgos y propuestas de transformación social.
  - Evaluación Formativa (1h): Rúbrica de pensamiento histórico-social y argumentación crítica.`,
  },

  humanidades_filosofia_logica_etica: {
    id: 'humanidades_filosofia_logica_etica',
    displayName: 'Humanidades, Filosofía, Lógica, Ética y Estética',
    epistemologicalApproach:
      'Comunidad de indagación filosófica, diálogo socrático, reconstrucción y evaluación lógica de argumentos, deliberación bioética/política y problematización de la experiencia humana.',
    allowedPhysicalEquipment: [
      'Textos filosóficos clásicos y contemporáneos seleccionados',
      'Tarjetas de falacias y esquemas de argumentación lógica',
      'Bitácora filosófica de deliberación ética',
      'Casos de dilemas éticos y bioéticos comunitarios',
    ],
    allowedDigitalTools: [
      'Encyclopaedia Herder / Stanford Encyclopedia of Philosophy',
      'Kialo Edu (Mapas de Argumentación y Debate Estructurado)',
      'PhilPapers / Repositorio de Textos Humanísticos',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'tabla de cortar',
      'cuchillo',
      'matraz',
      'cautín',
      'plano cartesiano para tabulación',
    ],
    workbookVoiceDirective:
      'Desarrolla disertaciones filosóficas claras, reconstrucción de premisas y conclusiones, identificación de falacias, contraejemplos y deliberación de dilemas éticos situados.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Humanidades / Filosofía / Lógica | 18h | Corte 1):
  APERTURA (3h):
  - Asombro y Dilema Ético Situado (1.5h): Planteamiento de un dilema ético-político derivado de la problemática comunitaria del PAEC.
  - Cuestionamiento Socrático (1.5h): Formulación de preguntas filosóficas radicales sobre justicia, libertad, agencia y convivencia.
  DESARROLLO (12h):
  - Lectura Hermenéutica (4h): Análisis de posturas filosóficas clásicas y contemporáneas aplicables al problema situado.
  - Taller de Lógica y Argumentación (4h): Identificación de premisas, conclusiones, validez argumentativa y detección de falacias en discursos cotidianos.
  - Comunidad de Indagación PAEC (4h): Redacción de ensayo filosófico breve y preparación de diálogo deliberativo.
  CIERRE (3h):
  - Café Filosófico / Disertación Pública (2h): Deliberación colectiva fundamentada ante el grupo.
  - Evaluación Formativa (1h): Rúbrica de rigor argumentativo y reflexión metacognitiva.`,
  },

  cultura_digital_programacion_ti: {
    id: 'cultura_digital_programacion_ti',
    displayName: 'Cultura Digital, Pensamiento Algorítmico, Programación y TI',
    epistemologicalApproach:
      'Pensamiento computacional, diseño de algoritmos, desarrollo de software, bases de datos, ciberseguridad, ciencia de datos e impacto ético de las tecnologías de la información.',
    allowedPhysicalEquipment: [
      'Equipo de cómputo / laptop o dispositivo móvil',
      'Plantillas de diagramas de flujo y pseudocódigo en papel (Garantía Dual Offline)',
      'Tarjetas de trazado de variables (Prueba de escritorio)',
      'Kit de redes / cableado UTP o microcontrolador (según submódulo)',
    ],
    allowedDigitalTools: [
      'Python / Google Colab / Replit',
      'PSeInt / Flowgorithm (Algoritmos y Diagramas de Flujo)',
      'Scratch / MakeCode / LibreOffice Calc',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar de madera',
      'cuchillo cebollero',
      'matraz erlenmeyer',
      'mechero bunsen',
      'balanza romana',
    ],
    workbookVoiceDirective:
      'Incluye algoritmos paso a paso, tablas de prueba de escritorio (traza de variables), bloques de código o fórmulas de hoja de cálculo comentadas y su equivalente offline en cuaderno.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Cultura Digital / Programación | 18h | Corte 1):
  APERTURA (3h):
  - Problema de Automatización Comunitaria (1.5h): Identificación de necesidades de procesamiento de datos o difusión digital en el proyecto PAEC.
  - Descomposición del Problema (1.5h): Definición de entradas, procesos, salidas y restricciones técnicas.
  DESARROLLO (12h):
  - Diseño Algorítmico y Prueba de Escritorio (4h): Construcción de diagramas de flujo y pseudocódigo validados en papel y en entorno digital.
  - Implementación Técnica (4h): Codificación, estructuración de hojas de cálculo o desarrollo digital con validación de datos.
  - Proyecto Digital PAEC (4h): Pruebas de usabilidad, seguridad digital y documentación técnica de la solución.
  CIERRE (3h):
  - Demostración Funcional (2h): Presentación de la solución digital o prototipo algorítmico en funcionamiento.
  - Evaluación Formativa (1h): Lista de cotejo técnica y rúbrica de calidad del producto digital.`,
  },

  dibujo_tecnico_diseno_arquitectura: {
    id: 'dibujo_tecnico_diseno_arquitectura',
    displayName: 'Dibujo Técnico, Expresión Gráfica, Diseño y Planimetría',
    epistemologicalApproach:
      'Representación geométrica normalizada (ISO/NOM), proyecciones ortogonales (sistema diédrico americano y europeo), perspectiva isométrica, acotación técnica, escalas y diseño asistido por computadora (CAD).',
    allowedPhysicalEquipment: [
      'Escalímetro triangular profesional (escalas 1:100, 1:50, 1:20, 1:25, 1:75, 1:125)',
      'Juego de escuadras profesionales (45° y 30°/60°) sin bisel',
      'Compás de precisión con extensión y regla T / paralela',
      'Lápices de dibujo graduados (2H, HB, 2B) y estilógrafos técnicos',
      'Láminas de papel bond / opalina formato A3 o A4 con cuadro de referencia normalizado',
      'Flexómetro de cinta metálica para levantamiento dimensional físico',
    ],
    allowedDigitalTools: [
      'LibreCAD / AutoCAD Web (Diseño Técnico 2D Normalizado)',
      'GeoGebra Geometría y Construcciones',
      'SketchUp Web / FreeCAD (Modelado Volumétrico Isométrico)',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar',
      'tabla de picar',
      'cuchillo',
      'cuchillo de chef',
      'chef',
      'cocina',
      'sartén',
      'olla',
      'matraz',
      'reactivo químico',
      'balanza romana',
      'cautín',
    ],
    workbookVoiceDirective:
      'Detalla trazos geométricos paso a paso con instrumentos (escuadras, compás, escalímetro), calidades de línea (continua gruesa, fina, oculta, ejes), cálculo de escalas (E = D / R) y vistas ortogonales/isométricas. Usa analogías situadas EXCLUSIVAMENTE en arquitectura, obras civiles, urbanismo, mecánica, diseño industrial, topografía o construcción. QUEDA TERMINANTEMENTE PROHIBIDO usar analogías de gastronomía, chefs, cocina o preparación de alimentos.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Dibujo Técnico I | 18h | Corte 1):
  APERTURA (3h):
  - Levantamiento Dimensional Situado (1.5h): Recorrido técnico en el plantel o espacio público del PAEC para identificar estructuras que requieren representación en planos a escala.
  - Diagnóstico de Trazado y Normativa (1.5h): Reconocimiento de formatos normalizados (A4/A3), cuadro de datos, rotulación técnica y manejo de escuadras a 30°, 45° y 60°.
  DESARROLLO (12h):
  - Trazado Geométrico y Calidades de Línea (4h): Ejecución de láminas de líneas normalizadas (visibles, ocultas, ejes y cotas) y construcciones geométricas con compás y escuadras.
  - Escalas y Acotación Técnica (4h): Levantamiento físico con flexómetro y conversión a escalas de reducción y ampliación (1:50, 1:100, 1:20) usando escalímetro triangular.
  - Proyecciones Ortogonales e Isométricas PAEC (4h): Dibujo de vistas principales (alzado, planta y perfil lateral) e isométrico a 30° del equipamiento o espacio comunitario del PAEC.
  CIERRE (3h):
  - Crítica de Láminas y Portafolio Técnico (2h): Exposición de láminas normalizadas verificando precisión dimensional, limpieza y rotulación.
  - Evaluación Formativa (1h): Lista de cotejo de normas de dibujo técnico y rúbrica de precisión gráfica.`,
  },

  actividades_fisicas_deportivas_salud: {
    id: 'actividades_fisicas_deportivas_salud',
    displayName: 'Actividades Físicas y Deportivas, Educación Física y Recreación',
    epistemologicalApproach:
      'Corpereidad consciente, motricidad, juego como derecho humano, rescate de juegos tradicionales, acondicionamiento físico saludable, inclusión, trabajo cooperativo y prevención de riesgos psicosociales.',
    allowedPhysicalEquipment: [
      'Cronómetro deportivo digital',
      'Cinta métrica / flexómetro para medición de pistas y circuitos',
      'Conos deportivos de señalización, aros y cuerdas para saltar',
      'Balones deportivos (fútbol, básquetbol, voleibol) y silbato',
      'Bitácora de frecuencia cardíaca (ppm) e índice de esfuerzo percibido (Escala de Borg)',
      'Cancha de usos múltiples o patio escolar seguro',
    ],
    allowedDigitalTools: [
      'Kinovea (Análisis Biomecánico y Deportivo en Video)',
      'Tabata Timer & Monitor de Frecuencia Cardíaca HIIT',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar',
      'cuchillo',
      'plano cartesiano para tabulación',
      'geogebra',
      'scratch',
      'makecode',
      'cautín',
      'multímetro',
      'vernier',
      'matraz',
    ],
    workbookVoiceDirective:
      'Enfoca todas las actividades en motricidad, fisiología del ejercicio básica (frecuencia cardíaca en reposo y esfuerzo en ppm, calentamiento articular, hidratación), reglamento deportivo, inclusión y circuitos motores en cancha.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Actividades Físicas y Deportivas | 12h | Corte 1):
  APERTURA (2h):
  - Activación Diagnóstica y Derecho al Juego (1h): Dinámica grupal en cancha sobre el juego como derecho humano y rescate de juegos tradicionales de la comunidad. Toma de frecuencia cardíaca basal (ppm).
  - Problematización del Sedentarismo (1h): Reflexión sobre el impacto del sedentarismo juvenil y acuerdo de seguridad e hidratación en cancha.
  DESARROLLO (8h):
  - Estaciones de Juegos Tradicionales y Motricidad (3h): Práctica activa de juegos tradicionales regionales y circuitos de agilidad, coordinación y velocidad de reacción medidos con cronómetro.
  - Acondicionamiento Físico y Monitoreo Fisiológico (3h): Ejecución de fases de calentamiento, fase medular aeróbica/anaeróbica y vuelta a la calma, registrando pulsaciones por minuto (ppm) antes y después del esfuerzo.
  - Circuito Deportivo Inclusivo PAEC (2h): Diseño y aplicación por equipos de un circuito de activación neuromuscular adaptado a la diversidad corporal para la comunidad escolar.
  CIERRE (2h):
  - Festival Recreativo y Socialización (1h): Demostración práctica de los circuitos motrices con participación grupal.
  - Evaluación Formativa (1h): Bitácora corporal de frecuencia cardíaca y rúbrica de desempeño motriz y trabajo colaborativo.`,
  },

  artes_educacion_artistica_cultural: {
    id: 'artes_educacion_artistica_cultural',
    displayName: 'Educación Artística y Cultural, Artes Visuales, Música, Danza y Teatro',
    epistemologicalApproach:
      'Sensibilidad estética, apreciación crítica del patrimonio cultural, expresión creativa (plástica, sonora, escénica o corporal) e identidad comunitaria.',
    allowedPhysicalEquipment: [
      'Cuaderno de bocetos (Sketchbook) y papel marquilla / acuarela',
      'Lápices de dibujo artístico, carboncillo, pinceles y pigmentos acrílicos/acuarela',
      'Instrumentos musicales acústicos / percusión corporal o vestuario escénico',
      'Fichas de catalogación de patrimonio cultural e iconográfico comunitario',
    ],
    allowedDigitalTools: [
      'Google Arts & Culture / Mexicana Repositorio de Patrimonio Cultural',
      'Krita / Canva / MediBang (Composición Visual)',
      'Audacity / MuseScore (Creación Sonora)',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'tabla de cortar de cocina',
      'cuchillo cebollero',
      'matraz',
      'cautín',
    ],
    workbookVoiceDirective:
      'Desarrolla análisis de elementos formales del arte (composición, ritmo, color, perspectiva, sonoridad o expresión escénica), procesos de bocetaje y creación artística vinculada a la memoria cultural local.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Artes / Educación Artística | 12h | Corte 1):
  APERTURA (2h):
  - Experiencia Estética Situada (1h): Apreciación de manifestaciones artísticas, artesanales o sonoras de la región de Puebla vinculadas al PAEC.
  - Sensibilización y Bocetaje Inicial (1h): Exploración sensorial de formas, ritmos, colores o movimientos corporales.
  DESARROLLO (8h):
  - Lenguaje y Técnica Artística (4h): Práctica guiada de composición visual, plástica, sonora o escénica en taller escolar.
  - Obra Colectiva PAEC (4h): Creación de boceto y producción de pieza artística (mural, cartel, ensamble o intervención cultural) con identidad comunitaria.
  CIERRE (2h):
  - Galería / Muestra Escolar (1.5h): Montaje curatorial y presentación pública con cédula de obra.
  - Evaluación Formativa (0.5h): Bitácora de proceso creativo y rúbrica de expresión artística.`,
  },

  socioemocional_tutoria_educacion_integral: {
    id: 'socioemocional_tutoria_educacion_integral',
    displayName: 'Formación Socioemocional, Educación para la Salud, Sexualidad y Práctica Social',
    epistemologicalApproach:
      'Desarrollo socioemocional integral, autoconocimiento, regulación emocional, educación integral en sexualidad y género, prevención de adicciones, cultura de paz y aprendizaje-servicio (ApS).',
    allowedPhysicalEquipment: [
      'Bitácora de reflexión personal y diario socioemocional',
      'Tarjetas de casos para círculos de paz y mediación escolar',
      'Cartulinas, marcadores y material para campañas de prevención comunitaria',
      'Guías oficiales de salud adolescente y derechos sexuales y reproductivos',
    ],
    allowedDigitalTools: [
      'Portal CONADIC / Secretaría de Salud (Prevención y Salud Integral)',
      'ONU Mujeres / CONAPRED (Igualdad, No Discriminación y Cultura de Paz)',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'vernier',
      'tabla de cortar',
      'cuchillo',
      'matraz',
      'cautín',
      'plano cartesiano',
    ],
    workbookVoiceDirective:
      'Aborda casos vivenciales respetuosos, herramientas de regulación emocional, protocolos de autocuidado, prevención de riesgos psicosociales, derechos humanos y acciones de impacto comunitario.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Formación Socioemocional / Salud Integral | 12h | Corte 1):
  APERTURA (2h):
  - Círculo de Diálogo y Diagnóstico Vivencial (1h): Reflexión grupal en ambiente seguro sobre factores de bienestar y riesgos psicosociales en la comunidad (PAEC).
  - Reconocimiento de Factores Protectores (1h): Identificación de redes de apoyo escolar, familiar y comunitario.
  DESARROLLO (8h):
  - Análisis de Casos y Toma de Decisiones (4h): Estudio de escenarios reales sobre salud integral, convivencia pacífica y prevención de conductas de riesgo.
  - Acción de Aprendizaje-Servicio PAEC (4h): Diseño de estrategia o campaña de promoción del bienestar y prevención en el plantel.
  CIERRE (2h):
  - Socialización Comunitaria (1.5h): Presentación de acuerdos de convivencia y materiales preventivos.
  - Evaluación Formativa (0.5h): Autoevaluación reflexiva y escala valorativa de participación.`,
  },

  formacion_laboral_servicios_gestion_turismo: {
    id: 'formacion_laboral_servicios_gestion_turismo',
    displayName: 'Formación Laboral y Tecnológica: Administración, Contabilidad, Turismo, Gastronomía, Estética, Confección y Servicios',
    epistemologicalApproach:
      'Competencia laboral y emprendimiento situado: aplicación de estándares de calidad en el servicio, higiene, normativas oficiales (NOM/Distintivo H/NIF según especialidad), gestión administrativa, costos, confección/diseño y atención al cliente.',
    allowedPhysicalEquipment: [
      'Formatos contables, pólizas, arqueo de caja y calculadora financiera (Administración/Contabilidad)',
      'Utensilios de cocina profesional, tabla de picar por código de color, cuchillo chef, termómetro de alimentos y cofia/red (SOLO en Gastronomía/Alimentos)',
      'Bitácora de operación turística, guion de recorrido patrimonial y directorio de servicios (Turismo/Hospitalidad)',
      'Cinta métrica, patrones de trazo, ficha técnica de prenda o servicio y listas de verificación de higiene y calidad (Confección/Estética/Servicios)',
    ],
    allowedDigitalTools: [
      'Hoja de Cálculo Financiera y de Costos (Excel / Calc)',
      'Sistema de Punto de Venta / Simulador Contable y Fiscal SAT',
      'Canva / Gestor de Proyectos y Marketing de Servicios',
    ],
    forbiddenCrossDomainTerms: [
      'osciloscopio',
      'riel de aire',
      'microscopio compuesto',
      'balanza romana',
      'multímetro',
      'cautín',
    ],
    workbookVoiceDirective:
      'Desarrolla procedimientos operativos estandarizados (POE), cálculo de costos/presupuestos reales, simulación de casos laborales del sector servicios y verificación de normas oficiales aplicables a la especialidad.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Formación Laboral: Servicios, Gestión y Turismo | 18h | Corte 1):
  APERTURA (3h):
  - Caso Empresarial / Productivo Local (1.5h): Análisis de una necesidad real del sector servicios, comercial o turístico vinculada al PAEC en el municipio.
  - Diagnóstico de Normativa y Estándares (1.5h): Identificación de requisitos legales, de higiene o administrativos aplicables.
  DESARROLLO (12h):
  - Procedimiento Operativo Estandarizado (4h): Modelado paso a paso del proceso técnico (registro contable, costeo de servicio o protocolo de atención).
  - Práctica Simulada Nivel 2 (4h): Ejecución en equipos de trabajo con formatos profesionales y cálculo de indicadores de costo/rendimiento.
  - Proyecto Productivo PAEC (4h): Propuesta de mejora operativa o emprendimiento comunitario sostenible.
  CIERRE (3h):
  - Simulación Práctica Evaluable (2h): Demostración del servicio o defensa del plan operativo ante jurado escolar.
  - Evaluación de Competencia Laboral (1h): Lista de cotejo de estándares técnicos y rúbrica profesional.`,
  },

  formacion_laboral_salud_clinica: {
    id: 'formacion_laboral_salud_clinica',
    displayName: 'Formación Laboral y Ciencias de la Salud: Enfermería, Atención Clínica, Farmacia, Nutrición y Mecánica Dental',
    epistemologicalApproach:
      'Competencia clínica, preventiva y técnico-sanitaria bajo bioseguridad estricta, normatividad mexicana de salud (NOM-SSA, RPBI, COFEPRIS, Guías de Práctica Clínica CENETEC), registro preciso y seguridad del paciente.',
    allowedPhysicalEquipment: [
      'Equipo de Protección Personal clínico (bata, guantes de látex o nitrilo, cubrebocas y careta)',
      'Baumanómetro, estetoscopio, oxímetro de pulso, termómetro clínico y material de curación (Enfermería / Primeros Auxilios / Ciencias de la Salud)',
      'Material de esterilización (CEYE), recetario, etiquetas de control e inventario farmacéutico (Área de la Salud / Farmacia)',
      'Modelos de yeso, cubetas/portaimpresiones, ceras dentales, articulador, alicates de ortodoncia y fichas de prescripción odontológica (Mecánica Dental)',
    ],
    allowedDigitalTools: [
      'Guías de Práctica Clínica CENETEC (Secretaría de Salud)',
      'Catálogo de Normas Oficiales Mexicanas en Salud (NOM-SSA / COFEPRIS)',
      'Atlas Anatómico y Odontológico 3D de consulta formativa',
    ],
    forbiddenCrossDomainTerms: [
      'multímetro',
      'cautín',
      'osciloscopio',
      'tabla de cortar',
      'cuchillo de chef',
      'varilla corrugada',
      'mezcla de cemento',
      'balanza romana',
    ],
    workbookVoiceDirective:
      'Estructura protocolos clínicos, farmacéuticos o de laboratorio dental con medidas explícitas de bioseguridad (EPP, asepsia, manejo de RPBI), registros clínicos o de orden de trabajo, parámetros sanitarios medibles y criterios de seguridad del paciente.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Formación Laboral: Salud Clínica / Enfermería / Mecánica Dental | 18h | Corte 1):
  APERTURA (3h):
  - Caso Clínico o Prescripción Situada (1.5h): Análisis de una necesidad real de atención sanitaria, preventiva o protésica vinculada al PAEC comunitario.
  - Protocolo de Bioseguridad y Normativa (1.5h): Verificación de higiene de manos, EPP clínico y normas oficiales aplicables (NOM-SSA / RPBI).
  DESARROLLO (12h):
  - Demostración de Protocolo Sanitario (4h): Modelado paso a paso del procedimiento clínico, farmacéutico o protésico con registro de control.
  - Práctica Supervisada en Estaciones (4h): Ejecución en equipo aplicando lista de verificación de asepsia, dosificación o ajuste y control de calidad.
  - Intervención Preventiva PAEC (4h): Diseño de campaña de salud comunitaria o documentación completa del servicio clínico.
  CIERRE (3h):
  - Demostración Práctica Evaluable (2h): Ejecución íntegra del protocolo con verificación de seguridad del paciente y entrega de bitácora.
  - Evaluación de Competencia Sanitaria (1h): Lista de cotejo de bioseguridad y rúbrica de precisión clínica.`,
  },

  formacion_laboral_industrial_agro_salud: {
    id: 'formacion_laboral_industrial_agro_salud',
    displayName: 'Formación Laboral y Tecnológica: Industrial, Eléctrica, Domótica, Construcción y Agropecuaria',
    epistemologicalApproach:
      'Competencia técnica de taller industrial, instalaciones o campo agropecuario/forestal bajo normas de seguridad e higiene (NOM-STPS / NOM-SEDE / SENASICA), diagnóstico instrumental y control de tolerancias.',
    allowedPhysicalEquipment: [
      'Equipo de Protección Personal (EPP) acorde a la especialidad (gafas, guantes dieléctricos o de carnaza, casco o calzado de seguridad)',
      'Multímetro, cautín, osciloscopio, vernier, pinzas de electricista o herramienta mecánica (Especialidades Industriales/Eléctricas/Domótica)',
      'Flexómetro, nivel de burbuja, escuadra, herramienta de trazo y montaje (Construcción e Instalaciones Residenciales)',
      'Potenciómetro de suelo, cinta diamétrica, instrumental agronómico, muestreadores y sustratos (Especialidades Agropecuarias y Ecosistemas)',
    ],
    allowedDigitalTools: [
      'Tinkercad Circuits / Proteus / FluidSIM (Electrónica, Electricidad y Domótica)',
      'Manuales Técnicos NOM-STPS / NOM-001-SEDE / Portales Agropecuarios SIAP-SENASICA',
    ],
    forbiddenCrossDomainTerms: [
      'balanza romana',
      'báscula de dos platillos',
      'tabla de cortar',
      'cuchillo de chef',
    ],
    workbookVoiceDirective:
      'Estructura prácticas de taller o campo con protocolos estrictos de seguridad (EPP), diagramas técnicos, tablas de diagnóstico instrumental y resolución de fallas o casos productivos reales.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Formación Laboral / Carrera Técnica | 18h | Corte 1):
  APERTURA (3h):
  - Orden de Trabajo / Caso Técnico Situado (1.5h): Presentación de una problemática técnica real de taller, clínica o producción agropecuaria vinculada al PAEC.
  - Protocolo de Seguridad y Diagnóstico (1.5h): Verificación de Equipo de Protección Personal (EPP) y reconocimiento de instrumentos de medición.
  DESARROLLO (12h):
  - Demostración Instrumental Guiada (4h): Uso normado de instrumentos de diagnóstico y registro de parámetros técnicos en bitácora.
  - Práctica de Taller / Campo en Equipos (4h): Ejecución del procedimiento técnico estándar, control de calidad y corrección de desviaciones.
  - Aplicación Comunitaria PAEC (4h): Implementación de mantenimiento, prototipo funcional o intervención técnica documentada.
  CIERRE (3h):
  - Prueba Funcional y Entrega Técnica (2h): Demostración práctica del protocolo o producto bajo criterios de tolerancia y seguridad.
  - Evaluación por Competencias (1h): Lista de cotejo de desempeño técnico y rúbrica de reporte de taller.`,
  },

  indagacion_interdisciplinaria_general: {
    id: 'indagacion_interdisciplinaria_general',
    displayName: 'Formación Curricular General e Indagación Interdisciplinaria (MCCEMS)',
    epistemologicalApproach:
      'Construcción crítica del conocimiento mediante indagación situada, análisis de problemas reales, contrastación de fuentes de información, resolución estructurada de casos y transferencia al entorno escolar y comunitario.',
    allowedPhysicalEquipment: [
      'Cuaderno de trabajo y bitácora de indagación',
      'Fuentes documentales, lecturas seleccionadas y estudios de caso',
      'Organizadores gráficos (mapas conceptuales, cuadros comparativos, diagramas)',
      'Instrumentos de registro y observación de campo',
    ],
    allowedDigitalTools: [
      'Bibliotecas y repositorios académicos digitales institucionales',
      'Herramientas de elaboración de esquemas y presentaciones',
      'Buscadores académicos y portales de datos públicos oficiales (INEGI / SEP)',
    ],
    forbiddenCrossDomainTerms: [
      'tabla de cortar',
      'cuchillo de chef',
      'matraz erlenmeyer',
      'mechero bunsen',
      'microscopio compuesto',
      'tiras reactivas de pH',
      'cautín',
      'osciloscopio',
      'balanza romana',
    ],
    workbookVoiceDirective:
      'Desarrolla explicaciones conceptuales rigurosas, estudios de caso analizados paso a paso, tablas comparativas claras y actividades de aplicación situada pertinentes al objeto de estudio de la UAC.',
    fewShotExampleBlock: `SECUENCIA DIDÁCTICA EJEMPLO (Indagación Curricular MCCEMS | 18h | Corte 1):
  APERTURA (3h):
  - Problematización Situada (1.5h): Análisis de un caso real vinculado a los contenidos de la UAC y su relación con el entorno escolar.
  - Diagnóstico de Saberes Previos (1.5h): Recuperación de conceptos antecedentes mediante preguntas detonadoras y organizador gráfico inicial.
  DESARROLLO (12h):
  - Fundamentación y Modelado (4h): Construcción de conceptos centrales, análisis de ejemplos resueltos y contrastación de fuentes confiables.
  - Práctica Guiada y Colaborativa (4h): Resolución de casos prácticos y ejercicios estructurados en equipos con retroalimentación formativa.
  - Aplicación al Proyecto Integrador (4h): Elaboración de avance tangible del producto del bloque aplicando los criterios de la asignatura.
  CIERRE (3h):
  - Socialización de Evidencias (2h): Presentación argumentada de resultados y revisión entre pares.
  - Evaluación Formativa y Metacognición (1h): Aplicación de rúbrica analítica, lista de cotejo y reflexión sobre lo aprendido.`,
  },
};

const FAMILY_WORKED_EXAMPLE_DIRECTIVES: Record<EpistemologicalFamily, string> = {
  cuantitativa_experimental:
    "Ejemplo cuantitativo o geométrico resuelto de 250 a 300 palabras en prosa final natural, estructurado en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras con datos explícitos, unidades y qué se busca determinar), 'Paso 1:' (40–55 palabras identificando variables y unidades en prosa directa), 'Paso 2:' (40–55 palabras planteando la ecuación completa sin abreviar), 'Paso 3:' (40–55 palabras con sustitución y operaciones intermedias explícitas hasta obtener el valor), y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con comprobación e interpretación del resultado con unidades). PROHIBIDO copiar etiquetas de plantilla o subtítulos meta después de 'Paso N:'.",
  humanistica_comunicativa_social:
    "Ejemplo de análisis textual, histórico, argumentativo, lingüístico o estudio de caso resuelto de 250 a 300 palabras en prosa final natural, estructurado en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras con fragmento, caso situado, fuente o dilema concreto a analizar y criterio rector), 'Paso 1:' (40–55 palabras contextualizando e identificando elementos clave), 'Paso 2:' (40–55 palabras aplicando la categoría de análisis al caso), 'Paso 3:' (40–55 palabras contrastando y fundamentando con evidencia textual o social), y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con síntesis verificable). PROHIBIDO inventar ecuaciones algebraicas artificiales o copiar etiquetas de plantilla después de 'Paso N:'.",
  computacional_algoritmica:
    "Ejemplo algorítmico, de hardware o procesamiento de datos resuelto de 250 a 300 palabras en prosa final directa (NO uses subtítulos ni etiquetas de plantilla como 'Definición de entradas, variables y tipos', 'Algoritmo, fórmula de hoja de cálculo o estructura lógica' ni 'Prueba de escritorio paso a paso con valores reales'), estructurado en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras con caso técnico real, datos de entrada y salida esperada), 'Paso 1:' (40–55 palabras indicando en prosa natural las entradas, variables y parámetros concretos del caso), 'Paso 2:' (40–55 palabras describiendo en prosa continua la regla lógica, fórmula o procedimiento operativo sin listas numeradas huérfanas), 'Paso 3:' (40–55 palabras ejecutando la verificación con valores reales medidos), y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con dictamen técnico verificable de salida y caso borde).",
  corporal_motriz:
    "Ejemplo práctico de prescripción motriz o monitoreo fisiológico resuelto de 250 a 300 palabras en prosa final natural, estructurado en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras), 'Paso 1:' (40–55 palabras detallando valoración basal y calentamiento articular), 'Paso 2:' (40–55 palabras precisando dosificación de estaciones o secuencia técnica), 'Paso 3:' (40–55 palabras registrando frecuencia cardíaca en ppm y escala de esfuerzo Borg), y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con vuelta a la calma e interpretación del desempeño saludable). PROHIBIDO copiar etiquetas de plantilla después de 'Paso N:'.",
  tecnica_laboral:
    "Caso técnico o procedimiento operativo estandarizado (POE) resuelto de 250 a 300 palabras en prosa final directa (NO uses etiquetas de plantilla como 'Ejecución paso a paso y registro de mediciones/controles' ni 'Seguridad (EPP/higiene), insumos y parámetros de entrada'), estructurado en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras con orden de trabajo, servicio o diagnóstico técnico, especificaciones y normativa aplicable), 'Paso 1:' (40–55 palabras precisando EPP/higiene, insumos y parámetros de entrada del caso), 'Paso 2:' (40–55 palabras aplicando la norma técnica, fórmula de costeo o protocolo operativo), 'Paso 3:' (40–55 palabras detallando la ejecución concreta con mediciones y controles verificados), y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con dictamen de calidad, tolerancia y entrega del servicio/producto).",
};

const FAMILY_KEY_FORMULA_DIRECTIVES: Record<EpistemologicalFamily, string> = {
  cuantitativa_experimental:
    "Ecuación, identidad o proporción matemática completa (con ambos miembros de la igualdad, ej. '12x + 300 = 1800' o 'c² = a² + b²'), nunca sub-igualdades truncadas como 'x = 1800' ni funciones en texto como 'raiz(' o 'sqrt('.",
  humanistica_comunicativa_social:
    "Principio rector, estructura lógica/gramatical o relación conceptual sintética en máximo 12 palabras (ej. 'Tesis + Evidencia Verificable + Garantía → Conclusión Argumentada' o 'Subject + modal verb (should/must) + base verb').",
  computacional_algoritmica:
    "Expresión lógica, sintaxis de función o estructura de control clave (ej. 'SI(promedio >= 6, \"Aprobado\", \"Regularización\")' o 'Entrada → Proceso (Condición) → Salida').",
  corporal_motriz:
    "Fórmula fisiológica o regla biomecánica clave (ej. 'FC máx = 220 - edad (años)' o 'Calentamiento → Fase Medular Aeróbica → Vuelta a la Calma').",
  tecnica_laboral:
    "Fórmula técnico-productiva, ecuación de costeo o regla normativa clave (ej. 'Punto de Equilibrio = Costos Fijos / (Precio - Costo Variable)' o 'Ley de Ohm: V = I · R').",
};

const HUMANISTIC_LOG_TEMPLATE =
  'BITÁCORA DE PROYECTO\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nActividad: _________________\\nFuentes o evidencias consultadas: _________________\\nHallazgos y ajustes: _________________\\nRetroalimentación entre pares: _________';

const TECHNICAL_LOG_TEMPLATE =
  'BITÁCORA TÉCNICA DE PROYECTO\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nActividad: _________________\\nParámetros verificados: ___________ Desviación/Error: ______\\nIncidencia: _________________ Solución: _________________\\nValidación del equipo: _________';

const CLINICAL_LOG_TEMPLATE =
  'BITÁCORA CLÍNICA Y DE BIOSEGURIDAD\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nProcedimiento o protocolo: _________________\\nControl sanitario / EPP verificado: ___________\\nRegistro de hallazgos y ajustes: _________________\\nValidación y firma: _________';

const ADAPTER_V2_METADATA: Record<
  DisciplinaryDomainId,
  Pick<DisciplinaryAdapterV2, DisciplinaryAdapterV2MetaKeys>
> = {
  pensamiento_matematico: {
    family: 'cuantitativa_experimental',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.cuantitativa_experimental,
    defaultTableColumns: [
      'Variable x',
      'Sustitución en el Modelo',
      'Valor Obtenido y',
      'Par Ordenado (x, y)',
      'Interpretación en el Caso',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.cuantitativa_experimental,
    requiresQuantitativeData: true,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'modelación matemática, razonamiento deductivo y resolución de problemas situados',
    practiceSpaceLabel: 'Taller de Modelación y Resolución de Problemas',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con verificación matemática, unidades consistentes e interpretación situada',
    projectLogTemplate:
      'BITÁCORA DE MODELACIÓN Y PROYECTO\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nActividad: _________________\\nVariables y datos registrados: _________________\\nComprobación del modelo: _________________\\nAjustes y conclusiones: _________',
    projectSpecsExample: ['Modelo matemático o estadístico verificado con datos reales', 'Comprobación de unidades e interpretación comunitaria'],
    evaluationChecklistCategories: ['Planteamiento', 'Desarrollo Procedimental', 'Verificación e Interpretación'],
    evaluationChecklistExample: {
      item: 'Comprueba el resultado obtenido en el modelo original e interpreta sus unidades en el contexto',
      category: 'Verificación e Interpretación',
    },
  },
  ciencias_fisica_ingenieria: {
    family: 'cuantitativa_experimental',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.cuantitativa_experimental,
    defaultTableColumns: [
      'Magnitud Medida',
      'Valor Teórico',
      'Medición Experimental 1',
      'Medición Experimental 2',
      'Error Porcentual (%)',
      'Unidad (SI)',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.cuantitativa_experimental,
    requiresQuantitativeData: true,
    requiresNormativeStandards: false,
    requiresLabSafety: true,
    approachDescriptor: 'indagación experimental, modelado físico-matemático y verificación con unidades SI',
    practiceSpaceLabel: 'Laboratorio Experimental de Física',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con tolerancia experimental, unidades del Sistema Internacional (SI) y control de seguridad',
    projectLogTemplate: TECHNICAL_LOG_TEMPLATE,
    projectSpecsExample: ['Magnitudes medidas en Sistema Internacional (SI)', 'Control de error experimental y condiciones de seguridad'],
    evaluationChecklistCategories: ['Seguridad Experimental', 'Medición y Registro', 'Análisis de Resultados'],
    evaluationChecklistExample: {
      item: 'Registra las mediciones experimentales con unidades del SI y calcula el margen de error',
      category: 'Medición y Registro',
    },
  },
  ciencias_quimica_biologia_ambiental: {
    family: 'cuantitativa_experimental',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.cuantitativa_experimental,
    defaultTableColumns: [
      'Muestra / Ensayo',
      'Condición Inicial',
      'Observación o Medición',
      'Cambio Registrado',
      'Interpretación Biológica/Química',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.cuantitativa_experimental,
    requiresQuantitativeData: true,
    requiresNormativeStandards: false,
    requiresLabSafety: true,
    approachDescriptor: 'indagación experimental, análisis científico de muestras y sustentabilidad ambiental',
    practiceSpaceLabel: 'Laboratorio Experimental de Ciencias',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables con control experimental, manejo seguro de muestras/reactivos y evidencia empírica',
    projectLogTemplate: TECHNICAL_LOG_TEMPLATE,
    projectSpecsExample: ['Control de variables y registro de observaciones experimentales', 'Manejo seguro de muestras y disposición responsable de residuos'],
    evaluationChecklistCategories: ['Seguridad Experimental', 'Registro y Observación', 'Análisis Científico'],
    evaluationChecklistExample: {
      item: 'Aplica las medidas de seguridad en el manejo de muestras y registra cambios observables con precisión',
      category: 'Seguridad Experimental',
    },
  },
  dibujo_tecnico_diseno_arquitectura: {
    family: 'cuantitativa_experimental',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.cuantitativa_experimental,
    defaultTableColumns: [
      'Elemento del Plano',
      'Dimensión Real (m)',
      'Escala Aplicada',
      'Dimensión en Dibujo (cm)',
      'Calidad de Línea Normalizada',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.cuantitativa_experimental,
    requiresQuantitativeData: true,
    requiresNormativeStandards: true,
    requiresLabSafety: false,
    approachDescriptor: 'representación técnica normalizada, precisión geométrica y diseño proyectual',
    practiceSpaceLabel: 'Taller de Trazado Técnico y Diseño',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con exactitud de escala, acotación y normas de dibujo técnico (ISO/NOM)',
    projectLogTemplate: TECHNICAL_LOG_TEMPLATE,
    projectSpecsExample: ['Escala normalizada y acotación consistente en mm/cm', 'Normativa de calidad de línea y cuadro de referencia (ISO/NOM)'],
    evaluationChecklistCategories: ['Escala y Acotación', 'Calidad de Trazo', 'Normalización'],
    evaluationChecklistExample: {
      item: 'Verifica la correspondencia entre dimensiones reales, escala aplicada y acotación normalizada',
      category: 'Escala y Acotación',
    },
  },
  lengua_comunicacion_literatura: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Fragmento o Fuente',
      'Intención Comunicativa',
      'Tesis o Idea Central',
      'Argumento / Recurso Discursivo',
      'Postura Crítica Personal',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.humanistica_comunicativa_social,
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'lectura crítica, producción textual planificada y comunicación oral situada',
    practiceSpaceLabel: 'Taller de Lectura, Análisis y Producción Textual',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre coherencia textual, sustento en fuentes, adecuación comunicativa y corrección ortográfica',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Estructura discursiva clara con tesis y argumentos sustentados', 'Adecuación al destinatario, cohesión y citación de fuentes'],
    evaluationChecklistCategories: ['Comprensión y Fuentes', 'Coherencia y Argumentación', 'Redacción y Oralidad'],
    evaluationChecklistExample: {
      item: 'Sustenta la tesis central con fuentes confiables, conectores cohesivos y registro adecuado al público',
      category: 'Coherencia y Argumentación',
    },
  },
  lengua_extranjera_ingles: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Communicative Situation',
      'Grammar Structure / Pattern',
      'Affirmative Example',
      'Negative / Question Form',
      'Meaning in Context',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.humanistica_comunicativa_social,
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'enfoque comunicativo por tareas (MCER) integrando comprensión y producción en inglés',
    practiceSpaceLabel: 'Taller de Práctica Comunicativa en Inglés',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre pertinencia comunicativa, uso correcto de estructuras gramaticales, vocabulario contextual y claridad oral/escrita',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Uso pertinente de estructuras gramaticales y vocabulario del nivel MCER', 'Claridad comunicativa en la producción escrita y oral'],
    evaluationChecklistCategories: ['Comprensión y Léxico', 'Precisión Gramatical', 'Producción Comunicativa'],
    evaluationChecklistExample: {
      item: 'Emplea las estructuras gramaticales y el vocabulario meta en una situación comunicativa real',
      category: 'Precisión Gramatical',
    },
  },
  lengua_extranjera_general: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Situación Comunicativa',
      'Estructura Gramatical',
      'Ejemplo Afirmativo (Lengua Meta)',
      'Forma Negativa / Interrogativa',
      'Significado en Contexto',
    ],
    keyFormulaOrRuleDirective:
      'Estructura comunicativa o patrón gramatical clave en la lengua meta de la UAC (máximo 12 palabras, nunca sustituir por otro idioma ajeno).',
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'enfoque comunicativo por tareas (MCER) en la lengua meta de la UAC',
    practiceSpaceLabel: 'Taller de Práctica Comunicativa en Lengua Extranjera',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre pertinencia comunicativa, uso correcto de estructuras gramaticales en la lengua meta y claridad oral/escrita',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Uso pertinente de estructuras y vocabulario en la lengua meta', 'Claridad comunicativa en interacción oral y producción escrita'],
    evaluationChecklistCategories: ['Comprensión y Léxico', 'Precisión Gramatical', 'Producción Comunicativa'],
    evaluationChecklistExample: {
      item: 'Emplea las estructuras gramaticales y el vocabulario de la lengua meta en un diálogo o texto situado',
      category: 'Producción Comunicativa',
    },
  },
  conciencia_historica_ciencias_sociales: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Proceso o Caso Histórico-Social',
      'Causas Estructurales',
      'Actores e Intereses',
      'Fuente o Indicador Oficial',
      'Consecuencia en el Presente',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.humanistica_comunicativa_social,
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'pensamiento crítico histórico-social, análisis de fuentes y diagnóstico comunitario',
    practiceSpaceLabel: 'Taller de Análisis Histórico, Social y Comunitario',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre rigor de fuentes primarias/oficiales, análisis multicausal, pertinencia social y respeto a los derechos humanos',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Contrastación de fuentes documentales, testimonios o indicadores oficiales', 'Análisis multicausal vinculado a la realidad comunitaria'],
    evaluationChecklistCategories: ['Análisis de Fuentes', 'Pensamiento Crítico', 'Pertinencia Social y Ética'],
    evaluationChecklistExample: {
      item: 'Contrasta al menos dos fuentes verificables e identifica causas, actores y consecuencias del caso',
      category: 'Análisis de Fuentes',
    },
  },
  humanidades_filosofia_logica_etica: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Postura o Dilema Filosófico',
      'Premisa Principal',
      'Premisa Secundaria / Evidencia',
      'Posible Objeción o Falacia',
      'Conclusión Deliberativa',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.humanistica_comunicativa_social,
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'comunidad de indagación filosófica, análisis lógico y deliberación ética',
    practiceSpaceLabel: 'Comunidad de Indagación y Deliberación Filosófica',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre claridad conceptual, validez argumentativa, ausencia de falacias y sustento ético-filosófico',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Reconstrucción clara de premisas, objeciones y postura fundamentada', 'Deliberación ética rigurosa con referencia a textos o casos situados'],
    evaluationChecklistCategories: ['Rigor Conceptual', 'Validez Argumentativa', 'Deliberación Ética'],
    evaluationChecklistExample: {
      item: 'Formula una postura fundamentada en premisas coherentes y responde a una objeción pertinente sin falacias',
      category: 'Validez Argumentativa',
    },
  },
  artes_educacion_artistica_cultural: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Elemento Formal / Técnico',
      'Observación en la Obra o Referente',
      'Intención Expresiva',
      'Aplicación en tu Boceto',
      'Material o Soporte',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.humanistica_comunicativa_social,
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'apreciación estética, composición visual/escénica y creación artística situada',
    practiceSpaceLabel: 'Taller Creativo y de Producción Artística',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre composición, intención expresiva, dominio del soporte/técnica y diálogo con el patrimonio cultural',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Coherencia entre intención expresiva, composición y soporte elegido', 'Documentación del proceso creativo desde el boceto hasta la obra final'],
    evaluationChecklistCategories: ['Composición y Lenguaje', 'Ejecución Creativa', 'Reflexión Estética y Cultural'],
    evaluationChecklistExample: {
      item: 'Justifica las decisiones de composición, color, ritmo o encuadre en relación con su intención expresiva',
      category: 'Composición y Lenguaje',
    },
  },
  socioemocional_tutoria_educacion_integral: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.humanistica_comunicativa_social,
    defaultTableColumns: [
      'Situación o Dilema Vivencial',
      'Emoción o Factor Identificado',
      'Riesgo o Necesidad',
      'Estrategia de Regulación / Cuidado',
      'Acuerdo o Acción Preventiva',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.humanistica_comunicativa_social,
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'educación socioemocional, bienestar integral, prevención y colaboración ciudadana',
    practiceSpaceLabel: 'Taller Vivencial y de Colaboración Comunitaria',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre autocuidado, respeto, inclusión, enfoque preventivo e impacto en el bienestar escolar y comunitario',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Acción preventiva inclusiva basada en derechos y respeto mutuo', 'Acuerdos verificables de bienestar y participación comunitaria'],
    evaluationChecklistCategories: ['Autoconocimiento y Cuidado', 'Convivencia y Respeto', 'Acción Comunitaria'],
    evaluationChecklistExample: {
      item: 'Propone acciones concretas de autocuidado y prevención basadas en el respeto y la corresponsabilidad',
      category: 'Autoconocimiento y Cuidado',
    },
  },
  cultura_digital_programacion_ti: {
    family: 'computacional_algoritmica',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.computacional_algoritmica,
    defaultTableColumns: [
      'Paso / Iteración',
      'Entrada Recibida',
      'Estado de Variables',
      'Condición Evaluada',
      'Salida Generada',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.computacional_algoritmica,
    requiresQuantitativeData: true,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'pensamiento computacional, diseño algorítmico, pruebas y ciudadanía digital segura',
    practiceSpaceLabel: 'Laboratorio de Cómputo y Práctica Digital',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables con pruebas de funcionamiento, manejo de casos borde, documentación y buenas prácticas de seguridad digital',
    projectLogTemplate:
      'BITÁCORA DE DESARROLLO Y PRUEBAS DIGITALES\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nMódulo o tarea: _________________\\nEntradas probadas / Salida obtenida: _________________\\nError detectado y depuración: _________________\\nValidación del equipo: _________',
    projectSpecsExample: ['Pruebas con datos de entrada y casos borde verificados', 'Buenas prácticas de organización, documentación y seguridad informática'],
    evaluationChecklistCategories: ['Lógica y Funcionamiento', 'Pruebas y Depuración', 'Seguridad Digital y Documentación'],
    evaluationChecklistExample: {
      item: 'Ejecuta pruebas con datos válidos y casos borde verificando que la salida coincida con lo esperado',
      category: 'Pruebas y Depuración',
    },
  },
  actividades_fisicas_deportivas_salud: {
    family: 'corporal_motriz',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.corporal_motriz,
    defaultTableColumns: [
      'Fase o Estación Motriz',
      'Tiempo / Repeticiones',
      'FC Inicial (ppm)',
      'FC Esfuerzo (ppm)',
      'Esfuerzo Percibido (Borg 1-10)',
      'Observación Técnica',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.corporal_motriz,
    requiresQuantitativeData: true,
    requiresNormativeStandards: false,
    requiresLabSafety: true,
    approachDescriptor: 'corporeidad saludable, dosificación motriz y monitoreo fisiológico responsable',
    practiceSpaceLabel: 'Práctica Motriz en Cancha o Espacio Deportivo',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con calentamiento, dosificación por tiempos/repeticiones, control de frecuencia cardíaca y prevención de lesiones',
    projectLogTemplate:
      'BITÁCORA DE PRÁCTICA MOTRIZ Y MONITOREO\\nSesión: [ ] Fecha: [ ] Equipo: [ ]\\nActividad / Circuito: _________________\\nFC basal / FC esfuerzo (ppm) / Escala Borg: ___________\\nIncidencias e hidratación: _________________\\nReflexión de progreso: _________',
    projectSpecsExample: ['Dosificación clara de calentamiento, fase medular y vuelta a la calma', 'Registro verificado de frecuencia cardíaca (ppm) y prevención de lesiones'],
    evaluationChecklistCategories: ['Calentamiento y Prevención', 'Ejecución Motriz', 'Monitoreo Fisiológico'],
    evaluationChecklistExample: {
      item: 'Realiza calentamiento articular previo y registra su frecuencia cardíaca antes y después del esfuerzo',
      category: 'Calentamiento y Prevención',
    },
  },
  formacion_laboral_servicios_gestion_turismo: {
    family: 'tecnica_laboral',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.tecnica_laboral,
    defaultTableColumns: [
      'Etapa del Proceso / POE',
      'Norma o Estándar Aplicable',
      'Parámetro o Insumo Crítico',
      'Valor / Control Registrado',
      'Dictamen de Conformidad',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.tecnica_laboral,
    requiresQuantitativeData: true,
    requiresNormativeStandards: true,
    requiresLabSafety: false,
    approachDescriptor: 'competencia laboral en servicios, gestión operativa, costeo y calidad en la atención',
    practiceSpaceLabel: 'Taller de Práctica Profesional y Simulación de Servicios',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles conforme a estándares de servicio, normas aplicables (NIF, higiene o calidad según especialidad) y viabilidad operativa',
    projectLogTemplate:
      'BITÁCORA OPERATIVA DE SERVICIO Y GESTIÓN\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nProceso o servicio realizado: _________________\\nInsumos / Costos / Controles verificados: _________________\\nIncidencia y acción correctiva: _________________\\nValidación del equipo: _________',
    projectSpecsExample: ['Estándar operativo, costeo o ficha de calidad del servicio', 'Normativa aplicable del sector (higiene, NIF o calidad de atención)'],
    evaluationChecklistCategories: ['Higiene y Presentación', 'Procedimiento Operativo', 'Calidad en el Servicio'],
    evaluationChecklistExample: {
      item: 'Aplica el procedimiento operativo estandarizado verificando costos, higiene y satisfacción del usuario',
      category: 'Procedimiento Operativo',
    },
  },
  formacion_laboral_salud_clinica: {
    family: 'tecnica_laboral',
    workedExampleDirective:
      "Protocolo clínico, farmacéutico o de laboratorio dental resuelto de 250 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras con caso clínico, prescripción médica/odontológica o situación sanitaria con datos concretos y norma aplicable), 'Paso 1: Bioseguridad (higiene de manos, EPP clínico y control de área)' (40–55 palabras), 'Paso 2: Preparación de insumos, instrumental o receta y verificación de parámetros sanitarios' (40–55 palabras), 'Paso 3: Ejecución paso a paso del procedimiento clínico/protésico y registro en bitácora' (40–55 palabras), y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con verificación clínica de seguridad del paciente y manejo responsable de RPBI).",
    defaultTableColumns: [
      'Etapa del Protocolo Clínico',
      'Insumo / Parámetro Verificado',
      'Norma Sanitaria (NOM-SSA / RPBI)',
      'Registro de Control',
      'Criterio de Seguridad del Paciente',
    ],
    keyFormulaOrRuleDirective:
      "Regla de bioseguridad, parámetro clínico o fórmula de dosificación/control sanitario clave (ej. 'Higiene de manos + EPP + Verificación de prescripción → Ejecución segura' o 'Dosis total = dosis unitaria × frecuencia').",
    requiresQuantitativeData: true,
    requiresNormativeStandards: true,
    requiresLabSafety: true,
    approachDescriptor: 'competencia técnico-sanitaria bajo bioseguridad clínica y normatividad NOM-SSA',
    practiceSpaceLabel: 'Práctica Clínica / Laboratorio de Salud',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con normas sanitarias aplicables (NOM-SSA, RPBI, COFEPRIS o Guías CENETEC), asepsia y seguridad del paciente',
    projectLogTemplate: CLINICAL_LOG_TEMPLATE,
    projectSpecsExample: ['Protocolo de bioseguridad, asepsia y control de insumos clínicos', 'Norma oficial sanitaria aplicable (NOM-SSA / RPBI / COFEPRIS)'],
    evaluationChecklistCategories: ['Bioseguridad y EPP Clínico', 'Protocolo Sanitario', 'Registro y Seguridad del Paciente'],
    evaluationChecklistExample: {
      item: 'Verifica el uso completo de EPP clínico, la asepsia del instrumental y el registro exacto de la orden',
      category: 'Bioseguridad y EPP Clínico',
    },
  },
  formacion_laboral_industrial_agro_salud: {
    family: 'tecnica_laboral',
    workedExampleDirective: FAMILY_WORKED_EXAMPLE_DIRECTIVES.tecnica_laboral,
    defaultTableColumns: [
      'Etapa del Proceso / POE',
      'Norma o Estándar Aplicable',
      'Parámetro o Insumo Crítico',
      'Valor / Control Registrado',
      'Dictamen de Conformidad',
    ],
    keyFormulaOrRuleDirective: FAMILY_KEY_FORMULA_DIRECTIVES.tecnica_laboral,
    requiresQuantitativeData: true,
    requiresNormativeStandards: true,
    requiresLabSafety: true,
    approachDescriptor: 'competencia técnica industrial, instalaciones o campo agropecuario bajo normas NOM',
    practiceSpaceLabel: 'Taller Técnico / Práctica de Campo',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con normas aplicables (NOM/ISO/STPS/SENASICA según especialidad), tolerancias y seguridad operativa',
    projectLogTemplate: TECHNICAL_LOG_TEMPLATE,
    projectSpecsExample: ['Especificación técnica y tolerancia medible del prototipo o instalación', 'Norma aplicable de seguridad y ejecución (NOM-STPS / NOM / ISO)'],
    evaluationChecklistCategories: ['Seguridad y EPP', 'Ejecución Técnica', 'Control de Tolerancias'],
    evaluationChecklistExample: {
      item: 'Verifica condiciones de seguridad, uso de EPP y parámetros medibles dentro de tolerancia',
      category: 'Seguridad y EPP',
    },
  },
  indagacion_interdisciplinaria_general: {
    family: 'humanistica_comunicativa_social',
    workedExampleDirective:
      "Estudio de caso o problema disciplinar resuelto de 250 a 300 palabras en 5 bloques separados por salto de línea (\\n): 'Planteamiento:' (50–70 palabras contextualizadas), 'Paso 1: Identificación de datos o elementos clave' (40–55 palabras), 'Paso 2: Criterio, principio o modelo aplicable' (40–55 palabras), 'Paso 3: Desarrollo y análisis paso a paso' (40–55 palabras) y termina LITERALMENTE con 'Paso 4: Conclusión:' (30–45 palabras con cierre verificable e interpretación).",
    defaultTableColumns: [
      'Elemento o Categoría',
      'Definición / Datos Clave',
      'Evidencia o Desarrollo',
      'Aplicación en el Caso',
      'Conclusión',
    ],
    keyFormulaOrRuleDirective:
      'Principio, relación conceptual o regla central de la sesión expresada con claridad en una sola línea.',
    requiresQuantitativeData: false,
    requiresNormativeStandards: false,
    requiresLabSafety: false,
    approachDescriptor: 'indagación interdisciplinaria, análisis de fuentes y resolución de casos situados',
    practiceSpaceLabel: 'Taller de Indagación y Análisis Aplicado',
    projectAcceptanceDirective:
      '4 a 6 deliveryCriteria formales y acceptanceCriteria verificables sobre rigor metodológico, sustento en evidencias y utilidad comunitaria',
    projectLogTemplate: HUMANISTIC_LOG_TEMPLATE,
    projectSpecsExample: ['Criterio metodológico y sustento en evidencias verificables', 'Pertinencia, claridad y entrega documentada para la comunidad'],
    evaluationChecklistCategories: ['Fundamentación', 'Desarrollo Metodológico', 'Comunicación y Ética'],
    evaluationChecklistExample: {
      item: 'Sustenta sus hallazgos con fuentes o registros verificables y explica sus conclusiones con claridad',
      category: 'Fundamentación',
    },
  },
};

const ADAPTERS = Object.fromEntries(
  (Object.keys(ADAPTERS_BASE) as DisciplinaryDomainId[]).map((id) => [
    id,
    { ...ADAPTERS_BASE[id], ...ADAPTER_V2_METADATA[id] },
  ])
) as Record<DisciplinaryDomainId, DisciplinaryAdapterV2>;

/**
 * Normaliza texto para clasificación determinista: minúsculas, sin acentos ni
 * signos de puntuación, con espacios simples.
 */
function normalizeClassifierText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Coincidencia exacta de palabra o frase completa (nunca substring accidental como "artes" en "artesanales"). */
function hasTerm(normalizedText: string, term: string): boolean {
  if (!normalizedText || !term) return false;
  return new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s)`).test(normalizedText);
}

function hasAnyTerm(normalizedText: string, terms: readonly string[]): boolean {
  return terms.some((term) => hasTerm(normalizedText, term));
}

function startsWithAny(normalizedText: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => normalizedText === prefix || normalizedText.startsWith(`${prefix} `));
}

/**
 * Mapa canónico mantenible de prefijos/títulos de UAC MCCEMS (BGE, FFE, FFEO, Ampliado y Laboral).
 * Las entradas se evalúan en orden de especificidad antes de recurrir a señales secundarias.
 */
const CANONICAL_UAC_PREFIX_MAP: ReadonlyArray<readonly [string, DisciplinaryDomainId]> = [
  // Ciencias Naturales, Experimentales y Tecnología I–VI (MCCEMS Fundamental)
  ['ciencias naturales experimentales y tecnologia ii', 'ciencias_fisica_ingenieria'],
  ['ciencias naturales experimentales y tecnologia v', 'ciencias_fisica_ingenieria'],
  ['ciencias naturales experimentales y tecnologia i', 'ciencias_quimica_biologia_ambiental'],
  ['ciencias naturales experimentales y tecnologia iii', 'ciencias_quimica_biologia_ambiental'],
  ['ciencias naturales experimentales y tecnologia iv', 'ciencias_quimica_biologia_ambiental'],
  ['ciencias naturales experimentales y tecnologia vi', 'ciencias_quimica_biologia_ambiental'],
  ['ciencias naturales', 'ciencias_quimica_biologia_ambiental'],

  // Lengua, Comunicación y Literatura
  ['lenguaje y comunicacion', 'lengua_comunicacion_literatura'],
  ['lengua y comunicacion', 'lengua_comunicacion_literatura'],
  ['pensamiento literario', 'lengua_comunicacion_literatura'],
  ['comunicacion y sociedad', 'lengua_comunicacion_literatura'],
  ['comunicacion social', 'lengua_comunicacion_literatura'],
  ['ciencias de la comunicacion', 'lengua_comunicacion_literatura'],
  ['periodismo', 'lengua_comunicacion_literatura'],
  ['taller de lectura y redaccion', 'lengua_comunicacion_literatura'],
  ['taller de expresion oral', 'lengua_comunicacion_literatura'],
  ['raices etimologicas del espanol', 'lengua_comunicacion_literatura'],

  // Lenguas extranjeras
  ['ingles', 'lengua_extranjera_ingles'],
  ['frances', 'lengua_extranjera_general'],
  ['aleman', 'lengua_extranjera_general'],
  ['italiano', 'lengua_extranjera_general'],
  ['portugues', 'lengua_extranjera_general'],
  ['japones', 'lengua_extranjera_general'],

  // Pensamiento Matemático (antes de finanzas/dibujo para evitar colisiones)
  ['pensamiento matematico', 'pensamiento_matematico'],
  ['taller de pensamiento variacional', 'pensamiento_matematico'],
  ['taller de probabilidad y estadistica', 'pensamiento_matematico'],
  ['temas selectos de matematicas', 'pensamiento_matematico'],

  // Física y Biología propedéuticas
  ['analisis de fenomenos fisicos', 'ciencias_fisica_ingenieria'],
  ['temas selectos de fisica', 'ciencias_fisica_ingenieria'],
  ['analisis de fenomenos y procesos biologicos', 'ciencias_quimica_biologia_ambiental'],
  ['organizacion del flujo de materia y energia en los organismos', 'ciencias_quimica_biologia_ambiental'],
  ['temas selectos de biologia', 'ciencias_quimica_biologia_ambiental'],
  ['taller de ciencias', 'ciencias_quimica_biologia_ambiental'],
  ['desarrollo sustentable', 'ciencias_quimica_biologia_ambiental'],

  // Geografía (física vs humana/general) y Ciencias Sociales
  ['geografia fisica', 'ciencias_quimica_biologia_ambiental'],
  ['geografia humana', 'conciencia_historica_ciencias_sociales'],
  ['geografia', 'conciencia_historica_ciencias_sociales'],
  ['espacio y sociedad', 'conciencia_historica_ciencias_sociales'],
  ['conciencia historica', 'conciencia_historica_ciencias_sociales'],
  ['ciencias sociales', 'conciencia_historica_ciencias_sociales'],
  ['temas selectos de ciencias sociales', 'conciencia_historica_ciencias_sociales'],
  ['derecho y sociedad', 'conciencia_historica_ciencias_sociales'],
  ['economia', 'conciencia_historica_ciencias_sociales'],
  ['psicologia', 'conciencia_historica_ciencias_sociales'],

  // Humanidades y Filosofía
  ['pensamiento filosofico', 'humanidades_filosofia_logica_etica'],
  ['humanidades', 'humanidades_filosofia_logica_etica'],
  ['logica y pensamiento critico', 'humanidades_filosofia_logica_etica'],
  ['experiencia estetica', 'humanidades_filosofia_logica_etica'],
  ['bioetica', 'humanidades_filosofia_logica_etica'],

  // Artes, Comunicación Gráfica y Cultura (antes de dibujo técnico)
  ['dibujo tecnico', 'dibujo_tecnico_diseno_arquitectura'],
  ['dibujo arquitectonico', 'dibujo_tecnico_diseno_arquitectura'],
  ['comunicacion grafica', 'artes_educacion_artistica_cultural'],
  ['arte y cultura', 'artes_educacion_artistica_cultural'],
  ['actividades artisticas y culturales', 'artes_educacion_artistica_cultural'],
  ['patrimonio cultural', 'artes_educacion_artistica_cultural'],
  ['fotografia', 'artes_educacion_artistica_cultural'],
  ['cine', 'artes_educacion_artistica_cultural'],
  ['dibujo', 'artes_educacion_artistica_cultural'],

  // Cultura Digital y TI
  ['cultura digital', 'cultura_digital_programacion_ti'],
  ['taller de cultura digital', 'cultura_digital_programacion_ti'],

  // Deportes y Socioemocional / Salud Integral
  ['actividades fisicas y deportivas', 'actividades_fisicas_deportivas_salud'],
  ['educacion fisica', 'actividades_fisicas_deportivas_salud'],
  ['practica y colaboracion ciudadana', 'socioemocional_tutoria_educacion_integral'],
  ['educacion integral en sexualidad y genero', 'socioemocional_tutoria_educacion_integral'],
  ['educacion para la salud', 'socioemocional_tutoria_educacion_integral'],
  ['salud integral', 'socioemocional_tutoria_educacion_integral'],

  // Salud Clínica (antes de física/mecánica y antes de química/biología)
  ['mecanica dental', 'formacion_laboral_salud_clinica'],
  ['ciencias de la salud', 'formacion_laboral_salud_clinica'],
  ['enfermeria', 'formacion_laboral_salud_clinica'],
  ['primeros auxilios', 'formacion_laboral_salud_clinica'],
  ['nutricion', 'formacion_laboral_salud_clinica'],

  // Servicios, Gestión, Contabilidad, Gastronomía, Estética y Confección (antes de artes/humanidades/industrial)
  ['estetica y belleza', 'formacion_laboral_servicios_gestion_turismo'],
  ['preparacion de alimentos artesanales', 'formacion_laboral_servicios_gestion_turismo'],
  ['procesos culinarios y reposteria', 'formacion_laboral_servicios_gestion_turismo'],
  ['corte y confeccion', 'formacion_laboral_servicios_gestion_turismo'],
  ['diseno de modas', 'formacion_laboral_servicios_gestion_turismo'],
  ['procesos contables', 'formacion_laboral_servicios_gestion_turismo'],
  ['fundamentos de administracion', 'formacion_laboral_servicios_gestion_turismo'],
  ['servicios de hosteleria', 'formacion_laboral_servicios_gestion_turismo'],
  ['recursos humanos', 'formacion_laboral_servicios_gestion_turismo'],
  ['finanzas', 'formacion_laboral_servicios_gestion_turismo'],
  ['emprendimiento', 'formacion_laboral_servicios_gestion_turismo'],

  // Industrial, Eléctrica, Construcción, Agropecuaria
  ['instalaciones residenciales', 'formacion_laboral_industrial_agro_salud'],
  ['sistemas electricos', 'formacion_laboral_industrial_agro_salud'],
  ['refrigeracion', 'formacion_laboral_industrial_agro_salud'],
  ['instrumentacion industrial', 'formacion_laboral_industrial_agro_salud'],
  ['agricultura sostenible', 'formacion_laboral_industrial_agro_salud'],
  ['seguridad e higiene', 'formacion_laboral_industrial_agro_salud'],

  // Indagación interdisciplinaria (fallback legítimo explícito)
  ['laboratorio de investigacion', 'indagacion_interdisciplinaria_general'],
];

/**
 * Señal secundaria por carrera/programa formativo (clave para módulos laborales MCCEMS
 * redactados como verbo de competencia, ej. "Asiste especialistas del área...").
 */
function resolveByCareerSignal(normCareer: string): DisciplinaryDomainId | null {
  if (!normCareer) return null;

  // Salud clínica / odontología / enfermería / farmacia
  if (
    hasAnyTerm(normCareer, [
      'area de la salud',
      'mecanica dental',
      'enfermeria',
      'ciencias de la salud',
      'odontologia',
      'protesis dental',
      'farmacia',
      'nutricion',
      'salud',
      'clinica',
      'laboratorio clinico',
      'puericultura',
      'radiologia',
      'gericultura',
    ])
  ) {
    return 'formacion_laboral_salud_clinica';
  }

  // Tecnología Informática y Redes
  if (
    hasAnyTerm(normCareer, [
      'redes y mantenimiento',
      'tecnologia informatica',
      'informatica',
      'programacion',
      'soporte y mantenimiento de equipo de computo',
      'ofimatica',
      'ciberseguridad',
      'inteligencia artificial',
      'desarrollo de software',
    ])
  ) {
    return 'cultura_digital_programacion_ti';
  }

  // Comunicación Gráfica / Artes visuales aplicadas
  if (hasAnyTerm(normCareer, ['comunicacion grafica', 'diseno grafico', 'artes graficas', 'fotografia', 'cine'])) {
    return 'artes_educacion_artistica_cultural';
  }

  // Servicios, gestión, turismo, gastronomía, belleza y confección
  if (
    hasAnyTerm(normCareer, [
      'administracion',
      'contabilidad',
      'turismo',
      'hosteleria',
      'hospedaje',
      'gastronomia',
      'alimentos y bebidas',
      'preparacion de alimentos artesanales',
      'procesos culinarios y reposteria',
      'reposteria',
      'panaderia',
      'estetica y belleza',
      'cosmetologia',
      'corte y confeccion',
      'diseno de modas',
      'confeccion',
      'mercadotecnia',
      'logistica',
      'comercio',
      'ventas',
      'servicios',
    ]) &&
    !hasTerm(normCareer, 'servicios ecosistemicos')
  ) {
    return 'formacion_laboral_servicios_gestion_turismo';
  }

  // Industrial, eléctrica, domótica, construcción, agropecuaria y servicios ecosistémicos
  if (
    hasAnyTerm(normCareer, [
      'domotica',
      'instalaciones residenciales',
      'sistemas electricos',
      'electricidad',
      'electronica',
      'mecatronica',
      'refrigeracion',
      'aire acondicionado',
      'instrumentacion industrial',
      'mantenimiento industrial',
      'mecanica automotriz',
      'soldadura',
      'construccion',
      'agricultura',
      'agricultura sostenible de traspatio',
      'agropecuaria',
      'servicios ecosistemicos',
      'seguridad',
      'seguridad e higiene',
      'biotecnologia',
    ])
  ) {
    return 'formacion_laboral_industrial_agro_salud';
  }

  // Dibujo técnico / arquitectura
  if (hasAnyTerm(normCareer, ['arquitectura', 'dibujo tecnico', 'dibujo industrial'])) {
    return 'dibujo_tecnico_diseno_arquitectura';
  }

  return null;
}

/**
 * Resuelve deterministamente el Adaptador Disciplinar para cualquier UAC de BGE o BT (400+ UAC).
 * Orden de prioridad:
 *   1. Mapa canónico de UAC (coincidencia exacta / prefijo normalizado).
 *   2. Señal de carrera/programa (para módulos laborales redactados como acción).
 *   3. Reglas ordenadas por límites de palabra sobre el nombre de la UAC.
 *   4. Señal débil de componente (solo socioemocional; NUNCA default industrial por "laboral").
 *   5. Fallback seguro hacia indagacion_interdisciplinaria_general.
 */
export function getDisciplinaryAdapter(
  uacName: string = '',
  component: string = '',
  careerOrProgramName: string = ''
): DisciplinaryAdapterV2 {
  const normUac = normalizeClassifierText(uacName);
  const normComp = normalizeClassifierText(component);
  const normCareer = normalizeClassifierText(careerOrProgramName);

  // 1. Coincidencia canónica de UAC (prioridad máxima)
  for (const [prefix, domainId] of CANONICAL_UAC_PREFIX_MAP) {
    if (startsWithAny(normUac, [prefix])) {
      return ADAPTERS[domainId];
    }
  }

  // 2. Señal secundaria de carrera / programa (módulos laborales MCCEMS)
  const byCareer = resolveByCareerSignal(normCareer);
  if (byCareer) {
    return ADAPTERS[byCareer];
  }

  // 3. Reglas ordenadas por límites de palabra sobre el título de la UAC
  // 3.1 Deportes / Educación Física (antes de 'fisica')
  if (
    hasAnyTerm(normUac, [
      'actividades fisicas',
      'actividad fisica',
      'educacion fisica',
      'deporte',
      'deportes',
      'deportivas',
      'deportivos',
      'recreacion',
      'acondicionamiento fisico',
    ])
  ) {
    return ADAPTERS.actividades_fisicas_deportivas_salud;
  }

  // 3.2 Salud clínica / dental / enfermería / farmacia (antes de 'mecanica' y 'biologia')
  if (
    hasAnyTerm(normUac, [
      'mecanica dental',
      'protesis dental',
      'protesis dentales',
      'impresiones dentales',
      'odontologia',
      'ortodoncia',
      'ciencias de la salud',
      'enfermeria',
      'primeros auxilios',
      'nutricion',
      'farmacia',
      'medicamentos',
      'laboratorio clinico',
      'esterilizacion',
    ])
  ) {
    return ADAPTERS.formacion_laboral_salud_clinica;
  }

  // 3.3 Estética y belleza / Gastronomía / Confección / Servicios (antes de 'estetica' filosófica y 'artes')
  if (
    hasAnyTerm(normUac, [
      'estetica y belleza',
      'cosmetologia',
      'estilismo',
      'corte y confeccion',
      'diseno de modas',
      'patronaje',
      'gastronomia',
      'alimentos y bebidas',
      'alimentos artesanales',
      'reposteria',
      'panaderia',
      'panificacion',
      'cocina',
      'culinarios',
      'turismo',
      'hosteleria',
      'hospitalidad',
      'hospedaje',
      'administracion',
      'contabilidad',
      'contables',
      'estados financieros',
      'impuestos',
      'ventas',
      'mercadotecnia',
      'logistica',
      'recursos humanos',
      'emprendimiento',
      'comercio exterior',
    ])
  ) {
    return ADAPTERS.formacion_laboral_servicios_gestion_turismo;
  }

  // 3.4 Dibujo Técnico, CAD y Arquitectura (con límites de palabra: nunca 'cad' dentro de 'aplicado'/'diagnosticado')
  if (
    hasAnyTerm(normUac, [
      'dibujo tecnico',
      'dibujo arquitectonico',
      'dibujo industrial',
      'expresion grafica',
      'planimetria',
      'diseno arquitectonico',
      'arquitectura',
      'cad',
      'autocad',
      'librecad',
    ])
  ) {
    return ADAPTERS.dibujo_tecnico_diseno_arquitectura;
  }

  // 3.5 Lenguas extranjeras (Inglés vs otras lenguas extranjeras)
  if (hasAnyTerm(normUac, ['ingles', 'english'])) {
    return ADAPTERS.lengua_extranjera_ingles;
  }
  if (
    hasAnyTerm(normUac, [
      'frances',
      'aleman',
      'italiano',
      'portugues',
      'japones',
      'chino mandarin',
      'lengua extranjera',
      'lengua adicional',
    ])
  ) {
    return ADAPTERS.lengua_extranjera_general;
  }

  // 3.6 Artes, Fotografía, Cine, Música y Cultura (con límite de palabra: nunca 'artes' dentro de 'artesanales')
  if (
    hasAnyTerm(normUac, [
      'arte',
      'artes',
      'educacion artistica',
      'apreciacion artistica',
      'actividades artisticas',
      'artes visuales',
      'artes plasticas',
      'comunicacion grafica',
      'diseno grafico',
      'fotografia',
      'cine',
      'cinematografia',
      'patrimonio cultural',
      'danza',
      'musica',
      'teatro',
      'pintura',
      'escultura',
      'dibujo artistico',
    ])
  ) {
    return ADAPTERS.artes_educacion_artistica_cultural;
  }

  // 3.7 Formación Socioemocional / Tutoría / Educación Integral / Salud Integral
  if (
    hasAnyTerm(normUac, [
      'socioemocional',
      'sexualidad',
      'practica y colaboracion ciudadana',
      'educacion para la salud',
      'salud integral',
      'tutoria',
      'orientacion educativa',
      'orientacion vocacional',
    ])
  ) {
    return ADAPTERS.socioemocional_tutoria_educacion_integral;
  }

  // 3.8 Cultura Digital, Programación, Ofimática y TI (antes de matemáticas para 'hojas de calculo')
  if (
    hasAnyTerm(normUac, [
      'cultura digital',
      'programacion',
      'software',
      'hardware',
      'informatica',
      'ofimatica',
      'hojas de calculo',
      'procesadores de texto',
      'bases de datos',
      'redes de computadoras',
      'redes y mantenimiento',
      'equipo de computo',
      'equipos de computo',
      'mantenimiento de equipo de computo',
      'mantenimiento de equipos de computo',
      'soporte tecnico',
      'ciberseguridad',
      'inteligencia artificial',
      'ciencia de datos',
      'desarrollo web',
    ])
  ) {
    return ADAPTERS.cultura_digital_programacion_ti;
  }

  // 3.9 Pensamiento Matemático, Variacional, Estadística
  if (
    hasAnyTerm(normUac, [
      'pensamiento matematico',
      'pensamiento variacional',
      'matematicas',
      'matematica',
      'algebra',
      'geometria',
      'trigonometria',
      'calculo diferencial',
      'calculo integral',
      'calculo',
      'probabilidad',
      'estadistica',
      'educacion financiera',
    ])
  ) {
    return ADAPTERS.pensamiento_matematico;
  }

  // 3.10 Humanidades, Filosofía, Lógica, Ética (con límites de palabra: nunca 'logica' dentro de 'agroecologicas')
  if (
    hasAnyTerm(normUac, [
      'humanidades',
      'filosofia',
      'pensamiento filosofico',
      'logica',
      'etica',
      'bioetica',
      'estetica',
      'experiencia estetica',
      'epistemologia',
    ])
  ) {
    return ADAPTERS.humanidades_filosofia_logica_etica;
  }

  // 3.11 Conciencia Histórica, Ciencias Sociales, Geografía, Economía, Derecho, Psicología
  if (
    hasAnyTerm(normUac, [
      'conciencia historica',
      'ciencias sociales',
      'historia',
      'geografia',
      'espacio y sociedad',
      'economia',
      'derecho',
      'sociologia',
      'antropologia',
      'psicologia',
      'problemas politicos',
      'ciencia politica',
      'civismo',
    ])
  ) {
    return ADAPTERS.conciencia_historica_ciencias_sociales;
  }

  // 3.12 Lengua, Comunicación, Literatura y Periodismo
  if (
    hasAnyTerm(normUac, [
      'lengua y comunicacion',
      'lenguaje y comunicacion',
      'literatura',
      'literario',
      'lectura',
      'redaccion',
      'expresion oral',
      'talleres de escritura',
      'escritura',
      'ciencias de la comunicacion',
      'comunicacion social',
      'comunicacion y sociedad',
      'periodismo',
      'etimologias',
      'etimologicas',
      'espanol',
      'linguistica',
    ])
  ) {
    return ADAPTERS.lengua_comunicacion_literatura;
  }

  // 3.13 Ciencias Naturales: Física, Energía, Fenómenos Físicos
  if (
    hasAnyTerm(normUac, [
      'fisica',
      'fenomenos fisicos',
      'energia en los procesos',
      'interacciones de la materia',
      'temas selectos de fisica',
      'mecanica clasica',
      'termodinamica',
      'electromagnetismo',
      'optica',
      'acustica',
    ])
  ) {
    return ADAPTERS.ciencias_fisica_ingenieria;
  }

  // 3.14 Ciencias Naturales: Química, Biología, Ecología, Sustentabilidad
  if (
    hasAnyTerm(normUac, [
      'materia y sus interacciones',
      'conservacion de la energia',
      'ecosistemas',
      'organismos',
      'herencia y evolucion',
      'reacciones quimicas',
      'taller de ciencias',
      'ciencias naturales',
      'quimica',
      'biologia',
      'biologicos',
      'ecologia',
      'desarrollo sustentable',
      'anatomia',
      'fisiologia',
      'geografia fisica',
    ])
  ) {
    return ADAPTERS.ciencias_quimica_biologia_ambiental;
  }

  // 3.15 Formación Laboral Industrial, Eléctrica, Domótica, Construcción y Agropecuaria
  // Nota: NO se usa normComp.includes('laboral') como default industrial.
  if (
    hasAnyTerm(normUac, [
      'mecatronica',
      'electronica',
      'electronicos',
      'electricidad',
      'electricos',
      'domotica',
      'refrigeracion',
      'aire acondicionado',
      'instrumentacion industrial',
      'mantenimiento industrial',
      'mecanica automotriz',
      'soldadura',
      'construccion',
      'instalaciones residenciales',
      'instalaciones hidraulicas',
      'vivienda',
      'plomeria',
      'hidrosanitaria',
      'agricultura',
      'agroecologia',
      'agroecologico',
      'agroecologicas',
      'agropecuaria',
      'huerto',
      'biotecnologia',
      'seguridad e higiene',
    ])
  ) {
    return ADAPTERS.formacion_laboral_industrial_agro_salud;
  }

  // 4. Señal débil de componente (únicamente socioemocional explícito)
  if (hasTerm(normComp, 'socioemocional')) {
    return ADAPTERS.socioemocional_tutoria_educacion_integral;
  }

  // 5. Fallback seguro hacia Indagación Interdisciplinaria General
  return ADAPTERS.indagacion_interdisciplinaria_general;
}

/**
 * Construye el bloque de reglas disciplinares para inyectar en los prompts
 * de planeaciones didácticas y de los 4 escritores de libros de texto.
 */
export function buildDisciplinaryPromptBlock(
  uacName: string,
  component: string = '',
  careerOrProgramName: string = ''
): string {
  const adapter = getDisciplinaryAdapter(uacName, component, careerOrProgramName);
  const isCulinary =
    /gastronom|alimentos y bebidas|alimentos artesanales|reposteri|panaderi|panificaci|culinari/i.test(
      `${uacName} ${component} ${careerOrProgramName}`
    );

  const allowedEquipment = isCulinary
    ? adapter.allowedPhysicalEquipment
    : adapter.allowedPhysicalEquipment.filter(
        (item) => !/cocina|cuchillo|tabla de picar|cofia/i.test(item)
      );

  const forbiddenTerms = isCulinary
    ? adapter.forbiddenCrossDomainTerms
    : [...adapter.forbiddenCrossDomainTerms, 'tabla de cortar', 'cuchillo de chef'];

  return `
═══════════ ESTRATEGIA DISCIPLINAR ESPECIALIZADA (${adapter.displayName.toUpperCase()}) ═══════════
• Enfoque Epistemológico y Didáctico: ${adapter.epistemologicalApproach}
• Directriz de Redacción Disciplinar: ${adapter.workbookVoiceDirective}
• Equipo Físico e Instrumental Pertinente para "${uacName}": ${allowedEquipment.join(' | ')}.
• Herramientas Digitales Pertinentes para "${uacName}": ${adapter.allowedDigitalTools.join(' | ')}.
• PROHIBICIÓN DE CONTAMINACIÓN ENTRE DISCIPLINAS: Queda estrictamente PROHIBIDO mencionar o asignar instrumentos ajenos a "${uacName}" tales como: ${Array.from(new Set(forbiddenTerms)).join(', ')}.
`;
}

