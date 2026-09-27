/**
 * src/__tests__/pmc-paec-diagnostic-fusion.test.ts
 *
 * Regression tests for H-160 (PAEC banner + diagnostic fusion logic).
 * These tests FAIL if the fusion logic is reverted:
 * - mergePaecIntoDiagnostic must preserve existing text and replace PAEC section
 * - preservePaecOnPmcLoad must keep PAEC section when PMC text changes
 * - buildPaecDiagnosticParts must filter empty fields and format non-empty ones
 */

import { describe, it, expect } from 'vitest';
import {
  mergePaecIntoDiagnostic,
  preservePaecOnPmcLoad,
  buildPaecDiagnosticParts,
} from '@/lib/pmc/paec-diagnostic-fusion';

describe('PAEC Diagnostic Fusion (H-160 regression)', () => {
  // ── mergePaecIntoDiagnostic ─────────────────────────────────────────────────

  it('1. Appends PAEC section to empty diagnostic', () => {
    const result = mergePaecIntoDiagnostic('', 'Contexto comunitario rural');
    expect(result).toBe('--- Integrado desde PAEC ---\nContexto comunitario rural');
  });

  it('2. Appends PAEC section after existing PMC diagnostic', () => {
    const result = mergePaecIntoDiagnostic(
      'Diagnóstico institucional existente',
      'Contexto comunitario rural'
    );
    expect(result).toContain('Diagnóstico institucional existente');
    expect(result).toContain('--- Integrado desde PAEC ---');
    expect(result).toContain('Contexto comunitario rural');
    // PMC text must come before PAEC
    const pmcIdx = result.indexOf('Diagnóstico institucional');
    const paecIdx = result.indexOf('--- Integrado desde PAEC ---');
    expect(pmcIdx).toBeLessThan(paecIdx);
  });

  it('3. Replaces existing PAEC section without duplicating separator', () => {
    const existing = 'Diagnóstico previo\n\n--- Integrado desde PAEC ---\nDatos anteriores obsoletos';
    const result = mergePaecIntoDiagnostic(existing, 'Datos actualizados del PAEC');

    // Should contain the new PAEC data
    expect(result).toContain('Datos actualizados del PAEC');
    // Should NOT contain old PAEC data
    expect(result).not.toContain('Datos anteriores obsoletos');
    // Should have exactly one separator
    const separatorCount = result.split('--- Integrado desde PAEC ---').length - 1;
    expect(separatorCount).toBe(1);
    // PMC diagnostic must still be there
    expect(result).toContain('Diagnóstico previo');
  });

  // ── preservePaecOnPmcLoad ───────────────────────────────────────────────────

  it('4. Preserves PAEC section when PMC text is replaced', () => {
    const existing = 'Viejo PMC texto\n\n--- Integrado desde PAEC ---\nDatos comunitarios';
    const result = preservePaecOnPmcLoad('Nuevo PMC texto', existing);

    expect(result).toContain('Nuevo PMC texto');
    expect(result).toContain('--- Integrado desde PAEC ---');
    expect(result).toContain('Datos comunitarios');
    expect(result).not.toContain('Viejo PMC texto');
  });

  it('5. Returns only PMC text when no PAEC section exists', () => {
    const result = preservePaecOnPmcLoad('Solo PMC', 'Sin sección PAEC');
    expect(result).toBe('Solo PMC');
  });

  // ── buildPaecDiagnosticParts ────────────────────────────────────────────────

  it('6. Filters empty fields and formats non-empty ones with labels', () => {
    const parts = buildPaecDiagnosticParts(
      {
        context: 'Comunidad semiurbana',
        location: '',
        problematics: 'Deserción y adicciones',
        economicActivities: 'Agricultura',
      },
      {
        projectName: 'Mi Proyecto PAEC',
        problemStatement: 'Falta de áreas verdes',
      }
    );

    // Should have 4 non-empty parts (location is empty → filtered)
    expect(parts).toHaveLength(4);
    expect(parts[0]).toContain('[Contexto Comunitario PAEC]: Comunidad semiurbana');
    expect(parts[1]).toContain('[Problemática Comunitaria Central - Mi Proyecto PAEC]: Falta de áreas verdes');
    expect(parts[2]).toContain('[Problemáticas Detectadas]: Deserción y adicciones');
    expect(parts[3]).toContain('[Actividades Económicas]: Agricultura');
  });

  it('7. Returns empty array when all fields are missing', () => {
    const parts = buildPaecDiagnosticParts({}, {});
    expect(parts).toHaveLength(0);
  });

  it('8. Uses "PAEC" as fallback project name when projectName is not provided', () => {
    const parts = buildPaecDiagnosticParts(
      {},
      { problemStatement: 'Problema detectado' }
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('- PAEC]');
  });

  it('9. Counter includes all non-empty community fields (H-167 regression)', () => {
    const parts = buildPaecDiagnosticParts(
      {
        context: 'Rural',
        location: 'Montaña',
        problematics: 'Deserción',
        economicActivities: 'Café',
      },
      {
        projectName: 'PAEC Local',
        problemStatement: 'Sin agua potable',
      }
    );
    // All 5 fields are non-empty → 5 parts
    expect(parts).toHaveLength(5);
  });
});
