/**
 * paec-orchestrator.test.ts
 * 
 * Tests unitarios y de integración para PaecOrchestrator (Nivel 1) y el patrón
 * Strangler Fig bajo control de la feature flag PAEC_ORCHESTRATOR_V2 (Fase D).
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
import { POST as handlePaecParsePreviousPost } from '@/app/api/paec/parse-previous/route';
import {
  paecOrchestrator,
  PaecOrchestrator,
  PaecOrchestratorError,
} from '@/lib/paec/orchestrator';
import {
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
} from '@/lib/platform/feature-flags';

const mockTeacher = {
  id: 'teacher-paec-123',
  email: 'docente.paec@bachillerato.edu.mx',
  name: 'Prof. Carlos Mendoza',
};

describe('PaecOrchestrator (Fase D — Piloto Nivel 1 & Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
    vi.mocked(auth).mockResolvedValue({
      user: { email: mockTeacher.email },
    } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
    vi.mocked(resolveUserIsPremium).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Implementa IProgramSystem con programId "paec" y versión canónica "2.0.0"', () => {
    expect(paecOrchestrator.programId).toBe('paec');
    expect(paecOrchestrator.version).toBe('2.0.0');
    expect(paecOrchestrator).toBeInstanceOf(PaecOrchestrator);
  });

  it('2. healthCheck reporta healthy cuando BD e IA están configuradas, y degraded honesto ante ausencias', async () => {
    // Configuración completa
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');

    const health = await paecOrchestrator.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.checks.databaseConfigured).toBe(true);
    expect(health.checks.aiServiceConfigured).toBe(true);
    expect(health.checks.featureFlagService).toBe(true);

    // Degraded por ausencia de BD
    vi.stubEnv('DATABASE_URL', '');
    const degradedDb = await paecOrchestrator.healthCheck();
    expect(degradedDb.status).toBe('degraded');
    expect(degradedDb.checks.databaseConfigured).toBe(false);

    // Degraded por ausencia de clave IA
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', '');
    const degradedAi = await paecOrchestrator.healthCheck();
    expect(degradedAi.status).toBe('degraded');
    expect(degradedAi.checks.aiServiceConfigured).toBe(false);
  });

  it('3. getMetrics retorna estructura con programId, versión, tenantId y banderas', async () => {
    const metrics = await paecOrchestrator.getMetrics('escuela-cct-21ebh');
    expect(metrics.programId).toBe('paec');
    expect(metrics.version).toBe('2.0.0');
    expect(metrics.tenantId).toBe('escuela-cct-21ebh');
    expect((metrics.flags as Record<string, boolean>).PAEC_ORCHESTRATOR_V2).toBe(false);
  });

  it('4. Política B-001 (Zero Silent Stubs): métodos no migrados lanzan explícitamente 501 NOT_IMPLEMENTED', async () => {
    await expect(paecOrchestrator.generateProject()).rejects.toThrow(PaecOrchestratorError);
    await expect(paecOrchestrator.generateProject()).rejects.toMatchObject({ status: 501 });

    await expect(paecOrchestrator.auditProject()).rejects.toThrow(PaecOrchestratorError);
    await expect(paecOrchestrator.auditProject()).rejects.toMatchObject({ status: 501 });

    await expect(paecOrchestrator.renderDOCX()).rejects.toThrow(PaecOrchestratorError);
    await expect(paecOrchestrator.renderDOCX()).rejects.toMatchObject({ status: 501 });

    await expect(paecOrchestrator.renderPDF()).rejects.toThrow(PaecOrchestratorError);
    await expect(paecOrchestrator.renderPDF()).rejects.toMatchObject({ status: 501 });
  });

  it('5. ingestPrevious valida longitud mínima y extrae proyecto PAEC con IA', async () => {
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: 'Texto muy corto',
      fullText: 'Texto muy corto',
      totalPages: 1,
    } as never);

    await expect(
      paecOrchestrator.ingestPrevious(Buffer.from('short'), {
        filename: 'corto.pdf',
        teacherId: mockTeacher.id,
      })
    ).rejects.toThrow('El documento no contiene texto legible ni datos extraíbles.');

    // Ingesta exitosa
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# Proyecto PAEC Comunitario\nDiagnóstico de agua potable y reforestación en la comunidad...',
      fullText: 'Proyecto PAEC Comunitario Diagnóstico de agua potable y reforestación en la comunidad...',
      totalPages: 2,
    } as never);

    vi.mocked(generateWithRotation).mockResolvedValueOnce(
      JSON.stringify({
        projectName: 'Cuidado Comunitario del Agua',
        problemStatement: 'Escasez y contaminación de mantos acuíferos en la región',
        cycleType: 'A',
        schoolType: 'general',
        school: {
          schoolName: 'Bachillerato General Moisés Sáenz Garza',
          cct: '21EBH0465E',
        },
        community: {
          problematics: 'Falta de drenaje y tratamiento de aguas residuales',
        },
      })
    );

    const result = await paecOrchestrator.ingestPrevious(Buffer.from('mock paec file'), {
      filename: 'paec_anterior.docx',
      teacherId: mockTeacher.id,
    });

    expect(result.success).toBe(true);
    expect(result.filename).toBe('paec_anterior.docx');
    expect(result.data.projectName).toBe('Cuidado Comunitario del Agua');
    expect(result.data.school?.cct).toBe('21EBH0465E');
  });

  it('6. Strangler Fig: /api/paec/parse-previous ejecuta legacy por defecto (flag OFF)', async () => {
    expect(isFeatureEnabled('PAEC_ORCHESTRATOR_V2')).toBe(false);

    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# PAEC Anterior Legacy\nTexto completo de prueba con más de cuarenta caracteres institucionales...',
      fullText: 'PAEC Anterior Legacy Texto completo de prueba con más de cuarenta caracteres institucionales...',
      totalPages: 1,
    } as never);

    vi.mocked(generateWithRotation).mockResolvedValueOnce(
      JSON.stringify({
        projectName: 'Huerto Escolar Sustentable',
        problemStatement: 'Falta de educación agroecológica',
      })
    );

    const file = new File(['mock paec file bytes'], 'paec_legacy.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/paec/parse-previous', {
      method: 'POST',
      body: formData,
    });

    const res = await handlePaecParsePreviousPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.projectName).toBe('Huerto Escolar Sustentable');
  });

  it('7. Strangler Fig: /api/paec/parse-previous delega a paecOrchestrator cuando PAEC_ORCHESTRATOR_V2 = true', async () => {
    setFeatureFlag('PAEC_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('PAEC_ORCHESTRATOR_V2')).toBe(true);

    const spyOrchestrator = vi.spyOn(paecOrchestrator, 'ingestPrevious').mockResolvedValueOnce({
      success: true,
      filename: 'paec_strangler.pdf',
      data: {
        projectName: 'Proyecto V2 Orquestado',
        problemStatement: 'Problemática V2',
        cycleType: 'A',
        schoolType: 'general',
        school: {},
        community: {},
        selectedLaboral: [],
        selectedFfe: [],
      },
    });

    const file = new File(['mock paec v2 bytes'], 'paec_strangler.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/paec/parse-previous', {
      method: 'POST',
      body: formData,
    });

    const res = await handlePaecParsePreviousPost(req);
    const json = await res.json();

    expect(spyOrchestrator).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.projectName).toBe('Proyecto V2 Orquestado');
  });

  it('8. Mapea caídas de IA upstream a HTTP 503 tanto con flag ON como con flag OFF', async () => {
    // Flag ON
    setFeatureFlag('PAEC_ORCHESTRATOR_V2', true);
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# PAEC Texto con más de cuarenta caracteres institucionales...',
      fullText: 'PAEC Texto con más de cuarenta caracteres institucionales...',
      totalPages: 1,
    } as never);
    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new Error('[ai-provider] All AI providers exhausted. Original error: HTTP 503: Service Unavailable')
    );

    const file = new File(['bytes'], 'paec.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const reqOn = new NextRequest('http://localhost:3000/api/paec/parse-previous', {
      method: 'POST',
      body: formData,
    });
    const resOn = await handlePaecParsePreviousPost(reqOn);
    expect(resOn.status).toBe(503);

    // Flag OFF
    resetFeatureFlags();
    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# PAEC Texto con más de cuarenta caracteres institucionales...',
      fullText: 'PAEC Texto con más de cuarenta caracteres institucionales...',
      totalPages: 1,
    } as never);
    vi.mocked(generateWithRotation).mockRejectedValueOnce(
      new Error('GoogleGenerativeAIError: [503] UNAVAILABLE')
    );

    const reqOff = new NextRequest('http://localhost:3000/api/paec/parse-previous', {
      method: 'POST',
      body: formData,
    });
    const resOff = await handlePaecParsePreviousPost(reqOff);
    expect(resOff.status).toBe(503);
  });

  it('9. Invariante Reto Situado: valida criptográficamente que planning-evaluator.ts está intacto', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const crypto = await import('node:crypto');

    const filePath = path.resolve(process.cwd(), 'src/lib/planning-evaluator.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const hash = crypto.createHash('sha256').update(normalizedContent).digest('hex');

    expect(hash).toBe('d030d785788c2b41a13abb83fa0e24b46f1ebd4cc82cfaf6b1cb8c852cf5a653');
  });

  it('10. Con PAEC_ORCHESTRATOR_V2 = true, tolera nulls y ejecuta reintento correctivo ante parseo inicial fallido', async () => {
    setFeatureFlag('PAEC_ORCHESTRATOR_V2', true);

    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# PAEC Texto con más de cuarenta caracteres institucionales para superar el filtro...',
      fullText: 'PAEC Texto con más de cuarenta caracteres institucionales para superar el filtro...',
      totalPages: 1,
    } as never);

    // Primer intento con JSON roto que falla Zod
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce('JSON malformado que fallará Zod: { projectName: 12345 }')
      // Segundo intento correctivo con nulls
      .mockResolvedValueOnce(JSON.stringify({
        projectName: 'Proyecto Agroecológico Comunitario',
        problemStatement: null,
        cycleType: 'annual',
        schoolType: 'general',
        school: {
          schoolName: null,
          cct: '21EBH0001A',
        },
        community: {
          context: null,
        },
      }));

    const file = new File(['mock bytes'], 'paec_retry.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/paec/parse-previous', {
      method: 'POST',
      body: formData,
    });

    const res = await handlePaecParsePreviousPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.projectName).toBe('Proyecto Agroecológico Comunitario');
    expect(json.data.problemStatement).toBe('');
    expect(json.data.school.cct).toBe('21EBH0001A');
  });

  it('11. Con PAEC_ORCHESTRATOR_V2 = false (ruta legacy), tolera nulls y ejecuta reintento correctivo ante parseo inicial fallido (H-013)', async () => {
    setFeatureFlag('PAEC_ORCHESTRATOR_V2', false);

    vi.mocked(ingestDocument).mockResolvedValueOnce({
      markdown: '# PAEC Texto con más de cuarenta caracteres institucionales para superar el filtro...',
      fullText: 'PAEC Texto con más de cuarenta caracteres institucionales para superar el filtro...',
      totalPages: 1,
    } as never);

    // Primer intento con JSON malformado
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce('JSON malformado que fallará Zod: { projectName: 99999 }')
      // Segundo intento correctivo con nulls reparados
      .mockResolvedValueOnce(JSON.stringify({
        projectName: 'Proyecto Agroecológico Comunitario Legacy',
        problemStatement: null,
        cycleType: 'annual',
        schoolType: 'general',
        school: {
          schoolName: null,
          cct: '21EBH0002B',
        },
        community: {
          context: null,
        },
      }));

    const file = new File(['mock bytes'], 'paec_legacy_retry.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const req = new NextRequest('http://localhost:3000/api/paec/parse-previous', {
      method: 'POST',
      body: formData,
    });

    const res = await handlePaecParsePreviousPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.projectName).toBe('Proyecto Agroecológico Comunitario Legacy');
    expect(json.data.problemStatement).toBe('');
    expect(json.data.school.cct).toBe('21EBH0002B');
  });
});
