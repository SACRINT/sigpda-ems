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
    enrollment: nullableString(),
    teacherCount: nullableString(),
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
  const isTruncated = documentText.length > 75000;
  const truncationNotice = isTruncated
    ? `\n[AVISO DE CAPACIDAD DOCUMENTAL: El texto excede la ventana de análisis individual (longitud: ${documentText.length.toLocaleString('es-MX')} caracteres). Se procesan los primeros 75,000 caracteres prioritarios que abarcan portada, diagnóstico comunitario y mapa curricular principal.]\n`
    : '';

  return `Analiza con minuciosidad el siguiente documento correspondiente a un Proyecto Aula Escuela Comunidad (PAEC) previo y extrae la información general, comunitaria, institucional y curricular.${truncationNotice}

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
    "supervisorName": "Nombre del Supervisor(a) escolar",
    "enrollment": "Matrícula total de estudiantes si se menciona (ej. '168 estudiantes')",
    "teacherCount": "Número total de docentes del plantel si se menciona (ej. '12 docentes')"
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

/**
 * Genera el prompt para extraer información de un fragmento o bloque documental de PAEC (H-13).
 * Sigue el patrón canónico de chunking estructurado empleado en PMC.
 */
export function buildPaecChunkExtractionPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number
): string {
  return `Analiza el siguiente fragmento (${chunkIndex + 1} de ${totalChunks}) correspondiente a un Proyecto Aula Escuela Comunidad (PAEC) previo y extrae la información general, comunitaria, institucional y curricular presente en este segmento.

