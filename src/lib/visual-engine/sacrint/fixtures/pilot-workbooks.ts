import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { MATH_DEMO_WORKBOOK } from './math-demo-workbook';

export interface PilotContent {
  id: string;
  subjectName: string;
  title: string;
  blockName: string;
  topic: string;
  focus: string;
  story: string;
  question: string;
  analogy: string;
  explanation: string;
  procedure: string;
  visual: string;
  solvedProblem: string;
  solvedSteps: string[];
  interpretation: string;
  misconception: string;
  correct: string;
  reasoning: string;
  guided: string;
  autonomous: string;
  checkpoint: string;
  criteria: string[];
  artifactName: string;
  communityUtility: string;
  rubric: string[];
}

function cloneBase(): ActiveWorkTextbook {
  return JSON.parse(JSON.stringify(MATH_DEMO_WORKBOOK)) as ActiveWorkTextbook;
}

export function buildPilotWorkbook(content: PilotContent): ActiveWorkTextbook {
  const workbook = cloneBase();
  const mission = workbook.missions[0]!;
  workbook.id = content.id;
  workbook.coverData = {
    ...workbook.coverData,
    title: content.title,
    subtitle: 'Misiones Didácticas Orientadas al Proyecto PAEC Comunitario',
    subjectName: content.subjectName,
    blockNumber: 1,
    teacherName: 'Equipo SACRINT',
    schoolName: 'Plantel de demostración',
    paecProjectName: content.artifactName,
  };
  workbook.blockName = content.blockName;
  workbook.tableOfContents = [
    {
      missionIndex: 1,
      title: `Misión 1: ${content.title}`,
      sessionsRange: 'Sesiones 1, 2, 3',
      pageEstimate: 6,
    },
  ];
  mission.title = `Misión 1: ${content.title}`;
  mission.coveredSessions = [1, 2, 3];
  mission.sessionTopic = content.topic;
  mission.sessionFocus = content.focus;
  mission.phenomenonHook = {
    story: content.story,
    detonatingQuestion: content.question,
  };
  mission.conceptZero = {
    physicalAnalogy: content.analogy,
    coreExplanation: content.explanation,
    solvedExample: {
      problemStatement: content.solvedProblem,
      solutionSteps: content.solvedSteps,
      interpretation: content.interpretation,
    },
    contrastTable: [
      {
        correctConcept: content.correct,
        commonMisconception: content.misconception,
        reasoning: content.reasoning,
      },
    ],
  };
  mission.iDoSection = {
    stepByStepDemo: content.procedure,
    visualOrDiagram: content.visual,
  };
  mission.weDoSection = { guidedPractice: content.guided, workbookElements: [] };
  mission.youDoSection = { autonomousChallenge: content.autonomous, workbookElements: [] };
  mission.troubleshooting = [];
  mission.formativeCheckpoint = {
    question: content.checkpoint,
    reflectionPrompts: [
      '¿Qué evidencia usaría para explicar mi conclusión?',
      '¿Qué supuesto de mi respuesta podría fallar?',
    ],
    criteriaChecklist: content.criteria,
  };
  mission.metacognitiveTrafficLight = {
    green: 'Puedo explicar el concepto con evidencia y aplicarlo en un caso nuevo.',
    yellow: 'Reconozco las ideas centrales, pero aún necesito precisar la evidencia.',
    red: 'Necesito revisar el concepto y practicar con acompañamiento.',
  };
  mission.wordCount = 640;
  workbook.projectSection = {
    ...workbook.projectSection,
    artifactName: content.artifactName,
    communityUtility: content.communityUtility,
    learningObjectives: content.criteria.slice(0, 3),
    executionSteps: content.solvedSteps,
    deliveryCriteria: content.criteria,
    acceptanceCriteria: content.criteria.slice(0, 2),
  };
  workbook.evaluationSection = {
    ...workbook.evaluationSection,
    rubric: content.rubric.map((criterion, index) => ({
      criterion,
      weightPercent: [30, 30, 25, 15][index] ?? 15,
      levels: [],
    })),
    checklist: content.criteria.map((item) => ({ item, category: content.subjectName })),
  };
  return workbook;
}

