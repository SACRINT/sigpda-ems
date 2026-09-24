/**
 * cartografia-context-provider.test.ts
 * 
 * Tests unitarios y de integración para CartografiaContextProvider (Nivel 1)
 * y el patrón Strangler Fig bajo control de la feature flag CARTOGRAFIA_ORCHESTRATOR_V2 (Fase E).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Mocks
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
}));

vi.mock('@/lib/cartografia-parser', () => ({
  parseCartografiaMatriz: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { parseCartografiaMatriz } from '@/lib/cartografia-parser';
import { POST as handlePipsParseExcelPost } from '@/app/api/pips/parse-excel/route';
import {
  cartografiaContextProvider,
  CartografiaContextProvider,
  CartografiaContextProviderError,
} from '@/lib/cartografia/context-provider';
import {
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
} from '@/lib/platform/feature-flags';

const mockMomento1 = {
  planteles: [
    {
      no: 1,
      cct: '21EBH0015A',
      nombre: 'Bachillerato Venustiano Carranza',
      localidad: 'Venustiano Carranza',
      municipio: 'Venustiano Carranza',
      turno: 'MATUTINO',
      matricula: 240,
      egresados: 72,
      bajasDefinitivas: 12,
      eficienciaTerminal: 90.0,
      abandono: 5.0,
      reprobacion: 8.0,
      promedioGeneral: 8.5,
      paecProyecto: 'Cuidado Comunitario del Agua',
      paecProblematica: 'Escasez y contaminación en cuenca local',
    },
  ],
  matriculaTotalZona: 240,
  municipiosCobertura: ['Venustiano Carranza'],
  sedesPlanteles: ['Bachillerato Venustiano Carranza [21EBH0015A]'],
  caracterizacionInicial: 'Zona escolar 004 con 1 plantel y matrícula de 240 estudiantes.',
};

const mockMomento2 = {
  capaCuantitativa: {
    promedioAbandonoZona: 5.0,
    promedioEficienciaZona: 90.0,
    promedioAprovechamientoZona: 8.5,
    promedioReprobacionZona: 8.0,
    matriculaTotal: 240,
    plantelesAtencionPrioritaria: [],
    resumenEstadistico911F11: 'Análisis consolidado 911/F11: Abandono 5%, Eficiencia Terminal 90%.',
  },
  capaCualitativa: {
    problematicasComunes: ['Vulnerabilidad socioeconómica familiar.'],
    factoresContextuales: ['Actividades agrícolas en la región serrana.'],
    vinculacionPaecZona: ['Bachillerato Venustiano Carranza: Cuidado Comunitario del Agua'],
    desafiosSocioeconomicos: 'Dispersión geográfica.',
  },
};

describe('CartografiaContextProvider (Fase E — Piloto Nivel 1 & Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'supervisor.zona004@bachillerato.pue.gob.mx' },
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Implementa IProgramSystem con programId "cartografia" y versión canónica "2.0.0"', () => {
    expect(cartografiaContextProvider.programId).toBe('cartografia');
    expect(cartografiaContextProvider.version).toBe('2.0.0');
    expect(cartografiaContextProvider).toBeInstanceOf(CartografiaContextProvider);
  });

  it('2. healthCheck reporta healthy cuando BD e IA están configuradas, y degraded honesto ante ausencias', async () => {
    // Configuración completa
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');

    const health = await cartografiaContextProvider.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.checks.databaseConfigured).toBe(true);
    expect(health.checks.aiServiceConfigured).toBe(true);
    expect(health.checks.featureFlagService).toBe(true);

    // Degraded por ausencia de BD
    vi.stubEnv('DATABASE_URL', '');
    const degradedDb = await cartografiaContextProvider.healthCheck();
    expect(degradedDb.status).toBe('degraded');
    expect(degradedDb.checks.databaseConfigured).toBe(false);

    // Degraded por ausencia de clave IA
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', '');
    const degradedAi = await cartografiaContextProvider.healthCheck();
    expect(degradedAi.status).toBe('degraded');
    expect(degradedAi.checks.aiServiceConfigured).toBe(false);
  });

  it('3. getMetrics retorna métricas institucionales con el estado de CARTOGRAFIA_ORCHESTRATOR_V2', async () => {
    const metricsOff = await cartografiaContextProvider.getMetrics('zona-004');
    expect(metricsOff.programId).toBe('cartografia');
    expect(metricsOff.version).toBe('2.0.0');
    expect(metricsOff.tenantId).toBe('zona-004');
    expect(metricsOff.flags).toEqual({ CARTOGRAFIA_ORCHESTRATOR_V2: false });

    setFeatureFlag('CARTOGRAFIA_ORCHESTRATOR_V2', true);
    const metricsOn = await cartografiaContextProvider.getMetrics('zona-004');
    expect(metricsOn.flags).toEqual({ CARTOGRAFIA_ORCHESTRATOR_V2: true });
  });

  it('4. Política B-001 (Zero Silent Stubs): Métodos no migrados lanzan 501 NOT_IMPLEMENTED ruidosamente', async () => {
    await expect(cartografiaContextProvider.generateMomento(3, 'proj-123')).rejects.toBeInstanceOf(CartografiaContextProviderError);
    await expect(cartografiaContextProvider.generateMomento(3, 'proj-123')).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });

    await expect(cartografiaContextProvider.generatePedagogicalMemory('proj-123')).rejects.toBeInstanceOf(CartografiaContextProviderError);
    await expect(cartografiaContextProvider.generatePedagogicalMemory('proj-123')).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });

    await expect(cartografiaContextProvider.renderPDF('proj-123')).rejects.toBeInstanceOf(CartografiaContextProviderError);
    await expect(cartografiaContextProvider.renderPDF('proj-123')).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });

    await expect(cartografiaContextProvider.exportContextForPmc('proj-123')).rejects.toBeInstanceOf(CartografiaContextProviderError);
    await expect(cartografiaContextProvider.exportContextForPmc('proj-123')).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });
  });

  it('5. ingestZoneMatrix procesa el buffer exitosamente y retorna los Momentos 1 y 2', async () => {
    vi.mocked(parseCartografiaMatriz).mockResolvedValue({
      success: true,
      momento1: mockMomento1,
      momento2: mockMomento2,
    });

    const buffer = Buffer.from('excel-data-simulada');
    const result = await cartografiaContextProvider.ingestZoneMatrix(buffer, {
      filename: 'matriz_zona_004.xlsx',
      zonaNumero: '004',
      cicloEscolar: '2026-2027',
      linkDbPaec: true,
    });

    expect(result.success).toBe(true);
    expect(result.filename).toBe('matriz_zona_004.xlsx');
    expect(result.momento1.planteles.length).toBe(1);
    expect(result.momento2.capaCuantitativa.promedioEficienciaZona).toBe(90.0);
  });

  it('6. ingestZoneMatrix lanza error 422 cuando parseCartografiaMatriz falla', async () => {
    vi.mocked(parseCartografiaMatriz).mockResolvedValue({
      success: false,
      momento1: { planteles: [], matriculaTotalZona: 0, municipiosCobertura: [], sedesPlanteles: [], caracterizacionInicial: '' },
      momento2: {
        capaCuantitativa: { promedioAbandonoZona: 0, promedioEficienciaZona: 0, promedioAprovechamientoZona: 0, promedioReprobacionZona: 0, matriculaTotal: 0, plantelesAtencionPrioritaria: [], resumenEstadistico911F11: '' },
        capaCualitativa: { problematicasComunes: [], factoresContextuales: [], vinculacionPaecZona: [], desafiosSocioeconomicos: '' },
      },
      error: 'Formato 911 no contiene columnas requeridas de matrícula',
    });

    const buffer = Buffer.from('excel-corrupto');
    await expect(
      cartografiaContextProvider.ingestZoneMatrix(buffer, {
        filename: 'matriz_invalida.xlsx',
      })
    ).rejects.toMatchObject({
      name: 'CartografiaContextProviderError',
      status: 422,
      message: expect.stringContaining('columnas requeridas'),
    });
  });

  it('7. Strangler Fig en /api/pips/parse-excel: usa rama legacy cuando CARTOGRAFIA_ORCHESTRATOR_V2 = false', async () => {
    expect(isFeatureEnabled('CARTOGRAFIA_ORCHESTRATOR_V2')).toBe(false);

    vi.mocked(parseCartografiaMatriz).mockResolvedValue({
      success: true,
      momento1: mockMomento1,
      momento2: mockMomento2,
    });

    const spyIngest = vi.spyOn(cartografiaContextProvider, 'ingestZoneMatrix');

    const fakeFile = new File(['fake-content'], 'matriz_zona.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const formData = new FormData();
    formData.append('file', fakeFile);
    formData.append('zonaNumero', '004');
    formData.append('cicloEscolar', '2026-2027');

    const req = new NextRequest('http://localhost:3000/api/pips/parse-excel', {
      method: 'POST',
      body: formData,
    });

    const res = await handlePipsParseExcelPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.filename).toBe('matriz_zona.xlsx');
    expect(data.momento1.planteles[0].cct).toBe('21EBH0015A');

    // Verifica que NO se llamó al context provider (rama legacy activa)
    expect(spyIngest).not.toHaveBeenCalled();
    spyIngest.mockRestore();
  });

  it('8. Strangler Fig en /api/pips/parse-excel: delega a CartografiaContextProvider cuando CARTOGRAFIA_ORCHESTRATOR_V2 = true', async () => {
    setFeatureFlag('CARTOGRAFIA_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('CARTOGRAFIA_ORCHESTRATOR_V2')).toBe(true);

    vi.mocked(parseCartografiaMatriz).mockResolvedValue({
      success: true,
      momento1: mockMomento1,
      momento2: mockMomento2,
    });

    const spyIngest = vi.spyOn(cartografiaContextProvider, 'ingestZoneMatrix');

    const fakeFile = new File(['fake-content'], 'matriz_zona_v2.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const formData = new FormData();
    formData.append('file', fakeFile);
    formData.append('zonaNumero', '004');
    formData.append('cicloEscolar', '2026-2027');

    const req = new NextRequest('http://localhost:3000/api/pips/parse-excel', {
      method: 'POST',
      body: formData,
    });

    const res = await handlePipsParseExcelPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.filename).toBe('matriz_zona_v2.xlsx');
    expect(data.momento1.planteles[0].cct).toBe('21EBH0015A');

    // Verifica que SÍ se delegó al context provider (Strangler activo)
    expect(spyIngest).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        filename: 'matriz_zona_v2.xlsx',
        zonaNumero: '004',
        cicloEscolar: '2026-2027',
        linkDbPaec: true,
      })
    );
    spyIngest.mockRestore();
  });

  it('9. Invariante Criptográfica: planning-evaluator.ts se mantiene exactamente intacto (hash SHA-256 inalterado)', () => {
    const evaluatorPath = path.resolve(process.cwd(), 'src/lib/planning-evaluator.ts');
    const content = fs.readFileSync(evaluatorPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Hash criptográfico de referencia sellado en Fase B/C/D
    expect(hash).toBe('d030d785788c2b41a13abb83fa0e24b46f1ebd4cc82cfaf6b1cb8c852cf5a653');
  });
});
