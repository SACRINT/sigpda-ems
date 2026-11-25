import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  computeCurrentPaecPmcGolden,
  diffGoldenSnapshots,
  type PaecPmcGoldenBaseline,
} from '../../scripts/verify-paec-pmc-golden';

const BASELINE_PATH = path.resolve(process.cwd(), 'tests/fixtures/paec-pmc-golden/baseline.golden.json');

describe('PAEC & PMC Golden Regression Harness (Fase C.5 / D)', () => {
  it('reproduce exactamente 0 diffs contra el baseline congelado de DOCX, Maestro, PDF y Quality Gates', async () => {
    expect(fs.existsSync(BASELINE_PATH)).toBe(true);
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as PaecPmcGoldenBaseline;
    const current = await computeCurrentPaecPmcGolden();

    expect(current.pmc.semanticQaPassed).toBe(true);
    expect(current.paec.semAPassed).toBe(true);
    expect(current.paec.semBPassed).toBe(true);

    const diffs = diffGoldenSnapshots(baseline, current);
    expect(diffs).toEqual([]);
  }, 30000);
});
