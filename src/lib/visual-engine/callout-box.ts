/**
 * callout-box.ts — Extractor y generador de cajas destacadas (Callout Boxes)
 * SIGPDA-EMS · Sistema de Diseño Editorial Escolar
 *
 * Extrae o sintetiza datos de impacto, citas o principios clave de la misión
 * para enriquecer la densidad visual de los libros de texto y cuadernos activos.
 */

export interface CalloutBoxData {
  title: string;
  body: string;
  content: string;      // Alias de body para compatibilidad con renderizadores
  accent: string;       // Color primario hexadecimal (ej. '#2563eb')
  accentRgb: [number, number, number];
  bgHex: string;        // Fondo suave hexadecimal
  bgRgb: [number, number, number];
  type: string;
  badge: string;
  icon?: string;
  keyTakeaway?: string;
}

export interface ExtractCalloutBoxOptions {
  missionNumber?: number;
  defaultType?: string;
  defaultTitle?: string;
  defaultSubjectName?: string;
  allowSynthetic?: boolean;
}

/**
 * Retorna la configuración de color y temática según el número de misión / momento pedagógico.
 * Misión 1 (Activa): #2563eb (Azul)
 * Misión 2 (Profundiza): #7c3aed (Púrpura)
 * Misión 3 (Conecta): #d97706 (Ámbar)
 * Misión 4 / posterior (Evalúa): #059669 (Esmeralda)
 */
export function getMomentPalette(missionNumber: number): {
  accent: string;
  accentRgb: [number, number, number];
  bgHex: string;
  bgRgb: [number, number, number];
} {
  switch (missionNumber) {
    case 1:
      return {
        accent: '#2563eb',
        accentRgb: [37, 99, 235],
        bgHex: 'eff6ff',
        bgRgb: [239, 246, 255],
      };
    case 2:
      return {
        accent: '#7c3aed',
        accentRgb: [124, 58, 237],
        bgHex: 'f5f3ff',
        bgRgb: [245, 243, 255],
      };
    case 3:
      return {
        accent: '#d97706',
        accentRgb: [217, 119, 6],
        bgHex: 'fef3c7',
        bgRgb: [254, 243, 199],
      };
    case 4:
    default:
      return {
        accent: '#059669',
        accentRgb: [5, 150, 105],
        bgHex: 'ecfdf5',
        bgRgb: [236, 253, 245],
      };
  }
}

function buildCallout(
  title: string,
  body: string,
  palette: { accent: string; accentRgb: [number, number, number]; bgHex: string; bgRgb: [number, number, number] },
  type: string,
  badge: string,
  icon: string = '★',
  keyTakeaway?: string
): CalloutBoxData {
  return {
    title,
    body,
    content: body,
    accent: palette.accent,
    accentRgb: palette.accentRgb,
    bgHex: palette.bgHex,
    bgRgb: palette.bgRgb,
    type,
    badge,
    icon,
    keyTakeaway,
  };
}

/**
 * Extrae heurísticamente del texto de la misión un elemento destacado
 * (estadística con %, fecha relevante, cita entrecomillada o concepto esencial extraído).
 * Retorna `null` si el texto no contiene información sustantiva real (cero relleno genérico).
 */
