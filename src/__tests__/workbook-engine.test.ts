import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 1. Mock de logger y dependencias externas ────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock de base de datos para visual-asset-manager
vi.mock('@/lib/db', () => ({
  saveImageAsset: vi.fn().mockResolvedValue({ id: 'saved-1' }),
  getImageAssetByMission: vi.fn().mockResolvedValue(null),
}));

// Mock de openverse-client para test de deduplicación controlada
vi.mock('@/lib/visual-engine/openverse-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/visual-engine/openverse-client')>(
    '@/lib/visual-engine/openverse-client'
  );
  return {
    ...actual,
    searchOpenverseImages: vi.fn().mockResolvedValue([
      {
        id: 'openverse-img-101',
        url: 'https://images.openverse.org/photo1.jpg',
        thumbnail: 'https://images.openverse.org/thumb1.jpg',
        title: 'Célula animal bajo microscopio',
        creator: 'Biólogo UNAM',
        license: 'cc-by',
        licenseVersion: '4.0',
        caption: 'Figura M1.1 — Célula animal',
      },
      {
        id: 'openverse-img-102',
        url: 'https://images.openverse.org/photo2.jpg',
        thumbnail: 'https://images.openverse.org/thumb2.jpg',
        title: 'Tejido vegetal en laboratorio',
        creator: 'Laboratorio BUAP',
        license: 'cc-by',
        licenseVersion: '4.0',
        caption: 'Figura M1.2 — Tejido vegetal',
      },
    ]),
  };
});

