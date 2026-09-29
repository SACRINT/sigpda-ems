import { z } from 'zod';
import { nullableString } from './zod-helpers';

/**
 * Extraction schemas and prompts for Formato 911 / Concentrado Estadístico.
 * (H-220 / Regla Anti-Fabricación B-001):
 * Se eliminaron todos los porcentajes pre-extraídos (eficienciaTerminal, abandono,
 * aprobacion, reprobacion, egresados). El concentrado 911 NO trae porcentajes;
 * la plataforma los CALCULA matemáticamente a partir de las cifras de inicio y fin.
 */

export const Estadistica911ExtractSchema = z.object({
  cicloEscolar: nullableString(),
  schoolName: nullableString(),
  schoolCct: nullableString(),
  directorName: nullableString(),
  supervisorName: nullableString(),
  momento: z.enum(['inicio_anterior', 'fin_anterior', 'inicio_actual', 'desconocido']).optional().default('desconocido'),
  tipoReporte: z.enum(['inicio', 'fin', 'desconocido']).optional().default('desconocido'),
  matricula: z.coerce.number().nullable().optional(),
  matriculaInicio: z.coerce.number().nullable().optional(),
  altas: z.coerce.number().nullable().optional(),
  bajas: z.coerce.number().nullable().optional(),
  existencia: z.coerce.number().nullable().optional(),
  regulares: z.coerce.number().nullable().optional(),
  irregulares: z.coerce.number().nullable().optional(),
  totalDocentes: z.coerce.number().nullable().optional(),
  docentesHombres: z.coerce.number().nullable().optional(),
  docentesMujeres: z.coerce.number().nullable().optional(),
  totalGrupos: z.coerce.number().nullable().optional(),
  gruposPorGrado: z.record(z.string(), z.coerce.number()).optional().default({}),
  observaciones: nullableString(),
});

export type Estadistica911ExtractDTO = z.infer<typeof Estadistica911ExtractSchema>;

export const ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT = `Eres un experto en análisis de concentrados estadísticos escolares (Formato 911) de la Educación Media Superior en México.
Tu objetivo es analizar textos de concentrados estadísticos de inicio o fin de ciclo y extraer las cifras oficiales exactas de la fila GENERAL y cabecera.
NUNCA calcules ni inventes porcentajes; solo extrae los números enteros presentes en el documento.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildEstadistica911ExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente al Concentrado Estadístico (Formato 911) de un plantel de Educación Media Superior y extrae las cifras de matrícula y cabecera institucional.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "cicloEscolar": "Ciclo escolar del documento (ej. 2025-2026)",
  "schoolName": "Nombre oficial del plantel",
  "schoolCct": "Clave de Centro de Trabajo (CCT)",
  "directorName": "Nombre completo del Director(a) si aparece en firmas o sello (o vacía)",
  "supervisorName": "Nombre completo del Supervisor(a) si aparece en firmas o sello (o vacía)",
  "tipoReporte": "inicio | fin (según sea concentrado de inicio o fin de cursos)",
  "momento": "inicio_anterior | fin_anterior | inicio_actual | desconocido",
  "matriculaInicio": número de alumnos al inicio del periodo (fila GENERAL columna AL INICIO DEL PERIODO TOTAL o matrícula de inicio),
  "altas": número de altas del ciclo (fila GENERAL columna ALTAS TOTAL o null si es inicio),
  "bajas": número de bajas definitivas del ciclo (fila GENERAL columna BAJAS TOTAL o null si es inicio),
  "existencia": número de alumnos en existencia al término del semestre (fila GENERAL columna EXISTENCIA o null si es inicio),
  "regulares": número de alumnos regulares (o null),
  "irregulares": número de alumnos irregulares (o null),
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
1. Extrae únicamente números enteros presentes en el documento.
2. NO calcules porcentajes de eficiencia terminal, abandono, aprobación ni reprobación.
3. En concentrados de FIN: extrae obligatoriamente la fila GENERAL con las columnas AL INICIO DEL PERIODO (matriculaInicio), ALTAS TOTAL, BAJAS TOTAL y EXISTENCIA.
4. En concentrados de INICIO: extrae la matrícula total al inicio del periodo escolar en matriculaInicio.
5. Si un dato no se encuentra en el documento, asigna null para campos numéricos y cadena vacía "" para texto.`;
}
