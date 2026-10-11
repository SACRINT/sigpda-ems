import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  drawConceptCardsGrid,
  extractConceptCardsFromMission,
  cleanConceptCardDescription,
} from '@/lib/visual-engine/concept-card-renderer';
import * as conceptCardRenderer from '@/lib/visual-engine/concept-card-renderer';
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

  it('H-7: clampLinesWithEllipsis recorta con "..." y respeta textos que ya caben', () => {
    const lines = ['uno', 'dos', 'tres', 'cuatro', 'cinco'];
    expect(conceptCardRenderer.clampLinesWithEllipsis(lines, 10)).toEqual(lines);
    const clipped = conceptCardRenderer.clampLinesWithEllipsis(lines, 3);
    expect(clipped).toHaveLength(3);
    expect(clipped[2]).toBe('tres...');
  });

  it('H-7: con una tarjeta de >200 palabras usa ancho completo y la altura no excede la página útil', () => {
    const doc = new jsPDF();
    const longText = Array.from({ length: 900 }, (_, i) => `termino${i}`).join(' ');
    const roundedRectSpy = vi.spyOn(doc, 'roundedRect');
    const pageHeight = 279;
    const margin = 15;
    const cards: ConceptCardItem[] = [
      { title: 'Analogía Intuitiva', badge: 'ANALOGÍA', description: 'Breve analogía cotidiana del fenómeno.' },
      { title: 'Fundamento Central', badge: 'CONCEPTO', description: longText },
      { title: 'Criterio de Aplicación', badge: 'APLICACIÓN', description: 'Criterio observable y verificable.' },
    ];

    drawConceptCardsGrid(doc, cards, {
      margin,
      drawWidth: 180,
      y: 30,
      pageHeight,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });

    // Chasis exteriores: roundedRect(x, y, w, h, rx, ry, 'FD'). Ancho completo (180) y altura <= página útil.
    const chassis = roundedRectSpy.mock.calls.filter((c) => c[6] === 'FD' && Number(c[2]) > 100);
    expect(chassis.length).toBe(3);
    for (const call of chassis) {
      expect(Number(call[2])).toBeCloseTo(180, 0);
      expect(Number(call[3])).toBeLessThanOrEqual(pageHeight - margin * 2);
    }
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

    // Aserción Anti-F11 (PDF): Si la llamada al widget se desconecta o muta a false, este test falla inmediatamente
    expect(conceptGridSpy).toHaveBeenCalledTimes(1);

    // 2. DOCX Parity & Anti-F11 check: el consumer DOCX DEBE invocar extractConceptCardsFromMission (F-31)
    const docxExtractorSpy = vi.spyOn(conceptCardRenderer, 'extractConceptCardsFromMission');

    const docxBuffer = await renderWorkbookToDocx(
      mockWorkbook,
      mockPlanning,
      { coverBuffer: undefined }
    );

    expect(docxBuffer).toBeDefined();
    expect(docxBuffer.byteLength).toBeGreaterThan(1000);
    expect(docxExtractorSpy).toHaveBeenCalled();
  });

  it('F-71: renderiza descripción completa de 15 líneas y ejemplo de 6+ líneas sin truncar', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const textSpy = vi.spyOn(doc, 'text');

    // Construir una descripción de 15 líneas
    const fifteenLineDesc = Array.from(
      { length: 15 },
      (_, i) => `Línea explicativa ${i + 1} del principio fundamental de conservación y balance.`
    ).join(' ');

    const sixLineExample = Array.from(
      { length: 6 },
      (_, i) => `Paso experimental ${i + 1} para calibrar la balanza analítica en el laboratorio.`
    ).join(' ');

    const cards: ConceptCardItem[] = [
      {
        title: 'Principio Extendido de Conservación',
        badge: 'CONCEPTO',
        description: fifteenLineDesc,
        example: sixLineExample,
      },
      {
        title: 'Segundo Concepto de Acompañamiento',
        badge: 'APLICACIÓN',
        description: 'Descripción complementaria para cumplir con el mínimo de 2 tarjetas.',
      },
    ];

    const nextY = drawConceptCardsGrid(doc, cards, {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });

    expect(nextY).toBeGreaterThan(20);

    // Verificar que todas las llamadas a doc.text incluyan las líneas de la descripción larga
    const allRenderedText = textSpy.mock.calls.map(c => {
      const arg = c[0];
      return Array.isArray(arg) ? arg.join('\n') : String(arg);
    }).join('\n');

    expect(allRenderedText).toContain('Línea explicativa 1');
    expect(allRenderedText).toContain('Línea explicativa 10');
    expect(allRenderedText).toContain('Línea explicativa 15');
    expect(allRenderedText).toContain('Paso experimental 1');
    expect(allRenderedText).toContain('experimental 6');
  });

  it('REG-8: cleanConceptCardDescription y drawConceptCardsGrid eliminan bloques de tabla markdown y pipes', () => {
    const rawWithTable = [
      'Explicación introductoria del concepto de proporcionalidad directa.',
      '<!--workbook:table:cols=Aspecto Cotidiano,Concepto Técnico Formal,Función en el Problema-->',
      '| Aspecto Cotidiano | Concepto Técnico Formal | Función en el Problema |',
      '|-------------------|-------------------------|------------------------|',
      '| Presupuesto total asignado | Término independiente | Valor inicial |',
      '| Costo unitario por hora | Pendiente de la recta | Tasa de cambio |',
      'Conclusión sintética del modelo en el contexto comunitario.',
    ].join('\n');

    const cleaned = cleanConceptCardDescription(rawWithTable);
    expect(cleaned).not.toContain('|');
    expect(cleaned).not.toContain('Aspecto Cotidiano');
    expect(cleaned).not.toContain('workbook:table');
    expect(cleaned).toContain('Explicación introductoria del concepto de proporcionalidad directa');
    expect(cleaned).toContain('Conclusión sintética del modelo en el contexto comunitario');

    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const textSpy = vi.spyOn(doc, 'text');

    const cards: ConceptCardItem[] = [
      {
        title: 'Modelo Matemático',
        badge: 'CONCEPTO',
        description: rawWithTable,
      },
      {
        title: 'Criterio de Validación',
        badge: 'APLICACIÓN',
        description: 'Verificar coherencia entre las variables medidas en la comunidad.',
      },
    ];

    drawConceptCardsGrid(doc, cards, {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: vi.fn((_d, curY) => curY),
    });

    const allRendered = textSpy.mock.calls
      .map((c) => (Array.isArray(c[0]) ? c[0].join('\n') : String(c[0])))
      .join('\n');

    expect(allRendered).not.toContain('|');
    expect(allRendered).not.toContain('Aspecto Cotidiano');
    expect(allRendered).toContain('Explicación introductoria');
  });
});

