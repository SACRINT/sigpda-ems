/**
 * pmc-cartografia-db.test.ts
 * Tests for formal database repositories: PMC and Cartografía (PIPS)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.fn();
vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));

import {
  mapRawPmcProject,
  getPmcProjectsByTeacher,
  getPmcProjectById,
  createPmcProject,
  updatePmcProject,
  updatePmcProjectStep,
  updatePmcAudit,
  deletePmcProject,
  pmcRepository,
} from '@/lib/db/pmc';

import {
  mapRawCartografiaProject,
  getCartografiaProjectsByTeacher,
  getPipsProjectsByTeacher,
  getCartografiaProjectById,
  getPipsProjectById,
  createCartografiaProject,
  createPipsProject,
  updateCartografiaProject,
  updatePipsProject,
  deleteCartografiaProject,
  deletePipsProject,
  cartografiaRepository,
} from '@/lib/db/cartografia';

describe('Formal Repositories — PMC and Cartografía', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PMC Repository (pmc.ts)', () => {
    it('mapRawPmcProject handles null / undefined safely', () => {
      expect(mapRawPmcProject(null)).toBeNull();
      expect(mapRawPmcProject(undefined)).toBeNull();
    });

    it('mapRawPmcProject maps raw DB row to PmcProject', () => {
      const raw = {
        id: 'pmc-123',
        teacher_id: 'teacher-456',
        school_name: 'Bachillerato Digital 01',
        school_cct: '21EBH0001Z',
        current_step: 3,
        status: 'in_progress',
        created_at: new Date('2026-09-01'),
        updated_at: new Date('2026-09-02'),
      };
      const project = mapRawPmcProject(raw);
      expect(project).not.toBeNull();
      expect(project?.id).toBe('pmc-123');
      expect(project?.school_name).toBe('Bachillerato Digital 01');
      expect(project?.current_step).toBe(3);
      expect(project?.status).toBe('in_progress');
    });

    it('getPmcProjectsByTeacher queries by teacher_id and maps rows', async () => {
      mockDb.mockResolvedValueOnce([
        { id: 'p1', teacher_id: 't1', school_name: 'Escuela 1', current_step: 1 },
      ]);
      const result = await getPmcProjectsByTeacher('t1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p1');
      expect(mockDb).toHaveBeenCalledTimes(1);
    });

    it('getPmcProjectById fetches with and without teacherId', async () => {
      mockDb.mockResolvedValueOnce([{ id: 'p1', teacher_id: 't1' }]);
      const resWithTeacher = await getPmcProjectById('p1', 't1');
      expect(resWithTeacher?.id).toBe('p1');

      mockDb.mockResolvedValueOnce([{ id: 'p1' }]);
      const resWithoutTeacher = await getPmcProjectById('p1');
      expect(resWithoutTeacher?.id).toBe('p1');
    });

    it('createPmcProject inserts and returns new project', async () => {
      mockDb.mockResolvedValueOnce([
        { id: 'p-new', teacher_id: 't1', school_name: 'Nueva Esc', school_cct: '21EBH' },
      ]);
      const res = await createPmcProject({
        teacherId: 't1',
        school_name: 'Nueva Esc',
        school_cct: '21EBH',
      });
      expect(res.id).toBe('p-new');
    });

    it('updatePmcProject and updatePmcProjectStep execute properly', async () => {
      mockDb.mockResolvedValueOnce([{ id: 'p1', school_name: 'Updated Name' }]);
      const res = await updatePmcProject('p1', 't1', { school_name: 'Updated Name' });
      expect(res?.school_name).toBe('Updated Name');

      mockDb.mockResolvedValueOnce([{ id: 'p1', current_step: 4 }]);
      const stepRes = await updatePmcProjectStep('p1', 3);
      expect(stepRes?.current_step).toBe(4);
    });

    it('updatePmcAudit and deletePmcProject execute properly', async () => {
      mockDb.mockResolvedValueOnce([]);
      await expect(
        updatePmcAudit('p1', {
          totalScore: 100,
          maxPossibleScore: 100,
          percentage: 100,
          overallStatus: 'EXCELENTE',
          passedCriteria: 10,
          warningCriteria: 0,
          failedCriteria: 0,
          criteria: [],
          dimensionScores: {},
          strengths: [],
          criticalRecommendations: [],
          auditedAt: new Date().toISOString(),
        })
      ).resolves.toBeUndefined();

      mockDb.mockResolvedValueOnce([{ id: 'p1' }]);
      const deleted = await deletePmcProject('p1', 't1');
      expect(deleted).toBe(true);
    });

    it('PmcRepository implements IProgramRepository methods', async () => {
      mockDb.mockResolvedValueOnce([{ id: 'p1', school_name: 'Repo School' }]);
      const found = await pmcRepository.findById('p1');
      expect(found?.school_name).toBe('Repo School');

      mockDb.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }]);
      const all = await pmcRepository.findAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('Cartografía Repository (cartografia.ts)', () => {
    it('mapRawCartografiaProject handles null / undefined safely', () => {
      expect(mapRawCartografiaProject(null)).toBeNull();
      expect(mapRawCartografiaProject(undefined)).toBeNull();
    });

    it('mapRawCartografiaProject provides default fallbacks for missing fields', () => {
      const raw = {
        id: 'cart-1',
        teacher_id: 't-1',
      };
      const project = mapRawCartografiaProject(raw);
      expect(project?.id).toBe('cart-1');
      expect(project?.zona_clave).toBe('');
      expect(project?.subsistema).toBe('BGE');
      expect(project?.current_step).toBe(1);
      expect(project?.status).toBe('draft');
    });

    it('getCartografiaProjectsByTeacher and getPipsProjectsByTeacher alias parity', async () => {
      mockDb.mockResolvedValueOnce([{ id: 'c1', zona_nombre: 'Zona 05' }]);
      const res1 = await getCartografiaProjectsByTeacher('t1');
      expect(res1[0].zona_nombre).toBe('Zona 05');

      mockDb.mockResolvedValueOnce([{ id: 'c1', zona_nombre: 'Zona 05' }]);
      const res2 = await getPipsProjectsByTeacher('t1');
      expect(res2[0].zona_nombre).toBe('Zona 05');
      expect(getPipsProjectsByTeacher).toBe(getCartografiaProjectsByTeacher);
    });

    it('getCartografiaProjectById and getPipsProjectById alias parity', async () => {
      expect(getPipsProjectById).toBe(getCartografiaProjectById);
      mockDb.mockResolvedValueOnce([{ id: 'c1', zona_nombre: 'Zona 01' }]);
      const res = await getCartografiaProjectById('c1', 't1');
      expect(res?.id).toBe('c1');
    });

    it('createCartografiaProject and updateCartografiaProject work properly', async () => {
      expect(createPipsProject).toBe(createCartografiaProject);
      expect(updatePipsProject).toBe(updateCartografiaProject);

      mockDb.mockResolvedValueOnce([{ id: 'c-new', zona_nombre: 'Zona Nueva' }]);
      const created = await createCartografiaProject({
        teacherId: 't1',
        zona_nombre: 'Zona Nueva',
      });
      expect(created.id).toBe('c-new');

      mockDb.mockResolvedValueOnce([{ id: 'c-new', zona_nombre: 'Zona Editada' }]);
      const updated = await updateCartografiaProject('c-new', 't1', {
        zona_nombre: 'Zona Editada',
      });
      expect(updated?.zona_nombre).toBe('Zona Editada');
    });

    it('deleteCartografiaProject and alias deletePipsProject execute properly', async () => {
      expect(deletePipsProject).toBe(deleteCartografiaProject);
      mockDb.mockResolvedValueOnce([{ id: 'c1' }]);
      const deleted = await deleteCartografiaProject('c1', 't1');
      expect(deleted).toBe(true);
    });

    it('CartografiaRepository implements IProgramRepository methods', async () => {
      mockDb.mockResolvedValueOnce([{ id: 'c1', zona_nombre: 'Zona Repo' }]);
      const found = await cartografiaRepository.findById('c1');
      expect(found?.zona_nombre).toBe('Zona Repo');

      mockDb.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
      const all = await cartografiaRepository.findAll();
      expect(all).toHaveLength(2);
    });
  });
});
