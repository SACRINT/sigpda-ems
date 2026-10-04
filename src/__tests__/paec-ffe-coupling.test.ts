import { describe, it, expect } from 'vitest';
import {
  FFE_PAIRS,
  FFE_PACKAGES,
  FFE_CONTINUIDAD_5_A_6,
  obtenerFfeSemestre6,
  consolidarUacsUnicasPlantel,
} from '@/lib/escuela-grupos';
import { normalizeUacName, matchCurricularContent } from '@/lib/paec-curricular-helper';
import { BGE_UACS_MASTER } from '@/lib/bge-catalog';
import type { GroupTrackConfig } from '@/types/paec';
import type { PaecCatalogItem } from '@/lib/db/programs-catalog';

describe('H-04 / H-05: Acoplamiento FFE 5° ➔ 6° y Homologación contra Catálogo BGE', () => {

  // Test 1: 5° group selects 4 subjects -> 6° group couples to exactly those 4 continuations
  describe('Test 1: Acoplamiento automático de asignaturas 5° ➔ 6°', () => {
    it('debe mapear con precisión las 4 materias de un paquete propedéutico a su continuidad en 6°', () => {
      const fisMat = FFE_PACKAGES['fisico_matematico'].subjects;
      expect(fisMat).toHaveLength(4);

      const contin = fisMat.map(s => obtenerFfeSemestre6(s));
      expect(contin).toEqual([
        'Análisis de Fenómenos Físicos II',
        'Dibujo Técnico II',
        'Taller Pensamiento Variacional II',
        'Taller de Probabilidad y Estadística II',
      ]);
    });

    it('todas las 20 materias de 5° en FFE_PAIRS se mapean determinísticamente a su par de 6°', () => {
      expect(FFE_PAIRS).toHaveLength(20);
      for (const pair of FFE_PAIRS) {
        expect(obtenerFfeSemestre6(pair.name5)).toBe(pair.name6);
      }
    });

    it('soporta alias y variantes históricas sin romper la continuidad (Avanzado, Taller de)', () => {
      expect(obtenerFfeSemestre6('Inglés V (Avanzado)')).toBe('Inglés VI (Avanzado)');
      expect(obtenerFfeSemestre6('Inglés V')).toBe('Inglés VI');
      expect(obtenerFfeSemestre6('Taller de Pensamiento Variacional I')).toBe('Taller de Pensamiento Variacional II');
      expect(obtenerFfeSemestre6('Taller Pensamiento Variacional I')).toBe('Taller Pensamiento Variacional II');
      expect(obtenerFfeSemestre6('Economía I')).toBe('Economía II');
      expect(obtenerFfeSemestre6('Economía I. La Función de los Agentes Económicos en la Sociedad')).toBe(
        'Economía II. Política Económica y Política Pública Mexicana'
      );
    });
  });

  // Test 2: Drift test comparando FFE_PAIRS y FFE_CONTINUIDAD contra bge-catalog.ts
  describe('Test 2: Control de deriva (drift test) contra BGE_UACS_MASTER', () => {
    it('las asignaturas de FFE_PAIRS existen en el catálogo curricular oficial de BGE', () => {
      const catalogNames = new Set(BGE_UACS_MASTER.map(c => normalizeUacName(c.uacName)));

      for (const pair of FFE_PAIRS) {
        const norm5 = normalizeUacName(pair.name5);
        const norm6 = normalizeUacName(pair.name6);

        expect(catalogNames.has(norm5)).toBe(true);
        expect(catalogNames.has(norm6)).toBe(true);
      }
    });

    it('las duplas de FFE_CONTINUIDAD_5_A_6 tienen coherencia semestral (5° ➔ 6°)', () => {
      for (const [m5, m6] of Object.entries(FFE_CONTINUIDAD_5_A_6)) {
        const norm5 = normalizeUacName(m5);
        const norm6 = normalizeUacName(m6);
        const item5 = BGE_UACS_MASTER.find(c => normalizeUacName(c.uacName) === norm5);
        const item6 = BGE_UACS_MASTER.find(c => normalizeUacName(c.uacName) === norm6);

        if (item5) expect(item5.semester).toBe(5);
        if (item6) expect(item6.semester).toBe(6);
      }
    });
  });

  // Test 3: matchCurricularContent normaliza variantes sin degradarse a fallback
  describe('Test 3: matchCurricularContent con normalización textual (H-05)', () => {
    const mockCatalog: PaecCatalogItem[] = [
      {
        uac_name: 'Inglés V',
        semester: 5,
        component: 'ffe',
        contenidos_formativos: [{ numero: 1, progresion: 'Progresión 1 de Inglés V' }],
      },
      {
        uac_name: 'Taller Pensamiento Variacional I',
        semester: 5,
        component: 'ffe',
        contenidos_formativos: [{ numero: 1, progresion: 'Progresión 1 de Variacional' }],
      },
      {
        uac_name: 'Economía I. La Función de los Agentes Económicos en la Sociedad',
        semester: 5,
        component: 'ffe',
        contenidos_formativos: [{ numero: 1, progresion: 'Progresión 1 de Economía' }],
      },
    ];

    it('empareja correctamente "Inglés V (Avanzado)" con "Inglés V"', () => {
      const match = matchCurricularContent('Inglés V (Avanzado)', 5, mockCatalog);
      expect(match).toBeDefined();
      expect(match?.uac_name).toBe('Inglés V');
    });

    it('empareja correctamente "Taller de Pensamiento Variacional I" con "Taller Pensamiento Variacional I"', () => {
      const match = matchCurricularContent('Taller de Pensamiento Variacional I', 5, mockCatalog);
      expect(match).toBeDefined();
      expect(match?.uac_name).toBe('Taller Pensamiento Variacional I');
    });

    it('empareja "Economía I" con el nombre expandido oficial de catálogo', () => {
      const match = matchCurricularContent('Economía I', 5, mockCatalog);
      expect(match).toBeDefined();
      expect(match?.uac_name).toContain('Economía I');
    });
  });

  // Test 4: Consolidación limpia de UACs de FFE acopladas
  describe('Test 4: Consolidación de UACs únicas para grupos 5° y 6° acoplados', () => {
    it('consolida 4 UACs para 5° y sus 4 continuaciones para 6° sin duplicados', () => {
      const ffe5 = ['Análisis de Fenómenos Físicos I', 'Dibujo Técnico I', 'Taller Pensamiento Variacional I', 'Taller de Probabilidad y Estadística I'];
      const ffe6 = ffe5.map(s => obtenerFfeSemestre6(s));

      const groups: GroupTrackConfig[] = [
        {
          groupId: '5-A',
          groupName: '5° A',
          semester: 5,
          trackId: 'fisico_matematico',
          trackName: '📐 Físico-Matemático',
          ffeSelections: ffe5,
        },
        {
          groupId: '6-A',
          groupName: '6° A',
          semester: 6,
          trackId: 'fisico_matematico',
          trackName: '📐 Físico-Matemático',
          ffeSelections: ffe6,
        },
      ];

      const uacs = consolidarUacsUnicasPlantel({
        semesters: [5, 6],
        groupAssignments: groups,
        activeFundamentalUacs: [],
        activeLaboralUacs: [],
        activeFfeUacs: [],
        activeBtCarreras: [],
        schoolType: 'general',
      });

      const ffeUacs = uacs.filter(u => u.component === 'ffe');
      expect(ffeUacs).toHaveLength(8);

      const ffeSem5 = ffeUacs.filter(u => u.semester === 5);
      const ffeSem6 = ffeUacs.filter(u => u.semester === 6);
      expect(ffeSem5).toHaveLength(4);
      expect(ffeSem6).toHaveLength(4);

      // Verificar que cada UAC de 5° tiene su continuación en 6°
      for (const u5 of ffeSem5) {
        const expected6 = obtenerFfeSemestre6(u5.uacName);
        expect(ffeSem6.some(u6 => u6.uacName === expected6)).toBe(true);
      }
    });
  });
});
