/**
 * no-generic-content.ts — Gate arquitectónico anti-contenido genérico
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * SSoT para detectar relleno sintético, plantillas de contingencia y
 * marcadores de texto incompleto en CUALQUIER material del motor editorial.
 *
 * Regla de producto: ningún material puede persistirse ni exportarse si
 * contiene una firma genérica conocida. El fallback silencioso está prohibido;
 * si la IA no entrega contenido específico, el pipeline debe reintentar o
 * fallar de forma ruidosa (fail-closed), nunca degradar la calidad en silencio.
 */

export interface GenericContentIssue {
  /** Ruta del campo dentro del objeto auditado (ej. missions[0].sessionPlans[1].contenido). */
  path: string;
  /** Identificador estable de la firma detectada. */
  signature: string;
  /** Etiqueta legible para logs y mensajes de error. */
  label: string;
  /** Fragmento del texto infractor, acotado para no inundar los logs. */
  excerpt: string;
}

interface GenericSignature {
  id: string;
  label: string;
  pattern: RegExp;
}

/**
 * Firmas explícitas de fallback/relleno. No se incluyen términos disciplinares
 * legítimos (p. ej. "Aprendizaje Basado en Retos" como metodología declarada):
 * solo textos que el código inyecta cuando la IA no entregó contenido real.
 */
const GENERIC_SIGNATURES: readonly GenericSignature[] = [
  {
    id: 'placeholder',
    label: 'Marcador de texto incompleto',
    pattern: /\[completar\]|\[escribe aquí\]|\[placeholder\]|\[aquí escribe\]|\[texto\]|\[insertar\]|\[pendiente\]|\[tbd\]|\[\s*\.\.\.\s*\]/i,
  },
  {
    id: 'fallback-pista',
    label: 'Pista genérica de práctica',
    pattern: /Observa el ejemplo resuelto paso a paso y aplica el mismo procedimiento con los datos del ejercicio\./i,
  },
  {
    id: 'fallback-autoeval-1',
    label: 'Autoevaluación genérica de respaldo',
    pattern: /¿Puedo explicar con mis palabras el concepto central de esta sesión\?/i,
  },
  {
    id: 'fallback-autoeval-2',
    label: 'Autoevaluación genérica de respaldo',
    pattern: /¿Logré resolver la práctica sin mirar el ejemplo\?/i,
  },
  {
    id: 'fallback-practica',
    label: 'Práctica genérica de respaldo',
    pattern: /Resuelve los ejercicios prácticos de la sesión \d+ aplicando el modelo conceptual estudiado con datos de tu entorno\./i,
  },
  {
    id: 'fallback-objetivo',
    label: 'Objetivo genérico de respaldo',
    pattern: /Al terminar la sesión \d+ sabrás aplicar los conceptos del tema en situaciones reales\./i,
  },
  {
    id: 'fallback-motivacion',
    label: 'Motivación genérica de respaldo',
    pattern: /Imagina que en tu comunidad existe un problema real que puede resolverse con lo que vas a aprender hoy\./i,
  },
  {
    id: 'fallback-saberes',
    label: 'Saberes previos genéricos de respaldo',
    pattern: /Ya conoces ideas previas del tema de la sesión anterior; úsalas como punto de partida\./i,
  },
  {
    id: 'fallback-contenido',
    label: 'Contenido teórico genérico de respaldo',
    pattern: /En esta sesión estudiarás los conceptos fundamentales del tema con definiciones, fórmulas y ejemplos que podrás aplicar de inmediato\./i,
  },
  {
    id: 'fallback-ejemplo',
    label: 'Ejemplo resuelto genérico de respaldo',
    pattern: /A continuación verás un ejemplo resuelto paso a paso con números concretos; sigue el procedimiento en tu cuaderno\./i,
  },
  {
    id: 'fallback-aplicacion',
    label: 'Aplicación genérica de respaldo',
    pattern: /Aplica lo aprendido a una situación de tu vida diaria y registra la evidencia en tu cuaderno\./i,
  },
  {
    id: 'fallback-producto',
    label: 'Producto integrador genérico de respaldo',
    pattern: /Agrega a tu producto integrador el avance de esta sesión con evidencia legible y fechada\./i,
  },
  {
    id: 'fallback-mision-story',
    label: 'Gancho fenomenológico genérico',
    pattern: /Desafío del entorno escolar poblano\./i,
  },
  {
    id: 'fallback-mision-question',
    label: 'Pregunta detonadora genérica',
    pattern: /¿Cómo podemos explicar y modelar esta situación\?/i,
  },
  {
    id: 'fallback-mision-analogia',
    label: 'Analogía genérica',
    pattern: /Analogía intuitiva cotidiana\./i,
  },
  {
    id: 'fallback-mision-concepto',
    label: 'Concepto cero genérico',
    pattern: /Fundamento conceptual inicial\./i,
  },
  {
    id: 'fallback-mision-demo',
    label: 'Demostración genérica',
    pattern: /Ejemplo resuelto paso a paso por el docente\./i,
  },
  {
    id: 'fallback-mision-practica',
    label: 'Práctica colaborativa genérica',
    pattern: /Actividad colaborativa en clase\./i,
  },
  {
    id: 'fallback-mision-reto',
    label: 'Reto autónomo genérico',
    pattern: /Reto individual en cuaderno\./i,
  },
  {
    id: 'fallback-mision-checkpoint',
    label: 'Checkpoint genérico',
    pattern: /¿Qué aprendiste hoy y cómo se conecta con tu comunidad\?/i,
  },
  {
    id: 'fallback-mision-reflexion',
    label: 'Reflexión genérica',
    pattern: /Identifica un ejemplo similar en tu entorno\./i,
  },
  {
    id: 'fallback-mision-criterio',
    label: 'Criterio genérico',
    pattern: /Explico el concepto sin memorizar fórmulas\./i,
  },
  {
    id: 'fallback-material-story',
    label: 'Gancho genérico del extractor',
    pattern: /Desafío práctico situado en el entorno regional\./i,
  },
  {
    id: 'fallback-material-question',
    label: 'Pregunta detonadora genérica del extractor',
    pattern: /¿Cómo aplicamos los conceptos en la resolución de problemas cotidianos\?/i,
  },
  {
    id: 'fallback-material-analogia',
    label: 'Analogía genérica del extractor',
    pattern: /Analogía práctica del contexto escolar\./i,
  },
  {
    id: 'fallback-material-concepto',
    label: 'Fundamento genérico del extractor',
    pattern: /Fundamentación conceptual aplicada\./i,
  },
  {
    id: 'fallback-material-demo',
    label: 'Demostración genérica del extractor',
    pattern: /Explicación demostrativa y modelado guiado por el docente\./i,
  },
  {
    id: 'fallback-material-practica',
    label: 'Práctica genérica del extractor',
    pattern: /Actividad colaborativa en equipos de trabajo\./i,
  },
  {
    id: 'fallback-material-reto',
    label: 'Reto genérico del extractor',
    pattern: /Reto autónomo de consolidación práctica\./i,
  },
  {
    id: 'fallback-material-checkpoint',
    label: 'Checkpoint genérico del extractor',
    pattern: /Verificación de aprendizaje esperado\./i,
  },
  {
    id: 'fallback-material-reflexion',
    label: 'Reflexión genérica del extractor',
    pattern: /¿Qué dificultades enfrentaste\?/i,
  },
  {
    id: 'fallback-saberes-genericos',
    label: 'Saberes previos genéricos de sesión',
    pattern: /Conexión con conceptos fundamentales y experiencias previas\./i,
  },
  {
    id: 'fallback-metodologia',
    label: 'Metodología genérica de respaldo',
    pattern: /Aprendizaje Basado en Retos y Modelado Cognitivo \(I Do - We Do - You Do\)/i,
  },
  {
    id: 'fallback-recursos',
    label: 'Recursos didácticos genéricos de respaldo',
    pattern: /Cuaderno de Trabajo Activo del estudiante, bitácora de taller\/laboratorio, instrumental didáctico\./i,
  },
  {
    id: 'fallback-instrumento',
    label: 'Instrumento de evaluación genérico',
    pattern: /Rúbrica de Desempeño y Lista de Cotejo · Misión \d+/i,
  },
  {
    id: 'fallback-seed-materiales',
    label: 'Materiales de semilla genéricos',
    pattern: /^Materiales de práctica escolar$/i,
  },
];

