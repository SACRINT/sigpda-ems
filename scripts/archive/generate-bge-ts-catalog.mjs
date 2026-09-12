import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const catalogPath = join(__dir, 'bge-laboral-official-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));

// Build the TypeScript catalog file
const lines = [];

lines.push(`// AUTO-GENERATED — DO NOT EDIT MANUALLY`);
lines.push(`// Source: scripts/extract-bge-official-laboral.py`);
lines.push(`// Generated from: 15 PDFs oficiales BGE 2024 (Currículo Laboral)`);
lines.push(`// Coverage: 15 capacitaciones / 120 UACs / 360 Actividades Clave`);
lines.push(``);
lines.push(`export interface ActividadClave {`);
lines.push(`  order: 1 | 2 | 3;`);
lines.push(`  name: string;`);
lines.push(`  hours: 18;`);
lines.push(`}`);
lines.push(``);
lines.push(`export interface UACEntry {`);
lines.push(`  semester: 3 | 4 | 5 | 6;`);
lines.push(`  uac_num: 1 | 2;`);
lines.push(`  activities: [ActividadClave, ActividadClave, ActividadClave];`);
lines.push(`  learning_outcome: string;`);
lines.push(`  total_hours: 54;`);
lines.push(`}`);
lines.push(``);
lines.push(`export type BGECapacitacion =`);

const names = Object.keys(catalog);
names.forEach((name, i) => {
  const comma = i < names.length - 1 ? ' |' : ';';
  lines.push(`  | '${name}'${comma}`);
});

lines.push(``);
lines.push(`// ============================================================`);
lines.push(`// CATÁLOGO MAESTRO: 15 Capacitaciones BGE`);
lines.push(`// ============================================================`);
lines.push(`export const BGE_ACTIVIDADES_CATALOG: Record<string, UACEntry[]> = {`);

for (const [currName, uacs] of Object.entries(catalog)) {
  lines.push(`  // --- ${currName} ---`);
  lines.push(`  ${JSON.stringify(currName)}: [`);
  for (const uac of uacs) {
    lines.push(`    {`);
    lines.push(`      semester: ${uac.semester},`);
    lines.push(`      uac_num: ${uac.uac_num},`);
    lines.push(`      activities: [`);
    for (const a of uac.activities) {
      lines.push(`        { order: ${a.order}, name: ${JSON.stringify(a.name)}, hours: 18 },`);
    }
    lines.push(`      ],`);
    lines.push(`      learning_outcome: ${JSON.stringify(uac.learning_outcome || '')},`);
    lines.push(`      total_hours: 54,`);
    lines.push(`    },`);
  }
  lines.push(`  ],`);
}

lines.push(`};`);
lines.push(``);
lines.push(`// ============================================================`);
lines.push(`// UTILITY FUNCTIONS`);
lines.push(`// ============================================================`);
lines.push(``);
lines.push(`/** Normalize string: remove accents, lowercase, trim whitespace */`);
lines.push(`function normalize(s: string): string {`);
lines.push(`  return s`);
lines.push(`    .normalize('NFD')`);
lines.push(`    .replace(/[\\u0300-\\u036f]/g, '')`);
lines.push(`    .toLowerCase()`);
lines.push(`    .trim();`);
lines.push(`}`);
lines.push(``);
lines.push(`/** Find a curriculum in the catalog (case/accent insensitive) */`);
lines.push(`function findCurriculum(capacitacion: string): UACEntry[] | null {`);
lines.push(`  const normTarget = normalize(capacitacion);`);
lines.push(`  for (const [key, val] of Object.entries(BGE_ACTIVIDADES_CATALOG)) {`);
lines.push(`    if (normalize(key) === normTarget) return val;`);
lines.push(`  }`);
lines.push(`  // Partial match fallback`);
lines.push(`  for (const [key, val] of Object.entries(BGE_ACTIVIDADES_CATALOG)) {`);
lines.push(`    if (normalize(key).includes(normTarget) || normTarget.includes(normalize(key))) {`);
lines.push(`      return val;`);
lines.push(`    }`);
lines.push(`  }`);
lines.push(`  return null;`);
lines.push(`}`);
lines.push(``);
lines.push(`/**`);
lines.push(` * Get the 3 official Actividades Clave for a BGE UAC.`);
lines.push(` * Matches by capacitacion name, semester, and UAC number (1 or 2).`);
lines.push(` * Returns null if not found — caller must handle the fallback.`);
lines.push(` */`);
lines.push(`export function getActividadesClaveBGE(`);
lines.push(`  capacitacion: string,`);
lines.push(`  semestre: number,`);
lines.push(`  uacNum: 1 | 2`);
lines.push(`): [ActividadClave, ActividadClave, ActividadClave] | null {`);
lines.push(`  const entries = findCurriculum(capacitacion);`);
lines.push(`  if (!entries) return null;`);
lines.push(`  const entry = entries.find(e => e.semester === semestre && e.uac_num === uacNum);`);
lines.push(`  return entry?.activities ?? null;`);
lines.push(`}`);
lines.push(``);
lines.push(`/**`);
lines.push(` * Get the official Resultado de Aprendizaje for a BGE UAC.`);
lines.push(` * Returns empty string if not found.`);
lines.push(` */`);
lines.push(`export function getResultadoAprendizajeBGE(`);
lines.push(`  capacitacion: string,`);
lines.push(`  semestre: number,`);
lines.push(`  uacNum: 1 | 2`);
lines.push(`): string {`);
lines.push(`  const entries = findCurriculum(capacitacion);`);
lines.push(`  if (!entries) return '';`);
lines.push(`  const entry = entries.find(e => e.semester === semestre && e.uac_num === uacNum);`);
lines.push(`  return entry?.learning_outcome ?? '';`);
lines.push(`}`);
lines.push(``);
lines.push(`/**`);
lines.push(` * List all available BGE capacitacion names.`);
lines.push(` */`);
lines.push(`export function listBGECapacitaciones(): string[] {`);
lines.push(`  return Object.keys(BGE_ACTIVIDADES_CATALOG);`);
lines.push(`}`);

const tsContent = lines.join('\n');
const outPath = join(__dir, '../src/lib/bge-actividades-clave-catalog.ts');
writeFileSync(outPath, tsContent, 'utf-8');

console.log(`[DONE] Generated: src/lib/bge-actividades-clave-catalog.ts`);
console.log(`  Lines: ${lines.length}`);
console.log(`  Size: ${Buffer.byteLength(tsContent, 'utf-8').toLocaleString()} bytes`);
console.log(`  Capacitaciones: ${Object.keys(catalog).length}`);
console.log(`  UACs: ${Object.values(catalog).reduce((s, u) => s + u.length, 0)}`);
console.log(`  Actividades: ${Object.values(catalog).reduce((s, u) => s + u.length * 3, 0)}`);
