import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import JSZip from 'jszip';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck, LessonGuideNoSessionsError } from '@/lib/visual-engine/sacrint/spec';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';

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

function buildWorkbookWithSession(sessionNumber = 1): ActiveWorkTextbook {
  const wb = structuredClone(MATH_DEMO_WORKBOOK);
  const session: SessionPlan = {
    sessionNumber,
    objetivo: 'Modelar ingresos y gastos lineales con ecuaciones de primer grado.',
    motivacion: 'Un taller comunitario cobra $150 de inscripción y $80 por sesión.',
    saberesPrevios: 'Despeje básico de ecuaciones de la forma ax + b = c.',
    contenido: 'Una ecuación lineal representa una tasa de cambio constante respecto a una variable.',
    ejemploResuelto: 'Con 80x + 150 = 550, resta 150 para obtener 80x = 400 y divide entre 80: x = 5.',
    practica: [
      {
        enunciado: 'Resuelve 40x + 120 = 320 para hallar el número de semanas.',
        pista: 'Resta 120 en ambos lados primero.',
        solucion: ['x = 5'],
      },
    ],
    aplicacion: 'Sirve para calcular presupuestos semanales sin déficit.',
    autoevaluacion: ['Identifico pendiente y ordenada al origen en problemas cotidianos.'],
    recursos: [],
    productoIntegrador: 'Tabla de costos semanales del proyecto.',
  };
  wb.missions![0]!.coveredSessions = [sessionNumber];
  wb.missions![0]!.sessionPlans = [session];
  return wb;
}

describe('SACRINT Part 2 — S6 Review Gate on Combined Decks & Aula Package', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { email: 'docente@ems.mx' } });
    mockIsAdmin.mockResolvedValue(false);
    mockPlanRows = [{ id: planningId, teacher_id: teacherId, uac_name: 'Pensamiento Matemático III', component: 'Fundamental' }];
    mockGetTeacherByEmail.mockResolvedValue({ id: teacherId, role: 'docente' });
  });

  it('reports 3–160 range in S6_INVALID_SLIDE_COUNT message when slide count is invalid', () => {
    const wb = buildWorkbookWithSession(1);
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
    deck.slides = deck.slides.slice(0, 2); // 2 slides is invalid in all modes

    const report = reviewBlockMaterials({ workbook: wb, deck, checkFullBlockPersistence: false });
    const issue = report.byMaterial.deck.issues.find((i) => i.code === 'S6_INVALID_SLIDE_COUNT');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('3 a 160 en modo guía por clase');
  });

  it('throws LessonGuideNoSessionsError and returns HTTP 422 on combined route when sessionPlans is empty', async () => {
    const emptySessionsWb = structuredClone(MATH_DEMO_WORKBOOK);
    expect(() => buildSacrintDeck(emptySessionsWb, { mode: 'lesson-guide' })).toThrow(LessonGuideNoSessionsError);

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: emptySessionsWb, version: 1 },
    });

    const req = new NextRequest(`http://localhost:3000/api/planeaciones/${planningId}/presentacion/combinada`);
    const res = await GET_COMBINED_PPTX(req, { params: Promise.resolve({ id: planningId }) });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('LESSON_GUIDE_NO_SESSIONS');
  });

  it('blocks GET /api/planeaciones/[id]/presentacion/combinada with HTTP 422 when a combined deck has an S6 error', async () => {
    const corruptWb = buildWorkbookWithSession(1);
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

  it('excludes only corrupt S6 decks in buildAulaPackageZip without falling back to generic PPTX', async () => {
    const corruptWb = buildWorkbookWithSession(1);
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
    expect(result.warnings.some((w) => w.includes('S6_PLACEHOLDER_IN_DECK') && w.includes('Bloque 1') && w.includes('Misión 1'))).toBe(true);

    const zip = await JSZip.loadAsync(result.buffer);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.startsWith('01_'))).toBe(true);
    expect(names.some((n) => n.startsWith('09_'))).toBe(true);
    expect(names.some((n) => n.startsWith('08_Presentacion_SACRINT_'))).toBe(false);
    expect(names.some((n) => n.startsWith('08_Presentacion_de_Clase_'))).toBe(false);
    const readme = await zip.file('LEEME_PAQUETE_AULA.txt')!.async('string');
    expect(readme).toContain('S6_PLACEHOLDER_IN_DECK');
  });

  it('keeps valid decks in 08_Presentacion_SACRINT while excluding only a corrupt mission deck', async () => {
    const mixedWb = buildWorkbookWithSession(1);
    const secondMission = structuredClone(mixedWb.missions![0]!);
    secondMission.missionIndex = 2;
    secondMission.title = 'Misión 2 con error ${corruptToken}';
    secondMission.coveredSessions = [2];
    secondMission.sessionPlans = [{ ...secondMission.sessionPlans![0]!, sessionNumber: 2 }];
    mixedWb.missions!.push(secondMission);

    mockGetAllBlockWorkbooks.mockResolvedValue({
      block_0: { current: mixedWb, version: 1 },
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
    const zip = await JSZip.loadAsync(result.buffer);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.startsWith('08_Presentacion_SACRINT_'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('Misión 2') && w.includes('S6_PLACEHOLDER_IN_DECK'))).toBe(true);
  });
});
