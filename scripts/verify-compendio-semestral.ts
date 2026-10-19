/**
 * verify-compendio-semestral.ts — Verificación E2E del Compendio Semestral
 * (Libro Maestro) descargado desde /api/pdf/libro-semestral.
 *
 * Uso:
 *   npx tsx scripts/verify-compendio-semestral.ts "<carpeta con el PDF>"
 *
 * Busca en la carpeta el archivo cuyo nombre empiece con "Libro_Maestro" y
 * verifica:
 *   1. Portada institucional con la UAC.
 *   2. Los 3 bloques (BLOQUE I / II / III) presentes.
 *   3. Divisores de sesión: cada número 1..24 aparece en los 3 bloques
 *      (numeración local por bloque; total de divisores = 72).
 *   4. Fase D: el flujo de sesión (EMPIEZA AQUI) se imprime en las 72 sesiones.
 *   5. Paridad libro ↔ planes: TODOS los enunciados de práctica de la BD
 *      (sessionPlans de workbooks_json) aparecen en el PDF.
 *
 * Sale con código != 0 si alguna verificación FALLA.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { neon } from '@neondatabase/serverless';

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
    // .env.local opcional
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

interface PracticeRow {
  block_index: string;
  session_number: number;
  enunciado: string;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Uso: npx tsx scripts/verify-compendio-semestral.ts "<carpeta con el PDF | ruta del PDF>"');
    process.exit(2);
  }

  // Acepta ruta directa al PDF o carpeta (excluye el libro editorial nuevo,
  // que también empieza con "Libro_Maestro" en la misma carpeta).
  let pdfPath: string;
  if (/\.pdf$/i.test(arg) && existsSync(arg)) {
    pdfPath = arg;
  } else {
    const candidates = readdirSync(arg).filter(
      (f) => f.toLowerCase().startsWith('libro_maestro') && f.toLowerCase().endsWith('.pdf'),
    );
    const file = candidates.find((f) => !f.toLowerCase().includes('editorial')) ?? candidates[0];
    if (!file) {
      console.error(`No se encontró ningún PDF que empiece con "Libro_Maestro" en: ${arg}`);
      process.exit(2);
    }
    pdfPath = join(arg, file);
  }
  console.log(`PDF: ${basename(pdfPath)}`);

  const failures: string[] = [];
  const infos: string[] = [];

  // ── 1. Extraer texto del PDF ──
  const buf = readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = fold(parsed.text);
  console.log(`Texto extraído: ${text.length} caracteres normalizados`);

  // ── 2. Portada ──
  if (text.slice(0, 3000).includes('PENSAMIENTO MATEMAT')) {
    infos.push('OK  portada: la UAC aparece en la primera página');
  } else {
    failures.push('FAIL portada: no se encontró la UAC en la primera página');
  }

  // ── 3. Los 3 bloques ──
  for (const [roman, label] of [['I', 'BLOQUE I'], ['II', 'BLOQUE II'], ['III', 'BLOQUE III']] as const) {
    if (new RegExp(`${label}:`).test(text)) infos.push(`OK  ${label} presente (índice/encabezado)`);
    else if (text.includes(`[BLOQUE ${roman}]`)) infos.push(`OK  ${label} presente ([Bloque ${roman}] en índice)`);
    else failures.push(`FAIL ${label} no aparece en el documento`);
  }

  // ── 4. Divisores de sesión (SESION n) ──
  const dividerCounts = new Map<number, number>();
  for (const m of text.matchAll(/SESION (\d+)\b/g)) {
    const n = parseInt(m[1], 10);
    dividerCounts.set(n, (dividerCounts.get(n) || 0) + 1);
  }
  const missing: number[] = [];
  let totalDividers = 0;
  let outOfRange = 0;
  for (let n = 1; n <= 24; n++) {
    const c = dividerCounts.get(n) || 0;
    totalDividers += c;
    if (c === 0) missing.push(n);
  }
  for (const [n, c] of dividerCounts) if (n > 24) outOfRange += c;
  if (missing.length === 0) {
    infos.push(`OK  divisores: sesiones 1..24 presentes (total de divisores detectados: ${totalDividers}; se esperan ~72 = 24 por bloque × 3)`);
  } else {
    failures.push(`FAIL divisores: faltan las sesiones locales ${missing.join(', ')}`);
  }
  if (outOfRange > 0) {
    failures.push(`FAIL divisores: se detectaron ${outOfRange} divisores con número fuera de 1..24 (numeración inesperada)`);
  }

  // ── 5. Fase D: flujo de sesión completo en cada sesión ──
  const flows = (text.match(/EMPIEZA AQUI/g) || []).length;
  if (flows === 72) {
    infos.push('OK  fase D: 72 flujos EMPIEZA AQUI (uno por sesión de los 3 bloques)');
  } else {
    failures.push(`FAIL fase D: se esperaban 72 flujos EMPIEZA AQUI y se encontraron ${flows}`);
  }
  const products = (text.match(/TU PRODUCTO/g) || []).length;
  infos.push(`info flujos TU PRODUCTO detectados: ${products} (esperado 72)`);

  // ── 6. Paridad: enunciados de la BD presentes en el PDF ──
  loadEnvLocal();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    failures.push('FAIL paridad: DATABASE_URL no disponible (.env.local)');
  } else {
    const sql = neon(dbUrl);
    const rows = (await sql`
      SELECT e.k AS block_index, (p->>'sessionNumber')::int AS session_number, pr->>'enunciado' AS enunciado
      FROM plannings,
           LATERAL jsonb_each(workbooks_json) e(k, v),
           LATERAL jsonb_array_elements(v->'current'->'missions') m(value),
           LATERAL jsonb_array_elements(m.value->'sessionPlans') p,
           LATERAL jsonb_array_elements(p->'practica') pr
      WHERE id = '90da0b02-1946-41d6-83c0-2334569cd632'
        AND v ? 'current'
    `) as unknown as PracticeRow[];

    const missingEx: string[] = [];
    let checked = 0;
    for (const r of rows) {
      const needle = fold(r.enunciado);
      if (needle.length < 30) continue;
      checked++;
      const probe = needle.length > 60 ? needle.slice(0, 60) : needle;
      if (!text.includes(probe)) {
        missingEx.push(`[${r.block_index} S${r.session_number}] ${needle.slice(0, 70)}…`);
      }
    }
    if (checked === 0) {
      failures.push('FAIL paridad: no se obtuvieron enunciados de la BD');
    } else if (missingEx.length === 0) {
      infos.push(`OK  paridad: los ${checked} enunciados de práctica de la BD aparecen en el PDF`);
    } else {
      failures.push(`FAIL paridad: ${missingEx.length} de ${checked} enunciados NO aparecen en el PDF. Primeros:`);
      for (const e of missingEx.slice(0, 10)) failures.push(`     - ${e}`);
    }
  }

  // ── Reporte ──
  console.log('\n──────── RESULTADOS ────────');
  for (const i of infos) console.log(i);
  for (const f of failures) console.log(f);
  console.log(`\n${failures.length === 0 ? '✅ VERIFICACIÓN EXITOSA' : `❌ ${failures.length} VERIFICACIONES FALLARON`}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
