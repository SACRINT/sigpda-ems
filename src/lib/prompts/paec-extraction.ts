import { z } from 'zod';
import { nullableString } from './zod-helpers';

/**
 * Specialized prompts and schemas for extracting structured PAEC data from previous documents (PDF / Word DOCX).
 * Aligned with MCCEMS and New School Model (NEM) guidelines.
 */

export const PaecPreviousExtractSchema = z.object({
  projectName: nullableString(),
  problemStatement: nullableString(),
  cycleType: z.enum(['A', 'B', 'annual']).catch('A'),
  schoolType: z.enum(['general', 'tecnico', 'telesecundaria', 'indigena']).catch('general'),
  school: z.object({
    schoolName: nullableString(),
    cct: nullableString(),
    municipality: nullableString(),
    locality: nullableString(),
    schoolZone: nullableString(),
    directorName: nullableString(),
    supervisorName: nullableString(),
  }).partial().optional().default({}),
  community: z.object({
    context: nullableString(),
    location: nullableString(),
    problematics: nullableString(),
    economicActivities: nullableString(),
    culturalAspects: nullableString(),
  }).partial().optional().default({}),
  selectedLaboral: z.array(z.string()).optional().default([]),
  selectedFfe: z.array(z.string()).optional().default([]),
});

export type PaecPreviousExtractDTO = z.infer<typeof PaecPreviousExtractSchema>;

export const PAEC_EXTRACTION_SYSTEM_PROMPT = `Eres un auditor y especialista educativo experto en el Proyecto Aula Escuela Comunidad (PAEC) de la Educación Media Superior en México (MCCEMS / NEM).
Tu objetivo es analizar textos extraídos de documentos previos del PAEC (PDFs o archivos Word) y estructurar con precisión todos los datos encontrados.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildPaecExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente a un Proyecto Aula Escuela Comunidad (PAEC) previo y extrae la información general, comunitaria, institucional y curricular.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "projectName": "Nombre o título oficial del Proyecto Aula Escuela Comunidad",
  "problemStatement": "Descripción o planteamiento central de la problemática socioeducativa o comunitaria atendida",
  "cycleType": "A | B | annual (según el semestre o ciclo: 'A' para semestres impares 1,3,5; 'B' para pares 2,4,6; 'annual' si abarca ambos)",
  "schoolType": "general | tecnico | telesecundaria | indigena",
  "school": {
    "schoolName": "Nombre oficial del plantel o bachillerato",
    "cct": "Clave de Centro de Trabajo (ej. 21EBH0001A)",
    "municipality": "Municipio donde se ubica",
    "locality": "Localidad o comunidad",
    "schoolZone": "Zona escolar (ej. 013)",
    "directorName": "Nombre del Director(a)",
    "supervisorName": "Nombre del Supervisor(a) escolar"
  },
  "community": {
    "context": "Contexto territorial, geográfico y demográfico de la comunidad donde se inserta el plantel",
    "location": "Ubicación geográfica o entorno de la comunidad",
    "problematics": "Principales problemáticas comunitarias observadas o analizadas",
    "economicActivities": "Actividades económicas predominantes de la comunidad",
    "culturalAspects": "Aspectos socioculturales, tradiciones o patrimonio local"
  },
  "selectedLaboral": [
    "Nombres de las capacitaciones o formaciones laborales detectadas (ej. Administración, Contabilidad, Higiene y Salud Comunitaria, etc.)"
  ],
  "selectedFfe": [
    "Nombres de las asignaturas de Formación Fundamental Extendida detectadas si las hay"
  ]
}

REGLAS DE EXTRACCIÓN:
1. Extrae el nombre del proyecto y la problemática de forma íntegra y fidedigna al texto.
2. Si se mencionan datos del plantel (CCT, Director, Zona, Municipio), asígnalos en el objeto "school".
3. Si el texto detalla el diagnóstico comunitario o el contexto territorial, sintetiza con fidelidad en el objeto "community".
4. Si un dato no se encuentra en el texto, coloca una cadena vacía "" o arreglo vacío []. NUNCA uses null ni omitas claves.`;
}
