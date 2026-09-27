// src/__tests__/pmc-put-guard.test.ts
/**
 * Tests para la validación determinista de términos prohibidos (SIGPDA/SIGPDA-EMS)
 * en el handler PUT de PMC (H-144).
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

import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { PUT } from '@/app/api/pmc/[id]/route';

describe('H-144 — Guard contra términos prohibidos en actualización PUT de PMC', () => {
  const mockTeacher = {
    id: 'teacher-uuid-1',
    email: 'director@puebla.gob.mx',
    name: 'Prof. Alejandro Escamilla',
  };

  const projectId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
  });

  it('1. Actualización limpia con PUT: retorna status 200 y persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([{ id: projectId }]) // SELECT existing
      .mockResolvedValueOnce([{ id: projectId, school_name: 'Bachillerato General Actualizado' }]); // UPDATE

    vi.mocked(sql).mockReturnValue(mockDb as never);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({
        school_name: 'Bachillerato General Actualizado',
        plan_accion: {
          metas_institucionales: [
            { meta: 'Meta en la plataforma institucional de planeación docente para 2026-2027' },
          ],
        },
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: projectId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDb).toHaveBeenCalledTimes(2); // SELECT + UPDATE
  });

  it('2. PUT con plan_accion contaminado con "SIGPDA-EMS": rechaza con HTTP 422 y NO persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([{ id: projectId }]); // SELECT existing

    vi.mocked(sql).mockReturnValue(mockDb as never);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({
        plan_accion: {
          metas_institucionales: [
            { meta: 'Meta de planeación docente en SIGPDA-EMS durante el ciclo 2026-2027' },
          ],
        },
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: projectId }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('términos prohibidos de plataforma privada');
    expect(data.forbiddenTerms).toContain('SIGPDA-EMS');
    // CRÍTICO: el UPDATE a la base de datos NUNCA debe ejecutarse
    expect(mockDb).toHaveBeenCalledTimes(1); // Solo SELECT, NUNCA UPDATE
  });

  it('3. PUT con diagnostico_generado contaminado con "SIGPDA": rechaza con HTTP 422 y NO persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([{ id: projectId }]); // SELECT existing

    vi.mocked(sql).mockReturnValue(mockDb as never);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({
        diagnostico_generado: {
          presentacion: 'Presentación formal en el sistema SIGPDA para seguimiento docente.',
        },
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: projectId }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('términos prohibidos de plataforma privada');
    expect(data.forbiddenTerms).toContain('SIGPDA');
    expect(mockDb).toHaveBeenCalledTimes(1); // Solo SELECT, NUNCA UPDATE
  });

  it('4. PUT con foda contaminado con "SIGPDA EMS": rechaza con HTTP 422 y NO persiste en BD', async () => {
    const mockDb = vi.fn()
      .mockResolvedValueOnce([{ id: projectId }]); // SELECT existing

    vi.mocked(sql).mockReturnValue(mockDb as never);

    const req = new NextRequest(`http://localhost:3000/api/pmc/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({
        foda: {
          fortalezas: 'Fortalezas sustentadas en la herramienta SIGPDA EMS.',
        },
      }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: projectId }) });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain('términos prohibidos de plataforma privada');
    expect(data.forbiddenTerms).toContain('SIGPDA EMS');
    expect(mockDb).toHaveBeenCalledTimes(1); // Solo SELECT, NUNCA UPDATE
  });
});
