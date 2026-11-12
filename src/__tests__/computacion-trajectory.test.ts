import { describe, expect, it } from 'vitest';
import { COMPUTACION_REDES_TRAJECTORY } from '@/lib/curriculum/trajectories/computacion-redes';
import {
  findTrajectoryNodeByUacName,
  getCurriculumTrajectory,
} from '@/lib/curriculum/trajectories';
import { validateCurriculumTrajectory } from '@/lib/curriculum/trajectory-validator';
import {
  buildFormativeContents,
  validateFormativeContents,
} from '@/lib/curriculum/trajectory-contents';

describe('Trayectoria Computación y Redes (BGE Puebla 2024)', () => {
  it('1. Es un DAG acíclico formalmente válido de 8 UACs y 24 actividades clave', () => {
    const report = validateCurriculumTrajectory(COMPUTACION_REDES_TRAJECTORY);

    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.stats.nodes).toBe(8);
    expect(report.stats.activities).toBe(24);
    expect(report.stats.totalHours).toBe(432);
    expect(report.stats.projectMilestones).toBe(4);
    expect(report.stats.semesters).toEqual([3, 4, 5, 6]);
  });

  it('2. Cada UAC tiene exactamente 3 actividades clave de 18 h (54 h totales por UAC)', () => {
    for (const node of COMPUTACION_REDES_TRAJECTORY.nodes) {
      expect(node.totalHours).toBe(54);
      expect(node.weeklyHours).toBe(3);
      expect(node.blocks).toBe(3);
      expect(node.keyActivities).toHaveLength(3);
      expect(node.keyActivities.every((activity) => activity.hours === 18)).toBe(true);
      expect(node.keyActivities.reduce((sum, activity) => sum + activity.hours, 0)).toBe(54);
      expect(node.keyActivities.every((activity) => activity.contents.length > 0)).toBe(true);
    }
  });

  it('3. Genera contenidos_formativos canónicos oficiales con needs_review=false', () => {
    const report = validateFormativeContents(COMPUTACION_REDES_TRAJECTORY);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);

    for (const node of COMPUTACION_REDES_TRAJECTORY.nodes) {
      const items = buildFormativeContents(node);
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item.needs_review).toBe(false);
        expect(item.source).toBe('official_pdf_2024');
        expect(item.contenidos.length).toBeGreaterThan(0);
      }
    }
  });

  it('4. Está registrada en el índice global y se encuentra por uacName', () => {
    const trajectory = getCurriculumTrajectory('computacion-redes-bge-2024');
    expect(trajectory).toBeDefined();
    expect(trajectory?.totalHours).toBe(432);

    const match = findTrajectoryNodeByUacName(
      'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante'
    );
    expect(match).toBeDefined();
    expect(match?.node.id).toBe('CR-3.1');
    expect(match?.node.semester).toBe(3);
  });
});
