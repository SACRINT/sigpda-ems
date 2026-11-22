import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'duplication-6gram.txt');
const clean = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const grams = (s: string) => {
  const words = normalize(s).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 6 <= words.length; i++) out.add(words.slice(i, i + 6).join(' '));
  return out;
};
const overlap = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const g of a) if (b.has(g)) n++;
  return n / Math.min(a.size, b.size);
};
const extract = (text: string, label: string, next: string[]) => {
  const i = text.indexOf(label);
  if (i < 0) return '';
  const start = i + label.length;
  let end = text.length;
  for (const n of next) {
    const j = text.indexOf(n, start);
    if (j >= 0 && j < end) end = j;
  }
  return text.slice(start, end);
};

async function slideTexts(file: string) {
  const z = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(z.files).filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: Array<{ slide: number; text: string }> = [];
  for (const name of names) {
    const xml = await z.files[name]!.async('text');
    out.push({ slide: Number(name.match(/\d+/)![0]), text: clean([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]!).join(' | ')) });
  }
  return out;
}

async function main() {
  let res = '';
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const s = await slideTexts(path.join(full, f08));
    let pairs = 0;
    let high = 0;
    let max = 0;
    let maxSlide = 0;
    let maxExample = '';
    let maxConcept = '';
    for (const slide of s) {
      const concept = extract(slide.text, 'CONOCIMIENTO NUEVO', ['EJEMPLO RESUELTO', 'EXPRESIÓN CLAVE', 'ERROR COMÚN', 'MAPA ', 'RED DE SISTEMAS', 'ORIGEN', 'ENTRADA', 'Héroes de la Patria']);
      const example = extract(slide.text, 'EJEMPLO RESUELTO', ['EXPRESIÓN CLAVE', 'ERROR COMÚN', 'MAPA ', 'RED DE SISTEMAS', 'ORIGEN', 'ENTRADA', 'Héroes de la Patria']);
      if (!concept || !example) continue;
      pairs++;
      const ov = overlap(grams(concept), grams(example));
      if (ov > max) { max = ov; maxSlide = slide.slide; maxExample = example.slice(0, 170); maxConcept = concept.slice(0, 170); }
      if (ov >= 0.5) high++;
    }
    res += `${dir}\tpairs=${pairs}\thighOverlap>=0.5=${high}\tmax=${max.toFixed(2)} (S${maxSlide})\n`;
    if (max >= 0.3) res += `  concept: ${maxConcept}\n  example: ${maxExample}\n`;
  }
  fs.writeFileSync(OUT, res, 'utf8');
}
main().catch((e) => { console.error(e); process.exit(1); });
