import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { drawStepCardGrid } from '@/lib/visual-engine/step-card-renderer';
import * as pdfComponents from '@/lib/visual-engine/pdf-components';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { LabStepCard, ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

describe('Widget Step-Cards Grid — Renderizado y Prueba de Mutación Anti-F11', () => {
  it('retorna opts.y sin dibujar cuando cards es vacío', () => {
    const doc = new jsPDF();
    const y = drawStepCardGrid(doc, [], {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });
    expect(y).toBe(20);
  });

  it('renderiza tarjetas de laboratorio en cuadrícula 2 columnas con paginación atómica', () => {
    const doc = new jsPDF();
    const ensureVerticalSpaceMock = vi.fn((_d, curY, neededH) => {
      // Si excede la página, simula salto
      return curY + neededH > 260 ? 20 : curY;
    });

    const mockCards: LabStepCard[] = [
      {
        stepNumber: 1,
        title: 'Preparar Dataset',
        actionDescription: 'Cargar dependencias y verificar librerías.',
        codeSnippet: '$ pip install pandas\nimport pandas as pd',
        expectedOutput: 'Bibliotecas listas',
        tipOrNote: 'Verifica la versión de Python',
      },
      {
        stepNumber: 2,
        title: 'Limpieza de Nulos',
        actionDescription: 'Eliminar filas con campos críticos vacíos.',
        codeSnippet: 'df = df.dropna()',
        expectedOutput: 'DataFrame sin nulos',
      },
      {
        stepNumber: 3,
        title: 'Validación de Tipos',
        actionDescription: 'Comprobar tipos de datos de cada columna.',
        codeSnippet: 'print(df.dtypes)',
      },
    ];

    const fillSpy = vi.spyOn(doc, 'setFillColor');
    const circleSpy = vi.spyOn(doc, 'circle');

    const nextY = drawStepCardGrid(doc, mockCards, {
      margin: 15,
      drawWidth: 180,
      y: 30,
      pageHeight: 279,
      ensureVerticalSpace: ensureVerticalSpaceMock,
    });

    expect(nextY).toBeGreaterThan(30);
    // Debe haber invocado ensureVerticalSpace para cada fila (2 filas para 3 tarjetas)
    expect(ensureVerticalSpaceMock).toHaveBeenCalledTimes(2);

    // Debe haber dibujado badges circulares azules (#2563EB = [37, 99, 235])
    expect(fillSpy).toHaveBeenCalledWith(37, 99, 235);
    expect(circleSpy).toHaveBeenCalledTimes(3);

    // Debe haber dibujado cajas de salida verde (#ECFDF5 = [236, 253, 245])
    expect(fillSpy).toHaveBeenCalledWith(236, 253, 245);

    // Debe haber dibujado caja de tip (#FEF3C7 = [254, 243, 199])
    expect(fillSpy).toHaveBeenCalledWith(254, 243, 199);
  });

  it('PRUEBA DE MUTACIÓN ANTI-F11: renderWorkbookToPdf DEBE invocar drawStepCardGrid cuando el protocolo contiene >= 3 pasos', async () => {
    const mockPlanning = {
      id: 'plan-step-grid-1',
      title: 'Taller de Automatización',
      subject: 'Programación',
      subsystem: 'bt',
      semester: 'Tercero',
      targetGrade: 3,
      school: 'CECyTE Tepeaca',
      schoolId: 'cct-02',
      paecName: 'Automatización y Machine Learning',
      teacherId: 'prof-02',
      progressionSummary: 'Preprocesamiento de datos',
      unitOrBlock: 'Bloque II',
      problematicContext: 'Limpieza de datos tabulares',
      transversalTheme: 'Ciencia de Datos',
    } as unknown as Planning;

    const mockWorkbook = {
      id: 'wb-step-grid-1',
      planningId: 'plan-step-grid-1',
      coverData: {
        title: 'Cuaderno de Trabajo Activo',
        subtitle: 'Bachillerato Tecnológico',
        subjectName: 'Programación',
        schoolName: 'CECyTE Tepeaca',
        semester: 3,
        blockNumber: 2,
        teacherName: 'Docente Titular',
        paecProjectName: 'Proyecto Machine Learning',
      },
      missions: [
        {
          missionIndex: 1,
          title: 'Práctica de Laboratorio 3: Protocolo Técnico',
          coveredSessions: [1, 2],
          sessionTopic: 'Pipeline de Datos',
          sessionFocus: 'Procedimientos y Algoritmos',
          phenomenonHook: {
            story: 'Problema en la captura de sensores',
            detonatingQuestion: '¿Cómo asegurar la integridad de la señal?',
          },
          conceptZero: {
            physicalAnalogy: 'Filtro de agua en tres etapas',
            coreExplanation: 'El pipeline procesa secuencialmente cada etapa de limpieza.',
          },
          iDoSection: {
            stepByStepDemo: `
1. Inicializar el entorno: Conectar cables y energizar placa.
$ python main.py
Salida: Sistema conectado.

2. Cargar dependencias: Importar módulos del sensor.
import sensor_lib
Nota: Revisar puerto COM.

3. Adquirir muestras: Tomar lecturas continuas.
lecturas = sensor_lib.read()
Resultado: 100 lecturas almacenadas.
            `.trim(),
          },
          weDoSection: {
            guidedPractice: 'Práctica guiada en equipo',
            workbookElements: [],
          },
          youDoSection: {
            autonomousChallenge: 'Reto autónomo',
            workbookElements: [],
          },
          troubleshooting: [],
          formativeCheckpoint: {
            question: '¿Por qué es crítico calibrar el sensor?',
            reflectionPrompts: ['Analiza la precisión'],
            criteriaChecklist: ['Protocolo verificado'],
          },
          wordCount: 500,
        },
      ],
      projectSection: {
        artifactName: 'Sensor Calibrado',
        communityUtility: 'Medición ambiental comunitaria',
        learningObjectives: ['Calibración de instrumentos'],
        requiredMaterials: [],
        phases: [],
      },
      evaluationSection: {
        rubric: [],
        checklist: [],
      },
    } as unknown as ActiveWorkTextbook;

    const stepGridSpy = vi.spyOn(pdfComponents, 'drawStepCardGrid');

    // 1. PDF
    const pdfBuffer = await renderWorkbookToPdf(
      mockWorkbook,
      mockPlanning,
      { forceFallbackCover: true }
    );

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);

    // Asersión Anti-F11: Si la llamada al widget se desconecta o muta a false, este test falla inmediatamente
    expect(stepGridSpy).toHaveBeenCalledTimes(1);

    // 2. DOCX Parity check: el renderizador DOCX debe generar el buffer sin errores conteniendo el grid
    const docxBuffer = await renderWorkbookToDocx(
      mockWorkbook,
      mockPlanning,
      { coverBuffer: undefined }
    );

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);
  });
});
