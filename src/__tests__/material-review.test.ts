import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import { buildSacrintDeck, buildSacrintInfographic } from '@/lib/visual-engine/sacrint/spec';

// ── Mocks para pruebas de integración en cascada y rutas de descarga ─────────
const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockGetTeacherByEmail = vi.fn();
const mockGetPlanningExtraById = vi.fn();
const mockGetBlockWorkbook = vi.fn();
const mockSql = vi.fn();

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (email: string) => mockGetTeacherByEmail(email),
  getPlanningExtraById: (id: string, teacherId: string) => mockGetPlanningExtraById(id, teacherId),
  getBlockWorkbook: (planningId: string, blockIdx: number) => mockGetBlockWorkbook(planningId, blockIdx),
  WorkerLeaseLostError: class WorkerLeaseLostError extends Error {},
}));

vi.mock('@/lib/visual-engine/visual-asset-manager', () => ({
  resolveVisualForMission: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { cascadeBlockMaterials } from '@/lib/guide-engine/cascade-block-materials';
import { GET as GET_PDF_EXTRA } from '@/app/api/pdf/extra/[extraId]/route';
import { GET as GET_DOCX_EXTRA } from '@/app/api/docx/extra/[extraId]/route';

// ── Fixture Builder Paramétrico (6, 12, 18, 24, 30 sesiones) ─────────────────

function buildValidSessionPlan(sessionNumber: number): SessionPlan {
  return {
    sessionNumber,
    objetivo: `Analizar y modelar sistemas lineales aplicados a la gestión hídrica comunitaria en la sesión ${sessionNumber}, verificando parámetros e interpretación contextual.`,
    motivacion: `En la comunidad escolar de Tehuacán, el monitoreo del caudal requiere modelos lineales precisos durante la sesión ${sessionNumber} para evitar desperdicios y optimizar el riego.`,
    saberesPrevios: `Recupera tus notas de la sesión previa sobre razón de cambio constante, variables dependientes e independientes y representación tabular de datos comunitarios.`,
    contenido:
      `Durante la sesión ${sessionNumber} estudiaremos la formulación analítica y gráfica de modelos lineales con parámetros empíricos obtenidos en campo. ` +
      `Cada registro recolectado permite estimar la pendiente como razón de cambio promedio y la ordenada al origen como condición inicial del depósito escolar.\n\n` +
      `Al contrastar la predicción del modelo con las mediciones reales de la bitácora, identificamos desviaciones y establecemos intervalos de validez técnica para la toma de decisiones colectivas.`,
    ejemploResuelto:
      `Planteamiento: Un depósito inicia con 150 litros y recibe un flujo constante de 25 litros por minuto.\n` +
      `Paso 1: Definir V(t) = 25t + 150 donde t son minutos y V volumen en litros.\n` +
      `Paso 2: Evaluar para t = 12 minutos obteniendo V(12) = 25(12) + 150 = 450 litros.\n` +
      `Paso 3: Verificar que la capacidad máxima del tanque (600 L) no sea excedida en el intervalo.`,
    practica: [
      {
        enunciado: `Determina el volumen acumulado del captador pluvial escolar en la sesión ${sessionNumber} si el caudal constante es de ${10 + sessionNumber} litros por minuto durante 15 minutos.`,
        pista: `Plantea la relación lineal V(t) = m·t + b identificando el volumen inicial registrado en bitácora.`,
        solucion: [
          `Paso 1: Identificar la pendiente m = ${10 + sessionNumber} L/min y el tiempo t = 15 min.`,
          `Paso 2: Multiplicar m por t y sumar la condición inicial b para obtener el volumen total.`,
        ],
      },
    ],
    aplicacion: `Registra en tu bitácora las mediciones del tinaco del plantel correspondientes a la sesión ${sessionNumber} y compara el modelo lineal con el consumo real.`,
    autoevaluacion: [
      `¿Identifiqué con precisión las variables y unidades en la sesión ${sessionNumber}?`,
      `¿Verifiqué la coherencia del resultado obtenido con el contexto comunitario?`,
    ],
    recursos: [
      {
        titulo: `Guía de modelación lineal comunitaria — Sesión ${sessionNumber}`,
        url: 'https://educacionmediasuperior.sep.gob.mx',
        tipo: 'web',
      },
    ],
    productoIntegrador: `Reporte técnico de modelación y tabla comparativa de la sesión ${sessionNumber} firmada en bitácora.`,
    isFallback: false,
  };
}

function buildValidWorkbook(totalSessions: number = 12): ActiveWorkTextbook {
  const missionCount = 4;
  const baseSize = Math.floor(totalSessions / missionCount);
  const remainder = totalSessions % missionCount;

  const missions: MissionSection[] = [];
  let cursor = 1;

  for (let m = 0; m < missionCount; m++) {
    const count = baseSize + (m < remainder ? 1 : 0);
    const coveredSessions: number[] = [];
    for (let k = 0; k < count; k++) {
      coveredSessions.push(cursor++);
    }

    missions.push({
      missionIndex: m + 1,
      title: `Misión ${m + 1}: Modelación Cuantitativa del Agua en el Plantel`,
      coveredSessions,
      sessionTopic: `Función lineal y balance hídrico — Fase ${m + 1}`,
      sessionFocus: 'Modelar relaciones lineales con datos reales del plantel y la comunidad.',
      phenomenonHook: {
        story:
          'En el plantel escolar se busca optimizar el almacenamiento de agua pluvial mediante registros sistemáticos por jornada y análisis de tendencias lineales.',
        detonatingQuestion:
          '¿Cómo anticipar el volumen disponible cada semana utilizando ecuaciones lineales verificables?',
      },
      conceptZero: {
        physicalAnalogy:
          'El llenado uniforme de un recipiente graduado donde cada minuto sube el nivel exactamente la misma altura.',
        coreExplanation:
          'Una función lineal de la forma y = mx + b permite modelar procesos con tasa de variación constante e interpretar su pendiente y condición inicial.',
        narrativeExplanation:
          'El análisis algebraico convierte mediciones aisladas en proyecciones útiles para la comunidad.',
        solvedExample: {
          problemStatement: 'Calcular el volumen en t = 10 min para V(t) = 18t + 120.',
          solutionSteps: [
            'Paso 1: Sustituir t = 10 en la ecuación lineal.',
            'Paso 2: Multiplicar 18 × 10 = 180 y sumar 120 = 300 litros.',
          ],
          interpretation: 'Al minuto 10 se cuenta con 300 litros disponibles en el depósito.',
        },
        contrastTable: [
          {
            correctConcept: 'La pendiente multiplica a la variable independiente en cada unidad de tiempo.',
            commonMisconception: 'Sumar la pendiente una sola vez sin multiplicarla por el tiempo transcurrido.',
            reasoning: 'La razón de cambio se acumula proporcionalmente por cada unidad de x.',
          },
        ],
      },
      iDoSection: {
        stepByStepDemo:
          'El docente construye en el pizarrón la tabla de valores, calcula diferencias divididas constantes y traza la recta en el plano cartesiano.',
        visualOrDiagram: 'Gráfica cartesiana volumen contra tiempo con pendiente positiva.',
      },
      weDoSection: {
        guidedPractice:
          'En equipos de trabajo, los estudiantes ajustan el modelo lineal para dos depósitos con distinta capacidad inicial y comparan sus gráficas.',
        workbookElements: [],
      },
      youDoSection: {
        autonomousChallenge:
          'Elabora el modelo lineal de captación pluvial de tu hogar o plantel con cinco mediciones reales y redacta una propuesta de ahorro.',
        workbookElements: [],
      },
      troubleshooting: [
        {
          id: `ts-${m + 1}`,
          symptom: 'La gráfica no pasa por los puntos medidos en la bitácora.',
          rootCause: 'Inversión de las coordenadas (y, x) o error al despejar la ordenada al origen b.',
          solutionSteps: [
            'Verificar las unidades de cada eje antes de ubicar los pares ordenados.',
            'Recalcular m = (y2 - y1) / (x2 - x1) con dos puntos verificados.',
          ],
          preventionTip: 'Rotular siempre las columnas de la tabla con variable y unidad de medida.',
        },
      ],
      formativeCheckpoint: {
        question: '¿Qué representa físicamente la pendiente m en el problema del depósito escolar?',
        reflectionPrompts: [
          '¿Cómo verifico si el supuesto de razón de cambio constante se cumple en mi comunidad?',
        ],
        criteriaChecklist: [
          'Identifico variables dependiente e independiente con sus unidades.',
          'Calculo e interpreto correctamente la pendiente y la ordenada al origen.',
        ],
      },
      metacognitiveTrafficLight: {
        green: 'Domino la formulación y verificación del modelo lineal.',
        yellow: 'Planteo la ecuación pero requiero apoyo al interpretar las unidades.',
        red: 'Necesito repasar cómo calcular la razón de cambio a partir de una tabla.',
      },
      sessionPlans: coveredSessions.map((sNum) => buildValidSessionPlan(sNum)),
      wordCount: coveredSessions.length * 420,
    });
  }

  return {
    id: 'wb-test-valid',
    planningId: 'plan-test-001',
    blockIndex: 0,
    blockName: 'Bloque I: Modelación Lineal y Sustentabilidad Hídrica',
    version: 1,
    subsystem: 'bge',
    targetPages: 40,
    totalPages: 40,
    totalWords: totalSessions * 450,
    sessionsPerBlock: totalSessions,
    generatedAt: new Date().toISOString(),
    qualityScore: 96,
    qualityWarning: false,
    coverData: {
      title: 'Cuaderno de Trabajo Activo · Pensamiento Matemático II',
      subtitle: 'Modelación Matemática para la Sustentabilidad Comunitaria',
      subjectName: 'Pensamiento Matemático II',
      semester: 2,
      blockNumber: 1,
      teacherName: 'Docente Investigador',
      schoolName: 'Bachillerato General Oficial Emiliano Zapata',
      cct: '21EBH0123Z',
      paecProjectName: 'Gestión Sustentable del Agua Escolar',
      municipality: 'Puebla',
    },
    tableOfContents: missions.map((m) => ({
      missionIndex: m.missionIndex,
      title: m.title,
      sessionsRange: `Sesiones ${m.coveredSessions.join(', ')}`,
      pageEstimate: 10,
    })),
    missions,
    projectSection: {
      artifactName: 'Sistema de Monitoreo y Proyección Lineal de Captación Pluvial',
      communityUtility: 'Optimiza el uso del agua almacenada en el plantel durante la temporada seca.',
      learningObjectives: ['Modelar datos reales mediante ecuaciones lineales.'],
      requiredMaterials: ['Bitácora de campo', 'Cinta métrica', 'Calculadora científica'],
      executionSteps: ['Medición de niveles', 'Ajuste algebraico', 'Validación gráfica'],
      deliveryCriteria: ['Memoria de cálculo completa', 'Gráfica a escala'],
      registrationFormat: 'Bitácora técnica escolar',
      phases: [],
      technicalSpecs: ['Unidades del Sistema Internacional'],
      acceptanceCriteria: ['Modelo verificado con margen de error menor al 5%'],
    },
    evaluationSection: {
      source: 'generated_fresh',
      rubric: [
        {
          criterion: 'Formulación y resolución algebraica del modelo lineal',
          weightPercent: 40,
          levels: [
            { levelName: 'Excelente', points: 10, descriptor: 'Formula y resuelve el modelo lineal sin errores justificándolo con rigor.' },
            { levelName: 'Bueno', points: 8, descriptor: 'Formula el modelo lineal con imprecisiones menores en el despeje.' },
            { levelName: 'Suficiente', points: 6, descriptor: 'Identifica las variables pero requiere apoyo en la ecuación.' },
            { levelName: 'Requiere Apoyo', points: 4, descriptor: 'No logra establecer la relación funcional entre variables.' },
          ],
        },
        {
          criterion: 'Representación gráfica y tabulación de datos comunitarios',
          weightPercent: 30,
          levels: [
            { levelName: 'Excelente', points: 10, descriptor: 'Construye tablas y gráficas precisas con escalas y rótulos completos.' },
            { levelName: 'Bueno', points: 8, descriptor: 'Traza la gráfica correctamente omitiendo etiquetas secundarias.' },
            { levelName: 'Suficiente', points: 6, descriptor: 'Ubica puntos aislados con errores de escala en los ejes.' },
            { levelName: 'Requiere Apoyo', points: 4, descriptor: 'No logra representar los pares ordenados en el plano.' },
          ],
        },
        {
          criterion: 'Interpretación contextual y propuesta para el proyecto PAEC',
          weightPercent: 30,
          levels: [
            { levelName: 'Excelente', points: 10, descriptor: 'Argumenta decisiones comunitarias sustentadas en la pendiente y ordenada.' },
            { levelName: 'Bueno', points: 8, descriptor: 'Interpreta los resultados numéricos en el contexto escolar.' },
            { levelName: 'Suficiente', points: 6, descriptor: 'Describe resultados de forma superficial sin vincularlos al PAEC.' },
            { levelName: 'Requiere Apoyo', points: 4, descriptor: 'Omite la interpretación contextual de los valores obtenidos.' },
          ],
        },
      ],
      checklist: [
        { category: 'Procedimental', item: 'Registra las mediciones completas con unidades en la bitácora.' },
        { category: 'Conceptual', item: 'Verifica analíticamente la pendiente y la ordenada al origen.' },
        { category: 'Actitudinal', item: 'Colabora activamente en la propuesta de ahorro hídrico comunitario.' },
      ],
      tieredExercises: [
        {
          level: 'basico',
          levelName: 'Nivel Básico',
          description: 'Identificación directa de parámetros lineales.',
          exercises: [
            {
              number: 1,
              statement: 'Calcula la razón de cambio entre (0, 100) y (5, 225).',
              expectedOutputOrCriteria: 'Pendiente m = 25 litros por minuto con interpretación.',
            },
          ],
        },
      ],
      criticalThinkingQuiz: [
        {
          questionNumber: 1,
          scenario: 'Durante una semana sin lluvia el nivel del depósito desciende a razón constante.',
          question: '¿Qué signo adopta la pendiente m del modelo lineal de volumen durante el consumo sin recarga?',
          options: ['Positivo', 'Negativo', 'Cero', 'Indefinido'],
          answerExplanation:
            'La pendiente m es negativa porque el volumen disminuye una cantidad constante por cada unidad de tiempo transcurrida.',
        },
      ],
      metacognitiveReflection: {
        prompts: ['¿Cómo fortaleció el modelo lineal la toma de decisiones en mi comunidad?'],
      },
    },
  };
}

describe('Fase R1 — Revisor Determinista de Materiales Derivados (material-review.ts)', () => {
  it.each([6, 12, 18, 24, 30])(
    'aprueba sin errores un bloque íntegro con %i sesiones dinámicas (sin hardcodear 24)',
    (sessionCount) => {
      const wb = buildValidWorkbook(sessionCount);
      const report = reviewBlockMaterials({ workbook: wb });

      expect(report.ok).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.score).toBeGreaterThanOrEqual(90);
      expect(report.byMaterial.lesson_plan.ok).toBe(true);
      expect(report.byMaterial.rubric.ok).toBe(true);
      expect(report.byMaterial.checklist.ok).toBe(true);
      expect(report.byMaterial.answer_key.ok).toBe(true);
    }
  );

  it('S1: detecta sesiones faltantes rellenadas sintéticamente por el extractor (S1_SYNTHETIC_FALLBACK_DETECTED)', () => {
    const wb = buildValidWorkbook(12);
    // Eliminar las últimas 4 sesiones declaradas de la misión 4 pero mantener sessionsPerBlock = 12
    wb.missions[3].coveredSessions = [10];
    wb.missions[3].sessionPlans = [buildValidSessionPlan(10)];

    // El extractor rellena hasta 12 sesiones con fallback sintético
    const extracted = extractMaterialsFromWorkbook(wb);
    expect(extracted.planesDeClase).toHaveLength(12);

    const report = reviewBlockMaterials({ workbook: wb, extracted });
    expect(report.ok).toBe(false);
    expect(report.byMaterial.lesson_plan.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S1_MISSING_DECLARED_SESSIONS')).toBe(true);
    expect(report.errors.some((e) => e.code === 'S1_SYNTHETIC_FALLBACK_DETECTED')).toBe(true);
  });

  it('S1: detecta sessionPlan con isFallback=true en el libro (S1_FALLBACK_SESSION_IN_BOOK)', () => {
    const wb = buildValidWorkbook(6);
    wb.missions[0].sessionPlans![0].isFallback = true;

    const report = reviewBlockMaterials({ workbook: wb });
    expect(report.ok).toBe(false);
    expect(report.byMaterial.lesson_plan.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S1_FALLBACK_SESSION_IN_BOOK')).toBe(true);
  });

  it('S2: detecta desbalance de tiempos o falta de instrumentoEvaluacion en un plan de clase', () => {
    const wb = buildValidWorkbook(6);
    const extracted = extractMaterialsFromWorkbook(wb);
    extracted.planesDeClase[0].apertura.tiempoMinutos = 25; // 25 + 30 + 10 = 65 !== 50
    extracted.planesDeClase[1].instrumentoEvaluacion = '   ';

    const report = reviewBlockMaterials({ workbook: wb, extracted });
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S2_INVALID_TIME_BALANCE' && e.session === 1)).toBe(true);
    expect(report.errors.some((e) => e.code === 'S2_MISSING_EVALUATION_INSTRUMENT' && e.session === 2)).toBe(true);
  });

  it('S4: rechaza rúbricas cuyos pesos sumen 90% o 105% (S4_RUBRIC_WEIGHT_SUM_MISMATCH)', () => {
    const wb90 = buildValidWorkbook(6);
    wb90.evaluationSection!.rubric[0].weightPercent = 30; // 30 + 30 + 30 = 90%

    const report90 = reviewBlockMaterials({ workbook: wb90 });
    expect(report90.ok).toBe(false);
    expect(report90.byMaterial.rubric.ok).toBe(false);
    expect(report90.errors.some((e) => e.code === 'S4_RUBRIC_WEIGHT_SUM_MISMATCH')).toBe(true);

    const wb105 = buildValidWorkbook(6);
    wb105.evaluationSection!.rubric[0].weightPercent = 45; // 45 + 30 + 30 = 105%

    const report105 = reviewBlockMaterials({ workbook: wb105 });
    expect(report105.ok).toBe(false);
    expect(report105.byMaterial.rubric.ok).toBe(false);
    expect(report105.errors.some((e) => e.code === 'S4_RUBRIC_WEIGHT_SUM_MISMATCH')).toBe(true);
  });

  it('S5: marca error si falta un ejercicio práctico en el solucionario, pero solo warning si solucion[] está vacío', () => {
    const wbMissingSol = buildValidWorkbook(6);
    // Ejercicio presente pero con solucion[] vacío -> solo warning, NO error
    wbMissingSol.missions[0].sessionPlans![0].practica[0].solucion = [];
    const reportWarn = reviewBlockMaterials({ workbook: wbMissingSol });
    expect(reportWarn.byMaterial.answer_key.ok).toBe(true);
    expect(reportWarn.warnings.some((w) => w.code === 'S5_MISSING_MODEL_SOLUTION')).toBe(true);

    // Si el solucionario omite el enunciado del ejercicio -> error bloqueante S5_EXERCISE_NOT_IN_ANSWER_KEY
    const wbCorruptKey = buildValidWorkbook(6);
    const extracted = extractMaterialsFromWorkbook(wbCorruptKey);
    extracted.solucionarioDocente =
      '# SOLUCIONARIO TRUNCADO\nTexto de referencia sin los ejercicios de práctica de las sesiones.\n'.repeat(20);

    const reportErr = reviewBlockMaterials({ workbook: wbCorruptKey, extracted });
    expect(reportErr.byMaterial.answer_key.ok).toBe(false);
    expect(reportErr.errors.some((e) => e.code === 'S5_EXERCISE_NOT_IN_ANSWER_KEY')).toBe(true);
  });

  it('S6: valida presentaciones SACRINT (deck), infografías y payloads visuales con undefined o ${', () => {
    const wb = buildValidWorkbook(6);
    const deck = buildSacrintDeck(wb, { missionIndex: 0 });
    deck.slides[1].title = 'Título con marcador ${sinInterpolar} inválido';

    const infographic = buildSacrintInfographic(wb, 'letter', { missionIndex: 0 });
    infographic.claim = 'Afirmación con undefined incrustado';

    const report = reviewBlockMaterials({
      workbook: wb,
      deck,
      infographic,
      persistedExtras: [
        {
          type: 'material',
          title: '[Visual] Recurso Gráfico Misión 1',
          content_text: JSON.stringify({ type: 'flow', svg: '<svg>${bad}</svg>' }),
        },
      ],
      checkFullBlockPersistence: false,
    });

    expect(report.byMaterial.deck.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S6_PLACEHOLDER_IN_DECK')).toBe(true);
    expect(report.byMaterial.infographic.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S6_PLACEHOLDER_IN_INFOGRAPHIC')).toBe(true);
    expect(report.byMaterial.visual_asset.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S6_CORRUPT_VISUAL_ASSET')).toBe(true);
  });

  it('S7: detecta content_text truncado en planning_extras respecto a la extracción fresca', () => {
    const wb = buildValidWorkbook(6);
    const extracted = extractMaterialsFromWorkbook(wb);
    // Cortar el solucionario al 40% de su longitud original (pero por encima de 800 chars)
    const truncatedKey = extracted.solucionarioDocente.slice(0, Math.floor(extracted.solucionarioDocente.length * 0.4));

    const report = reviewBlockMaterials({
      workbook: wb,
      extracted,
      persistedExtras: [
        {
          type: 'teacher_guide',
          title: 'Solucionario Truncado',
          key_index: 0,
          content_text: truncatedKey,
        },
      ],
      checkFullBlockPersistence: false,
    });

    expect(report.byMaterial.answer_key.ok).toBe(false);
    expect(report.errors.some((e) => e.code === 'S7_TRUNCATED_MATERIAL')).toBe(true);
  });

  it('W0: advertencias de coherencia no bloquean (ok: true, warnings.length > 0)', () => {
    const wb = buildValidWorkbook(6);
    // Omitir blockSequence explícita genera W0_INFERRED_SESSION_BUDGET o W0_W1_MISSING_SEQ_SESSION sin bloquear
    wb.sessionsPerBlock = undefined;
    const report = reviewBlockMaterials({ workbook: wb });

    expect(report.ok).toBe(true);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('Benchmark de rendimiento: p95 < 50 ms por bloque de 24 sesiones', () => {
    const wb = buildValidWorkbook(24);
    const durations: number[] = [];

    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const res = reviewBlockMaterials({ workbook: wb });
      const t1 = performance.now();
      expect(res.ok).toBe(true);
      durations.push(t1 - t0);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});

describe('Fase R1 — Integración en Cascada y Gate HTTP 422 en Descargas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'docente@pue.gob.mx' } });
    mockGetTeacherByEmail.mockResolvedValue({ id: 'teacher-1', email: 'docente@pue.gob.mx', role: 'docente' });
    mockSql.mockResolvedValue([]);
  });

  it('cascadeBlockMaterials omite materiales con errores estructurales R1 y los reporta en omitted[]', async () => {
    const wb = buildValidWorkbook(6);
    // Romper la rúbrica (suma 70% en vez de 100%)
    wb.evaluationSection!.rubric[0].weightPercent = 10;

    const result = await cascadeBlockMaterials('plan-1111-2222-3333-444444444444', 0, wb, 'teacher-1');

    expect(result.success).toBe(true);
    expect(result.omitted).toContain('rubric');
    expect(result.omitted).not.toContain('lesson_plan');
    expect(result.omitted).not.toContain('checklist');
    expect(result.review?.byMaterial.rubric.ok).toBe(false);
    expect(result.review?.byMaterial.lesson_plan.ok).toBe(true);
  });

  it('Gate 422 en /api/pdf/extra/[extraId] y /api/docx/extra/[extraId] cuando el material tiene errores estructurales', async () => {
    const wb = buildValidWorkbook(6);
    wb.evaluationSection!.rubric[0].weightPercent = 15; // Suma 75% -> error S4

    mockGetBlockWorkbook.mockResolvedValue(wb);
    mockGetPlanningExtraById.mockResolvedValue({
      id: 'extra-rubric-1',
      planning_id: 'plan-1',
      type: 'rubric',
      title: 'Rúbrica Bloque 1',
      key_index: 0,
      keyIndex: 0,
      content_text: '# RÚBRICA ANALÍTICA DE EVALUACIÓN\n'.repeat(12),
    });

    const pdfRes = await GET_PDF_EXTRA(new NextRequest('http://localhost:3000/api/pdf/extra/extra-rubric-1'), {
      params: Promise.resolve({ extraId: 'extra-rubric-1' }),
    });
    expect(pdfRes.status).toBe(422);
    const pdfJson = await pdfRes.json();
    expect(pdfJson.ok).toBe(false);
    expect(pdfJson.error).toBe('Material bloqueado por inconsistencia estructural');
    expect(pdfJson.issues.some((i: { code: string }) => i.code === 'S4_RUBRIC_WEIGHT_SUM_MISMATCH')).toBe(true);

    const docxRes = await GET_DOCX_EXTRA(new NextRequest('http://localhost:3000/api/docx/extra/extra-rubric-1'), {
      params: Promise.resolve({ extraId: 'extra-rubric-1' }),
    });
    expect(docxRes.status).toBe(422);
    const docxJson = await docxRes.json();
    expect(docxJson.ok).toBe(false);
  });

  it('Gate 200 con cabecera X-Material-Warnings cuando solo existen advertencias no bloqueantes', async () => {
    const wb = buildValidWorkbook(6);
    // Eliminar solucion[] de un ejercicio práctico -> genera warning S5_MISSING_MODEL_SOLUTION en answer_key
    wb.missions[0].sessionPlans![0].practica[0].solucion = [];
    const extracted = extractMaterialsFromWorkbook(wb);

    mockGetBlockWorkbook.mockResolvedValue(wb);
    mockGetPlanningExtraById.mockResolvedValue({
      id: 'extra-key-1',
      planning_id: 'plan-1',
      type: 'teacher_guide',
      title: 'Solucionario Bloque 1',
      key_index: 0,
      keyIndex: 0,
      content_text: extracted.solucionarioDocente,
    });

    const docxRes = await GET_DOCX_EXTRA(new NextRequest('http://localhost:3000/api/docx/extra/extra-key-1'), {
      params: Promise.resolve({ extraId: 'extra-key-1' }),
    });
    expect(docxRes.status).toBe(200);
    expect(Number(docxRes.headers.get('X-Material-Warnings'))).toBeGreaterThanOrEqual(1);
  });
});

