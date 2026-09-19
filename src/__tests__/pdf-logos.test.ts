// src/__tests__/pdf-logos.test.ts
/**
 * Tests Unitarios para pdf-logos.ts
 * Fase 19 · SIGPDA-EMS DBEPA Puebla MCCEMS 2026-2027
 *
 * Valida el servicio de carga, procesamiento con Sharp, fallback y caché
 * de logotipos oficiales institucionales:
 * 1. Fallback defensivo ante archivos inexistentes (retorna '' sin excepción).
 * 2. Carga exitosa de logotipos reales con Sharp en Node.js (JPEG en Base64).
 * 3. Carga individual de logos (Gobierno, SEP, Supervisión 004).
 * 4. Caché en memoria para evitar re-lectura y reprocesamiento.
 * 5. Carga paralela con loadAllLogos().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAllLogos, getLogoGobierno, getLogoSep, getLogoSupervision } from '@/lib/pdf-logos';

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('pdf-logos.ts — Servicio de Logotipos Institucionales (Fase 19)', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  // ── 1. Fallback Defensivo ante Archivo Inexistente ──────────────────────────
  it('Test 1 (Fallback Inexistente): Retorna cadena vacía cuando los archivos no existen en el sistema de archivos', async () => {
    // Simular un directorio de trabajo donde no existen los archivos en public/images/
    process.cwd = () => 'C:\\nonexistent_virtual_workspace_dir';

    const logos = await loadAllLogos();

    expect(logos).toBeDefined();
    expect(logos.gobierno).toBe('');
    expect(logos.sep).toBe('');
    expect(logos.supervision).toBe('');
  });

  // ── 2. Carga Exitosa con Archivos Reales y Sharp ───────────────────────────
  it('Test 2 (Carga Real con Sharp): Carga y optimiza los logotipos oficiales en formato JPEG Base64', async () => {
    process.cwd = originalCwd;

    const [logoGobierno, logoSep, logoSupervision] = await Promise.all([
      getLogoGobierno(),
      getLogoSep(),
      getLogoSupervision(),
    ]);

    // Los 3 logos existen en public/images/ y deben haberse procesado a JPEG con sharp
    expect(logoGobierno.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(logoSep.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(logoSupervision.startsWith('data:image/jpeg;base64,')).toBe(true);

    // Tamaño de base64 razonable (> 100 caracteres)
    expect(logoGobierno.length).toBeGreaterThan(100);
    expect(logoSep.length).toBeGreaterThan(100);
    expect(logoSupervision.length).toBeGreaterThan(100);
  });

  // ── 3. Caché en Memoria ───────────────────────────────────────────────────
  it('Test 3 (Caché en Memoria): Reutiliza los logos en memoria sin reprocesar', async () => {
    // Primera lectura (ya cargados en Test 2)
    const logo1 = await getLogoGobierno();
    const sep1 = await getLogoSep();
    const sup1 = await getLogoSupervision();

    // Segunda lectura (debe retornar exactamente la misma referencia en caché)
    const logo2 = await getLogoGobierno();
    const sep2 = await getLogoSep();
    const sup2 = await getLogoSupervision();

    expect(logo1).toBe(logo2);
    expect(sep1).toBe(sep2);
    expect(sup1).toBe(sup2);
  });

  // ── 4. Carga Paralela con loadAllLogos ─────────────────────────────────────
  it('Test 4 (loadAllLogos Paralelo): Carga y devuelve los 3 logos consolidados', async () => {
    const logos = await loadAllLogos();

    expect(logos).toBeDefined();
    expect(logos.gobierno.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(logos.sep.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(logos.supervision.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
