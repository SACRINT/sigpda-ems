/**
 * Hands-on Lab & Workshop Mission Writer
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Redacta la misión de práctica y taller del bloque:
 * - Inyección de semillas canónicas si existen para 0 tokens técnicos redundantes.
 * - Procedimiento paso a paso detallado y ejecutable.
 * - Tablas vacías de medición y registro experimental.
 * - Código fuente 100% completo y funcional en BT (cero truncados).
 * - Preguntas de reflexión y conexión con la teoría.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { extractWorkbookTags, consolidateWorkbookElements, stripWorkbookTags } from '../workbook-tags';
import type { MissionSection, WorkbookElement, TroubleshootItem } from '@/types/work-textbook';
import {
  type WriterInput,
  type WriterOutput,
  type FallbackPlanContext,
  evaluateQuality,
  completeSessionPlans,
  resolveRemainingBudgetMs,
} from './writer-contract';
import {
  generateMissingSessionPlans,
  getPresentSessionNumbers,
  mergeSessionPlans,
} from './session-plan-completion';
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

export async function generateLabMission(input: WriterInput): Promise<WriterOutput> {
  const labMission = input.missions.find((m) => m.missionType === 'lab') || input.missions[1] || input.missions[0];
  const coveredSessions = labMission ? labMission.sessionNumbers : [3, 4, 5];
  const missionTitle = labMission ? labMission.title : `Misión 2: Práctica y Aplicación`;
  const discipline = getDisciplinaryAdapter(
    input.uacName,
    input.component,
    input.curriculumName || input.careerOrProgramName
  );
  const equipmentHint = discipline.allowedPhysicalEquipment.slice(0, 4).join(', ');
  const practiceLabel = discipline.practiceSpaceLabel.toLowerCase();
  const fallbackContext: FallbackPlanContext = {
    uacName: input.uacName,
    blockName: input.blockName,
    sessionTopic: labMission?.sessionTopic || 'Práctica disciplinar',
    sessionFocus: labMission?.focus || 'Destrezas prácticas y procedimentales',
    paecContext: input.paecContext,
    subsystem: input.subsystem,
    component: input.component,
    curriculumName: input.curriculumName,
    careerOrProgramName: input.careerOrProgramName,
  };

  const sessionCount = Math.max(1, coveredSessions.length);
  const targetWordsPerPlan = sessionPlanWordTarget(input.targetWords.ideal, sessionCount);
  const shardCtx: SessionShardContext = {
    input,
    missionType: 'lab',
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

  // Construir contexto de semilla canónica si existe
  let seedPromptChunk = '';
  if (input.canonicalSeed) {
    seedPromptChunk = `
BASE DE CONOCIMIENTO (SEMILLA CANÓNICA PRE-VALIDADA):
- Título: ${input.canonicalSeed.content.title}
- Procedimientos: ${input.canonicalSeed.content.procedures.join('; ')}
- Materiales: ${input.canonicalSeed.content.materials.join(', ')}
- Normativa: ${input.canonicalSeed.content.nomNorms?.join(', ') || 'NOM/ISO'}
- Errores comunes: ${input.canonicalSeed.content.commonErrors?.map((e) => e.symptom).join('; ') || 'Ninguno'}`;
  }

  const requiredTermsChunk = formatRequiredTermsDirective(input.requiredTerms ?? []);
  const planningAlignmentChunk = buildPlanningAlignmentPrompt(
    input.planningActivities,
    'lab',
    input.uacName,
    input.component,
    input.curriculumName,
    input.careerOrProgramName
  ) +
  (requiredTermsChunk ? `\n${requiredTermsChunk}\n` : '') +
  (input.alignmentDirective ? ` 
ALINEACION DURA — TERMINOS OBLIGATORIOS DE LA PLANEACION (reproduce su redaccion original en tu seccion): ` + input.alignmentDirective + ` 
 ` : '');

  // NOTA DE DISEÑO (F-06): materialsList de manuales no se tokeniza; los renderers strippan defensivamente.
  const canonicalSessionContract = buildCanonicalSessionPlanInstructions(discipline, 'lab', {
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

  const tableColsList = discipline.defaultTableColumns.join(',');
  const tableColsJson = JSON.stringify(discipline.defaultTableColumns);
  const systemInstruction = `Eres AUTOR DE LIBRO DE TEXTO práctico para estudiantes de Bachillerato en Puebla (MCCEMS), especialista en ${discipline.displayName}.
Tu tarea es redactar la misión de ${practiceLabel} ("${missionTitle}") de un LIBRO PARA EL ESTUDIANTE, NO una guía para el docente: el estudiante debe poder realizar la actividad SOLO, leyendo el libro, sin que el maestro esté presente.
UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Equipo, recursos o instrumentos pertinentes: ${equipmentHint || 'los recursos propios de la disciplina'}.
${planningAlignmentChunk}
${seedPromptChunk}
FAMILIA EPISTEMOLÓGICA: ${discipline.family}.
TABLA CANÓNICA DE REGISTRO: ${discipline.defaultTableColumns.join(', ')}.
DIRECTIVA DEL EJEMPLO RESUELTO: ${discipline.workedExampleDirective}

REGLAS DE VOZ (CRÍTICO — el libro es del ESTUDIANTE):
- Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "vas a realizar", "tu cuaderno", "observa", "registra").
- PROHIBIDO usar etiquetas "Docente:" o "Estudiante:", y verbos de instrucción al maestro ("activar el interés", "exponer y problematizar", "verificar comprensión", "orientar el avance"). Eso va en el plan de clase, NO en el libro.
- El contenido debe ser REAL y AUTODIDACTA: procedimientos, criterios o fórmulas, tablas de registro, ejemplos y ejercicios con datos concretos. Un estudiante que lee el libro realiza la actividad y aprende.

DIRECTIVAS TÉCNICAS Y METAS DE EXTENSIÓN:
1. Objetivo y Materiales: Formulación rigurosa y lista de recursos pertinentes con casilla de verificación [✓]: ${equipmentHint || 'los recursos propios de la disciplina'}.
2. Procedimiento paso a paso (400 a 600 palabras, 8-12 pasos): Explicación de cada paso con espacios <!--workbook:lines:rows=3--> o tablas.
3. Tabla o formato de registro: Encabezados propios de ${discipline.displayName} con <!--workbook:table:cols=${tableColsList}-->.
4. Código, protocolo o producto (300 a 500 palabras): Bloques de código reales y comentados en BT; protocolo, análisis o producto disciplinar en BGE, según corresponda a ${discipline.displayName}.
5. Reto autónomo ("Tú Haces" - 200 a 350 palabras): EXACTAMENTE 5 a 7 PASOS NUMERADOS con variables o criterios concretos y vinculación PAEC: "${input.paecContext}". OBLIGATORIO: anclar cada paso a una aplicación real en la vida diaria del estudiante o su comunidad en Puebla (no ejercicios abstractos); el estudiante debe percibir para qué le sirve en la práctica.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "phenomenonHook": {
    "story": "Narración del fenómeno cotidiano situado en la comunidad...",
    "detonatingQuestion": "Pregunta detonadora que abre el tema..."
  },
  "conceptZero": {
    "physicalAnalogy": "Analogía intuitiva y disciplinar (80-140 palabras)...",
    "coreExplanation": "Explicación conceptual rigurosa con ejemplo resuelto paso a paso y datos concretos..."
  },
  "formativeCheckpoint": {
    "question": "Pregunta de verificación del procedimiento...",
    "criteriaChecklist": ["Explica el procedimiento con tus palabras", "Ejecuta la práctica con datos nuevos"]
  },
  "labTitle": "Título oficial de la práctica...",
  "objective": "Objetivo claro y contundente...",
  "materialsList": ["✓ Insumo / Herramienta 1", "✓ Software / Equipo 2"],
  "stepByStepProcedure": "1. Paso uno con explicación disciplinar...\\n<!--workbook:lines:rows=3-->\\n2. Paso dos...",
  "dataTableColumns": ${tableColsJson},
  "executableCodeOrProtocol": "Código, protocolo, análisis o producto completo según la disciplina...",
  "autonomousChallenge": "1. Paso uno...\\n2. Paso dos...\\n3. Paso tres...\\n4. Paso cuatro...\\n5. Paso cinco...",
  "reflectionQuestions": [
    "¿Qué relación observaste entre las variables o categorías de la actividad?",
    "¿Cómo aplicarías este procedimiento para resolver un problema en tu comunidad?"
  ],
  "quickTroubleshooting": [
    {
      "symptom": "Síntoma visible de error...",
      "rootCause": "Causa técnica...",
      "solutionSteps": ["Solución directa paso a paso."],
      "preventionTip": "Acción preventiva para evitarlo."
    }
  ]${shardingEnabled ? '' : `,\n  "sessionPlans": [ /* EXACTAMENTE ${sessionCount} planes completos (sesiones ${coveredSessions.join(', ')}) según Contrato Canónico V2 */ ]`}
}

${canonicalSessionBlocks}
`;

  const totalPlansTarget = sessionCount * targetWordsPerPlan;
  const remainingNarrativeTarget = Math.max(300, input.targetWords.ideal - totalPlansTarget);

  const procedureTarget = Math.round(remainingNarrativeTarget * 0.45);
  const protocolTarget = Math.round(remainingNarrativeTarget * 0.25);
  const challengeTarget = Math.round(remainingNarrativeTarget * 0.15);
  const reflectionTarget = Math.round(remainingNarrativeTarget * 0.15);

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Misión: ${missionTitle}
Sesiones asignadas: Sesiones ${coveredSessions.join(', ')} (${sessionCount} sesiones)
Problemática PAEC: ${input.paecContext}
Presupuesto total para esta misión: mínimo ${input.targetWords.min} palabras (ideal ~${input.targetWords.ideal} palabras).

