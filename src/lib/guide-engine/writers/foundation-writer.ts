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
import {
  type WriterInput,
  type WriterOutput,
  type FallbackPlanContext,
  evaluateQuality,
  completeSessionPlans,
  resolveRemainingBudgetMs,
} from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { formatRequiredTermsDirective } from '../planning-content-alignment';
import { assertNoGenericContent } from '../quality/no-generic-content';
import { runScheduled } from '../writer-scheduler';
import {
  generateShardedSessionPlans,
  applySurgicalSessionRepair,
  sessionPlanWordTarget,
  type SessionShardContext,
} from './session-shard';
import { logger } from '@/lib/logger';
import { lintPedagogicalTerminology, FORBIDDEN_PM3_TERMINOLOGY_REGEX } from '../pedagogical-quality-gate';
import { countSessionPlanWords } from '../content-budget';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
import {
  buildCanonicalSessionPlanInstructions,
  buildCanonicalSessionPlanJsonExample,
} from './session-prompt-contract';
import {
  resolveCheckpoint,
  resolveConceptZero,
  resolvePhenomenonHook,
} from './mission-narrative';

export async function generateFoundationMission(input: WriterInput): Promise<WriterOutput> {
  const foundationMission = input.missions.find((m) => m.missionType === 'foundation') || input.missions[0];
  const coveredSessions = foundationMission ? foundationMission.sessionNumbers : [1, 2];
  const missionTitle = foundationMission ? foundationMission.title : `Misión 1: Fundamentación e Intuición`;
  const discipline = getDisciplinaryAdapter(
    input.uacName,
    input.component,
    input.curriculumName || input.careerOrProgramName
  );
  const equipmentHint = discipline.allowedPhysicalEquipment.slice(0, 4).join(', ');
  const fallbackContext: FallbackPlanContext = {
    uacName: input.uacName,
    blockName: input.blockName,
    sessionTopic: foundationMission?.sessionTopic || 'Fundamentos',
    sessionFocus: foundationMission?.focus || 'Concepto Cero y Andamiaje',
    paecContext: input.paecContext,
    subsystem: input.subsystem,
    component: input.component,
    curriculumName: input.curriculumName,
    careerOrProgramName: input.careerOrProgramName,
  };

  const isQuantitative = discipline.family === 'cuantitativa_experimental';
  const sessionCount = Math.max(1, coveredSessions.length);
  const targetWordsPerPlan = sessionPlanWordTarget(input.targetWords.ideal, sessionCount);
  const shardCtx: SessionShardContext = {
    input,
    missionType: 'foundation',
    missionTitle,
    coveredSessions,
    disciplineName: discipline.displayName,
    fallbackContext,
    targetWordsPerPlan,
    extraGuardrails: isQuantitative
      ? "GUARDRAIL DE TERMINOLOGÍA (CERO ARCAÍSMOS): Queda estrictamente PROHIBIDO emplear conceptos o instrumentos arcaicos/obsoletos tales como 'balanza romana' o 'báscula de dos platillos'. Emplear en su lugar balances analíticos contemporáneos, básculas de precisión digital, balanzas algebraicas de equilibrio o herramientas modernas de medición y modelado."
      : undefined,
    requiredTerms: input.requiredTerms,
  };

  if (input.previousOutput && input.surgicalSessionTerms) {
    return applySurgicalSessionRepair(shardCtx, input.previousOutput, input.surgicalSessionTerms);
  }

  const approach = discipline.approachDescriptor;
  const autodidactEvidenceRule = discipline.requiresQuantitativeData
    ? 'definiciones, fórmulas o procedimientos, explicaciones, ejemplos resueltos con NÚMEROS o datos medibles y ejercicios con datos concretos.'
    : 'definiciones, marcos conceptuales, explicaciones claras, ejemplos resueltos con casos, textos o fuentes verificables y ejercicios aplicados.';
  const coreExampleRule = discipline.requiresQuantitativeData
    ? '1 EJEMPLO RESUELTO PASO A PASO con datos cuantitativos/procedimentales verificables'
    : '1 EJEMPLO RESUELTO PASO A PASO con un caso, texto, fuente o situación verificable propia de la disciplina (sin inventar fórmulas artificiales)';
  const iDoModalityRule =
    discipline.family === 'computacional_algoritmica'
      ? 'código funcional comentado o algoritmo con prueba de escritorio'
      : discipline.family === 'tecnica_laboral'
        ? 'procedimiento operativo estandarizado (POE) o protocolo paso a paso'
        : discipline.family === 'corporal_motriz'
          ? 'demostración motriz dosificada y monitoreo fisiológico paso a paso'
          : discipline.family === 'humanistica_comunicativa_social'
            ? 'análisis modelado paso a paso de un texto, fuente, obra o estudio de caso'
            : 'modelación matemática o experimento resuelto paso a paso';
  const weDoDataRule = discipline.requiresQuantitativeData
    ? 'con datos cuantitativos concretos y aplicables. PROHIBIDO usar ejercicios abstractos desconectados de la realidad (ej. \'resuelve 2x+5=15\' sin contexto).'
    : 'con fuentes, casos, dilemas o evidencias concretas y aplicables. PROHIBIDO usar ejercicios memorísticos o preguntas genéricas desconectadas de la realidad.';
  const requiredTermsChunk = formatRequiredTermsDirective(input.requiredTerms ?? []);
  const planningAlignmentChunk = buildPlanningAlignmentPrompt(
    input.planningActivities,
    'foundation',
    input.uacName,
    input.component,
    input.curriculumName,
    input.careerOrProgramName
  ) +
  (requiredTermsChunk ? `\n${requiredTermsChunk}\n` : '') +
  (input.alignmentDirective ? ` 
ALINEACION DURA — TERMINOS OBLIGATORIOS DE LA PLANEACION (reproduce su redaccion original en tu seccion): ` + input.alignmentDirective + ` 
 ` : '');

  const canonicalSessionContract = buildCanonicalSessionPlanInstructions(discipline, 'foundation', {
    firstSession: coveredSessions[0],
  });
  const canonicalSessionJson = buildCanonicalSessionPlanJsonExample(
    discipline,
    coveredSessions[0]
  );
  const shardingEnabled = Boolean(input.scheduler);
  const canonicalSessionBlocks = shardingEnabled
  ? ''
  : [
      '',
      'ESTRUCTURA OBLIGATORIA DE LA PROPIEDAD "sessionPlans" DENTRO DEL MISMO OBJETO JSON ANTERIOR:',
      canonicalSessionContract,
      '',
      'EJEMPLO DE REFERENCIA PARA "sessionPlans" (intégralo dentro del mismo JSON raíz de salida):',
      canonicalSessionJson,
      '',
      'PRECEDENCIA: este Contrato Canónico V2 sustituye cualquier cuota o ejemplo de sessionPlans indicado antes.',
    ].join('\n');

  const systemInstruction = `Eres AUTOR DE LIBRO DE TEXTO para estudiantes de Educación Media Superior en México (estilo Santillana/Pearson), especialista en ${discipline.displayName} y en el modelo de Finlandia (Phenomenon-Based Learning).
Tu tarea es redactar la primera misión formativa ("Misión 1: Fundamentación e Intuición - Concepto Cero") de un LIBRO PARA EL ESTUDIANTE, NO una guía para el docente: el estudiante debe poder aprender SOLO, leyendo el libro, sin que el maestro esté presente.
Libro de: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Enfoque pedagógico: "${approach}".
${planningAlignmentChunk}

REGLAS DE VOZ (CRÍTICO — el libro es del ESTUDIANTE):
- Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "vas a aprender", "tu cuaderno", "observa", "analiza").
- PROHIBIDO usar etiquetas "Docente:" o "Estudiante:", y verbos de instrucción al maestro ("activar el interés", "exponer y problematizar", "verificar comprensión", "orientar el avance", "plantear la situación", "retomar el desafío"). Eso va en el plan de clase, NO en el libro.
- El contenido debe ser REAL y AUTODIDACTA: ${autodidactEvidenceRule} Un estudiante que lee el libro aprende el tema.
- ESTILO EDITORIAL OBLIGATORIO: lenguaje claro, directo y breve. PROHIBIDO el lenguaje hiperbólico o grandilocuente ("altísimo valor académico", "pulcritud", "veracidad absoluta", "lamentable omisión", "excelencia académica", "inequívoca"). Explica con hechos, datos y procedimientos, sin adjetivos de exaltación.

REGLAS DE PROFUNDIDAD Y CUADERNO ACTIVO:
1. Concepto Cero (400 a 600 palabras en total entre physicalAnalogy y coreExplanation):
   - physicalAnalogy: Analogía cotidiana vívida e intuitiva (80-140 palabras) de la vida real o comunidad situada EXCLUSIVAMENTE en el ámbito disciplinar de "${input.uacName}" (${discipline.displayName}). Usa como referencia el equipo, los recursos o las prácticas propias de esta disciplina: ${equipmentHint || 'los recursos pertinentes de la UAC'}. No introduzcas instrumentos, escenarios ni ejemplos de otras disciplinas.
   - coreExplanation: Al menos 2 párrafos explicativos conceptuales + ${coreExampleRule} + 1 tabla de contraste <!--workbook:table:cols=Aspecto Cotidiano,Concepto Formal,Función en el Caso-->.
2. Gancho fenomenológico: Desafío real motivador de Puebla contextualizado en el proyecto PAEC: "${input.paecContext}".
3. Yo Hago (350 a 500 palabras): Tutorial maestro modelado paso a paso (${iDoModalityRule}).
4. Hacemos Juntos (300 a 450 palabras): Práctica colaborativa en equipo. OBLIGATORIO: cada actividad debe plantear un PROBLEMA REAL de la vida diaria del estudiante en Puebla, su comunidad o el proyecto PAEC ("${input.paecContext}"), ${weDoDataRule} Cada práctica debe responder '¿dónde veo esto en mi vida?'.
5. Tú Haces (250 a 400 palabras): Desafío individual de aplicación real con espacios de trabajo, anclado a una situación cotidiana verificable del entorno del estudiante.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "phenomenonStory": "Narración del fenómeno cotidiano situado en la comunidad...",
  "detonatingQuestion": "Pregunta detonadora que abre el tema...",
  "physicalAnalogy": "Analogía intuitiva y disciplinar (80-140 palabras)...",
  "coreExplanation": "Dos párrafos conceptuales + ejemplo resuelto paso a paso + tabla de contraste...",
  "iDoDemo": "Tutorial modelado paso a paso...",
  "weDoPractice": "Práctica colaborativa con problema real y datos concretos...",
  "youDoChallenge": "Desafío individual con espacios de trabajo...",
  "formativeCheckpoint": {
    "question": "Pregunta de verificación...",
    "reflectionPrompts": ["¿Qué concepto aplicaste?", "¿Dónde lo observas en tu comunidad?"],
    "criteriaChecklist": ["Explica el concepto con tus palabras", "Resuelve un caso con datos nuevos"]
  }${shardingEnabled ? '' : `,\n  "sessionPlans": [ /* EXACTAMENTE ${sessionCount} planes completos (sesiones ${coveredSessions.join(', ')}) según Contrato Canónico V2 */ ]`}
}

${canonicalSessionBlocks}
`;

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
- sessionPlans (${sessionCount} sesiones): OBLIGATORIO redactar las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}), con ~${targetWordsPerPlan} palabras por sesión (total planes: ~${totalPlansTarget} palabras). Respeta íntegramente la estructura y profundidad del Contrato Canónico V2; no comprimas campos ni omitas la solución de las prácticas, el ejemplo resuelto ni sintesisVisual.
- coreExplanation + physicalAnalogy: ~${coreTarget} palabras (explicación formal rigurosa y analogía intuitiva)
- iDoDemo: ~${iDoTarget} palabras (modelado guiado paso a paso que el estudiante sigue)
- weDoPractice: ~${weDoTarget} palabras (práctica guiada colaborativa)
- youDoChallenge: ~${youDoTarget} palabras (reto autónomo escalonado)
${isQuantitative ? `\nGUARDRAIL TERMINOLÓGICO OBLIGATORIO:\n- Queda estrictamente PROHIBIDO usar 'balanza romana' o 'báscula de dos platillos'.\n- Usa exclusivamente instrumental y terminología contemporánea (báscula digital, balanza analítica, balanza algebraica).\n` : ''}
Redacta la Misión de Fundamentación e Intuición completa con máxima profundidad:`;

  const useSharding = Boolean(input.scheduler);
  const narrativeMaxTokens = useSharding ? 8192 : 16384;
  const narrativeTimeoutMs = useSharding ? 75000 : 85000;
  const effectiveSystemInstruction = systemInstruction;
  const basePrompt = useSharding
    ? prompt.replace(/- sessionPlans[^\n]*\n/, '')
    : prompt;
  const effectivePrompt = input.institutionalContext
    ? `${input.institutionalContext}\n\n${basePrompt}`
    : basePrompt;

  try {
    let attempt: 1 | 2 = 1;
    const remainingBudgetMs = resolveRemainingBudgetMs(input.budgetDeadlineMs);
    const shardedPromise = useSharding ? generateShardedSessionPlans(shardCtx) : null;
    shardedPromise?.catch(() => undefined);
    const rawResponse = await runScheduled(input.scheduler, 'foundation:narrative', () =>
      generateWithRotation(
        effectiveSystemInstruction,
        effectivePrompt,
        input.planning.teacherId,
        false,
        {
          jsonMode: true,
          maxTokens: narrativeMaxTokens,
          timeoutMs: narrativeTimeoutMs,
          remainingBudgetMs,
          signal: input.signal,
        }
      )
    );
    let parsed = robustJsonParse(rawResponse);

    // Validación de extensión mínima calibrada según el presupuesto
    const coreWords = (parsed.coreExplanation || '').split(/\s+/).filter(Boolean).length;
    const minCoreWords = Math.min(400, Math.max(150, Math.round(coreTarget * 0.5)));
    if (coreWords < minCoreWords) {
      attempt = 2;
      logger.warn(`[FoundationWriter] coreExplanation tiene solo ${coreWords} palabras (< ${minCoreWords}). Reintentando con instrucción estricta...`);
      try {
        const retryPrompt = `${effectivePrompt}\n\n[REQUISITO CRÍTICO DE PROFUNDIDAD]: Tu respuesta anterior fue insuficiente (${coreWords} palabras en coreExplanation). Redacta OBLIGATORIAMENTE un 'coreExplanation' de MÍNIMO ${minCoreWords} palabras con al menos dos párrafos explicativos extensos, desarrollando paso a paso la fundamentación formal y disciplinar del concepto sin resumir.`;
        const retryResponse = await runScheduled(input.scheduler, 'foundation:narrative-retry', () =>
          generateWithRotation(
            effectiveSystemInstruction,
            retryPrompt,
            input.planning.teacherId,
            false,
            {
              jsonMode: true,
              maxTokens: narrativeMaxTokens,
              timeoutMs: narrativeTimeoutMs,
              remainingBudgetMs: resolveRemainingBudgetMs(input.budgetDeadlineMs),
              signal: input.signal,
            }
          )
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
        const correctivePrompt = `${effectivePrompt}\n\n[REQUISITO CRÍTICO DE TERMINOLOGÍA - CORRECTIVE RETRY]: Tu respuesta previa contenía términos obsoletos prohibidos (${terminologyLint.forbiddenMatches.join(', ')}). Es ESTRICTAMENTE OBLIGATORIO eliminar cualquier mención a 'balanza romana' o 'báscula de dos platillos' y sustituirlas por balanza de precisión analítica, báscula digital de laboratorio o balanza algebraica contemporánea.`;
        const correctiveResponse = await runScheduled(input.scheduler, 'foundation:terminology-retry', () =>
          generateWithRotation(
            effectiveSystemInstruction,
            correctivePrompt,
            input.planning.teacherId,
            false,
            {
              jsonMode: true,
              maxTokens: narrativeMaxTokens,
              remainingBudgetMs: resolveRemainingBudgetMs(input.budgetDeadlineMs),
              signal: input.signal,
            }
          )
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
          instruction: 'Completa la tabla comparando la analogía cotidiana con el concepto formal:',
          config: {
            cols: ['Elemento Cotidiano', 'Concepto Formal', 'Función en el Caso'],
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
    const sessionPlans = shardedPromise
      ? (await shardedPromise).plans
      : completeSessionPlans(parsed.sessionPlans, coveredSessions, fallbackContext);
    const sessionPlansWords = sessionPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
    const totalMissionWords = sectionWordCount + sessionPlansWords;

    const phenomenonHook = resolvePhenomenonHook({
      uacName: input.uacName,
      paecContext: input.paecContext,
      sessionPlans,
      objective: parsed.coreExplanation,
      phenomenonStory: parsed.phenomenonStory,
      detonatingQuestion: parsed.detonatingQuestion,
    });
    const conceptZero = resolveConceptZero({
      uacName: input.uacName,
      paecContext: input.paecContext,
      sessionPlans,
      objective: parsed.coreExplanation,
      physicalAnalogy: parsed.physicalAnalogy,
      coreExplanation: parsed.coreExplanation,
    });
    const checkpoint = resolveCheckpoint({
      uacName: input.uacName,
      paecContext: input.paecContext,
      sessionPlans,
      objective: parsed.coreExplanation,
      checkpointQuestion: parsed.formativeCheckpoint?.question,
      criteriaChecklist: parsed.formativeCheckpoint?.criteriaChecklist,
    });

    const missionSection: MissionSection = {
      missionIndex: foundationMission?.missionIndex || 1,
      title: missionTitle,
      coveredSessions,
      sessionTopic: foundationMission?.sessionTopic || 'Fundamentos',
      sessionFocus: foundationMission?.focus || 'Concepto Cero y Andamiaje',
      phenomenonHook,
      conceptZero,
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
        ...checkpoint,
        reflectionPrompts: parsed.formativeCheckpoint?.reflectionPrompts || [],
      },
      sessionPlans,
      wordCount: totalMissionWords,
    };

    assertNoGenericContent(missionSection, `FoundationWriter · ${missionTitle}`);

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
    logger.error('[generateFoundationMission] Error sin fallback sintético:', err);
    throw err;
  }
}
