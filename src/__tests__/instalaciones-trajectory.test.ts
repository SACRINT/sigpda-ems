import { describe, expect, it } from 'vitest';
import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '@/lib/curriculum/trajectories/instalaciones-residenciales';
import {
  findTrajectoryNodeByUacName,
  getCurriculumTrajectory,
} from '@/lib/curriculum/trajectories';
import { validateCurriculumTrajectory } from '@/lib/curriculum/trajectory-validator';
import {
  buildFormativeContents,
  validateFormativeContents,
} from '@/lib/curriculum/trajectory-contents';
import type { CurriculumTrajectory } from '@/lib/curriculum/trajectory-types';

function cloneTrajectory(): CurriculumTrajectory {
  return JSON.parse(JSON.stringify(INSTALACIONES_RESIDENCIALES_TRAJECTORY)) as CurriculumTrajectory;
}

describe('trayectoria Instalaciones Residenciales (BGE 2024)', () => {
  it('es un DAG válido de 8 UAC y 24 actividades clave', () => {
    const report = validateCurriculumTrajectory(INSTALACIONES_RESIDENCIALES_TRAJECTORY);

    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats.nodes).toBe(8);
    expect(report.stats.activities).toBe(24);
    expect(report.stats.totalHours).toBe(432);
    expect(report.stats.projectMilestones).toBe(4);
    expect(report.stats.semesters).toEqual([3, 4, 5, 6]);
  });

  it('cada UAC tiene 3 actividades de 18 h y 54 h totales', () => {
    for (const node of INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes) {
      expect(node.totalHours).toBe(54);
      expect(node.weeklyHours).toBe(3);
      expect(node.blocks).toBe(3);
      expect(node.keyActivities).toHaveLength(3);
      expect(node.keyActivities.every((activity) => activity.hours === 18)).toBe(true);
      expect(node.keyActivities.reduce((sum, activity) => sum + activity.hours, 0)).toBe(54);
      expect(node.keyActivities.every((activity) => activity.contents.length > 0)).toBe(true);
    }
  });

  it('genera contenidos_formativos canónicos: 3 entradas por UAC con temas oficiales', () => {
    const report = validateFormativeContents(INSTALACIONES_RESIDENCIALES_TRAJECTORY);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);

    for (const node of INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes) {
      const items = buildFormativeContents(node);
      expect(items).toHaveLength(3);
      expect(items.map((item) => item.numero)).toEqual([1, 2, 3]);
      for (const [index, item] of items.entries()) {
        expect(item.actividad_clave).toBe(node.keyActivities[index].name);
        expect(item.contenidos).toEqual(node.keyActivities[index].contents);
        expect(item.contenidos.length).toBeGreaterThan(0);
        expect(item.source).toBe('official_pdf_2024');
        expect(item.needs_review).toBe(false);
      }
    }
  });

  it('los prerrequisitos siempre apuntan a UAC anteriores', () => {
    const byId = new Map(INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes.map((node) => [node.id, node]));
    for (const node of INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes) {
      for (const prerequisiteId of node.prerequisites) {
        const prerequisite = byId.get(prerequisiteId);
        expect(prerequisite).toBeDefined();
        if (!prerequisite) continue;
        const earlierSemester = prerequisite.semester < node.semester;
        const earlierInSameSemester =
          prerequisite.semester === node.semester && prerequisite.order < node.order;
        expect(earlierSemester || earlierInSameSemester).toBe(true);
      }
    }
  });

  it('el proyecto integrador cubre las 8 UAC exactamente una vez', () => {
    const covered = INSTALACIONES_RESIDENCIALES_TRAJECTORY.project.milestones.flatMap(
      (milestone) => milestone.linkedUacs
    );
    expect(covered).toHaveLength(8);
    expect(new Set(covered).size).toBe(8);
    expect(covered.sort()).toEqual(
      INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes.map((node) => node.id).sort()
    );
  });

  it('detecta un ciclo de prerrequisitos', () => {
    const trajectory = cloneTrajectory();
    const first = trajectory.nodes.find((node) => node.id === 'IR-3.1');
    expect(first).toBeDefined();
    if (first) first.prerequisites = ['IR-6.2'];

    const report = validateCurriculumTrajectory(trajectory);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.code === 'prereq_cycle')).toBe(true);
  });

  it('detecta horas de actividad inconsistentes', () => {
    const trajectory = cloneTrajectory();
    const first = trajectory.nodes[0];
    first.keyActivities[0].hours = 12;

    const report = validateCurriculumTrajectory(trajectory);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.code === 'activity_hours')).toBe(true);
  });

  it('detecta actividades sin contenidos formativos', () => {
    const trajectory = cloneTrajectory();
    trajectory.nodes[0].keyActivities[0].contents = [];

    const report = validateCurriculumTrajectory(trajectory);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.code === 'activity_contents')).toBe(true);
  });

  it('se localiza por id y por nombre de UAC (con acentos y mayúsculas)', () => {
    expect(getCurriculumTrajectory('instalaciones-residenciales-bge-2024')).toBe(
      INSTALACIONES_RESIDENCIALES_TRAJECTORY
    );
    const found = findTrajectoryNodeByUacName(
      'COLOCA MUEBLES, TUBERÍAS Y CONEXIONES DE ACUERDO CON INSTRUCCIONES'
    );
    expect(found?.node.id).toBe('IR-6.1');
    expect(found?.trajectory.id).toBe(INSTALACIONES_RESIDENCIALES_TRAJECTORY.id);
  });
});
