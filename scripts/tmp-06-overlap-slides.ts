import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const grams = (value: string) => {
  const list = normalize(value).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 6 <= list.length; i++) out.add(list.slice(i, i + 6).join(' '));
  return out;
};
const ratio = (a: Set<string>, b: Set<string>) => {
  if (!a.size) return 0;
  let hits = 0;
  for (const gram of a) if (b.has(gram)) hits++;
  return (hits / a.size) * 100;
};

async function pdfText(file: string): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    const result = (await parser.getText()).pages ?? [];
    return clean((result as Array<{ text?: string } | string>).map((page) => (typeof page === 'string' ? page : page.text || '')).join(' '));
  } finally {
    await parser.destroy();
  }
}

async function slides(file: string) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const result: Array<{ slide: number; text: string }> = [];
  for (const name of names) {
    const xml = await zip.files[name]!.async('text');
    result.push({
      slide: Number(name.match(/\d+/)![0]),
      text: clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1]!).join(' ')),
    });
  }
  return result;
}

async function main() {
  const pkg = process.argv[2] || 'Paquete_CNET1_PDF';
  const full = path.join(BASE, pkg);
  const f06 = fs.readdirSync(full).find((file) => file.startsWith('06_'))!;
  const f08 = fs.readdirSync(full).find((file) => file.startsWith('08_'))!;
  const book = grams(await pdfText(path.join(full, f06)));
  const list = await slides(path.join(full, f08));
  const rows = list
    .map((slide) => ({ slide: slide.slide, ratio: ratio(grams(slide.text), book), text: slide.text }))
    .sort((a, b) => b.ratio - a.ratio);
  console.log(`### ${pkg} | slides=${list.length}`);
  for (const row of rows.slice(0, 15)) {
    console.log(`S${row.slide}\t${row.ratio.toFixed(2)}%\t${row.text.slice(0, 220)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
