/**
 * orchestrator-parity-checklist.test.ts
 * 
 * Checklist de paridad de contrato Legacy <-> Orquestador para las 7 rutas con Feature Flag (Fase D-01).
 * Compara códigos HTTP, contratos JSON y documenta gaps 501 conocidos sin simular éxito artificial.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks globales de infraestructura ────────────────────────────────────────
const mockDb = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  getScheduleById: vi.fn(),
  updateSchedule: vi.fn(),
  sql: () => mockDb,
}));

vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/admin-unified', () => ({
  isAdmin: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  resolveUserIsPremium: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/document-ingestion', () => ({
  ingestDocument: vi.fn(),
}));

vi.mock('@/lib/cartografia-parser', () => ({
  parseCartografiaMatriz: vi.fn(),
}));

vi.mock('@/lib/planeaciones-evaluator', () => ({
  evaluarPlaneacion: vi.fn(),
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

// Importar rutas bajo prueba
import { POST as handlePmc911Post } from '@/app/api/pmc/estadistica-911/route';
import { POST as handlePmcF11Post } from '@/app/api/pmc/f11/route';
import { POST as handlePmcParsePreviousPost } from '@/app/api/pmc/parse-previous/route';
import { POST as handlePaecParsePreviousPost } from '@/app/api/paec/parse-previous/route';
import { POST as handlePlaneacionesEvaluarPost } from '@/app/api/planeaciones/evaluar/route';
import { POST as handlePipsParseExcelPost } from '@/app/api/pips/parse-excel/route';
import { POST as handleSchedulesOptimizePost } from '@/app/api/schedules/[id]/optimize/route';

// Importar servicios y orquestadores
import { auth } from '@/lib/auth';
import { getTeacherByEmail, getScheduleById, updateSchedule } from '@/lib/db';
import { generateWithRotation } from '@/lib/ai-provider';
import { ingestDocument } from '@/lib/document-ingestion';
import { parseCartografiaMatriz } from '@/lib/cartografia-parser';
import { cartografiaContextProvider } from '@/lib/cartografia/context-provider';
import { evaluarPlaneacion } from '@/lib/planeaciones-evaluator';
import { planeacionesOrchestrator } from '@/lib/planeaciones/orchestrator';
import { horariosOrchestrator } from '@/lib/horarios/orchestrator';
import { pmcOrchestrator, PmcOrchestratorError } from '@/lib/pmc/orchestrator';
import { paecOrchestrator, PaecOrchestratorError } from '@/lib/paec/orchestrator';
import { setFeatureFlag, resetFeatureFlags } from '@/lib/platform/feature-flags';

describe('D-01 Checklist de Paridad Contractual Legacy vs Orquestadores V2 (7 Rutas)', () => {
  const mockTeacher = {
    id: 'teacher-parity-uuid-1',
    email: 'docente.test@puebla.gob.mx',
    nombre: 'Profesor de Prueba',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
    vi.mocked(auth).mockResolvedValue({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  const validIngestedDoc = {
    fullText: 'Reporte oficial institucional SEMS Puebla con longitud superior a cuarenta caracteres para validación de formato.',
    markdown: 'Reporte oficial institucional SEMS Puebla con longitud superior a cuarenta caracteres para validación de formato.',
  };

  // ── RUTA 1: /api/pmc/estadistica-911 ───────────────────────────────────────
  it('Ruta 1 (/api/pmc/estadistica-911): Paridad de contrato y HTTP 200 entre legacy y orquestador', async () => {
    const ai911Json = JSON.stringify({
      cct: '21EBH0045A',
      nombre: 'Plantel de Prueba',
      turno: 'MATUTINO',
      matricula: 240,
      egresados: 196,
      aprobados: 205,
      reprobados: 35,
      bajasDefinitivas: 15,
      eficienciaTerminal: 81.6,
      abandono: 6.2,
      reprobacion: 14.5,
    });

    const createReq = () => {
      const file = new File(['buffer 911'], 'estadistica911.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('momento', 'inicio');
      return new NextRequest('http://localhost:3000/api/pmc/estadistica-911', { method: 'POST', body: formData });
    };

    // 1. Ejecutar Legacy (Flag OFF)
    setFeatureFlag('PMC_ORCHESTRATOR_V2', false);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(ai911Json);
    const legacyRes = await handlePmc911Post(createReq());
    const legacyJson = await legacyRes.json();

    // 2. Ejecutar Orquestador (Flag ON)
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(ai911Json);
    const orchRes = await handlePmc911Post(createReq());
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(Object.keys(legacyJson).sort()).toEqual(Object.keys(orchJson).sort());
    expect(orchJson.success).toBe(true);
    expect(orchJson.filename).toBe(legacyJson.filename);
    expect(orchJson.data.matricula).toBe(legacyJson.data.matricula);
  });

  // ── RUTA 2: /api/pmc/f11 ──────────────────────────────────────────────────
  it('Ruta 2 (/api/pmc/f11): Paridad de contrato y HTTP 200 entre legacy y orquestador', async () => {
    const aiF11Json = JSON.stringify({
      schoolName: 'Bachillerato General Puebla',
      schoolCct: '21EBH0045A',
      cicloEscolar: '2025-2026',
      semestre: 'A',
      totalAlumnos: 240,
      aprobadosPorcentaje: 85.5,
      reprobadosPorcentaje: 14.5,
      promedioGeneral: 8.4,
      promediosPorAsignatura: { 'Pensamiento Matemático I': 7.8 },
      materiasMayorReprobacion: [],
    });

    const createReq = () => {
      const file = new File(['buffer f11'], 'f11_reporte.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      return new NextRequest('http://localhost:3000/api/pmc/f11', { method: 'POST', body: formData });
    };

    // 1. Legacy
    setFeatureFlag('PMC_ORCHESTRATOR_V2', false);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(aiF11Json);
    const legacyRes = await handlePmcF11Post(createReq());
    const legacyJson = await legacyRes.json();

    // 2. Orquestador
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(aiF11Json);
    const orchRes = await handlePmcF11Post(createReq());
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(Object.keys(legacyJson).sort()).toEqual(Object.keys(orchJson).sort());
    expect(orchJson.success).toBe(true);
    expect(orchJson.data.schoolCct).toBe(legacyJson.data.schoolCct);
    expect(orchJson.data.promedioGeneral).toBe(legacyJson.data.promedioGeneral);
  });

  // ── RUTA 3: /api/pmc/parse-previous ────────────────────────────────────────
  it('Ruta 3 (/api/pmc/parse-previous): Paridad de contrato y HTTP 200 entre legacy y orquestador', async () => {
    const aiPreviousJson = JSON.stringify({
      schoolName: 'Bachillerato Digital Núm. 45',
      schoolCct: '21EBH0045A',
      cicloEscolar: '2024-2025',
      directorName: 'Mtro. Director',
      staffData: [{ nombre: 'Docente Uno', cargo: 'Docente', metas_individuales: [] }],
    });

    const createReq = () => {
      const file = new File(['buffer pmc'], 'pmc_anterior.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const formData = new FormData();
      formData.append('file', file);
      return new NextRequest('http://localhost:3000/api/pmc/parse-previous', { method: 'POST', body: formData });
    };

    // 1. Legacy
    setFeatureFlag('PMC_ORCHESTRATOR_V2', false);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(aiPreviousJson);
    const legacyRes = await handlePmcParsePreviousPost(createReq());
    const legacyJson = await legacyRes.json();

    // 2. Orquestador
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(aiPreviousJson);
    const orchRes = await handlePmcParsePreviousPost(createReq());
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(Object.keys(legacyJson).sort()).toEqual(Object.keys(orchJson).sort());
    expect(orchJson.success).toBe(true);
    expect(orchJson.data.schoolCct).toBe(legacyJson.data.schoolCct);
  });

  // ── RUTA 4: /api/paec/parse-previous ───────────────────────────────────────
  it('Ruta 4 (/api/paec/parse-previous): Paridad de contrato y HTTP 200 entre legacy y orquestador', async () => {
    const aiPaecJson = JSON.stringify({
      projectName: 'Proyecto Ecológico y Comunitario 2024',
      objective: 'Fomentar la sustentabilidad escolar',
      problem: 'Acumulación de residuos sólidos',
      studentContext: 'Comunidad semiurbana',
      schoolName: 'Bachillerato General Puebla',
      cct: '21EBH0045A',
      municipality: 'Puebla',
      planOperativo: [],
    });

    const createReq = () => {
      const file = new File(['buffer paec'], 'paec_anterior.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      return new NextRequest('http://localhost:3000/api/paec/parse-previous', { method: 'POST', body: formData });
    };

    // 1. Legacy
    setFeatureFlag('PAEC_ORCHESTRATOR_V2', false);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(aiPaecJson);
    const legacyRes = await handlePaecParsePreviousPost(createReq());
    const legacyJson = await legacyRes.json();

    // 2. Orquestador
    setFeatureFlag('PAEC_ORCHESTRATOR_V2', true);
    vi.mocked(ingestDocument).mockResolvedValueOnce(validIngestedDoc as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(aiPaecJson);
    const orchRes = await handlePaecParsePreviousPost(createReq());
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(Object.keys(legacyJson).sort()).toEqual(Object.keys(orchJson).sort());
    expect(orchJson.success).toBe(true);
    expect(orchJson.data.projectName).toBe(legacyJson.data.projectName);
  });

  // ── RUTA 5: /api/planeaciones/evaluar ──────────────────────────────────────
  it('Ruta 5 (/api/planeaciones/evaluar): Paridad de contrato { success, resultado, cached } entre legacy y orquestador', async () => {
    const mockEvalOutput = {
      rubricaUsada: 'Anexo 12 USICAMM — Semestres 1-4',
      puntajeTotal: 280,
      puntajeMaximo: 300,
      nivelCumplimiento: 'COMPLETO',
      criterios: [],
      puntosFuertes: ['Coherencia curricular'],
      areasMejora: ['Mayor contextualización comunitaria'],
      recomendaciones: ['Integrar producto integrador situado'],
    };

    const createReq = () => {
      return new NextRequest('http://localhost:3000/api/planeaciones/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asignatura: 'Pensamiento Matemático I',
          semestre: '1',
          docenteNombre: 'Profesor Evaluado',
          textoPlanificacion: 'Planificación didáctica detallada con inicio, desarrollo y cierre.',
          textoPaecPec: 'Contexto comunitario del proyecto escolar.',
        }),
      });
    };

    // 1. Legacy
    setFeatureFlag('PLANEACION_ORCHESTRATOR_V2', false);
    vi.mocked(evaluarPlaneacion).mockResolvedValueOnce(mockEvalOutput as never);
    const legacyRes = await handlePlaneacionesEvaluarPost(createReq());
    const legacyJson = await legacyRes.json();

    // 2. Orquestador
    setFeatureFlag('PLANEACION_ORCHESTRATOR_V2', true);
    vi.spyOn(planeacionesOrchestrator, 'evaluate').mockResolvedValueOnce(mockEvalOutput as never);
    const orchRes = await handlePlaneacionesEvaluarPost(createReq());
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(legacyJson.success).toBe(true);
    expect(orchJson.success).toBe(true);
    expect(legacyJson.cached).toBe(false);
    expect(orchJson.cached).toBe(false);
    expect(orchJson.resultado.puntajeTotal).toBe(legacyJson.resultado.puntajeTotal);
  });

  // ── RUTA 6: /api/pips/parse-excel ──────────────────────────────────────────
  it('Ruta 6 (/api/pips/parse-excel): Paridad de contrato { success, filename, momento1, momento2 } entre legacy y orquestador', async () => {
    const mockCartografiaData = {
      success: true,
      filename: 'matriz_zona.xlsx',
      momento1: { zonaEscolar: '001', escuelas: [] },
      momento2: { diagnostico: 'Prioridad media', planteles: [] },
    };

    const createReq = () => {
      const file = new File(['buffer excel'], 'matriz_zona.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('zonaNumero', '001');
      formData.append('cicloEscolar', '2025-2026');
      return new NextRequest('http://localhost:3000/api/pips/parse-excel', { method: 'POST', body: formData });
    };

    // 1. Legacy
    setFeatureFlag('CARTOGRAFIA_ORCHESTRATOR_V2', false);
    vi.mocked(parseCartografiaMatriz).mockResolvedValueOnce(mockCartografiaData as never);
    const legacyRes = await handlePipsParseExcelPost(createReq());
    const legacyJson = await legacyRes.json();

    // 2. Orquestador
    setFeatureFlag('CARTOGRAFIA_ORCHESTRATOR_V2', true);
    vi.spyOn(cartografiaContextProvider, 'ingestZoneMatrix').mockResolvedValueOnce(mockCartografiaData as never);
    const orchRes = await handlePipsParseExcelPost(createReq());
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(legacyJson.success).toBe(true);
    expect(orchJson.success).toBe(true);
    expect(Object.keys(legacyJson).sort()).toEqual(Object.keys(orchJson).sort());
    expect(orchJson.filename).toBe(legacyJson.filename);
  });

  // ── RUTA 7: /api/schedules/[id]/optimize ───────────────────────────────────
  it('Ruta 7 (/api/schedules/[id]/optimize): Paridad de contrato { ok, schedule, optimizations, solverResult } entre legacy y orquestador', async () => {
    const mockSchedule = {
      id: 'sched-123',
      school_name: 'Plantel Horarios',
      celdas: [],
      metricas: { huecosDocentes: 2 },
      ai_optimization_log: [],
    };
    const mockOptimizedSchedule = {
      ...mockSchedule,
      metricas: { huecosDocentes: 0 },
    };

    const createReq = () => {
      return new NextRequest('http://localhost:3000/api/schedules/sched-123/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reSolve: false, aiFeedback: false }),
      });
    };

    // Configurar schedule mock común para legacy y orquestador
    vi.mocked(getScheduleById).mockResolvedValue(mockSchedule as never);
    vi.mocked(updateSchedule).mockResolvedValue(mockOptimizedSchedule as never);

    // 1. Legacy
    setFeatureFlag('HORARIOS_ORCHESTRATOR_V2', false);
    const legacyRes = await handleSchedulesOptimizePost(createReq(), { params: Promise.resolve({ id: 'sched-123' }) });
    const legacyJson = await legacyRes.json();

    // 2. Orquestador
    setFeatureFlag('HORARIOS_ORCHESTRATOR_V2', true);
    vi.spyOn(horariosOrchestrator, 'optimizeSchedule').mockResolvedValueOnce({
      ok: true,
      schedule: mockOptimizedSchedule,
      optimizations: [],
      solverResult: null,
    } as never);
    const orchRes = await handleSchedulesOptimizePost(createReq(), { params: Promise.resolve({ id: 'sched-123' }) });
    const orchJson = await orchRes.json();

    expect(legacyRes.status).toBe(200);
    expect(orchRes.status).toBe(200);
    expect(legacyJson.ok).toBe(true);
    expect(orchJson.ok).toBe(true);
    expect(Object.keys(legacyJson).sort()).toEqual(Object.keys(orchJson).sort());
    expect(orchJson.schedule.id).toBe(legacyJson.schedule.id);
  });

  // ── SECCIÓN 8: GAPS CONOCIDOS 501 (POLÍTICA B-001) ─────────────────────────
  it('Gaps Conocidos 501: Los métodos de flujo no implementados en orquestadores reportan 501 de forma explícita', async () => {
    // PMC Orchestrator gaps
    await expect(pmcOrchestrator.generate()).rejects.toThrowError(PmcOrchestratorError);
    await expect(pmcOrchestrator.importPaec()).rejects.toThrowError(PmcOrchestratorError);
    await expect(pmcOrchestrator.renderDOCX()).rejects.toThrowError(PmcOrchestratorError);

    // PAEC Orchestrator gaps
    await expect(paecOrchestrator.generateProject()).rejects.toThrowError(PaecOrchestratorError);
    await expect(paecOrchestrator.auditProject()).rejects.toThrowError(PaecOrchestratorError);
    await expect(paecOrchestrator.renderDOCX()).rejects.toThrowError(PaecOrchestratorError);
    await expect(paecOrchestrator.renderPDF()).rejects.toThrowError(PaecOrchestratorError);

    try {
      await pmcOrchestrator.generate();
    } catch (err) {
      expect((err as PmcOrchestratorError).status).toBe(501);
    }

    try {
      await paecOrchestrator.generateProject();
    } catch (err) {
      expect((err as PaecOrchestratorError).status).toBe(501);
    }
  });
});
