import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'current-key-findings.txt');

const TARGETS: Record<string, { slides?: number[]; pages?: number[] }> = {
  Paquete_AECAEF_PDF: { slides: [30, 51, 36, 43, 76, 80], pages: [14, 35] },
  Paquete_CECBV_PDF: { slides: [64, 112, 14, 65, 76], pages: [5, 28] },
  Paquete_CNET1_PDF: { slides: [2, 12, 31, 35, 153], pages: [1] },
  Paquete_CS1_PDF: { slides: [4, 26], pages: [2] },
  Paquete_DT1_PDF: { slides: [19, 50, 55, 56, 95], pages: [24, 32, 41, 45] },
  Paquete_I1_PDF: { slides: [69, 73], pages: [46] },
  Paquete_ICDIBV_PDF: { slides: [58, 110], pages: [] },
  Paquete_LC1_PDF: { slides: [77, 11], pages: [] },
  Paquete_LMTCLCDIV_PDF: { slides: [96], pages: [] },
  Paquete_PM3_PDF: { slides: [15, 42, 54, 108, 155], pages: [] },
  Paquete_PMCCELCDTM_PDF: { slides: [27, 100], pages: [18] },
  Paquete_TPV1_PDF: { slides: [15, 46, 49, 79, 104], pages: [] },
};

const clean = (text: string) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();

async function pdfPages(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return (await p.getText()).pages ?? []; } finally { await p.destroy(); }
}
async function slides(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const map = new Map<number, string>();
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    map.set(Number(name.match(/\d+/)![0]), clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' | ')));
  }
  return map;
}
async function main() {
  let out = '';
  for (const [dir, target] of Object.entries(TARGETS)) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const s = await slides(path.join(full, f08));
    const pages = await pdfPages(path.join(full, f09));
    out += `\n######## ${dir}\n`;
    for (const n of target.slides ?? []) out += `\n[08 S${n}]\n${s.get(n) ?? '(no existe)'}\n`;
    for (const n of target.pages ?? []) {
      const page = pages[n - 1] as { text?: string } | string | undefined;
      out += `\n[09 p${n}]\n${clean(typeof page === 'string' ? page : page?.text || '')}\n`;
    }
  }
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
