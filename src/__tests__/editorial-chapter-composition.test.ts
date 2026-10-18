/**
 * editorial-chapter-composition.test.ts — Composición del capítulo del estudiante
 * desde plannings.workbooks_json (fix P0 NO_SESSIONS · Tarea 1)
 *
 * Cobertura de Pruebas:
 * 1. Sin libros de bloque → HTTP 400 NO_SESSIONS con mensaje accionable y sin despacho.
 * 2. 3 bloques × 2 sesiones (sessionNumber reinicia por bloque) → un único despacho,
 *    6 sesiones renumeradas 1..6 (invariante anti-F11), orden por bloque y sessionNumber,
 *    plantel/CCT reales del docente en lugar de constantes hardcodeadas.
 * 3. Sesión inválida (URL de recurso malformada) → se descarta con log y el resto
 *    se renumera manteniendo continuidad estricta 1..N.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { SessionPlan } from '@/types/work-textbook';

// Mocks de dependencias externas
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  getPlanningById: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/subscription-gate', () => ({
  getSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/editorial/editorial-db', () => ({
  initEditorialBooksTable: vi.fn().mockResolvedValue(undefined),
  createEditorialBook: vi.fn(),
  getEditorialBookByPlanningAndHash: vi.fn(),
  getEditorialBookById: vi.fn(),
  getLatestEditorialBookForPlanning: vi.fn(),
  updateEditorialBookStatus: vi.fn(),
}));

vi.mock('@/lib/editorial/worker-client', () => ({
  dispatchToEditorialWorker: vi.fn(),
  EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS: 50000,
  EDITORIAL_WORKER_MAX_BUDGET_MS: 55000,
}));

vi.mock('@/lib/editorial/blob-storage', () => ({
  uploadEditorialPdfToBlob: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { featureFlags } from '@/lib/platform/feature-flags';
import { POST } from '@/app/api/pdf/libro-editorial/[id]/route';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import { uploadEditorialPdfToBlob } from '@/lib/editorial/blob-storage';
import {
  createEditorialBook,
  getEditorialBookByPlanningAndHash,
  updateEditorialBookStatus,
} from '@/lib/editorial/editorial-db';
import type { StudentChapter } from '@/lib/editorial/student-content-model';

describe('Motor Editorial — Composición de capítulo desde plannings.workbooks_json', () => {
  const mockTeacher = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'docente.editorial@sems.puebla.gob.mx',
    role: 'docente',
    school_name: 'Bachillerato Benemérito Juárez',
    cct: '21EBH0099Z',
  };

  const planningId = '33333333-3333-3333-3333-333333333333';

  const basePlanning = {
    id: planningId,
    teacher_id: mockTeacher.id,
    uac_name: 'Pensamiento Matemático III',
    semester: 3,
    workbooks_json: null,
  };

  function makePlan(sessionNumber: number, opts?: { tag?: string; badUrl?: boolean }): SessionPlan {
    const tag = opts?.tag ?? `unidad ${sessionNumber}`;
    return {
      sessionNumber,
      objetivo: `Vas a aprender a calcular la variación numérica con ejemplos reales de ${tag}.`,
      motivacion: `Imagina que en tu comunidad los precios cambian cada semana: medir esa variación numérica es la tarea real de hoy en ${tag}.`,
      saberesPrevios: `Ya dominas operaciones básicas, porcentajes y tabulación de datos en clase.`,
      contenido: `Parrafo: La variación numérica describe qué tan grande o pequeña es la diferencia entre dos cantidades medibles.\n\nDefinicion: Relación de cambio proporcional entre dos magnitudes que se expresa en porcentaje o razón.`,
      ejemploResuelto: `Un vendedor vendió 5 artículos en 2 días.\nPaso 1: Calcular el ritmo diario: 5 / 2 = 2.5 artículos por día.\nPaso 2: Estimar la semana completa: 2.5 * 7 = 17.5 artículos.`,
      practica: [
        {
          enunciado: `Calcula la variación porcentual cuando el precio pasa de 20 a 25 pesos concretos.`,
          pista: `Aplica la fórmula de variación porcentual paso a paso con los dos valores dados.`,
        },
      ],
      aplicacion: `Aplica la variación porcentual al presupuesto del salón de clases y justifica tu estrategia de ahorro.`,
      autoevaluacion: [
        `¿Puedes explicar la variación porcentual con tus palabras?`,
        `¿Resolviste el ejemplo sin ayuda y sin equivocarte?`,
      ],
      recursos: [
        {
          titulo: `Video de variación numérica ${sessionNumber}`,
          url: opts?.badUrl ? 'no-es-url-valida' : `https://www.youtube.com/watch?v=vid${sessionNumber}`,
          tipo: 'video',
        },
      ],
      productoIntegrador: `Agregas una tabla de variación numérica a tu proyecto comunitario.`,
    };
  }

  function workbook(missions: Array<{ title: string; sessionPlans: SessionPlan[] }>) {
    return { current: { missions } };
  }

  function postEmptyBody() {
    return new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  function dispatchedChapter(): StudentChapter {
    const calls = vi.mocked(dispatchToEditorialWorker).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[0][0] as unknown as StudentChapter;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    featureFlags.setOverride('EDITORIAL_PUBLISHER_ENGINE', true);

    vi.mocked(auth).mockResolvedValue({
      user: { email: mockTeacher.email },
    } as never);

    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(getPlanningById).mockResolvedValue(basePlanning as never);

    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      hasActiveSubscription: true,
      subscription: null,
      subjects: [],
      usedSubjectsCount: 1,
      availableSlots: 9,
      isAdmin: false,
    } as never);

    vi.mocked(getEditorialBookByPlanningAndHash).mockResolvedValue(null);
    vi.mocked(createEditorialBook).mockResolvedValue({
      id: 'book-uuid-1',
      planning_id: planningId,
      workbook_id: 'editorial_wb_1',
      content_hash: 'hash123',
      metadata: {},
      pdf_storage_path: null,
      page_count: null,
      spine_width_mm: null,
      status: 'pending',
      job_id: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.mocked(updateEditorialBookStatus).mockResolvedValue({
      id: 'book-uuid-1',
      status: 'completed',
    } as never);

    vi.mocked(dispatchToEditorialWorker).mockResolvedValue({
      success: true,
      pdfBuffer: Buffer.from('%PDF-1.7 Fake Editorial Buffer'),
      pageCount: 40,
      sha256: 'f'.repeat(64),
      durationMs: 1234,
      typstPeakMemoryMb: 11,
      nodeHeapDeltaMb: 4,
      renderedSessionCount: 6,
      renderedProductoIntegradorCount: 6,
      binaryVersion: 'typst 0.13.1',
      source: 'render_worker',
    } as never);

    vi.mocked(uploadEditorialPdfToBlob).mockResolvedValue({
      url: 'https://blob.example/editorial-books/mock.pdf',
      pathname: 'editorial-books/mock.pdf',
      sizeBytes: 27,
      provider: 'vercel',
    } as never);
  });

  afterEach(() => {
    featureFlags.clearAllOverrides();
  });

  // ==========================================================================
  // 1. Sin libros de bloque → 400 NO_SESSIONS accionable
  // ==========================================================================
  it('sin workbooks_json responde 400 NO_SESSIONS con mensaje accionable y sin despachar', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      ...basePlanning,
      workbooks_json: null,
    } as never);

    const res = await POST(postEmptyBody(), { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('NO_SESSIONS');
    expect(data.error).toContain('libros de bloque');
    expect(dispatchToEditorialWorker).not.toHaveBeenCalled();
  }, 15000);

  it('workbooks_json vacío ({}) también responde 400 NO_SESSIONS', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      ...basePlanning,
      workbooks_json: {},
    } as never);

    const res = await POST(postEmptyBody(), { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('NO_SESSIONS');
    expect(dispatchToEditorialWorker).not.toHaveBeenCalled();
  }, 15000);

  // ==========================================================================
  // 2. Composición 3 bloques → renumeración 1..N + datos reales del docente
  // ==========================================================================
  it('compone 3 bloques × 2 sesiones, renumera 1..6, ordena por bloque/sn y usa plantel/CCT reales', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      ...basePlanning,
      workbooks_json: {
        block_0: workbook([
          {
            title: 'Misión 1',
            sessionPlans: [
              makePlan(1, { tag: 'PC1 ses1' }),
              makePlan(2, { tag: 'PC1 ses2' }),
            ],
          },
        ]),
        // sessionNumber reinicia en 1 por bloque; misiones fuera de orden para probar el sort
        block_1: workbook([
          {
            title: 'Misión 1',
            sessionPlans: [
              makePlan(2, { tag: 'PC2 ses2' }),
              makePlan(1, { tag: 'PC2 ses1' }),
            ],
          },
        ]),
        block_2: workbook([
          {
            title: 'Misión 1',
            sessionPlans: [
              makePlan(1, { tag: 'PC3 ses1' }),
              makePlan(2, { tag: 'PC3 ses2' }),
            ],
          },
        ]),
      },
    } as never);

    const res = await POST(postEmptyBody(), { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(dispatchToEditorialWorker).toHaveBeenCalledTimes(1);

    const chapter = dispatchedChapter();

    // Renumeración estricta 1..6 (invariante anti-F11)
    expect(chapter.sesiones.map((s) => s.numero)).toEqual([1, 2, 3, 4, 5, 6]);

    // Orden: bloques 0→1→2 y dentro de cada bloque por sessionNumber (block_1 venía invertido)
    expect(chapter.sesiones[0].objetivo).toContain('PC1 ses1');
    expect(chapter.sesiones[2].objetivo).toContain('PC2 ses1');
    expect(chapter.sesiones[3].objetivo).toContain('PC2 ses2');
    expect(chapter.sesiones[5].objetivo).toContain('PC3 ses2');

    // Títulos renumerados (prefijo "Sesión N:" reescrito tras la composición)
    expect(chapter.sesiones[2].titulo.startsWith('Sesión 3:')).toBe(true);
    expect(chapter.sesiones[5].titulo.startsWith('Sesión 6:')).toBe(true);

    // Plantel y CCT reales del docente (no constantes fallback)
    expect(chapter.plantel).toBe('Bachillerato Benemérito Juárez');
    expect(chapter.cct).toBe('21EBH0099Z');
    expect(chapter.bloque).toBe('Bloques 1, 2, 3');
    expect(chapter.uac).toBe('Pensamiento Matemático III');
    expect(chapter.semestre).toBe('3');

    // Registro editorial y despacho coherentes
    const createArgs = vi.mocked(createEditorialBook).mock.calls[0][0] as unknown as {
      metadata: { sessionCount: number };
    };
    expect(createArgs.metadata.sessionCount).toBe(6);
  }, 15000);

  // ==========================================================================
  // 3. Sesión inválida → drop + renumeración continúa 1..N
  // ==========================================================================
  it('descarta la sesión con URL inválida y renumera el resto manteniendo continuidad 1..N', async () => {
    vi.mocked(getPlanningById).mockResolvedValue({
      ...basePlanning,
      workbooks_json: {
        block_0: workbook([
          {
            title: 'Misión 1',
            sessionPlans: [
              makePlan(1),
              makePlan(2, { badUrl: true }),
              makePlan(3),
            ],
          },
        ]),
      },
    } as never);

    const res = await POST(postEmptyBody(), { params: Promise.resolve({ id: planningId }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(dispatchToEditorialWorker).toHaveBeenCalledTimes(1);

    const chapter = dispatchedChapter();

    // 2 válidas de 3 (la #2 cae por URL inválida) y numeración continua
    expect(chapter.sesiones).toHaveLength(2);
    expect(chapter.sesiones.map((s) => s.numero)).toEqual([1, 2]);

    // La tercera sesión original ocupa ahora el índice 1 con título renumerado
    expect(chapter.sesiones[1].objetivo).toContain('unidad 3');
    expect(chapter.sesiones[1].titulo.startsWith('Sesión 2:')).toBe(true);

    // Bloque etiquetado según bloques presentes (solo block_0)
    expect(chapter.bloque).toBe('Bloque 1');
  }, 15000);
});
