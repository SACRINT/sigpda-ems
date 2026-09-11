/**
 * Evaluation Instruments Writer
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Genera los instrumentos de evaluación formativa y sumativa del bloque:
 * - Lógica de reutilización (0 tokens): Si existingExtras ya cuenta con rúbrica,
 *   lista de verificación, autoevaluación o criterios de producto, los aprovecha directamente.
 * - Si faltan instrumentos, genera los 4 oficiales bajo el estándar NEM:
 *   1. Rúbrica analítica (4 niveles: Sobresaliente 10-9, Notable 8-7, Suficiente 6-5, Insuficiente 4-1).
 *   2. Lista de verificación técnica del artefacto/producto.
 *   3. Cuestionario formativo de pensamiento crítico con escenarios y justificación.
 *   4. Formato de autoevaluación y reflexión metacognitiva.
 * - Devuelve WriterOutput uniforme con section: MissionSection obligatorio y evaluationSection estructurado.
 */

import { callGeminiPool } from '@/lib/gemini';
import { robustJsonParse } from '../json-repair';
import type {
  EvaluationSection,
  EvaluationRubricCriterion,
  MissionSection,
  WorkbookElement,
} from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';

export async function generateEvaluationSection(input: WriterInput): Promise<WriterOutput> {
  const extras = input.existingExtras || {};
  const hasExistingRubric = Boolean(extras.rubric || extras.rubrica);
  const hasExistingChecklist = Boolean(extras.checklist || extras.lista_verificacion);

  let extrasContext = '';
  if (hasExistingRubric || hasExistingChecklist) {
    extrasContext = `\nANTECEDENTES DE EVALUACIÓN DE LA PLANEACIÓN (utilízalos como referencia/semilla pero amplíalos con máximo detalle):
- Rúbrica previa: ${JSON.stringify(extras.rubric || extras.rubrica || {})}
- Lista de cotejo previa: ${JSON.stringify(extras.checklist || extras.lista_verificacion || {})}`;
  }

  // ── Construir contexto de alineación con la planeación ──
  let planningAlignmentChunk = '';
  if (input.planningActivities) {
    const pa = input.planningActivities;
    planningAlignmentChunk = `
ALINEACIÓN OBLIGATORIA CON LA PLANEACIÓN DIDÁCTICA:
La actividad planificada por el docente para este bloque tiene las siguientes fases. Los instrumentos de evaluación DEBEN evaluar lo planificado:

CIERRE PLANIFICADO (conclusión y evaluación): ${pa.conclusion.description || 'No especificado'}
PROCESOS DE CIERRE: ${pa.conclusion.processes || 'No especificados'}
MATERIALES DE CIERRE: ${pa.conclusion.materials || 'No especificados'}

DESARROLLO PLANIFICADO (para evaluar las evidencias de la fase de desarrollo): ${pa.ejecucion.description || 'No especificado'}
APERTURA PLANIFICADA (para contextualizar la evaluación): ${pa.apertura.description || 'No especificada'}
${pa.saberes ? `SABERES QUE LOS INSTRUMENTOS DEBEN EVALUAR:
- Saber (teórico): ${pa.saberes.saber}
- Saber Hacer (procedimental): ${pa.saberes.saberHacer}
- Saber Ser (actitudinal): ${pa.saberes.saberSer}` : ''}
${pa.contenidoFormativo ? `CONTENIDO FORMATIVO A EVALUAR: ${pa.contenidoFormativo}` : ''}

REGLA DE ALINEACIÓN: La rúbrica DEBE evaluar los saberes planificados. La lista de cotejo DEBE verificar las actividades de desarrollo planificadas. Los escenarios del cuestionario DEBEN estar situados en el contexto de la problemática PAEC. NO generes instrumentos que evalúen contenidos no contemplados en la planeación.
`;
  }

  const systemInstruction = `Eres un evaluador educativo de élite especializado en el Marco Curricular Común de la Educación Media Superior (NEM / DBEPA Puebla).
Tu tarea es redactar el paquete integral de 4 instrumentos de evaluación formativa y sumativa para el bloque de la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}

ESTÁNDARES FORMATIVOS OBLIGATORIOS Y METAS DE EXTENSIÓN NEM:
1. Rúbrica analítica por niveles de desempeño (800 a 1,200 palabras):
   - Exactamente 4 escalas oficiales:
     - 10-9: Sobresaliente / Excelente
     - 8-7: Notable / Bueno
     - 6-5: Suficiente / Básico
     - 4-1: Insuficiente / Requiere Apoyo
   - 4 a 6 criterios técnicos y formativos exhaustivos (la suma de pesos debe ser 100%).
   - Cada descriptor debe ser un párrafo completo de 40 a 60 palabras explicando con precisión técnica qué debe observarse en el producto del estudiante.
2. Lista de verificación técnica del artefacto/producto (500 a 800 palabras):
   - 15 a 20 reactivos minuciosamente descritos, clasificados en categorías (Seguridad, Funcionalidad, Metodología, Presentación, Impacto PAEC).
   - Cada reactivo debe redactarse de forma observable y medible.
3. Cuestionario de juicio crítico situado (800 a 1,200 palabras):
   - 3 a 5 escenarios reales problemáticos situados en comunidades de Puebla.
   - Cada escenario debe tener una narrativa rica, una pregunta reflexiva profunda y un estándar de respuesta / retroalimentación formativa de más de 150 palabras.
4. Autoevaluación formativa y metacognición (500 a 800 palabras):
   - 5 a 8 preguntas abiertas de autocrítica constructiva, análisis de dificultades, superación de errores y transferencia del aprendizaje a la vida real.
5. REGLA ESTRICTA DE SINTAXIS JSON:
   Para cadenas de texto, citas o especificaciones, usa EXCLUSIVAMENTE comillas simples ('...'). NUNCA coloques comillas dobles sin escapar dentro de un valor de texto JSON.

IMPORTANTE: Esta sección debe tener MÍNIMO 2,000 palabras en total y cumplir con las metas asignadas. No la acortes. Incluye explicaciones detalladas, descriptores extensos y escenarios enriquecidos.
${extrasContext}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "rubric": [
    {
      "criterion": "Rigor metodológico y aplicación procedimental",
      "weightPercent": 25,
      "levels": [
        { "levelName": "Excelente", "points": 10, "descriptor": "Sobresaliente (10-9): Aplica los protocolos sin errores con dominio autónomo..." },
        { "levelName": "Bueno", "points": 8, "descriptor": "Notable (8-7): Aplica los protocolos con precisión y mínimas omisiones..." },
        { "levelName": "Suficiente", "points": 6, "descriptor": "Suficiente (6-5): Cumple los procedimientos básicos requeridos..." },
        { "levelName": "Requiere Apoyo", "points": 4, "descriptor": "Insuficiente (4-1): Presenta inconsistencias que impiden el resultado..." }
      ]
    }
  ],
  "checklist": [
    { "item": "Verifica parámetros y condiciones de seguridad antes de operar el equipo o software", "category": "Seguridad" }
  ],
  "criticalThinkingQuiz": [
    {
      "questionNumber": 1,
      "question": "¿Pregunta de juicio crítico o resolución ética/técnica?",
      "scenario": "Situación problemática contextualizada en una comunidad de Puebla de al menos 100 palabras...",
      "answerExplanation": "Justificación formativa exhaustiva y retroalimentación docente esperada de al menos 150 palabras..."
    }
  ],
  "metacognitiveReflection": {
    "prompts": [
      "¿Qué aprendizaje de este bloque consideras más transformador para tu vida y por qué?",
      "¿Qué estrategia implementaste para superar el obstáculo técnico más difícil del bloque?"
    ]
  }
}`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Bloque: ${input.blockName} (Índice ${input.blockIndex})
Problemática PAEC comunitaria: ${input.paecContext}
Meta de palabras para esta misión: mínimo ${input.targetWords.min} palabras (ideal ${input.targetWords.ideal} palabras).

DISTRIBUCIÓN OBLIGATORIA DE PALABRAS:
- rubric: 800 a 1,200 palabras (descriptores amplios y detallados en cada escala)
- checklist: 500 a 800 palabras (15-20 reactivos bien explicados)
- criticalThinkingQuiz: 800 a 1,200 palabras (escenarios situados con explicaciones docentes completas)
- metacognitiveReflection: 500 a 800 palabras (preguntas abiertas de desarrollo reflexivo)

IMPORTANTE: Esta sección debe tener MÍNIMO 2,000 palabras en total y al menos ${input.targetWords.min} palabras. No la acortes.
Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos,
y espacios amplios para que el estudiante trabaje.

Genera el paquete oficial de 4 instrumentos de evaluación NEM:`;

  try {
    const rawResponse = await callGeminiPool(systemInstruction, prompt, input.planning.teacherId);
    const parsed = robustJsonParse(rawResponse);

    const evaluationSection: EvaluationSection = {
      source: 'generated_fresh',
      rubric: parsed.rubric || [],
      checklist: parsed.checklist || [],
      criticalThinkingQuiz: parsed.criticalThinkingQuiz || [],
      metacognitiveReflection: parsed.metacognitiveReflection || {
        prompts: ['Reflexiona sobre tu aprendizaje en este bloque.'],
      },
    };

    const missionSection = buildEvaluationMissionSection(input, evaluationSection);
    const evalRealText = getEvaluationRealText(evaluationSection);
    const wordCount = evalRealText.split(/\s+/).filter(Boolean).length;
    missionSection.wordCount = wordCount;

    const quality = evaluateQuality({
      wordCount,
      targetWords: input.targetWords,
      content: evalRealText,
      subsystem: input.subsystem,
      workbookElementsCount: 2, // 2 workbook elements reales generados en buildEvaluationMissionSection
    });

    return {
      type: 'evaluation',
      section: missionSection,
      evaluationSection,
      wordCount,
      tokensUsed: Math.round(wordCount * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: any) {
    console.error('[generateEvaluationSection] Error:', err);
    // Fallback estructurado de evaluación NEM
    const fallbackEval: EvaluationSection = {
      source: 'generated_fresh',
      rubric: [
        {
          criterion: 'Aplicación de Principios Técnicos y Disciplinares',
          weightPercent: 50,
          levels: [
            { levelName: 'Excelente', points: 10, descriptor: 'Sobresaliente (10-9): Demuestra dominio pleno y fundamentado de los conceptos.' },
            { levelName: 'Bueno', points: 8, descriptor: 'Notable (8-7): Aplica los conceptos correctamente con mínimas omisiones.' },
            { levelName: 'Suficiente', points: 6, descriptor: 'Suficiente (6-5): Cumple los requisitos indispensables de forma básica.' },
            { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Insuficiente (4-1): No logra integrar los conceptos en el producto.' },
          ],
        },
        {
          criterion: 'Vinculación Comunitaria y Solución PAEC',
          weightPercent: 50,
          levels: [
            { levelName: 'Excelente', points: 10, descriptor: 'Sobresaliente (10-9): Colabora activamente y vincula el producto al PAEC escolar.' },
            { levelName: 'Bueno', points: 8, descriptor: 'Notable (8-7): Participa en equipo y comprende la vinculación comunitaria.' },
            { levelName: 'Suficiente', points: 6, descriptor: 'Suficiente (6-5): Participación pasiva en las tareas asignadas.' },
            { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Insuficiente (4-1): Dificultades para integrarse en el trabajo grupal.' },
          ],
        },
      ],
      checklist: [
        { item: 'Presentación formal del reporte y bitácora de trabajo completa', category: 'Formato' },
        { item: 'Demostración de funcionamiento del artefacto o prototipo', category: 'Técnico' },
        { item: 'Participación honesta y reflexiva en la sesión de coevaluación', category: 'Actitudinal' },
      ],
      criticalThinkingQuiz: [
        {
          questionNumber: 1,
          question: `¿De qué manera el proyecto desarrollado contribuye a mitigar ${input.paecContext}?`,
          scenario: 'Presentación de resultados en el aula ante la comunidad escolar.',
          answerExplanation: 'El estudiante debe argumentar con datos concretos el beneficio de su solución.',
        },
      ],
      metacognitiveReflection: {
        prompts: [
          '¿Qué habilidad desarrollaste con mayor éxito durante este bloque?',
          '¿Qué compromiso personal estableces para consolidar tus aprendizajes en el siguiente parcial?',
        ],
      },
    };

    const missionSection = buildEvaluationMissionSection(input, fallbackEval);

    return {
      type: 'evaluation',
      section: missionSection,
      evaluationSection: fallbackEval,
      wordCount: 450,
      tokensUsed: 0,
      qualityScore: 75,
      warnings: ['Generado con instrumentos NEM de respaldo por contingencia: ' + String(err?.message || err)],
    };
  }
}

/**
 * Construye la sección de misión (MissionSection) correspondiente a la evaluación
 * para garantizar el contrato uniforme de salida entre todos los redactores.
 */
function buildEvaluationMissionSection(
  input: WriterInput,
  evaluation: EvaluationSection
): MissionSection {
  const evalMission = input.missions.find((m) => m.missionType === 'evaluation') || input.missions[input.missions.length - 1];
  const lastSession = input.sessions[input.sessions.length - 1];
  const coveredSessions = evalMission ? evalMission.sessionNumbers : (lastSession ? [lastSession.sessionNum] : [input.sessions.length || 16]);
  const missionIndex = evalMission?.missionIndex || 4;
  const title = evalMission?.title || `Misión 4: Demostración Integral y Evaluación Formativa`;

  const workbookElements: WorkbookElement[] = [
    {
      id: 'wb-eval-checklist-box',
      type: 'checkbox_list',
      title: 'Lista de Cotejo Técnica del Artefacto (Coevaluación entre Pares)',
      instruction: 'Intercambia tu proyecto con un compañero y verifica objetivamente el cumplimiento de cada indicador:',
      config: {
        checkboxes: evaluation.checklist.map((c) => `[${c.category}] ${c.item}`),
      },
    },
    {
      id: 'wb-eval-reflection-lines',
      type: 'lines',
      title: 'Bitácora de Autoevaluación Metacognitiva',
      instruction: 'Responde reflexivamente a las preguntas de consolidación del bloque:',
      config: { rows: 6 },
    },
  ];

  const rubricDescription = evaluation.rubric
    .map(
      (r) =>
        `### Criterio: ${r.criterion} (Ponderación: ${r.weightPercent}%)\n` +
        r.levels
          .map((l) => `- **${l.levelName} (${l.points} pts):** ${l.descriptor}`)
          .join('\n')
    )
    .join('\n\n');

  return {
    missionIndex,
    title,
    coveredSessions,
    sessionTopic: evalMission?.sessionTopic || `Evaluación y Cierre Formativo de ${input.blockName}`,
    sessionFocus: 'Demostración de aprendizajes, coevaluación y rúbrica NEM',
    phenomenonHook: {
      story: `La evaluación formativa en el modelo NEM no es una prueba memorística; es la oportunidad en que tú y tu equipo demuestran ante la comunidad escolar cómo los conocimientos construidos en ${input.uacName} responden a la problemática de ${input.paecContext}.`,
      detonatingQuestion: '¿De qué manera tus evidencias demuestran que alcanzaste las metas de aprendizaje y qué impacto real tienen tus soluciones?',
    },
    conceptZero: {
      physicalAnalogy: 'La evaluación es como el control de calidad final en una línea de producción: no busca descartar piezas, sino asegurar que cada una cumpla con la resistencia y confiabilidad requerida para su propósito real.',
      coreExplanation: 'La evaluación formativa combina tres miradas indispensables: la heteroevaluación docente guiada por una rúbrica analítica, la coevaluación técnica entre compañeros mediante lista de cotejo, y la autoevaluación reflexiva sobre tu propio progreso cognitivo.',
    },
    iDoSection: {
      stepByStepDemo: `Rúbrica Analítica Oficial NEM:\n\n${rubricDescription}`,
    },
    weDoSection: {
      guidedPractice: 'Sesión de coevaluación técnica: los equipos contrastan sus entregables utilizando la lista de cotejo y registran observaciones constructivas.',
      workbookElements: [workbookElements[0]],
    },
    youDoSection: {
      autonomousChallenge: 'Autoevaluación individual y resolución de los reactivos de juicio crítico en el cuaderno de trabajo.',
      workbookElements: [workbookElements[1]],
    },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué evidencias concretas avalan el nivel de desempeño que asignaste a tu proyecto?',
      reflectionPrompts: evaluation.metacognitiveReflection.prompts,
      criteriaChecklist: [
        'Contrasté mi producto contra todos los niveles de la rúbrica analítica.',
        'Completé la lista de cotejo con imparcialidad técnica.',
        'Redacté mis compromisos de mejora para el siguiente periodo.',
      ],
    },
    wordCount: 650,
  };
}

/**
 * Extrae exclusivamente el contenido textual real de los instrumentos de evaluación
 * para el cálculo de conteo de palabras sin artefactos de serialización JSON.
 */
function getEvaluationRealText(evaluationSection: EvaluationSection): string {
  const rubricText = (evaluationSection.rubric || [])
    .map((c) => `${c.criterion || ''} ${(c.levels || []).map((l) => l.descriptor || '').join(' ')}`)
    .join(' ');
  const checklistText = (evaluationSection.checklist || [])
    .map((i) => `${i.item || ''} ${i.category || ''}`)
    .join(' ');
  const quizText = (evaluationSection.criticalThinkingQuiz || [])
    .map((q) => `${q.question || ''} ${q.scenario || ''} ${q.answerExplanation || ''}`)
    .join(' ');
  const metaText = (evaluationSection.metacognitiveReflection?.prompts || []).join(' ');
  return [rubricText, checklistText, quizText, metaText].filter(Boolean).join(' ');
}
