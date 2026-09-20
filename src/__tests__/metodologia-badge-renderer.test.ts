/**
 * Pruebas de Integración y Visualización: Badges de Metodología Activa en Renderizadores DOCX/PDF
 * SIGPDA-EMS · Validación de Carátula y Tablas Institucionales
 */

import { describe, it, expect, vi } from 'vitest';
import { formatearBadgeMetodologia } from '@/lib/catalogo-metodologias';
import { generateSecuenciaDocx } from '@/lib/docx-generator';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import type { GeneratedPlanningContent, Planning } from '@/types/planning';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import { PDFParse } from 'pdf-parse';

vi.mock('@/lib/db', () => ({
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'mock-badge-asset' }),
}));

describe('Badges de Metodología Activa — formatearBadgeMetodologia', () => {
  it('debe formatear [Metodología: ABProblemas] para id abproblemas', () => {
    expect(formatearBadgeMetodologia('abproblemas')).toBe('[Metodología: ABProblemas]');
  });

  it('debe formatear [Metodología: Indagación (ABI)] para id indagacion', () => {
    expect(formatearBadgeMetodologia('indagacion')).toBe('[Metodología: Indagación (ABI)]');
  });

  it('debe formatear [Metodología: ABP] para id abp', () => {
    expect(formatearBadgeMetodologia('abp')).toBe('[Metodología: ABP]');
  });

  it('debe resolver nombres largos legacy de catálogo a su nombre corto oficial', () => {
    expect(
      formatearBadgeMetodologia('Aprendizaje Basado en Problemas (ABProblemas)')
    ).toBe('[Metodología: ABProblemas]');
    expect(
      formatearBadgeMetodologia('Aprendizaje Basado en Indagación (ABI)')
    ).toBe('[Metodología: Indagación (ABI)]');
  });

  it('debe retornar fallback seguro para valores nulos o vacíos', () => {
    expect(formatearBadgeMetodologia(null)).toBe('[Metodología: Activa]');
    expect(formatearBadgeMetodologia(undefined)).toBe('[Metodología: Activa]');
    expect(formatearBadgeMetodologia('')).toBe('[Metodología: Activa]');
  });
});

