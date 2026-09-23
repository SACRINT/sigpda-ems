// src/__tests__/workbook-snapshot.test.ts
/**
 * Test de Snapshot Estructural para pdf-workbook-renderer.ts (Fase 25)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Previene regresiones visuales y de flujo de página al comparar la estructura
 * canónica generada (páginas, encabezados, divisores de sesión y badges)
 * contra un snapshot determinista inmutable.
 */

import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

// ── Mocks Autónomos ──────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'mock-snapshot-asset' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeCanonicalMission(): MissionSection {
  return {
    missionIndex: 1,
    title: 'Misión 1: Leyes de Conservación y Balance Termodinámico en Hornos Rurales',
    coveredSessions: [1, 2],
    sessionTopic: 'Primera Ley de la Termodinámica y Rendimiento Energético',
    sessionFocus: 'Modelación del calor transferido en la cocción de ladrillo rojo tradicional',
    phenomenonHook: {
      story: 'En los hornos ladrilleros de San Pedro Cholula, el consumo excesivo de leña genera costos elevados y emisiones contaminantes evitables.',
      detonatingQuestion: '¿Cómo podemos estimar la energía térmica útil para reducir el combustible en un 25%?',
    },
    conceptZero: {
      physicalAnalogy: 'Como el presupuesto familiar: la energía que ingresa debe ser igual a la energía útil más las pérdidas hacia el entorno.',
      coreExplanation: 'La Primera Ley establece que delta U = Q - W, conservando la masa-energía de manera continua en un sistema cerrado.',
      narrativeExplanation: 'El aislamiento de los muros refractarios reduce la tasa de pérdidas por conducción y radiación exterior.',
      solvedExample: {
        problemStatement: 'Calcular el calor suministrado Q si el trabajo de expansión W es 40 kJ y el incremento de energía interna es 110 kJ.',
        solutionSteps: [
          'Paso 1: Aplicar balance de energía: Q = delta U + W.',
          'Paso 2: Sustituir valores: Q = 110 kJ + 40 kJ = 150 kJ.',
          'Paso 3: Calcular eficiencia térmica preliminar.',
        ],
        interpretation: 'Se requieren exactamente 150 kJ de energía térmica neta transferida al proceso.',
      },
      contrastTable: [
        {
          correctConcept: 'El calor es energía en tránsito, no una sustancia que se almacena.',
          commonMisconception: 'Creer que los cuerpos "poseen" calor en vez de energía interna.',
          reasoning: 'La temperatura mide la energía cinética promedio de las partículas.',
        },
      ],
    },
    iDoSection: {
      stepByStepDemo: 'El docente grafica en el pizarrón el diagrama P-V del ciclo termodinámico y calcula el área bajo la curva.',
    },
    weDoSection: {
      guidedPractice: 'En parejas, calculen el trabajo neto para un ciclo de compresión cuasiestática: <!--workbook:lines:rows=4-->',
      workbookElements: [
        {
          id: 'wb-snap-lines',
          type: 'lines',
          title: 'Espacio de Deducción en Parejas',
          instruction: 'Desarrolla el balance de calor y trabajo:',
          config: { rows: 4 },
        },
      ],
    },
    youDoSection: {
      autonomousChallenge: 'Reto autónomo individual: Calcula la eficiencia térmica de un intercambiador de calor artesanal.',
      workbookElements: [
        {
          id: 'wb-snap-table',
          type: 'empty_table',
          title: 'Tabla de Balance Energético',
          instruction: 'Registra los datos experimentales:',
          config: { cols: ['Etapa', 'Calor Q (kJ)', 'Trabajo W (kJ)', 'delta U (kJ)'] },
        },
      ],
    },
    troubleshooting: [
      {
        id: 'tb-snap-1',
        symptom: 'El cálculo resulta en eficiencia superior al 100%.',
        rootCause: 'Inversión de signos en la convención de trabajo y calor.',
        solutionSteps: [
          '1. Recuerda que el calor que entra al sistema es positivo (+Q).',
          '2. El trabajo realizado por el sistema es positivo (+W).',
        ],
        preventionTip: 'Traza el diagrama de cuerpo libre térmico antes de operar numéricamente.',
      },
    ],
    formativeCheckpoint: {
      question: '¿Por qué ninguna máquina térmica puede transformar todo el calor absorbido en trabajo mecánico?',
      reflectionPrompts: [
        'Explica la relación entre la Primera Ley y la preservación de recursos en tu comunidad.',
      ],
      criteriaChecklist: [
        'Aplica la ecuación de la Primera Ley con coherencia de signos.',
        'Convierte unidades entre Joules y Calorías con precisión.',
      ],
    },
    wordCount: 880,
    diagnosticEvaluation: {
      context: 'Exploración de conceptos previos: temperatura, calor y escalas de medición.',
      questions: ['¿Cuál es la diferencia entre calor y temperatura?'],
    },
    realLifeConnection: {
      context: 'Eficiencia energética en cocinas ecológicas y calentadores solares comunitarios.',
      householdApplication: 'Aislamiento térmico en calentadores de agua domésticos.',
      communityImpact: 'Disminución de tala clandestina y ahorro económico para familias campesinas.',
    },
    metacognitiveTrafficLight: {
      green: 'Comprendo y aplico el balance termodinámico con solvencia.',
      yellow: 'Tengo dudas con los signos de calor y trabajo.',
      red: 'No logro distinguir energía interna de calor transferido.',
    },
    safetyOrWorkshopTip: 'Precaución con superficies calientes y medición con termopares calibrados.',
  };
}