export const CHEMISTRY_DEMO_WORKBOOK = buildPilotWorkbook({
  id: 'sacrint-demo-chemistry',
  subjectName: 'Química II',
  title: 'Combustión, balance y decisiones seguras',
  blockName: 'Explica la transformación de la materia en reacciones químicas.',
  topic: 'Balanceo de ecuaciones y conservación de la materia',
  focus:
    'Explicar la conservación de la materia en la combustión del metano y usar una ecuación balanceada para decidir cómo ventilar una cocina comunitaria.',
  story:
    'En la cocina de una casa de salud comunitaria, varias familias preparan alimentos con un calentador de gas. Después de una jornada con dolor de cabeza y mareo, el comité quiere saber si la combustión está liberando sustancias que deben ventilarse. Tienen la fórmula del gas y registros de consumo, pero no saben cómo leer la reacción ni qué evidencia reunir antes de tomar decisiones.',
  question:
    '¿Cómo podemos demostrar que la materia se conserva en la combustión y usar esa evidencia para decidir cómo ventilar el espacio?',
  analogy:
    'Imagina que una receta cambia la forma de los ingredientes, pero no su cantidad total: al mezclar y cocinar, los materiales se reorganizan. En una reacción química ocurre algo parecido: los átomos cambian de compañeros, pero no desaparecen.',
  explanation:
    'CH₄ + 2O₂ → CO₂ + 2H₂O. En esta combustión, el metano y el oxígeno se reorganizan para formar dióxido de carbono y agua. Una ecuación balanceada conserva el número de átomos de cada elemento en reactivos y productos. Los coeficientes indican cuántas moléculas participan; nunca se cambian los subíndices de una fórmula para “cuadrar” la ecuación.',
  procedure:
    'El docente modela el balanceo: escribe la ecuación incompleta, cuenta átomos de carbono, hidrógeno y oxígeno, ajusta coeficientes y verifica que la masa se conserve. Después relaciona la producción de CO₂ con la necesidad de ventilación.',
  visual: 'Esquema de reactivos, flecha de transformación y productos con coeficientes.',
  solvedProblem:
    'Balancea la combustión del metano y explica qué representan los coeficientes para la ventilación de una cocina.',
  solvedSteps: [
    'Escribimos la ecuación incompleta: CH₄ + O₂ → CO₂ + H₂O.',
    'Contamos átomos y ajustamos coeficientes hasta conservar carbono, hidrógeno y oxígeno.',
    'Verificamos el balance y relacionamos la producción de CO₂ con la ventilación del espacio.',
  ],
  interpretation:
    'La ecuación balanceada permite estimar cuánto CO₂ se produce y justificar la ventilación como medida de seguridad.',
  misconception:
    'Creer que se pueden cambiar los subíndices de una fórmula para balancear la ecuación.',
  correct:
    'Solo se ajustan los coeficientes; los subíndices forman parte de la identidad de cada sustancia.',
  reasoning:
    'Cambiar un subíndice transforma la sustancia y deja de representar la reacción observada.',
  guided:
    'En equipos, balanceen otra combustión sencilla y expliquen qué evidencia usarían para convencer al comité de la casa de salud.',
  autonomous:
    'Documenta una reacción cotidiana, balancea su ecuación y redacta una recomendación de seguridad para tu comunidad.',
  checkpoint:
    '¿Qué evidencia demuestra que la materia se conserva en la combustión y cómo sustenta una decisión de ventilación?',
  criteria: [
    'Identifico reactivos, productos y coeficientes en una ecuación química.',
    'Balanceo ecuaciones sencillas conservando los átomos.',
    'Explico la conservación de la materia con evidencia del balance.',
    'Relaciono la reacción con una decisión de seguridad comunitaria.',
  ],
  artifactName: 'Ficha de seguridad: combustión y ventilación',
  communityUtility:
    'Orienta la ventilación de espacios donde se usa gas y explica la evidencia química de la decisión.',
  rubric: [
    'Identificación de reactivos y productos',
    'Balanceo y conservación de átomos',
    'Interpretación de coeficientes',
    'Recomendación de seguridad basada en evidencia',
  ],
});

