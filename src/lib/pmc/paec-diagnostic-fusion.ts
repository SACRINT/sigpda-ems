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
