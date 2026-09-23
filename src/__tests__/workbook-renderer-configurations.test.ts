// src/__tests__/workbook-renderer-configurations.test.ts
/**
 * Tests de Cobertura y Configuraciones para pdf-workbook-renderer.ts
 * Fase 17 · SIGPDA-EMS SEMS Puebla MCCEMS 2026-2027
 *
 * Valida el comportamiento del renderizador de libros de trabajo activo
 * ante múltiples configuraciones curriculares, tecnológicas y de formato:
 * 1. Área STEM (Pensamiento Matemático) -> Gráfico vectorial matemático (preferOpenverseMedia: false).
 * 2. Área No-STEM (Español / Lengua) -> Búsqueda Openverse o fallback vectorial genérico (preferOpenverseMedia: true).
 * 3. Variación de Subsistema (BT vs BGE) -> Diferencias institucionales en metadatos y portadas.
 * 4. Generación con FLUX API Key -> Detección de clave y llamada a generateBookCover.
 * 5. Cuaderno sin coverData -> Resiliencia defensiva y degradación elegante con fallbacks institucionales.
 * 6. Cuaderno extenso (>5 misiones) -> Paginación robusta, sincronización de TOC y más de 20 páginas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { generateBookCover } from '@/lib/visual-engine/cover-generator';
import type { ActiveWorkTextbook, MissionSection, ProjectSection, EvaluationSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

// ── Mocks Autónomos para Entorno de Pruebas ──────────────────────────────────
vi.mock('@/lib/db', () => ({
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'mock-saved-asset-id' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/visual-engine/visual-asset-manager', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visual-engine/visual-asset-manager')>(
    '@/lib/visual-engine/visual-asset-manager'
  );
  return {
    ...actual,
    resolveVisualForMission: vi.fn(actual.resolveVisualForMission),
    resolveEquipmentVisualForMission: vi.fn(actual.resolveEquipmentVisualForMission),
  };
});

vi.mock('@/lib/visual-engine/cover-generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visual-engine/cover-generator')>(
    '@/lib/visual-engine/cover-generator'
  );
  return {
    ...actual,
    generateBookCover: vi.fn(actual.generateBookCover),
  };
});

// ── Helper de Extracción Textual Segura con PDFParse v2 ───────────────────────
async function extractPdfData(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    return {
      text: textResult.text,
      numpages: textResult.total,
    };
  } finally {
    await parser.destroy();
  }
}

// ── Dummy JPEG de 1x1 Pixel para Pruebas de Portada ──────────────────────────
const dummyJpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

// ── Fixture Factory ─────────────────────────────────────────────────────────
function makeMission(index: number, topic = 'Modelación de Sistemas'): MissionSection {
  return {
    missionIndex: index,
    title: `Misión ${index}: ${topic}`,
    coveredSessions: [(index - 1) * 2 + 1, (index - 1) * 2 + 2],
    sessionTopic: topic,
    sessionFocus: `Enfoque situado para sesión ${index}`,
    phenomenonHook: {
      story: `Narrativa contextual de la misión ${index} en el entorno comunitario de Puebla.`,
      detonatingQuestion: `¿Cómo podemos resolver el dilema ${index} de forma sostenible?`,
    },
    conceptZero: {
      physicalAnalogy: `Analogía física explicativa de la misión ${index}.`,
      coreExplanation: `Explicación conceptual fundamental del tema ${topic} para el bloque activo.`,
      narrativeExplanation: `Narrativa técnica y social del fenómeno abordado.`,
      solvedExample: {
        problemStatement: `Planteamiento del problema resuelto número ${index}.`,
        solutionSteps: [
          'Paso 1: Identificación de variables y parámetros clave.',
          'Paso 2: Aplicación del método analítico correspondiente.',
          'Paso 3: Verificación de los resultados y cálculo de unidades.',
        ],
        interpretation: `Conclusión práctica derivada del cálculo de la misión ${index}.`,
      },
      contrastTable: [
        {
          correctConcept: 'Principio metodológico fundamentado.',
          commonMisconception: 'Suposición empírica sin evidencia.',
          reasoning: 'La demostración matemática o teórica valida el proceso.',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'Demostración paso a paso ejecutada por el docente.',
    },
    weDoSection: {
      guidedPractice: 'Práctica guiada en equipos de trabajo colaborativo.',
      workbookElements: [
        {
          id: `elem-we-do-${index}`,
          type: 'lines',
          title: 'Procedimiento Guiado',
          instruction: 'Registra los pasos acordados en equipo:',
          config: { rows: 3 },
        },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo individual de aplicación situada.',
      workbookElements: [
        {
          id: `elem-you-do-${index}`,
          type: 'empty_table',
          title: 'Registro de Resultados',
          instruction: 'Llena la tabla de observaciones:',
          config: { cols: ['Indicador', 'Valor Inicial', 'Valor Final', 'Observaciones'] },
        },
      ],
    },
    troubleshooting: [
      {
        id: `tb-${index}`,
        symptom: 'El cálculo difiere del valor teórico esperado',
        rootCause: 'Discrepancia en unidades de entrada o redondeo anticipado',
        solutionSteps: ['1. Estandarizar unidades del SI', '2. Mantener cuatro cifras decimales'],
        preventionTip: 'Revisar la tabla dimensional antes de operar.',
      },
    ],
    formativeCheckpoint: {
      question: `¿Cuál es el significado de los resultados obtenidos en la misión ${index}?`,
      reflectionPrompts: ['Explica la aplicación comunitaria', 'Identifica oportunidades de mejora'],
      criteriaChecklist: ['Cálculo correcto', 'Justificación argumentada'],
    },
    wordCount: 820,
    diagnosticEvaluation: {
      context: 'Evaluación previa de saberes requeridos.',
      questions: ['Concepto básico previo 1', 'Concepto básico previo 2'],
    },
    realLifeConnection: {
      context: 'Aplicación en economía y oficios locales.',
      householdApplication: 'Optimización de consumos en el hogar.',
      communityImpact: 'Desarrollo regional sustentable.',
    },
    metacognitiveTrafficLight: {
      green: 'Domino completamente los conceptos y procedimientos.',
      yellow: 'Tengo dudas menores en la interpretación gráfica.',
      red: 'Requiero asesoría docente en el planteamiento inicial.',
    },
    safetyOrWorkshopTip: 'Mantén limpios y ordenados los instrumentos de medición.',
  };
}

function makeWorkbook(options: {
  subjectName?: string;
  subsystem?: string;
  missionsCount?: number;
  withoutCoverData?: boolean;
} = {}): ActiveWorkTextbook {
  const {
    subjectName = 'PENSAMIENTO MATEMÁTICO II',
    subsystem = 'bge',
    missionsCount = 1,
    withoutCoverData = false,
  } = options;

  const missions: MissionSection[] = [];
  const tableOfContents = [];

  for (let i = 1; i <= missionsCount; i++) {
    missions.push(makeMission(i, `Contenido de la Misión ${i}`));
    tableOfContents.push({
      missionIndex: i,
      title: `Misión ${i}: Contenido de la Misión ${i}`,
      sessionsRange: `Sesiones ${(i - 1) * 2 + 1} a ${i * 2}`,
      pageEstimate: 4,
    });
  }

  const projectSection: ProjectSection = {
    artifactName: 'Prototipo de Aplicación Comunitaria',
    communityUtility: 'Solución situada para el beneficio del contexto escolar y vecinal.',
    phases: [
      {
        phaseNum: 1,
        title: 'Diagnóstico y Planificación',
        allocatedHours: 4,
        deliverables: ['Plan de trabajo'],
        instructions: 'Definir el alcance de la intervención comunitaria.',
      },
    ],
    technicalSpecs: ['Alineación con el MCCEMS 2026-2027'],
    acceptanceCriteria: ['Entrega en tiempo y forma'],
  };

  const evaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Dominio Conceptual y Procedimental',
        weightPercent: 60,
        levels: [
          { levelName: 'Excelente', points: 4, descriptor: 'Demuestra dominio integral autónomo.' },
          { levelName: 'Bueno', points: 3, descriptor: 'Demuestra comprensión con soporte menor.' },
        ],
      },
    ],
    checklist: [
      { item: 'Participación en dinámicas colaborativas', category: 'Actitudinal' },
    ],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        scenario: 'Situación contextualizada de prueba',
        question: '¿Cuál es el resultado esperado?',
        options: ['Opción A', 'Opción B'],
        answerExplanation: 'Explicación del criterio de respuesta.',
      },
    ],
    metacognitiveReflection: {
      prompts: ['¿Qué aprendiste hoy?'],
    },
  };

  const wb: ActiveWorkTextbook = {
    id: 'wb-conf-test-01',
    planningId: 'plan-conf-test-01',
    blockIndex: 0,
    blockName: subjectName,
    version: 1,
    subsystem,
    targetPages: missionsCount * 4 + 4,
    totalPages: missionsCount * 4 + 4,
    totalWords: missionsCount * 800 + 1000,
    generatedAt: new Date().toISOString(),
    qualityScore: 99,
    qualityWarning: false,
    coverData: (withoutCoverData
      ? {}
      : {
          title: 'CUADERNO DE TRABAJO ACTIVO',
          subtitle: 'Enfoque Situado MCCEMS Puebla',
          subjectName,
          semester: 2,
          blockNumber: 1,
          teacherName: 'Mtro. Valente Rivera Rosas',
          schoolName: 'Bachillerato General Oficial Lic. Benito Juárez',
          cct: '21EBH0012A',
          paecProjectName: 'Proyecto Comunitario de Soberanía Hídrica',
          municipality: 'San Pedro Cholula, Puebla',
        }) as unknown as ActiveWorkTextbook['coverData'],
    tableOfContents,
    missions,
    projectSection,
    evaluationSection,
  };

  return wb;
}

function makePlanning(subjectName = 'PENSAMIENTO MATEMÁTICO II', subsystem = 'bge'): Planning {
  return {
    id: 'plan-conf-test-01',
    teacherId: 'teacher-vr-001',
    uacName: subjectName,
    semester: 2,
    component: 'fundamental',
    curriculumName: 'MCCEMS 2026',
    paecContext: 'Proyecto Comunitario de Soberanía Hídrica en San Pedro Cholula',
    extractedData: null,
    status: 'generated',
    createdAt: new Date(),
    updatedAt: new Date(),
    contentJson: {
      sectionI: {
        teacherName: 'Mtro. Valente Rivera Rosas',
        uacName: subjectName,
        semester: 2,
        groups: '2° A',
        schoolYear: '2026-2027',
        applicationPeriod: 'Agosto - Diciembre 2026',
        estimatedSessions: '16 sesiones',
        component: 'fundamental',
        totalHours: 16,
        subsystem,
        schoolName: 'Bachillerato General Oficial Lic. Benito Juárez',
        cct: '21EBH0012A',
      },
      sectionII: {
        purpose: 'Desarrollo integral de competencias y aprendizajes de trayectoria.',
        learningOutcomes: ['Aplica principios teóricos y procedimentales a contextos reales.'],
        paecConnection: 'Articulación con problemáticas comunitarias del municipio.',
        activities: [
          { name: 'Actividad de integración', hours: 4, order: 1 },
        ],
      },
      sectionIII: {
        fundamentalCurriculum: [{ area: 'Pensamiento Crítico', description: 'Razonamiento situado' }],
        expandedCurriculum: [{ area: 'Responsabilidad Social', description: 'Participación ciudadana' }],
      },
      sectionIV: {
        note: 'Secuencia didáctica alineada',
        activities: [],
      },
      sectionV: {
        evaluations: [],
      },
      sectionVI: {
        studentMaterials: ['Cuaderno de trabajo', 'Útiles escolares'],
        teacherMaterials: ['Guía pedagógica'],
        digital: [],
        spaces: ['Aula'],
        references: ['Bibliografía MCCEMS'],
      },
      sectionVII: {},
    },
  };
}

// ── Suite de Pruebas de Configuraciones ───────────────────────────────────────
describe('pdf-workbook-renderer.ts — Cobertura de Subject Types y Configuraciones (Fase 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.FLUX_API_KEY;
    delete process.env.TOGETHER_API_KEY;
  });

  // ── 1. TEST STEM: Gráfico vectorial matemático en UAC STEM ─────────────────
  it('Test 1 (STEM): UAC "PENSAMIENTO MATEMÁTICO II" genera gráfico vectorial y previene fotos Openverse', async () => {
    const workbook = makeWorkbook({ subjectName: 'PENSAMIENTO MATEMÁTICO II' });
    const planning = makePlanning('PENSAMIENTO MATEMÁTICO II');

    const buffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });

    expect(buffer).toBeDefined();
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Verificar que resolveVisualForMission fue invocado con preferOpenverseMedia: false para preservar vector
    expect(resolveVisualForMission).toHaveBeenCalledWith(
      expect.objectContaining({
        uacName: 'PENSAMIENTO MATEMÁTICO II',
        preferOpenverseMedia: false,
      })
    );

    const pdfData = await extractPdfData(buffer);
    expect(pdfData.numpages).toBeGreaterThanOrEqual(4);
    expect(pdfData.text).toContain('PENSAMIENTO MATEMÁTICO II');
  }, 25000);

  // ── 2. TEST NON-STEM: Búsqueda Openverse / fallback genérico en Lengua ──────
  it('Test 2 (non-STEM): UAC "ESPANOL I" solicita búsqueda de medios abiertos (preferOpenverseMedia: true)', async () => {
    const workbook = makeWorkbook({ subjectName: 'ESPANOL I' });
    const planning = makePlanning('ESPANOL I');

    const buffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });

    expect(buffer).toBeDefined();
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Verificar que para UAC humanística/lengua se busca preferentemente medios abiertos
    expect(resolveVisualForMission).toHaveBeenCalledWith(
      expect.objectContaining({
        uacName: 'ESPANOL I',
        preferOpenverseMedia: true,
      })
    );

    const pdfData = await extractPdfData(buffer);
    expect(pdfData.numpages).toBeGreaterThanOrEqual(4);
    expect(pdfData.text).toContain('ESPANOL I');
  }, 25000);

  // ── 3. TEST SUBSYSTEMS: Diferenciación de formato e insignias BT vs BGE ──────
  it('Test 3 (Subsystems): Refleja correctamente el subsistema oficial (BT vs BGE) en metadatos y portadas', async () => {
    const workbookBT = makeWorkbook({ subsystem: 'bt', subjectName: 'MANTENIMIENTO INDUSTRIAL' });
    const planningBT = makePlanning('MANTENIMIENTO INDUSTRIAL', 'bt');

    const workbookBGE = makeWorkbook({ subsystem: 'bge', subjectName: 'FILOSOFÍA' });
    const planningBGE = makePlanning('FILOSOFÍA', 'bge');

    const [bufferBT, bufferBGE] = await Promise.all([
      renderWorkbookToPdf(workbookBT, planningBT, { forceFallbackCover: true }),
      renderWorkbookToPdf(workbookBGE, planningBGE, { forceFallbackCover: true }),
    ]);

    const pdfDataBT = await extractPdfData(bufferBT);
    const pdfDataBGE = await extractPdfData(bufferBGE);

    // Verificación de textos del subsistema en portada y cuerpo
    expect(pdfDataBT.text).toContain('SUBSISTEMA: BT');
    expect(pdfDataBGE.text).toContain('SUBSISTEMA: BGE');

    expect(pdfDataBT.numpages).toBeGreaterThanOrEqual(4);
    expect(pdfDataBGE.numpages).toBeGreaterThanOrEqual(4);
  }, 35000);

  // ── 4. TEST FLUX KEY: Detección de FLUX_API_KEY e intento de portada Tier 1 ──
  it('Test 4 (FLUX Key): Invoca generateBookCover cuando existe FLUX_API_KEY y no se fuerza fallback', async () => {
    process.env.FLUX_API_KEY = 'test_flux_key_live_998877';

    const mockedGenerateBookCover = vi.mocked(generateBookCover);
    mockedGenerateBookCover.mockResolvedValueOnce({
      buffer: dummyJpegBuffer,
      format: 'JPEG',
      isFallback: false,
      latencyMs: 120,
      costEstimateUsd: 0.003,
      source: 'flux_schnell',
    });

    const workbook = makeWorkbook({ subjectName: 'QUÍMICA I' });
    const planning = makePlanning('QUÍMICA I');

    const buffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: false });

    expect(buffer).toBeDefined();
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Verificar que se intentó generar la portada con FLUX pasando las opciones correspondientes
    expect(mockedGenerateBookCover).toHaveBeenCalledWith(
      expect.objectContaining({
        uacName: 'QUÍMICA I',
        forceFallback: false,
      })
    );

    const pdfData = await extractPdfData(buffer);
    expect(pdfData.numpages).toBeGreaterThanOrEqual(4);
  }, 25000);

  // ── 5. TEST SIN COVERDATA: Degradación elegante ante datos ausentes ─────────
  it('Test 5 (Defensive Fallback): Genera PDF válido y funcional cuando coverData es undefined', async () => {
    const workbookWithoutCover = makeWorkbook({ withoutCoverData: true });
    const planning = makePlanning();

    // No debe arrojar excepción ni unhandled rejection
    const buffer = await renderWorkbookToPdf(workbookWithoutCover, planning, { forceFallbackCover: true });

    expect(buffer).toBeDefined();
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.byteLength).toBeGreaterThan(30000);

    const pdfData = await extractPdfData(buffer);
    expect(pdfData.numpages).toBeGreaterThanOrEqual(3);

    // Debe contener los valores de respaldo institucionales por defecto
    expect(pdfData.text).toContain('BACHILLERATO GENERAL OFICIAL');
    expect(pdfData.text).toContain('21ECT0017T');
  }, 25000);

  // ── 6. TEST EXTENSO: Paginación continua en libro con más de 5 misiones ──────
  it('Test 6 (Extensive Workbook): Pagina correctamente un libro de 6 misiones superando 20 páginas con TOC sincronizado', async () => {
    const workbookExtensive = makeWorkbook({ missionsCount: 6 });
    const planning = makePlanning();

    const buffer = await renderWorkbookToPdf(workbookExtensive, planning, { forceFallbackCover: true });

    expect(buffer).toBeDefined();
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const pdfData = await extractPdfData(buffer);

    // Verificación de extensión superior a 20 páginas
    expect(pdfData.numpages).toBeGreaterThan(20);

    // Verificación de presencia íntegra de las 6 misiones en el documento generado
    expect(pdfData.text).toContain('Misión 1');
    expect(pdfData.text).toContain('Misión 2');
    expect(pdfData.text).toContain('Misión 3');
    expect(pdfData.text).toContain('Misión 4');
    expect(pdfData.text).toContain('Misión 5');
    expect(pdfData.text).toContain('Misión 6');
  }, 45000);
});
