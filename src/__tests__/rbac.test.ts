import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
}));

vi.mock('@/lib/admin-unified', () => ({
  isAdmin: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { isAdmin } from '@/lib/admin-unified';
import {
  DIRECTIVO_ROLES,
  HORARIOS_READ_ROLES,
  SUPERVISION_ROLES,
  assertRole,
  guardRole,
} from '@/lib/rbac';

describe('RBAC guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite un rol directivo sin consultar la tabla de administradores', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'director@escuela.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'teacher-1',
      email: 'director@escuela.mx',
      role: 'director',
    } as never);

    const result = await guardRole(DIRECTIVO_ROLES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.role).toBe('director');
      expect(result.context.teacher.id).toBe('teacher-1');
    }
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it('permite acceso administrativo por fallback de isAdmin', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@escuela.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'teacher-2',
      email: 'admin@escuela.mx',
      role: 'docente',
    } as never);
    vi.mocked(isAdmin).mockResolvedValue(true as never);

    const result = await guardRole(DIRECTIVO_ROLES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.isAdmin).toBe(true);
      expect(result.context.role).toBe('administrador');
    }
    expect(isAdmin).toHaveBeenCalledWith('admin@escuela.mx', 'docente');
  });

  it('rechaza un rol no autorizado con HTTP 403', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'docente@escuela.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'teacher-3',
      email: 'docente@escuela.mx',
      role: 'docente',
    } as never);
    vi.mocked(isAdmin).mockResolvedValue(false as never);

    const result = await guardRole(DIRECTIVO_ROLES);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.code).toBe('FORBIDDEN');
    }
  });

  it('rechaza una solicitud sin sesión con HTTP 401', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await guardRole(DIRECTIVO_ROLES);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('retorna HTTP 404 si el docente no existe', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'fantasma@escuela.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(null as never);

    const result = await guardRole(DIRECTIVO_ROLES);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it('permite supervisión en la lectura de configuración de horarios', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'supervisor@escuela.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'teacher-4',
      email: 'supervisor@escuela.mx',
      role: 'supervisor',
    } as never);

    const result = await guardRole(HORARIOS_READ_ROLES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.role).toBe('supervisor');
    }
  });

  it('rechaza supervisión en rutas exclusivas de PMC', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'supervisor@escuela.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'teacher-5',
      email: 'supervisor@escuela.mx',
      role: 'supervisor',
    } as never);
    vi.mocked(isAdmin).mockResolvedValue(false as never);

    await expect(assertRole(DIRECTIVO_ROLES)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    expect(SUPERVISION_ROLES).toContain('supervisor');
  });
});
