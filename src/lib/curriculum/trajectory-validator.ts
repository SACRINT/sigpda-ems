/**
 * trajectory-validator.ts — Validación determinista de una malla curricular.
 *
 * Verifica estructura, horas, actividades clave, prerrequisitos (DAG sin
 * ciclos), orden semestral y cobertura del proyecto integrador. No usa IA.
 */

import type {
  CurriculumTrajectory,
  TrajectoryNode,
  TrajectorySemester,
  TrajectoryValidationIssue,
  TrajectoryValidationReport,
} from './trajectory-types';

const EXPECTED_SEMESTERS: TrajectorySemester[] = [3, 4, 5, 6];
const PLACEHOLDER_RE = /\[(completar|insertar|pendiente|texto)\]|\bTODO\b/i;

function hasText(value: string, min = 1): boolean {
  return typeof value === 'string' && value.trim().length >= min;
}

function detectCycle(nodes: TrajectoryNode[]): string[] | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  let cycle: string[] | null = null;

  const visit = (id: string): void => {
    if (cycle) return;
    const current = state.get(id) ?? 0;
    if (current === 1) {
      const start = stack.indexOf(id);
      cycle = [...stack.slice(start), id];
      return;
    }
    if (current === 2) return;

    state.set(id, 1);
    stack.push(id);
    const node = byId.get(id);
    for (const prerequisite of node?.prerequisites ?? []) {
      if (byId.has(prerequisite)) visit(prerequisite);
    }
    stack.pop();
    state.set(id, 2);
  };

  for (const node of nodes) visit(node.id);
  return cycle;
}

