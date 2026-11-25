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
    ejemploResuelto: `Planteamiento: ${words(60)}\nPaso 1: ${words(70)}\nPaso 2: ${words(70)}\nPaso 3: ${words(70)}\nPaso 4: ${words(70)}\nConclusión: x = 7.`,
    practica: [
      { enunciado: `${words(70)} Calcula el valor de x.`, pista: words(35), solucion: ['Paso 1: x', 'Paso 2: y', 'Respuesta final: z'] },
      { enunciado: `${words(70)} Determina el resultado del caso.`, pista: words(35), solucion: ['Paso 1: x', 'Respuesta final: z'] },
    ],
    aplicacion: words(90),
    autoevaluacion: ['¿Puedo explicar el concepto central?', '¿Logré la práctica sin mirar?'],
    recursos: [{ titulo: 'Video educativo', url: 'https://www.youtube.com/results?search_query=x', tipo: 'video' }],
    productoIntegrador: words(70),
    sintesisVisual: {
      conceptoBreve:
        'El concepto central de esta sesión relaciona las magnitudes observables y permite explicar cómo cambian los datos en situaciones reales de la comunidad.',
      formulaOReglaClave: 'y = 2x + 3',
      ejemploBreve: {
        planteamiento:
          'Una cooperativa escolar registra datos concretos en dos jornadas y necesita determinar el comportamiento esperado en una tercera jornada.',
        pasos: [
          'Identifica los valores iniciales y el modelo que relaciona ambas magnitudes.',
          'Sustituye los datos conocidos en la expresión completa y realiza las operaciones.',
          'Verifica el resultado obtenido en el contexto del caso.',
        ],
        conclusion: 'El resultado verificado es x = 7 unidades en el caso analizado.',
      },
      mapaConceptual: {
        definicionClave: 'El concepto organiza la relación entre las variables clave del problema analizado.',
        criterioDesarrollo: 'Registra primero los datos con unidades y desarrolla cada paso en orden.',
        errorComun: 'Omitir las unidades o intercambiar los valores al sustituir en la expresión.',
        correccionBreve: 'Etiqueta cada dato antes de operar y comprueba el resultado al finalizar.',
      },
    },
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

  it('sessionPlanWordTarget conserva el piso del contrato V2 (1,120) y escala con el presupuesto', () => {
    expect(sessionPlanWordTarget(4000, 4)).toBe(1120);
    expect(sessionPlanWordTarget(20000, 8)).toBeGreaterThan(1120);
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



describe('generateShardedSessionPlans — fail-closed V2.1 (Tarea 1)', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('mantiene los umbrales V2.1 de densidad editorial (minTotalWords ≈ 1002, minContenido = 320, minEjemplo = 220, requireVisualSynthesis = true)', () => {
    const thresholds = densityThresholdsFor(1120, false, true);

    expect(thresholds.minTotalWords).toBe(1002);
    expect(thresholds.minContenidoWords).toBe(320);
    expect(thresholds.minEjemploWords).toBe(220);
    expect(thresholds.requireVisualSynthesis).toBe(true);

    const noVisual = evaluateSessionPlanDensity(
      goodPlan(1, { sintesisVisual: undefined }) as unknown as Parameters<typeof evaluateSessionPlanDensity>[0],
      thresholds
    );
    expect(noVisual.ok).toBe(false);
    expect(noVisual.deficits.some((d) => /sintesisVisual/i.test(d))).toBe(true);
  });

  it('plan deficiente sin sintesisVisual dispara reparación y completa la síntesis faltante', async () => {
    const deficientPlan = goodPlan(1, { sintesisVisual: undefined });
    const repairedPlan = goodPlan(1);

    mockGenerate
      .mockResolvedValueOnce(JSON.stringify({ sessionPlans: [deficientPlan] }))
      .mockResolvedValueOnce(JSON.stringify({ sessionPlans: [repairedPlan] }));

    const result = await generateShardedSessionPlans(
      makeCtx([1], { targetWordsPerPlan: 1120 })
    );

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(result.diagnostics.repairedSessions).toEqual([1]);
    expect(result.diagnostics.stillDeficient).toEqual([]);
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].sintesisVisual?.conceptoBreve).toBeTruthy();
  });

  it('si tras las reparaciones persiste déficit o falta sintesisVisual, lanza SessionDensityDeficiencyError con metadata completa', async () => {
    const { SessionDensityDeficiencyError } = await import(
      '@/lib/guide-engine/writers/session-shard'
    );

    const shortContent = 'Párrafo de desarrollo insuficiente para el mínimo requerido. '.repeat(8).trim();
    const broken1 = goodPlan(1, { contenido: shortContent, sintesisVisual: undefined });
    const broken2 = goodPlan(2, { contenido: shortContent, sintesisVisual: undefined });

    mockGenerate
      .mockResolvedValueOnce(JSON.stringify({ sessionPlans: [broken1, broken2] }))
      .mockResolvedValue(JSON.stringify({ sessionPlans: [broken1, broken2] }));

    let caught: unknown;
    try {
      await generateShardedSessionPlans(
        makeCtx([1, 2], { missionType: 'project', targetWordsPerPlan: 1120 })
      );
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(SessionDensityDeficiencyError);
    const err = caught as InstanceType<typeof SessionDensityDeficiencyError>;
    expect(err.missionType).toBe('project');
    expect(err.uacName).toBeTruthy();
    expect(err.sessions).toEqual([1, 2]);
    expect(err.deficits).toHaveLength(2);
    expect(err.deficits[0].deficits.length).toBeGreaterThan(0);
    expect(Array.isArray(err.repairedSessions)).toBe(true);
    expect(err.message).toContain('Sesiones afectadas: 1, 2');
  });

  it('repara todas las sesiones deficientes de un paquete de 6 por lotes de 2-3 (sin tope del 80% ni 1-a-1)', async () => {
    const shortContent = 'Párrafo de desarrollo insuficiente para el mínimo requerido. '.repeat(8).trim();
    const broken = (n: number) => goodPlan(n, { contenido: shortContent, sintesisVisual: undefined });

    let repairCalls = 0;
    mockGenerate.mockImplementation(async (_s: string, user: string) => {
      const asked = requested(user);
      const isRepair = /REPARACI[ÓO]N DE DENSIDAD/i.test(user);
      if (isRepair) {
        repairCalls++;
        expect(user).not.toContain('Ejemplo previo (recortado)');
      }
      return respond(asked.map((n) => (isRepair ? goodPlan(n) : broken(n))));
    });

    const result = await generateShardedSessionPlans(
      makeCtx([1, 2, 3, 4, 5, 6], { targetWordsPerPlan: 1120 })
    );

    expect(repairCalls).toBe(2);
    expect(mockGenerate).toHaveBeenCalledTimes(4);
    expect(result.diagnostics.repairedSessions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.diagnostics.stillDeficient).toEqual([]);
    expect(result.plans).toHaveLength(6);
  });

  it('revalida el lote tras la ronda 1 y repara en ronda 2 SOLO las sesiones residuales que sigan fallando', async () => {
    const shortContent = 'Párrafo de desarrollo insuficiente para el mínimo requerido. '.repeat(8).trim();
    const broken = (n: number) => goodPlan(n, { contenido: shortContent, sintesisVisual: undefined });

    let repairCalls = 0;
    mockGenerate.mockImplementation(async (_s: string, user: string) => {
      const asked = requested(user);
      const isRepair = /REPARACI[ÓO]N DE DENSIDAD/i.test(user);
      if (!isRepair) {
        return respond(asked.map((n) => broken(n)));
      }
      repairCalls++;
      // Ronda 1 (lotes [1,2,3] y [4,5]): todas aprueban menos la sesión 4.
      if (asked.includes(4) && asked.length > 1) {
        return respond(asked.map((n) => (n === 4 ? broken(n) : goodPlan(n))));
      }
      if (!asked.includes(4)) {
        return respond(asked.map((n) => goodPlan(n)));
      }
      // Ronda 2 (solo [4]): sesión 4 aprueba limpia.
      expect(asked).toEqual([4]);
      return respond([goodPlan(4)]);
    });

    const result = await generateShardedSessionPlans(
      makeCtx([1, 2, 3, 4, 5], { targetWordsPerPlan: 1120 })
    );

    // 2 lotes en ronda 1 ([1,2,3], [4,5]) + 1 llamada residual en ronda 2 ([4]) = 3 en vez de 5 1-a-1
    expect(repairCalls).toBe(3);
    expect(result.diagnostics.stillDeficient).toEqual([]);
    expect(result.diagnostics.repairedSessions).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
  });

  it('no enmascara un 503 durante la reparación como SessionDensityDeficiencyError', async () => {
    const shortContent = 'Párrafo de desarrollo insuficiente para el mínimo requerido. '.repeat(8).trim();
    const broken = goodPlan(1, { contenido: shortContent, sintesisVisual: undefined });

    mockGenerate
      .mockResolvedValueOnce(JSON.stringify({ sessionPlans: [broken] }))
      .mockRejectedValue(new Error('HTTP 503: UNAVAILABLE'));

    let caught: unknown;
    try {
      await generateShardedSessionPlans(makeCtx([1], { targetWordsPerPlan: 1120 }));
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).not.toBe('SessionDensityDeficiencyError');
    expect((caught as Error).message).toContain('HTTP 503');
  });

  it('plan completo y denso con sintesisVisual pasa sin reparaciones ni stillDeficient', async () => {
    const p1 = goodPlan(1);
    const p2 = goodPlan(2);
    mockGenerate.mockResolvedValueOnce(JSON.stringify({ sessionPlans: [p1, p2] }));

    const result = await generateShardedSessionPlans(
      makeCtx([1, 2], { targetWordsPerPlan: 1120 })
    );

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(result.diagnostics.repairedSessions).toEqual([]);
    expect(result.diagnostics.stillDeficient).toEqual([]);
    expect(result.plans).toHaveLength(2);
  });

  it('reparación quirúrgica por campo: fusiona SOLO el campo reparado sin sobrescribir campos válidos y conserva el campo previo si no mejora', async () => {
    const {
      classifyDeficientFields,
      mergeRepairedSessionFields,
    } = await import('@/lib/guide-engine/writers/session-shard');

    const thresholds = densityThresholdsFor(1120, false, true);
    const base = goodPlan(1) as unknown as Parameters<typeof evaluateSessionPlanDensity>[0];
    const shortEjemplo =
      'Planteamiento: Caso breve.\nPaso 1: Dato inicial.\nPaso 2: Criterio.\nPaso 3: Desarrollo.\nPaso 4: Conclusión: Resultado preliminar corto.';
    const brokenEjemploPlan = {
      ...base,
      ejemploResuelto: shortEjemplo,
    };

    expect(classifyDeficientFields(brokenEjemploPlan, thresholds)).toEqual(['ejemploResuelto']);

    // 1) Si el parche trae un ejemploResuelto que NO mejora y un contenido corto intruso, conserva ambos del plan previo
    const worseMerge = mergeRepairedSessionFields({
      prevPlan: brokenEjemploPlan,
      rawPatch: {
        sessionNumber: 1,
        ejemploResuelto: 'Planteamiento: Peor.',
        contenido: 'Intruso corto que no debe sobrescribir contenido válido.',
      },
      fieldsToRepair: ['ejemploResuelto'],
      thresholds,
      fallbackContext: { uacName: 'Asignatura de prueba' },
    });
    expect(worseMerge.updatedFields).toEqual([]);
    expect(worseMerge.plan.ejemploResuelto).toBe(shortEjemplo);
    expect(worseMerge.plan.contenido).toBe(base.contenido);
    expect(worseMerge.plan.sintesisVisual).toEqual(base.sintesisVisual);
    expect(worseMerge.plan.practica).toEqual(base.practica);

    // 2) Si el parche devuelve solo { sessionNumber: 1, ejemploResuelto: <válido> }, fusiona solo ejemploResuelto
    const goodMerge = mergeRepairedSessionFields({
      prevPlan: brokenEjemploPlan,
      rawPatch: {
        sessionNumber: 1,
        ejemploResuelto: base.ejemploResuelto,
        contenido: 'Intruso corto que jamás debe tocar contenido válido.',
      },
      fieldsToRepair: ['ejemploResuelto'],
      thresholds,
      fallbackContext: { uacName: 'Asignatura de prueba' },
    });
    expect(goodMerge.updatedFields).toEqual(['ejemploResuelto']);
    expect(goodMerge.plan.ejemploResuelto).toBe(base.ejemploResuelto);
    expect(goodMerge.plan.contenido).toBe(base.contenido);
    expect(goodMerge.plan.sintesisVisual).toEqual(base.sintesisVisual);
    expect(goodMerge.plan.practica).toEqual(base.practica);
    expect(evaluateSessionPlanDensity(goodMerge.plan, thresholds).ok).toBe(true);
  });

  it('presupuesto insuficiente (< 30 s) con residuo pendiente lanza RepairBudgetExhaustedError transitorio y nunca SessionDensityDeficiencyError', async () => {
    const {
      RepairBudgetExhaustedError,
      SessionDensityDeficiencyError,
    } = await import('@/lib/guide-engine/writers/session-shard');
    const { isTransientCapacityError } = await import('@/lib/guide-engine/writer-scheduler');

    const shortEjemplo =
      'Planteamiento: Caso breve.\nPaso 1: Dato.\nPaso 2: Regla.\nPaso 3: Paso.\nPaso 4: Conclusión: Corto.';
    const broken = goodPlan(1, { ejemploResuelto: shortEjemplo });

    let fakeNow = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

    try {
      mockGenerate.mockImplementationOnce(async () => {
        // Al terminar la generación inicial solo quedan 20s (< 30s requeridos para reparar)
        fakeNow = 1_000_000 + 80_000;
        return JSON.stringify({ sessionPlans: [broken] });
      });

      const ctx = makeCtx([1], { targetWordsPerPlan: 1120 });
      ctx.input.budgetDeadlineMs = 1_000_000 + 100_000; // 20s restantes tras la llamada inicial

      let caught: unknown;
      try {
        await generateShardedSessionPlans(ctx);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(RepairBudgetExhaustedError);
      expect(caught).not.toBeInstanceOf(SessionDensityDeficiencyError);
      expect(isTransientCapacityError(caught)).toBe(true);
      expect((caught as Error).message).toContain('restan 20s');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('acepta verbos imperativos de Humanidades en hasExplicitPracticeTask y tolerancia editorial del 15% en ejemploResuelto solo cuando la sesión ya cumple volumen y estructura', async () => {
    const { hasExplicitPracticeTask } = await import(
      '@/lib/guide-engine/writers/writer-contract'
    );
    const { classifyDeficientFields } = await import(
      '@/lib/guide-engine/writers/session-shard'
    );

    // Verbo real rechazado previamente en Pensamiento Filosófico y Humanidades II (S23)
    expect(
      hasExplicitPracticeTask(
        'Prepara un guion de tres minutos para defender tu propuesta sobre la equidad de género en los espacios recreativos. Incluye una tesis central y dos argumentos respaldados.'
      )
    ).toBe(true);
    expect(hasExplicitPracticeTask('Cuestiona los supuestos éticos del dilema comunitario.')).toBe(true);
    // Sigue rechazando enunciados puramente descriptivos sin consigna
    expect(hasExplicitPracticeTask('El presupuesto total del taller comunitario es de 2,500 pesos.')).toBe(false);

    const thresholds = densityThresholdsFor(1120, false, true);
    expect(thresholds.minEjemploWords).toBe(220);

    // 200 palabras con 4 pasos y cierre válido en una sesión >= 1002 palabras -> aprobado (margen >= 187w)
    const ejemplo200 = `Planteamiento: ${words(40)}\nPaso 1: ${words(38)}\nPaso 2: ${words(38)}\nPaso 3: ${words(38)}\nPaso 4: Conclusión: ${words(36)}.`;
    const planWithinMargin = goodPlan(2, {
      ejemploResuelto: ejemplo200,
    }) as unknown as Parameters<typeof evaluateSessionPlanDensity>[0];
    expect(evaluateSessionPlanDensity(planWithinMargin, thresholds).ok).toBe(true);
    expect(classifyDeficientFields(planWithinMargin, thresholds)).toEqual([]);

    // 165 palabras (< 187w) sigue siendo rechazado incluso si el plan suma > 1002 palabras
    const ejemplo165 = `Planteamiento: ${words(30)}\nPaso 1: ${words(30)}\nPaso 2: ${words(30)}\nPaso 3: ${words(30)}\nPaso 4: Conclusión: ${words(30)}.`;
    const planTooShort = goodPlan(2, {
      ejemploResuelto: ejemplo165,
    }) as unknown as Parameters<typeof evaluateSessionPlanDensity>[0];
    expect(evaluateSessionPlanDensity(planTooShort, thresholds).ok).toBe(false);
    expect(classifyDeficientFields(planTooShort, thresholds)).toEqual(['ejemploResuelto']);
  });
});
