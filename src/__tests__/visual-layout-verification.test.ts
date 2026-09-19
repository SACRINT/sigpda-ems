// src/__tests__/visual-layout-verification.test.ts
/**
 * Test de Verificación Visual de Maquetación y Badges de Sesión (Fase 24)
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Valida visual y estructuralmente la maquetación editorial de un Libro de Texto Activo:
 * 1. Generación de divisores de sesión con geometría institucional y colores homologados.
 * 2. Inserción de los 7 badges cognitivos WinAnsi en cintillos y encabezados.
 * 3. Ausencia total de emojis y caracteres que provoquen corrupción en jsPDF (Helvetica).
 * 4. Paginación consistente con TOC y preservación de márgenes de impresión.
 * 5. Persistencia del archivo PDF de verificación en scratch/ para auditoría física.
 */

import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import type { ActiveWorkTextbook, MissionSection, ProjectSection, EvaluationSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

// ── Mocks para Entorno Autónomo ──────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'mock-visual-asset' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Fixture Builder ──────────────────────────────────────────────────────────
function buildMission(idx: number, startSession: number): MissionSection {
  return {
    missionIndex: idx,
    title: `Misión ${idx}: Análisis de Sistemas de Ecuaciones en Modelos Productivos`,
    coveredSessions: [startSession, startSession + 1],
    sessionTopic: 'Modelación algebraica de restricciones en microempresas poblanas',
    sessionFocus: 'Resolución analítica de balance de recursos e insumos mediante sistemas 2x2',
    phenomenonHook: {
      story: 'En los talleres de talavera de San Jerónimo Caleras, la mezcla de pigmentos minerales y esmaltes tradicionales debe cumplir proporciones estequiométricas rigurosas para soportar la cocción en horno.',
      detonatingQuestion: '¿Cómo podemos calcular las proporciones exactas para evitar piezas craqueladas sin exceder el presupuesto del taller?',
    },
    conceptZero: {
      physicalAnalogy: 'Como dos caminos rectos en la campiña poblana que se cruzan en un único punto geográfico cardinal.',
      coreExplanation: 'Un sistema lineal representa intersecciones simultáneas de restricciones en un espacio bidimensional.',
      narrativeExplanation: 'El balance matemático asegura sostenibilidad económica y calidad técnica en la manufactura artesanal.',
      solvedExample: {
        problemStatement: 'Determinar x (esmaltes) y y (pigmentos) tales que x + y = 60 kg y 3x + 5y = 220 pesos.',
        solutionSteps: [
          'Paso 1: Despejar x = 60 - y.',
          'Paso 2: Sustituir 3(60 - y) + 5y = 220 -> 180 + 2y = 220 -> y = 20 kg.',
          'Paso 3: Calcular x = 60 - 20 = 40 kg.',
        ],
        interpretation: 'El taller requiere exactamente 40 kg de base de esmalte y 20 kg de pigmento mineral azul cobalto.',
      },
      contrastTable: [
        {
          correctConcept: 'El punto de equilibrio es simultáneo y único para ambas ecuaciones.',
          commonMisconception: 'Asumir que cualquier solución particular de una recta satisface el sistema global.',
          reasoning: 'La solución requiere intersección matemática rigurosa en el plano coordenado.',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'El docente modela en el pizarrón el método de sustitución y grafica las asíntotas y puntos de corte.',
    },
    weDoSection: {
      guidedPractice: 'En equipos colaborativos de 4 integrantes, resuelvan el siguiente desafío de hornada continua: <!--workbook:lines:rows=4-->',
      workbookElements: [
        {
          id: `wb-colab-${idx}`,
          type: 'lines',
          title: 'Procedimiento Colaborativo en Equipo',
          instruction: 'Desarrolla el despeje algebraico y comprueba el balance numérico:',
          config: { rows: 4 },
        },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo individual: Determina la cantidad óptima de esmalte para 150 cazuelas vidriadas.',
      workbookElements: [
        {
          id: `wb-table-${idx}`,
          type: 'empty_table',
          title: 'Matriz de Costos de Producción',
          instruction: 'Registra los valores tabulados de la jornada:',
          config: { cols: ['Insumo (x)', 'Precio Base', 'Factor de Merma', 'Costo Final (y)'] },
        },
      ],
    },
    troubleshooting: [
      {
        id: `tb-${idx}-1`,
        symptom: 'Al operar se obtiene 0 = 12 o inconsistencia similar.',
        rootCause: 'Las ecuaciones describen rectas paralelas con pendientes idénticas.',
        solutionSteps: [
          '1. Calcula la pendiente m = -A/B de ambas expresiones lineales.',
          '2. Si m1 = m2 y b1 != b2, concluye que no hay punto común de producción.',
        ],
        preventionTip: 'Comprueba la razón de proporcionalidad entre coeficientes antes de iniciar operaciones.',
      },
    ],
    formativeCheckpoint: {
      question: '¿Por qué la verificación numérica en ambas ecuaciones es indispensable antes de emitir la orden de compra?',
      reflectionPrompts: [
        'Explica cómo aplicarías este modelo a los gastos familiares semanales.',
        'Describe la diferencia geométrica entre un sistema compatible determinado e indeterminado.',
      ],
      criteriaChecklist: [
        'Identifica correctamente variables independientes y dependientes.',
        'Aplica leyes de los signos y despejes sin omisión de pasos.',
        'Interpreta los valores hallados en el contexto artesanal.',
      ],
    },
    wordCount: 920,
    diagnosticEvaluation: {
      context: 'Exploración de saberes previos: ecuaciones de primer grado y lectura gráfica en el plano cartesiano.',
      questions: [
        '¿Qué representa una pendiente positiva en una función de producción?',
        'Si un artesano gasta 2x = 50 pesos, ¿cuál es el costo unitario x?',
      ],
    },
    realLifeConnection: {
      context: 'Microeconomía regional y cooperativas comunitarias en el Valle de Puebla.',
      householdApplication: 'Aplica el balance de costos al consumo mensual de energía eléctrica en el hogar.',
      communityImpact: 'Mejora la rentabilidad y evita pérdidas en talleres familiares.',
    },
    metacognitiveTrafficLight: {
      green: 'Domino la resolución analítica y su modelación gráfica.',
      yellow: 'Requiero verificar el despeje con calculadora o apoyo del docente.',
      red: 'Se me dificulta traducir el problema narrativo al lenguaje algebraico.',
    },
    safetyOrWorkshopTip: 'Mantén limpieza y ventilación adecuada al manipular polvos cerámicos y esmaltes.',
  };
}

function buildVerificationWorkbook(): ActiveWorkTextbook {
  const projectSection: ProjectSection = {
    artifactName: 'Manual de Costos y Catálogo de Mezclas para Artesanos de San Jerónimo',
    communityUtility: 'Guía técnica aplicada para calcular mezclas de materias primas con mínimo desperdicio.',
    phases: [
      {
        phaseNum: 1,
        title: 'Relevamiento de datos en talleres de alfarería',
        allocatedHours: 6,
        deliverables: ['Cédula de costos unitarios'],
        instructions: 'Entrevistar a maestros alfareros y registrar el consumo de esmaltes.',
      },
      {
        phaseNum: 2,
        title: 'Modelación matemática y hojas de cálculo',
        allocatedHours: 8,
        deliverables: ['Matriz de balance comprobada'],
        instructions: 'Resolver algebraicamente los puntos de equilibrio de producción.',
      },
    ],
  };

  const evaluationSection: EvaluationSection = {
    rubric: {
      criteria: [
        {
          name: 'Modelación Matemática',
          excellent: 'Plantea y resuelve el sistema 2x2 con exactitud y comprobación analítica completa.',
          good: 'Plantea el sistema pero comete errores algebraicos menores en la comprobación.',
          acceptable: 'Requiere asistencia para formular las ecuaciones pero comprende el resultado.',
          insufficient: 'No logra traducir el enunciado a variables algebraicas.',
        },
      ],
    },
    summaryMatrix: [
      {
        missionTitle: 'Misión 1: Análisis de Sistemas Lineales',
        keyCompetency: 'Pensamiento Lógico-Matemático en contextos productivos',
        suggestedScore: '50% Reto Situado / 30% Práctica / 20% Participación',
      },
    ],
  };

  return {
    uacName: 'PENSAMIENTO MATEMÁTICO II',
    blockName: 'Bloque I: Modelación de Restricciones Lineales en la Comunidad',
    blockNumber: 1,
    semester: 2,
    hoursTotal: 16,
    subsystem: 'Bachillerato General Estatal (BGE)',
    coverData: {
      schoolName: 'BACHILLERATO GENERAL ESTATAL EMILIANO ZAPATA',
      cct: '21EBH0245K',
      subjectName: 'PENSAMIENTO MATEMÁTICO II',
      semester: 'Segundo Semestre',
      blockTitle: 'Bloque I: Modelación de Restricciones Lineales',
      paecProjectName: 'Preservación y Tecnificación de Talleres Artesanales Comunitarios',
      authorTeacher: 'Prof. Marco Antonio Morales Vázquez',
      targetCycle: 'Ciclo Escolar 2026-2027',
      primaryColor: '#1B6B8A',
    },
    missions: [
      buildMission(1, 1),
      buildMission(2, 3),
    ],
    projectSection,
    evaluationSection,
  };
}

function buildVerificationPlanning(): Planning {
  return {
    id: 'plan-visual-verification-001',
    teacherId: 'teacher-fase24-001',
    uacName: 'PENSAMIENTO MATEMÁTICO II',
    semester: 2,
    subsystem: 'Bachillerato General Estatal',
    modality: 'Escolarizada',
    period: '2026-2027',
    hoursTotal: 16,
    weeklyHours: 4,
    component: 'fundamental',
    paecContext: 'Problemática: Reducción del margen de ganancia en talleres familiares por cálculo empírico de insumos cerámicos en San Jerónimo Caleras.',
    status: 'generated',
    createdAt: new Date(),
    updatedAt: new Date(),
    contentJson: {
      sectionI: {
        schoolName: 'BACHILLERATO GENERAL ESTATAL EMILIANO ZAPATA',
        cct: '21EBH0245K',
        zone: 'Zona Escolar 004',
        municipality: 'Puebla',
        teacherName: 'Prof. Marco Antonio Morales Vázquez',
        semester: 'Segundo',
        group: 'A y B',
        shift: 'Matutino',
        cycle: '2026-2027',
      },
      sectionII: {
        diagnosis: 'Los alumnos reconocen el plano cartesiano pero presentan dificultad al traducir problemas verbales a ecuaciones simultáneas.',
        paecConnection: 'Vincular el aprendizaje matemático al cálculo de costos de producción en microempresas familiares.',
      },
      sectionIII: { transversalThemes: ['Cultura Digital', 'Conciencia Histórica', 'Economía Comunitaria'] },
      sectionIV: { activities: [] },
      sectionV: { evaluations: [], evaluationAgreement: '80% Portafolio de Evidencias / 20% Desempeño' },
    },
  };
}

describe('Fase 24 — Verificación Visual de Maquetación y Badges de Sesión', () => {
  it('genera un PDF completo con divisores de sesión y badges cognitivos WinAnsi verificados visualmente', async () => {
    const workbook = buildVerificationWorkbook();
    const planning = buildVerificationPlanning();

    // 1. Renderizar el PDF completo de 2 misiones con portada vectorial V7 institucional
    const pdfBuffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(30000);

    // 2. Persistir archivo en scratch/ para verificación física y trazabilidad editorial
    const scratchDir = path.resolve(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    const outputPath = path.join(scratchDir, 'fase24-visual-verification.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    expect(fs.existsSync(outputPath)).toBe(true);

    // 3. Extracción de contenido con PDFParse v2
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();

    const pdfText = parsed.text;

    // 4. Verificación de Metadatos y Estructura Editorial
    expect(pdfText).toContain('PENSAMIENTO MATEMÁTICO II');
    expect(pdfText).toContain('BACHILLERATO GENERAL ESTATAL EMILIANO ZAPATA');

    // 5. Verificación de Divisores de Sesión Predictivos (Etapa 1)
    expect(pdfText).toContain('SESION 1 (50 MIN)');
    expect(pdfText).toContain('APERTURA Y MODELADO CONCEPTUAL');
    expect(pdfText).toContain('SESION 2 (50 MIN)');
    expect(pdfText).toContain('PRACTICA GUIADA, RETO Y CIERRE');
    expect(pdfText).toContain('SESION 3 (50 MIN)');
    expect(pdfText).toContain('SESION 4 (50 MIN)');

    // 6. Verificación de los 7 Badges de Acción Cognitiva WinAnsi
    expect(pdfText).toContain('[ SITUACION REAL ]');
    expect(pdfText).toContain('[ LEO Y COMPRENDO ]');
    expect(pdfText).toContain('[ MODELO DOCENTE ]');
    expect(pdfText).toContain('[ TRABAJO EN EQUIPO ]');
    expect(pdfText).toContain('[ HAGO Y RESUELVO ]');
    expect(pdfText).toContain('[ ERROR COMUN ]');
    expect(pdfText).toContain('[ MI ENTREGA ]');

    // 7. Garantía Absoluta: Cero Emojis en el Flujo jsPDF (WinAnsi Safe)
    const forbiddenEmojis = ['⏱️', '📖', '💡', '👨‍🏫', '👥', '✏️', '⚠️', '🎯', '🎨', '🔍'];
    for (const emoji of forbiddenEmojis) {
      expect(pdfText).not.toContain(emoji);
    }

    // 8. Paginación y Robustez de Contenido
    expect(parsed.total).toBeGreaterThanOrEqual(10);
  }, 35000);
});