describe('Integración en Renderizadores — DOCX y PDF', () => {
  const mockContent: GeneratedPlanningContent = {
    sectionI: {
      teacherName: 'Prof. Pedro Ramírez',
      uacName: 'PENSAMIENTO MATEMÁTICO II',
      semester: 2,
      groups: 'A, B',
      schoolYear: '2026-2027',
      applicationPeriod: 'Feb-Jul 2026',
      estimatedSessions: '18',
      component: 'Fundamental',
      totalHours: 18,
      subsystem: 'BGE',
      schoolName: 'BACHILLERATO GENERAL OFICIAL PUEBLA',
      cct: '21EBH0100A',
      metodologiaActiva: 'abproblemas',
    },
    sectionII: {
      purpose: 'Modelado algebraico y resolución colaborativa de problemas del entorno.',
      learningOutcomes: ['Aplica ecuaciones lineales en contextos reales.'],
      paecConnection: 'Optimización de recursos hídricos en la comunidad escolar.',
      activities: [
        {
          name: 'Resolución de Desafíos Hídricos',
          hours: 18,
          order: 1,
        },
      ],
    },
    sectionIII: {
      fundamentalCurriculum: [{ area: 'Pensamiento Matemático', description: 'Modelado algebraico' }],
      expandedCurriculum: [{ area: 'Cuidado Ambiental', description: 'Huella hídrica' }],
    },
    sectionIV: {
      note: 'Metodología activa obligatoria NEM',
      activities: [
        {
          name: 'Resolución de Desafíos Hídricos',
          hours: 18,
          methodology: 'abproblemas',
          apertura: { activities: 'Problematización inicial', processes: 'asombro', materials: 'Recibo de agua' },
          ejecucion: { activities: 'Modelado de ecuaciones', processes: 'razonamiento', materials: 'Calculadora' },
          conclusion: { activities: 'Sustentación de propuestas', processes: 'transferencia', materials: 'Cartel' },
        },
      ],
    },
    sectionV: {
      evaluations: [
        {
          type: 'Formativa',
          agent: 'Heteroevaluación',
          moment: 'Cierre',
          evidence: 'Modelo de ecuaciones',
          instrument: 'Rúbrica',
          percentage: 100,
        },
      ],
      evaluationAgreement: '70% proceso / 30% producto',
    },
    sectionVI: {
      studentMaterials: ['Cuaderno'],
      teacherMaterials: ['Pizarrón'],
      digital: ['Calculadora'],
      spaces: ['Aula'],
      references: ['SEP 2026'],
    },
    sectionVII: {},
  };

  it('generateSecuenciaDocx debe compilar un buffer DOCX válido con el badge de metodología', async () => {
    const sequenceJson = {
      0: {
        blockIndex: 0,
        blockName: 'Bloque 1: Ecuaciones',
        hours: 18,
        sessions: [
          {
            sessionNum: 1,
            totalSessions: 18,
            phase: 'Apertura',
            title: 'Sesión 1: Problematización Inicial',
            teachingActivity: 'Presenta el caso',
            learningActivity: 'Identifica variables',
            evidence: 'Tabla de datos',
          },
        ],
      },
    };

    const docxBuffer = await generateSecuenciaDocx(mockContent, sequenceJson);
    expect(docxBuffer).toBeInstanceOf(Buffer);
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);
  });

  it('renderWorkbookToPdf debe reflejar el badge [Metodología: ABProblemas] en el PDF del libro', async () => {
    const mockMission: MissionSection = {
      missionIndex: 1,
      title: 'Misión 1: Ecuaciones Hídricas y Modelado de Recursos Comunitarios',
      coveredSessions: [1, 2],
      sessionTopic: 'Ecuaciones Lineales',
      sessionFocus: 'Modelado de gasto y caudal de agua potable en la comunidad',
      phenomenonHook: {
        story: 'En la junta auxiliar local el tandeo de agua requiere calcular tiempos de llenado de cisternas.',
        detonatingQuestion: '¿Cómo modelar el caudal para distribuir equitativamente el agua?',
      },
      conceptZero: {
        physicalAnalogy: 'El flujo de agua es análogo a la velocidad de llenado en función del tiempo.',
        coreExplanation: 'La ecuación lineal de primer grado modela la relación entre volumen y tiempo.',
        narrativeExplanation: 'Las variables dependientes e independientes representan magnitudes físicas medibles.',
        solvedExample: {
          problemStatement: 'Calcular el tiempo de llenado con caudal constante de 5 litros por segundo.',
          solutionSteps: ['Paso 1: Identificar caudal Q', 'Paso 2: Calcular tiempo t = V / Q'],
          interpretation: 'Se requieren 200 segundos para completar el llenado.',
        },
        contrastTable: [
          {
            correctConcept: 'El caudal es la razón de cambio del volumen respecto al tiempo.',
            commonMisconception: 'Confundir volumen con caudal acumulado.',
            reasoning: 'El caudal es flujo por unidad temporal.',
          },
        ],
      },
      iDoSection: {
        stepByStepDemo: 'El docente modela el despeje algebraico paso a paso en el pizarrón.',
      },
      weDoSection: {
        guidedPractice: 'En parejas resuelven el cálculo de caudal para tres tanques comunitarios.',
        workbookElements: [],
      },
      youDoSection: {
        autonomousPractice: 'Resuelve individualmente el desafío de optimización del tandeo.',
        challengeLevel: 'Intermedio',
      },
    } as unknown as MissionSection;

    const mockWorkbook = {
      id: 'wb-test-1',
      planningId: 'plan-1',
      blockIndex: 0,
      blockName: 'Pensamiento Matemático y Resolución de Problemas',
      version: 1,
      subsystem: 'bge',
      targetPages: 10,
      totalPages: 10,
      totalWords: 3000,
      generatedAt: new Date().toISOString(),
      qualityScore: 95,
      qualityWarning: false,
      coverData: {
        title: 'Pensamiento Matemático II',
        subtitle: 'Cuaderno Activo',
        subjectName: 'Pensamiento Matemático II',
        semester: 2,
        blockNumber: 1,
        teacherName: 'Prof. Pedro Ramírez',
        schoolName: 'Bachillerato General Oficial Puebla',
        cct: '21EBH0100A',
        paecProjectName: 'Cuidado del Agua Comunitaria',
      },
      tableOfContents: [
        { missionIndex: 1, title: 'Misión 1: Ecuaciones Hídricas', sessionsRange: '1-2', pageEstimate: 5 },
      ],
      missions: [mockMission],
      projectSection: {
        title: 'Manual de Ahorro Hídrico',
        communityUtility: 'Distribución justa en la localidad',
        phases: [
          { name: 'Fase 1: Diagnóstico', description: 'Levantamiento de necesidades' },
          { name: 'Fase 2: Modelado', description: 'Cálculo de balances' },
        ],
      },
      evaluationSection: {
        rubric: {
          criteria: [
            {
              name: 'Modelado Algebraico',
              excellent: 'Preciso y sin errores',
              good: 'Errores mínimos',
              acceptable: 'Con apoyo',
              insufficient: 'Sin resolver',
            },
          ],
        },
      },
    } as unknown as ActiveWorkTextbook;

    const mockPlanning: Planning = {
      id: 'plan-1',
      teacherId: 'teacher-1',
      uacName: 'Pensamiento Matemático II',
      semester: 2,
      component: 'fundamental',
      curriculumName: 'MCCEMS NEM',
      paecContext: 'Cuidado del Agua Comunitaria',
      extractedData: null,
      contentJson: mockContent,
      metodologiaActiva: 'abproblemas',
      status: 'generated',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeInstanceOf(Buffer);

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();

    // Verificación de badge en carátula y tablas
    expect(parsed.text).toContain('[Metodología: ABProblemas]');
  });
});
