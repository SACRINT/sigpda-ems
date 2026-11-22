import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'activities-no-question.txt');

const clean = (text: string) =>
  text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();

async function slides(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: Array<{ slide: number; text: string }> = [];
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    const text = clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' | '));
    out.push({ slide: Number(name.match(/\d+/)![0]), text });
  }
  return out;
}
function between(text: string, start: string, end: string) {
  const a = text.indexOf(start);
  if (a < 0) return '';
  const from = a + start.length;
  const b = text.indexOf(end, from);
  return (b < 0 ? text.slice(from) : text.slice(from, b)).trim();
}
async function main() {
  let out = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const s = await slides(path.join(full, f08));
    for (const slide of s) {
      for (const label of ['ACTIVIDAD 1 |', 'ACTIVIDAD 2 |']) {
        const body = between(slide.text, label, '| Pista:');
        if (!body || body.includes('?')) continue;
        out += `\n${dir} S${slide.slide} ${label.replace(' |', '')}\n${body}\n`;
      }
    }
  }
  fs.writeFileSync(OUT, out, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
