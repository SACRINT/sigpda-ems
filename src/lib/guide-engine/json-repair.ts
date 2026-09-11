/**
 * Robust JSON parser and repair utility for LLM generation responses.
 * Handles markdown fences, unescaped control chars, bad escape sequences,
 * and extracts valid JSON substring.
 */

function escapeRawNewlinesInStrings(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  return result;
}

function repairUnescapedQuotesInStrings(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
      } else {
        // Mirar hacia adelante al siguiente caracter que no sea espacio
        let j = i + 1;
        while (j < jsonStr.length && /\s/.test(jsonStr[j])) {
          j++;
        }
        const nextChar = j < jsonStr.length ? jsonStr[j] : '';

        // Delimitadores válidos de JSON tras cerrar un valor o clave:
        const isValidDelimiter = nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']';

        if (!isValidDelimiter) {
          // Es una comilla interna sin escapar (ej: print("hola")), escaparla
          result += '\\"';
        } else {
          if (nextChar === ',') {
            let k = j + 1;
            while (k < jsonStr.length && /\s/.test(jsonStr[k])) {
              k++;
            }
            const charAfterComma = k < jsonStr.length ? jsonStr[k] : '';
            const isValidAfterComma = charAfterComma === '"' || charAfterComma === '{' || charAfterComma === '[' ||
              charAfterComma === '}' || charAfterComma === ']' ||
              /[\d\-tfn]/.test(charAfterComma);

            if (!isValidAfterComma) {
              result += '\\"';
              continue;
            }
          }
          inString = false;
          result += char;
        }
      }
      continue;
    }

    result += char;
  }

  return result;
}

export function robustJsonParse<T = any>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Entrada vacía para parsing de JSON');
  }

  // 1. Limpieza básica de bloques markdown
  let clean = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // 2. Si el modelo devolvió una lista con guiones de objetos: - { ... } - { ... }
  if (/^\s*[-*]\s*\{/.test(clean) || (clean.includes('}\n- {') || clean.includes('}\r\n- {'))) {
    clean = clean.replace(/^\s*[-*]\s*/gm, '');
    if (!clean.trim().startsWith('[')) {
      clean = `[\n${clean.replace(/}\s*\{/g, '},\n{')}\n]`;
    }
  }

  // 3. Extraer límites JSON externos (detectando si la raíz es objeto {} o arreglo [])
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    const lastBracket = clean.lastIndexOf(']');
    if (lastBracket > firstBracket) {
      clean = clean.substring(firstBracket, lastBracket + 1);
    }
  } else if (firstBrace !== -1) {
    const lastBrace = clean.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
  }

  // Intento 1: parseo directo
  try {
    return JSON.parse(clean);
  } catch (err1: any) {
    // Intento 2: reparar saltos de línea literales dentro de strings y secuencias de escape inválidas
    try {
      let repaired = escapeRawNewlinesInStrings(clean);
      repaired = repaired
        .replace(/\\\\/g, '__DOUBLE_BACKSLASH__')
        .replace(/\\([^"\/bfnrtu]|u(?![\da-fA-F]{4}))/g, '$1')
        .replace(/__DOUBLE_BACKSLASH__/g, '\\\\')
        .replace(/,\s*([}\]])/g, '$1');

      return JSON.parse(repaired);
    } catch (err2: any) {
      // Intento 3: reparar comillas internas no escapadas + limpiar caracteres de control
      try {
        let sanitized = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        sanitized = escapeRawNewlinesInStrings(sanitized);
        sanitized = repairUnescapedQuotesInStrings(sanitized);
        sanitized = sanitized
          .replace(/\\\\/g, '__DOUBLE_BACKSLASH__')
          .replace(/\\([^"\/bfnrtu]|u(?![\da-fA-F]{4}))/g, '$1')
          .replace(/__DOUBLE_BACKSLASH__/g, '\\\\')
          .replace(/,\s*([}\]])/g, '$1');

        return JSON.parse(sanitized);
      } catch (err3: any) {
        console.error('[robustJsonParse] Fallaron todos los intentos de parseo:', err1.message);
        throw err1;
      }
    }
  }
}


