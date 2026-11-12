/**
 * knowledge-types.ts — Tipos, esquema Zod y parser de frontmatter de la
 * Capa de Conocimiento SEP (AIC-SEP).
 *
 * La fuente de verdad son los archivos markdown de `src/knowledge/wiki/`.
 * Este módulo NO accede a base de datos: es lógica pura y testeable.
 *
 * Ver `src/knowledge/SCHEMA.md` para las convenciones.
 */

import { createHash } from 'crypto';
import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const KNOWLEDGE_DOMAINS = ['normativo', 'metodologico', 'curricular'] as const;
export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];

export const KNOWLEDGE_APPLICABLE = ['pmc', 'pips', 'paec', 'planeacion', 'editorial'] as const;
export type KnowledgeApplicable = (typeof KNOWLEDGE_APPLICABLE)[number];

/** Dominios que NUNCA pueden inyectarse en planeación ni editorial (regla D7). */
export const LEGAL_ONLY_DOMAINS: readonly KnowledgeDomain[] = ['normativo'];

/** Caracteres por token usados por el resto del motor editorial. */
export const CHARS_PER_TOKEN = 4;

// ─── Esquema Zod ─────────────────────────────────────────────────────────────

export const KnowledgeSourceRefSchema = z.object({
  ruta: z.string().min(3),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, 'sha256 debe ser un hash hexadecimal de 64 caracteres')
    .optional(),
});

export const KnowledgeFrontmatterSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9/_-]+$/, 'slug solo admite minúsculas, dígitos, "/", "_" y "-"'),
    titulo: z.string().min(5),
    dominio: z.enum(KNOWLEDGE_DOMAINS),
    applicable_a: z.array(z.enum(KNOWLEDGE_APPLICABLE)).min(1),
    fuentes_referencia: z.array(KnowledgeSourceRefSchema).min(1),
    status: z.enum(['draft', 'reviewed', 'published']).default('draft'),
    uac_slugs: z.array(z.string()).default([]),
    model: z.string().min(1).optional(),
    prompt_version: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dominio === 'normativo') {
      const forbidden = value.applicable_a.filter((g) => g !== 'pmc' && g !== 'pips');
      if (forbidden.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applicable_a'],
          message:
            `El dominio "normativo" solo puede aplicarse a pmc/pips. ` +
            `Valores prohibidos: ${forbidden.join(', ')}.`,
        });
      }
    }
  });

export type KnowledgeFrontmatter = z.infer<typeof KnowledgeFrontmatterSchema>;

export interface KnowledgePage {
  slug: string;
  dominio: KnowledgeDomain;
  titulo: string;
  contenido: string;
  applicable_a: KnowledgeApplicable[];
  sha256: string;
  tokenCount: number;
  publicado: boolean;
  uac_slugs?: string[];
  compiladoCon?: string | null;
  promptVersion?: string | null;
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Indica si una página es legalmente inyectable en un generador didáctico. */
export function isApplicableTo(
  dominio: KnowledgeDomain,
  applicable: readonly KnowledgeApplicable[],
  generator: KnowledgeApplicable
): boolean {
  if (!applicable.includes(generator)) return false;
  if (LEGAL_ONLY_DOMAINS.includes(dominio) && (generator === 'planeacion' || generator === 'editorial')) {
    return false;
  }
  return true;
}

// ─── Parser de frontmatter (subconjunto YAML estricto) ───────────────────────

type FrontmatterScalar = string | number | boolean;
type FrontmatterValue = FrontmatterScalar | FrontmatterScalar[] | FrontmatterMap | FrontmatterMap[];
interface FrontmatterMap {
  [key: string]: FrontmatterValue;
}

const KEY_LINE = /^([A-Za-z0-9_]+):\s*(.*)$/;
const LIST_ITEM = /^-\s*(.*)$/;

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(raw: string): FrontmatterScalar | FrontmatterScalar[] {
  const value = raw.trim();

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((part) => parseScalar(part) as FrontmatterScalar)
      .filter((part) => String(part).length > 0);
  }

  const unquoted = unquote(value);
  if (/^(true|false)$/i.test(unquoted)) return unquoted.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted);
  return unquoted;
}

