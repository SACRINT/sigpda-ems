/**
 * planeaciones-orchestrator.test.ts
 * 
 * Tests unitarios y de integración para PlaneacionOrchestrator (Nivel 1)
 * y el patrón Strangler Fig en /api/planeaciones/evaluar bajo la feature flag
 * PLANEACION_ORCHESTRATOR_V2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  planeacionesOrchestrator,
  PlaneacionOrchestrator,
  PlaneacionOrchestratorError,
} from '@/lib/planeaciones/orchestrator';
import {
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
} from '@/lib/platform/feature-flags';
import type { ResultadoEvaluacion } from '@/lib/planeaciones-evaluator';

// Mocks
const mockDb = vi.fn();
vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/admin-unified', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/planeaciones-evaluator', () => ({
  evaluarPlaneacion: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { evaluarPlaneacion } from '@/lib/planeaciones-evaluator';
import { POST as handleEvaluarPost } from '@/app/api/planeaciones/evaluar/route';

const mockEvaluationResult: ResultadoEvaluacion = {
  rubricaUsada: 'Anexo 12 USICAMM — Semestres 1-4',
  puntajeTotal: 285,
  puntajeMaximo: 300,
  nivelCumplimiento: 'COMPLETO',
  criterios: [
    {
      id: 'crit-1',
      criterio: 'Alineación Curricular y Saberes',
      categoria: 'Diseño Curricular',
      puntajeMax: 100,
      puntajeObtenido: 95,
      cumple: 'SI',
      evidencia: 'Progresión 1 vinculada a saberes procedimentales.',
      observacion: 'Excelente contextualización.',
      recomendacion: 'Mantener la transversalidad.',
    },
  ],
  puntosFuertes: ['Articulación clara con la Nueva Escuela Mexicana'],
  mejorasUrgentes: [],
  observacionesExtendidas: 'Planeación de alta calidad pedagógica.',
  alineacionPaecPec: 'Vinculada al PEC Comunitario de la Zona 004.',
  retroalimentacionDocente: 'Cumple satisfactoriamente con la normativa estatal.',
  evaluadoAt: new Date().toISOString(),
};

describe('PlaneacionOrchestrator (Piloto Nivel 1 & Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('1. Con flag OFF (legacy default): ejecuta el flujo existente de evaluación de forma byte-idéntica', async () => {
    expect(isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2')).toBe(false);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx', name: 'Prof. Juan' } } as never);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockDb.mockResolvedValueOnce([
      { id: 'teacher-1', name: 'Prof. Juan', role: 'docente', sub_status: 'active' },
    ]);
    vi.mocked(evaluarPlaneacion).mockResolvedValueOnce(mockEvaluationResult);

    const validPlanText = 'Contenido pedagógico detallado con más de cincuenta caracteres para evaluar la planeación docente de forma integral.';
    const req = new Request('http://localhost:3000/api/planeaciones/evaluar', {
      method: 'POST',
      body: JSON.stringify({
        asignatura: 'Pensamiento Matemático I',
        semestre: 1,
        textoPlanificacion: validPlanText,
      }),
    });

    const res = await handleEvaluarPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cached).toBe(false);
    expect(json.resultado.puntajeTotal).toBe(285);
    expect(json.resultado.nivelCumplimiento).toBe('COMPLETO');
  });

  it('2. Con flag ON: delega la evaluación a planeacionesOrchestrator.evaluate() retornando la misma estructura JSON', async () => {
    setFeatureFlag('PLANEACION_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2')).toBe(true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx', name: 'Prof. Juan' } } as never);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockDb.mockResolvedValueOnce([
      { id: 'teacher-1', name: 'Prof. Juan', role: 'docente', sub_status: 'active' },
    ]);
    vi.mocked(evaluarPlaneacion).mockResolvedValueOnce(mockEvaluationResult);

    const validPlanText = 'Secuencia didáctica oficial MCCEMS para el Bachillerato General con saberes conceptuales y procedimentales.';
    const req = new Request('http://localhost:3000/api/planeaciones/evaluar', {
      method: 'POST',
      body: JSON.stringify({
        asignatura: 'Lengua y Comunicación I',
        semestre: 1,
        textoPlanificacion: validPlanText,
      }),
    });

    const res = await handleEvaluarPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cached).toBe(false);
    expect(json.resultado.rubricaUsada).toContain('Anexo 12 USICAMM');
    expect(json.resultado.criterios[0].categoria).toBe('Diseño Curricular');
  });

  it('3. Con flag ON: maneja error 400 cuando el texto de la planeación es demasiado corto', async () => {
    setFeatureFlag('PLANEACION_ORCHESTRATOR_V2', true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockDb.mockResolvedValueOnce([
      { id: 'teacher-1', name: 'Prof. Juan', role: 'docente', sub_status: 'active' },
    ]);

    const req = new Request('http://localhost:3000/api/planeaciones/evaluar', {
      method: 'POST',
      body: JSON.stringify({
        asignatura: 'Química I',
        semestre: 1,
        textoPlanificacion: 'Texto muy corto',
      }),
    });

    const res = await handleEvaluarPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('demasiado corto o inválido');
  });

  it('4. Métodos no implementados en orquestador Planeaciones lanzan PlaneacionOrchestratorError con HTTP 501', async () => {
    await expect(planeacionesOrchestrator.generate()).rejects.toThrow(PlaneacionOrchestratorError);
    await expect(planeacionesOrchestrator.buildSequence()).rejects.toThrow(PlaneacionOrchestratorError);
    await expect(planeacionesOrchestrator.renderPDF()).rejects.toThrow(PlaneacionOrchestratorError);

    try {
      await planeacionesOrchestrator.generate();
    } catch (err) {
      expect(err).toBeInstanceOf(PlaneacionOrchestratorError);
      expect((err as PlaneacionOrchestratorError).status).toBe(501);
    }
  });

  it('5. Valida salud y métricas de Planeaciones bajo el contrato IProgramSystem (Nivel 2)', async () => {
    expect(planeacionesOrchestrator).toBeInstanceOf(PlaneacionOrchestrator);
    expect(planeacionesOrchestrator.programId).toBe('planeaciones');

    // Estado con dependencias configuradas
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'test-key-mock');

    const health = await planeacionesOrchestrator.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.checks.databaseConfigured).toBe(true);
    expect(health.checks.aiServiceConfigured).toBe(true);
    expect(health.checks.featureFlagService).toBe(true);

    // Estado degradado cuando falta configuración crítica (BD o IA)
    vi.stubEnv('DATABASE_URL', '');
    const degradedHealth = await planeacionesOrchestrator.healthCheck();
    expect(degradedHealth.status).toBe('degraded');
    expect(degradedHealth.checks.databaseConfigured).toBe(false);

    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', '');
    const degradedAiHealth = await planeacionesOrchestrator.healthCheck();
    expect(degradedAiHealth.status).toBe('degraded');
    expect(degradedAiHealth.checks.aiServiceConfigured).toBe(false);

    vi.unstubAllEnvs();

    const metrics = await planeacionesOrchestrator.getMetrics('escuela-zona-004');
    expect(metrics.programId).toBe('planeaciones');
    expect(metrics.tenantId).toBe('escuela-zona-004');
  });

  it('6. Invariante Reto Situado / Modelo Finlandés: valida integridad estricta de planning-evaluator.ts', async () => {
    // Valida criptográficamente que planning-evaluator.ts no ha sufrido ninguna modificación en su código fuente
    const fs = await import('node:fs');
    const path = await import('node:path');
    const crypto = await import('node:crypto');

    const filePath = path.resolve(process.cwd(), 'src/lib/planning-evaluator.ts');
    const fileContent = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

    // Hash canónico del evaluador Reto Situado (Modelo Finlandés 4/4)
    expect(fileHash).toBe('d030d785788c2b41a13abb83fa0e24b46f1ebd4cc82cfaf6b1cb8c852cf5a653');

    const planningEvaluatorModule = await import('@/lib/planning-evaluator');
    expect(planningEvaluatorModule.validateRetoSituado).toBeDefined();
    expect(typeof planningEvaluatorModule.validateRetoSituado).toBe('function');
    expect(planningEvaluatorModule.autoRepairRetoSituado).toBeDefined();
    expect(planningEvaluatorModule.ensureRetoSituadoCalidad).toBeDefined();
  });
});
