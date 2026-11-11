/**
 * scripts/build-prompt-catalog.ts — Genera el módulo TypeScript del catálogo de
 * prompts de planeación a partir de los fragmentos markdown versionados en
 * `src/prompts/catalog/planeacion/*.md`.
 *
 * El runtime NO lee archivos: importa el módulo generado y commitado.
 *
 * Uso:
 *   npx tsx scripts/build-prompt-catalog.ts            # dry-run
 *   npx tsx scripts/build-prompt-catalog.ts --write    # escribe el .ts generado
 */

import { promises as fs } from 'fs';
import path from 'path';
import { parseKnowledgeFile } from '@/lib/knowledge/knowledge-types';

const CATALOG_DIR = path.join(process.cwd(), 'src', 'prompts', 'catalog', 'planeacion');
const OUTPUT = path.join(
  process.cwd(),
  'src',
  'lib',
  'prompts',
  'generated',
  'prompt-catalog.generated.ts'
);

const VALID_TYPES = ['laboral', 'fundamental', 'extendido'] as const;
type PromptType = (typeof VALID_TYPES)[number];

interface CatalogEntry {
  id: string;
  tipo: PromptType;
  version: string;
  descripcion: string;
  contenido: string;
}

function requireString(frontmatter: Record<string, unknown>, key: string, archivo: string): string {
  const value = frontmatter[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${archivo}: el campo "${key}" es obligatorio y debe ser texto.`);
  }
  return value.trim();
}

async function buildCatalog(): Promise<CatalogEntry[]> {
  const files = (await fs.readdir(CATALOG_DIR)).filter((file) => file.endsWith('.md')).sort();
  if (files.length === 0) throw new Error(`No hay fragmentos .md en ${CATALOG_DIR}`);

  const entries: CatalogEntry[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(CATALOG_DIR, file), 'utf8');
    const { frontmatter, body } = parseKnowledgeFile(raw);
    const fm = frontmatter as Record<string, unknown>;

    const tipo = requireString(fm, 'tipo', file);
    if (!VALID_TYPES.includes(tipo as PromptType)) {
      throw new Error(`${file}: tipo "${tipo}" inválido. Usa: ${VALID_TYPES.join(', ')}.`);
    }

    const contenido = body.trim();
    if (contenido.length < 100) {
      throw new Error(`${file}: el fragmento de prompt es demasiado corto (${contenido.length} chars).`);
    }

    entries.push({
      id: requireString(fm, 'id', file),
      tipo: tipo as PromptType,
      version: requireString(fm, 'version', file),
      descripcion: requireString(fm, 'descripcion', file),
      contenido,
    });
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.tipo)) throw new Error(`Tipo duplicado en el catálogo: ${entry.tipo}`);
    seen.add(entry.tipo);
  }
  for (const tipo of VALID_TYPES) {
    if (!seen.has(tipo)) throw new Error(`Falta el fragmento obligatorio para tipo "${tipo}".`);
  }

  return entries;
}

function renderModule(entries: CatalogEntry[]): string {
  const record = entries
    .map(
      (entry) =>
        `  ${entry.tipo}: {\n` +
        `    id: ${JSON.stringify(entry.id)},\n` +
        `    tipo: ${JSON.stringify(entry.tipo)},\n` +
        `    version: ${JSON.stringify(entry.version)},\n` +
        `    descripcion: ${JSON.stringify(entry.descripcion)},\n` +
        `    contenido: ${JSON.stringify(entry.contenido)},\n` +
        `  },`
    )
    .join('\n');

  return `// AUTO-GENERADO por scripts/build-prompt-catalog.ts — NO EDITAR A MANO.
// Fuente: src/prompts/catalog/planeacion/*.md

export type PlanningPromptType = 'laboral' | 'fundamental' | 'extendido';

export interface PromptCatalogEntry {
  id: string;
  tipo: PlanningPromptType;
  version: string;
  descripcion: string;
  contenido: string;
}

export const PROMPT_CATALOG: Record<PlanningPromptType, PromptCatalogEntry> = {
${record}
};
`;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const entries = await buildCatalog();
  const moduleSource = renderModule(entries);

  console.log(`📚 Catálogo de prompts: ${entries.length} fragmento(s)`);
  for (const entry of entries) {
    console.log(`   - ${entry.tipo} (${entry.id} · ${entry.version}) · ${entry.contenido.length} chars`);
  }

  if (!write) {
    console.log('\n🔎 Dry-run: usa --write para generar el módulo TypeScript.');
    return;
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, moduleSource, 'utf8');
  console.log(`\n✅ Generado: ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch((error) => {
  console.error('❌ Error generando catálogo de prompts:', error instanceof Error ? error.message : error);
  process.exit(1);
});
