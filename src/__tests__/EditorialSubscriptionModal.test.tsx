import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import EditorialSubscriptionModal from '@/components/ui/EditorialSubscriptionModal';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('EditorialSubscriptionModal (Fase 3 — Tarea 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no debe renderizar nada si isOpen es false', () => {
    const html = renderToString(
      <EditorialSubscriptionModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('debe renderizar el diálogo accesible con título y beneficios si isOpen es true', () => {
    const html = renderToString(
      <EditorialSubscriptionModal isOpen={true} onClose={vi.fn()} />,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Motor Editorial Premium');
    expect(html).toContain('Compilación de Imprenta Typst');
    expect(html).toContain('Lomo Paramétrico Automatizado');
    expect(html).toContain('Almacenamiento Durable Vercel Blob');
    expect(html).toContain('Cumplimiento Normativo MCCEMS');
    expect(html).toContain('Ver planes');
    expect(html).toContain('Cerrar');
    expect(html).toContain('aria-label="Cerrar modal"');
  });

  it('debe incluir las rutas visuales y tokens de diseño esperados', () => {
    const html = renderToString(
      <EditorialSubscriptionModal isOpen={true} onClose={vi.fn()} />,
    );

    expect(html).toContain('SUSCRIPCIÓN REQUERIDA');
    expect(html).toContain('editorial-modal-title');
  });
});
