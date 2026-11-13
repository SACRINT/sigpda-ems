/**
 * generation-jobs-idempotency.test.ts
 *
 * Suite de pruebas unitarias exhaustivas para la Fase P2:
 * - Claim atómico con lease_id (fencing token) en PostgreSQL Neon.
 * - Idempotencia atómica con captura de error 23505 (unique_violation).
 * - Renovación periódica de lease (heartbeat) y detección de pérdida de concesión.
 * - Fencing de escrituras en progreso, completado y fallo (WorkerLeaseLostError).
 * - Idempotencia de persistencia en saveBlockWorkbook (lastJobId).
 * - Fencing en cascada de materiales (cascadeBlockMaterials).
 * - Orquestación en worker con punto único de persistencia.
 */

import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

// ── Mocks para Neon y dependencias ───────────────────────────────────────────
const mockQueryFn = vi.fn().mockResolvedValue([]);

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockQueryFn),
}));

vi.mock('@/lib/ai-provider/key-rotator', () => ({
  decryptKey: vi.fn((s: string) => `decrypted:${s}`),
  encryptKey: vi.fn((s: string) => `encrypted:${s}`),
  withKeyRotation: vi.fn(async (_prov, fn, options) => {
    if (options?.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new DOMException('This operation was aborted', 'AbortError');
    }
    return fn('mocked-api-key', 'gemini');
  }),
}));

// Mock logger para mantener salida de tests limpia
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  createGenerationJob,
  claimGenerationJob,
  claimNextPendingJob,
  renewGenerationJobLease,
  updateGenerationJobProgress,
  completeGenerationJob,
  failGenerationJob,
  saveBlockWorkbook,
  updateWorkbookProgress,
  WorkerLeaseLostError,
} from '@/lib/db';
import { cascadeBlockMaterials } from '@/lib/guide-engine/cascade-block-materials';
import { generateFoundationMission } from '@/lib/guide-engine/writers/foundation-writer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { WriterInput } from '@/lib/guide-engine/writers/writer-contract';

