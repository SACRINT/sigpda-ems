/**
 * src/__tests__/pmc-inverted-metric-foda.test.ts
 *
 * Pruebas unitarias para:
 * 1. Corrección automática de inversión de métricas en metas (ej. Meta 19: reprobación del 3% al 7.5%).
 * 2. Síntesis situada del FODA escolar enriquecido con PAEC, PMC previo y estadísticas F11/911.
 */

import { describe, it, expect } from 'vitest';
import {
  correctInvertedMetricGoals,
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
} from '@/lib/pmc/plan-element-normalizer';
import { synthesizeSituatedFoda } from '@/lib/pmc/pmc-foda-synthesizer';
import type { PmcProject, PmcStatisticalContext, PmcFodaData } from '@/types/pmc';

describe('correctInvertedMetricGoals - Corrección determinista de errores en metas', () => {
  it('corrige exactamente el error de la Meta 19: "Disminuir el índice de reprobación del 3% al 7.5%"', () => {
    const raw = 'Disminuir el índice de reprobación del 3% al 7.5% en el ciclo escolar';
    const result = correctInvertedMetricGoals(raw);

    expect(result.wasCorrected).toBe(true);
    expect(result.text).toBe('Disminuir el índice de reprobación del 7.5% al 3% en el ciclo escolar');
    expect(result.detectedBaseline).toBe('7.5%');
    expect(result.detectedTarget).toBe('3%');
    expect(result.reason).toContain('Inversión de métrica corregida');
  });

  it('corrige verbos de reducción/disminución cuando valor inicial < meta (ej. reducir abandono de 2% a 6.8%)', () => {
    const raw = 'Reducir el abandono escolar del 2% al 6.8% implementando tutorías grupales';
    const result = correctInvertedMetricGoals(raw);

    expect(result.wasCorrected).toBe(true);
    expect(result.text).toBe('Reducir el abandono escolar del 6.8% al 2% implementando tutorías grupales');
    expect(result.detectedBaseline).toBe('6.8%');
    expect(result.detectedTarget).toBe('2%');
  });

  it('corrige verbos de aumento/incremento cuando valor inicial > meta (ej. elevar aprobación del 85% al 70%)', () => {
    const raw = 'Elevar la tasa de aprobación del 85% al 70% mediante círculos de estudio';
    const result = correctInvertedMetricGoals(raw);

    expect(result.wasCorrected).toBe(true);
    expect(result.text).toBe('Elevar la tasa de aprobación del 70% al 85% mediante círculos de estudio');
    expect(result.detectedBaseline).toBe('70%');
    expect(result.detectedTarget).toBe('85%');
  });

  it('no modifica metas que tienen la dirección correcta', () => {
    const validDecrease = 'Disminuir el índice de reprobación del 12.5% al 5.0% al finalizar el ciclo';
    const resDecrease = correctInvertedMetricGoals(validDecrease);
    expect(resDecrease.wasCorrected).toBe(false);
    expect(resDecrease.text).toBe(validDecrease);

    const validIncrease = 'Incrementar la aprobación del 72% al 88% en el turno matutino';
    const resIncrease = correctInvertedMetricGoals(validIncrease);
    expect(resIncrease.wasCorrected).toBe(false);
    expect(resIncrease.text).toBe(validIncrease);
  });

  it('deriveMetasPreviasFromElementos ajusta automáticamente la redacción y la línea base de la meta', () => {
    const elementos = [
      {
        tipo: 'meta' as const,
        texto_original: '19. Disminuir el índice de reprobación del 3% al 7.5%',
        texto_normalizado: 'Disminuir el índice de reprobación del 3% al 7.5%',
        categoria: 'Aprovechamiento académico',
        tema: 'Reprobación',
        responsable: 'Docente Juan Pérez',
        periodo: '2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
    ];

    const metas = deriveMetasPreviasFromElementos(elementos, [
      {
        categoria: 'Aprovechamiento académico',
        tema: 'Reprobación',
        meta: 'Disminuir el índice de reprobación del 3% al 7.5%',
        linea_base: '3%',
      },
    ]);

    expect(metas).toHaveLength(1);
    expect(metas[0].meta).toBe('Disminuir el índice de reprobación del 7.5% al 3%');
    expect(metas[0].linea_base).toBe('7.5%');
  });
});

describe('synthesizeSituatedFoda - Síntesis y Enriquecimiento Situado del FODA', () => {
  it('combina FODA previo, PAEC e indicadores estadísticos F11/911 de forma contextualizada', () => {
    const project: Partial<PmcProject> = {
      school_name: 'Bachillerato General Oficial Moisés Sáenz Garza',
      school_cct: '21EBH0282M',
      municipality: 'Izúcar de Matamoros',
      locality: 'El Tecomate',
      indicadores_academicos: {
        aprobacion_ant: 92.5,
        reprobacion_ant: 7.5,
        abandono_ant: 3.2,
      },
      statistical_context: {
        fuente: 'f11_911',
        parsedAt: new Date().toISOString(),
        plantel: {
          promediosPorAsignatura: {
            'Pensamiento Matemático II': 6.4,
            'Cultura Digital II': 7.1,
            'Lengua y Comunicación II': 8.3,
          },
        },
      } as unknown as PmcStatisticalContext,
      foda: {
        fortalezas: 'Planta docente completa y comprometida con el trabajo colegiado.',
        oportunidades: 'Apoyo de padres de familia y comités comunitarios.',
        debilidades: 'Carencia de equipos de cómputo actualizados en el aula de medios.',
        amenazas: 'Condiciones de transporte difíciles para estudiantes que viajan desde rancherías.',
      },
    };

    const paec = {
      nombre_proyecto: 'Cuidado del Agua y Reforestación Comunitaria',
      foda: {
        fortalezas: 'Gran disposición de los ejidatarios y alumnos en proyectos ecológicos.',
        oportunidades: 'Vínculos con la inspectoría auxiliar para faenas comunitarias.',
        debilidades: 'Limitada disponibilidad de agua entubada durante la temporada de estiaje.',
        amenazas: 'Migración temporal de jóvenes hacia el corte de caña o Estados Unidos.',
      },
    };

    const synthesized = synthesizeSituatedFoda({
      schoolName: project.school_name,
      schoolCct: project.school_cct,
      municipality: project.municipality,
      locality: project.locality,
      rawFoda: project.foda as PmcFodaData,
      paecFoda: paec.foda,
      promediosPorAsignatura: {
        'Pensamiento Matemático II': 6.4,
        'Cultura Digital II': 7.1,
        'Lengua y Comunicación II': 8.3,
      },
    });

    // Debe contener los 4 cuadrantes institucionales
    expect(synthesized.fortalezas).toBeDefined();
    expect(synthesized.oportunidades).toBeDefined();
    expect(synthesized.debilidades).toBeDefined();
    expect(synthesized.amenazas).toBeDefined();

    // Las fortalezas deben incorporar el compromiso docente y las fortalezas del PAEC
    expect(synthesized.fortalezas).toContain('Planta docente');
    expect(synthesized.fortalezas).toContain('proyectos ecológicos');

    // Las debilidades deben integrar las asignaturas con rezago detectadas en el F11 (< 7.5)
    expect(synthesized.debilidades).toContain('Pensamiento Matemático II');
    expect(synthesized.debilidades).toContain('6.4');
    expect(synthesized.debilidades).toContain('Cultura Digital II');
    expect(synthesized.debilidades).toContain('7.1');
    expect(synthesized.debilidades).toContain('equipos de cómputo');

    // Las amenazas deben incorporar el contexto regional y la vulnerabilidad
    expect(synthesized.amenazas).toContain('transporte');
  });
});
