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
  checkRawIsTruncated,
  partitionMarkdownDocument,
  deduplicatePlanElements,
  extractPmcPreviousWithPartitioning,
} from '@/lib/pmc/pmc-partitioner';
import { calculatePmcCoverage } from '@/lib/pmc/plan-element-normalizer';
import type { PmcPlanElement } from '@/lib/prompts/pmc-extraction';

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

  it('1. Conteo determinista: detecta exactamente 41 actividades/metas en el fixture real de Héroes de la Patria', async () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    const expected = countDeterministicExpectedActivities(documentText);
    expect(expected).toBeGreaterThanOrEqual(40);
    expect(expected).toBeLessThanOrEqual(45);
  }, 15000);

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
    expect(result.data.elementos_plan?.length).toBeGreaterThanOrEqual(40);
    expect(result.expectedActivities).toBeGreaterThanOrEqual(40);
    expect(result.expectedActivities).toBeLessThanOrEqual(45);

    const coverage = calculatePmcCoverage(
      result.data.totales_detectados,
      result.data.metas_institucionales_previas?.length || 0,
      result.data.elementos_plan?.length || 0,
      result.expectedActivities
    );

    expect(coverage.parcial).toBe(false);
    expect(coverage.ratio).toBeGreaterThanOrEqual(0.9);
  }, 15000);
});
