import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('F-72: Portada PAEC multilínea completa sin truncado', () => {
  it('renderiza el título completo del PAEC de 3 líneas en la portada sin cortarlo a la primera línea', async () => {
    const longPaecName =
      'Construcción de un Huerto Escolar Comunitario Sustentable para la Seguridad Alimentaria y Mitigación del Rezago Nutricional en Estudiantes de la Sierra Norte de Puebla';

    const mockPlanning = {
      id: 'plan-paec-cover-1',
      title: 'Ciencias Naturales y Desarrollo Comunitario',
      subject: 'Biología y Ecosistemas',
      subsystem: 'bge',
      semester: 'Segundo',
      targetGrade: 2,
      school: 'Bachillerato General Emiliano Zapata',
      schoolId: 'cct-paec-01',
      paecName: longPaecName,
      teacherId: 'prof-paec-01',
      progressionSummary: 'Ciclos biogeoquímicos y soberanía alimentaria',
      unitOrBlock: 'Bloque I',
    } as unknown as Planning;

    const mockWorkbook = {
      id: 'wb-paec-cover-1',
      planningId: 'plan-paec-cover-1',
      subsystem: 'bge',
      blockName: 'Ecosistemas y Soberanía Alimentaria',
      blockIndex: 0,
      coverData: {
        title: 'Cuaderno de Trabajo Activo',
        subtitle: 'Bachillerato General Estatal',
        subjectName: 'Biología y Ecosistemas',
        schoolName: 'Bachillerato General Emiliano Zapata',
        semester: 2,
        blockNumber: 1,
        teacherName: 'Mtro. Fernando Ramos',
        paecProjectName: longPaecName,
      },
      missions: [
        {
          missionIndex: 1,
          title: 'Misión 1: Balance de Nutrientes en Sustratos',
          coveredSessions: [1, 2],
          sessionTopic: 'Compostaje y Fertilidad',
          sessionFocus: 'Descomposición aerobia de materia orgánica',
          phenomenonHook: {
            story: 'Observación de parcelas escolares con diferente rendimiento de cultivo.',
            detonatingQuestion: '¿Por qué la composta orgánica retiene más humedad que el suelo erosionado?',
          },
          conceptZero: {
            physicalAnalogy: 'Como una esponja porosa que atrapa microgotas de agua.',
            coreExplanation: 'La materia orgánica aumenta la capacidad de intercambio catiónico del sustrato.',
          },
          iDoSection: { stepByStepDemo: 'Demostración de preparación de composta.' },
          weDoSection: { guidedPractice: 'Medición de pH en muestras de suelo.', workbookElements: [] },
          youDoSection: { autonomousChallenge: 'Propuesta de mezcla de sustrato.', workbookElements: [] },
          troubleshooting: [],
          formativeCheckpoint: {
            question: '¿Qué microorganismos intervienen en la fase termófila?',
            reflectionPrompts: ['Analiza la temperatura del sustrato.'],
            criteriaChecklist: ['El alumno identifica bacterias aerobias.'],
          },
          wordCount: 400,
        },
      ],
      projectSection: {
        artifactName: 'Cama de Cultivo',
        communityUtility: 'Producción de hortalizas',
        learningObjectives: ['Soberanía alimentaria'],
        requiredMaterials: [],
        phases: [],
      },
      evaluationSection: {
        rubric: [],
        checklist: [],
      },
    } as unknown as ActiveWorkTextbook;

    const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(10000);

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();

    const text = parsed.text;

    // Verificar que partes del inicio, mitad y final del texto largo de 3 líneas aparezcan en el PDF
    expect(text).toContain('PROYECTO ESCOLAR COMUNITARIO (PAEC)');
    expect(text).toContain('Construcción de un Huerto Escolar');
    expect(text).toContain('Seguridad Alimentaria');
    expect(text).toContain('Sierra Norte de Puebla');
  });
});
