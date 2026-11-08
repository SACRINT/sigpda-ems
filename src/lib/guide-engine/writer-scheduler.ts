/**
 * writer-scheduler.ts — Planificador de concurrencia acotada para llamadas de IA del libro
 * SIGPDA-EMS · Motor editorial MCCEMS
 *
 * Reemplaza el bucle secuencial (con `sleep` fijo) por un scheduler que:
 *  1. Limita las llamadas simultáneas (semáforo global) a `maxConcurrency`, dimensionado según
 *     el número de claves activas del pool para no exceder la cuota por clave (la rotación LRU
 *     de `claimApiKey` reparte las llamadas concurrentes entre claves distintas).
 *  2. Aplica jitter aleatorio al lanzar cada tarea (evita ráfagas sincronizadas).
 *  3. Mantiene un circuit breaker COMPARTIDO: tras N fallos transitorios consecutivos (503/429)
 *     pausa los nuevos lanzamientos con espera exponencial; nunca descarta tareas por sí mismo.
 *  4. Respeta la señal de aborto (rechaza tareas en cola) y es agnóstico a la asignatura.
 */

export interface SchedulerStats {
  started: number;
  completed: number;
  failed: number;
  maxObservedConcurrency: number;
  breakerTrips: number;
}

export interface WriterScheduler {
  /** Encola y ejecuta una tarea respetando concurrencia, jitter y breaker. */
  run<T>(label: string, task: () => Promise<T>): Promise<T>;
  readonly stats: SchedulerStats;
  readonly maxConcurrency: number;
}

export interface SchedulerOptions {
  maxConcurrency: number;
  /** Jitter máximo (ms) previo al lanzamiento de cada tarea. Default 300. */
  jitterMs?: number;
  signal?: AbortSignal;
  breaker?: {
    /** Fallos transitorios consecutivos que abren el breaker. Default 3. */
    threshold?: number;
    baseCooldownMs?: number;
    maxCooldownMs?: number;
  };
  /** Inyectables para pruebas deterministas. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

/** Errores transitorios de capacidad/cuota del proveedor (comparten breaker). */
export function isTransientCapacityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /503|UNAVAILABLE|high demand|service unavailable|overloaded|429|RESOURCE_EXHAUSTED|rate.?limit|cooldown|AiServiceUnavailable/i.test(
    msg
  );
}

interface QueueItem {
  label: string;
  start: () => void;
  reject: (reason: unknown) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createWriterScheduler(options: SchedulerOptions): WriterScheduler {
  const maxConcurrency = Math.max(1, Math.floor(options.maxConcurrency));
  const jitterMs = Math.max(0, options.jitterMs ?? 300);
  const threshold = Math.max(1, options.breaker?.threshold ?? 3);
  const baseCooldown = Math.max(0, options.breaker?.baseCooldownMs ?? 4000);
  const maxCooldown = Math.max(baseCooldown, options.breaker?.maxCooldownMs ?? 30000);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const signal = options.signal;

  const stats: SchedulerStats = {
    started: 0,
    completed: 0,
    failed: 0,
    maxObservedConcurrency: 0,
    breakerTrips: 0,
  };

  const queue: QueueItem[] = [];
  let inFlight = 0;
  let consecutiveTransient = 0;
  let breakerOpenUntil = 0;
  let currentCooldown = baseCooldown;
  let pumping = false;

  const abortReason = (): unknown =>
    signal?.reason instanceof Error ? signal.reason : new DOMException('Scheduler aborted', 'AbortError');

  const pump = async (): Promise<void> => {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length > 0 && inFlight < maxConcurrency) {
        if (signal?.aborted) {
          const reason = abortReason();
          while (queue.length > 0) queue.shift()!.reject(reason);
          return;
        }
        const wait = breakerOpenUntil - now();
        if (wait > 0) {
          await sleep(wait);
          continue;
        }
        const item = queue.shift()!;
        inFlight++;
        stats.maxObservedConcurrency = Math.max(stats.maxObservedConcurrency, inFlight);
        // Jitter ANTES de arrancar, sin bloquear el reparto del resto de slots libres
        const delay = jitterMs > 0 ? Math.floor(random() * jitterMs) : 0;
        if (delay > 0) {
          void sleep(delay).then(() => item.start());
        } else {
          item.start();
        }
      }
    } finally {
      pumping = false;
    }
  };

  const onSuccess = () => {
    consecutiveTransient = 0;
    currentCooldown = baseCooldown;
  };

  const onFailure = (err: unknown) => {
    if (!isTransientCapacityError(err)) {
      return; // un error de contenido/validación no indica saturación del proveedor
    }
    consecutiveTransient++;
    if (consecutiveTransient >= threshold) {
      stats.breakerTrips++;
      breakerOpenUntil = now() + currentCooldown;
      currentCooldown = Math.min(maxCooldown, Math.max(1, currentCooldown) * 2);
      consecutiveTransient = 0;
    }
  };

  return {
    stats,
    maxConcurrency,
    run<T>(label: string, task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        if (signal?.aborted) {
          reject(abortReason());
          return;
        }
        queue.push({
          label,
          reject,
          start: () => {
            stats.started++;
            let settled: Promise<T>;
            try {
              settled = Promise.resolve(task());
            } catch (syncErr) {
              settled = Promise.reject(syncErr);
            }
            settled
              .then((value) => {
                stats.completed++;
                onSuccess();
                resolve(value);
              })
              .catch((err) => {
                stats.failed++;
                onFailure(err);
                reject(err);
              })
              .finally(() => {
                inFlight--;
                void pump();
              });
          },
        });
        void pump();
      });
    },
  };
}

/**
 * Concurrencia efectiva para los redactores del libro.
 * Prioridad: variable de entorno BOOK_WRITER_MAX_CONCURRENCY (1..8) → tamaño del pool de claves
 * activas acotado a [1, 4]. `resolvePoolSize` es inyectable (evita acoplar el scheduler al gateway).
 */
export async function resolveWriterConcurrency(
  resolvePoolSize?: () => Promise<number>
): Promise<number> {
  const envValue = Number(process.env.BOOK_WRITER_MAX_CONCURRENCY);
  if (Number.isFinite(envValue) && envValue >= 1) {
    return Math.min(8, Math.floor(envValue));
  }
  if (!resolvePoolSize) return 2;
  try {
    const pool = await resolvePoolSize();
    if (!Number.isFinite(pool)) return 2;
    return Math.max(1, Math.min(4, Math.floor(pool)));
  } catch {
    return 1;
  }
}

/** Ejecuta `task` a través del scheduler si existe; si no, directamente (compatibilidad). */
export function runScheduled<T>(
  scheduler: WriterScheduler | undefined,
  label: string,
  task: () => Promise<T>
): Promise<T> {
  return scheduler ? scheduler.run(label, task) : task();
}

