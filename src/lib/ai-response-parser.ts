import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

export interface ParseAIResponseOptions {
  contextName?: string;
}

export interface ParseAIResponseResult<T> {
  success: boolean;
  data: T;
  warnings: string[];
  error?: string;
  cleanedJson?: string;
}

/**
 * Pipeline centralizado de 6 pasos para parsear, reparar y validar respuestas JSON de LLMs.
 * 
 * 1. Sanitización de texto inicial
 * 2. Limpieza de bloques de código Markdown (```json / ```)
 * 3. Detección y extracción de delimitadores JSON ({...} o [...])
 * 4. Reparación sintáctica determinista (jsonrepair + regex fallback para trailing commas y escapes)
 * 5. Parseo nativo a objeto JavaScript
 * 6. Validación y tipado estricto contra esquema Zod
 */
export function parseAIResponse<T>(
  rawText: string,
  schema: z.ZodType<T>,
  options?: ParseAIResponseOptions
): ParseAIResponseResult<T> {
  const warnings: string[] = [];
  const context = options?.contextName ? `[${options.contextName}] ` : '';

  // 1. Sanitización de texto inicial
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      success: false,
      data: undefined as any,
      warnings,
      error: `${context}Respuesta vacía o nula del modelo de IA`,
    };
  }

  let text = rawText.trim();

  // 2. Limpieza de bloques de código Markdown
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
    warnings.push('Se removieron delimitadores markdown de bloque de código');
  } else {
    // Si quedan ``` sueltos al inicio o final
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // 3. Detección y extracción de delimitadores JSON
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  let jsonCandidate = text;

  // Determinar si el contenido principal es un objeto {...} o un arreglo [...]
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    if (lastBrace > firstBrace) {
      jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    if (lastBracket > firstBracket) {
      jsonCandidate = text.substring(firstBracket, lastBracket + 1);
    }
  }

  // 4. Reparación sintáctica determinista
  let parsedObj: any = null;

  // Intento A: jsonrepair library
  try {
    const repaired = jsonrepair(jsonCandidate);
    parsedObj = JSON.parse(repaired);
    if (repaired !== jsonCandidate) {
      warnings.push('Sintaxis JSON reparada mediante jsonrepair (comas o comillas normalizadas)');
    }
  } catch (repairErr) {
    // Intento B: Reparación defensiva manual
    try {
      const cleaned = jsonCandidate
        // Remover trailing commas antes de } o ]
        .replace(/,\s*([}\]])/g, '$1')
        // Reemplazar caracteres de control binarios
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]+/g, ' ')
        // Normalizar comillas tipográficas
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'");

      parsedObj = JSON.parse(cleaned);
      warnings.push('Sintaxis JSON recuperada mediante normalización regex fallback');
    } catch (manualErr) {
      // Intento C: Recuperación de arreglos truncados por longitud de tokens
      if (firstBracket !== -1 && lastBrace > firstBracket) {
        try {
          const truncatedArray = jsonCandidate.substring(0, jsonCandidate.lastIndexOf('}') + 1) + ']';
          const repairedTruncated = jsonrepair(truncatedArray);
          parsedObj = JSON.parse(repairedTruncated);
          warnings.push('Arreglo JSON truncado recuperado cerrando el corchete final');
        } catch {
          // No fue posible parsear
        }
      }
    }
  }

  // 5. Parseo nativo a objeto JavaScript
  if (!parsedObj || typeof parsedObj !== 'object') {
    return {
      success: false,
      data: undefined as any,
      warnings,
      error: `${context}No se pudo estructurar un JSON válido a partir de la respuesta de la IA`,
      cleanedJson: jsonCandidate.substring(0, 400),
    };
  }

  // 6. Validación y tipado estricto contra esquema Zod
  const validationResult = schema.safeParse(parsedObj);

  if (!validationResult.success) {
    const formattedErrors = validationResult.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
        return `${path}${issue.message}`;
      })
      .join('; ');

    return {
      success: false,
      data: undefined as any,
      warnings,
      error: `${context}Validación de esquema Zod fallida: ${formattedErrors}`,
      cleanedJson: JSON.stringify(parsedObj).substring(0, 400),
    };
  }

  return {
    success: true,
    data: validationResult.data,
    warnings,
    cleanedJson: JSON.stringify(validationResult.data),
  };
}

/**
 * Parseo y reparación robusta de JSON sin requerir esquema Zod previo.
 * Utiliza jsonrepair y las estrategias de limpieza del pipeline central.
 */
export function robustJsonParse<T = any>(raw: string): T {
  const parsed = parseAIResponse(raw, z.any());
  if (!parsed.success || parsed.data === undefined) {
    throw new Error(parsed.error || `[robustJsonParse] No se pudo parsear el JSON de IA: ${raw.substring(0, 100)}...`);
  }
  return parsed.data as T;
}
