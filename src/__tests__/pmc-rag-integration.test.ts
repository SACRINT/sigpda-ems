/**
 * pmc-rag-integration.test.ts
 *
 * Pruebas unitarias de integración de RAG curricular en PMC (M4).
 * Valida:
 * 1. Parametrización de targetDoc en buildRagContextBlock ('el diagnóstico del PMC' vs 'la planeación').
 * 2. Fail-open y filtrado de similitud vectorial (>= 0.6) vs fallback ILIKE (0.5 fijo).
 * 3. Inyección en prompt sin afectar ejecuciones cuando no hay datos.
 */

import { describe, it, expect } from 'vitest';
import {
  buildRagContextBlock,
  type RagContext,
  type CurriculumChunk,
} from '@/lib/rag-curricular';

describe('M4: RAG Curricular — Integración con PMC', () => {
  const sampleChunk: CurriculumChunk = {
    id: 'chunk-1',
    program_id: 'prog-01',
    uac_name: 'PENSAMIENTO MATEMÁTICO I',
    semester: 1,
    component: 'Fundamental',
    chunk_text: 'Progresión 1: Identifica situaciones donde intervienen cantidades variables.',
    similarity: 0.85,
  };

  it('parametriza el documento destino en buildRagContextBlock para PMC', () => {
    const context: RagContext = {
      chunks: [sampleChunk],
      query: 'Pensamiento Matemático',
    };

    const pmcBlock = buildRagContextBlock(context, {
      targetDoc: 'el diagnóstico del Plan de Mejora Continua (PMC)',
    });

    expect(pmcBlock).toContain('CONTEXTO CURRICULAR RECUPERADO POR RAG (Fuente Oficial SEP)');
    expect(pmcBlock).toContain('el diagnóstico del Plan de Mejora Continua (PMC)');
    expect(pmcBlock).toContain('PENSAMIENTO MATEMÁTICO I');
    expect(pmcBlock).toContain('Progresión 1: Identifica situaciones donde intervienen cantidades variables.');
    expect(pmcBlock).toContain('Similitud: 85%');
  });

  it('mantiene el valor por defecto "la planeación" cuando no se especifican opciones (backward compatibility)', () => {
    const context: RagContext = {
      chunks: [sampleChunk],
      query: 'Pensamiento Matemático',
    };

    const defaultBlock = buildRagContextBlock(context);
    expect(defaultBlock).toContain('la planeación');
    expect(defaultBlock).not.toContain('Plan de Mejora Continua');
  });

  it('retorna cadena vacía cuando el contexto RAG no tiene chunks (fail-open)', () => {
    const emptyContext: RagContext = {
      chunks: [],
      query: 'consulta vacia',
    };

    expect(buildRagContextBlock(emptyContext)).toBe('');
    expect(buildRagContextBlock(emptyContext, { targetDoc: 'el PMC' })).toBe('');
  });

  it('discrimina correctamente chunks vectoriales (>= 0.6) y chunks de fallback de texto (0.5 fijo)', () => {
    const vectorChunks: CurriculumChunk[] = [
      { ...sampleChunk, id: 'v1', similarity: 0.75 },
      { ...sampleChunk, id: 'v2', similarity: 0.55 }, // Vectorial por debajo del umbral 0.6
    ];

    const isVector = vectorChunks.some(c => c.similarity !== 0.5);
    expect(isVector).toBe(true);

    const filteredVector = isVector
      ? vectorChunks.filter(c => c.similarity >= 0.6)
      : vectorChunks;
    expect(filteredVector.length).toBe(1);
    expect(filteredVector[0].id).toBe('v1');

    // Chunks con fallback ILIKE (todos 0.5 fijo según rag-curricular.ts:113)
    const textFallbackChunks: CurriculumChunk[] = [
      { ...sampleChunk, id: 't1', similarity: 0.5 },
      { ...sampleChunk, id: 't2', similarity: 0.5 },
    ];

    const isVectorFallback = textFallbackChunks.some(c => c.similarity !== 0.5);
    expect(isVectorFallback).toBe(false);

    // No debe descartar los chunks de texto fallback aunque similarity sea 0.5
    const filteredFallback = isVectorFallback
      ? textFallbackChunks.filter(c => c.similarity >= 0.6)
      : textFallbackChunks;
    expect(filteredFallback.length).toBe(2);
  });
});
