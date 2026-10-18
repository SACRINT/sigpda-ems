// src/__tests__/student-teacher-parity.test.ts
/**
 * PARIDAD 1:1 LIBRO DEL ESTUDIANTE ↔ SOLUCIONARIO DOCENTE
 * SIGPDA-EMS — SEMS Puebla MCCEMS 2026-2027
 *
 * Invariantes verificadas:
 *  1. Cada ejercicio impreso en "Practica" (sessionPlans) del libro aparece en el
 *     solucionario docente con su MISMO enunciado, su pista visible y su solución modelo.
 *  2. El sanitizador de planes conserva `solucion` (la parte aguas docente) y descarta basura.
 *  3. GARANTÍA DE NO-FILTRACIÓN: los renderers del libro del estudiante (DOCX/PDF)
 *     jamás leen `item.solucion` — la solución solo vive en el documento docente.
 *  4. Misiones sin sessionPlans conservan el formato heredado (sin regresión).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import { sanitizeSessionPlans } from '@/lib/guide-engine/writers/writer-contract';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque, SecuenciaSesion } from '@/types/planning';

const EX1 = 'Calcula el área de un terreno rectangular de 12.5 m de largo por 8.4 m de ancho.';
const EX1_PISTA = 'Recuerda: área de un rectángulo = largo × ancho.';
const EX1_SOL = [
  'Paso 1: identifica largo = 12.5 m y ancho = 8.4 m.',
  'Paso 2: multiplica 12.5 × 8.4 = 105.',
  'Respuesta final: el terreno mide 105 m².',
];
const EX2 = 'Un estudiante midió 3.20 m y 4.75 m para dos lados de una mesa; calcula su perímetro.';
const EX2_PISTA = 'Suma los cuatro lados (la mesa es rectangular).';
const EX2_SOL = ['Paso 1: perímetro = 2 × (3.20 + 4.75).', 'Paso 2: 2 × 7.95 = 15.90 m.'];

function makeParityWorkbook(): ActiveWorkTextbook {
  const mission = {
    missionIndex: 1,
    title: 'Optimización de superficies en el taller comunitario',
    coveredSessions: [1, 2],
    sessionTopic: 'Perímetro y área de figuras planas',
    sessionFocus: 'Cálculo de superficies para mobiliario escolar',
    phenomenonHook: {
      story: 'El taller de la comunidad necesita fabricar bancas con láminas metálicas.',
      detonatingQuestion: '¿Cuánta lámina gasta el taller en cada banca?',
    },
    conceptZero: {
      physicalAnalogy: 'El papel que cubre una mesa es su área.',
      coreExplanation: 'El área mide la superficie encerrada; el perímetro mide el borde.',
      narrativeExplanation: 'Elegir medidas eficientes reduce el costo de material.',
      solvedExample: {
        problemStatement: 'Calcular el área de un rectángulo de 5 m por 3 m.',
        solutionSteps: ['Paso 1: A = 5 × 3.', 'Paso 2: A = 15 m².'],
        interpretation: 'La superficie es 15 m².',
      },
    },
    iDoSection: { stepByStepDemo: 'Modelado de cálculo de área paso a paso.' },
    weDoSection: { guidedPractice: 'En equipos calculen el área de la banca del salón.' },
    youDoSection: { autonomousChallenge: 'Calcula el área de tu escritorio en casa.' },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Cómo distingues área de perímetro?',
      reflectionPrompts: ['¿Dónde usas área en tu casa?'],
      criteriaChecklist: ['Identifica datos', 'Aplica fórmula'],
    },
    sessionPlans: [
      {
        sessionNumber: 1,
        objetivo: 'Aprender a calcular perímetro y área de figuras rectangulares.',
        motivacion: 'El taller de tu comunidad necesita medir bancas nuevas.',
        saberesPrevios: 'Ya conoces las operaciones básicas de suma y multiplicación.',
        contenido: 'El área es la superficie encerrada en una figura, medida en unidades cuadradas. El perímetro es la longitud total del borde, medida en unidades lineales.',
        ejemploResuelto: 'Rectángulo de 5 m × 3 m: A = 5 × 3 = 15 m² y P = 2 × (5 + 3) = 16 m.',
        practica: [
          { enunciado: EX1, pista: EX1_PISTA, solucion: EX1_SOL },
          { enunciado: EX2, pista: EX2_PISTA, solucion: EX2_SOL },
        ],
        aplicacion: 'Mide un mueble de tu casa y calcula su área.',
        autoevaluacion: ['¿Puedo distinguir área de perímetro?'],
        recursos: [],
        productoIntegrador: 'Agrega los cálculos a tu proyecto.',
      },
      {
        sessionNumber: 2,
        objetivo: 'Aplicar el cálculo de superficies a problemas reales del taller.',
        motivacion: 'Cada centímetro desperdiciado cuesta a la cooperativa.',
        saberesPrevios: 'En la sesión 1 calculaste perímetro y área de rectángulos.',
        contenido: 'Para combinar figuras se descomponen en rectángulos y se suman sus áreas parciales.',
        ejemploResuelto: 'Una forma en L de 6×4 con un hueco de 2×2: A = 24 − 4 = 20 m².',
        practica: [
          { enunciado: 'Calcula el área de una forma en L de 6 m × 4 m con un hueco de 2 m × 2 m.', pista: 'Área total menos el hueco.', solucion: ['Paso 1: A total = 6 × 4 = 24 m².', 'Paso 2: A hueco = 2 × 2 = 4 m².', 'Respuesta final: A = 24 − 4 = 20 m².'] },
        ],
        aplicacion: 'Calcula la lámina necesaria para una repisa en L.',
        autoevaluacion: ['¿Puedo descomponer figuras complejas?'],
        recursos: [],
        productoIntegrador: 'Incorpora el cálculo a tu plano.',
      },
    ],
    wordCount: 800,
  };

  return {
    uacName: 'Pensamiento Matemático III',
    blockName: 'Bloque I: Medición y Superficies',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO ESTATAL DE PRUEBA',
      subjectName: 'Pensamiento Matemático III',
      semester: 2,
      paecProjectName: 'Cooperativa Artesanal de Prueba',
    },
    missions: [mission],
  } as unknown as ActiveWorkTextbook;
}

describe('Paridad 1:1 libro del estudiante ↔ solucionario docente', () => {
  const materials = extractMaterialsFromWorkbook(makeParityWorkbook());
  const solucionario = materials.solucionarioDocente;

  it('encabezado de paridad explícito cuando existen sessionPlans', () => {
    expect(solucionario).toContain('Guía de Ejercicios Resueltos');
    expect(solucionario).toContain('MISMO ORDEN Y CONTENIDO QUE EL LIBRO DEL ESTUDIANTE');
  });

  it('cada enunciado del libro aparece literal en el solucionario (1:1)', () => {
    expect(solucionario).toContain(EX1);
    expect(solucionario).toContain(EX2);
    expect(solucionario).toContain('Calcula el área de una forma en L de 6 m × 4 m con un hueco de 2 m × 2 m.');
  });

  it('cada pista visible en el libro aparece en el solucionario', () => {
    expect(solucionario).toContain(EX1_PISTA);
    expect(solucionario).toContain(EX2_PISTA);
  });

  it('cada solución modelo (solo docente) se imprime completa paso a paso', () => {
    for (const step of [...EX1_SOL, ...EX2_SOL]) {
      expect(solucionario).toContain(step);
    }
    expect(solucionario).toContain('Respuesta final: A = 24 − 4 = 20 m².');
  });

  it('la solución NO se coloca antes de su ejercicio ni se mezcla entre sesiones', () => {
    const s1 = solucionario.indexOf('**Sesión 1 —');
    const s2 = solucionario.indexOf('**Sesión 2 —');
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s2).toBeGreaterThan(s1);
    // El enunciado del ejercicio 1 y su solución van juntos en la sesión 1
    const ex1Pos = solucionario.indexOf(EX1, s1);
    const sol1Pos = solucionario.indexOf(EX1_SOL[2], s1);
    expect(ex1Pos).toBeGreaterThan(s1);
    expect(sol1Pos).toBeGreaterThan(ex1Pos);
    expect(sol1Pos).toBeLessThan(s2);
  });

  it('misión sin sessionPlans conserva el encabezado heredado (sin regresión)', () => {
    const legacy = makeParityWorkbook();
    const m = legacy.missions![0];
    delete (m as { sessionPlans?: unknown }).sessionPlans;
    const out = extractMaterialsFromWorkbook(legacy);
    expect(out.solucionarioDocente).toContain(
      '#### C. Criterios de Acreditación y Solución del Reto'
    );
    expect(out.solucionarioDocente).not.toContain('Guía de Ejercicios Resueltos');
  });
});

describe('Sanitizador de sessionPlans: conserva la parte docente (solucion)', () => {
  const covered = [1];

  it('conserva los pasos de solución válidos', () => {
    const plans = sanitizeSessionPlans(
      [{ sessionNumber: 1, enunciadoIgnored: true, practica: [{ enunciado: EX1, pista: EX1_PISTA, solucion: EX1_SOL }] }],
      covered
    );
    expect(plans).toHaveLength(1);
    expect(plans![0].practica[0].solucion).toEqual(EX1_SOL);
  });

  it('descarta pasos basura, acota a 6 pasos y limpia prefijos de voz', () => {
    const longSteps = Array.from({ length: 9 }, (_, i) => `Paso ${i + 1}: detalle numérico del cálculo.`);
    const plans = sanitizeSessionPlans(
      [
        {
          sessionNumber: 1,
          practica: [
            {
              enunciado: 'Resuelve el ejercicio de verificación de áreas del cuaderno activo.',
              pista: 'Divide en rectángulos.',
              solucion: ['Docente: guiar al grupo', 'x', ...longSteps],
            },
          ],
        },
      ],
      covered
    );
    const sol = plans![0].practica[0].solucion!;
    expect(sol[0]).toBe('guiar al grupo');
    expect(sol).toHaveLength(6);
    expect(sol.every((s) => s.length >= 5)).toBe(true);
  });

  it('omite el campo cuando no hay solución utilizable (queda opcional)', () => {
    const plans = sanitizeSessionPlans(
      [{ sessionNumber: 1, practica: [{ enunciado: EX1, pista: EX1_PISTA, solucion: ['a', ''] }] }],
      covered
    );
    expect(plans![0].practica[0].solucion).toBeUndefined();
  });
});

describe('Paridad plan de clase ↔ sessionPlans del libro', () => {
  it('la actividad del estudiante en el plan de clase refleja el plan del libro', () => {
    const materials = extractMaterialsFromWorkbook(makeParityWorkbook());
    const plan = materials.planesDeClase.find((p) => p.numeroSesion === 1);
    expect(plan).toBeDefined();
    expect(plan!.desarrollo.actividadEstudiante).toContain('Libro del estudiante');
    expect(plan!.desarrollo.actividadEstudiante).toContain('Aprender a calcular perímetro y área');
    expect(plan!.desarrollo.actividadEstudiante).toContain('2 ejercicio(s)');
  });

  it('sin sessionPlans la actividad hereda el comportamiento previo (sin texto de libro)', () => {
    const legacy = makeParityWorkbook();
    delete (legacy.missions![0] as { sessionPlans?: unknown }).sessionPlans;
    const materials = extractMaterialsFromWorkbook(legacy);
    const plan = materials.planesDeClase.find((p) => p.numeroSesion === 1);
    expect(plan!.desarrollo.actividadEstudiante).not.toContain('Libro del estudiante');
  });

  it('el plan de clase lista los mismos enunciados y pistas del libro (sin soluciones)', () => {
    const materials = extractMaterialsFromWorkbook(makeParityWorkbook());
    const plan1 = materials.planesDeClase.find((p) => p.numeroSesion === 1);
    expect(plan1!.desarrollo.actividadEstudiante).toContain(EX1);
    expect(plan1!.desarrollo.actividadEstudiante).toContain(EX1_PISTA);
    expect(plan1!.desarrollo.actividadEstudiante).toContain(EX2);
    expect(plan1!.desarrollo.actividadEstudiante).toContain(EX2_PISTA);
    expect(plan1!.desarrollo.actividadEstudiante).toContain(
      'Ejercicios de la sesión (mismos enunciados que el libro y el solucionario docente):'
    );
    // La solución modelo vive SOLO en el solucionario docente: ni en el plan ni en el libro.
    expect(plan1!.desarrollo.actividadEstudiante).not.toContain(EX1_SOL[2]);
    const plan2 = materials.planesDeClase.find((p) => p.numeroSesion === 2);
    expect(plan2!.desarrollo.actividadEstudiante).toContain(
      'Calcula el área de una forma en L de 6 m × 4 m con un hueco de 2 m × 2 m.'
    );
  });
});

// ─── Fase B: cobertura total 24/24 con paridad plan ↔ libro ↔ solucionario ────

const FULL_SESSION_GROUPS: ReadonlyArray<{ sessions: number[]; topic: string }> = [
  { sessions: [1, 2, 3], topic: 'fracciones y decimales' },
  { sessions: [4, 5, 6, 7, 8, 9, 10, 11, 12], topic: 'proporcionalidad y porcentajes' },
  { sessions: [13, 14, 15, 16, 17, 18, 19, 20, 21], topic: 'geometría del plano' },
  { sessions: [22, 23, 24], topic: 'estadística descriptiva' },
];

function topicOfSession(n: number): string {
  return FULL_SESSION_GROUPS.find((g) => g.sessions.includes(n))!.topic;
}

function fullSessionPlan(n: number, topic: string) {
  return {
    sessionNumber: n,
    objetivo: `Objetivo ${n}: dominar ${topic}.`,
    motivacion: `Caso real ${n} de ${topic} en la comunidad.`,
    saberesPrevios: `En sesiones previas trabajaste aspectos de ${topic}.`,
    contenido: `Contenido teórico de ${topic}: definiciones, propiedades y fórmulas esenciales.`,
    ejemploResuelto: `Ejemplo ${n}: resolver un problema de ${topic} paso a paso con números concretos.`,
    practica: [
      {
        enunciado: `Ejercicio ${n}.1: aplica ${topic} para resolver el caso planteado con datos concretos.`,
        pista: `Usa la fórmula de ${topic} del ejemplo resuelto.`,
        solucion: [
          `Paso 1: identifica los datos del ejercicio ${n}.`,
          `Paso 2: sustituye en la fórmula de ${topic}.`,
          `Respuesta final: resultado del ejercicio ${n}.`,
        ],
      },
    ],
    aplicacion: `Aplica ${topic} en una situación de tu vida diaria.`,
    autoevaluacion: [`¿Puedo resolver ejercicios de ${topic}?`],
    recursos: [],
    productoIntegrador: `Agrega la evidencia de la sesión ${n} a tu proyecto.`,
  };
}

function makeFullCoverageWorkbook(): { workbook: ActiveWorkTextbook; sequence: SecuenciaBloque } {
  const missions = FULL_SESSION_GROUPS.map((group, k) => ({
    missionIndex: k + 1,
    title: `Misión ${k + 1}: ${group.topic}`,
    coveredSessions: group.sessions,
    sessionTopic: group.topic,
    sessionFocus: `${group.topic} en contexto comunitario`,
    phenomenonHook: {
      story: `Situación real de ${group.topic} en la comunidad.`,
      detonatingQuestion: `¿Cómo aplicamos ${group.topic} en la vida diaria?`,
    },
    conceptZero: {
      physicalAnalogy: `Analogía cotidiana de ${group.topic}.`,
      coreExplanation: `Explicación fundamental de ${group.topic} con definiciones y fórmulas.`,
      solvedExample: {
        problemStatement: `Problema modelo de ${group.topic}.`,
        solutionSteps: ['Paso 1: sustituir datos.', 'Paso 2: operar.'],
        interpretation: 'Resultado verificado.',
      },
    },
    iDoSection: { stepByStepDemo: `Demostración modelada de ${group.topic}.` },
    weDoSection: { guidedPractice: `Práctica guiada de ${group.topic}.` },
    youDoSection: { autonomousChallenge: `Reto autónomo de ${group.topic}.` },
    troubleshooting: [],
    formativeCheckpoint: {
      question: `¿Qué aprendiste de ${group.topic}?`,
      reflectionPrompts: ['Reflexiona sobre tu proceso de aprendizaje.'],
      criteriaChecklist: ['Explico el concepto con claridad.'],
    },
    sessionPlans: group.sessions.map((n) => fullSessionPlan(n, group.topic)),
    wordCount: 600,
  }));

  const workbook = {
    uacName: 'Pensamiento Matemático III',
    blockName: 'Bloque I: Medición y Superficies',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO ESTATAL DE PRUEBA',
      subjectName: 'Pensamiento Matemático III',
      semester: 2,
      paecProjectName: 'Proyecto Comunitario de Prueba',
    },
    missions,
  } as unknown as ActiveWorkTextbook;

  const sessions: SecuenciaSesion[] = Array.from({ length: 24 }, (_, i) => {
    const n = i + 1;
    const phase: SecuenciaSesion['phase'] = n <= 3 ? 'Apertura' : n <= 21 ? 'Desarrollo' : 'Cierre';
    return {
      sessionNum: n,
      totalSessions: 24,
      phase,
      title: `Título único de la sesión ${n}`,
      teachingActivity: `El docente guía la sesión ${n} paso a paso con el grupo.`,
      learningActivity: `El estudiante desarrolla la sesión ${n} en su cuaderno.`,
      evidence: `Evidencia de la sesión ${n}`,
      evaluation: `Evaluación formativa de la sesión ${n}`,
    };
  });

  return {
    workbook,
    sequence: { blockIndex: 0, blockName: 'Bloque I: Medición y Superficies', hours: 34, sessions },
  };
}

describe('Paridad total 24/24: planes de clase y solucionario con cobertura completa (Fase B)', () => {
  const { workbook, sequence } = makeFullCoverageWorkbook();
  const materials = extractMaterialsFromWorkbook(workbook, sequence);
  const expectedNumbers = Array.from({ length: 24 }, (_, i) => i + 1);

  it('genera exactamente los 24 planes consecutivos y la auditoría de coherencia no arroja errores', () => {
    expect(materials.planesDeClase.map((p) => p.numeroSesion)).toEqual(expectedNumbers);
    expect(materials.coherencia?.errors).toEqual([]);
    expect(materials.coherencia?.ok).toBe(true);
  });

  it('el solucionario lista exactamente las 24 sesiones en orden 1..24', () => {
    const headers = materials.solucionarioDocente.match(/\*\*Sesión (\d+) —/g) ?? [];
    expect(headers.map((h) => Number(h.match(/(\d+)/)![1]))).toEqual(expectedNumbers);
  });

  it('cada plan de clase contiene el enunciado y la pista de su sesión (paridad plan ↔ libro ↔ solucionario)', () => {
    for (let n = 1; n <= 24; n++) {
      const topic = topicOfSession(n);
      const enunciado = `Ejercicio ${n}.1: aplica ${topic} para resolver el caso planteado con datos concretos.`;
      const pista = `Usa la fórmula de ${topic} del ejemplo resuelto.`;
      const plan = materials.planesDeClase[n - 1];
      expect(plan.desarrollo.actividadEstudiante).toContain(enunciado);
      expect(plan.desarrollo.actividadEstudiante).toContain(pista);
      expect(materials.solucionarioDocente).toContain(enunciado);
      expect(materials.solucionarioDocente).toContain(pista);
      // La solución modelo permanece SOLO en el solucionario, nunca en el plan de clase.
      expect(plan.desarrollo.actividadEstudiante).not.toContain(`Respuesta final: resultado del ejercicio ${n}.`);
      expect(materials.solucionarioDocente).toContain(`Respuesta final: resultado del ejercicio ${n}.`);
    }
  });
});

describe('Garantía de no-filtración: el libro del estudiante nunca lee .solucion', () => {
  const root = process.cwd();
  const rendererFiles = [
    join(root, 'src', 'lib', 'docx-workbook-renderer.ts'),
    join(root, 'src', 'lib', 'pdf-workbook-renderer.ts'),
  ];

  for (const file of rendererFiles) {
    it(`${file.split(/[\\/]/).pop()} no contiene acceso a la propiedad .solucion`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\.solucion\b/);
    });
  }

  it('el sanitizador no filtra soluciones hacia campos de estudiante fuera de practica', () => {
    const plans = sanitizeSessionPlans(
      [{ sessionNumber: 1, practica: [{ enunciado: EX1, pista: EX1_PISTA, solucion: EX1_SOL }], contenido: EX1_SOL[0] }],
      [1]
    );
    // `contenido` (teoría impresa al estudiante) NO hereda la solución
    expect(plans![0].contenido).not.toContain('Respuesta final');
  });
});
