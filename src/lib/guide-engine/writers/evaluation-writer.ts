/**
 * Evaluation Instruments Writer
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Genera los instrumentos de evaluación formativa y sumativa del bloque:
 * - Genera siempre instrumentos frescos; no reutiliza extras previos para evitar
 *   heredar rúbricas/checklists contaminados de versiones anteriores.
 * - Genera los 4 oficiales bajo el estándar NEM:
 *   1. Rúbrica analítica (4 niveles: Sobresaliente 10-9, Notable 8-7, Suficiente 6-5, Insuficiente 4-1).
 *   2. Lista de verificación de calidad del producto/evidencia.
 *   3. Cuestionario formativo de pensamiento crítico con escenarios y justificación.
 *   4. Formato de autoevaluación y reflexión metacognitiva.
 * - Devuelve WriterOutput uniforme con section: MissionSection obligatorio y evaluationSection estructurado.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import type {
  EvaluationSection,
  MissionSection,
  WorkbookElement,
} from '@/types/work-textbook';
import {
  type WriterInput,
  type WriterOutput,
  type FallbackPlanContext,
  evaluateQuality,
  completeSessionPlans,
} from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { formatRequiredTermsDirective } from '../planning-content-alignment';
import { assertNoGenericContent } from '../quality/no-generic-content';
import { runScheduled } from '../writer-scheduler';
import {
  generateShardedSessionPlans,
  applySurgicalSessionRepair,
  type SessionShardContext,
} from './session-shard';
import { logger } from '@/lib/logger';
import { countSessionPlanWords } from '../content-budget';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';

export async function generateEvaluationSection(input: WriterInput): Promise<WriterOutput> {
  const { evalMission, coveredSessions, title: missionTitle } = resolveEvaluationMission(input);
  const discipline = getDisciplinaryAdapter(
    input.uacName,
    input.component,
    input.curriculumName || input.careerOrProgramName
  );
  const fallbackContext: FallbackPlanContext = {
    uacName: input.uacName,
    blockName: input.blockName,
    sessionTopic: evalMission?.sessionTopic || 'Demostración Integral y Evaluación Formativa',
    sessionFocus: evalMission?.focus || 'Evaluación Formativa y Cierre',
    paecContext: input.paecContext,
    subsystem: input.subsystem,
    component: input.component,
    curriculumName: input.curriculumName,
    careerOrProgramName: input.careerOrProgramName,
  };

  const sessionCount = Math.max(1, coveredSessions.length);
  const targetWordsPerPlan = Math.max(900, Math.round((input.targetWords.ideal / sessionCount) * 0.78));
  const shardCtx: SessionShardContext = {
    input,
    missionType: 'evaluation',
    missionTitle,
    coveredSessions,
    disciplineName: discipline.displayName,
    fallbackContext,
    targetWordsPerPlan,
    requiredTerms: input.requiredTerms,
  };

  if (input.previousOutput && input.surgicalSessionTerms) {
    return applySurgicalSessionRepair(shardCtx, input.previousOutput, input.surgicalSessionTerms);
  }

  const requiredTermsChunk = formatRequiredTermsDirective(input.requiredTerms ?? []);
  const planningAlignmentChunk = buildPlanningAlignmentPrompt(
    input.planningActivities,
    'evaluation',
    input.uacName,
    input.component,
    input.curriculumName,
    input.careerOrProgramName
  ) +
  (requiredTermsChunk ? `\n${requiredTermsChunk}\n` : '') +
  (input.alignmentDirective ? ` 
ALINEACION DURA — TERMINOS OBLIGATORIOS DE LA PLANEACION (reproduce su redaccion original en tu seccion): ` + input.alignmentDirective + ` 
 ` : '');

  const systemInstruction = `Eres un evaluador educativo de élite especializado en el Marco Curricular Común de la EMS (NEM / MCCEMS Puebla).
Tu tarea es redactar el paquete integral de 4 instrumentos de evaluación formativa y sumativa para: "${input.uacName}" (${input.subsystem.toUpperCase()}).
${planningAlignmentChunk}

ESTÁNDARES FORMATIVOS OBLIGATORIOS Y METAS NEM:
1. Rúbrica analítica (300 a 500 palabras): Exactamente 4 escalas (Excelente 10-9, Bueno 8-7, Suficiente 6-5, Requiere Apoyo 4-1) y 4 a 6 criterios (suma 100%).
2. Lista de verificación técnica (200 a 350 palabras): 10 a 15 reactivos medibles clasificados por categorías.
3. Cuestionario de juicio crítico (250 a 400 palabras): 3 a 5 escenarios reales en Puebla con retroalimentación docente formativa.
4. Autoevaluación metacognitiva (150 a 250 palabras): 4 a 6 preguntas abiertas de reflexión y transferencia.
5. Evaluación Escalonada (tieredExercises - 300 a 500 palabras): EXACTAMENTE 3 NIVELES ('basico', 'intermedio', 'avanzado') con al menos 2 ejercicios por nivel (mínimo 6 ejercicios en total) con statement, contextOrData, expectedOutputOrCriteria y hint.
6. Contenido por sesión para el ESTUDIANTE (OBLIGATORIO — genera un "plan" por cada sesión de ${coveredSessions.join(', ')}, ~950 a 1,150 palabras por plan):
   Para CADA sesión asignada (${coveredSessions.join(', ')}) genera un objeto en "sessionPlans". NUNCA omitas ninguna sesión ni uses resúmenes telegráficos. Cada objeto es material que el estudiante LEE para aprender de forma autodidacta:
   (a) objetivo: "Lo que vas a aprender" (1-2 frases en voz de estudiante);
   (b) motivacion: (80 a 120 palabras) caso o contexto de síntesis y cierre formativo en Puebla;
   (c) saberesPrevios: (50 a 80 palabras) qué aprendizajes consolidados del bloque se ponen en juego;
   (d) contenido: (OBLIGATORIO MÍNIMO 440 A 520 PALABRAS) LA TEORÍA REAL de la sesión — marcos conceptuales de evaluación, validación de hipótesis o modelación formal en 3 párrafos sustanciales (al menos 150 palabras por párrafo);
   (e) ejemploResuelto: (OBLIGATORIO MÍNIMO 300 A 360 PALABRAS) ejemplo evaluativo resuelto paso a paso con rúbrica comentada, cálculos y 4 pasos numerados;
   (f) practica: 2 reactivos formativos complejos con datos; enunciados detallados (mínimo 60 palabras cada uno) con "pista" (mínimo 30 palabras) y "solucion" con 3-6 pasos numerados;
   (g) aplicacion: (80 a 120 palabras) transferencia integradora al entorno comunitario;
   (h) autoevaluacion: 2-3 preguntas reflexivas;
   (i) recursos: 1-2 enlaces de consulta y profundización;
   (j) productoIntegrador: (60 a 90 palabras) evaluación final, sustentación y acreditación del producto o evidencia.
   Los planes deben VARIAR entre sesiones y ser específicos del contexto PAEC/comunidad. VOZ DE ESTUDIANTE en todo.
7. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

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
      "description": "Problemas situados con variables contextuales de Puebla y de la disciplina.",
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
  },
  "sessionPlans": [
    {
      "sessionNumber": 22,
      "objetivo": "Lo que vas a aprender en la sesión 22 (1-2 frases)...",
      "motivacion": "Caso real / historia contada al estudiante...",
      "saberesPrevios": "Qué ya sabes que conecta con esto...",
      "contenido": "Párrafo 1: En esta sesión consolidarás los conceptos y criterios técnicos clave...\\n\\nPárrafo 2: El análisis formativo y los métodos de verificación cuantitativa exigen...\\n\\nPárrafo 3: La interpretación de resultados y la toma de decisiones en el entorno comunitario...",
      "ejemploResuelto": "Planteamiento: Se analiza un caso de evaluación integral con parámetros e indicadores reales...\\nPaso 1: Extracción de datos y fijación de criterios de aceptación...\\nPaso 2: Aplicación del modelo analítico de resolución...\\nPaso 3: Verificación cuantitativa y diagnóstico de discrepancias...\\nPaso 4: Dictamen formativo y plan de retroalimentación...",
      "practica": [
        { "enunciado": "Ejercicio 1 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: sustituir datos...", "Paso 2: operar y verificar...", "Respuesta final: ..."] },
        { "enunciado": "Ejercicio 2 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: ...", "Respuesta final: ..."] }
      ],
      "aplicacion": "Aplicación a la vida real del estudiante...",
      "autoevaluacion": ["¿Puedo explicar el criterio central?", "¿Logré la práctica sin mirar?"],
      "recursos": [
        { "titulo": "Video de repaso e integración", "url": "https://www.youtube.com/results?search_query=repaso+educacion+media+superior", "tipo": "video" },
        { "titulo": "Consulta temática de ampliación", "url": "https://www.google.com/search?q=evaluacion+bachillerato", "tipo": "web" }
      ],
      "productoIntegrador": "Qué agregas hoy a tu producto integrador..."
    }
  ]
}`;

  const totalPlansTarget = sessionCount * targetWordsPerPlan;
  const remainingNarrativeTarget = Math.max(300, input.targetWords.ideal - totalPlansTarget);

  const rubricTarget = Math.round(remainingNarrativeTarget * 0.25);
  const checklistTarget = Math.round(remainingNarrativeTarget * 0.15);
  const tieredTarget = Math.round(remainingNarrativeTarget * 0.30);
  const quizTarget = Math.round(remainingNarrativeTarget * 0.18);
  const metaTarget = Math.round(remainingNarrativeTarget * 0.12);

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Bloque: ${input.blockName} (Índice ${input.blockIndex})
Sesiones asignadas: Sesiones ${coveredSessions.join(', ')} (${sessionCount} sesiones)
Problemática PAEC comunitaria: ${input.paecContext}
Presupuesto total para esta misión: mínimo ${input.targetWords.min} palabras (ideal ~${input.targetWords.ideal} palabras).

DISTRIBUCIÓN CALIBRADA DE PALABRAS:
- sessionPlans (${sessionCount} sesiones): OBLIGATORIO redactar las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}), con ~${targetWordsPerPlan} palabras por sesión (total planes: ~${totalPlansTarget} palabras). Cada plan debe contener mínimo 440 a 500 palabras en contenido (3 párrafos analíticos y de verificación, mínimo 150 palabras por párrafo) y mínimo 300 a 360 palabras en ejemploResuelto (caso de evaluación con 4 pasos cuantitativos de resolución y rúbrica comentada).
- rubric: ~${rubricTarget} palabras
- checklist: ~${checklistTarget} palabras
- tieredExercises: ~${tieredTarget} palabras (3 niveles escalonados, mínimo 6 ejercicios completos con andamiaje)
- criticalThinkingQuiz: ~${quizTarget} palabras
- metacognitiveReflection: ~${metaTarget} palabras

Genera los 4 instrumentos oficiales de evaluación NEM Y las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}) con máxima profundidad conceptual y desarrollo analítico:`;

  const useSharding = Boolean(input.scheduler);
  const narrativeMaxTokens = useSharding ? 8192 : 16384;
  const narrativeTimeoutMs = useSharding ? 75000 : 85000;
  const effectiveSystemInstruction = useSharding
    ? systemInstruction.replace(/,\s*"sessionPlans"\s*:\s*\[[\s\S]*?\]\s*\}/, '\n}')
    : systemInstruction;
  const basePrompt = useSharding
    ? prompt.replace(/- sessionPlans[^\n]*\n/, '')
    : prompt;
  const effectivePrompt = input.institutionalContext
    ? `${input.institutionalContext}\n\n${basePrompt}`
    : basePrompt;

  try {
    let attempt: 1 | 2 = 1;
    const shardedPromise = useSharding ? generateShardedSessionPlans(shardCtx) : null;
    shardedPromise?.catch(() => undefined);
    const rawResponse = await runScheduled(input.scheduler, 'evaluation:narrative', () =>
      generateWithRotation(
        effectiveSystemInstruction,
        effectivePrompt,
        input.planning.teacherId,
        false,
        { jsonMode: true, maxTokens: narrativeMaxTokens, timeoutMs: narrativeTimeoutMs, signal: input.signal }
      )
    );
    let parsed = robustJsonParse(rawResponse);

    // Validación de estructura + cobertura total de sesiones (Fase A)
    const tiers = Array.isArray(parsed.tieredExercises) ? parsed.tieredExercises : [];
    const has3Levels = tiers.length >= 3;
    const allHave2Exercises = has3Levels && tiers.every((t: { exercises?: unknown }) => Array.isArray(t.exercises) && t.exercises.length >= 2);
    const planCount = Array.isArray(parsed.sessionPlans) ? parsed.sessionPlans.length : 0;
    const missingPlans = !useSharding && planCount < coveredSessions.length;

    if (!has3Levels || !allHave2Exercises || missingPlans) {
      attempt = 2;
      logger.warn(
        `[EvaluationWriter] tieredExercises=${tiers.length} niveles (3 requeridos) o sessionPlans=${planCount}/${coveredSessions.length}. Reintentando con instrucción estricta...`
      );
      const strictDirectives: string[] = [];
      if (!has3Levels || !allHave2Exercises) {
        strictDirectives.push(
          `Tu respuesta anterior no cumplió la estructura de 'tieredExercises'. Es OBLIGATORIO incluir EXACTAMENTE 3 NIVELES ('basico', 'intermedio', 'avanzado') y al menos 2 EJERCICIOS POR CADA NIVEL (mínimo 6 ejercicios en total), con sus datos, pistas de andamiaje y criterios de evaluación.`
        );
      }
      if (!useSharding && missingPlans) {
        strictDirectives.push(
          `Tu respuesta anterior solo incluyó ${planCount} de ${coveredSessions.length} planes en 'sessionPlans'. Genera OBLIGATORIAMENTE UN plan por cada sesión asignada (${coveredSessions.join(', ')}), es decir EXACTAMENTE ${coveredSessions.length} objetos en 'sessionPlans', cada uno con su "sessionNumber" correcto y contenido real de estudiante (voz en tú).`
        );
      }
      try {
        const retryPrompt = `${effectivePrompt}\n\n[REQUISITO CRÍTICO - REINTENTO OBLIGATORIO]: ${strictDirectives.join(' ')}`;
        const retryResponse = await runScheduled(input.scheduler, 'evaluation:narrative-retry', () =>
          generateWithRotation(
            effectiveSystemInstruction,
            retryPrompt,
            input.planning.teacherId,
            false,
            { jsonMode: true, maxTokens: narrativeMaxTokens, timeoutMs: narrativeTimeoutMs, signal: input.signal }
          )
        );
        const retryParsed = robustJsonParse(retryResponse);
        const retryTiers = Array.isArray(retryParsed.tieredExercises) ? retryParsed.tieredExercises : [];
        const retryPlanCount = Array.isArray(retryParsed.sessionPlans) ? retryParsed.sessionPlans.length : 0;
        const tiersOk = retryTiers.length >= tiers.length;
        const retryExercisesOk = retryTiers.every((t: { exercises?: unknown }) => Array.isArray(t.exercises));
        if (tiersOk && retryExercisesOk && (useSharding || retryPlanCount >= planCount)) {
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
    const sessionPlans = shardedPromise
      ? (await shardedPromise).plans
      : completeSessionPlans(parsed.sessionPlans, coveredSessions, fallbackContext);
    missionSection.sessionPlans = sessionPlans;
    assertNoGenericContent(missionSection, `EvaluationWriter · ${missionSection.title}`);
    const evalRealText = getEvaluationRealText(evaluationSection);
    const sectionWordCount = evalRealText.split(/\s+/).filter(Boolean).length;
    const sessionPlansWords = sessionPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
    const totalMissionWords = sectionWordCount + sessionPlansWords;
    missionSection.wordCount = totalMissionWords;

    const quality = evaluateQuality({
      wordCount: totalMissionWords,
      targetWords: input.targetWords,
      content: evalRealText,
      subsystem: input.subsystem,
      workbookElementsCount: 2, // 2 workbook elements reales generados en buildEvaluationMissionSection
    });

    if (attempt === 1) {
      logger.info(`[EvaluationWriter] ✅ Generado en intento 1 — ${totalMissionWords} palabras (${sectionWordCount} sección + ${sessionPlansWords} sesiones)`);
    } else {
      logger.info(`[EvaluationWriter] ⚠️ Reintento necesario — ${totalMissionWords} palabras en intento 2`);
    }

    return {
      type: 'evaluation',
      section: missionSection,
      evaluationSection,
      wordCount: totalMissionWords,
      tokensUsed: Math.round(totalMissionWords * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: unknown) {
    if (input.signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('AbortError')))) {
      throw (input.signal?.reason || err);
    }
    logger.error('[generateEvaluationSection] Error sin fallback sintético:', err);
    throw err;
  }
}

/**
 * Resuelve la misión de evaluación, sus sesiones cubiertas, índice y título.
 * SSoT compartido entre la generación (cobertura de sessionPlans) y el ensamblado
 * de la MissionSection, para que ambos usen SIEMPRE las mismas sesiones.
 */
