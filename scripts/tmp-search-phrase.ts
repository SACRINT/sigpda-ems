import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

async function pdfText(file: string): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    return clean(((await parser.getText()).pages ?? []).map((page) => {
      const value = page as { text?: string } | string;
      return typeof value === 'string' ? value : value.text || '';
    }).join(' '));
  } finally {
    await parser.destroy();
  }
}

async function pptxText(file: string): Promise<string> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const parts: string[] = [];
  for (const name of names) {
    const xml = await zip.files[name]!.async('text');
    parts.push(clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => match[1]!).join(' ')));
  }
  return parts.join(' ');
}

async function main() {
  const pkg = process.argv[2] || 'Paquete_CNET1_PDF';
  const phrase = process.argv[3] || 'detalla por qué el valor';
  const full = path.join(BASE, pkg);
  const files = fs.readdirSync(full).filter((file) => /^(05|06|08)_/.test(file));
  for (const file of files) {
    const text = file.endsWith('.pptx') ? await pptxText(path.join(full, file)) : await pdfText(path.join(full, file));
    const index = text.toLowerCase().indexOf(phrase.toLowerCase());
    console.log(`\n${file}: ${index >= 0 ? 'FOUND' : 'NOT FOUND'}`);
    if (index >= 0) console.log(text.slice(Math.max(0, index - 180), Math.min(text.length, index + phrase.length + 220)));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
