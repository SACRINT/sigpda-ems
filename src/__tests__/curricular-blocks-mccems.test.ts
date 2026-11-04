/**
 * curricular-blocks-mccems.test.ts
 *
 * Suite de verificación adversarial e institucional para la invariante MCCEMS:
 * Toda planeación se estructura en exactamente 3 CORTES / BLOQUES DE EVALUACIÓN (0, 1, 2),
 * sin importar el número de Progresiones oficiales (4, 7, 8, 10 o 16 progresiones).
 *
 * Verifica que ningún pie de página, documento, encabezado, libro o sesión
 * produzca jamás "Bloque 4", "Bloque 5", "Bloque 6" o "Bloque 7".
 */

import { describe, it, expect } from 'vitest';
import {
  resolveBlockNumber,
  mapActivityIndexToBlockIndex,
  resolveCurricularBlocks,
} from '@/lib/curricular-blocks';
import { resolveFooterBranding } from '@/lib/document-branding';
import { generateCurricularBlockSessions } from '@/lib/session-progression-engine';
import type { GeneratedPlanningContent } from '@/types/planning';

describe('Invariante MCCEMS — 3 Bloques de Evaluación Formativa', () => {
  describe('resolveBlockNumber', () => {
    it('resuelve índices canónicos 0-based a números 1, 2, 3', () => {
      expect(resolveBlockNumber(0)).toBe(1);
      expect(resolveBlockNumber(1)).toBe(2);
      expect(resolveBlockNumber(2)).toBe(3);
    });

    it('respeta números 1-based (1, 2, 3)', () => {
      expect(resolveBlockNumber(1)).toBe(2); // 1 0-based -> 2
      // Si se pasa número 3 directo
      expect(resolveBlockNumber(3, 3)).toBe(3);
    });

    it('normaliza defensivamente índices mayores a 2 para UACs con 7 progresiones (Dibujo Técnico I)', () => {
      // 7 progresiones: 0,1 -> Bloque 1; 2,3,4 -> Bloque 2; 5,6 -> Bloque 3
      expect(resolveBlockNumber(0, 7)).toBe(1);
      expect(resolveBlockNumber(1, 7)).toBe(1);
      expect(resolveBlockNumber(2, 7)).toBe(2);
      expect(resolveBlockNumber(3, 7)).toBe(2);
      expect(resolveBlockNumber(4, 7)).toBe(2);
      expect(resolveBlockNumber(5, 7)).toBe(3);
      expect(resolveBlockNumber(6, 7)).toBe(3);
    });

    it('NUNCA devuelve un número mayor a 3 para ningún índice o total de actividades', () => {
      for (let total = 3; total <= 20; total++) {
        for (let idx = 0; idx < total; idx++) {
          const num = resolveBlockNumber(idx, total);
          expect(num).toBeGreaterThanOrEqual(1);
          expect(num).toBeLessThanOrEqual(3);
        }
      }
    });

    it('maneja valores null o undefined devolviendo null', () => {
      expect(resolveBlockNumber(null)).toBeNull();
      expect(resolveBlockNumber(undefined)).toBeNull();
    });
  });

  describe('mapActivityIndexToBlockIndex', () => {
    it('mapea correctamente las 7 progresiones de Dibujo Técnico I a 3 bloques', () => {
      expect(mapActivityIndexToBlockIndex(0, 7)).toBe(0); // Progresión 1 -> Bloque 1 (Corte 1)
      expect(mapActivityIndexToBlockIndex(1, 7)).toBe(0); // Progresión 2 -> Bloque 1 (Corte 1)
      expect(mapActivityIndexToBlockIndex(2, 7)).toBe(1); // Progresión 3 -> Bloque 2 (Corte 2)
      expect(mapActivityIndexToBlockIndex(3, 7)).toBe(1); // Progresión 4 -> Bloque 2 (Corte 2)
      expect(mapActivityIndexToBlockIndex(4, 7)).toBe(1); // Progresión 5 -> Bloque 2 (Corte 2)
      expect(mapActivityIndexToBlockIndex(5, 7)).toBe(2); // Progresión 6 -> Bloque 3 (Corte 3)
      expect(mapActivityIndexToBlockIndex(6, 7)).toBe(2); // Progresión 7 -> Bloque 3 (Corte 3)
    });

    it('respeta el corte explícito si la progresión lo tiene especificado', () => {
      expect(mapActivityIndexToBlockIndex(0, 7, 2)).toBe(1);
      expect(mapActivityIndexToBlockIndex(5, 7, 1)).toBe(0);
      expect(mapActivityIndexToBlockIndex(6, 7, 3)).toBe(2);
    });
  });

  describe('resolveCurricularBlocks', () => {
    it('agrupa exactamente en 3 bloques una UAC de 7 progresiones (Dibujo Técnico I, 54h)', () => {
      const mockDT1Content = {
        sectionI: {
          component: 'fundamental',
          generalData: {
            uac: 'Dibujo Técnico I',
            semester: '5°',
            totalHours: 54,
          },
        },
        sectionII: {
          purpose: 'Desarrollar el lenguaje gráfico universal',
          learningOutcomes: [
            'Resultado P1', 'Resultado P2', 'Resultado P3',
            'Resultado P4', 'Resultado P5', 'Resultado P6', 'Resultado P7',
          ],
        },
        sectionIV: {
          activities: [
            { name: 'Progresión 1: Historia del dibujo', hours: 9, contenidoFormativo: 'Historia y utilidad', corte: 1 },
            { name: 'Progresión 2: Trazo a mano alzada', hours: 9, contenidoFormativo: 'Bocetaje y proporción', corte: 1 },
            { name: 'Progresión 3: Instrumentos de dibujo', hours: 6, contenidoFormativo: 'Regla T y escuadras', corte: 2 },
            { name: 'Progresión 4: Normativa básica', hours: 6, contenidoFormativo: 'NOM y formatos', corte: 2 },
            { name: 'Progresión 5: Dibujo 2D y 3D', hours: 6, contenidoFormativo: 'Acotación y escalas', corte: 2 },
            { name: 'Progresión 6: Proyección ortogonal', hours: 9, contenidoFormativo: 'Vistas diédricas', corte: 3 },
            { name: 'Progresión 7: Proyecciones axonométricas', hours: 9, contenidoFormativo: 'Isométrico y perspectiva', corte: 3 },
          ],
        },
      } as unknown as GeneratedPlanningContent;

      const blocks = resolveCurricularBlocks(mockDT1Content);

      expect(blocks).toHaveLength(3);

      // Bloque 1 (Corte 1): P1 + P2 (18 hrs)
      expect(blocks[0].blockIndex).toBe(0);
      expect(blocks[0].corteNumber).toBe(1);
      expect(blocks[0].corteLabel).toBe('Corte 1');
      expect(blocks[0].hours).toBe(18);
      expect(blocks[0].activities).toHaveLength(2);
      expect(blocks[0].activityIndices).toEqual([0, 1]);
      expect(blocks[0].title).toContain('Progresiones 1 y 2');

      // Bloque 2 (Corte 2): P3 + P4 + P5 (18 hrs)
      expect(blocks[1].blockIndex).toBe(1);
      expect(blocks[1].corteNumber).toBe(2);
      expect(blocks[1].corteLabel).toBe('Corte 2');
      expect(blocks[1].hours).toBe(18);
      expect(blocks[1].activities).toHaveLength(3);
      expect(blocks[1].activityIndices).toEqual([2, 3, 4]);
      expect(blocks[1].title).toContain('Progresiones 3, 4 y 5');

      // Bloque 3 (Corte 3): P6 + P7 (18 hrs)
      expect(blocks[2].blockIndex).toBe(2);
      expect(blocks[2].corteNumber).toBe(3);
      expect(blocks[2].corteLabel).toBe('Corte 3');
      expect(blocks[2].hours).toBe(18);
      expect(blocks[2].activities).toHaveLength(2);
      expect(blocks[2].activityIndices).toEqual([5, 6]);
      expect(blocks[2].title).toContain('Progresiones 6 y 7');

      // Suma total de horas
      const totalHours = blocks.reduce((sum, b) => sum + b.hours, 0);
      expect(totalHours).toBe(54);
    });

    it('agrupa exactamente en 3 bloques una UAC de Formación Laboral (3 actividades clave)', () => {
      const mockLaboralContent = {
        sectionI: { component: 'laboral' },
        sectionIV: {
          activities: [
            { name: 'Actividad Clave 1: Diagnóstico', hours: 18 },
            { name: 'Actividad Clave 2: Ejecución', hours: 18 },
            { name: 'Actividad Clave 3: Entrega', hours: 18 },
          ],
        },
      } as unknown as GeneratedPlanningContent;

      const blocks = resolveCurricularBlocks(mockLaboralContent);
      expect(blocks).toHaveLength(3);
      expect(blocks[0].hours).toBe(18);
      expect(blocks[1].hours).toBe(18);
      expect(blocks[2].hours).toBe(18);
    });

    it('agrupa exactamente en 3 bloques una UAC de 16 progresiones (Lengua y Comunicación)', () => {
      const mock16Content = {
        sectionI: { component: 'fundamental' },
        sectionIV: {
          activities: Array.from({ length: 16 }, (_, i) => ({
            name: `Progresión ${i + 1}`,
            hours: 4,
          })),
        },
      } as unknown as GeneratedPlanningContent;

      const blocks = resolveCurricularBlocks(mock16Content);
      expect(blocks).toHaveLength(3);
      expect(blocks[0].corteNumber).toBe(1);
      expect(blocks[1].corteNumber).toBe(2);
      expect(blocks[2].corteNumber).toBe(3);
      const totalMapped = blocks.reduce((acc, b) => acc + b.activities.length, 0);
      expect(totalMapped).toBe(16);
    });
  });

  describe('generateCurricularBlockSessions', () => {
    it('genera sesiones continuas del bloque respetando las progresiones asignadas', () => {
      const mockDT1Content = {
        sectionI: { component: 'fundamental' },
        sectionIV: {
          activities: [
            { name: 'Progresión 1: Historia', hours: 9, contenidoFormativo: 'Historia', corte: 1 },
            { name: 'Progresión 2: Trazo', hours: 9, contenidoFormativo: 'Trazo', corte: 1 },
          ],
        },
      } as unknown as GeneratedPlanningContent;

      const blocks = resolveCurricularBlocks(mockDT1Content);
      const sessions = generateCurricularBlockSessions(blocks[0], false);

      expect(sessions).toHaveLength(18);
      expect(sessions[0].sessionNum).toBe(1);
      expect(sessions[17].sessionNum).toBe(18);

      // Primeras 9 sesiones corresponden a P1
      expect(sessions[0].activityName).toBe('Progresión 1: Historia');
      expect(sessions[8].activityName).toBe('Progresión 1: Historia');

      // Sesiones 10 a 18 corresponden a P2
      expect(sessions[9].activityName).toBe('Progresión 2: Trazo');
      expect(sessions[17].activityName).toBe('Progresión 2: Trazo');
    });
  });

  describe('resolveFooterBranding institucional', () => {
    it('genera pie de página para plan de clase solo con Bloque 1, 2 o 3', () => {
      const footer0 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 0);
      expect(footer0.leftText).toBe('SIGPDA-EMS · PLAN DE CLASE · Bloque 1');

      const footer1 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 1);
      expect(footer1.leftText).toBe('SIGPDA-EMS · PLAN DE CLASE · Bloque 2');

      const footer2 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 2);
      expect(footer2.leftText).toBe('SIGPDA-EMS · PLAN DE CLASE · Bloque 3');
    });

    it('NUNCA produce "Bloque 4", "Bloque 5", "Bloque 6" o "Bloque 7" aun recibiendo índices legados', () => {
      const footer3 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 3);
      expect(footer3.leftText).not.toContain('Bloque 4');
      expect(footer3.leftText).toMatch(/Bloque [1-3]/);

      const footer4 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 4);
      expect(footer4.leftText).not.toContain('Bloque 5');
      expect(footer4.leftText).toMatch(/Bloque [1-3]/);

      const footer5 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 5);
      expect(footer5.leftText).not.toContain('Bloque 6');
      expect(footer5.leftText).toMatch(/Bloque [1-3]/);

      const footer6 = resolveFooterBranding('lesson_plan', 'Plan', {}, 1, 2, 6);
      expect(footer6.leftText).not.toContain('Bloque 7');
      expect(footer6.leftText).toMatch(/Bloque [1-3]/);
    });
  });
});