function excerpt(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

/** Devuelve la primera firma genérica encontrada en un texto, si existe. */
export function findGenericSignature(text: string): GenericSignature | null {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  for (const signature of GENERIC_SIGNATURES) {
    if (signature.pattern.test(text)) return signature;
  }
  return null;
}

export function isGenericText(text: string): boolean {
  return findGenericSignature(text) !== null;
}

/**
 * Recorre recursivamente un objeto/arreglo y devuelve TODAS las incidencias de
 * contenido genérico. No lanza: permite acumular evidencia para logs y gates.
 */
export function findGenericContent(value: unknown, path = 'root'): GenericContentIssue[] {
  if (typeof value === 'string') {
    const signature = findGenericSignature(value);
    return signature
      ? [{ path, signature: signature.id, label: signature.label, excerpt: excerpt(value) }]
      : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findGenericContent(item, `${path}[${index}]`));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      findGenericContent(child, path ? `${path}.${key}` : key)
    );
  }

  return [];
}

export function hasGenericContent(value: unknown): boolean {
  return findGenericContent(value).length > 0;
}

export class GenericContentError extends Error {
  readonly issues: GenericContentIssue[];

  constructor(context: string, issues: GenericContentIssue[]) {
    const summary = issues
      .slice(0, 8)
      .map((issue) => `${issue.path}: ${issue.label}`)
      .join(' | ');
    super(
      `[NoGenericContent] ${context} contiene ${issues.length} firma(s) de contenido genérico: ${summary}. ` +
        'No se permite persistir ni exportar material genérico; reintente la generación.'
    );
    this.name = 'GenericContentError';
    this.issues = issues;
  }
}

/**
 * Gate fail-closed. Úsalo antes de persistir un workbook, exportar un PDF/DOCX
 * o aceptar la salida de un writer.
 */
export function assertNoGenericContent(value: unknown, context: string): void {
  const issues = findGenericContent(value);
  if (issues.length > 0) {
    throw new GenericContentError(context, issues);
  }
}
