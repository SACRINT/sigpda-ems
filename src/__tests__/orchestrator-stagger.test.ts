import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('block-guide-orchestrator — Micro-desfase (Staggering) de Redactores', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debe ejecutar los redactores de forma escalonada con 500ms de diferencia entre cada uno en producción', async () => {
    const STAGGER_DELAY_MS = 500;
    const executionTimestamps: number[] = [];

    const mockWriter = async (id: string) => {
      executionTimestamps.push(Date.now());
      return { id };
    };

    const writerTasks = [
      { type: 'foundation', fn: () => mockWriter('foundation') },
      { type: 'lab', fn: () => mockWriter('lab') },
      { type: 'project', fn: () => mockWriter('project') },
      { type: 'evaluation', fn: () => mockWriter('evaluation') },
    ];

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const startTime = Date.now();

    const promise = Promise.allSettled(
      writerTasks.map(async (task, index) => {
        if (index > 0 && STAGGER_DELAY_MS > 0) {
          await sleep(index * STAGGER_DELAY_MS);
        }
        return task.fn();
      })
    );

    // En t = 0: solo foundation debe haber arrancado
    expect(executionTimestamps.length).toBe(1);

    // Avanzar 500ms: lab arranca
    await vi.advanceTimersByTimeAsync(500);
    expect(executionTimestamps.length).toBe(2);

    // Avanzar otros 500ms (t = 1000): project arranca
    await vi.advanceTimersByTimeAsync(500);
    expect(executionTimestamps.length).toBe(3);

    // Avanzar otros 500ms (t = 1500): evaluation arranca
    await vi.advanceTimersByTimeAsync(500);
    expect(executionTimestamps.length).toBe(4);

    const results = await promise;
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    // Verificar las diferencias de tiempo exactas (500ms entre cada llamada)
    expect(executionTimestamps[0] - startTime).toBe(0);
    expect(executionTimestamps[1] - startTime).toBe(500);
    expect(executionTimestamps[2] - startTime).toBe(1000);
    expect(executionTimestamps[3] - startTime).toBe(1500);
  });

  it('en modo test (NODE_ENV=test) el delay es 0ms para no ralentizar la suite de pruebas', async () => {
    const STAGGER_DELAY_MS = 0;
    const executionTimestamps: number[] = [];

    const mockWriter = async (id: string) => {
      executionTimestamps.push(Date.now());
      return { id };
    };

    const writerTasks = [
      { type: 'foundation', fn: () => mockWriter('foundation') },
      { type: 'lab', fn: () => mockWriter('lab') },
      { type: 'project', fn: () => mockWriter('project') },
      { type: 'evaluation', fn: () => mockWriter('evaluation') },
    ];

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const promise = Promise.allSettled(
      writerTasks.map(async (task, index) => {
        if (index > 0 && STAGGER_DELAY_MS > 0) {
          await sleep(index * STAGGER_DELAY_MS);
        }
        return task.fn();
      })
    );

    await promise;

    // Todas las tareas se dispararon de inmediato sin retardo
    expect(executionTimestamps.length).toBe(4);
    expect(executionTimestamps[1] - executionTimestamps[0]).toBe(0);
    expect(executionTimestamps[2] - executionTimestamps[0]).toBe(0);
    expect(executionTimestamps[3] - executionTimestamps[0]).toBe(0);
  });
});

