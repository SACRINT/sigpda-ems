import { describe, it, expect } from 'vitest';
import { verifySacrintGolden } from '../../scripts/verify-sacrint-golden';

describe('SACRINT Golden Baseline — 0-diff parity & strict PPTX QA (12 fixtures: 6 reales + 6 sintéticos)', () => {
  it('mantiene 0 diferencias contra el baseline congelado y 0 fallos QA estrictos en los 12 fixtures', async () => {
    const result = await verifySacrintGolden();
    expect(result.fixtureCount).toBe(12);
    expect(result.qaFailures).toEqual([]);
    expect(result.diffs).toEqual([]);
    expect(result.passed).toBe(true);
  }, 60000);
});
