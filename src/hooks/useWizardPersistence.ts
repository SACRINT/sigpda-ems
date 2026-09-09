'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * A generic hook that persists wizard form state to localStorage.
 * - Restores state automatically on page load/refresh
 * - Saves state automatically on every change
 * - Provides a `clearDraft()` function to call when the wizard finishes
 *
 * @param storageKey  Unique key for this wizard (e.g. 'didactica_planeacion_draft')
 * @param initialState  The default state when no saved draft exists
 */
export function useWizardPersistence<T>(storageKey: string, initialState: T) {
  // Always initialize with initialState to guarantee that server-side HTML
  // and initial client-side hydration render EXACTLY the same DOM (preventing React #418 error)
  const [state, setStateInternal] = useState<T>(initialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Restore state from localStorage ONLY after mounting on the client
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as T;
        setStateInternal(parsed);
        setHasDraft(true);
      }
    } catch (e) {
      console.warn(`[useWizardPersistence] Failed to restore draft for key "${storageKey}":`, e);
    } finally {
      setIsHydrated(true);
    }
  }, [storageKey]);

  // Save state to localStorage whenever it changes, but ONLY after initial hydration
  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
      setHasDraft(true);
    } catch (e) {
      console.warn(`[useWizardPersistence] Failed to save draft for key "${storageKey}":`, e);
    }
  }, [storageKey, state, isHydrated]);

  const setState = useCallback((update: T | ((prev: T) => T)) => {
    setStateInternal(update);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
      setHasDraft(false);
    } catch (e) {
      console.warn(`[useWizardPersistence] Failed to clear draft for key "${storageKey}":`, e);
    }
  }, [storageKey]);

  return { state, setState, hasDraft, clearDraft, isHydrated };
}

/**
 * Clears all Didáctica-IA wizard drafts from localStorage.
 * Call this on sign-out.
 */
export function clearAllWizardDrafts() {
  const DRAFT_KEYS = [
    'didactica_planeacion_draft',
    'didactica_paec_draft',
    'didactica_pmc_draft',
  ];
  try {
    DRAFT_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch (e) {
    console.warn('[clearAllWizardDrafts] Failed to clear drafts:', e);
  }
}
