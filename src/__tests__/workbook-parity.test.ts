// src/__tests__/workbook-parity.test.ts
/**
 * Test de Paridad Estructural y Editorial DOCX <-> PDF (H-325)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Verifica que renderWorkbookToDocx y renderWorkbookToPdf entreguen
 * exactamente el mismo documento al usuario a partir del mismo libro de trabajo:
 * 1. Portada con metadatos oficiales del plantel, CCT y UAC.
 * 2. Índice estructurado (Misiones, Proyecto PAEC, Evaluación NEM).
 * 3. Misiones didácticas con evaluación diagnóstica, 7 secciones canónicas y sus badges.
 * 4. Semáforo metacognitivo de 3 niveles y rúbrica analítica por misión.
 * 5. Artefacto de Proyecto Integrador PAEC.
 * 6. Instrumentos de evaluación formativa y sumativa NEM (incluyendo Sección V-B 50-20-30 y Ticket de Salida).
 */

import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook, MissionSection, ProjectSection, EvaluationSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

// Mocks defensivos autónomos
vi.mock('@/lib/db', () => ({
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'mock-parity-asset' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeParityMission(): MissionSection {
  return {
    missionIndex: 1,
    title: 'Misión 1: Leyes de Conservación y Balance Termodinámico en Hornos Rurales',
    coveredSessions: [1, 2],
    sessionTopic: 'Primera Ley de la Termodinámica y Rendimiento Energético',
    sessionFocus: 'Modelación del calor transferido en la cocción de ladrillo rojo tradicional',
    wordCount: 1200,
    phenomenonHook: {
      story: 'En los hornos ladrilleros de San Pedro Cholula, el consumo excesivo de leña genera costos elevados y emisiones.',
      detonatingQuestion: '¿Cómo podemos estimar la energía térmica útil para reducir el combustible en un 25%?',
    },
    conceptZero: {
      physicalAnalogy: 'Como el presupuesto familiar: la energía que ingresa debe ser igual a la energía útil más las pérdidas.',
      coreExplanation: 'La Primera Ley establece que delta U = Q - W, conservando la masa-energía de manera continua.',
      narrativeExplanation: 'El aislamiento de los muros refractarios reduce la tasa de pérdidas por conducción y radiación.',
      solvedExample: {
        problemStatement: 'Calcular el calor suministrado Q si el trabajo W es 40 kJ y delta U es 110 kJ.',
        solutionSteps: ['Paso 1: Q = delta U + W', 'Paso 2: Q = 110 + 40 = 150 kJ'],
        interpretation: 'Se requieren exactamente 150 kJ de energía térmica neta.',
      },
      contrastTable: [
        {
          correctConcept: 'El calor es energía en tránsito.',
          commonMisconception: 'Creer que los cuerpos poseen calor.',
          reasoning: 'La temperatura mide energía cinética media.',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'El docente grafica en el pizarrón el diagrama P-V del ciclo termodinámico.',
    },
    weDoSection: {
      guidedPractice: 'En parejas, calculen el trabajo neto del ciclo: <!--workbook:lines:rows=4-->',
      workbookElements: [
        {
          id: 'wb-lines-1',
          type: 'lines',
          title: 'Espacio de Deducción',
          instruction: 'Desarrolla el balance:',
          config: { rows: 4 },
        },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo individual: Calcula la eficiencia térmica de un intercambiador.',
      workbookElements: [
        {
          id: 'wb-table-1',
          type: 'empty_table',
          title: 'Tabla de Balance',
          instruction: 'Registra los datos:',
          config: { cols: ['Etapa', 'Calor Q', 'Trabajo W'] },
        },
      ],
    },
    troubleshooting: [
      {
        id: 'tb-1',
        symptom: 'El cálculo resulta en eficiencia superior al 100%.',
        rootCause: 'Inversión de signos en la convención de trabajo y calor.',
        solutionSteps: ['1. El calor entrante es positivo (+Q).', '2. El trabajo realizado es positivo (+W).'],
        preventionTip: 'Traza el diagrama de cuerpo libre térmico antes de operar.',
      },
    ],
    formativeCheckpoint: {
      question: '¿Por qué ninguna máquina térmica puede transformar todo el calor absorbido en trabajo?',
      reflectionPrompts: ['Explica la relación entre la Primera Ley y el ahorro comunitario.'],
      criteriaChecklist: ['Aplica la ecuación con signos correctos.', 'Convierte unidades con precisión.'],
    },
    diagnosticEvaluation: {
      context: 'Exploración de conceptos previos: temperatura, calor y escalas.',
      questions: ['¿Cuál es la diferencia entre calor y temperatura?'],
    },
    metacognitiveTrafficLight: {
      green: 'Comprendo y aplico el balance termodinámico con solvencia.',
      yellow: 'Tengo dudas con los signos de calor y trabajo.',
      red: 'No logro distinguir energía interna de calor transferido.',
    },
    safetyOrWorkshopTip: 'Precaución con superficies calientes y medición con termopares calibrados.',
  };
}

function makeParityWorkbook(): ActiveWorkTextbook {
  const projectSection: ProjectSection = {
    artifactName: 'Prototipo de Intercambiador Térmico para Secado de Tabique',
    communityUtility: 'Dispositivo recuperador de calor residual para optimizar la combustión.',
    phases: [
      {
        phaseNum: 1,
        title: 'Medición de temperatura',
        allocatedHours: 4,
        deliverables: ['Registro termográfico'],
        instructions: 'Medir la temperatura de los gases de escape.',
      },
    ],
    technicalSpecs: ['Sensor termopar tipo K', 'Cámara aislada'],
    acceptanceCriteria: ['Eficiencia energética calculada', 'Emisiones reducidas'],
  };

  const evaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Balance Termodinámico',
        weightPercent: 30,
        levels: [
          { levelName: 'Excelente', points: 10, descriptor: 'Modela el sistema térmico con balance exacto.' },
          { levelName: 'Bueno', points: 8, descriptor: 'Aplica la fórmula general con mínimas omisiones.' },
          { levelName: 'Suficiente', points: 6, descriptor: 'Identifica variables con asistencia.' },
          { levelName: 'Requiere Apoyo', points: 4, descriptor: 'No identifica los términos de calor y trabajo.' },
        ],
      },
    ],
    checklist: [
      { item: 'Registro de datos completo y verificado', category: 'Procedimiento' },
    ],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        scenario: 'Un horno rural incrementa su aislamiento pero las pérdidas por chimenea aumentan.',
        question: '¿Qué principio termodinámico explica que el rendimiento global permanezca constante?',
        options: [
          'Primera Ley de Conservación de la Energía',
          'Cero absoluto de temperatura',
        ],
        answerExplanation: 'La energía total se conserva independientemente de las vías de disipación.',
      },
    ],
    metacognitiveReflection: {
      prompts: ['¿Qué concepto resultó más desafiante de aplicar a tu entorno?'],
    },
  };

  return {
    uacName: 'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
    blockName: 'Bloque I: La Energía Térmica en los Procesos de Producción',
    blockIndex: 0,
    semester: 2,
    subsystem: 'Bachillerato General Estatal (BGE)',
    coverData: {
      schoolName: 'BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX',
      cct: '21EBH0118P',
      subjectName: 'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
      semester: 2,
      paecProjectName: 'Eficiencia Energética y Producción Sustentable',
      teacherName: 'Academia de Ciencias Naturales',
    },
    missions: [makeParityMission()],
    projectSection,
    evaluationSection,
  } as unknown as ActiveWorkTextbook;
}

function makeParityPlanning(): Planning {
  return {
    id: 'plan-parity-001',
    teacherId: 'teacher-parity-001',
    uacName: 'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
    semester: 2,
    subsystem: 'Bachillerato General Estatal',
    contentJson: {
      sectionI: {
        schoolName: 'BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX',
        cct: '21EBH0118P',
        teacherName: 'Academia de Ciencias Naturales',
      },
      sectionII: {
        paecConnection: 'Vincular el balance de energía al ahorro de leña.',
      },
      sectionIV: { activities: [] },
      sectionV: { evaluations: [] },
    },
  } as unknown as Planning;
}

describe('H-325 — Paridad Arquitectónica Integral DOCX <-> PDF', () => {
  it('ambos formatos contienen las secciones, insignias y contenidos clave en idéntica correspondencia', async () => {
    const workbook = makeParityWorkbook();
    const planning = makeParityPlanning();

    const [pdfBuffer, docxBuffer] = await Promise.all([
      renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true }),
      renderWorkbookToDocx(workbook, planning, { forceFallbackCover: true }),
    ]);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer).toBeInstanceOf(Buffer);

    // Extraer texto plano de PDF
    const pdfParser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const pdfResult = await pdfParser.getText();
    await pdfParser.destroy();
    const pdfText = pdfResult.text;

    // Extraer texto plano de DOCX con mammoth
    const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
    const docxText = docxResult.value;

    // 1. Metadatos del Plantel y Portada
    expect(pdfText).toContain('BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX');
    expect(docxText).toContain('BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX');
    expect(pdfText).toContain('21EBH0118P');
    expect(docxText).toContain('21EBH0118P');

    // 2. Título de Misión y Divisores de Sesión
    expect(pdfText).toContain('SESION 1 (50 MIN)');
    expect(docxText).toContain('SESIÓN 1 (50 MIN)');
    expect(pdfText).toContain('SESION 2 (50 MIN)');
    expect(docxText).toContain('SESIÓN 2 (50 MIN)');

    // 3. Badges de Acción Cognitiva de las 7 Secciones Canónicas
    const canonicalBadges = [
      'SITUACION REAL',
      'LEO Y COMPRENDO',
      'MODELO DOCENTE',
      'TRABAJO EN EQUIPO',
      'HAGO Y RESUELVO',
      'ERROR COMUN',
      'MI ENTREGA',
    ];
    for (const badge of canonicalBadges) {
      // Normalizar texto para tolerar acentos entre WinAnsi y UTF-8
      const normPdf = pdfText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normDocx = docxText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      expect(normPdf).toContain(badge);
      expect(normDocx).toContain(badge);
    }

    // 4. Evaluación Diagnóstica de Saberes Previos Situados (H-325)
    expect(pdfText).toContain('EVALUACIÓN DIAGNÓSTICA: SABERES PREVIOS SITUADOS');
    expect(docxText).toContain('EVALUACIÓN DIAGNÓSTICA: SABERES PREVIOS SITUADOS');
    expect(pdfText).toContain('¿Cuál es la diferencia entre calor y temperatura?');
    expect(docxText).toContain('¿Cuál es la diferencia entre calor y temperatura?');

    // 5. Semáforo Metacognitivo (H-325)
    expect(pdfText).toContain('SEMÁFORO DE APRENDIZAJE: AUTOEVALUACIÓN METACOGNITIVA');
    expect(docxText).toContain('SEMÁFORO DE APRENDIZAJE: AUTOEVALUACIÓN METACOGNITIVA');
    expect(pdfText).toContain('LO LOGRÉ');
    expect(docxText).toContain('LO LOGRÉ');
    expect(pdfText).toContain('EN PROCESO');
    expect(docxText).toContain('EN PROCESO');
    expect(pdfText).toContain('NECESITO APOYO');
    expect(docxText).toContain('NECESITO APOYO');

    // 6. Rúbrica Analítica de Misión (H-325)
    expect(pdfText).toContain('RÚBRICA FORMATIVA ANALÍTICA DE LA MISIÓN');
    expect(docxText).toContain('RÚBRICA FORMATIVA ANALÍTICA DE LA MISIÓN');

    // 7. Proyecto Integrador PAEC
    expect(pdfText).toContain('Prototipo de Intercambiador Térmico para Secado de Tabique');
    expect(docxText).toContain('Prototipo de Intercambiador Térmico para Secado de Tabique');

    // 8. Sección V-B: Bitácora Formativa y Reguladora (50-20-30) y Ticket de Salida
    expect(pdfText).toContain('SECCIÓN V-B: BITÁCORA FORMATIVA Y REGULADORA (50-20-30)');
    expect(docxText).toContain('SECCIÓN V-B: BITÁCORA FORMATIVA Y REGULADORA (50-20-30)');
    expect(pdfText).toContain('TICKET DE SALIDA (Evaluación Reguladora al Cierre de Sesión):');
    expect(docxText).toContain('TICKET DE SALIDA (Evaluación Reguladora al Cierre de Sesión):');

    // 9. Índice General con Proyecto y Evaluación NEM
    expect(pdfText).toContain('Proyecto PAEC');
    expect(docxText).toContain('Proyecto PAEC');
    expect(pdfText).toContain('Evaluación NEM');
    expect(docxText).toContain('Evaluación NEM');

    // 10. Anti-regresión de paridad de sanitización (F-01)
    expect(docxText).not.toContain('<!--workbook:');
    expect(pdfText).not.toContain('<!--workbook:');
    expect(docxText).not.toContain('<!--');
    expect(pdfText).not.toContain('<!--');

    // 11. Matriz de Troubleshooting (fixture: m.troubleshooting[0])
    for (const frag of [
      'El cálculo resulta en eficiencia',
      'Inversión de signos',
      'cuerpo libre térmico',
    ]) {
      expect(pdfText).toContain(frag);
      expect(docxText).toContain(frag);
    }

    // 12. Créditos institucionales y ficha de acreditación (headers por formato)
    expect(docxText).toContain('Créditos Institucionales y Atribuciones de Propiedad Intelectual');
    expect(pdfText).toContain('CRÉDITOS INSTITUCIONALES Y ATRIBUCIONES LEGALES');
    expect(docxText).toContain('FICHA DE ACREDITACIÓN CURRICULAR Y VALIDACIÓN INSTITUCIONAL');
    expect(pdfText).toContain('FICHA DE ACREDITACIÓN CURRICULAR Y SELLO INSTITUCIONAL');
    expect(docxText).toContain('SUBSISTEMA');
    expect(pdfText).toContain('SUBSISTEMA:');

    // 13. Subsistema y ciclo escolar en portada
    expect(docxText).toContain('Subsistema:');
    expect(pdfText).toContain('SUBSISTEMA:');
    expect(docxText).toContain('Ciclo Escolar');
    expect(pdfText).toContain('Ciclo Escolar');

    // 14. Estructura del TOC (títulos)
    for (const t of ['MISIÓN 1', 'Proyecto PAEC', 'Evaluación NEM', 'Créditos']) {
      expect(pdfText).toContain(t);
      expect(docxText).toContain(t);
    }
  }, 40000);

  it('fallbacks H-325: diagnóstico y semáforo sintéticos + sin etiquetas crudas (F-03)', async () => {
    const baseMission = makeParityMission();
    const fallbackMission: MissionSection = {
      ...baseMission,
      diagnosticEvaluation: undefined,
      metacognitiveTrafficLight: undefined,
      phenomenonHook: {
        ...baseMission.phenomenonHook,
        story: 'En los hornos comunitarios de Puebla se analiza el balance térmico de la TERMODINÁMICA para optimizar la combustión y reducir emisiones contaminantes en el entorno escolar. <!--workbook:lines:rows=3-->',
      },
      conceptZero: {
        ...baseMission.conceptZero,
        coreExplanation: 'La Primera Ley establece la CONSERVACIÓN de la energía entre el calor absorbido y el trabajo entregado por el sistema térmico artesanal. <!--workbook:table:cols=3-->',
      },
      iDoSection: { stepByStepDemo: 'Demostración docente guiada del balance térmico con fórmulas fundamentales. <!--workbook:code_box-->' },
    } as MissionSection;

    const workbookFallback: ActiveWorkTextbook = {
      ...makeParityWorkbook(),
      missions: [fallbackMission],
    };
    const planning = makeParityPlanning();

    const [pdfBuffer, docxBuffer] = await Promise.all([
      renderWorkbookToPdf(workbookFallback, planning, { forceFallbackCover: true }),
      renderWorkbookToDocx(workbookFallback, planning, { forceFallbackCover: true }),
    ]);

    const pdfParser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const pdfResult = await pdfParser.getText();
    await pdfParser.destroy();
    const pdfText = pdfResult.text;

    const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
    const docxText = docxResult.value;

    expect(docxText).toContain('EVALUACIÓN DIAGNÓSTICA: SABERES PREVIOS SITUADOS');
    expect(pdfText).toContain('EVALUACIÓN DIAGNÓSTICA: SABERES PREVIOS SITUADOS');
    expect(docxText).toContain('SEMÁFORO DE APRENDIZAJE: AUTOEVALUACIÓN METACOGNITIVA');
    expect(pdfText).toContain('SEMÁFORO DE APRENDIZAJE: AUTOEVALUACIÓN METACOGNITIVA');
    expect(docxText).not.toContain('<!--');
    expect(pdfText).not.toContain('<!--');
  }, 40000);
});
