import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'overlap-06.txt');
const clean = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const grams = (s: string) => {
  const words = normalize(s).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 6 <= words.length; i++) out.add(words.slice(i, i + 6).join(' '));
  return out;
};
const ratio = (a: Set<string>, b: Set<string>) => {
  if (!a.size) return 0;
  let n = 0;
  for (const g of a) if (b.has(g)) n++;
  return n / a.size;
};
async function pdfText(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return clean(((await p.getText()).pages as Array<{ text?: string }>).map((x) => x.text || '').join('\n')); } finally { await p.destroy(); }
}
async function pptxText(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const parts: string[] = [];
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    parts.push(clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' ')));
  }
  return parts.join('\n');
}
async function main() {
  let out = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f06 = fs.readdirSync(full).find((f) => f.startsWith('06_'))!;
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const book = grams(await pdfText(path.join(full, f06)));
    const r08 = ratio(grams(await pptxText(path.join(full, f08))), book) * 100;
    const r09 = ratio(grams(await pdfText(path.join(full, f09))), book) * 100;
    out += `${dir}\t08=${r08.toFixed(2)}%\t09=${r09.toFixed(2)}%\n`;
  }
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
