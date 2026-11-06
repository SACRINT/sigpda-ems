/**
 * Resilience & Troubleshooting Agent
 * SIGPDA-EMS - SEMS Puebla MCCEMS 2026-2027
 *
 * Genera la matriz "Que hacer si falla?" a partir del adaptador disciplinar de
 * la UAC. No impone electronica, fisica ni taller a disciplinas ajenas.
 */

import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import type { CanonicalSeed, TroubleshootItem } from '@/types/work-textbook';
import { getDisciplinaryAdapter } from '@/lib/prompts/disciplinary-adapters';

export interface ResilienceInput {
  uacName: string;
  subsystem: 'bge' | 'bt';
  blockName: string;
  teacherId?: string;
  canonicalSeed?: CanonicalSeed;
  writerWarnings?: string[];
  sampleTopics?: string[];
  component?: string;
  curriculumName?: string;
  careerOrProgramName?: string;
}

export async function generateTroubleshootingMatrix(
  input: ResilienceInput
): Promise<TroubleshootItem[]> {
  const seedErrors = (input.canonicalSeed?.content?.commonErrors || []).map((err, i) => ({
    id: err.id || `tb-seed-${i + 1}`,
    symptom: err.symptom,
    cause: err.cause || err.rootCause || 'Procedimiento o criterio no verificado',
    solution: err.solution || (Array.isArray(err.solutionSteps) ? err.solutionSteps.join('. ') : 'Verificar procedimiento'),
    prevention: err.prevention || err.preventionTip || 'Revisar la guia y los criterios antes de operar',
    rootCause: err.rootCause || err.cause || 'Procedimiento o criterio no verificado',
    solutionSteps: Array.isArray(err.solutionSteps) ? err.solutionSteps : [err.solution || 'Verificar procedimiento'],
    preventionTip: err.preventionTip || err.prevention || 'Revisar la guia y los criterios antes de operar',
  }));

  if (seedErrors.length >= 5) {
    return seedErrors.slice(0, 8);
  }

  const discipline = getDisciplinaryAdapter(
    input.uacName,
    input.component,
    input.curriculumName || input.careerOrProgramName
  );
  const equipmentHint = discipline.allowedPhysicalEquipment.slice(0, 4).join(', ') || 'los recursos propios de la disciplina';
  const isBt = input.subsystem === 'bt';
  const focusDomain = isBt
    ? 'errores procedimentales, uso de instrumental, seguridad, tolerancias y normas tecnicas'
    : 'errores conceptuales, dificultades de analisis o calculo, fallas en la evidencia y sesgos de argumentacion';

  const warningsContext = input.writerWarnings && input.writerWarnings.length > 0
    ? `\nADVERTENCIAS DETECTADAS POR OTROS REDACTORES A MITIGAR:\n${input.writerWarnings.map((w) => `- ${w}`).join('\n')}`
    : '';

  const systemInstruction = `Eres un docente de Educacion Media Superior en Puebla (MCCEMS Puebla), especialista en ${discipline.displayName}.
Tu tarea es generar la "Zona de Depuracion: Que hacer si falla?" para el bloque formativo de la UAC: "${input.uacName}" (${input.subsystem.toUpperCase()}).

ENFOQUE FORMATIVO OBLIGATORIO:
Genera un arreglo de entre 5 y 8 casos reales de problemas y errores comunes que enfrentan los estudiantes (${focusDomain}). Usa como referencia el equipo o los recursos pertinentes: ${equipmentHint}.
${warningsContext}

Para cada problema debes proporcionar exactamente:
1. symptom: Descripcion concisa y exacta de lo que el alumno observa.
2. cause: Causa tecnica, conceptual o procedimental subyacente.
3. solution: Solucion paso a paso para que el alumno lo resuelva de forma autonoma.
4. prevention: Medida preventiva clara.

Devuelve EXCLUSIVAMENTE un arreglo JSON valido con este formato:
[
  {
    "symptom": "Descripcion del problema...",
    "cause": "Causa...",
    "solution": "Solucion paso a paso...",
    "prevention": "Medida de prevencion..."
  }
]`;

  const prompt = `UAC: ${input.uacName}
Subsistema: ${input.subsystem.toUpperCase()}
Bloque: ${input.blockName}
Temas del bloque: ${input.sampleTopics?.join(', ') || 'Contenidos formativos del bloque'}
Semillas tecnicas previas: ${seedErrors.map((s) => s.symptom).join('; ') || 'Ninguna'}

Genera los 5 a 8 casos mas relevantes de la matriz "Que hacer si falla?":`;

  try {
    const rawResponse = await generateWithRotation(systemInstruction, prompt, input.teacherId);
    const parsed = robustJsonParse(rawResponse);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const generatedItems: TroubleshootItem[] = parsed.map((item: unknown, idx: number) => {
        const record = (item || {}) as Record<string, unknown>;
        const rawCause = record.cause || record.rootCause;
        const rawSolution = record.solution;
        const rawPrevention = record.prevention || record.preventionTip;
        const rawSteps = record.solutionSteps;
        const cause = typeof rawCause === 'string' ? rawCause : 'Procedimiento o criterio no verificado';
        const solution =
          typeof rawSolution === 'string'
            ? rawSolution
            : Array.isArray(rawSteps)
              ? rawSteps.join('. ')
              : 'Verificar el procedimiento y reintentar';
        const prevention = typeof rawPrevention === 'string' ? rawPrevention : 'Realizar una revision previa antes de operar';

        const solutionSteps = Array.isArray(rawSteps)
          ? rawSteps.filter((step): step is string => typeof step === 'string')
          : solution.split(/\d+\.\s+/).map((s: string) => s.trim()).filter(Boolean);

        return {
          id: `tb-${input.subsystem}-${idx + 1}`,
          symptom: typeof record.symptom === 'string' ? record.symptom : 'Falla imprevista en el procedimiento',
          cause,
          solution,
          prevention,
          rootCause: cause,
          solutionSteps: solutionSteps.length > 0 ? solutionSteps : [solution],
          preventionTip: prevention,
        };
      });

      const merged = [...seedErrors, ...generatedItems];
      return merged.slice(0, 8);
    }
  } catch (err) {
    logger.error('[generateTroubleshootingMatrix] Error:', err);
  }

  return buildNeutralFallback(discipline.displayName, equipmentHint);
}

