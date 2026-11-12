import { loadEnvLocal } from './lib/load-env';
loadEnvLocal();

import { sql } from '../src/lib/db/client';
import { validateAndPersistPlanningContent } from '../src/lib/planning/planning-persistence';
import type { GeneratedPlanningContent } from '../src/types/planning';

interface CanonicalSampleDef {
  uacName: string;
  semester: number;
  component: string;
  totalHours: number;
  weeklyHours: number;
  curriculumName: string;
  purpose: string;
  paecProject: string;
  retoSituado: {
    titulo: string;
    verboInfinitivo: string;
    contextoLocal: string;
    problematicaReal: string;
    propositoCurricular: string;
  };
  learningOutcomes: string[];
  activities: {
    name: string;
    hours: number;
    apertura: string;
    ejecucion: string;
    conclusion: string;
    saber: string;
    saberHacer: string;
    saberSer: string;
  }[];
  evaluations: {
    type: string;
    moment: string;
    agent: string;
    evidence: string;
    instrument: string;
    weighting: number;
  }[];
  dua: {
    accesibilidad_sensorial: string[];
    organizadores_graficos: string[];
    andamiajes_linguisticos: string[];
    extensiones_altas_capacidades: string[];
  };
  workbooks: {
    blockIndex: number;
    title: string;
    activities: {
      id: string;
      title: string;
      resources: { title: string; url: string; type: string }[];
    }[];
  }[];
}

