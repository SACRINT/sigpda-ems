import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  sql: vi.fn(() => vi.fn().mockResolvedValue([])),
}));

vi.mock('@/lib/db/teachers', () => ({
  getTeacherSchoolZone: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  sql: vi.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/estatus-entrega/route';
import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { getTeacherSchoolZone } from '@/lib/db/teachers';
import { sql } from '@/lib/db/client';

describe('API Admin — GET /api/admin/estatus-entrega (Tarea D.1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Debe responder 401 si no hay sesión activa', async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = new NextRequest('http://localhost:3000/api/admin/estatus-entrega');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('2. Debe responder 403 si el rol es docente ordinario', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'docente@test.edu' } } as any);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'docente-1',
      role: 'docente',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/admin/estatus-entrega');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('3. Debe responder 403 para director si no tiene CCT ni nombre de escuela', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'director@test.edu' } } as any);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'dir-1',
      role: 'director',
      cct: null,
      school_name: null,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/admin/estatus-entrega');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('CCT ni nombre de escuela');
  });

  it('4. Debe autorizar y retornar estadísticas para director con CCT', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'director@test.edu' } } as any);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'dir-1',
      role: 'director',
      cct: '21EBH0001A',
      school_name: 'Bachillerato Héroes de la Patria',
    } as any);

    const mockStats = [
      {
        total_planeaciones: 10,
        generadas: 8,
        borradores: 2,
        dbepa_verde: 7,
        anexo12_conforme: 8,
      },
    ];

    const mockItems = [
      {
        id: 'p-1',
        docente_nombre: 'Profesor Uno',
        docente_cct: '21EBH0001A',
        escuela: 'Bachillerato Héroes de la Patria',
        uac_name: 'Pensamiento Matemático I',
        semester: 1,
        component: 'fundamental',
        status: 'generated',
        dbepa_semaforo: 'verde',
        anexo12_ok: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockSql = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('COUNT(p.id)')) return Promise.resolve(mockStats);
      return Promise.resolve(mockItems);
    });
    vi.mocked(sql).mockReturnValue(mockSql as any);

    const req = new NextRequest('http://localhost:3000/api/admin/estatus-entrega?page=1&limit=20');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.stats.total_planeaciones).toBe(10);
    expect(data.stats.generadas).toBe(8);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].uac_name).toBe('Pensamiento Matemático I');
    // Privacidad docente: no expone secuencias ni contenidos sensibles
    expect(data.items[0].content_json).toBeUndefined();
    expect(data.items[0].sequence_json).toBeUndefined();
  });

  it('5. Debe autorizar y filtrar por zona escolar para supervisores', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: 'supervisor@test.edu' } } as any);
    vi.mocked(getTeacherByEmail).mockResolvedValue({
      id: 'sup-1',
      role: 'supervisor',
    } as any);
    vi.mocked(getTeacherSchoolZone).mockResolvedValue('Zona 086');

    const mockStats = [
      {
        total_planeaciones: 50,
        generadas: 45,
        borradores: 5,
        dbepa_verde: 40,
        anexo12_conforme: 44,
      },
    ];

    const mockSql = vi.fn().mockImplementation((strings: TemplateStringsArray) => {
      const q = strings.join(' ');
      if (q.includes('COUNT(p.id)')) return Promise.resolve(mockStats);
      return Promise.resolve([]);
    });
    vi.mocked(sql).mockReturnValue(mockSql as any);

    const req = new NextRequest('http://localhost:3000/api/admin/estatus-entrega');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.stats.total_planeaciones).toBe(50);
    expect(getTeacherSchoolZone).toHaveBeenCalledWith('sup-1');
  });
});
