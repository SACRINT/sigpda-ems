import { z } from 'zod';
import { nullableString } from './zod-helpers';

/**
 * Extraction schemas and prompts for Estadística 911 (Formato 911 - School Statistics).
 * The 911 contains demographic/enrollment data: matrícula, abandono, eficiencia terminal, etc.
 */

export const Estadistica911ExtractSchema = z.object({
  cicloEscolar: nullableString(),
  schoolName: nullableString(),
  schoolCct: nullableString(),
  directorName: nullableString(),
  supervisorName: nullableString(),
  matricula: z.coerce.number().nullable().optional(),
  matriculaAnterior: z.coerce.number().nullable().optional(),
  egresados: z.coerce.number().nullable().optional(),
  egresadosAnterior: z.coerce.number().nullable().optional(),
  bajasDefinitivas: z.coerce.number().nullable().optional(),
  abandonoPorcentaje: z.coerce.number().nullable().optional(),
  abandonoAnterior: z.coerce.number().nullable().optional(),
  eficienciaTerminal: z.coerce.number().nullable().optional(),
  eficienciaTerminalAnterior: z.coerce.number().nullable().optional(),
  aprobacionPorcentaje: z.coerce.number().nullable().optional(),
  reprobacionPorcentaje: z.coerce.number().nullable().optional(),
  tipoReporte: z.enum(['inicio', 'fin', 'desconocido']).optional().default('desconocido'),
  momento: z.enum(['inicio_anterior', 'fin_anterior', 'inicio_actual', 'desconocido']).optional().default('desconocido'),
  totalDocentes: z.coerce.number().nullable().optional(),
  docentesHombres: z.coerce.number().nullable().optional(),
  docentesMujeres: z.coerce.number().nullable().optional(),
  totalGrupos: z.coerce.number().nullable().optional(),
  gruposPorGrado: z.record(z.string(), z.coerce.number()).optional().default({}),
  observaciones: nullableString(),
});

export type Estadistica911ExtractDTO = z.infer<typeof Estadistica911ExtractSchema>;

export const ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT = `Eres un experto en análisis de documentos estadísticos escolares de la Educación Media Superior en México.
Tu objetivo es analizar textos extraídos del Formato 911 (Estadística Escolar) y extraer datos demográficos y de matrícula estructurados.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildEstadistica911ExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente a la Estadística Escolar (Formato 911) de un plantel de Educación Media Superior y extrae los datos demográficos y de matrícula.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "cicloEscolar": "Ciclo escolar del documento (ej. 2025-2026)",
  "schoolName": "Nombre del plantel",
  "schoolCct": "Clave de Centro de Trabajo (CCT)",
  "directorName": "Nombre completo del Director(a) si aparece en firmas, sellos o datos del responsable (o vacía)",
  "supervisorName": "Nombre completo del Supervisor(a) escolar si aparece en firmas o sellos (o vacía)",
  "matricula": número total de alumnos inscritos en el ciclo actual (o null),
  "matriculaAnterior": número total de alumnos inscritos en el ciclo anterior (o null),
  "egresados": número de egresados del ciclo actual (o null),
  "egresadosAnterior": número de egresados del ciclo anterior (o null),
  "bajasDefinitivas": número de bajas definitivas (o null),
  "abandonoPorcentaje": tasa de abandono escolar en porcentaje (número 0-100 o null),
  "abandonoAnterior": tasa de abandono escolar del ciclo anterior (o null),
  "eficienciaTerminal": porcentaje de eficiencia terminal (número 0-100 o null),
  "eficienciaTerminalAnterior": eficiencia terminal del ciclo anterior (o null),
  "aprobacionPorcentaje": porcentaje de aprobación general (o null),
  "reprobacionPorcentaje": porcentaje de reprobación general (o null),
  "tipoReporte": "inicio | fin (si es formato 911 de inicio de cursos o fin de cursos)",
  "totalDocentes": número total de docentes (o null),
  "docentesHombres": número de docentes hombres (o null),
  "docentesMujeres": número de docentes mujeres (o null),
  "totalGrupos": número total de grupos (o null),
  "gruposPorGrado": {
    "1er Semestre": número de grupos,
    "2do Semestre": número de grupos,
    "3er Semestre": número de grupos
  },
  "observaciones": "Observaciones generales del documento si las hay"
}

REGLAS DE EXTRACCIÓN:
1. Extrae los porcentajes numéricos limpios (sin el símbolo %).
2. Si el documento contiene datos de ciclos anteriores para comparación, extráelos en los campos "Anterior".
3. Si el documento contiene desglose por grado o semester, extrae el número de grupos por grado.
4. Extrae el nombre del Director(a) y Supervisor(a) en "directorName" y "supervisorName" si aparecen en los bloques de firmas oficiales al calce del formato 911.
5. Si un dato no se encuentra, asigna una cadena vacía "" para texto o null para números, sin inventar información.
6. Los porcentajes deben ser números decimales (ej. 6.8, no "6.8%" como texto).`;
}
