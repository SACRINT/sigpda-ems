/**
 * Block Guide Orchestrator (Orquestador Editorial de Libros de Trabajo)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Coordina el pipeline completo de generación del Libro-Cuaderno de Trabajo
 * para un bloque formativo específico:
 * 1. Obtiene planeación y perfil docente desde Neon PostgreSQL.
 * 2. Ejecuta curriculum-context-agent para contextualización curricular oficial.
 * 3. Ejecuta blueprint-architect-agent para dosificación de sesiones y misiones.
 * 4. Consulta el repositorio de semillas canónicas para reutilización técnica.
 * 5. Ejecuta en paralelo los 4 redactores con Promise.allSettled().
 * 6. Ejecuta resilience-agent para la matriz formativa "¿Qué hacer si falla?".
 * 7. Ejecuta quality-validator para evaluar calidad y gestionar reintentos selectivos.
 * 8. Reintenta únicamente los redactores que no alcanzaron el estándar (máx 2 reintentos).
 * 9. Ensambla y persiste el ActiveWorkTextbook con versionamiento histórico en workbooks_json.
 * 10. Si qualityScore >= 80, promueve los procedimientos técnicos como nueva semilla canónica.
 */

import {
  getPlanningById,
  getTeacherById,
  getPlanningExtras,
  findCanonicalSeed,
  saveCanonicalSeed,
  saveBlockWorkbook,
  updateWorkbookProgress,
  incrementSeedUsage,
} from '@/lib/db';
import { extractCurriculumContext } from './curriculum-context-agent';
import { buildBlockBlueprint } from './blueprint-architect-agent';
import { generateFoundationMission } from './writers/foundation-writer';
import { generateLabMission } from './writers/lab-writer';
import { generateProjectMission } from './writers/project-writer';
import { generateEvaluationSection } from './writers/evaluation-writer';
import { generateTroubleshootingMatrix } from './resilience-agent';
import { validateBlockGuideQuality } from './quality-validator';
import type { WriterInput, WriterOutput, PlanningActivities } from './writers/writer-contract';
import type {
  ActiveWorkTextbook,
  CanonicalSeed,
  GenerationProgressState,
  ProjectSection,
  EvaluationSection,
  MissionSection,
} from '@/types/work-textbook';
import type {
  Planning,
  TeacherContext,
  CurriculumComponent,
  ExtractedPdfData,
  GeneratedPlanningContent,
  PlanningStatus,
  SecuenciaBloque,
} from '@/types/planning';

interface RawPlanningRow {
  id: string;
  teacher_id: string;
  uac_name: string;
  semester: number;
  component: CurriculumComponent;
  curriculum_name?: string | null;
  paec_context?: string | null;
  paec_project_name?: string | null;
  extracted_data: ExtractedPdfData | null;
  content_json: GeneratedPlanningContent | null;
  status: PlanningStatus;
  created_at: Date;
  updated_at: Date;
  metodologia_activa?: string | null;
  evaluation_json?: any | null;
  sequence_json?: Record<number, SecuenciaBloque> | null;
}

export interface OrchestratorOptions {
  customHours?: number;
  maxRetriesPerWriter?: number;
}

/**
 * Genera el Libro-Cuaderno de Trabajo Activo completo para un bloque curricular.
 */