function makeCanonicalWorkbook(): ActiveWorkTextbook {
  const projectSection = {
    artifactName: 'Prototipo de Intercambiador Térmico para Secado de Tabique',
    communityUtility: 'Dispositivo recuperador de calor residual para optimizar la combustión en ladrilleras.',
    phases: [
      {
        phaseNum: 1,
        title: 'Medición de temperatura de chimenea',
        allocatedHours: 4,
        deliverables: ['Registro termográfico'],
        instructions: 'Medir la temperatura de los gases de escape durante la quema.',
      },
    ],
  };

  const evaluationSection = {
    rubric: {
      criteria: [
        {
          name: 'Balance Termodinámico',
          excellent: 'Modela el sistema térmico con balance exacto y diagramas de flujo.',
          good: 'Aplica la fórmula general pero omite pérdidas por radiación.',
          acceptable: 'Identifica las variables con asistencia del facilitador.',
          insufficient: 'No identifica los términos de calor y trabajo.',
        },
      ],
    },
  };

  return {
    uacName: 'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
    blockName: 'Bloque I: La Energía Térmica en los Procesos de Producción',
    blockNumber: 1,
    semester: 2,
    hoursTotal: 16,
    subsystem: 'Bachillerato General Estatal (BGE)',
    coverData: {
      schoolName: 'BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX',
      cct: '21EBH0118P',
      subjectName: 'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
      semester: 2,
      blockTitle: 'Bloque I: Energía Térmica en Procesos Locales',
      paecProjectName: 'Eficiencia Energética y Producción Sustentable',
      authorTeacher: 'Academia de Ciencias Naturales',
      targetCycle: 'Ciclo Escolar 2026-2027',
      primaryColor: '#1B6B8A',
    },
    missions: [makeCanonicalMission()],
    projectSection,
    evaluationSection,
  } as unknown as ActiveWorkTextbook;
}

function makeCanonicalPlanning(): Planning {
  return {
    id: 'plan-snapshot-001',
    teacherId: 'teacher-snap-001',
    uacName: 'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
    semester: 2,
    subsystem: 'Bachillerato General Estatal',
    modality: 'Escolarizada',
    period: '2026-2027',
    hoursTotal: 16,
    weeklyHours: 4,
    component: 'fundamental',
    paecContext: 'Eficiencia de combustible en procesos productivos tradicionales de la región.',
    status: 'generated',
    createdAt: new Date(),
    updatedAt: new Date(),
    contentJson: {
      sectionI: {
        schoolName: 'BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX',
        cct: '21EBH0118P',
        zone: 'Zona Escolar 004',
        municipality: 'Cholula',
        teacherName: 'Academia de Ciencias Naturales',
        semester: 2,
        group: 'A',
        shift: 'Matutino',
        cycle: '2026-2027',
      },
      sectionII: {
        diagnosis: 'Alumnos con nociones intuitivas de calor pero confusión con energía interna.',
        paecConnection: 'Vincular el balance de energía al ahorro de leña en ladrilleras comunitarias.',
      },
      sectionIII: { transversalThemes: ['Pensamiento Matemático', 'Cuidado Ambiental'] },
      sectionIV: { activities: [] },
      sectionV: { evaluations: [], evaluationAgreement: '70% Desempeño / 30% Producto' },
    },
  } as unknown as Planning;
}

describe('Fase 25 — Tests de Snapshot Estructural para pdf-workbook-renderer.ts', () => {
  it('preserva la estructura canónica, divisores y badges sin regresión de maquetación', async () => {
    const workbook = makeCanonicalWorkbook();
    const planning = makeCanonicalPlanning();

    const pdfBuffer = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeInstanceOf(Buffer);

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();

    // 1. Snapshot de la lista ordenada de marcas estructurales detectadas
    const expectedMarkers = [
      'CONSERVACIÓN DE LA ENERGÍA Y SUS INTERACCIONES',
      'BACHILLERATO GENERAL ESTATAL JUAN DE PALAFOX',
      'SESION 1 (50 MIN)',
      'APERTURA Y MODELADO CONCEPTUAL',
      '[ SITUACION REAL ]',
      '[ LEO Y COMPRENDO ]',
      '[ MODELO DOCENTE ]',
      'SESION 2 (50 MIN)',
      'PRACTICA GUIADA, RETO Y CIERRE',
      '[ TRABAJO EN EQUIPO ]',
      '[ HAGO Y RESUELVO ]',
      '[ ERROR COMUN ]',
      '[ MI ENTREGA ]',
    ];

    const detectedMarkers = expectedMarkers.filter((marker) => parsed.text.includes(marker));
    expect(detectedMarkers).toEqual(expectedMarkers);

    // 2. Snapshot de métricas estructurales globales
    const structuralMetrics = {
      totalMarkersFound: detectedMarkers.length,
      hasSession1: parsed.text.includes('SESION 1 (50 MIN)'),
      hasSession2: parsed.text.includes('SESION 2 (50 MIN)'),
      hasWinAnsiBadges: [
        '[ SITUACION REAL ]',
        '[ LEO Y COMPRENDO ]',
        '[ MODELO DOCENTE ]',
        '[ TRABAJO EN EQUIPO ]',
        '[ HAGO Y RESUELVO ]',
        '[ ERROR COMUN ]',
        '[ MI ENTREGA ]',
      ].every((badge) => parsed.text.includes(badge)),
      isEmojiFree: !/[⏱️📖💡👨‍🏫👥✏️⚠️🎯🎨]/.test(parsed.text),
      minExpectedPages: 8,
    };

    expect(structuralMetrics).toMatchInlineSnapshot(`
      {
        "hasSession1": true,
        "hasSession2": true,
        "hasWinAnsiBadges": true,
        "isEmojiFree": true,
        "minExpectedPages": 8,
        "totalMarkersFound": 13,
      }
    `);

    // 3. Verificación de umbral de páginas
    expect(parsed.total).toBeGreaterThanOrEqual(8);
  }, 35000);
});
