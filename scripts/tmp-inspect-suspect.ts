import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const TARGETS: Record<string, { slides?: number[]; pages?: number[] }> = {
  Paquete_AECAEF_PDF: { slides: [30, 75, 67], pages: [14, 33] },
  Paquete_CNET1_PDF: { slides: [2, 153], pages: [1] },
  Paquete_CECBV_PDF: { slides: [111, 13], pages: [5] },
  Paquete_CS1_PDF: { slides: [84, 23, 31], pages: [2] },
  Paquete_DT1_PDF: { slides: [50, 67], pages: [41] },
  Paquete_I1_PDF: { slides: [109, 73], pages: [] },
  Paquete_PM3_PDF: { slides: [133, 141, 20], pages: [] },
  Paquete_TPV1_PDF: { slides: [10, 23, 56], pages: [] },
  Paquete_LC1_PDF: { slides: [5, 11, 77], pages: [] },
  Paquete_LMTCLCDIV_PDF: { slides: [14], pages: [] },
  Paquete_PMCCELCDTM_PDF: { slides: [27], pages: [] },
  Paquete_ICDIBV_PDF: { slides: [14], pages: [] },
};
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
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")).join(' | ');
    map.set(Number(name.match(/\d+/)![0]), text.replace(/\s+/g, ' ').trim());
  }
  return map;
}
async function main() {
  for (const [dir, target] of Object.entries(TARGETS)) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const s = await slides(path.join(full, f08));
    const pages = await pdfPages(path.join(full, f09));
    console.log(`\n######## ${dir}`);
    for (const n of target.slides ?? []) console.log(`\n[08 S${n}]\n${s.get(n) ?? '(no existe)'}`);
    for (const n of target.pages ?? []) {
      const page = pages[n - 1] as { text?: string } | string | undefined;
      const text = typeof page === 'string' ? page : page?.text || '';
      console.log(`\n[09 p${n}]\n${text.replace(/\s+/g, ' ')}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
