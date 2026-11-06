/**
 * Real Project / Artifact Mission Writer
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Redacta la misión de desarrollo del Producto / Proyecto Integrador:
 * - Nombre motivador y situado del proyecto.
 * - Descripción del producto o evidencia útil para la vida diaria, la comunidad o el perfil formativo.
 * - Fases de desarrollo sesión por sesión con entregables verificables.
 * - Criterios de aceptación técnica y calidad.
 * - Espacios de trabajo para diagramación, bitácora y portafolio de evidencias.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import type { MissionSection, ProjectSection, WorkbookElement } from '@/types/work-textbook';
import {
  type WriterInput,
  type WriterOutput,
  type FallbackPlanContext,
  evaluateQuality,
  completeSessionPlans,
} from './writer-contract';
import { buildPlanningAlignmentPrompt } from './planning-alignment-prompt';
import { logger } from '@/lib/logger';
import { countSessionPlanWords } from '../content-budget';
import {
  buildMaterialSlugIndex,
  getMaterialCategoriesForContext,
  MATERIAL_INDEX_MAX_CHARS,
} from '@/lib/materials/slug-index';
import { autoTokenizeMaterials } from '@/lib/materials/auto-tokenize';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';

export async function generateProjectMission(input: WriterInput): Promise<WriterOutput> {
  const projectMission = input.missions.find((m) => m.missionType === 'project') || input.missions[input.missions.length - 2] || input.missions[0];
  const coveredSessions = projectMission
    ? projectMission.sessionNumbers
    : [Math.max(1, input.sessions.length - 3), Math.max(2, input.sessions.length - 2)];
  const missionTitle = projectMission ? projectMission.title : `Misión 3: Proyecto Integrador`;
  const discipline = getDisciplinaryAdapter(
    input.uacName,
    input.component,
    input.curriculumName || input.careerOrProgramName
  );
  const equipmentHint = discipline.allowedPhysicalEquipment.slice(0, 4).join(', ') || 'recursos pertinentes de la disciplina';
  const fallbackContext: FallbackPlanContext = {
    uacName: input.uacName,
    blockName: input.blockName,
    sessionTopic: projectMission?.sessionTopic || 'Proyecto integrador',
    sessionFocus: projectMission?.focus || 'Desarrollo del producto e integración socioproductiva',
    paecContext: input.paecContext,
    subsystem: input.subsystem,
    component: input.component,
    curriculumName: input.curriculumName,
    careerOrProgramName: input.careerOrProgramName,
  };

  const planningAlignmentChunk = buildPlanningAlignmentPrompt(
    input.planningActivities,
    'project',
    input.uacName,
    input.component,
    input.curriculumName,
    input.careerOrProgramName
  ) +
  (input.alignmentDirective ? ` 
ALINEACION DURA — TERMINOS OBLIGATORIOS DE LA PLANEACION (reproduce su redaccion original en tu seccion): ` + input.alignmentDirective + ` 
 ` : '');

  const systemInstruction = `Eres un diseñador pedagógico y director de proyectos formativos para Educación Media Superior en Puebla (MCCEMS).
Tu tarea es redactar la misión cumbre del bloque: el desarrollo de un producto, proyecto o evidencia integradora para la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}), dentro de ${discipline.displayName}.
${planningAlignmentChunk}

DIRECTIVAS DEL PROYECTO Y METAS FORMATIVAS:
1. Producto o proyecto real: resultado auténtico y útil para la vida diaria, la comunidad o el perfil formativo (no un mero resumen). Usa como referencia recursos propios de la disciplina: ${equipmentHint}.
2. Utilidad Comunitaria (300 a 500 palabras): Vinculación profunda con la problemática PAEC: "${input.paecContext}", justificando beneficiarios e impacto.
3. Objetivos y Materiales: 3 a 5 learningObjectives de orden superior y lista detallada de requiredMaterials con especificaciones. Cada requiredMaterials que corresponda a un instrumento/herramienta/insumo del INDICE DE MATERIALES debe escribirse como token normativo [[material:slug]] o [[material:slug|etiqueta con especificación]] usando SOLO slugs de ese índice (prohibido inventar slugs o URLs); los materiales fuera del índice van en texto plano.
4. Fases y Pasos (400 a 600 palabras en total): 6 a 8 executionSteps secuenciales y 3 a 5 phases con entregables verificables e instrucciones detalladas.
5. Criterios de Entrega y Aceptación: 4 a 6 deliveryCriteria formales y acceptanceCriteria medibles con normas NOM/ISO.
6. Bitácora de Registro: registrationFormat estructurado con campos de sesión, parámetros, incidencias, firmas y sellos.
7. Rúbrica y Desafío Autónomo: Rúbrica en 4 niveles NEM (Excelente 10-9, Bueno 8-7, Suficiente 6-5, Insuficiente 4-1) y reto autónomo de campo (You Do - 200-350 palabras).
8. Contenido por sesión para el ESTUDIANTE (OBLIGATORIO — genera un "plan" por cada sesión de ${coveredSessions.join(', ')}, ~950 a 1,150 palabras por plan):
   Para CADA sesión asignada (${coveredSessions.join(', ')}) genera un objeto en "sessionPlans". NUNCA omitas ninguna sesión ni uses resúmenes telegráficos. Cada objeto es material que el estudiante LEE para aprender de forma autodidacta:
   (a) objetivo: "Lo que vas a aprender" (1-2 frases en voz de estudiante);
   (b) motivacion: (80 a 120 palabras) caso o necesidad comunitaria PAEC que detona este avance del producto o proyecto;
   (c) saberesPrevios: (50 a 80 palabras) qué fundamentos previos sustentan la etapa actual;
   (d) contenido: (OBLIGATORIO MÍNIMO 440 A 520 PALABRAS) LA TEORÍA REAL de la sesión — especificaciones, criterios, fórmulas o modelos propios de ${discipline.displayName} para la fase de desarrollo en 3 párrafos sustanciales (al menos 150 palabras por párrafo);
   (e) ejemploResuelto: (OBLIGATORIO MÍNIMO 300 A 360 PALABRAS) ejemplo numérico, procedimental o analítico resuelto paso a paso con datos del proyecto en 4 pasos numerados;
   (f) practica: 2 tareas/ejercicios con datos concretos; enunciados detallados (mínimo 60 palabras cada uno) con "pista" (mínimo 30 palabras) y "solucion" con 3-6 pasos numerados;
   (g) aplicacion: (80 a 120 palabras) transferencia a la solución comunitaria real;
   (h) autoevaluacion: 2-3 preguntas reflexivas;
   (i) recursos: 1-2 enlaces de ampliación técnica;
   (j) productoIntegrador: (60 a 90 palabras) avance concreto o evidencia específica del producto/proyecto en esta sesión.
   Cada sesión corresponde a un avance concreto del producto o proyecto: VARIA el contenido entre sesiones y ancla cada una a su fase de desarrollo en el contexto PAEC. VOZ DE ESTUDIANTE en todo.
9. Sintaxis JSON: Usa comillas simples ('...') en código/citas. Cero comillas dobles sin escapar dentro de valores JSON.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "artifactName": "Nombre motivador y descriptivo del producto o proyecto...",
  "communityUtility": "Descripción extensa de utilidad comunitaria e impacto...",
  "learningObjectives": [
    "Diseñar la propuesta o producto de la disciplina...",
    "Desarrollar y verificar la evidencia o producto...",
    "Validar el impacto comunitario en el entorno PAEC..."
  ],
  "requiredMaterials": [
    "Insumo o herramienta específica de ${input.uacName} con especificación técnica",
    "Material de registro y documentación del proyecto"
  ],
  "executionSteps": [
    "1. Planificación y acopio...",
    "2. Diseño o diagramación...",
    "3. Desarrollo o producción...",
    "4. Revisión y pruebas...",
    "5. Integración comunitaria...",
    "6. Documentación final..."
  ],
  "deliveryCriteria": [
    "Producto o evidencia terminado y verificado",
    "Memoria o reporte con esquemas o registros",
    "Bitácora o registro firmado por fase",
    "Presentación ante el grupo"
  ],
  "registrationFormat": "BITÁCORA TÉCNICA DE PROYECTO\\nSemana: [ ] Fecha: [ ] Equipo: [ ]\\nActividad: _________________\\nParámetros: ___________ Error: ______\\nIncidencia: _________________ Solución: _________________\\nFirma Docente: _________ Sello: [ ]",
  "phases": [
    {
      "phaseNum": 1,
      "title": "Fase 1: Diagnóstico técnico y diseño preliminar",
      "allocatedHours": 2,
      "deliverables": ["Lista de insumos", "Boceto"],
      "instructions": "Instrucciones detalladas paso a paso..."
    }
  ],
  "technicalSpecs": ["Especificación técnica 1", "Norma aplicable NOM/ISO"],
  "acceptanceCriteria": [
    "El producto o evidencia cumple la función principal en condiciones normales",
    "Cumple con los criterios de calidad y pertinencia de la disciplina"
  ],
  "autonomousChallenge": "Instrucción y desafío autónomo (Tú Haces) de 200-350 palabras para validación de campo...",
  "rubricSummary": [
    {
      "criterion": "Calidad y Pertinencia del Producto o Evidencia",
      "excellent": "Cumple al 100% los criterios de aceptación.",
      "good": "Cumple los criterios principales con detalles menores.",
      "sufficient": "Cumple de forma básica con asistencia docente.",
      "insufficient": "No cumple las especificaciones mínimas."
    }
  ],
  "sessionPlans": [
    {
      "sessionNumber": 13,
      "objetivo": "Lo que vas a aprender en la sesión 13 (1-2 frases)...",
      "motivacion": "Caso real / historia contada al estudiante...",
      "saberesPrevios": "Qué ya sabes que conecta con esto...",
      "contenido": "Párrafo 1: En esta sesión aprenderás las bases conceptuales y criterios de esta fase del proyecto...\\n\\nPárrafo 2: El desarrollo del producto o evidencia requiere...\\n\\nPárrafo 3: Los criterios de calidad y pertinencia en el entorno comunitario son...",
      "ejemploResuelto": "Planteamiento: Se analiza un caso concreto del proyecto con datos y criterios reales...\\nPaso 1: Identificación de variables, recursos y criterios de entrada...\\nPaso 2: Formulación de la propuesta o modelo...\\nPaso 3: Desarrollo y verificación de resultados...\\nPaso 4: Conclusión y validación del entregable...",
      "practica": [
        { "enunciado": "Ejercicio 1 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: sustituir datos...", "Paso 2: operar y verificar...", "Respuesta final: ..."] },
        { "enunciado": "Ejercicio 2 con datos concretos", "pista": "Pista de cómo empezar (sin solución)", "solucion": ["Paso 1: ...", "Respuesta final: ..."] }
      ],
      "aplicacion": "Aplicación a la vida real del estudiante...",
      "autoevaluacion": ["¿Puedo explicar el avance de mi producto o proyecto?", "¿Logré la práctica sin mirar?"],
      "recursos": [
        { "titulo": "Video de proyecto aplicado", "url": "https://www.youtube.com/results?search_query=proyecto+educacion+media+superior", "tipo": "video" },
        { "titulo": "Consulta temática de ampliación", "url": "https://www.google.com/search?q=proyecto+bachillerato", "tipo": "web" }
      ],
      "productoIntegrador": "Qué agregas hoy a tu producto integrador..."
    }
  ]
}

INDICE DE MATERIALES AUTORIZADOS (usa SOLO estos slugs en los tokens [[material:slug]] de requiredMaterials; lo que no esté aquí, en texto plano):
${buildMaterialSlugIndex(getMaterialCategoriesForContext(input.uacName, input.subsystem), MATERIAL_INDEX_MAX_CHARS - 300)}`;

  const sessionCount = Math.max(1, coveredSessions.length);
  const targetWordsPerPlan = Math.max(900, Math.round((input.targetWords.ideal / sessionCount) * 0.78));
  const totalPlansTarget = sessionCount * targetWordsPerPlan;
  const remainingNarrativeTarget = Math.max(300, input.targetWords.ideal - totalPlansTarget);

  const utilityTarget = Math.round(remainingNarrativeTarget * 0.30);
  const phasesTarget = Math.round(remainingNarrativeTarget * 0.45);
  const challengeTarget = Math.round(remainingNarrativeTarget * 0.10);
  const rubricTarget = Math.round(remainingNarrativeTarget * 0.15);

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Misión: ${missionTitle}
Sesiones asignadas: Sesiones ${coveredSessions.join(', ')} (${sessionCount} sesiones)
Problemática PAEC: ${input.paecContext}
Presupuesto total para esta misión: mínimo ${input.targetWords.min} palabras (ideal ~${input.targetWords.ideal} palabras).

DISTRIBUCIÓN CALIBRADA DE PALABRAS:
- sessionPlans (${sessionCount} sesiones): OBLIGATORIO redactar las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}), con ~${targetWordsPerPlan} palabras por sesión (total planes: ~${totalPlansTarget} palabras). Cada plan debe contener mínimo 440 a 500 palabras en contenido (3 párrafos con criterios y desarrollo propios de ${discipline.displayName}, mínimo 150 palabras por párrafo) y mínimo 300 a 360 palabras en ejemploResuelto (planteamiento concreto y 4 pasos de desarrollo y verificación).
- communityUtility: ~${utilityTarget} palabras (descripción e impacto comunitario PAEC)
- phases: ~${phasesTarget} palabras (instrucciones detalladas y operativas por fases de desarrollo)
- autonomousChallenge: ~${challengeTarget} palabras (validación autónoma de campo)
- rubricSummary: ~${rubricTarget} palabras (criterios y descriptores analíticos)

Esta sección narrativa debe sumar aproximadamente ${remainingNarrativeTarget} palabras, y cada plan de sesión debe contener ~${targetWordsPerPlan} palabras para alcanzar el presupuesto total de ~${input.targetWords.ideal} palabras.
Incluye explicaciones detalladas, ejemplos múltiples, pasos numerados extensos y espacios para que el estudiante trabaje.

Redacta la Misión del Proyecto, el Desarrollo del Producto o Evidencia Y las ${sessionCount} sesiones completas (${coveredSessions.join(', ')}) con máxima extensión y profundidad sin abreviar:`;

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

    // Validación de extensión mínima + cobertura total de sesiones (Fase A)
    const objCount = Array.isArray(parsed.learningObjectives) ? parsed.learningObjectives.length : 0;
    const planCount = Array.isArray(parsed.sessionPlans) ? parsed.sessionPlans.length : 0;
    const missingPlans = planCount < coveredSessions.length;
    if (objCount < 3 || missingPlans) {
      attempt = 2;
      logger.warn(
        `[ProjectWriter] learningObjectives=${objCount} (<3: ${objCount < 3}) o sessionPlans=${planCount}/${coveredSessions.length}. Reintentando con instrucción estricta...`
      );
      const strictDirectives: string[] = [];
      if (objCount < 3) {
        strictDirectives.push(
          `Tu respuesta anterior tuvo menos de 3 objetivos en 'learningObjectives'. Genera OBLIGATORIAMENTE al menos 3 a 5 'learningObjectives' exhaustivos, orientados al logro de competencias integrales y vinculados al problema comunitario PAEC.`
        );
      }
      if (missingPlans) {
        strictDirectives.push(
          `Tu respuesta anterior solo incluyó ${planCount} de ${coveredSessions.length} planes en 'sessionPlans'. Genera OBLIGATORIAMENTE UN plan por cada sesión asignada (${coveredSessions.join(', ')}), es decir EXACTAMENTE ${coveredSessions.length} objetos en 'sessionPlans', cada uno con su "sessionNumber" correcto y contenido real de estudiante (voz en tú).`
        );
      }
      try {
        const retryPrompt = `${prompt}\n\n[REQUISITO CRÍTICO - REINTENTO OBLIGATORIO]: ${strictDirectives.join(' ')}`;
        const retryResponse = await generateWithRotation(
          systemInstruction,
          retryPrompt,
          input.planning.teacherId,
          false,
          { jsonMode: true, maxTokens: 16384, timeoutMs: 85000, signal: input.signal }
        );
        const retryParsed = robustJsonParse(retryResponse);
        const retryObjCount = Array.isArray(retryParsed.learningObjectives) ? retryParsed.learningObjectives.length : 0;
        const retryPlanCount = Array.isArray(retryParsed.sessionPlans) ? retryParsed.sessionPlans.length : 0;
        if (retryObjCount >= objCount && retryPlanCount >= planCount) {
          parsed = retryParsed;
        }
      } catch (retryErr) {
        logger.warn('[ProjectWriter] Error en reintento, preservando primera respuesta:', { error: String(retryErr) });
      }
    }

    const phases = (parsed.phases || []).map((p: Record<string, unknown>, i: number) => ({
      phaseNum: (p.phaseNum as number) || i + 1,
      title: (p.title as string) || `Fase ${i + 1}`,
      allocatedHours: (p.allocatedHours as number) || 2,
      deliverables: Array.isArray(p.deliverables) ? (p.deliverables as string[]) : ['Entregable de fase'],
      instructions: (p.instructions as string) || 'Desarrollar las actividades asignadas para esta fase.',
    }));

    const projectSection: ProjectSection = {
      artifactName: parsed.artifactName || `Producto Integrador: ${input.uacName}`,
      communityUtility: parsed.communityUtility || `Mejora orientada a ${input.paecContext}`,
      learningObjectives: Array.isArray(parsed.learningObjectives) && parsed.learningObjectives.length > 0
        ? parsed.learningObjectives
        : [
            `Diseñar e implementar una solución integral de ${input.uacName} para mitigar ${input.paecContext}.`,
            `Aplicar procedimientos y criterios de calidad propios de ${discipline.displayName} en el desarrollo del producto.`,
            'Evaluar la efectividad del producto o evidencia mediante criterios y registro de avances.',
          ],
      requiredMaterials: Array.isArray(parsed.requiredMaterials) && parsed.requiredMaterials.length > 0
        ? parsed.requiredMaterials.map((m: unknown) => (typeof m === 'string' ? autoTokenizeMaterials(m) : m))
        : [
            `Insumos o recursos específicos de ${input.uacName} según la fase de planeación.`,
            `Herramientas o materiales pertinentes: ${equipmentHint}.`,
            'Cuaderno, portafolio o bitácora de registro para control de avances.',
          ],
      executionSteps: Array.isArray(parsed.executionSteps) && parsed.executionSteps.length > 0
        ? parsed.executionSteps
        : [
            '1. Diagnóstico y definición de alcances con el equipo de trabajo.',
            '2. Diseño de la propuesta y especificación de criterios.',
            '3. Desarrollo, producción o configuración del producto o evidencia.',
            '4. Revisión y pruebas de acuerdo con los criterios de la disciplina.',
            '5. Despliegue situado para evaluación de impacto en el entorno escolar/comunitario.',
            '6. Elaboración de memoria o reporte y entrega final ante el grupo.',
          ],
      deliveryCriteria: Array.isArray(parsed.deliveryCriteria) && parsed.deliveryCriteria.length > 0
        ? parsed.deliveryCriteria
        : [
            'Producto o evidencia terminado y verificado.',
            'Memoria o reporte con registros y criterios de calidad.',
            'Bitácora o registro con seguimiento firmado de cada fase.',
          ],
      registrationFormat: typeof parsed.registrationFormat === 'string' && parsed.registrationFormat.trim().length > 20
        ? parsed.registrationFormat.trim()
        : 'REGISTRO DE BITÁCORA Y CONTROL DE AVANCE DEL PROYECTO\nSesión/Fecha: _______________ | Integrantes del equipo: _________________________________\nAvance realizado: _____________________________________________________________________\nParámetros verificados: ____________________ | Observaciones docentes: ___________________\nFirma de validación: ________________________',
      phases,
      technicalSpecs: parsed.technicalSpecs || ['Estándares de calidad y funcionalidad técnica'],
      acceptanceCriteria: parsed.acceptanceCriteria || ['El producto final opera de forma verificable'],
    };

    const autonomousChallenge = typeof parsed.autonomousChallenge === 'string' && parsed.autonomousChallenge.trim().length > 30
      ? parsed.autonomousChallenge.trim()
      : `Desafío autónomo individual (Tú Haces): Realiza de manera independiente la validación y revisión de calidad de tu producto o evidencia aplicando la lista de verificación y el registro de avances. Contrasta los resultados obtenidos con los criterios de aceptación y documenta cualquier ajuste necesario para maximizar su impacto en ${input.paecContext}.`;

    const workbookElements: WorkbookElement[] = [
      {
        id: 'wb-project-diagram',
        type: 'drawing_box',
        title: 'Diagrama o esquema del producto o proyecto',
        instruction: 'Dibuja el diagrama, esquema o representación de tu propuesta:',
        config: { heightPx: 160 },
      },
      {
        id: 'wb-project-checklist',
        type: 'checkbox_list',
        title: 'Lista de verificación de criterios de aceptación',
        instruction: 'Verifica junto con tu docente el cumplimiento de cada criterio antes de la entrega:',
        config: {
          checkboxes: projectSection.acceptanceCriteria.length > 0
            ? projectSection.acceptanceCriteria
            : ['Cumple con las especificaciones técnicas', 'Resuelve el problema planteado', 'Documentado en la bitácora'],
        },
      },
      {
        id: 'wb-project-notes',
        type: 'lines',
        title: 'Bitácora de campo y lecciones aprendidas',
        instruction: 'Anota los principales retos técnicos enfrentados y cómo los resolvieron en equipo:',
        config: { rows: 6 },
      },
    ];

    const phasesText = phases.map((p: { title: string; instructions: string }) => `${p.title}: ${p.instructions}`).join('\n\n');
    const rubricText = Array.isArray(parsed.rubricSummary)
      ? parsed.rubricSummary.map((r: Record<string, unknown>) => `${(r.criterion as string) || ''}: ${(r.excellent as string) || ''} ${(r.good as string) || ''} ${(r.sufficient as string) || ''} ${(r.insufficient as string) || ''}`).join(' ')
      : '';
    const specsText = Array.isArray(projectSection.technicalSpecs) ? projectSection.technicalSpecs.join(' ') : '';
    const criteriaText = Array.isArray(projectSection.acceptanceCriteria) ? projectSection.acceptanceCriteria.join(' ') : '';
    const fullText = `${projectSection.artifactName}\n${projectSection.communityUtility}\n${phasesText}\n${autonomousChallenge}\n${specsText}\n${criteriaText}\n${rubricText}`;
    const sectionWordCount = fullText.split(/\s+/).filter(Boolean).length;
    const sessionPlans = completeSessionPlans(parsed.sessionPlans, coveredSessions, fallbackContext);
    const sessionPlansWords = sessionPlans.reduce((acc, sp) => acc + countSessionPlanWords(sp), 0);
    const totalMissionWords = sectionWordCount + sessionPlansWords;

    const missionSection: MissionSection = {
      missionIndex: projectMission?.missionIndex || 3,
      title: missionTitle,
      coveredSessions,
      sessionTopic: projectSection.artifactName,
      sessionFocus: 'Desarrollo del producto e integración socioproductiva',
      phenomenonHook: {
        story: `Llegamos a la fase de transferencia y aplicación: aquí transformamos el conocimiento de ${input.uacName} en un producto o proyecto real que atiende la problemática de ${input.paecContext}.`,
        detonatingQuestion: '¿De qué manera una solución bien diseñada puede mejorar la calidad de vida o el aprendizaje en nuestro entorno escolar y comunitario?',
      },
      conceptZero: {
        physicalAnalogy: 'Un proyecto es como resolver un problema real: no basta con tener una idea, hay que probarla, revisarla y mejorarla con evidencias.',
        coreExplanation: projectSection.communityUtility,
      },
      iDoSection: {
        stepByStepDemo: `Fases del Proyecto Formativo:\n${phasesText}`,
      },
      weDoSection: {
        guidedPractice: 'Desarrollo colaborativo en equipos de trabajo con seguimiento docente en el aula y taller.',
        workbookElements: [workbookElements[0]],
      },
      youDoSection: {
        autonomousChallenge,
        workbookElements: workbookElements.slice(1),
      },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Qué impacto esperado tiene tu producto o proyecto en la comunidad o en tu perfil profesional?',
        reflectionPrompts: ['Evalúa la viabilidad y pertinencia de tu propuesta.'],
        criteriaChecklist: ['El producto o evidencia cumple los criterios de aceptación acordados.'],
      },
      sessionPlans,
      wordCount: totalMissionWords,
    };

    const quality = evaluateQuality({
      wordCount: totalMissionWords,
      targetWords: input.targetWords,
      content: fullText,
      subsystem: input.subsystem,
      workbookElementsCount: workbookElements.length,
    });

    if (attempt === 1) {
      logger.info(`[ProjectWriter] ✅ Generado en intento 1 — ${totalMissionWords} palabras (${sectionWordCount} sección + ${sessionPlansWords} sesiones)`);
    } else {
      logger.info(`[ProjectWriter] ⚠️ Reintento necesario — ${totalMissionWords} palabras en intento 2`);
    }

    return {
      type: 'project',
      section: missionSection,
      projectSection,
      wordCount: totalMissionWords,
      tokensUsed: Math.round(totalMissionWords * 1.3),
      qualityScore: quality.qualityScore,
      warnings: quality.warnings,
    };
  } catch (err: unknown) {
    if (input.signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted') || err.message.includes('AbortError')))) {
      throw (input.signal?.reason || err);
    }
    logger.error('[generateProjectMission] Error sin fallback sintético:', err);
    throw err;
  }
}
