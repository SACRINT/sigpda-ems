// src/__tests__/workbook-integration.test.ts
/**
 * Tests de integración end-to-end para el Libro de Trabajo Activo
 * Fase 16 · SIGPDA-EMS DBEPA Puebla MCCEMS 2026-2027
 *
 * Valida el pipeline completo de renderizado:
 * Portada (vectorial jsPDF / JPEG) -> Mi Plantel / Mi Comunidad -> Índice TOC Real ->
 * Misiones Didácticas -> Artefacto/Proyecto -> Rúbricas de Evaluación -> Contraportada V7.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import type { ActiveWorkTextbook, MissionSection, ProjectSection, EvaluationSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

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

// ── Mock de Base de Datos y Logger para Entorno de Pruebas Autónomo ──────────
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

// ── Factory de Fixtures Realistas ────────────────────────────────────────────
function makeIntegrationMission(index = 1): MissionSection {
  return {
    missionIndex: index,
    title: `Misión ${index}: Modelación de Sistemas Lineales en la Producción Artesanal`,
    coveredSessions: [1, 2, 3],
    sessionTopic: 'Ecuaciones lineales simultáneas de dos incógnitas',
    sessionFocus: 'Resolución de problemas de balance de costos y materiales en talleres locales',
    phenomenonHook: {
      story: 'En el taller de cerámica de Don Mateo en San Cristóbal Tepontla, se mezclan dos tipos de arcilla para elaborar cazuelas vidriadas.',
      detonatingQuestion: '¿Cómo podemos calcular la proporción exacta de cada arcilla para no sobrepasar el presupuesto semanal?',
    },
    conceptZero: {
      physicalAnalogy: 'Imagina una balanza de dos platillos donde ajustas pesas de plomo hasta lograr el equilibrio horizontal perfecto.',
      coreExplanation: 'Un sistema de ecuaciones representa dos condiciones que deben cumplirse de manera simultánea en el mismo instante.',
      narrativeExplanation: 'Las relaciones matemáticas modelan restricciones reales de recursos y costos en la economía comunitaria de Puebla.',
      solvedExample: {
        problemStatement: 'Determinar x (arcilla roja) y y (arcilla blanca) si x + y = 50 kg y 2x + 3y = 120 pesos.',
        solutionSteps: [
          'Paso 1: Despejar x en la primera ecuación: x = 50 - y.',
          'Paso 2: Sustituir en la segunda: 2(50 - y) + 3y = 120.',
          'Paso 3: Resolver para y: 100 - 2y + 3y = 120, por tanto y = 20 kg.',
          'Paso 4: Calcular x: x = 50 - 20 = 30 kg.',
        ],
        interpretation: 'Don Mateo requiere exactamente 30 kg de arcilla roja y 20 kg de arcilla blanca.',
      },
      contrastTable: [
        {
          correctConcept: 'La solución es el punto único de intersección gráfica.',
          commonMisconception: 'Creer que cualquier valor que satisfaga una ecuación resuelve el sistema.',
          reasoning: 'Ambas rectas deben cruzarse en las mismas coordenadas (x, y).',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'El docente modela en el pizarrón la tabulación de las rectas y muestra el método de igualación paso a paso.',
    },
    weDoSection: {
      guidedPractice: 'En parejas, resuelvan el siguiente problema de dos hornos de cocción continua: <!--workbook:lines:rows=4-->',
      workbookElements: [
        {
          id: `wb-lines-m${index}`,
          type: 'lines',
          title: 'Espacio de Trabajo Colaborativo',
          instruction: 'Desarrolla el procedimiento algebraico completo:',
          config: { rows: 4 },
        },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Reto individual: Calcula el punto de equilibrio para una producción de 100 piezas artesanales.',
      workbookElements: [
        {
          id: `wb-table-m${index}`,
          type: 'empty_table',
          title: 'Tabla de Tabulación de Costos',
          instruction: 'Llena las coordenadas (x, y) calculadas:',
          config: { cols: ['Cantidad (x)', 'Costo Fijo', 'Costo Variable', 'Costo Total (y)'] },
        },
      ],
    },
    troubleshooting: [
      {
        id: `tb-m${index}-1`,
        symptom: 'Al sustituir obtienes una contradicción matemática como 0 = 5',
        rootCause: 'El sistema representa rectas paralelas sin punto de corte común',
        solutionSteps: [
          '1. Verifica las pendientes m1 y m2 de ambas ecuaciones.',
          '2. Si son iguales y las ordenadas son distintas, el sistema es inconsistente.',
          '3. Concluye que no existe solución simultánea para las condiciones dadas.',
        ],
        preventionTip: 'Compara los coeficientes proporcionales antes de comenzar el despeje algebraico.',
      },
    ],
    formativeCheckpoint: {
      question: '¿Qué significado geométrico tiene que dos rectas coincidan en todos sus puntos?',
      reflectionPrompts: [
        'Explica con tus propias palabras qué es un sistema dependiente.',
        '¿Cómo le explicarías a un compañero cuándo usar el método de suma y resta?',
      ],
      criteriaChecklist: [
        'Despeja correctamente la incógnita seleccionada.',
        'Sustituye sin errores de signos.',
        'Interpreta el resultado en el contexto del problema artesanal.',
      ],
    },
    wordCount: 850,
    diagnosticEvaluation: {
      context: 'Diagnóstico de saberes previos sobre plano cartesiano y despejes de primer grado.',
      questions: [
        '¿Qué es una variable independiente en una función?',
        '¿Cómo se grafican las coordenadas (3, -2) en el plano?',
        'Si 2x = 14, ¿cuál es el valor de x?',
      ],
    },
    realLifeConnection: {
      context: 'Presupuestos en el hogar y balance de compras en el mercado semanal.',
      householdApplication: 'Registra los gastos familiares de dos productos de consumo básico y formula una ecuación.',
      communityImpact: 'Optimización de recursos en microempresas familiares de la región.',
    },
    metacognitiveTrafficLight: {
      green: 'Puedo resolver sistemas 2x2 y modelar situaciones reales sin apoyo.',
      yellow: 'Comprendo el método analítico pero cometo errores algebraicos menores.',
      red: 'Se me dificulta plantear las ecuaciones a partir de un texto narrativo.',
    },
    safetyOrWorkshopTip: 'Mantén un orden estricto en la columna de signos para prevenir errores de arrastre.',
  };
}

function makeIntegrationWorkbook(): ActiveWorkTextbook {
  const projectSection: ProjectSection = {
    artifactName: 'Manual de Costos y Catálogo de Mezclas para Artesanos de Cholula',
    communityUtility: 'Herramienta práctica de cálculo para optimizar el gasto de materias primas en talleres locales.',
    phases: [
      {
        phaseNum: 1,
        title: 'Levantamiento de datos en talleres',
        allocatedHours: 6,
        deliverables: ['Cuestionario aplicado a 3 artesanos'],
        instructions: 'Visitar los talleres de alfarería y registrar los costos de insumos.',
      },
      {
        phaseNum: 2,
        title: 'Modelación algebraica y tabulación',
        allocatedHours: 8,
        deliverables: ['Hojas de cálculo impresas con sistemas resueltos'],
        instructions: 'Formular las matrices de ecuaciones y calcular los puntos de equilibrio.',
      },
    ],
    technicalSpecs: ['Norma Oficial Mexicana NOM-050-SCFI', 'Alineación MCCEMS Puebla'],
    acceptanceCriteria: ['Precisión de cálculo al 100%', 'Manual encuadernado y legible'],
  };

  const evaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Modelación Algebraica de Situaciones Reales',
        weightPercent: 40,
        levels: [
          { levelName: 'Excelente', points: 4, descriptor: 'Formula y resuelve sistemas 2x2 con total autonomía y rigor.' },
          { levelName: 'Bueno', points: 3, descriptor: 'Plantea el sistema pero requiere apoyo en la resolución gráfica.' },
          { levelName: 'Suficiente', points: 2, descriptor: 'Identifica las variables pero comete errores en el despeje.' },
          { levelName: 'Requiere Apoyo', points: 1, descriptor: 'No logra traducir el problema verbal a lenguaje algebraico.' },
        ],
      },
      {
        criterion: 'Interpretación y Toma de Decisiones',
        weightPercent: 30,
        levels: [
          { levelName: 'Excelente', points: 3, descriptor: 'Interpreta la solución en el contexto de Don Mateo con claridad.' },
          { levelName: 'Bueno', points: 2, descriptor: 'Comprende el resultado numérico pero omite las unidades de medida.' },
          { levelName: 'Suficiente', points: 1.5, descriptor: 'Explica de forma incompleta la conclusión.' },
          { levelName: 'Requiere Apoyo', points: 1, descriptor: 'No emite conclusiones sobre el problema planteado.' },
        ],
      },
    ],
    checklist: [
      { item: 'Participó activamente en la sesión We Do en parejas', category: 'Colaboración' },
      { item: 'Completó los renglones y la tabla de tabulación You Do', category: 'Procedimental' },
      { item: 'Reflexionó en el semáforo metacognitivo', category: 'Actitudinal' },
    ],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        scenario: 'Un taller compra el doble de material pero sus ventas disminuyen un 50%.',
        question: '¿Qué condición describe mejor el nuevo sistema de costos?',
        options: ['Aumento de déficit', 'Punto de equilibrio nulo', 'Superávit continuo'],
        answerExplanation: 'El aumento de costos fijos sin ingresos desplaza el punto de equilibrio a valores inalcanzables.',
      },
    ],
    metacognitiveReflection: {
      prompts: [
        '¿Qué paso del método de sustitución te pareció más intuitivo?',
        '¿Cómo aplicarías las ecuaciones lineales en tu vida cotidiana?',
      ],
    },
  };

  return {
    id: 'wb-integration-001',
    planningId: 'plan-integration-001',
    blockIndex: 0,
    blockName: 'Geometría Analítica y Sistemas de Ecuaciones Lineales',
    version: 1,
    subsystem: 'bge',
    targetPages: 12,
    totalPages: 14,
    totalWords: 3500,
    generatedAt: new Date().toISOString(),
    qualityScore: 98,
    qualityWarning: false,
    coverData: {
      title: 'CUADERNO DE TRABAJO ACTIVO',
      subtitle: 'Enfoque Situado MCCEMS DBEPA Puebla',
      subjectName: 'PENSAMIENTO MATEMÁTICO II',
      semester: 2,
      blockNumber: 1,
      teacherName: 'Mtro. Fernando Ruiz Galindo',
      schoolName: 'Bachillerato General Oficial Lic. Benito Juárez',
      cct: '21EBH0012A',
      paecProjectName: 'Rescate de Saberes Agroecológicos y Economía Artesanal',
      municipality: 'San Pedro Cholula, Puebla',
    },
    tableOfContents: [
      {
        missionIndex: 1,
        title: 'Misión 1: Modelación de Sistemas Lineales en la Producción Artesanal',
        sessionsRange: 'Sesiones 1 a 3',
        pageEstimate: 4,
      },
    ],
    missions: [makeIntegrationMission(1)],
    projectSection,
    evaluationSection,
  };
}

function makeIntegrationPlanning(): Planning {
  return {
    id: 'plan-integration-001',
    teacherId: 'teacher-ruiz-001',
    uacName: 'PENSAMIENTO MATEMÁTICO II',
    semester: 2,
    component: 'fundamental',
    curriculumName: 'MCCEMS 2026',
    paecContext: 'Vinculación con proyectos comunitarios de San Pedro Cholula',
    extractedData: null,
    status: 'generated',
    createdAt: new Date(),
    updatedAt: new Date(),
    contentJson: {
      sectionI: {
        teacherName: 'Mtro. Fernando Ruiz Galindo',
        uacName: 'PENSAMIENTO MATEMÁTICO II',
        semester: 2,
        groups: '2° A, 2° B',
        schoolYear: '2026-2027',
        applicationPeriod: 'Agosto - Octubre 2026',
        estimatedSessions: '16 sesiones de 50 min',
        component: 'fundamental',
        totalHours: 16,
        subsystem: 'Bachillerato General Estatal',
        schoolName: 'Bachillerato General Oficial Lic. Benito Juárez',
        cct: '21EBH0012A',
      },
      sectionII: {
        purpose: 'Desarrollar el razonamiento cuantitativo mediante modelos lineales situados.',
        learningOutcomes: ['Modela situaciones cotidianas usando sistemas lineales 2x2.'],
        paecConnection: 'Vinculación directa con talleres alfareros de San Cristóbal Tepontla.',
        activities: [
          { name: 'Activación de saberes y análisis de costos', hours: 4, order: 1 },
          { name: 'Modelado algebraico y resolución guiada', hours: 6, order: 2 },
          { name: 'Aplicación práctica y portafolio de evidencias', hours: 6, order: 3 },
        ],
      },
      sectionIII: {
        fundamentalCurriculum: [
          { area: 'Lengua y Comunicación', description: 'Redacción de informes de costos' },
        ],
        expandedCurriculum: [
          { area: 'Responsabilidad Social', description: 'Comercio justo en comunidades locales' },
        ],
      },
      sectionIV: {
        note: 'Secuencia didáctica situada',
        activities: [],
      },
      sectionV: {
        evaluations: [],
      },
      sectionVI: {
        studentMaterials: ['Libro de trabajo activo', 'Calculadora'],
        teacherMaterials: ['Guía docente', 'Pizarrón'],
        digital: [],
        spaces: ['Aula taller'],
        references: ['Bibliografía oficial'],
      },
      sectionVII: {},
    },
  };
}

describe('Workbook Engine — Test de Integración End-to-End (renderWorkbookToPdf)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 1: Generación completa de libro con portada nativa jsPDF ──────────
  it('Test 1: Renderiza el libro completo a PDF generando un buffer válido con cabecera %PDF- y metadatos institucionales', async () => {
    const workbook = makeIntegrationWorkbook();
    const planning = makeIntegrationPlanning();

    // Invocación completa del pipeline con fallbackCover forzado para garantizar determinismo en Node
    const buffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });

    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // 1. Verificación de cabecera mágica de archivo PDF (%PDF-)
    const pdfMagicHeader = buffer.subarray(0, 5).toString('ascii');
    expect(pdfMagicHeader).toBe('%PDF-');

    // 2. Verificación de peso del documento (> 40 KB para un libro con portada, páginas de misión y autotable)
    expect(buffer.byteLength).toBeGreaterThan(40000);

    // 3. Extracción y verificación semántica de contenido textual con pdfParse
    const pdfData = await extractPdfData(buffer);

    // 4. Verificación de que cuenta con múltiples páginas (Portada, Plantel, Índice TOC, Misión, etc.)
    expect(pdfData.numpages).toBeGreaterThanOrEqual(4);

    // 5. Verificación de presencia de textos clave de la institución y la asignatura
    expect(pdfData.text).toContain('PENSAMIENTO MATEMÁTICO II');
    expect(pdfData.text).toContain('Bachillerato General Oficial Lic. Benito Juárez');
    expect(pdfData.text).toContain('21EBH0012A');
    expect(pdfData.text).toContain('San Pedro Cholula');
    expect(pdfData.text).toContain('Misión 1: Modelación de Sistemas Lineales');
    expect(pdfData.text).toContain('Don Mateo');
  }, 30000);

  // ── TEST 2: Inserción directa de portada personalizada provista como Buffer ─
  it('Test 2: Soporta coverBuffer pre-generado e incrusta la portada en la primera página sin errores', async () => {
    const workbook = makeIntegrationWorkbook();
    const planning = makeIntegrationPlanning();

    // Crear un mock mínimo de buffer de imagen JPEG válida de 1x1 pixel
    // SOI (FF D8), APP0 (FF E0 00 10 4A 46 49 46 00 ...), EOI (FF D9)
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

    const buffer = await renderWorkbookToPdf(workbook, planning, {
      coverBuffer: dummyJpegBuffer,
    });

    expect(buffer).toBeDefined();
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const pdfData = await extractPdfData(buffer);
    expect(pdfData.numpages).toBeGreaterThanOrEqual(3);
  }, 20000);

  // ── TEST 3: Renderizado con múltiples misiones y paginación extendida ───────
  it('Test 3: Concatena y pagina correctamente múltiples misiones didácticas sincronizando el TOC', async () => {
    const workbook = makeIntegrationWorkbook();
    // Agregar una segunda misión
    workbook.missions.push(makeIntegrationMission(2));
    workbook.tableOfContents.push({
      missionIndex: 2,
      title: 'Misión 2: Modelación de Sistemas Lineales en la Producción Artesanal',
      sessionsRange: 'Sesiones 4 a 6',
      pageEstimate: 4,
    });

    const planning = makeIntegrationPlanning();
    const buffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });

    const pdfData = await extractPdfData(buffer);
    expect(pdfData.numpages).toBeGreaterThan(4);
    expect(pdfData.text).toContain('Misión 1');
    expect(pdfData.text).toContain('Misión 2');
  }, 25000);
});
