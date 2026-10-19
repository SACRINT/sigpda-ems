/**
 * analyze-editorial-sessions.ts — Diagnóstico del Libro Editorial (Typst).
 * Reporta qué sesiones 1..72 globales están presentes/ausentes y contadores.
 * Uso: npx tsx scripts/analyze-editorial-sessions.ts "<ruta del PDF>"
 */
import { readFileSync } from 'node:fs';
import { PDFParse } from 'pdf-parse';

const fold = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

async function main(): Promise<void> {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Uso: npx tsx scripts/analyze-editorial-sessions.ts "<ruta del PDF>"');
    process.exit(2);
  }
  const buf = readFileSync(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = fold(parsed.text);
  console.log(`Caracteres normalizados: ${text.length}`);

  const counts = new Map<number, number>();
  for (const m of text.matchAll(/SESION (\d+)/g)) {
    const n = parseInt(m[1], 10);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const present: number[] = [];
  const missing: number[] = [];
  for (let n = 1; n <= 72; n++) (counts.has(n) ? present : missing).push(n);
  const outOfRange = [...counts.entries()].filter(([n]) => n < 1 || n > 72);

  console.log(`Presentes: ${present.length}/72`);
  console.log(`Faltantes (${missing.length}): ${missing.join(', ') || 'ninguno'}`);
  if (outOfRange.length) console.log(`Fuera de rango: ${outOfRange.map(([n, c]) => `${n}(${c})`).join(', ')}`);
  console.log(`Detecciones por número (1..72): ${[...counts.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}:${c}`).join(' ')}`);

  for (const probe of ['EMPIEZA AQUI', 'APRENDE Y PRACTICA', 'AUTOEVALUACION', 'PARA SABER MAS', 'EJERCICIO', 'PUNTO DE CONTROL']) {
    console.log(`'${probe}': ${(text.match(new RegExp(probe, 'g')) || []).length}`);
  }

  const idx = text.indexOf('PENSAMIENTO MATEMAT');
  console.log(`Portada UAC en pos ${idx}`);
  console.log(`Primeros 400 chars:\n${text.slice(0, 400)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
