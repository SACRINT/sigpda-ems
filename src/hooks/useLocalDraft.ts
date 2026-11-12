'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseLocalDraftOptions<T> {
  debounceMs?: number;
  enabled?: boolean;
  onRestore?: (draft: T) => void;
}

export interface UseLocalDraftResult<T> {
  restored: boolean;
  restoredDraft: T | null;
  storageKey: string;
  isHydrated: boolean;
  dismissRestore: () => void;
  clearDraft: () => void;
}

const PREFIX = 'sigpda_draft_';

/**
 * Persiste un formulario en localStorage con debounce (3 s por defecto).
 * Restaura el borrador al montar y expone `restored` para mostrar un aviso.
 */
export function useLocalDraft<T>(
  key: string,
  value: T,
  options: UseLocalDraftOptions<T> = {}
): UseLocalDraftResult<T> {
  const storageKey = key.startsWith(PREFIX) ? key : `${PREFIX}${key}`;
  const debounceMs = options.debounceMs ?? 3000;
  const enabled = options.enabled !== false;

  const [isHydrated, setIsHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRestoreRef = useRef(options.onRestore);
  onRestoreRef.current = options.onRestore;

  useEffect(() => {
    let cancelled = false;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        if (!cancelled) {
          setRestoredDraft(parsed);
          setRestored(true);
          onRestoreRef.current?.(parsed);
        }
      }
    } catch {
      // localStorage puede estar bloqueado; el formulario sigue funcionando en memoria.
    } finally {
      if (!cancelled) setIsHydrated(true);
    }

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const serializedValue = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!isHydrated || !enabled || serializedValue === null) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, serializedValue);
      } catch {
        // Sin persistencia local si el navegador bloquea el almacenamiento.
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [storageKey, serializedValue, isHydrated, enabled, debounceMs]);

  const dismissRestore = useCallback(() => setRestored(false), []);

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignorar bloqueo de almacenamiento.
    }
    setRestored(false);
    setRestoredDraft(null);
  }, [storageKey]);

  return {
    restored,
    restoredDraft,
    storageKey,
    isHydrated,
    dismissRestore,
    clearDraft,
  };
}
