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
  type SessionShardContext,
} from './session-shard';
import { logger } from '@/lib/logger';
import { countSessionPlanWords } from '../content-budget';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
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
  const practiceLabel = discipline.id === 'pensamiento_matematico'
    ? 'práctica de modelación y resolución'
    : /artes|lengua|humanidades|conciencia/.test(discipline.id)
      ? 'taller de producción y análisis'
      : 'práctica disciplinar';
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
  const targetWordsPerPlan = Math.max(900, Math.round((input.targetWords.ideal / sessionCount) * 0.78));
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
  const systemInstruction = `Eres AUTOR DE LIBRO DE TEXTO práctico para estudiantes de Bachillerato en Puebla (MCCEMS), especialista en ${discipline.displayName}.
Tu tarea es redactar la misión de ${practiceLabel} ("${missionTitle}") de un LIBRO PARA EL ESTUDIANTE, NO una guía para el docente: el estudiante debe poder realizar la actividad SOLO, leyendo el libro, sin que el maestro esté presente.
UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).
Equipo, recursos o instrumentos pertinentes: ${equipmentHint || 'los recursos propios de la disciplina'}.
${planningAlignmentChunk}
${seedPromptChunk}

REGLAS DE VOZ (CRÍTICO — el libro es del ESTUDIANTE):
- Escribe SIEMPRE en segunda persona dirigida al estudiante ("tú", "vas a realizar", "tu cuaderno", "observa", "registra").
- PROHIBIDO usar etiquetas "Docente:" o "Estudiante:", y verbos de instrucción al maestro ("activar el interés", "exponer y problematizar", "verificar comprensión", "orientar el avance"). Eso va en el plan de clase, NO en el libro.
- El contenido debe ser REAL y AUTODIDACTA: procedimientos, fórmulas, tabla de datos, ejemplos con NÚMEROS y ejercicios con datos concretos. Un estudiante que lee el libro realiza la práctica y aprende.

DIRECTIVAS TÉCNICAS Y METAS DE EXTENSIÓN:
1. Objetivo y Materiales: Formulación rigurosa y lista de recursos pertinentes con casilla de verificación [✓].
2. Procedimiento paso a paso (400 a 600 palabras, 8-12 pasos): Explicación de cada paso con espacios <!--workbook:lines:rows=3--> o tablas.
3. Tabla o formato de registro: Encabezados descriptivos con <!--workbook:table:cols=Parámetro,Referencia,Registro 1,Registro 2,Observaciones,Unidad-->.
4. Código, protocolo o producto (300 a 500 palabras): Bloques de código reales y comentados en BT; protocolo, análisis o producto disciplinar en BGE, según corresponda a ${discipline.displayName}.
5. Reto autónomo ("Tú Haces" - 200 a 350 palabras): EXACTAMENTE 5 a 7 PASOS NUMERADOS con variables cuantitativas y vinculación PAEC: "${input.paecContext}". OBLIGATORIO: anclar cada paso a una aplicación real en la vida diaria del estudiante o su comunidad en Puebla (no ejercicios abstractos); el estudiante debe percibir para qué le sirve en la práctica.
6. Contenido por sesión para el ESTUDIANTE (OBLIGATORIO — genera un "plan" por cada sesión de ${coveredSessions.join(', ')}, ~950 a 1,150 palabras por plan):
   Para CADA sesión asignada (${coveredSessions.join(', ')}) genera un objeto en "sessionPlans". NUNCA omitas ninguna sesión ni uses resúmenes telegráficos. Cada objeto es material que el estudiante LEE para aprender de forma autodidacta:
   (a) objetivo: "Lo que vas a aprender" (1-2 frases en voz de estudiante);
   (b) motivacion: (80 a 120 palabras) caso real de la comunidad o PAEC contado al estudiante;
   (c) saberesPrevios: (50 a 80 palabras) qué ya sabe y preguntas diagnósticas;
   (d) contenido: (OBLIGATORIO MÍNIMO 440 A 520 PALABRAS) LA TEORÍA REAL en 3 párrafos formales separados por saltos de línea (\n\n): definiciones, fórmulas y procedimiento de taller/laboratorio explicado con rigor conceptual (al menos 150 palabras por párrafo). PROHIBIDO redactar menos de 440 palabras en contenido;
   (e) ejemploResuelto: (OBLIGATORIO MÍNIMO 300 A 360 PALABRAS) ejemplo numérico/experimental paso a paso con datos de laboratorio, sustitución y cálculos en 4 pasos numerados (Planteamiento, Paso 1 Datos, Paso 2 Ecuación, Paso 3 Operaciones, Paso 4 Conclusión). PROHIBIDO redactar menos de 300 palabras en ejemploResuelto;
   (f) practica: 2 ejercicios/tareas concretas con datos; enunciados detallados (mínimo 60 palabras cada uno) con "pista" (mínimo 30 palabras) y "solucion" con 3-6 pasos numerados;
   (g) aplicacion: (80 a 120 palabras) tarea aplicada al entorno real o comunitario;
   (h) autoevaluacion: 2-3 preguntas de autorevisión;
   (i) recursos: 1-2 enlaces reales a video o web de ampliación;
   (j) productoIntegrador: (60 a 90 palabras) qué agrega el estudiante a su proyecto hoy.
   Los planes deben VARIAR entre sesiones y ser específicos del contexto PAEC/comunidad. VOZ DE ESTUDIANTE en todo.
7. Preguntas y Casos de Error: 4-6 preguntas analíticas amplias y al menos 3 casos de fallo (Síntoma → Causa → Solución → Prevención).
8. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "phenomenonHook": {
    "story": "Caso real de la comunidad o del taller que detona la práctica (2-4 frases, con datos del PAEC)...",
    "detonatingQuestion": "Pregunta que confronta el error conceptual o la decisión técnica central de la práctica..."
  },
  "conceptZero": {
    "physicalAnalogy": "Analogía física o cotidiana ESPECÍFICA de esta práctica (no una frase genérica)...",
    "coreExplanation": "Explicación conceptual central que el estudiante debe construir..."
  },
  "formativeCheckpoint": {
    "question": "Pregunta de verificación de comprensión propia de esta práctica...",
    "criteriaChecklist": ["Criterio de auto-verificación específico 1", "Criterio específico 2"]
  },
  "labTitle": "Título oficial de la práctica...",
  "objective": "Objetivo claro y contundente...",
  "materialsList": ["✓ Insumo / Herramienta 1", "✓ Software / Equipo 2"],
  "stepByStepProcedure": "1. Paso uno con explicación técnica...\\n<!--workbook:lines:rows=3-->\\n2. Paso dos...",
  "dataTableColumns": ["Parámetro", "Referencia", "Registro 1", "Registro 2", "Observaciones", "Unidad"],
  "executableCodeOrProtocol": "Código, protocolo, análisis o producto completo según la disciplina...",
  "autonomousChallenge": "1. Paso uno con instrucción clara...\\n2. Paso dos...\\n3. Paso tres...\\n4. Paso cuatro...\\n5. Paso cinco...",
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
  ],
  "sessionPlans": [
    {
      "sessionNumber": 3,
      "objetivo": "Lo que vas a aprender en la sesión 3 (1-2 frases)...",
      "motivacion": "Caso real / historia contada al estudiante...",
      "saberesPrevios": "Qué ya sabes que conecta con esto...",
      "contenido": "Párrafo 1: En esta sesión aprenderás las bases conceptuales...\\n\\nPárrafo 2: El procedimiento analítico formal requiere...\\n\\nPárrafo 3: Las restricciones prácticas en el entorno comunitario son...",
      "ejemploResuelto": "Planteamiento: Se monitorea la magnitud...\\nPaso 1: Variables...\\nPaso 2: Ecuación y sustitución...\\nPaso 3: Cálculo...\\nPaso 4: Conclusión e impacto...",
      "practica": [
        { "enunciado": "Ejercicio 1 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: sustituir los datos medidos...", "Paso 2: operar y despejar...", "Respuesta final: ..."] },
        { "enunciado": "Ejercicio 2 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: ...", "Respuesta final: ..."] }
      ],
      "aplicacion": "Aplicación a la vida real del estudiante...",
      "autoevaluacion": ["¿Puedo explicar el procedimiento?", "¿Logré la práctica sin mirar?"],
      "recursos": [
        { "titulo": "Simulaciones y laboratorio virtual", "url": "https://phet.colorado.edu/es/", "tipo": "web" },
        { "titulo": "Práctica guiada y ejercicios", "url": "https://www.khanacademy.org/", "tipo": "video" }
      ],
      "productoIntegrador": "Qué agregas hoy a tu producto integrador..."
    }
  ]
}`;

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
- sessionPlans (${sessionCount} sesiones): OBLIGATORIO redactar las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}), con ~${targetWordsPerPlan} palabras por sesión (total planes: ~${totalPlansTarget} palabras). Cada plan debe contener mínimo 440 a 500 palabras en contenido (3 párrafos extensos de fundamentación y modelación técnica, mínimo 150 palabras por párrafo) y mínimo 300 a 360 palabras en ejemploResuelto (planteamiento concreto y 4 pasos detallados de desarrollo algebraico y numérico).
- stepByStepProcedure: ~${procedureTarget} palabras (redacta 8 a 10 pasos experimentales exhaustivos con parámetros técnicos y mediciones de laboratorio)
- executableCodeOrProtocol: ~${protocolTarget} palabras (código fuente funcional documentado o protocolo experimental riguroso)
- autonomousChallenge: ~${challengeTarget} palabras (OBLIGATORIAMENTE de 5 a 7 pasos numerados correlativos con instrucciones técnicas precisas)
- reflectionQuestions: ~${reflectionTarget} palabras (análisis técnico y transferencia)

