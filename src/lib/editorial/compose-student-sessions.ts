/**
 * compose-student-sessions.ts — Composición del capítulo editorial de estudiante
 * desde plannings.workbooks_json (block_N.current: missions, sessionPlans,
 * projectSection y evaluationSection).
 *
 * Contrato (Fase 3 · PUBLISHING_ENGINE_V2):
 *  1. Los recursos faltantes solo se completan con entradas REALES del catálogo.
 *     Autoevaluación, pistas y campos teóricos NO se rellenan con texto genérico.
 *  2. Si un plan falla por contenido genérico, teórico o práctico duro, se registra
 *     en `dropped` y la ruta aborta con 422 explícito — jamás se publica un libro
 *     parcial ni con relleno sintético en silencio.
 *  3. Numeración global 1..N con remapeo de referencias (offset = global − local).
 *  4. Extrae además `missions[]` (encuadre de las 4 misiones + escena por rol),
 *     `projectSections[]` y `evaluationSections[]` (estrictamente sin clave docente
 *     `answerExplanation`) al cierre de cada bloque.
 */

import { logger } from '@/lib/logger';
import {
  StudentSessionSchema,
  adaptSessionPlanToStudentSession,
  remapSessionReferencesDeep,
  type StudentEvaluationSection,
  type StudentMissionFraming,
  type StudentProjectSection,
  type StudentSession,
} from './student-content-model';
import { enforceEditorialSoftMinimums } from './session-plan-minimums';
import { findGenericContent } from '@/lib/guide-engine/quality/no-generic-content';
import { stripMaterialTokensDeep } from '@/lib/materials/material-tokens';
import {
  allocateEditorialSceneOnDisk,
  missionIndexToSceneRole,
  type SceneFileExistsFn,
} from '@/lib/visual-engine/scene-allocator';
import type {
  EvaluationSection,
  MissionSection,
  ProjectSection,
  SessionPlan,
} from '@/types/work-textbook';

export interface DroppedSession {
  blockKey: string;
  sessionNumber: number;
  issues: string[];
}

export interface ComposedStudentSessions {
  sessions: StudentSession[];
  blocksPresent: number[];
  /** Planes que fallaron por reglas DURAS (contenido corrupto) → la ruta responde 422. */
  dropped: DroppedSession[];
  /** Total de planes leídos en workbooks_json. */
  totalPlans: number;
  /** Cuántos planes recibieron un recurso REAL del catálogo (sin relleno textual). */
  padded: number;
  /** Fase 3: Encuadre de las misiones pedagógicas con rango de sesiones globales. */
  missions: StudentMissionFraming[];
  /** Fase 3: Proyectos Integradores PAEC al cierre de cada bloque. */
  projectSections: StudentProjectSection[];
  /** Fase 3: Secciones de Evaluación Formativa NEM (sin clave docente). */
  evaluationSections: StudentEvaluationSection[];
}

const MISSION_STAGE_LABELS = [
  'Concepto Cero',
  'Yo Hago',
  'Nosotros Hacemos',
  'Tú Haces',
] as const;

interface RawWorkbookLike {
  blockName?: string;
  missions?: Array<Partial<MissionSection> & { sessionPlans?: SessionPlan[] }>;
  projectSection?: ProjectSection;
  evaluationSection?: EvaluationSection;
}

