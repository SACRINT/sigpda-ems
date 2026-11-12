import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canonicalJsonStringify,
  computeCanonicalSha256,
  recordPlanningVersion,
  getPlanningVersions,
  getPlanningVersionByNumber,
} from '@/lib/planning/planning-versions';

vi.mock('@/lib/db/client', () => ({
  sql: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  updatePlanningContent: vi.fn(),
}));

import { sql } from '@/lib/db/client';
import { updatePlanningContent } from '@/lib/db';
import { validateAndPersistPlanningContent } from '@/lib/planning/planning-persistence';

describe('ISO 21001:2018 — Control Documental Inmutable (planning-versions)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Hash canónico SHA-256 y orden determinista', () => {
    it('debe producir exactamente el mismo hash independientemente del orden de las claves', () => {
      const objA = {
        title: 'Planeación Pensamiento Matemático',
        semester: 1,
        author: { name: 'Docente A', cct: '21EBH0001Z' },
        tags: ['mccems', 'nem'],
      };

      const objB = {
        tags: ['mccems', 'nem'],
        author: { cct: '21EBH0001Z', name: 'Docente A' },
        title: 'Planeación Pensamiento Matemático',
        semester: 1,
      };

      const jsonA = canonicalJsonStringify(objA);
      const jsonB = canonicalJsonStringify(objB);

      expect(jsonA).toBe(jsonB);

      const hashA = computeCanonicalSha256(objA);
      const hashB = computeCanonicalSha256(objB);

      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64);
    });

    it('debe producir hashes diferentes si el contenido cambia', () => {
      const objA = { title: 'Planeación 1', hours: 4 };
      const objB = { title: 'Planeación 1', hours: 5 };

      const hashA = computeCanonicalSha256(objA);
      const hashB = computeCanonicalSha256(objB);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe('2. Registro de Versión Inmutable (recordPlanningVersion)', () => {
    it('debe calcular el siguiente número de versión e insertar snapshot', async () => {
      const mockDb = vi.fn()
        // Primera llamada: MAX(version_number) -> 2
        .mockResolvedValueOnce([{ next_version: 3 }])
        // Segunda llamada: INSERT ... RETURNING *
        .mockResolvedValueOnce([
          {
            id: 'version-uuid-3',
            planning_id: 'plan-123',
            teacher_id: 'teacher-456',
            version_number: 3,
            snapshot_json: { title: 'Test' },
            sha256_hash: 'abc123hash',
            anexo12_score: 98,
            dbepa_score: 100,
            change_summary: 'Ajuste DUA',
            created_at: '2026-11-12T00:00:00.000Z',
          },
        ]);

      vi.mocked(sql).mockReturnValue(mockDb as any);

      const result = await recordPlanningVersion({
        planningId: 'plan-123',
        teacherId: 'teacher-456',
        contentJson: { title: 'Test' },
        anexo12Score: 98,
        dbepaScore: 100,
        changeSummary: 'Ajuste DUA',
      });

      expect(result).not.toBeNull();
      expect(result?.version_number).toBe(3);
      expect(result?.sha256_hash).toBeDefined();
      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('debe arrojar error si faltan parámetros requeridos', async () => {
      await expect(
        recordPlanningVersion({
          planningId: '',
          teacherId: 'teacher-456',
          contentJson: {},
        })
      ).rejects.toThrow('planningId, teacherId y contentJson son obligatorios');
    });
  });

  describe('3. Consulta de Versiones Históricas', () => {
    it('debe consultar versiones ordenadas descendentemente por version_number', async () => {
      const mockVersions = [
        { id: 'v2', version_number: 2, planning_id: 'plan-1' },
        { id: 'v1', version_number: 1, planning_id: 'plan-1' },
      ];
      const mockDb = vi.fn().mockResolvedValueOnce(mockVersions);
      vi.mocked(sql).mockReturnValue(mockDb as any);

      const list = await getPlanningVersions('plan-1');
      expect(list).toEqual(mockVersions);
      expect(mockDb).toHaveBeenCalledTimes(1);
    });

    it('debe consultar una versión específica por número', async () => {
      const mockVersion = { id: 'v2', version_number: 2, planning_id: 'plan-1' };
      const mockDb = vi.fn().mockResolvedValueOnce([mockVersion]);
      vi.mocked(sql).mockReturnValue(mockDb as any);

      const item = await getPlanningVersionByNumber('plan-1', 2);
      expect(item).toEqual(mockVersion);
    });
  });

  describe('4. Integración con validateAndPersistPlanningContent', () => {
    it('debe crear un snapshot de versión al guardar satisfactoriamente', async () => {
      vi.mocked(updatePlanningContent).mockResolvedValue({ id: 'plan-1' } as any);

      const mockDb = vi.fn()
        .mockResolvedValueOnce([{ next_version: 1 }])
        .mockResolvedValueOnce([
          {
            id: 'v-1',
            planning_id: 'plan-1',
            version_number: 1,
            sha256_hash: 'hash-abc',
          },
        ]);
      vi.mocked(sql).mockReturnValue(mockDb as any);

      const result = await validateAndPersistPlanningContent(
        'plan-1',
        'teacher-1',
        { sectionI: { subjectName: 'Pensamiento Matemático I' } },
        { isNewOrStrictMode: false, changeSummary: 'Primera versión' }
      );

      expect(result.success).toBe(true);
      expect(result.versionRecord).toBeDefined();
      expect(result.versionRecord?.version_number).toBe(1);
    });
  });
});