export function extractCalloutBox(
  missionText: string,
  missionNumberOrOptions: number | ExtractCalloutBoxOptions = 1,
  defaultSubjectName: string = 'la disciplina'
): CalloutBoxData | null {
  const opts: ExtractCalloutBoxOptions =
    typeof missionNumberOrOptions === 'number'
      ? { missionNumber: missionNumberOrOptions }
      : missionNumberOrOptions || {};

  const missionNumber = opts.missionNumber ?? 1;
  const subjectName = opts.defaultSubjectName || defaultSubjectName;
  const palette = getMomentPalette(missionNumber);
  const text = (missionText || '').trim();

  if (!text) {
    return opts.allowSynthetic
      ? buildCallout(
          opts.defaultTitle || 'PUNTO DE REFLEXIÓN CRÍTICA',
          `La comprensión de los fundamentos de ${subjectName} permite resolver problemas auténticos en tu entorno comunitario y productivo.`,
          palette,
          opts.defaultType || 'did_you_know',
          '¿SABÍAS QUE?',
          '⚡',
          'Conectar el aprendizaje con la práctica transforma el entorno.'
        )
      : null;
  }

  // 1. Buscar cifras porcentuales (ej. "85%", "45 por ciento")
  const percentRegex = /([^.?!;\n]*?\b\d+(?:[\.,]\d+)?\s*(?:%|por ciento)\b[^.?!;\n]*[.?!]?)/i;
  const percentMatch = text.match(percentRegex);
  if (percentMatch && percentMatch[0].trim().length > 20) {
    const rawSentence = percentMatch[0].trim().replace(/^[-*•\s]+/, '');
    const numMatch = rawSentence.match(/\b\d+(?:[\.,]\d+)?\s*(?:%|por ciento)/i);
    const highlight = numMatch ? numMatch[0] : 'Dato clave';
    return buildCallout(
      opts.defaultTitle || `DATO DE IMPACTO [${highlight.toUpperCase()}]`,
      rawSentence,
      palette,
      opts.defaultType || 'stat',
      'DATO RELEVANTE',
      '📊',
      `El indicador ${highlight} marca la pauta operativa.`
    );
  }

  // 2. Buscar fechas o años históricos significativos (4 dígitos entre 1500 y 2099)
  const dateRegex = /([^.?!;\n]*?\b(?:en\s+|el\s+año\s+|hacia\s+)?(1[5-9]\d\d|20[0-2]\d)\b[^.?!;\n]*[.?!]?)/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch && dateMatch[0].trim().length > 25) {
    const rawSentence = dateMatch[0].trim().replace(/^[-*•\s]+/, '');
    const yearMatch = rawSentence.match(/\b(1[5-9]\d\d|20[0-2]\d)\b/);
    const yearStr = yearMatch ? yearMatch[0] : 'Hito';
    return buildCallout(
      opts.defaultTitle || `CONTEXTO CRONOLÓGICO (${yearStr})`,
      rawSentence,
      palette,
      opts.defaultType || 'stat',
      'CONTEXTO HISTÓRICO',
      '📅',
      `Hito clave en ${yearStr}.`
    );
  }

  // 3. Buscar citas entrecomilladas ("...", «...»)
  const quoteRegex = /["«“]([^"»”]{15,220})["»”]/;
  const quoteMatch = text.match(quoteRegex);
  if (quoteMatch && quoteMatch[1].trim().length > 15) {
    return buildCallout(
      opts.defaultTitle || 'PERSPECTIVA DESTACADA',
      `"${quoteMatch[1].trim()}"`,
      palette,
      opts.defaultType || 'quote',
      'CITA FORMATIVA',
      '💬'
    );
  }

  // 4. Buscar primera oración sustantiva como concepto clave real extraído
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim().replace(/^[-*•\s]+/, ''))
    .filter((s) => s.length >= 35 && s.length <= 250);

  if (sentences.length > 0) {
    return buildCallout(
      opts.defaultTitle || 'PRINCIPIO FUNDAMENTAL',
      sentences[0],
      palette,
      opts.defaultType || 'key_concept',
      'IDEA FUERZA',
      '💡',
      sentences[0].slice(0, 80) + '...'
    );
  }

  // 5. Si no se detectó nada real, solo retornar fallback genérico si allowSynthetic es true explícito
  if (opts.allowSynthetic) {
    return buildCallout(
      opts.defaultTitle || 'PUNTO DE REFLEXIÓN CRÍTICA',
      `La comprensión de los fundamentos de ${subjectName} permite resolver problemas auténticos en tu entorno comunitario y productivo.`,
      palette,
      opts.defaultType || 'did_you_know',
      '¿SABÍAS QUE?',
      '⚡',
      'Conectar el aprendizaje con la práctica transforma el entorno.'
    );
  }

  return null;
}
