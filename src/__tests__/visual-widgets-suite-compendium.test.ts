import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import * as pdfComponents from '@/lib/visual-engine/pdf-components';
import * as conceptCardRenderer from '@/lib/visual-engine/concept-card-renderer';
import * as processFlowRenderer from '@/lib/visual-engine/process-flow-renderer';
import * as labStepParser from '@/lib/guide-engine/lab-step-parser';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

describe('Suite Visual Completa — Compendio Piloto y Coexistencia de 4 Widgets (Fase 5)', () => {
  const mockPlanning = {
    id: 'plan-suite-compendium-1',
    title: 'Automatización y Sistemas Embebidos',
    subject: 'Mecatrónica y Control',
    subsystem: 'bt',
    semester: 'Cuarto',
    targetGrade: 4,
    school: 'CECyTE Plantel Tepeaca',
    schoolId: 'cct-pue-04',
    paecName: 'Monitoreo de Infraestructura Hídrica',
    teacherId: 'docente-01',
    progressionSummary: 'Diseño e instrumentación de sensores IoT',
    unitOrBlock: 'Bloque II',
    problematicContext: 'Monitoreo automatizado de pozos de agua',
    transversalTheme: 'Sostenibilidad Ambiental',
  } as unknown as Planning;

  const mockFullWorkbook: ActiveWorkTextbook = {
    id: 'wb-suite-compendium-1',
    planningId: 'plan-suite-compendium-1',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Bachillerato Tecnológico',
      subjectName: 'Mecatrónica y Control',
      schoolName: 'CECyTE Plantel Tepeaca',
      semester: 4,
      blockNumber: 2,
      teacherName: 'Ing. Supervisor de Taller',
      paecProjectName: 'Red de Telemetría Hídrica',
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Control de Nivel por Sensor',
        coveredSessions: [1, 2],
        sessionTopic: 'Sensores de Distancia',
        sessionFocus: 'Telemetría Digital',
        phenomenonHook: {
          story: 'Fuga inadvertida en el tanque elevado municipal.',
          detonatingQuestion: '¿Cómo prevenir el desperdicio con medición ultrasónica?',
        },
        // Widget 3: Concept Cards Source
        conceptZero: {
          physicalAnalogy: 'Un eco en un cañón montañoso permite estimar la distancia a la pared.',
          coreExplanation: 'El sensor emite un pulso sónico y calcula la distancia según el tiempo de vuelo de la onda reflejada.',
        },
        iDoSection: {
          stepByStepDemo:
            '1. Inicializar el sensor: Conectar cables y energizar placa.\n' +
            'Salida: Sistema conectado.\n\n' +
            '2. Cargar dependencias: Configurar pines GPIO.\n' +
            'Nota: Revisar conexion.\n\n' +
            '3. Adquirir muestras: Tomar lecturas continuas.\n' +
            'Resultado: 100 lecturas almacenadas.',
        },
        // Widget 1: Dark IDE Code Block Source
        weDoSection: {
          guidedPractice: 'Práctica guiada en equipo',
          workbookElements: [
            {
              type: 'code_box',
              language: 'python',
              code: 'import time\nimport machine\n\ndef measure_distance():\n    trigger = machine.Pin(12, machine.Pin.OUT)\n    echo = machine.Pin(14, machine.Pin.IN)\n    return 42.5\n',
              explanation: 'Función determinista de lectura de pulso sónico',
            },
          ],
        },
        youDoSection: {
          autonomousChallenge: 'Reto autónomo de calibración',
          workbookElements: [],
        },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué precisión se obtiene?',
          reflectionPrompts: ['Analiza la dispersión de mediciones'],
          criteriaChecklist: ['Tolerancia menor a 1%'],
        },
        wordCount: 850,
      },
    ],
    // Widget 4: Process Flow Banner Source
    projectSection: {
      artifactName: 'Estación de Telemetría Ultrasónica',
      communityUtility: 'Monitoreo de almacenamiento de agua comunitaria',
      learningObjectives: ['Instrumentación', 'IoT'],
      requiredMaterials: [],
      phases: [
        {
          phaseNum: 1,
          title: 'Fase 1: Diagnóstico de la cisterna',
          allocatedHours: 2,
          deliverables: ['Plano de cotas'],
          instructions: 'Medición física del depósito',
        },
        {
          phaseNum: 2,
          title: 'Fase 2: Ensamble del circuito',
          allocatedHours: 4,
          deliverables: ['PCB montada'],
          instructions: 'Soldadura de componentes',
        },
        {
          phaseNum: 3,
          title: 'Fase 3: Calibración y pruebas',
          allocatedHours: 3,
          deliverables: ['Reporte de campo'],
          instructions: 'Validación de lecturas',
        },
      ],
      technicalSpecs: ['Sensor HC-SR04', 'ESP32'],
      acceptanceCriteria: ['Transmisión cada 10 segundos'],
    },
    evaluationSection: {
      rubric: [],
      checklist: [],
    },
  } as unknown as ActiveWorkTextbook;

  it('coexistencia e invocación de los 4 widgets simultáneamente en renderWorkbookToPdf y renderWorkbookToDocx', async () => {
    // 1. Configuración de espías anti-F11 para la suite completa
    const darkIdeSpy = vi.spyOn(pdfComponents, 'drawDarkIdeCodeBlock');
    const stepGridSpy = vi.spyOn(pdfComponents, 'drawStepCardGrid');
    const conceptGridSpy = vi.spyOn(pdfComponents, 'drawConceptCardsGrid');
    const processBannerSpy = vi.spyOn(pdfComponents, 'drawProcessFlowBanner');

    const docxConceptSpy = vi.spyOn(conceptCardRenderer, 'extractConceptCardsFromMission');
    const docxProcessSpy = vi.spyOn(processFlowRenderer, 'extractProcessFlowSteps');
    const docxStepSpy = vi.spyOn(labStepParser, 'parseLabStepsFromProse');

    // 2. Renderizado PDF del compendio completo
    const pdfBuffer = await renderWorkbookToPdf(
      mockFullWorkbook,
      mockPlanning,
      { forceFallbackCover: true }
    );

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(5000);

    // Verificación de invocación de los 4 widgets en el pipeline PDF
    expect(darkIdeSpy).toHaveBeenCalled();
    expect(stepGridSpy).toHaveBeenCalled();
    expect(conceptGridSpy).toHaveBeenCalled();
    expect(processBannerSpy).toHaveBeenCalled();

    // 3. Renderizado DOCX del compendio completo
    docxConceptSpy.mockClear();
    docxProcessSpy.mockClear();
    docxStepSpy.mockClear();

    const docxBuffer = await renderWorkbookToDocx(
      mockFullWorkbook,
      mockPlanning,
      { coverBuffer: undefined }
    );

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(5000);

    // Verificación de invocación de los extractores deterministas en DOCX
    expect(docxConceptSpy).toHaveBeenCalled();
    expect(docxProcessSpy).toHaveBeenCalled();
    expect(docxStepSpy).toHaveBeenCalled();
  }, 45000);

  it('degradación canónica D9 armónica cuando los widgets carecen de datos suficientes', async () => {
    const doc = new jsPDF();
    const noopEnsureSpace = vi.fn((_d, curY) => curY);

    // Widget 2: Sin pasos (D9 canónico)
    const y2 = pdfComponents.drawStepCardGrid(
      doc,
      [],
      { margin: 15, drawWidth: 180, y: 40, pageHeight: 279, ensureVerticalSpace: noopEnsureSpace }
    );
    expect(y2).toBe(40);

    // Widget 3: Menos de 2 conceptos (< 2 activa D9)
    const y3 = pdfComponents.drawConceptCardsGrid(
      doc,
      [{ title: 'Único concepto', description: 'Desc' }],
      { margin: 15, drawWidth: 180, y: 50, pageHeight: 279, ensureVerticalSpace: noopEnsureSpace }
    );
    expect(y3).toBe(50);

    // Widget 4: Menos de 2 etapas (< 2 activa D9)
    const y4 = pdfComponents.drawProcessFlowBanner(
      doc,
      [{ stepNumber: 1, title: 'Única fase' }],
      { margin: 15, drawWidth: 180, y: 60, pageHeight: 279, ensureVerticalSpace: noopEnsureSpace }
    );
    expect(y4).toBe(60);
  });
});
