/**
 * sync-bge-contenidos-formativos.ts — Puebla `contenidos_formativos` de las
 * 120 UAC de Formación Laboral BGE a partir de sus 3 actividades oficiales.
 *
 * No usa IA ni inventa contenido: replica temas, saberes y horas ya persistidos
 * en `activities` (fuente oficial PDF 2024) al formato canónico de contenidos.
 *
 * Uso:
 *   npx tsx scripts/sync-bge-contenidos-formativos.ts
 *   npx tsx scripts/sync-bge-contenidos-formativos.ts --apply
 */

import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const APPLY = process.argv.includes('--apply');

interface Saberes {
  saber?: string;
  saberHacer?: string;
  saberSer?: string;
}

interface Activity {
  name?: string;
  hours?: number;
  order?: number;
  temas?: string[];
  saberes?: Saberes;
}

interface Row {
  id: string;
  uac_name: string;
  activities: Activity[];
  contenidos_formativos: unknown;
}

interface FormativeContent {
  corte: string;
  horas: number;
  orden: number;
  actividad: string;
  contenidoFormativo: string;
  temas: string[];
  saberes: Saberes;
  fuente: 'official_pdf_2024';
  needs_review: false;
}

function buildContents(row: Row): FormativeContent[] {
  return row.activities.map((activity, index) => {
    const orden = activity.order ?? index + 1;
    const temas = Array.isArray(activity.temas) ? activity.temas.filter(Boolean) : [];
    const saberes = activity.saberes ?? {};
    const actividad = (activity.name ?? '').trim();

    if (!actividad) throw new Error(`${row.uac_name}: actividad sin nombre en orden ${orden}`);
    if (temas.length === 0) throw new Error(`${row.uac_name}: actividad "${actividad}" sin temas`);
    if (!saberes.saber || !saberes.saberHacer || !saberes.saberSer) {
      throw new Error(`${row.uac_name}: actividad "${actividad}" con saberes incompletos`);
    }

    return {
      corte: `Corte ${orden}`,
      horas: 18,
      orden,
      actividad,
      contenidoFormativo: actividad,
      temas: [...temas],
      saberes: {
        saber: saberes.saber,
        saberHacer: saberes.saberHacer,
        saberSer: saberes.saberSer,
      },
      fuente: 'official_pdf_2024',
      needs_review: false,
    };
  });
}

async function main(): Promise<void> {
  console.log(`=== SYNC BGE CONTENIDOS FORMATIVOS (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);

  const rows = (await sql`
    SELECT id, uac_name, activities, contenidos_formativos
    FROM programs_catalog
    WHERE subsystem = 'bge' AND component = 'laboral'
    ORDER BY uac_name
  `) as unknown as Row[];

  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];
  const pending: Array<{ id: string; next: string }> = [];

  for (const row of rows) {
    if (!Array.isArray(row.activities) || row.activities.length !== 3) {
      errors.push(`${row.uac_name}: se esperaban 3 actividades, hay ${row.activities?.length ?? 0}`);
      continue;
    }

    let contents: FormativeContent[];
    try {
      contents = buildContents(row);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }

    const current = JSON.stringify(row.contenidos_formativos);
    const next = JSON.stringify(contents);
    if (current === next) {
      unchanged++;
      continue;
    }

    pending.push({ id: row.id, next });
    updated++;
  }

  console.log(
    JSON.stringify(
      {
        totalBgeLaboral: rows.length,
        updated,
        unchanged,
        errors: errors.length,
      },
      null,
      2
    )
  );

  if (errors.length > 0) {
    for (const error of errors.slice(0, 20)) console.error(`[ERROR] ${error}`);
    if (errors.length > 20) console.error(`... y ${errors.length - 20} errores más.`);
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDry-run: no se escribió nada. Ejecuta con --apply para aplicar.');
    return;
  }

  const backup = `programs_catalog_backup_bge_cf_${Date.now()}`;
  await sql.query(`CREATE TABLE ${backup} AS SELECT * FROM programs_catalog`);
  console.log(`Respaldo creado: ${backup}`);

  for (const item of pending) {
    await sql`
      UPDATE programs_catalog
      SET contenidos_formativos = ${item.next}::jsonb
      WHERE id = ${item.id}
    `;
  }

  console.log(`Actualizadas ${updated} UAC; ${unchanged} ya estaban sincronizadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
