/**
 * editorial-phase4-unified.test.ts — Pruebas de Fase 4 (PR 4.0 + PR 4.1)
 * SIGPDA-EMS · Motor Editorial Unificado (Render + Caché Blob + Fallback Clásico)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook, EvaluationSection, SessionPlan } from '@/types/work-textbook';
import { isTypstAvailableSync } from '@/lib/editorial/typst-compiler';

// Mocks controlados para validar caché, fallback y rutas sin tocar Neon/Vercel Blob reales
const mockRenderWorkbookToPdf = vi.fn<(...args: unknown[]) => Promise<Buffer>>(
  async () => Buffer.from('%PDF-1.4\n%jsPDF-classic-mock\n%%EOF'),
);
const mockGetEditorialBookByPlanningAndHash = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockCreateEditorialBook = vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(
  async () => ({ id: 'eb-1' }),
);
const mockUpdateEditorialBookStatus = vi.fn<(...args: unknown[]) => Promise<unknown>>(
  async () => ({}),
);
const mockReadEditorialPdfFromStorage = vi.fn<(...args: unknown[]) => Promise<Buffer | null>>();
const mockUploadEditorialPdfToBlob = vi.fn<
  (...args: unknown[]) => Promise<{
    url: string;
    pathname: string;
    sizeBytes: number;
    provider: 'vercel_blob' | 'local_fallback';
  }>
>(async () => ({
  url: 'https://blob.vercel-storage.com/editorial-books/test.pdf',
  pathname: 'editorial-books/test.pdf',
  sizeBytes: 2048,
  provider: 'vercel_blob',
}));
const mockDispatchToEditorialWorker = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockFetchWorkerTemplateVersion = vi.fn<() => Promise<string | null>>(
  async () => 'tpl:46494246dd2f2254',
);
const mockAcquireEditorialConcurrencyLock = vi.fn<(...args: unknown[]) => Promise<unknown>>(
  async () => ({ acquired: true, lockId: 'lock-test-1', activeCount: 1 }),
);
const mockEnforceUsageQuota = vi.fn<(...args: unknown[]) => Promise<unknown>>(
  async () => ({
    allowed: true,
    alreadyCounted: false,
    metric: 'pdf_compile',
    tier: 'pro',
    windowKey: 'stripe_2026-11-01',
    hourlyMetric: 'pdf_compile_hourly',
    hourWindowKey: '2026-11-27T18',
    scopedIdempotencyKey: 'pdf_compile:v2-block-0:hash',
    used: 1,
    limit: 60,
    remaining: 59,
  }),
);
const mockRefundUsageQuota = vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true);
const mockReleaseEditorialConcurrencyLock = vi.fn<(...args: unknown[]) => Promise<void>>(
  async () => {},
);
const mockReleaseEditorialLockOnAbort = vi.fn<(...args: unknown[]) => Promise<void>>(
  async () => {},
);
const mockRecordEditorialEngineTelemetry = vi.fn<(...args: unknown[]) => Promise<void>>(
  async () => {},
);

vi.mock('@/lib/pdf-workbook-renderer', () => ({
  renderWorkbookToPdf: (...args: unknown[]) => mockRenderWorkbookToPdf(...args),
}));

vi.mock('@/lib/editorial/editorial-db', () => ({
  getEditorialBookByPlanningAndHash: (...args: unknown[]) =>
    mockGetEditorialBookByPlanningAndHash(...args),
  createEditorialBook: (...args: unknown[]) => mockCreateEditorialBook(...args),
  updateEditorialBookStatus: (...args: unknown[]) => mockUpdateEditorialBookStatus(...args),
}));

vi.mock('@/lib/editorial/blob-storage', () => ({
  readEditorialPdfFromStorage: (...args: unknown[]) => mockReadEditorialPdfFromStorage(...args),
  uploadEditorialPdfToBlob: (...args: unknown[]) => mockUploadEditorialPdfToBlob(...args),
}));

vi.mock('@/lib/editorial/worker-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/editorial/worker-client')>();
  return {
    ...actual,
    dispatchToEditorialWorker: (...args: unknown[]) => mockDispatchToEditorialWorker(...args),
    fetchEditorialWorkerTemplateVersion: () => mockFetchWorkerTemplateVersion(),
  };
});

vi.mock('@/lib/platform/usage-quota-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/platform/usage-quota-guard')>();
  return {
    ...actual,
    acquireEditorialConcurrencyLock: (...args: unknown[]) =>
      mockAcquireEditorialConcurrencyLock(...args),
    enforceUsageQuota: (...args: unknown[]) => mockEnforceUsageQuota(...args),
    refundUsageQuota: (...args: unknown[]) => mockRefundUsageQuota(...args),
    releaseEditorialConcurrencyLock: (...args: unknown[]) =>
      mockReleaseEditorialConcurrencyLock(...args),
    releaseEditorialLockOnAbort: (...args: unknown[]) => mockReleaseEditorialLockOnAbort(...args),
  };
});

vi.mock('@/lib/db/usage-quotas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/usage-quotas')>();
  return {
    ...actual,
    recordEditorialEngineTelemetry: (...args: unknown[]) =>
      mockRecordEditorialEngineTelemetry(...args),
  };
});

import {
  clearHotEditorialCacheForTests,
  compileUnifiedEditorialPdf,
} from '@/lib/editorial/unified-editorial-compiler';
import { featureFlags } from '@/lib/platform/feature-flags';

function makeFixturePlanning(): Planning {
  return {
    id: 'plan-phase4-001',
    teacherId: 'teacher-001',
    uacName: 'Pensamiento Matemático II',
    semester: 2,
    component: 'fundamental',
    curriculumName: 'MCCEMS 2026',
    paecContext: 'Diseño de captación pluvial escolar en Puebla',
    extractedData: null,
    status: 'generated',
    contentJson: {
      sectionI: {
        teacherName: 'Prof. Demo',
        schoolName: 'Bachillerato General Estatal Puebla',
        cct: '21EBH0123A',
        schoolZone: '086',
        uacName: 'Pensamiento Matemático II',
        semester: 2,
        groups: '201',
        schoolYear: '2026-2027',
        applicationPeriod: '2026-B',
        estimatedSessions: '72',
        component: 'fundamental',
        totalHours: 72,
        subsystem: 'BGE',
      },
    } as unknown as Planning['contentJson'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeFixtureSessionPlan(): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: 'Aplicar ecuaciones lineales para modelar costos reales de captación pluvial en el plantel.',
    motivacion: 'El comité estudiantil de tu plantel en Puebla necesita calcular cuántos tramos de tubería comprar.',
    saberesPrevios: 'Ya dominas operaciones con números enteros, razones y porcentajes en situaciones cotidianas.',
    contenido:
      'Una ecuación lineal relaciona una incógnita con coeficientes conocidos mediante una igualdad que se conserva al aplicar la misma operación en ambos miembros. Usa tu [[material:calculadora-cientifica]] para verificar.',
    ejemploResuelto:
      'Calcula cuántos tramos de $38 puedes comprar con $370 si 4 llaves cuestan $180:\nPaso 1: Plantea 180 + 38x = 370.\nPaso 2: Resta 180 en ambos lados: 38x = 190 y divide entre 38 para obtener x = 5 tramos.',
    practica: [
      {
        enunciado: 'Resuelve 140 + 70x = 560 para calcular cuántas canaletas alcanza a cubrir el presupuesto escolar.',
        pista: 'Resta primero el costo fijo de 140 y después divide entre el costo unitario de 70.',
      },
    ],
    aplicacion: 'Integra el modelo algebraico al presupuesto real del proyecto comunitario PAEC de captación pluvial.',
    autoevaluacion: [
      'Identifico correctamente la incógnita y sus unidades dentro del problema real.',
      'Compruebo la solución sustituyendo el valor obtenido en la ecuación original.',
    ],
    recursos: [
      {
        titulo: 'GeoGebra — Ecuaciones lineales',
        url: 'https://www.geogebra.org/calculator',
        tipo: 'web',
      },
    ],
    productoIntegrador: 'Hoja de presupuesto algebraico verificada para el proyecto escolar PAEC.',
    sintesisVisual: {
      conceptoBreve: 'Ecuación lineal de primer grado en presupuestos reales',
      formulaOReglaClave: 'ax + b = c',
      ejemploBreve: {
        planteamiento: 'Costo fijo más costo por tramo',
        pasos: ['Restar costo fijo', 'Dividir entre costo unitario'],
        conclusion: 'Cada tramo adicional incrementa el costo en a pesos.',
      },
      mapaConceptual: {
        definicionClave: 'Una ecuación lineal conserva el equilibrio cuando la misma operación se aplica a ambos miembros.',
        criterioDesarrollo: 'Verifica siempre tus resultados con unidades explícitas.',
        errorComun: 'Cambiar de miembro un término sin invertir su operación.',
        correccionBreve: 'Usa siempre la operación inversa al despejar.',
      },
    },
  };
}

function makeFixtureWorkbook(blockIndex = 0): ActiveWorkTextbook {
  const evaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Planteamiento algebraico',
        weightPercent: 100,
        levels: [
          { levelName: 'Excelente', descriptor: 'Modela y verifica sin errores', points: 100 },
          { levelName: 'Bueno', descriptor: 'Modela correctamente con detalle menor', points: 80 },
          { levelName: 'Suficiente', descriptor: 'Requiere guía en el despeje', points: 60 },
          { levelName: 'Requiere Apoyo', descriptor: 'No establece la igualdad', points: 40 },
        ],
      },
    ],
    checklist: [{ item: 'Define la incógnita con unidades claras.', category: 'Procedimiento' }],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        scenario: 'Un proveedor ofrece 10% de descuento si compras más de 8 tramos.',
        question: '¿Cómo cambia la ecuación del presupuesto?',
        answerExplanation: 'CLAVE DOCENTE SECRETA QUE NO DEBE SALIR EN ESTUDIANTE',
      },
    ],
    metacognitiveReflection: {
      prompts: ['¿Qué error evitaste al comprobar tu resultado?'],
    },
  };

  return {
    id: `wb-b${blockIndex + 1}`,
    planningId: 'plan-phase4-001',
    blockIndex,
    blockName: `Bloque ${blockIndex + 1}: Modelación Algebraica`,
    version: 1,
    subsystem: 'bge',
    targetPages: 45,
    totalPages: 45,
    totalWords: 12000,
    qualityScore: 95,
    qualityWarning: false,
    generatedAt: new Date().toISOString(),
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subtitle: 'Modelación y Resolución de Problemas',
      subjectName: 'Pensamiento Matemático II',
      semester: 2,
      blockNumber: blockIndex + 1,
      teacherName: 'Prof. Demo',
      schoolName: 'Bachillerato General Estatal Puebla',
      cct: '21EBH0123A',
    },
    tableOfContents: [],
    missions: [
      {
        missionIndex: 1,
        title: 'Ecuaciones lineales en el presupuesto escolar',
        realLifeConnection: {
          context: 'Cálculo de costos reales para el huerto y captación pluvial del plantel.',
          householdApplication: 'Estimar presupuestos domésticos mensuales.',
          communityImpact: 'Optimizar los insumos del plantel escolar.',
        },
        coveredSessions: [1],
        wordCount: 900,
        sessionPlans: [makeFixtureSessionPlan()],
      },
    ] as unknown as ActiveWorkTextbook['missions'],
    projectSection: {
      artifactName: 'Presupuesto algebraico de captación pluvial',
      communityUtility: 'Optimizar los insumos del plantel escolar reduciendo desperdicios.',
      requiredMaterials: ['Calculadora científica', 'Flexómetro'],
      phases: [
        {
          phaseNum: 1,
          title: 'Levantamiento de medidas',
          allocatedHours: 2,
          deliverables: ['Croquis acotado'],
          instructions: 'Mide el techo del módulo y registra longitudes en metros.',
        },
      ],
      technicalSpecs: ['Unidades en metros y pesos MXN'],
      acceptanceCriteria: ['Ecuaciones verificadas por sustitución'],
    },
    evaluationSection,
  };
}

describe('Fase 4 (PR 4.0 + PR 4.1 + PR 4.2.2) — Render Blueprint y Motor Editorial Unificado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearHotEditorialCacheForTests();
    featureFlags.clearOverride('PUBLISHING_ENGINE_V2');
  });

  it('PR 4.0: render.yaml existe, package.json usa editorial:health (sin flyctl) y fly.toml está marcado legado', () => {
    const root = process.cwd();
    const renderYaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
    expect(renderYaml).toContain('sigpda-editorial-worker');
    expect(renderYaml).toContain('dockerfilePath: ./Dockerfile');
    expect(renderYaml).toContain('healthCheckPath: /health');

    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['editorial:deploy']).toBeUndefined();
    expect(pkg.scripts['editorial:health']).toContain('check-editorial-worker.mjs');

    const flyToml = fs.readFileSync(path.join(root, 'worker-editorial', 'fly.toml'), 'utf8');
    expect(flyToml).toContain('LEGACY / ARCHIVED');
  });

  it('PR 4.1: con PUBLISHING_ENGINE_V2=false usa jsPDF legacy sin invocar caché ni worker', async () => {
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', false);
    const planning = makeFixturePlanning();
    const wb = makeFixtureWorkbook(0);

    const res = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      blockIndex: 0,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
    });

    expect(res.engine).toBe('jspdf_legacy');
    expect(res.cached).toBe(false);
    expect(mockRenderWorkbookToPdf).toHaveBeenCalledTimes(1);
    expect(mockDispatchToEditorialWorker).not.toHaveBeenCalled();
    expect(mockGetEditorialBookByPlanningAndHash).not.toHaveBeenCalled();
  });

  it('PR 4.1: con PUBLISHING_ENGINE_V2=true y cache HIT devuelve PDF de Blob a costo 0 (sin llamar al worker)', async () => {
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', true);
    const cachedPdf = Buffer.from('%PDF-1.7\n%cached-typst-v2-blob-bytes-' + '0'.repeat(120) + '\n%%EOF');
    mockGetEditorialBookByPlanningAndHash.mockResolvedValueOnce({
      id: 'eb-hit-1',
      status: 'completed',
      pdf_storage_path: 'https://blob.vercel-storage.com/editorial-books/cached.pdf',
      page_count: 14,
    });
    mockReadEditorialPdfFromStorage.mockResolvedValueOnce(cachedPdf);

    const planning = makeFixturePlanning();
    const wb = makeFixtureWorkbook(0);
    const res = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      blockIndex: 0,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
    });

    expect(res.engine).toBe('typst_cached');
    expect(res.cached).toBe(true);
    expect(res.pageCount).toBe(14);
    expect(res.pdfBuffer.equals(cachedPdf)).toBe(true);
    expect(mockDispatchToEditorialWorker).not.toHaveBeenCalled();
    expect(mockRenderWorkbookToPdf).not.toHaveBeenCalled();
  });

  it('PR 4.1: con PUBLISHING_ENGINE_V2=true y cache MISS compila en worker y persiste en Blob/editorial_books', async () => {
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', true);
    const compiledPdf = Buffer.from('%PDF-1.7\n%compiled-by-render-typst-' + 'A'.repeat(150) + '\n%%EOF');
    mockGetEditorialBookByPlanningAndHash.mockResolvedValueOnce(null);
    mockDispatchToEditorialWorker.mockResolvedValueOnce({
      success: true,
      sha256: 'abc123',
      pageCount: 18,
      durationMs: 2400,
      typstPeakMemoryMb: 42,
      nodeHeapDeltaMb: 8,
      renderedSessionCount: 1,
      renderedProductoIntegradorCount: 1,
      binaryVersion: 'typst 0.15.1',
      pdfBuffer: compiledPdf,
      source: 'remote_worker',
    });

    const planning = makeFixturePlanning();
    const wb = makeFixtureWorkbook(0);
    const res = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
    });

    expect(res.engine).toBe('typst');
    expect(res.cached).toBe(false);
    expect(res.source).toBe('remote_worker');
    expect(res.pageCount).toBe(18);
    expect(mockDispatchToEditorialWorker).toHaveBeenCalledTimes(1);
    const sentChapter = mockDispatchToEditorialWorker.mock.calls[0]?.[0];
    expect(JSON.stringify(sentChapter)).not.toContain('CLAVE DOCENTE SECRETA');
    expect(mockUploadEditorialPdfToBlob).toHaveBeenCalledTimes(1);
    expect(mockUpdateEditorialBookStatus).toHaveBeenCalledWith(
      'eb-1',
      'completed',
      expect.objectContaining({
        pdfStoragePath: 'https://blob.vercel-storage.com/editorial-books/test.pdf',
        pageCount: 18,
      }),
    );
    expect(mockRenderWorkbookToPdf).not.toHaveBeenCalled();
  });

  it('PR 4.1: si el worker de Render falla o expira, activa fallback automático a jsPDF clásico sin lanzar error', async () => {
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', true);
    mockGetEditorialBookByPlanningAndHash.mockResolvedValueOnce(null);
    mockDispatchToEditorialWorker.mockRejectedValueOnce(new Error('Render cold-start timeout 50000ms'));

    const planning = makeFixturePlanning();
    const wb = makeFixtureWorkbook(0);
    const res = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      blockIndex: 0,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
    });

    expect(res.engine).toBe('jspdf_fallback');
    expect(res.cached).toBe(false);
    expect(res.fallbackReason).toContain('Render cold-start timeout');
    expect(res.pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(mockRenderWorkbookToPdf).toHaveBeenCalledTimes(1);
  });

  it('PR 4.2.2: un cache-hit previo en hotEditorialCache responde 200 (typst_cached) aunque Neon falle después, sin cobrar cuota ni lanzar 503', async () => {
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', true);
    const cachedPdf = Buffer.from('%PDF-1.7\n%hot-cache-resilient-blob-bytes-' + '9'.repeat(120) + '\n%%EOF');
    const planning = makeFixturePlanning();
    const wb = makeFixtureWorkbook(0);

    // Llamada 1: Neon responde normalmente y calienta hotEditorialCache
    mockGetEditorialBookByPlanningAndHash.mockResolvedValueOnce({
      id: 'eb-hot-1',
      status: 'completed',
      pdf_storage_path: 'https://blob.vercel-storage.com/editorial-books/hot-cached.pdf',
      page_count: 22,
    });
    mockReadEditorialPdfFromStorage.mockResolvedValueOnce(cachedPdf);

    const first = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      blockIndex: 0,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
      quotaContext: { teacherId: 'teacher-001', teacherEmail: 'docente@sep.gob.mx' },
    });
    expect(first.engine).toBe('typst_cached');
    expect(first.cached).toBe(true);

    // Llamada 2: Neon cae (ECONNREFUSED), pero hotEditorialCache + Blob siguen sirviendo el PDF
    mockGetEditorialBookByPlanningAndHash.mockRejectedValueOnce(new Error('Neon ECONNREFUSED'));
    mockReadEditorialPdfFromStorage.mockResolvedValueOnce(cachedPdf);

    const second = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      blockIndex: 0,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
      quotaContext: { teacherId: 'teacher-001', teacherEmail: 'docente@sep.gob.mx' },
    });

    expect(second.engine).toBe('typst_cached');
    expect(second.cached).toBe(true);
    expect(second.pageCount).toBe(22);
    expect(second.pdfBuffer.equals(cachedPdf)).toBe(true);
    expect(mockAcquireEditorialConcurrencyLock).not.toHaveBeenCalled();
    expect(mockEnforceUsageQuota).not.toHaveBeenCalled();
    expect(mockDispatchToEditorialWorker).not.toHaveBeenCalled();
    expect(mockRenderWorkbookToPdf).not.toHaveBeenCalled();
  });

  it('PR 4.2.2: si Render falla tras consumir cuota pdf_compile, reembolsa la cuota automáticamente antes del fallback jsPDF', async () => {
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', true);
    mockGetEditorialBookByPlanningAndHash.mockResolvedValueOnce(null);
    mockDispatchToEditorialWorker.mockRejectedValueOnce(new Error('Render 502 Bad Gateway'));

    const planning = makeFixturePlanning();
    const wb = makeFixtureWorkbook(0);
    const res = await compileUnifiedEditorialPdf({
      planningId: planning.id,
      planning,
      blockIndex: 0,
      workbooksMap: { block_0: { current: wb } },
      fallbackWorkbook: wb,
      quotaContext: { teacherId: 'teacher-001', teacherEmail: 'docente@sep.gob.mx' },
    });

    expect(res.engine).toBe('jspdf_fallback');
    expect(res.fallbackReason).toContain('Render 502');
    expect(mockAcquireEditorialConcurrencyLock).toHaveBeenCalledTimes(1);
    expect(mockEnforceUsageQuota).toHaveBeenCalledTimes(1);
    expect(mockRefundUsageQuota).toHaveBeenCalledTimes(1);
    expect(mockRefundUsageQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: 'teacher-001',
        quota: expect.objectContaining({ metric: 'pdf_compile', alreadyCounted: false }),
      }),
    );
    expect(mockReleaseEditorialConcurrencyLock).toHaveBeenCalledTimes(1);
    expect(mockRenderWorkbookToPdf).toHaveBeenCalledTimes(1);
  });

  it.skipIf(!isTypstAvailableSync())(
    'PR 4.1: smoke real de typst.exe 0.15.1 disponible en local para fallback offline',
    () => {
      expect(isTypstAvailableSync()).toBe(true);
    },
  );
});
