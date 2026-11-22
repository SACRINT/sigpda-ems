import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const TERMS = [
  '20%', 'polígono B', 'detectas un error', 'colores poco', 'expone', 'Dimensi', 'municipio',
  'a partir', 'un lado', 'mediante', 'al momento', 'hacia ', 'tal tal', 'dicha', 'altavoz',
  'considera', 'S ', 'C ', 'P ', 'F ',
];
async function pdfPages(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    const r = await p.getText();
    return { text: r.text || '', pages: r.pages ?? [] };
  } finally { await p.destroy(); }
}
async function slides(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: Array<{ slide: number; text: string }> = [];
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")).join(' | ');
    out.push({ slide: Number(name.match(/\d+/)![0]), text: text.replace(/\s+/g, ' ').trim() });
  }
  return out;
}
async function main() {
  for (const dir of fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort()) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const s = await slides(path.join(full, f08));
    const p9 = await pdfPages(path.join(full, f09));
    console.log(`\n######## ${dir}`);
    for (const term of TERMS) {
      const hits: string[] = [];
      for (const slide of s) {
        if (slide.text.toLowerCase().includes(term.toLowerCase())) hits.push(`08 S${slide.slide}: ${slide.text.slice(0, 320)}`);
        if (hits.length >= 3) break;
      }
      for (let i = 0; i < (p9.pages as unknown[]).length; i++) {
        const page = p9.pages[i] as { text?: string } | string;
        const text = typeof page === 'string' ? page : page.text || '';
        if (text.toLowerCase().includes(term.toLowerCase())) hits.push(`09 p${i + 1}: ${text.replace(/\s+/g,' ').slice(0, 320)}`);
        if (hits.length >= 5) break;
      }
      if (hits.length) console.log(`-- ${term}\n${hits.join('\n')}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
