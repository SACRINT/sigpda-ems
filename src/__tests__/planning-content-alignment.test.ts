// src/__tests__/planning-content-alignment.test.ts
/**
 * Alineación DURA planeación ↔ libro (Fase 8.5 del orquestador).
 *
 * Pruebas FALSABLES (anti-F11): mutaciones load-bearing reales sobre el corpus
 * del libro deben hacer caer el score; restaurarlas debe recuperarlo. Nada se
 * calcula a partir del propio input del reporte.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluatePlanningContentAlignment,
  extractMissingTerms,
  corpusCoversTerm,
  sectionCorpus,
} from '@/lib/guide-engine/planning-content-alignment';
import type { AlignmentCorpusSource } from '@/lib/guide-engine/planning-content-alignment';
import type { PlanningActivities } from '@/lib/guide-engine/writers/writer-contract';
import type { MissionSection, EvaluationSection } from '@/types/work-textbook';

const ACTIVITIES: PlanningActivities = {
  apertura: {
    description: 'Exploración inicial del problema del taller comunitario.',
    processes: 'Observación y registro',
    materials: 'regla metálica, compás, cuaderno de trabajo',
  },
  ejecucion: {
    description: 'Cálculo de superficies con fórmulas.',
    processes: 'Aplicación de fórmulas',
    materials: 'calculadora científica',
  },
  conclusion: {
    description: 'Socialización de resultados.',
    processes: 'Argumentación',
    materials: 'papel bond',
  },
  saberes: {
    saber: 'El estudiante distingue entre perímetro y área de figuras planas',
    saberHacer: 'Aplica la fórmula del área de rectángulos',
    saberSer: 'Valora el uso eficiente de los materiales',
  },
  contenidoFormativo:
    'Perímetro y área de figuras rectangulares; Descomposición de figuras complejas en rectángulos',
  methodology: 'Aprendizaje basado en problemas',
};

function makeMission(overrides?: Partial<MissionSection>): MissionSection {
  return {
    missionIndex: 1,
    title: 'Medición de superficies en el taller',
    coveredSessions: [1, 2],
    sessionTopic: 'Perímetro y área de figuras rectangulares',
    sessionFocus: 'Descomposición de figuras complejas en rectángulos',
    phenomenonHook: { story: 'El taller necesita medir láminas.', detonatingQuestion: '¿Cuánta lámina se gasta?' },
    conceptZero: {
      physicalAnalogy: 'El papel que cubre una mesa.',
      coreExplanation:
        'El área mide la superficie de figuras rectangulares y se calcula con la fórmula largo por ancho.',
    },
    iDoSection: { stepByStepDemo: 'Modelado del cálculo de área con la fórmula largo por ancho.' },
    weDoSection: {
      guidedPractice:
        'En equipos calculen el área del rectángulo usando la calculadora científica y la regla metálica; registren en el cuaderno de trabajo y socialicen en papel bond con el compás.',
    },
    youDoSection: { autonomousChallenge: 'Miden el área de su escritorio y comparan resultados.' },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Cómo distingues perímetro de área?',
      reflectionPrompts: ['¿Dónde usas el cálculo de áreas en casa?'],
      criteriaChecklist: ['Identifica datos', 'Aplica la fórmula'],
    },
    wordCount: 900,
    ...overrides,
  } as MissionSection;
}

function makeEvaluation(): EvaluationSection {
  return {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Distingue correctamente entre perímetro y área de figuras planas',
        weightPercent: 50,
        levels: [{ levelName: 'Excelente', points: 10, descriptor: 'Identifica ambos conceptos.' }],
      },
      {
        criterion: 'Aplica la fórmula del área de rectángulos con precisión',
        weightPercent: 50,
        levels: [{ levelName: 'Excelente', points: 10, descriptor: 'Cálculo correcto.' }],
      },
    ],
    checklist: [{ item: 'Valora el uso eficiente de los materiales', category: 'Actitudinal' }],
    criticalThinkingQuiz: [],
    metacognitiveReflection: { prompts: ['¿Qué aprendiste?'] },
  } as EvaluationSection;
}

function makeSource(overrides?: Partial<AlignmentCorpusSource>): AlignmentCorpusSource {
  return {
    missions: [makeMission()],
    evaluationSection: makeEvaluation(),
    projectSection: null,
    ...overrides,
  };
}

describe('evaluatePlanningContentAlignment — cobertura completa', () => {
  it('score 100 y pass cuando TODO el plan está reflejado en el libro', () => {
    const report = evaluatePlanningContentAlignment(makeSource(), ACTIVITIES);
    expect(report.checks.every((c) => c.missing.length === 0)).toBe(true);
    expect(report.score).toBe(100);
    expect(report.pass).toBe(true);
  });

  it('sin actividades de planeación: nada que verificar (score 100, checks vacíos)', () => {
    const report = evaluatePlanningContentAlignment(makeSource(), undefined);
    expect(report.score).toBe(100);
    expect(report.pass).toBe(true);
    expect(report.checks).toHaveLength(0);
  });
});

describe('mutaciones load-bearing (anti-F11 real)', () => {
  it('borrar TODO rastro del contenido formativo del libro hunde el score', () => {
    const clean = makeSource();
    const report = evaluatePlanningContentAlignment(clean, ACTIVITIES);
    expect(report.pass).toBe(true);

    // Mutación real: la misión ya no menciona ninguno de los dos temas del bloque
    const mutated = makeSource({
      missions: [
        makeMission({
          sessionTopic: 'Historia de la medición en culturas antiguas',
          sessionFocus: 'Lectura de textos sobre medida y comunidad',
          conceptZero: {
            physicalAnalogy: 'Un reloj de sol.',
            coreExplanation: 'La medición comparativa aparece en culturas antiguas de manera empírica.',
          },
          weDoSection: { guidedPractice: 'Lean y comenten un texto sobre medida y comunidad.', workbookElements: [] },
        }),
      ],
      evaluationSection: {
        ...makeEvaluation(),
        rubric: [{ criterion: 'Comenta el texto leído', weightPercent: 100, levels: [] }],
        checklist: [{ item: 'Participa en la lectura', category: 'Actitudinal' }],
      } as EvaluationSection,
    });
    const mutatedReport = evaluatePlanningContentAlignment(mutated, ACTIVITIES);

    expect(mutatedReport.score).toBeLessThan(report.score);
    expect(mutatedReport.pass).toBe(false);
    const contenido = mutatedReport.checks.find((c) => c.id === 'contenido')!;
    expect(contenido.covered).toBe(0);
    expect(contenido.missing.join(' ')).toContain('Perímetro y área de figuras rectangulares');
    // Término original listo para el reintento dirigido
    const terms = extractMissingTerms(mutatedReport);
    expect(terms).toContain('Perímetro y área de figuras rectangulares');
  });

  it('saberes evaluados SOLO contra el corpus de evaluación (no contra la teoría)', () => {
    // La teoría habla de "fórmula del área de rectángulos", pero la evaluación NO.
    const source = makeSource({
      missions: [
        makeMission({
          formativeCheckpoint: { question: '¿Avanzaste hoy?', reflectionPrompts: [], criteriaChecklist: [] },
        }),
      ],
      evaluationSection: {
        ...makeEvaluation(),
        rubric: [{ criterion: 'Participa activamente en clase', weightPercent: 100, levels: [] }],
        checklist: [{ item: 'Entrega la actividad', category: 'Cumplimiento' }],
      } as EvaluationSection,
    });
    const report = evaluatePlanningContentAlignment(source, ACTIVITIES, 80);
    const saberes = report.checks.find((c) => c.id === 'saberes')!;
    expect(saberes.skipped).toBe(false);
    expect(saberes.covered).toBe(0);
    expect(saberes.missing.join(' ')).toContain('fórmula del área de rectángulos');
    // Con umbral exigente el reporte completo falla (score = 70: contenido+materiales completos)
    expect(report.score).toBe(70);
    expect(report.pass).toBe(false);
  });

  it('materiales: cada token de la lista debe aparecer en el libro', () => {
    const source = makeSource({
      missions: [makeMission({ weDoSection: { guidedPractice: 'Resuelvan con lo que tengan a la mano.', workbookElements: [] } })],
    });
    const report = evaluatePlanningContentAlignment(source, ACTIVITIES);
    const materiales = report.checks.find((c) => c.id === 'materiales')!;
    expect(materiales.skipped).toBe(false);
    expect(materiales.missing.length).toBeGreaterThan(0);
    expect(materiales.missing.join(' ')).toContain('calculadora científica');
  });
});

describe('exclusión de soluciones (corpus = lo que el estudiante ve)', () => {
  const FRASE = 'Teorema de Pitágoras en triángulos rectángulos';

  function missionWithSolucion(solucion: string[]): MissionSection {
    return makeMission({
      sessionTopic: 'Medición de superficies en el taller',
      sessionFocus: 'Registro de medidas del proyecto',
      conceptZero: {
        physicalAnalogy: 'El papel que cubre una mesa.',
        coreExplanation: 'El área mide la superficie de figuras planas.',
      },
      weDoSection: { guidedPractice: 'Calculen áreas con la regla metálica.', workbookElements: [] },
      sessionPlans: [
        {
          sessionNumber: 1,
          objetivo: 'Aprender medición.',
          motivacion: 'Caso real.',
          saberesPrevios: 'Ya sabes sumar.',
          contenido: 'Introducción general al bloque de medición.',
          ejemploResuelto: 'Ejemplo básico con números.',
          practica: [{ enunciado: 'Resuelve el triángulo del ejercicio 3.', pista: 'Relación entre lados.', solucion }],
          aplicacion: 'Aplica en tu casa.',
          autoevaluacion: ['¿Puedo explicarlo?'],
          recursos: [],
          productoIntegrador: 'Avance del día.',
        },
      ],
    });
  }

  it('un contenido NO se da por cubierto si solo aparece en practica.solucion', () => {
    const source = makeSource({
      missions: [missionWithSolucion([`Paso 1: ${FRASE} se usa aquí.`])],
    });
    const report = evaluatePlanningContentAlignment(source, {
      ...ACTIVITIES,
      contenidoFormativo: FRASE,
    });
    const contenido = report.checks.find((c) => c.id === 'contenido')!;
    expect(contenido.covered).toBe(0);
    expect(contenido.missing).toContain(FRASE);
  });

  it('la MISMA frase en contenido del estudiante sí cuenta como cubierta (prueba bidireccional)', () => {
    const source = makeSource({
      missions: [
        missionWithSolucion([]),
      ],
    });
    // La frase vive ahora en `contenido` (texto impreso al estudiante)
    source.missions![0].conceptZero!.coreExplanation = `El ${FRASE} permite resolver problemas.`;
    const report = evaluatePlanningContentAlignment(source, {
      ...ACTIVITIES,
      contenidoFormativo: FRASE,
    });
    const contenido = report.checks.find((c) => c.id === 'contenido')!;
    expect(contenido.covered).toBe(1);
    expect(contenido.missing).toHaveLength(0);
  });
});

describe('utilidades del reintento dirigido', () => {
  it('extractMissingTerms acota a 12 términos y conserva la redacción original', () => {
    const items = Array.from({ length: 20 }, (_, i) => `Tema obligatorio número ${i} del programa oficial`).join('; ');
    const report = evaluatePlanningContentAlignment(
      { missions: [makeMission({ sessionTopic: 'Nada relacionado', sessionFocus: 'Nada relacionado' })] },
      { ...ACTIVITIES, contenidoFormativo: items }
    );
    const terms = extractMissingTerms(report);
    expect(terms).toHaveLength(12);
    expect(terms[0]).toBe('Tema obligatorio número 0 del programa oficial');
  });

  it('sectionCorpus + corpusCoversTerm detectan términos por frase o palabras clave', () => {
    const corpus = sectionCorpus(makeMission());
    expect(corpusCoversTerm(corpus, 'perímetro y área de figuras rectangulares')).toBe(true);
    expect(corpusCoversTerm(corpus, 'sistema de refrigeración industrial')).toBe(false);
    // Cobertura por palabras distintivas (paráfrasis parcial)
    expect(corpusCoversTerm(corpus, 'cálculo del área de rectángulos con fórmula')).toBe(true);
  });
});
