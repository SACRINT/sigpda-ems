import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP || 'C:/Users/samue/AppData/Local/Temp', 'opencode', 'ling-compare.json');
const RULES: Array<[string, RegExp]> = [
  ['hacia_inf', /\bhacia\s+[a-záéíóúñü]+(?:ar|er|ir)\b/gi],
  ['tal_tal', /\btal\s+tal\b/gi],
  ['dicha_gerund', /\bdicha\s+(?:funcionando|siendo|teniendo|haciendo|dando|dejando)\b/gi],
  ['un_lado_al', /\bun\s+lado\s+al\b/gi],
  ['mediante_forma', /\bmediante\s+forma\b/gi],
  ['a_partir_fin', /\ba\s+partir\s*\./gi],
  ['considera_fin', /\bconsidera\s*\./gi],
  ['tal_como_inf', /\btal\s+como\s+[a-záéíóúñü]+(?:ar|er|ir)\b/gi],
  ['en_la_expone', /\ben\s+la\s+expone\b/gi],
  ['al_momento_que', /\bal\s+momento\s+que\b/gi],
];
const count = (text: string, re: RegExp) => {
  const rr = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let n = 0;
  while (rr.exec(text) !== null) n++;
  return n;
};
const one = (text: string, re: RegExp) => {
  const rr = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const m = rr.exec(text);
  return m ? text.slice(Math.max(0, m.index - 45), Math.min(text.length, m.index + m[0].length + 70)).replace(/\s+/g, ' ').trim() : '';
};
async function pdf(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    return (await p.getText()).text || '';
  } finally {
    await p.destroy();
  }
}
async function pptx(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const slides = Object.keys(z.files)
    .filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  let out = '';
  for (const s of slides) {
    const xml = await z.files[s]!.async('text');
    out += [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => m[1]!.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
      .join(' ') + '\n';
  }
  return out;
}
async function text(file: string) {
  return file.endsWith('.pptx') ? pptx(file) : pdf(file);
}
async function main() {
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  const report: unknown[] = [];
  for (const novo of dirs) {
    const oldDirName = novo === 'Paquete_PM3_PDF' ? 'PM3_ANT' : novo.replace(/_PDF$/, '_ANT');
    const oldDir = path.join(BASE, oldDirName);
    const newDir = path.join(BASE, novo);
    const rows: Array<Record<string, unknown>> = [];
    for (const prefix of ['08_', '09_']) {
      const newFile = fs.readdirSync(newDir).find((f) => f.startsWith(prefix));
      const oldFile = fs.existsSync(oldDir) ? fs.readdirSync(oldDir).find((f) => f.startsWith(prefix)) : undefined;
      if (!newFile) continue;
      const newText = await text(path.join(newDir, newFile));
      const oldText = oldFile ? await text(path.join(oldDir, oldFile)) : '';
      const counts: Record<string, { old: number; new: number; example: string }> = {};
      for (const [kind, re] of RULES) {
        const nOld = oldFile ? count(oldText, re) : 0;
        const nNew = count(newText, re);
        if (nOld || nNew) counts[kind] = { old: nOld, new: nNew, example: one(newText, re) || one(oldText, re) };
      }
      rows.push({ material: prefix.slice(0, 2), oldFile: oldFile ?? null, newFile, counts });
      console.log(`### ${novo} ${prefix.slice(0, 2)}`);
      for (const [kind, value] of Object.entries(counts)) console.log(`  ${kind}: ${value.old}->${value.new} | ${value.example}`);
    }
    report.push({ novo, oldDirName, rows });
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
