import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OLD = path.join(BASE, 'PM3_ANT');
const NEW = path.join(BASE, 'Paquete_PM3_PDF');
const normalize = (t: string) => t.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
const sha = (t: string) => crypto.createHash('sha256').update(normalize(t), 'utf8').digest('hex');
async function pdf(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return (await p.getText()).text || ''; } finally { await p.destroy(); }
}
async function pptx(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const slides = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  let out = '';
  for (const s of slides) { const xml = await z.files[s]!.async('text'); out += [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")).join(' ') + '\n'; }
  return out;
}
async function main() {
  for (const file of fs.readdirSync(NEW).sort()) {
    if (!/^0[1-9]_/.test(file)) continue;
    const oldFile = path.join(OLD, file);
    const newFile = path.join(NEW, file);
    const oldText = fs.existsSync(oldFile) ? (file.endsWith('.pptx') ? await pptx(oldFile) : await pdf(oldFile)) : '';
    const newText = file.endsWith('.pptx') ? await pptx(newFile) : await pdf(newFile);
    console.log(`${file.slice(0,2)} ${sha(oldText) === sha(newText) ? 'SAME' : 'CHANGED'} | old=${normalize(oldText).length} new=${normalize(newText).length} delta=${normalize(newText).length - normalize(oldText).length}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
