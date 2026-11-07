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
  remainingBudgetMs?: number;
}

const MISSING_PLAN_CHUNK_SIZE = 3;
const MISSING_PLAN_CHUNK_ATTEMPTS = 2;

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

function parseGeneratedPlans(raw: string, allowed: Set<number>): unknown[] {
  const parsed = robustJsonParse(raw);
  const candidate = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).sessionPlans)
      ? ((parsed as Record<string, unknown>).sessionPlans as unknown[])
      : [];
  return candidate.filter((plan: unknown) => {
    const sessionNumber = sessionNumberOf(plan);
    return sessionNumber !== null && allowed.has(sessionNumber);
  });
}

async function generateMissingChunk(
  params: MissingPlanParams,
  missingSessions: number[],
  existingPlans: unknown[]
): Promise<unknown[]> {
  const missionLabel = params.missionType === 'lab' ? 'laboratorio/taller' : 'proyecto integrador';
  const examplePlan = existingPlans.length > 0 ? JSON.stringify(existingPlans[0], null, 2) : '{}';
  const systemInstruction = `Eres autor de libro de texto para Educación Media Superior (MCCEMS Puebla), en voz de estudiante (tú).
UAC: ${params.uacName}. Bloque: ${params.blockName || 'Bloque actual'}. Subsistema: ${params.subsystem.toUpperCase()}.
Debes completar los planes de sesión faltantes de una misión de ${missionLabel}.`;

  const userPrompt = `Sesiones ya cubiertas: ${params.coveredSessions.join(', ')}.
Sesiones faltantes: ${missingSessions.join(', ')}.

Genera EXACTAMENTE un plan por cada sesión faltante (${missingSessions.join(', ')}), sin omitir ninguna y sin duplicar las ya cubiertas. Cada plan debe conservar la misma estructura, campos y profundidad que este plan de ejemplo:
${examplePlan}

Requisitos por plan: contenido teórico real de al menos 440 palabras en 3 párrafos; ejemplo resuelto de al menos 300 palabras con 4 pasos numerados; práctica con enunciados, pistas y solución; aplicación, autoevaluación y recursos. No uses marcadores ni puntos suspensivos.
Devuelve EXCLUSIVAMENTE un objeto JSON válido con la forma {"sessionPlans": [ ... ]} que contenga únicamente las sesiones faltantes.`;

  const raw = await generateWithRotation(
    systemInstruction,
    userPrompt,
    params.teacherId,
    false,
    {
      jsonMode: true,
      maxTokens: 16384,
      timeoutMs: 85000,
      remainingBudgetMs: params.remainingBudgetMs,
      signal: params.signal,
    }
  );
  return parseGeneratedPlans(raw, new Set(missingSessions));
}

export async function generateMissingSessionPlans(params: MissingPlanParams): Promise<unknown[]> {
  if (params.missingSessions.length === 0) return [];

  const collected: unknown[] = [];
  for (let i = 0; i < params.missingSessions.length; i += MISSING_PLAN_CHUNK_SIZE) {
    const chunk = params.missingSessions.slice(i, i + MISSING_PLAN_CHUNK_SIZE);
    let remaining = [...chunk];

    for (let attempt = 1; attempt <= MISSING_PLAN_CHUNK_ATTEMPTS && remaining.length > 0; attempt++) {
      try {
        const generated = await generateMissingChunk(
          params,
          remaining,
          [...params.existingPlans, ...collected]
        );
        collected.push(...generated);
        const present = getPresentSessionNumbers(collected);
        remaining = remaining.filter((sessionNumber) => !present.has(sessionNumber));
        if (remaining.length > 0) {
          logger.warn(
            `[SessionPlanCompletion] Lote ${chunk.join(', ')} incompleto en intento ${attempt}: faltan ${remaining.join(', ')}.`
          );
        }
      } catch (err) {
        logger.warn(`[SessionPlanCompletion] Falló el lote ${remaining.join(', ')}:`, { error: String(err) });
      }
    }

    if (remaining.length > 0) {
      logger.warn(
        `[SessionPlanCompletion] No se generaron las sesiones ${remaining.join(', ')} tras ${MISSING_PLAN_CHUNK_ATTEMPTS} intentos.`
      );
    }
  }

  return mergeSessionPlans(params.existingPlans, collected, params.missingSessions);
}