export async function generateBlockWorkTextbook(
  planningId: string,
  blockIndex: number,
  options: OrchestratorOptions = {}
): Promise<ActiveWorkTextbook> {
  const maxRetries = options.maxRetriesPerWriter ?? 2;

  // ── Fase 1: Análisis y Recuperación de Datos ─────────────────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'analyzing',
    currentStep: 'Recuperando planeación docente y contexto curricular...',
    percent: 10,
  });

  const rawPlanning = (await getPlanningById(planningId)) as unknown as RawPlanningRow | null;
  if (!rawPlanning) {
    throw new Error(`[block-guide-orchestrator] Planeación no encontrada: ${planningId}`);
  }

  const teacher = await getTeacherById(rawPlanning.teacher_id);
  const teacherSubsystemRaw = teacher?.subsystem || '';
  const isTeacherBt = teacherSubsystemRaw.toLowerCase().includes('bt') ||
                      teacherSubsystemRaw.toLowerCase().includes('tecnol') ||
                      teacherSubsystemRaw.toLowerCase().includes('cecyte') ||
                      teacherSubsystemRaw.toLowerCase().includes('cbtis');
  const normalizedSubsystem: 'bge' | 'bt' = isTeacherBt ? 'bt' : 'bge';

  const teacherContext: TeacherContext = {
    teacherName: teacher?.name || 'Docente Titular',
    schoolName: teacher?.school_name || 'Bachillerato del Estado de Puebla',
    municipality: teacher?.municipality || 'Puebla',
    state: 'Puebla',
    region: 'Puebla',
    subsystem: normalizedSubsystem,
    groupInfo: rawPlanning.semester ? `${rawPlanning.semester}° Semestre` : 'Grupo A',
    paecProjectName: rawPlanning.paec_project_name || (rawPlanning.content_json as any)?.sectionI?.paecProjectName || (rawPlanning.extracted_data as any)?.paecProjectName || rawPlanning.paec_context || 'Proyecto Escolar Comunitario PAEC',
    paecProblem: rawPlanning.paec_context || 'Mejora del entorno escolar y convivencia comunitaria',
    studentContext: 'Estudiantes de educación media superior de Puebla con diversos estilos de aprendizaje.',
  };

  const planning: Planning = {
    id: rawPlanning.id,
    teacherId: rawPlanning.teacher_id,
    uacName: rawPlanning.uac_name,
    semester: rawPlanning.semester,
    component: rawPlanning.component,
    curriculumName: rawPlanning.curriculum_name || '',
    paecContext: rawPlanning.paec_context || '',
    extractedData: rawPlanning.extracted_data,
    contentJson: rawPlanning.content_json,
    status: rawPlanning.status,
    createdAt: rawPlanning.created_at,
    updatedAt: rawPlanning.updated_at,
    metodologiaActiva: rawPlanning.metodologia_activa || undefined,
    evaluationJson: rawPlanning.evaluation_json || null,
    sequenceJson: rawPlanning.sequence_json || null,
  };

  const blockActivities = planning.contentJson?.sectionIV?.activities || [];
  const currentBlockActivity = blockActivities[blockIndex];
  const blockName = currentBlockActivity?.name || `Bloque ${blockIndex + 1}`;

  // ── Construcción de PlanningActivities para alineación guía ↔ planeación ──
  const planningActivities: PlanningActivities | undefined = currentBlockActivity
    ? {
        apertura: {
          description: currentBlockActivity.apertura?.activities || '',
          processes: currentBlockActivity.apertura?.processes || '',
          materials: currentBlockActivity.apertura?.materials || '',
        },
        ejecucion: {
          description: currentBlockActivity.ejecucion?.activities || '',
          processes: currentBlockActivity.ejecucion?.processes || '',
          materials: currentBlockActivity.ejecucion?.materials || '',
        },
        conclusion: {
          description: currentBlockActivity.conclusion?.activities || '',
          processes: currentBlockActivity.conclusion?.processes || '',
          materials: currentBlockActivity.conclusion?.materials || '',
        },
        saberes: currentBlockActivity.saberes,
        contenidoFormativo: currentBlockActivity.contenidoFormativo,
        methodology: currentBlockActivity.methodology,
      }
    : undefined;

  // ── Fase 2: Extracción de Contexto Curricular Oficial ───────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'blueprint',
    currentStep: 'Estructurando contexto normativo y aprendizajes de trayectoria...',
    percent: 20,
  });

  const curriculumContext = extractCurriculumContext({
    uacName: planning.uacName,
    semester: planning.semester,
    subsystem: teacherContext.subsystem,
    component: planning.component,
    teacherContext,
  });

  // ── Fase 3: Blueprint de Dosificación y Clustering de Misiones ─────────
  await reportProgress(planningId, blockIndex, {
    phase: 'blueprint',
    currentStep: 'Diseñando misiones pedagógicas sesión por sesión...',
    percent: 30,
  });

  const extrasRows = await getPlanningExtras(planningId, planning.teacherId).catch(() => []);
  const existingExtras: Record<string, unknown> = {};
  for (const extra of extrasRows) {
    existingExtras[extra.type] = extra.content_text || extra;
  }

  const blueprint = buildBlockBlueprint({
    blockIndex,
    blockName,
    planning,
    curriculum: curriculumContext,
    hasExistingExtras: Object.keys(existingExtras).length > 0,
  });

  // ── Fase 4: Búsqueda de Semilla Canónica Reutilizable ───────────────────
  let canonicalSeed: CanonicalSeed | null = null;
  try {
    const seedTopic =
      blueprint.missions[0]?.sessionTopic ||
      blueprint.missions[blueprint.missions.length - 1]?.sessionTopic ||
      blockName;
    canonicalSeed = await findCanonicalSeed(
      curriculumContext.uacName,
      seedTopic,
      curriculumContext.subsystem
    );
    if (canonicalSeed && canonicalSeed.id) {
      await incrementSeedUsage(canonicalSeed.id);
    }
  } catch (seedErr) {
    console.warn('[orchestrator] Error al buscar semilla canónica:', seedErr);
  }

  // ── Fase 5: Preparación de Inputs para los 4 Redactores ────────────────
  const blockMinWords = Math.round(curriculumContext.targetWords.min / 3);  // ~8,333 BT, ~5,833 BGE
  const blockIdealWords = Math.round((curriculumContext.targetWords.min / 3) * 1.6);  // ~13,333 BT, ~9,333 BGE
  const blockMaxWords = Math.max(
    Math.round(curriculumContext.targetWords.max / 3),
    Math.round(blockIdealWords * 1.25)
  );  // ~16,666 BT, ~11,666 BGE

  const writerSplits = { foundation: 0.30, lab: 0.30, project: 0.25, evaluation: 0.15 };

  const baseWriterInput: WriterInput = {
    planning,
    blockIndex,
    blockName,
    sessions: blueprint.sessions,
    missions: blueprint.missions,
    canonicalSeed: canonicalSeed || undefined,
    existingExtras,
    paecContext: curriculumContext.paecConnection.communityProblem || planning.paecContext || 'Problema comunitario escolar',
    studentProfile: curriculumContext.studentProfile.contextDescription,
    subsystem: curriculumContext.subsystem,
    uacName: planning.uacName,
    targetWords: {
      min: Math.round(blockMinWords * 0.25),
      ideal: Math.round(blockIdealWords * 0.25),
      max: Math.round(blockMaxWords * 0.25),
    },
    planningActivities,
  };

  // ── Fase 6: Redacción Concurrente con Promise.allSettled() ─────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'writing',
    currentStep: 'Redactando concurrentemente las 4 dimensiones del libro...',
    percent: 50,
  });

  const writerPromises = [
    runWriterSafely('foundation', () =>
      generateFoundationMission({
        ...baseWriterInput,
        targetWords: {
          min: Math.round(blockMinWords * writerSplits.foundation),
          ideal: Math.round(blockIdealWords * writerSplits.foundation),
          max: Math.round(blockMaxWords * writerSplits.foundation),
        },
      })
    ),
    runWriterSafely('lab', () =>
      generateLabMission({
        ...baseWriterInput,
        targetWords: {
          min: Math.round(blockMinWords * writerSplits.lab),
          ideal: Math.round(blockIdealWords * writerSplits.lab),
          max: Math.round(blockMaxWords * writerSplits.lab),
        },
      })
    ),
    runWriterSafely('project', () =>
      generateProjectMission({
        ...baseWriterInput,
        targetWords: {
          min: Math.round(blockMinWords * writerSplits.project),
          ideal: Math.round(blockIdealWords * writerSplits.project),
          max: Math.round(blockMaxWords * writerSplits.project),
        },
      })
    ),
    runWriterSafely('evaluation', () =>
      generateEvaluationSection({
        ...baseWriterInput,
        targetWords: {
          min: Math.round(blockMinWords * writerSplits.evaluation),
          ideal: Math.round(blockIdealWords * writerSplits.evaluation),
          max: Math.round(blockMaxWords * writerSplits.evaluation),
        },
      })
    ),
  ];

  const initialResults = await Promise.allSettled(writerPromises);
  const writerOutputs: WriterOutput[] = initialResults.map((res, i) => {
    if (res.status === 'fulfilled') return res.value;
    const types: ('foundation' | 'lab' | 'project' | 'evaluation')[] = ['foundation', 'lab', 'project', 'evaluation'];
    return createEmergencyFallbackOutput(types[i], baseWriterInput, String(res.reason));
  });

  // ── Fase 7: Zona de Depuración y Resiliencia ────────────────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'troubleshooting',
    currentStep: 'Generando matriz formativa "¿Qué hacer si falla?"...',
    percent: 70,
  });

  const allWarnings = writerOutputs.flatMap((w) => w.warnings);
  const sampleTopics = blueprint.missions.map((m) => m.sessionTopic);

  const troubleshootMatrix = await generateTroubleshootingMatrix({
    uacName: planning.uacName,
    subsystem: curriculumContext.subsystem,
    blockName,
    teacherId: planning.teacherId,
    canonicalSeed: canonicalSeed || undefined,
    writerWarnings: allWarnings,
    sampleTopics,
  });

  // ── Fase 8: Validación de Calidad y Reintentos Dirigidos ────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'validating',
    currentStep: 'Auditando estándares pedagógicos y volumen de palabras...',
    percent: 85,
  });

  let validation = validateBlockGuideQuality({
    writerOutputs,
    subsystem: curriculumContext.subsystem,
    targetWords: {
      min: blockMinWords,
      ideal: blockIdealWords,
      max: blockMaxWords,
    },
  });

  // Si hay redactores reintentables, ejecutar reintentos específicos (máx 2 por redactor)
  if (validation.retryableWriters.length > 0) {
    for (const writerType of validation.retryableWriters) {
      let attempts = 0;
      let improved = false;

      while (attempts < maxRetries && !improved) {
        attempts++;
        console.log(`[orchestrator] Reintentando ${writerType} (Intento ${attempts}/${maxRetries})...`);

        try {
          const split = writerSplits[writerType];
          const writerSpecificInput: WriterInput = {
            ...baseWriterInput,
            targetWords: {
              min: Math.round(blockMinWords * split),
              ideal: Math.round(blockIdealWords * split),
              max: Math.round(blockMaxWords * split),
            },
          };

          let reRunOutput: WriterOutput;
          if (writerType === 'foundation') reRunOutput = await generateFoundationMission(writerSpecificInput);
          else if (writerType === 'lab') reRunOutput = await generateLabMission(writerSpecificInput);
          else if (writerType === 'project') reRunOutput = await generateProjectMission(writerSpecificInput);
          else reRunOutput = await generateEvaluationSection(writerSpecificInput);

          const idx = writerOutputs.findIndex((w) => w.type === writerType);
          if (idx !== -1 && reRunOutput.qualityScore > writerOutputs[idx].qualityScore) {
            writerOutputs[idx] = reRunOutput;
            improved = true;
          }
        } catch (retryErr) {
          console.warn(`[orchestrator] Falló reintento de ${writerType}:`, retryErr);
        }
      }
    }

    // Re-validar después de los reintentos
    validation = validateBlockGuideQuality({
      writerOutputs,
      subsystem: curriculumContext.subsystem,
      targetWords: {
        min: blockMinWords,
        ideal: blockIdealWords,
        max: blockMaxWords,
      },
    });
  }

  // ── Fase 9: Ensamblado del ActiveWorkTextbook ───────────────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'assembling',
    currentStep: 'Compilando libro de trabajo activo y tabla de contenido...',
    percent: 95,
  });

  const foundationOut = writerOutputs.find((w) => w.type === 'foundation')!;
  const labOut = writerOutputs.find((w) => w.type === 'lab')!;
  const projectOut = writerOutputs.find((w) => w.type === 'project')!;
  const evalOut = writerOutputs.find((w) => w.type === 'evaluation')!;

  // Inyectar matriz de resiliencia en la misión de laboratorio
  if (labOut.section) {
    labOut.section.troubleshooting = troubleshootMatrix;
  }

  const missions: MissionSection[] = [
    foundationOut.section,
    labOut.section,
    projectOut.section,
    evalOut.section,
  ].filter(Boolean);

  const defaultProjectSection: ProjectSection = {
    artifactName: `Artefacto Demostrativo para ${planning.uacName}`,
    communityUtility: `Solución técnica comunitaria orientada a ${curriculumContext.paecConnection.communityProblem}`,
    phases: [
      { phaseNum: 1, title: 'Fase 1: Diagnóstico', allocatedHours: 2, deliverables: ['Boceto'], instructions: 'Definir especificaciones.' },
      { phaseNum: 2, title: 'Fase 2: Construcción', allocatedHours: 4, deliverables: ['Prototipo'], instructions: 'Montaje de la solución.' },
      { phaseNum: 3, title: 'Fase 3: Pruebas y Entrega', allocatedHours: 2, deliverables: ['Bitácora'], instructions: 'Validación en campo.' },
    ],
    technicalSpecs: ['Estándares de calidad formal'],
    acceptanceCriteria: ['El artefacto opera según los requerimientos'],
  };

  const defaultEvaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Calidad Técnica y Procedimental',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Demuestra dominio pleno de los estándares.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Aplica los conceptos correctamente con mínimas omisiones.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Cumple los requisitos indispensables de forma básica.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Requiere acompañamiento permanente.' },
        ],
      },
      {
        criterion: 'Impacto en la Comunidad PAEC',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Aporte de alto valor a la problemática escolar.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Aporte claro y medible al entorno escolar.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Aporte modesto o indirecto.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Sin vinculación demostrable.' },
        ],
      },
    ],
    checklist: [
      { item: 'Entrega del producto en tiempo y forma', category: 'Cumplimiento' },
      { item: 'Funcionamiento comprobable del artefacto', category: 'Técnico' },
    ],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        question: `¿Cómo mitiga tu proyecto la problemática de ${curriculumContext.paecConnection.communityProblem}?`,
        scenario: 'Demostración de resultados ante la comunidad escolar.',
        answerExplanation: 'El estudiante debe justificar el impacto social de su artefacto.',
      },
    ],
    metacognitiveReflection: {
      prompts: ['¿Qué aprendiste al construir este proyecto que puedas aplicar en tu vida diaria?'],
    },
  };

  const projectSection: ProjectSection = projectOut.projectSection || defaultProjectSection;
  const evaluationSection: EvaluationSection = evalOut.evaluationSection || defaultEvaluationSection;

  const totalWords = validation.totalWordCount;
  const totalPages = Math.max(
    curriculumContext.subsystem === 'bt' ? 50 : 35,
    Math.round(totalWords / 450)
  );

  const tableOfContents = missions.map((m, idx) => ({
    missionIndex: idx + 1,
    title: m.title,
    sessionsRange: `Sesiones ${m.coveredSessions?.join(', ') || 'N/A'}`,
    pageEstimate: Math.max(4, Math.round(m.wordCount / 450)),
  }));

  const activeWorkTextbook: ActiveWorkTextbook = {
    id: `wtb-${planningId}-b${blockIndex}`,
    planningId,
    blockIndex,
    blockName,
    version: 1, // saveBlockWorkbook se encargará de asignar la versión correlativa
    subsystem: curriculumContext.subsystem,
    targetPages: curriculumContext.subsystem === 'bt' ? 65 : 42,
    totalPages,
    totalWords,
    generatedAt: new Date().toISOString(),
    qualityScore: validation.qualityScore,
    qualityWarning: validation.qualityWarning,
    coverData: {
      title: `Cuaderno de Aprendizaje Activo: ${blockName}`,
      subtitle: `Misiones Didácticas Orientadas al Proyecto PAEC Comunitario`,
      subjectName: planning.uacName,
      semester: planning.semester,
      blockNumber: blockIndex + 1,
      teacherName: teacher?.name || 'Docente Titular',
      schoolName: teacherContext.schoolName,
      cct: teacher?.cct || '21ECT0017T',
      paecProjectName: curriculumContext.paecConnection.projectName || planning.paecContext,
    },
    tableOfContents,
    missions,
    projectSection,
    evaluationSection,
  };

  // ── Fase 10: Persistencia en DB con Versionamiento ─────────────────────
  if (validation.accepted) {
    await saveBlockWorkbook(planningId, blockIndex, activeWorkTextbook);
  } else {
    console.warn(
      `[Orchestrator] Block ${blockIndex} NOT accepted: qualityScore=${validation.qualityScore}, words=${validation.totalWordCount}. Guardando con advertencia activa.`
    );
    activeWorkTextbook.qualityWarning = true;
    await saveBlockWorkbook(planningId, blockIndex, activeWorkTextbook);
  }

  // Si alcanzó estándar alto (qualityScore >= 80) y no existía semilla previa, guardarla
  if (validation.qualityScore >= 80 && !canonicalSeed && labOut.section) {
    const seedCandidate: CanonicalSeed = {
      uacId: curriculumContext.uacName,
      subsystem: curriculumContext.subsystem,
      topic: labOut.section.sessionTopic || blockName,
      practiceType: curriculumContext.subsystem === 'bt' ? 'workshop' : 'lab',
      content: {
        title: labOut.section.title,
        procedures: [labOut.section.iDoSection.stepByStepDemo],
        dataTableSchema: {
          columns: ['Parámetro', 'Valor Esperado', 'Medición 1', 'Medición 2', 'Unidad'],
          sampleRows: 6,
        },
        commonErrors: troubleshootMatrix,
        materials: ['Materiales de práctica escolar'],
        nomNorms: curriculumContext.applicableNorms,
      },
      source: 'ai_generated',
      qualityScore: validation.qualityScore,
    };
    await saveCanonicalSeed(seedCandidate).catch((e) =>
      console.warn('[orchestrator] Error al guardar semilla canónica:', e)
    );
  }

  // ── Fase 11: Finalización ──────────────────────────────────────────────
  await reportProgress(planningId, blockIndex, {
    phase: 'completed',
    currentStep: 'Libro-Cuaderno de Trabajo Activo completado y listo para descarga.',
    percent: 100,
    qualityScore: validation.qualityScore,
    wordCount: validation.totalWordCount,
    totalWords: validation.totalWordCount,
  });

  return activeWorkTextbook;
}

