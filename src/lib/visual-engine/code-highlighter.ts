/**
 * code-highlighter.ts — Lexer Determinista y Resaltador de Sintaxis Offline
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Proporciona tokenización coloreada para Python y Bash con máquina de estados
 * carry-over para docstrings multilínea, f-strings y comentarios en bloque.
 *
 * Cero dependencias externas. Paleta canónica centralizada en `design-tokens.ts`.
 */

import { CODE_IDE, type RGB } from './design-tokens';

export interface CodeHighlightToken {
  text: string;
  color: RGB;
  bold?: boolean;
}

export interface HighlightedLine {
  lineNumber: number;
  tokens: CodeHighlightToken[];
}

// Built-in functions / identifiers comunes de Python (estilo VS Code #DCDCAA)
const PYTHON_BUILTINS: RGB = [220, 220, 170];

const PYTHON_KEYWORDS = new Set([
  'import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else',
  'for', 'in', 'while', 'try', 'except', 'finally', 'with', 'pass', 'break',
  'continue', 'lambda', 'raise', 'yield', 'is', 'not', 'and', 'or', 'global',
  'nonlocal', 'assert', 'async', 'await'
]);

const PYTHON_LITERALS = new Set([
  'True', 'False', 'None'
]);

const PYTHON_BUILTIN_FUNCS = new Set([
  'print', 'len', 'range', 'int', 'float', 'str', 'list', 'dict', 'set',
  'tuple', 'bool', 'type', 'sum', 'min', 'max', 'enumerate', 'zip', 'open',
  'input', 'round', 'super', 'map', 'filter', 'abs', 'all', 'any', 'dir',
  'id', 'isinstance', 'issubclass', 'iter', 'next', 'reversed', 'sorted'
]);

const BASH_COMMANDS = new Set([
  'cd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'pip', 'pip3', 'python', 'python3',
  'npm', 'npx', 'git', 'cat', 'echo', 'chmod', 'chown', 'sudo', 'curl',
  'wget', 'source', 'export', 'touch', 'grep', 'find', 'clear', 'bash', 'sh'
]);

type MultilineState = 'none' | 'triple_double' | 'triple_single';

/**
 * Tokeniza un bloque completo de código preservando estado multilínea entre líneas.
 */
export function highlightCodeBlock(
  code: string,
  language: 'python' | 'bash' = 'python'
): HighlightedLine[] {
  if (!code || typeof code !== 'string') {
    return [];
  }

  const rawLines = code.split(/\r?\n/);
  const result: HighlightedLine[] = [];
  let state: MultilineState = 'none';

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineText = rawLines[idx];
    const lineNumber = idx + 1;
    const tokens: CodeHighlightToken[] = [];

    if (language === 'bash') {
      tokenizeBashLine(lineText, tokens);
    } else {
      state = tokenizePythonLineWithState(lineText, tokens, state);
    }

    result.push({
      lineNumber,
      tokens: tokens.length > 0 ? tokens : [{ text: ' ', color: CODE_IDE.baseText }],
    });
  }

  return result;
}

/**
 * Tokenizador de línea Python con soporte para estados carry-over multilínea.
 */
