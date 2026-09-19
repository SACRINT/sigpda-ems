/**
 * db.test.ts
 * Unit tests for src/lib/db.ts — core database query functions.
 *
 * Strategy: Mock @neondatabase/serverless so neon() returns a vi.fn() that
 * works as a tagged-template function (template literals desugar to fn(strings, ...values)).
 * Dynamic imports of key-rotator (decryptKey) are hoisted via vi.mock.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ── Mocks (hoisted before any src imports) ────────────────────────────────────

/** Shared tagged-template mock for every neon client in the module */
const mockQueryFn = vi.fn().mockResolvedValue([]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));

vi.mock('@/lib/ai-provider/key-rotator', () => ({
  decryptKey: vi.fn((s: string) => `decrypted:${s}`),
  encryptKey: vi.fn((s: string) => `encrypted:${s}`),
}));

// ── Module under test (imported AFTER mocks) ──────────────────────────────────

import {
  getTeacherByEmail,
  getTeacherById,
  getPlanningsByTeacher,
  getPlanningById,
  createPlanning,
  updateTeacherProfile,
} from '@/lib/db';

// ─────────────────────────────────────────────────────────────────────────────

describe('db.ts — Core Database Queries', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('ADMIN_ENCRYPTION_KEY', '01234567890123456789012345678901'); // 32 chars
  });

  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([]); // default: empty result
  });

  // ── Teacher queries ─────────────────────────────────────────────────────────

  it('getTeacherByEmail — hit: retorna teacher con custom_api_key descifrado', async () => {
    const mockRow = {
      id: 'uuid-teacher-001',
      name: 'Docente Test',
      email: 'docente@plantel.mx',
      custom_api_key: 'enc-key-abc',
      custom_api_provider: 'gemini',
      role: 'docente',
      is_premium: false,
    };
    mockQueryFn.mockResolvedValueOnce([mockRow]);

    const result = await getTeacherByEmail('Docente@Plantel.mx'); // normaliza a lower
    expect(result).not.toBeNull();
    expect(result.email).toBe('docente@plantel.mx');
    // decryptKey fue llamado y reemplazó el valor
    expect(result.custom_api_key).toBe('decrypted:enc-key-abc');
  });

  it('getTeacherByEmail — miss: retorna null cuando no existe el correo', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getTeacherByEmail('noexiste@test.mx');
    expect(result).toBeNull();
  });

  it('getTeacherById — hit sin custom_api_key: no llama a decryptKey', async () => {
    const { decryptKey } = await import('@/lib/ai-provider/key-rotator');
    (decryptKey as ReturnType<typeof vi.fn>).mockClear();

    mockQueryFn.mockResolvedValueOnce([{
      id: 'uuid-teacher-002',
      name: 'Sin Clave',
      email: 'sin-clave@test.mx',
      custom_api_key: null,
    }]);

    const result = await getTeacherById('uuid-teacher-002');
    expect(result).not.toBeNull();
    expect(decryptKey).not.toHaveBeenCalled();
    expect(result.custom_api_key).toBeNull();
  });

  // ── Planning queries ────────────────────────────────────────────────────────

  it('getPlanningsByTeacher — retorna array de planeaciones ordenado por fecha', async () => {
    const mockPlannings = [
      { id: 'p-1', teacher_id: 'tid', uac_name: 'Matemáticas', semester: 2, status: 'completed' },
      { id: 'p-2', teacher_id: 'tid', uac_name: 'Física',       semester: 2, status: 'draft'     },
    ];
    mockQueryFn.mockResolvedValueOnce(mockPlannings);

    const result = await getPlanningsByTeacher('uuid-teacher-001');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].uac_name).toBe('Matemáticas');
    expect(result[1].status).toBe('draft');
  });

  it('getPlanningById — hit sin teacherId: retorna la planeación', async () => {
    mockQueryFn.mockResolvedValueOnce([{ id: 'p-1', uac_name: 'Física', semester: 3 }]);

    const result = await getPlanningById('p-1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('p-1');
    expect(result.semester).toBe(3);
  });

  it('getPlanningById — miss: retorna null cuando no existe', async () => {
    mockQueryFn.mockResolvedValueOnce([]);

    const result = await getPlanningById('planning-inexistente');
    expect(result).toBeNull();
  });

  it('createPlanning — retorna la planeación creada con status draft', async () => {
    const mockInserted = {
      id: 'new-uuid-planning',
      teacher_id: 'uuid-teacher-001',
      uac_name: 'Química',
      semester: 3,
      component: 'Fundamental',
      status: 'draft',
    };
    mockQueryFn.mockResolvedValueOnce([mockInserted]);

    const result = await createPlanning({
      teacherId:  'uuid-teacher-001',
      uacName:    'Química',
      semester:   3,
      component:  'Fundamental',
    });

    expect(result.id).toBe('new-uuid-planning');
    expect(result.status).toBe('draft');
    expect(result.uac_name).toBe('Química');
  });

  it('updateTeacherProfile — retorna el perfil actualizado', async () => {
    const mockUpdated = {
      id: 'uuid-teacher-001',
      school_name: 'COBAEP 01',
      municipality: 'Puebla',
      cct: '21EBH0001X',
      profile_completed: true,
    };
    mockQueryFn.mockResolvedValueOnce([mockUpdated]);

    const result = await updateTeacherProfile('uuid-teacher-001', {
      schoolName:   'COBAEP 01',
      municipality: 'Puebla',
      cct:          '21EBH0001X',
    });

    expect(result.profile_completed).toBe(true);
    expect(result.municipality).toBe('Puebla');
  });
});
