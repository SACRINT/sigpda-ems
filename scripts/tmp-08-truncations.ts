import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { hasDanglingEnding } from '../src/lib/editorial/pedagogical-text-fitter';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', '08-truncations.json');

const clean = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const SUSPECT_END =
  /(?:^|\s)(?:de|del|al|con|para|por|en|que|y|o|como|cuando|donde|mientras|sobre|entre|hasta|desde|sin|tras|según|mide|tasa|valor|proceso|conforme|volumen|punto|instante|forma|piensa|entiende|entienda|listo|documenta|valora|formula|incorpora|exceder|alcanza|correctamente|estar|vs)\s*\.?$/i;

function segment(tokens: string[], start: string, stops: string[]): string {
  const index = tokens.findIndex((token) => token.trim() === start);
  if (index < 0) return '';
  const body: string[] = [];
  for (let i = index + 1; i < tokens.length; i++) {
    const token = tokens[i]!.trim();
    if (stops.some((stop) => token === stop || token.startsWith(stop))) break;
    body.push(token);
  }
  return clean(body.join(' '));
}

async function slides(file: string) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const result: Array<{ slide: number; tokens: string[] }> = [];
  for (const name of names) {
    const xml = await zip.files[name]!.async('text');
    const tokens = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((match) => clean(match[1]!));
    result.push({ slide: Number(name.match(/\d+/)![0]), tokens });
  }
  return result;
}

async function main() {
  const dirs = fs
    .readdirSync(BASE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('_PDF'))
    .map((entry) => entry.name)
    .sort();
  const report: Array<{ package: string; findings: Array<{ slide: number; activity: string; text: string; reason: string }> }> = [];
  for (const pkg of dirs) {
    const full = path.join(BASE, pkg);
    const f08 = fs.readdirSync(full).find((file) => file.startsWith('08_'))!;
    const list = await slides(path.join(full, f08));
    const findings: Array<{ slide: number; activity: string; text: string; reason: string }> = [];
    for (const slide of list) {
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
        const reason: string[] = [];
        if (hasDanglingEnding(body)) reason.push('dangling');
        if (SUSPECT_END.test(body)) reason.push('suspectEnd');
        if (/\.{3,}|…/.test(body)) reason.push('ellipsis');
        if (/^(?:En una lista de tres puntos|de 24|como cuarto|en forma|conforme|y piensa|ayuda a entender)\.?$/i.test(body)) reason.push('known');
        if (reason.length) findings.push({ slide: slide.slide, activity: label, text: body, reason: reason.join('+') });
      }
    }
    report.push({ package: pkg, findings });
    console.log(`\n### ${pkg} | ${findings.length}`);
    for (const finding of findings) console.log(`  S${finding.slide} ${finding.activity} [${finding.reason}]: ${finding.text.slice(0, 220)}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
