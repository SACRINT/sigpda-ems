import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP || 'C:/Users/samue/AppData/Local/Temp', 'opencode', 'residual-audit.json');

const clean = (text: string) => text.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
const truncEnd = (text: string) => {
  const value = text.trim().replace(/[|»"'”’)\]]+$/g, '').trim();
  if (!value) return false;
  if (/\.\.\.|…\s*$/.test(value)) return true;
  if (/\b(?:para|de|del|al|con|sin|que|y|o|en|por|como|según|sobre|entre|hacia|desde|hasta|su|sus|tu|tus|el|la|los|las|un|una|unos|unas)\s*\.?$/i.test(value)) return true;
  if (/\b(?:diseñad[oa]s?|especializad[oa]s?|cuantificar|estimar|representar|acotaciones|visualicen|entender|poco|cumplan|logrando|preferida|aplicar|realizar|considerar|utilizar)\s*\.?$/i.test(value)) return true;
  return false;
};
const TASK_PRODUCT =
  /\b(?:tabla|cuadro|gráfica|grafica|reporte|texto|lista|esquema|propuesta|respuesta|argumento|procedimiento|mapa|dibujo|boceto|solución|resultado|análisis|ensayo|carta|folleto|presentación|bitácora|expediente|documento|plan|diseño|modelo|fórmula|ecuación|croquis|lámina|video|exposición|producto|registro|dictamen|diagnóstico|informe|memoria|portafolio|dossier|maqueta|prototipo|programa|código|organizador|collage|cartel|mural|entrevista|encuesta|cuestionario)\b/i;
const TASK_VERB =
  /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica|estima|precisa|audita|revisa|aplica|traza|dibuja|grafica|clasifica|compara|argumenta|explica|analiza|relaciona|interpreta|distingue|localiza|señala|construye|elabora|crea|redacta|integra|prepara|consolida|organiza|demuestra|simula|examina|utiliza|genera|emplea|describe|representa|completa|ordena|usa|enfócate|asegúrate|anota|elige|reconoce|detalla|sustenta|valora|corrige|diseña|planifica|proyecta|mide|convierte|sustituye|suma|resta|multiplica|divide|despeja|compara|discute|reflexiona|investiga|entrevista|observa|clasifica|selecciona|incorpora|adjunta|archiva|entrega|presenta)\b/i;

const RESIDUAL_PATTERNS: Array<[string, RegExp]> = [
  ['boilerplate', /permite interpretar datos del entorno y resolver situaciones con rigor metodológico/gi],
  ['tautology', /(?:El concepto central es|Concepto clave para interpretar|se aplica en situaciones del entorno|La .{2,60} es (?:la|el|un|una) .{2,60} y se aplica)/gi],
  ['stub_fragment', /\b(?:FENÓMENO|FENOMENO|CONCEPTO|PRÁCTICA|PRACTICA|DECISIÓN|DECISION)\s+(?:Alguna vez te has preguntado|Comprendes|Además|¿Qué consideraciones|La [^.]{2,50}\.)/gi],
  ['gender_error', /\b(?:una instrumento|el regla|el plantilla|una sistema|el guía|la problema|el área de juegos tiene un área|un área)\b/gi],
  ['wrong_term', /\b(?:estimar objetos|instrumento digital preferida|memoria de cómputo|costado|polígono en lugar)\b/gi],
  ['generic_activity', /\b(?:datos anteriores|este evento|texto dice\.|situación planteada|un lado correspondiente al de)\b/gi],
  ['truncated', /(?:diseñados\.|cuantificar\.|acotaciones\.|visualicen\.|entender\.|colores poco\.|cada 2\.5\.|cumplan\.|logrando\.|preferida\.|para cuantificar\.|que las acotaciones\.)/gi],
];

async function pdfPages(file: string) {
  const p = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { return (await p.getText()).pages ?? []; } finally { await p.destroy(); }
}
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
function main08(slide: { slide: number; text: string }) {
  const findings: Array<{ kind: string; slide: number; text: string }> = [];
  const concept = between(slide.text, 'CONOCIMIENTO NUEVO |', '| EJEMPLO RESUELTO');
  if (concept && (concept.length < 90 || truncEnd(concept))) findings.push({ kind: 'concept', slide: slide.slide, text: concept.slice(0, 180) });
  const example = between(slide.text, 'EJEMPLO RESUELTO |', '| ERROR COMÚN');
  for (const step of example.split('|')) {
    const s = step.trim();
    if (s && /^(?:0\d|\d{1,2})$/.test(s) === false && s.length > 8 && truncEnd(s)) findings.push({ kind: 'example', slide: slide.slide, text: s.slice(0, 180) });
  }
  for (const label of ['ACTIVIDAD 1 |', 'ACTIVIDAD 2 |']) {
    const body = between(slide.text, label, '| Pista:');
    if (!body) continue;
    const noQuestion = !body.includes('?');
    const noProduct = !TASK_PRODUCT.test(body);
    const noVerb = !TASK_VERB.test(body);
    if (truncEnd(body) || (noQuestion && noProduct) || (noQuestion && noVerb)) findings.push({ kind: 'activity', slide: slide.slide, text: `${label.slice(0, -2)}: ${body.slice(0, 180)}` });
  }
  return findings;
}
async function main() {
  const all: unknown[] = [];
  const dirs = fs.readdirSync(BASE, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.endsWith('_PDF')).map((d) => d.name).sort();
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const f08 = fs.readdirSync(full).find((f) => f.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((f) => f.startsWith('09_'))!;
    const s = await slides(path.join(full, f08));
    const pages = await pdfPages(path.join(full, f09));
    const findings: Array<{ kind: string; where: string; text: string }> = [];
    for (const slide of s) for (const f of main08(slide)) findings.push({ kind: f.kind, where: `08 S${f.slide}`, text: f.text });
    for (let i = 0; i < (pages as unknown[]).length; i++) {
      const page = pages[i] as { text?: string } | string;
      const text = clean(typeof page === 'string' ? page : page.text || '');
      for (const [kind, re] of RESIDUAL_PATTERNS) {
        const m = re.exec(text);
        if (m) findings.push({ kind, where: `09 p${i + 1}`, text: text.slice(Math.max(0, m.index - 40), Math.min(text.length, m.index + 160)) });
      }
    }
    all.push({ dir, findings });
    console.log(`### ${dir} | findings=${findings.length}`);
    for (const f of findings.slice(0, 12)) console.log(`  ${f.kind} ${f.where}: ${f.text.slice(0, 220)}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
