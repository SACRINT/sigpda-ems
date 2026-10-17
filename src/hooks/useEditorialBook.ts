'use client';

import { useState, useEffect } from 'react';

export type EditorialBookStatus = 'idle' | 'generating' | 'completed' | 'failed' | 'error';

export interface UseEditorialBookOptions {
  planningId?: string;
  onCompleted?: (downloadUrl: string) => void;
  onPremiumRequired?: () => void;
  onError?: (error: string) => void;
}

export interface EditorialBookState {
  status: EditorialBookStatus;
  downloadUrl: string | null;
  pageCount: number | null;
  spineWidthMm: number | null;
  errorMessage: string | null;
  isPremiumRequired: boolean;
  pollAttempts: number;
}

export interface UseEditorialBookReturn extends EditorialBookState {
  generateBook: (customBody?: Record<string, unknown>) => Promise<boolean>;
  pollBookStatus: (planningIdToPoll?: string) => Promise<void>;
  reset: () => void;
}

export const BACKOFF_INTERVALS_MS = [3000, 5000, 8000, 13000, 15000];
export const MAX_POLL_ATTEMPTS = 10;

/**
 * EditorialBookClient — Controlador de estado y polling para el motor editorial
 * Permite ejecución determinista tanto en hooks de React como en pruebas unitarias Node.
 */
export class EditorialBookClient {
  private options: UseEditorialBookOptions;
  private state: EditorialBookState;
  private listeners: Set<(state: EditorialBookState) => void> = new Set();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;

  constructor(options: UseEditorialBookOptions = {}) {
    this.options = options;
    this.state = {
      status: 'idle',
      downloadUrl: null,
      pageCount: null,
      spineWidthMm: null,
      errorMessage: null,
      isPremiumRequired: false,
      pollAttempts: 0,
    };
  }

  public getState(): EditorialBookState {
    return { ...this.state };
  }

  public setOptions(options: UseEditorialBookOptions): void {
    this.options = options;
  }

