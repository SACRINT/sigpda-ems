import { stripWorkbookTags } from '@/lib/guide-engine/workbook-tags';
import { stripMaterialTokens } from '@/lib/materials/material-tokens';
import { getMaterial } from '@/lib/materials/materials-catalog';
import { stripInlineMarkdownEmphasis } from '@/lib/utils/inline-markdown';
import { stripMarkdownTables } from '@/lib/editorial/markdown-table-sanitizer';
import {
  SacrintContentError,
  type SacrintContentErrorContext,
} from '@/lib/editorial/topic-title-resolver';
import { normalizeMathNotation } from '../math-text';

export const RUBRIC_OR_META_LEAK_RE =
  /ponderaci[oó]n\s*:\s*\d+\s*%|excelente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|bueno\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|suficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|insuficiente\s*\(\s*\d+\s*(?:pts?|puntos?)\s*\)|este\s+(?:ejercicio|apartado)\s+de\s+\d+\s+palabras|este\s+contenido\s+formativo\s+sienta\s+las\s+bases\s+metodol[oó]gicas|y\s+las\s+normas\s+oficiales\s+aplicables\b|^conocimientos\s+construidos\s+en\s+la\s+sesi[oó]n\s+previa\s+de\b/i;

export const BOILERPLATE_PREFIX_RE =
  /^(?:(?:misi[oó]n|bloque|sesi[oó]n)\s*\d+\s*:\s*)+(?:optimizaci[oó]n\s+y\s+consolidaci[oó]n\s+de\s+la\s+evidencia|exploraci[oó]n\s+diagn[oó]stica\s+y\s+problematizaci[oó]n\s+situada|modelado\s+metodol[oó]gico\s+y\s+procedimientos\s+clave|evaluaci[oó]n\s+(?:de\s+logros|sumativa|diagn[oó]stica)|fundamentaci[oó]n\s+e\s+intuici[oó]n)\s*[—–\-:]\s*/i;


function stripMaterialTagsForSlide(text: string): string {
  const withoutUnknownBareTags = text.replace(/\[\[\s*material\s*:\s*([a-zA-Z0-9-]+)\s*\]\]/gi, (full, slug: string) =>
    getMaterial(slug.toLowerCase()) ? full : ''
  );
  return stripMaterialTokens(withoutUnknownBareTags);
}

const MASCULINE_A_NOUN_EXCEPTIONS = new Set([
  'dia',
  'dias',
  'mapa',
  'mapas',
  'problema',
  'problemas',
  'sistema',
  'sistemas',
  'tema',
  'temas',
  'planeta',
  'planetas',
  'idioma',
  'idiomas',
  'clima',
  'climas',
  'programa',
  'programas',
  'esquema',
  'esquemas',
  'poema',
  'poemas',
  'drama',
  'dramas',
  'fantasma',
  'fantasmas',
  'sintoma',
  'sintomas',
]);

function isLikelyFeminineNoun(noun: string): boolean {
  const lower = noun.toLowerCase();
  if (MASCULINE_A_NOUN_EXCEPTIONS.has(lower)) return false;
  if (/(?:a|as)$/.test(lower)) return true;
  return /(?:ciones|siones|dades|tades|tudes|umbres|ies|sis|itis|eces|ezas|oras|istas|ncias|encias|ancias|uras)$/.test(
    lower
  );
}

export function repairSpanishSurfaceGrammar(value: string | null | undefined): string {
  if (!value) return '';
  let out = value
    .replace(/\btodas los respaldos\b/gi, 'todos los respaldos')
    .replace(/\btodas los inspecciones\b/gi, 'todas las inspecciones')
    .replace(/\btodos las pautas\b/gi, 'todas las pautas')
    .replace(/\btodas las respaldos\b/gi, 'todos los respaldos')
    .replace(/\blas pautas t[eé]cnicos\b/gi, 'las pautas técnicas')
    .replace(/\bla pauta adecuado\b/gi, 'la pauta adecuada')
    .replace(/\bel caso planteada\b/gi, 'el caso planteado')
    .replace(/\bla prop[oó]sito\b/gi, 'el propósito')
    .replace(/\bel l[aá]mina\b/gi, 'la lámina')
    .replace(/\b([Uu])n funci[oó]n\b/g, '$1na función')
    .replace(
      /\b([Ll])os\s+((?:(?:dos|tres|cuatro|cinco|seis|divers[oa]s|distint[oa]s|vari[oa]s|diferentes|principales)\s+)?)clases\b/g,
      (_m, lChar: string, mod: string) => {
        const femMod = mod
          .replace(/\bdiversos\b/gi, 'diversas')
          .replace(/\bdistintos\b/gi, 'distintas')
          .replace(/\bvarios\b/gi, 'varias');
        const art = lChar === 'L' ? 'Las' : 'las';
        return `${art} ${femMod}clases`;
      }
    )
    .replace(/\bconforme a corresponda\b/gi, 'conforme corresponda');

  out = out.replace(/\b(todas|todos)\s+(los|las)\s+([a-záéíóúñ]+)/gi, (_match, _quant, _art, noun: string) => {
    const feminine = isLikelyFeminineNoun(noun);
    return `${feminine ? 'todas' : 'todos'} ${feminine ? 'las' : 'los'} ${noun}`;
  });

  out = out
    .replace(/\brespaldos([^.!?]{0,60}?)\brequeridas\b/gi, 'respaldos$1requeridos')
    .replace(/\bpautas([^.!?]{0,60}?)\brequeridos\b/gi, 'pautas$1requeridas')
    .replace(/\brespaldos([^.!?]{0,60}?)\bfirmadas\b/gi, 'respaldos$1firmados')
    .replace(/\brespaldos([^.!?]{0,60}?)\bt[eé]cnicas\b/gi, 'respaldos$1técnicos');

  return out;
}

