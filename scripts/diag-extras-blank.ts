/**
 * diag-extras-blank.ts — Diagnóstico "PDF de extras descargado en blanco / sin información"
 *
 * Reproduce exactamente la ruta de exportación (`/api/pdf/extra/[extraId]` -> generateExtraPDF)
 * sobre extras REALES de la BD y reporta por página: número de página y caracteres extraídos,
 * para localizar páginas en blanco y contenido faltante.
 *
 * Uso:
 *   npx tsx scripts/diag-extras-blank.ts              (todos los extras del planning con más)
 *   npx tsx scripts/diag-extras-blank.ts <type>       (los 80 más largos de ese tipo)
 *   npx tsx scripts/diag-extras-blank.ts <extraId>    (uno solo)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { PDFParse } from 'pdf-parse';
import { generateExtraPDF } from '../src/lib/pdf-extra-generator';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^['"]|['"]$/g, '');
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  } catch {
    /* opcional */
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL no disponible.');
    process.exit(1);
  }
  const sql = neon(url);

  const only = process.argv[2];
  const knownTypes = ['lesson_plan', 'checklist', 'material', 'rubric', 'teacher_guide', 'practice_guide'];
  const rows = only
    ? knownTypes.includes(only)
      ? await sql`
          SELECT e.id, e.type, e.title, e.content_text, e.planning_id, p.uac_name
          FROM planning_extras e JOIN plannings p ON p.id = e.planning_id
          WHERE e.type = ${only}
          ORDER BY length(e.content_text) DESC
          LIMIT 80
        `
      : await sql`
          SELECT e.id, e.type, e.title, e.content_text, e.planning_id, p.uac_name
          FROM planning_extras e JOIN plannings p ON p.id = e.planning_id
          WHERE e.id = ${only}
        `
    : await sql`
        SELECT e.id, e.type, e.title, e.content_text, e.planning_id, p.uac_name
        FROM planning_extras e
        JOIN plannings p ON p.id = e.planning_id
        WHERE e.planning_id = (
          SELECT planning_id FROM planning_extras
          GROUP BY planning_id ORDER BY COUNT(*) DESC LIMIT 1
        )
        ORDER BY e.type, e.key_index, e.created_at
      `;

  if (rows.length === 0) {
    console.log('⚠️  No hay extras para diagnosticar.');
    return;
  }

  const outDir = join(process.cwd(), 'scripts', 'output', 'diag-extras');
  mkdirSync(outDir, { recursive: true });

  let totalPages = 0;
  let docsConVacias = 0;

  for (const row of rows) {
    const content = row.content_text ?? '';
    const doc = generateExtraPDF({
      id: row.id,
      title: row.title || 'Recurso Extra',
      type: row.type,
      content_text: content,
    });

    const buffer = Buffer.from(doc.output('arraybuffer'));
    const fileName = `${row.type}-${row.id}.pdf`;
    writeFileSync(join(outDir, fileName), buffer);

    const parser = new PDFParse({ data: buffer });
    let pages: { num: number; text: string }[] = [];
    let total = '';
    try {
      const result = await parser.getText();
      pages = result.pages;
      total = result.text;
    } finally {
      await parser.destroy();
    }

    const mdLines = content.split('\n').filter((l) => l.trim().length > 0).length;
    const vacias = pages.filter((p) => p.text.replace(/\s/g, '').length < 600).length;
    console.log('');
    console.log(`── [${row.type}] ${row.title}`);
    console.log(`   md: ${content.length} chars / ${mdLines} líneas | pdf: ${pages.length} páginas / ${total.length} chars | páginas casi vacías: ${vacias}`);
    for (const p of pages) {
      const chars = p.text.replace(/\s/g, '').length;
      if (chars < 600) {
        console.log(`   pág ${p.num}: ${String(chars).padStart(5)} chars  <-- CASI VACÍA`);
        console.log(`        >>> ${p.text.replace(/\s+/g, ' ').trim()}`);
      }
    }
    console.log(`   PDF: scripts/output/diag-extras/${fileName}`);
    totalPages += pages.length;
    if (vacias > 0) docsConVacias++;
  }

  console.log('');
  console.log(`══ RESUMEN: ${rows.length} documentos · ${totalPages} páginas · ${docsConVacias} con página(s) casi vacías ══`);
}

main().catch((err) => {
  console.error('❌ Error en diagnóstico:', err);
  process.exit(1);
});
