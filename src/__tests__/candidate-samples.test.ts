import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateAnexo12 } from '@/lib/planning/anexo12-validator';
import { evaluateDBEPA } from '@/lib/planning/dbepa-quality-gate';
import { computeCanonicalSha256 } from '@/lib/planning/planning-versions';
import type { GeneratedPlanningContent } from '@/types/planning';

interface CanonicalSampleDuaItem {
  categoria: string;
  descripcion?: string;
  estrategias?: unknown[];
  evaluacionDiferenciada?: string;
  recursos?: unknown[];
}

interface CanonicalSampleFixtureRecord {
  id: string;
  shortName: string;
  uac_name: string;
  semester: number;
  component: 'fundamental' | 'laboral';
  hours: number;
  content_json: GeneratedPlanningContent & {
    ajustesDUA?: { ajustes?: CanonicalSampleDuaItem[] };
  };
  sequence_json: Record<string, unknown>;
  workbooks_json: Record<string, unknown>;
  lesson_plans: Array<{ key_index: number; title: string; content_text: string }>;
  latest_version: {
    version_number: number;
    sha256_hash: string;
    anexo12_score: number;
    dbepa_score: number;
  };
}

interface CanonicalSamplesFixture {
  samples: CanonicalSampleFixtureRecord[];
}

const EXPECTED_SAMPLES = [
  { id: '18016fa8-7a96-4d89-b693-47788285560e', hours: 54, component: 'fundamental' },
  { id: 'cc626dd9-9a8a-442a-ab25-532d485d6b36', hours: 72, component: 'fundamental' },
  { id: '57484f68-811a-485e-817e-f68ff0c92fe8', hours: 36, component: 'fundamental' },
  { id: '7a1e4e19-efa3-40eb-b819-dd604d742cbf', hours: 54, component: 'fundamental' },
  { id: 'd944cd30-7fb6-4e3d-a7a6-db48caa78973', hours: 54, component: 'laboral' },
] as const;

describe('Muestras canónicas: validación offline desde fixture JSON versionado', () => {
  let rawFixtureText = '';
  let fixture: CanonicalSamplesFixture;

  beforeAll(() => {
    const fixturePath = path.resolve(
      process.cwd(),
      'src',
      '__tests__',
      'fixtures',
      'canonical-samples.json'
    );
    rawFixtureText = fs.readFileSync(fixturePath, 'utf8');
    fixture = JSON.parse(rawFixtureText) as CanonicalSamplesFixture;
  });

  it('1. Las 5 muestras existen en el fixture y cubren tronco común y formación laboral', () => {
    expect(fixture.samples).toHaveLength(5);
    expect(fixture.samples.filter((sample) => sample.component === 'fundamental')).toHaveLength(4);
    expect(fixture.samples.filter((sample) => sample.component === 'laboral')).toHaveLength(1);

    let totalHours = 0;
    for (const expected of EXPECTED_SAMPLES) {
      const sample = fixture.samples.find((item) => item.id === expected.id);
      expect(sample).toBeDefined();
      expect(sample!.component).toBe(expected.component);
      expect(sample!.hours).toBe(expected.hours);
      expect(sample!.content_json.sectionI?.totalHours).toBe(expected.hours);
      expect(sample!.lesson_plans).toHaveLength(expected.hours);
      totalHours += sample!.hours;
    }

    expect(totalHours).toBe(270);
  });

  it('2. El DUA real contiene las 4 categorías con estrategias, evaluación y recursos', () => {
    for (const sample of fixture.samples) {
      const ajustes = sample.content_json.ajustesDUA?.ajustes;
      expect(Array.isArray(ajustes)).toBe(true);
      expect(ajustes).toHaveLength(4);

      const categories = new Set<string>(ajustes!.map((ajuste) => ajuste.categoria));
      for (const category of ['bap_sensorial', 'bap_motriz', 'ritmos_rezago', 'sobresalientes'] as const) {
        expect(categories.has(category)).toBe(true);
      }

      for (const ajuste of ajustes!) {
        expect(String(ajuste.descripcion || '').trim().length).toBeGreaterThan(20);
        expect(Array.isArray(ajuste.estrategias)).toBe(true);
        expect(ajuste.estrategias!.length).toBeGreaterThan(0);
        expect(String(ajuste.evaluacionDiferenciada || '').trim().length).toBeGreaterThan(20);
        expect(Array.isArray(ajuste.recursos)).toBe(true);
        expect(ajuste.recursos!.length).toBeGreaterThan(0);
      }
    }
  });

  it('3. Anexo 12 y DBEPA se recalculan sobre el contenido real y coinciden con el estándar canónico', () => {
    for (const sample of fixture.samples) {
      const anexo12 = validateAnexo12(sample.content_json);
      expect(anexo12.ok).toBe(true);
      expect(anexo12.score).toBe(100);
      expect(anexo12.criticalFailures).toBe(0);

      const dbepa = evaluateDBEPA(sample.content_json);
      expect(dbepa.semaforo).toBe('verde');
      expect(dbepa.score).toBeGreaterThanOrEqual(96);
    }
  });

  it('4. El hash canónico SHA-256 es inmutable, de 64 caracteres y sin caracteres de reemplazo', () => {
    expect(rawFixtureText.includes('\uFFFD')).toBe(false);

    for (const sample of fixture.samples) {
      const hash = computeCanonicalSha256(sample.content_json);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).toBe(sample.latest_version.sha256_hash);
    }
  });

  it('5. Los recursos curados no usan URLs de búsqueda genéricas', () => {
    const forbiddenPatterns = ['youtube.com/results', 'google.com/search', 'bing.com/search'];

    for (const sample of fixture.samples) {
      const text = `${JSON.stringify(sample.content_json)}\n${JSON.stringify(sample.workbooks_json)}`;
      for (const pattern of forbiddenPatterns) {
        expect(text.includes(pattern)).toBe(false);
      }
    }
  });
});
