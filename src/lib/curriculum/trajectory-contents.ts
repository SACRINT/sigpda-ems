/**
 * trajectory-contents.ts — Convierte una UAC de la trayectoria en el arreglo
 * canónico `contenidos_formativos` que consume `programs_catalog`.
 *
 * La forma canónica es una entrada por actividad clave:
 *   { numero, proposito, actividad_clave, contenidos: string[], saberes }
 *
 * Los temas provienen de los contenidos oficiales declarados en la malla
 * (Instalaciones_Residenciales_2024.pdf); no se generan con IA.
 */

import type { CurriculumTrajectory, TrajectoryNode } from './trajectory-types';

export interface FormativeContentItem {
  numero: number;
  proposito: string;
  actividad_clave: string;
  contenidos: string[];
  saberes: string[];
  source: 'official_pdf_2024';
  needs_review: boolean;
}

export function buildFormativeContents(node: TrajectoryNode): FormativeContentItem[] {
  return node.keyActivities.map((activity, index) => ({
    numero: index + 1,
    proposito: `Actividad Clave ${index + 1}: ${activity.name}`,
    actividad_clave: activity.name,
    contenidos: [...activity.contents],
    saberes: [],
    source: 'official_pdf_2024',
    needs_review: false,
  }));
}

export function validateFormativeContents(
  trajectory: CurriculumTrajectory
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const node of trajectory.nodes) {
    const items = buildFormativeContents(node);
    if (items.length !== 3) {
      errors.push(`${node.id}: se esperan 3 entradas de contenidos, hay ${items.length}.`);
    }
    for (const item of items) {
      if (item.contenidos.length === 0) {
        errors.push(`${node.id}: la actividad ${item.numero} no tiene contenidos.`);
      }
      if (item.contenidos.some((content) => content.trim().length < 3)) {
        errors.push(`${node.id}: la actividad ${item.numero} tiene un contenido demasiado corto.`);
      }
      if (item.needs_review) {
        errors.push(`${node.id}: la actividad ${item.numero} quedó marcada para revisión.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
