import { describe, it, expect } from 'vitest';
import {
  consolidarUacsUnicasPlantel,
  toggleGroupFfeSubject,
  removeGroupFfeSubject,
  clearGroupFfeSubjects,
} from '@/lib/escuela-grupos';
import { UACS_LABORALES_OFICIALES_BGE } from '@/lib/capacitaciones-data';
import { getMissingStep1Fields } from '@/lib/prompts/paec-extraction';
import type { GroupTrackConfig } from '@/types/paec';

describe('PAEC H-02 & H-03: Paridad Curricular Laboral y Validación de Paso 1', () => {
  it('H-02: Una sola capacitación asignada (Redes y Mantenimiento) genera exactamente 8 UACs en ciclo anual (nunca 16)', () => {
    const track = 'Redes y Mantenimiento';
    const groupAssignments: GroupTrackConfig[] = [
      { groupId: '1-A', groupName: '1° A', semester: 1, trackId: '', trackName: '', ffeSelections: [] },
      { groupId: '2-A', groupName: '2° A', semester: 2, trackId: '', trackName: '', ffeSelections: [] },
      { groupId: '3-A', groupName: '3° A', semester: 3, trackId: track, trackName: track, ffeSelections: [] },
      { groupId: '4-A', groupName: '4° A', semester: 4, trackId: track, trackName: track, ffeSelections: [] },
      { groupId: '5-A', groupName: '5° A', semester: 5, trackId: '', trackName: '', ffeSelections: ['Análisis de Fenómenos Físicos I'] },
      { groupId: '6-A', groupName: '6° A', semester: 6, trackId: '', trackName: '', ffeSelections: ['Análisis de Fenómenos Físicos II'] },
    ];

    // Derivar selectedLaboral a partir de los grupos asignados (patrón Single Source of Truth)
    const assignedTracks = Array.from(new Set(groupAssignments.filter(g => Boolean(g.trackName)).map(g => g.trackName as string)));
    expect(assignedTracks).toEqual(['Redes y Mantenimiento']);

    const derivedLaboralUacs: string[] = [];
    for (const t of assignedTracks) {
      const sems = UACS_LABORALES_OFICIALES_BGE[t];
      if (sems) {
        for (const uacList of Object.values(sems) as string[][]) {
          for (const u of uacList) {
            if (!derivedLaboralUacs.includes(u)) derivedLaboralUacs.push(u);
          }
        }
      }
    }

    expect(derivedLaboralUacs).toHaveLength(8);

    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [1, 2, 3, 4, 5, 6],
      schoolType: 'general',
      groupAssignments,
      activeLaboralUacs: derivedLaboralUacs,
      activeFfeUacs: ['Análisis de Fenómenos Físicos I', 'Análisis de Fenómenos Físicos II'],
    });

    const laboralConsolidadas = uniqueUacs.filter(u => u.component === 'laboral');
    // DEBE SER EXACTAMENTE 8, NUNCA 16
    expect(laboralConsolidadas).toHaveLength(8);

    // Verificar que solo pertenecen a Redes y Mantenimiento
    for (const u of laboralConsolidadas) {
      expect(u.originTrack).toBe('Redes y Mantenimiento');
    }
  });

  it('H-02: En ciclo A (1, 3, 5), una capacitación genera exactamente 4 UACs laborales (semestres 3 y 5)', () => {
    const track = 'Redes y Mantenimiento';
    const groupAssignments: GroupTrackConfig[] = [
      { groupId: '1-A', groupName: '1° A', semester: 1, trackId: '', trackName: '', ffeSelections: [] },
      { groupId: '3-A', groupName: '3° A', semester: 3, trackId: track, trackName: track, ffeSelections: [] },
      { groupId: '5-A', groupName: '5° A', semester: 5, trackId: '', trackName: '', ffeSelections: ['Análisis de Fenómenos Físicos I'] },
    ];

    const derivedLaboralUacs: string[] = [];
    for (const uacList of Object.values(UACS_LABORALES_OFICIALES_BGE[track]) as string[][]) {
      for (const u of uacList) {
        if (!derivedLaboralUacs.includes(u)) derivedLaboralUacs.push(u);
      }
    }

    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [1, 3, 5],
      schoolType: 'general',
      groupAssignments,
      activeLaboralUacs: derivedLaboralUacs,
    });

    const laboralConsolidadas = uniqueUacs.filter(u => u.component === 'laboral');
    expect(laboralConsolidadas).toHaveLength(4);
    expect(laboralConsolidadas.map(u => u.semester).sort()).toEqual([3, 3, 5, 5]);
  });

  it('H-02: Dos capacitaciones legítimas asignadas a grupos distintos generan 16 UACs (8 cada una)', () => {
    const groupAssignments: GroupTrackConfig[] = [
      { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Redes y Mantenimiento', trackName: 'Redes y Mantenimiento', ffeSelections: [] },
      { groupId: '3-B', groupName: '3° B', semester: 3, trackId: 'Contabilidad', trackName: 'Contabilidad', ffeSelections: [] },
    ];

    const assignedTracks = ['Redes y Mantenimiento', 'Contabilidad'];
    const derivedLaboralUacs: string[] = [];
    for (const t of assignedTracks) {
      for (const uacList of Object.values(UACS_LABORALES_OFICIALES_BGE[t]) as string[][]) {
        for (const u of uacList) {
          if (!derivedLaboralUacs.includes(u)) derivedLaboralUacs.push(u);
        }
      }
    }

    expect(derivedLaboralUacs).toHaveLength(16);

    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [1, 2, 3, 4, 5, 6],
      schoolType: 'general',
      groupAssignments,
      activeLaboralUacs: derivedLaboralUacs,
    });

    const laboralConsolidadas = uniqueUacs.filter(u => u.component === 'laboral');
    expect(laboralConsolidadas).toHaveLength(16);
  });

  it('H-03: isStep1Valid y getMissingStep1Fields exigen selectedLaboral cuando hay semestres laborales', () => {
    const baseParams = {
      projectName: 'Proyecto Escolar Sustentable',
      problemStatement: 'Problemática de deserción e integración',
      community: {
        location: 'Comunidad Rural',
        demographics: 'Población de 2500 hab',
        economy: 'Agricultura y ganadería',
        traditions: 'Fiestas patronales',
        environment: '',
        security: '',
      },
      school: {
        enrollment: '120',
        teacherCount: '8',
      },
    };

    // Caso 1: Semestres laborales activos pero selectedLaboralCount === 0
    const missingSinLaboral = getMissingStep1Fields({
      ...baseParams,
      curricular: {
        hasLaboralSemesters: true,
        selectedLaboralCount: 0,
        hasFfeSemesters: false,
        selectedFfeCount: 0,
        isTecnico: false,
        selectedBtCarrerasCount: 0,
      },
    });

    expect(missingSinLaboral).toContain('Capacitación Laboral (Formación para el Trabajo)');

    // Caso 2: Con capacitación laboral seleccionada
    const missingConLaboral = getMissingStep1Fields({
      ...baseParams,
      curricular: {
        hasLaboralSemesters: true,
        selectedLaboralCount: 8,
        hasFfeSemesters: false,
        selectedFfeCount: 0,
        isTecnico: false,
        selectedBtCarrerasCount: 0,
      },
    });

    expect(missingConLaboral).not.toContain('Capacitación Laboral (Formación para el Trabajo)');
  });

  it('H-Multi-PAEC: Permite seleccionar un subconjunto específico de UACs laborales para un proyecto específico', () => {
    const track = 'Redes y Mantenimiento';
    const groupAssignments: GroupTrackConfig[] = [
      { groupId: '3-A', groupName: '3° A', semester: 3, trackId: track, trackName: track, ffeSelections: [] },
      { groupId: '4-A', groupName: '4° A', semester: 4, trackId: track, trackName: track, ffeSelections: [] },
    ];

    // El plantel ofrece Redes y Mantenimiento, pero para este PAEC específico solo participan 2 UACs de 3° semestre
    const subconjuntoSeleccionado = [
      'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante',
      'Usa técnicas y estrategias de mantenimiento del equipo de cómputo',
    ];

    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [3, 4],
      schoolType: 'general',
      groupAssignments,
      activeLaboralUacs: subconjuntoSeleccionado,
    });

    const laboralConsolidadas = uniqueUacs.filter(u => u.component === 'laboral');
    expect(laboralConsolidadas).toHaveLength(2);
    expect(laboralConsolidadas.map(u => u.uacName)).toEqual(subconjuntoSeleccionado);
  });

  it('H-Multi-PAEC: Permite seleccionar un subconjunto específico de UACs FFE para un proyecto específico', () => {
    const groupAssignments: GroupTrackConfig[] = [
      {
        groupId: '5-A',
        groupName: '5° A',
        semester: 5,
        trackId: '',
        trackName: '',
        ffeSelections: ['Análisis de Fenómenos Físicos I', 'Pensamiento Filosófico I'],
      },
      {
        groupId: '6-A',
        groupName: '6° A',
        semester: 6,
        trackId: '',
        trackName: '',
        ffeSelections: ['Análisis de Fenómenos Físicos II', 'Pensamiento Filosófico II'],
      },
    ];

    // El usuario selecciona solo la UAC de física para este PAEC de ciencias
    const subconjuntoFfe = ['Análisis de Fenómenos Físicos I', 'Análisis de Fenómenos Físicos II'];

    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [5, 6],
      schoolType: 'general',
      groupAssignments,
      activeFfeUacs: subconjuntoFfe,
    });

    const ffeConsolidadas = uniqueUacs.filter(u => u.component === 'ffe');
    expect(ffeConsolidadas).toHaveLength(2);
    expect(ffeConsolidadas.map(u => u.uacName).sort()).toEqual(subconjuntoFfe.sort());
  });

  it('F-R3-01: Preservación de capacitación laboral en 5° y 6° al asignar y modificar asignaturas FFE', () => {
    const track5 = 'Tecnología Informática';
    const group5: GroupTrackConfig = {
      groupId: '5-A',
      groupName: '5° A',
      semester: 5,
      trackId: track5,
      trackName: track5,
      ffeSelections: [],
    };
    const group6: GroupTrackConfig = {
      groupId: '6-A',
      groupName: '6° A',
      semester: 6,
      trackId: track5,
      trackName: track5,
      ffeSelections: [],
    };

    // Simular la interacción real del usuario marcando asignaturas FFE con toggleGroupFfeSubject
    let groups: GroupTrackConfig[] = [group5, group6];
    groups = toggleGroupFfeSubject(groups, '5-A', 'Inglés V', '6-A');
    groups = toggleGroupFfeSubject(groups, '5-A', 'Dibujo Técnico I', '6-A');

    const updatedGroup5 = groups.find(g => g.groupId === '5-A')!;
    const updatedGroup6 = groups.find(g => g.groupId === '6-A')!;

    // Verificar invariantes: trackId y trackName DEBEN conservar la capacitación laboral y NO ser 'Personalizado'
    expect(updatedGroup5.trackName).toBe(track5);
    expect(updatedGroup5.trackId).toBe(track5);
    expect(updatedGroup5.ffeSelections).toEqual(['Inglés V', 'Dibujo Técnico I']);
    expect(updatedGroup6.trackName).toBe(track5);
    expect(updatedGroup6.trackId).toBe(track5);
    expect(updatedGroup6.ffeSelections).toEqual(['Inglés VI', 'Dibujo Técnico II']);

    // Consolidación en el padrón curricular
    const uniqueUacs = consolidarUacsUnicasPlantel({
      semesters: [5, 6],
      schoolType: 'general',
      groupAssignments: [updatedGroup5, updatedGroup6],
    });

    const laboralConsolidadas = uniqueUacs.filter(u => u.component === 'laboral');
    const ffeConsolidadas = uniqueUacs.filter(u => u.component === 'ffe');

    // Debe incluir las 4 UACs laborales de Tecnología Informática en semestres 5° y 6°
    expect(laboralConsolidadas).toHaveLength(4);
    expect(laboralConsolidadas.every(u => u.originTrack === track5)).toBe(true);

    // Y además debe incluir las UACs de FFE seleccionadas
    expect(ffeConsolidadas.map(u => u.uacName).sort()).toEqual([
      'Dibujo Técnico I',
      'Dibujo Técnico II',
      'Inglés V',
      'Inglés VI',
    ]);
  });

  it('F-R5-03: removeGroupFfeSubject remueve asignatura en 5° y replica remoción en espejo de 6° sin mutar laboral', () => {
    const track = 'Tecnología Informática';
    let groups: GroupTrackConfig[] = [
      { groupId: '5-A', groupName: '5° A', semester: 5, trackId: track, trackName: track, ffeSelections: ['Inglés V', 'Dibujo Técnico I'] },
      { groupId: '6-A', groupName: '6° A', semester: 6, trackId: track, trackName: track, ffeSelections: ['Inglés VI', 'Dibujo Técnico II'] },
    ];

    // Quitar 'Dibujo Técnico I' de 5° A debe quitar 'Dibujo Técnico II' de 6° A automáticamente
    groups = removeGroupFfeSubject(groups, '5-A', 'Dibujo Técnico I', '6-A');

    const g5 = groups.find(g => g.groupId === '5-A')!;
    const g6 = groups.find(g => g.groupId === '6-A')!;

    expect(g5.ffeSelections).toEqual(['Inglés V']);
    expect(g6.ffeSelections).toEqual(['Inglés VI']);
    expect(g5.trackName).toBe(track);
    expect(g6.trackName).toBe(track);
  });

  it('F-R5-03: clearGroupFfeSubjects limpia completamente FFE en 5° y su espejo en 6° preservando laboral', () => {
    const track = 'Contabilidad';
    let groups: GroupTrackConfig[] = [
      { groupId: '5-B', groupName: '5° B', semester: 5, trackId: track, trackName: track, ffeSelections: ['Inglés V', 'Salud Integral I'] },
      { groupId: '6-B', groupName: '6° B', semester: 6, trackId: track, trackName: track, ffeSelections: ['Inglés VI', 'Salud Integral II'] },
    ];

    // Limpiar 5° B
    groups = clearGroupFfeSubjects(groups, '5-B', '6-B');

    const g5 = groups.find(g => g.groupId === '5-B')!;
    const g6 = groups.find(g => g.groupId === '6-B')!;

    expect(g5.ffeSelections).toEqual([]);
    expect(g6.ffeSelections).toEqual([]);
    expect(g5.trackName).toBe(track);
    expect(g6.trackName).toBe(track);
  });
});
