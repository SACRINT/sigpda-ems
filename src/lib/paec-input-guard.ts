// src/lib/paec-input-guard.ts
/**
 * paec-input-guard.ts — Guard Anti-Fabricación de Insumos para PAEC (H-314)
 * SIGPDA-EMS · Valida disponibilidad de datos comunitarios y escolares reales
 * antes de invocar a los modelos LLM, evitando la alucinación de datos ausentes.
 *
 * Contrato:
 * Si faltan datos indispensables (Paso 1 o Paso 8) y no se especificó allowPartialGeneration:
 * Retorna { needsInput: true, missingFields: string[], message: string }.
 */

export interface PaecMissingInputResult {
  needsInput: boolean;
  missingFields: string[];
  message: string;
}

export interface PaecStepInputOptions {
  allowPartialGeneration?: boolean;
}

export function validatePaecStepInputs(
  step: number,
  project: Record<string, unknown>,
  options?: PaecStepInputOptions
): PaecMissingInputResult {
  if (options?.allowPartialGeneration) {
    return { needsInput: false, missingFields: [], message: '' };
  }

  // Paso 1: Diagnóstico Comunitario y Escolar
  // Requiere al menos que exista el planteamiento del problema o datos contextuales comunitarios
  if (step === 1) {
    const missing: string[] = [];
    const problem = String(project.problem_statement || project.problemStatement || '').trim();
    const comm = (project.community_context || project.communityContext || {}) as Record<string, unknown>;
    const hasLocation = Boolean(String(comm.location || '').trim());
    const hasEnvironment = Boolean(String(comm.environment || '').trim());
    const hasDemographics = Boolean(String(comm.demographics || '').trim());
    const hasEconomy = Boolean(String(comm.economy || '').trim());
    const hasAnyComm = hasLocation || hasEnvironment || hasDemographics || hasEconomy;

    if (!problem) {
      missing.push('problemStatement');
    }
    if (!hasAnyComm) {
      missing.push('communityContext');
    }

    if (missing.length > 0) {
      return {
        needsInput: true,
        missingFields: missing,
        message: 'Para generar el Diagnóstico Colectivo oficial sin inventar datos, se requiere registrar el Planteamiento del Problema o al menos un aspecto del Contexto Comunitario (Ubicación, Demografía o Medio Ambiente).',
      };
    }
  }

  // Paso 8: Implementación y Gobernanza del Comité
  // El Criterio 1 del MCCEMS exige formalizar las figuras del Comité del Plantel
  if (step === 8) {
    const missing: string[] = [];
    const schoolCtx = (project.school_context || project.schoolContext || {}) as Record<string, unknown>;
    const comite = (schoolCtx.comite || project.comite || {}) as Record<string, unknown>;

    const hasDirectivo = Boolean(comite.directivo || comite.responsablePlantel || schoolCtx.directivo);
    const hasDocentes = Boolean(comite.docentes || schoolCtx.docentes);
    const hasEstudiantes = Boolean(comite.estudiantes || schoolCtx.estudiantes);
    const hasPadres = Boolean(comite.padres || comite.padresFamilia || schoolCtx.padresFamilia);

    const hasAnyComite = hasDirectivo || hasDocentes || hasEstudiantes || hasPadres;

    if (!hasAnyComite) {
      missing.push('comite.responsablePlantel', 'comite.docentes', 'comite.estudiantes', 'comite.padresFamilia');
      return {
        needsInput: true,
        missingFields: missing,
        message: 'El Criterio 1 del MCCEMS exige formalizar las figuras del Comité del Plantel (1 Responsable, 2 Docentes, 2 Estudiantes y 1 Padre de familia). Registre estas figuras o active la generación preliminar.',
      };
    }
  }

  return { needsInput: false, missingFields: [], message: '' };
}
