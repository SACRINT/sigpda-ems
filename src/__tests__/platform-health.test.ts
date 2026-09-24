/**
 * platform-health.test.ts
 * 
 * Tests unitarios para el endpoint agregador central de salud de Plataforma Nivel 2
 * (GET /api/platform/health).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Mocks
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
}));

vi.mock('@/lib/planeaciones/orchestrator', () => ({
  planeacionesOrchestrator: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('@/lib/paec/orchestrator', () => ({
  paecOrchestrator: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('@/lib/pmc/orchestrator', () => ({
  pmcOrchestrator: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('@/lib/cartografia/context-provider', () => ({
  cartografiaContextProvider: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('@/lib/horarios/orchestrator', () => ({
  horariosOrchestrator: {
    healthCheck: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { sql } from '@/lib/db';
import { planeacionesOrchestrator } from '@/lib/planeaciones/orchestrator';
import { paecOrchestrator } from '@/lib/paec/orchestrator';
import { pmcOrchestrator } from '@/lib/pmc/orchestrator';
import { cartografiaContextProvider } from '@/lib/cartografia/context-provider';
import { horariosOrchestrator } from '@/lib/horarios/orchestrator';
import { GET as handlePlatformHealthGet } from '@/app/api/platform/health/route';

const healthyProgram = (id: string) => ({
  status: 'healthy' as const,
  checks: {
    databaseConfigured: true,
    aiServiceConfigured: true,
    featureFlagService: true,
  },
  timestamp: new Date().toISOString(),
  programId: id,
});

const degradedProgram = (id: string) => ({
  status: 'degraded' as const,
  checks: {
    databaseConfigured: true,
    aiServiceConfigured: false,
    featureFlagService: true,
  },
  timestamp: new Date().toISOString(),
  programId: id,
});

describe('Platform Health Endpoint (GET /api/platform/health)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');

    const mockDb = vi.fn().mockResolvedValue([{ ping: 1 }]);
    vi.mocked(sql).mockReturnValue(mockDb as never);

    vi.mocked(planeacionesOrchestrator.healthCheck).mockResolvedValue(healthyProgram('planeaciones'));
    vi.mocked(paecOrchestrator.healthCheck).mockResolvedValue(healthyProgram('paec'));
    vi.mocked(pmcOrchestrator.healthCheck).mockResolvedValue(healthyProgram('pmc'));
    vi.mocked(cartografiaContextProvider.healthCheck).mockResolvedValue(healthyProgram('cartografia'));
    vi.mocked(horariosOrchestrator.healthCheck).mockResolvedValue(healthyProgram('horarios'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Retorna status "healthy" y HTTP 200 cuando BD y los 5 orquestadores están saludables', async () => {
    const res = await handlePlatformHealthGet();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.platform).toBe('SIGPDA-EMS');
    expect(data.version).toBe('2.0.0');
    expect(data.database.connected).toBe(true);
    expect(data.programs.planeaciones.status).toBe('healthy');
    expect(data.programs.paec.status).toBe('healthy');
    expect(data.programs.pmc.status).toBe('healthy');
    expect(data.programs.cartografia.status).toBe('healthy');
    expect(data.programs.horarios.status).toBe('healthy');
  });

  it('2. Retorna status "degraded" y HTTP 200 cuando algún subsistema reporta degraded', async () => {
    vi.mocked(pmcOrchestrator.healthCheck).mockResolvedValue(degradedProgram('pmc'));

    const res = await handlePlatformHealthGet();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('degraded');
    expect(data.programs.pmc.status).toBe('degraded');
    expect(data.programs.paec.status).toBe('healthy');
  });

  it('3. Retorna status "unhealthy" y HTTP 503 cuando la base de datos no puede responder', async () => {
    const mockFailingDb = vi.fn().mockRejectedValue(new Error('Connection timeout to Neon DB'));
    vi.mocked(sql).mockReturnValue(mockFailingDb as never);

    const res = await handlePlatformHealthGet();
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe('unhealthy');
    expect(data.database.connected).toBe(false);
    expect(data.database.error).toContain('Connection timeout');
  });

  it('4. Retorna status "unhealthy" y HTTP 503 cuando DATABASE_URL no está definida', async () => {
    vi.stubEnv('DATABASE_URL', '');

    const res = await handlePlatformHealthGet();
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe('unhealthy');
    expect(data.database.connected).toBe(false);
    expect(data.database.error).toContain('DATABASE_URL no configurada');
  });

  it('5. Retorna status "unhealthy" y HTTP 503 cuando algún subsistema reporta status unhealthy', async () => {
    vi.mocked(horariosOrchestrator.healthCheck).mockResolvedValue({
      status: 'unhealthy',
      checks: { databaseConfigured: false, aiServiceConfigured: false, featureFlagService: false },
      timestamp: new Date().toISOString(),
    });

    const res = await handlePlatformHealthGet();
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe('unhealthy');
    expect(data.programs.horarios.status).toBe('unhealthy');
  });

  it('6. Invariante Criptográfica: planning-evaluator.ts se mantiene exactamente intacto (hash SHA-256 inalterado)', () => {
    const evaluatorPath = path.resolve(process.cwd(), 'src/lib/planning-evaluator.ts');
    const content = fs.readFileSync(evaluatorPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Hash criptográfico de referencia sellado en Fases B..F
    expect(hash).toBe('d030d785788c2b41a13abb83fa0e24b46f1ebd4cc82cfaf6b1cb8c852cf5a653');
  });
});
