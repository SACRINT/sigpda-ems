import { z } from 'zod';

/**
 * Specialized prompts and schemas for extracting structured PMC data from previous documents (PDF / Word DOCX).
 * Aligned with MCCEMS and New School Model (NEM) guidelines.
 */

export const PmcPreviousExtractSchema = z.object({
  schoolName: z.string().optional().default(''),
  schoolCct: z.string().optional().default(''),
  municipality: z.string().optional().default(''),
  locality: z.string().optional().default(''),
  schoolZone: z.string().optional().default(''),
  directorName: z.string().optional().default(''),
  supervisorName: z.string().optional().default(''),
  cicloEscolar: z.string().optional().default('2025-2026'),
  subsystem: z.string().optional().default('BGE'),
  totalStaff: z.coerce.number().optional().default(1),
  staffData: z.array(z.object({
    nombre: z.string().optional().default(''),
    cargo: z.string().optional().default('Docente'),
    meta_individual: z.string().optional().default(''),
    metas_individuales: z.array(z.object({
      categoria: z.string().optional().default(''),
      tema: z.string().optional().default(''),
      meta: z.string().optional().default(''),
      estrategia: z.string().optional().default(''),
      entregable: z.string().optional().default(''),
      periodo: z.string().optional().default(''),
    })).optional().default([]),
  })).optional().default([]),
  diagnosticoComunidad: z.string().optional().default(''),
  indicadores: z.object({
    matricula: z.coerce.number().nullable().optional(),
    aprobacion_ant: z.coerce.number().nullable().optional(),
    aprobacion_meta: z.coerce.number().nullable().optional(),
    reprobacion_ant: z.coerce.number().nullable().optional(),
    reprobacion_meta: z.coerce.number().nullable().optional(),
    abandono_ant: z.coerce.number().nullable().optional(),
    abandono_meta: z.coerce.number().nullable().optional(),
    et_ant: z.coerce.number().nullable().optional(),
    et_meta: z.coerce.number().nullable().optional(),
  }).partial().optional().default({}),
  foda: z.object({
    fortalezas: z.string().optional().default(''),
    oportunidades: z.string().optional().default(''),
    debilidades: z.string().optional().default(''),
    amenazas: z.string().optional().default(''),
  }).partial().optional().default({}),
});

export type PmcPreviousExtractDTO = z.infer<typeof PmcPreviousExtractSchema>;

export const PMC_EXTRACTION_SYSTEM_PROMPT = `Eres un auditor y especialista educativo experto en el Programa de Mejora Continua (PMC) de la Educación Media Superior en México (MCCEMS / NEM).
Tu objetivo es analizar textos extraídos de documentos previos del PMC (PDFs o archivos Word) y estructurar con precisión todos los datos encontrados.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildPmcExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente a un Programa de Mejora Continua (PMC) previo y extrae la información institucional, de personal, diagnóstica y académica.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "schoolName": "Nombre oficial del plantel o escuela (o cadena vacía si no se localiza)",
  "schoolCct": "Clave de Centro de Trabajo (10 caracteres alfanuméricos, ej. 21EBH0001A, o vacía)",
  "municipality": "Municipio donde se ubica el plantel (o vacía)",
  "locality": "Localidad o comunidad del plantel (o vacía)",
  "schoolZone": "Zona escolar a la que pertenece (ej. 013, o vacía)",
  "directorName": "Nombre completo del Director(a) (o vacía)",
  "supervisorName": "Nombre completo del Supervisor(a) escolar (o vacía)",
  "cicloEscolar": "Ciclo escolar del documento (ej. 2024-2025, 2025-2026, o vacía)",
  "subsystem": "Subsistema (ej. BGE, Bachillerato Tecnológico, TBC, etc., o 'BGE' por defecto)",
  "totalStaff": número entero con el total de personal reportado (o 1 por defecto),
  "staffData": [
    {
      "nombre": "Nombre del docente o directivo",
      "cargo": "Director(a) | Subdirector(a) | Docente de tiempo completo | Docente por horas | Administrativo | etc.",
      "meta_individual": "Meta o compromiso general si se especifica (texto libre)",
      "metas_individuales": [
        {
          "categoria": "Categoría a la que pertenece la meta (ej. Categoría 1, Categoría 2, Categoría 3)",
          "tema": "Tema específico (ej. Formación y actualización docente, Indicadores académicos)",
          "meta": "Meta individual específica para ese tema",
          "estrategia": "Estrategia o acciones para lograr la meta",
          "entregable": "Producto o evidencia de entrega",
          "periodo": "Periodo de ejecución"
        }
      ]
    }
  ],
  "diagnosticoComunidad": "Diagnóstico de la comunidad y del entorno escolar (descripción textual amplia, contexto social, económico y cultural)",
  "indicadores": {
    "matricula": número de alumnos inscritos (o null si no se especifica),
    "aprobacion_ant": porcentaje de aprobación previo (número 0-100 o null),
    "aprobacion_meta": porcentaje de aprobación proyectado como meta (número 0-100 o null),
    "reprobacion_ant": porcentaje de reprobación previo (número 0-100 o null),
    "reprobacion_meta": porcentaje de reprobación meta (número 0-100 o null),
    "abandono_ant": porcentaje de abandono o deserción previo (número 0-100 o null),
    "abandono_meta": porcentaje de abandono meta (número 0-100 o null),
    "et_ant": porcentaje de eficiencia terminal previo (número 0-100 o null),
    "et_meta": porcentaje de eficiencia terminal meta (número 0-100 o null)
  },
  "foda": {
    "fortalezas": "Fortalezas institucionales identificadas en el diagnóstico",
    "oportunidades": "Oportunidades del entorno exterior detectadas",
    "debilidades": "Debilidades internas de la escuela o comunidad escolar",
    "amenazas": "Amenazas o riesgos externos que impactan a la escuela"
  }
}

REGLAS DE EXTRACCIÓN:
1. Conserva la redacción textual del diagnóstico de la comunidad y del FODA tanto como sea posible.
2. Si el documento contiene tablas de indicadores académicos, extrae los porcentajes numéricos limpios (sin el símbolo %).
3. Si el documento contiene una lista de plantilla docente o personal, extrae cada miembro en el arreglo "staffData".
4. Si un docente tiene múltiples metas individuales en el PMC anterior (una por categoría o tema), extrae TODAS en el arreglo "metas_individuales", indicando la categoría y tema de cada una.
5. Si un dato no se encuentra explícitamente en el texto, asigna una cadena vacía "" o null según corresponda, sin inventar información no sustentada.`;
}
