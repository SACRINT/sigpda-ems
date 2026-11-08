import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerate = vi.fn();
vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: (...args: unknown[]) => mockGenerate(...args),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  shardSessions,
  evaluateSessionPlanDensity,
  densityThresholdsFor,
  generateShardedSessionPlans,
  distributeTermsAcrossPacks,
  sessionPlanWordTarget,
  SESSION_PACK_MAX_TOKENS,
  type SessionShardContext,
} from '@/lib/guide-engine/writers/session-shard';
import { createWriterScheduler } from '@/lib/guide-engine/writer-scheduler';
import { IncompleteSessionPlansError } from '@/lib/guide-engine/writers/writer-contract';
import type { WriterInput } from '@/lib/guide-engine/writers/writer-contract';

const words = (n: number, w = 'palabra') => Array.from({ length: n }, () => w).join(' ');
const para = (n: number) => `${words(n)}.`;

function goodPlan(n: number, over: Record<string, unknown> = {}) {
  return {
    sessionNumber: n,
    objetivo: `Lo que vas a aprender en la sesión ${n} sobre el tema`,
    motivacion: words(90),
    saberesPrevios: words(60),
    contenido: [para(160), para(160), para(160)].join('\n\n'),
    ejemploResuelto: `Planteamiento: ${words(60)}\nPaso 1: ${words(70)}\nPaso 2: ${words(70)}\nPaso 3: ${words(70)}\nPaso 4: ${words(70)}`,
    practica: [
      { enunciado: words(70), pista: words(35), solucion: ['Paso 1: x', 'Paso 2: y', 'Respuesta final: z'] },
      { enunciado: words(70), pista: words(35), solucion: ['Paso 1: x', 'Respuesta final: z'] },
    ],
    aplicacion: words(90),
    autoevaluacion: ['¿Puedo explicar el concepto central?', '¿Logré la práctica sin mirar?'],
    recursos: [{ titulo: 'Video educativo', url: 'https://www.youtube.com/results?search_query=x', tipo: 'video' }],
    productoIntegrador: words(70),
    ...over,
  };
}

const requested = (userPrompt: string): number[] => {
  const m = /exactamente \d+: ([\d, ]+)\)/.exec(userPrompt);
  return m ? m[1].split(',').map((s) => parseInt(s.trim(), 10)) : [];
};

const respond = (plans: unknown[]) => JSON.stringify({ sessionPlans: plans });

function makeCtx(sessions: number[], extra: Partial<SessionShardContext> = {}): SessionShardContext {
  const input = {
    planning: { teacherId: 't1', semester: 3 },
    blockIndex: 0,
    blockName: 'Bloque X',
    sessions: sessions.map((n) => ({ sessionNum: n, phase: 'Desarrollo', title: `Tema ${n}`, focus: `Foco ${n}` })),
    missions: [],
    paecContext: 'Problema PAEC',
    studentProfile: 'Perfil',
    subsystem: 'bge',
    uacName: 'Asignatura de prueba',
    targetWords: { min: 8000, ideal: 9000, max: 10000 },
    planningActivities: undefined,
    scheduler: createWriterScheduler({
      maxConcurrency: 4,
      jitterMs: 0,
      breaker: { threshold: 3, baseCooldownMs: 1, maxCooldownMs: 5 },
    }),
  } as unknown as WriterInput;
  return {
    input,
    missionType: 'lab',
    missionTitle: 'Misión de prueba',
    coveredSessions: sessions,
    disciplineName: 'Disciplina X',
    fallbackContext: { uacName: 'Asignatura de prueba' },
    targetWordsPerPlan: 900,
    ...extra,
  };
}

beforeEach(() => {
  mockGenerate.mockReset();
});

