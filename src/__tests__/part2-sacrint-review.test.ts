import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck } from '@/lib/visual-engine/sacrint/spec';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockIsAdmin = vi.fn();
vi.mock('@/lib/admin-unified', () => ({ isAdmin: (email: string) => mockIsAdmin(email) }));

let mockPlanRows: Array<{ id: string; teacher_id: string; uac_name: string; component: string | null }> = [];
const mockSql = vi.fn(() => Promise.resolve(mockPlanRows));
const mockGetTeacherByEmail = vi.fn();
const mockGetAllBlockWorkbooks = vi.fn();

vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (email: string) => mockGetTeacherByEmail(email),
  getAllBlockWorkbooks: (id: string) => mockGetAllBlockWorkbooks(id),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as GET_COMBINED_PPTX } from '@/app/api/planeaciones/[id]/presentacion/combinada/route';
import { buildAulaPackageZip } from '@/lib/aula-package';

const planningId = '22222222-2222-2222-2222-222222222222';
const teacherId = 'teacher-review-1';

describe('SACRINT Part 2 — S6 Review Gate on Combined Decks & Aula Package', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'docente@ems.mx' } });
    mockIsAdmin.mockResolvedValue(false);
    mockPlanRows = [{ id: planningId, teacher_id: teacherId, uac_name: 'Pensamiento Matemático III', component: 'Fundamental' }];
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, role: 'docente' });
  });

  it('reports 4–160 range in S6_INVALID_SLIDE_COUNT message when slide count is invalid', () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
    deck.slides = deck.slides.slice(0, 2); // 2 slides is invalid in all modes

    const report = reviewBlockMaterials({ workbook: wb, deck, checkFullBlockPersistence: false });
    const issue = report.byMaterial.deck.issues.find((i) => i.code === 'S6_INVALID_SLIDE_COUNT');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('4 a 160 en modo guía por clase');
  });

  it('blocks GET /api/planeaciones/[id]/presentacion/combinada with HTTP 422 when a combined deck has an S6 error', async () => {
    const corruptWb: ActiveWorkTextbook = structuredClone(MATH_DEMO_WORKBOOK);
    corruptWb.missions![0]!.title = 'Misión con placeholder ${corruptToken} no interpolado';

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: corruptWb, version: 1 },
    });

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion/combinada`);
    const res = await GET_COMBINED_PPTX(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.issues.some((i: { code: string }) => i.code === 'S6_PLACEHOLDER_IN_DECK')).toBe(true);
  });

  it('records S6 warnings in buildAulaPackageZip without blocking the full aula ZIP package', async () => {
    const corruptWb: ActiveWorkTextbook = structuredClone(MATH_DEMO_WORKBOOK);
    corruptWb.missions![0]!.title = 'Misión con placeholder ${corruptToken} no interpolado';

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: corruptWb, version: 1 },
    });

    const fakePlanning = {
      id: planningId,
      teacher_id: teacherId,
      uac_name: 'Pensamiento Matemático III',
      semester: 3,
      subsystem: 'BGE',
      content_json: {
        sectionI: { uacName: 'Pensamiento Matemático III', semester: 3 },
      },
      extracted_data: { schoolName: 'Plantel 1', cct: '21EBH0001X' },
    } as unknown as Parameters<typeof buildAulaPackageZip>[0];

    const result = await buildAulaPackageZip(fakePlanning, []);
    expect(result.buffer.byteLength).toBeGreaterThan(1000);
    expect(result.warnings.some((w) => w.includes('S6_PLACEHOLDER_IN_DECK'))).toBe(true);
  });
});
