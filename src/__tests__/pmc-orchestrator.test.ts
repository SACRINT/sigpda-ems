/**
 * pmc-orchestrator.test.ts
 * 
 * Tests unitarios y de integración para PmcOrchestrator (Nivel 1) y el patrón
 * Strangler Fig bajo control de la feature flag PMC_ORCHESTRATOR_V2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  resolveUserIsPremium: vi.fn(),
}));

vi.mock('@/lib/document-ingestion', () => ({
  ingestDocument: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail } from '@/lib/db';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { ingestDocument } from '@/lib/document-ingestion';
import { POST as handleF11Post } from '@/app/api/pmc/f11/route';
import { POST as handle911Post } from '@/app/api/pmc/estadistica-911/route';
import { POST as handleParsePreviousPost } from '@/app/api/pmc/parse-previous/route';
import {
  pmcOrchestrator,
  PmcOrchestrator,
  PmcOrchestratorError,
  isUpstreamAIError,
  withTimeoutBudget,
  type PmcDocumentType,
} from '@/lib/pmc/orchestrator';
import {
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
} from '@/lib/platform/feature-flags';

const mockTeacher = {
  id: 'teacher-uuid-456',
  email: 'docente.pmc@bachillerato.edu.mx',
  name: 'Mtra. Elena Garro',
};

describe('PmcOrchestrator (Piloto Nivel 1 & Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('1. Con flag OFF (legacy default): ejecuta el flujo existente de forma byte-idéntica', async () => {
    expect(isFeatureEnabled('PMC_ORCHESTRATOR_V2')).toBe(false);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(false);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'Texto oficial F11 con más de cuarenta caracteres suficientes para el flujo legacy.',
      markdown: 'Texto oficial F11 con más de cuarenta caracteres suficientes para el flujo legacy.',
      pageCount: 1,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO HEROES DE LA PATRIA',
      schoolCct: '21EBH0282Y',
      cicloEscolar: '2025-2026',
      semestre: 'B',
      totalAlumnos: 100,
      aprobadosPorcentaje: 90,
      reprobadosPorcentaje: 10,
      promedioGeneral: 8.5,
      promediosPorAsignatura: { 'Matemáticas': 8.0 },
      materiasMayorReprobacion: [],
    });
    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['mock content'], 'f11_legacy.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.filename).toBe('f11_legacy.pdf');
    expect(json.data.schoolCct).toBe('21EBH0282Y');
    expect(json.data.promedioGeneral).toBe(8.5);
  });

  it('2. Con flag ON: /api/pmc/f11 delega al orquestador y retorna 200 con estructura F11 válida', async () => {
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('PMC_ORCHESTRATOR_V2')).toBe(true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'Reporte oficial F11 procesado por el nuevo Orquestador Central Nivel 1 con texto suficiente.',
      markdown: 'Reporte oficial F11 procesado por el nuevo Orquestador Central Nivel 1 con texto suficiente.',
      pageCount: 2,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO GENERAL PUEBLA',
      schoolCct: '21EBH0100A',
      cicloEscolar: '2026-2027',
      semestre: 'A',
      totalAlumnos: 150,
      aprobadosPorcentaje: 92.5,
      reprobadosPorcentaje: 7.5,
      promedioGeneral: 8.8,
      promediosPorAsignatura: { 'Pensamiento Matemático I': 8.2 },
      materiasMayorReprobacion: [],
    });
    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['buffer f11'], 'f11_orchestrated.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.filename).toBe('f11_orchestrated.pdf');
    expect(json.data.schoolCct).toBe('21EBH0100A');
    expect(json.data.promedioGeneral).toBe(8.8);
  });

  it('3. Con flag ON: /api/pmc/estadistica-911 delega al orquestador y preserva momento y datos oficiales', async () => {
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'ESTADISTICA 911 FORMULARIO OFICIAL FIN DE CURSOS CON INFORMACION SUFICIENTE PARA PROCESAR.',
      markdown: 'ESTADISTICA 911 FORMULARIO OFICIAL FIN DE CURSOS CON INFORMACION SUFICIENTE PARA PROCESAR.',
      pageCount: 3,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO GENERAL PUEBLA',
      schoolCct: '21EBH0100A',
      cicloEscolar: '2025-2026',
      momento: 'fin_anterior',
      matricula: 290,
      abandonoPorcentaje: 5.4,
      eficienciaTerminal: 89.2,
      totalDocentes: 16,
    });
    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['911 content'], '911_orchestrated.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('momento', 'fin_anterior');

    const req = new NextRequest('http://localhost:3000/api/pmc/estadistica-911', {
      method: 'POST',
      body: formData,
    });
    const res = await handle911Post(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.filename).toBe('911_orchestrated.pdf');
    expect(json.data.momento).toBe('fin_anterior');
    expect(json.data.matricula).toBe(290);
    expect(json.data.abandonoPorcentaje).toBe(5.4);
    expect(json.data.eficienciaTerminal).toBe(89.2);
  });

  it('4. Con flag ON: maneja error 400 cuando el documento carece de texto suficiente', async () => {
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'vacio',
      markdown: 'vacio',
      pageCount: 1,
    } as never);

    const file = new File(['too short'], 'blank.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', {
      method: 'POST',
      body: formData,
    });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('no contiene texto legible');
  });

  it('5. Valida salud y métricas del orquestador bajo el contrato IProgramSystem (Nivel 2)', async () => {
    expect(pmcOrchestrator).toBeInstanceOf(PmcOrchestrator);
    expect(pmcOrchestrator.programId).toBe('pmc');

    // Estado con dependencias configuradas
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'test-key-mock');

    const health = await pmcOrchestrator.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.checks.databaseConfigured).toBe(true);
    expect(health.checks.aiServiceConfigured).toBe(true);
    expect(health.checks.featureFlagService).toBe(true);

    // Estado degradado cuando falta configuración crítica (BD o IA)
    vi.stubEnv('DATABASE_URL', '');
    const degradedHealth = await pmcOrchestrator.healthCheck();
    expect(degradedHealth.status).toBe('degraded');
    expect(degradedHealth.checks.databaseConfigured).toBe(false);

    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', '');
    const degradedAiHealth = await pmcOrchestrator.healthCheck();
    expect(degradedAiHealth.status).toBe('degraded');
    expect(degradedAiHealth.checks.aiServiceConfigured).toBe(false);

    vi.unstubAllEnvs();

    const metrics = await pmcOrchestrator.getMetrics('escuela-test-456');
    expect(metrics.programId).toBe('pmc');
    expect(metrics.tenantId).toBe('escuela-test-456');
  });

  it('6. Lanza PmcOrchestratorError cuando el tipo de documento es desconocido', async () => {
    await expect(
      pmcOrchestrator.ingestDocument('desconocido' as unknown as PmcDocumentType, Buffer.from('test'), {
        filename: 'test.pdf',
        teacherId: 'teacher-123',
      })
    ).rejects.toThrow(PmcOrchestratorError);
  });

  it('7. Paridad de contrato 422 en F11: tanto flag OFF como ON retornan HTTP 422 con mensaje idéntico', async () => {
    const file = new File(['mock content bytes'], 'f11_err.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    // Mock común de ingestión que retorna texto suficiente pero IA retorna JSON malformado
    vi.mocked(auth).mockResolvedValue({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValue(false);
    vi.mocked(ingestDocument).mockResolvedValue({
      fullText: 'Reporte F11 con suficiente texto para pasar la validacion de cuarenta caracteres minimos.',
      markdown: 'Reporte F11 con suficiente texto para pasar la validacion de cuarenta caracteres minimos.',
      pageCount: 1,
    } as never);
    vi.mocked(generateWithRotation).mockResolvedValue('Respuesta invalida que no parsea contra schema');

    // 1. Ejecución con Flag OFF (Legacy)
    resetFeatureFlags();
    const reqOff = new NextRequest('http://localhost:3000/api/pmc/f11', { method: 'POST', body: formData });
    const resOff = await handleF11Post(reqOff);
    const jsonOff = await resOff.json();

    // 2. Ejecución con Flag ON (Orchestrator)
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);
    const reqOn = new NextRequest('http://localhost:3000/api/pmc/f11', { method: 'POST', body: formData });
    const resOn = await handleF11Post(reqOn);
    const jsonOn = await resOn.json();

    expect(resOff.status).toBe(422);
    expect(resOn.status).toBe(422);
    expect(jsonOn.error).toContain('No se pudieron estructurar los datos del F11:');
    expect(jsonOff.error).toContain('No se pudieron estructurar los datos del F11:');
  });

  it('8. Strangler parse-previous con flag OFF: ejecuta legacy y normaliza categorias/temas', async () => {
    resetFeatureFlags();

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'PMC anterior oficial con texto suficiente para superar la validacion de cuarenta caracteres.',
      markdown: 'PMC anterior oficial con texto suficiente para superar la validacion de cuarenta caracteres.',
      pageCount: 2,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO HEROES DE LA PATRIA',
      schoolCct: '21EBH0282Y',
      cicloEscolar: '2025-2026',
      staffData: [
        {
          nombre: 'Prof. Pedro Infante',
          cargo: 'Docente',
          metas_individuales: [
            {
              categoria: '1',
              tema: 'tutorias',
              meta: 'Disminuir reprobación',
            },
          ],
        },
      ],
    });
    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['mock prev bytes'], 'pmc_anterior.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/parse-previous', { method: 'POST', body: formData });
    const res = await handleParsePreviousPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.staffData).toBeDefined();
    expect(json.data.staffData[0].nombre).toBe('Prof. Pedro Infante');
    expect(json.data.staffData[0].metas_individuales[0].categoria).toBe('Desarrollo académico y aprendizaje');
  });

  it('9. Strangler parse-previous con flag ON: delega en PmcOrchestrator y normaliza categorias/temas', async () => {
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValueOnce(true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      fullText: 'PMC anterior procesado via orquestador con texto suficiente para superar la validacion.',
      markdown: 'PMC anterior procesado via orquestador con texto suficiente para superar la validacion.',
      pageCount: 2,
    } as never);

    const validAiResponse = JSON.stringify({
      schoolName: 'BACHILLERATO GENERAL PUEBLA',
      schoolCct: '21EBH0100A',
      cicloEscolar: '2025-2026',
      staffData: [
        {
          nombre: 'Mtra. María Félix',
          cargo: 'Directora',
          metas_individuales: [
            {
              categoria: 'categoria 2',
              tema: 'recursos',
              meta: 'Equipar laboratorio',
            },
          ],
        },
      ],
    });
    vi.mocked(generateWithRotation).mockResolvedValueOnce(validAiResponse);

    const file = new File(['mock prev bytes'], 'pmc_prev_orchestrated.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/parse-previous', { method: 'POST', body: formData });
    const res = await handleParsePreviousPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.staffData[0].nombre).toBe('Mtra. María Félix');
    expect(json.data.staffData[0].metas_individuales[0].categoria).toBe('Gestión y administración escolar');
  });

  it('10. Métodos no implementados en orquestador PMC lanzan PmcOrchestratorError con HTTP 501', async () => {
    await expect(pmcOrchestrator.generate()).rejects.toThrow(PmcOrchestratorError);
    await expect(pmcOrchestrator.importPaec()).rejects.toThrow(PmcOrchestratorError);
    await expect(pmcOrchestrator.renderDOCX()).rejects.toThrow(PmcOrchestratorError);

    try {
      await pmcOrchestrator.generate();
    } catch (err) {
      expect(err).toBeInstanceOf(PmcOrchestratorError);
      expect((err as PmcOrchestratorError).status).toBe(501);
    }
  });

  it('11. Mapea fallos de upstream de IA (503 UNAVAILABLE / All providers exhausted) a HTTP 503 en vez de 400 o 500', async () => {
    setFeatureFlag('PMC_ORCHESTRATOR_V2', true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'director@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 'teacher-director-1', email: 'director@bachillerato.edu.mx' } as never);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# Actas F11\nDatos completos con más de cuarenta caracteres...',
      fullText: 'Actas F11 Datos completos con más de cuarenta caracteres...',
      totalPages: 1,
    } as never);

    // Simular caída global de Gemini / proveedores upstream con HTTP 503
    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new Error('[ai-provider] All AI providers exhausted. Primary: gemini. Alternatives tried: openrouter. Original error: HTTP 503: This model is currently experiencing high demand.')
    );

    const file = new File(['mock f11 bytes'], 'f11_documento.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', { method: 'POST', body: formData });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toContain('alta demanda o saturación temporal');
  });

  describe('12. isUpstreamAIError — Clasificación acotada de fallos de IA (F-003)', () => {
    it('reconoce códigos de estado HTTP 429, 503, 504 en objetos de error', () => {
      expect(isUpstreamAIError({ status: 503 })).toBe(true);
      expect(isUpstreamAIError({ statusCode: 504 })).toBe(true);
      expect(isUpstreamAIError({ status: 429 })).toBe(true);
    });

    it('reconoce firmas canónicas de proveedores de IA', () => {
      expect(isUpstreamAIError(new Error('GoogleGenerativeAIError: [503 Service Unavailable] UNAVAILABLE'))).toBe(true);
      expect(isUpstreamAIError(new Error('This model is currently experiencing high demand.'))).toBe(true);
      expect(isUpstreamAIError(new Error('[ai-provider] All AI providers exhausted. Primary: gemini.'))).toBe(true);
      expect(isUpstreamAIError(new Error('Rate-limit exceeded for tier'))).toBe(true);
      expect(isUpstreamAIError(new Error('upstream rate limit reached'))).toBe(true);
      expect(isUpstreamAIError(new Error('RESOURCE_EXHAUSTED'))).toBe(true);
      expect(isUpstreamAIError(new Error('MODEL_CAPACITY_EXCEEDED'))).toBe(true);
      expect(isUpstreamAIError(new Error('Request aborted due to timeout'))).toBe(true);
      // D-004: Casos crudos de proveedores alternativos o proxies
      expect(isUpstreamAIError(new Error('HTTP 503: upstream backend connection dropped'))).toBe(true);
      expect(isUpstreamAIError(new Error('upstream service unavailable during peak load'))).toBe(true);
    });

    it('NO clasifica como IA errores de base de datos o validaciones genéricas (test negativo)', () => {
      expect(isUpstreamAIError(new Error('Connection timeout to Neon DB'))).toBe(false);
      expect(isUpstreamAIError(new Error('Database query timed out'))).toBe(false);
      expect(isUpstreamAIError(new Error('Postgres error 503001 relation not found'))).toBe(false);
      expect(isUpstreamAIError(new Error('Constraint violation code 42901'))).toBe(false);
      expect(isUpstreamAIError(new Error('HTTP 500: Internal Server Error'))).toBe(false);
      expect(isUpstreamAIError(new Error('Validation error: text is too short'))).toBe(false);
      expect(isUpstreamAIError(null)).toBe(false);
      expect(isUpstreamAIError(undefined)).toBe(false);
    });
  });

  it('13. Camino legacy (PMC_ORCHESTRATOR_V2 = false) mapea fallos de upstream de IA a HTTP 503', async () => {
    resetFeatureFlags(); // Asegurar flag OFF (camino legacy por defecto)

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'director@bachillerato.edu.mx' } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValueOnce({ id: 'teacher-director-1', email: 'director@bachillerato.edu.mx' } as never);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# Actas F11\nDatos completos con más de cuarenta caracteres...',
      fullText: 'Actas F11 Datos completos con más de cuarenta caracteres...',
      totalPages: 1,
    } as never);

    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new Error('[ai-provider] All AI providers exhausted. Primary: gemini. Original error: HTTP 503: Service Unavailable')
    );

    const file = new File(['mock f11 bytes'], 'f11_documento.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/pmc/f11', { method: 'POST', body: formData });
    const res = await handleF11Post(req);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toContain('alta demanda o saturación temporal');
  });

  describe('14. withTimeoutBudget — Presupuesto de tiempo de procesamiento seguro (F-001)', () => {
    it('resuelve normalmente si la promesa concluye antes del timeout', async () => {
      const result = await withTimeoutBudget(Promise.resolve('éxito rápido'), 1000);
      expect(result).toBe('éxito rápido');
    });

    it('aborta y rechaza con status 503 cuando se excede el presupuesto de tiempo', async () => {
      const hungPromise = new Promise<string>(() => {
        // Promesa que nunca resuelve simulando timeout de OCR o IA
      });

      const budgetPromise = withTimeoutBudget(hungPromise, 50, 'Timeout simulado excedido');

      await expect(budgetPromise).rejects.toThrow('Timeout simulado excedido');
      await expect(budgetPromise).rejects.toMatchObject({ status: 503 });
    });
  });
});
