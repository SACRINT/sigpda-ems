import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { hasDanglingEnding } from '../src/lib/editorial/pedagogical-text-fitter';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', '09-node-defects.json');

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const TRUNC_END =
  /(?:^|\s)(?:estar|ser|tener|haber|vs|correctamente|por exceder|no alcanza|comunica|trasladar|sistematiza|señala|permite|excede|alcanza|utiliza|sirve|presenta|integra|contiene|corresponde|paralelas|las líneas|del|de la|de los|de las|en el|en la|con el|con la|para el|para la|por el|por la|al|que)\s*\.?$/i;

async function pages(file: string): Promise<string[]> {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try {
    const result = (await parser.getText()).pages ?? [];
    return (result as Array<{ text?: string } | string>).map((page) =>
      clean(typeof page === 'string' ? page : page.text || '')
    );
  } finally {
    await parser.destroy();
  }
}

function extractNodes(block: string, labels: string[]): Array<{ label: string; text: string }> {
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(?:${sorted.join('|')})\\b`, 'g');
  const matches = [...block.matchAll(regex)];
  const nodes: Array<{ label: string; text: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const label = match[0];
    const start = (match.index ?? 0) + label.length;
    const end = matches[i + 1]?.index ?? block.length;
    const text = block.slice(start, end).replace(/^[\s:.-]+/, '').trim();
    if (text) nodes.push({ label, text });
  }
  return nodes;
}

function suspicious(text: string): boolean {
  if (!text) return true;
  if (text.length < 8) return true;
  if (/\.{3,}|…\s*$/.test(text)) return true;
  if (hasDanglingEnding(text)) return true;
  if (TRUNC_END.test(text)) return true;
  return false;
}

async function main() {
  const dirs = fs
    .readdirSync(BASE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('_PDF'))
    .map((entry) => entry.name)
    .sort();
  const report: Array<{ package: string; pages: number; findings: Array<{ page: number; label: string; text: string }> }> = [];
  for (const pkg of dirs) {
    const full = path.join(BASE, pkg);
    const f09 = fs.readdirSync(full).find((file) => file.startsWith('09_'))!;
    const list = await pages(path.join(full, f09));
    const findings: Array<{ page: number; label: string; text: string }> = [];
    for (let i = 0; i < list.length; i++) {
      const text = list[i]!;
      const conceptIndex = text.indexOf('CONCEPTO CENTRAL');
      const procedureIndex = text.indexOf('PROCEDIMIENTO CLAVE DE ESTUDIO');
      if (conceptIndex >= 0) {
        const end = procedureIndex > conceptIndex ? procedureIndex : text.length;
        const block = text.slice(conceptIndex + 'CONCEPTO CENTRAL'.length, end);
        const nodes = extractNodes(block, [
          'FENÓMENO',
          'FENOMENO',
          'CONCEPTO',
          'PRÁCTICA',
          'PRACTICA',
          'DECISIÓN',
          'DECISION',
          'F',
          'C',
          'P',
          'D',
        ]);
        for (const node of nodes) {
          if (suspicious(node.text)) findings.push({ page: i + 1, label: node.label, text: node.text });
        }
      }
      const modelIndex = text.indexOf('MODELO Y FORMULA CENTRAL');
      if (modelIndex >= 0) {
        const end = procedureIndex > modelIndex ? procedureIndex : text.length;
        const block = text.slice(modelIndex + 'MODELO Y FORMULA CENTRAL'.length, end);
        const nodes = extractNodes(block, ['ENTRADA', 'PROCESO', 'SALIDA', 'CONTROL', 'I', 'P', 'S', 'R']);
        for (const node of nodes) {
          if (suspicious(node.text)) findings.push({ page: i + 1, label: node.label, text: node.text });
        }
      }
    }
    report.push({ package: pkg, pages: list.length, findings });
    console.log(`\n### ${pkg} | pages=${list.length} | nodeIssues=${findings.length}`);
    for (const finding of findings.slice(0, 8)) console.log(`  p${finding.page} ${finding.label}: ${finding.text.slice(0, 180)}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
