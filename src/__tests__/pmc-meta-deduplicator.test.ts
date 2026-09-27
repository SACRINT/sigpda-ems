// src/__tests__/pmc-meta-deduplicator.test.ts
/**
 * Pruebas unitarias para la deduplicación silenciosa de metas institucionales (H-150).
 * Valida:
 * 1. Duplicado exacto.
 * 2. Duplicado semántico y resolución de conflicto duro con indicadores (ej. abandono 0% vs 3%).
 * 3. Miscategorías (metas con categoría incoherente pero mismo ámbito temático).
 * 4. Fusión de campos complementarios y conservación de continuidad_de.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeMetaText,
  computeMetaSimilarity,
  detectMetaTopic,
  applyIndicatorPrecedence,
  deduplicateMetasInstitucionales,
} from '@/lib/pmc-meta-deduplicator';
import type { PmcMetaInstitucional, PmcIndicadoresAcademicos } from '@/types/pmc';

describe('H-150: Deduplicación silenciosa de metas institucionales', () => {
  const mockIndicadores: PmcIndicadoresAcademicos = {
    abandono_ant: 5.0,
    abandono_meta: 3.0,
    aprobacion_ant: 75.0,
    aprobacion_meta: 85.0,
    et_ant: 70.0,
    et_meta: 80.0,
    matricula: 75,
  };

  describe('1. Normalización y Similitud Léxica', () => {
    it('normaliza texto removiendo mayúsculas, acentos, prefijos de continuidad y puntuación', () => {
      const raw = '[Continuidad 2026-2027] ¡Reducir el abandono escolar al 3% en primer año!';
      const norm = normalizeMetaText(raw);
      expect(norm).toBe('reducir el abandono escolar al 3 en primer ano');
    });

    it('calcula alta similitud para redacciones equivalentes', () => {
      const a = 'Reducir el abandono escolar en la matrícula estudiantil durante 2026-2027';
      const b = 'Disminuir el abandono escolar en la comunidad estudiantil para el ciclo 2026-2027';
      const sim = computeMetaSimilarity(a, b);
      expect(sim).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('2. Detección de Topic y Precedencia de Indicadores', () => {
    it('detecta correctamente los topics clave de la política CREAA', () => {
      expect(detectMetaTopic({ meta: 'Reducir la deserción de los alumnos' })).toBe('abandono');
      expect(detectMetaTopic({ meta: 'Aumentar la aprobación en matemáticas' })).toBe('aprobacion_reprobacion');
      expect(detectMetaTopic({ meta: 'Monitorear la titulación de egresados' })).toBe('eficiencia_egreso');
      expect(detectMetaTopic({ meta: 'Capacitación docente en metodologías activas' })).toBe('formacion_docente');
      expect(detectMetaTopic({ meta: 'Círculos de apoyo socioemocional' })).toBe('socioemocional');
      expect(detectMetaTopic({ meta: 'Talleres contra la violencia escolar y cultura de paz' })).toBe('convivencia_violencia');
    });

    it('prevalencia de indicadores_academicos.*_meta sobre contradicciones alucinadas (abandono 0% vs 3%)', () => {
      const alucinadoIA: PmcMetaInstitucional = {
        categoria: 'Permanencia escolar',
        tema: 'Prevención de deserción',
        meta: 'Reducir el abandono escolar al 0% durante el ciclo escolar 2026-2027',
      };

      const corregido = applyIndicatorPrecedence(alucinadoIA, mockIndicadores);
      expect(corregido.meta).toContain('al 3%');
      expect(corregido.meta).not.toContain('0%');
      expect(corregido.linea_base).toContain('meta proyectada: 3%');
    });
  });

  describe('3. Deduplicación de Metas Institucionales', () => {
    it('elimina duplicados exactos conservando una sola instancia', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Permanencia escolar',
          meta: 'Reducir el abandono escolar al 3% en el plantel',
          estrategia: 'Tutorías personalizadas',
        },
        {
          categoria: 'Permanencia escolar',
          meta: 'reducir el abandono escolar al 3% en el plantel.',
          estrategia: 'Tutorías personalizadas y alertas tempranas',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      expect(deduplicadas.length).toBe(1);
      expect(deduplicadas[0].estrategia).toBe('Tutorías personalizadas y alertas tempranas');
    });

    it('resuelve conflicto semántico duro (IA #3 "abandono al 0%" vs continuidad #14 "5%->3%")', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Permanencia y egreso',
          tema: 'Abandono escolar',
          meta: 'Reducir el abandono escolar al 0% mediante alertas tempranas',
          estrategia: 'Alertas en semana 6 y 12',
          personal_designado: 'Orientador educativo',
        },
        {
          categoria: 'Permanencia',
          tema: 'Deserción escolar',
          meta: '[Continuidad 2026-2027] Lograr la disminución de la tasa de abandono del 5% al 3%',
          continuidad_de: 'Lograr la disminución de la tasa de abandono del 5% al 3%',
          estrategia: 'Acompañamiento a estudiantes en riesgo',
          linea_base: 'Tasa 5%',
          entregable: 'Reporte trimestral de retención',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      // Se debe consolidar en una única meta de abandono
      expect(deduplicadas.length).toBe(1);
      const metaFinal = deduplicadas[0];
      // Debe contener la meta oficial 3% y no tener 0%
      expect(metaFinal.meta).not.toContain('0%');
      expect(metaFinal.meta).toContain('3%');
      // Debe haber fusionado campos complementarios
      expect(metaFinal.entregable).toBe('Reporte trimestral de retención');
      expect(metaFinal.personal_designado).toBe('Orientador educativo');
    });

    it('resuelve miscategorías unificando metas del mismo ámbito (ej. Abandono etiquetada bajo "Trabajo colegiado")', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Trabajo colegiado',
          tema: 'Reuniones docentes',
          meta: 'Abordar en academia la reducción del abandono escolar al 3%',
          estrategia: 'Análisis bimestral de deserción',
        },
        {
          categoria: 'Permanencia escolar',
          tema: 'Abandono escolar',
          meta: 'Disminuir el abandono escolar al 3% mediante tutoría académica',
          estrategia: 'Tutorías en aula',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      expect(deduplicadas.length).toBe(1);
      expect(deduplicadas[0].categoria).toBe('Permanencia escolar');
    });

    it('deduplica metas clonadas de egresados (#8 vs #20 vs #21)', () => {
      const metas: PmcMetaInstitucional[] = [
        {
          categoria: 'Eficiencia Terminal',
          tema: 'Seguimiento de Egresados',
          meta: 'Lograr que el 80% de los egresados continúen estudios superiores o ingresen al mercado laboral',
          estrategia: 'Vinculación con universidades y bolsas de trabajo',
          linea_base: 'Eficiencia actual: 70%',
        },
        {
          categoria: 'Eficiencia Terminal',
          tema: 'Seguimiento de Egresados',
          meta: '[Continuidad 2026-2027] Seguimiento del 80% de egresados para vinculación territorial',
          estrategia: 'Vinculación con universidades y bolsas de trabajo',
          linea_base: 'Eficiencia actual: 70%',
        },
      ];

      const deduplicadas = deduplicateMetasInstitucionales(metas, mockIndicadores);
      expect(deduplicadas.length).toBe(1);
      expect(deduplicadas[0].meta).toContain('80%');
    });
  });
});