export const PHILOSOPHY_DEMO_WORKBOOK = buildPilotWorkbook({
  id: 'sacrint-demo-philosophy',
  subjectName: 'Filosofía',
  title: 'Libertad, responsabilidad y vida en común',
  blockName: 'Argumenta sobre libertad y responsabilidad en decisiones comunitarias.',
  topic: 'Libertad, responsabilidad y argumentación',
  focus:
    'Sostener que la libertad no consiste en hacer cualquier cosa, sino en decidir con razones y responder por las consecuencias de esas decisiones.',
  story:
    'En una asamblea estudiantil, un grupo propone usar el patio sin horario para ensayar música. Otro grupo argumenta que eso afectaría las clases y el descanso. La discusión se vuelve una disputa sobre libertad: unos dicen que limitar el horario es negar la libertad; otros responden que la libertad también implica responsabilidad por el bien común.',
  question:
    '¿Qué significa ser libre cuando mis decisiones afectan a otras personas?',
  analogy:
    'La libertad se parece al timón de una embarcación: puedes elegir la dirección, pero también respondes por el rumbo y por quienes viajan contigo.',
  explanation:
    'La libertad no es ausencia de límites. Una decisión libre exige razones, información y responsabilidad por las consecuencias. En una comunidad, la libertad se ejerce en un espacio compartido: mis elecciones pueden ampliar o reducir las posibilidades de otras personas.',
  procedure:
    'El docente reconstruye el argumento de la asamblea: identifica la tesis, separa premisas de opiniones, formula una objeción y evalúa si la conclusión se sostiene con las razones presentadas.',
  visual: 'Mapa argumental con tesis, premisas, objeción y conclusión.',
  solvedProblem:
    'Analiza el argumento “limitar el horario del patio niega la libertad” y evalúa qué premisa falta para sostener la conclusión.',
  solvedSteps: [
    'Identificamos la tesis: toda limitación del uso del patio es una negación de la libertad.',
    'Distinguimos la premisa implícita: la libertad exige usar el espacio sin restricciones.',
    'Contrastamos con una objeción: la libertad también implica responsabilidad por el bien común.',
  ],
  interpretation:
    'La conclusión inicial es débil porque confunde libertad con ausencia de límites y no considera las consecuencias para otras personas.',
  misconception:
    'Confundir la libertad con la ausencia total de normas o límites.',
  correct:
    'La libertad se ejerce con razones y responsabilidad por las consecuencias compartidas.',
  reasoning:
    'Una norma puede limitar una acción y, al mismo tiempo, proteger la libertad de otras personas.',
  guided:
    'En parejas, reconstruyan un argumento sobre el uso del patio y señalen una premisa implícita, una objeción y una posible respuesta.',
  autonomous:
    'Escribe un argumento breve sobre una decisión de tu comunidad; incluye tesis, dos premisas, una objeción y una conclusión.',
  checkpoint:
    '¿Qué hace que una decisión sea libre y, a la vez, responsable frente a la comunidad?',
  criteria: [
    'Formulo una tesis clara sobre libertad y responsabilidad.',
    'Distinguo premisas de opiniones y ejemplos.',
    'Incorporo una objeción y respondo con razones.',
    'Evalúo las consecuencias comunitarias de una decisión.',
  ],
  artifactName: 'Panel de debate: libertad y bien común',
  communityUtility:
    'Ayuda a la asamblea estudiantil a deliberar con argumentos explícitos y a reconocer las consecuencias compartidas.',
  rubric: [
    'Claridad de la tesis',
    'Solidez de las premisas',
    'Calidad de la objeción',
    'Evaluación de consecuencias comunitarias',
  ],
});

export const ENGLISH_DEMO_WORKBOOK = buildPilotWorkbook({
  id: 'sacrint-demo-english',
  subjectName: 'Inglés III',
  title: 'Describing community needs',
  blockName: 'Describe community needs and propose simple actions in English.',
  topic: 'Present simple and community vocabulary',
  focus:
    'Use the present simple to describe a community problem, explain its causes, and propose a realistic action in English.',
  story:
    'Students at a rural high school want to present a recycling project to a visitor from a sister school. They have good ideas, but their sentences mix subjects, verbs, and vocabulary. They need a clear language pattern to describe the problem, the people involved, and one action the community can take.',
  question: 'How can we describe a community problem clearly and propose an action in English?',
  analogy:
    'A language pattern works like a bus route: the subject is the starting point, the verb is the engine, and the complement tells where the idea is going.',
  explanation:
    'In the present simple, use the base verb with I, you, we, and they, and add -s or -es with he, she, and it. Use clear subject + verb + complement order. For community topics, choose precise nouns and verbs such as collect, reduce, provide, and support.',
  procedure:
    'The teacher models the pattern: “Our community needs a clean space. Students collect plastic bottles every Friday.” Then students identify the subject, verb, and complement before writing their own description.',
  visual: 'Language map: input, form rule, output, and context.',
  solvedProblem:
    'Write three present-simple sentences that describe a recycling problem and one action the school can take.',
  solvedSteps: [
    'Choose the subject and the community topic.',
    'Select the present-simple form that agrees with the subject.',
    'Write the sentence and check subject + verb + complement order.',
  ],
  interpretation:
    'A clear pattern helps the audience understand the problem and the proposed action without ambiguity.',
  misconception:
    'Adding -s to the verb with plural subjects or omitting the subject in English sentences.',
  correct:
    'Match the verb form to the subject and keep a visible subject in every sentence.',
  reasoning:
    'English present-simple agreement depends on the subject, not on the length of the sentence.',
  guided:
    'In pairs, write four sentences about a local problem and underline the subject and verb in each one.',
  autonomous:
    'Create a short English poster that describes a community problem, two causes, and one action.',
  checkpoint:
    'How does the present-simple form change when the subject changes, and how does that affect your message?',
  criteria: [
    'Use present-simple forms that agree with the subject.',
    'Describe a community problem with precise vocabulary.',
    'Organize ideas in subject + verb + complement order.',
    'Propose one clear action for the community.',
  ],
  artifactName: 'English community action poster',
  communityUtility:
    'Communicates a local problem and a feasible action to an English-speaking audience.',
  rubric: [
    'Present-simple accuracy',
    'Community vocabulary',
    'Sentence organization',
    'Clarity of the proposed action',
  ],
});
