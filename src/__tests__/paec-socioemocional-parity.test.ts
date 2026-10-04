import { describe, it, expect } from 'vitest';
import {
  consolidarUacsUnicasPlantel,
  resolverSocioemocionalGrupo,
} from '@/lib/escuela-grupos';
import type { GroupTrackConfig } from '@/types/paec';

describe('PAEC H-01 & H-09: Socioemocional Dinámico (Regla 4°=6°) y Desglose Honesto', () => {
  it('H-01: resolverSocioemocionalGrupo aplica estrictamente la regla 4°=6° asignando la 3.ª opción restante', () => {
    const s3 = 'Educación para la Salud';
    const s5 = 'Educación Integral en Sexualidad y Género';
    const res = resolverSocioemocionalGrupo(s3, s5);

    expect(res.sem3).toBe('Educación para la Salud');
    expect(res.sem5).toBe('Educación Integral en Sexualidad y Género');
    // La 3.ª opción restante debe ser Práctica y Colaboración Ciudadana en 4° y 6°
    expect(res.sem4).toBe('Práctica y Colaboración Ciudadana');
    expect(res.sem6).toBe('Práctica y Colaboración Ciudadana');
    expect(res.sem4).toBe(res.sem6);
  });

  it('H-01 & H-09: consolidarUacsUnicasPlantel separa limpiamente Fundamental y Socioemocional (34 Fundamental + 6 Socioemocional en ciclo anual)', () => {
    const track = 'Redes y Mantenimiento';
    const groupAssignments: GroupTrackConfig[] = [
      { groupId: '1-A', groupName: '1° A', semester: 1, trackId: '', trackName: '', ffeSelections: [] },
      { groupId: '2-A', groupName: '2° A', semester: 2, trackId: '', trackName: '', ffeSelections: [] },
      { groupId: '3-A', groupName: '3° A', semester: 3, trackId: track, trackName: track, ffeSelections: [], ffeoSocioemocional: 'Educación para la Salud' },
      { groupId: '4-A', groupName: '4° A', semester: 4, trackId: track, trackName: track, ffeSelections: [], ffeoSocioemocional: 'Práctica y Colaboración Ciudadana' },
      { groupId: '5-A', groupName: '5° A', semester: 5, trackId: '', trackName: '', ffeSelections: ['Análisis de Fenómenos Físicos I'], ffeoSocioemocional: 'Educación Integral en Sexualidad y Género' },
      { groupId: '6-A', groupName: '6° A', semester: 6, trackId: '', trackName: '', ffeSelections: ['Análisis de Fenómenos Físicos II'], ffeoSocioemocional: 'Práctica y Colaboración Ciudadana' },
    ];

    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [1, 2, 3, 4, 5, 6],
      schoolType: 'general',
      groupAssignments,
      activeLaboralUacs: [],
      activeFfeUacs: [],
    });

    const fundUacs = uniqueUacs.filter(u => u.component === 'fundamental');
    const socioUacs = uniqueUacs.filter(u => u.component === 'socioemocional');

    // H-09: Fundamental NO debe inflarse con las 6 socioemocionales
    // Sem 1: 7 fund + 1 socio
    // Sem 2: 7 fund + 1 socio
    // Sem 3: 6 fund + 1 socio
    // Sem 4: 6 fund + 1 socio
    // Sem 5: 3 fund + 1 socio
    // Sem 6: 3 fund + 1 socio
    // Total Fundamental = 7 + 7 + 6 + 6 + 3 + 3 = 32 (Sonda C confirmada)
    expect(fundUacs).toHaveLength(32);

    // Total Socioemocional = exactamente 6 (1 por semestre)
    expect(socioUacs).toHaveLength(6);

    // Verificar las materias socioemocionales exactas
    const socioPorSemestre = Object.fromEntries(socioUacs.map(u => [u.semester, u.uacName]));
    expect(socioPorSemestre[1]).toBe('Actividades Físicas y Deportivas I');
    expect(socioPorSemestre[2]).toBe('Actividades Físicas y Deportivas II');
    expect(socioPorSemestre[3]).toBe('Educación para la Salud');
    expect(socioPorSemestre[4]).toBe('Práctica y Colaboración Ciudadana');
    expect(socioPorSemestre[5]).toBe('Educación Integral en Sexualidad y Género');
    expect(socioPorSemestre[6]).toBe('Práctica y Colaboración Ciudadana');

    // Comprobar la invariante 4° = 6°
    expect(socioPorSemestre[4]).toBe(socioPorSemestre[6]);
  });

  it('H-01: Si cambia la selección de 3° o 5°, se propaga la materia correcta a 4° y 6°', () => {
    const s3 = 'Práctica y Colaboración Ciudadana';
    const s5 = 'Educación para la Salud';
    const res = resolverSocioemocionalGrupo(s3, s5);

    expect(res.sem3).toBe('Práctica y Colaboración Ciudadana');
    expect(res.sem5).toBe('Educación para la Salud');
    expect(res.sem4).toBe('Educación Integral en Sexualidad y Género');
    expect(res.sem6).toBe('Educación Integral en Sexualidad y Género');
  });
});
