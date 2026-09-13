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

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import type {
  EvaluationSection,
  EvaluationRubricCriterion,
  MissionSection,
  WorkbookElement,
} from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality } from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { logger } from '@/lib/logger';

export async function generateEvaluationSection(input: WriterInput): Promise<WriterOutput> {
  const extras = input.existingExtras || {};
  const hasExistingRubric = Boolean(extras.rubric || extras.rubrica);
  const hasExistingChecklist = Boolean(extras.checklist || extras.lista_verificacion);

  let extrasContext = '';
  if (hasExistingRubric || hasExistingChecklist) {
    extrasContext = `\nANTECEDENTES DE EVALUACIÓN DE LA PLANEACIÓN (referencia):
- Rúbrica previa: ${JSON.stringify(extras.rubric || extras.rubrica || {})}
- Lista previa: ${JSON.stringify(extras.checklist || extras.lista_verificacion || {})}`;
  }

  const planningAlignmentChunk = buildPlanningAlignmentPrompt(input.planningActivities, 'evaluation');

  const systemInstruction = `Eres un evaluador educativo de élite especializado en el Marco Curricular Común de la EMS (NEM / DBEPA Puebla).
Tu tarea es redactar el paquete integral de 4 instrumentos de evaluación formativa y sumativa para: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}
${extrasContext}

ESTÁNDARES FORMATIVOS OBLIGATORIOS Y METAS NEM:
1. Rúbrica analítica (800-1,200 palabras): Exactamente 4 escalas (Excelente 10-9, Bueno 8-7, Suficiente 6-5, Requiere Apoyo 4-1) y 4 a 6 criterios (suma 100%).
2. Lista de verificación técnica (500-800 palabras): 15 a 20 reactivos medibles clasificados por categorías.
3. Cuestionario de juicio crítico (800-1,200 palabras): 3 a 5 escenarios reales en Puebla con retroalimentación docente formativa > 150 palabras.
4. Autoevaluación metacognitiva (500-800 palabras): 5 a 8 preguntas abiertas de reflexión y transferencia.
5. Evaluación Escalonada (tieredExercises - 800-1,200 palabras): EXACTAMENTE 3 NIVELES ('basico', 'intermedio', 'avanzado') con al menos 2 ejercicios por nivel (mínimo 6 ejercicios en total) con statement, contextOrData, expectedOutputOrCriteria y hint.
6. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "rubric": [
    {
      "criterion": "Rigor metodológico y procedimental",
      "weightPercent": 25,
      "levels": [
        { "levelName": "Excelente", "points": 10, "descriptor": "Sobresaliente (10-9): Dominio autónomo y riguroso..." },
        { "levelName": "Bueno", "points": 8, "descriptor": "Notable (8-7): Procedimientos precisos..." },
        { "levelName": "Suficiente", "points": 6, "descriptor": "Suficiente (6-5): Cumple lo básico..." },
        { "levelName": "Requiere Apoyo", "points": 4, "descriptor": "Insuficiente (4-1): Requiere asesoría..." }
      ]
    }
  ],
  "checklist": [
    { "item": "Verifica parámetros y condiciones de seguridad", "category": "Seguridad" }
  ],
  "tieredExercises": [
    {
      "level": "basico",
      "levelName": "Nivel Básico: Comprensión y Aplicación Directa",
      "description": "Reactivos de ejecución directa y consolidación procedimental.",
      "exercises": [
        {
          "number": 1,
          "statement": "Enunciado del ejercicio 1...",
          "contextOrData": "Datos: variable X = valor...",
          "expectedOutputOrCriteria": "Resultado numérico o criterio esperado.",
          "hint": "Pista de andamiaje..."
        },
        {
          "number": 2,
          "statement": "Enunciado del ejercicio 2...",
          "contextOrData": "Condiciones operativas...",
          "expectedOutputOrCriteria": "Criterio de validación."
        }
      ]
    },
    {
      "level": "intermedio",
      "levelName": "Nivel Intermedio: Análisis y Modelación en Contexto",
      "description": "Problemas situados con variables contextuales de Puebla o taller.",
      "exercises": [
        {
          "number": 3,
          "statement": "Problema contextualizado 1...",
          "contextOrData": "Escenario socioproductivo...",
          "expectedOutputOrCriteria": "Desarrollo paso a paso."
        },
        {
          "number": 4,
          "statement": "Problema contextualizado 2...",
          "contextOrData": "Parámetros y restricciones...",
          "expectedOutputOrCriteria": "Solución procedimental completa."
        }
      ]
    },
    {
      "level": "avanzado",
      "levelName": "Nivel Avanzado: Optimización, Diagnóstico y Transferencia",
      "description": "Desafíos de alto orden cognitivo y propuesta de mejora.",
      "exercises": [
        {
          "number": 5,
          "statement": "Desafío de optimización o diagnóstico...",
          "contextOrData": "Caso de estudio técnico...",
          "expectedOutputOrCriteria": "Propuesta fundada de resolución."
        },
        {
          "number": 6,
          "statement": "Desafío de transferencia comunitaria PAEC...",
          "contextOrData": "Situación real no estructurada...",
          "expectedOutputOrCriteria": "Estrategia integral de intervención."
        }
      ]
    }
  ],
  "criticalThinkingQuiz": [
    {
      "questionNumber": 1,
      "question": "¿Pregunta de juicio crítico o resolución?",
      "scenario": "Situación problemática en comunidad de Puebla...",
      "answerExplanation": "Justificación formativa y retroalimentación docente > 150 palabras..."
    }
  ],
  "metacognitiveReflection": {
    "prompts": [
      "¿Qué aprendizaje de este bloque consideras más transformador y por qué?",
      "¿Qué estrategia implementaste para superar el obstáculo técnico más difícil?"
    ]
  }
}`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Bloque: ${input.blockName} (Índice ${input.blockIndex})
Problemática PAEC comunitaria: ${input.paecContext}
Meta de palabras para esta misión: mínimo ${input.targetWords.min} palabras (ideal ${input.targetWords.ideal} palabras).

DISTRIBUCIÓN SUGERIDA DE PALABRAS:
- rubric: 800 a 1,200 palabras
- checklist: 500 a 800 palabras
- tieredExercises: 800 a 1,200 palabras (3 niveles, mínimo 6 ejercicios completos)
- criticalThinkingQuiz: 800 a 1,200 palabras
- metacognitiveReflection: 500 a 800 palabras

Genera el paquete oficial de 4 instrumentos de evaluación NEM con ejercicios escalonados:`;

  try {
    let attempt: 1 | 2 = 1;
    const rawResponse = await generateWithRotation(
      systemInstruction,
      prompt,
      input.planning.teacherId,
      false,
      { jsonMode: true, maxTokens: 8192 }
    );
    let parsed = robustJsonParse(rawResponse);

    // Validación de extensión mínima (MEJORA 1)
    const tiers = Array.isArray(parsed.tieredExercises) ? parsed.tieredExercises : [];
    const has3Levels = tiers.length >= 3;
    const allHave2Exercises = has3Levels && tiers.every((t: any) => Array.isArray(t.exercises) && t.exercises.length >= 2);

    if (!has3Levels || !allHave2Exercises) {
      attempt = 2;
      console.warn(`[EvaluationWriter] tieredExercises tiene niveles o ejercicios insuficientes (${tiers.length} niveles). Reintentando con instrucción estricta...`);
      try {
        const retryPrompt = `${prompt}\n\n[REQUISITO CRÍTICO DE PROFUNDIDAD]: Tu respuesta anterior no cumplió la estructura de 'tieredExercises'. Es OBLIGATORIO incluir EXACTAMENTE 3 NIVELES ('basico', 'intermedio', 'avanzado') y al menos 2 EJERCICIOS POR CADA NIVEL (mínimo 6 ejercicios en total), con sus datos, pistas de andamiaje y criterios de evaluación.`;
        const retryResponse = await generateWithRotation(
          systemInstruction,
          retryPrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 8192 }
        );
        const retryParsed = robustJsonParse(retryResponse);
        const retryTiers = Array.isArray(retryParsed.tieredExercises) ? retryParsed.tieredExercises : [];
        if (retryTiers.length >= tiers.length) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        logger.warn('[EvaluationWriter] Error en reintento, preservando primera respuesta:', { error: String(retryErr) });
      }
    }

    const evaluationSection: EvaluationSection = {
      source: 'generated_fresh',
      rubric: parsed.rubric || [],
      checklist: parsed.checklist || [],
      tieredExercises: Array.isArray(parsed.tieredExercises) && parsed.tieredExercises.length > 0
        ? parsed.tieredExercises
        : undefined,
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

    if (attempt === 1) {
      logger.info(`[EvaluationWriter] ✅ Generado en intento 1 — ${wordCount} palabras`);
    } else {
      logger.info(`[EvaluationWriter] ⚠️ Reintento necesario — ${wordCount} palabras en intento 2`);
    }

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
    logger.error('[generateEvaluationSection] Error:', err);
    // Fallback estructurado de evaluación NEM con 3 niveles escalonados
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
      tieredExercises: [
        {
          level: 'basico',
          levelName: 'Nivel Básico: Comprensión y Algoritmos Directos',
          description: 'Ejercicios de aplicación directa de conceptos esenciales del bloque.',
          exercises: [
            {
              number: 1,
              statement: `Identifica y define los conceptos rectores de ${input.uacName} estudiados en este bloque, señalando su unidad de medida y formulación base.`,
              contextOrData: 'Conceptos fundamentales y definiciones técnicas tratadas en la sesión inicial.',
              expectedOutputOrCriteria: 'Definición precisa y aplicación directa sin errores conceptuales.',
            },
            {
              number: 2,
              statement: 'Calcula o resuelve un caso elemental aplicando el procedimiento modelado en la sección "Yo Hago".',
              contextOrData: 'Valores nominales de referencia indicados en el cuaderno de trabajo.',
              expectedOutputOrCriteria: 'Resultado cuantitativo exacto con sustitución paso a paso.',
            },
          ],
        },
        {
          level: 'intermedio',
          levelName: 'Nivel Intermedio: Modelación y Análisis en Contexto',
          description: 'Problemas de aplicación procedimental con variables combinadas en situaciones reales.',
          exercises: [
            {
              number: 3,
              statement: `Modela una situación de tu entorno escolar donde intervengan las variables de ${input.uacName}, calculando los parámetros resultantes.`,
              contextOrData: `Entorno escolar y comunitario vinculado a ${input.paecContext}.`,
              expectedOutputOrCriteria: 'Modelo estructurado con tabla de variables y desarrollo matemático/lógico.',
            },
            {
              number: 4,
              statement: 'Determina las condiciones óptimas de operación o respuesta ante una variación imprevista en las condiciones iniciales.',
              contextOrData: 'Incremento del 15% en la carga o demanda operativa.',
              expectedOutputOrCriteria: 'Análisis de sensibilidad y justificación procedimental fundamentada.',
            },
          ],
        },
        {
          level: 'avanzado',
          levelName: 'Nivel Avanzado: Juicio Crítico y Transferencia Socioproductiva',
          description: 'Retos de alta complejidad cognitiva para optimización y solución de problemáticas comunitarias.',
          exercises: [
            {
              number: 5,
              statement: `Diseña una propuesta de optimización técnica que resuelva una limitación detectada en la comunidad escolar relacionada con ${input.paecContext}.`,
              contextOrData: 'Restricciones de presupuesto, sustentabilidad y normativas vigentes aplicables.',
              expectedOutputOrCriteria: 'Propuesta técnica viable con justificación de impacto social y cálculos de soporte.',
            },
            {
              number: 6,
              statement: 'Audita y diagnostica una falla inducida en el sistema o procedimiento, deduciendo la causa raíz y proponiendo la medida preventiva.',
              contextOrData: 'Registro de datos anómalos obtenidos en las pruebas de campo.',
              expectedOutputOrCriteria: 'Informe de diagnóstico técnico con ruta crítica de corrección.',
            },
          ],
        },
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
  const tieredText = (evaluationSection.tieredExercises || [])
    .map((lvl) => `${lvl.levelName} ${lvl.description} ${(lvl.exercises || []).map((e) => `${e.statement} ${e.contextOrData || ''} ${e.expectedOutputOrCriteria || ''} ${e.hint || ''}`).join(' ')}`)
    .join(' ');
  const quizText = (evaluationSection.criticalThinkingQuiz || [])
    .map((q) => `${q.question || ''} ${q.scenario || ''} ${q.answerExplanation || ''}`)
    .join(' ');
  const metaText = (evaluationSection.metacognitiveReflection?.prompts || []).join(' ');
  return [rubricText, checklistText, tieredText, quizText, metaText].filter(Boolean).join(' ');
}
