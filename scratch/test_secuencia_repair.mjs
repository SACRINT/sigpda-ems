function parseAndRepairSessionsJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Respuesta vacía de la IA');
  }

  let text = rawText.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  const tryParseObject = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      try {
        const cleaned = str
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[\u0000-\u001F]+/g, (m) => (m === '\n' || m === '\r' || m === '\t' ? m : ' '));
        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    }
  };

  let parsed = tryParseObject(text);

  if (!parsed) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      parsed = tryParseObject(text.substring(firstBrace, lastBrace + 1));
    }
  }

  if (!parsed) {
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const arr = tryParseObject(text.substring(firstBracket, lastBracket + 1));
      if (Array.isArray(arr)) {
        parsed = { sessions: arr };
      }
    }
  }

  if (!parsed) {
    const firstBracket = text.indexOf('[');
    if (firstBracket !== -1) {
      const lastCloseObj = text.lastIndexOf('}');
      if (lastCloseObj > firstBracket) {
        const truncatedArray = text.substring(firstBracket, lastCloseObj + 1) + ']';
        const arr = tryParseObject(truncatedArray);
        if (Array.isArray(arr) && arr.length > 0) {
          parsed = { sessions: arr };
        }
      }
    }
  }

  if (!parsed) {
    throw new Error('Formato JSON no reconocible');
  }

  const rawList = Array.isArray(parsed.sessions)
    ? parsed.sessions
    : Array.isArray(parsed.sesiones)
    ? parsed.sesiones
    : Array.isArray(parsed.secuencia)
    ? parsed.secuencia
    : Array.isArray(parsed.activities)
    ? parsed.activities
    : Array.isArray(parsed)
    ? parsed
    : [];

  return rawList;
}

// Case 1: Preamble + postscript + trailing commas
const case1 = `Aquí está la planeación solicitada para el bloque 3:
{
  "sessions": [
    { "sessionNum": 1, "title": "Sesión 1", },
    { "sessionNum": 2, "title": "Sesión 2", }
  ],
}
Espero que te sea de gran utilidad.`;

// Case 2: Spanish key 'sesiones' with markdown
const case2 = `\`\`\`json
{
  "sesiones": [
    { "sessionNum": 1, "title": "Sesión 1" }
  ]
}
\`\`\``;

// Case 3: Truncated tokens (cut off at the end)
const case3 = `{"sessions": [{"sessionNum": 1, "title": "Sesión 1"}, {"sessionNum": 2, "title": "Sesión 2"`;

console.log('Testing Case 1 (preamble + trailing commas):', parseAndRepairSessionsJson(case1).length, 'sessions');
console.log('Testing Case 2 (markdown + sesiones key):', parseAndRepairSessionsJson(case2).length, 'sessions');
console.log('Testing Case 3 (truncated tokens):', parseAndRepairSessionsJson(case3).length, 'sessions');
