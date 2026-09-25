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
Tu objetivo es analizar textos extraídos del Formato F11 (Control Escolar) y extraer datos académicos estructurados.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildF11ExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente al Formato F11 (Control Escolar) de un plantel de Educación Media Superior y extrae los datos académicos.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "cicloEscolar": "Ciclo escolar del documento (ej. 2025-2026)",
  "schoolName": "Nombre del plantel",
  "schoolCct": "Clave de Centro de Trabajo (CCT)",
  "directorName": "Nombre completo del Director(a) si aparece en firmas, sellos o encabezados (o vacía)",
  "totalAlumnos": número total de alumnos inscritos (o null),
  "totalDocentes": número total de docentes (o null),
  "totalGrupos": número total de grupos (o null),
  "promedioGeneral": promedio general de aprovechamiento (número 0-10 o null),
  "aprobadosPorcentaje": porcentaje de alumnos aprobados (número 0-100 o null),
  "reprobadosPorcentaje": porcentaje de alumnos reprobados (número 0-100 o null),
  "promediosPorAsignatura": {
    "Nombre de Asignatura": promedio numérico (ej. {"Pensamiento Matemático I": 7.5, "Lenguaje y Comunicación I": 8.2}),
    "...": "..."
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
1. Extrae los promedios por asignatura exactamente como aparecen en el documento.
2. Si el documento contiene tabla de calificaciones por grupo, extrae cada asignatura con su docente y grupos.
3. Extrae la lista limpia de todos los nombres de profesores identificados en el arreglo "docentes".
4. Extrae el nombre del Director(a) en "directorName" si aparece en sellos o firmas al pie.
5. Si un dato no se encuentra, asigna una cadena vacía "" para texto o null para números, sin inventar información.
6. Los promedios deben ser números decimales (ej. 7.5, no "7.5" como texto).`;
}