function parseBlock(lines: string[]): FrontmatterValue {
  const first = lines.find((line) => line.trim() !== '');
  if (!first) return [];
  const isList = LIST_ITEM.test(first.trim());

  if (isList) {
    const items: Array<FrontmatterScalar | FrontmatterMap> = [];
    let current: FrontmatterMap | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const itemMatch = LIST_ITEM.exec(trimmed);
      if (itemMatch) {
        const rest = itemMatch[1].trim();
        const kv = KEY_LINE.exec(rest);
        if (kv) {
          current = { [kv[1]]: parseScalar(kv[2]) };
          items.push(current);
        } else {
          current = null;
          items.push(rest ? (parseScalar(rest) as FrontmatterScalar) : '');
        }
        continue;
      }
      const kv = KEY_LINE.exec(trimmed);
      if (!kv || !current) {
        throw new Error(`Línea de frontmatter inválida: "${line}"`);
      }
      current[kv[1]] = parseScalar(kv[2]);
    }
    return items as FrontmatterValue;
  }

  const map: FrontmatterMap = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const kv = KEY_LINE.exec(trimmed);
    if (!kv) throw new Error(`Línea de frontmatter inválida: "${line}"`);
    map[kv[1]] = parseScalar(kv[2]);
  }
  return map;
}

export interface ParsedKnowledgeFile {
  frontmatter: unknown;
  body: string;
}

/**
 * Separa el frontmatter YAML del cuerpo markdown. Falla ruidosamente si el
 * archivo no respeta el delimitador `---` o contiene sintaxis no soportada.
 */
export function parseKnowledgeFile(raw: string): ParsedKnowledgeFile {
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0]?.trim() !== '---') {
    throw new Error('El archivo debe iniciar con el delimitador "---" del frontmatter.');
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closing === -1) {
    throw new Error('No se encontró el delimitador de cierre "---" del frontmatter.');
  }

  const frontmatterLines = lines.slice(1, closing);
  const body = lines.slice(closing + 1).join('\n').replace(/^\n+/, '');

  const frontmatter: FrontmatterMap = {};
  let i = 0;
  while (i < frontmatterLines.length) {
    const line = frontmatterLines[i];
    if (!line.trim() || line.trim().startsWith('#')) {
      i += 1;
      continue;
    }
    if (/^\s/.test(line)) {
      throw new Error(`Sangría inesperada en frontmatter: "${line}"`);
    }
    const match = KEY_LINE.exec(line);
    if (!match) throw new Error(`Línea de frontmatter inválida: "${line}"`);
    const [, key, rawValue] = match;

    if (rawValue.trim() !== '') {
      frontmatter[key] = parseScalar(rawValue);
      i += 1;
      continue;
    }

    const block: string[] = [];
    i += 1;
    while (i < frontmatterLines.length && /^\s/.test(frontmatterLines[i])) {
      if (frontmatterLines[i].trim() !== '') block.push(frontmatterLines[i]);
      i += 1;
    }
    frontmatter[key] = parseBlock(block);
  }

  return { frontmatter, body };
}

export type KnowledgeValidation =
  | { success: true; data: KnowledgeFrontmatter }
  | { success: false; errors: string[] };

export function validateKnowledgeFrontmatter(input: unknown): KnowledgeValidation {
  const parsed = KnowledgeFrontmatterSchema.safeParse(input);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    }),
  };
}

/**
 * Imperativos que no deben aparecer en una página de conocimiento: el bloque
 * se inyecta como referencia y jamás debe reemplazar instrucciones del sistema.
 */
const PROMPT_INJECTION_SIGNATURES: readonly RegExp[] = [
  /ignora\s+(todas\s+)?(las\s+)?instrucciones/i,
  /olvida\s+(todas\s+)?(las\s+)?instrucciones/i,
  /responde\s+solo/i,
  /act[úu]a\s+como/i,
  /system\s*prompt/i,
  /<\s*\/?\s*(system|assistant|user)\s*>/i,
];

export function findPromptInjection(text: string): string | null {
  for (const signature of PROMPT_INJECTION_SIGNATURES) {
    if (signature.test(text)) return signature.source;
  }
  return null;
}

/** Elimina imperativos de inyección del cuerpo compilado (defensa en profundidad). */
export function stripPromptInjection(text: string): string {
  return text
    .split('\n')
    .filter((line) => findPromptInjection(line) === null)
    .join('\n');
}
