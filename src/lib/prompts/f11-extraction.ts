import { z } from 'zod';
import { nullableString } from './zod-helpers';

/**
 * Extraction schemas and prompts for F11 (Formato 11 - Control Escolar).
 * The F11 contains academic data: grades, averages by subject, approval rates.
 */

export const F11ExtractSchema = z.object({
  cicloEscolar: nullableString(),
  schoolName: nullableString(),
  schoolCct: nullableString(),
  directorName: nullableString(),
  totalAlumnos: z.coerce.number().nullable().optional(),
  totalDocentes: z.coerce.number().nullable().optional(),
  totalGrupos: z.coerce.number().nullable().optional(),
  promedioGeneral: z.coerce.number().nullable().optional(),
  aprobadosPorcentaje: z.coerce.number().nullable().optional(),
  reprobadosPorcentaje: z.coerce.number().nullable().optional(),
  // H-219: Campos deterministas de clasificación escolar F11
  regulares: z.coerce.number().nullable().optional(),
  irregulares: z.coerce.number().nullable().optional(),
  aprobados: z.coerce.number().nullable().optional(),
  reprobados: z.coerce.number().nullable().optional(),
  bajas: z.coerce.number().nullable().optional(),
  sinCalificacion: z.coerce.number().nullable().optional(),
  porcentajes: z.object({
    aprobados: z.coerce.number().optional(),
    regulares: z.coerce.number().optional(),
    irregulares: z.coerce.number().optional(),
    reprobados: z.coerce.number().optional(),
    bajas: z.coerce.number().optional(),
  }).optional(),
  listaAlumnos: z.array(z.object({
    curp: z.string(),
    nombre: z.string(),
    nia: z.string().optional(),
    grupo: z.string(),
    promedio: z.string().optional(),
    situacion: z.string().optional(),
    clase: z.enum(['BAJA', 'REGULAR', 'IRREGULAR', 'REPROBADO']).optional(),
    materiasCinco: z.number().optional(),
  })).optional(),
  reprobacionPorMateria: z.array(z.object({
    materia: z.string(),
    n: z.number(),
    reprobados: z.number(),
    porcentaje: z.number(),
    porcentajeAprobacion: z.number().optional(),
    metaSugerida: z.number().optional(),
    metaConfirmada: z.boolean().optional(),
    detallePorGrupo: z.record(z.string(), z.object({
      n: z.number(),
      reprobados: z.number(),
      porcentajeReprobacion: z.number(),
    })).optional(),
  })).optional(),
  cobertura: z.object({
    alumnosDetectados: z.number().optional(),
    alumnosConCalificacion: z.number().optional(),
    gruposDetectados: z.number().optional(),
  }).optional(),
  promediosPorAsignatura: z.record(z.string(), z.coerce.number()).optional().default({}),
  docentes: z.array(nullableString()).optional().default([]),
  docentesPorAsignatura: z.array(z.object({
    asignatura: nullableString(),
    docente: nullableString(),
    grupos: nullableString(),
    promedio: z.coerce.number().nullable().optional(),
  })).optional().default([]),
  observaciones: nullableString(),
});

export type F11ExtractDTO = z.infer<typeof F11ExtractSchema>;

