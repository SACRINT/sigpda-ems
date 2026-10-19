/**
 * verify-editorial-book-vs-plans.ts — Libro Editorial (PDF) ↔ 72 Planes (BD).
 *
 * Compara el PDF exportado con el botón "Exportar Libro Editorial" contra la
 * fuente de verdad de los 72 sessionPlans (workbooks_json):
 *   1. 72 sesiones presentes (badge SISIÓN por sesión).
 *   2. Objetivo de cada sesión contenido en el libro (alineación de contenido).
 *   3. 1er enunciado de práctica de cada sesión contenido en el libro.
 *   4. TÍTULOS COMPLETOS: "Sesión N: <objetivo completo>" (detecta el corte
 *      histórico de 60 caracteres → marca PENDIENTE hasta re-exportar).
 *   5. Zona escolar correcta (esperada: 086 para CCT 21EBH0200X).
 *   6. Cero tokens crudos [[material:...]] y cero emojis/tofu en el texto.
 *
 * Notas de comparación (replican el runtime del compose):
 *   - Los planes de la BD usan numeración LOCAL por bloque (1..24); el libro
 *     imprime numeración GLOBAL con `remapSessionReferences(offset)` — idéntico
 *     al de src/lib/editorial/student-content-model.ts.
 *   - fold() insensitivo a acentos/puntuación/glifos de control para tolerar
 *     artefactos de extracción de pdf-parse (minus "−" → \u0016, guiones de
 *     corte, etc.) sin perder precisión de contenido.
 *
 * Uso:
 *   npx tsx scripts/verify-editorial-book-vs-plans.ts "<ruta PDF libro>" [planningId] [zonaEsperada]
 *
 * Exit code 0 = TODO alineado y sin defectos de formato.
 */
import { readFileSync } from 'node:fs';
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

/**
 * Normaliza para comparación: sin acentos, puntuación, símbolos, emojis ni
 * caracteres de control (artefactos de extracción de pdf-parse); espacios
 * colapsados. Se aplica a AMBOS lados → cualquier diferencia subsiste solo si
 * es de contenido real.
 */
const fold = (s: string): string =>
  s
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9A-Za-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

// ── Réplica exacta de remapSessionReferences (student-content-model.ts) ─────
const SESSION_NUM_EXPR_SRC =
  '\\d{1,2}(?!\\d)(?:\\s*(?:[,y]\\s*|a(?:\\s+la)?\\s+|al\\s+|hasta(?:\\s+la)?\\s+|[-–—])\\s*\\d{1,2}(?!\\d))*';
const SESSION_REF_REGEX = new RegExp(`(sesi(?:ón|ones|on)\\b\\s*)(${SESSION_NUM_EXPR_SRC})`, 'gi');

function remapSessionReferences(text: string, offset: number): string {
  if (!offset || !text) return text;
  return text.replace(SESSION_REF_REGEX, (_full, prefix: string, numExpr: string) => {
    const remapped = numExpr.replace(/\d{1,2}/g, (digit) => {
      const v = Number(digit);
      const target = v + offset;
      return v >= 1 && v <= 24 && target >= 1 && target <= 72 ? String(target) : digit;
    });
    return `${prefix}${remapped}`;
  });
}

interface PlanRow {
  block_index: string;
  session_number: number;
  objetivo: string;
  enunciado: string | null;
}

/**
 * Contención tolerante a guionación de línea del PDF: si la frase estricta no
 * aparece, prueba sin espacios (pdf-parse parte palabras en "POLIVA LENTE").
 * Un solo camino de fallback para no debilitar la detección de contenido real.
 */
const contained = (bookFold: string, phraseFold: string): boolean =>
  bookFold.includes(phraseFold) ||
  (phraseFold.length >= 30 && bookFold.replace(/ /g, '').includes(phraseFold.replace(/ /g, '')));

