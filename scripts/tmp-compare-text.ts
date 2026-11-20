import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const NVO = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\DOCUMENTOS_REFERENCIA\\[01]PLANEACIONES-SECUENCIAS-PLAN_DE_CLASE\\LIBROS PLANEACIONES 2026\\PM3_NVO';
const ANT = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\DOCUMENTOS_REFERENCIA\\[01]PLANEACIONES-SECUENCIAS-PLAN_DE_CLASE\\LIBROS PLANEACIONES 2026\\PM3_ANT';

async function pdfText(path: string): Promise<string> {
  const data = new Uint8Array(readFileSync(path));
  const parser = new PDFParse({ data });
  try {
    const res = await parser.getText();
    return res.text || '';
  } finally {
    await parser.destroy();
  }
}

async function pptxText(path: string): Promise<string> {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const files = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const parts: string[] = [];
  for (const f of files) {
    const xml = await zip.files[f]!.async('text');
    for (const m of xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)) {
      parts.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    }
  }
  return parts.join(' ');
}

function grams(text: string, n = 6): Set<string> {
  const words = text.toLowerCase().replace(/[^a-záéíóúñü0-9]+/gi, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}
function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return (2 * shared) / (a.size + b.size);
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

async function main() {
  const files = [
    '01_Planeacion_PM3.pdf',
    '02_Secuencia_PM3.pdf',
    '03_Planes_Clase_PM3.pdf',
    '04_Solucionario_PM3.pdf',
    '05_Guias_Practica_PM3.pdf',
    '06_Libro_Semestral_PM3.pdf',
    '07_Instrumentos_PM3.pdf',
    '08_Presentaciones_PM3.pptx',
    '09_Infografias_PM3.pdf',
  ];
  for (const file of files) {
    console.error(`[compare] ${file}`);
    const isPptx = file.endsWith('.pptx');
    const [nvo, ant] = await Promise.all([
      isPptx ? pptxText(join(NVO, file)) : pdfText(join(NVO, file)),
      isPptx ? pptxText(join(ANT, file)) : pdfText(join(ANT, file)),
    ]);
    console.log(JSON.stringify({
      file,
      nvoChars: nvo.length,
      antChars: ant.length,
      identical: nvo === ant,
      nvoHash: sha(nvo),
      antHash: sha(ant),
      sixGramDice: Number(dice(grams(nvo), grams(ant)).toFixed(4)),
    }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
