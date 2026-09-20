/**
 * secuencia-reto-validation.test.ts
 *
 * Verificación de la regla pedagógica innegociable Reto Situado 4/4:
 * 1. Validación de criterios de calidad (verbo infinitivo superior, contexto Puebla, problema real, propósito UAC).
 * 2. Auto-repair determinista con ensureRetoSituadoCalidad antes de persistir.
 * 3. SecuenciaUpdateInputSchema con soporte opcional para retoSituado.
 */

import { describe, it, expect } from 'vitest';
import { validateRetoSituado, ensureRetoSituadoCalidad, autoRepairRetoSituado } from '@/lib/planning-evaluator';
import { SecuenciaUpdateInputSchema } from '@/lib/ai-schemas';
import type { RetoSituado } from '@/types/planning';

describe('Reto Situado 4/4 Quality Pipeline en Guardado de Secuencia', () => {
  const contextPuebla = {
    municipality: 'Tepeaca',
    schoolName: 'Bachillerato General Emiliano Zapata',
    uacName: 'Pensamiento Matemático I',
    paecProblem: 'Desabasto y filtración de agua en la comunidad escolar',
  };

  it('debe aprobar un Reto Situado completo que cumple los 4 criterios (4/4)', () => {
    const retoValido: RetoSituado = {
      titulo: 'Optimización de captación de agua',
      verboInfinitivo: 'Diseñar y construir',
      contextoLocal: 'en el plantel escolar de Tepeaca, Puebla',
      problematicaReal: 'para resolver las fugas y el desabasto de agua potable en los sanitarios',
      propositoCurricular: 'articulando modelos de geometría analítica y cálculo de volúmenes de la UAC',
      retoCompleto: 'Diseñar y construir un sistema de captación pluvial en Tepeaca, Puebla para mitigar el desabasto de agua potable, aplicando modelos geométricos y optimización de volúmenes de Pensamiento Matemático I.',
    };

    const validation = validateRetoSituado(retoValido, contextPuebla);
    expect(validation.isApproved).toBe(true);
    expect(validation.score).toBe(4);
    expect(validation.feedback).toHaveLength(0);
  });

  it('debe rechazar un Reto Situado incompleto o pasivo con desglose de feedback', () => {
    const retoIncompleto = 'Aprender sobre las fórmulas matemáticas en el salón';
    const validation = validateRetoSituado(retoIncompleto, contextPuebla);

    expect(validation.isApproved).toBe(false);
    expect(validation.score).toBeLessThan(4);
    expect(validation.feedback.length).toBeGreaterThan(0);
    // Debe señalar verbo pasivo o falta de anclaje local
    expect(validation.hasInfinitiveVerb).toBe(false);
  });

  it('ensureRetoSituadoCalidad debe auto-reparar cualquier reto defectuoso a 4/4 garantizado', () => {
    const retoDefectuoso: RetoSituado = {
      titulo: 'Tema 1',
      verboInfinitivo: 'conocer', // verbo pasivo prohibido
      contextoLocal: '',
      problematicaReal: '',
      propositoCurricular: '',
      retoCompleto: 'Conocer las leyes de la física',
    };

    const reparado = ensureRetoSituadoCalidad(retoDefectuoso, contextPuebla);
    expect(reparado.validacion).toBeDefined();
    expect(reparado.validacion?.isApproved).toBe(true);
    expect(reparado.validacion?.score).toBe(4);
    expect(reparado.verboInfinitivo.toLowerCase()).not.toContain('conocer');
    expect(reparado.contextoLocal).toContain('Tepeaca');
  });

  it('ensureRetoSituadoCalidad maneja retos nulos o indefinidos generando un reto 4/4 base', () => {
    const reparado = ensureRetoSituadoCalidad(null, contextPuebla);
    expect(reparado.validacion?.isApproved).toBe(true);
    expect(reparado.validacion?.score).toBe(4);
    expect(reparado.verboInfinitivo).toBe('Diseñar');
    expect(reparado.contextoLocal).toContain('Tepeaca');
  });

  it('SecuenciaUpdateInputSchema acepta payload con retoSituado válido', () => {
    const input = {
      blockIndex: 0,
      sessions: [
        {
          sessionNum: 1,
          totalSessions: 1,
          phase: 'Apertura' as const,
          title: 'Sesión 1: Encuadre situacional',
          teachingActivity: 'Presentación del reto comunitario.',
          learningActivity: 'Análisis de la problemática en equipos.',
          evidence: 'Diagnóstico inicial.',
          evaluation: 'Lista de cotejo.',
        },
      ],
      retoSituado: {
        titulo: 'Reto Situado 1',
        verboInfinitivo: 'Diseñar',
        contextoLocal: 'en Tepeaca, Puebla',
        problematicaReal: 'para mitigar el desperdicio de agua',
        propositoCurricular: 'aplicando Pensamiento Matemático I',
        retoCompleto: 'Diseñar un prototipo en Tepeaca, Puebla para mitigar el desperdicio de agua aplicando Pensamiento Matemático I.',
      },
    };

    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retoSituado).toBeDefined();
    }
  });

  it('SecuenciaUpdateInputSchema acepta payload con retoSituado como string', () => {
    const input = {
      blockIndex: 0,
      sessions: [
        {
          sessionNum: 1,
          totalSessions: 1,
          phase: 'Apertura' as const,
          title: 'Sesión 1: Encuadre situacional',
          teachingActivity: 'Presentación del reto comunitario.',
          learningActivity: 'Análisis de la problemática en equipos.',
          evidence: 'Diagnóstico inicial.',
          evaluation: 'Lista de cotejo.',
        },
      ],
      retoSituado: 'Diseñar un prototipo en Tepeaca, Puebla para resolver el desabasto de agua.',
    };

    const result = SecuenciaUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
