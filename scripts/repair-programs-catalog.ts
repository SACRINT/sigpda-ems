/**
 * repair-programs-catalog.ts — Saneamiento conservador del catálogo curricular.
 *
 * Problemas detectados en la auditoría:
 *  - Cadenas corruptas de extracción BT con secuencias "X X X ..." y fragmentos
 *    de tabla ("Configura", "hardware y").
 *  - UAC laborales BGE con `contenidos_formativos = null` aunque tienen
 *    `activities` con nombre y horas.
 *
 * Este script NO inventa contenido técnico. Solo:
 *  1. Limpia ruido de extracción (X repetidas, espacios, tokens vacíos).
 *  2. Deriva `contenidos_formativos` de `activities` cuando es null (mapeo
 *     estructural: actividad + saberes existentes).
 *  3. Reporta filas que requieren revisión humana (fragmentos no reconstruibles).
 *
 * Uso:
 *   npx tsx scripts/repair-programs-catalog.ts            # dry-run
 *   npx tsx scripts/repair-programs-catalog.ts --apply    # aplica + respaldo
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

type Json = unknown;

interface Row {
  id: string;
  uac_name: string;
  semester: number | null;
  component: string | null;
  subsystem: string | null;
  activities: Json;
  contenidos_formativos: Json;
}

const X_RUN = /\bX(?:\s+X)+\b/gi;
const X_RUN_TEST = /\bX(?:\s+X)+\b/i;
const SUSPICIOUS_FRAGMENT = /^(configura|hardware y|software y|y|prepara el área de trabajo, dispositivos)$/i;

function cleanString(value: string): string {
  return value
    .replace(X_RUN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function cleanDeep(value: Json): Json {
  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [key, inner] of Object.entries(value as Record<string, Json>)) {
      out[key] = cleanDeep(inner);
    }
    return out;
  }
  return value;
}

function hasXRun(value: Json): boolean {
  return JSON.stringify(value ?? '').match(X_RUN) !== null;
}

function deriveContenidosFromActivities(activities: Json): Json | null {
  if (!Array.isArray(activities) || activities.length === 0) return null;
  const derived = activities
    .map((activity, index) => {
      if (!activity || typeof activity !== 'object') return null;
      const record = activity as Record<string, Json>;
      const name = cleanString(String(record.name ?? record.actividad ?? ''));
      if (name.length < 5) return null;
      const saberes = Array.isArray(record.saberes)
        ? record.saberes.map((s) => (typeof s === 'string' ? cleanString(s) : '')).filter(Boolean)
        : [];
      return {
        order: Number(record.order ?? index + 1) || index + 1,
        actividad: name,
        saberes,
        source: 'activities_mirror',
        needs_review: true,
      };
    })
    .filter(Boolean);
  return derived.length > 0 ? derived : null;
}

function collectSuspiciousFragments(value: Json, out: string[]): void {
  if (typeof value === 'string') {
    const text = value.trim();
    if (SUSPICIOUS_FRAGMENT.test(text) || X_RUN_TEST.test(text)) {
      out.push(text);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSuspiciousFragments(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value as Record<string, Json>)) collectSuspiciousFragments(inner, out);
  }
}

async function main(): Promise<void> {
  console.log(`=== REPARACIÓN DE programs_catalog (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  const rows = (await sql`
    SELECT id, uac_name, semester, component, subsystem, activities, contenidos_formativos
    FROM programs_catalog
    ORDER BY component, semester, uac_name
  `) as unknown as Row[];

  let cleaned = 0;
  let nullDerived = 0;
  let needsReview = 0;
  let unchanged = 0;
  const review: Array<{ id: string; uac: string; fragments: string[] }> = [];
  const updates: Array<{ id: string; activities: Json; contenidos: Json; uac: string }> = [];

  for (const row of rows) {
    const activities = cleanDeep(row.activities);
    let contenidos = cleanDeep(row.contenidos_formativos);
    const changedActivities = JSON.stringify(activities) !== JSON.stringify(row.activities);
    const changedContenidos = JSON.stringify(contenidos) !== JSON.stringify(row.contenidos_formativos);

    if (contenidos == null && /laboral/i.test(row.component ?? '')) {
      const derived = deriveContenidosFromActivities(activities);
      if (derived) {
        contenidos = derived;
        nullDerived++;
      }
    }

    const fragments: string[] = [];
    collectSuspiciousFragments(activities, fragments);
    collectSuspiciousFragments(contenidos, fragments);
    if (fragments.length > 0) {
      needsReview++;
      review.push({ id: row.id, uac: row.uac_name, fragments: [...new Set(fragments)].slice(0, 8) });
    }

    const changed = changedActivities || changedContenidos || (row.contenidos_formativos == null && contenidos != null);
    if (!changed) {
      unchanged++;
      continue;
    }
    if (changedActivities || changedContenidos || hasXRun(row.activities) || hasXRun(row.contenidos_formativos)) {
      cleaned++;
    }
    updates.push({ id: row.id, activities, contenidos, uac: row.uac_name });
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        updates: updates.length,
        cleanedWithXRuns: cleaned,
        nullContentsDerived: nullDerived,
        needsHumanReview: needsReview,
        unchanged,
      },
      null,
      2
    )
  );

  if (review.length > 0) {
    console.log('\n--- FILAS QUE REQUIEREN REVISIÓN HUMANA (no se inventa contenido) ---');
    for (const item of review.slice(0, 40)) {
      console.log(`- ${item.id} | ${item.uac.slice(0, 80)} | fragmentos: ${item.fragments.join(' / ')}`);
    }
    if (review.length > 40) console.log(`... y ${review.length - 40} más.`);
  }

  if (!APPLY) {
    console.log('\nDry-run: no se escribió nada. Ejecuta con --apply para aplicar (crea respaldo).');
    return;
  }

  if (updates.length === 0) {
    console.log('\nNada que actualizar.');
    return;
  }

  const backup = `programs_catalog_backup_p0_${Date.now()}`;
  await sql.query(`CREATE TABLE ${backup} AS SELECT * FROM programs_catalog`);
  console.log(`\nRespaldo creado: ${backup}`);

  for (const update of updates) {
    const activitiesJson = JSON.stringify(update.activities);
    const contenidosJson = update.contenidos == null ? null : JSON.stringify(update.contenidos);
    await sql`
      UPDATE programs_catalog
      SET activities = ${activitiesJson}::jsonb,
          contenidos_formativos = ${contenidosJson}::jsonb
      WHERE id = ${update.id}
    `;
  }
  console.log(`Actualizadas ${updates.length} filas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
