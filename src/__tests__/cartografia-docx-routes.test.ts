// src/__tests__/cartografia-docx-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

const mockSqlTag = vi.fn();
vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  sql: () => mockSqlTag,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { GET as handleDocxIIV } from '@/app/api/docx/cartografia/[id]/route';
import { GET as handleDocxResumen } from '@/app/api/docx/cartografia/[id]/resumen/route';

const mockTeacher = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'supervisor@puebla.gob.mx',
  name: 'Mtro. José Luis Benítez',
};

const mockProjectRow = {
  id: '11111111-1111-1111-1111-111111111111',
  teacher_id: '00000000-0000-0000-0000-000000000001',
  zona_nombre: 'Zona Escolar 004',
  zona_clave: '21FZP0004Z',
  supervisor_name: 'Mtro. José Luis Benítez',
  ciclo_escolar: '2026-2027',
  subsistema: 'DBEPA',
  status: 'completed',
  num_planteles: 2,
  planteles_json: JSON.stringify([
    { no: 1, cct: '21EBH1039R', nombre: 'Bachillerato Digital Núm. 153', localidad: 'San Baltazar', municipio: 'Puebla', turno: 'Matutino', total: 180 },
  ]),
};

describe('API Routes: Descargas DOCX de Cartografía de Zona', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/docx/cartografia/[id] (Proyecto Completo I-IV)', () => {
    it('retorna 401 si no hay sesión autenticada', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as never);
      const req = new NextRequest('http://localhost:3000/api/docx/cartografia/11111111-1111-1111-1111-111111111111');
      const res = await handleDocxIIV(req, { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('No autorizado');
    });

    it('retorna 404 si el proyecto no pertenece al docente', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
      mockSqlTag.mockResolvedValueOnce([]); // no rows found

      const req = new NextRequest('http://localhost:3000/api/docx/cartografia/11111111-1111-1111-1111-111111111111');
      const res = await handleDocxIIV(req, { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Proyecto no encontrado');
    });

    it('retorna 200 con archivo DOCX y headers de calidad si el proyecto existe', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
      mockSqlTag.mockResolvedValueOnce([mockProjectRow]);

      const req = new NextRequest('http://localhost:3000/api/docx/cartografia/11111111-1111-1111-1111-111111111111');
      const res = await handleDocxIIV(req, { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="Cartografia_Zona_');
      expect(res.headers.get('X-Quality-Score')).toBeDefined();
    });
  });

  describe('GET /api/docx/cartografia/[id]/resumen (Resumen Ejecutivo)', () => {
    it('retorna 401 si no hay sesión autenticada', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as never);
      const req = new NextRequest('http://localhost:3000/api/docx/cartografia/11111111-1111-1111-1111-111111111111/resumen');
      const res = await handleDocxResumen(req, { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) });
      expect(res.status).toBe(401);
    });

    it('retorna 200 con archivo DOCX del Resumen Ejecutivo', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
      mockSqlTag.mockResolvedValueOnce([mockProjectRow]);

      const req = new NextRequest('http://localhost:3000/api/docx/cartografia/11111111-1111-1111-1111-111111111111/resumen');
      const res = await handleDocxResumen(req, { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(res.headers.get('Content-Disposition')).toContain('Resumen_Ejecutivo_Zona_');
      expect(res.headers.get('X-Quality-Score')).toBeDefined();
    });
  });
});
