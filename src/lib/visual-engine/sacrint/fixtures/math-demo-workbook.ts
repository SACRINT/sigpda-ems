import type { ActiveWorkTextbook } from '@/types/work-textbook';

export const MATH_DEMO_WORKBOOK: ActiveWorkTextbook = {
  id: 'sacrint-demo-math',
  planningId: 'sacrint-demo-planning',
  blockIndex: 0,
  blockName: 'Modela fenómenos lineales para tomar decisiones comunitarias.',
  version: 1,
  subsystem: 'bge',
  targetPages: 24,
  totalPages: 22,
  totalWords: 6400,
  generatedAt: '2026-10-25T00:00:00.000Z',
  qualityScore: 95,
  qualityWarning: false,
  coverData: {
    title: 'La geometría del impacto: función lineal y decisiones comunitarias',
    subtitle: 'Misiones Didácticas Orientadas al Proyecto PAEC Comunitario',
    subjectName: 'Pensamiento Matemático I',
    semester: 1,
    blockNumber: 1,
    teacherName: 'Equipo SACRINT',
    schoolName: 'Plantel de demostración',
    cct: '21EBH0000X',
    paecProjectName: 'Café comunitario: cosecha, precio y decisión',
    municipality: 'Sierra Norte de Puebla',
  },
  tableOfContents: [
    {
      missionIndex: 1,
      title: 'Misión 1: La geometría del impacto',
      sessionsRange: 'Sesiones 1, 2, 3',
      pageEstimate: 6,
    },
  ],
  missions: [
    {
      missionIndex: 1,
      title: 'Misión 1: La geometría del impacto — función lineal y decisiones comunitarias',
      coveredSessions: [1, 2, 3],
      sessionTopic: 'Función lineal, razón de cambio y toma de decisiones',
      sessionFocus: 'Modelar la producción de café de una cooperativa comunitaria con una función lineal para proyectar cosecha y decidir reinversión.',
      phenomenonHook: {
        story:
          'En la Sierra Norte de Puebla, la cooperativa de café de Doña Rosa reúne a doce familias que cosechan en laderas empinadas. Cada año, el comité discute cuánto grano esperar y cuánto invertir en secadores, transporte y pago justo. Durante la última asamblea, una socia preguntó si el aumento de la cosecha era constante o si dependía del clima. El comité tiene registros de producción de varios ciclos, pero nadie los ha convertido en un modelo que permita anticipar el siguiente año. Sin esa proyección, la cooperativa compra insumos a ciegas y negocia el precio sin evidencia. La pregunta no es solo matemática: afecta el ingreso de doce familias y la posibilidad de financiar un secador comunitario.',
        detonatingQuestion:
          '¿Cómo podemos usar los registros de producción de la cooperativa para anticipar la cosecha y decidir con evidencia cuánto reinvertir?',
      },
      conceptZero: {
        physicalAnalogy:
          'Piensa en una ladera de café recorrida con paso constante: cada metro que avanzas sube la misma cantidad de altura. La pendiente es la razón de cambio; el punto donde empezaste es el valor inicial. Si confundes la altura del primer metro con la pendiente, calculas mal toda la ruta.',
        coreExplanation:
          'Una función lineal relaciona dos variables con una razón de cambio constante. Su forma general es y = mx + b: m es la pendiente, e indica cuánto cambia y por cada unidad de x; b es la intersección con el eje vertical, e indica el valor de y cuando x = 0. En un contexto comunitario, x puede representar años, hectáreas o personas, mientras que y puede representar producción, ingreso o costo. Modelar exige identificar las variables, obtener la razón de cambio a partir de datos, escribir la ecuación y verificar que la interpretación tenga sentido en la situación.',
        solvedExample: {
          problemStatement:
            'La cooperativa registró una producción inicial de 1.2 toneladas y un aumento constante de 0.85 toneladas por año. Modela la producción y proyecta la cosecha para el año 8.',
          solutionSteps: [
            'Identificamos las variables: x = años desde el primer registro; y = toneladas de café cosechadas.',
            'Reconocimos la razón de cambio: m = 0.85 toneladas por año. El valor inicial es b = 1.2 toneladas.',
            'Escribimos el modelo lineal: y = mx + b, es decir, y = 0.85x + 1.2.',
            'Tabulamos: x = 0, 2, 4, 6, 8 produce y = 1.2, 2.9, 4.6, 6.3 y 8.0 toneladas.',
            'Interpretamos: al año 8 la cooperativa puede esperar 8.0 toneladas si mantiene la misma razón de cambio.',
          ],
          interpretation:
            'El modelo permite comparar escenarios de reinversión, pero solo es válido si las condiciones de cultivo y precio se mantienen razonablemente estables.',
        },
        contrastTable: [
          {
            correctConcept:
              'La pendiente m describe el cambio por unidad de x y la intersección b describe el valor inicial.',
            commonMisconception:
              'Creer que b es la razón de cambio y que m es el valor inicial, o sumar m sin multiplicarla por x.',
            reasoning:
              'En y = mx + b, m acompaña a x porque multiplica cada unidad; b aparece solo cuando x = 0.',
          },
        ],
      },
      iDoSection: {
        stepByStepDemo:
          'El docente modela el problema de la cooperativa: identifica x e y, calcula m = 0.85 y b = 1.2, escribe y = 0.85x + 1.2, construye una tabla y ubica los puntos en el plano cartesiano. Después compara la proyección con la capacidad del secador comunitario y pregunta qué decisión cambia si el precio del café sube o baja.',
        visualOrDiagram: 'Plano cartesiano con la recta y = 0.85x + 1.2 y puntos en x = 0, 2, 4, 6, 8.',
      },
      weDoSection: {
        guidedPractice:
          'En equipos, usen el modelo y = 0.85x + 1.2 para responder: ¿cuántas toneladas se esperan al año 10?, ¿en qué año se alcanzan 6 toneladas?, ¿qué significa la pendiente en la cooperativa? Registren el procedimiento y justifiquen si el modelo sigue siendo útil si la cooperativa siembra una hectárea más.',
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge:
          'Recolecten o reciban un pequeño conjunto de datos de producción, ingreso o consumo de su comunidad. Identifiquen la variable independiente y la dependiente, calculen o estimen la razón de cambio, escriban un modelo lineal y redacten una recomendación de una página para una familia o comité. Incluyan una gráfica, los supuestos del modelo y una decisión concreta.',
        workbookElements: [],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question:
          '¿Cómo cambia una decisión comunitaria cuando la producción se expresa como una función lineal en lugar de una lista de datos aislados?',
        reflectionPrompts: [
          '¿Qué evidencia del modelo usaría para convencer a la asamblea de la cooperativa?',
          '¿Qué supuesto del modelo podría fallar y cómo lo comunicaría?',
        ],
        criteriaChecklist: [
          'Identifico las variables independiente y dependiente en una situación comunitaria.',
          'Calculo la pendiente y la intersección a partir de datos o de una descripción.',
          'Escribo y verifico un modelo lineal con la forma y = mx + b.',
          'Interpreto la pendiente y el valor inicial en el contexto del problema.',
        ],
      },
      metacognitiveTrafficLight: {
        green: 'Puedo modelar una situación lineal y explicar qué significa cada parámetro.',
        yellow: 'Identifico los datos, pero aún confundo la pendiente con el valor inicial.',
        red: 'Necesito repasar cómo se construye una tabla y cómo se grafica una función lineal.',
      },
      wordCount: 640,
    },
  ],
  projectSection: {
    artifactName: 'Panel de decisión: cosecha, ingreso y reinversión',
    communityUtility:
      'Permite a la cooperativa anticipar cosecha, comparar escenarios de precio y justificar la compra de un secador comunitario.',
    learningObjectives: [
      'Modelar fenómenos lineales con datos comunitarios.',
      'Interpretar parámetros en contexto.',
      'Argumentar decisiones con evidencia matemática.',
    ],
    requiredMaterials: ['Registros de producción', 'Calculadora', 'Hoja milimétrica o herramienta digital'],
    executionSteps: [
      'Depurar los registros y elegir las variables.',
      'Estimar la razón de cambio y el valor inicial.',
      'Construir el modelo y la gráfica.',
      'Redactar el panel de decisión para la asamblea.',
    ],
    deliveryCriteria: ['Modelo correcto', 'Gráfica legible', 'Interpretación contextual', 'Recomendación viable'],
    registrationFormat: 'Panel de una página con modelo, gráfica y recomendación.',
    phases: [],
    technicalSpecs: [],
    acceptanceCriteria: ['El modelo representa los datos', 'La recomendación se sustenta en la proyección'],
  },
  evaluationSection: {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Identificación de variables y parámetros',
        weightPercent: 30,
        levels: [],
      },
      {
        criterion: 'Construcción y verificación del modelo lineal',
        weightPercent: 30,
        levels: [],
      },
      {
        criterion: 'Interpretación contextual de pendiente e intersección',
        weightPercent: 25,
        levels: [],
      },
      {
        criterion: 'Recomendación comunitaria basada en evidencia',
        weightPercent: 15,
        levels: [],
      },
    ],
    checklist: [
      { item: 'El modelo usa y = mx + b correctamente.', category: 'Modelación' },
      { item: 'La gráfica incluye ejes, escala y puntos.', category: 'Representación' },
      { item: 'La recomendación cita la proyección.', category: 'Argumentación' },
    ],
    tieredExercises: [],
    criticalThinkingQuiz: [],
    metacognitiveReflection: {
      prompts: ['¿Qué aprendí sobre el uso de las matemáticas en mi comunidad?'],
    },
  },
};
