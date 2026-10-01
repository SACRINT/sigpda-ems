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
  matriculaInicioFinDoc: z.coerce.number().nullable().optional(),
  matriculaFinal: z.coerce.number().nullable().optional(),
  existenciaFin: z.coerce.number().nullable().optional(),
  totalAlumnos: z.coerce.number().nullable().optional(),
  altas: z.coerce.number().nullable().optional(),
  bajas: z.coerce.number().nullable().optional(),
  bajasDefinitivas: z.coerce.number().nullable().optional(),
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

export const ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT = `Eres un experto de alta precisión en análisis e interpretación de concentrados estadísticos escolares y Formato 911 de la Educación Media Superior en México (SEP, DGB, SEMS, Estados).
Tu misión es analizar textos y tablas extraídas (incluyendo OCR de documentos escaneados o fotocopiados, sin importar si estaban rotados u horizontales) y extraer fielmente las cifras oficiales de matrícula, altas, bajas, existencia y datos institucionales.
NUNCA calcules ni inventes porcentajes de eficiencia terminal, abandono o aprobación; solo extrae los números enteros de alumnos, docentes y grupos presentes o derivables del documento.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildEstadistica911ExtractionPrompt(documentText: string, requestedMomento?: string): string {
  const isExplicitFin = requestedMomento === 'fin_anterior';
  const isExplicitIniAct = requestedMomento === 'inicio_actual';
  const isExplicitIniAnt = requestedMomento === 'inicio_anterior';

  let contextoMomento = '';
  if (isExplicitFin) {
    contextoMomento = `
>>> ATENCIÓN CRÍTICA: El usuario ha seleccionado este documento como "911 FIN DE CICLO ANTERIOR" (fin_anterior).
- "tipoReporte" DEBE ser "fin" y "momento" DEBE ser "fin_anterior".
- OBLIGATORIO: Debes extraer el número de alumnos en "existencia" (alumnos al cierre/fin del ciclo) y "bajas". NUNCA retornes existencia: null si el documento contiene datos de matrícula o alumnos.
- En concentrados de fin estatales (Puebla / BGE / DGB):
  * "AL INICIO DEL PERIODO ESCOLAR (AL 30 DE SEPTIEMBRE)" columna TOTAL -> "matriculaInicio".
  * "ALTAS (TIPOS DE ACUERDO AL MANUAL DE TRASLADO)" columna TOTAL -> "altas".
  * "BAJAS (TIPOS DE ACUERDO AL MANUAL DE TRASLADO)" columna TOTAL -> "bajas".
  * "AL TÉRMINO DEL SEMESTRE" columna "EXISTENCIA" o "TOTAL" -> "existencia".
  * Revisa la fila "GENERAL" al pie de la tabla. Si la fila GENERAL no aparece explícita por OCR, busca la fila "SUBTOTAL" o suma los valores de "HOMBRES (M)" y "MUJERES (M)" para cada columna.
- En Formato 911.8 SEP/INEGI (Fin de Cursos):
  * "Existencia al fin de cursos" o "Total de alumnos al fin de cursos" -> "existencia".
  * "Bajas durante el ciclo" -> "bajas".
  * "Matrícula inicial" o "Inscripción total" -> "matriculaInicio".
- Regla de salvaguarda: Si no hallas la palabra "EXISTENCIA" pero tienes matrícula inicial y bajas, calcula existencia = matriculaInicio + (altas o 0) - bajas. Si solo hay un número total de matrícula en el reporte de fin, asígnalo a "existencia".
`;
  } else if (isExplicitIniAct) {
    contextoMomento = `
>>> ATENCIÓN: El usuario ha seleccionado este documento como "911 INICIO CICLO ACTUAL" (inicio_actual).
- "tipoReporte" DEBE ser "inicio" y "momento" DEBE ser "inicio_actual".
- Extrae la matrícula total al inicio del ciclo escolar vigente en "matriculaInicio".
`;
  } else if (isExplicitIniAnt) {
    contextoMomento = `
>>> ATENCIÓN: El usuario ha seleccionado este documento como "911 INICIO CICLO ANTERIOR" (inicio_anterior).
- "tipoReporte" DEBE ser "inicio" y "momento" DEBE ser "inicio_anterior".
- Extrae la matrícula total al inicio del ciclo escolar anterior en "matriculaInicio".
`;
  }

  return `Analiza con minuciosidad el siguiente documento correspondiente al Concentrado Estadístico (Formato 911) de un plantel de Educación Media Superior y extrae las cifras oficiales de matrícula, cierre y cabecera institucional.
${contextoMomento}
TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "cicloEscolar": "Ciclo escolar del documento (ej. 2025-2026)",
  "schoolName": "Nombre oficial del plantel",
  "schoolCct": "Clave de Centro de Trabajo (CCT)",
  "directorName": "Nombre completo del Director(a) si aparece en firmas, sello o texto (o vacía)",
  "supervisorName": "Nombre completo del Supervisor(a) si aparece en firmas, sello o texto (o vacía)",
  "tipoReporte": "inicio | fin (según sea concentrado de inicio o fin de cursos)",
  "momento": "inicio_anterior | fin_anterior | inicio_actual | desconocido",
  "matriculaInicio": número de alumnos al inicio del periodo (fila GENERAL columna AL INICIO DEL PERIODO TOTAL, o matrícula de inicio),
  "altas": número de altas del ciclo (fila GENERAL columna ALTAS TOTAL o 0),
  "bajas": número de bajas definitivas del ciclo (fila GENERAL columna BAJAS TOTAL o 0),
  "existencia": número de alumnos en existencia al término del semestre / fin de cursos (fila GENERAL columna EXISTENCIA, o matrícula final),
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

REGLAS DE EXTRACCIÓN Y CONSISTENCIA NUMÉRICA:
1. Extrae únicamente números enteros presentes en el documento.
2. NO calcules porcentajes de eficiencia terminal, abandono, aprobación ni reprobación.
3. IDENTIFICACIÓN DE TABLAS Y FILAS (CONCENTRADO ESTADÍSTICO DE PUEBLA Y NACIONAL 911):
   a) Fila GENERAL: Representa el total del plantel. Si el texto OCR no tiene la palabra "GENERAL" intacta (puede decir "TOTAL", "TOTAL GENERAL", "GENERAL:", o estar cortada), identifica la fila de totales finales o suma los subtotales de HOMBRES (M) y MUJERES (M).
   b) En concentrados de FIN ("AL TÉRMINO DEL SEMESTRE" o momento "fin_anterior"):
      - "existencia": Obligatorio. Es la cantidad de alumnos que concluyeron el ciclo. Buscar en "AL TÉRMINO DEL SEMESTRE - EXISTENCIA" o suma de hombres + mujeres en existencia.
      - "bajas": Obligatorio. Total de bajas definitivas (columna BAJAS TOTAL o suma de bajas hombres + mujeres).
      - "matriculaInicio": Matrícula con la que arrancó el periodo (columna AL INICIO DEL PERIODO TOTAL).
      - "altas": Total de altas durante el periodo.
   c) En concentrados de INICIO ("AL INICIO DEL PERIODO" o momento "inicio_actual" / "inicio_anterior"):
      - "matriculaInicio": Matrícula total inicial.
4. Si un dato textual no se encuentra, asigna cadena vacía "". Para campos numéricos no aplicables asigna null o 0 según corresponda.`;
}
