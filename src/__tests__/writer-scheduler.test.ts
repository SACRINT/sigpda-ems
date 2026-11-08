import { describe, it, expect } from 'vitest';
import {
  createWriterScheduler,
  resolveWriterConcurrency,
  isTransientCapacityError,
  runScheduled,
} from '@/lib/guide-engine/writer-scheduler';

const tick = (ms = 1) => new Promise<void>((r) => setTimeout(r, ms));

describe('writer-scheduler: concurrencia acotada', () => {
  it('nunca excede maxConcurrency y completa todas las tareas', async () => {
    const sched = createWriterScheduler({ maxConcurrency: 3, jitterMs: 0 });
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 14 }, (_, i) =>
      sched.run(`t${i}`, async () => {
        active++;
        peak = Math.max(peak, active);
        await tick(5);
        active--;
        return i;
      })
    );
    const out = await Promise.all(tasks);
    expect(out).toEqual(Array.from({ length: 14 }, (_, i) => i));
    expect(peak).toBeLessThanOrEqual(3);
    expect(sched.stats.maxObservedConcurrency).toBeLessThanOrEqual(3);
    expect(sched.stats.completed).toBe(14);
  });

  it('maxConcurrency=1 equivale a ejecución secuencial FIFO', async () => {
    const sched = createWriterScheduler({ maxConcurrency: 1, jitterMs: 0 });
    const order: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map((i) =>
        sched.run(`t${i}`, async () => {
          await tick(2);
          order.push(i);
        })
      )
    );
    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('un fallo no bloquea la cola ni libera mal el slot', async () => {
    const sched = createWriterScheduler({ maxConcurrency: 2, jitterMs: 0 });
    const results = await Promise.allSettled([
      sched.run('a', async () => 'ok'),
      sched.run('b', async () => {
        throw new Error('contenido inválido');
      }),
      sched.run('c', async () => 'ok2'),
      sched.run('d', async () => 'ok3'),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
    expect(sched.stats.failed).toBe(1);
  });

  it('aplica el jitter inyectado antes de lanzar', async () => {
    const delays: number[] = [];
    const sched = createWriterScheduler({
      maxConcurrency: 2,
      jitterMs: 300,
      random: () => 0.5,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    await Promise.all([sched.run('a', async () => 1), sched.run('b', async () => 2)]);
    expect(delays.filter((d) => d === 150).length).toBe(2);
  });
});

describe('writer-scheduler: circuit breaker compartido', () => {
  it('tras N fallos transitorios consecutivos pausa nuevos lanzamientos y luego continúa', async () => {
    const sleeps: number[] = [];
    let clock = 0;
    const sched = createWriterScheduler({
      maxConcurrency: 1,
      jitterMs: 0,
      breaker: { threshold: 2, baseCooldownMs: 1000, maxCooldownMs: 4000 },
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });
    const err503 = () => {
      throw new Error('HTTP 503: UNAVAILABLE high demand');
    };
    await Promise.allSettled([sched.run('1', async () => err503()), sched.run('2', async () => err503())]);
    expect(sched.stats.breakerTrips).toBe(1);
    // la siguiente tarea espera el cooldown (1000ms) y luego se ejecuta
    const v = await sched.run('3', async () => 'recuperado');
    expect(v).toBe('recuperado');
    expect(sleeps).toContain(1000);
  });

  it('errores NO transitorios no abren el breaker', async () => {
    const sched = createWriterScheduler({ maxConcurrency: 1, jitterMs: 0, breaker: { threshold: 2 } });
    await Promise.allSettled([
      sched.run('a', async () => {
        throw new Error('JSON inválido');
      }),
      sched.run('b', async () => {
        throw new Error('sesión faltante');
      }),
      sched.run('c', async () => {
        throw new Error('otra validación');
      }),
    ]);
    expect(sched.stats.breakerTrips).toBe(0);
  });

  it('un éxito reinicia el contador de fallos consecutivos', async () => {
    const sched = createWriterScheduler({ maxConcurrency: 1, jitterMs: 0, breaker: { threshold: 2 } });
    const f = () => {
      throw new Error('429 RESOURCE_EXHAUSTED');
    };
    await Promise.allSettled([
      sched.run('f1', async () => f()),
      sched.run('ok', async () => 1),
      sched.run('f2', async () => f()),
    ]);
    expect(sched.stats.breakerTrips).toBe(0);
  });
});

describe('writer-scheduler: aborto y utilidades', () => {
  it('rechaza tareas en cola cuando la señal se aborta', async () => {
    const ac = new AbortController();
    const sched = createWriterScheduler({ maxConcurrency: 1, jitterMs: 0, signal: ac.signal });
    const first = sched.run('long', async () => {
      await tick(10);
      return 'done';
    });
    const queued = sched.run('queued', async () => 'nunca');
    ac.abort(new Error('lease perdido'));
    await expect(queued).rejects.toThrow('lease perdido');
    await expect(first).resolves.toBe('done');
    await expect(sched.run('after', async () => 1)).rejects.toThrow('lease perdido');
  });

  it('runScheduled sin scheduler ejecuta directamente', async () => {
    expect(await runScheduled(undefined, 'x', async () => 7)).toBe(7);
  });

  it('isTransientCapacityError clasifica 503/429 y no errores de contenido', () => {
    expect(isTransientCapacityError(new Error('HTTP 503: x'))).toBe(true);
    expect(isTransientCapacityError(new Error('429 RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isTransientCapacityError(new Error('sessionPlans incompletos'))).toBe(false);
  });
});

describe('resolveWriterConcurrency', () => {
  it('acota el pool a [1,4]', async () => {
    delete process.env.BOOK_WRITER_MAX_CONCURRENCY;
    expect(await resolveWriterConcurrency(async () => 0)).toBe(1);
    expect(await resolveWriterConcurrency(async () => 2)).toBe(2);
    expect(await resolveWriterConcurrency(async () => 9)).toBe(4);
  });

  it('cae a 1 si el pool falla y respeta el override de entorno', async () => {
    delete process.env.BOOK_WRITER_MAX_CONCURRENCY;
    expect(
      await resolveWriterConcurrency(async () => {
        throw new Error('db');
      })
    ).toBe(1);
    process.env.BOOK_WRITER_MAX_CONCURRENCY = '6';
    expect(await resolveWriterConcurrency(async () => 1)).toBe(6);
    delete process.env.BOOK_WRITER_MAX_CONCURRENCY;
  });
});

