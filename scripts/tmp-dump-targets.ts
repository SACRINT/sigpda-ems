import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', `target-dump-${process.argv[2] || 'default'}.txt`);

const clean = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function slides(file: string) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const map = new Map<number, string>();
  for (const name of names) {
    const xml = await zip.files[name]!.async('text');
    map.set(
      Number(name.match(/\d+/)![0]),
      clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1]!).join(' | '))
    );
  }
  return map;
}

async function pages(file: string) {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    return ((await parser.getText()).pages ?? []) as Array<{ text?: string } | string>;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const requested = process.argv[2] || 'Paquete_CNET1_PDF';
  const slideArgs = (process.argv[3] || '').split(',').map(Number).filter(Boolean);
  const pageArgs = (process.argv[4] || '').split(',').map(Number).filter(Boolean);
  const full = path.join(BASE, requested);
  const f08 = fs.readdirSync(full).find((file) => file.startsWith('08_'))!;
  const f09 = fs.readdirSync(full).find((file) => file.startsWith('09_'))!;
  let out = `######## ${requested}\n`;
  if (slideArgs.length) {
    const map = await slides(path.join(full, f08));
    for (const slide of slideArgs) out += `\n[08 S${slide}]\n${map.get(slide) ?? '(no existe)'}\n`;
  }
  if (pageArgs.length) {
    const list = await pages(path.join(full, f09));
    for (const page of pageArgs) {
      const value = list[page - 1];
      out += `\n[09 p${page}]\n${clean(typeof value === 'string' ? value : value?.text || '')}\n`;
    }
  }
  fs.writeFileSync(OUT, out, 'utf8');
  console.log(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