function tokenizePythonLineWithState(
  line: string,
  tokens: CodeHighlightToken[],
  initialState: MultilineState
): MultilineState {
  let state = initialState;
  let cursor = 0;
  const len = line.length;

  // Si venimos de un docstring/multilínea previo
  if (state === 'triple_double' || state === 'triple_single') {
    const endDelim = state === 'triple_double' ? '"""' : "'''";
    const endPos = line.indexOf(endDelim);

    if (endPos === -1) {
      // Toda la línea sigue dentro del docstring multilínea
      tokens.push({ text: line, color: CODE_IDE.string });
      return state;
    } else {
      // Cierra el docstring en esta línea
      const closedText = line.slice(0, endPos + 3);
      tokens.push({ text: closedText, color: CODE_IDE.string });
      cursor = endPos + 3;
      state = 'none';
    }
  }

  while (cursor < len) {
    const char = line[cursor];

    // 1. Espacios en blanco
    if (/\s/.test(char)) {
      let spaceEnd = cursor + 1;
      while (spaceEnd < len && /\s/.test(line[spaceEnd])) {
        spaceEnd++;
      }
      tokens.push({ text: line.slice(cursor, spaceEnd), color: CODE_IDE.baseText });
      cursor = spaceEnd;
      continue;
    }

    // 2. Comentario de una línea
    if (char === '#') {
      tokens.push({ text: line.slice(cursor), color: CODE_IDE.comment, italic: true } as CodeHighlightToken);
      break;
    }

    // 3. Inicio de Docstrings triples (""" o ''')
    if (line.startsWith('"""', cursor)) {
      const closingPos = line.indexOf('"""', cursor + 3);
      if (closingPos !== -1) {
        tokens.push({ text: line.slice(cursor, closingPos + 3), color: CODE_IDE.string });
        cursor = closingPos + 3;
      } else {
        tokens.push({ text: line.slice(cursor), color: CODE_IDE.string });
        state = 'triple_double';
        break;
      }
      continue;
    }

    if (line.startsWith("'''", cursor)) {
      const closingPos = line.indexOf("'''", cursor + 3);
      if (closingPos !== -1) {
        tokens.push({ text: line.slice(cursor, closingPos + 3), color: CODE_IDE.string });
        cursor = closingPos + 3;
      } else {
        tokens.push({ text: line.slice(cursor), color: CODE_IDE.string });
        state = 'triple_single';
        break;
      }
      continue;
    }

    // 4. Strings normales simples ('...' o "...") incluyendo prefijos f, r, b
    const stringPrefixMatch = line.slice(cursor).match(/^([frbFRB]?)(["'])/);
    if (stringPrefixMatch) {
      const prefix = stringPrefixMatch[1];
      const quoteChar = stringPrefixMatch[2];
      let strEnd = cursor + prefix.length + 1;
      let escaped = false;

      while (strEnd < len) {
        const c = line[strEnd];
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === quoteChar) {
          strEnd++;
          break;
        }
        strEnd++;
      }

      tokens.push({ text: line.slice(cursor, strEnd), color: CODE_IDE.string });
      cursor = strEnd;
      continue;
    }

    // 5. Números (enteros, decimales, notación científica)
    const numMatch = line.slice(cursor).match(/^(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)/);
    if (numMatch) {
      tokens.push({ text: numMatch[1], color: CODE_IDE.number });
      cursor += numMatch[1].length;
      continue;
    }

    // 6. Identificadores (keywords, builtins, variables)
    const identMatch = line.slice(cursor).match(/^[a-zA-Z_]\w*/);
    if (identMatch) {
      const word = identMatch[0];
      if (PYTHON_KEYWORDS.has(word)) {
        tokens.push({ text: word, color: CODE_IDE.keyword, bold: true });
      } else if (PYTHON_LITERALS.has(word)) {
        tokens.push({ text: word, color: CODE_IDE.number });
      } else if (PYTHON_BUILTIN_FUNCS.has(word)) {
        tokens.push({ text: word, color: PYTHON_BUILTINS });
      } else {
        tokens.push({ text: word, color: CODE_IDE.baseText });
      }
      cursor += word.length;
      continue;
    }

    // 7. Operadores y signos de puntuación
    tokens.push({ text: char, color: CODE_IDE.baseText });
    cursor++;
  }

  return state;
}

/**
 * Tokenizador básico para comandos de terminal Bash.
 */
function tokenizeBashLine(line: string, tokens: CodeHighlightToken[]): void {
  let cursor = 0;
  const len = line.length;

  while (cursor < len) {
    const char = line[cursor];

    // Espacios
    if (/\s/.test(char)) {
      let spaceEnd = cursor + 1;
      while (spaceEnd < len && /\s/.test(line[spaceEnd])) spaceEnd++;
      tokens.push({ text: line.slice(cursor, spaceEnd), color: CODE_IDE.baseText });
      cursor = spaceEnd;
      continue;
    }

    // Comentario #
    if (char === '#') {
      tokens.push({ text: line.slice(cursor), color: CODE_IDE.comment, italic: true } as CodeHighlightToken);
      break;
    }

    // Prompt $
    if (char === '$' && (cursor === 0 || /\s/.test(line[cursor - 1]))) {
      tokens.push({ text: '$', color: CODE_IDE.keyword, bold: true });
      cursor++;
      continue;
    }

    // Flags --option o -o
    const flagMatch = line.slice(cursor).match(/^--?[a-zA-Z0-9_\-]+/);
    if (flagMatch) {
      tokens.push({ text: flagMatch[0], color: [156, 220, 254] as RGB }); // #9CDCFE
      cursor += flagMatch[0].length;
      continue;
    }

    // Strings entre comillas
    if (char === '"' || char === "'") {
      const quoteChar = char;
      let strEnd = cursor + 1;
      while (strEnd < len && line[strEnd] !== quoteChar) {
        if (line[strEnd] === '\\') strEnd++;
        strEnd++;
      }
      if (strEnd < len) strEnd++;
      tokens.push({ text: line.slice(cursor, strEnd), color: CODE_IDE.string });
      cursor = strEnd;
      continue;
    }

    // Palabras / Comandos
    const wordMatch = line.slice(cursor).match(/^[a-zA-Z0-9_\.\-]+/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (BASH_COMMANDS.has(word)) {
        tokens.push({ text: word, color: CODE_IDE.keyword, bold: true });
      } else {
        tokens.push({ text: word, color: CODE_IDE.baseText });
      }
      cursor += word.length;
      continue;
    }

    tokens.push({ text: char, color: CODE_IDE.baseText });
    cursor++;
  }
}
