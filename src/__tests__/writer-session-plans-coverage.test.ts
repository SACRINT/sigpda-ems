/**
 * Fase A — Cobertura total de sessionPlans (anti "36 vs 72").
 *
 * El motor editorial solo aplana mission.sessionPlans: si un writer no emite
 * planes (o la IA los omite), esas sesiones desaparecen del libro, del solucionario
 * y de los planes de clase. Estos tests son load-bearing contra las mutaciones:
 *  - "project/evaluation writer no pide sessionPlans" (bug raíz 36 vs 72);
 *  - "completeSessionPlans → sanitizeSessionPlans" (fill de sesiones faltantes);
 *  - "maxTokens: 8192" (truncado de JSON con 9 planes en la respuesta).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWithRotation } from '@/lib/ai-provider';
import { generateProjectMission } from '@/lib/guide-engine/writers/project-writer';
import { generateEvaluationSection } from '@/lib/guide-engine/writers/evaluation-writer';
import {
  completeSessionPlans,
  type WriterInput,
} from '@/lib/guide-engine/writers/writer-contract';
import type { MissionBlueprint } from '@/lib/guide-engine/blueprint-architect-agent';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
}));

const PROJECT_SESSIONS = [13, 14, 15, 16, 17, 18, 19, 20, 21];
const EVAL_SESSIONS = [22, 23, 24];

const MISSIONS: MissionBlueprint[] = [
  { missionIndex: 1, title: 'Misión 1: Fundamentación e Intuición — Apertura', sessionNumbers: [1, 2, 3], sessionTopic: 'Ecuaciones lineales', focus: 'Concepto Cero', missionType: 'foundation', targetPages: 9, targetWords: 9000 },
  { missionIndex: 2, title: 'Misión 2: Laboratorio — Desarrollo', sessionNumbers: [4, 5, 6, 7, 8, 9, 10, 11, 12], sessionTopic: 'Resolución de ecuaciones', focus: 'Práctica guiada', missionType: 'lab', targetPages: 9, targetWords: 9000 },
  { missionIndex: 3, title: 'Misión 3: Construcción del Artefacto Real — Desarrollo', sessionNumbers: PROJECT_SESSIONS, sessionTopic: 'Modelación', focus: 'Proyecto', missionType: 'project', targetPages: 9, targetWords: 9000 },
  { missionIndex: 4, title: 'Misión 4: Demostración Integral y Evaluación Formativa — Cierre', sessionNumbers: EVAL_SESSIONS, sessionTopic: 'Evaluación', focus: 'Cierre', missionType: 'evaluation', targetPages: 6, targetWords: 6000 },
];

const planning = {
  id: 'pl-1',
  teacherId: 't-1',
  uacName: 'Pensamiento Matemático III',
  semester: 3,
  component: 'fundamental',
  curriculumName: 'MCCEMS 2026-2027',
  paecContext: 'Falta de espacios de esparcimiento comunitario en Venustiano Carranza',
  extractedData: null,
  contentJson: null,
  status: 'generated',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
} as unknown as Planning;

function makeInput(overrides: Partial<WriterInput> = {}): WriterInput {
  return {
    planning,
    blockIndex: 0,
    blockName: 'Bloque 1: Ecuaciones lineales y situaciones de interés',
    sessions: [],
    missions: MISSIONS,
    paecContext: 'Falta de espacios de esparcimiento comunitario en Venustiano Carranza',
    studentProfile: 'Estudiantes de tercer semestre con acceso a dispositivos móviles.',
    subsystem: 'bge',
    uacName: 'Pensamiento Matemático III',
    targetWords: { min: 4000, ideal: 6000, max: 8000 },
    ...overrides,
  };
}

function makeRawPlan(n: number): Record<string, unknown> {
  return {
    sessionNumber: n,
    objetivo: `Lo que vas a aprender en la sesión ${n}: modelar situaciones reales con ecuaciones lineales.`,
    motivacion: `Docente: plantear la situación. Historia real de la comunidad durante la sesión ${n}: el comité organizó un evento con datos concretos y presupuesto verificable.`,
    saberesPrevios: `Ya resolviste ecuaciones simples de primer grado en sesiones previas del bloque.`,
    contenido: `Contenido teórico de la sesión ${n}: definiciones, fórmulas y procedimiento explicado paso a paso con tecnicismos resueltos para que aprendas solo.`,
    ejemploResuelto: `Ejemplo con números de la sesión ${n}: 12x + 60 = 180; se restan 60 en ambos miembros y se divide entre 12, resultando x = 10.`,
    practica: [
      {
        enunciado: `Ejercicio 1 de la sesión ${n}: calcula la incógnita con los datos del enunciado.`,
        pista: 'Agrupa los términos semejantes en cada miembro antes de despejar.',
        solucion: ['Paso 1: restar 60 en ambos miembros', 'Paso 2: dividir entre 12', 'Respuesta final: x = 10'],
      },
      {
        enunciado: `Ejercicio 2 de la sesión ${n}: modela la situación con una ecuación lineal.`,
        pista: 'Traduce primero el enunciado a una ecuación con la incógnita.',
        solucion: ['Paso 1: plantear la ecuación', 'Respuesta final: y = 4'],
      },
    ],
    aplicacion: `Aplica lo aprendido a una situación real de tu vida diaria en la comunidad escolar.`,
    autoevaluacion: [
      `¿Puedo explicar el concepto central de la sesión ${n} con mis palabras?`,
      `¿Logré resolver la práctica sin mirar el ejemplo resuelto?`,
    ],
    recursos: [
      { titulo: 'Video: ecuaciones lineales en YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', tipo: 'video' },
    ],
    productoIntegrador: `Agrega el avance de la sesión ${n} a tu producto integrador con evidencia fechada.`,
  };
}

function makeRawPlans(sessionNumbers: number[]): Record<string, unknown>[] {
  return sessionNumbers.map(makeRawPlan);
}

function projectResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    artifactName: 'Prototipo de huerto comunitario hidropónico',
    communityUtility:
      'El artefacto produce alimentos frescos para la comunidad escolar y enseña modelación de ecuaciones con datos reales del huerto durante todas las fases del proyecto comunitario.',
    learningObjectives: [
      'Diseñar la arquitectura técnica del huerto hidropónico.',
      'Construir y verificar el prototipo funcional con datos medidos.',
      'Validar el impacto comunitario en el entorno PAEC.',
    ],
    requiredMaterials: ['Tubo PVC de 4 pulgadas — 3 m', 'Bomba de acuario de bajo consumo'],
    executionSteps: ['1. Diagnóstico y acopio', '2. Diagramación', '3. Ensamble', '4. Pruebas', '5. Integración'],
    deliveryCriteria: ['Prototipo operativo para demostración'],
    registrationFormat: 'BITÁCORA TÉCNICA DE PROYECTO\nSemana: [ ] Fecha: [ ] Equipo: [ ]\nActividad: _________________\nFirma Docente: _________ Sello: [ ]',
    phases: [
      { phaseNum: 1, title: 'Fase 1: Diagnóstico técnico', allocatedHours: 2, deliverables: ['Boceto'], instructions: 'Definir alcance y materiales del huerto.' },
      { phaseNum: 2, title: 'Fase 2: Construcción', allocatedHours: 4, deliverables: ['Prototipo'], instructions: 'Ensambar tuberías y instalar la bomba.' },
    ],
    technicalSpecs: ['Norma NOM de materiales plásticos'],
    acceptanceCriteria: ['El huerto riega de forma continua 30 minutos'],
    autonomousChallenge:
      'Desafío autónomo de campo: mide el flujo de agua del prototipo durante 5 minutos, calcula el volumen por minuto con una ecuación lineal y compáralo contra el caudal nominal del fabricante, registrando la desviación porcentual en tu bitácora.',
    rubricSummary: [
      {
        criterion: 'Funcionalidad del huerto',
        excellent: 'Opera al 100% cumpliendo criterios.',
        good: 'Opera con detalles menores.',
        sufficient: 'Opera con asistencia.',
        insufficient: 'No opera.',
      },
    ],
    sessionPlans: makeRawPlans(PROJECT_SESSIONS),
    ...overrides,
  });
}

function evaluationResponse(overrides: Record<string, unknown> = {}): string {
  const tier = (level: string, levelName: string, from: number) => ({
    level,
    levelName,
    description: `Reactivos de ${level} para el bloque.`,
    exercises: [
      { number: from, statement: `Ejercicio ${from} con datos concretos del bloque.`, contextOrData: 'Datos del contexto poblano.', expectedOutputOrCriteria: 'Resultado verificable.', hint: 'Usa la fórmula del bloque.' },
      { number: from + 1, statement: `Ejercicio ${from + 1} con datos concretos del bloque.`, contextOrData: 'Datos del contexto poblano.', expectedOutputOrCriteria: 'Resultado verificable.', hint: 'Revisa el ejemplo resuelto.' },
    ],
  });
  return JSON.stringify({
    rubric: [
      {
        criterion: 'Rigor metodológico',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Dominio autónomo y riguroso de los procedimientos.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Procedimientos precisos con errores menores.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Cumple lo básico con apoyo puntual.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Requiere asesoría para procedimientos esenciales.' },
        ],
      },
    ],
    checklist: [{ item: 'Presenta la bitácora completa', category: 'Formato' }],
    tieredExercises: [
      tier('basico', 'Nivel Básico: Comprensión y Aplicación Directa', 1),
      tier('intermedio', 'Nivel Intermedio: Análisis y Modelación en Contexto', 3),
      tier('avanzado', 'Nivel Avanzado: Optimización y Transferencia', 5),
    ],
    criticalThinkingQuiz: [
      { questionNumber: 1, question: '¿Cómo aplicas lo aprendido en tu comunidad?', scenario: 'Situación real en Puebla.', answerExplanation: 'Justificación formativa con datos concretos de la experiencia vivida en el bloque.' },
    ],
    metacognitiveReflection: { prompts: ['¿Qué aprendizaje del bloque fue más transformador?', '¿Qué estrategia te ayudó a superar el obstáculo técnico más difícil?'] },
    sessionPlans: makeRawPlans(EVAL_SESSIONS),
    ...overrides,
  });
}

describe('completeSessionPlans — cobertura garantizada', () => {
  it('devuelve la lista completa cuando la IA emitió todos los planes', () => {
    const plans = completeSessionPlans(makeRawPlans([1, 2, 3]), [1, 2, 3]);
    expect(plans.map((p) => p.sessionNumber)).toEqual([1, 2, 3]);
    expect(plans[0].practica[0].pista).toContain('términos semejantes');
    expect(plans[0].practica[0].solucion?.length).toBeGreaterThan(0);
  });

  it('completa las sesiones faltantes con planes genéricos en voz de estudiante', () => {
    const plans = completeSessionPlans(makeRawPlans([1]), [1, 2, 3]);
    expect(plans.map((p) => p.sessionNumber)).toEqual([1, 2, 3]);
    expect(plans[1].objetivo).toContain('sesión 2');
    expect(plans[2].objetivo).toContain('sesión 3');
    expect(plans[1].motivacion.length).toBeGreaterThan(20);
    expect(plans[1].practica.length).toBeGreaterThan(0);
  });

  it('deduplica sesiones repetidas y descarta planes fuera de la misión', () => {
    const plans = completeSessionPlans(
      [makeRawPlan(13), makeRawPlan(13), makeRawPlan(99)],
      [13, 14]
    );
    expect(plans.map((p) => p.sessionNumber)).toEqual([13, 14]);
  });

  it('con IA sin planes utilizables cubre todas las sesiones con contenido base', () => {
    const plans = completeSessionPlans(undefined, [4, 5]);
    expect(plans.map((p) => p.sessionNumber)).toEqual([4, 5]);
    expect(plans[0].contenido.length).toBeGreaterThan(20);
  });

  it('sin sesiones cubiertas devuelve arreglo vacío', () => {
    expect(completeSessionPlans(makeRawPlans([1]), [])).toEqual([]);
  });
});

describe('project-writer — sessionPlans de las sesiones 13-21', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emite sessionPlans para las 9 sesiones asignadas con maxTokens 16384', async () => {
    vi.mocked(generateWithRotation).mockResolvedValue(projectResponse());

    const out = await generateProjectMission(makeInput());

    expect(generateWithRotation).toHaveBeenCalledTimes(1);
    expect(generateWithRotation).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      't-1',
      false,
      expect.objectContaining({ maxTokens: 16384 })
    );
    const plans = out.section.sessionPlans ?? [];
    expect(plans.map((p) => p.sessionNumber)).toEqual(PROJECT_SESSIONS);
    // Sanitización de voz docente (paridad libro ↔ solucionario).
    expect(plans[0].motivacion).not.toMatch(/^Docente:/i);
    expect(plans[0].motivacion).not.toContain('plantear la situación');
    expect(plans[0].motivacion).toContain('Historia real de la comunidad');
    expect(plans[0].practica[0].solucion?.length).toBeGreaterThan(0);
  }, 20000);

  it('si la IA omite planes, reintenta con instrucción y termina cubriendo las 9 sesiones', async () => {
    const partial = projectResponse({ sessionPlans: makeRawPlans([13, 14, 15, 16, 17]) });
    vi.mocked(generateWithRotation)
      .mockResolvedValue(partial)
      .mockResolvedValue(partial);

    const out = await generateProjectMission(makeInput());

    expect(generateWithRotation).toHaveBeenCalledTimes(2);
    const retryPrompt = vi.mocked(generateWithRotation).mock.calls[1][1] as string;
    expect(retryPrompt).toContain('sessionPlans');
    expect(retryPrompt).toContain('13, 14, 15, 16, 17, 18, 19, 20, 21');

    const plans = out.section.sessionPlans ?? [];
    expect(plans.map((p) => p.sessionNumber)).toEqual(PROJECT_SESSIONS);
    // Las 4 sesiones que la IA omitió quedan con plan genérico (no desaparecen).
    expect(plans.find((p) => p.sessionNumber === 18)?.objetivo).toContain('sesión 18');
  }, 20000);

  it('si el modelo falla por completo, el fallback cubre las 9 sesiones', async () => {
    vi.mocked(generateWithRotation).mockRejectedValue(new Error('upstream 503'));

    const out = await generateProjectMission(makeInput());

    expect(out.warnings.join(' ')).toContain('fallback');
    const plans = out.section.sessionPlans ?? [];
    expect(plans.map((p) => p.sessionNumber)).toEqual(PROJECT_SESSIONS);
    expect(plans[0].contenido.length).toBeGreaterThan(20);
  }, 20000);
});

describe('evaluation-writer — sessionPlans de las sesiones 22-24', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emite sessionPlans para las sesiones de cierre y anuncia las sesiones en el prompt', async () => {
    vi.mocked(generateWithRotation).mockResolvedValue(evaluationResponse());

    const out = await generateEvaluationSection(makeInput());

    expect(generateWithRotation).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(generateWithRotation).mock.calls[0][1] as string;
    expect(prompt).toContain('Sesiones asignadas: Sesiones 22, 23, 24');

    const plans = out.section.sessionPlans ?? [];
    expect(plans.map((p) => p.sessionNumber)).toEqual(EVAL_SESSIONS);
    expect(out.evaluationSection?.tieredExercises?.length).toBe(3);
    expect(plans[0].practica[0].solucion?.length).toBeGreaterThan(0);
  }, 20000);

  it('si la IA no emite planes, reintenta y completa la cobertura de las 3 sesiones', async () => {
    const noPlans = evaluationResponse({ sessionPlans: [] });
    vi.mocked(generateWithRotation)
      .mockResolvedValue(noPlans)
      .mockResolvedValue(noPlans);

    const out = await generateEvaluationSection(makeInput());

    expect(generateWithRotation).toHaveBeenCalledTimes(2);
    const retryPrompt = vi.mocked(generateWithRotation).mock.calls[1][1] as string;
    expect(retryPrompt).toContain('EXACTAMENTE 3 objetos en \'sessionPlans\'');

    const plans = out.section.sessionPlans ?? [];
    expect(plans.map((p) => p.sessionNumber)).toEqual(EVAL_SESSIONS);
  }, 20000);

  it('si el modelo falla por completo, el fallback cubre las 3 sesiones', async () => {
    vi.mocked(generateWithRotation).mockRejectedValue(new Error('timeout upstream'));

    const out = await generateEvaluationSection(makeInput());

    expect(out.warnings.join(' ')).toContain('contingencia');
    const plans = out.section.sessionPlans ?? [];
    expect(plans.map((p) => p.sessionNumber)).toEqual(EVAL_SESSIONS);
  }, 20000);
});
