import { loadEnvLocal } from './lib/load-env';

loadEnvLocal();

import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { validateAnexo12 } from '../src/lib/planning/anexo12-validator';
import { evaluateDBEPA } from '../src/lib/planning/dbepa-quality-gate';
import { computeCanonicalSha256 } from '../src/lib/planning/planning-versions';

const ADMIN_TEACHER_ID = 'e2bf54f5-4f52-4d2b-a58e-10346ebee53d';

const CANONICAL_META = [
  {
    id: '18016fa8-7a96-4d89-b693-47788285560e',
    shortName: 'Lenguaje y Comunicación I',
    hours: 54,
    component: 'fundamental',
  },
  {
    id: 'cc626dd9-9a8a-442a-ab25-532d485d6b36',
    shortName: 'Ciencias Naturales I',
    hours: 72,
    component: 'fundamental',
  },
  {
    id: '57484f68-811a-485e-817e-f68ff0c92fe8',
    shortName: 'Ciencias sociales I',
    hours: 36,
    component: 'fundamental',
  },
  {
    id: '7a1e4e19-efa3-40eb-b819-dd604d742cbf',
    shortName: 'Inglés I',
    hours: 54,
    component: 'fundamental',
  },
  {
    id: 'd944cd30-7fb6-4e3d-a7a6-db48caa78973',
    shortName: 'Actualiza equipos de cómputo',
    hours: 54,
    component: 'laboral',
  },
] as const;

function parseJson<T>(value: unknown): T {
  return typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required to export canonical samples.');
  }

  const sql = neon(dbUrl);
  const ids = CANONICAL_META.map((m) => m.id);

  const plannings = (await sql`
    SELECT id::text, teacher_id::text, uac_name, semester, component,
           content_json, sequence_json, workbooks_json
    FROM plannings
    WHERE id = ANY(${ids}::uuid[])
  `) as Array<{
    id: string;
    teacher_id: string;
    uac_name: string;
    semester: number;
    component: string;
    content_json: unknown;
    sequence_json: unknown;
    workbooks_json: unknown;
  }>;

  const extras = (await sql`
    SELECT planning_id::text, type, key_index, title, content_text
    FROM planning_extras
    WHERE planning_id = ANY(${ids}::uuid[]) AND type = 'lesson_plan'
    ORDER BY planning_id, key_index
  `) as Array<{
    planning_id: string;
    type: string;
    key_index: number;
    title: string;
    content_text: string;
  }>;

  const versions = (await sql`
    SELECT DISTINCT ON (planning_id)
      planning_id::text,
      version_number,
      sha256_hash,
      anexo12_score,
      dbepa_score
    FROM planning_versions
    WHERE planning_id = ANY(${ids}::uuid[])
    ORDER BY planning_id, version_number DESC
  `) as Array<{
    planning_id: string;
    version_number: number;
    sha256_hash: string;
    anexo12_score: number;
    dbepa_score: number;
  }>;

  if (plannings.length !== 5) {
    throw new Error(`Expected 5 canonical plannings in Neon DB, found ${plannings.length}`);
  }

  const samples = CANONICAL_META.map((meta) => {
    const row = plannings.find((p) => p.id === meta.id);
    if (!row) {
      throw new Error(`Missing canonical planning ${meta.id}`);
    }
    if (row.teacher_id !== ADMIN_TEACHER_ID) {
      throw new Error(
        `Expected ${meta.id} to belong to admin (${ADMIN_TEACHER_ID}), got ${row.teacher_id}`
      );
    }

    const contentJson = parseJson<Record<string, unknown>>(row.content_json);
    const sequenceJson = parseJson<Record<string, unknown>>(row.sequence_json);
    const workbooksJson = parseJson<Record<string, unknown>>(row.workbooks_json);
    const lessonPlans = extras.filter((e) => e.planning_id === meta.id);
    const latestVersion = versions.find((v) => v.planning_id === meta.id);

    if (!latestVersion) {
      throw new Error(`Missing planning_versions row for ${meta.id}`);
    }

    const a12 = validateAnexo12(contentJson as never);
    const dbepa = evaluateDBEPA(contentJson as never);
    const sha256 = computeCanonicalSha256(contentJson);

    if (!a12.ok || a12.score !== 100 || a12.criticalFailures !== 0) {
      throw new Error(`Anexo 12 validation failed for ${meta.id}: ${JSON.stringify(a12)}`);
    }
    if (dbepa.semaforo !== 'verde' || dbepa.score < 96) {
      throw new Error(`DBEPA validation failed for ${meta.id}: ${JSON.stringify(dbepa)}`);
    }
    if (lessonPlans.length !== meta.hours) {
      throw new Error(`Expected ${meta.hours} lesson_plan rows for ${meta.id}, got ${lessonPlans.length}`);
    }

    console.log(
      `[VERIFIED] ${meta.id} | ${row.uac_name} | hours=${meta.hours} | plans=${lessonPlans.length} | Anexo12=${a12.score} | DBEPA=${dbepa.semaforo}(${dbepa.score}) | v${latestVersion.version_number} | SHA=${sha256.slice(0, 12)}...`
    );

    return {
      id: row.id,
      shortName: meta.shortName,
      uac_name: row.uac_name,
      semester: row.semester,
      component: meta.component,
      hours: meta.hours,
      content_json: contentJson,
      sequence_json: sequenceJson,
      workbooks_json: workbooksJson,
      lesson_plans: lessonPlans.map((lp) => ({
        key_index: lp.key_index,
        title: lp.title,
        content_text: lp.content_text,
      })),
      latest_version: {
        version_number: Number(latestVersion.version_number),
        sha256_hash: latestVersion.sha256_hash,
        anexo12_score: Number(latestVersion.anexo12_score),
        dbepa_score: Number(latestVersion.dbepa_score),
      },
    };
  });

  const fixturePath = path.resolve(
    process.cwd(),
    'src',
    '__tests__',
    'fixtures',
    'canonical-samples.json'
  );
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  const fixtureContent = JSON.stringify({ samples }, null, 2);
  fs.writeFileSync(fixturePath, fixtureContent, 'utf8');

  const sizeKb = (Buffer.byteLength(fixtureContent, 'utf8') / 1024).toFixed(1);
  console.log(`Exported ${samples.length} canonical samples to ${fixturePath} (${sizeKb} KB).`);
}

main().catch((err) => {
  console.error('Failed to export canonical samples:', err);
  process.exit(1);
});

