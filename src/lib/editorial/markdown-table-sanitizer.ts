/**
 * markdown-table-sanitizer.ts — SSoT para eliminar tablas Markdown crudas de texto visible
 * (PDF libro 06, PPTX 08, infografías 09). Las tablas se descartan: el texto que las rodea
 * debe sostener el sentido por sí mismo.
 */

const SEPARATOR_ROW_RE = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
/** Indicador inequívoco de una tabla Markdown (aunque llegue aplanada en una sola línea). */
const FLATTENED_SEPARATOR_RE = /\|\s*:?-{3,}:?\s*\|/;

export function stripMarkdownTables(value: string | null | undefined): string {
  if (!value) return '';

  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (SEPARATOR_ROW_RE.test(line) || TABLE_ROW_RE.test(line)) continue;
    out.push(line);
  }
  let text = out.join('\n');

  // Tablas aplanadas en una sola línea: solo si hay separador `|---|` (evita tocar `|x|` o "tal que |").
  if (FLATTENED_SEPARATOR_RE.test(text)) {
    text = text
      // Fila de separador aplanada: |---|---|-----|
      .replace(/\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?/g, ' ')
      // Filas aplanadas: | a | b | ... |
      .replace(/\|\s*[^|\n]{1,80}?\s*(?:\|\s*[^|\n]{1,80}?\s*)+\|/g, ' ')
      // Barras sueltas residuales
      .replace(/\s\|\s/g, ' ');
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}
