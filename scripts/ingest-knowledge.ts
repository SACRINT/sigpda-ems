/**
 * scripts/ingest-knowledge.ts — Compilador determinista de páginas normativas
 * desde la tabla `normativa_articulos` (Normateca SEP ya ingerida).
 *
 * Costo $0 de IA: no llama a ningún modelo. Extrae los artículos aplicables a
 * PMC/PIPS y genera síntesis markdown en `src/knowledge/wiki/normativa/`.
 *
 * Uso:
 *   npx tsx scripts/ingest-knowledge.ts                 # dry-run (previsualiza)
 *   npx tsx scripts/ingest-knowledge.ts --write         # escribe los .md
 *   npx tsx scripts/ingest-knowledge.ts --doc=2,5,8     # subconjunto de documentos
 */

import { neon } from '@neondatabase/serverless';
import { promises as fs } from 'fs';
import path from 'path';
import { loadEnvLocal } from './lib/load-env';
import {
  estimateTokens,
  sha256Hex,
  stripPromptInjection,
} from '@/lib/knowledge/knowledge-types';

/** Piloto F2: documentos de mayor valor para PMC/PIPS. */
const PILOT_DOC_IDS = [2, 5, 8, 34, 44, 47, 55, 60, 61, 62, 68, 93];

const MAX_BODY_CHARS = 5200;
const WIKI_DIR = path.join(process.cwd(), 'src', 'knowledge', 'wiki', 'normativa');

interface DocumentRow {
  id: number;
  titulo: string;
  tipo: string;
}

interface ArticleRow {
  documento_id: number;
  numero: string;
  texto: string;
  orden_en_doc: number;
}

interface GeneratedPage {
  docId: number;
  slug: string;
  archivo: string;
  contenido: string;
  tokens: number;
  articulos: number;
  truncado: boolean;
}

function parseArgs(argv: string[]): { write: boolean; docIds: number[] } {
  const docArg = argv.find((arg) => arg.startsWith('--doc='));
  const docIds = docArg
    ? docArg
        .slice('--doc='.length)
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    : PILOT_DOC_IDS;
  return { write: argv.includes('--write'), docIds };
}

function slugify(value: string, maxLength = 60): string {
  const full = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (full.length <= maxLength) return full;
  const cut = full.slice(0, maxLength);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > maxLength * 0.4 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

function cleanText(value: string): string {
  return stripPromptInjection(
    value
      .replace(/\r\n/g, '\n')
      .replace(/\u0000/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .trim()
  );
}

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildPage(document: DocumentRow, articles: ArticleRow[]): GeneratedPage {
  const sections: string[] = [];
  let usedChars = 0;
  let truncado = false;
  let included = 0;

  for (const article of articles) {
    const header = `## ${article.numero.trim()}\n`;
    const body = cleanText(article.texto);
    if (!body) continue;

    const chunk = `${header}${body}\n\n`;
    if (usedChars + chunk.length > MAX_BODY_CHARS) {
      truncado = true;
      const remaining = MAX_BODY_CHARS - usedChars;
      if (remaining > 200) {
        sections.push(chunk.slice(0, remaining).trimEnd());
        included += 1;
      }
      break;
    }
    sections.push(chunk.trimEnd());
    usedChars += chunk.length;
    included += 1;
  }

  const sourceHash = sha256Hex(articles.map((a) => `${a.numero}\n${a.texto}`).join('\n'));
  const titulo = document.titulo.trim();
  const baseSlug = slugify(titulo) || `documento-${document.id}`;
  const slug = `normativa/${baseSlug}`;

  const header = [
    '---',
    `slug: ${slug}`,
    `titulo: ${yamlString(titulo)}`,
    'dominio: normativo',
    'applicable_a: [pmc, pips]',
    'status: draft',
    'model: deterministic-normateca-v1',
    'prompt_version: normateca-v1',
    'fuentes_referencia:',
    `  - ruta: ${yamlString(`db:normativa_documentos/${document.id}`)}`,
    `    sha256: ${yamlString(sourceHash)}`,
    '---',
    '',
    `# ${titulo}`,
    '',
    `> Fuente: Normateca SEP, documento ${document.id} (${document.tipo}). ` +
      'Transcripción literal de los artículos aplicables a PMC/PIPS.',
    '',
    ...sections,
  ];

  if (truncado) {
    header.push(
      '',
      '> Página truncada al presupuesto de ~1,500 tokens. Consulta el documento completo en la Normateca.'
    );
  }

  const contenido = `${header.join('\n').trimEnd()}\n`;
  return {
    docId: document.id,
    slug,
    archivo: path.join(WIKI_DIR, `${baseSlug}.md`),
    contenido,
    tokens: estimateTokens(contenido),
    articulos: included,
    truncado,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loadEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definido (revisa .env.local).');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log(
    `📚 ingest-knowledge · documentos=${options.docIds.length} · modo=${options.write ? 'write' : 'dry-run'}\n`
  );

  const documents = (await sql`
    SELECT id, titulo, tipo
    FROM normativa_documentos
    WHERE id = ANY(${options.docIds}::int[]) AND vigente = TRUE
    ORDER BY id ASC
  `) as DocumentRow[];

  const foundIds = new Set(documents.map((document) => document.id));
  const missing = options.docIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    console.warn(`⚠️  Documentos no encontrados o no vigentes: ${missing.join(', ')}\n`);
  }

  const articles = (await sql`
    SELECT documento_id, numero, texto, orden_en_doc
    FROM normativa_articulos
    WHERE documento_id = ANY(${options.docIds}::int[])
      AND aplicable_a && ARRAY['pmc','pips']::text[]
    ORDER BY documento_id ASC, orden_en_doc ASC
  `) as ArticleRow[];

  const byDocument = new Map<number, ArticleRow[]>();
  for (const article of articles) {
    const list = byDocument.get(article.documento_id) ?? [];
    list.push(article);
    byDocument.set(article.documento_id, list);
  }

  if (options.write) {
    await fs.mkdir(WIKI_DIR, { recursive: true });
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const document of documents) {
    const documentArticles = byDocument.get(document.id) ?? [];
    if (documentArticles.length === 0) {
      console.warn(`⏭️  #${document.id} ${document.titulo}: sin artículos PMC/PIPS, se omite.`);
      skipped += 1;
      continue;
    }

    const page = buildPage(document, documentArticles);

    let previous: string | null = null;
    try {
      previous = await fs.readFile(page.archivo, 'utf8');
    } catch {
      previous = null;
    }

    const state = previous === page.contenido ? 'unchanged' : previous ? 'updated' : 'created';
    if (state === 'unchanged') unchanged += 1;
    else if (state === 'updated') updated += 1;
    else created += 1;

    console.log(
      `[${state.toUpperCase()}] #${document.id} → ${page.slug} ` +
        `(${page.articulos} arts, ≈${page.tokens} tokens${page.truncado ? ', truncada' : ''})`
    );

    if (options.write && state !== 'unchanged') {
      await fs.writeFile(page.archivo, page.contenido, 'utf8');
    }
  }

  console.log(
    `\nResumen: ${created} creadas, ${updated} actualizadas, ${unchanged} sin cambios, ${skipped} omitidas.`
  );
  if (!options.write) {
    console.log('🔎 Dry-run: no se escribió ningún archivo. Usa --write para persistir.');
  }
}

main().catch((error) => {
  console.error('❌ Error en ingest-knowledge:', error instanceof Error ? error.message : error);
  process.exit(1);
});