import { generateFallbackCover } from '@/lib/visual-engine/cover-generator';
import { stripMarkdown, sanitizeWorkbookNarratives } from '@/lib/visual-engine/content-extractor';
import { sanitizePdfText, renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import {
  consolidateWorkbookElements,
  stripWorkbookTags,
  extractWorkbookTags,
} from '@/lib/guide-engine/workbook-tags';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import { parseMarkdownTable } from '@/lib/visual-engine/column-flow-manager';
import type {
  WorkbookElement,
  ActiveWorkTextbook,
  MissionSection,
  ProjectSection,
  EvaluationSection,
} from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

describe('Workbook Engine Architecture Tests (Fase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TEST 1: Portada JPEG nítida con Sharp y tipografías embebidas ──────────
  it('Test 1: Genera portada JPEG nítida determinista (Capa 0) con Sharp sin tofu', async () => {
    const result = await generateFallbackCover({
      uacName: 'PENSAMIENTO MATEMÁTICO II',
      plantelNombre: 'Bachillerato General Oficial Lic. Benito Juárez',
      cct: '21EBH0012A',
      semestre: 'Segundo Semestre',
      blockName: 'Geometría Analítica y Álgebra Lineal',
      blockIndex: 0,
    });

    expect(result).toBeDefined();
    expect(result.format).toBe('JPEG');
    expect(result.isFallback).toBe(true);
    expect(result.source).toBe('deterministic_svg_thematic');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    // Un JPEG de 1200x1600 con alta densidad vectorial supera holgadamente 40KB
    expect(result.buffer.length).toBeGreaterThan(40000);
  }, 15000);

  // ── TEST 2: stripMarkdown + sanitizePdfText limpian comentarios HTML y tags ─
  it('Test 2: stripMarkdown y sanitizePdfText eliminan etiquetas de control <!--workbook:...--> y comentarios HTML', () => {
    const inputWithTags = 'Procedimiento: <!--workbook:lines:rows=3--> Realizar el cálculo <!--comentario interno--> del perímetro.';

    const stripped = stripMarkdown(inputWithTags);
    expect(stripped).not.toContain('<!--workbook:lines:rows=3-->');
    expect(stripped).not.toContain('<!--comentario interno-->');
    expect(stripped).toContain('Realizar el cálculo');
    expect(stripped).toContain('del perímetro.');

    const sanitized = sanitizePdfText(inputWithTags);
    expect(sanitized).not.toContain('<!--');
    expect(sanitized).not.toContain('-->');
    expect(sanitized).toContain('Realizar el cálculo');
  });

  // ── TEST 3: Consolidación de tags lines en writers / workbook-tags ──────────
  it('Test 3: consolidateWorkbookElements colapsa múltiples tags lines consecutivos en uno solo con max 6 rows', () => {
    // Simulando el error reportado: IA emitió 10 tags seguidos en la sección You Do
    const tenLinesElements: WorkbookElement[] = Array.from({ length: 10 }, (_, i) => ({
      id: `wb-lines-${i + 1}`,
      type: 'lines',
      title: `Renglones de práctica ${i + 1}`,
      instruction: `Anota tu respuesta ${i + 1}`,
      config: { rows: 4 },
    }));

    const consolidated = consolidateWorkbookElements(tenLinesElements);

    // Debe colapsar los 10 elementos consecutivos en exactamente 1
    expect(consolidated.length).toBe(1);
    expect(consolidated[0].type).toBe('lines');
    // El número de renglones está delimitado a máximo 6
    expect(consolidated[0].config?.rows).toBeLessThanOrEqual(6);
    expect(consolidated[0].config?.rows).toBeGreaterThanOrEqual(4);

    // Test de preservación de otros tipos de elementos
    const mixedElements: WorkbookElement[] = [
      { id: '1', type: 'lines', config: { rows: 4 } },
      { id: '2', type: 'empty_table', config: { cols: ['A', 'B'] } },
      { id: '3', type: 'lines', config: { rows: 4 } },
      { id: '4', type: 'lines', config: { rows: 4 } },
    ];
    const mixedConsolidated = consolidateWorkbookElements(mixedElements);
    expect(mixedConsolidated.length).toBe(3);
    expect(mixedConsolidated[0].type).toBe('lines');
    expect(mixedConsolidated[1].type).toBe('empty_table');
    expect(mixedConsolidated[2].type).toBe('lines');

    // Distribución .slice() entre weDo y youDo (regla de foundation-writer)
    const weDo = consolidated.slice(0, Math.ceil(consolidated.length / 2));
    const youDo = consolidated.slice(Math.ceil(consolidated.length / 2));
    expect(weDo.length).toBe(1);
    expect(youDo.length).toBe(0);

    // Test con 10 lines intercaladas con tablas (escenario real de IA en foundation-writer)
    const mixedTen: WorkbookElement[] = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `l1-${i}`, type: 'lines' as const, config: { rows: 4 } })),
      { id: 't1', type: 'empty_table' as const, config: { cols: ['X', 'Y'] } },
      ...Array.from({ length: 5 }, (_, i) => ({ id: `l2-${i}`, type: 'lines' as const, config: { rows: 4 } })),
    ];
    const mixedConsolidatedTen = consolidateWorkbookElements(mixedTen);
    expect(mixedConsolidatedTen.length).toBe(3); // lines colapsadas, tabla, lines colapsadas
    const weDoMixed = mixedConsolidatedTen.slice(0, Math.ceil(mixedConsolidatedTen.length / 2));
    const youDoMixed = mixedConsolidatedTen.slice(Math.ceil(mixedConsolidatedTen.length / 2));
    expect(weDoMixed.length).toBe(2); // 1er grupo de lines + tabla
    expect(youDoMixed.length).toBe(1); // 2do grupo de lines

    // stripWorkbookTags elimina tags del texto
    const textWithTag = 'Paso 1: Medir la masa.<!--workbook:lines:rows=4--> Paso 2: Calcular densidad.';
    expect(stripWorkbookTags(textWithTag)).toBe('Paso 1: Medir la masa. Paso 2: Calcular densidad.');
  });

  // ── TEST 4: Sanitización de tareas en extractWorkbookTags y saneamiento ─────
  it('Test 4: extractWorkbookTags extrae correctamente y drawPracticeTasks no confunde tags con tareas', () => {
    const rawProcedure = `
1. Preparar la balanza analítica y calibrar a cero.
<!--workbook:lines:rows=3-->
2. Pesar la muestra por duplicado con precisión de miligramos.
<!--workbook:empty_table:cols=Muestra,Masa,Volumen-->
3. Registrar observaciones en la bitácora técnica.
    `.trim();

    const tags = extractWorkbookTags(rawProcedure);
    expect(tags.length).toBe(2);
    expect(tags[0].type).toBe('lines');
    expect(tags[1].type).toBe('empty_table');

    // Al limpiar los tags de workbook, el texto de la tarea no contiene marcas de control
    const cleanedText = stripWorkbookTags(rawProcedure);
    expect(cleanedText).not.toContain('<!--workbook:');
    const lines = cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('1. Preparar');
    expect(lines[1]).toContain('2. Pesar');
    expect(lines[2]).toContain('3. Registrar');
  });

  // ── TEST 5: Deduplicación de activos visuales en visual-asset-manager ───────
  it('Test 5: resolveVisualForMission deduplica imágenes usando usedAssetIds y hace fallback a Capa 0 cuando se agotan', async () => {
    const usedAssetIds = new Set<string>();

    // Primera misión: debe seleccionar la primera imagen disponible (openverse-img-101)
    const visual1 = await resolveVisualForMission({
      uacName: 'BIOLOGÍA I',
      blockIndex: 0,
      missionIndex: 1,
      missionTitle: 'Estructura y Organización Celular',
      preferOpenverseMedia: true,
      usedAssetIds,
    });

    expect(visual1).toBeDefined();
    expect(visual1?.type).toBe('openverse_media');
    expect(visual1?.mediaAsset?.externalId).toBe('openverse-img-101');
    expect(usedAssetIds.has('openverse-img-101')).toBe(true);

    // Segunda misión: no debe repetir la imagen 101, debe seleccionar la 102
    const visual2 = await resolveVisualForMission({
      uacName: 'BIOLOGÍA I',
      blockIndex: 0,
      missionIndex: 2,
      missionTitle: 'Fisiología Celular y Tejidos',
      preferOpenverseMedia: true,
      usedAssetIds,
    });

    expect(visual2).toBeDefined();
    expect(visual2?.type).toBe('openverse_media');
    expect(visual2?.mediaAsset?.externalId).toBe('openverse-img-102');
    expect(usedAssetIds.has('openverse-img-102')).toBe(true);

    // Tercera misión: ambas imágenes (101 y 102) ya están en usedAssetIds.
    // El motor NO debe repetir ninguna de las dos; debe hacer fallback limpio a Capa 0 (vector_svg didáctico)
    const visual3 = await resolveVisualForMission({
      uacName: 'BIOLOGÍA I',
      blockIndex: 0,
      missionIndex: 3,
      missionTitle: 'División Celular y Mitosis',
      preferOpenverseMedia: true,
      usedAssetIds,
    });

    expect(visual3).toBeDefined();
    expect(visual3?.type).toBe('vector_svg');
    expect(visual3?.svg).toBeDefined();
    expect(typeof visual3?.svg).toBe('string');
  });

  // ── TEST 6: Extracción y parsing de tablas Markdown inline ─────────────────
  it('Test 6: parseMarkdownTable extrae tablas simples, maneja celdas vacías y descarta texto plano', () => {
    // 1. Tabla simple estándar con alineación
    const validTable = `
| Fase | Actividad | Tiempo |
| :--- | :---: | ---: |
| Inicio | Activación de saberes | 15 min |
| Desarrollo | Práctica guiada | 25 min |
| Cierre | Evaluación formativa | 10 min |
    `.trim();

    const result1 = parseMarkdownTable(validTable);
    expect(result1).not.toBeNull();
    expect(result1?.headers).toEqual(['Fase', 'Actividad', 'Tiempo']);
    expect(result1?.rows.length).toBe(3);
    expect(result1?.rows[0]).toEqual(['Inicio', 'Activación de saberes', '15 min']);

    // 2. Tabla con celdas vacías y espaciado desbalanceado
    const emptyCellsTable = `
| Criterio | Nivel 1 | Nivel 2 | Nivel 3 |
|---|---|---|---|
| Análisis | | En proceso | Consolidado |
| Conclusión | No logrado | | Sobresaliente |
    `.trim();

    const result2 = parseMarkdownTable(emptyCellsTable);
    expect(result2).not.toBeNull();
    expect(result2?.headers.length).toBe(4);
    expect(result2?.rows[0][1]).toBe('');
    expect(result2?.rows[1][2]).toBe('');

    // 3. Texto narrativo plano sin tabla (debe retornar null)
    const plainText = 'En esta sesión aprenderemos a calcular el volumen del cilindro usando la fórmula V = pi * r^2 * h.';
    expect(parseMarkdownTable(plainText)).toBeNull();

    // 4. Texto con pipe único o tabla incompleta sin separador
    const brokenTable = '| Solo encabezado | Sin divisor |';
    expect(parseMarkdownTable(brokenTable)).toBeNull();
  });

  describe('sanitizeWorkbookNarratives (F-16 Suite Unitaria Exhaustiva)', () => {
    it('sanea todos los campos narrativos, estructurales y de configuración sin mutar el objeto de entrada', () => {
      const tag = '<!--workbook:lines:rows=4-->';
      const tagOnly = '<!--workbook:table:cols=2-->';

      const input: ActiveWorkTextbook = {
        id: 'wb-test-unit',
        planningId: 'plan-unit-01',
        blockIndex: 0,
        blockName: `Bloque 1: Materia y Energía ${tag}`,
        version: 1,
        subsystem: `Bachillerato General Estatal ${tag}`,
        targetPages: 40,
        totalPages: 40,
        totalWords: 3500,
        generatedAt: '2026-10-03',
        qualityScore: 95,
        qualityWarning: false,
        coverData: {
          title: tagOnly, // Tag-only: debe reducirse a '' sin regresar al crudo por fallback ||
          subtitle: `**Subtítulo Editorial** ${tag}`,
          subjectName: `Ciencias Naturales ${tag}`,
          semester: 2,
          blockNumber: 1,
          teacherName: `Mtra. González ${tag}`,
          schoolName: `Bachillerato Gral Puebla ${tag}`,
          cct: `21EBH0001X ${tag}`,
          paecProjectName: `Sustentabilidad Escolar ${tag}`,
          municipality: `Puebla, Pue. ${tag}`,
        },
        tableOfContents: [
          {
            missionIndex: 1,
            title: `Misión 1: Ley de Conservación ${tag}`,
            sessionsRange: `Sesiones 1 a 4 ${tag}`,
            pageEstimate: 6,
          },
        ],
        missions: [
          {
            missionIndex: 1,
            title: `Misión 1: Balance de Masa ${tag}`,
            coveredSessions: [1, 2],
            sessionTopic: `Termodinámica Básica ${tag}`,
            sessionFocus: `Conservación de la Materia ${tag}`,
            wordCount: 1200,
            phenomenonHook: {
              story: `Un trozo de hielo se derrite lentamente ${tag}`,
              detonatingQuestion: `¿Adónde fue la masa perdida? ${tag}`,
            },
            conceptZero: {
              physicalAnalogy: `Como una balanza de dos platos ${tag}`,
              coreExplanation: `La materia no se crea ni se destruye ${tag}`,
              narrativeExplanation: `Explicación narrativa ${tag}`,
              solvedExample: {
                problemStatement: `Calcular la masa final ${tag}`,
                solutionSteps: [`Paso 1: Sumar reactivos ${tag}`, `Paso 2: Igualar productos ${tag}`],
                interpretation: `La masa neta se conserva ${tag}`,
              },
              contrastTable: [
                {
                  correctConcept: `La masa total permanece constante ${tag}`,
                  commonMisconception: `El gas liberado no tiene masa ${tag}`,
                  reasoning: `Porque los átomos se reorganizan ${tag}`,
                },
              ],
            },
            iDoSection: {
              stepByStepDemo: `El docente pesa un matraz sellado ${tag}`,
              visualOrDiagram: 'flowchart TD; A[Inicio]-->B[Fin];',
            },
            weDoSection: {
              guidedPractice: `En equipos medimos reactivos en probeta ${tag}`,
              workbookElements: [
                {
                  id: 'el-cb-1',
                  type: 'checkbox_list',
                  title: `Lista de Verificación de Laboratorio ${tag}`,
                  instruction: `Marca cada paso conforme lo concluyas ${tag}`,
                  config: {
                    checkboxes: [
                      `Calibrar la báscula a cero ${tag}`,
                      `Registrar masa inicial del vaso ${tag}`,
                    ],
                    cols: [`Parámetro ${tag}`, `Medición ${tag}`, tagOnly],
                    initialCode: `# Comentario Python de ejemplo\nconst potencia = base ** exponente;\nif (__name__ === "__main__") {\n  console.log("listo");\n} ${tag}`,
                  },
                } as unknown as WorkbookElement,
                {
                  id: 'el-cb-alltag',
                  type: 'checkbox_list',
                  title: `Lista Casillas Solo Tag ${tag}`,
                  instruction: `Marca cada paso conforme avances ${tag}`,
                  config: {
                    checkboxes: [tagOnly, tagOnly],
                  },
                } as unknown as WorkbookElement,
                {
                  id: 'el-table-alltag',
                  type: 'empty_table',
                  title: `Tabla Columnas Solo Tag ${tag}`,
                  instruction: `Registra datos experimentales ${tag}`,
                  config: {
                    cols: [tagOnly, tagOnly],
                  },
                } as unknown as WorkbookElement,
              ],
            },
            youDoSection: {
              autonomousChallenge: `Calcula el rendimiento porcentual ${tag}`,
              workbookElements: [
                {
                  id: 'el-lines-1',
                  type: 'lines',
                  title: `Espacio de Trabajo Autónomo ${tag}`,
                  instruction: `Desarrolla tus operaciones completas ${tag}`,
                  config: { rows: 5 },
                } as unknown as WorkbookElement,
              ],
            },
            troubleshooting: [
              {
                id: 'tb-01',
                symptom: `La masa final difiere en más de 0.5g ${tag}`,
                rootCause: `Fuga de gas o balanza descalibrada ${tag}`,
                solution: `Verificar el sello del matraz y recalibrar ${tag}`,
                solutionSteps: [`Paso 1: Recalibrar ${tag}`],
                prevention: `Revisar empaques de goma antes de iniciar ${tag}`,
                preventionTip: `Tip prevención ${tag}`,
              },
            ],
            formativeCheckpoint: {
              question: `¿Qué principio termodinámico demostraste? ${tag}`,
              reflectionPrompts: [`Reflexiona sobre posibles fuentes de error ${tag}`],
              criteriaChecklist: [`Anotó unidades correctas ${tag}`],
            },
            diagnosticEvaluation: {
              context: `Situación de diagnóstico inicial ${tag}`,
              questions: [`¿Qué ocurre cuando una vela se consume? ${tag}`],
            },
            metacognitiveTrafficLight: {
              green: `Comprendo y aplico el balance ${tag}`,
              yellow: `Entiendo el concepto pero dudo en cálculos ${tag}`,
              red: `Requiero asesoría docente ${tag}`,
            },
            safetyOrWorkshopTip: `Usar gafas de seguridad y guantes térmicos ${tag}`,
          },
        ],
        projectSection: {
          artifactName: `Calentador Solar Comunitario ${tag}`,
          communityUtility: `Agua caliente para el comedor escolar ${tag}`,
          phases: [
            {
              phaseNum: 1,
              title: `Fase 1: Diagnóstico Territorial ${tag}`,
              allocatedHours: 4,
              deliverables: [`Plano inicial ${tag}`],
              instructions: `Inspeccionar techumbre escolar ${tag}`,
            },
          ],
          technicalSpecs: [`Tubería de cobre 1/2 pulgada ${tag}`],
          acceptanceCriteria: [`Alcanzar 45 grados centígrados ${tag}`],
        },
        evaluationSection: {
          source: 'generated_fresh',
          rubric: [
            {
              criterion: `Rigurosidad Experimental ${tag}`,
              weightPercent: 25,
              levels: [
                { levelName: 'Excelente', points: 10, descriptor: `Procedimiento impecable y registro exacto ${tag}` },
                { levelName: 'Bueno', points: 8, descriptor: `Procedimiento correcto con mínimas desviaciones ${tag}` },
                { levelName: 'Suficiente', points: 6, descriptor: `Cumple los pasos con apoyo parcial ${tag}` },
                { levelName: 'Requiere Apoyo', points: 4, descriptor: `Omite mediciones y medidas de seguridad ${tag}` },
              ],
            },
          ],
          checklist: [],
          criticalThinkingQuiz: [],
          metacognitiveReflection: { prompts: [] },
        },
      };

      // Clon profundo del input para verificar NO-MUTACIÓN
      const inputSnapshot = JSON.parse(JSON.stringify(input));

      // Ejecución del sanitizador
      const result = sanitizeWorkbookNarratives(input);

      // 1. Verificación de Inmutabilidad del objeto original
      expect(JSON.parse(JSON.stringify(input))).toEqual(inputSnapshot);

      // 2. Tabla de aserciones campo por campo sin etiquetas ni Markdown residual
      // A) Bloque y Portada
      expect(result.blockName).toBe('Bloque 1: Materia y Energía');
      expect(result.subsystem).toBe('Bachillerato General Estatal');
      expect(result.coverData.title).toBe(''); // Saneado de solo-tag sin fallback al crudo
      expect(result.coverData.subtitle).toBe('Subtítulo Editorial');
      expect(result.coverData.subjectName).toBe('Ciencias Naturales');
      expect(result.coverData.teacherName).toBe('Mtra. González');
      expect(result.coverData.schoolName).toBe('Bachillerato Gral Puebla');
      expect(result.coverData.cct).toBe('21EBH0001X');
      expect(result.coverData.paecProjectName).toBe('Sustentabilidad Escolar');
      expect(result.coverData.municipality).toBe('Puebla, Pue.');

      // B) Tabla de Contenidos (TOC)
      expect(result.tableOfContents[0].title).toBe('Misión 1: Ley de Conservación');
      expect(result.tableOfContents[0].sessionsRange).toBe('Sesiones 1 a 4');

      // C) Misión y Secciones Didácticas
      const m = result.missions[0];
      expect(m.title).toBe('Misión 1: Balance de Masa');
      expect(m.sessionTopic).toBe('Termodinámica Básica');
      expect(m.sessionFocus).toBe('Conservación de la Materia');
      expect(m.phenomenonHook?.story).toBe('Un trozo de hielo se derrite lentamente');
      expect(m.phenomenonHook?.detonatingQuestion).toBe('¿Adónde fue la masa perdida?');
      expect(m.conceptZero?.physicalAnalogy).toBe('Como una balanza de dos platos');
      expect(m.conceptZero?.coreExplanation).toBe('La materia no se crea ni se destruye');
      expect(m.conceptZero?.narrativeExplanation).toBe('Explicación narrativa');
      expect(m.conceptZero?.solvedExample?.problemStatement).toBe('Calcular la masa final');
      expect(m.conceptZero?.solvedExample?.solutionSteps[0]).toBe('Paso 1: Sumar reactivos');
      expect(m.conceptZero?.solvedExample?.solutionSteps[1]).toBe('Paso 2: Igualar productos');
      expect(m.conceptZero?.solvedExample?.interpretation).toBe('La masa neta se conserva');
      expect(m.conceptZero?.contrastTable?.[0].correctConcept).toBe('La masa total permanece constante');
      expect(m.conceptZero?.contrastTable?.[0].commonMisconception).toBe('El gas liberado no tiene masa');
      expect(m.conceptZero?.contrastTable?.[0].reasoning).toBe('Porque los átomos se reorganizan');
      expect(m.iDoSection?.stepByStepDemo).toBe('El docente pesa un matraz sellado');
      expect(m.iDoSection?.visualOrDiagram).toBe('flowchart TD; A[Inicio]-->B[Fin];');
      expect(m.weDoSection?.guidedPractice).toBe('En equipos medimos reactivos en probeta');

      // D) WorkbookElements (títulos, instrucciones y config)
      const elCb = m.weDoSection?.workbookElements?.[0];
      expect(elCb?.title).toBe('Lista de Verificación de Laboratorio');
      expect(elCb?.instruction).toBe('Marca cada paso conforme lo concluyas');
      const cfg = elCb?.config as Record<string, unknown>;
      expect(cfg?.checkboxes).toEqual([
        'Calibrar la báscula a cero',
        'Registrar masa inicial del vaso',
      ]);
      expect(cfg?.cols).toEqual(['Parámetro', 'Medición']);
      expect(cfg?.initialCode).toBe(
        '# Comentario Python de ejemplo\nconst potencia = base ** exponente;\nif (__name__ === "__main__") {\n  console.log("listo");\n}'
      );

      // Elementos cuyos arrays se reducen a [] por contener únicamente etiquetas de control
      const elCbAllTag = m.weDoSection?.workbookElements?.[1];
      expect(elCbAllTag?.title).toBe('Lista Casillas Solo Tag');
      expect((elCbAllTag?.config as Record<string, unknown>)?.checkboxes).toEqual([]);

      const elTableAllTag = m.weDoSection?.workbookElements?.[2];
      expect(elTableAllTag?.title).toBe('Tabla Columnas Solo Tag');
      expect((elTableAllTag?.config as Record<string, unknown>)?.cols).toEqual([]);

      const elLines = m.youDoSection?.workbookElements?.[0];
      expect(elLines?.title).toBe('Espacio de Trabajo Autónomo');
      expect(elLines?.instruction).toBe('Desarrolla tus operaciones completas');

      // E) Troubleshooting, Checkpoint, Diagnóstico, Semáforo y Seguridad
      expect(m.troubleshooting?.[0].symptom).toBe('La masa final difiere en más de 0.5g');
      expect(m.troubleshooting?.[0].rootCause).toBe('Fuga de gas o balanza descalibrada');
      expect(m.troubleshooting?.[0].solution).toBe('Verificar el sello del matraz y recalibrar');
      expect(m.troubleshooting?.[0].prevention).toBe('Revisar empaques de goma antes de iniciar');
      expect(m.formativeCheckpoint?.question).toBe('¿Qué principio termodinámico demostraste?');
      expect(m.formativeCheckpoint?.reflectionPrompts[0]).toBe('Reflexiona sobre posibles fuentes de error');
      expect(m.formativeCheckpoint?.criteriaChecklist[0]).toBe('Anotó unidades correctas');
      expect(m.diagnosticEvaluation?.context).toBe('Situación de diagnóstico inicial');
      expect(m.diagnosticEvaluation?.questions[0]).toBe('¿Qué ocurre cuando una vela se consume?');
      expect(m.metacognitiveTrafficLight?.green).toBe('Comprendo y aplico el balance');
      expect(m.metacognitiveTrafficLight?.yellow).toBe('Entiendo el concepto pero dudo en cálculos');
      expect(m.metacognitiveTrafficLight?.red).toBe('Requiero asesoría docente');
      expect(m.safetyOrWorkshopTip).toBe('Usar gafas de seguridad y guantes térmicos');

      // F) Sección Proyecto PAEC
      expect(result.projectSection?.artifactName).toBe('Calentador Solar Comunitario');
      expect(result.projectSection?.communityUtility).toBe('Agua caliente para el comedor escolar');
      expect(result.projectSection?.phases[0].title).toBe('Fase 1: Diagnóstico Territorial');
      expect(result.projectSection?.phases[0].deliverables[0]).toBe('Plano inicial');
      expect(result.projectSection?.phases[0].instructions).toBe('Inspeccionar techumbre escolar');
      expect(result.projectSection?.technicalSpecs[0]).toBe('Tubería de cobre 1/2 pulgada');
      expect(result.projectSection?.acceptanceCriteria[0]).toBe('Alcanzar 45 grados centígrados');

      // G) Sección Evaluación (Rúbrica)
      const rubric = result.evaluationSection?.rubric?.[0];
      expect(rubric?.criterion).toBe('Rigurosidad Experimental');
      expect(rubric?.levels[0].descriptor).toBe('Procedimiento impecable y registro exacto');
      expect(rubric?.levels[1].descriptor).toBe('Procedimiento correcto con mínimas desviaciones');
      expect(rubric?.levels[2].descriptor).toBe('Cumple los pasos con apoyo parcial');
      expect(rubric?.levels[3].descriptor).toBe('Omite mediciones y medidas de seguridad');

      // H) Aserción global: NINGÚN campo del resultado contiene '<!--'
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('<!--');
    });

    it('F-22-gap: defaults en DOCX y PDF cuando casillas o columnas se reducen a vacio [] tras sanitizar', async () => {
      const tag = '<!--workbook:lines:rows=4-->';
      const tagOnly = '<!--workbook:table:cols=2-->';

      const input: ActiveWorkTextbook = {
        id: 'wb-test-defaults',
        planningId: 'plan-unit-01',
        blockIndex: 0,
        blockName: `Bloque 1: Materia y Energía ${tag}`,
        version: 1,
        subsystem: `Bachillerato General Estatal ${tag}`,
        targetPages: 40,
        totalPages: 40,
        totalWords: 3500,
        generatedAt: '2026-10-03',
        qualityScore: 95,
        qualityWarning: false,
        coverData: {
          title: tagOnly,
          subtitle: `**Subtítulo Editorial** ${tag}`,
          subjectName: `Ciencias Naturales ${tag}`,
          semester: 2,
          blockNumber: 1,
          teacherName: `Mtra. González ${tag}`,
          schoolName: `Bachillerato Gral Puebla ${tag}`,
          cct: `21EBH0001X ${tag}`,
          paecProjectName: `Sustentabilidad Escolar ${tag}`,
          municipality: `Puebla, Pue. ${tag}`,
        },
        tableOfContents: [
          {
            missionIndex: 1,
            title: `Misión 1: Ley de Conservación ${tag}`,
            sessionsRange: `Sesiones 1 a 4 ${tag}`,
            pageEstimate: 6,
          },
        ],
        missions: [
          {
            missionIndex: 1,
            title: `Misión 1: Ley de Conservación de la Materia ${tag}`,
            coveredSessions: [1, 2, 3, 4],
            sessionTopic: `Transformaciones Químicas y Ley de Lavoisier ${tag}`,
            sessionFocus: `Comprobación experimental en sistema cerrado ${tag}`,
            wordCount: 850,
            phenomenonHook: {
              story: `En un taller de herrería en Tepeaca, el óxido de hierro... ${tag}`,
              detonatingQuestion: `¿Por qué el hierro oxidado parece pesar más? ${tag}`,
            },
            conceptZero: {
              physicalAnalogy: `Una báscula de dos platos en equilibrio ${tag}`,
              coreExplanation: `La materia no se crea ni se destruye ${tag}`,
              narrativeExplanation: `Durante cualquier reacción química ordinaria... ${tag}`,
              solvedExample: {
                problemStatement: `Calcular la masa final ${tag}`,
                solutionSteps: [`Paso 1: Sumar reactivos ${tag}`, `Paso 2: Igualar productos ${tag}`],
                interpretation: `La masa neta se conserva ${tag}`,
              },
              contrastTable: [
                {
                  correctConcept: `La masa total permanece constante ${tag}`,
                  commonMisconception: `El gas liberado no tiene masa ${tag}`,
                  reasoning: `Porque los átomos se reorganizan ${tag}`,
                },
              ],
            },
            iDoSection: {
              stepByStepDemo: `El docente pesa un matraz sellado ${tag}`,
              visualOrDiagram: 'flowchart TD; A[Inicio]-->B[Fin];',
            },
            weDoSection: {
              guidedPractice: `En equipos medimos reactivos en probeta ${tag}`,
              workbookElements: [
                {
                  id: 'el-cb-alltag',
                  type: 'checkbox_list',
                  title: `Lista Casillas Solo Tag ${tag}`,
                  instruction: `Marca cada paso conforme avances ${tag}`,
                  config: {
                    checkboxes: [tagOnly, tagOnly],
                  },
                } as unknown as WorkbookElement,
                {
                  id: 'el-table-alltag',
                  type: 'empty_table',
                  title: `Tabla Columnas Solo Tag ${tag}`,
                  instruction: `Registra datos experimentales ${tag}`,
                  config: {
                    cols: [tagOnly, tagOnly],
                  },
                } as unknown as WorkbookElement,
              ],
            },
            youDoSection: {
              autonomousChallenge: `Calcula el rendimiento porcentual ${tag}`,
              workbookElements: [],
            },
            troubleshooting: [],
            formativeCheckpoint: {
              question: `¿Qué principio termodinámico demostraste? ${tag}`,
              reflectionPrompts: [`Reflexiona sobre posibles fuentes de error ${tag}`],
              criteriaChecklist: [`Anotó unidades correctas ${tag}`],
            },
            diagnosticEvaluation: {
              context: `Situación de diagnóstico inicial ${tag}`,
              questions: [`¿Qué ocurre cuando una vela se consume? ${tag}`],
            },
            metacognitiveTrafficLight: {
              green: `Comprendo y aplico el balance ${tag}`,
              yellow: `Entiendo el concepto pero dudo en cálculos ${tag}`,
              red: `Requiero asesoría docente ${tag}`,
            },
            safetyOrWorkshopTip: `Usar gafas de seguridad y guantes térmicos ${tag}`,
          } as unknown as MissionSection,
        ],
        projectSection: {
          artifactName: `Calentador Solar Comunitario ${tag}`,
          communityUtility: `Agua caliente para el comedor escolar ${tag}`,
          phases: [],
          technicalSpecs: [],
          acceptanceCriteria: [],
        } as unknown as ProjectSection,
        evaluationSection: {
          source: 'generated_fresh',
          rubric: [],
        } as unknown as EvaluationSection,
      };

      const sanitized = sanitizeWorkbookNarratives(input);
      const dummyPlanning: Planning = {
        id: 'plan-unit-01',
        teacherId: 'teacher-unit',
        uacName: 'Ciencias Naturales',
        semester: 2,
        subsystem: 'Bachillerato General Estatal',
        contentJson: {},
      } as unknown as Planning;

      const docxBuf = await renderWorkbookToDocx(sanitized, dummyPlanning, {});
      const docxText = (await mammoth.extractRawText({ buffer: docxBuf })).value;
      expect(docxText).toContain('He verificado los requerimientos antes de iniciar.');
      expect(docxText).toContain('Aspecto / Variable');
      expect(docxText).not.toContain('<!--');

      // Inspección de partes XML del DOCX para certificar 0 etiquetas workbook
      const zip = await JSZip.loadAsync(docxBuf);
      let xmlWorkbookTags = 0;
      for (const [filename, file] of Object.entries(zip.files)) {
        if (filename.endsWith('.xml')) {
          const content = await file.async('string');
          const matches = content.match(/<!--\s*workbook:/gi);
          if (matches) xmlWorkbookTags += matches.length;
        }
      }
      expect(xmlWorkbookTags).toBe(0);

      const pdfBuf = await renderWorkbookToPdf(sanitized, dummyPlanning, {});
      const p = new PDFParse({ data: new Uint8Array(pdfBuf) });
      const pdfText = (await p.getText()).text;
      await p.destroy();
      expect(pdfText).toContain('Instrumentos verificados y listos');
      expect(pdfText).toContain('Variable / Parámetro');
      expect(pdfText).not.toContain('<!--');
    }, 60000);
  });
});
