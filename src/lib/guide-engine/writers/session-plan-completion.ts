import { generateWithRotation } from '@/lib/ai-provider';
import { robustJsonParse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';

interface MissingPlanParams {
  missionType: 'lab' | 'project';
  uacName: string;
  blockName?: string;
  subsystem: 'bge' | 'bt';
  coveredSessions: number[];
  missingSessions: number[];
  existingPlans: unknown[];
  teacherId?: string;
  signal?: AbortSignal;
}

function sessionNumberOf(plan: unknown): number | null {
  if (!plan || typeof plan !== 'object') return null;
  const value = (plan as Record<string, unknown>).sessionNumber;
  return typeof value === 'number' ? value : null;
}

export function getPresentSessionNumbers(plans: unknown[]): Set<number> {
  const present = new Set<number>();
  for (const plan of plans) {
    const sessionNumber = sessionNumberOf(plan);
    if (sessionNumber !== null) present.add(sessionNumber);
  }
  return present;
}

export function mergeSessionPlans(
  existing: unknown[],
  generated: unknown[],
  coveredSessions: number[]
): unknown[] {
  const bySession = new Map<number, unknown>();
  for (const plan of [...existing, ...generated]) {
    const sessionNumber = sessionNumberOf(plan);
    if (sessionNumber !== null) bySession.set(sessionNumber, plan);
  }
  return coveredSessions
    .map((sessionNumber) => bySession.get(sessionNumber))
    .filter((plan): plan is unknown => plan !== undefined);
}

export async function generateMissingSessionPlans(params: MissingPlanParams): Promise<unknown[]> {
  if (params.missingSessions.length === 0) return [];

  const missionLabel = params.missionType === 'lab' ? 'laboratorio/taller' : 'proyecto integrador';
  const examplePlan = params.existingPlans.length > 0 ? JSON.stringify(params.existingPlans[0], null, 2) : '{}';
  const systemInstruction = `Eres autor de libro de texto para Educación Media Superior (MCCEMS Puebla), en voz de estudiante (tú).
UAC: ${params.uacName}. Bloque: ${params.blockName || 'Bloque actual'}. Subsistema: ${params.subsystem.toUpperCase()}.
Debes completar los planes de sesión faltantes de una misión de ${missionLabel}.`;

  const userPrompt = `Sesiones ya cubiertas: ${params.coveredSessions.join(', ')}.
Sesiones faltantes: ${params.missingSessions.join(', ')}.

Genera EXACTAMENTE un plan por cada sesión faltante (${params.missingSessions.join(', ')}), sin omitir ninguna y sin duplicar las ya cubiertas. Cada plan debe conservar la misma estructura, campos y profundidad que este plan de ejemplo:
${examplePlan}

Requisitos por plan: contenido teórico real de al menos 440 palabras en 3 párrafos; ejemplo resuelto de al menos 300 palabras con 4 pasos numerados; práctica con enunciados, pistas y solución; aplicación, autoevaluación y recursos. No uses marcadores ni puntos suspensivos.
Devuelve EXCLUSIVAMENTE un objeto JSON válido con la forma {"sessionPlans": [ ... ]} que contenga únicamente las sesiones faltantes.`;

  const raw = await generateWithRotation(
    systemInstruction,
    userPrompt,
    params.teacherId,
    false,
    { jsonMode: true, maxTokens: 16384, timeoutMs: 85000, signal: params.signal }
  );
  const parsed = robustJsonParse(raw);
  const generated = Array.isArray(parsed.sessionPlans) ? parsed.sessionPlans : [];
  const allowed = new Set(params.missingSessions);
  const filtered = generated.filter((plan: unknown) => {
    const sessionNumber = sessionNumberOf(plan);
    return sessionNumber !== null && allowed.has(sessionNumber);
  });
  if (filtered.length < params.missingSessions.length) {
    logger.warn(
      `[SessionPlanCompletion] Respuesta incompleta: ${filtered.length}/${params.missingSessions.length} sesiones faltantes generadas.`
    );
  }
  return filtered;
}
