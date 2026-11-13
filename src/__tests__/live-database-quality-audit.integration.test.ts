/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

const ADMIN_SHOWROOM_TEACHER_ID = 'e2bf54f5-4f52-4d2b-a58e-10346ebee53d';
const RUN_LIVE_SAMPLE_AUDIT = process.env.RUN_LIVE_SAMPLE_AUDIT === '1';

// Cargar DATABASE_URL desde process.env o .env.local
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

interface CanonicalFixtureSample {
  id: string;
  shortName: string;
  uac_name: string;
  semester: number;
  component: 'fundamental' | 'laboral';
  hours: number;
  content_json: Record<string, any>;
  sequence_json: Record<string, any>;
  workbooks_json: Record<string, any>;
  lesson_plans: Array<{ key_index: number; title: string; content_text: string }>;
  latest_version: {
    version_number: number;
    sha256_hash: string;
    anexo12_score: number;
    dbepa_score: number;
  };
}

function loadCanonicalSamplesFixture(): CanonicalFixtureSample[] {
  const fixturePath = path.resolve(
    process.cwd(),
    'src',
    '__tests__',
    'fixtures',
    'canonical-samples.json'
  );
  const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    samples: CanonicalFixtureSample[];
  };
  return parsed.samples;
}

describe('Auditoría Integral de Calidad y Cierre (Neon DB Catálogo/ISO + Fixture Muestras)', () => {
  let sql: NeonQueryFunction<false, false>;
  let fixtureSamples: CanonicalFixtureSample[] = [];

  beforeAll(() => {
    if (!dbUrl) {
      throw new Error('DATABASE_URL no configurada para live-database-quality-audit.test.ts');
    }
    sql = neon(dbUrl);
    fixtureSamples = loadCanonicalSamplesFixture();
  });

  // --------------------------------------------------------------------------
  // 1. Verificación BGE Laboral: 15 Carreras, 120 UACs (Neon DB)
  // --------------------------------------------------------------------------
  describe('1. BGE Laboral: 120 UACs sin saberes vacíos y sin plantillas genéricas', () => {
    it('Existen exactamente 120 UACs laborales de BGE en programs_catalog', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE subsystem = 'bge' AND component = 'laboral'
      `;
      expect(rows.length).toBe(120);
    });

    it('0 UACs de BGE laboral contienen la plantilla genérica en temas', async () => {
      const rows = await sql`
        SELECT id, uac_name
        FROM programs_catalog
        WHERE subsystem = 'bge' AND component = 'laboral'
          AND (
            contenidos_formativos::text LIKE '%Fundamentos técnicos y normativos de%'
            OR activities::text LIKE '%Fundamentos técnicos y normativos de%'
            OR contenidos_formativos::text LIKE '%Prácticas estándar de aplicación para%'
          )
      `;
      expect(rows.length).toBe(0);
    });

    it('0 UACs de BGE laboral tienen saberes vacíos ([]) en contenidos_formativos o activities', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE subsystem = 'bge' AND component = 'laboral'
      `;

      let emptySaberesContenidos = 0;
      let emptySaberesActivities = 0;

      for (const row of rows) {
        const contenidos = parseJson<any[]>(row.contenidos_formativos, []);
        if (Array.isArray(contenidos)) {
          for (const c of contenidos) {
            if (Array.isArray(c.saberes) && c.saberes.length === 0) emptySaberesContenidos++;
            if (!c.saberes || (!c.saberes.saber && !c.saberes.conceptual)) emptySaberesContenidos++;
          }
        }

        const activities = parseJson<any[]>(row.activities, []);
        if (Array.isArray(activities)) {
          for (const a of activities) {
            if (Array.isArray(a.saberes) && a.saberes.length === 0) emptySaberesActivities++;
            if (!a.saberes || (!a.saberes.saber && !a.saberes.conceptual)) emptySaberesActivities++;
          }
        }
      }

      expect(emptySaberesContenidos).toBe(0);
      expect(emptySaberesActivities).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Verificación FFEO: 8 UACs (Neon DB)
  // --------------------------------------------------------------------------
  describe('2. FFEO: 8 UACs sin plantillas genéricas epistemológicas', () => {
    it('Existen exactamente 8 UACs en component = ffeo', async () => {
      const rows = await sql`
        SELECT id, uac_name
        FROM programs_catalog
        WHERE component = 'ffeo'
      `;
      expect(rows.length).toBe(8);
    });

    it('0 UACs de FFEO contienen "Fundamentos epistemológicos y conceptuales de"', async () => {
      const rows = await sql`
        SELECT id, uac_name
        FROM programs_catalog
        WHERE component = 'ffeo'
          AND (
            contenidos_formativos::text LIKE '%Fundamentos epistemológicos y conceptuales de%'
            OR activities::text LIKE '%Fundamentos epistemológicos y conceptuales de%'
          )
      `;
      expect(rows.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Verificación FFE Optativas: 40 UACs con metas y categorías pobladas (Neon DB)
  // --------------------------------------------------------------------------
  describe('3. FFE Optativas: 40 UACs con metas y categorías MCCEMS', () => {
    it('Existen 40 UACs en component = ffe_optativa', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE component = 'ffe_optativa'
      `;
      expect(rows.length).toBe(40);
    });

    it('0 UACs de optativas tienen metas o categorías vacías ([]) en sus progresiones', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE component = 'ffe_optativa'
      `;

      let emptyMetas = 0;
      let emptyCategorias = 0;

      for (const row of rows) {
        const cfs = parseJson<any[]>(row.contenidos_formativos, []);
        for (const cf of cfs) {
          if (!Array.isArray(cf.metas) || cf.metas.length === 0) emptyMetas++;
          if (!Array.isArray(cf.categorias) || cf.categorias.length === 0) emptyCategorias++;
        }
      }

      expect(emptyMetas).toBe(0);
      expect(emptyCategorias).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Verificación Bachillerato Tecnológico: 285 UACs / Submódulos (Neon DB)
  // --------------------------------------------------------------------------
  describe('4. Bachillerato Tecnológico: 285 submódulos y 0 con saberes vacíos', () => {
    it('Existen exactamente 285 submódulos laborales tecnológicos y ninguno tiene saberes: []', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos
        FROM programs_catalog
        WHERE subsystem = 'tecnologico' AND component = 'laboral'
      `;
      expect(rows.length).toBe(285);

      let emptySaberesCount = 0;

      for (const row of rows) {
        const contenidos = parseJson<any[]>(row.contenidos_formativos, []);
        if (Array.isArray(contenidos)) {
          for (const c of contenidos) {
            if (Array.isArray(c.saberes) && c.saberes.length === 0) emptySaberesCount++;
          }
        }
      }

      expect(emptySaberesCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Integridad global del catálogo: 498 UACs (Neon DB)
  // --------------------------------------------------------------------------
  describe('6. Integridad global del catálogo: 498 UACs y saberes completos', () => {
    it('El catálogo contiene exactamente 498 UACs y ninguna actividad vacía', async () => {
      const rows = await sql`
        SELECT id, uac_name, activities
        FROM programs_catalog
      `;
      expect(rows.length).toBe(498);

      const emptyActivities = rows.filter((row: any) => {
        const acts = parseJson<any[]>(row.activities, []);
        return !Array.isArray(acts) || acts.length === 0;
      });

      expect(emptyActivities.map((r: any) => r.uac_name)).toEqual([]);
    });

    it('Todas las actividades tienen saberes completos como objeto { saber, saberHacer, saberSer }', async () => {
      const rows = await sql`
        SELECT id, uac_name, activities
        FROM programs_catalog
      `;

      const invalid: string[] = [];
      for (const row of rows as any[]) {
        const acts = parseJson<any[]>(row.activities, []);
        for (const activity of acts) {
          const saberes = activity?.saberes;
          const valid =
            saberes &&
            !Array.isArray(saberes) &&
            typeof saberes === 'object' &&
            ['saber', 'saberHacer', 'saberSer'].every(
              (key) => typeof saberes[key] === 'string' && saberes[key].trim().length > 20,
            );
          if (!valid) invalid.push(`${row.uac_name} :: ${activity?.name || 'actividad sin nombre'}`);
        }
      }

      expect(invalid).toEqual([]);
    });

    it('Todos los contenidos formativos no vacíos tienen saberes completos', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos
        FROM programs_catalog
      `;

      const invalid: string[] = [];
      for (const row of rows as any[]) {
        const cfs = parseJson<any[]>(row.contenidos_formativos, []);
        for (const cf of cfs) {
          const saberes = cf?.saberes;
          const valid =
            saberes &&
            !Array.isArray(saberes) &&
            typeof saberes === 'object' &&
            ['saber', 'saberHacer', 'saberSer'].every(
              (key) => typeof saberes[key] === 'string' && saberes[key].trim().length > 20,
            );
          if (!valid) invalid.push(`${row.uac_name} :: contenido formativo sin saberes`);
        }
      }

      expect(invalid).toEqual([]);
    });

    it('No hay caracteres de reemplazo ni plantillas genéricas en el catálogo', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos::text AS cf_text, activities::text AS activities_text
        FROM programs_catalog
      `;

      const genericMarkers = [
        'Fundamentos técnicos y normativos de',
        'Prácticas estándar de aplicación para',
        'Fundamentos epistemológicos y conceptuales de',
        'Contenido pendiente',
        'Lorem ipsum',
      ];

      const contaminated = (rows as any[]).filter((row) => {
        const text = `${row.cf_text || ''}\n${row.activities_text || ''}`;
        return text.includes('\uFFFD') || genericMarkers.some((marker) => text.includes(marker));
      });

      expect(contaminated.map((r: any) => r.uac_name)).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Trazabilidad e inmutabilidad ISO (Fixture + Esquema/Trigger en Neon DB)
  // --------------------------------------------------------------------------
  describe('8. Trazabilidad de versiones y trigger/esquema ISO en Neon DB', () => {
    it('El trigger que impide mutar versiones de planeación existe en Neon DB', async () => {
      const rows = await sql`
        SELECT tgname, pg_get_triggerdef(oid) AS def
        FROM pg_trigger
        WHERE tgname = 'trg_prevent_planning_version_mutation'
      `;
      expect(rows.length).toBe(1);
      expect(String(rows[0].def)).toContain('BEFORE DELETE OR UPDATE ON public.planning_versions');
    });

    it('El esquema y restricciones ISO de planning_versions existen en Neon DB', async () => {
      const cols = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'planning_versions'
      `;
      const colNames = new Set(cols.map((c: any) => String(c.column_name)));
      for (const requiredCol of [
        'id',
        'planning_id',
        'teacher_id',
        'version_number',
        'snapshot_json',
        'sha256_hash',
        'anexo12_score',
        'dbepa_score',
        'change_summary',
        'created_at',
      ]) {
        expect(colNames.has(requiredCol)).toBe(true);
      }

      const constraints = await sql`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'planning_versions'::regclass
      `;
      const constraintNames = new Set(constraints.map((c: any) => String(c.conname)));
      expect(constraintNames.has('planning_versions_pkey')).toBe(true);
      expect(constraintNames.has('uq_planning_version')).toBe(true);
      expect(constraintNames.has('planning_versions_planning_id_fkey')).toBe(true);
      expect(constraintNames.has('planning_versions_teacher_id_fkey')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Auditoría viva opcional de las 5 muestras reales en Neon DB (RUN_LIVE_SAMPLE_AUDIT=1)
  // --------------------------------------------------------------------------
  describe.runIf(RUN_LIVE_SAMPLE_AUDIT)(
    '9. Auditoría viva opcional de muestras canónicas en Neon DB (RUN_LIVE_SAMPLE_AUDIT=1)',
    () => {
      it('Las 5 muestras canónicas residen en la cuenta admin con 270 sesiones, Anexo 12 = 100 y DBEPA verde', async () => {
        const ids = fixtureSamples.map((s) => s.id);
        const rows = await sql`
          SELECT id::text, teacher_id::text, content_json, sequence_json, workbooks_json
          FROM plannings
          WHERE id = ANY(${ids}::uuid[])
        `;
        expect(rows.length).toBe(5);

        let totalSessions = 0;
        for (const sample of fixtureSamples) {
          const row = (rows as any[]).find((r) => r.id === sample.id);
          expect(row).toBeDefined();
          expect(row.teacher_id).toBe(ADMIN_SHOWROOM_TEACHER_ID);

          const content = parseJson<Record<string, any>>(row.content_json, {});
          expect(content.anexo12Audit?.score).toBe(100);
          expect(content.anexo12Audit?.criticalFailures).toBe(0);
          expect(content.dbepaAudit?.semaforo).toBe('verde');

          const seq = parseJson<Record<string, any>>(row.sequence_json, {});
          const sessions = Object.values(seq).flatMap((b: any) => b.sessions || []);
          expect(sessions.length).toBe(sample.hours);
          totalSessions += sessions.length;
        }
        expect(totalSessions).toBe(270);
      });

      it('Existen exactamente 270 planes de clase en planning_extras para las 5 muestras en Neon DB', async () => {
        let totalPlans = 0;
        for (const sample of fixtureSamples) {
          const extraRows = await sql`
            SELECT count(*)::int AS cnt
            FROM planning_extras
            WHERE planning_id = ${sample.id}::uuid AND type = 'lesson_plan'
          `;
          const cnt = Number(extraRows[0]?.cnt || 0);
          expect(cnt).toBe(sample.hours);
          totalPlans += cnt;
        }
        expect(totalPlans).toBe(270);
      });

      it('Cada muestra en Neon DB conserva su historial ISO en planning_versions', async () => {
        for (const sample of fixtureSamples) {
          const rows = await sql`
            SELECT version_number, sha256_hash, anexo12_score
            FROM planning_versions
            WHERE planning_id = ${sample.id}::uuid
            ORDER BY version_number DESC
            LIMIT 1
          `;
          expect(rows.length).toBe(1);
          expect(Number(rows[0].version_number)).toBeGreaterThanOrEqual(1);
          expect(rows[0].sha256_hash).toMatch(/^[a-f0-9]{64}$/);
          expect(Number(rows[0].anexo12_score)).toBe(100);
        }
      });
    }
  );
});
