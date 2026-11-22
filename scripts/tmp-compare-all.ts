import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP || 'C:/Users/samue/AppData/Local/Temp', 'opencode', 'compare-all.json');

const normalize = (text: string) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

const sha = (text: string) => crypto.createHash('sha256').update(normalize(text), 'utf8').digest('hex');

async function pdfText(file: string): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    const result = await parser.getText();
    return result.text || '';
  } finally {
    await parser.destroy();
  }
}

async function pptxText(file: string): Promise<string> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const parts: string[] = [];
  for (const slide of slides) {
    const xml = await zip.files[slide]!.async('text');
    parts.push(
      [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
        .map((m) =>
          m[1]!
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
        )
        .join(' ')
    );
  }
  return parts.join('\n');
}

async function textOf(file: string): Promise<string> {
  return file.toLowerCase().endsWith('.pptx') ? pptxText(file) : pdfText(file);
}

async function main() {
  const dirs = fs
    .readdirSync(BASE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.endsWith('_PDF'))
    .map((d) => d.name)
    .sort();
  const report: Array<Record<string, unknown>> = [];
  for (const novo of dirs) {
    const ant = novo.replace(/_PDF$/, '_ANT');
    const antDir = path.join(BASE, ant);
    const novoDir = path.join(BASE, novo);
    const files = fs.readdirSync(novoDir).sort();
    const rows: Array<Record<string, unknown>> = [];
    for (const file of files) {
      if (!/^0[1-9]_/.test(file)) continue;
      const oldPath = path.join(antDir, file);
      const newPath = path.join(novoDir, file);
      const oldExists = fs.existsSync(oldPath);
      const newText = await textOf(newPath);
      const oldText = oldExists ? await textOf(oldPath) : '';
      const newNorm = normalize(newText);
      const oldNorm = normalize(oldText);
      rows.push({
        material: file.slice(0, 2),
        file,
        oldExists,
        oldBytes: oldExists ? fs.statSync(oldPath).size : null,
        newBytes: fs.statSync(newPath).size,
        oldChars: oldNorm.length,
        newChars: newNorm.length,
        deltaChars: newNorm.length - oldNorm.length,
        oldSha: oldExists ? sha(oldText) : null,
        newSha: sha(newText),
        changed: oldExists ? sha(oldText) !== sha(newText) : null,
        changedChars: oldExists ? oldNorm !== newNorm : null,
        sampleOld: oldExists ? oldNorm.slice(0, 180) : null,
        sampleNew: newNorm.slice(0, 180),
      });
    }
    const changed = rows.filter((r) => r.changed).map((r) => r.material);
    report.push({ novo, ant, oldExists: fs.existsSync(antDir), changed, files: rows });
    console.log(`### ${novo} vs ${ant} | changed=${changed.join(',') || 'NINGUNO'}`);
    for (const r of rows) {
      console.log(
        `  ${r.material} ${r.changed ? 'CHANGED' : 'SAME'} | old=${r.oldChars} new=${r.newChars} delta=${r.deltaChars} bytes=${r.oldBytes}->${r.newBytes}`
      );
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
