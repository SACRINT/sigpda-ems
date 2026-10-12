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
