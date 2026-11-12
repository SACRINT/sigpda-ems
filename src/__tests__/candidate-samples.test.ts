/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { validateAnexo12 } from '@/lib/planning/anexo12-validator';
import { evaluateDBEPA } from '@/lib/planning/dbepa-quality-gate';
import { computeCanonicalSha256 } from '@/lib/planning/planning-versions';

const dbUrl = (() => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      const line = lines.find((l) => l.trim().startsWith('DATABASE_URL='));
      if (line) {
        return line.replace(/^DATABASE_URL=/, '').trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
})();

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const CANONICAL_SAMPLES = [
  {
    id: '18016fa8-7a96-4d89-b693-47788285560e',
    name: 'Lenguaje y Comunicación I. Leer y escribir para pensar juntos',
    semester: 1,
    hours: 54,
    component: 'fundamental',
  },
  {
    id: 'cc626dd9-9a8a-442a-ab25-532d485d6b36',
    name: 'Ciencias Naturales, Experimentales y Tecnología I. Invitación a la Ciencia. Naturaleza de la materia',
    semester: 1,
    hours: 72,
    component: 'fundamental',
  },
  {
    id: '57484f68-811a-485e-817e-f68ff0c92fe8',
    name: 'Ciencias sociales I. Estado, ciudadanía y relaciones de poder',
    semester: 1,
    hours: 36,
    component: 'fundamental',
  },
  {
    id: '7a1e4e19-efa3-40eb-b819-dd604d742cbf',
    name: 'Inglés I. To Be, or Not to be, That is the Question',
    semester: 1,
    hours: 54,
    component: 'fundamental',
  },
  {
    id: 'd944cd30-7fb6-4e3d-a7a6-db48caa78973',
    name: 'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante',
    semester: 3,
    hours: 54,
    component: 'laboral',
  },
];

describe('Muestras canónicas: validación real contra Neon DB', () => {
  let sql: NeonQueryFunction<false, false>;

  beforeAll(() => {
    if (!dbUrl) {
      throw new Error('DATABASE_URL no configurada para candidate-samples.test.ts');
    }
    sql = neon(dbUrl);
  });

  it('1. Las 5 muestras existen y cubren tronco común y formación laboral', async () => {
    expect(CANONICAL_SAMPLES).toHaveLength(5);
    expect(CANONICAL_SAMPLES.filter((sample) => sample.component === 'fundamental')).toHaveLength(4);
    expect(CANONICAL_SAMPLES.filter((sample) => sample.component === 'laboral')).toHaveLength(1);

    const rows = await sql`
      SELECT id, uac_name, content_json
      FROM plannings
      WHERE id = ANY(${CANONICAL_SAMPLES.map((sample) => sample.id)}::uuid[])
    `;
    expect(rows).toHaveLength(5);

    for (const sample of CANONICAL_SAMPLES) {
      const row = (rows as any[]).find((r) => r.id === sample.id);
      expect(row).toBeDefined();
      const content = parseJson<any>(row.content_json, {});
      expect(content.sectionI?.totalHours).toBe(sample.hours);
    }
  });

  it('2. El DUA real contiene las 4 categorías con estrategias, evaluación y recursos', async () => {
    const rows = await sql`
      SELECT id, content_json
      FROM plannings
      WHERE id = ANY(${CANONICAL_SAMPLES.map((sample) => sample.id)}::uuid[])
    `;

    for (const row of rows as any[]) {
      const content = parseJson<any>(row.content_json, {});
      const ajustes = content.ajustesDUA?.ajustes;
      expect(Array.isArray(ajustes)).toBe(true);
      expect(ajustes).toHaveLength(4);

      const categories = new Set(ajustes.map((ajuste: any) => ajuste.categoria));
      for (const category of ['bap_sensorial', 'bap_motriz', 'ritmos_rezago', 'sobresalientes']) {
        expect(categories.has(category)).toBe(true);
      }

      for (const ajuste of ajustes) {
        expect(String(ajuste.descripcion || '').trim().length).toBeGreaterThan(20);
        expect(Array.isArray(ajuste.estrategias)).toBe(true);
        expect(ajuste.estrategias.length).toBeGreaterThan(0);
        expect(String(ajuste.evaluacionDiferenciada || '').trim().length).toBeGreaterThan(20);
        expect(Array.isArray(ajuste.recursos)).toBe(true);
        expect(ajuste.recursos.length).toBeGreaterThan(0);
      }
    }
  });

  it('3. Anexo 12 y DBEPA se recalculan sobre el contenido real y coinciden con el estándar canónico', async () => {
    const rows = await sql`
      SELECT id, content_json
      FROM plannings
      WHERE id = ANY(${CANONICAL_SAMPLES.map((sample) => sample.id)}::uuid[])
    `;

    for (const row of rows as any[]) {
      const content = parseJson<any>(row.content_json, {});
      const anexo12 = validateAnexo12(content);
      expect(anexo12.ok).toBe(true);
      expect(anexo12.score).toBe(100);
      expect(anexo12.criticalFailures).toBe(0);

      const dbepa = evaluateDBEPA(content);
      expect(dbepa.semaforo).toBe('verde');
      expect(dbepa.score).toBeGreaterThanOrEqual(96);
    }
  });

  it('4. El hash canónico SHA-256 es inmutable, de 64 caracteres y no contiene caracteres de reemplazo', async () => {
    const rows = await sql`
      SELECT id, content_json::text AS content_text
      FROM plannings
      WHERE id = ANY(${CANONICAL_SAMPLES.map((sample) => sample.id)}::uuid[])
    `;

    for (const row of rows as any[]) {
      const content = parseJson<any>(row.content_text, {});
      const hash = computeCanonicalSha256(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(row.content_text.includes('\uFFFD')).toBe(false);
    }
  });

  it('5. Los recursos curados no usan URLs de búsqueda genéricas', async () => {
    const forbiddenPatterns = ['youtube.com/results', 'google.com/search', 'bing.com/search'];
    const rows = await sql`
      SELECT id, content_json::text AS content_text, workbooks_json::text AS workbooks_text
      FROM plannings
      WHERE id = ANY(${CANONICAL_SAMPLES.map((sample) => sample.id)}::uuid[])
    `;

    for (const row of rows as any[]) {
      const text = `${row.content_text || ''}\n${row.workbooks_text || ''}`;
      for (const pattern of forbiddenPatterns) {
        expect(text.includes(pattern)).toBe(false);
      }
    }
  });
});
