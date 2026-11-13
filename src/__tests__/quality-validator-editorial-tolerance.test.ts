import { describe, it, expect } from 'vitest';
import {
  EDITORIAL_TOLERANCE_RATIO,
  validateBlockGuideQuality,
} from '@/lib/guide-engine/quality-validator';
import type { WriterOutput } from '@/lib/guide-engine/writers/writer-contract';

function output(
  type: WriterOutput['type'],
  wordCount: number,
  qualityScore = 93
): WriterOutput {
  return {
    type,
    section: { title: type, coveredSessions: [] },
    wordCount,
    tokensUsed: 0,
    qualityScore,
    warnings: [],
  } as unknown as WriterOutput;
}

const targetWords = { min: 27_000, ideal: 28_500, max: 30_000 };

describe('QualityValidator - tolerancia editorial única', () => {
  it('acepta 25,881/27,000 (95.8%) dentro de la tolerancia del 90% con advertencia', () => {
    const result = validateBlockGuideQuality({
      writerOutputs: [output('foundation', 8000), output('lab', 8000), output('project', 6000), output('evaluation', 3881)],
      subsystem: 'bge',
      targetWords,
    });

    expect(EDITORIAL_TOLERANCE_RATIO).toBe(0.9);
    expect(result.totalWordCount).toBe(25_881);
    expect(result.editorialMinWords).toBe(24_300);
    expect(result.withinEditorialTolerance).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.qualityWarning).toBe(true);
    expect(result.retryableWriters).toEqual([]);
    expect(result.warnings.join(' ')).toContain('tolerancia editorial del 90%');
  });

  it('rechaza 24,299/27,000 (por debajo del 90%) y marca reintento', () => {
    const result = validateBlockGuideQuality({
      writerOutputs: [output('foundation', 7500), output('lab', 7500), output('project', 5500), output('evaluation', 3799)],
      subsystem: 'bge',
      targetWords,
    });

    expect(result.totalWordCount).toBe(24_299);
    expect(result.withinEditorialTolerance).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.retryableWriters.length).toBeGreaterThan(0);
  });

  it('acepta el mínimo formal exacto sin advertencia de extensión', () => {
    const result = validateBlockGuideQuality({
      writerOutputs: [output('foundation', 8500), output('lab', 8500), output('project', 6000), output('evaluation', 4000)],
      subsystem: 'bge',
      targetWords,
    });

    expect(result.totalWordCount).toBe(27_000);
    expect(result.accepted).toBe(true);
    expect(result.qualityWarning).toBe(false);
  });

  it('los placeholders siguen bloqueando aunque el volumen esté en tolerancia', () => {
    const result = validateBlockGuideQuality({
      writerOutputs: [
        { ...output('foundation', 8000), section: { text: '[completar]' } as never },
        output('lab', 8000),
        output('project', 6000),
        output('evaluation', 3881),
      ],
      subsystem: 'bge',
      targetWords,
    });

    expect(result.withinEditorialTolerance).toBe(true);
    expect(result.accepted).toBe(false);
    expect(result.retryableWriters).toContain('foundation');
  });
});
