import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import { hasDanglingEnding } from '../src/lib/editorial/pedagogical-text-fitter';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'deep-audit.json');

const TASK =
  /\b(?:analiza|calcula|halla|determina|explica|describe|identifica|reconoce|elabora|diseña|traza|representa|construye|examina|registra|justifica|argumenta|completa|resuelve|aplica|emplea|investiga|selecciona|clasifica|transforma|lee|escribe|anota|piensa|valora|propón|propone|dibuja|compara|observa|mide|ubica|ordena|formula|plantea|sustituye|verifica|contrasta|relaciona|fundamenta|integra|incorpora|presenta|entrega|comparte|debate|reflexiona|deduce|demuestra|experimenta|modela|simula|programa|crea|redacta|corrige|revisa|escucha|narra|resume|sintetiza|parafrasea|traduce|ilustra|grafica|tabula|obtén|convierte|redondea|estima|aproxima|pesa|prepara|mezcla|filtra|calienta|enfría|siembra|cosecha|recolecta|interpreta|distingue|enumera|señala|marca|subraya|llena|colorea|recorta|pega|arma|desarma|repara|limpia|instala|configura|optimiza|actualiza|diagnostica|evalúa|audita|valida|prueba|recopila|organiza|planifica|expone|defiende|concluye|responde|contesta|elige|indica|menciona|localiza|encuentra|sustenta|desarrolla)\b/i;
const FUNCTION_WORD =
  /(?:^|\s)(?:de|del|la|el|los|las|un|una|unos|unas|y|o|para|por|con|sin|en|a|al|que|su|sus|tu|tus|mi|mis|este|esta|estos|estas|ese|esa|esos|esas|como|cuando|donde|mientras|sobre|entre|hasta|desde|según|durante|mediante|través|partir)\.?$/i;
const OBJECTIVE_CONCEPT =
  /^(?:Comprendes|Analizas|Diseñas|Evalúas|Elaboras|Realizas|Integras|Proyectas|Sustentas|Construyes|Dominas|Aprendes|Identificas|Explicas|Aplicas|Resuelves|Interpretas|Reconoces|Creas|Describes)\b/i;
const GENERIC_HINT =
  /^(?:Luego, plantea una ecuación\.?|Aplica el procedimiento estudiado.*|Halla .*|Calcula .*|Examina .*|Usa .*|Recuerda .*)$/i;
const KNOWN_TRUNCATED_09 = [
  /Comprendes los principios de la gestión(?!\s+térmica)/i,
  /Además, comprueba que el ventilador/i,
  /La cubicación es el proceso técnico\./i,
  /Ocurre esto y cómo la ciencia nos/i,
  /R ¿Logré mantener(?:\s+PROCEDIMIENTO|\s*$)/i,
  /R ¿Puedo detallar(?:\s+PROCEDIMIENTO|\s*$)/i,
  /F ¿Alguna vez(?:\s+C|\s*$)/i,
  /P Registraste los pesos cargados en 4(?:\s+D|\s*$)/i,
  /La perspectiva isométrica es un sistema\./i,
  /F La grabación de una guía(?:\s+S|\s*$)/i,
  /A\s*=\s*0\.5\s*m\b/i,
  /\bpor parte\.(?:\s|$)/i,
  /\b(?:Sistema de representación que utiliza|Sistema de representación que proyecta un objeto)\s*(?:\||$)/i,
];
const GENERIC_09 = [
  /El concepto central es .* y se aplica en situaciones del entorno/i,
  /Concepto clave para interpretar/i,
  /Resuelve la situación planteada con los datos anteriores/i,
  /permite interpretar datos del entorno y resolver situaciones con rigor metodológico/i,
];

function clean(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function join(tokens: string[]): string {
  return clean(tokens.join(' '));
}

function segment(tokens: string[], start: string, stops: string[]): string {
  const index = tokens.findIndex((token) => token.trim() === start);
  if (index < 0) return '';
  const body: string[] = [];
  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i]!.trim();
    if (stops.some((stop) => token === stop || token.startsWith(stop))) break;
    body.push(token);
  }
  return join(body);
}

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function grams(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const list = normalized.split(' ').filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 6 <= list.length; i++) out.add(list.slice(i, i + 6).join(' '));
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const gram of a) if (b.has(gram)) hits++;
  return hits / Math.min(a.size, b.size);
}

async function pptxSlides(file: string): Promise<Array<{ slide: number; tokens: string[]; text: string }>> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const result: Array<{ slide: number; tokens: string[]; text: string }> = [];
  for (const name of names) {
    const xml = await zip.files[name]!.async('text');
    const tokens = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => clean(match[1]!));
    result.push({ slide: Number(name.match(/\d+/)![0]), tokens, text: join(tokens) });
  }
  return result;
}