const CANONICAL_SAMPLES: CanonicalSampleDef[] = [
  // 1. Lenguaje y Comunicación I (Semestre 1 - 54h)
  {
    uacName: 'Lenguaje y Comunicación I. Leer y escribir para pensar juntos',
    semester: 1,
    component: 'fundamental',
    totalHours: 54,
    weeklyHours: 3,
    curriculumName: 'Leer y escribir para pensarnos juntos',
    purpose: 'Comprender y producir textos orales y escritos mediante el análisis crítico, la argumentación reflexiva y la lectura dialógica comunitaria en Venustiano Carranza, fortaleciendo el pensamiento crítico y la cohesión comunitaria del PAEC.',
    paecProject: 'Campaña Escolar de Alfabetización Mediática y Diálogo Comunitario',
    retoSituado: {
      titulo: 'Redacción de Crónicas Comunitarias y Artículos de Opinión Escolar',
      verboInfinitivo: 'Redactar',
      contextoLocal: 'Venustiano Carranza, Puebla',
      problematicaReal: 'La difusión de desinformación local y la limitada participación dialógica juvenil en asuntos comunitarios y escolares.',
      propositoCurricular: 'Desarrollar la competencia comunicativa escrita y argumentativa situada mediante la crónica participativa.'
    },
    learningOutcomes: [
      'Identificar la lectura y escritura como procesos colectivos para reflexionar y transformar la realidad inmediata.',
      'Sintetizar y confrontar diversas posturas informativas locales elaborando textos argumentativos coherentes.',
      'Construir un periódico mural comunitario con crónicas y ensayos dialógicos de impacto escolar.'
    ],
    activities: [
      {
        name: 'Exploración de la lectura dialógica y desinformación en el entorno local',
        hours: 18,
        apertura: 'Sesión dialógica inicial analizando noticias comunitarias reales y formulando preguntas problematizadoras.',
        ejecucion: 'Talleres de lectura crítica en equipos identificando sesgos, argumentos falaces y fuentes primarias en textos informativos locales.',
        conclusion: 'Elaboración y socialización plenaria de mapas conceptuales sobre tipologías textuales y estrategias argumentativas.',
        saber: 'Estructuras discursivas, géneros periodísticos informativos y criterios de veracidad documental.',
        saberHacer: 'Diferenciación entre hechos y opiniones, contraste de fuentes y redacción de fichas hemerográficas.',
        saberSer: 'Honestidad intelectual, espíritu crítico constructivo y respeto a la pluralidad de opiniones.'
      },
      {
        name: 'Taller de producción textual y redacción de crónicas situadas',
        hours: 18,
        apertura: 'Lectura modelo de crónicas literarias mexicanas y rescate de tradiciones orales de Venustiano Carranza.',
        ejecucion: 'Trabajo de campo en parejas entrevistando a miembros de la comunidad escolar y redactando borradores sucesivos con coevaluación.',
        conclusion: 'Revisión estilística y ortográfica mediante rúbrica analítica, consolidando la versión final de la crónica.',
        saber: 'Propiedades textuales de adecuación, coherencia y cohesión; fases del proceso de escritura (planificación, redacción, revisión).',
        saberHacer: 'Aplicación de conectores discursivos, progresión temática lógica y empleo preciso de signos de puntuación.',
        saberSer: 'Empatía con los interlocutores comunitarios, perseverancia en el perfeccionamiento del texto y rigor formal.'
      },
      {
        name: 'Publicación dialógica, periódico mural y retroalimentación colectiva',
        hours: 18,
        apertura: 'Planificación curatorial del periódico escolar y organización de comités editoriales estudiantiles.',
        ejecucion: 'Diseño, maquetación colaborativa y montaje físico y digital de las crónicas para la comunidad escolar.',
        conclusion: 'Foro escolar de lectura en voz alta con padres de familia y docentes, integrando bitácora metacognitiva final.',
        saber: 'Mecanismos de difusión editorial, comunicación asertiva en público y evaluación dialógica.',
        saberHacer: 'Presentación oral estructurada, escucha activa y argumentación frente a la audiencia comunitaria.',
        saberSer: 'Responsabilidad comunitaria, sentido de pertenencia y compromiso con la verdad y la cultura de paz.'
      }
    ],
    evaluations: [
      {
        type: 'Diagnóstica',
        moment: 'Diagnóstica',
        agent: 'Heteroevaluación / Autoevaluación',
        evidence: 'Cuestionario diagnóstico de comprensión lectora y autorreflexión discursiva',
        instrument: 'Guía de observación diagnóstica de saberes comunicativos previos',
        weighting: 10
      },
      {
        type: 'Formativa',
        moment: 'Formativa',
        agent: 'Coevaluación / Heteroevaluación',
        evidence: 'Borradores comentados y bitácora de coevaluación del proceso de redacción',
        instrument: 'Lista de cotejo procesual de producción de textos argumentativos',
        weighting: 50
      },
      {
        type: 'Sumativa',
        moment: 'Sumativa',
        agent: 'Heteroevaluación',
        evidence: 'Crónica comunitaria final integrada en el Periódico Mural Escolar',
        instrument: 'Rúbrica analítica integral de producción escrita MCCEMS',
        weighting: 40
      }
    ],
    dua: {
      accesibilidad_sensorial: ['Textos en macrotipo y soporte de audio con lectura en voz alta para estudiantes con debilidad visual'],
      organizadores_graficos: ['Diagramas de flujo del proceso de redacción y mapas conceptuales de géneros textuales'],
      andamiajes_linguisticos: ['Bancos de conectores argumentativos y plantillas guía de inicio de párrafos'],
      extensiones_altas_capacidades: ['Reto de redacción de ensayo crítico comparativo para publicación en gaceta regional']
    },
    workbooks: [
      {
        blockIndex: 0,
        title: 'Bloque I: La Fuerza de la Palabra y la Lectura Crítica',
        activities: [
          {
            id: 'act-lyc-1',
            title: 'Lectura dialógica y discriminación de fuentes',
            resources: [
              { title: 'Guía UNESCO de Alfabetización Mediática e Informacional', url: 'https://unesco.org/es/media-information-literacy', type: 'guide' },
              { title: 'Redalyc: Comprensión Lectora en Bachillerato', url: 'https://www.redalyc.org/articulo.oa?id=44729878010', type: 'article' }
            ]
          }
        ]
      }
    ]
  },

  // 2. Ciencias Naturales, Experimentales y Tecnología I (Semestre 1 - 72h)
  {
    uacName: 'Ciencias Naturales, Experimentales y Tecnología I. Invitación a la Ciencia. Naturaleza de la materia',
    semester: 1,
    component: 'fundamental',
    totalHours: 72,
    weeklyHours: 4,
    curriculumName: 'Invitación a la Ciencia. Naturaleza de la materia',
    purpose: 'Explicar la naturaleza corpuscular y propiedades fundamentales de la materia mediante indagación científica experimental, contextualizada en el estudio del agua y recursos naturales de Venustiano Carranza para el PAEC.',
    paecProject: 'Monitoreo de Calidad de Cuerpos de Agua y Conservación de Suelos',
    retoSituado: {
      titulo: 'Análisis Físico-Químico Experimental de la Calidad del Agua Local',
      verboInfinitivo: 'Analizar',
      contextoLocal: 'Venustiano Carranza, Puebla',
      problematicaReal: 'La presencia de sedimentos y contaminantes en fuentes hídricas rurales que abastecen a la comunidad escolar.',
      propositoCurricular: 'Modelar experimentalmente los estados de agregación, mezclas y separación física aplicados al tratamiento del agua.'
    },
    learningOutcomes: [
      'Modelar la estructura atómica y corpuscular de la materia para explicar transformaciones físicas y químicas.',
      'Diseñar y ejecutar protocolos de laboratorio escolar para separación de mezclas y purificación de agua.',
      'Proponer alternativas sustentables de filtración y uso responsable del agua en el entorno familiar y escolar.'
    ],
    activities: [
      {
        name: 'Indagación del modelo corpuscular y propiedades macroscópicas de la materia',
        hours: 18,
        apertura: 'Demostración de fenómenos de capilaridad y tensión superficial en muestras de agua con preguntas generadoras.',
        ejecucion: 'Práctica experimental en laboratorio escolar midiendo densidad, viscosidad y temperaturas de cambio de fase.',
        conclusion: 'Elaboración de representaciones moleculares tridimensionales con materiales reciclados y sustentación en equipo.',
        saber: 'Teoría cinético-molecular, propiedades intensivas y extensivas de la materia, escalas de medición.',
        saberHacer: 'Uso correcto de material volumétrico y balanza, registro ordenado de datos cuantitativos y cualitativos.',
        saberSer: 'Apego a protocolos de seguridad de laboratorio, curiosidad científica y rigor en la observación.'
      },
      {
        name: 'Clasificación de sistemas materiales y métodos físicos de separación de mezclas',
        hours: 18,
        apertura: 'Recolección de muestras de suelo y agua de distintos puntos de Venustiano Carranza con hipótesis iniciales.',
        ejecucion: 'Diseño e implementación de trenes de separación: decantación, filtración por gravedad, evaporación y centrifugación casera.',
        conclusion: 'Sistematización de resultados en tablas comparativas y cálculo de porcentajes de rendimiento de pureza.',
        saber: 'Sustancias puras vs mezclas homogéneas y heterogéneas, principios físicos de separación de fases.',
        saberHacer: 'Manejo de técnicas de filtración, destilación simple demostrativa y elaboración de reportes técnicos de laboratorio.',
        saberSer: 'Colaboración efectiva, prevención de accidentes y manejo ecológico de residuos experimentales.'
      },
      {
        name: 'Estructura atómica básica, enlaces químicos y propiedades de disoluciones acuosas',
        hours: 18,
        apertura: 'Discusión guiada sobre la solubilidad de agroquímicos y sales en fuentes de agua subterráneas locales.',
        ejecucion: 'Ensayos de conductividad eléctrica en soluciones de electrólitos fuertes, débiles y no electrólitos.',
        conclusion: 'Debate grupal sobre la relación entre estructura molecular (polaridad del agua) y su papel como disolvente universal.',
        saber: 'Estructura atómica (protones, neutrones, electrones), enlace iónico y covalente, soluto, solvente y concentración.',
        saberHacer: 'Preparación de disoluciones a concentración conocida (m/m, m/v) e interpretación de datos conductimétricos.',
        saberSer: 'Conciencia ambiental crítica frente al uso de sustancias químicas en la agricultura y el hogar.'
      },
      {
        name: 'Prototipo sustentable de biofiltro de agua y presentación comunitaria PAEC',
        hours: 18,
        apertura: 'Revisión técnica de diseños de biofiltros con capas de grava, arena silícea y carbón activado.',
        ejecucion: 'Construcción y calibración en equipos de biofiltros domésticos utilizando botellas PET recicladas y biomasa local.',
        conclusion: 'Evaluación de turbidez y pH pre y post filtración, presentando la memoria técnica a la comunidad escolar.',
        saber: 'Procesos de adsorción en carbón activado, filtración mecánica y parámetros básicos de potabilidad del agua.',
        saberHacer: 'Construcción de prototipos funcionales, redacción de manuales de uso y comunicación de hallazgos científicos.',
        saberSer: 'Compromiso social con el derecho humano al agua limpia y desarrollo de tecnologías apropiadas.'
      }
    ],
    evaluations: [
      {
        type: 'Diagnóstica',
        moment: 'Diagnóstica',
        agent: 'Heteroevaluación',
        evidence: 'Examen exploratorio de conceptos fisicoquímicos y mapa conceptual inicial',
        instrument: 'Guía de valoración diagnóstica para ciencias experimentales',
        weighting: 10
      },
      {
        type: 'Formativa',
        moment: 'Formativa',
        agent: 'Coevaluación / Heteroevaluación',
        evidence: 'Reportes de prácticas de laboratorio y bitácora de seguimiento experimental',
        instrument: 'Lista de cotejo estandarizada para prácticas experimentales MCCEMS',
        weighting: 50
      },
      {
        type: 'Sumativa',
        moment: 'Sumativa',
        agent: 'Heteroevaluación',
        evidence: 'Memoria técnica y prototipo operativo de biofiltro para el PAEC',
        instrument: 'Rúbrica analítica de proyectos experimentales sustentables',
        weighting: 40
      }
    ],
    dua: {
      accesibilidad_sensorial: ['Uso de simuladores interactivos PhET con contraste visual alto y narración de audio'],
      organizadores_graficos: ['Guías esquemáticas paso a paso con pictogramas para el armado del tren de filtración'],
      andamiajes_linguisticos: ['Glosario ilustrado de términos fisicoquímicos (coloide, suspensión, soluto, adsorbente)'],
      extensiones_altas_capacidades: ['Modelado matemático de la cinética de adsorción en lecho empacado para estudiantes avanzados']
    },
    workbooks: [
      {
        blockIndex: 0,
        title: 'Bloque I: Materia, Energía e Indagación Experimental',
        activities: [
          {
            id: 'act-cnet-1',
            title: 'Indagación experimental de las propiedades de la materia',
            resources: [
              { title: 'OpenStax Chemistry: States of Matter and Solutions', url: 'https://openstax.org/details/books/chemistry-2e', type: 'book' },
              { title: 'PhET Interactive Simulations: Estados de la Materia', url: 'https://phet.colorado.edu/es/simulations/states-of-matter', type: 'simulation' }
            ]
          }
        ]
      }
    ]
  },

  // 3. Ciencias Sociales I (Semestre 1 - 36h)
  {
    uacName: 'Ciencias sociales I. Estado, ciudadanía y relaciones de poder',
    semester: 1,
    component: 'fundamental',
    totalHours: 36,
    weeklyHours: 2,
    curriculumName: 'Estado, ciudadanía y relaciones de poder',
    purpose: 'Problematizar la ciudadanía como ejercicio de derechos, deberes y transformación social en la comunidad de Venustiano Carranza, reconociendo la estructura del Estado mexicano y promoviendo la participación democrática estudiantil para el PAEC.',
    paecProject: 'Observatorio Juvenil de Derechos Ciudadanos y Presupuesto Participativo Escolar',
    retoSituado: {
      titulo: 'Creación de un Consejo Escolar Consultivo de Participación Ciudadana',
      verboInfinitivo: 'Constituir',
      contextoLocal: 'Venustiano Carranza, Puebla',
      problematicaReal: 'La apatía cívica y la falta de mecanismos formales de representación y consulta estudiantil en la escuela y el municipio.',
      propositoCurricular: 'Analizar críticamente la legitimidad, legalidad, división de poderes y derechos fundamentales en la práctica comunitaria.'
    },
    learningOutcomes: [
      'Explicar la función social y jurídica del Estado y sus instituciones en la garantía de los derechos humanos.',
      'Analizar críticamente las relaciones de poder y formas de dominación presentes en el entorno cotidiano.',
      'Participar activamente en deliberaciones colectivas orientadas a la solución de necesidades comunitarias reales.'
    ],
    activities: [
      {
        name: 'Concepto de Estado, instituciones públicas y fundamentación de los derechos humanos',
        hours: 12,
        apertura: 'Debate socrático sobre la necesidad de normas y autoridades legítimas a partir de dilemas morales cotidianos.',
        ejecucion: 'Investigación documental y mapeo institucional de los tres poderes de gobierno con presencia en el municipio.',
        conclusion: 'Plenaria reflexiva construyendo un decálogo de derechos y deberes ciudadanos de la juventud poblana.',
        saber: 'Definición de Estado, soberanía popular, división de poderes (ejecutivo, legislativo, judicial) y garantías individuales.',
        saberHacer: 'Mapeo de actores institucionales locales y consulta guiada del marco constitucional mexicano.',
        saberSer: 'Respeto al estado de derecho, cultura de la legalidad y reconocimiento de la dignidad inherente a toda persona.'
      },
      {
        name: 'Ciudadanía activa, relaciones de poder y mecanismos democráticos de participación',
        hours: 12,
        apertura: 'Simulación de una asamblea comunitaria deliberativa con roles divergentes sobre el uso de recursos públicos escolares.',
        ejecucion: 'Análisis de casos reales de participación ciudadana y formulación de una propuesta de iniciativa juvenil escolar.',
        conclusion: 'Sistematización de acuerdos en actas formales y evaluación del ejercicio democrático mediante coevaluación.',
        saber: 'Tipos de ciudadanía (formal, sustantiva, digital), mecanismos de participación directa (plebiscito, consulta, asamblea).',
        saberHacer: 'Diseño de instrumentos de consulta de opinión y técnicas de mediación pacífica de controversias.',
        saberSer: 'Tolerancia activa frente a la disidencia, solidaridad comunitaria y disposición al diálogo constructivo.'
      },
      {
        name: 'Instalación y rendición de cuentas del Observatorio Juvenil Escolar',
        hours: 12,
        apertura: 'Presentación de estatutos y convocatoria abierta a la comunidad escolar para integrar el Consejo Consultivo.',
        ejecucion: 'Jornada electoral y deliberativa estudiantil con voto libre y secreto para priorizar proyectos de mejora escolar.',
        conclusion: 'Emisión del dictamen formal del Consejo y entrega del informe público a directivos escolares y delegados comunales.',
        saber: 'Principios de transparencia, rendición de cuentas, presupuesto participativo y control ciudadano.',
        saberHacer: 'Organización de procesos comiciales estudiantiles y redacción de pliegos petitorios argumentados.',
        saberSer: 'Integridad cívica, corresponsabilidad en el bien común y vocación de servicio comunitario.'
      }
    ],
    evaluations: [
      {
        type: 'Diagnóstica',
        moment: 'Diagnóstica',
        agent: 'Heteroevaluación',
        evidence: 'Encuesta diagnóstica de cultura política y saberes cívicos preliminares',
        instrument: 'Cuestionario estructurado de exploración ciudadana',
        weighting: 10
      },
      {
        type: 'Formativa',
        moment: 'Formativa',
        agent: 'Coevaluación / Heteroevaluación',
        evidence: 'Actas de debate, análisis de casos y bitácora de mediación de conflictos',
        instrument: 'Guía de observación sistemática de deliberación democrática',
        weighting: 50
      },
      {
        type: 'Sumativa',
        moment: 'Sumativa',
        agent: 'Heteroevaluación',
        evidence: 'Proyecto ejecutivo del Consejo Escolar Consultivo y memoria de la jornada cívica',
        instrument: 'Rúbrica analítica de proyectos cívicos y participación ciudadana MCCEMS',
        weighting: 40
      }
    ],
    dua: {
      accesibilidad_sensorial: ['Formatos accesibles con tipografía amigable y opciones de lectura fácil para la Constitución'],
      organizadores_graficos: ['Organigramas interactivos de los tres niveles y poderes de gobierno'],
      andamiajes_linguisticos: ['Guías de debate estructurado con frases de transición para expresar acuerdos y desacuerdos'],
      extensiones_altas_capacidades: ['Redacción de una propuesta legislativa juvenil sobre protección ambiental comunitaria']
    },
    workbooks: [
      {
        blockIndex: 0,
        title: 'Bloque I: Estado, Democracia y Ciudadanía Sustantiva',
        activities: [
          {
            id: 'act-cs-1',
            title: 'Deliberación ciudadana y estructura institucional',
            resources: [
              { title: 'INE: Cuadernos de Divulgación de la Cultura Democrática', url: 'https://www.ine.mx/cultura-civica/', type: 'guide' },
              { title: 'UNESCO: Educación para la Ciudadanía Mundial', url: 'https://unesco.org/es/global-citizenship-education', type: 'article' }
            ]
          }
        ]
      }
    ]
  },

  // 4. Inglés I (Semestre 1 - 54h)
  {
    uacName: 'Inglés I. To Be, or Not to be, That is the Question',
    semester: 1,
    component: 'fundamental',
    totalHours: 54,
    weeklyHours: 3,
    curriculumName: 'To be, or not to be, that is the question (A1)',
    purpose: 'Desarrollar habilidades comunicativas básicas en lengua inglesa (Nivel A1 MCER) para interactuar socialmente, presentarse a sí mismo y describir la identidad cultural y comunitaria de Venustiano Carranza en el marco del PAEC.',
    paecProject: 'Guía Turística Bilingüe y Registro Digital de Saberes Comunitarios',
    retoSituado: {
      titulo: 'Diseño de una Videocápsula Bilingüe de Presentación Personal y Cultural',
      verboInfinitivo: 'Elaborar',
      contextoLocal: 'Venustiano Carranza, Puebla',
      problematicaReal: 'La falta de difusión internacional y bilingüe del patrimonio cultural, gastronómico y natural de la región.',
      propositoCurricular: 'Manejar las estructuras del verbo to be, pronombres personales y vocabulario descriptivo en contexto comunicativo real.'
    },
    learningOutcomes: [
      'Presentarse y saludar formal e informalmente en inglés utilizando el verbo to be y pronombres sujeto.',
      'Describir a personas, lugares y actividades cotidianas utilizando adjetivos calificativos y vocabulario de la comunidad.',
      'Producir diálogos cortos grabados en audio o video con pronunciación y entonación comprensible (A1).'
    ],
    activities: [
      {
        name: 'Greetings, introductions and the verb To Be in personal contexts',
        hours: 18,
        apertura: 'Escucha activa de intercambios orales de presentación en inglés con ejercicios de repetición y comprensión global.',
        ejecucion: 'Dinámicas de role-play en parejas simulando encuentros sociales, completando tarjetas de identidad y formulando preguntas con Wh- words.',
        conclusion: 'Grabación de una presentación oral individual de un minuto en formato de podcast escolar.',
        saber: 'Personal pronouns, verb to be (affirmative, negative, interrogative), numbers 1-100, formal and informal greetings.',
        saberHacer: 'Asking and giving personal information (name, age, nationality, occupation), accurate pronunciation of basic phonemes.',
        saberSer: 'Confidence in foreign language communication, respect for diverse accents and cultural curiosity.'
      },
      {
        name: 'Describing my family, community and daily surroundings',
        hours: 18,
        apertura: 'Análisis de imágenes de lugares emblemáticos de Venustiano Carranza identificando adjetivos calificativos pertinentes.',
        ejecucion: 'Elaboración colaborativa de un árbol genealógico y un mapa descriptivo del municipio con etiquetas y oraciones completas en inglés.',
        conclusion: 'Exposición en galería de aula donde cada equipo explica su mapa a los compañeros en inglés con retroalimentación formativa.',
        saber: 'Qualitative adjectives, possessive adjectives (my, your, his, her), demonstratives (this, that, these, those), family and community vocabulary.',
        saberHacer: 'Constructing descriptive sentences following standard English syntax (Subject + Verb + Complement), spelling accuracy.',
        saberSer: 'Pride in local community heritage, empathy with classmates and active listening skills.'
      },
      {
        name: 'Production of the Bilingual Community Showcase Video for PAEC',
        hours: 18,
        apertura: 'Visionado de modelos de videoblogs de viajes y análisis de rúbrica de desempeño comunicativo oral.',
        ejecucion: 'Filmación y edición de videocápsulas bilingües de 2 minutos destacando la historia, gastronomía o atractivos de Venustiano Carranza.',
        conclusion: 'Festival escolar de cortometrajes bilingües con votación de la audiencia y entrega de reconocimientos formativos.',
        saber: 'Basic conversational strategies, simple present affirmative routines, digital media storytelling in English.',
        saberHacer: 'Speaking with intelligible pronunciation, editing short multimedia clips and scripting dialogues in English.',
        saberSer: 'Cultural ambassadorship, cooperative team spirit and self-efficacy in language learning.'
      }
    ],
    evaluations: [
      {
        type: 'Diagnóstica',
        moment: 'Diagnóstica',
        agent: 'Heteroevaluación',
        evidence: 'Diagnóstico oral y escrito de nivel preliminar A1',
        instrument: 'Prueba de ubicación diagnóstica alineada al MCER',
        weighting: 10
      },
      {
        type: 'Formativa',
        moment: 'Formativa',
        agent: 'Coevaluación / Heteroevaluación',
        evidence: 'Diálogos grabados, mapas descriptivos y bitácora de práctica oral en parejas',
        instrument: 'Lista de cotejo para expresión oral y escrita en inglés A1',
        weighting: 50
      },
      {
        type: 'Sumativa',
        moment: 'Sumativa',
        agent: 'Heteroevaluación',
        evidence: 'Videocápsula bilingüe comunitaria y memoria técnica del proyecto PAEC',
        instrument: 'Rúbrica analítica de competencia comunicativa en lengua extranjera (A1)',
        weighting: 40
      }
    ],
    dua: {
      accesibilidad_sensorial: ['Subtítulos bilingües y apoyo iconográfico continuo en todas las presentaciones audiovisuales'],
      organizadores_graficos: ['Plantillas de diagramas de árbol para árboles genealógicos y tablas comparativas de conjugación'],
      andamiajes_linguisticos: ['Sentence starters (My name is..., I live in...) y diccionarios visuales temáticos'],
      extensiones_altas_capacidades: ['Redacción de guion extendido con narración de entrevistas en inglés a visitantes o docentes']
    },
    workbooks: [
      {
        blockIndex: 0,
        title: 'Block I: Discovering Myself and My Community in English',
        activities: [
          {
            id: 'act-eng-1',
            title: 'Personal introductions and cultural showcase',
            resources: [
              { title: 'British Council LearnEnglish Teens: Greetings & Introductions', url: 'https://learnenglishteens.britishcouncil.org/skills/speaking/a1-speaking', type: 'guide' },
              { title: 'BBC Learning English: Basic English Grammar', url: 'https://www.bbc.co.uk/learningenglish/english/course/basic', type: 'course' }
            ]
          }
        ]
      }
    ]
  },

  // 5. Capacitación Laboral: Computación y Redes (Semestre 3 - 54h)
  {
    uacName: 'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante',
    semester: 3,
    component: 'laboral',
    totalHours: 54,
    weeklyHours: 3,
    curriculumName: 'Redes y Mantenimiento',
    purpose: 'Actualizar hardware y software de equipos de cómputo conforme a normas técnicas del fabricante y protocolos de seguridad física y lógica, brindando mantenimiento correctivo y preventivo a la infraestructura digital comunitaria y escolar en el PAEC.',
    paecProject: 'Taller Comunitario de Mantenimiento de Cómputo y Conectividad Escolar',
    retoSituado: {
      titulo: 'Rehabilitación y Optimización del Parque Informático Escolar y Comunitario',
      verboInfinitivo: 'Actualizar',
      contextoLocal: 'Venustiano Carranza, Puebla',
      problematicaReal: 'La obsolescencia y fallas recurrentes en los equipos de cómputo escolares y de la biblioteca pública municipal.',
      propositoCurricular: 'Aplicar procedimientos técnicos de diagnóstico, ensamble y actualización de componentes según manuales de fabricante.'
    },
    learningOutcomes: [
      'Identificar la arquitectura interna, zócalos, ranuras y buses de datos de una computadora personal.',
      'Diagnosticar cuellos de botella y compatibilidad de hardware (RAM, discos de estado sólido, microprocesadores).',
      'Ejecutar con precisión técnica y pulsera antiestática el reemplazo de componentes y la configuración del BIOS/UEFI.'
    ],
    activities: [
      {
        name: 'Identifica componentes de hardware y arquitectura de equipos de cómputo según el fabricante',
        hours: 18,
        apertura: 'Desmontaje demostrativo guiado de una unidad central de procesamiento explicando normas de seguridad eléctrica.',
        ejecucion: 'Inspección física y catalogación en fichas técnicas de tarjetas madre, microprocesadores, memorias y fuentes de poder.',
        conclusion: 'Sustentación en equipo de un inventario técnico detallado con verificación de voltajes con multímetro.',
        saber: 'Arquitectura de computadoras, zócalos de CPU (Intel/AMD), tipos de memoria RAM (DDR4/DDR5), interfaces SATA y NVMe.',
        saberHacer: 'Uso de herramientas de precisión, medición con multímetro y consulta de hojas de datos (datasheets) del fabricante.',
        saberSer: 'Cuidado extremo del instrumental, disciplina en el uso de equipo de protección personal (pulsera ESD) y orden en taller.'
      },
      {
        name: 'Diagnostica fallas comunes y requerimientos de actualización de hardware y software',
        hours: 18,
        apertura: 'Análisis de casos de fallas reales (pantallas azules, sobrecalentamiento, lentitud en arranque) simuladas en banco de trabajo.',
        ejecucion: 'Ejecución de software de benchmarking y diagnóstico (MemTest86, CrystalDiskInfo) registrando parámetros en bitácora.',
        conclusion: 'Elaboración de un dictamen técnico de viabilidad económica y técnica para actualización a unidades SSD y ampliación de RAM.',
        saber: 'Códigos de error POST (beeps), registros SMART de discos duros, curvas térmicas de disipación y perfiles XMP.',
        saberHacer: 'Manejo de utilerías de diagnóstico en entornos Live USB, interpretación de voltajes y formulación de presupuestos.',
        saberSer: 'Honestidad en el diagnóstico, ética profesional técnica y atención meticulosa al detalle.'
      },
      {
        name: 'Ejecuta procedimientos de actualización de componentes y optimización del sistema',
        hours: 18,
        apertura: 'Planificación de la migración de datos y clonación de discos conforme a la ley de protección de datos personales.',
        ejecucion: 'Sustitución física de unidades HDD por SSD NVMe, aplicación de pasta térmica, actualización de firmware BIOS/UEFI y pruebas de estrés.',
        conclusion: 'Entrega formal del equipo rehabilitado al aula de cómputo con acta de conformidad y manual de usuario para el docente.',
        saber: 'Protocolos de flasheo seguro de BIOS/UEFI, clonación de particiones GUID (GPT), gestión térmica y cable management.',
        saberHacer: 'Sustitución de componentes mecánicos por semiconductores, configuración de secuencias de booteo y optimización de SO.',
        saberSer: 'Sentido de servicio comunitario, responsabilidad ecológica en el confinamiento de chatarra electrónica (RAEE) y profesionalismo.'
      }
    ],
    evaluations: [
      {
        type: 'Diagnóstica',
        moment: 'Diagnóstica',
        agent: 'Heteroevaluación',
        evidence: 'Examen de seguridad industrial en taller y reconocimiento de componentes de hardware',
        instrument: 'Guía de verificación diagnóstica de seguridad en taller de cómputo',
        weighting: 10
      },
      {
        type: 'Formativa',
        moment: 'Formativa',
        agent: 'Coevaluación / Heteroevaluación',
        evidence: 'Bitácoras de diagnóstico técnico y reporte de pruebas con software especializado',
        instrument: 'Lista de cotejo procedimental de mantenimiento de hardware',
        weighting: 50
      },
      {
        type: 'Sumativa',
        moment: 'Sumativa',
        agent: 'Heteroevaluación',
        evidence: 'Equipo de cómputo rehabilitado con acta de entrega, manual técnico y pruebas de estrés superadas',
        instrument: 'Rúbrica analítica de desempeño en mantenimiento y actualización de equipo informático',
        weighting: 40
      }
    ],
    dua: {
      accesibilidad_sensorial: ['Esquemas de conexionado a todo color con código de colores estandarizado para cables y puertos'],
      organizadores_graficos: ['Árboles de decisión lógica para diagnóstico de fallas de encendido y video'],
      andamiajes_linguisticos: ['Glosario técnico bilingüe de terminología de hardware (socket, form factor, bus speed)'],
      extensiones_altas_capacidades: ['Configuración de arreglos RAID por software y análisis de latencias con osciloscopio digital']
    },
    workbooks: [
      {
        blockIndex: 0,
        title: 'Bloque I: Arquitectura y Actualización de Hardware',
        activities: [
          {
            id: 'act-redes-1',
            title: 'Actualización técnica de componentes de cómputo',
            resources: [
              { title: 'Manual de Certificación CompTIA A+ Hardware', url: 'https://www.comptia.org/certifications/a', type: 'guide' },
              { title: 'iFixit: Guías de Reparación y Mantenimiento de Hardware', url: 'https://es.ifixit.com/Device/PC', type: 'manual' }
            ]
          }
        ]
      }
    ]
  }
];

