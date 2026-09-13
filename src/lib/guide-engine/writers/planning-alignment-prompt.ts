/**
 * planning-alignment-prompt.ts — Generador unificado de contexto de alineación
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Centraliza las directivas de alineación curricular para los 4 writers modulares,
 * reduciendo tokens duplicados y garantizando coherencia pedagógica.
 */

import type { PlanningActivities } from './writer-contract';

export type WriterRoleFocus = 'foundation' | 'lab' | 'project' | 'evaluation';

/**
 * Genera el bloque textual de alineación curricular para inyectar en el prompt del writer.
 */
export function buildPlanningAlignmentPrompt(
  pa?: PlanningActivities,
  focus: WriterRoleFocus = 'foundation'
): string {
  if (!pa) return '';

  let specificRule = '';
  switch (focus) {
    case 'foundation':
      specificRule = 'REGLA DE ALINEACIÓN: El Concepto Cero DEBE conectar con la apertura planificada. El "Yo Hago" DEBE implementar las actividades de desarrollo planificadas. El "Tú Haces" DEBE evaluar los saberes planificados.';
      break;
    case 'lab':
      specificRule = 'REGLA DE ALINEACIÓN: El procedimiento del laboratorio DEBE implementar las actividades de desarrollo/ejecución planificadas. El objetivo DEBE estar vinculado con los saberes planificados y los materiales a los insumos previstos.';
      break;
    case 'project':
      specificRule = 'REGLA DE ALINEACIÓN: Las fases del proyecto DEBEN implementar las actividades de desarrollo/ejecución planificadas. Los criterios de aceptación DEBEN evaluar los saberes planificados y responder al problema PAEC.';
      break;
    case 'evaluation':
      specificRule = 'REGLA DE ALINEACIÓN: La rúbrica DEBE evaluar los saberes planificados. La lista de cotejo DEBE verificar las actividades de desarrollo planificadas. Los escenarios del cuestionario DEBEN situarse en el problema PAEC.';
      break;
  }

  return `
ALINEACIÓN OBLIGATORIA CON LA PLANEACIÓN DIDÁCTICA:
- APERTURA: ${pa.apertura.description || 'No especificada'} | Procesos: ${pa.apertura.processes || 'N/A'} | Materiales: ${pa.apertura.materials || 'N/A'}
- DESARROLLO: ${pa.ejecucion.description || 'No especificado'} | Procesos: ${pa.ejecucion.processes || 'N/A'} | Materiales: ${pa.ejecucion.materials || 'N/A'}
- CIERRE: ${pa.conclusion.description || 'No especificado'} | Procesos: ${pa.conclusion.processes || 'N/A'} | Materiales: ${pa.conclusion.materials || 'N/A'}
${pa.saberes ? `- SABERES: [Teórico]: ${pa.saberes.saber} | [Procedimental]: ${pa.saberes.saberHacer} | [Actitudinal]: ${pa.saberes.saberSer}` : ''}
${pa.contenidoFormativo ? `- CONTENIDO FORMATIVO: ${pa.contenidoFormativo}` : ''}
${pa.methodology ? `- METODOLOGÍA: ${pa.methodology}` : ''}
${specificRule} NO generes actividades ajenas a la planeación.
`;
}