export const F11_EXTRACTION_SYSTEM_PROMPT = `Eres un experto en análisis de documentos escolares de Control Escolar de la Educación Media Superior en México.
Tu objetivo es analizar textos extraídos del Formato F11C (Control Escolar - Inscripción y Acreditación Escolar) y extraer todos los datos académicos estructurados.
El F11C contiene una tabla por alumno con: CURP, nombre, calificaciones por asignatura, promedio general y situación escolar.
La "situación" o "clase" de cada alumno se determina así:
  - BAJA: marcado con "B" o sin calificaciones numéricas
  - REGULAR: tiene promedio numérico (>= 6.0) y 0 materias reprobadas (calificación < 6)
  - IRREGULAR: tiene promedio "/" y entre 1 y 3 materias con calificación < 6 (en 5)
  - REPROBADO: tiene promedio "/" y 4 o más materias con calificación < 6
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildF11ExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente al Formato F11C (Control Escolar - Inscripción y Acreditación Escolar) de un plantel de Educación Media Superior y extrae TODOS los datos académicos.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "cicloEscolar": "Ciclo escolar del documento (ej. 2025-2026)",
  "schoolName": "Nombre del plantel",
  "schoolCct": "Clave de Centro de Trabajo (CCT) formato XX[A-Z]{3}XXXX[A-Z]",
  "directorName": "Nombre completo del Director(a) si aparece en firmas, sellos o encabezados (o vacía)",
  "totalAlumnos": número total de alumnos inscritos (o null),
  "totalDocentes": número total de docentes (o null),
  "totalGrupos": número total de grupos (o null),
  "promedioGeneral": promedio general de aprovechamiento calculado sobre los alumnos con promedio numérico (número 0-10 o null),
  "aprobadosPorcentaje": porcentaje de alumnos REGULARES + IRREGULARES sobre el total (número 0-100 o null),
  "reprobadosPorcentaje": porcentaje de alumnos REPROBADOS sobre el total (número 0-100 o null),
  "regulares": número absoluto de alumnos clasificados como REGULAR (con promedio numérico, 0 materias reprobadas),
  "irregulares": número absoluto de alumnos clasificados como IRREGULAR (de 1 a 3 materias con calificación < 6),
  "aprobados": suma de regulares + irregulares (alumnos con derecho a reinscripción),
  "reprobados": número absoluto de alumnos clasificados como REPROBADO (4 o más materias con calificación < 6),
  "bajas": número absoluto de alumnos marcados como BAJA (código "B" o sin calificaciones),
  "porcentajes": {
    "aprobados": porcentaje = (regulares + irregulares) / totalAlumnos * 100 (redondeado a 1 decimal),
    "regulares": porcentaje = regulares / totalAlumnos * 100 (redondeado a 1 decimal),
    "irregulares": porcentaje = irregulares / totalAlumnos * 100 (redondeado a 1 decimal),
    "reprobados": porcentaje = reprobados / totalAlumnos * 100 (redondeado a 1 decimal),
    "bajas": porcentaje = bajas / totalAlumnos * 100 (redondeado a 1 decimal)
  },
  "listaAlumnos": [
    {
      "curp": "CURP del alumno (18 caracteres)",
      "nombre": "Apellido Paterno / Apellido Materno * Nombre(s) como aparece en el documento",
      "nia": "Número de identificación del alumno si aparece",
      "grupo": "Grupo al que pertenece (ej. 1A, 2A)",
      "promedio": "Promedio general del alumno como texto (número como '7.8' o '/' para irregulares/reprobados)",
      "situacion": "Clave de situación escolar (ej. 'Ac', 'B', '/')",
      "clase": "REGULAR | IRREGULAR | REPROBADO | BAJA",
      "materiasCinco": número de materias con calificación menor a 6 (entero)
    }
  ],
  "reprobacionPorMateria": [
    {
      "materia": "Nombre de la asignatura",
      "n": total de alumnos que cursaron la asignatura,
      "reprobados": número de alumnos con calificación < 6,
      "porcentaje": porcentaje de reprobación (0-100),
      "porcentajeAprobacion": porcentaje de aprobación (0-100)
    }
  ],
  "promediosPorAsignatura": {
    "Nombre de Asignatura": promedio numérico (ej. {"Pensamiento Matemático I": 7.5, "Lenguaje y Comunicación I": 8.2})
  },
  "docentes": [
    "Nombres completos de todos los docentes que aparezcan en el documento"
  ],
  "docentesPorAsignatura": [
    {
      "asignatura": "Nombre de la asignatura",
      "docente": "Nombre del docente que la imparte",
      "grupos": "Grupos a los que imparte (ej. 1A, 1B, 2A)",
      "promedio": promedio de esa asignatura (o null)
    }
  ],
  "observaciones": "Observaciones generales del documento si las hay"
}

REGLAS DE EXTRACCIÓN:
1. Extrae CADA ALUMNO de la tabla en "listaAlumnos" con su clasificación determinista (REGULAR/IRREGULAR/REPROBADO/BAJA).
2. Calcula "regulares", "irregulares", "aprobados", "reprobados" y "bajas" contando los alumnos de "listaAlumnos".
3. Calcula los porcentajes usando "totalAlumnos" como base (divides cada conteo entre totalAlumnos y multiplicas por 100).
4. "aprobadosPorcentaje" = (regulares + irregulares) / totalAlumnos * 100
5. Si el documento es una imagen escaneada y no puedes leer la tabla completa, extrae al menos: totalAlumnos, schoolName, schoolCct, directorName, cicloEscolar.
6. Extrae los promedios por asignatura exactamente como aparecen.
7. Si el documento contiene tabla de calificaciones por grupo, extrae cada asignatura con su docente y grupos.
8. Si un dato numérico no se encuentra, usa null. Para texto usa "".
9. Los promedios deben ser números decimales (ej. 7.5, no "7.5" como texto).
10. El CURP tiene exactamente 18 caracteres alfanuméricos — no inventes CURPs.`;
}