Redacta la Misión Práctica de Laboratorio/Taller Y las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}) con máxima profundidad y rigor experimental sin abreviar:`;

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
    const rawResponse = await runScheduled(input.scheduler, 'lab:narrative', () =>
      generateWithRotation(
        effectiveSystemInstruction,
        effectivePrompt,
        input.planning.teacherId,
        false,
        { jsonMode: true, maxTokens: narrativeMaxTokens, timeoutMs: narrativeTimeoutMs, signal: input.signal }
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
            `Tu respuesta anterior tuvo menos de 5 pasos en 'autonomousChallenge'. Redacta OBLIGATORIAMENTE el 'autonomousChallenge' en EXACTAMENTE 5 a 7 PASOS NUMERADOS (Paso 1 al Paso 5, 6 o 7), cada uno con una instrucción cuantitativa clara, variables precisas y acción técnica concreta del estudiante.`
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
              { jsonMode: true, maxTokens: narrativeMaxTokens, timeoutMs: narrativeTimeoutMs, signal: input.signal }
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

    // Si no hay tags en el texto, generar los elementos oficiales de laboratorio
    if (workbookElements.length === 0) {
      const cols = parsed.dataTableColumns && parsed.dataTableColumns.length > 0
        ? parsed.dataTableColumns
        : ['Parámetro', 'Valor Esperado', 'Medición 1', 'Medición 2', 'Unidad'];

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
      symptom: typeof t.symptom === 'string' ? t.symptom : 'Falla en lectura o ejecución',
      rootCause: typeof t.rootCause === 'string' ? t.rootCause : 'Parámetros incorrectos o desconexión',
      solutionSteps: Array.isArray(t.solutionSteps) ? (t.solutionSteps as string[]) : ['Verificar conexiones y reintentar'],
      preventionTip: typeof t.preventionTip === 'string' ? t.preventionTip : 'Revisar manual antes de energizar',
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
        stepByStepDemo: `Protocolo Técnico:\n${cleanStepByStep}`,
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
