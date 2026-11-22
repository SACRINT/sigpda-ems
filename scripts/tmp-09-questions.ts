import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', '09-incomplete-questions.txt');
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

async function pages(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return (await p.getText()).pages ?? []; } finally { await p.destroy(); }
}
async function main() {
  let out = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const ps = await pages(path.join(full, f09));
    const rows: string[] = [];
    for (let i = 0; i < (ps as unknown[]).length; i++) {
      const p = ps[i] as { text?: string } | string;
      const text = clean(typeof p === 'string' ? p : p.text || '');
      const ms = [...text.matchAll(/¿[^?]{0,220}(?=\?|$)/g)].map((m) => m[0]);
      const incomplete = ms.filter((m) => !m.endsWith('?'));
      if (incomplete.length) rows.push(`p${i + 1}: ${incomplete.map((x) => x.slice(0, 180)).join(' || ')}`);
    }
    if (rows.length) {
      out += `\n######## ${dir}\n`;
      for (const r of rows) out += `- ${r}\n`;
    }
  }
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
