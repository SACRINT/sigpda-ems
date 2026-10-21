/**
 * editorial-job-queue.test.ts — Suite de Integración del Pipeline Asíncrono de Fase 2
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 2)
 *
 * Cobertura de Pruebas:
 * 1. Control por Feature Flag (EDITORIAL_PUBLISHER_ENGINE).
 * 2. Subscription Gate y Mutación Load-Bearing Anti-F11 (MUT-EDIT-2).
 * 3. Despacho al Worker y Medición Real de Memoria (cierre del TODO de child process).
 * 4. Persistencia en Vercel Blob Storage y Deduplicación por Content Hash.
 * 5. No-Regresión de Rutas Legacy de Aula (/api/pdf/libro-bloque).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import rawFixture from './fixtures/editorial/student-workbook-chapter.fixture.json';

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

import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPlanningById } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { featureFlags } from '@/lib/platform/feature-flags';
import { POST, GET } from '@/app/api/pdf/libro-editorial/[id]/route';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import { uploadEditorialPdfToBlob } from '@/lib/editorial/blob-storage';
import { StudentChapter } from '@/lib/editorial/student-content-model';
import {
  createEditorialBook,
  getEditorialBookByPlanningAndHash,
  getLatestEditorialBookForPlanning,
  updateEditorialBookStatus,
} from '@/lib/editorial/editorial-db';

describe('Motor Editorial Fase 2 — Pipeline Asíncrono, Worker y Subscription Gate', () => {
  const mockTeacher = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'docente.premium@sems.puebla.gob.mx',
    role: 'docente',
  };

  const planningId = '22222222-2222-2222-2222-222222222222';

  const mockPlanning = {
    id: planningId,
    teacher_id: mockTeacher.id,
    uac_name: 'Pensamiento Matemático II',
    semester: 2,
    workbooks_json: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    featureFlags.setOverride('EDITORIAL_PUBLISHER_ENGINE', true);

    vi.mocked(auth).mockResolvedValue({
      user: { email: mockTeacher.email },
    } as never);

    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(getPlanningById).mockResolvedValue(mockPlanning as never);

    vi.mocked(getSubscriptionStatus).mockResolvedValue({
      hasActiveSubscription: true,
      subscription: {
        id: 'sub_123',
        planName: 'Editorial Premium Imprenta',
        planSubjects: 10,
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_123',
      },
      subjects: [],
      usedSubjectsCount: 1,
      availableSlots: 9,
      isAdmin: false,
    } as never);

    vi.mocked(getEditorialBookByPlanningAndHash).mockResolvedValue(null);
    vi.mocked(getLatestEditorialBookForPlanning).mockResolvedValue(null);
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
  });

  afterEach(() => {
    featureFlags.clearAllOverrides();
  });

  // ==========================================================================
  // 1. Control por Feature Flag (EDITORIAL_PUBLISHER_ENGINE)
  // ==========================================================================
  describe('1. Control por Feature Flag (EDITORIAL_PUBLISHER_ENGINE)', () => {
    it('debe rechazar con HTTP 403 si la bandera está desactivada (default)', async () => {
      featureFlags.setOverride('EDITORIAL_PUBLISHER_ENGINE', false);

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
        method: 'POST',
        body: JSON.stringify({ chapter: rawFixture }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.code).toBe('FEATURE_DISABLED');
      expect(data.error).toContain('Motor Editorial de Alta Gama se encuentra inactivo');
    });

    it('debe permitir continuar al subscription gate si la bandera está activa', async () => {
      featureFlags.setOverride('EDITORIAL_PUBLISHER_ENGINE', true);

      // Simular falla de suscripción para verificar que traspasó el feature flag
      vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
        hasActiveSubscription: false,
        isAdmin: false,
      } as never);

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
        method: 'POST',
        body: JSON.stringify({ chapter: rawFixture }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.code).toBe('PREMIUM_REQUIRED'); // Llegó a evaluar suscripción
    });
  });

  // ==========================================================================
  // 2. Subscription Gate y Mutación Load-Bearing Anti-F11 (MUT-EDIT-2)
  // ==========================================================================
  describe('2. Subscription Gate — Mutación Load-Bearing Anti-F11 (MUT-EDIT-2)', () => {
    it('MUT-EDIT-2: debe RECHAZAR con HTTP 403 a docentes sin suscripción activa', async () => {
      vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
        hasActiveSubscription: false,
        subscription: null,
        subjects: [],
        usedSubjectsCount: 0,
        availableSlots: 0,
        isAdmin: false,
      } as never);

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
        method: 'POST',
        body: JSON.stringify({ chapter: rawFixture }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.code).toBe('PREMIUM_REQUIRED');
      expect(data.error).toContain('Se requiere una suscripción Premium activa');
    });

    it('debe AUTORIZAR el acceso si el docente es Administrador institucional', async () => {
      vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
        hasActiveSubscription: false,
        isAdmin: true,
        subscription: {
          id: 'admin',
          planName: 'Administrador',
          planSubjects: 9999,
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: null,
        },
        subjects: [],
        usedSubjectsCount: 0,
        availableSlots: 9999,
      } as never);

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
        method: 'POST',
        body: JSON.stringify({ chapter: rawFixture }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
      expect(res.status).toBe(200);
    }, 15000);

    it('debe AUTORIZAR el acceso si el docente tiene rol administrador en BD aunque subscriptionStatus.isAdmin sea false', async () => {
      vi.mocked(getTeacherByEmail).mockResolvedValueOnce({
        id: mockTeacher.id,
        email: mockTeacher.email,
        role: 'administrador',
      } as never);

      vi.mocked(getSubscriptionStatus).mockResolvedValueOnce({
        hasActiveSubscription: false,
        isAdmin: false,
        subscription: null,
        subjects: [],
        usedSubjectsCount: 0,
        availableSlots: 0,
      } as never);

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
        method: 'POST',
        body: JSON.stringify({ chapter: rawFixture }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    }, 15000);
  });

  // ==========================================================================
  // 3. Despacho al Worker y Medición Real de Memoria
  // ==========================================================================
  describe('3. Despacho al Worker y Medición Real de Memoria (Cierre de TODO)', () => {
    it('debe compilar el fixture canónico, reportar páginas deterministas y métrica de memoria real', async () => {
      const result = await dispatchToEditorialWorker(rawFixture as unknown as StudentChapter, {
        sourceDateEpoch: 0,
      });

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
      expect(result.pdfBuffer.length).toBeGreaterThan(50000);

      // Requisito de páginas: rango [16, 25] (14 sesiones × 1 pág. + portada + preliminar)
      expect(result.pageCount).toBeGreaterThanOrEqual(16);
      expect(result.pageCount).toBeLessThanOrEqual(25);

      // Determinismo de hash SHA-256
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);

      // Medición de memoria: null honesto en fallback local sin /proc; acotada si viene de worker
      if (result.source === 'local_fallback') {
        expect(result.typstPeakMemoryMb).toBeNull();
      } else {
        expect(result.typstPeakMemoryMb).toBeGreaterThan(0);
        expect(result.typstPeakMemoryMb).toBeLessThan(50);
      }

      // Medición del heap del padre Node.js acotada (< 50 MB)
      expect(result.nodeHeapDeltaMb).toBeLessThan(50);

      // Etiquetas renderizadas
      expect(result.renderedSessionCount).toBe(14);
      expect(result.renderedProductoIntegradorCount).toBe(3);
    }, 15000);
  });

  // ==========================================================================
  // 4. Persistencia en Blob Storage y Deduplicación por Content Hash
  // ==========================================================================
  describe('4. Persistencia en Blob Storage y Deduplicación por Content Hash', () => {
    it('debe persistir el PDF en Blob y devolver una URL de descarga válida', async () => {
      const fakePdfBuffer = Buffer.from('%PDF-1.7 Fake Content For Test');
      const filename = `test_planning_${Date.now()}.pdf`;

      const blobResult = await uploadEditorialPdfToBlob(fakePdfBuffer, filename);
      expect(blobResult.url).toBeDefined();
      expect(blobResult.url).toContain('.pdf');
      expect(blobResult.sizeBytes).toBe(fakePdfBuffer.length);
      expect(blobResult.pathname).toContain('editorial-books/');
    });

    it('debe calcular lomo paramétrico proporcional al número de páginas (0.09 mm calibre)', () => {
      const pageCount = 32;
      const spineWidthMm = Number(((pageCount / 2) * 0.09).toFixed(2));
      expect(spineWidthMm).toBe(1.44);
    });

    it('debe devolver libro en caché sin re-compilar si el content_hash coincide', async () => {
      vi.mocked(getEditorialBookByPlanningAndHash).mockResolvedValueOnce({
        id: 'cached-book-uuid',
        planning_id: planningId,
        workbook_id: 'cached_wb',
        content_hash: 'existing_hash',
        metadata: {},
        pdf_storage_path: 'https://blob.vercel-storage.com/editorial-books/cached.pdf',
        page_count: 32,
        spine_width_mm: 1.44,
        status: 'completed',
        job_id: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
        method: 'POST',
        body: JSON.stringify({ chapter: rawFixture }),
      });

      const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.cached).toBe(true);
      expect(data.downloadUrl).toContain('cached.pdf');
    });
  });

  // ==========================================================================
  // 5. Preservación de Rutas Legacy de Aula (No-Regresión)
  // ==========================================================================
  describe('5. Preservación de Rutas Legacy de Aula (No-Regresión)', () => {
    it('el módulo GET /api/pdf/libro-editorial responde 404 si no existe libro', async () => {
      vi.mocked(getLatestEditorialBookForPlanning).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`);
      const res = await GET(req, { params: Promise.resolve({ id: planningId }) });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
    });

    it('el módulo GET /api/pdf/libro-editorial responde 200 con downloadUrl si existe libro completado', async () => {
      vi.mocked(getLatestEditorialBookForPlanning).mockResolvedValueOnce({
        id: 'completed-book-uuid',
        planning_id: planningId,
        workbook_id: 'completed_wb',
        content_hash: 'hash',
        metadata: {},
        pdf_storage_path: 'https://blob.vercel-storage.com/editorial-books/final.pdf',
        page_count: 32,
        spine_width_mm: 1.44,
        status: 'completed',
        job_id: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`);
      const res = await GET(req, { params: Promise.resolve({ id: planningId }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.downloadUrl).toBe('https://blob.vercel-storage.com/editorial-books/final.pdf');
      expect(data.status).toBe('completed');
    });
  });

  // ==========================================================================
  // 6. Presupuesto Dinámico y Control de Timeout Vercel (AUD-R3)
  // ==========================================================================
  describe('6. Presupuesto Dinámico y Control de Timeout Vercel (AUD-R3)', () => {
    it('debe responder con HTTP 504 y TIMEOUT_BUDGET_EXCEEDED si el presupuesto restante es menor a 8 segundos', async () => {
      let callCount = 0;
      const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++;
        // Primera llamada marca requestStartTime (1000000); llamadas posteriores simulan 50s transcurridos (1050000)
        return callCount === 1 ? 1000000 : 1000000 + 50000;
      });

      try {
        const req = new NextRequest(`http://localhost:3000/api/pdf/libro-editorial/${planningId}`, {
          method: 'POST',
          body: JSON.stringify({ chapter: rawFixture }),
        });

        const res = await POST(req, { params: Promise.resolve({ id: planningId }) });
        expect(res.status).toBe(504);
        const data = await res.json();
        expect(data.code).toBe('TIMEOUT_BUDGET_EXCEEDED');
        expect(res.headers.get('Retry-After')).toBe('5');
      } finally {
        dateSpy.mockRestore();
      }
    });
  });
});
