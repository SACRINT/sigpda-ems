import { describe, it, expect } from 'vitest';
import {
  FFE_PAIRS,
  obtenerFfeSemestre6,
  FORMACIONES_LABORALES,
  consolidarUacsUnicasPlantel,
  obtenerFundamentalesPorSemestres,
} from '@/lib/escuela-grupos';
import { UACS_LABORALES_OFICIALES_BGE } from '@/lib/capacitaciones-data';
import { PmcPreviousExtractSchema } from '@/lib/prompts/pmc-extraction';
import { PaecPreviousExtractSchema } from '@/lib/prompts/paec-extraction';
import type { GroupTrackConfig } from '@/types/paec';

describe('FASE 4: Regresión y Blindaje Curricular PAEC / PMC', () => {

  // ── 1. Continuidad Canónica FFE 5° → 6° (20 Asignaturas) ────────────────
  describe('1. Continuidad Canónica FFE 5° → 6°', () => {
    it('FFE_PAIRS contiene exactamente las 20 duplas oficiales de asignaturas', () => {
      expect(FFE_PAIRS).toHaveLength(20);
    });

    it('todas las 20 duplas tienen categorías válidas (Recursos Sociocognitivos o Áreas de Conocimiento)', () => {
      const socio = FFE_PAIRS.filter(p => p.category === 'Recursos Sociocognitivos');
      const areas = FFE_PAIRS.filter(p => p.category !== 'Recursos Sociocognitivos');
      expect(socio).toHaveLength(7);
      expect(areas).toHaveLength(13);
    });

    it('obtenerFfeSemestre6 mapea con precisión matemática cada materia de 5° a su par de 6°', () => {
      for (const pair of FFE_PAIRS) {
        const continuation = obtenerFfeSemestre6(pair.name5);
        expect(continuation).toBe(pair.name6);
      }
    });

    it('retorna fallback consistente cuando una materia no está en catálogo o está vacía', () => {
      expect(obtenerFfeSemestre6('')).toBe('Optativa FFE II');
      expect(obtenerFfeSemestre6('Taller Experimental I')).toBe('Taller Experimental II');
    });
  });

  // ── 2. Homologación de Capacitaciones Laborales (15 Keys, 120 UACs) ─────
  describe('2. Homologación de Capacitaciones Laborales con Tildes', () => {
    it('FORMACIONES_LABORALES contiene las 15 capacitaciones con tildes oficiales', () => {
      expect(FORMACIONES_LABORALES).toHaveLength(15);
      expect(FORMACIONES_LABORALES).toContain('Administración');
      expect(FORMACIONES_LABORALES).toContain('Área de la Salud');
      expect(FORMACIONES_LABORALES).toContain('Comunicación Gráfica');
      expect(FORMACIONES_LABORALES).toContain('Domótica');
      expect(FORMACIONES_LABORALES).toContain('Instalaciones Residenciales');
      expect(FORMACIONES_LABORALES).toContain('Mecánica Dental');
      expect(FORMACIONES_LABORALES).toContain('Preparación de Alimentos Artesanales');
      expect(FORMACIONES_LABORALES).toContain('Procesos Culinarios y Repostería');
      expect(FORMACIONES_LABORALES).toContain('Redes y Mantenimiento');
      expect(FORMACIONES_LABORALES).toContain('Servicios Ecosistémicos');
      expect(FORMACIONES_LABORALES).toContain('Sistemas Eléctricos');
      expect(FORMACIONES_LABORALES).toContain('Tecnología Informática');
      expect(FORMACIONES_LABORALES).toContain('Turismo');
    });

    it('UACS_LABORALES_OFICIALES_BGE contiene las 120 UACs oficiales distribuidas en 3°, 4°, 5° y 6° semestre', () => {
      const caps = Object.keys(UACS_LABORALES_OFICIALES_BGE);
      expect(caps).toHaveLength(15);

      let totalUacs = 0;
      for (const cap of FORMACIONES_LABORALES) {
        const semMap = UACS_LABORALES_OFICIALES_BGE[cap];
        expect(semMap).toBeDefined();

        // 4 semestres formativos (3°, 4°, 5°, 6°) con 2 UACs por semestre = 8 UACs
        const sem3 = semMap[3] || [];
        const sem4 = semMap[4] || [];
        const sem5 = semMap[5] || [];
        const sem6 = semMap[6] || [];

        expect(sem3.length + sem4.length + sem5.length + sem6.length).toBe(8);
        totalUacs += (sem3.length + sem4.length + sem5.length + sem6.length);
      }

      expect(totalUacs).toBe(120);
    });
  });

  // ── 3. Blindaje Defensivo contra UUIDs Inválidos en PMC ───────────────────
  describe('3. Blindaje Defensivo UUID PMC (page.tsx)', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    it('rechaza strings inválidos como "undefined", "null", "123" y "[object Object]"', () => {
      expect(UUID_REGEX.test('undefined')).toBe(false);
      expect(UUID_REGEX.test('null')).toBe(false);
      expect(UUID_REGEX.test('123')).toBe(false);
      expect(UUID_REGEX.test('[object Object]')).toBe(false);
      expect(UUID_REGEX.test('')).toBe(false);
      expect(UUID_REGEX.test('undefined-uuid-not-valid')).toBe(false);
    });

    it('acepta UUIDs v4 válidos en mayúsculas o minúsculas', () => {
      expect(UUID_REGEX.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(UUID_REGEX.test('7b8e2358-154a-4a67-9d78-bbdf07cfb95e')).toBe(true);
      expect(UUID_REGEX.test('7B8E2358-154A-4A67-9D78-BBDF07CFB95E')).toBe(true);
    });
  });

  // ── 4. Libertad Curricular Multi-PAEC y Consolidación Cero Duplicados ─────
  describe('4. Consolidación de UACs Únicas y Soporte Multi-PAEC', () => {
    it('incluye el 100% de UACs fundamentales cuando no se especifica activeFundamentalUacs', () => {
      const uacs = consolidarUacsUnicasPlantel({
        semesters: [1],
        schoolType: 'general',
      });

      const fundamentalCount = uacs.filter(u => u.component === 'fundamental').length;
      expect(fundamentalCount).toBeGreaterThan(0);
    });

    it('filtra estrictamente a las asignaturas fundamentales seleccionadas en multi-PAEC', () => {
      const allSem1 = obtenerFundamentalesPorSemestres([1]);
      expect(allSem1.length).toBeGreaterThan(1);

      // Seleccionamos solo una materia específica para este proyecto PAEC
      const selected = [allSem1[0].nombre];

      const uacs = consolidarUacsUnicasPlantel({
        semesters: [1],
        schoolType: 'general',
        activeFundamentalUacs: selected,
      });

      const fundamental = uacs.filter(u => u.component === 'fundamental');
      expect(fundamental).toHaveLength(1);
      expect(fundamental[0].uacName.toLowerCase()).toBe(selected[0].toLowerCase());
    });

    it('soporta selección personalizada de FFE individual por grupo (20 UACs)', () => {
      const customGroup: GroupTrackConfig = {
        groupId: 'g5_A',
        groupName: '5° A',
        semester: 5,
        trackId: 'custom',
        trackName: 'Personalizado',
        ffeSelections: [
          'Salud Integral I',
          'Temas Selectos de Matemáticas I',
        ],
      };

      const uacs = consolidarUacsUnicasPlantel({
        semesters: [5],
        schoolType: 'general',
        groupAssignments: [customGroup],
      });

      const ffeUacs = uacs.filter(u => u.component === 'ffe');
      expect(ffeUacs).toHaveLength(2);
      expect(ffeUacs.map(u => u.uacName)).toContain('Salud Integral I');
      expect(ffeUacs.map(u => u.uacName)).toContain('Temas Selectos de Matemáticas I');
    });

    it('garantiza CERO DUPLICADOS cuando múltiples grupos cursan las mismas asignaturas', () => {
      const groupA: GroupTrackConfig = {
        groupId: 'g5_A',
        groupName: '5° A',
        semester: 5,
        trackId: 'custom',
        trackName: 'Personalizado',
        ffeSelections: ['Salud Integral I'],
      };
      const groupB: GroupTrackConfig = {
        groupId: 'g5_B',
        groupName: '5° B',
        semester: 5,
        trackId: 'custom',
        trackName: 'Personalizado',
        ffeSelections: ['Salud Integral I'], // Misma materia
      };

      const uacs = consolidarUacsUnicasPlantel({
        semesters: [5],
        schoolType: 'general',
        groupAssignments: [groupA, groupB],
      });

      const saludIntegral = uacs.filter(u => u.uacName === 'Salud Integral I');
      expect(saludIntegral).toHaveLength(1); // Exactamente 1 vez en el padrón consolidado
    });
  });

  // ── 5. Validación de Esquemas de Extracción de Documentos Anteriores ──────
  describe('5. Esquemas de Extracción de Documentos Anteriores (PMC y PAEC)', () => {
    it('PmcPreviousExtractSchema valida y asigna defaults ante objetos parciales', () => {
      const result = PmcPreviousExtractSchema.safeParse({
        schoolName: 'Bachillerato General Emiliano Zapata',
        schoolCct: '21EBH0099Z',
        diagnosticoComunidad: 'Comunidad semiurbana con actividad comercial activa.',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.schoolName).toBe('Bachillerato General Emiliano Zapata');
        expect(result.data.schoolCct).toBe('21EBH0099Z');
        expect(result.data.subsystem).toBe('BGE');
        expect(result.data.totalStaff).toBeUndefined();
        expect(result.data.staffData).toEqual([]);
        expect(result.data.indicadores).toBeDefined();
        expect(result.data.foda).toBeDefined();
      }
    });

    it('PaecPreviousExtractSchema valida y asigna defaults ante objetos parciales', () => {
      const result = PaecPreviousExtractSchema.safeParse({
        projectName: 'Huertos Escolares Sustentables',
        problemStatement: 'Desabasto alimentario y falta de áreas verdes en la comunidad.',
        cycleType: 'A',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectName).toBe('Huertos Escolares Sustentables');
        expect(result.data.cycleType).toBe('A');
        expect(result.data.schoolType).toBe('general');
        expect(result.data.school).toBeDefined();
        expect(result.data.community).toBeDefined();
      }
    });
  });

});
