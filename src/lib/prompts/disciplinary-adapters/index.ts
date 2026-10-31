/**
 * disciplinary-adapters/index.ts — Matriz de 14 Estrategias Disciplinares Dinámicas
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Resuelve de forma determinista el perfil disciplinar de cualquier UAC (203 programas BGE/BT)
 * para inyectar en el Generador de Planeaciones (build-prompt.ts) y en los 4 Escritores
 * del Libro de Texto (foundation, lab, project, evaluation):
 *   1. Enfoque pedagógico y epistemológico propio del área/componente.
 *   2. Equipo físico e instrumental permitido (alineado con catálogos 512x512 y SVG).
 *   3. Herramientas digitales y simuladores pertinentes (CERO contaminación cruzada).
 *   4. Términos y objetos estrictamente prohibidos de otras disciplinas.
 *   5. Ejemplo canónico (Few-Shot) de Secuencia Didáctica situado en la disciplina.
 */

export type DisciplinaryDomainId =
  | 'pensamiento_matematico'
  | 'ciencias_fisica_ingenieria'
  | 'ciencias_quimica_biologia_ambiental'
  | 'lengua_comunicacion_literatura'
  | 'lengua_extranjera_ingles'
  | 'conciencia_historica_ciencias_sociales'
  | 'humanidades_filosofia_logica_etica'
  | 'cultura_digital_programacion_ti'
  | 'dibujo_tecnico_diseno_arquitectura'
  | 'actividades_fisicas_deportivas_salud'
  | 'artes_educacion_artistica_cultural'
  | 'socioemocional_tutoria_educacion_integral'
  | 'formacion_laboral_servicios_gestion_turismo'
  | 'formacion_laboral_industrial_agro_salud';

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

const ADAPTERS: Record<DisciplinaryDomainId, DisciplinaryAdapter> = {
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
      'balanza romana',
      'báscula de dos platillos',
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
      'cuchillo',
      'matraz',
      'reactivo químico',
      'balanza romana',
      'cautín',
    ],
    workbookVoiceDirective:
      'Detalla trazos geométricos paso a paso con instrumentos (escuadras, compás, escalímetro), calidades de línea (continua gruesa, fina, oculta, ejes), cálculo de escalas (E = D / R) y vistas ortogonales/isométricas.',
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
    displayName: 'Formación Laboral y Tecnológica: Administración, Contabilidad, Turismo, Gastronomía y Servicios',
    epistemologicalApproach:
      'Competencia laboral y emprendimiento situado: aplicación de estándares de calidad en el servicio, normativas oficiales (NOM/Distintivo H/NIF), gestión administrativa, costos y atención al cliente.',
    allowedPhysicalEquipment: [
      'Formatos contables, pólizas, arqueo de caja y calculadora financiera (Administración/Contabilidad)',
      'Utensilios de cocina profesional, tabla de picar por código de color, cuchillo chef, termómetro de alimentos y cofia/red (SOLO en Gastronomía/Alimentos)',
      'Bitácora de operación turística, guion de recorrido patrimonial y directorio de servicios (Turismo/Hospitalidad)',
      'Listas de verificación de higiene, seguridad y calidad en el servicio (NOM)',
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
    ],
    workbookVoiceDirective:
      'Desarrolla procedimientos operativos estandarizados (POE), cálculo de costos/presupuestos reales, simulación de casos laborales del sector servicios y verificación de normas oficiales.',
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

  formacion_laboral_industrial_agro_salud: {
    id: 'formacion_laboral_industrial_agro_salud',
    displayName: 'Formación Laboral y Tecnológica: Mecatrónica, Electrónica, Industrial, Agropecuaria y Salud Clínica',
    epistemologicalApproach:
      'Competencia técnica de taller, laboratorio clínico o campo agropecuario bajo normas de seguridad e higiene (NOM-STPS / SSA / SENASICA), diagnóstico instrumental y mantenimiento/producción.',
    allowedPhysicalEquipment: [
      'Equipo de Protección Personal (EPP) acorde a la especialidad (gafas, guantes, bata o calzado de seguridad)',
      'Multímetro, cautín, osciloscopio, vernier o herramienta mecánica (Especialidades Industriales/Electrónicas)',
      'Baumanómetro, estetoscopio, oxímetro, termómetro clínico y material de curación (Especialidades de Salud)',
      'Potenciómetro de suelo, cinta diamétrica, instrumental agronómico y sustratos (Especialidades Agropecuarias)',
    ],
    allowedDigitalTools: [
      'Tinkercad Circuits / Proteus / FluidSIM (Electrónica y Mecatrónica)',
      'Manuales Técnicos NOM-STPS / Guías de Práctica Clínica CENETEC / SIAP',
    ],
    forbiddenCrossDomainTerms: [
      'balanza romana',
      'báscula de dos platillos',
    ],
    workbookVoiceDirective:
      'Estructura prácticas de taller/clínica/campo con protocolos estrictos de seguridad (EPP), diagramas técnicos, tablas de diagnóstico instrumental y resolución de fallas o casos técnicos reales.',
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
};