  public subscribe(listener: (state: EditorialBookState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    if (this.isDestroyed) return;
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }

  private setState(partial: Partial<EditorialBookState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  public clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clearTimer();
    this.listeners.clear();
  }

  public reset(): void {
    this.clearTimer();
    this.setState({
      status: 'idle',
      downloadUrl: null,
      pageCount: null,
      spineWidthMm: null,
      errorMessage: null,
      isPremiumRequired: false,
      pollAttempts: 0,
    });
  }

  /**
   * Consulta periódica (polling) a GET /api/pdf/libro-editorial/[id]
   */
  public async pollBookStatus(planningIdToPoll?: string): Promise<void> {
    const targetId = planningIdToPoll || this.options.planningId;
    if (!targetId || this.isDestroyed) return;

    this.clearTimer();

    const executePoll = async (attempt: number): Promise<void> => {
      if (this.isDestroyed) return;
      this.setState({ pollAttempts: attempt });

      try {
        const res = await fetch(`/api/pdf/libro-editorial/${targetId}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        // 504: Reintentar con backoff
        if (res.status === 504) {
          if (attempt < MAX_POLL_ATTEMPTS) {
            const delay = BACKOFF_INTERVALS_MS[Math.min(attempt - 1, BACKOFF_INTERVALS_MS.length - 1)];
            this.timer = setTimeout(() => executePoll(attempt + 1), delay);
          } else {
            this.setState({
              status: 'error',
              errorMessage: 'Tiempo de espera agotado al consultar el estado de compilación.',
            });
          }
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const msg = errorData.error || `Error ${res.status} al consultar el estado del libro.`;
          this.setState({ status: 'error', errorMessage: msg });
          this.options.onError?.(msg);
          return;
        }

        const data = await res.json();
        const bookStatus = data.status || data.editorialBook?.status;

        if (bookStatus === 'completed' && data.downloadUrl) {
          this.setState({
            status: 'completed',
            downloadUrl: data.downloadUrl,
            pageCount: data.pageCount ?? null,
            spineWidthMm: data.spineWidthMm ?? null,
          });
          this.options.onCompleted?.(data.downloadUrl);
          return;
        }

        if (bookStatus === 'failed') {
          const msg = data.editorialBook?.error_message || 'La compilación editorial en el worker falló.';
          this.setState({ status: 'failed', errorMessage: msg });
          this.options.onError?.(msg);
          return;
        }

        // Si sigue pendiente o en proceso y quedan intentos, programar siguiente intento
        if (attempt < MAX_POLL_ATTEMPTS) {
          const delay = BACKOFF_INTERVALS_MS[Math.min(attempt - 1, BACKOFF_INTERVALS_MS.length - 1)];
          this.timer = setTimeout(() => executePoll(attempt + 1), delay);
        } else {
          const msg = 'Límite de intentos de consulta alcanzado sin confirmación de finalización.';
          this.setState({ status: 'error', errorMessage: msg });
          this.options.onError?.(msg);
        }
      } catch (fetchErr) {
        if (this.isDestroyed) return;
        if (attempt < MAX_POLL_ATTEMPTS) {
          const delay = BACKOFF_INTERVALS_MS[Math.min(attempt - 1, BACKOFF_INTERVALS_MS.length - 1)];
          this.timer = setTimeout(() => executePoll(attempt + 1), delay);
        } else {
          const msg = fetchErr instanceof Error ? fetchErr.message : 'Error de conexión consultando el libro.';
          this.setState({ status: 'error', errorMessage: msg });
          this.options.onError?.(msg);
        }
      }
    };

    await executePoll(1);
  }

  /**
   * Envía POST /api/pdf/libro-editorial/[id] para iniciar la compilación
   */
  public async generateBook(customBody?: Record<string, unknown>): Promise<boolean> {
    const targetId = this.options.planningId;
    if (!targetId || this.isDestroyed) {
      this.setState({
        status: 'error',
        errorMessage: 'ID de planeación requerido para generar el libro editorial.',
      });
      return false;
    }

    this.clearTimer();
    this.setState({
      status: 'generating',
      errorMessage: null,
      isPremiumRequired: false,
      pollAttempts: 0,
    });

    try {
      const res = await fetch(`/api/pdf/libro-editorial/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: customBody ? JSON.stringify(customBody) : undefined,
      });

      // 403: Control de acceso o suscripción requerida
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.code === 'PREMIUM_REQUIRED') {
          const msg = data.error || 'Se requiere una suscripción Premium activa.';
          this.setState({
            status: 'failed',
            isPremiumRequired: true,
            errorMessage: msg,
          });
          this.options.onPremiumRequired?.();
          return false;
        }

        const msg = data.error || 'Motor editorial inactivo o sin permisos.';
        this.setState({ status: 'error', errorMessage: msg });
        this.options.onError?.(msg);
        return false;
      }

      // 504: Presupuesto de ejecución agotado en Vercel
      if (res.status === 504) {
        const data = await res.json().catch(() => ({}));
        const retrySec = res.headers.get('Retry-After') || '5';
        const msg = `${data.error || 'Tiempo de ejecución insuficiente'}. Intenta de nuevo en ${retrySec} segundos.`;
        this.setState({ status: 'error', errorMessage: msg });
        this.options.onError?.(msg);
        return false;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || `Error ${res.status} durante la compilación editorial.`;
        this.setState({ status: 'failed', errorMessage: msg });
        this.options.onError?.(msg);
        return false;
      }

      const data = await res.json();

      // Si ya finalizó (ej. en caché)
      if (data.status === 'completed' && data.downloadUrl) {
        this.setState({
          status: 'completed',
          downloadUrl: data.downloadUrl,
          pageCount: data.pageCount ?? null,
          spineWidthMm: data.spineWidthMm ?? null,
        });
        this.options.onCompleted?.(data.downloadUrl);
        return true;
      }

      // Si quedó en cola / procesando, iniciar ciclo de polling
      await this.pollBookStatus(targetId);
      return true;
    } catch (postErr) {
      if (this.isDestroyed) return false;
      const msg = postErr instanceof Error ? postErr.message : 'Error de red al despachar la compilación editorial.';
      this.setState({ status: 'error', errorMessage: msg });
      this.options.onError?.(msg);
      return false;
    }
  }
}

/**
 * useEditorialBook — Hook para orquestación asíncrona y polling del Motor Editorial
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 3 — Tarea 4)
 */
export function useEditorialBook(options: UseEditorialBookOptions = {}): UseEditorialBookReturn {
  const [client] = useState(() => new EditorialBookClient(options));
  const [state, setState] = useState<EditorialBookState>(() => client.getState());

  useEffect(() => {
    client.setOptions(options);
  }, [client, options]);

  useEffect(() => {
    const unsubscribe = client.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    return () => {
      client.destroy();
    };
  }, [client]);

  return {
    ...state,
    generateBook: (customBody) => client.generateBook(customBody),
    pollBookStatus: (id) => client.pollBookStatus(id),
    reset: () => client.reset(),
  };
}
