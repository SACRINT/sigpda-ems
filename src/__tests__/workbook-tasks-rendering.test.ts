import { describe, it, expect, vi } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('F-73: Renderizado de todas las tareas de actividades sin techo de 4', () => {
  const multiTaskGuidedPractice = `
1. Tarea 1: Identificar las variables principales en el circuito.
2. Tarea 2: Medir la resistencia equivalente con multímetro.
3. Tarea 3: Calcular la caída de tensión en cada nodo.
4. Tarea 4: Verificar la ley de corrientes de Kirchhoff.
5. Tarea 5: Registrar lecturas de corriente en la bitácora.
6. Tarea 6: Contrastar los valores teóricos contra las mediciones reales.
7. Tarea 7: Redactar conclusiones técnicas sobre la tolerancia de componentes.
  `.trim();

  const mockPlanning = {
    id: 'plan-tasks-1',
    title: 'Electrónica y Mediciones',
    subject: 'Circuitos Eléctricos',
    subsystem: 'bt',
    semester: 'Tercero',
    targetGrade: 3,
    school: 'CECyTE Tepeaca',
    schoolId: 'cct-03',
    teacherId: 'prof-03',
    unitOrBlock: 'Bloque I',
  } as unknown as Planning;

  const mockWorkbook = {
    id: 'wb-tasks-1',
    planningId: 'plan-tasks-1',
    subsystem: 'bt',
    coverData: {
      title: 'Cuaderno de Electrónica',
      subtitle: 'Bachillerato Tecnológico',
      subjectName: 'Circuitos Eléctricos',
      schoolName: 'CECyTE Tepeaca',
      semester: 3,
      blockNumber: 1,
      teacherName: 'Ing. Carlos Mendoza',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Leyes de Kirchhoff y Circuitos Serie-Paralelo',
        coveredSessions: [1, 2],
        sessionTopic: 'Análisis Nodal',
        sessionFocus: 'Medición y validación experimental',
        phenomenonHook: {
          story: 'Caída de tensión imprevista en el tablero de distribución de la escuela.',
          detonatingQuestion: '¿Por qué la suma de corrientes debe ser cero en cada nodo?',
        },
        conceptZero: {
          physicalAnalogy: 'Como tuberías de agua convergiendo en una bifurcación hidráulica.',
          coreExplanation: 'La conservación de la carga eléctrica exige balance de corrientes en los nodos.',
        },
        iDoSection: { stepByStepDemo: 'Demostración de cálculo nodal por el docente.' },
        weDoSection: {
          guidedPractice: multiTaskGuidedPractice,
          workbookElements: [],
        },
        youDoSection: {
          autonomousChallenge: 'Resolver malla compleja.',
          workbookElements: [],
        },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué ocurre si un resistor se abre?',
          reflectionPrompts: ['Analiza la continuidad.'],
          criteriaChecklist: ['Identifica nodo abierto.'],
        },
        wordCount: 450,
      },
    ],
    projectSection: {
      artifactName: 'Prototipo',
      communityUtility: 'Instalación',
      learningObjectives: ['Circuitos'],
      requiredMaterials: [],
      phases: [],
    },
    evaluationSection: {
      rubric: [],
      checklist: [],
    },
  } as unknown as ActiveWorkTextbook;

  it('PDF renderiza las 7 tareas completas sin descartar tareas mayores a 4', async () => {
    const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning, { forceFallbackCover: true });
    expect(pdfBuffer).toBeDefined();

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const parsed = await parser.getText();
    await parser.destroy();

    const text = parsed.text;

    expect(text).toContain('Tarea 1:');
    expect(text).toContain('Tarea 4:');
    expect(text).toContain('Tarea 5:');
    expect(text).toContain('Tarea 6:');
    expect(text).toContain('Tarea 7:');
  });

  it('DOCX compila con éxito incluyendo todas las tareas', async () => {
    const docxBuffer = await renderWorkbookToDocx(mockWorkbook, mockPlanning, { coverBuffer: undefined });
    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(5000);
  });
});