function adaptProjectSection(
  raw: ProjectSection,
  blockNumber: number,
  blockName: string,
  afterSession: number,
): StudentProjectSection | null {
  const clean = stripMaterialTokensDeep(raw);
  const artifactName = (clean.artifactName || '').trim();
  const communityUtility = (clean.communityUtility || '').trim();
  if (artifactName.length < 3 || communityUtility.length < 5) return null;

  return {
    blockNumber,
    blockName: blockName || `Bloque ${blockNumber}`,
    afterSession,
    artifactName,
    communityUtility,
    requiredMaterials: Array.isArray(clean.requiredMaterials)
      ? clean.requiredMaterials.filter((m) => typeof m === 'string' && m.trim().length > 0)
      : [],
    phases: Array.isArray(clean.phases)
      ? clean.phases
          .filter((ph) => ph && typeof ph.title === 'string' && ph.title.trim().length >= 2)
          .map((ph, idx) => ({
            phaseNum: ph.phaseNum || idx + 1,
            title: ph.title.trim(),
            allocatedHours: Number(ph.allocatedHours) || 0,
            deliverables: Array.isArray(ph.deliverables) ? ph.deliverables.filter(Boolean) : [],
            instructions: (ph.instructions || 'Ejecuta esta fase registrando evidencias en tu bitácora.').trim(),
          }))
      : [],
    technicalSpecs: Array.isArray(clean.technicalSpecs) ? clean.technicalSpecs.filter(Boolean) : [],
    acceptanceCriteria: Array.isArray(clean.acceptanceCriteria) ? clean.acceptanceCriteria.filter(Boolean) : [],
    ...(clean.registrationFormat ? { registrationFormat: clean.registrationFormat } : {}),
  };
}

function adaptEvaluationSection(
  raw: EvaluationSection,
  blockNumber: number,
  blockName: string,
  afterSession: number,
): StudentEvaluationSection | null {
  const clean = stripMaterialTokensDeep(raw);
  const rubric = Array.isArray(clean.rubric)
    ? clean.rubric
        .filter((c) => c && typeof c.criterion === 'string' && c.criterion.trim().length >= 2)
        .map((c) => ({
          criterion: c.criterion.trim(),
          weightPercent: Number(c.weightPercent) || 0,
          levels: Array.isArray(c.levels)
            ? c.levels.map((l) => ({
                levelName: l.levelName,
                points: Number(l.points) || 0,
                descriptor: (l.descriptor || '').trim() || '—',
              }))
            : [],
        }))
    : [];

  const checklist = Array.isArray(clean.checklist)
    ? clean.checklist
        .filter((i) => i && typeof i.item === 'string' && i.item.trim().length >= 3)
        .map((i) => ({
          item: i.item.trim(),
          category: (i.category || 'Desempeño').trim(),
        }))
    : [];

  const reflectionPrompts = Array.isArray(clean.metacognitiveReflection?.prompts)
    ? clean.metacognitiveReflection.prompts.filter((p) => typeof p === 'string' && p.trim().length >= 4)
    : [];

  // Seguridad estudiante-docente: NUNCA proyectar `answerExplanation` al libro del estudiante
  const quizQuestions = Array.isArray(clean.criticalThinkingQuiz)
    ? clean.criticalThinkingQuiz
        .filter((q) => q && typeof q.question === 'string' && q.question.trim().length >= 4)
        .map((q, idx) => ({
          questionNumber: q.questionNumber || idx + 1,
          scenario: (q.scenario || '').trim(),
          question: q.question.trim(),
          ...(Array.isArray(q.options) && q.options.length > 0 ? { options: q.options } : {}),
        }))
    : [];

  if (rubric.length === 0 && checklist.length === 0 && reflectionPrompts.length === 0 && quizQuestions.length === 0) {
    return null;
  }

  return {
    blockNumber,
    blockName: blockName || `Bloque ${blockNumber}`,
    afterSession,
    rubric,
    checklist,
    reflectionPrompts,
    quizQuestions,
  };
}

/**
 * Compone las sesiones, misiones, proyectos integradores y evaluaciones NEM desde
 * `plannings.workbooks_json`, ordenando por bloque y renumerando 1..N (invariante anti-F11).
 */