async function pdfPages(file: string): Promise<string[]> {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    const pages = (await parser.getText()).pages ?? [];
    return (pages as Array<{ text?: string } | string>).map((page) =>
      clean(typeof page === 'string' ? page : page.text || '')
    );
  } finally {
    await parser.destroy();
  }
}

type Issue = { package: string; material: '08' | '09'; slide?: number; page?: number; kind: string; text: string };

function auditSlide(pkg: string, slide: { slide: number; tokens: string[]; text: string }): Issue[] {
  const issues: Issue[] = [];
  const add = (kind: string, text: string) => {
    if (text) issues.push({ package: pkg, material: '08', slide: slide.slide, kind, text });
  };
  const concept = segment(slide.tokens, 'CONOCIMIENTO NUEVO', [
    'EJEMPLO RESUELTO',
    'EXPRESIÓN CLAVE',
    'ERROR COMÚN',
    'MAPA ',
    'RED DE SISTEMAS',
    'ORIGEN',
    'ENTRADA',
    'Héroes de la Patria',
  ]);
  const example = segment(slide.tokens, 'EJEMPLO RESUELTO', [
    'EXPRESIÓN CLAVE',
    'ERROR COMÚN',
    'MAPA ',
    'RED DE SISTEMAS',
    'ORIGEN',
    'ENTRADA',
    'Héroes de la Patria',
  ]);
  if (slide.text.includes('CONOCIMIENTO NUEVO') && (!concept || concept.length < 60)) {
    add('concepto_vacio_o_corto', concept);
  }
  if (concept && hasDanglingEnding(concept)) add('concepto_colgante', concept);
  if (slide.text.includes('EJEMPLO RESUELTO')) {
    if (!example || example.length < 40) add('ejemplo_vacio_o_corto', example);
    if (example && hasDanglingEnding(example)) add('ejemplo_colgante', example);
    if (objectivesInExample(example)) add('ejemplo_generico', example);
    if (concept && example && overlap(grams(concept), grams(example)) >= 0.5) add('concepto_repetido_en_ejemplo', example);
  }
  const objective = segment(slide.tokens, 'OBJETIVO DE LA SESIÓN', [
    'EJERCICIOS DEL LIBRO',
    'ACTIVIDAD 1',
    'Héroes de la Patria',
  ]);
  if (objective && hasDanglingEnding(objective)) add('objetivo_colgante', objective);
  const conceptCentral = segment(slide.tokens, 'CONCEPTO CENTRAL', [
    'FENÓMENO',
    'FENÓMENO',
    'Héroes de la Patria',
  ]);
  if (conceptCentral && OBJECTIVE_CONCEPT.test(conceptCentral)) add('concepto_central_es_objetivo', conceptCentral);

  for (const label of ['ACTIVIDAD 1', 'ACTIVIDAD 2']) {
    const body = segment(slide.tokens, label, [
      'Pista:',
      'ACTIVIDAD 2',
      'APLICACIÓN REAL',
      'EVALUACIÓN',
      'EVIDENCIA',
      'Héroes de la Patria',
    ]);
    if (!body) continue;
    if (body.length < 12) add(`${label}_vacia`, body);
    if (hasDanglingEnding(body)) add(`${label}_colgante`, body);
    if (/\.{3,}|…/.test(body)) add(`${label}_puntos_suspensivos`, body);
    if (FUNCTION_WORD.test(body)) add(`${label}_termina_palabra_funcional`, body);
    if (/\b(?:de|del|con|en)\s+\d+(?:[.,]\d+)?\.$/i.test(body)) add(`${label}_dato_sin_unidad`, body);
    if (!body.includes('?') && !TASK.test(body)) add(`${label}_sin_consigna`, body);
    const hint = segment(slide.tokens, 'Pista:', ['ACTIVIDAD 2', 'APLICACIÓN REAL', 'EVALUACIÓN', 'EVIDENCIA', 'Héroes de la Patria']);
    if (hint && (hint.length < 12 || GENERIC_HINT.test(hint))) add(`${label}_pista_generica`, hint);
    if (hint && hasDanglingEnding(hint)) add(`${label}_pista_colgante`, hint);
  }
  const application = segment(slide.tokens, 'APLICACIÓN REAL', ['EVALUACIÓN', 'EVIDENCIA', 'Héroes de la Patria']);
  if (application && (application.length < 35 || hasDanglingEnding(application))) add('aplicacion_generica_o_colgante', application);
  const evaluation = segment(slide.tokens, 'EVALUACIÓN', ['EVIDENCIA', 'Héroes de la Patria']);
  if (evaluation && (evaluation.length < 20 || hasDanglingEnding(evaluation))) add('evaluacion_generica_o_colgante', evaluation);
  return issues;
}

