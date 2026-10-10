import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  drawProcessFlowBanner,
  extractProcessFlowSteps,
} from '@/lib/visual-engine/process-flow-renderer';
import * as processFlowRenderer from '@/lib/visual-engine/process-flow-renderer';
import * as pdfComponents from '@/lib/visual-engine/pdf-components';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ProcessFlowStep, ProjectPhase, ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

describe('Widget Process Flow Banner 100% Offline — Renderizado, Extractor y Anti-F11 (Fase 4)', () => {
  it('retorna opts.y sin dibujar cuando steps es vacío o < 2 (Degradación D9)', () => {
    const doc = new jsPDF();
    const y1 = drawProcessFlowBanner(doc, [], {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });
    expect(y1).toBe(20);

    const singleStep: ProcessFlowStep[] = [
      { stepNumber: 1, title: 'Solo un paso' },
    ];
    const y2 = drawProcessFlowBanner(doc, singleStep, {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });
    expect(y2).toBe(20);
  });

  it('extrae etapas deterministamente desde ProjectPhase[] y string[] de ejecución', () => {
    const mockPhases: ProjectPhase[] = [
      {
        phaseNum: 1,
        title: 'Fase 1: Diagnóstico técnico y diseño',
        allocatedHours: 2,
        deliverables: ['Boceto'],
        instructions: 'Levantamiento',
      },
      {
        phaseNum: 2,
        title: 'Fase 2: Ensamble del circuito',
        allocatedHours: 4,
        deliverables: ['Placa'],
        instructions: 'Soldadura',
      },
      {
        phaseNum: 3,
        title: 'Fase 3: Pruebas y calibración',
        allocatedHours: 3,
        deliverables: ['Reporte'],
        instructions: 'Mediciones',
      },
    ];

    const steps = extractProcessFlowSteps(mockPhases);
    expect(steps).toHaveLength(3);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].title).toBe('Diagnóstico técnico...');
    expect(steps[0].subtitle).toBe('2 hrs');
    expect(steps[1].stepNumber).toBe(2);
    expect(steps[1].title).toBe('Ensamble del circuito');

    // Extracción desde strings numerados
    const stringSteps = [
      '1. Planificación y acopio de materiales',
      '2. Diagramación del circuito esquemático',
      '3. Pruebas de continuidad con multímetro',
    ];
    const stepsFromString = extractProcessFlowSteps(stringSteps);
    expect(stepsFromString).toHaveLength(3);
    expect(stepsFromString[0].stepNumber).toBe(1);

    // Si tiene < 2 pasos -> debe retornar [] activando D9
    expect(extractProcessFlowSteps([])).toHaveLength(0);
    expect(extractProcessFlowSteps(['1. Único paso'])).toHaveLength(0);
  });

  it('renderiza banner con geometría vectorial offline (flechas, nodos) y sanitización WinAnsi estricta', () => {
    const doc = new jsPDF();
    const ensureVerticalSpaceMock = vi.fn((_d, curY, neededH) => {
      return curY + neededH > 260 ? 20 : curY;
    });

    const mockSteps: ProcessFlowStep[] = [
      { stepNumber: 1, title: 'Diagnóstico', subtitle: '2 hrs' },
      { stepNumber: 2, title: 'Diseño CAD', subtitle: '3 hrs' },
      { stepNumber: 3, title: 'Prototipado', subtitle: '4 hrs' },
      { stepNumber: 4, title: 'Validación', subtitle: '2 hrs' },
    ];

    const roundedRectSpy = vi.spyOn(doc, 'roundedRect');
    const circleSpy = vi.spyOn(doc, 'circle');
    const lineSpy = vi.spyOn(doc, 'line');
    const triangleSpy = vi.spyOn(doc, 'triangle');
    const textSpy = vi.spyOn(doc, 'text');

    const nextY = drawProcessFlowBanner(doc, mockSteps, {
      margin: 15,
      drawWidth: 180,
      y: 35,
      pageHeight: 279,
      bannerTitle: 'Ruta de Desarrollo del Proyecto',
      ensureVerticalSpace: ensureVerticalSpaceMock,
    });

    expect(nextY).toBeGreaterThan(35);

    // Paginación atómica invocada una vez para el bloque completo
    expect(ensureVerticalSpaceMock).toHaveBeenCalledTimes(1);

    // Contenedor principal + 4 píldoras de nodos = 5 roundedRects
    expect(roundedRectSpy).toHaveBeenCalledTimes(5);

    // 4 círculos con números
    expect(circleSpy).toHaveBeenCalledTimes(4);

    // 3 flechas vectoriales entre los 4 nodos (línea + triángulo)
    expect(lineSpy).toHaveBeenCalledTimes(3);
    expect(triangleSpy).toHaveBeenCalledTimes(3);

    // Verificación WinAnsi estricta (Lección F-24):
    // Ningún texto enviado a doc.text debe contener emojis o caracteres fuera de WinAnsi
    const allRenderedText = textSpy.mock.calls.map(c => String(c[0]));
    expect(allRenderedText.some(t => t.includes('✓'))).toBe(false);
    expect(allRenderedText.some(t => t.includes('💡'))).toBe(false);
    expect(allRenderedText.some(t => t.includes('RUTA DE DESARROLLO DEL PROYECTO'))).toBe(true);
    expect(allRenderedText.some(t => t.includes('Diagnóstico'))).toBe(true);
  });

  it('PRUEBA DE MUTACIÓN ANTI-F11: renderWorkbookToPdf y renderWorkbookToDocx DEBEN invocar el Process Flow Banner cuando el proyecto tiene fases', async () => {
    const mockPlanning = {
      id: 'plan-flow-1',
      title: 'Taller de Prototipado Electrónico',
      subject: 'Sistemas Embebidos',
      subsystem: 'bt',
      semester: 'Cuarto',
      targetGrade: 4,
      school: 'CECyTE Tepeaca',
      schoolId: 'cct-04',
      paecName: 'Automatización Comunitaria',
      teacherId: 'prof-04',
      progressionSummary: 'Diseño de PCB y microcontroladores',
      unitOrBlock: 'Bloque II',
      problematicContext: 'Monitoreo de pozo de agua',
      transversalTheme: 'Internet de las Cosas',
    } as unknown as Planning;

    const mockWorkbook = {
      id: 'wb-flow-1',
      planningId: 'plan-flow-1',
      coverData: {
        title: 'Cuaderno de Trabajo Activo',
        subtitle: 'Bachillerato Tecnológico',
        subjectName: 'Sistemas Embebidos',
        schoolName: 'CECyTE Tepeaca',
        semester: 4,
        blockNumber: 2,
        teacherName: 'Docente Titular',
        paecProjectName: 'Proyecto Pozo Comunitario',
      },
      missions: [],
      projectSection: {
        artifactName: 'Medidor Ultrasónico de Nivel',
        communityUtility: 'Monitoreo hídrico de la comunidad',
        learningObjectives: ['IoT y Telemetría'],
        requiredMaterials: [],
        phases: [
          {
            phaseNum: 1,
            title: 'Fase 1: Diagnóstico de la cisterna',
            allocatedHours: 2,
            deliverables: ['Medidas físicas'],
            instructions: 'Inspeccionar el tanque',
          },
          {
            phaseNum: 2,
            title: 'Fase 2: Ensamble del microcontrolador',
            allocatedHours: 4,
            deliverables: ['Circuito funcional'],
            instructions: 'Conectar ESP32 y sensor',
          },
          {
            phaseNum: 3,
            title: 'Fase 3: Pruebas de campo y calibración',
            allocatedHours: 3,
            deliverables: ['Telemetría enviada'],
            instructions: 'Verificar envío de datos',
          },
        ],
        technicalSpecs: ['Sensor HC-SR04'],
        acceptanceCriteria: ['Lectura continua cada 5 segundos'],
      },
      evaluationSection: {
        rubric: [],
        checklist: [],
      },
    } as unknown as ActiveWorkTextbook;

    // Spies anti-F11
    const bannerSpy = vi.spyOn(pdfComponents, 'drawProcessFlowBanner');
    const docxExtractorSpy = vi.spyOn(processFlowRenderer, 'extractProcessFlowSteps');

    // 1. PDF Consumer check
    const pdfBuffer = await renderWorkbookToPdf(
      mockWorkbook,
      mockPlanning,
      { forceFallbackCover: true }
    );

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);
    // Aserción Anti-F11 (PDF): Si el consumer de PDF no llama al banner, falla inmediatamente
    expect(bannerSpy).toHaveBeenCalledTimes(1);

    // 2. DOCX Consumer check
    docxExtractorSpy.mockClear();
    const docxBuffer = await renderWorkbookToDocx(
      mockWorkbook,
      mockPlanning,
      { coverBuffer: undefined }
    );

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);
    // Aserción Anti-F11 (DOCX): Si el consumer de DOCX deja de extraer etapas, falla inmediatamente
    expect(docxExtractorSpy).toHaveBeenCalled();
  }, 30000);
});