export function composeStudentSessionsFromWorkbooks(
  rawPlanning: {
    uac_name?: string | null;
    workbooks_json?: Record<string, { current?: RawWorkbookLike } | null> | null;
  },
  options?: {
    sceneFileExists?: SceneFileExistsFn;
  },
): ComposedStudentSessions {
  const workbooks = rawPlanning.workbooks_json;
  if (!workbooks || typeof workbooks !== 'object') {
    return {
      sessions: [],
      blocksPresent: [],
      dropped: [],
      totalPlans: 0,
      padded: 0,
      missions: [],
      projectSections: [],
      evaluationSections: [],
    };
  }

  const blockKeys = Object.keys(workbooks)
    .filter((key) => /^block_\d+$/.test(key))
    .sort((a, b) => Number(a.slice('block_'.length)) - Number(b.slice('block_'.length)));

  const plans: Array<{
    blockKey: string;
    blockIndex: number;
    missionPos: number;
    plan: SessionPlan;
  }> = [];
  const blocksPresent: number[] = [];
  const blockMetaMap = new Map<number, RawWorkbookLike>();

  for (const key of blockKeys) {
    const current = workbooks[key]?.current;
    const rawMissions = Array.isArray(current?.missions) ? current!.missions : [];
    const blockIndex = Number(key.slice('block_'.length));

    const blockPlans: Array<{ missionPos: number; plan: SessionPlan }> = [];
    rawMissions.forEach((mission, mIdx) => {
      if (Array.isArray(mission?.sessionPlans)) {
        for (const p of mission.sessionPlans) {
          blockPlans.push({ missionPos: mIdx, plan: p });
        }
      }
    });
    if (blockPlans.length === 0) continue;

    blocksPresent.push(blockIndex);
    if (current) blockMetaMap.set(blockIndex, current);

    blockPlans.sort((a, b) => (a.plan?.sessionNumber || 0) - (b.plan?.sessionNumber || 0));
    for (const item of blockPlans) {
      plans.push({ blockKey: key, blockIndex, missionPos: item.missionPos, plan: item.plan });
    }
  }

  const validEntries: Array<{
    blockIndex: number;
    missionPos: number;
    session: StudentSession;
  }> = [];
  const dropped: DroppedSession[] = [];
  let padded = 0;

  for (const { blockKey, blockIndex, missionPos, plan } of plans) {
    const prepared = enforceEditorialSoftMinimums(plan);
    if (prepared !== plan) padded++;

    const genericIssues = findGenericContent(prepared, `session_${plan?.sessionNumber ?? '?'}`);
    if (genericIssues.length > 0) {
      dropped.push({
        blockKey,
        sessionNumber: plan?.sessionNumber ?? -1,
        issues: genericIssues.map((issue) => `${issue.path}: ${issue.label}`),
      });
      continue;
    }

    try {
      const parsed = StudentSessionSchema.safeParse(
        adaptSessionPlanToStudentSession(prepared, undefined, {
          uacName: rawPlanning.uac_name || undefined,
        }),
      );
      if (parsed.success) {
        validEntries.push({ blockIndex, missionPos, session: parsed.data });
      } else {
        dropped.push({
          blockKey,
          sessionNumber: plan?.sessionNumber ?? -1,
          issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        });
      }
    } catch (error) {
      dropped.push({
        blockKey,
        sessionNumber: plan?.sessionNumber ?? -1,
        issues: [
          `adaptación SessionPlan→StudentSession falló: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      });
    }
  }

  if (dropped.length > 0) {
    logger.error('[editorial/compose] Sesiones con contenido DURAMENTE inválido (la exportación se abortará con 422):', {
      dropped: dropped.map((d) => `${d.blockKey} sesión local ${d.sessionNumber}`),
      issues: dropped.map((d) => ({ session: d.sessionNumber, issues: d.issues })),
    });
  }
  if (padded > 0) {
    logger.warn('[editorial/compose] Red de seguridad determinista aplicada (campos blandos reparados):', {
      padded,
      totalPlans: plans.length,
      note: 'Si el reparador IA no cubrió estas sesiones, revisar logs de plan-completeness.',
    });
  }

  // Numeración global 1..N + rastreo de rangos por bloque y por misión
  const missionRanges = new Map<string, { blockIndex: number; missionPos: number; start: number; end: number }>();
  const blockLastSession = new Map<number, number>();

  const sessions = validEntries.map((entry, index) => {
    const globalNumber = index + 1;
    const offset = globalNumber - entry.session.numero;
    const remapped = offset !== 0 ? remapSessionReferencesDeep(entry.session, offset) : entry.session;

    const mKey = `${entry.blockIndex}:${entry.missionPos}`;
    const existingRange = missionRanges.get(mKey);
    if (!existingRange) {
      missionRanges.set(mKey, {
        blockIndex: entry.blockIndex,
        missionPos: entry.missionPos,
        start: globalNumber,
        end: globalNumber,
      });
    } else {
      existingRange.end = globalNumber;
    }
    blockLastSession.set(entry.blockIndex, globalNumber);

    return {
      ...remapped,
      numero: globalNumber,
      titulo: remapped.titulo.replace(/^Sesión \d+:\s*/, `Sesión ${globalNumber}: `),
    };
  });

  // Proyectar encuadre de misiones (4 misiones por bloque)
  const missions: StudentMissionFraming[] = [];
  for (const range of missionRanges.values()) {
    const wb = blockMetaMap.get(range.blockIndex);
    const rawMission = wb?.missions?.[range.missionPos];
    const blockNumber = range.blockIndex + 1;
    const missionIndex = rawMission?.missionIndex || range.missionPos + 1;
    const cleanMission = rawMission ? stripMaterialTokensDeep(rawMission) : undefined;
    const title = (cleanMission?.title || `Misión ${missionIndex}`).trim();
    const stageLabel = MISSION_STAGE_LABELS[range.missionPos % MISSION_STAGE_LABELS.length];

    const scene = options?.sceneFileExists
      ? allocateEditorialSceneOnDisk({
          uacName: rawPlanning.uac_name || undefined,
          blockNumber,
          role: missionIndexToSceneRole(range.missionPos),
          fileExists: options.sceneFileExists,
        })
      : null;

    missions.push({
      blockNumber,
      missionIndex,
      title,
      stageLabel,
      startSession: range.start,
      endSession: range.end,
      ...(cleanMission?.realLifeConnection?.context
        ? { realLifeContext: cleanMission.realLifeConnection.context.trim() }
        : {}),
      ...(scene ? { scene } : {}),
      ...(cleanMission?.metacognitiveTrafficLight
        ? { trafficLight: cleanMission.metacognitiveTrafficLight }
        : {}),
    });
  }
  missions.sort((a, b) => a.startSession - b.startSession);

  // Proyectar ProjectSection y EvaluationSection al cierre de cada bloque
  const projectSections: StudentProjectSection[] = [];
  const evaluationSections: StudentEvaluationSection[] = [];

  for (const blockIndex of blocksPresent) {
    const wb = blockMetaMap.get(blockIndex);
    const afterSession = blockLastSession.get(blockIndex);
    if (!wb || !afterSession) continue;
    const blockNumber = blockIndex + 1;
    const blockName = wb.blockName || `Bloque ${blockNumber}`;

    if (wb.projectSection) {
      const adaptedProj = adaptProjectSection(wb.projectSection, blockNumber, blockName, afterSession);
      if (adaptedProj) projectSections.push(adaptedProj);
    }
    if (wb.evaluationSection) {
      const adaptedEval = adaptEvaluationSection(wb.evaluationSection, blockNumber, blockName, afterSession);
      if (adaptedEval) evaluationSections.push(adaptedEval);
    }
  }

  return {
    sessions,
    blocksPresent,
    dropped,
    totalPlans: plans.length,
    padded,
    missions,
    projectSections,
    evaluationSections,
  };
}
