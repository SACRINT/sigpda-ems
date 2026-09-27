// src/__tests__/pmc-generate-step-guard.test.ts
/**
 * Tests para el guard determinista contra términos prohibidos (SIGPDA/SIGPDA-EMS)
 * en la generación de Plan de Acción PMC (Paso 4).
 * H-143 · Fase 12A / Arquitectura PMC
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  resolveUserIsPremium: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock('@/lib/subscription-gate', () => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/idempotency', () => ({
  extractIdempotencyKey: vi.fn(() => null),
  checkIdempotencyKey: vi.fn(async () => null),
  createIdempotencyKey: vi.fn(),
}));

vi.mock('@/lib/context-extractor', () => ({
  getUserLibraryContext: vi.fn(async () => ''),
}));

vi.mock('@/lib/normativa-context', () => ({
  getNormativaForGenerator: vi.fn(async () => ''),
  getStructuredNormativaForGenerator: vi.fn(async () => []),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { POST } from '@/app/api/pmc/[id]/generate-step/route';

describe('H-143 — Guard determinista contra términos prohibidos en generate-step (plan_accion)', () => {
  const mockTeacher = {
    id: 'teacher-uuid-1',
    email: 'director@puebla.gob.mx',
    name: 'Prof. Alejandro Escamilla',
  };

  const mockProject = {
    id: 'pmc-proj-4061b476',
    teacher_id: mockTeacher.id,
    school_name: 'Bachillerato General Francisco Z. Mena',
    school_cct: '21EBH0465E',
    school_zone: '004',
    municipality: 'Francisco Z. Mena',
    ciclo_escolar: '2026-2027',
    current_step: 3,
    indicadores_academicos: JSON.stringify({
      aprobacion_ant: 85,
      reprobacion_ant: 15,
      abandono_ant: 4,
      et_ant: 88,
    }),
    staff_data: JSON.stringify([
      { nombre: 'Maria Perez', cargo: 'Docente de Lengua' },
      { nombre: 'Juan Lopez', cargo: 'Docente de Matematicas' },
    ]),
    statistical_context: null,
  };

  const contaminatedAiPayload = JSON.stringify({
    metas_institucionales: [
      {
        categoria: '1',
        nombre_categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Seguimiento al desempeño docente en el aula',
        diagnostico_meta: 'Rezago en planeación y retroalimentación',
        meta: 'Lograr que el 100% de la plantilla docente consolide y valide sus planeaciones didácticas en el SIGPDA-EMS durante el ciclo escolar 2026-2027 en Puebla',
        estrategia: 'Reuniones quincenales de academia docente para armonizar secuencias didácticas',
        linea_base: 'Eficiencia terminal: 74%',
        personal_designado: 'Director y Consejo Académico',
        entregable: 'Concentrado de planeaciones didácticas registradas y evaluadas en SIGPDA-EMS',
        periodo_inicio: '08/2026',
        periodo_fin: '06/2027',
      },
    ],
    metas_personales: [],
  });

  const cleanAiPayload = JSON.stringify({
    metas_institucionales: [
      {
        categoria: '1',
        nombre_categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Seguimiento al desempeño docente en el aula',
        diagnostico_meta: 'Rezago en planeación y retroalimentación',
        meta: 'Lograr que el 100% de la plantilla docente consolide y valide sus planeaciones didácticas en la plataforma institucional de planeación docente durante el ciclo escolar 2026-2027 en Puebla',
        estrategia: 'Reuniones quincenales de academia docente para armonizar secuencias didácticas',
        linea_base: 'Eficiencia terminal: 74%',
        personal_designado: 'Director y Consejo Académico',
        entregable: 'Concentrado de planeaciones didácticas registradas y evaluadas por el órgano colegiado',
        periodo_inicio: '08/2026',
        periodo_fin: '06/2027',
      },
    ],
    metas_personales: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(getSubscriptionStatus).mockResolvedValue({ hasActiveSubscription: true, isAdmin: false } as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValue(true as never);
  });

  it('1. Generación limpia a la primera: persiste en BD y retorna status 200', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([mockProject]) // SELECT
      .mockResolvedValueOnce([{ ...mockProject, current_step: 4 }]); // UPDATE

    vi.mocked(sql).mockReturnValue(mockDb as never);
    vi.mocked(generateWithRotation).mockResolvedValueOnce(cleanAiPayload);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${mockProject.id}/generate-step`, {
      method: 'POST',
      body: JSON.stringify({ step: 'plan_accion' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: mockProject.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.plan_accion.metas_institucionales[0].meta).toContain('plataforma institucional');
    expect(generateWithRotation).toHaveBeenCalledTimes(1);
    expect(mockDb).toHaveBeenCalledTimes(2); // SELECT + UPDATE
  });

  it('2. Detección de SIGPDA-EMS en 1er intento -> reintento correctivo exitoso -> persiste plan limpio con status 200', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([mockProject]) // SELECT
      .mockResolvedValueOnce([{ ...mockProject, current_step: 4 }]); // UPDATE

    vi.mocked(sql).mockReturnValue(mockDb as never);
    // 1er intento contaminado, 2do intento limpio
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(contaminatedAiPayload)
      .mockResolvedValueOnce(cleanAiPayload);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${mockProject.id}/generate-step`, {
      method: 'POST',
      body: JSON.stringify({ step: 'plan_accion' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: mockProject.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Verificamos que se ejecutó el reintento
    expect(generateWithRotation).toHaveBeenCalledTimes(2);
    // Verificamos que el segundo llamado recibió la corrección obligatoria
    const secondCallPrompt = vi.mocked(generateWithRotation).mock.calls[1][1];
    expect(secondCallPrompt).toContain('[CORRECCIÓN OBLIGATORIA DEL SISTEMA]');
    expect(secondCallPrompt).toContain('SIGPDA-EMS');
    // Verificamos que se persistió el plan limpio
    expect(mockDb).toHaveBeenCalledTimes(2);
    expect(data.plan_accion.metas_institucionales[0].meta).not.toContain('SIGPDA');
    expect(data.plan_accion.metas_institucionales[0].entregable).not.toContain('SIGPDA');
  });

  it('3. Detección persistente de SIGPDA-EMS tras reintento -> rechaza con HTTP 422 y NO persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([mockProject]); // Solo SELECT

    vi.mocked(sql).mockReturnValue(mockDb as never);
    // Ambos intentos contaminados
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(contaminatedAiPayload)
      .mockResolvedValueOnce(contaminatedAiPayload);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${mockProject.id}/generate-step`, {
      method: 'POST',
      body: JSON.stringify({ step: 'plan_accion' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: mockProject.id }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('términos prohibidos de plataforma privada');
    expect(data.forbiddenTerms).toContain('SIGPDA-EMS');
    expect(generateWithRotation).toHaveBeenCalledTimes(2);
    // CRÍTICO: el UPDATE a la base de datos NUNCA debe ejecutarse
    expect(mockDb).toHaveBeenCalledTimes(1); // Solo SELECT, NUNCA UPDATE
  });

  const contaminatedDiagPayload = JSON.stringify({
    presentacion: 'Presentación formal en el sistema SIGPDA-EMS para el plantel.',
    contexto: 'Contexto educativo regional.',
    analisis_indicadores: 'Aprobación del 85% y retención en seguimiento.',
    sintesis_foda: 'Fortalezas consolidadas mediante uso de SIGPDA.',
    priorizacion: 'Priorización colegiada de indicadores.',
  });

  const cleanDiagPayload = JSON.stringify({
    presentacion: 'Presentación formal en la plataforma institucional de planeación para el plantel.',
    contexto: 'Contexto educativo regional.',
    analisis_indicadores: 'Aprobación del 85% y retención en seguimiento.',
    sintesis_foda: 'Fortalezas consolidadas mediante uso de herramientas académicas oficiales.',
    priorizacion: 'Priorización colegiada de indicadores.',
  });

  it('4. Detección de SIGPDA en step diagnostico -> reintento correctivo exitoso -> status 200 y persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([mockProject]) // SELECT
      .mockResolvedValueOnce([{ ...mockProject, current_step: 3 }]); // UPDATE

    vi.mocked(sql).mockReturnValue(mockDb as never);
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(contaminatedDiagPayload)
      .mockResolvedValueOnce(cleanDiagPayload);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${mockProject.id}/generate-step`, {
      method: 'POST',
      body: JSON.stringify({ step: 'diagnostico' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: mockProject.id }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(generateWithRotation).toHaveBeenCalledTimes(2);
    expect(mockDb).toHaveBeenCalledTimes(2);
    expect(data.diagnostico_generado.presentacion).not.toContain('SIGPDA');
  });

  it('5. Detección persistente de SIGPDA en step diagnostico tras reintento -> rechaza con HTTP 422 y NO persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([mockProject]); // Solo SELECT

    vi.mocked(sql).mockReturnValue(mockDb as never);
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(contaminatedDiagPayload)
      .mockResolvedValueOnce(contaminatedDiagPayload);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${mockProject.id}/generate-step`, {
      method: 'POST',
      body: JSON.stringify({ step: 'diagnostico' }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: mockProject.id }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('términos prohibidos de plataforma privada');
    expect(data.forbiddenTerms.length).toBeGreaterThan(0);
    expect(generateWithRotation).toHaveBeenCalledTimes(2);
    expect(mockDb).toHaveBeenCalledTimes(1); // Solo SELECT, NUNCA UPDATE
  });
});
