// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalDraft } from '@/hooks/useLocalDraft';

describe('useLocalDraft — resiliencia offline', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('guarda con debounce de 3 segundos y prefijo sigpda_draft_', () => {
    const { result } = renderHook(() =>
      useLocalDraft('wizard-context', { docente: 'Ana', escuela: 'BGE' })
    );

    expect(result.current.storageKey).toBe('sigpda_draft_wizard-context');
    expect(window.localStorage.getItem('sigpda_draft_wizard-context')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(window.localStorage.getItem('sigpda_draft_wizard-context')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(window.localStorage.getItem('sigpda_draft_wizard-context')).toContain('Ana');
  });

  it('restaura el borrador y notifica mediante onRestore', () => {
    window.localStorage.setItem(
      'sigpda_draft_wizard-uac',
      JSON.stringify({ uacName: 'Lengua y Comunicación I', semester: 1 })
    );
    const onRestore = vi.fn();

    const { result } = renderHook(() =>
      useLocalDraft('wizard-uac', { uacName: '', semester: 3 }, { onRestore })
    );

    expect(result.current.restored).toBe(true);
    expect(result.current.restoredDraft).toEqual({
      uacName: 'Lengua y Comunicación I',
      semester: 1,
    });
    expect(onRestore).toHaveBeenCalledWith({
      uacName: 'Lengua y Comunicación I',
      semester: 1,
    });
  });

  it('clearDraft elimina el borrador y el aviso', () => {
    window.localStorage.setItem('sigpda_draft_wizard-context', '{"docente":"Ana"}');
    const { result } = renderHook(() => useLocalDraft('wizard-context', { docente: '' }));

    expect(result.current.restored).toBe(true);
    act(() => result.current.clearDraft());

    expect(window.localStorage.getItem('sigpda_draft_wizard-context')).toBeNull();
    expect(result.current.restored).toBe(false);
  });
});