export function validateCurriculumTrajectory(
  trajectory: CurriculumTrajectory
): TrajectoryValidationReport {
  const errors: TrajectoryValidationIssue[] = [];
  const warnings: TrajectoryValidationIssue[] = [];
  const nodes = Array.isArray(trajectory.nodes) ? trajectory.nodes : [];
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const addError = (code: string, message: string, nodeId?: string): void => {
    errors.push({ code, message, ...(nodeId ? { nodeId } : {}) });
  };
  const addWarning = (code: string, message: string, nodeId?: string): void => {
    warnings.push({ code, message, ...(nodeId ? { nodeId } : {}) });
  };

  // ── Metadatos ─────────────────────────────────────────────────────────────
  if (!hasText(trajectory.id)) addError('meta_id', 'La trayectoria no tiene id.');
  if (!hasText(trajectory.name)) addError('meta_name', 'La trayectoria no tiene nombre.');
  if (!hasText(trajectory.sourceDocument)) {
    addError('meta_source', 'Falta el documento oficial de origen.');
  }
  if (trajectory.subsystem !== 'bge') {
    addError('meta_subsystem', `Subsistema no soportado: ${trajectory.subsystem}.`);
  }
  if (trajectory.totalUacs !== nodes.length) {
    addError('meta_total_uacs', `totalUacs=${trajectory.totalUacs} no coincide con ${nodes.length} nodos.`);
  }
  if (trajectory.durationSemesters !== EXPECTED_SEMESTERS.length) {
    addError('meta_duration', `durationSemesters=${trajectory.durationSemesters}; se esperan 4.`);
  }

  // ── Nodos y horas ─────────────────────────────────────────────────────────
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const seenActivityIds = new Set<string>();
  const perSemester = new Map<TrajectorySemester, number>();
  let activityCount = 0;
  let totalHours = 0;

  for (const node of nodes) {
    if (seenIds.has(node.id)) addError('node_duplicate_id', `ID duplicado: ${node.id}.`, node.id);
    seenIds.add(node.id);

    const normalizedName = node.uacName.trim().toLowerCase();
    if (seenNames.has(normalizedName)) {
      addError('node_duplicate_name', `UAC duplicada: ${node.uacName}.`, node.id);
    }
    seenNames.add(normalizedName);

    if (!EXPECTED_SEMESTERS.includes(node.semester)) {
      addError('node_semester', `Semestre fuera de 3–6: ${node.semester}.`, node.id);
    }
    perSemester.set(node.semester, (perSemester.get(node.semester) ?? 0) + 1);

    if (node.order !== 1 && node.order !== 2) {
      addError('node_order', `Orden inválido (${node.order}); debe ser 1 o 2.`, node.id);
    }
    if (node.totalHours !== 54) {
      addError('node_hours', `totalHours=${node.totalHours}; la UAC BGE laboral debe tener 54 h.`, node.id);
    }
    if (node.weeklyHours !== 3) {
      addError('node_weekly_hours', `weeklyHours=${node.weeklyHours}; se esperan 3 h/semana.`, node.id);
    }
    if (node.blocks !== 3) {
      addError('node_blocks', `blocks=${node.blocks}; se esperan 3 bloques de 18 h.`, node.id);
    }
    totalHours += node.totalHours;

    if (!hasText(node.learningOutcome, 20)) {
      addError('node_outcome', 'Resultado de aprendizaje ausente o demasiado corto.', node.id);
    }
    if (!hasText(node.projectMilestone, 5)) {
      addError('node_project_milestone', 'La UAC no declara hito del proyecto integrador.', node.id);
    }
    if (node.contents.length < 4) {
      addWarning('node_contents', `Solo ${node.contents.length} contenidos; se recomiendan ≥ 4.`, node.id);
    }
    if (node.contents.some((content) => !hasText(content, 3) || PLACEHOLDER_RE.test(content))) {
      addError('node_contents_placeholder', 'Contenido vacío o con placeholder.', node.id);
    }
    if (node.sinco.length === 0) addWarning('node_sinco', 'Sin ocupación SINCO declarada.', node.id);
    if (node.scian.length === 0) addWarning('node_scian', 'Sin código SCIAN declarado.', node.id);

    if (node.keyActivities.length !== 3) {
      addError('node_activities_count', `La UAC tiene ${node.keyActivities.length} actividades clave; se esperan 3.`, node.id);
    }
    const activityHours = node.keyActivities.reduce((sum, activity) => sum + activity.hours, 0);
    if (activityHours !== node.totalHours) {
      addError(
        'node_activities_hours',
        `Horas de actividades=${activityHours} no coinciden con totalHours=${node.totalHours}.`,
        node.id
      );
    }
    for (const activity of node.keyActivities) {
      activityCount += 1;
      if (seenActivityIds.has(activity.id)) {
        addError('activity_duplicate_id', `ID de actividad duplicado: ${activity.id}.`, node.id);
      }
      seenActivityIds.add(activity.id);
      if (!hasText(activity.name, 10)) {
        addError('activity_name', `Actividad sin nombre válido: ${activity.id}.`, node.id);
      }
      if (activity.hours !== 18) {
        addError('activity_hours', `Actividad ${activity.id} tiene ${activity.hours} h; se esperan 18.`, node.id);
      }
      if (!hasText(activity.description, 20)) {
        addWarning('activity_description', `Actividad ${activity.id} sin descripción suficiente.`, node.id);
      }
    }
  }

  for (const semester of EXPECTED_SEMESTERS) {
    const count = perSemester.get(semester) ?? 0;
    if (count !== 2) {
      addError('semester_distribution', `Semestre ${semester} tiene ${count} UAC; se esperan 2.`);
    }
  }
  if (nodes.length !== 8) {
    addError('node_count', `La trayectoria tiene ${nodes.length} UAC; se esperan 8.`);
  }
  if (activityCount !== 24) {
    addError('activity_count', `La trayectoria tiene ${activityCount} actividades clave; se esperan 24.`);
  }
  if (totalHours !== trajectory.totalHours) {
    addError('total_hours', `Suma de horas=${totalHours} no coincide con totalHours=${trajectory.totalHours}.`);
  }

  // ── Prerrequisitos (DAG) ──────────────────────────────────────────────────
  for (const node of nodes) {
    for (const prerequisiteId of node.prerequisites) {
      if (prerequisiteId === node.id) {
        addError('prereq_self', `La UAC ${node.id} se declara prerrequisito de sí misma.`, node.id);
        continue;
      }
      const prerequisite = byId.get(prerequisiteId);
      if (!prerequisite) {
        addError('prereq_missing', `Prerrequisito inexistente: ${prerequisiteId}.`, node.id);
        continue;
      }
      const sameSemester = prerequisite.semester === node.semester;
      if (prerequisite.semester > node.semester) {
        addError(
          'prereq_future',
          `Prerrequisito ${prerequisiteId} (${prerequisite.semester}°) es posterior a ${node.id} (${node.semester}°).`,
          node.id
        );
      } else if (sameSemester && prerequisite.order >= node.order) {
        addError(
          'prereq_order',
          `En el mismo semestre, ${prerequisiteId} debe ir antes que ${node.id}.`,
          node.id
        );
      }
    }
  }

  const cycle = detectCycle(nodes);
  if (cycle) {
    addError('prereq_cycle', `Ciclo de prerrequisitos detectado: ${cycle.join(' → ')}.`);
  }

  // ── Proyecto integrador ───────────────────────────────────────────────────
  const milestones = Array.isArray(trajectory.project?.milestones)
    ? trajectory.project.milestones
    : [];
  if (milestones.length !== EXPECTED_SEMESTERS.length) {
    addError('project_milestones', `Hay ${milestones.length} hitos; se esperan 4 (uno por semestre).`);
  }
  const covered = new Map<string, number>();
  for (const milestone of milestones) {
    if (!EXPECTED_SEMESTERS.includes(milestone.semester)) {
      addError('project_semester', `Hito con semestre inválido: ${milestone.semester}.`);
    }
    if (!hasText(milestone.title, 5) || !hasText(milestone.description, 20)) {
      addError('project_text', `Hito del semestre ${milestone.semester} incompleto.`);
    }
    if (!hasText(milestone.evidence, 10)) {
      addWarning('project_evidence', `Hito del semestre ${milestone.semester} sin evidencia suficiente.`);
    }
    for (const uacId of milestone.linkedUacs) {
      const node = byId.get(uacId);
      if (!node) {
        addError('project_uac_missing', `Hito ${milestone.title} referencia UAC inexistente: ${uacId}.`);
        continue;
      }
      if (node.semester !== milestone.semester) {
        addError(
          'project_uac_semester',
          `Hito del semestre ${milestone.semester} referencia ${uacId} del semestre ${node.semester}.`,
          uacId
        );
      }
      covered.set(uacId, (covered.get(uacId) ?? 0) + 1);
    }
  }
  for (const node of nodes) {
    const count = covered.get(node.id) ?? 0;
    if (count !== 1) {
      addError('project_coverage', `La UAC ${node.id} aparece ${count} veces en el proyecto; se espera 1.`, node.id);
    }
  }
  if (!hasText(trajectory.project?.finalProduct, 20)) {
    addError('project_product', 'Falta el producto final del proyecto integrador.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      nodes: nodes.length,
      activities: activityCount,
      totalHours,
      semesters: [...new Set(nodes.map((node) => node.semester))].sort(),
      projectMilestones: milestones.length,
    },
  };
}
