/**
 * Piloto P1.5 — contrato real de /api/planeaciones/[id]/materiales-bloque
 * sobre una copia temporal de la planeación canónica IR-3.1.
 *
 * Opt-in: RUN_DB_INTEGRATION=1
 * Uso:
 *   npx vitest run --config vitest.integration.config.mts src/__tests__/p15-instalaciones.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { sql } from '@/lib/db/client';

function loadEnvLocal(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    let value = (match[2] || '').trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadEnvLocal();

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { email: 'sci211270@gmail.com' } }),
}));

import { GET, POST } from '@/app/api/planeaciones/[id]/materiales-bloque/route';

const CANONICAL_PLANNING_ID = '166f816d-7a66-46dc-b5b6-b1ccda273353';
const TEST_PLANNING_ID = '00000000-0000-4000-8000-0000000000a5';
const isOptInIntegration = process.env.RUN_DB_INTEGRATION === '1';

async function cleanup(): Promise<void> {
  const db = sql();
  await db`DELETE FROM planning_extras WHERE planning_id = ${TEST_PLANNING_ID}::uuid`;
  await db`DELETE FROM generation_jobs WHERE planning_id = ${TEST_PLANNING_ID}::uuid`;
  await db`DELETE FROM plannings WHERE id = ${TEST_PLANNING_ID}::uuid`;
}

describe.runIf(isOptInIntegration)('P1.5 IR-3.1 — materiales-bloque con datos reales', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL es obligatoria para el piloto P1.5');
    }

    await cleanup();

    const db = sql();
    await db`
      INSERT INTO plannings (
        id, teacher_id, uac_name, semester, component, curriculum_name,
        paec_context, extracted_data, content_json, sequence_json,
        workbooks_json, metodologia_activa, status
      )
      SELECT
        ${TEST_PLANNING_ID}::uuid, teacher_id, uac_name, semester, component, curriculum_name,
        paec_context, extracted_data, content_json, sequence_json,
        workbooks_json, metodologia_activa, status
      FROM plannings
      WHERE id = ${CANONICAL_PLANNING_ID}::uuid
    `;
  }, 60000);

  afterAll(async () => {
    await cleanup();
  }, 60000);

  it('GET responde 200 en los 3 bloques y la revisión R1 está limpia', async () => {
    for (const blockIndex of [0, 1, 2]) {
      const request = new NextRequest(
        `http://localhost:3000/api/planeaciones/${TEST_PLANNING_ID}/materiales-bloque?blockIndex=${blockIndex}`
      );
      const response = await GET(request, { params: Promise.resolve({ id: TEST_PLANNING_ID }) });
      const body = await response.json();

      expect(response.status, `bloque ${blockIndex}: ${JSON.stringify(body)}`).toBe(200);
      expect(body.success).toBe(true);
      expect(body.review?.ok).toBe(true);
      expect(body.review?.errors ?? []).toEqual([]);
      expect(body.omitted ?? []).toEqual([]);
      expect(body.materials?.planesDeClase?.length ?? 0).toBeGreaterThan(0);
      expect(body.materials?.guiaDelBloque?.length ?? 0).toBeGreaterThan(0);
    }
  }, 120000);

  it('POST responde 200 en los 3 bloques, sin 422 y con cascada completa', async () => {
    for (const blockIndex of [0, 1, 2]) {
      const request = new NextRequest(
        `http://localhost:3000/api/planeaciones/${TEST_PLANNING_ID}/materiales-bloque?blockIndex=${blockIndex}`,
        { method: 'POST' }
      );
      const response = await POST(request, { params: Promise.resolve({ id: TEST_PLANNING_ID }) });
      const body = await response.json();

      expect(response.status, `bloque ${blockIndex}: ${JSON.stringify(body)}`).toBe(200);
      expect(body.success).toBe(true);
      expect(body.cascade?.success).toBe(true);
      expect(body.omitted ?? []).toEqual([]);
      expect(body.review?.ok).toBe(true);
    }

    const db = sql();
    const rows = (await db`
      SELECT count(*)::int AS n
      FROM planning_extras
      WHERE planning_id = ${TEST_PLANNING_ID}::uuid
    `) as unknown as { n: number }[];
    expect(Number(rows[0]?.n ?? 0)).toBeGreaterThan(0);
  }, 180000);
});
