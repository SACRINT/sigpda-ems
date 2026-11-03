import { describe, expect, it } from 'vitest';
import {
  buildPlanningActivityHeading,
  buildPlanningActivityLabel,
  parseCorteNumber,
  parseProgressionNumber,
  resolvePlanningActivityNumber,
  resolvePlanningBlockNumber,
} from '@/lib/planning-activity-labels';

const progressionActivities = Array.from({ length: 8 }, (_, index) => ({
  name: `Progresión ${index + 1}: Contenido ${index + 1}`,
  order: index + 1,
  corte: index < 3 ? 'Corte 1' : index < 6 ? 'Corte 2' : 'Corte 3',
}));

describe('Etiquetas de bloque, actividad y progresión', () => {
  it('no usa Unidad y numera solo 3 bloques por semestre', () => {
    const labels = [0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
      buildPlanningActivityLabel(progressionActivities[index], index, progressionActivities, {
        isProgresiones: true,
      })
    );

    expect(labels).toEqual([
      'Bloque 1 / Actividad 1 / Progresión 1',
      'Bloque 1 / Actividad 2 / Progresión 2',
      'Bloque 1 / Actividad 3 / Progresión 3',
      'Bloque 2 / Actividad 1 / Progresión 4',
      'Bloque 2 / Actividad 2 / Progresión 5',
      'Bloque 2 / Actividad 3 / Progresión 6',
      'Bloque 3 / Actividad 1 / Progresión 7',
      'Bloque 3 / Actividad 2 / Progresión 8',
    ]);
    expect(labels.join(' ')).not.toMatch(/UNIDAD/i);
  });

  it('calcula bloque 1 a 3 a partir de corte o de la posición cuando no existe corte', () => {
    expect(resolvePlanningBlockNumber(progressionActivities[3], 3, progressionActivities)).toBe(2);
    expect(parseCorteNumber('Corte 3')).toBe(3);
    expect(parseCorteNumber('Bloque 2')).toBe(2);
    expect(parseCorteNumber('sin corte')).toBeNull();

    const withoutCorte = [{ name: 'Uno' }, { name: 'Dos' }, { name: 'Tres' }];
    expect(withoutCorte.map((activity, index) => resolvePlanningBlockNumber(activity, index, withoutCorte))).toEqual([
      1, 2, 3,
    ]);
  });

  it('reinicia el número de actividad dentro de cada bloque', () => {
    expect(resolvePlanningActivityNumber(progressionActivities[0], 0, progressionActivities)).toBe(1);
    expect(resolvePlanningActivityNumber(progressionActivities[3], 3, progressionActivities)).toBe(1);
    expect(resolvePlanningActivityNumber(progressionActivities[6], 6, progressionActivities)).toBe(1);
  });

  it('tolera nombres sin prefijo oficial de progresión y conserva el número de orden', () => {
    expect(parseProgressionNumber('Progresión 7: Aplica...')).toBe(7);
    expect(
      buildPlanningActivityHeading(
        { name: 'Aplica técnicas algebraicas', order: 7, corte: 'Corte 3' },
        6,
        progressionActivities,
        { isProgresiones: true, uppercase: true }
      )
    ).toBe('BLOQUE 3 / ACTIVIDAD 1 / PROGRESIÓN 7: Aplica técnicas algebraicas');
  });

  it('omite la progresión en planes que no son de progresiones', () => {
    const activities = [
      { name: 'Actividad clave uno', corte: 'Corte 1' },
      { name: 'Actividad clave dos', corte: 'Corte 2' },
      { name: 'Actividad clave tres', corte: 'Corte 3' },
    ];

    expect(
      buildPlanningActivityHeading(activities[1], 1, activities, { uppercase: true })
    ).toBe('BLOQUE 2 / ACTIVIDAD 1: Actividad clave dos');
  });
});
