/**
 * src/lib/pmc/paec-diagnostic-fusion.ts
 *
 * Pure utility for merging PAEC community diagnostic text into PMC diagnostics.
 * Extracted from PmcWizardClient.tsx (H-160) to enable unit testing.
 *
 * Rules:
 * 1. If existing text already has a PAEC section, replace only the PAEC part.
 * 2. If existing text has no PAEC section, append with separator.
 * 3. If existing text is empty, use PAEC content directly.
 * 4. PMC diagnostic text always goes before the PAEC section.
 */

const PAEC_SEPARATOR = '--- Integrado desde PAEC ---';

/**
 * Merges PAEC community diagnostic fields into the existing diagnostic text.
 * @param existingDiagnostic - Current diagnostic text (may already contain PAEC section)
 * @param paecCombinedText - New PAEC content to integrate
 * @returns Merged diagnostic text
 */
export function mergePaecIntoDiagnostic(
  existingDiagnostic: string,
  paecCombinedText: string
): string {
  const prev = existingDiagnostic.trim();
  if (prev.includes(PAEC_SEPARATOR)) {
    const parts = prev.split(PAEC_SEPARATOR);
    return `${parts[0].trim()}\n\n${PAEC_SEPARATOR}\n${paecCombinedText}`;
  }
  return prev ? `${prev}\n\n${PAEC_SEPARATOR}\n${paecCombinedText}` : `${PAEC_SEPARATOR}\n${paecCombinedText}`;
}

/**
 * Preserves PAEC section when PMC diagnostic text is loaded/replaced.
 * @param newPmcDiagnostic - New PMC diagnostic text to set
 * @param existingDiagnostic - Current diagnostic text (may contain PAEC section)
 * @returns Merged text preserving PAEC section if present
 */
export function preservePaecOnPmcLoad(
  newPmcDiagnostic: string,
  existingDiagnostic: string
): string {
  const pmcDiag = newPmcDiagnostic.trim();
  if (existingDiagnostic.includes(PAEC_SEPARATOR)) {
    const paecPart = existingDiagnostic.slice(existingDiagnostic.indexOf(PAEC_SEPARATOR)).trim();
    return `${pmcDiag}\n\n${paecPart}`;
  }
  return pmcDiag;
}

/**
 * Filters and formats PAEC community context fields into diagnostic parts.
 * @param communityContext - PAEC community context object
 * @param projectData - PAEC project data object
 * @returns Array of non-empty formatted diagnostic lines
 */
export function buildPaecDiagnosticParts(
  communityContext: {
    context?: string | null;
    location?: string | null;
    problematics?: string | null;
    economicActivities?: string | null;
  },
  projectData: {
    projectName?: string | null;
    problemStatement?: string | null;
  }
): string[] {
  return [
    communityContext.context ? `[Contexto Comunitario PAEC]: ${communityContext.context}` : '',
    communityContext.location ? `[Entorno Geográfico]: ${communityContext.location}` : '',
    projectData.problemStatement ? `[Problemática Comunitaria Central - ${projectData.projectName || 'PAEC'}]: ${projectData.problemStatement}` : '',
    communityContext.problematics ? `[Problemáticas Detectadas]: ${communityContext.problematics}` : '',
    communityContext.economicActivities ? `[Actividades Económicas]: ${communityContext.economicActivities}` : '',
  ].filter(Boolean);
}

/**
 * Counts non-empty school/plantel fields extracted from PAEC (H-167).
 * Fields: schoolName, cct, directorName, supervisorName, schoolZone, municipality, locality.
 */
export function countPlantelFields(school?: {
  schoolName?: string | null;
  cct?: string | null;
  directorName?: string | null;
  supervisorName?: string | null;
  schoolZone?: string | null;
  municipality?: string | null;
  locality?: string | null;
} | null): number {
  if (!school) return 0;
  return [
    school.schoolName,
    school.cct,
    school.directorName,
    school.supervisorName,
    school.schoolZone,
    school.municipality,
    school.locality,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).length;
}

export interface PaecIngestionSummary {
  status: 'both' | 'plantel_only' | 'none';
  isSuccess: boolean;
  totalCount: number;
  communityCount: number;
  plantelCount: number;
  message: string;
}

/**
 * Generates accurate banner copy and status for PAEC ingestion (H-167).
 * Avoids misleading 0-count reports when plantel fields were extracted.
 */
export function getPaecIngestionSummary(
  communityCount: number,
  plantelCount: number
): PaecIngestionSummary {
  const totalCount = communityCount + plantelCount;
  if (communityCount > 0) {
    return {
      status: 'both',
      isSuccess: true,
      totalCount,
      communityCount,
      plantelCount,
      message: `✓ Documento PAEC procesado exitosamente: ${totalCount} campos extraídos (${communityCount} comunitarios + ${plantelCount} de plantel).`,
    };
  }
  if (plantelCount > 0) {
    return {
      status: 'plantel_only',
      isSuccess: true,
      totalCount,
      communityCount: 0,
      plantelCount,
      message: `✓ Documento PAEC procesado: ${plantelCount} campos de plantel extraídos (CCT, director, zona, etc.). No se encontraron campos comunitarios para el diagnóstico.`,
    };
  }
  return {
    status: 'none',
    isSuccess: false,
    totalCount: 0,
    communityCount: 0,
    plantelCount: 0,
    message: 'El documento PAEC fue analizado, pero no se extrajeron campos de plantel ni comunitarios. Revisa el contenido del archivo.',
  };
}

