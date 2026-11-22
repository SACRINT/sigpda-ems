import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP!, 'opencode', 'structural-audit.json');

const PATTERNS: Array<[string, RegExp]> = [
  ['undefined', /\bundefined\b/gi],
  ['null', /\bnull\b/gi],
  ['placeholder', /\[(?:completar|placeholder|pendiente|insertar)[^\]]*\]/gi],
  ['template', /\$\{[^}]+\}/g],
  ['markdown_table', /\|(?:-{3,}|:?-+:?)\|/g],
  ['raw_latex', /\\(?:frac|sqrt|times|cdot|begin|end)\b/gi],
  ['raiz_literal', /\braiz\s*\(/gi],
  ['not_equal', /!=/g],
  ['modelo_por_construir', /Modelo por construir/gi],
  ['page_one', /P[áa]gina\s+1\s+de\s+\d+/gi],
];

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();

async function pdfPages(file: string): Promise<string[]> {
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

async function main() {
  const dirs = fs
    .readdirSync(BASE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('_PDF'))
    .map((entry) => entry.name)
    .sort();
  const report: Array<Record<string, unknown>> = [];
  for (const pkg of dirs) {
    const full = path.join(BASE, pkg);
    const files = fs
      .readdirSync(full)
      .filter((file) => /^0[1-7]_/.test(file))
      .sort();
    const materials: Array<Record<string, unknown>> = [];
    for (const file of files) {
      const list = await pdfPages(path.join(full, file));
      const text = list.join('\n');
      const counts: Record<string, number> = {};
      const examples: Record<string, string> = {};
      for (const [kind, regex] of PATTERNS) {
        regex.lastIndex = 0;
        const matches = [...text.matchAll(regex)];
        counts[kind] = matches.length;
        if (matches[0]?.index !== undefined) {
          examples[kind] = text.slice(Math.max(0, matches[0].index - 60), Math.min(text.length, matches[0].index + 140));
        }
      }
      const sessionNumbers = [...text.matchAll(/SESI[OÓ]N\s+(\d{1,2})/gi)].map((match) => Number(match[1]));
      const uniqueSessions = [...new Set(sessionNumbers)].sort((a, b) => a - b);
      materials.push({
        file,
        pages: list.length,
        chars: text.length,
        counts,
        examples,
        uniqueSessions: uniqueSessions.length,
        sessionMin: uniqueSessions[0] ?? null,
        sessionMax: uniqueSessions[uniqueSessions.length - 1] ?? null,
      });
    }
    report.push({ package: pkg, materials });
    const bad = materials
      .map((material) => {
        const counts = material.counts as Record<string, number>;
        const keys = Object.keys(counts).filter((key) => key !== 'page_one' && counts[key]! > 0);
        return `${String(material.file).slice(0, 2)}:${keys.join('+') || 'ok'}`;
      })
      .join(' | ');
    console.log(`${pkg}: ${bad}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