describe('shardSessions', () => {
  it.each([
    [8, [3, 3, 2]],
    [4, [2, 2]],
    [6, [3, 3]],
    [5, [3, 2]],
    [3, [3]],
    [1, [1]],
    [12, [3, 3, 3, 3]],
  ])('reparte %i sesiones en paquetes equilibrados', (n, sizes) => {
    const sessions = Array.from({ length: n }, (_, i) => i + 1);
    const packs = shardSessions(sessions, 3);
    expect(packs.map((p) => p.length)).toEqual(sizes);
    expect(packs.flat()).toEqual(sessions);
  });

  it('lista vacía → sin paquetes; packSize inválido se acota a 1', () => {
    expect(shardSessions([])).toEqual([]);
    expect(shardSessions([1, 2], 0)).toEqual([[1], [2]]);
  });

  it('distributeTermsAcrossPacks cubre todos los términos (round-robin)', () => {
    const shares = distributeTermsAcrossPacks(['a', 'b', 'c', 'd', 'e'], 3);
    expect(shares.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(shares.map((s) => s.length)).toEqual([2, 2, 1]);
  });

  it('sessionPlanWordTarget conserva el piso de 900 y escala con el presupuesto', () => {
    expect(sessionPlanWordTarget(4000, 4)).toBe(900);
    expect(sessionPlanWordTarget(20000, 8)).toBeGreaterThan(900);
  });
});

describe('evaluateSessionPlanDensity', () => {
  const t = densityThresholdsFor(900);
  const sanitized = (plan: Record<string, unknown>) =>
    // los campos ya vienen con forma de SessionPlan
    plan as unknown as Parameters<typeof evaluateSessionPlanDensity>[0];

  it('acepta un plan completo', () => {
    expect(evaluateSessionPlanDensity(sanitized(goodPlan(1)), t).ok).toBe(true);
  });

  it('detecta contenido corto, pocos párrafos, pocos pasos y práctica incompleta', () => {
    const bad = goodPlan(1, {
      contenido: para(100),
      ejemploResuelto: `Planteamiento ${words(40)}`,
      practica: [{ enunciado: 'corto', pista: 'x' }],
    });
    const r = evaluateSessionPlanDensity(sanitized(bad), t);
    expect(r.ok).toBe(false);
    expect(r.deficits.join(' ')).toMatch(/contenido tiene \d+ palabras/);
    expect(r.deficits.join(' ')).toMatch(/párrafos/);
    expect(r.deficits.join(' ')).toMatch(/pasos numerados/);
    expect(r.deficits.join(' ')).toMatch(/ejercicios completos/);
  });
});

describe('generateShardedSessionPlans', () => {
  it('8 sesiones → 3 llamadas pequeñas (paquetes 3+3+2), cada una por debajo del tope de tokens', async () => {
    mockGenerate.mockImplementation(async (_s: string, user: string) => respond(requested(user).map((n) => goodPlan(n))));
    const ctx = makeCtx([3, 4, 5, 6, 7, 8, 9, 10]);
    const { plans, diagnostics } = await generateShardedSessionPlans(ctx);
    expect(plans.map((p) => p.sessionNumber)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    expect(diagnostics.packs.map((p) => p.length)).toEqual([3, 3, 2]);
    for (const call of mockGenerate.mock.calls) {
      expect(call[4].maxTokens).toBe(SESSION_PACK_MAX_TOKENS);
      expect(call[4].jsonMode).toBe(true);
    }
  });

  it('cada llamada pide únicamente las sesiones de su paquete', async () => {
    mockGenerate.mockImplementation(async (_s: string, user: string) => respond(requested(user).map((n) => goodPlan(n))));
    await generateShardedSessionPlans(makeCtx([1, 2, 3, 4]));
    const asked = mockGenerate.mock.calls.map((c) => requested(c[2 - 1 + 0 + 0] ?? c[1]));
    expect(asked.flat().sort()).toEqual([1, 2, 3, 4]);
    expect(asked.every((a) => a.length === 2)).toBe(true);
  });

  it('respeta la concurrencia del scheduler (nunca más de N llamadas simultáneas)', async () => {
    let active = 0;
    let peak = 0;
    mockGenerate.mockImplementation(async (_s: string, user: string) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return respond(requested(user).map((n) => goodPlan(n)));
    });
    const ctx = makeCtx(Array.from({ length: 12 }, (_, i) => i + 1));
    ctx.input.scheduler = createWriterScheduler({ maxConcurrency: 2, jitterMs: 0 });
    await generateShardedSessionPlans(ctx);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('si el modelo omite una sesión del paquete, reintenta SOLO la faltante', async () => {
    let first = true;
    mockGenerate.mockImplementation(async (_s: string, user: string) => {
      const asked = requested(user);
      if (first && asked.length === 2) {
        first = false;
        return respond([goodPlan(asked[0])]); // omite la segunda
      }
      return respond(asked.map((n) => goodPlan(n)));
    });
    const { plans } = await generateShardedSessionPlans(makeCtx([1, 2]));
    expect(plans.map((p) => p.sessionNumber)).toEqual([1, 2]);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(requested(mockGenerate.mock.calls[1][1])).toEqual([2]);
  });

  it('reparación quirúrgica: solo la sesión deficiente se regenera y se acepta si mejora', async () => {
    const calls: number[][] = [];
    mockGenerate.mockImplementation(async (_s: string, user: string) => {
      const asked = requested(user);
      calls.push(asked);
      const isRepair = /REPARACIÓN/.test(user);
      return respond(
        asked.map((n) => (n === 2 && !isRepair ? goodPlan(n, { contenido: para(90) }) : goodPlan(n)))
      );
    });
    const { plans, diagnostics } = await generateShardedSessionPlans(makeCtx([1, 2, 3]));
    expect(diagnostics.repairedSessions).toEqual([2]);
    expect(diagnostics.stillDeficient).toEqual([]);
    expect(calls.filter((c) => c.length === 1 && c[0] === 2).length).toBe(1);
    expect(plans.find((p) => p.sessionNumber === 2)!.contenido.split(/\s+/).length).toBeGreaterThan(400);
  });

  it('inyecta los términos requeridos repartidos entre paquetes (alineación preventiva)', async () => {
    mockGenerate.mockImplementation(async (_s: string, user: string) => respond(requested(user).map((n) => goodPlan(n))));
    const terms = ['Teorema ALFA', 'Concepto BETA', 'Material GAMMA', 'Saber DELTA'];
    await generateShardedSessionPlans(makeCtx([1, 2, 3, 4], { requiredTerms: terms }));
    const systems = mockGenerate.mock.calls.map((c) => c[0] as string);
    for (const term of terms) {
      expect(systems.some((s) => s.includes(term))).toBe(true);
    }
  });

  it('fail-closed: si un paquete cae por completo lanza IncompleteSessionPlansError (sin relleno sintético)', async () => {
    mockGenerate.mockImplementation(async (_s: string, user: string) => {
      const asked = requested(user);
      if (asked.includes(1)) throw new Error('boom');
      return respond(asked.map((n) => goodPlan(n)));
    });
    await expect(generateShardedSessionPlans(makeCtx([1, 2, 3, 4]))).rejects.toBeInstanceOf(IncompleteSessionPlansError);
  });

  it('si TODAS las llamadas fallan, propaga el error del proveedor (no lo enmascara)', async () => {
    mockGenerate.mockRejectedValue(new Error('HTTP 503: UNAVAILABLE'));
    await expect(generateShardedSessionPlans(makeCtx([1, 2]))).rejects.toThrow('HTTP 503: UNAVAILABLE');
  });
});

