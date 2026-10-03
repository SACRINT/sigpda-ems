/**
 * H-319 — API /api/planeaciones/[id]/presentacion
 * Valida control de acceso, parámetros, formato JSON (visor) y descarga PPTX.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockIsAdmin = vi.fn();
vi.mock('@/lib/admin-unified', () => ({ isAdmin: (e: string) => mockIsAdmin(e) }));

let mockPlanRows: Array<{ id: string; teacher_id: string; uac_name: string; component: string | null }> = [];
const mockSql = vi.fn(() => Promise.resolve(mockPlanRows));
const mockGetTeacherByEmail = vi.fn();
const mockGetBlockWorkbook = vi.fn();
vi.mock('@/lib/db', () => ({
  sql: () => mockSql,
  getTeacherByEmail: (e: string) => mockGetTeacherByEmail(e),
  getBlockWorkbook: (id: string, idx: number) => mockGetBlockWorkbook(id, idx),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '@/app/api/planeaciones/[id]/presentacion/route';

const planningId = '11111111-1111-1111-1111-111111111111';
const teacherId = 'teacher-1';

const workbook = {
  id: 'w', planningId, blockIndex: 0, blockName: 'Bloque 1', version: 1, subsystem: 'bge',
  targetPages: 1, totalPages: 1, totalWords: 1, generatedAt: '', qualityScore: 90, qualityWarning: false,
  coverData: { title: 'Pensamiento Matemático I', subtitle: '', subjectName: 'Pensamiento Matemático I', semester: 1, blockNumber: 1, teacherName: 'D', schoolName: 'E' },
  tableOfContents: [], missions: [],
  projectSection: { artifactName: '', communityUtility: '', phases: [], technicalSpecs: [], acceptanceCriteria: [] },
  evaluationSection: { source: 'generated_fresh', rubric: [], checklist: [], criticalThinkingQuiz: [], metacognitiveReflection: { prompts: [] } },
};

const call = (qs: string) =>
  GET(new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion${qs}`), {
    params: Promise.resolve({ id: planningId }),
  });

describe('H-319 — endpoint de presentación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 't@x.mx' } });
    mockIsAdmin.mockResolvedValue(false);
    mockPlanRows = [{ id: planningId, teacher_id: teacherId, uac_name: 'PM I', component: null }];
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, role: 'docente' });
    mockGetBlockWorkbook.mockResolvedValue(workbook);
  });

  it('401 sin sesión', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await call('?blockIndex=0')).status).toBe(401);
  });

  it('400 con blockIndex o formato inválido', async () => {
    expect((await call('?blockIndex=-1')).status).toBe(400);
    expect((await call('?blockIndex=0&format=zip')).status).toBe(400);
  });

  it('404 si la planeación no existe', async () => {
    mockPlanRows = [];
    expect((await call('?blockIndex=0')).status).toBe(404);
  });

  it('403 si no es dueño, supervisor ni admin', async () => {
    mockPlanRows = [{ id: planningId, teacher_id: 'otro', uac_name: 'x', component: null }];
    expect((await call('?blockIndex=0')).status).toBe(403);
  });

  it('404 si el libro de bloque no existe', async () => {
    mockGetBlockWorkbook.mockResolvedValue(null);
    const res = await call('?blockIndex=0');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('aún no ha sido generado');
  });

  it('format=json devuelve el mazo para el visor', async () => {
    const res = await call('?blockIndex=0&format=json');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deck.slides[0].kind).toBe('cover');
    expect(data.deck.palette.area).toBe('stem');
  });

  it('por defecto descarga un .pptx válido con headers correctos', async () => {
    const res = await call('?blockIndex=0');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('presentationml.presentation');
    expect(res.headers.get('Content-Disposition')).toContain('.pptx');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
});