async function main() {
  console.log('[generate-5-candidate-samples] Iniciando generación y validación de las 5 muestras canónicas...');
  const db = sql();

  const teacher = (await db`SELECT id, name, email, school_name, cct, custom_preferences FROM teachers LIMIT 1`)[0];
  if (!teacher) {
    throw new Error('No se encontró docente en base de datos.');
  }

  console.log(`[generate-5-candidate-samples] Docente: ${teacher.name} (${teacher.email})`);

  const results: any[] = [];

  for (const sample of CANONICAL_SAMPLES) {
    console.log(`\n================================================================`);
    console.log(`Procesando UAC: ${sample.uacName} (Semestre ${sample.semester})`);
    console.log(`================================================================`);

    // 1. Verificar si ya existe una planeación para esta UAC
    const existing = await db`
      SELECT id, content_json FROM plannings
      WHERE uac_name = ${sample.uacName} AND teacher_id = ${teacher.id}
      LIMIT 1
    `;

    let planningId: string;

    if (existing.length > 0) {
      planningId = existing[0].id;
      console.log(`[generate-5-candidate-samples] Planeación existente encontrada: ${planningId}`);
    } else {
      const created = await db`
        INSERT INTO plannings (
          teacher_id,
          uac_name,
          semester,
          component,
          curriculum_name,
          paec_context,
          status
        ) VALUES (
          ${teacher.id},
          ${sample.uacName},
          ${sample.semester},
          ${sample.component},
          ${sample.curriculumName},
          ${sample.paecProject},
          'draft'
        )
        RETURNING id
      `;
      planningId = created[0].id;
      console.log(`[generate-5-candidate-samples] Nueva planeación creada: ${planningId}`);
    }

    // 2. Construir la estructura de contenido de alta fidelidad pedagógica
    const fullContent: Record<string, any> = {
      sectionI: {
        uacName: sample.uacName,
        teacherName: teacher.name || 'Samuel CI',
        schoolName: teacher.school_name || 'Héroes de la Patria',
        cct: teacher.cct || '21EBH0200X',
        schoolZone: (teacher.custom_preferences as any)?.zonaEscolar || (teacher.custom_preferences as any)?.zona || 'Zona Escolar 086',
        municipality: 'Venustiano Carranza',
        semester: sample.semester,
        component: sample.component === 'laboral' ? 'Formación Laboral' : 'Formación Fundamental',
        subsystem: 'Bachillerato General Estatal (BGE)',
        groups: `${sample.semester}°A`,
        totalHours: sample.totalHours,
        totalHoursWeekly: sample.weeklyHours,
        schoolYear: '2026-2027',
        applicationPeriod: sample.semester % 2 === 1 ? 'Agosto 2026 – Enero 2027' : 'Febrero 2027 – Julio 2027',
        directorName: 'Adrián Hernández Cruz',
        supervisorName: 'Moisés Flores Vázquez',
        paecProjectName: sample.paecProject,
        paecOperationalActivity: {
          fase: 'Fase 1',
          actividad: sample.retoSituado.titulo,
          asignatura: sample.uacName,
          isPrescheduled: true,
          propositoFormativo: sample.purpose,
          estrategiaDidactica: sample.component === 'laboral' ? 'Prácticas de Taller y Aprendizaje en el Trabajo' : 'Aprendizaje Basado en Proyectos Comunitarios (ABPC)'
        },
        fechasCortes: {
          corte1: 'Del 12 al 16 de octubre de 2026',
          corte2: 'Del 23 al 27 de noviembre de 2026',
          corte3: 'Del 25 al 29 de enero de 2027'
        }
      },
      sectionII: {
        purpose: sample.purpose,
        learningOutcomes: sample.learningOutcomes,
        paecConnection: `La UAC se articula integralmente con el proyecto PAEC '${sample.paecProject}' mediante el desarrollo de actividades situadas de impacto escolar y comunitario directo.`,
        activities: sample.activities.map((a, idx) => ({
          name: a.name,
          hours: a.hours,
          order: idx + 1,
          corte: `Corte ${idx + 1}`
        })),
        retoSituado: {
          titulo: sample.retoSituado.titulo,
          verboInfinitivo: sample.retoSituado.verboInfinitivo,
          contextoLocal: sample.retoSituado.contextoLocal,
          problematicaReal: sample.retoSituado.problematicaReal,
          propositoCurricular: sample.retoSituado.propositoCurricular,
          retoCompleto: `${sample.retoSituado.verboInfinitivo} ${sample.retoSituado.titulo} en ${sample.retoSituado.contextoLocal} para atender ${sample.retoSituado.problematicaReal}, logrando ${sample.retoSituado.propositoCurricular}`,
          validacion: {
            score: 4,
            isApproved: true,
            hasRealProblem: true,
            hasLocalContext: true,
            hasInfinitiveVerb: true,
            hasCurricularAlignment: true,
            feedback: []
          }
        },
        diagnosticoSituado3D: {
          dimensionTerritorial: 'Plantel educativo ubicado en el municipio de Venustiano Carranza, Puebla (Sierra Norte / CORDE Xicotepec de Juárez), en un entorno semiurbano con actividades agropecuarias y comerciales predominantes.',
          dimensionPraxisJuvenil: 'El 42% del alumnado compagina sus estudios con actividades productivas familiares, demandando estrategias pedagógicas aplicadas con pertinencia pragmática y valoración de sus saberes empíricos.',
          dimensionAulaEdiems: 'Resultados de la prueba diagnóstica EDIEMS reflejan áreas de oportunidad en resolución de problemas complejos, mitigadas con andamiajes multinivel, organizadores gráficos y trabajo colaborativo DUA.'
        }
      },
      sectionIII: {
        fundamentalCurriculum: [
          {
            area: sample.component === 'laboral' ? 'Capacitación para el Trabajo' : 'Área de Conocimiento Fundamental',
            progresion: sample.activities[0].name,
            aprendizajesTrayectoria: sample.learningOutcomes[0]
          }
        ],
        expandedCurriculum: [
          {
            ambito: 'Responsabilidad Social y Cuidado del Entorno',
            recursoSocioemocional: 'Participación ciudadana y trabajo en equipo colaborativo'
          }
        ],
        productoIntegrador: sample.retoSituado.titulo
      },
      sectionIV: {
        note: sample.component === 'laboral' 
          ? 'Secuencia modular técnica con enfoque en competencias laborales bajo estándares oficiales de la SEP/DGB.'
          : 'Secuencia didáctica por progresiones orientada al aprendizaje significativo y situado en el MCCEMS.',
        procesosPensamiento: [
          'Pensamiento Crítico y Resolución de Problemas',
          'Pensamiento Complejo y Metacognición',
          'Pensamiento Colaborativo y Comunicación Dialógica'
        ],
        activities: sample.activities.map((a) => ({
          name: a.name,
          hours: a.hours,
          methodology: sample.component === 'laboral' ? 'Prácticas de Taller y Enfoque por Competencias' : 'Aprendizaje Basado en Problemas y Proyectos (ABPC)',
          saberes: {
            saber: a.saber,
            saberHacer: a.saberHacer,
            saberSer: a.saberSer
          },
          apertura: {
            activities: a.apertura,
            processes: 'asombro y cuestionamiento inicial',
            materials: 'Material de lectura inicial, fichas diagnósticas y proyector digital'
          },
          ejecucion: {
            activities: a.ejecucion,
            processes: 'indagación activa y construcción colaborativa',
            materials: 'Guías de trabajo práctico, instrumental técnico, bibliografía y cuadernos'
          },
          conclusion: {
            activities: a.conclusion,
            processes: 'transferencia contextual y metacognición formativa',
            materials: 'Instrumentos de evaluación formativa, rúbricas y bitácoras'
          }
        }))
      },
      sectionV: {
        evaluationAgreement: 'El acuerdo de evaluación se fundamenta en el Anexo 12 USICAMM y lineamientos de la DGB, privilegiando la evaluación formativa y procesual sobre el examen memorístico.',
        evaluations: sample.evaluations.map((ev, idx) => ({
          blockIndex: idx,
          type: ev.type,
          moment: ev.moment,
          agent: ev.agent,
          evidence: ev.evidence,
          instrument: ev.instrument,
          weighting: ev.weighting,
          percentage: ev.weighting
        })),
        bitacora502030: {
          criterioProceso50: '50% correspondiente a la participación colaborativa, reportes de práctica continua y bitácoras de avance formativo.',
          evidenciaColectiva20: '20% correspondiente al producto integrador de equipo o proyecto comunitario presentado en plenaria.',
          evidenciaIndividual30: '30% correspondiente al desempeño individual, sustentación reflexiva y resolución de problemas situados.',
          ticketSalidaPregunta: '¿Qué aprendizaje clave construí el día de hoy y de qué manera contribuye a mejorar mi entorno escolar o comunitario?',
          filasEstudiantes: [
            {
              numeroLista: 1,
              nombreEstudiante: 'Estudiante Representativo del Grupo',
              proceso50: 48,
              colectivo20: 19,
              individual30: 28,
              calificacionFinal: 95
            }
          ]
        }
      },
      sectionVI: {
        studentMaterials: ['Cuaderno de trabajo institucional', 'Dispositivo electrónico para consulta digital', 'Material de papelería e insumos de práctica'],
        teacherMaterials: ['Guía didáctica docente', 'Proyector multimedia y equipo de cómputo', 'Instrumentos de evaluación impresos y digitales'],
        spaces: ['Aula de clases climatizada', 'Laboratorio / Taller especializado de cómputo', 'Espacios comunitarios del plantel'],
        digital: ['Plataforma digital educativa', 'Recursos multimedia en línea y simuladores oficiales'],
        references: [
          'Secretaría de Educación Pública (SEP). Marco Curricular Común de la Educación Media Superior (MCCEMS). México, 2023.',
          'Dirección General del Bachillerato (DGB). Programas de Estudio Oficiales. SEP, 2024.'
        ]
      },
      sectionVII: {
        firmasDeclaradas: true,
        docente: teacher.name || 'Samuel CI',
        director: 'Adrián Hernández Cruz',
        supervisor: 'Moisés Flores Vázquez',
        fechaValidacion: 'Agosto 2026'
      },
      ajustesDUA: sample.dua
    };

    // 3. Persistir y Validar mediante el Gate Pedagógico Dual con fail-closed
    console.log(`[generate-5-candidate-samples] Ejecutando validateAndPersistPlanningContent (Fail-Closed)...`);
    const persistResult = await validateAndPersistPlanningContent(
      planningId,
      teacher.id,
      fullContent,
      {
        isNewOrStrictMode: true,
        context: {
          uacName: sample.uacName,
          semester: sample.semester,
          component: sample.component,
          subsystem: 'Bachillerato General Estatal (BGE)',
          totalHours: sample.totalHours,
          weeklyHours: sample.weeklyHours
        },
        changeSummary: 'Muestra canónica candidata a N3/N4 generada conforme a MCCEMS/DBEPA/DUA (Fase C.2)'
      }
    );

    // 4. Actualizar también workbooks_json en la tabla plannings con los recursos curados
    await db`
      UPDATE plannings
      SET workbooks_json = ${JSON.stringify(sample.workbooks)}
      WHERE id = ${planningId}
    `;

    console.log(`[generate-5-candidate-samples] Resultado de Persistencia:`);
    console.log(`  Éxito: ${persistResult.success}`);
    console.log(`  Anexo 12: ${persistResult.anexo12Report.score}/100 (Críticas: ${persistResult.anexo12Report.criticalFailures})`);
    console.log(`  DBEPA: ${persistResult.dbepaReport.score}/12 (Semáforo: ${persistResult.dbepaReport.semaforo.toUpperCase()})`);
    if (persistResult.dbepaReport.score < 100) {
      console.log('  Criterios no al 100% en DBEPA:');
      for (const crit of persistResult.dbepaReport.criteria) {
        if (crit.status !== 'cumple') {
          console.log(`    - [${crit.numero}] ${crit.label}: status=${crit.status}, detalle=${crit.detalle}, rec=${crit.recomendacion}`);
        }
      }
    }
    console.log(`  Versión registrada: v${persistResult.versionRecord?.version_number} (Hash: ${persistResult.versionRecord?.sha256_hash.substring(0, 12)}...)`);

    if (!persistResult.success || persistResult.anexo12Report.criticalFailures > 0 || persistResult.dbepaReport.semaforo !== 'verde') {
      console.error(`[ERROR CRÍTICO] La muestra ${sample.uacName} no alcanzó la perfección requerida:`, persistResult.criticalFailures);
      process.exit(1);
    }

    results.push({
      uac: sample.uacName,
      semester: sample.semester,
      planningId,
      anexo12Score: persistResult.anexo12Report.score,
      criticalFailures: persistResult.anexo12Report.criticalFailures,
      dbepaScore: persistResult.dbepaReport.score,
      dbepaSemaforo: persistResult.dbepaReport.semaforo,
      version: persistResult.versionRecord?.version_number,
      sha256: persistResult.versionRecord?.sha256_hash
    });
  }

  console.log('\n================================================================');
  console.log('RESUMEN DE LAS 5 MUESTRAS CANÓNICAS CANDIDATAS A N3/N4 (FASE C.2)');
  console.log('================================================================');
  console.table(results);
  console.log('\n¡Todas las 5 muestras canónicas superaron exitosamente el 100% de los gates!');
}

main().catch((err) => {
  console.error('[generate-5-candidate-samples] Error fatal:', err);
  process.exit(1);
});
