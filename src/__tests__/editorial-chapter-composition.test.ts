/**
 * editorial-chapter-composition.test.ts — Composición del capítulo del estudiante
 * desde plannings.workbooks_json (fix P0 NO_SESSIONS · Tarea 1)
 *
 * Cobertura de Pruebas:
 * 1. Sin libros de bloque → HTTP 400 NO_SESSIONS con mensaje accionable y sin despacho.
 * 2. 3 bloques × 2 sesiones (sessionNumber reinicia por bloque) → un único despacho,
 *    6 sesiones renumeradas 1..6 (invariante anti-F11), orden por bloque y sessionNumber,
 *    plantel/CCT reales del docente en lugar de constantes hardcodeadas.
 * 3. Sesión con URL de recurso inválida → la capa editorial la REPARA (con la IA
 *    deshabilitada en este archivo, la red de seguridad determinista con recurso
 *    de catálogo) y compone 3/3 con continuidad estricta 1..N. El descarte duro
 *    (dropped) solo queda para contenido corrupto y responde 422 explícito.
 * 4. Fase C — numeración global: las referencias en prosa a sesiones (numeración
 *    local por bloque 1..24) se desplazan al número global 1..72 vía
 *    remapSessionReferences / remapSessionReferencesDeep (offset por bloque).
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
  fetchEditorialWorkerTemplateVersion: vi.fn().mockResolvedValue(null),
  EDITORIAL_WORKER_DEFAULT_TIMEOUT_MS: 50000,
  EDITORIAL_WORKER_MAX_BUDGET_MS: 55000,
}));

vi.mock('@/lib/editorial/blob-storage', () => ({
  uploadEditorialPdfToBlob: vi.fn(),
}));

// Reparador de integridad: IA deshabilitada (mockRejectedValue en beforeEach) para
// que este archivo ejerza la RED DE SEGURIDAD DETERMINISTA de forma determinista,
// sin llamadas reales de IA ni costos. La capa IA se cubre en
// editorial-plan-completeness.test.ts con deps inyectadas.
vi.mock('@/lib/ai-provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-provider')>()),
  generateWithRotation: vi.fn(),
}));

vi.mock('@/lib/db/workbooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/workbooks')>()),
  saveBlockWorkbook: vi.fn().mockResolvedValue({ version: 2, success: true }),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { generateWithRotation } from '@/lib/ai-provider';
import { saveBlockWorkbook } from '@/lib/db/workbooks';
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
import {
  adaptSessionPlanToStudentSession,
  remapSessionReferences,
  remapSessionReferencesDeep,
} from '@/lib/editorial/student-content-model';
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

  function makePlan(
    sessionNumber: number,
    opts?: { tag?: string; badUrl?: boolean; saberes?: string },
  ): SessionPlan {
    const tag = opts?.tag ?? `unidad ${sessionNumber}`;
    return {
      sessionNumber,
      objetivo: `Vas a aprender a calcular la variación numérica con ejemplos reales de ${tag}.`,
      motivacion: `Imagina que en tu comunidad los precios cambian cada semana: medir esa variación numérica es la tarea real de hoy en ${tag}.`,
      saberesPrevios:
        opts?.saberes ?? `Ya dominas operaciones básicas, porcentajes y tabulación de datos en clase.`,
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

    // Reparador: la IA "está caída" en este archivo → siempre red determinista.
    vi.mocked(generateWithRotation).mockRejectedValue(new Error('IA deshabilitada en tests de composición'));
    vi.mocked(saveBlockWorkbook).mockResolvedValue({ version: 2, success: true });

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
  // 3. URL inválida → REPARACIÓN (red determinista) + 3/3 sesiones
  // ==========================================================================
  it('repara la sesión con URL de recurso inválida (IA caída → catálogo) y compone 3/3 con continuidad 1..N', async () => {
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

    // El reparador corrió: IA caída en este test → red determinista + persistencia
    expect(generateWithRotation).toHaveBeenCalled();
    expect(saveBlockWorkbook).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveBlockWorkbook).mock.calls[0][1]).toBe(0); // bloque tocado: block_0

    const chapter = dispatchedChapter();

    // 3/3 sesiones (la #2 ya NO se descarta) y numeración continua
    expect(chapter.sesiones).toHaveLength(3);
    expect(chapter.sesiones.map((s) => s.numero)).toEqual([1, 2, 3]);

    // La sesión reparada conserva su identidad y gana un recurso https real del catálogo
    expect(chapter.sesiones[1].objetivo).toContain('unidad 2');
    expect(chapter.sesiones[1].recursos).toHaveLength(1);
    expect(chapter.sesiones[1].recursos[0].url).toMatch(/^https:\/\//);
    expect(chapter.sesiones[1].recursos[0].titulo.length).toBeGreaterThanOrEqual(3);

    // La tercera sesión mantiene su numeración original (sin desplazamiento por drop)
    expect(chapter.sesiones[2].objetivo).toContain('unidad 3');
    expect(chapter.sesiones[2].titulo.startsWith('Sesión 3:')).toBe(true);

    // Bloque etiquetado según bloques presentes (solo block_0)
    expect(chapter.bloque).toBe('Bloque 1');
  }, 15000);

  // ==========================================================================
  // 4. Fase C — numeración global: las referencias en prosa se desplazan
  // ==========================================================================
  it('desplaza las referencias en prosa de sesiones al número global (offset por bloque)', async () => {
    const refText = 'Continúa con las sesiones 4 a 11 y la sesión 6 del plan de estudio.';
    vi.mocked(getPlanningById).mockResolvedValue({
      ...basePlanning,
      workbooks_json: {
        block_0: workbook([
          {
            title: 'Misión 1',
            sessionPlans: [
              makePlan(1, { tag: 'PC1 ses1', saberes: refText }),
              makePlan(2, { tag: 'PC1 ses2' }),
            ],
          },
        ]),
        block_1: workbook([
          {
            title: 'Misión 1',
            sessionPlans: [
              makePlan(1, { tag: 'PC2 ses1', saberes: refText }),
              makePlan(2, { tag: 'PC2 ses2' }),
            ],
          },
        ]),
      },
    } as never);

    const res = await POST(postEmptyBody(), { params: Promise.resolve({ id: planningId }) });
    expect(res.status).toBe(200);

    const chapter = dispatchedChapter();
    expect(chapter.sesiones.map((s) => s.numero)).toEqual([1, 2, 3, 4]);

    // Bloque 0 = offset 0 → la referencia local queda intacta
    expect(chapter.sesiones[0].saberesPrevios).toBe(refText);

    // Bloque 1 = sesión local 1 → global 3 (offset +2) → referencias desplazadas +2
    expect(chapter.sesiones[2].saberesPrevios).toBe(
      'Continúa con las sesiones 6 a 13 y la sesión 8 del plan de estudio.'
    );
    expect(chapter.sesiones[2].titulo.startsWith('Sesión 3:')).toBe(true);
    expect(chapter.sesiones[3].titulo.startsWith('Sesión 4:')).toBe(true);
  }, 15000);
});

describe('Motor Editorial — remapSessionReferences (numeración global 1..72)', () => {
  it('offset 0 (bloque 1) no modifica nada', () => {
    expect(remapSessionReferences('Estudiaste las sesiones 1 y 2 en el bloque 1.', 0)).toBe(
      'Estudiaste las sesiones 1 y 2 en el bloque 1.'
    );
  });

  it('desplaza rangos y listas reales del corpus (+24 y +48)', () => {
    expect(
      remapSessionReferences('Todo el contenido desarrollado en las sesiones 4 a 11, portafolio completo.', 24)
    ).toBe('Todo el contenido desarrollado en las sesiones 28 a 35, portafolio completo.');
    expect(remapSessionReferences('repasa la sesión 4 hasta la 11.', 48)).toBe(
      'repasa la sesión 52 hasta la 59.'
    );
    expect(remapSessionReferences('Sesiones 13, 14, 15 del reto.', 24)).toBe(
      'Sesiones 37, 38, 39 del reto.'
    );
    expect(remapSessionReferences('Sesiones 18, 19 y 20 del reto.', 48)).toBe(
      'Sesiones 66, 67 y 68 del reto.'
    );
    expect(remapSessionReferences('Sesiones 15-17 del bloque.', 24)).toBe('Sesiones 39-41 del bloque.');
    expect(remapSessionReferences('Sesión 1: Exploración Diagnóstica', 24)).toBe(
      'Sesión 25: Exploración Diagnóstica'
    );
    expect(remapSessionReferences('entre las sesiones 13 y 14)', 24)).toBe('entre las sesiones 37 y 38)');
  });

  it('respeta límites: >24 no se toca, objetivo ≤72, sin acentos también', () => {
    expect(remapSessionReferences('la sesión 30 queda pendiente', 24)).toBe('la sesión 30 queda pendiente');
    expect(remapSessionReferences('la sesión 24', 48)).toBe('la sesión 72');
    expect(remapSessionReferences('la sesión 25', 48)).toBe('la sesión 25');
    expect(remapSessionReferences('la sesion 4 del cuaderno', 24)).toBe('la sesion 28 del cuaderno');
  });

  it('números sin "sesión" previa quedan intactos', () => {
    expect(remapSessionReferences('apunta 5 ideas y 12 dudas en tu cuaderno', 24)).toBe(
      'apunta 5 ideas y 12 dudas en tu cuaderno'
    );
    expect(remapSessionReferences('valores de 10 a 20 pesos', 24)).toBe('valores de 10 a 20 pesos');
  });

  it('remapSessionReferencesDeep recorre estructuras anidadas completas', () => {
    const input = {
      titulo: 'Sesión 4: taller',
      autoevaluacion: ['¿Qué viste en la sesión 6?', '¿Qué falta de la sesión 7?'],
      practica: [{ enunciado: 'Ejercicio basado en la sesión 5', pista: 'Revisa la sesión 4' }],
      numero: 4,
    };
    const out = remapSessionReferencesDeep(input, 24);
    expect(out.titulo).toBe('Sesión 28: taller');
    expect(out.autoevaluacion[0]).toBe('¿Qué viste en la sesión 30?');
    expect(out.autoevaluacion[1]).toBe('¿Qué falta de la sesión 31?');
    expect(out.practica[0].enunciado).toBe('Ejercicio basado en la sesión 29');
    expect(out.practica[0].pista).toBe('Revisa la sesión 28');
    expect(out.numero).toBe(4);
  });
});

describe('adaptSessionPlanToStudentSession — tokens [[material:...]] (paridad plan ↔ libro)', () => {
  it('la sesión de estudiante no expone tokens crudos en NINGÚN campo (objetivo, teoría, práctica, recursos)', () => {
    const plan: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Vas a usar el [[material:papel-milimetrado]] para trazar figuras con precisión.',
      motivacion: 'En tu comunidad se miden terrenos cada semana con planos impresos en papel milimetrado real.',
      saberesPrevios: 'Ya conoces el plano cartesiano y las unidades de medida del semestre anterior.',
      contenido:
        'Parrafo: El [[material:papel-milimetrado]] permite trazar con exactitud las figuras.\n\nDefinicion: Superficie con retícula milimétrica que ayuda a trabajar a escala.',
      ejemploResuelto: 'Trazar un rectángulo de 5 cm por 3 cm.\nPaso 1: Ubica el origen en el papel.',
      practica: [
        {
          enunciado: 'Trazar un triángulo equilátero de 6 cm de lado usando el [[material:compas]].',
          pista: 'Apoya la medición con [[material:regla|la regla graduada]] antes de trazar.',
        },
      ],
      aplicacion: 'Aplica el trazado a un plano simple de tu salón con medidas reales.',
      autoevaluacion: ['¿Pudiste trazar la figura usando el [[material:compas]] sin ayuda?'],
      recursos: [
        { titulo: 'Tutorial de trazado con [[material:regla]]', url: 'https://www.youtube.com/watch?v=traz1', tipo: 'video' },
      ],
      productoIntegrador: 'Agregas el plano trazado a tu proyecto comunitario.',
    };

    const session = adaptSessionPlanToStudentSession(plan);
    const serialized = JSON.stringify(session);

    // Anti-fuga total: ni un rastro de sintaxis de token en la sesión final
    expect(serialized).not.toContain('[[');
    expect(serialized).not.toContain(']]');
    expect(serialized).not.toContain('material:');

    // El contenido teórico conserva el sentido (token del catálogo → nombre legible)
    expect(session.contenido.map((b) => b.texto).join(' ')).toContain('Papel Milimetrado');
    expect(session.practica[0].pista).toContain('la regla graduada');
    expect(session.autoevaluacion[0]).not.toContain('[[');

    // El plan original de workbooks_json queda intacto (helper puro)
    expect(plan.objetivo).toContain('[[material:papel-milimetrado]]');
  });
});