DISTRIBUCIÓN CALIBRADA DE PALABRAS:
- sessionPlans (${sessionCount} sesiones): OBLIGATORIO redactar las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}), con ~${targetWordsPerPlan} palabras por sesión (total planes: ~${totalPlansTarget} palabras). Respeta íntegramente la estructura y profundidad del Contrato Canónico V2; no comprimas campos ni omitas la solución de las prácticas, el ejemplo resuelto ni sintesisVisual.
- stepByStepProcedure: ~${procedureTarget} palabras (redacta 8 a 10 pasos detallados con criterios, parámetros o evidencias propios de ${discipline.displayName})
- executableCodeOrProtocol: ~${protocolTarget} palabras (${discipline.family === 'computacional_algoritmica' ? 'código fuente funcional documentado y prueba de escritorio' : discipline.family === 'humanistica_comunicativa_social' ? 'guía analítica, matriz o producto textual disciplinar completo' : 'protocolo o procedimiento riguroso de la disciplina'})
- autonomousChallenge: ~${challengeTarget} palabras (OBLIGATORIAMENTE de 5 a 7 pasos numerados correlativos con instrucciones claras y contextualizadas)
- reflectionQuestions: ~${reflectionTarget} palabras (análisis reflexivo y transferencia situada)

Redacta la Misión Práctica (${discipline.practiceSpaceLabel}) Y las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}) con máxima profundidad y rigor disciplinar sin abreviar:`;

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
    const rawResponse = await runScheduled(input.scheduler, 'lab:narrative', () =>
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

    // Validación de extensión mínima y cobertura total de sesiones (MEJORA 1)
    const challengeText = typeof parsed.autonomousChallenge === 'string' ? parsed.autonomousChallenge : '';
    const stepMatches = challengeText.match(/(?:Paso\s*\d+|\b\d+[\.\)])/gi) || [];
    const stepCount = stepMatches.length;
    const planCount = Array.isArray(parsed.sessionPlans) ? parsed.sessionPlans.length : 0;
    const missingPlans = !useSharding && planCount < coveredSessions.length;

    if (stepCount < 5 || missingPlans) {
      attempt = 2;
      logger.warn(
        `[LabWriter] autonomousChallenge=${stepCount} pasos (<5: ${stepCount < 5}) o sessionPlans=${planCount}/${coveredSessions.length}. Reintentando con instrucción estricta...`
      );
      let retryStepCount = stepCount;
      let retryPlanCount = planCount;
      for (let retry = 0; retry < 2; retry++) {
        if (input.signal?.aborted) break;
        const strictDirectives: string[] = [];
        if (retryStepCount < 5) {
          strictDirectives.push(
            discipline.requiresQuantitativeData
              ? `Tu respuesta anterior tuvo menos de 5 pasos en 'autonomousChallenge'. Redacta OBLIGATORIAMENTE el 'autonomousChallenge' en EXACTAMENTE 5 a 7 PASOS NUMERADOS (Paso 1 al Paso 5, 6 o 7), cada uno con una instrucción cuantitativa clara, variables precisas y acción concreta del estudiante.`
              : `Tu respuesta anterior tuvo menos de 5 pasos en 'autonomousChallenge'. Redacta OBLIGATORIAMENTE el 'autonomousChallenge' en EXACTAMENTE 5 a 7 PASOS NUMERADOS (Paso 1 al Paso 5, 6 o 7), cada uno con una instrucción concreta, criterios observables y acción clara del estudiante.`
          );
        }
        if (!useSharding && retryPlanCount < coveredSessions.length) {
          strictDirectives.push(
            `Tu respuesta anterior solo incluyó ${retryPlanCount} de ${coveredSessions.length} planes en 'sessionPlans'. Genera OBLIGATORIAMENTE UN plan por cada sesión asignada (${coveredSessions.join(', ')}), es decir EXACTAMENTE ${coveredSessions.length} objetos en 'sessionPlans', cada uno con su "sessionNumber" correcto y contenido real de estudiante (voz en tú). No omitas ninguna sesión.`
          );
        }
        try {
          const retryPrompt = `${effectivePrompt}\n\n[REQUISITO CRÍTICO - REINTENTO OBLIGATORIO]: ${strictDirectives.join(' ')}`;
          const retryResponse = await runScheduled(input.scheduler, `lab:narrative-retry#${retry + 1}`, () =>
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
          const retryText =
            typeof retryParsed.autonomousChallenge === 'string' ? retryParsed.autonomousChallenge : '';
          const retryMatches = retryText.match(/(?:Paso\s*\d+|\b\d+[\.\)])/gi) || [];
          const nextStepCount = retryMatches.length;
          const nextPlanCount = Array.isArray(retryParsed.sessionPlans)
            ? retryParsed.sessionPlans.length
            : 0;
          if (useSharding ? nextStepCount >= 5 : nextPlanCount >= coveredSessions.length) {
            parsed = {
              ...parsed,
              ...(useSharding ? {} : { sessionPlans: retryParsed.sessionPlans }),
              autonomousChallenge:
                nextStepCount >= retryStepCount ? retryText || parsed.autonomousChallenge : parsed.autonomousChallenge,
            };
            break;
          }
          retryStepCount = nextStepCount;
          retryPlanCount = nextPlanCount;
          logger.warn(
            `[LabWriter] Reintento ${retry + 1} incompleto: sessionPlans=${nextPlanCount}/${coveredSessions.length}.`
          );
        } catch (retryErr) {
          logger.warn('[LabWriter] Error en reintento, preservando primera respuesta:', { error: String(retryErr) });
        }
      }
    }

    // Extraer o generar tags de cuaderno activo
    const materialsText = Array.isArray(parsed.materialsList) ? parsed.materialsList.join(' ') : (parsed.materialsList || '');
    const reflectionsText = Array.isArray(parsed.reflectionQuestions) ? parsed.reflectionQuestions.join(' ') : (parsed.reflectionQuestions || '');
    const troublesText = Array.isArray(parsed.quickTroubleshooting)
      ? parsed.quickTroubleshooting.map((t: Record<string, unknown>) => `${t.symptom || ''} ${t.rootCause || ''} ${Array.isArray(t.solutionSteps) ? t.solutionSteps.join(' ') : (t.solutionSteps || '')} ${t.preventionTip || ''}`).join(' ')
      : '';
    const autonomousChallenge = typeof parsed.autonomousChallenge === 'string' && parsed.autonomousChallenge.trim().length > 30
      ? parsed.autonomousChallenge.trim()
      : `Desafío autónomo individual (Tú Haces):\n1. Prepara el espacio, los recursos y las condiciones iniciales de la actividad.\n2. Realiza la actividad siguiendo los criterios de ${discipline.displayName}.\n3. Registra por duplicado los datos, observaciones o evidencias obtenidas.\n4. Compara tus resultados con los criterios o referentes establecidos.\n5. Evalúa el impacto de la actividad en la solución del reto comunitario PAEC (${input.paecContext}).\n6. Documenta tus conclusiones y presenta la evidencia a tu docente.`;

    const fullText = [
      parsed.objective,
      materialsText,
      parsed.stepByStepProcedure,
      parsed.executableCodeOrProtocol,
      autonomousChallenge,
      reflectionsText,
      troublesText,
    ].filter(Boolean).join(' ');

    let workbookElements: WorkbookElement[] = extractWorkbookTags(`${parsed.stepByStepProcedure || ''}\n${parsed.executableCodeOrProtocol || ''}`).map((t) => t.element);

    // Consolidación de tags consecutivos para evitar redundancia de renglones
    workbookElements = consolidateWorkbookElements(workbookElements);

    // Si no hay tags en el texto, generar los elementos oficiales de la disciplina
    if (workbookElements.length === 0) {
      const cols = parsed.dataTableColumns && parsed.dataTableColumns.length > 0
        ? parsed.dataTableColumns
        : discipline.defaultTableColumns;

      workbookElements = [
        {
          id: 'wb-table-data',
          type: 'data_recording',
          title: 'Hoja de registro y evidencias de la actividad',
          instruction: 'Registra los datos, observaciones o evidencias obtenidas durante el desarrollo de la actividad:',
          config: {
            cols,
            sampleRows: 6,
          },
        },
        {
          id: 'wb-check-safety',
          type: 'checkbox_list',
          title: 'Lista de verificación y calidad del trabajo',
          instruction: 'Marca cada casilla conforme verifiques el cumplimiento de los criterios:',
          config: {
            checkboxes: [
              'Recursos revisados y preparados antes de iniciar.',
              'Condiciones de trabajo y criterios de la disciplina verificados.',
              'Registros u observaciones consignados por duplicado.',
              'Espacio de trabajo ordenado y evidencias resguardadas.',
            ],
          },
        },
      ];

      if (input.subsystem === 'bt') {
        workbookElements.push({
          id: 'wb-code-exec',
          type: 'code_box',
          title: 'Bloque de código y depuración de terminal',
          instruction: 'Escribe el bloque principal de ejecución o comandos de prueba utilizados:',
          config: { rows: 10 },
        });
      }

      workbookElements.push({
        id: 'wb-lab-analysis',
        type: 'lines',
        title: 'Análisis Crítico de Resultados y Conclusiones Técnicas',
        instruction: 'Anota tus deducciones individuales, balance de errores y cómo este conocimiento beneficia a la comunidad:',
        config: { rows: 6 },
      });
    }

    // Limpieza de etiquetas de control <!--workbook:...--> de los textos de protocolo
    const cleanStepByStep = stripWorkbookTags(parsed.stepByStepProcedure || 'Demostración del docente.');
    const cleanExecutableCode = stripWorkbookTags(parsed.executableCodeOrProtocol || 'Ejecución experimental coordinada.');
    const cleanAutonomousChallenge = stripWorkbookTags(autonomousChallenge);

    const troubles: TroubleshootItem[] = (parsed.quickTroubleshooting || []).map((t: Record<string, unknown>, i: number) => ({
      id: `tb-lab-${i + 1}`,
      symptom: typeof t.symptom === 'string' ? t.symptom : 'Inconsistencia o error durante el desarrollo',
      rootCause: typeof t.rootCause === 'string' ? t.rootCause : 'Omisión de criterios iniciales o datos incompletos',
      solutionSteps: Array.isArray(t.solutionSteps) ? (t.solutionSteps as string[]) : ['Verificar los criterios de la sesión y corregir el paso'],
      preventionTip: typeof t.preventionTip === 'string' ? t.preventionTip : 'Revisar las instrucciones y parámetros antes de continuar',
    }));

    const sectionWordCount = fullText.split(/\s+/).filter(Boolean).length;
    let sessionPlans;
    if (shardedPromise) {
      sessionPlans = (await shardedPromise).plans;
    } else {
      const currentPlans = Array.isArray(parsed.sessionPlans) ? (parsed.sessionPlans as unknown[]) : [];
      const presentSessions = getPresentSessionNumbers(currentPlans);
      const missingSessions = coveredSessions.filter((sessionNumber) => !presentSessions.has(sessionNumber));
      if (missingSessions.length > 0) {
        try {
          const generated = await generateMissingSessionPlans({
            missionType: 'lab',
            uacName: input.uacName,
            blockName: input.blockName,
            subsystem: input.subsystem,
            component: input.component,
            curriculumName: input.curriculumName,
            careerOrProgramName: input.careerOrProgramName,
            coveredSessions,
            missingSessions,
            existingPlans: currentPlans,
            teacherId: input.planning.teacherId,
            signal: input.signal,
          });
          parsed.sessionPlans = mergeSessionPlans(currentPlans, generated, coveredSessions);
        } catch (err) {
          logger.warn('[LabWriter] No se pudieron completar las sesiones faltantes:', { error: String(err) });
        }
      }
      sessionPlans = completeSessionPlans(parsed.sessionPlans, coveredSessions, fallbackContext);
    }
    const sessionPlansWords = sessionPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
    const totalMissionWords = sectionWordCount + sessionPlansWords;

    const phenomenonHook = resolvePhenomenonHook({
      uacName: input.uacName,
      paecContext: input.paecContext,
      sessionPlans,
      objective: parsed.objective,
      phenomenonStory: parsed?.phenomenonHook?.story,
      detonatingQuestion: parsed?.phenomenonHook?.detonatingQuestion,
    });
    const conceptZero = resolveConceptZero({
      uacName: input.uacName,
      paecContext: input.paecContext,
      sessionPlans,
      objective: parsed.objective,
      physicalAnalogy: parsed?.conceptZero?.physicalAnalogy,
      coreExplanation: parsed?.conceptZero?.coreExplanation,
    });
    const checkpoint = resolveCheckpoint({
      uacName: input.uacName,
      paecContext: input.paecContext,
      sessionPlans,
      objective: parsed.objective,
      checkpointQuestion: parsed?.formativeCheckpoint?.question,
      criteriaChecklist: parsed?.formativeCheckpoint?.criteriaChecklist,
    });

    const missionSection: MissionSection = {
      missionIndex: labMission?.missionIndex || 2,
      title: missionTitle,
      coveredSessions,
      sessionTopic: labMission?.sessionTopic || 'Práctica disciplinar',
      sessionFocus: labMission?.focus || 'Destrezas prácticas y procedimentales',
      phenomenonHook,
      conceptZero,
      iDoSection: {
        stepByStepDemo: `${discipline.family === 'humanistica_comunicativa_social' ? 'Guía Paso a Paso' : 'Protocolo Técnico'}:\n${cleanStepByStep}`,
      },
      weDoSection: {
        guidedPractice: `Desarrollo guiado en equipo:\n${cleanExecutableCode}`,
        workbookElements: [workbookElements[0], workbookElements[1]].filter(Boolean),
      },
      youDoSection: {
        autonomousChallenge: cleanAutonomousChallenge,
        workbookElements: workbookElements.slice(2).length > 0 ? workbookElements.slice(2) : [
          {
            id: 'wb-lab-analysis-fallback',
            type: 'lines',
            title: 'Análisis Crítico de Resultados y Transferencia',
            instruction: 'Redacta tus observaciones y conclusiones autónomas:',
            config: { rows: 6 },
          },
        ],
      },
      troubleshooting: troubles,
      formativeCheckpoint: {
        ...checkpoint,
        reflectionPrompts: parsed.reflectionQuestions || [],
      },
      sessionPlans,
      wordCount: totalMissionWords,
    };

    assertNoGenericContent(missionSection, `LabWriter · ${missionTitle}`);

    const quality = evaluateQuality({
      wordCount: totalMissionWords,
      targetWords: input.targetWords,
      content: fullText,
      subsystem: input.subsystem,
      workbookElementsCount: workbookElements.length,
    });

    if (attempt === 1) {
      logger.info(`[LabWriter] ✅ Generado en intento 1 — ${totalMissionWords} palabras (${sectionWordCount} sección + ${sessionPlansWords} sesiones)`);
    } else {
      logger.info(`[LabWriter] ⚠️ Reintento necesario — ${totalMissionWords} palabras en intento 2`);
    }

    return {
      type: 'lab',
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
    logger.error('[generateLabMission] Error sin fallback sintético:', err);
    throw err;
  }
}
