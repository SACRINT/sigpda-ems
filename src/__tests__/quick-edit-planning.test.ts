/**
 * quick-edit-planning.test.ts
 * Pruebas unitarias e invariantes para Nivel 1 — Edición Rápida de Datos (Premium / Admin)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  getPlanningById: vi.fn(),
  deletePlanning: vi.fn(),
  updatePlanningContent: vi.fn(),
}));

vi.mock('@/lib/subscription-gate', () => ({
  getSubscriptionStatus: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, updatePlanningContent } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { PUT } from '@/app/api/plannings/[id]/route';

describe('Nivel 1: PUT /api/plannings/[id] — Guardián de Edición Rápida', () => {
  const planningId = '166f816d-7a66-46dc-b5b6-b1ccda273353';
  const teacherId = 'teacher-uuid-001';
  const teacherEmail = 'docente@ejemplo.edu.mx';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Debe rechazar con 401 si no hay sesión autenticada', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const req = new NextRequest(`http://localhost:3000/api/plannings/${planningId}`, {
      method: 'PUT',
      body: JSON.stringify({ content_json: { sectionI: { groups: '3°A' } } }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: planningId }) });
    expect(res.status).toBe(401);
  });

  it('2. Debe rechazar con 403 Forbidden a usuarios gratuitos (sin suscripción y no admin)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: teacherEmail },
      expires: '2026-12-31',
    });
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce({
      id: teacherId,
      email: teacherEmail,
      name: 'Docente Prueba',
    } as never);
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
      hasActiveSubscription: false,
      isAdmin: false,
    } as never);

    const req = new NextRequest(`http://localhost:3000/api/plannings/${planningId}`, {
      method: 'PUT',
      body: JSON.stringify({ content_json: { sectionI: { groups: '3°A' } } }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('función exclusiva del Plan Premium');
    expect(updatePlanningContent).not.toHaveBeenCalled();
  });

  it('3. Debe autorizar y actualizar si el usuario es Administrador (tus cuentas)', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@sigpda.mx' },
      expires: '2026-12-31',
    });
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce({
      id: teacherId,
      email: 'admin@sigpda.mx',
      name: 'Admin Master',
    } as never);
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
      hasActiveSubscription: false,
      isAdmin: true,
    } as never);

    const updatedContent = {
      sectionI: { groups: '3°B', teacherName: 'Prof. Actualizado' },
      sectionII: { purpose: 'Propósito Corregido' },
    };

    vi.mocked(updatePlanningContent).mockResolvedValueOnce({
      id: planningId,
      teacher_id: teacherId,
      content_json: updatedContent,
      status: 'generated',
    } as never);

    const req = new NextRequest(`http://localhost:3000/api/plannings/${planningId}`, {
      method: 'PUT',
      body: JSON.stringify({ content_json: updatedContent }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updatePlanningContent).toHaveBeenCalledWith(planningId, teacherId, updatedContent);
  });

  it('4. Debe autorizar y actualizar si el usuario tiene Suscripción Premium Activa', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: teacherEmail },
      expires: '2026-12-31',
    });
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce({
      id: teacherId,
      email: teacherEmail,
      name: 'Docente Premium',
    } as never);
    vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
      hasActiveSubscription: true,
      isAdmin: false,
    } as never);

    const updatedContent = {
      sectionI: { groups: '3°A' },
    };

    vi.mocked(updatePlanningContent).mockResolvedValueOnce({
      id: planningId,
      teacher_id: teacherId,
      content_json: updatedContent,
      status: 'generated',
    } as never);

    const req = new NextRequest(`http://localhost:3000/api/plannings/${planningId}`, {
      method: 'PUT',
      body: JSON.stringify({ content_json: updatedContent }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updatePlanningContent).toHaveBeenCalledWith(planningId, teacherId, updatedContent);
  });
});

