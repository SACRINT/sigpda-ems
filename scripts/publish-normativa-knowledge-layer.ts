/**
 * publish-normativa-knowledge-layer.ts — Publica las páginas normativas de la
 * Capa de Conocimiento con un resumen extractivo determinista de <= 800 tokens.
 *
 * No usa IA. Conserva el encabezado, la nota de fuente y los artículos con mayor
 * relevancia para PMC/PIPS, respetando el orden original del documento.
 *
 * Uso:
 *   npx tsx scripts/publish-normativa-knowledge-layer.ts            # dry-run
 *   npx tsx scripts/publish-normativa-knowledge-layer.ts --apply    # publica
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)/);
if (!match) {
  console.error('DATABASE_URL no encontrado en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const APPLY = process.argv.includes('--apply');
const MAX_TOKENS = 800;
const MAX_CHARS = MAX_TOKENS * 4;
const COMPILED_WITH = 'normativa-extractiva-v1';

interface NormativaRow {
  id: number;
  slug: string;
  titulo: string;
  contenido: string;
  token_count: number;
  source_ids: number[];
}

interface Section {
  index: number;
  heading: string;
  body: string;
  score: number;
}

const KEYWORDS = [
  'planeación',
  'planeacion',
  'supervisión',
  'supervision',
  'evaluación',
  'evaluacion',
  'mejora continua',
  'diagnóstico',
  'diagnostico',
  'metas',
  'indicadores',
  'gestión',
  'gestion',
  'directivos',
  'docentes',
  'plantel',
  'estudiantes',
  'educandos',
  'trayectoria',
  'formación',
  'formacion',
  'equidad',
  'inclusión',
  'inclusion',
  'excelencia',
  'derechos',
  'seguridad escolar',
  'formación dual',
  'formacion dual',
  'media superior',
  'educación media superior',
  'educacion media superior',
];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function scoreText(text: string): number {
  const normalized = text.toLowerCase();
  return KEYWORDS.reduce((total, keyword) => {
    if (!normalized.includes(keyword)) return total;
    return total + 1;
  }, 0);
}

function splitContent(content: string): { header: string; sections: Section[] } {
  const lines = content.split('\n');
  const headerLines: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = {
        index: sections.length,
        heading: line.trim(),
        body: '',
        score: scoreText(line) * 5,
      };
      continue;
    }

    if (current) {
      current.body += `${line}\n`;
    } else {
      headerLines.push(line);
    }
  }

  if (current) sections.push(current);

  for (const section of sections) {
    section.body = section.body.trim();
    section.score += scoreText(section.body);
  }

  return {
    header: headerLines.join('\n').trim(),
    sections,
  };
}

function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, Math.max(0, maxChars));
  const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
  if (cut > maxChars * 0.5) return `${slice.slice(0, cut + 1).trim()}\n`;
  return `${slice.trim()}\n`;
}

function compressContent(content: string): string {
  const { header, sections } = splitContent(content);
  if (sections.length === 0) {
    return truncateAtSentence(content, MAX_CHARS).trim();
  }

  const ranked = [...sections].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  const selected: Section[] = [];
  let used = estimateTokens(header);

  for (const section of ranked) {
    const sectionTokens = estimateTokens(`${section.heading}\n${section.body}`);
    if (used + sectionTokens <= MAX_TOKENS) {
      selected.push(section);
      used += sectionTokens;
      continue;
    }

    const remainingTokens = MAX_TOKENS - used;
    if (remainingTokens >= 80) {
      const availableChars = remainingTokens * 4 - section.heading.length - 2;
      if (availableChars > 160) {
        selected.push({
          ...section,
          body: truncateAtSentence(section.body, availableChars),
        });
      }
    }
    break;
  }

  if (selected.length === 0) {
    selected.push(ranked[0]);
  }

  const ordered = selected.sort((a, b) => a.index - b.index);
  const body = ordered.map((section) => `${section.heading}\n${section.body}`).join('\n\n');
  const result = `${header}\n\n${body}`.trim();

  if (estimateTokens(result) <= MAX_TOKENS) return result;
  return truncateAtSentence(result, MAX_CHARS).trim();
}

async function main(): Promise<void> {
  console.log(`=== PUBLICAR NORMATIVA (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  const rows = (await sql`
    SELECT id, slug, titulo, contenido, token_count, source_ids
    FROM knowledge_pages
    WHERE dominio = 'normativo'
    ORDER BY slug
  `) as unknown as NormativaRow[];

  if (rows.length === 0) {
    console.log('No hay páginas normativas.');
    return;
  }

  let published = 0;
  for (const row of rows) {
    const compressed = compressContent(row.contenido);
    const tokens = estimateTokens(compressed);
    const hash = sha256Hex(compressed);

    if (tokens > MAX_TOKENS) {
      console.error(`[ABORT] ${row.slug}: ${tokens} tokens > ${MAX_TOKENS}`);
      process.exitCode = 1;
      continue;
    }

    console.log(
      `[${APPLY ? 'PUBLISH' : 'PLAN'}] ${row.slug}: ${row.token_count} -> ${tokens} tokens`
    );

    if (!APPLY) continue;

    await sql`
      UPDATE knowledge_pages
      SET contenido = ${compressed},
          token_count = ${tokens},
          sha256 = ${hash},
          publicado = TRUE,
          compilado_con = ${COMPILED_WITH},
          updated_at = NOW()
      WHERE id = ${row.id}
    `;

    await sql`
      INSERT INTO knowledge_sync_log (archivo, slug, accion, sha256, detalle)
      VALUES (
        ${`db:knowledge_pages/${row.slug}`},
        ${row.slug},
        'updated',
        ${hash},
        ${JSON.stringify({
          origen: 'publish-normativa-knowledge-layer',
          tokens_antes: row.token_count,
          tokens_despues: tokens,
          max_tokens: MAX_TOKENS,
          source_ids: row.source_ids,
        })}::jsonb
      )
    `;

    published++;
  }

  console.log(`\nResumen: ${APPLY ? published : rows.length} planificadas.`);
  if (!APPLY) {
    console.log('Dry-run: no se escribió nada. Ejecuta con --apply para publicar.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
