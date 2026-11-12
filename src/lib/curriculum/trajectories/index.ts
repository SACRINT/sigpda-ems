/**
 * Registro de trayectorias curriculares disponibles.
 *
 * La malla de Instalaciones Residenciales es la primera trayectoria piloto.
 * Redes y Mantenimiento y Tecnología Informática se incorporarán después de
 * validar el patrón N4 con este currículum.
 */

import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from './instalaciones-residenciales';
import { COMPUTACION_REDES_TRAJECTORY } from './computacion-redes';
import type { CurriculumTrajectory, TrajectoryNode } from '../trajectory-types';

export { INSTALACIONES_RESIDENCIALES_TRAJECTORY, COMPUTACION_REDES_TRAJECTORY };

export const CURRICULUM_TRAJECTORIES: readonly CurriculumTrajectory[] = [
  INSTALACIONES_RESIDENCIALES_TRAJECTORY,
  COMPUTACION_REDES_TRAJECTORY,
];

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export function getCurriculumTrajectory(id: string): CurriculumTrajectory | undefined {
  return CURRICULUM_TRAJECTORIES.find((trajectory) => trajectory.id === id);
}

export function findTrajectoryNodeByUacName(
  uacName: string
): { trajectory: CurriculumTrajectory; node: TrajectoryNode } | undefined {
  const target = normalize(uacName);
  if (!target) return undefined;

  for (const trajectory of CURRICULUM_TRAJECTORIES) {
    const node = trajectory.nodes.find((candidate) => normalize(candidate.uacName) === target);
    if (node) return { trajectory, node };
  }
  return undefined;
}