describe('Fase P2: Idempotencia, Lease Fencing y Concurrencia de Workers', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('ADMIN_ENCRYPTION_KEY', '01234567890123456789012345678901');
  });

  beforeEach(() => {
    mockQueryFn.mockReset();
    mockQueryFn.mockResolvedValue([]);
  });

  // ── 1. createGenerationJob: Atomicidad y Manejo de 23505 ────────────────────
  describe('P2.1: createGenerationJob (Atomicidad con índice único parcial)', () => {
    it('inserta atómicamente un nuevo job en pending si no hay conflicto', async () => {
      const mockJob = {
        id: '11111111-1111-1111-1111-111111111111',
        planning_id: '22222222-2222-2222-2222-222222222222',
        teacher_id: '33333333-3333-3333-3333-333333333333',
        block_index: 0,
        status: 'pending',
        progress: 0,
        current_phase: 'analyzing',
        current_step: 'Trabajo encolado, esperando asignación de worker...',
      };

      mockQueryFn.mockResolvedValueOnce([mockJob]);

      const result = await createGenerationJob(mockJob.planning_id, mockJob.teacher_id, 0);

      expect(result.id).toBe(mockJob.id);
      expect(result.status).toBe('pending');
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });

    it('captura código 23505 (unique_violation) y retorna el job activo existente sin duplicar', async () => {
      const planningId = '22222222-2222-2222-2222-222222222222';
      const teacherId = '33333333-3333-3333-3333-333333333333';

      const conflictErr = Object.assign(
        new Error('duplicate key value violates unique constraint "idx_active_generation_job"'),
        { code: '23505' }
      );

      // 1. INSERT falla por violación del índice único parcial
      mockQueryFn.mockRejectedValueOnce(conflictErr);

      // 2. Fallback SELECT recupera el job activo existente
      const existingJob = {
        id: 'active-job-999',
        planning_id: planningId,
        teacher_id: teacherId,
        block_index: 1,
        status: 'running',
        progress: 45,
        lease_id: 'lease-abc-123',
      };
      mockQueryFn.mockResolvedValueOnce([existingJob]);

      const result = await createGenerationJob(planningId, teacherId, 1);

      expect(result.id).toBe('active-job-999');
      expect(result.status).toBe('running');
      expect(result.progress).toBe(45);
      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });

    it('relanza cualquier otro error de base de datos no relacionado con 23505', async () => {
      const connectionError = new Error('Connection terminated unexpectedly');
      mockQueryFn.mockRejectedValueOnce(connectionError);

      await expect(
        createGenerationJob('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 0)
      ).rejects.toThrow('Connection terminated unexpectedly');
    });
  });

  // ── 2. claimGenerationJob y claimNextPendingJob: Lease Fencing ──────────────
  describe('P2.2: Reclamo atómico con lease_id', () => {
    it('claimGenerationJob genera un lease_id y asigna lease_until', async () => {
      const mockClaimed = {
        id: 'job-100',
        planning_id: 'plan-100',
        block_index: 0,
        status: 'running',
        lease_id: 'mocked-lease-uuid',
        heartbeat_at: new Date().toISOString(),
        lease_until: new Date(Date.now() + 120_000).toISOString(),
      };
      mockQueryFn.mockResolvedValueOnce([mockClaimed]);

      const result = await claimGenerationJob('job-100', 120);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-100');
      expect(result?.status).toBe('running');
      expect(result?.lease_id).toBe('mocked-lease-uuid');

      const sqlText = (mockQueryFn.mock.calls[0][0] as TemplateStringsArray).join('?');
      expect(sqlText).toContain("result->>'nextRetryAt'");
      expect(sqlText).toContain('<= NOW()');
    });

    it('claimGenerationJob retorna null si el job ya está tomado con lease vigente', async () => {
      mockQueryFn.mockResolvedValueOnce([]); // 0 rows updated

      const result = await claimGenerationJob('job-already-running', 120);
      expect(result).toBeNull();
    });

    it('claimNextPendingJob reclama con CTE FOR UPDATE SKIP LOCKED', async () => {
      const mockCandidate = {
        id: 'job-oldest-pending',
        planning_id: 'plan-200',
        block_index: 2,
        status: 'running',
        lease_id: 'new-lease-uuid',
      };
      mockQueryFn.mockResolvedValueOnce([mockCandidate]);

      const result = await claimNextPendingJob(120);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-oldest-pending');
      expect(result?.lease_id).toBe('new-lease-uuid');

      const sqlText = (mockQueryFn.mock.calls[0][0] as TemplateStringsArray).join('?');
      expect(sqlText).toContain("result->>'nextRetryAt'");
      expect(sqlText).toContain('<= NOW()');
      expect(sqlText).toContain('FOR UPDATE SKIP LOCKED');
    });
  });

  // ── 3. renewGenerationJobLease (Heartbeat) ──────────────────────────────────
  describe('P2.3: Heartbeat y Renovación de Lease', () => {
    it('renueva exitosamente el lease si lease_id coincide y el job sigue running', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'job-100' }]);

      const renewed = await renewGenerationJobLease('job-100', 'valid-lease-uuid', 120);
      expect(renewed).toBe(true);
    });

    it('falla y retorna false si el lease_id fue revocado o venció', async () => {
      mockQueryFn.mockResolvedValueOnce([]); // 0 filas actualizadas

      const renewed = await renewGenerationJobLease('job-100', 'stale-lease-uuid', 120);
      expect(renewed).toBe(false);
    });
  });

  // ── 4. Fencing estricto de mutaciones (WorkerLeaseLostError) ────────────────
  describe('P2.4: Fencing de mutaciones en generation_jobs', () => {
    it('updateGenerationJobProgress lanza WorkerLeaseLostError si el lease fue revocado', async () => {
      mockQueryFn.mockResolvedValueOnce([]); // 0 rows updated

      await expect(
        updateGenerationJobProgress('job-100', { progress: 50 }, 'my-revoked-lease')
      ).rejects.toThrow(WorkerLeaseLostError);
    });

    it('completeGenerationJob lanza WorkerLeaseLostError si el lease ya no coincide', async () => {
      mockQueryFn.mockResolvedValueOnce([]); // 0 rows updated

      await expect(
        completeGenerationJob('job-100', { totalWords: 5000 } as unknown as ActiveWorkTextbook, 'outdated-lease')
      ).rejects.toThrow(WorkerLeaseLostError);
    });

    it('failGenerationJob lanza WorkerLeaseLostError si el worker ya no posee el lease', async () => {
      mockQueryFn.mockResolvedValueOnce([]); // 0 rows updated

      await expect(
        failGenerationJob('job-100', 'Error de red', 'outdated-lease')
      ).rejects.toThrow(WorkerLeaseLostError);
    });

    it('permite completar exitosamente cuando el lease_id coincide', async () => {
      mockQueryFn.mockResolvedValueOnce([{ id: 'job-100', status: 'completed' }]);

      await expect(
        completeGenerationJob('job-100', { totalWords: 5000 } as unknown as ActiveWorkTextbook, 'valid-lease')
      ).resolves.not.toThrow();
    });
  });

  // ── 5. saveBlockWorkbook: Idempotencia por jobId (Punto Único) ───────────────
  describe('P2.5: Idempotencia en saveBlockWorkbook (lastJobId)', () => {
    it('incrementa versión cuando se guarda por primera vez con un jobId nuevo', async () => {
      const mockPlanningRow = {
        id: 'plan-1',
        workbooks_json: {
          block_0: {
            version: 1,
            lastJobId: 'old-job-001',
            current: { generatedAt: '2026-11-01', totalWords: 2000 },
            history: [],
          },
        },
      };

      // 1. SELECT plannings
      mockQueryFn.mockResolvedValueOnce([mockPlanningRow]);
      // 2. UPDATE plannings (con version_lock = 1)
      mockQueryFn.mockResolvedValueOnce([{ id: 'plan-1' }]);

      const mockWorkbook = {
        title: 'Nuevo Libro',
        totalWords: 5000,
        generatedAt: '2026-11-05',
      } as unknown as ActiveWorkTextbook;

      const result = await saveBlockWorkbook('plan-1', 0, mockWorkbook, 'new-job-002');

      expect(result.success).toBe(true);
      expect(result.version).toBe(2);
      expect(mockWorkbook.version).toBe(2);
    });

    it('retorna la versión existente sin mutar DB si el mismo jobId intenta guardar de nuevo (idempotencia)', async () => {
      const existingJobId = 'job-already-finished-777';
      const mockPlanningRow = {
        id: 'plan-1',
        workbooks_json: {
          block_0: {
            version: 3,
            lastJobId: existingJobId,
            current: {
              version: 3,
              generatedAt: '2026-11-05',
              totalWords: 4800,
            },
            history: [{ version: 1 }, { version: 2 }],
          },
        },
      };

      // 1. SELECT plannings
      mockQueryFn.mockResolvedValueOnce([mockPlanningRow]);

      const mockWorkbook = {
        title: 'Libro Reintentado',
        totalWords: 4800,
      } as unknown as ActiveWorkTextbook;

      // Llamada con el MISMO jobId
      const result = await saveBlockWorkbook('plan-1', 0, mockWorkbook, existingJobId);

      expect(result.success).toBe(true);
      expect(result.version).toBe(3);
      // Solo hizo el SELECT inicial; NO ejecutó UPDATE de plannings (idempotencia)
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });

    it('saveBlockWorkbook lanza WorkerLeaseLostError y no actualiza si el lease fue revocado o venció', async () => {
      // 1. SELECT id FROM generation_jobs ... -> 0 filas porque el lease expiró
      mockQueryFn.mockResolvedValueOnce([]);

      const mockWorkbook = { title: 'Libro Desfasado', totalWords: 4000 } as unknown as ActiveWorkTextbook;

      await expect(
        saveBlockWorkbook('plan-1', 0, mockWorkbook, 'job-stale', 'expired-lease')
      ).rejects.toThrow(WorkerLeaseLostError);

      // Certificar que NO se ejecutó ningún UPDATE en plannings
      const calls = mockQueryFn.mock.calls;
      const executedQueries = calls.map((c) => String(c[0] || ''));
      expect(executedQueries.some((q) => q.includes('UPDATE plannings'))).toBe(false);
    });

    it('updateWorkbookProgress lanza WorkerLeaseLostError y no muta plannings si el lease fue revocado', async () => {
      // 1. SELECT id FROM generation_jobs ... -> 0 filas
      mockQueryFn.mockResolvedValueOnce([]);

      const progressState = {
        planningId: 'plan-1',
        blockIndex: 0,
        phase: 'writing' as const,
        currentStep: 'Paso...',
        percent: 50,
        updatedAt: new Date().toISOString(),
      };

      await expect(
        updateWorkbookProgress('plan-1', 0, progressState, 'job-stale', 'revoked-lease')
      ).rejects.toThrow(WorkerLeaseLostError);

      const calls = mockQueryFn.mock.calls;
      const executedQueries = calls.map((c) => String(c[0] || ''));
      expect(executedQueries.some((q) => q.includes('UPDATE plannings'))).toBe(false);
    });
  });

  // ── 6. cascadeBlockMaterials: Fencing contra zombies ───────────────────────
  describe('P2.6: Fencing en cascadeBlockMaterials contra workers zombies', () => {
    const realMission = {
      missionIndex: 1,
      title: 'Misión de prueba con contenido específico',
      coveredSessions: [1, 2, 3],
      sessionTopic: 'Fenómenos físicos del entorno escolar',
      sessionFocus: 'Medición y análisis de datos',
      phenomenonHook: {
        story: 'El laboratorio mide la temperatura del agua en distintos horarios.',
        detonatingQuestion: '¿Cómo cambia la temperatura a lo largo del día?',
      },
      conceptZero: {
        physicalAnalogy: 'La temperatura del agua se comporta como una escala que sube y baja.',
        coreExplanation: 'La medición sistemática permite describir variaciones y comparar datos.',
      },
      iDoSection: { stepByStepDemo: 'Registrar la temperatura inicial y final con el termómetro.' },
      weDoSection: { guidedPractice: 'Medir en equipos y tabular los datos obtenidos.', workbookElements: [] },
      youDoSection: { autonomousChallenge: 'Graficar los datos y explicar la variación observada.', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: {
        question: '¿Qué variable explica el cambio de temperatura?',
        reflectionPrompts: ['¿Qué medición fue más precisa?'],
        criteriaChecklist: ['Registré los datos con unidades.'],
      },
      wordCount: 500,
    };
    it('aborta y lanza WorkerLeaseLostError antes del DELETE si el lease expiró o fue revocado', async () => {
      // 1. SELECT id FROM generation_jobs WHERE id = $jobId AND lease_id = $leaseId AND status = 'running'
      // Retorna vacío porque otro worker tomó el lease
      mockQueryFn.mockResolvedValueOnce([]);

      const mockWorkbook = {
        blockName: 'Bloque 1',
        missions: [realMission],
      } as unknown as ActiveWorkTextbook;

      await expect(
        cascadeBlockMaterials('plan-1', 0, mockWorkbook, 'teacher-1', {
          jobId: 'job-stale-worker',
          leaseId: 'revoked-lease-uuid',
        })
      ).rejects.toThrow(WorkerLeaseLostError);

      // Certificar que NO se ejecutó ningún DELETE en planning_extras
      const calls = mockQueryFn.mock.calls;
      const executedQueries = calls.map((c) => String(c[0] || ''));
      expect(executedQueries.some((q) => q.includes('DELETE FROM planning_extras'))).toBe(false);
    });

    it('aborta y lanza WorkerLeaseLostError si el lease se revoca entre el anclaje inicial y el DELETE', async () => {
      // 1. SELECT id FROM generation_jobs (inicio) -> lease válido
      mockQueryFn.mockResolvedValueOnce([{ id: 'job-stale-worker' }]);
      // 2. SELECT plannings (anclaje curricular) -> hit
      mockQueryFn.mockResolvedValueOnce([
        { sequence_json: null, content_json: null, extracted_data: null },
      ]);
      // 3. SELECT id FROM generation_jobs (justo antes de DELETE planning_extras) -> lease perdido!
      mockQueryFn.mockResolvedValueOnce([]);

      const mockWorkbook = {
        blockName: 'Bloque 1',
        coverData: { subjectName: 'Física', semester: 1 },
        missions: [realMission],
      } as unknown as ActiveWorkTextbook;

      await expect(
        cascadeBlockMaterials('plan-1', 0, mockWorkbook, 'teacher-1', {
          jobId: 'job-stale-worker',
          leaseId: 'revoked-lease-uuid',
        })
      ).rejects.toThrow(WorkerLeaseLostError);

      // Certificar que NO se ejecutó el DELETE en planning_extras
      const calls = mockQueryFn.mock.calls;
      const executedQueries = calls.map((c) => String(c[0] || ''));
      expect(executedQueries.some((q) => q.includes('DELETE FROM planning_extras'))).toBe(false);
    });

    it('continúa normalmente con la cascada si el lease está activo y verificado en todas las fases', async () => {
      mockQueryFn.mockImplementation((strings: TemplateStringsArray) => {
        const query = String(strings[0] || '');
        if (query.includes('generation_jobs')) {
          return Promise.resolve([{ id: 'job-active-worker' }]);
        }
        if (query.includes('SELECT uac_name')) {
          return Promise.resolve([
            { sequence_json: null, content_json: null, extracted_data: null },
          ]);
        }
        return Promise.resolve([]);
      });

      const mockWorkbook = {
        blockName: 'Bloque 1',
        coverData: { subjectName: 'Física', semester: 1 },
        missions: [realMission],
      } as unknown as ActiveWorkTextbook;

      const result = await cascadeBlockMaterials('plan-1', 0, mockWorkbook, 'teacher-1', {
        jobId: 'job-active-worker',
        leaseId: 'active-valid-lease',
      });

      expect(result.success).toBe(true);
      expect(result.blockIndex).toBe(0);
    });
  });

  // ── 7. AbortSignal en Writers ──────────────────────────────────────────────
  describe('P2.7: Propagación de AbortSignal a Writers', () => {
    it('cancela de inmediato la llamada si el AbortSignal ya está abortado', async () => {
      const abortController = new AbortController();
      abortController.abort(new Error('Job duration exceeded 270s'));

      const mockWriterInput: WriterInput = {
        planning: {
          id: 'plan-1',
          teacherId: 'teacher-1',
          uacName: 'Química I',
          semester: 1,
          component: 'fundamental',
          curriculumName: 'MCCEMS',
          paecContext: 'Agua',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
          extractedData: null,
          contentJson: null,
        } as unknown as WriterInput['planning'],
        blockIndex: 0,
        blockName: 'Bloque 1',
        sessions: [],
        missions: [
          {
            missionIndex: 1,
            title: 'Misión 1',
            sessionNumbers: [1, 2],
            sessionTopic: 'Fundamentos',
            focus: 'Concepto Cero',
            missionType: 'foundation',
            targetPages: 4,
            targetWords: 1500,
          },
        ],
        paecContext: 'Agua',
        studentProfile: 'Perfil',
        subsystem: 'bge',
        uacName: 'Química I',
        targetWords: { min: 1000, ideal: 1500, max: 2000 },
        signal: abortController.signal,
      };

      await expect(generateFoundationMission(mockWriterInput)).rejects.toThrow('Job duration exceeded 270s');
    });
  });
});