/**
 * Resuelve deterministamente el Adaptador Disciplinar para cualquier UAC de BGE o BT.
 */
export function getDisciplinaryAdapter(
  uacName: string = '',
  component: string = '',
  careerOrProgramName: string = ''
): DisciplinaryAdapter {
  const normUac = (uacName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normComp = (component || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normCareer = (careerOrProgramName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const combined = `${normUac} ${normComp} ${normCareer}`;

  // 1. Actividades Físicas y Deportivas / Educación Física (prioridad máxima antes de 'física')
  if (
    normUac.includes('actividades fisicas') ||
    normUac.includes('actividad fisica') ||
    normUac.includes('deportiv') ||
    normUac.includes('educacion fisica') ||
    normUac.includes('recreacion')
  ) {
    return ADAPTERS.actividades_fisicas_deportivas_salud;
  }

  // 2. Dibujo Técnico, Expresión Gráfica, Diseño y Arquitectura
  if (
    normUac.includes('dibujo tecnico') ||
    normUac.includes('dibujo arquitectonico') ||
    normUac.includes('expresion grafica') ||
    normUac.includes('planimetria') ||
    normUac.includes('diseno grafico') ||
    normUac.includes('diseno arquitectonico') ||
    normUac.includes('cad')
  ) {
    return ADAPTERS.dibujo_tecnico_diseno_arquitectura;
  }

  // 3. Lengua Extranjera (Inglés)
  if (normUac.includes('ingles') || normUac.includes('lengua extranjera')) {
    return ADAPTERS.lengua_extranjera_ingles;
  }

  // 4. Artes / Educación Artística y Cultural
  if (
    normUac.includes('educacion artistica') ||
    normUac.includes('artes') ||
    normUac.includes('apreciacion artistica') ||
    normUac.includes('danza') ||
    normUac.includes('musica') ||
    normUac.includes('teatro') ||
    normUac.includes('pintura')
  ) {
    return ADAPTERS.artes_educacion_artistica_cultural;
  }

  // 5. Formación Socioemocional / Tutoría / Educación Integral en Sexualidad / Salud
  if (
    normComp.includes('socioemocional') ||
    normUac.includes('socioemocional') ||
    normUac.includes('sexualidad') ||
    normUac.includes('practica y colaboracion ciudadana') ||
    normUac.includes('educacion para la salud') ||
    normUac.includes('tutoria') ||
    normUac.includes('orientacion educativa')
  ) {
    return ADAPTERS.socioemocional_tutoria_educacion_integral;
  }

  // 6. Pensamiento Matemático, Variacional, Estadística, Finanzas Matemáticas
  if (
    normUac.includes('pensamiento matematico') ||
    normUac.includes('pensamiento variacional') ||
    normUac.includes('probabilidad') ||
    normUac.includes('estadistica') ||
    normUac.includes('calculo') ||
    normUac.includes('geometria') ||
    normUac.includes('algebra') ||
    normUac.includes('trigonometria') ||
    normUac.includes('matematicas') ||
    normUac.includes('educacion financiera')
  ) {
    return ADAPTERS.pensamiento_matematico;
  }

  // 7. Cultura Digital, Programación, Sistemas y TI
  if (
    normUac.includes('cultura digital') ||
    normUac.includes('programacion') ||
    normUac.includes('software') ||
    normUac.includes('informatica') ||
    normUac.includes('bases de datos') ||
    normUac.includes('redes de computadoras') ||
    normUac.includes('ciberseguridad') ||
    normUac.includes('inteligencia artificial') ||
    normUac.includes('ciencia de datos') ||
    normUac.includes('ofimatica')
  ) {
    return ADAPTERS.cultura_digital_programacion_ti;
  }

  // 8. Humanidades, Filosofía, Lógica, Ética, Estética
  if (
    normUac.includes('humanidades') ||
    normUac.includes('filosofia') ||
    normUac.includes('logica') ||
    normUac.includes('etica') ||
    normUac.includes('estetica') ||
    normUac.includes('pensamiento filosofico') ||
    normUac.includes('bioetica')
  ) {
    return ADAPTERS.humanidades_filosofia_logica_etica;
  }

  // 9. Conciencia Histórica, Ciencias Sociales, Economía, Derecho, Administración Pública
  if (
    normUac.includes('conciencia historica') ||
    normUac.includes('ciencias sociales') ||
    normUac.includes('historia') ||
    normUac.includes('economia') ||
    normUac.includes('derecho') ||
    normUac.includes('sociologia') ||
    normUac.includes('antropologia') ||
    normUac.includes('geografia humana') ||
    normUac.includes('problemas politicos')
  ) {
    return ADAPTERS.conciencia_historica_ciencias_sociales;
  }

  // 10. Lengua y Comunicación, Literatura, Lectura, Taller de Redacción, Comunicación
  if (
    normUac.includes('lengua y comunicacion') ||
    normUac.includes('literatura') ||
    normUac.includes('lectura') ||
    normUac.includes('redaccion') ||
    normUac.includes('expresion oral') ||
    normUac.includes('talleres de escritura') ||
    normUac.includes('ciencias de la comunicacion') ||
    normUac.includes('etimologias')
  ) {
    return ADAPTERS.lengua_comunicacion_literatura;
  }

  // 11. Ciencias Naturales: Física, Mecánica, Energía, Electromagnetismo, Hidráulica
  if (
    normUac.includes('energia en los procesos') ||
    normUac.includes('interacciones de la materia') ||
    normUac.includes('temas selectos de fisica') ||
    normUac.includes('mecanica') ||
    normUac.includes('termodinamica') ||
    normUac.includes('optica') ||
    normUac.includes('acustica') ||
    /\bfisica(\s+i+|\s+\d+)?\b/.test(normUac)
  ) {
    return ADAPTERS.ciencias_fisica_ingenieria;
  }

  // 12. Ciencias Naturales: Química, Biología, Ecología, Materia, Ecosistemas, Taller de Ciencias
  if (
    normUac.includes('materia y sus interacciones') ||
    normUac.includes('conservacion de la energia') ||
    normUac.includes('ecosistemas') ||
    normUac.includes('organismos') ||
    normUac.includes('herencia y evolucion') ||
    normUac.includes('reacciones quimicas') ||
    normUac.includes('taller de ciencias') ||
    normUac.includes('quimica') ||
    normUac.includes('biologia') ||
    normUac.includes('ecologia') ||
    normUac.includes('anatomia') ||
    normUac.includes('ciencias de la salud') ||
    normUac.includes('geografia')
  ) {
    return ADAPTERS.ciencias_quimica_biologia_ambiental;
  }

  // 13. Formación Laboral / Carrera Técnica: Servicios, Administración, Turismo, Gastronomía, Contabilidad
  if (
    combined.includes('gastronomia') ||
    combined.includes('turismo') ||
    combined.includes('hospitalidad') ||
    combined.includes('administracion') ||
    combined.includes('contabilidad') ||
    combined.includes('ventas') ||
    combined.includes('mercadotecnia') ||
    combined.includes('logistica') ||
    combined.includes('puericultura') ||
    combined.includes('alimentos y bebidas')
  ) {
    return ADAPTERS.formacion_laboral_servicios_gestion_turismo;
  }

  // 14. Formación Laboral / Carrera Técnica: Industrial, Mecatrónica, Electrónica, Agropecuaria, Salud Clínica
  if (
    normComp.includes('laboral') ||
    normComp.includes('profesional') ||
    combined.includes('mecatronica') ||
    combined.includes('electronica') ||
    combined.includes('electricidad') ||
    combined.includes('mantenimiento') ||
    combined.includes('enfermeria') ||
    combined.includes('laboratorista') ||
    combined.includes('agropecuari') ||
    combined.includes('construccion') ||
    combined.includes('biotecnologia') ||
    combined.includes('soldadura')
  ) {
    return ADAPTERS.formacion_laboral_industrial_agro_salud;
  }

  // Fallback seguro hacia Ciencias / Indagación General
  return ADAPTERS.ciencias_quimica_biologia_ambiental;
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
    /gastronom|alimentos y bebidas|reposteri|panaderi|culinari/i.test(
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

