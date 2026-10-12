/**
 * E2E de la cadena de paridad: raw legado del writer → sanitizeSessionPlans →
 * mission.sessionPlans → material-extractor.
 *
 * Cierra el P3 "cadena writer→sanitize→extractor solo unit-testeada": valida
 * end-to-end que la solución modelo llega COMPLETA y en orden al solucionario
 * docente (sección C) y que NUNCA aparece en la guía del estudiante.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSessionPlans } from '@/lib/guide-engine/writers/writer-contract';
import { extractSpecificMaterial } from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';

const ENUNCIADO_1 =
  'Resuelve el sistema 2x2 por eliminación: 2x + y = 7 y x − y = 2.';
const ENUNCIADO_1B =
  'Grafica la recta y = 2x + 1 e identifica su intersección con el eje Y.';
const ENUNCIADO_2 =
  'Verifica la solución del sistema sustituyendo los valores en ambas ecuaciones.';
const PASO_A = 'primer paso: despejar y en la segunda ecuación';
const PASO_B = 'segundo paso: sustituir x en la primera ecuación';
const PASO_C = 'tercer paso: resolver la ecuación resultante en una sola variable';
const PASO_D = 'cuarto paso: calcular la variable restante con el valor obtenido';
const PASO_E = 'quinto paso: escribir la terna ordenada de la solución';
const PASO_INGLES_A = 'Paso A: sustituir los valores encontrados en ambas igualdades';
const PASO_INGLES_B = 'Paso B: comprobar que ambas igualdades se cumplen';

const RAW_PLANS = [
  {
    sessionNumber: 1,
    objetivo: 'Objetivo de aprendizaje de la sesión 1',
    practica: [
      {
        enunciado: ENUNCIADO_1,
        pista: 'Usa eliminación restando las dos ecuaciones.',
        solucion: [
          'Docente: ' + PASO_A,
          'Estudiante: ' + PASO_B,
          'xx',
          PASO_C,
          PASO_D,
          PASO_E,
          'sexto paso: explicar el procedimiento elegido',
          'séptimo paso: este paso debe recortarse por el máximo de 6',
        ],
      },
      {
        enunciado: ENUNCIADO_1B,
        pista: 'Recuerda que la intersección con Y ocurre cuando x = 0.',
      },
    ],
  },
  {
    sessionNumber: 2,
    objetivo: 'Objetivo de aprendizaje de la sesión 2',
    practica: [
      {
        enunciado: ENUNCIADO_2,
        pista: '',
        solution: [PASO_INGLES_A, PASO_INGLES_B],
      },
    ],
  },
  { sessionNumber: 9, objetivo: 'Sesión fuera del bloque', practica: [] },
];

function makeMission(sessionPlans: SessionPlan[]): MissionSection {
  return {
    missionIndex: 1,
    title: 'Misión Formativa: Sistemas de ecuaciones lineales',
    coveredSessions: [1, 2],
    sessionTopic: 'Sistemas de ecuaciones lineales 2x2',
    sessionFocus: 'Resolución e interpretación de sistemas',
    phenomenonHook: {
      story: 'El taller necesita mezclar soluciones para una reacción controlada.',
      detonatingQuestion: '¿Cómo encontrar las cantidades exactas de cada componente?',
    },
    conceptZero: {
      physicalAnalogy: 'Una balanza en equilibrio representa una ecuación.',
      coreExplanation: 'Un sistema 2x2 busca la pareja (x, y) que cumple ambas ecuaciones.',
    },
    iDoSection: { stepByStepDemo: 'Demostración de eliminación con coeficientes enteros.' },
    weDoSection: { guidedPractice: 'Práctica guiada por parejas.', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Reto autónomo con sistema3x3.', workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué estrategia de resolución fue más eficiente y por qué?',
      reflectionPrompts: [],
      criteriaChecklist: [],
    },
    sessionPlans,
    wordCount: 1500,
  };
}

function makeWorkbook(sessionPlans: SessionPlan[]): ActiveWorkTextbook {
  return {
    id: 'wtb-pl-e2e-b0',
    planningId: 'pl-e2e',
    blockIndex: 0,
    blockName: 'Bloque 1: Sistemas de ecuaciones',
    version: 1,
    subsystem: 'bge',
    targetPages: 42,
    totalPages: 12,
    totalWords: 6000,
    generatedAt: new Date('2026-10-12T00:00:00.000Z').toISOString(),
    qualityScore: 85,
    qualityWarning: false,
    coverData: {
      title: 'Cuaderno de Aprendizaje Activo',
      subtitle: 'Bachillerato General Estatal',
      subjectName: 'Pensamiento Matemático III',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Mtra. Prueba',
      schoolName: 'Plantel Demo',
    },
    tableOfContents: [],
    missions: [makeMission(sessionPlans)],
    projectSection: {
      artifactName: 'Kit de medición',
      communityUtility: 'Verificación comunitaria',
      phases: [],
      technicalSpecs: [],
      acceptanceCriteria: [],
    },
    evaluationSection: {
      source: 'generated_fresh',
      rubric: [],
      checklist: [],
      criticalThinkingQuiz: [],
      metacognitiveReflection: { prompts: [] },
    },
  };
}

describe('Cadena de paridad E2E: writer raw → sanitizador → extractor (docente vs estudiante)', () => {
  const plans = sanitizeSessionPlans(RAW_PLANS, [1, 2]);
  const workbook = makeWorkbook(plans ?? []);

  it('el sanitizador produce sessionPlans utilizables dentro del bloque', () => {
    expect(plans).toBeDefined();
    expect(plans).toHaveLength(2);
    expect(plans?.[0]?.sessionNumber).toBe(1);
    expect(plans?.[1]?.sessionNumber).toBe(2);
  });

  it('la solución modelo queda limpia: sin voz docente/estudiante, sin pasos basura, máximo 6', () => {
    const sol = plans?.[0]?.practica[0]?.solucion;
    expect(sol).toBeDefined();
    expect(sol?.[0]).toBe(PASO_A);
    expect(sol?.[1]).toBe(PASO_B);
    expect(sol).toHaveLength(6);
    expect(sol?.[5]).toBe('sexto paso: explicar el procedimiento elegido');
    expect(sol?.join(' ')).not.toContain('séptimo paso');
    expect(sol?.join(' ')).not.toMatch(/docente:/i);
    expect(sol?.join(' ')).not.toMatch(/estudiante:/i);
  });

  it('acepta el alias heredado `solution` en inglés', () => {
    expect(plans?.[1]?.practica[0]?.solucion).toEqual([PASO_INGLES_A, PASO_INGLES_B]);
  });

  it('el solucionario docente imprime la sección C con MISMO orden y pasos completos', () => {
    const solucionario = extractSpecificMaterial(workbook, 'solucionario');

    expect(solucionario).toContain('#### C. Guía de Ejercicios Resueltos');
    expect(solucionario).toContain('#### C2.');
    expect(solucionario).toContain(ENUNCIADO_1);
    expect(solucionario).toContain(ENUNCIADO_1B);
    expect(solucionario).toContain(ENUNCIADO_2);

    const sesion1 = solucionario.indexOf('Sesión 1');
    const sesion2 = solucionario.indexOf('Sesión 2');
    expect(sesion1).toBeGreaterThan(-1);
    expect(sesion2).toBeGreaterThan(sesion1);

    const pasoA = solucionario.indexOf(PASO_A);
    const pasoB = solucionario.indexOf(PASO_B);
    const pasoC = solucionario.indexOf(PASO_C);
    const pasoD = solucionario.indexOf(PASO_D);
    const pasoE = solucionario.indexOf(PASO_E);
    expect(pasoA).toBeGreaterThan(-1);
    expect(pasoB).toBeGreaterThan(pasoA);
    expect(pasoC).toBeGreaterThan(pasoB);
    expect(pasoD).toBeGreaterThan(pasoC);
    expect(pasoE).toBeGreaterThan(pasoD);

    expect(solucionario).toContain(PASO_INGLES_A);
    expect(solucionario).toContain(PASO_INGLES_B);
  });

  it('el ejercicio sin solución modelo cae al fallback honesto del pizarrón', () => {
    const solucionario = extractSpecificMaterial(workbook, 'solucionario');
    expect(solucionario).toContain('modelar en el pizarrón');
  });

  it('la guía del estudiante rinde contenido propio (sin sessionPlans) y NUNCA la solución modelo', () => {
    const guia = extractSpecificMaterial(workbook, 'guia');
    expect(guia).toContain('GUÍA DE TRABAJO DEL ESTUDIANTE');
    expect(guia).toContain('Práctica guiada por parejas.');
    expect(guia).toContain('Reto autónomo con sistema3x3.');
    expect(guia).not.toContain(PASO_A);
    expect(guia).not.toContain(PASO_B);
    expect(guia).not.toContain(PASO_INGLES_A);
    expect(guia).not.toContain('solución modelo (solo docente)');
  });
});
