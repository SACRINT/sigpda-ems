/**
 * student-content-model.ts — Modelo Canónico de Contenido de Estudiante
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 1 Spike)
 *
 * SSoT del contenido autodidacta para libros de texto escolares (MCCEMS 2026-2027).
 * Cumple estrictamente con la Salvedad Crítica del Gate 0 (§9):
 * - Voz dirigida exclusivamente al ESTUDIANTE en segunda persona ("tú").
 * - CERO etiquetas de docente ("Docente:", "Estudiante:").
 * - CERO verbos de instrucción de aula ("activar el interés", "verificar comprensión", "orientar el avance").
 * - Teoría real, ejemplos numéricos paso a paso, práctica con pistas y recursos de ampliación.
 */

import { z } from 'zod';
import type { SessionPlan } from '@/types/work-textbook';
import { stripMaterialTokensDeep } from '@/lib/materials/material-tokens';

// ============================================================================
// 1. Tipos e Interfaces Fundamentales
// ============================================================================

export type TipoContenidoBloque = 'parrafo' | 'formula' | 'definicion' | 'tabla';

export interface ContenidoBloque {
  tipo: TipoContenidoBloque;
  texto?: string;
  titulo?: string;
  formulaLatex?: string;
  columnas?: string[];
  filas?: string[][];
}

export interface EjemploResuelto {
  enunciado: string;
  pasos: string[];
}

export interface PracticaItem {
  enunciado: string;
  pista: string;
}

export type TipoRecurso = 'video' | 'web' | 'lectura';

export interface RecursoItem {
  titulo: string;
  url: string;
  tipo: TipoRecurso;
}

export interface SpotMaterial {
  nombre: string;
  archivo: string; // ej. "abaco.png" en public/images/materiales/
  pie?: string;
  anchoCm?: number; // Máximo permitido: 4.2 cm (>= 300 DPI a 512x512)
}

export interface StudentSession {
  numero: number;
  titulo: string;
  objetivo: string;
  motivacion: string;
  saberesPrevios: string;
  contenido: ContenidoBloque[];
  ejemploResuelto: EjemploResuelto;
  practica: PracticaItem[];
  aplicacion: string;
  autoevaluacion: string[];
  recursos: RecursoItem[];
  materialSpot?: SpotMaterial;
  sidenote?: string;
  productoIntegrador?: string;
}

export interface StudentChapter {
  uac: string;
  bloque: string;
  semestre: number | string;
  cicloEscolar: string;
  plantel: string;
  cct: string;
  zonaEscolar: string;
  subsecretaria?: string;
  editorialSubtitle?: string;
  sesiones: StudentSession[];
}

// ============================================================================
// 2. Esquemas Zod para Validación en Runtime
// ============================================================================

export const ContenidoBloqueSchema = z.object({
  tipo: z.enum(['parrafo', 'formula', 'definicion', 'tabla']),
  texto: z.string().optional().default(''),
  titulo: z.string().optional(),
  formulaLatex: z.string().optional(),
  columnas: z.array(z.string()).optional(),
  filas: z.array(z.array(z.string())).optional(),
});

export const EjemploResueltoSchema = z.object({
  enunciado: z.string().min(10, 'El enunciado del ejemplo debe ser detallado'),
  pasos: z.array(z.string().min(5)).min(2, 'El ejemplo resuelto requiere al menos 2 pasos numerados'),
});

export const PracticaItemSchema = z.object({
  enunciado: z.string().min(10, 'El enunciado del ejercicio debe tener datos concretos'),
  pista: z.string().min(5, 'La pista debe dar una orientación sin revelar la solución'),
});

export const RecursoItemSchema = z.object({
  titulo: z.string().min(3),
  url: z.string().url('La URL del recurso debe ser válida'),
  tipo: z.enum(['video', 'web', 'lectura']),
});

export const SpotMaterialSchema = z.object({
  nombre: z.string(),
  archivo: z.string().regex(/\.png$/i, 'El asset debe ser un archivo .png'),
  pie: z.string().optional(),
  anchoCm: z.number().max(4.2, 'El ancho del asset spot no puede superar 4.2 cm (>= 300 DPI)').optional(),
});

