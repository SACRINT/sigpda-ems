/**
 * horarios-orchestrator.test.ts
 * 
 * Tests unitarios y de integración para HorariosOrchestrator (Nivel 1)
 * y el patrón Strangler Fig bajo control de la feature flag HORARIOS_ORCHESTRATOR_V2 (Fase F).
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
  getTeacherByEmail: vi.fn(),
  getScheduleById: vi.fn(),
  updateSchedule: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
}));

vi.mock('@/lib/horarios/solver', () => ({
  resolverHorario: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, getScheduleById, updateSchedule } from '@/lib/db';
import { generateWithRotation } from '@/lib/ai-provider';
import { resolverHorario } from '@/lib/horarios/solver';
import { POST as handleScheduleOptimizePost } from '@/app/api/schedules/[id]/optimize/route';
import {
  horariosOrchestrator,
  HorariosOrchestrator,
  HorariosOrchestratorError,
} from '@/lib/horarios/orchestrator';
import {
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
} from '@/lib/platform/feature-flags';

const mockTeacher = {
  id: 'teacher-horarios-123',
  email: 'director.horarios@bachillerato.pue.gob.mx',
  name: 'Mtro. Fernando Ramos',
};

const mockSchedule = {
  id: 'sch-test-001',
  teacher_id: 'teacher-horarios-123',
  school_name: 'Bachillerato General Oficial',
  celdas: [
    { diaSemana: 1, periodo: 1, grupoId: 'g1', docenteId: 'd1', asignaturaId: 'asig1' },
  ],
  metricas: {
    huecosDocentes: 2,
    huecosGrupos: 1,
    softScore: 85,
  },
  grupos: [{ id: 'g1', nombre: '1-A', semestre: 1 }],
  docentes: [{ id: 'd1', nombre: 'Prof. Juan Pérez' }],
  aulas: [{ id: 'aula-1', nombre: 'Salón 1', tipo: 'REGULAR' }],
  cargas: [{ id: 'c1', docenteId: 'd1', grupoId: 'g1', asignaturaId: 'asig1', horasSemanales: 4 }],
  config: { diasLectivos: 5, horasPorDia: 6 },
  ai_optimization_log: [],
};

describe('HorariosOrchestrator (Fase F — Piloto Nivel 1 & Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
    vi.mocked(auth).mockResolvedValue({
      user: { email: mockTeacher.email },
    } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(getScheduleById).mockResolvedValue(mockSchedule as never);
    vi.mocked(updateSchedule).mockImplementation(async (_id, _teachId, patch) => ({
      ...mockSchedule,
      ...patch,
    } as never));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Implementa IProgramSystem con programId "horarios" y versión canónica "2.0.0"', () => {
    expect(horariosOrchestrator.programId).toBe('horarios');
    expect(horariosOrchestrator.version).toBe('2.0.0');
    expect(horariosOrchestrator).toBeInstanceOf(HorariosOrchestrator);
  });

  it('2. healthCheck reporta healthy cuando BD e IA están configuradas, y degraded honesto ante ausencias', async () => {
    // Configuración completa
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');

    const health = await horariosOrchestrator.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.checks.databaseConfigured).toBe(true);
    expect(health.checks.aiServiceConfigured).toBe(true);
    expect(health.checks.featureFlagService).toBe(true);

    // Degraded por ausencia de BD
    vi.stubEnv('DATABASE_URL', '');
    const degradedDb = await horariosOrchestrator.healthCheck();
    expect(degradedDb.status).toBe('degraded');
    expect(degradedDb.checks.databaseConfigured).toBe(false);

    // Degraded por ausencia de clave IA
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', '');
    const degradedAi = await horariosOrchestrator.healthCheck();
    expect(degradedAi.status).toBe('degraded');
    expect(degradedAi.checks.aiServiceConfigured).toBe(false);
  });

  it('3. getMetrics retorna métricas institucionales con el estado de HORARIOS_ORCHESTRATOR_V2', async () => {
    const metricsOff = await horariosOrchestrator.getMetrics('escuela-21EBH0015A');
    expect(metricsOff.programId).toBe('horarios');
    expect(metricsOff.version).toBe('2.0.0');
    expect(metricsOff.tenantId).toBe('escuela-21EBH0015A');
    expect(metricsOff.flags).toEqual({ HORARIOS_ORCHESTRATOR_V2: false });

    setFeatureFlag('HORARIOS_ORCHESTRATOR_V2', true);
    const metricsOn = await horariosOrchestrator.getMetrics('escuela-21EBH0015A');
    expect(metricsOn.flags).toEqual({ HORARIOS_ORCHESTRATOR_V2: true });
  });

  it('4. Política B-001 (Zero Silent Stubs): Métodos no migrados lanzan 501 NOT_IMPLEMENTED ruidosamente', async () => {
    await expect(horariosOrchestrator.generateFullSchedule()).rejects.toBeInstanceOf(HorariosOrchestratorError);
    await expect(horariosOrchestrator.generateFullSchedule()).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });

    await expect(horariosOrchestrator.exportScheduleExcel()).rejects.toBeInstanceOf(HorariosOrchestratorError);
    await expect(horariosOrchestrator.exportScheduleExcel()).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });

    await expect(horariosOrchestrator.exportSchedulePdf()).rejects.toBeInstanceOf(HorariosOrchestratorError);
    await expect(horariosOrchestrator.exportSchedulePdf()).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });

    await expect(horariosOrchestrator.validateTeacherAvailability()).rejects.toBeInstanceOf(HorariosOrchestratorError);
    await expect(horariosOrchestrator.validateTeacherAvailability()).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining('no implementado'),
    });
  });

  it('5. optimizeSchedule ejecuta optimización pedagógica con IA y actualiza el horario', async () => {
    vi.mocked(generateWithRotation).mockResolvedValue(JSON.stringify([
      {
        diagnostico_general: 'Estructura equilibrada con descansos pedagógicos adecuados.',
        score_balance: 92,
        puntos_fuertes: ['Cero colisiones docentes', 'Carga balanceada en turno matutino'],
        areas_mejora: ['Monitorear laboratorios en viernes'],
      },
    ]));

    const result = await horariosOrchestrator.optimizeSchedule('sch-test-001', mockTeacher.id, {
      reSolve: false,
      aiFeedback: true,
    });

    expect(result.ok).toBe(true);
    expect(result.optimizations.length).toBe(1);
    expect(result.optimizations[0].score_balance).toBe(92);
    expect(updateSchedule).toHaveBeenCalledWith(
      'sch-test-001',
      mockTeacher.id,
      expect.objectContaining({
        ai_optimization_log: expect.any(Array),
      })
    );
  });

  it('6. optimizeSchedule ejecuta el solver heurístico cuando reSolve = true', async () => {
    vi.mocked(resolverHorario).mockReturnValue({
      exito: true,
      celdas: [
        { diaSemana: 1, periodo: 1, grupoId: 'g1', docenteId: 'd1', asignaturaId: 'asig1' },
        { diaSemana: 1, periodo: 2, grupoId: 'g1', docenteId: 'd1', asignaturaId: 'asig1' },
      ],
      metricas: {
        totalClasesProgramadas: 2,
        totalClasesRequeridas: 2,
        huecosDocentes: 0,
        huecosGrupos: 0,
        diasAisladosDocentes: 0,
        materiasSinDispersion: 1,
        bloquesDoblesExitosos: 1,
        softScore: 98,
        tiempoEjecucionMs: 45,
      },
    } as never);

    const result = await horariosOrchestrator.optimizeSchedule('sch-test-001', mockTeacher.id, {
      reSolve: true,
      aiFeedback: false,
    });

    expect(result.ok).toBe(true);
    expect(result.solverResult).toBeDefined();
    expect(result.solverResult?.exito).toBe(true);
    expect(updateSchedule).toHaveBeenCalledWith(
      'sch-test-001',
      mockTeacher.id,
      expect.objectContaining({
        celdas: expect.any(Array),
        metricas: expect.objectContaining({ softScore: 98 }),
      })
    );
  });

  it('7. optimizeSchedule lanza HorariosOrchestratorError con 404 si el horario no existe', async () => {
    vi.mocked(getScheduleById).mockResolvedValue(null as never);

    await expect(
      horariosOrchestrator.optimizeSchedule('sch-inexistente', mockTeacher.id)
    ).rejects.toMatchObject({
      name: 'HorariosOrchestratorError',
      status: 404,
      message: 'Horario no encontrado',
    });
  });

  it('8. Strangler Fig en /api/schedules/[id]/optimize: usa rama legacy cuando HORARIOS_ORCHESTRATOR_V2 = false', async () => {
    expect(isFeatureEnabled('HORARIOS_ORCHESTRATOR_V2')).toBe(false);

    const spyOptimize = vi.spyOn(horariosOrchestrator, 'optimizeSchedule');

    const req = new NextRequest('http://localhost:3000/api/schedules/sch-test-001/optimize', {
      method: 'POST',
      body: JSON.stringify({ reSolve: false, aiFeedback: false }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleScheduleOptimizePost(req, {
      params: Promise.resolve({ id: 'sch-test-001' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verifica que NO se llamó al orquestador (rama legacy activa)
    expect(spyOptimize).not.toHaveBeenCalled();
    spyOptimize.mockRestore();
  });

  it('9. Strangler Fig en /api/schedules/[id]/optimize: delega a HorariosOrchestrator cuando HORARIOS_ORCHESTRATOR_V2 = true', async () => {
    setFeatureFlag('HORARIOS_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('HORARIOS_ORCHESTRATOR_V2')).toBe(true);

    const spyOptimize = vi.spyOn(horariosOrchestrator, 'optimizeSchedule');

    const req = new NextRequest('http://localhost:3000/api/schedules/sch-test-001/optimize', {
      method: 'POST',
      body: JSON.stringify({ reSolve: false, aiFeedback: false }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleScheduleOptimizePost(req, {
      params: Promise.resolve({ id: 'sch-test-001' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verifica que SÍ se delegó al orquestador (Strangler activo)
    expect(spyOptimize).toHaveBeenCalledWith('sch-test-001', mockTeacher.id, {
      reSolve: false,
      aiFeedback: false,
    });
    spyOptimize.mockRestore();
  });

  it('10. Invariante Criptográfica: planning-evaluator.ts se mantiene exactamente intacto (hash SHA-256 inalterado)', () => {
    const evaluatorPath = path.resolve(process.cwd(), 'src/lib/planning-evaluator.ts');
    const content = fs.readFileSync(evaluatorPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Hash criptográfico de referencia sellado en Fases B..E
    expect(hash).toBe('d030d785788c2b41a13abb83fa0e24b46f1ebd4cc82cfaf6b1cb8c852cf5a653');
  });
});
