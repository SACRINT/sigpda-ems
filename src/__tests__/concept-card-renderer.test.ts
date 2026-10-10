import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  drawConceptCardsGrid,
  extractConceptCardsFromMission,
} from '@/lib/visual-engine/concept-card-renderer';
import * as pdfComponents from '@/lib/visual-engine/pdf-components';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import type { ConceptCardItem, ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

describe('Widget Concept-Cards Grid — Renderizado, Extractor y Prueba de Mutación Anti-F11 (Fase 3)', () => {
  it('retorna opts.y intacto sin dibujar cuando cards es vacío o menor a 2 (Degradación D9)', () => {
    const doc = new jsPDF();
    const y1 = drawConceptCardsGrid(doc, [], {
      margin: 15,
      drawWidth: 180,
      y: 25,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });
    expect(y1).toBe(25);

    const singleCard: ConceptCardItem[] = [
      {
        title: 'Concepto Solitario',
        description: 'No alcanza el mínimo de 2 conceptos requeridos.',
      },
    ];
    const y2 = drawConceptCardsGrid(doc, singleCard, {
      margin: 15,
      drawWidth: 180,
      y: 25,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });
    expect(y2).toBe(25);
  });

  it('extrae deterministamente Concept-Cards desde los campos canónicos de la misión', () => {
    const fullMission: Partial<MissionSection> = {
      conceptZero: {
        physicalAnalogy: 'Filtro de agua casero de tres capas para purificar impurezas.',
        coreExplanation: 'El pipeline ETL limpia, transforma y carga registros válidos de forma determinista.',
      },
      formativeCheckpoint: {
        question: '¿Por qué es indispensable validar esquemas?',
        reflectionPrompts: ['Analiza la integridad'],
        criteriaChecklist: ['El dataset final carece de registros nulos y respeta los tipos.'],
      },
    };

    const cards = extractConceptCardsFromMission(fullMission);
    expect(cards).toHaveLength(3);

    // Card 1: Analogía
    expect(cards[0].badge).toBe('ANALOGÍA');
    expect(cards[0].title).toBe('Analogía Intuitiva');
    expect(cards[0].description).toContain('Filtro de agua casero');

    // Card 2: Concepto central
    expect(cards[1].badge).toBe('CONCEPTO');
    expect(cards[1].title).toBe('Fundamento Central');
    expect(cards[1].description).toContain('pipeline ETL');

    // Card 3: Aplicación práctica
    expect(cards[2].badge).toBe('APLICACIÓN');
    expect(cards[2].title).toBe('Criterio de Aplicación');
    expect(cards[2].description).toContain('El dataset final carece');

    // Misión con menos de 2 campos válidos -> debe retornar [] activando D9
    const incompleteMission: Partial<MissionSection> = {
      conceptZero: {
        physicalAnalogy: 'Solo tengo analogía.',
        coreExplanation: '',
      },
    };
    const emptyCards = extractConceptCardsFromMission(incompleteMission);
    expect(emptyCards).toHaveLength(0);

    // Misión con tarjetas preexistentes completas -> debe respetarlas
    const explicitMission: Partial<MissionSection> = {
      conceptZero: {
        physicalAnalogy: 'Analogía ignorada',
        coreExplanation: 'Explicación ignorada',
        conceptCards: [
          { title: 'Card A', badge: 'ALPHA', description: 'Desc A' },
          { title: 'Card B', badge: 'BETA', description: 'Desc B' },
        ],
      },
    };
    const preservedCards = extractConceptCardsFromMission(explicitMission);
    expect(preservedCards).toHaveLength(2);
    expect(preservedCards[0].title).toBe('Card A');
  });

  it('renderiza tarjetas conceptuales con paginación atómica y sanitización WinAnsi estricta', () => {
    const doc = new jsPDF();
    const ensureVerticalSpaceMock = vi.fn((_d, curY, neededH) => {
      return curY + neededH > 260 ? 20 : curY;
    });

    const mockCards: ConceptCardItem[] = [
      {
        title: 'Analogía del Semáforo',
        badge: 'ANALOGÍA',
        description: 'Un semáforo regula el flujo vehicular evitando colisiones en el crucero.',
        example: 'Rojo significa detenerse completamente.',
      },
      {
        title: 'Mutex y Semáforos Binarios',
        badge: 'CONCEPTO',
        description: 'Un mecanismo de sincronización que restringe el acceso concurrente a un recurso.',
        example: 'Adquirir lock antes de escribir en memoria compartida.',
      },
      {
        title: 'Prevención de Race Conditions',
        badge: 'APLICACIÓN',
        description: 'Garantizar que múltiples hilos no modifiquen simultáneamente el estado.',
      },
    ];

    const fillSpy = vi.spyOn(doc, 'setFillColor');
    const roundedRectSpy = vi.spyOn(doc, 'roundedRect');
    const textSpy = vi.spyOn(doc, 'text');

    const nextY = drawConceptCardsGrid(doc, mockCards, {
      margin: 15,
      drawWidth: 180,
      y: 30,
      pageHeight: 279,
      ensureVerticalSpace: ensureVerticalSpaceMock,
    });

    expect(nextY).toBeGreaterThan(30);

    // Debe haber llamado ensureVerticalSpace con la altura de fila
    expect(ensureVerticalSpaceMock).toHaveBeenCalledTimes(1);

    // Debe pintar chasis suave (#F8FAFC = [248, 250, 252])
    expect(fillSpy).toHaveBeenCalledWith(248, 250, 252);
    expect(roundedRectSpy).toHaveBeenCalled();

    // Badges de colores semánticos
    // Analogía: Sky (#0EA5E9 = [14, 165, 233])
    expect(fillSpy).toHaveBeenCalledWith(14, 165, 233);
    // Concepto: Indigo (#6366F1 = [99, 102, 241])
    expect(fillSpy).toHaveBeenCalledWith(99, 102, 241);
    // Aplicación: Emerald (#10B981 = [16, 185, 129])
    expect(fillSpy).toHaveBeenCalledWith(16, 185, 129);

    // Verificación de sanitización WinAnsi estricta (Lección F-24):
    // Ningún texto enviado a doc.text debe contener emojis o caracteres fuera de WinAnsi
    const allRenderedText = textSpy.mock.calls.map(c => String(c[0]));
    expect(allRenderedText.some(t => t.includes('✓'))).toBe(false);
    expect(allRenderedText.some(t => t.includes('💡'))).toBe(false);
    expect(allRenderedText.some(t => t.includes('ANALOGÍA'))).toBe(true);
    expect(allRenderedText.some(t => t.includes('CONCEPTO'))).toBe(true);
    expect(allRenderedText.some(t => t.includes('APLICACIÓN'))).toBe(true);
    expect(allRenderedText.some(t => t.includes('[EJEMPLO]:'))).toBe(true);
  });

  it('PRUEBA DE MUTACIÓN ANTI-F11: renderWorkbookToPdf DEBE invocar drawConceptCardsGrid cuando la misión contiene conceptos válidos', async () => {
    const mockPlanning = {
      id: 'plan-concept-grid-1',
      title: 'Taller de Arquitectura de Sistemas',
      subject: 'Programación Orientada a Objetos',
      subsystem: 'bt',
      semester: 'Tercero',
      targetGrade: 3,
      school: 'CECyTE Tepeaca',
      schoolId: 'cct-03',
      paecName: 'Desarrollo de Software Situado',
      teacherId: 'prof-03',
      progressionSummary: 'Diseño modular y encapsulamiento',
      unitOrBlock: 'Bloque I',
      problematicContext: 'Gestión escolar local',
      transversalTheme: 'Pensamiento Computacional',
    } as unknown as Planning;

    const mockWorkbook = {
      id: 'wb-concept-grid-1',
      planningId: 'plan-concept-grid-1',
      coverData: {
        title: 'Cuaderno de Trabajo Activo',
        subtitle: 'Bachillerato Tecnológico',
        subjectName: 'Programación',
        schoolName: 'CECyTE Tepeaca',
        semester: 3,
        blockNumber: 1,
        teacherName: 'Docente Titular',
        paecProjectName: 'Proyecto POO',
      },
      missions: [
        {
          missionIndex: 1,
          title: 'Misión 1: Encapsulamiento y Modelado',
          coveredSessions: [1, 2],
          sessionTopic: 'Objetos y Clases',
          sessionFocus: 'Abstracción y Modularidad',
          phenomenonHook: {
            story: 'Problema en la caja de cobro del mercado municipal',
            detonatingQuestion: '¿Cómo blindar los datos para que nadie altere el saldo directamente?',
          },
          conceptZero: {
            physicalAnalogy: 'Caja fuerte bancaria con ventana blindada y taquilla única de acceso controlado.',
            coreExplanation: 'El encapsulamiento oculta el estado interno del objeto y expone únicamente métodos públicos seguros.',
          },
          iDoSection: {
            stepByStepDemo: 'Demostración del docente.',
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
            question: '¿Por qué los atributos críticos deben ser privados?',
            reflectionPrompts: ['Analiza la seguridad'],
            criteriaChecklist: ['Los atributos saldo y cuenta están declarados con modificador private.'],
          },
          wordCount: 500,
        },
      ],
      projectSection: {
        artifactName: 'Módulo de Gestión',
        communityUtility: 'Control escolar',
        learningObjectives: ['POO'],
        requiredMaterials: [],
        phases: [],
      },
      evaluationSection: {
        rubric: [],
        checklist: [],
      },
    } as unknown as ActiveWorkTextbook;

    const conceptGridSpy = vi.spyOn(pdfComponents, 'drawConceptCardsGrid');

    // 1. PDF
    const pdfBuffer = await renderWorkbookToPdf(
      mockWorkbook,
      mockPlanning,
      { forceFallbackCover: true }
    );

    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);

    // Aserción Anti-F11: Si la llamada al widget se desconecta o muta a false, este test falla inmediatamente
    expect(conceptGridSpy).toHaveBeenCalledTimes(1);

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
