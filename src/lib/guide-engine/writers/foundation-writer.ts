/**
 * Foundation Mission Writer (Concepto Cero)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Redacta la primera misión del bloque introduciendo el tema desde cero:
 * - Gancho fenomenológico situado en Puebla (PAEC).
 * - Concepto Cero: analogía física intuitiva sin tecnicismos previos.
 * - Yo Hago: demostración resuelta paso a paso.
 * - Hacemos Juntos: práctica colaborativa con espacios de trabajo.
 * - Tú Haces: reto autónomo del estudiante.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { extractWorkbookTags, consolidateWorkbookElements, stripWorkbookTags } from '../workbook-tags';
import type { MissionSection, WorkbookElement } from '@/types/work-textbook';
import { type WriterInput, type WriterOutput, evaluateQuality, completeSessionPlans } from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { logger } from '@/lib/logger';
import { lintPedagogicalTerminology, FORBIDDEN_PM3_TERMINOLOGY_REGEX } from '../pedagogical-quality-gate';
import { countSessionPlanWords } from '../content-budget';

export async function generateFoundationMission(input: WriterInput): Promise<WriterOutput> {
  const foundationMission = input.missions.find((m) => m.missionType === 'foundation') || input.missions[0];
  const coveredSessions = foundationMission ? foundationMission.sessionNumbers : [1, 2];
  const missionTitle = foundationMission ? foundationMission.title : `Misión 1: Fundamentación e Intuición`;

  const approach = input.subsystem === 'bt' ? 'estándar industrial y tecnológico' : 'indagación científica y dialógica';
  const planningAlignmentChunk = buildPlanningAlignmentPrompt(input.planningActivities, 'foundation', input.uacName) +
  (input.alignmentDirective ? ` 
ALINEACION DURA — TERMINOS OBLIGATORIOS DE LA PLANEACION (reproduce su redaccion original en tu seccion): ` + input.alignmentDirective + ` 
 ` : '');

  const systemInstruction = `Eres AUTOR DE LIBRO DE TEXTO para estudiantes de Educación Media Superior en México (estilo Santillana/Pearson), especialista en Pedagogía y en el modelo de Finlandia (Phenomenon-Based Learning).
Tu tarea es redactar la primera misión formativa ("Misión 1: Fundamentación e Intuición - Concepto Cero") de un LIBRO PARA EL ESTUDIANTE, NO una guía para el docente: el estudiante debe poder aprender SOLO, leyendo el libro, sin que el maestro esté presente.
Libro de: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Enfoque pedagógico: "${approach}".
${planningAlignmentChunk}

REGLAS DE VOZ (CRÍTICO — el libro es del ESTUDIANTE):
- Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "vas a aprender", "tu cuaderno", "observa", "resuelve").
- PROHIBIDO usar etiquetas "Docente:" o "Estudiante:", y verbos de instrucción al maestro ("activar el interés", "exponer y problematizar", "verificar comprensión", "orientar el avance", "plantear la situación", "retomar el desafío"). Eso va en el plan de clase, NO en el libro.
- El contenido debe ser REAL y AUTODIDACTA: definiciones, fórmulas, explicaciones, ejemplos resueltos con NÚMEROS y ejercicios con datos concretos. Un estudiante que lee el libro aprende el tema.

REGLAS DE PROFUNDIDAD Y CUADERNO ACTIVO:
1. Concepto Cero (400 a 600 palabras en total entre physicalAnalogy y coreExplanation):
   - physicalAnalogy: Analogía cotidiana vívida e intuitiva (80-140 palabras) de la vida real o comunidad situada EXCLUSIVAMENTE en el ámbito disciplinar de "${input.uacName}" (ej. arquitectura, diseño, construcción, ingeniería civil, mecánica o topografía para Dibujo Técnico). QUEDA TERMINANTEMENTE PROHIBIDO usar analogías de gastronomía, cocina, chefs, cuchillos o recetas salvo que la UAC sea expresamente de Alimentos o Gastronomía.
   - coreExplanation: Al menos 2 párrafos explicativos conceptuales + 1 EJEMPLO RESUELTO PASO A PASO con datos cuantitativos/procedimentales + 1 tabla de contraste <!--workbook:table:cols=Aspecto Cotidiano,Concepto Técnico Formal,Función en el Problema-->.
2. Gancho fenomenológico: Desafío real motivador de Puebla contextualizado en el proyecto PAEC: "${input.paecContext}".
3. Yo Hago (350 a 500 palabras): Tutorial maestro modelado paso a paso (código funcional comentado en BT; modelación/experimento en BGE).
4. Hacemos Juntos (300 a 450 palabras): Práctica colaborativa en equipo. OBLIGATORIO: cada actividad debe plantear un PROBLEMA REAL de la vida diaria del estudiante en Puebla, su comunidad o el proyecto PAEC ("${input.paecContext}"), con datos cuantitativos concretos y aplicables. PROHIBIDO usar ejercicios abstractos desconectados de la realidad (ej. 'resuelve 2x+5=15' sin contexto). Cada práctica debe responder '¿dónde veo esto en mi vida?'.
5. Tú Haces (250 a 400 palabras): Desafío individual de aplicación real con espacios de trabajo, anclado a una situación cotidiana verificable del entorno del estudiante.
6. Contenido por sesión para el ESTUDIANTE (OBLIGATORIO — genera un "plan" por cada sesión de ${coveredSessions.join(', ')}, ~950 a 1,150 palabras por plan):
   Para CADA sesión cubierta (${coveredSessions.join(', ')}) genera un objeto en "sessionPlans". NUNCA omitas ninguna sesión ni uses resúmenes telegráficos. Cada objeto es material que el estudiante LEE para aprender de forma autodidacta:
   (a) objetivo: "Lo que vas a aprender" (1-2 frases concretas, voz en tú);
   (b) motivacion: (80 a 120 palabras) caso o dilema real de la comunidad escolar de Puebla o del proyecto PAEC contada directamente al estudiante;
   (c) saberesPrevios: (50 a 80 palabras) qué conocimientos previos conectan con la sesión y qué preguntas diagnósticas debe responder en su cuaderno;
   (d) contenido: (OBLIGATORIO MÍNIMO 440 A 520 PALABRAS) LA TEORÍA REAL de la sesión — definiciones formales, leyes o fórmulas explicadas con rigor, desarrollo teórico estructurado en 3 párrafos sustanciales (al menos 150 palabras por párrafo). NO resumas en 1-2 frases; explica como un verdadero libro de texto Santillana/Pearson;
   (e) ejemploResuelto: (OBLIGATORIO MÍNIMO 300 A 360 PALABRAS) ejemplo numérico o procedimental con planteamiento contextualizado, datos explícitos, desarrollo paso a paso numerado en 4 pasos y análisis del resultado;
   (f) practica: 2 ejercicios contextualizados con datos reales; enunciados detallados (mínimo 60 palabras cada uno) con "pista" orientadora (mínimo 30 palabras) y "solucion" con 3-6 pasos numerados con operaciones completas;
   (g) aplicacion: (80 a 120 palabras) tarea de transferencia y aplicación al entorno comunitario;
   (h) autoevaluacion: 2-3 preguntas reflexivas metacognitivas;
   (i) recursos: 1-2 enlaces verosímiles de ampliación (YouTube o web);
   (j) productoIntegrador: (60 a 90 palabras) avance concreto y fechado del entregable para el portafolio.
   Los planes deben VARIAR entre sesiones (cada sesión aborda una arista distinta del tema) y ser específicos del contexto PAEC/comunidad. VOZ DE ESTUDIANTE en todo.
7. Cuaderno activo: Incluye 2-4 etiquetas <!--workbook:...--> (lines:rows=8, table:cols=..., code:lines=15, drawing:height=160).
8. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.
9. GUARDRAIL DE TERMINOLOGÍA (CERO ARCAÍSMOS): Queda estrictamente PROHIBIDO emplear conceptos o instrumentos arcaicos/obsoletos tales como 'balanza romana' o 'báscula de dos platillos'. Emplear en su lugar balances analíticos contemporáneos, básculas de precisión digital, balanzas algebraicas de equilibrio o herramientas modernas de medición y modelado.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "phenomenonStory": "Relato fenomenológico motivador contado al estudiante...",
  "detonatingQuestion": "¿Pregunta detonadora de pensamiento crítico?",
  "physicalAnalogy": "Analogía cotidiana física e intuitiva...",
  "coreExplanation": "Explicación conceptual profunda en voz de estudiante (2+ párrafos + ejemplo resuelto paso a paso con números + tabla comparativa)...",
  "iDoDemo": "Demostración guiada paso a paso que el estudiante sigue ('Yo Hago')...",
  "weDoPractice": "Práctica colaborativa que el estudiante realiza ('Hacemos Juntos')...",
  "youDoChallenge": "Reto autónomo individual ('Tú Haces')...",
  "formativeCheckpoint": {
    "question": "Pregunta de reflexión metacognitiva para el estudiante...",
    "reflectionPrompts": ["Pregunta de reflexión 1", "Pregunta de reflexión 2"],
    "criteriaChecklist": ["Criterio de auto-verificación 1", "Criterio 2"]
  },
  "sessionPlans": [
    {
      "sessionNumber": 1,
      "objetivo": "Lo que vas a aprender en la sesión 1 (1-2 frases)...",
      "motivacion": "Caso real / historia contada al estudiante...",
      "saberesPrevios": "Qué ya sabes que conecta con esto...",
      "contenido": "Párrafo 1: En esta sesión aprenderás las bases conceptuales y definiciones fundamentales...\\n\\nPárrafo 2: El desarrollo analítico formal de los modelos matemáticos y leyes físicas requiere...\\n\\nPárrafo 3: La vinculación con los fenómenos cotidianos y la intuición visual demuestran...",
      "ejemploResuelto": "Planteamiento: Se analiza un caso fundamental con datos cuantitativos concretos...\\nPaso 1: Identificación de datos conocidos e incógnitas...\\nPaso 2: Selección y justificación del modelo o ecuación...\\nPaso 3: Operaciones numéricas paso a paso y despeje...\\nPaso 4: Interpretación del resultado y comprobación física...",
      "practica": [
        { "enunciado": "Ejercicio 1 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: sustituir datos en la fórmula...", "Paso 2: operar y despejar...", "Respuesta final: ..."] },
        { "enunciado": "Ejercicio 2 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: ...", "Respuesta final: ..."] }
      ],
      "aplicacion": "Aplicación a la vida real del estudiante...",
      "autoevaluacion": ["¿Puedo explicar el concepto central?", "¿Logré la práctica sin mirar?"],
      "recursos": [
        { "titulo": "Video educativo sobre el tema", "url": "https://www.youtube.com/results?search_query=tema+educacion+media+superior", "tipo": "video" },
        { "titulo": "Consulta temática de ampliación", "url": "https://www.google.com/search?q=tema+bachillerato", "tipo": "web" }
      ],
      "productoIntegrador": "Qué agregas hoy a tu producto integrador..."
    }
  ]
}`;

  const sessionCount = Math.max(1, coveredSessions.length);
  const targetWordsPerPlan = Math.round((input.targetWords.ideal / sessionCount) * 0.72);
  const totalPlansTarget = sessionCount * targetWordsPerPlan;
  const remainingNarrativeTarget = Math.max(300, input.targetWords.ideal - totalPlansTarget);

  const coreTarget = Math.round(remainingNarrativeTarget * 0.40);
  const iDoTarget = Math.round(remainingNarrativeTarget * 0.25);
  const weDoTarget = Math.round(remainingNarrativeTarget * 0.20);
  const youDoTarget = Math.round(remainingNarrativeTarget * 0.15);

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()} (Enfoque: ${approach})
Semestre: ${input.planning.semester}
Bloque: ${input.blockName} (Índice ${input.blockIndex})
Misión a redactar: ${missionTitle}
Sesiones cubiertas: Sesiones ${coveredSessions.join(', ')} (${sessionCount} sesiones)
Perfil de estudiantes: ${input.studentProfile}
Presupuesto total para esta misión: mínimo ${input.targetWords.min} palabras (ideal ~${input.targetWords.ideal} palabras).

DISTRIBUCIÓN CALIBRADA DE PALABRAS:
- sessionPlans (${sessionCount} sesiones): OBLIGATORIO redactar las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}), con ~${targetWordsPerPlan} palabras por sesión (total planes: ~${totalPlansTarget} palabras). Cada plan debe contener mínimo 440 a 500 palabras en contenido (3 párrafos conceptuales profundos, mínimo 150 palabras por párrafo) y mínimo 300 a 360 palabras en ejemploResuelto (caso formal con 4 pasos numéricos de desarrollo detallado).
- coreExplanation + physicalAnalogy: ~${coreTarget} palabras (explicación formal rigurosa y analogía intuitiva)
- iDoDemo: ~${iDoTarget} palabras (demostración docente modelada paso a paso)
- weDoPractice: ~${weDoTarget} palabras (práctica guiada colaborativa)
- youDoChallenge: ~${youDoTarget} palabras (reto autónomo escalonado)

GUARDRAIL TERMINOLÓGICO OBLIGATORIO:
- Queda estrictamente PROHIBIDO usar 'balanza romana' o 'báscula de dos platillos'.
- Usa exclusivamente instrumental y terminología contemporánea (báscula digital, balanza analítica, balanza algebraica).

Redacta la Misión de Fundamentación e Intuición completa con máxima profundidad:`;

  try {
    let attempt: 1 | 2 = 1;
    const rawResponse = await generateWithRotation(
      systemInstruction,
      prompt,
      input.planning.teacherId,
      false,
      { jsonMode: true, maxTokens: 16384, timeoutMs: 85000, signal: input.signal }
    );
    let parsed = robustJsonParse(rawResponse);

    // Validación de extensión mínima calibrada según el presupuesto
    const coreWords = (parsed.coreExplanation || '').split(/\s+/).filter(Boolean).length;
    const minCoreWords = Math.min(400, Math.max(150, Math.round(coreTarget * 0.5)));
    if (coreWords < minCoreWords) {
      attempt = 2;
      logger.warn(`[FoundationWriter] coreExplanation tiene solo ${coreWords} palabras (< ${minCoreWords}). Reintentando con instrucción estricta...`);
      try {
        const retryPrompt = `${prompt}\n\n[REQUISITO CRÍTICO DE PROFUNDIDAD]: Tu respuesta anterior fue insuficiente (${coreWords} palabras en coreExplanation). Redacta OBLIGATORIAMENTE un 'coreExplanation' de MÍNIMO ${minCoreWords} palabras con al menos dos párrafos explicativos extensos, desarrollando paso a paso la fundamentación formal y física del concepto sin resumir.`;
        const retryResponse = await generateWithRotation(
          systemInstruction,
          retryPrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 16384, timeoutMs: 85000, signal: input.signal }
        );
        const retryParsed = robustJsonParse(retryResponse);
        const retryWords = (retryParsed.coreExplanation || '').split(/\s+/).filter(Boolean).length;
        if (retryWords > coreWords) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        logger.warn('[FoundationWriter] Error en reintento, preservando primera respuesta:', { error: String(retryErr) });
      }
    }

    // Validación de terminología PM3 y reintento correctivo (F-63)
    const terminologyLint = lintPedagogicalTerminology(JSON.stringify(parsed));
    if (terminologyLint.hasForbiddenTerminology) {
      attempt = 2;
      logger.warn(`[FoundationWriter] Detectada terminología obsoleta (${terminologyLint.forbiddenMatches.join(', ')}). Ejecutando correctiveRetry...`);
      try {
        const correctivePrompt = `${prompt}\n\n[REQUISITO CRÍTICO DE TERMINOLOGÍA - CORRECTIVE RETRY]: Tu respuesta previa contenía términos obsoletos prohibidos (${terminologyLint.forbiddenMatches.join(', ')}). Es ESTRICTAMENTE OBLIGATORIO eliminar cualquier mención a 'balanza romana' o 'báscula de dos platillos' y sustituirlas por balanza de precisión analítica, báscula digital de laboratorio o balanza algebraica contemporánea.`;
        const correctiveResponse = await generateWithRotation(
          systemInstruction,
          correctivePrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 16384, signal: input.signal }
        );
        const retryParsed = robustJsonParse(correctiveResponse);
        const retryLint = lintPedagogicalTerminology(JSON.stringify(retryParsed));
        if (!retryLint.hasForbiddenTerminology) {
          parsed = retryParsed;
        } else {
          // Si el modelo reincide, sanitizar deterministamente las ocurrencias
          const sanitized = JSON.stringify(retryParsed).replace(
            new RegExp(FORBIDDEN_PM3_TERMINOLOGY_REGEX.source, 'gi'),
            'balanza de precisión analítica'
          );
          parsed = robustJsonParse(sanitized);
        }
      } catch (retryErr) {
        logger.warn('[FoundationWriter] Error en correctiveRetry de terminología, aplicando sanitización determinista:', { error: String(retryErr) });
        const sanitized = JSON.stringify(parsed).replace(
          new RegExp(FORBIDDEN_PM3_TERMINOLOGY_REGEX.source, 'gi'),
          'balanza de precisión analítica'
        );
        parsed = robustJsonParse(sanitized);
      }
    }

    // Extraer tags de cuaderno presentes en la respuesta
    const fullTextForTags = `${parsed.iDoDemo || ''}\n${parsed.weDoPractice || ''}\n${parsed.youDoChallenge || ''}`;
    const parsedTags = extractWorkbookTags(fullTextForTags);
    const workbookElements: WorkbookElement[] = parsedTags.map((t) => t.element);

    // Asegurar que al menos tengamos 2 elementos de cuaderno por defecto si la IA no colocó tags
    if (workbookElements.length === 0) {
      workbookElements.push(
        {
          id: 'wb-lines-1',
          type: 'lines',
          title: 'Registro de hipótesis inicial',
          instruction: 'Escribe con tus propias palabras qué fenómeno observas y cuál es tu predicción:',
          config: { rows: 5 },
        },
        {
          id: 'wb-table-1',
          type: 'empty_table',
          title: 'Tabla de contraste conceptual',
          instruction: 'Completa la tabla comparando la analogía física con el concepto formal:',
          config: {
            cols: ['Elemento Cotidiano', 'Concepto Técnico', 'Función en el Problema'],
            sampleRows: 4,
          },
        }
      );
    }

    // Consolidación de tags lines ANTES del .slice() para correcta distribución entre weDo y youDo
    const consolidatedElements = consolidateWorkbookElements(workbookElements);

    // Limpieza de etiquetas de control <!--workbook:...--> de los textos procedimentales
    const cleanIDoDemo = stripWorkbookTags(parsed.iDoDemo || 'Ejemplo resuelto paso a paso por el docente.');
    const cleanWeDoPractice = stripWorkbookTags(parsed.weDoPractice || 'Actividad colaborativa en clase.');
    const cleanYouDoChallenge = stripWorkbookTags(parsed.youDoChallenge || 'Reto individual en cuaderno.');

    const formativeText = parsed.formativeCheckpoint
      ? `${parsed.formativeCheckpoint.question || ''} ${(parsed.formativeCheckpoint.reflectionPrompts || []).join(' ')} ${(parsed.formativeCheckpoint.criteriaChecklist || []).join(' ')}`
      : '';
    const sectionContent = `${parsed.phenomenonStory || ''} ${parsed.detonatingQuestion || ''} ${parsed.physicalAnalogy || ''} ${parsed.coreExplanation || ''} ${cleanIDoDemo} ${cleanWeDoPractice} ${cleanYouDoChallenge} ${formativeText}`.trim();
    const sectionWordCount = sectionContent.split(/\s+/).filter(Boolean).length;
    const sessionPlans = completeSessionPlans(parsed.sessionPlans, coveredSessions);
    const sessionPlansWords = sessionPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
    const totalMissionWords = sectionWordCount + sessionPlansWords;

    const missionSection: MissionSection = {
      missionIndex: foundationMission?.missionIndex || 1,
      title: missionTitle,
      coveredSessions,
      sessionTopic: foundationMission?.sessionTopic || 'Fundamentos',
      sessionFocus: foundationMission?.focus || 'Concepto Cero y Andamiaje',
      phenomenonHook: {
        story: parsed.phenomenonStory || 'Desafío del entorno escolar poblano.',
        detonatingQuestion: parsed.detonatingQuestion || '¿Cómo podemos explicar y modelar esta situación?',
      },
      conceptZero: {
        physicalAnalogy: parsed.physicalAnalogy || 'Analogía intuitiva cotidiana.',
        coreExplanation: parsed.coreExplanation || 'Fundamento conceptual inicial.',
      },
      iDoSection: {
        stepByStepDemo: cleanIDoDemo,
      },
      weDoSection: {
        guidedPractice: cleanWeDoPractice,
        workbookElements: consolidatedElements.slice(0, Math.ceil(consolidatedElements.length / 2)),
      },
      youDoSection: {
        autonomousChallenge: cleanYouDoChallenge,
        workbookElements: consolidatedElements.slice(Math.ceil(consolidatedElements.length / 2)),
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: parsed.formativeCheckpoint?.question || '¿Qué aprendiste hoy y cómo se conecta con tu comunidad?',
        reflectionPrompts: parsed.formativeCheckpoint?.reflectionPrompts || ['Identifica un ejemplo similar en tu entorno.'],
        criteriaChecklist: parsed.formativeCheckpoint?.criteriaChecklist || ['Explico el concepto sin memorizar fórmulas.'],
      },
      sessionPlans,
      wordCount: totalMissionWords,
    };

    const quality = evaluateQuality({
      wordCount: totalMissionWords,
      targetWords: input.targetWords,
      content: sectionContent,
      subsystem: input.subsystem,
      workbookElementsCount: workbookElements.length,
    });

    if (attempt === 1) {
      logger.info(`[FoundationWriter] ✅ Generado en intento 1 — ${totalMissionWords} palabras (${sectionWordCount} sección + ${sessionPlansWords} sesiones)`);
    } else {
      logger.info(`[FoundationWriter] ⚠️ Reintento necesario — ${totalMissionWords} palabras en intento 2`);
    }

    return {
      type: 'foundation',
      section: missionSection,
      wordCount: totalMissionWords,
      tokensUsed: Math.round(totalMissionWords * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: unknown) {
    if (input.signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('AbortError')))) {
      throw (input.signal?.reason || err);
    }
    logger.error('[generateFoundationMission] Error:', err);
    // Fallback de resiliencia estructurado
    const fallbackPlans = completeSessionPlans([], coveredSessions);
    const fallbackPlansWords = fallbackPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
    const fallbackTotalWords = 500 + fallbackPlansWords;

    const fallbackSection: MissionSection = {
      missionIndex: foundationMission?.missionIndex || 1,
      title: missionTitle,
      coveredSessions,
      sessionTopic: 'Fundamentación e Intuición',
      sessionFocus: 'Concepto Cero y saberes previos',
      phenomenonHook: {
        story: `En la comunidad de la escuela, nos enfrentamos cotidianamente a situaciones vinculadas a ${input.uacName}. Reflexionar sobre cómo funciona nuestro entorno nos permite plantear soluciones concretas para el proyecto PAEC: ${input.paecContext}.`,
        detonatingQuestion: '¿De qué manera los principios que estudiaremos hoy transforman las decisiones técnicas en la vida real?',
      },
      conceptZero: {
        physicalAnalogy: 'Imaginemos este concepto como un sistema interconectado donde cada componente cumple un rol indispensable.',
        coreExplanation: `El estudio de ${input.uacName} permite comprender los principios operativos y formales que rigen la disciplina.`,
      },
      iDoSection: {
        stepByStepDemo: 'El docente modela el análisis inicial en el pizarrón demostrando el procedimiento estándar.',
      },
      weDoSection: {
        guidedPractice: 'En parejas, analicen el siguiente caso aplicando los principios revisados.',
        workbookElements: [
          {
            id: 'fb-lines-1',
            type: 'lines',
            title: 'Hipótesis de trabajo',
            instruction: 'Anota en tres renglones tu propuesta inicial:',
            config: { rows: 4 },
          },
        ],
      },
      youDoSection: {
        autonomousChallenge: 'Resuelve el ejercicio de aplicación de forma individual en tu cuaderno.',
        workbookElements: [
          {
            id: 'fb-table-1',
            type: 'empty_table',
            title: 'Tabla de registro individual',
            config: { cols: ['Etapa', 'Observación', 'Conclusión'], sampleRows: 4 },
          },
        ],
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Qué dificultades encontraste al abordar este concepto por primera vez?',
        reflectionPrompts: ['Revisa los pasos que seguiste y contrástalos con tu compañero.'],
        criteriaChecklist: ['Identifico el propósito central de la misión.'],
      },
      sessionPlans: fallbackPlans,
      wordCount: fallbackTotalWords,
    };

    return {
      type: 'foundation',
      section: fallbackSection,
      wordCount: fallbackTotalWords,
      tokensUsed: 0,
      qualityScore: 70,
      warnings: ['Generado con fallback estructurado por timeout o error en modelo: ' + (err instanceof Error ? err.message : String(err))],
    };
  }
}