function buildNeutralFallback(disciplineName: string, equipmentHint: string): TroubleshootItem[] {
  return [
    {
      id: 'tb-neutral-1',
      symptom: 'El procedimiento no produce el resultado esperado o la evidencia queda incompleta',
      cause: 'Omision de un paso, uso de un recurso en mal estado o criterio de la disciplina no verificado.',
      solution: `1. Revisa la lista de pasos y recursos de la actividad. 2. Verifica el estado de ${equipmentHint}. 3. Repite el procedimiento siguiendo los criterios de ${disciplineName}.`,
      prevention: 'Revisa la guia, los recursos y los criterios antes de iniciar la actividad.',
      rootCause: 'Omision de un paso o recurso no verificado.',
      solutionSteps: [
        'Revisa la lista de pasos y recursos de la actividad.',
        'Verifica el estado y la preparacion de los recursos necesarios.',
        'Repite el procedimiento siguiendo los criterios de la disciplina.',
      ],
      preventionTip: 'Revisa la guia, los recursos y los criterios antes de iniciar la actividad.',
    },
    {
      id: 'tb-neutral-2',
      symptom: 'Los registros u observaciones no coinciden entre integrantes del equipo',
      cause: 'Criterios de registro heterogeneos, unidades distintas o redondeo prematuro de datos.',
      solution: '1. Acuerden una sola unidad y formato de registro. 2. Conserven los datos completos hasta el resultado final. 3. Comparen los registros antes de concluir.',
      prevention: 'Define el formato de registro y las unidades antes de comenzar la actividad.',
      rootCause: 'Criterios de registro y unidades no homologados.',
      solutionSteps: [
        'Acuerden una sola unidad y formato de registro.',
        'Conserven los datos completos hasta el resultado final.',
        'Comparen los registros antes de redactar conclusiones.',
      ],
      preventionTip: 'Define el formato de registro y las unidades antes de comenzar la actividad.',
    },
    {
      id: 'tb-neutral-3',
      symptom: 'El producto o evidencia no cumple los criterios de calidad acordados',
      cause: 'Falta de revision contra la lista de cotejo o entrega sin verificacion final.',
      solution: '1. Contrasta el producto con la lista de cotejo. 2. Corrige los aspectos faltantes. 3. Solicita una revision entre pares antes de entregar.',
      prevention: 'Usa la lista de cotejo como control final antes de cada entrega.',
      rootCause: 'Producto no verificado contra los criterios de calidad.',
      solutionSteps: [
        'Contrasta el producto con la lista de cotejo.',
        'Corrige los aspectos faltantes.',
        'Solicita una revision entre pares antes de entregar.',
      ],
      preventionTip: 'Usa la lista de cotejo como control final antes de cada entrega.',
    },
    {
      id: 'tb-neutral-4',
      symptom: 'Dificultad para explicar o aplicar el concepto central de la sesion',
      cause: 'El concepto se memorizo sin conectarlo con la analogia o con una situacion real.',
      solution: '1. Regresa al Concepto Cero de la guia. 2. Explica el concepto con tus propias palabras. 3. Aplicalo a un caso cercano de tu comunidad.',
      prevention: 'Relaciona cada concepto con un ejemplo real antes de resolver ejercicios.',
      rootCause: 'Concepto memorizado sin conexion significativa.',
      solutionSteps: [
        'Regresa al Concepto Cero de la guia.',
        'Explica el concepto con tus propias palabras.',
        'Aplicalo a un caso cercano de tu comunidad.',
      ],
      preventionTip: 'Relaciona cada concepto con un ejemplo real antes de resolver ejercicios.',
    },
    {
      id: 'tb-neutral-5',
      symptom: 'El equipo no logra llegar a un consenso sobre la conclusion',
      cause: 'Opiniones basadas en intuiciones personales y no en la evidencia recolectada.',
      solution: '1. Coloca la evidencia y los registros frente al equipo. 2. Contrasta cada afirmacion con los datos. 3. Acepta solo argumentos sustentados en la evidencia.',
      prevention: 'Nombra un relator que registre solo hechos, datos y acuerdos verificables.',
      rootCause: 'Conclusiones no sustentadas en la evidencia.',
      solutionSteps: [
        'Coloca la evidencia y los registros frente al equipo.',
        'Contrasta cada afirmacion con los datos.',
        'Redacta la conclusion con base en la evidencia registrada.',
      ],
      preventionTip: 'Nombra un relator que registre solo hechos, datos y acuerdos verificables.',
    },
  ];
}
