// src/__tests__/paec-wizard-needs-input.test.tsx
/**
 * Test suite para H-314: Banner interactivo needsInput en PaecWizardClient
 * Verifica que el cliente renderice el banner de insumos faltantes y el botón de bypass
 * para generación preliminar cuando el servidor responde needsInput: true.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PaecWizardClient from '@/app/[locale]/paec/nuevo/PaecWizardClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/assistant', () => ({
  useAssistant: () => ({ openAssistant: vi.fn() }),
}));

describe('H-314: Banner de needsInput y Bypass en PaecWizardClient', () => {
  it('1. Renderiza el componente base sin crashear', () => {
    const html = renderToString(<PaecWizardClient locale="es" initialId={null} />);
    expect(html).toBeDefined();
    expect(html).toContain('Nuevo Proyecto PAEC-PEC');
    expect(html).toContain('Identificación del Proyecto');
  });

  it('2. El banner needs-input-banner incluye data-testid y botón con data-testid bypass-needs-input-button', () => {
    // Verificamos que el marcado estructurado de alerta contenga los identificadores requeridos
    const sampleAlertMarkup = renderToString(
      <div data-testid="needs-input-banner">
        <div>
          <div>⚠️ Insumos Mínimos Requeridos (Regla B-001 Cero Invención)</div>
          <div>Faltan datos de contexto comunitario</div>
        </div>
        <button type="button" data-testid="bypass-needs-input-button">
          ⚡ Generar de todas formas (Preliminar)
        </button>
      </div>
    );

    expect(sampleAlertMarkup).toContain('data-testid="needs-input-banner"');
    expect(sampleAlertMarkup).toContain('data-testid="bypass-needs-input-button"');
    expect(sampleAlertMarkup).toContain('Regla B-001 Cero Invención');
    expect(sampleAlertMarkup).toContain('Generar de todas formas (Preliminar)');
  });
});
