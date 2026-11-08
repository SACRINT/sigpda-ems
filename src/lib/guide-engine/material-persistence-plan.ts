/**
 * Planificador puro de persistencia de materiales derivados de un bloque.
 *
 * Invariantes estructurales:
 * - Ningún stream se borra si no se va a reinsertar completo.
 * - El material didáctico y los recursos visuales se gestionan como streams
 *   independientes: borrar uno nunca elimina al otro.
 * - Los visuales se reemplazan por misión, preservando los visuales de misiones
 *   que no se pudieron resolver en esta ejecución.
 * - La decisión es determinista y testeable sin base de datos.
 */

import type { ExtractedBlockMaterials, PlanDeClaseDerivado } from './material-extractor';
import type { MaterialReviewReport, MaterialType } from './material-review';

export type PersistenceStream =
  | 'lesson_plan'
  | 'rubric'
  | 'checklist'
  | 'didactic_material'
  | 'practice_guide'
  | 'teacher_guide'
  | 'visual_asset';

export type PersistedExtraType =
  | 'lesson_plan'
  | 'rubric'
  | 'checklist'
  | 'material'
  | 'practice_guide'
  | 'teacher_guide';

export interface PlannedInsert {
  extraType: PersistedExtraType;
  title: string;
  contentText: string;
}

export type PlannedDelete =
  | { kind: 'types'; types: PersistedExtraType[] }
  | { kind: 'material_non_visual' }
  | { kind: 'visual_missions'; missionNumbers: number[] };

export interface MaterialPersistencePlan {
  deletes: PlannedDelete[];
  inserts: PlannedInsert[];
  persistedStreams: PersistenceStream[];
  omitted: MaterialType[];
}

export interface ValidVisualEntry {
  missionNumber: number;
  title: string;
  payload: string;
}

export interface BuildMaterialPersistencePlanInput {
  review: MaterialReviewReport;
  extracted: ExtractedBlockMaterials;
  plans: PlanDeClaseDerivado[];
  blockNum: number;
  blockTitle: string;
  rubricContent: string;
  checklistContent: string;
  planMarkdownBySession: Map<number, string>;
  validVisuals: ValidVisualEntry[];
  omittedVisualMissions: number[];
}

export function cleanSessionTitle(title: string, sessionNumber: number): string {
  const raw = (title || '').trim();
  const prefix = `Sesión ${sessionNumber}`;
  if (!raw.toLowerCase().startsWith(prefix.toLowerCase())) return raw;
  return raw.substring(prefix.length).replace(/^\s*[:\-–—]\s*/, '').trim();
}

export function collectOmittedFromReview(review: MaterialReviewReport): MaterialType[] {
  const omitted: MaterialType[] = [];
  if (!review.byMaterial.lesson_plan.ok) omitted.push('lesson_plan');
  if (!review.byMaterial.rubric.ok) omitted.push('rubric');
  if (!review.byMaterial.checklist.ok) omitted.push('checklist');
  if (!review.byMaterial.didactic_material.ok) omitted.push('didactic_material');
  if (!review.byMaterial.recovery_cards.ok) omitted.push('recovery_cards');
  if (!review.byMaterial.answer_key.ok) omitted.push('answer_key');
  return omitted;
}

/**
 * Construye el plan de persistencia. El llamador ejecuta las operaciones en una
 * transacción por bloque; este módulo no conoce SQL ni efectos secundarios.
 */
export function buildMaterialPersistencePlan(
  input: BuildMaterialPersistencePlanInput
): MaterialPersistencePlan {
  const {
    review,
    extracted,
    plans,
    blockNum,
    blockTitle,
    rubricContent,
    checklistContent,
    planMarkdownBySession,
    validVisuals,
    omittedVisualMissions,
  } = input;

  const deletes: PlannedDelete[] = [];
  const inserts: PlannedInsert[] = [];
  const persistedStreams: PersistenceStream[] = [];
  const omitted = collectOmittedFromReview(review);

  const shouldPersistLessonPlans = review.byMaterial.lesson_plan.ok && plans.length > 0;
  if (shouldPersistLessonPlans) {
    const lessonPlanInserts: PlannedInsert[] = [];
    for (const plan of plans) {
      const markdown = planMarkdownBySession.get(plan.numeroSesion);
      if (!markdown) continue;
      const sessionTitle = cleanSessionTitle(plan.tituloSesion, plan.numeroSesion);
      const title = sessionTitle
        ? `Plan de Clase: Sesión ${plan.numeroSesion} · ${sessionTitle}`
        : `Plan de Clase: Sesión ${plan.numeroSesion}`;
      lessonPlanInserts.push({ extraType: 'lesson_plan', title, contentText: markdown });
    }
    if (lessonPlanInserts.length > 0) {
      deletes.push({ kind: 'types', types: ['lesson_plan'] });
      inserts.push(...lessonPlanInserts);
      persistedStreams.push('lesson_plan');
    }
  }

  if (rubricContent && review.byMaterial.rubric.ok) {
    deletes.push({ kind: 'types', types: ['rubric'] });
    inserts.push({
      extraType: 'rubric',
      title: `Rúbrica Analítica de Evaluación · Bloque ${blockNum}: ${blockTitle}`,
      contentText: rubricContent,
    });
    persistedStreams.push('rubric');
  }

  if (checklistContent && review.byMaterial.checklist.ok) {
    deletes.push({ kind: 'types', types: ['checklist'] });
    inserts.push({
      extraType: 'checklist',
      title: `Lista de Cotejo Formativa · Bloque ${blockNum}: ${blockTitle}`,
      contentText: checklistContent,
    });
    persistedStreams.push('checklist');
  }

  if (extracted.materialDidactico && review.byMaterial.didactic_material.ok) {
    // Stream no visual: nunca toca las filas [Visual].
    deletes.push({ kind: 'material_non_visual' });
    inserts.push({
      extraType: 'material',
      title: `Materiales Didácticos e Insumos del Docente · Bloque ${blockNum}: ${blockTitle}`,
      contentText: extracted.materialDidactico,
    });
    persistedStreams.push('didactic_material');
  }

  if (extracted.fichasTrabajo && review.byMaterial.recovery_cards.ok) {
    deletes.push({ kind: 'types', types: ['practice_guide'] });
    inserts.push({
      extraType: 'practice_guide',
      title: `Fichas de Trabajo Imprimibles · Bloque ${blockNum}: ${blockTitle}`,
      contentText: extracted.fichasTrabajo,
    });
    persistedStreams.push('practice_guide');
  }

  if (extracted.solucionarioDocente && review.byMaterial.answer_key.ok) {
    deletes.push({ kind: 'types', types: ['teacher_guide'] });
    inserts.push({
      extraType: 'teacher_guide',
      title: `Solucionario y Guía Pedagógica del Docente · Bloque ${blockNum}: ${blockTitle}`,
      contentText: extracted.solucionarioDocente,
    });
    persistedStreams.push('teacher_guide');
  }

  if (validVisuals.length > 0) {
    // Reemplazo quirúrgico por misión: preserva visuales de misiones no resueltas.
    deletes.push({
      kind: 'visual_missions',
      missionNumbers: validVisuals.map((visual) => visual.missionNumber),
    });
    for (const visual of validVisuals) {
      inserts.push({
        extraType: 'material',
        title: visual.title,
        contentText: visual.payload,
      });
    }
    persistedStreams.push('visual_asset');
  }

  if (omittedVisualMissions.length > 0 && !omitted.includes('visual_asset')) {
    omitted.push('visual_asset');
  }

  return { deletes, inserts, persistedStreams, omitted };
}