function resolveEvaluationMission(input: WriterInput): {
  evalMission: WriterInput['missions'][number] | undefined;
  coveredSessions: number[];
  missionIndex: number;
  title: string;
} {
  const evalMission = input.missions.find((m) => m.missionType === 'evaluation') || input.missions[input.missions.length - 1];
  const lastSession = input.sessions[input.sessions.length - 1];
  const coveredSessions = evalMission ? evalMission.sessionNumbers : (lastSession ? [lastSession.sessionNum] : [input.sessions.length || 16]);
  const missionIndex = evalMission?.missionIndex || 4;
  const title = evalMission?.title || `Misión 4: Demostración Integral y Evaluación Formativa`;
  return { evalMission, coveredSessions, missionIndex, title };
}

/**
 * Construye la sección de misión (MissionSection) correspondiente a la evaluación
 * para garantizar el contrato uniforme de salida entre todos los redactores.
 */
function buildEvaluationMissionSection(
  input: WriterInput,
  evaluation: EvaluationSection
): MissionSection {
  const { evalMission, coveredSessions, missionIndex, title } = resolveEvaluationMission(input);

  const workbookElements: WorkbookElement[] = [
    {
      id: 'wb-eval-checklist-box',
      type: 'checkbox_list',
      title: 'Lista de Cotejo del Producto o Evidencia (Coevaluación entre Pares)',
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