/**
 * Reporta el avance de la generación a la base de datos para el progreso en tiempo real
 */
async function reportProgress(
  planningId: string,
  blockIndex: number,
  params: {
    phase: GenerationProgressState['phase'];
    currentStep: string;
    percent: number;
    qualityScore?: number;
    wordCount?: number;
    totalWords?: number;
    error?: string;
  }
): Promise<void> {
  const state: GenerationProgressState = {
    planningId,
    blockIndex,
    phase: params.phase,
    currentStep: params.currentStep,
    percent: params.percent,
    qualityScore: params.qualityScore,
    wordCount: params.wordCount,
    totalWords: params.totalWords,
    error: params.error,
    updatedAt: new Date().toISOString(),
  };
  await updateWorkbookProgress(planningId, blockIndex, state).catch((err: any) =>
    console.warn('[Orchestrator] Progress update failed:', err?.message)
  );
}

/**
 * Ejecuta un writer con captura segura de excepciones
 */
async function runWriterSafely(
  type: 'foundation' | 'lab' | 'project' | 'evaluation',
  fn: () => Promise<WriterOutput>
): Promise<WriterOutput> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[runWriterSafely] Falló el redactor ${type}:`, err);
    throw err;
  }
}

/**
 * Construye una salida de emergencia con contenido mínimo en caso de fallo crítico
 */
function createEmergencyFallbackOutput(
  type: 'foundation' | 'lab' | 'project' | 'evaluation',
  input: WriterInput,
  errorMsg: string
): WriterOutput {
  const fallbackSection: MissionSection = {
    missionIndex: 1,
    title: `Misión Formativa: ${input.blockName}`,
    coveredSessions: [1, 2],
    sessionTopic: input.uacName,
    sessionFocus: 'Desarrollo de competencias esenciales',
    phenomenonHook: {
      story: `Abordamos los fundamentos esenciales de ${input.uacName} para atender ${input.paecContext}.`,
      detonatingQuestion: '¿De qué forma este conocimiento transforma nuestro entorno escolar?',
    },
    conceptZero: {
      physicalAnalogy: 'Cada concepto es un eslabón indispensable en la cadena de soluciones técnicas.',
      coreExplanation: `Fundamentos de ${input.uacName} para el Bachillerato.`,
    },
    iDoSection: { stepByStepDemo: 'Demostración inicial de los protocolos de trabajo.' },
    weDoSection: {
      guidedPractice: 'Actividad en equipos de trabajo en el aula.',
      workbookElements: [
        { id: 'em-1', type: 'lines', title: 'Registro inicial', config: { rows: 4 } },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Resolución autónoma de los ejercicios en el cuaderno.',
      workbookElements: [
        { id: 'em-2', type: 'lines', title: 'Conclusiones', config: { rows: 4 } },
      ],
    },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué aprendizaje clave consolidas en esta misión?',
      reflectionPrompts: ['Revisa los pasos realizados.'],
      criteriaChecklist: ['Identifico los conceptos centrales.'],
    },
    wordCount: 500,
  };

  return {
    type,
    section: fallbackSection,
    wordCount: 500,
    tokensUsed: 0,
    qualityScore: 60,
    warnings: [`Generado mediante contingencia crítica de redactor (${type}): ${errorMsg}`],
  };
}
