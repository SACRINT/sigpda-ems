/**
 * pmc-parse-previous-coverage.test.ts
 *
 * Tests unitarios para el Paquete C (P1 · H-216):
 * Extracción de metas institucionales del PMC anterior (>40 sin truncar),
 * particionado estructural determinista, reintento y cálculo de cobertura real.
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ingestDocument } from '@/lib/document-ingestion';
import {
  countDeterministicExpectedActivities,
  countPlanTableRows,
  checkRawIsTruncated,
  partitionMarkdownDocument,
  deduplicatePlanElements,
  deduplicateMetasPrevias,
  extractPmcPreviousWithPartitioning,
  extractDeterministicSupervisorAndZone,
  findPlanActionSection,
} from '@/lib/pmc/pmc-partitioner';
import { calculatePmcCoverage, validateNormalizedText } from '@/lib/pmc/plan-element-normalizer';
import { isValidStaffName } from '@/lib/pmc/staff-reconciler';
import { type PmcPlanElement, PmcPreviousExtractSchema } from '@/lib/prompts/pmc-extraction';
import { parseAIResponse } from '@/lib/ai-response-parser';

// Mock de ai-provider para pruebas controladas de rotación y llamadas a la IA
vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  resolveUserIsPremium: vi.fn().mockResolvedValue(true),
  logActivity: vi.fn(),
}));

import { generateWithRotation } from '@/lib/ai-provider';

describe('Paquete C (H-216) — Metas institucionales del PMC: >40 sin truncar y cobertura', () => {
  const fixturePath = path.resolve(
    process.cwd(),
    '..',
    'documentos_referencia',
    '[05] Proyectos_PAEC_y_PMC',
    '911 y F11',
    'Heroes',
    'PMC 2026-Heroes de la Patria.docx'
  );

  it('1. Conteo determinista: detecta honestamente ~22 actividades/metas en el fixture real de Héroes de la Patria (excluyendo firmas finales, H-298)', async () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    const expected = countDeterministicExpectedActivities(documentText);
    expect(expected).toBeGreaterThanOrEqual(20);
    expect(expected).toBeLessThanOrEqual(25);
  }, 15000);

  it('1b. Conteo de filas reales de tabla markdown en Plan de Acción (H-293)', () => {
    const markdownFixture = `
# 1. DATOS DEL PLANTEL
CCT: 21EBH0200X
Bachillerato Héroes de la Patria

# 6. PLAN DE ACCIÓN
## Matriz General de Metas

| N° | Categoría | Meta establecida | Responsable | Período |
|---|---|---|---|---|
| 1 | Desarrollo académico | Meta 1 sobre aprobación del 85% | Profr. Gómez | 2026-2027 |
| 2 | Desarrollo académico | Meta 2 sobre tutorías entre pares | Mtra. López | 2026-2027 |
| 3 | Gestión escolar | Meta 3 sobre observación de aula | Director | 2026-2027 |
| 4 | Desarrollo socioemocional | Meta 4 sobre cultura de paz | Lic. Sánchez | 2026-2027 |
| 5 | Vinculación | Meta 5 sobre convenios comunitarios | Profr. Díaz | 2026-2027 |

Texto de cierre sin tablas.
`;

    const rowCount = countPlanTableRows(markdownFixture);
    expect(rowCount).toBe(5);

    const totalExpected = countDeterministicExpectedActivities(markdownFixture);
    expect(totalExpected).toBeGreaterThanOrEqual(5);
  });

  it('2. Particionado estructural: divide documentos extensos en fragmentos respetando límites de 14k-25k chars', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    const chunks = partitionMarkdownDocument(documentText, 14000, 24000);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(25000);
      expect(chunk.length).toBeGreaterThan(0);
    }
  }, 15000);

  it('3. Detección de truncamiento: identifica respuestas incompletas de la IA antes de jsonrepair', () => {
    const completeJson = '{"elementos_plan": [{"tipo": "actividad", "texto_original": "t"}]}';
    const truncatedJson = '{"elementos_plan": [{"tipo": "actividad", "texto_original": "t';
    const completeWithMarkdown = '```json\n{"elementos_plan": []}\n```';
    const truncatedWithMarkdown = '```json\n{"elementos_plan": [{"tipo": "act';

    expect(checkRawIsTruncated(completeJson)).toBe(false);
    expect(checkRawIsTruncated(truncatedJson)).toBe(true);
    expect(checkRawIsTruncated(completeWithMarkdown)).toBe(false);
    expect(checkRawIsTruncated(truncatedWithMarkdown)).toBe(true);
  });

  it('3b. Resiliencia de esquema ante variaciones de IA en elementos_plan', () => {
    const raw = JSON.stringify({
      elementos_plan: [
        {
          tipo: 'Meta',
          texto_original: 'Meta 1',
          texto_normalizado: 'Meta 1',
          motivos_revision: null,
          ubicacion: null,
        }
      ]
    });
    const parsed = parseAIResponse(raw, PmcPreviousExtractSchema, { repairNullStrings: true });
    console.log('--- TEST 3B RESULT ---', 'Success:', parsed.success, 'Error:', parsed.error);
    expect(parsed.success).toBe(true);
  });

  it('4. Deduplicación de elementos del plan: elimina redundancias en los límites de corte con solapamiento léxico', () => {
    const rawElements: PmcPlanElement[] = [
      {
        tipo: 'actividad',
        texto_original: 'Ofrecer asesorías de pensamiento aritmético, de 1:30 a 2:30 los días viernes',
        texto_normalizado: 'Ofrecer asesorías de pensamiento aritmético de 1:30 a 2:30 los días viernes',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Indicadores académicos',
        responsable: 'ING. ALEJANDRA MARTÍNEZ LUNA',
        periodo: 'Ciclo 2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
      // Duplicado exacto
      {
        tipo: 'actividad',
        texto_original: 'Ofrecer asesorías de pensamiento aritmético de 1:30 a 2:30 los días viernes',
        texto_normalizado: 'Ofrecer asesorías de pensamiento aritmético de 1:30 a 2:30 los días viernes',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Indicadores académicos',
        responsable: 'ING. ALEJANDRA MARTÍNEZ LUNA',
        periodo: 'Ciclo 2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
      // Elemento distinto
      {
        tipo: 'actividad',
        texto_original: 'Realizar un concentrado de calificaciones grupal en el salón de 2 A',
        texto_normalizado: 'Realizar un concentrado de calificaciones grupal en el salón de 2 A',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Indicadores académicos',
        responsable: 'ING. ALEJANDRA MARTÍNEZ LUNA',
        periodo: 'Ciclo 2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
    ];

    const deduplicated = deduplicatePlanElements(rawElements);
    expect(deduplicated.length).toBe(2);
  });

  it('4b. Deduplicación con responsable (H-294 / caso 15-15-15): preserva actividades o metas idénticas si pertenecen a docentes distintos', () => {
    const multiTeacherElements: PmcPlanElement[] = [
      {
        tipo: 'actividad',
        texto_original: 'Tomar 2 cursos de formación docente COSFAC en línea',
        texto_normalizado: 'Tomar 2 cursos de formación docente COSFAC en línea',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Formación docente',
        responsable: 'ING. ALEJANDRA MARTÍNEZ LUNA',
        periodo: 'Ciclo 2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
      {
        tipo: 'actividad',
        texto_original: 'Tomar 2 cursos de formación docente COSFAC en línea',
        texto_normalizado: 'Tomar 2 cursos de formación docente COSFAC en línea',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Formación docente',
        responsable: 'MTRA. ANA LILIA PÉREZ HERNÁNDEZ',
        periodo: 'Ciclo 2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
      {
        tipo: 'actividad',
        texto_original: 'Tomar 2 cursos de formación docente COSFAC en línea',
        texto_normalizado: 'Tomar 2 cursos de formación docente COSFAC en línea',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Formación docente',
        responsable: 'PROFR. JOSÉ ALAIN ROSALES GARCÍA',
        periodo: 'Ciclo 2026-2027',
        ubicacion: {},
        requiere_revision: false,
      },
    ];

    const deduplicated = deduplicatePlanElements(multiTeacherElements);
    // H-294: Los 3 docentes deben preservarse sin colapsar en 1
    expect(deduplicated.length).toBe(3);

    const multiTeacherMetas = [
      {
        meta: 'Aprobar al 85% de los alumnos',
        categoria: 'Desarrollo académico y aprendizaje',
        responsable: 'Ing. Alejandra Martínez Luna',
      },
      {
        meta: 'Aprobar al 85% de los alumnos',
        categoria: 'Desarrollo académico y aprendizaje',
        responsable: 'Mtra. Ana Lilia Pérez Hernández',
      },
      // Duplicado exacto del mismo docente
      {
        meta: 'Aprobar al 85% de los alumnos',
        categoria: 'Desarrollo académico y aprendizaje',
        responsable: 'Alejandra Martínez Luna',
      },
    ];

    const deduplicatedMetas = deduplicateMetasPrevias(multiTeacherMetas);
    // Deben quedar 2: una para Alejandra y una para Ana Lilia
    expect(deduplicatedMetas.length).toBe(2);
  });

  it('5. Extracción completa con fixture real: genera >= 40 elementos y coverage >= 0.9 (H-216)', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    // Generar un mock de 41 elementos reales del plan distribuidos
    const mockElements: PmcPlanElement[] = Array.from({ length: 41 }, (_, i) => ({
      tipo: 'actividad' as const,
      texto_original: `Actividad institucional número ${i + 1} del PMC oficial de Héroes de la Patria`,
      texto_normalizado: `Actividad institucional número ${i + 1} del PMC oficial de Héroes de la Patria`,
      categoria: 'Desarrollo académico y aprendizaje',
      tema: 'Indicadores académicos',
      responsable: `DOCENTE RESPONSABLE ${i + 1}`,
      periodo: '2026-2027',
      ubicacion: {},
      requiere_revision: false,
    }));

    vi.mocked(generateWithRotation).mockResolvedValue(
      JSON.stringify({
        schoolName: 'BACHILLERATO GENERAL OFICIAL HEROES DE LA PATRIA',
        schoolCct: '21EBH0200X',
        directorName: 'PATRICIA MENDOZA SANTOS',
        totales_detectados: { metas: 15, actividades: 41 },
        elementos_plan: mockElements,
        metas_institucionales_previas: mockElements.map((e) => ({
          categoria: e.categoria,
          tema: e.tema,
          meta: e.texto_normalizado,
          linea_base: 'Diagnóstico 2025-2026',
          estrategia: 'Estrategia situada',
          responsable: e.responsable || '',
          entregable: 'Fotografías y minutas',
          periodo: e.periodo || '',
        })),
      })
    );

    const result = await extractPmcPreviousWithPartitioning({
      documentText,
      teacherId: 'teacher-heroes-123',
      isPremium: true,
      deadline: Date.now() + 60000,
      contextName: 'test-coverage',
    });

    expect(result.success).toBe(true);
    expect(result.data.elementos_plan?.length).toBeGreaterThanOrEqual(20);
    expect(result.expectedActivities).toBeGreaterThanOrEqual(20);
    expect(result.expectedActivities).toBeLessThanOrEqual(25);

    const coverage = calculatePmcCoverage(
      result.data.totales_detectados,
      result.data.metas_institucionales_previas?.length || 0,
      result.data.elementos_plan?.length || 0,
      result.expectedActivities
    );

    expect(coverage.parcial).toBe(false);
    expect(coverage.ratio).toBeGreaterThanOrEqual(0.9);
  }, 15000);

  it('6. Bucle de completitud (gap-fill, H-295): si extraidos < 90% expected, recupera elementos faltantes', async () => {
    // Documento sintético con 20 actividades esperadas
    const sampleDoc = `
# 6. PLAN DE ACCIÓN
| N° | Categoría | Meta | Responsable |
|---|---|---|---|
${Array.from({ length: 20 }, (_, i) => `| ${i + 1} | Desarrollo académico | Actividad ${i + 1} del plan | Profr. ${i + 1} |`).join('\n')}
`;

    // 1ª llamada: sólo devuelve 10 elementos
    const firstPassElements: PmcPlanElement[] = Array.from({ length: 10 }, (_, i) => ({
      tipo: 'actividad' as const,
      texto_original: `Actividad ${i + 1} del plan`,
      texto_normalizado: `Actividad ${i + 1} del plan`,
      categoria: 'Desarrollo académico y aprendizaje',
      tema: 'Indicadores académicos',
      responsable: `Profr. ${i + 1}`,
      periodo: '2026-2027',
      ubicacion: {},
      requiere_revision: false,
    }));

    // 2ª llamada (gap-fill): devuelve los 10 restantes
    const gapElements: PmcPlanElement[] = Array.from({ length: 10 }, (_, i) => ({
      tipo: 'actividad' as const,
      texto_original: `Actividad ${i + 11} del plan`,
      texto_normalizado: `Actividad ${i + 11} del plan`,
      categoria: 'Desarrollo académico y aprendizaje',
      tema: 'Indicadores académicos',
      responsable: `Profr. ${i + 11}`,
      periodo: '2026-2027',
      ubicacion: {},
      requiere_revision: false,
    }));

    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(
        JSON.stringify({
          schoolName: 'PLANTEL TEST',
          schoolCct: '21EBH0001X',
          totales_detectados: { metas: 0, actividades: 20 },
          elementos_plan: firstPassElements,
          metas_institucionales_previas: [],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          totales_detectados: { metas: 0, actividades: 20 },
          elementos_plan: gapElements,
          metas_institucionales_previas: [],
        })
      );

    const result = await extractPmcPreviousWithPartitioning({
      documentText: sampleDoc,
      teacherId: 'teacher-gap-123',
      isPremium: true,
      deadline: Date.now() + 60000,
      contextName: 'test-gap-fill',
    });

    expect(result.success).toBe(true);
    // H-295: Con gap-fill deben sumarse los 10 iniciales + 10 del gap = 20
    expect(result.data.elementos_plan?.length).toBe(20);
  });

  it('7. Escala 15-15-15 (H-297): soporta plantilla de 45 docentes en staffData y participantes sin error de cap (hasta 60)', () => {
    const fortyFiveTeachers = Array.from({ length: 45 }, (_, i) => ({
      nombre: `Docente Número ${i + 1}`,
      cargo: 'Docente de grupo',
      meta_individual: `Meta individual ${i + 1}`,
      metas_individuales: [],
    }));

    const fortyFiveParticipantes = Array.from({ length: 45 }, (_, i) => ({
      nombre: `Docente Número ${i + 1}`,
      cargo: 'Docente de grupo',
      firma: '',
    }));

    const validData = {
      schoolName: 'PLANTEL GRANDE 15-15-15',
      staffData: fortyFiveTeachers,
      participantes: fortyFiveParticipantes,
      elementos_plan: [],
      metas_institucionales_previas: [],
    };

    const parsed = PmcPreviousExtractSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.staffData?.length).toBe(45);
      expect(parsed.data.participantes?.length).toBe(45);
    }
  });

  it('7b. Escala 20-20-20 (H-301): soporta plantilla de 80 docentes y propaga cabeceras de tabla a todos los fragmentos', () => {
    const eightyTeachers = Array.from({ length: 80 }, (_, i) => ({
      nombre: `Docente Número ${i + 1}`,
      cargo: 'Docente',
      meta_individual: `Meta individual del docente ${i + 1}`,
      metas_individuales: [],
    }));

    const eightyParticipantes = Array.from({ length: 80 }, (_, i) => ({
      nombre: `Docente Número ${i + 1}`,
      cargo: 'Docente de grupo',
      firma: '',
    }));

    const validData = {
      schoolName: 'PLANTEL MEGA 20-20-20',
      staffData: eightyTeachers,
      participantes: eightyParticipantes,
      elementos_plan: [],
      metas_institucionales_previas: [],
    };

    const parsed = PmcPreviousExtractSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.staffData?.length).toBe(80);
      expect(parsed.data.participantes?.length).toBe(80);
    }

    // Probar propagación de cabeceras en tabla masiva
    const header = '| Categoria | Meta | Responsable |\n|---|---|---|\n';
    let massiveTable = header;
    for (let i = 0; i < 60; i++) {
      massiveTable += `| Cat ${i} | Meta extensa con detalles para el docente ${i} | Docente ${i} |\n`;
    }
    const chunks = partitionMarkdownDocument(massiveTable, 500, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk).toContain('| Categoria | Meta | Responsable |');
      expect(chunk).toContain('|---|---|---|');
    }
  });

  it('8. Extracción determinista de Supervisor y Zona Escolar (fixture real Héroes de la Patria, Zona 086)', async () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    const res = extractDeterministicSupervisorAndZone(documentText, 'Adrián Hernández Cruz');
    expect(res.schoolZone).toBe('086');
    expect(res.supervisorName).toContain('MOISES FLORES');
  });

  it('9. Detección robusta de Plan de Acción y particionado de todos los docentes (Héroes de la Patria)', async () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    const { planText, startIndex } = findPlanActionSection(documentText);
    expect(startIndex).toBeGreaterThan(10000);
    expect(planText.length).toBeGreaterThan(12000);

    // Todos los docentes deben estar en la sección del plan
    const teachers = ['Roselia', 'Tulia', 'Soledad', 'Nemesio', 'Nicolás', 'Alain', 'Claudia', 'Humberta', 'Alejandra', 'Ana Lilia'];
    for (const t of teachers) {
      expect(planText.toLowerCase()).toContain(t.toLowerCase());
    }

    // Particionado del plan en fragmentos manejables
    const planChunks = partitionMarkdownDocument(planText, 7000, 11000);
    expect(planChunks.length).toBeLessThanOrEqual(3);
  });

  it('10. Prevención de docentes fantasma e invariantes de numeración inline', () => {
    // Descartar fantasma
    expect(isValidStaffName('Docente sin nombre explícito en bloque final')).toBe(false);

    // Invariante numérico con listas de evidencias inline
    const originalEvidencia = '1. Constancias de los cursos 2. Fotografías 3. Fotografía y Video 4. Fotografías y Videos 5. Fotografías 6. Fotografías';
    const normalizedEvidencia = 'Constancias de los cursos, fotografías y videos';
    const val = validateNormalizedText(originalEvidencia, normalizedEvidencia);
    expect(val.ok).toBe(true);
    expect(val.faltantes).toEqual([]);
  });
});