export const StudentSessionSchema = z.object({
  numero: z.number().int().positive(),
  titulo: z.string().min(5),
  objetivo: z.string().min(10, 'El objetivo debe describir lo que el estudiante va a aprender'),
  motivacion: z.string().min(20, 'La motivación situada debe presentar un caso real o detonador'),
  saberesPrevios: z.string().min(10),
  contenido: z.array(ContenidoBloqueSchema).min(1, 'La sesión debe contener teoría real'),
  ejemploResuelto: EjemploResueltoSchema,
  practica: z.array(PracticaItemSchema).min(1, 'Debe incluir al menos un ejercicio práctico'),
  aplicacion: z.string().min(15, 'Debe incluir aplicación a la vida real'),
  autoevaluacion: z.array(z.string()).min(2, 'Debe incluir al menos 2 puntos de autoevaluación'),
  recursos: z.array(RecursoItemSchema).min(1, 'Debe incluir al menos 1 recurso de ampliación'),
  materialSpot: SpotMaterialSchema.optional(),
  sidenote: z.string().optional(),
  productoIntegrador: z.string().optional(),
});

export const StudentChapterSchema = z.object({
  uac: z.string().min(3),
  bloque: z.string().min(3),
  semestre: z.union([z.number(), z.string()]),
  cicloEscolar: z.string().min(4),
  plantel: z.string().min(3),
  cct: z.string().min(5),
  zonaEscolar: z.string().min(3),
  subsecretaria: z.string().optional(),
  editorialSubtitle: z.string().optional(),
  sesiones: z.array(StudentSessionSchema).min(1, 'El capítulo debe contener sesiones'),
}).superRefine((chapter, ctx) => {
  // Invariante Load-Bearing anti-F11: continuidad estricta 1..N sin omisiones ni desorden
  for (let i = 0; i < chapter.sesiones.length; i++) {
    const s = chapter.sesiones[i];
    const expectedNum = i + 1;
    if (s.numero !== expectedNum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Discontinuidad en numeración de sesiones (anti-F11): se esperaba sesión ${expectedNum} pero se encontró ${s.numero}`,
        path: ['sesiones', i, 'numero'],
      });
    }
  }
});

// ============================================================================
// 3. Guardrails de Contenido — Filtro Anti-Voz de Docente (Salvedad Crítica §9)
// ============================================================================

export const FORBIDDEN_TEACHER_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\bDocente\s*:/i, label: 'Etiqueta de rol "Docente:"' },
  { regex: /\bEstudiante\s*:/i, label: 'Etiqueta de rol "Estudiante:"' },
  { regex: /activar\s+el\s+inter[eé]s/i, label: 'Instrucción docente "activar el interés"' },
  { regex: /verificar\s+comprensi[oó]n/i, label: 'Instrucción docente "verificar comprensión"' },
  { regex: /orientar\s+el\s+avance/i, label: 'Instrucción docente "orientar el avance"' },
  { regex: /plantear\s+la\s+situaci[oó]n/i, label: 'Instrucción docente "plantear la situación"' },
  { regex: /retomar\s+el\s+desaf[ií]o/i, label: 'Instrucción docente "retomar el desafío"' },
  { regex: /exponer\s+y\s+problematizar/i, label: 'Instrucción docente "exponer y problematizar"' },
];

export interface ValidationViolation {
  campo: string;
  patron: string;
  fragmento: string;
}

export interface StudentContentValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  errors: string[];
}

/**
 * Escanea recursivamente cualquier estructura de datos en búsqueda de marcas
 * o instrucciones dirigidas al maestro en lugar del estudiante.
 */
function scanForTeacherVoice(obj: unknown, path: string, violations: ValidationViolation[]): void {
  if (typeof obj === 'string') {
    for (const { regex, label } of FORBIDDEN_TEACHER_PATTERNS) {
      if (regex.test(obj)) {
        const match = obj.match(regex);
        violations.push({
          campo: path,
          patron: label,
          fragmento: match ? match[0] : label,
        });
      }
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => scanForTeacherVoice(item, `${path}[${index}]`, violations));
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      scanForTeacherVoice(value, path ? `${path}.${key}` : key, violations);
    }
  }
}

/**
 * Valida un capítulo completo asegurando que cumpla el esquema Zod
 * y que no contenga ninguna marca de voz de docente.
 */
export function validateStudentChapter(chapter: unknown): StudentContentValidationResult {
  const parseResult = StudentChapterSchema.safeParse(chapter);
  const errors: string[] = [];

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  const violations: ValidationViolation[] = [];
  scanForTeacherVoice(chapter, 'chapter', violations);

  if (violations.length > 0) {
    for (const v of violations) {
      errors.push(`Voz docente detectada en ${v.campo}: ${v.patron} ('${v.fragmento}')`);
    }
  }

  return {
    isValid: errors.length === 0 && violations.length === 0,
    violations,
    errors,
  };
}

export class StudentContentValidationError extends Error {
  public readonly violations: ValidationViolation[];
  public readonly errors: string[];

  constructor(message: string, violations: ValidationViolation[], errors: string[]) {
    super(message);
    this.name = 'StudentContentValidationError';
    this.violations = violations;
    this.errors = errors;
  }
}

/**
 * Lanza un error de validación descriptivo si el contenido no es puramente para estudiante.
 */
export function assertValidStudentChapter(chapter: unknown): asserts chapter is StudentChapter {
  const result = validateStudentChapter(chapter);
  if (!result.isValid) {
    throw new StudentContentValidationError(
      `El capítulo contiene marcas inválidas o no cumple el modelo de estudiante:\n${result.errors.join('\n')}`,
      result.violations,
      result.errors,
    );
  }
}

// ============================================================================
// 4. Adaptador Bidireccional OpenCode (SessionPlan <-> StudentSession) — H-03
// ============================================================================

/**
 * Convierte un bloque de texto plano o markdown generado por los writers de OpenCode
 * en bloques estructurados ContenidoBloque[] requeridos por el motor editorial Typst.
 */
export function parseContenidoToBloques(rawContenido: string): ContenidoBloque[] {
  if (!rawContenido || typeof rawContenido !== 'string') {
    return [{ tipo: 'parrafo', texto: '' }];
  }

  const rawParagraphs = rawContenido
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (rawParagraphs.length === 0) {
    return [{ tipo: 'parrafo', texto: rawContenido.trim() }];
  }

  return rawParagraphs.map((parrafo) => {
    // Detección de fórmulas en display o bloques matemáticos
    if (/^\$\$[\s\S]+\$\$$/.test(parrafo) || /^\\\[[\s\S]+\\\]$/.test(parrafo)) {
      const cleanMath = parrafo.replace(/^\$\$|^\$\$\$|\$\$$|\\\[|\\\]/g, '').trim();
      return { tipo: 'formula', texto: cleanMath };
    }

    // Detección de definiciones formales
    if (/^(definici[oó]n|concepto|propiedad)\b/i.test(parrafo)) {
      const match = parrafo.match(/^(definici[oó]n|concepto|propiedad)\s*(?:[:\-–]\s*(.+?))?[:\-–]\s*(.+)$/i);
      if (match) {
        return {
          tipo: 'definicion',
          titulo: match[2]?.trim() || match[1]?.trim() || 'Definición Formal',
          texto: match[3]?.trim() || parrafo,
        };
      }
      return { tipo: 'definicion', titulo: 'Definición', texto: parrafo };
    }

    return { tipo: 'parrafo', texto: parrafo };
  });
}

/**
 * Convierte una cadena de ejemplo resuelto en el formato estructurado
 * { enunciado: string, pasos: string[] } requerido por el motor editorial.
 */
export function parseEjemploResuelto(rawEjemplo: string): EjemploResuelto {
  if (!rawEjemplo || typeof rawEjemplo !== 'string') {
    return {
      enunciado: 'Ejemplo resuelto de aplicación guiada.',
      pasos: [
        'Paso 1: Identificar los datos iniciales y aplicar la fórmula correspondiente.',
        'Paso 2: Realizar los cálculos y validar el resultado final.',
      ],
    };
  }

  const lines = rawEjemplo.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const pasoRegex = /^(?:paso\s*\d+[:.\-]?|\d+[:.)\-]|[-*•])\s*(.+)$/i;

  const pasos: string[] = [];
  const enunciadoLines: string[] = [];

  for (const line of lines) {
    const match = line.match(pasoRegex);
    if (match) {
      pasos.push(match[1].trim());
    } else if (pasos.length === 0) {
      enunciadoLines.push(line);
    } else {
      pasos[pasos.length - 1] += ' ' + line;
    }
  }

  const enunciado =
    enunciadoLines.join(' ').trim() || (pasos.length > 0 ? pasos.shift()! : rawEjemplo.slice(0, 100));

  if (pasos.length < 2) {
    if (pasos.length === 1) {
      pasos.push('Paso 2: Concluir y verificar el resultado con el contexto de la situación.');
    } else {
      pasos.push('Paso 1: Plantear la ecuación con los datos dados en el enunciado.');
      pasos.push('Paso 2: Despejar y calcular la solución numérica requerida.');
    }
  }

  return { enunciado, pasos };
}

/**
 * Adapta un SessionPlan generado por los writers de OpenCode en una StudentSession
 * compatible con el compilador editorial de Typst (Fase 3/5).
 *
 * Paridad Libro ↔ Plan: traduce los tokens [[material:...]] a su etiqueta humana
 * antes de validar, para que el libro del estudiante nunca muestre sintaxis cruda.
 */
export function adaptSessionPlanToStudentSession(
  plan: SessionPlan,
  tituloPersonalizado?: string,
): StudentSession {
  plan = stripMaterialTokensDeep(plan);
  const contenido = parseContenidoToBloques(plan.contenido);
  const ejemploResuelto = parseEjemploResuelto(plan.ejemploResuelto);

  return {
    numero: plan.sessionNumber,
    titulo: tituloPersonalizado || `Sesión ${plan.sessionNumber}: ${plan.objetivo.slice(0, 60).replace(/[.:]+$/, '')}`,
    objetivo: plan.objetivo,
    motivacion: plan.motivacion,
    saberesPrevios: plan.saberesPrevios,
    contenido,
    ejemploResuelto,
    practica: plan.practica.map((p) => ({
      enunciado: p.enunciado,
      pista: p.pista,
    })),
    aplicacion: plan.aplicacion,
    autoevaluacion: plan.autoevaluacion,
    recursos: plan.recursos.map((r) => ({
      titulo: r.titulo,
      url: r.url,
      tipo: (r.tipo === 'video' || r.tipo === 'web' || r.tipo === 'lectura' ? r.tipo : 'web') as
        | 'video'
        | 'web'
        | 'lectura',
    })),
    productoIntegrador: plan.productoIntegrador,
  };
}

/**
 * Adapta una StudentSession del motor editorial a un SessionPlan para interoperabilidad con OpenCode.
 *
 * NOTA DE DISEÑO (AUD-07):
 * Esta transformación es de interoperabilidad hacia el modelo plano heredado. Descarta intencionalmente
 * campos del motor editorial no soportados por el esquema de SessionPlan (como `titulo`, `materialSpot`
 * y `sidenote`). Garantiza preservación de la estructura pedagógica fundamental (número, objetivo, contenidos,
 * ejemplo, práctica, autoevaluación y producto integrador).
 */
export function adaptStudentSessionToSessionPlan(session: StudentSession): SessionPlan {
  const contenidoStr = session.contenido
    .map((b) => (b.titulo ? `${b.titulo}:\n${b.texto}` : b.texto))
    .join('\n\n');

  const ejemploStr = `${session.ejemploResuelto.enunciado}\n${session.ejemploResuelto.pasos
    .map((p, i) => `Paso ${i + 1}: ${p}`)
    .join('\n')}`;

  return {
    sessionNumber: session.numero,
    objetivo: session.objetivo,
    motivacion: session.motivacion,
    saberesPrevios: session.saberesPrevios,
    contenido: contenidoStr,
    ejemploResuelto: ejemploStr,
    practica: session.practica.map((p) => ({
      enunciado: p.enunciado,
      pista: p.pista,
    })),
    aplicacion: session.aplicacion,
    autoevaluacion: session.autoevaluacion,
    recursos: session.recursos.map((r) => ({
      titulo: r.titulo,
      url: r.url,
      tipo: r.tipo,
    })),
    productoIntegrador: session.productoIntegrador || '',
  };
}

// ============================================================================
// 5. Renumeración Global de Referencias de Sesión (Fase C — numeración 1..72)
// ============================================================================
// Los sessionPlans se generan con numeración LOCAL por bloque (1..24). El libro
// editorial imprime la numeración GLOBAL 1..72, por lo que toda referencia en
// prosa ("las sesiones 4 a 11", "Sesión 4 hasta la 11", "Sesiones 13, 14, 15",
// "Sesión 1:") debe desplazarse por el offset del bloque (0, +24 o +48).

const SESSION_NUM_EXPR_SRC =
  '\\d{1,2}(?!\\d)(?:\\s*(?:[,y]\\s*|a(?:\\s+la)?\\s+|al\\s+|hasta(?:\\s+la)?\\s+|[-–—])\\s*\\d{1,2}(?!\\d))*';
const SESSION_REF_REGEX = new RegExp(`(sesi(?:ón|ones|on)\\b\\s*)(${SESSION_NUM_EXPR_SRC})`, 'gi');

/** Desplaza las referencias de sesión en un texto (offset 0 = no-op). */
export function remapSessionReferences(text: string, offset: number): string {
  if (!offset || !text) return text;
  return text.replace(SESSION_REF_REGEX, (_full, prefix: string, numExpr: string) => {
    const remapped = numExpr.replace(/\d{1,2}/g, (digit) => {
      const v = Number(digit);
      const target = v + offset;
      return v >= 1 && v <= 24 && target >= 1 && target <= 72 ? String(target) : digit;
    });
    return `${prefix}${remapped}`;
  });
}

/** Aplica remapSessionReferences recursivamente a todas las cadenas de una estructura. */
export function remapSessionReferencesDeep<T>(value: T, offset: number): T {
  if (!offset) return value;
  if (typeof value === 'string') return remapSessionReferences(value, offset) as T;
  if (Array.isArray(value)) return value.map((item) => remapSessionReferencesDeep(item, offset)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = remapSessionReferencesDeep(item, offset);
    }
    return out as T;
  }
  return value;
}
