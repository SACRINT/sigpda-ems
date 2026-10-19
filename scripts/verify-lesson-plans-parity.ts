/**
 * verify-lesson-plans-parity.ts — Paridad BD ↔ PDFs de los 72 Planes de Clase.
 *
 * Verifica que cada PDF descargado en las subcarpetas
 *   Planes_de_Clase_Bloque_{1,2,3}_pensamiento_matematico_iii_pen_PDF
 * contenga TODOS los enunciados de práctica y las pistas de su sesión
 * (numeración local 1..24 por bloque) tal como están en workbooks_json.
 *
 * Uso:
 *   npx tsx scripts/verify-lesson-plans-parity.ts "<carpeta Libros Planeaciones 2026>" [planningId]
 *
 * Sale con código != 0 si algo FALLA.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { neon } from '@neondatabase/serverless';
import { stripMaterialTokens } from '../src/lib/materials/material-tokens';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // opcional
  }
}

const fold = (s: string): string =>
  s
    .replace(/[*#_`~]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

interface PlanRow {
  block_index: string;
  session_number: number;
  enunciado: string;
  pista: string | null;
}

async function main(): Promise<void> {
  const baseDir = process.argv[2];
  if (!baseDir) {
    console.error('Uso: npx tsx scripts/verify-lesson-plans-parity.ts "<carpeta Libros Planeaciones 2026>" [planningId]');
    process.exit(2);
  }
  const planningId = process.argv[3] || '90da0b02-1946-41d6-83c0-2334569cd632';
  loadEnvLocal();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no disponible (.env.local)');
  const sql = neon(dbUrl);

  const failures: string[] = [];
  const infos: string[] = [];

  // ── 1. BD: enunciados y pistas por (bloque, sesión local) ──
  const rows = (await sql`
    SELECT e.k AS block_index, (p->>'sessionNumber')::int AS session_number,
           pr->>'enunciado' AS enunciado, pr->>'pista' AS pista
    FROM plannings,
         LATERAL jsonb_each(workbooks_json) e(k, v),
         LATERAL jsonb_array_elements(v->'current'->'missions') m(value),
         LATERAL jsonb_array_elements(m.value->'sessionPlans') p,
         LATERAL jsonb_array_elements(p->'practica') pr
    WHERE id = ${planningId}
      AND v ? 'current'
  `) as unknown as PlanRow[];
  if (rows.length === 0) {
    console.error('La BD no devolvió prácticas para la planeación.');
    process.exit(2);
  }

  const byBlock = new Map<number, Map<number, { enunciados: string[]; pistas: string[] }>>();
  for (const r of rows) {
    const b = Number(r.block_index.replace('block_', ''));
    if (!byBlock.has(b)) byBlock.set(b, new Map());
    const sess = byBlock.get(b)!;
    if (!sess.has(r.session_number)) sess.set(r.session_number, { enunciados: [], pistas: [] });
    // La BD puede contener tokens [[material:...]] (reparación IA); los PDFs de
    // planes imprimen la etiqueta humana → strippear ANTES de comparar.
    const e = fold(stripMaterialTokens(r.enunciado));
    if (e.length >= 30) sess.get(r.session_number)!.enunciados.push(e);
    const p = fold(stripMaterialTokens(r.pista || ''));
    if (p.length >= 20) sess.get(r.session_number)!.pistas.push(p);
  }

  // ── 2. Por cada bloque: localizar los 24 PDFs y comparar ──
  let totalEnunciados = 0;
  let totalPistas = 0;
  for (const b of [0, 1, 2]) {
    const folder = join(baseDir, `Planes_de_Clase_Bloque_${b + 1}_pensamiento_matematico_iii_pen_PDF`);
    let files: string[];
    try {
      files = readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.pdf'));
    } catch {
      failures.push(`FAIL carpeta no encontrada: ${folder}`);
      continue;
    }

    const fileBySession = new Map<number, string>();
    for (const f of files) {
      const m = f.match(/sesion_(\d+)_/i);
      if (m) fileBySession.set(parseInt(m[1], 10), f);
    }
    const missingFiles: number[] = [];
    for (let n = 1; n <= 24; n++) if (!fileBySession.has(n)) missingFiles.push(n);
    if (missingFiles.length > 0) {
      failures.push(`FAIL Bloque ${b + 1}: faltan PDFs de las sesiones locales ${missingFiles.join(', ')}`);
    } else {
      infos.push(`OK  Bloque ${b + 1}: 24/24 PDFs presentes`);
    }

    const sess = byBlock.get(b) ?? new Map();
    for (const [n, exp] of [...sess.entries()].sort((x, y) => x[0] - y[0])) {
      const file = fileBySession.get(n);
      if (!file) continue;
      const buf = readFileSync(join(folder, file));
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const parsed = await parser.getText();
      await parser.destroy();
      const text = fold(parsed.text);

      for (const enun of exp.enunciados) {
        totalEnunciados++;
        const probe = enun.slice(0, 60);
        if (!text.includes(probe)) {
          failures.push(`FAIL [Bloque ${b + 1} S${n}] enunciado ausente en ${file}: ${enun.slice(0, 70)}…`);
        }
      }
      for (const pist of exp.pistas) {
        totalPistas++;
        const probe = pist.slice(0, 40);
        if (!text.includes(probe)) {
          failures.push(`FAIL [Bloque ${b + 1} S${n}] pista ausente en ${file}: ${pist.slice(0, 70)}…`);
        }
      }
    }
  }

  if (totalEnunciados === 0) {
    failures.push('FAIL no se evaluó ningún enunciado (BD vacía)');
  } else {
    infos.push(`OK  paridad: ${totalEnunciados} enunciados y ${totalPistas} pistas evaluados contra los PDFs`);
  }

  console.log('──────── RESULTADOS (paridad planes de clase) ────────');
  for (const i of infos) console.log(i);
  for (const f of failures) console.log(f);
  console.log(`\n${failures.length === 0 ? '✅ PARIDAD EXITOSA' : `❌ ${failures.length} PROBLEMAS`}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