function objectivesInExample(text: string): boolean {
  return /^(?:Aplica el procedimiento estudiado|Realiza el procedimiento|Resuelve la situación|Completa el procedimiento)/i.test(text);
}

function auditPage(pkg: string, page: number, text: string): Issue[] {
  const issues: Issue[] = [];
  const add = (kind: string) => issues.push({ package: pkg, material: '09', page, kind, text: text.slice(0, 500) });
  for (const regex of KNOWN_TRUNCATED_09) if (regex.test(text)) add(`patron_conocido:${regex.source}`);
  for (const regex of GENERIC_09) if (regex.test(text)) add(`tautologia:${regex.source}`);
  if (/SISTEMA\s+(?:Comprendes|Analizas|Diseñas|Evalúas|Elaboras|Realizas|Integras|Sustentas)/i.test(text)) {
    add('sistema_es_objetivo');
  }
  if (/CONCEPTO CENTRAL\s+(?:Comprendes|Analizas|Diseñas|Evalúas|Elaboras|Realizas|Integras|Sustentas)/i.test(text)) {
    add('concepto_central_es_objetivo');
  }
  if (/\bpor parte\s*(?:$|\||[A-ZÁÉÍÓÚ])/m.test(text)) add('sintagma_truncado_por_parte');
  if (/Sistema de representación que (?:utiliza|proyecta un objeto)\s*(?:\||$)/i.test(text)) {
    add('nodo_diagrama_truncado');
  }
  if (/[A-Za-zÁÉÍÓÚÑáéíóúñ]\s*\?\s*(?:=|→|$)/.test(text) && /MODELO Y FORMULA CENTRAL/.test(text)) {
    add('formula_con_caracter_invalido');
  }
  return issues;
}

async function main() {
  const dirs = fs
    .readdirSync(BASE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('_PDF'))
    .map((entry) => entry.name)
    .sort();
  const report: Array<{ package: string; current: { slides: number; issues: Issue[]; pages: number; pageIssues: Issue[] }; ant: { slides: number; issues: Issue[]; pages: number; pageIssues: Issue[] } | null }> = [];
  for (const pkg of dirs) {
    const full = path.join(BASE, pkg);
    const f08 = fs.readdirSync(full).find((file) => file.startsWith('08_'))!;
    const f09 = fs.readdirSync(full).find((file) => file.startsWith('09_'))!;
    const slides = await pptxSlides(path.join(full, f08));
    const pages = await pdfPages(path.join(full, f09));
    const issues = slides.flatMap((slide) => auditSlide(pkg, slide));
    const pageIssues = pages.flatMap((text, index) => auditPage(pkg, index + 1, text));
    const antName = pkg.replace(/_PDF$/, '_ANT');
    const antFull = path.join(BASE, antName);
    let ant: { slides: number; issues: Issue[]; pages: number; pageIssues: Issue[] } | null = null;
    if (fs.existsSync(antFull)) {
      const antF08 = fs.readdirSync(antFull).find((file) => file.startsWith('08_'))!;
      const antF09 = fs.readdirSync(antFull).find((file) => file.startsWith('09_'))!;
      const antSlides = await pptxSlides(path.join(antFull, antF08));
      const antPages = await pdfPages(path.join(antFull, antF09));
      ant = {
        slides: antSlides.length,
        issues: antSlides.flatMap((slide) => auditSlide(antName, slide)),
        pages: antPages.length,
        pageIssues: antPages.flatMap((text, index) => auditPage(antName, index + 1, text)),
      };
    }
    report.push({ package: pkg, current: { slides: slides.length, issues, pages: pages.length, pageIssues }, ant });
    const counts = (items: Issue[]) => {
      const map = new Map<string, number>();
      for (const item of items) map.set(item.kind, (map.get(item.kind) ?? 0) + 1);
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([kind, count]) => `${kind}=${count}`).join(', ');
    };
    console.log(`\n### ${pkg} | 08 slides=${slides.length} issues=${issues.length} | 09 pages=${pages.length} issues=${pageIssues.length}`);
    console.log(`08: ${counts(issues) || 'sin hallazgos'}`);
    console.log(`09: ${counts(pageIssues) || 'sin hallazgos'}`);
    if (ant) console.log(`ANT 08=${ant.issues.length} 09=${ant.pageIssues.length}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