TEXTO DEL FRAGMENTO (${chunkIndex + 1}/${totalChunks}):
"""
${chunkText.slice(0, 75000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "projectName": "Nombre o título oficial del Proyecto Aula Escuela Comunidad si se menciona en este fragmento",
  "problemStatement": "Descripción o planteamiento central de la problemática socioeducativa o comunitaria atendida",
  "cycleType": "A | B | annual (según el semestre o ciclo)",
  "schoolType": "general | tecnico | telebachillerato",
  "school": {
    "schoolName": "Nombre oficial del plantel o bachillerato",
    "cct": "Clave de Centro de Trabajo (ej. 21EBH0001A)",
    "municipality": "Municipio donde se ubica",
    "locality": "Localidad o comunidad",
    "schoolZone": "Zona escolar (ej. 013)",
    "directorName": "Nombre del Director(a)",
    "supervisorName": "Nombre del Supervisor(a) escolar",
    "enrollment": "Matrícula estudiantil si se menciona",
    "teacherCount": "Plantilla docente si se menciona"
  },
  "community": {
    "context": "Contexto territorial, geográfico y demográfico de la comunidad",
    "location": "Ubicación geográfica o entorno de la comunidad",
    "problematics": "Principales problemáticas comunitarias observadas o analizadas",
    "economicActivities": "Actividades económicas predominantes de la comunidad",
    "culturalAspects": "Aspectos socioculturales, tradiciones o patrimonio local"
  },
  "selectedLaboral": [
    "Nombres de las capacitaciones o formaciones laborales detectadas en este fragmento"
  ],
  "selectedFfe": [
    "Nombres de las asignaturas de Formación Fundamental Extendida detectadas en este fragmento"
  ],
  "foda": {
    "fortalezas": "Fortalezas institucionales identificadas en el FODA",
    "oportunidades": "Oportunidades del entorno identificadas en el FODA",
    "debilidades": "Debilidades o carencias internas identificadas en el FODA",
    "amenazas": "Riesgos del entorno identificados en el FODA"
  }
}

REGLAS DE EXTRACCIÓN:
1. Extrae únicamente los datos verificables en este fragmento.
2. Si un dato no se encuentra en el fragmento, coloca cadena vacía "" o arreglo vacío [].
3. Responde estrictamente con JSON válido.`;
}

/**
 * Divide un texto extenso de PAEC en fragmentos balanceados respetando saltos de párrafo (H-13).
 */
export function partitionPaecDocument(documentText: string, maxChunkSize = 65000): string[] {
  if (documentText.length <= maxChunkSize) {
    return [documentText];
  }

  const chunks: string[] = [];
  let startIndex = 0;
  const overlap = 3000;

  while (startIndex < documentText.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex >= documentText.length) {
      chunks.push(documentText.slice(startIndex));
      break;
    }

    // Buscar el salto de párrafo más cercano antes del límite
    const nextNewline = documentText.lastIndexOf('\n\n', endIndex);
    if (nextNewline > startIndex + 20000) {
      endIndex = nextNewline;
    }

    chunks.push(documentText.slice(startIndex, endIndex));
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return chunks;
}

/**
 * Fusiona de forma aditiva y determinista dos extracciones de PAEC procedentes de fragmentos distintos (H-13).
 */
export function mergePaecExtracts(
  base: PaecPreviousExtractDTO,
  addition: Partial<PaecPreviousExtractDTO>
): PaecPreviousExtractDTO {
  const mergedLaboral = Array.from(
    new Set([...(base.selectedLaboral || []), ...(addition.selectedLaboral || [])].map(s => s.trim()).filter(Boolean))
  );

  const mergedFfe = Array.from(
    new Set([...(base.selectedFfe || []), ...(addition.selectedFfe || [])].map(s => s.trim()).filter(Boolean))
  );

  const mergeText = (t1?: string | null, t2?: string | null, separator = '\n\n') => {
    const p1 = (t1 || '').trim();
    const p2 = (t2 || '').trim();
    if (!p1) return p2;
    if (!p2 || p1.includes(p2)) return p1;
    if (p2.includes(p1)) return p2;
    return `${p1}${separator}${p2}`;
  };

  return {
    projectName: base.projectName?.trim() || addition.projectName?.trim() || '',
    problemStatement: mergeText(base.problemStatement, addition.problemStatement),
    cycleType: base.cycleType || addition.cycleType || 'annual',
    schoolType: base.schoolType || addition.schoolType || 'general',
    school: {
      schoolName: base.school?.schoolName || addition.school?.schoolName || '',
      cct: base.school?.cct || addition.school?.cct || '',
      municipality: base.school?.municipality || addition.school?.municipality || '',
      locality: base.school?.locality || addition.school?.locality || '',
      schoolZone: base.school?.schoolZone || addition.school?.schoolZone || '',
      directorName: base.school?.directorName || addition.school?.directorName || '',
      supervisorName: base.school?.supervisorName || addition.school?.supervisorName || '',
      enrollment: base.school?.enrollment || addition.school?.enrollment || '',
      teacherCount: base.school?.teacherCount || addition.school?.teacherCount || '',
    },
    community: {
      context: mergeText(base.community?.context, addition.community?.context),
      location: base.community?.location || addition.community?.location || '',
      demographics: mergeText(base.community?.demographics, addition.community?.demographics),
      problematics: mergeText(base.community?.problematics, addition.community?.problematics),
      economy: base.community?.economy || addition.community?.economy || '',
      economicActivities: base.community?.economicActivities || addition.community?.economicActivities || '',
      traditions: base.community?.traditions || addition.community?.traditions || '',
      culturalAspects: base.community?.culturalAspects || addition.community?.culturalAspects || '',
      security: base.community?.security || addition.community?.security || '',
      environment: base.community?.environment || addition.community?.environment || '',
    },
    selectedLaboral: mergedLaboral,
    selectedFfe: mergedFfe,
    foda: {
      fortalezas: mergeText(base.foda?.fortalezas, addition.foda?.fortalezas, '; '),
      oportunidades: mergeText(base.foda?.oportunidades, addition.foda?.oportunidades, '; '),
      debilidades: mergeText(base.foda?.debilidades, addition.foda?.debilidades, '; '),
      amenazas: mergeText(base.foda?.amenazas, addition.foda?.amenazas, '; '),
    },
  };
}
