import { describe, it, expect } from 'vitest';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { PlanDeClaseDerivado } from '@/lib/guide-engine/material-extractor';
import {
  buildPlanEvaluationSummary,
  formatPlanDeClaseMarkdown,
  type PlanEvaluationSummary,
} from '@/lib/guide-engine/cascade-block-materials';

const workbook = {
  blockIndex: 0,
  coverData: {
    subjectName: 'Pensamiento Matemático III',
    semester: 3,
  },
} as unknown as ActiveWorkTextbook;

const summary: PlanEvaluationSummary = {
  heteroevaluacion: 'Diagnóstica 5% y Sumativa 40%',
  autoevaluacionCoevaluacion: 'Formativa 55%',
  ponderacion: 'Diagnóstica 5% · Formativa 55% · Sumativa 40%',
};

function buildPlan(overrides: Partial<PlanDeClaseDerivado> = {}): PlanDeClaseDerivado {
  return {
    numeroSesion: 1,
    duracionMinutos: 50,
    tituloSesion: 'Ecuaciones lineales y situaciones de interés',
    propósitoOMeta: 'Propósito legado',
    metaEducativa: 'Meta educativa real del MCC 2025',
    propositoFormativo: 'Propósito formativo real del bloque',
    contenidoFormativo: 'Contenido formativo real del bloque',
    transversalidad: 'Vinculación PAEC',
    apertura: {
      actividadDocente: 'Presentar el detonador',
      actividadEstudiante: 'Analizar la problemática',
      saberesPrevios: 'Saberes previos breves',
      tiempoMinutos: 15,
    },
    desarrollo: {
      actividadDocente: 'Modelar la solución',
      actividadEstudiante: 'Resolver el reto',
      metodologiaActiva: 'Aprendizaje Basado en Retos',
      recursosDidacticos: 'Cuaderno de Trabajo Activo',
      tiempoMinutos: 25,
    },
    cierre: {
      actividadDocente: 'Semáforo de autoevaluación',
      actividadEstudiante: 'Responder la metacognición',
      evaluacionFormativa: 'Lista de cotejo diagnóstica',
      metacognicion: '¿Qué aprendí?',
      productoEsperado: 'Cuestionario diagnóstico',
      tiempoMinutos: 10,
    },
    instrumentoEvaluacion: 'Rúbrica analítica',
    ...overrides,
  };
}

describe('formatPlanDeClaseMarkdown · MCC 2025 y evaluación', () => {
  it('incluye meta, propósito y contenido formativo reales', () => {
    const md = formatPlanDeClaseMarkdown(buildPlan(), workbook, summary);

    expect(md).toContain('**Meta Educativa:** Meta educativa real del MCC 2025');
    expect(md).toContain('**Propósito Formativo:** Propósito formativo real del bloque');
    expect(md).toContain('**Contenido Formativo:** Contenido formativo real del bloque');
  });

  it('incluye heteroevaluación, autoevaluación/coevaluación y ponderación sin duplicar la evaluación formativa', () => {
    const md = formatPlanDeClaseMarkdown(buildPlan(), workbook, summary);

    expect(md).toContain('- **Heteroevaluación:** Diagnóstica 5% y Sumativa 40%');
    expect(md).toContain('- **Autoevaluación / Coevaluación:** Formativa 55%');
    expect(md).toContain('- **Ponderación:** Diagnóstica 5% · Formativa 55% · Sumativa 40%');
    expect(md).not.toContain('- **Evaluación Formativa:**');
  });

  it('conserva la evaluación formativa y el instrumento cuando no hay resumen oficial', () => {
    const md = formatPlanDeClaseMarkdown(buildPlan(), workbook);

    expect(md).toContain('- **Evaluación Formativa:** Lista de cotejo diagnóstica');
    expect(md).toContain('- **Instrumento de Evaluación Oficial:** Rúbrica analítica');
    expect(md).not.toContain('- **Heteroevaluación:**');
  });

  it('conserva íntegros los saberes previos largos sin recortar la información', () => {
    const longSaberes = `${'Contexto comunitario y matemático. '.repeat(20)}Cierre adicional.`;
    const md = formatPlanDeClaseMarkdown(
      buildPlan({
        apertura: {
          ...buildPlan().apertura,
          saberesPrevios: longSaberes,
        },
      }),
      workbook,
      summary
    );

    const line = md.split('\n').find((item) => item.startsWith('- **Saberes Previos'));
    expect(line).toBeDefined();
    const value = line!.replace('- **Saberes Previos y Conexión Intuitiva:** ', '').trim();
    expect(value).toBe(longSaberes);
    expect(value.endsWith('…')).toBe(false);
  });

  it('usa "Asignatura" en 1º-4º semestre y conserva "UAC" en 5º-6º', () => {
    const md3 = formatPlanDeClaseMarkdown(buildPlan(), workbook, summary);
    expect(md3).toContain('**Asignatura:** Pensamiento Matemático III');
    expect(md3).not.toContain('**UAC:**');

    const workbook5 = {
      blockIndex: 4,
      coverData: { subjectName: 'Pensamiento Matemático V', semester: 5 },
    } as unknown as ActiveWorkTextbook;
    const md5 = formatPlanDeClaseMarkdown(buildPlan(), workbook5, summary);
    expect(md5).toContain('**UAC:** Pensamiento Matemático V');
    expect(md5).not.toContain('**Asignatura:**');
  });

  it('no agrega la nota de cascada ni duplica el prefijo de la sesión', () => {
    const md = formatPlanDeClaseMarkdown(
      buildPlan({ tituloSesion: 'Sesión 1: Ecuaciones lineales y situaciones de interés' }),
      workbook,
      summary
    );

    expect(md).not.toContain('Documento derivado en cascada');
    expect(md).toContain('**Título de la Sesión:** Ecuaciones lineales y situaciones de interés');
    expect(md).not.toContain('**Título de la Sesión:** Sesión 1:');
  });

  it('normaliza la ponderación oficial desde las evaluaciones de la planeación', () => {
    const result = buildPlanEvaluationSummary([
      { type: 'Diagnóstica', agent: 'Heteroevaluación', instrument: 'Lista de cotejo diagnóstica', percentage: 5 },
      { type: 'Formativa', agent: 'Coevaluación', instrument: 'Rúbrica analítica de proceso (Bitácora 50-20-30)', percentage: 55 },
      { type: 'Sumativa', agent: 'Heteroevaluación', instrument: 'Rúbrica holística', percentage: 40 },
    ]);

    expect(result).not.toBeNull();
    expect(result!.ponderacion).toBe('Diagnóstica 5% · Formativa 55% · Sumativa 40%');
    expect(result!.heteroevaluacion).toContain('Diagnóstica 5%');
    expect(result!.heteroevaluacion).toContain('Sumativa 40%');
    expect(result!.autoevaluacionCoevaluacion).toContain('Formativa 55%');
  });
});