async function main(): Promise<void> {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error(
      'Uso: npx tsx scripts/verify-editorial-book-vs-plans.ts "<ruta PDF libro editorial>" [planningId] [zonaEsperada]',
    );
    process.exit(2);
  }
  const planningId = process.argv[3] || '90da0b02-1946-41d6-83c0-2334569cd632';
  const zonaEsperada = process.argv[4] || '086';

  loadEnvLocal();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL no disponible (.env.local)');
  const sql = neon(dbUrl);

  // ── 1. Texto del libro ───────────────────────────────────────────────────
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(pdfPath)) });
  const pdfResult = await parser.getText();
  await parser.destroy();
  const bookRaw = pdfResult.text;
  const book = fold(bookRaw);
  console.log(`Libro: ${pdfPath}`);
  console.log(`Texto extraído: ${bookRaw.length.toLocaleString('es-MX')} caracteres\n`);

  // ── 2. BD: planes ordenados por posición global (igual que el compose) ──
  const rows = (await sql`
    SELECT e.k AS block_index, (p->>'sessionNumber')::int AS session_number,
           p->>'objetivo' AS objetivo,
           (SELECT pr->>'enunciado'
              FROM jsonb_array_elements(p->'practica') pr
             ORDER BY 1 LIMIT 1) AS enunciado
    FROM plannings,
         LATERAL jsonb_each(workbooks_json) e(k, v),
         LATERAL jsonb_array_elements(v->'current'->'missions') m(value),
         LATERAL jsonb_array_elements(m.value->'sessionPlans') p
    WHERE id = ${planningId}
      AND v ? 'current'
    ORDER BY (replace(e.k, 'block_', ''))::int, (p->>'sessionNumber')::int
  `) as unknown as PlanRow[];
  if (rows.length !== 72) {
    console.error(`FAIL: la BD devolvió ${rows.length} planes (esperados 72).`);
    process.exit(1);
  }

  const failures: string[] = [];
  const pendings: string[] = [];

  // ── 3. Sesiones presentes ────────────────────────────────────────────────
  const badges = new Set<number>();
  for (const m of bookRaw.matchAll(/SESI[ÓO]N\s+(\d+)/gi)) badges.add(Number(m[1]));
  const faltantes = Array.from({ length: 72 }, (_, i) => i + 1).filter((n) => !badges.has(n));
  if (faltantes.length > 0) failures.push(`FAIL sesiones sin badge en el libro: ${faltantes.join(', ')}`);
  else console.log('OK  Sesiones: 72/72 con badge SISIÓN en el libro');

  // ── 4. Objetivos, prácticas y títulos (con remap local→global) ───────────
  let titulosCompletos = 0;
  const truncados: number[] = [];
  const objetivoFaltante: number[] = [];
  const enunciadoFaltante: number[] = [];

  rows.forEach((row, idx) => {
    const globalN = idx + 1; // numeración global 1..72 (posición, como el compose)
    const offset = globalN - row.session_number;
    // La BD puede contener tokens [[material:...]] (reparación IA); el libro los
    // strippea a etiqueta humana vía adapt() → replicar ANTES de comparar.
    const objetivo = stripMaterialTokens(row.objetivo || '');

    // Objetivo alineado (banner/Mapa llevan el objetivo REMAPEADO a global)
    const objLibro = fold(remapSessionReferences(objetivo, offset));
    if (objLibro && !contained(book, objLibro)) objetivoFaltante.push(globalN);

    // Enunciado de práctica (1er ejercicio), también remapeado
    const enf = row.enunciado ? fold(remapSessionReferences(stripMaterialTokens(row.enunciado), offset)) : '';
    if (enf.length >= 30 && !contained(book, enf)) enunciadoFaltante.push(globalN);

    // Título: se construye en LOCAL (como adapt()), se remapea y se fuerza el
    // prefijo a la numeración global (como compose-student-sessions.ts).
    const localLimpio = objetivo.replace(/\s+/g, ' ').trim().replace(/[.:;,]+$/, '');
    const tituloCompleto = remapSessionReferences(`Sesión ${row.session_number}: ${localLimpio}`, offset)
      .replace(/^Sesión \d+:\s*/, `Sesión ${globalN}: `);
    const tituloLegacy =
      remapSessionReferences(
        `Sesión ${row.session_number}: ${objetivo.slice(0, 60).replace(/[.:]+$/, '')}`,
        offset,
      ).replace(/^Sesión \d+:\s*/, `Sesión ${globalN}: `);

    if (contained(book, fold(tituloCompleto))) {
      titulosCompletos++;
    } else if (contained(book, fold(tituloLegacy))) {
      truncados.push(globalN);
    } else {
      truncados.push(globalN); // ni completo ni por el corte viejo → también pendiente
    }
  });

  if (objetivoFaltante.length > 0)
    failures.push(`FAIL objetivos NO encontrados en el libro (${objetivoFaltante.length}): ${objetivoFaltante.join(', ')}`);
  else console.log('OK  Objetivos: 72/72 alineados (libro ↔ planes)');

  if (enunciadoFaltante.length > 0)
    failures.push(`FAIL enunciados de práctica NO encontrados (${enunciadoFaltante.length}): ${enunciadoFaltante.join(', ')}`);
  else console.log('OK  Prácticas: 72/72 1er enunciado alineado (libro ↔ planes)');

  if (titulosCompletos === 72) console.log('OK  Títulos: 72/72 COMPLETOS ("Sesión N: objetivo")');
  else
    pendings.push(
      `PENDIENTE RE-EXPORT: ${truncados.length} títulos incompletos/cortados (libro generado con TITULO_SESION_MAX anterior; el límite actual 300 ≥ máx. real 222) — ej. sesiones ${truncados.slice(0, 8).join(', ')}${truncados.length > 8 ? '…' : ''} (${titulosCompletos}/72 completos)`,
    );

  // ── 5. Zona escolar ──────────────────────────────────────────────────────
  const zonaMatch = bookRaw.match(/Zona\s+(\d{2,4})/i);
  const zonaLibro = zonaMatch ? zonaMatch[1] : '(no encontrada)';
  if (zonaLibro !== zonaEsperada) {
    pendings.push(`PENDIENTE RE-EXPORT: zona en portada = "Zona ${zonaLibro}" (esperada "Zona ${zonaEsperada}")`);
  } else {
    console.log(`OK  Zona: Zona ${zonaLibro}`);
  }

  // ── 6. Tokens crudos y emojis/tofu ───────────────────────────────────────
  if (/\[\[material:/i.test(bookRaw)) failures.push('FAIL: tokens crudos [[material:...]] en el libro');
  else console.log('OK  Tokens: cero [[material:...]] crudos');

  const emojiHits = (bookRaw.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2610}-\u{2611}]/gu) || []).length;
  if (emojiHits > 0)
    pendings.push(`PENDIENTE RE-EXPORT: ${emojiHits} caracteres emoji/tofu en el texto (template aún sin limpiar en esa exportación)`);
  else console.log('OK  Glifos: cero emojis/tofu en el texto extraído');

  // ── Reporte ──────────────────────────────────────────────────────────────
  console.log('');
  for (const p of pendings) console.log(`⚠  ${p}`);
  for (const f of failures) console.log(`✗  ${f}`);

  if (failures.length === 0 && pendings.length === 0) {
    console.log('\n✅ LIBRO 100% ALINEADO: 72/72 sesiones, contenido, títulos, zona y glifos correctos.');
    process.exit(0);
  } else if (failures.length === 0) {
    console.log('\n⚠  CONTENIDO ALINEADO (72/72), pero hay defectos de formato PENDIENTES de re-export.');
    process.exit(1);
  } else {
    console.log('\n✗ FALLAS DE ALINEACIÓN — revisar arriba.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
