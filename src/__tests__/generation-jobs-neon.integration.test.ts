/**
 * generation-jobs-neon.integration.test.ts
 *
 * Prueba de integración REAL para la Fase P2 contra PostgreSQL en Neon Serverless.
 * Opt-in exclusivo: solo se ejecuta con RUN_DB_INTEGRATION=1 y DATABASE_URL real.
 *
 * Aislamiento total:
 * - Emplea UUIDs efímeros dedicados para docente y planeación de test.
 * - Limpia (DELETE) todos los registros de prueba en afterAll.
 * - CERO alteración de datos de producción.
 *
 * Demuestra empíricamente:
 * 1. Violación capturada y controlada del índice único parcial `idx_active_generation_job` (código 23505).
 * 2. Asignación de lease_id criptográfico y fencing contra reclamo duplicado.
 * 3. Renovación de lease (heartbeat) y rechazo ante lease_id caduco.
 * 4. Fencing estricto de finalización con WorkerLeaseLostError ante lease perdido.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  if (process.env.DATABASE_URL && process.env.ADMIN_ENCRYPTION_KEY) return;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[match[1]] = val;
      }
    }
  }
}

loadEnvLocal();

const isOptInIntegration = process.env.RUN_DB_INTEGRATION === '1';

import {
  createGenerationJob,
  claimGenerationJob,
  renewGenerationJobLease,
  completeGenerationJob,
  WorkerLeaseLostError,
} from '@/lib/db';
import { sql } from '@/lib/db/client';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

const TEST_TEACHER_ID = '00000000-0000-4000-8000-000000000001';
const TEST_PLANNING_ID = '00000000-0000-4000-8000-000000000002';

describe.runIf(isOptInIntegration)('Neon DB Real Integration: P2 Idempotencia y Lease Fencing', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL || !process.env.ADMIN_ENCRYPTION_KEY) {
      throw new Error('DATABASE_URL y ADMIN_ENCRYPTION_KEY son obligatorias para el test de integración');
    }

    const db = sql();

    // Limpieza defensiva previa
    await db`DELETE FROM generation_jobs WHERE planning_id = ${TEST_PLANNING_ID}::uuid`;
    await db`DELETE FROM plannings WHERE id = ${TEST_PLANNING_ID}::uuid`;
    await db`DELETE FROM teachers WHERE id = ${TEST_TEACHER_ID}::uuid`;

    // Insertar registros base de prueba
    await db`
      INSERT INTO teachers (id, email, name, role)
      VALUES (${TEST_TEACHER_ID}::uuid, 'test_p2_worker@sigpda.local', 'Docente Test P2', 'docente')
      ON CONFLICT (id) DO NOTHING
    `;

    await db`
      INSERT INTO plannings (id, teacher_id, uac_name, semester, component)
      VALUES (${TEST_PLANNING_ID}::uuid, ${TEST_TEACHER_ID}::uuid, 'Física I', 1, 'fundamental')
      ON CONFLICT (id) DO NOTHING
    `;
  });

  beforeEach(async () => {
    const db = sql();
    await db`DELETE FROM generation_jobs WHERE planning_id = ${TEST_PLANNING_ID}::uuid`;
  });

  afterAll(async () => {
    const db = sql();
    await db`DELETE FROM generation_jobs WHERE planning_id = ${TEST_PLANNING_ID}::uuid`;
    await db`DELETE FROM plannings WHERE id = ${TEST_PLANNING_ID}::uuid`;
    await db`DELETE FROM teachers WHERE id = ${TEST_TEACHER_ID}::uuid`;
  });

  it('1. Atomicidad: creación concurrente activa índice único parcial idx_active_generation_job', async () => {
    // Lanzar dos creaciones simultáneas para el mismo (planning_id, block_index)
    const [job1, job2] = await Promise.all([
      createGenerationJob(TEST_PLANNING_ID, TEST_TEACHER_ID, 0),
      createGenerationJob(TEST_PLANNING_ID, TEST_TEACHER_ID, 0),
    ]);

    // Ambas promesas deben resolver al MISMO id de job sin duplicar filas
    expect(job1.id).toBe(job2.id);
    expect(job1.block_index).toBe(0);

    const db = sql();
    const rows = await db`
      SELECT count(*)::int AS cnt
      FROM generation_jobs
      WHERE planning_id = ${TEST_PLANNING_ID}::uuid
        AND block_index = 0
        AND status IN ('pending', 'running')
    `;

    expect(rows[0].cnt).toBe(1);
  });

  it('2. Reclamo con lease: genera lease_id y previene reclamo concurrente', async () => {
    const job = await createGenerationJob(TEST_PLANNING_ID, TEST_TEACHER_ID, 0);

    // Reclamo por Worker 1
    const claimedByWorker1 = await claimGenerationJob(job.id, 60);
    expect(claimedByWorker1).not.toBeNull();
    expect(claimedByWorker1?.status).toBe('running');
    expect(claimedByWorker1?.lease_id).toBeDefined();

    // Reclamo concurrente por Worker 2 mientras Worker 1 tiene lease activo
    const claimedByWorker2 = await claimGenerationJob(job.id, 60);
    expect(claimedByWorker2).toBeNull();
  });

  it('3. Heartbeat: renueva lease_until condicionado al lease_id', async () => {
    const job = await createGenerationJob(TEST_PLANNING_ID, TEST_TEACHER_ID, 0);
    const claimed = await claimGenerationJob(job.id, 60);
    expect(claimed?.lease_id).toBeDefined();

    const leaseId = claimed!.lease_id!;

    // Renovación exitosa con lease válido
    const renewed = await renewGenerationJobLease(job.id, leaseId, 90);
    expect(renewed).toBe(true);

    // Renovación fallida con lease ajeno/zombie
    const fakeLeaseId = crypto.randomUUID();
    const fakeRenewed = await renewGenerationJobLease(job.id, fakeLeaseId, 90);
    expect(fakeRenewed).toBe(false);
  });

  it('4. Fencing estricto: rechaza finalización con WorkerLeaseLostError ante lease perdido', async () => {
    const job = await createGenerationJob(TEST_PLANNING_ID, TEST_TEACHER_ID, 0);
    const claimed = await claimGenerationJob(job.id, 60);
    const realLeaseId = claimed!.lease_id!;

    const bogusLeaseId = crypto.randomUUID();
    const dummyResult = { totalWords: 4500 } as unknown as ActiveWorkTextbook;

    // Worker con lease vencido/robado intenta completar -> debe fallar con WorkerLeaseLostError
    await expect(
      completeGenerationJob(job.id, dummyResult, bogusLeaseId)
    ).rejects.toThrow(WorkerLeaseLostError);

    // Worker legítimo completa con éxito
    await expect(
      completeGenerationJob(job.id, dummyResult, realLeaseId)
    ).resolves.toBe(true);

    const db = sql();
    const finalJob = await db`
      SELECT status, completed_at FROM generation_jobs WHERE id = ${job.id}::uuid
    `;
    expect(finalJob[0].status).toBe('completed');
  });

  it('5. Expiración de lease_until: previene renovación tardía, permite reclamo por nuevo worker y bloquea persistencia vieja', async () => {
    const job = await createGenerationJob(TEST_PLANNING_ID, TEST_TEACHER_ID, 0);
    const claimed1 = await claimGenerationJob(job.id, 60);
    const leaseId1 = claimed1!.lease_id!;

    // Simular que el lease expiró en Neon DB (pasaron los 120s)
    const db = sql();
    await db`
      UPDATE generation_jobs
      SET lease_until = NOW() - INTERVAL '10 seconds'
      WHERE id = ${job.id}::uuid
    `;

    // 1. Worker 1 intenta renovar el lease vencido -> debe fallar porque lease_until <= NOW()
    const renewed = await renewGenerationJobLease(job.id, leaseId1, 60);
    expect(renewed).toBe(false);

    // 2. Worker 2 reclama el trabajo estancado por lease vencido -> debe tener éxito con nuevo lease_id
    const claimed2 = await claimGenerationJob(job.id, 60);
    expect(claimed2).not.toBeNull();
    expect(claimed2!.lease_id).not.toBe(leaseId1);
    const leaseId2 = claimed2!.lease_id!;

    // 3. Worker 1 (zombie) intenta persistir en plannings con su leaseId1 -> debe fallar con WorkerLeaseLostError
    const { saveBlockWorkbook } = await import('@/lib/db');
    const dummyWb = { title: 'Libro Zombie', totalWords: 3000 } as unknown as ActiveWorkTextbook;
    await expect(
      saveBlockWorkbook(TEST_PLANNING_ID, 0, dummyWb, job.id, leaseId1)
    ).rejects.toThrow(WorkerLeaseLostError);

    // 4. Worker 2 (legítimo) persiste con su leaseId2 -> éxito
    const saveResult = await saveBlockWorkbook(TEST_PLANNING_ID, 0, dummyWb, job.id, leaseId2);
    expect(saveResult.success).toBe(true);
  });
});