/**
 * Limpia texto editorial para láminas e infografías preservando operadores aritméticos (`2*x`, `a * b`).
 */
export function cleanSacrintText(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTagsForSlide(text);
  text = stripMarkdownTables(text);
  // Quitar reglas horizontales y encabezados Markdown manteniendo el título textual
  text = text
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/(^|\r?\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = stripInlineMarkdownEmphasis(text);
  text = text
    .replace(/\\\$/g, '$')
    .replace(/\$(\d+(?:[.,]\d+)?\s*:\s*\d+(?:[.,]\d+)?)\$/g, '$1')
    .replace(/\$(\d+(?:[.,]\d+)?\s*(?:cm|m|mm|km)\s*=\s*\d+(?:[.,]\d+)?\s*(?:cm|m|mm|km))\$/gi, '$1');
  text = normalizeMathNotation(text);
  text = text
    .replace(/\bpara\s+dentro\s+de\s+/gi, 'en ')
    .replace(/\bdentro\s+de\s+/gi, 'en ')
    .replace(/\?(['"»”’])\?/g, '?$1')
    .replace(/(['"][^'"]+?)\.{2,}(?=\s|[A-Za-z'"])/g, '$1 ___');
  return repairSpanishSurfaceGrammar(text).replace(/\s+/g, ' ').trim();
}

export function cleanSacrintTextPreservingLines(value: string | null | undefined): string {
  if (!value) return '';
  let text = stripWorkbookTags(value);
  text = stripMaterialTagsForSlide(text);
  text = stripMarkdownTables(text);
  text = text
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/(^|\r?\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  text = stripInlineMarkdownEmphasis(text);
  text = text
    .replace(/\\\$/g, '$')
    .replace(/\$(\d+(?:[.,]\d+)?\s*:\s*\d+(?:[.,]\d+)?)\$/g, '$1')
    .replace(/\$(\d+(?:[.,]\d+)?\s*(?:cm|m|mm|km)\s*=\s*\d+(?:[.,]\d+)?\s*(?:cm|m|mm|km))\$/gi, '$1');
  text = normalizeMathNotation(text);
  text = text
    .replace(/\bpara\s+dentro\s+de\s+/gi, 'en ')
    .replace(/\bdentro\s+de\s+/gi, 'en ')
    .replace(/\?(['"»”’])\?/g, '?$1');
  return repairSpanishSurfaceGrammar(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function sanitizePedagogicalMetaPhrases(value: string | null | undefined): string {
  if (!value) return '';
  let out = value
    .replace(
      /(?:(?:la|una|tu|su)\s+)?versi[oó]n\s+depurada(?:\s+y\s+validada)?\s+(?:de\s+(?:tu\s+|la\s+|su\s+)?)?/gi,
      ''
    )
    .replace(/\bversi[oó]n\s+depurada(?:\s+y\s+validada)?\b/gi, 'síntesis final')
    .replace(/\b(?:tu|la|su|una)\s+evidencia\s+formativa\b/gi, 'el producto de aprendizaje')
    .replace(/\bevidencia\s+formativa\b/gi, 'producto de aprendizaje')
    .replace(
      /\b(?:mediante|con(?:\s+base\s+en)?|seg[uú]n|usando|a\s+trav[eé]s\s+de)\s+(?:una\s+)?(?:escala\s+estimativa|lista\s+de\s+cotejo|r[uú]brica\s+anal[ií]tica)(?:\s*(?:y|,)\s*(?:una\s+)?(?:escala\s+estimativa|lista\s+de\s+cotejo|r[uú]brica\s+anal[ií]tica))?\b/gi,
      'con criterios de clase'
    )
    .replace(/\b(?:escala\s+estimativa|lista\s+de\s+cotejo|r[uú]brica\s+anal[ií]tica)\b/gi, 'pauta de logro')
    .replace(/\bEste\s+contenido\s+formativo\s+sienta\s+las\s+bases\s+metodol[oó]gicas[^.?!]*[.?!]?/gi, '')
    .replace(/\bConocimientos\s+construidos\s+en\s+la\s+sesi[oó]n\s+previa\s+de[^.?!]*[.?!]?/gi, '')
    .replace(/^(?:Trabajo\s+colaborativo|Actividad\s+colaborativa)\s*(?:\(\s*\d+\s*min\.?\s*\))?\s*:\s*/gi, '')
    .replace(/\bde\s+el\b/gi, 'del')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[.,;:\s]+/, '')
    .trim();
  out = repairSpanishSurfaceGrammar(out);
  if (
    out &&
    /^[a-záéíóúñ]/.test(out) &&
    !/^[a-z](?:[a-z0-9₀-₉ₐₑₒₓᵢₙᵥ²³]|\([^)]+\))?\s*(?:[=<>≤≥≠≈+\-*/·×^]|²|³)/i.test(out)
  ) {
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

/** Detecta fragmentos de rúbricas de evaluación o instrucciones de prompt filtradas en campos de contenido. */
export function isRubricOrBoilerplateLeak(value: string | null | undefined): boolean {
  const cleaned = cleanSacrintText(value);
  if (!cleaned) return false;
  if (RUBRIC_OR_META_LEAK_RE.test(cleaned)) return true;
  if (/^r[úu]brica\s+anal[íi]tica\s*[:\-–]?$/i.test(cleaned)) return true;
  const isWorkedExampleProse = /^(?:planteamiento|paso\s*\d+|evaluar\b|debes\s+evaluar\b)/i.test(cleaned);
  if (
    !isWorkedExampleProse &&
    /r[úu]brica\s+anal[íi]tica/i.test(cleaned) &&
    /criterio\s*:|ponderaci[oó]n|\b\d+\s*(?:pts?|puntos?|%)/i.test(cleaned)
  ) {
    return true;
  }
  if (/^fases?\s+del\s+proyecto\s+formativo\s*:?\s*$/i.test(cleaned)) return true;
  if (/^criterio\s*:\s*/i.test(cleaned) && /ponderaci[oó]n|excelente|requiere\s+apoyo/i.test(cleaned)) return true;
  return false;
}

export const NUMERIC_ONLY_STEP_RE = /^(?:\d+[.)]?\s*)+$/;

export const ORPHAN_LIST_END_RE = /[^\d]:\s+\d+\.\s*$/;

export const GENERIC_CONCLUSION_RE =
  /el\s+procedimiento\s+confirma\s+la\s+relaci[oó]n\s+planteada(?:\s+y\s+valida\s+el\s+resultado\s+en\s+contexto)?/i;

export const TEMPLATE_PHRASE_RE =
  /(?:(?:paso\s*\d+\s*:\s*)?definici[oó]n\s+de\s+entradas,\s*variables\s+y\s+(?:tipos|clases)|(?:paso\s*\d+\s*:\s*)?algoritmo,\s*f[oó]rmula\s+de\s+hoja\s+de\s+c[aá]lculo\s+o\s+estructura\s+l[oó]gica|(?:paso\s*\d+\s*:\s*)?prueba\s+de\s+escritorio\s+(?:paso\s+a\s+paso|con\s+orden)\s+con\s+valores\s+reales|(?:paso\s*\d+\s*:\s*)?ejecuci[oó]n\s+(?:paso\s+a\s+paso|con\s+orden)\s+y\s+registro\s+de\s+mediciones\/controles|(?:paso\s*\d+\s*:\s*)?seguridad\s*\(epp\/higiene\),\s*insumos\s+y\s+par[aá]metros\s+de\s+entrada)/i;

const STRIP_TEMPLATE_PHRASE_GLOBAL_RE = new RegExp(
  `${TEMPLATE_PHRASE_RE.source}(?:\\s*[:.\\-–—]\\s*|\\s+)`,
  'gi'
);

/**
 * Elimina etiquetas de plantilla/prompt filtradas en pasos o ejemplos resueltos.
 * Si el texto contenía una etiqueta de plantilla y tras limpiarla queda vacío,
 * lanza `SacrintContentError('SACRINT_TEMPLATE_LEAK')` cuando `strict: true`.
 */
export function stripTemplateLabels(
  value: string | null | undefined,
  options?: { strict?: boolean; context?: SacrintContentErrorContext }
): string {
  if (!value) return '';
  const hadTemplate = TEMPLATE_PHRASE_RE.test(value);
  let cleaned = value
    .replace(STRIP_TEMPLATE_PHRASE_GLOBAL_RE, '')
    .replace(new RegExp(TEMPLATE_PHRASE_RE.source, 'gi'), '')
    .replace(/^[:.\-–—\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (cleaned && /^[a-záéíóúñ]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (hadTemplate && !cleaned && options?.strict) {
    throw new SacrintContentError(
      'SACRINT_TEMPLATE_LEAK',
      `El campo contenía únicamente una etiqueta de plantilla sin contenido final: "${value.slice(0, 90)}"`,
      { ...options.context, raw: value }
    );
  }
  return cleaned;
}
