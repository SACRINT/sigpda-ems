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
  schoolType: z.enum(['general', 'tecnico', 'telebachillerato']).catch('general'),
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
    demographics: nullableString(),
    problematics: nullableString(),
    economy: nullableString(),
    economicActivities: nullableString(),
    traditions: nullableString(),
    culturalAspects: nullableString(),
    security: nullableString(),
    environment: nullableString(),
  }).partial().optional().default({}),
  selectedLaboral: z.array(z.string()).optional().default([]),
  selectedFfe: z.array(z.string()).optional().default([]),
  foda: z.object({
    fortalezas: nullableString(),
    oportunidades: nullableString(),
    debilidades: nullableString(),
    amenazas: nullableString(),
  }).partial().optional().default({}),
});

export type PaecPreviousExtractDTO = z.infer<typeof PaecPreviousExtractSchema>;

export interface MappedCommunityState {
  location?: string;
  demographics?: string;
  economy?: string;
  traditions?: string;
  security?: string;
  environment?: string;
}

/**
 * Mapea las claves extraídas del PAEC anterior al estado del formulario de la comunidad,
 * resolviendo aliases como context -> demographics, economicActivities -> economy y culturalAspects -> traditions.
 */
export function mapParsedCommunityToState(
  extracted: PaecPreviousExtractDTO['community'] | undefined,
  current: MappedCommunityState
): MappedCommunityState {
  if (!extracted) return current;
  return {
    location: extracted.location?.trim() || current.location || '',
    demographics: extracted.demographics?.trim() || extracted.context?.trim() || current.demographics || '',
    economy: extracted.economy?.trim() || extracted.economicActivities?.trim() || current.economy || '',
    traditions: extracted.traditions?.trim() || extracted.culturalAspects?.trim() || current.traditions || '',
    environment: extracted.environment?.trim() || current.environment || '',
    security: extracted.security?.trim() || current.security || '',
  };
}

/**
 * Identifica los campos obligatorios del Paso 1 (isStep1Valid) que quedan sin completar
 */
export function getMissingStep1Fields(params: {
  projectName?: string | null;
  problemStatement?: string | null;
  community: MappedCommunityState;
  school: { enrollment?: string | null; teacherCount?: string | null };
  curricular?: {
    hasLaboralSemesters?: boolean;
    selectedLaboralCount?: number;
    hasFfeSemesters?: boolean;
    selectedFfeCount?: number;
    isTecnico?: boolean;
    selectedBtCarrerasCount?: number;
  };
}): string[] {
  const missing: string[] = [];
  if (!params.projectName?.trim()) missing.push('Nombre del Proyecto');
  if (!params.problemStatement?.trim()) missing.push('Problemática Central');
  if (!params.community.location?.trim()) missing.push('Ubicación Geográfica');
  if (!params.community.demographics?.trim()) missing.push('Situación Demográfica');
  if (!params.community.economy?.trim()) missing.push('Actividades Socioeconómicas');
  if (!params.school.enrollment?.trim()) missing.push('Matrícula Estudiantil');
  if (!params.school.teacherCount?.trim()) missing.push('Plantilla Docente');
  if (params.curricular?.hasLaboralSemesters && (params.curricular.selectedLaboralCount ?? 0) === 0) {
    missing.push('Capacitación Laboral (Formación para el Trabajo)');
  }
  if (params.curricular?.hasFfeSemesters && (params.curricular.selectedFfeCount ?? 0) === 0) {
    missing.push('Formación Fundamental Extendida (FFE)');
  }
  if (params.curricular?.isTecnico && (params.curricular.selectedBtCarrerasCount ?? 0) === 0) {
    missing.push('Carrera Técnica BT');
  }
  return missing;
}

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
  "schoolType": "general | tecnico | telebachillerato",
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
  ],
  "foda": {
    "fortalezas": "Fortalezas institucionales o docentes identificadas en el análisis FODA del PAEC (o \"\")",
    "oportunidades": "Oportunidades del entorno o vinculación identificadas en el FODA (o \"\")",
    "debilidades": "Debilidades, carencias o rezagos internos identificados en el FODA (o \"\")",
    "amenazas": "Amenazas, riesgos contextuales o comunitarios identificados en el FODA (o \"\")"
  }
}

REGLAS DE EXTRACCIÓN:
1. Extrae el nombre del proyecto y la problemática de forma íntegra y fidedigna al texto.
2. Si se mencionan datos del plantel (CCT, Director, Zona, Municipio), asígnalos en el objeto "school".
3. Si el texto detalla el diagnóstico comunitario o el contexto territorial, sintetiza con fidelidad en el objeto "community".
4. Si un dato no se encuentra en el texto, coloca una cadena vacía "" o arreglo vacío []. NUNCA uses null ni omitas claves.`;
}
