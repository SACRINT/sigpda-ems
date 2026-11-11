/**
 * planning-alignment-prompt.ts — Generador unificado de contexto de alineación
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Centraliza las directivas de alineación curricular para los 4 writers modulares,
 * reduciendo tokens duplicados y garantizando coherencia pedagógica.
 */

import type { PlanningActivities } from './writer-contract';
import { buildDisciplinaryPromptBlock, getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';
import { formatCuratedResourcesForPrompt } from '@/lib/resources/curated-resources';

export type WriterRoleFocus = 'foundation' | 'lab' | 'project' | 'evaluation';

/**
 * Genera el bloque textual de alineación curricular y disciplinar para inyectar en el prompt del writer.
 */
export function buildPlanningAlignmentPrompt(
  pa?: PlanningActivities,
  focus: WriterRoleFocus = 'foundation',
  uacName: string = '',
  component: string = '',
  curriculumName: string = '',
  careerOrProgramName: string = ''
): string {
  const disciplinaryBlock = uacName
    ? buildDisciplinaryPromptBlock(uacName, component, curriculumName || careerOrProgramName)
    : '';
  const adapter = uacName
    ? getDisciplinaryAdapter(uacName, component, curriculumName || careerOrProgramName)
    : null;
  const curatedBlock = formatCuratedResourcesForPrompt(adapter?.id ?? 'general', 8);
  const urlGuardrail = `
REGLA DE ENLACES EDUCATIVOS CURADOS (CERO 404 Y CERO BÚSQUEDAS GENÉRICAS):
- En el arreglo "recursos" de cada "sessionPlans" usa enlaces DIRECTOS y verificables.
- PROHIBIDO usar google.com/search, youtube.com/results, bing, duckduckgo o similares como recurso didáctico.
- NUNCA inventes IDs de video ("watch?v=...") que no puedas verificar; si no conoces un enlace directo, usa la raíz de una institución de la biblioteca curada.
- Prioriza simuladores y repositorios institucionales sobre videos genéricos.
${curatedBlock}`;

  if (!pa) return `${disciplinaryBlock}${urlGuardrail}`;

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

  return `${disciplinaryBlock}${urlGuardrail}
ALINEACIÓN OBLIGATORIA CON LA PLANEACIÓN DIDÁCTICA:
- APERTURA: ${pa.apertura.description || 'No especificada'} | Procesos: ${pa.apertura.processes || 'N/A'} | Materiales: ${pa.apertura.materials || 'N/A'}
- DESARROLLO: ${pa.ejecucion.description || 'No especificado'} | Procesos: ${pa.ejecucion.processes || 'N/A'} | Materiales: ${pa.ejecucion.materials || 'N/A'}
- CIERRE: ${pa.conclusion.description || 'No especificado'} | Procesos: ${pa.conclusion.processes || 'N/A'} | Materiales: ${pa.conclusion.materials || 'N/A'}
${pa.saberes ? `- SABERES: [Teórico]: ${pa.saberes.saber} | [Procedimental]: ${pa.saberes.saberHacer} | [Actitudinal]: ${pa.saberes.saberSer}` : ''}
${pa.contenidoFormativo ? `- CONTENIDO FORMATIVO: ${pa.contenidoFormativo}` : ''}
${pa.methodology ? `- METODOLOGÍA: ${pa.methodology}` : ''}
${specificRule} NO generes actividades ni materiales ajenos a la planeación o a la disciplina.
`;
}
