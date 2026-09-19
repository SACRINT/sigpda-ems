/**
 * audit-engine.test.ts
 * Unit tests for src/lib/audit-engine.ts
 *
 * Hoisting: MOCK_AI_JSON_STRING and neon state must be created via vi.hoisted()
 * so they are available when vi.mock() factories are executed.
 */

import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ── 1. Hoist shared mock state (runs before vi.mock factories) ────────────────

const { neonResultQueue, mockNeonTaggedFn, MOCK_AI_RESPONSE } = vi.hoisted(() => {
  const neonResultQueue: unknown[][] = [];
  const mockNeonTaggedFn = vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => {
    const next = neonResultQueue.shift();
    return Promise.resolve(next ?? []);
  });

  // Fixed AI response that audit-engine will receive from generateWithRotation
  const MOCK_AI_RESPONSE = JSON.stringify({
    overall_score: 85,
    compliance_level: 'satisfactorio',
    dimension_scores: {
      propositos_alineacion: { score: 88, weight: 0.30, status: 'cumple',  feedback: 'Bien alineado.' },
      cobertura_contenidos:  { score: 82, weight: 0.25, status: 'cumple',  feedback: 'Cobertura adecuada.' },
      secuenciacion_logica:  { score: 90, weight: 0.25, status: 'cumple',  feedback: 'Secuencia correcta.' },
      adecuacion_evidencias: { score: 78, weight: 0.20, status: 'parcial', feedback: 'Instrumentos mejorables.' },
    },
    findings: {
      fortalezas:           ['Actividades bien diseñadas'],
      desalineaciones:      [],
      omisiones_detectadas: ['Falta abordar propósito 3'],
      propositos_cubiertos: ['P1', 'P2'],
      propositos_omitidos:  ['P3'],
    },
    recommendations: [{
      dimension: 'adecuacion_evidencias',
      severidad: 'media',
      mensaje: 'Agregar rúbrica de evaluación final.',
    }],
  });

  return { neonResultQueue, mockNeonTaggedFn, MOCK_AI_RESPONSE };
});

// ── 2. Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockNeonTaggedFn),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn().mockResolvedValue(MOCK_AI_RESPONSE),
}));

vi.mock('@/lib/ai-response-parser', () => ({
  robustJsonParse: vi.fn((raw: string) => JSON.parse(raw)),
}));

// ── 3. Module under test ──────────────────────────────────────────────────────

import { runPedagogicalAudit, type AuditReport } from '@/lib/audit-engine';
import { generateWithRotation } from '@/lib/ai-provider';

// ── Helper ────────────────────────────────────────────────────────────────────

function enqueue(...results: unknown[][]) {
  neonResultQueue.push(...results);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_PLANNING = {
  id: 'planning-uuid-001', teacher_id: 'teacher-uuid-001',
  uac_name: 'Matemáticas', semester: 2, component: 'Fundamental',
  curriculum_name: 'MCCEMS', paec_context: 'Contexto comunitario de prueba',
  extracted_data: {}, content_json: { sectionI: { teacherName: 'Docente Test' } },
  status: 'draft',
};

const MOCK_OFFICIAL_PROGRAM = {
  id: 'prog-uuid-001', uac_name: 'Matemáticas', semester: 2,
  component: 'Fundamental', subsystem: 'bge', model_type: 'MCCEMS',
  total_hours: 64,
  learning_outcome: 'El estudiante aplica pensamiento matemático en contextos reales.',
  activities: ['Resolución de problemas', 'Modelación matemática'],
  contenidos_formativos: ['Álgebra', 'Geometría analítica'],
  evidences: ['Portafolio', 'Proyecto final'],
};

const MOCK_INSERTED = [{ id: 'audit-uuid-001', created_at: '2026-09-18T20:00:00Z' }];

// ─────────────────────────────────────────────────────────────────────────────

describe('audit-engine.ts — Pedagogical Audit', () => {
  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost/sigpda_test');
  });

  beforeEach(() => {
    neonResultQueue.length = 0;
    mockNeonTaggedFn.mockClear();
    (generateWithRotation as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AI_RESPONSE);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('runPedagogicalAudit — genera AuditReport completo con score y dimensiones', async () => {
    enqueue(
      [MOCK_PLANNING],          // 1. SELECT from plannings
      [MOCK_OFFICIAL_PROGRAM],  // 2. SELECT from programs_catalog (exact)
      [],                       // 3. DELETE FROM audit_results
      MOCK_INSERTED,            // 4. INSERT RETURNING
    );

    const report: AuditReport = await runPedagogicalAudit('planning-uuid-001');

    expect(report.overall_score).toBe(85);
    expect(report.compliance_level).toBe('satisfactorio');
    expect(report.dimension_scores.propositos_alineacion.score).toBe(88);
    expect(report.dimension_scores.propositos_alineacion.status).toBe('cumple');
    expect(report.dimension_scores.adecuacion_evidencias.status).toBe('parcial');
    expect(report.findings.fortalezas).toContain('Actividades bien diseñadas');
    expect(report.findings.omisiones_detectadas).toContain('Falta abordar propósito 3');
    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0].dimension).toBe('adecuacion_evidencias');
    expect(report.recommendations[0].severidad).toBe('media');
  });

  it('runPedagogicalAudit — llama a generateWithRotation exactamente una vez', async () => {
    enqueue([MOCK_PLANNING], [MOCK_OFFICIAL_PROGRAM], [], MOCK_INSERTED);
    await runPedagogicalAudit('planning-uuid-001', { teacherId: 'teacher-uuid-001' });
    expect(generateWithRotation).toHaveBeenCalledTimes(1);
  });

  it('runPedagogicalAudit — normaliza overall_score > 100 a 100', async () => {
    const aiOver = JSON.stringify({ ...JSON.parse(MOCK_AI_RESPONSE), overall_score: 150 });
    (generateWithRotation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(aiOver);
    enqueue([MOCK_PLANNING], [MOCK_OFFICIAL_PROGRAM], [], MOCK_INSERTED);

    const report = await runPedagogicalAudit('planning-uuid-001');
    expect(report.overall_score).toBe(100);
  });

  it('runPedagogicalAudit — lanza error si la planeación no existe en DB', async () => {
    enqueue([]); // plannings vacío
    await expect(runPedagogicalAudit('planning-inexistente')).rejects.toThrow(
      'No se encontró la planeación',
    );
  });

  it('runPedagogicalAudit — funciona sin programa oficial (usa fallback desde planning)', async () => {
    enqueue(
      [MOCK_PLANNING],
      [],  // programs_catalog exact match: vacío
      [],  // programs_catalog fuzzy match: vacío
      [],  // DELETE
      MOCK_INSERTED,
    );

    const report = await runPedagogicalAudit('planning-uuid-001');
    expect(report.overall_score).toBe(85);
    expect(report.official_program_ref).toBeDefined();
    expect((report.official_program_ref as { uac_name: string }).uac_name).toBe('Matemáticas');
  });

  it('compliance_level se calcula correctamente según overall_score', async () => {
    // Score 92 → excelente
    const aiExcelente = JSON.stringify({ ...JSON.parse(MOCK_AI_RESPONSE), overall_score: 92 });
    (generateWithRotation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(aiExcelente);
    enqueue([MOCK_PLANNING], [MOCK_OFFICIAL_PROGRAM], [], MOCK_INSERTED);

    const report = await runPedagogicalAudit('planning-uuid-001');
    expect(report.compliance_level).toBe('excelente');
  });
});
