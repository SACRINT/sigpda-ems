/**
 * planeaciones-orchestrator.test.ts
 * 
 * Tests unitarios y de integración para PlaneacionOrchestrator (Nivel 1)
 * y el patrón Strangler Fig en /api/planeaciones/evaluar bajo la feature flag
 * PLANEACION_ORCHESTRATOR_V2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  planeacionesOrchestrator,
  PlaneacionOrchestrator,
  PlaneacionOrchestratorError,
} from '@/lib/planeaciones/orchestrator';
import {
  setFeatureFlag,
  resetFeatureFlags,
  isFeatureEnabled,
} from '@/lib/platform/feature-flags';
import type { ResultadoEvaluacion } from '@/lib/planeaciones-evaluator';

// Mocks
const mockDb = vi.fn();
vi.mock('@/lib/db/client', () => ({
  sql: () => mockDb,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/admin-unified', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/planeaciones-evaluator', () => ({
  evaluarPlaneacion: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin-unified';
import { evaluarPlaneacion } from '@/lib/planeaciones-evaluator';
import { POST as handleEvaluarPost } from '@/app/api/planeaciones/evaluar/route';
import * as planningPdfRenderer from '@/lib/planning-pdf-renderer';
import type { Planning } from '@/types/planning';

const mockEvaluationResult: ResultadoEvaluacion = {
  rubricaUsada: 'Anexo 12 USICAMM — Semestres 1-4',
  puntajeTotal: 285,
  puntajeMaximo: 300,
  nivelCumplimiento: 'COMPLETO',
  criterios: [
    {
      id: 'crit-1',
      criterio: 'Alineación Curricular y Saberes',
      categoria: 'Diseño Curricular',
      puntajeMax: 100,
      puntajeObtenido: 95,
      cumple: 'SI',
      evidencia: 'Progresión 1 vinculada a saberes procedimentales.',
      observacion: 'Excelente contextualización.',
      recomendacion: 'Mantener la transversalidad.',
    },
  ],
  puntosFuertes: ['Articulación clara con la Nueva Escuela Mexicana'],
  mejorasUrgentes: [],
  observacionesExtendidas: 'Planeación de alta calidad pedagógica.',
  alineacionPaecPec: 'Vinculada al PEC Comunitario de la Zona 004.',
  retroalimentacionDocente: 'Cumple satisfactoriamente con la normativa estatal.',
  evaluadoAt: new Date().toISOString(),
};

const mockEditorialPlanning: Planning = {
  id: 'plan-editorial-orchestrator-1',
  teacherId: 'teacher-1',
  uacName: 'Sistemas Embebidos e IoT',
  semester: 4,
  component: 'laboral',
  curriculumName: 'Mecatrónica',
  paecContext: 'Proyecto Aula Escuela Comunidad de Telemetría',
  status: 'generated',
  createdAt: new Date(),
  updatedAt: new Date(),
  contentJson: {
    sectionI: {
      teacherName: 'Ing. Docente Titular',
      uacName: 'Sistemas Embebidos e IoT',
      semester: 4,
      groups: '4A',
      schoolYear: '2026-2027',
      applicationPeriod: 'Ago-Dic 2026',
      estimatedSessions: '16',
      component: 'Formación Profesional',
      totalHours: 64,
      subsystem: 'CECyTE',
      schoolName: 'CECyTE Plantel Tepeaca',
      cct: '21ETC0004Y',
      period: '2026-2027',
    },
    sectionII: {
      problematicContext: 'Automatización del monitoreo hídrico en Tepeaca',
      paecLinking: 'Proyecto Aula Escuela Comunidad de Telemetría',
      transversalTheme: 'Cuidado del Agua',
    },
    sectionIII: {
      learningGoal: 'Desarrollar soluciones embebidas para telemetría ambiental.',
      fundamentalConcepts: ['Microcontroladores', 'Sensores de Flujo', 'Comunicaciones'],
    },
    sectionIV: {
      sessions: [
        {
          sessionNum: 1,
          totalSessions: 16,
          phase: 'Apertura',
          title: 'Diagnóstico de instrumentación digital',
          teachingActivity: 'Presentar problemática de desabasto y variables de medición.',
          learningActivity: 'Identificar componentes del circuito medidor de nivel.',
          evidence: 'Diagrama esquemático inicial',
        },
        {
          sessionNum: 2,
          totalSessions: 16,
          phase: 'Desarrollo',
          title: 'Ensamble del circuito con microcontrolador',
          teachingActivity: 'Modelar conexión del sensor ultrasónico y pines GPIO.',
          learningActivity: 'Realizar montaje en protoboard y verificar señales.',
          evidence: 'Circuito funcional en banco de trabajo',
        },
      ],
    },
    sectionV: {
      evaluations: [
        {
          moment: 'Formativa',
          agent: 'Heteroevaluación',
          evidence: 'Circuito funcional',
          instrument: 'Rúbrica analítica',
          weight: '40%',
        },
      ],
    },
  } as unknown as Planning['contentJson'],
  sequenceJson: null,
  extractedData: null,
};

describe('PlaneacionOrchestrator (Piloto Nivel 1 & Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureFlags();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('1. Con flag OFF (legacy default): ejecuta el flujo existente de evaluación de forma byte-idéntica', async () => {
    expect(isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2')).toBe(false);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx', name: 'Prof. Juan' } } as never);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockDb.mockResolvedValueOnce([
      { id: 'teacher-1', name: 'Prof. Juan', role: 'docente', sub_status: 'active' },
    ]);
    vi.mocked(evaluarPlaneacion).mockResolvedValueOnce(mockEvaluationResult);

    const validPlanText = 'Contenido pedagógico detallado con más de cincuenta caracteres para evaluar la planeación docente de forma integral.';
    const req = new Request('http://localhost:3000/api/planeaciones/evaluar', {
      method: 'POST',
      body: JSON.stringify({
        asignatura: 'Pensamiento Matemático I',
        semestre: 1,
        textoPlanificacion: validPlanText,
      }),
    });

    const res = await handleEvaluarPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cached).toBe(false);
    expect(json.resultado.puntajeTotal).toBe(285);
    expect(json.resultado.nivelCumplimiento).toBe('COMPLETO');
  });

  it('2. Con flag ON: delega la evaluación a planeacionesOrchestrator.evaluate() retornando la misma estructura JSON', async () => {
    setFeatureFlag('PLANEACION_ORCHESTRATOR_V2', true);
    expect(isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2')).toBe(true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx', name: 'Prof. Juan' } } as never);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockDb.mockResolvedValueOnce([
      { id: 'teacher-1', name: 'Prof. Juan', role: 'docente', sub_status: 'active' },
    ]);
    vi.mocked(evaluarPlaneacion).mockResolvedValueOnce(mockEvaluationResult);

    const validPlanText = 'Secuencia didáctica oficial MCCEMS para el Bachillerato General con saberes conceptuales y procedimentales.';
    const req = new Request('http://localhost:3000/api/planeaciones/evaluar', {
      method: 'POST',
      body: JSON.stringify({
        asignatura: 'Lengua y Comunicación I',
        semestre: 1,
        textoPlanificacion: validPlanText,
      }),
    });

    const res = await handleEvaluarPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.cached).toBe(false);
    expect(json.resultado.rubricaUsada).toContain('Anexo 12 USICAMM');
    expect(json.resultado.criterios[0].categoria).toBe('Diseño Curricular');
  });

  it('3. Con flag ON: maneja error 400 cuando el texto de la planeación es demasiado corto', async () => {
    setFeatureFlag('PLANEACION_ORCHESTRATOR_V2', true);

    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'docente@bachillerato.edu.mx' } } as never);
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    mockDb.mockResolvedValueOnce([
      { id: 'teacher-1', name: 'Prof. Juan', role: 'docente', sub_status: 'active' },
    ]);

    const req = new Request('http://localhost:3000/api/planeaciones/evaluar', {
      method: 'POST',
      body: JSON.stringify({
        asignatura: 'Química I',
        semestre: 1,
        textoPlanificacion: 'Texto muy corto',
      }),
    });

    const res = await handleEvaluarPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('demasiado corto o inválido');
  });

  it('4. Fase 2: renderPDF() delega en planning-pdf-renderer.ts generando un Buffer de PDF oficial con fuentes Lato/Montserrat', async () => {
    const pdfSpy = vi.spyOn(planningPdfRenderer, 'generatePlanningPDF');

    // 1. Generación exitosa a partir de una instancia Planning en memoria
    const bufferFromObj = await planeacionesOrchestrator.renderPDF(mockEditorialPlanning);
    expect(Buffer.isBuffer(bufferFromObj)).toBe(true);
    expect(bufferFromObj.subarray(0, 4).toString()).toBe('%PDF');
    expect(bufferFromObj.byteLength).toBeGreaterThan(3000);
    // Aserción Anti-F11: verificar que generatePlanningPDF fue invocado formalmente
    expect(pdfSpy).toHaveBeenCalledWith(mockEditorialPlanning, undefined);

    // 2. Generación exitosa resolviendo la planeación desde BD por ID
    mockDb.mockResolvedValueOnce([
      {
        id: 'plan-db-1',
        teacher_id: 'teacher-1',
        uac_name: 'Sistemas Embebidos e IoT',
        semester: 4,
        component: 'laboral',
        curriculum_name: 'Mecatrónica',
        paec_context: 'Comunidad Tepeaca',
        content_json: mockEditorialPlanning.contentJson,
        status: 'generated',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const bufferFromId = await planeacionesOrchestrator.renderPDF('plan-db-1');
    expect(Buffer.isBuffer(bufferFromId)).toBe(true);
    expect(bufferFromId.subarray(0, 4).toString()).toBe('%PDF');
    expect(bufferFromId.byteLength).toBeGreaterThan(3000);
    // Aserción Anti-F11 / F-48: valida que el mapeo BD -> Planning preserve fidelidad en campos clave
    expect(pdfSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'plan-db-1',
        teacherId: 'teacher-1',
        uacName: 'Sistemas Embebidos e IoT',
        semester: 4,
      }),
      undefined
    );

    // 3. Negativo / Robustez: ID inexistente en BD lanza 404
    mockDb.mockResolvedValueOnce([]);
    await expect(planeacionesOrchestrator.renderPDF('plan-inexistente')).rejects.toThrow(PlaneacionOrchestratorError);
    try {
      mockDb.mockResolvedValueOnce([]);
      await planeacionesOrchestrator.renderPDF('plan-inexistente');
    } catch (err) {
      expect(err).toBeInstanceOf(PlaneacionOrchestratorError);
      expect((err as PlaneacionOrchestratorError).status).toBe(404);
    }

    // 4. Negativo / Robustez: Sin parámetros lanza 400
    await expect(planeacionesOrchestrator.renderPDF()).rejects.toThrow(PlaneacionOrchestratorError);
    try {
      await planeacionesOrchestrator.renderPDF();
    } catch (err) {
      expect(err).toBeInstanceOf(PlaneacionOrchestratorError);
      expect((err as PlaneacionOrchestratorError).status).toBe(400);
    }
  });

  it('7. Fase 1: buildSequence() construye secuencia didáctica tripartita validada con SecuenciaGenerateInputSchema', async () => {
    const res = await planeacionesOrchestrator.buildSequence({
      blockIndex: 0,
      totalHours: 12,
    });

    expect(res.success).toBe(true);
    expect(res.blockIndex).toBe(0);
    expect(res.totalHours).toBe(12);

    const sessions = res.sessions as Array<{ phase: string; sessionNumber: number; title: string }>;
    expect(sessions).toHaveLength(12);

    // Distribución tripartita oficial MCCEMS (12 horas -> 2 apertura, 8 desarrollo, 2 cierre)
    const distribution = res.distribution as { apertura: number; desarrollo: number; cierre: number };
    expect(distribution.apertura).toBe(2);
    expect(distribution.desarrollo).toBe(8);
    expect(distribution.cierre).toBe(2);

    expect(sessions[0].phase).toBe('Apertura');
    expect(sessions[1].phase).toBe('Apertura');
    expect(sessions[2].phase).toBe('Desarrollo');
    expect(sessions[10].phase).toBe('Cierre');
    expect(sessions[11].phase).toBe('Cierre');
  });

  it('8. Fase 1: buildSequence() rechaza parámetros inválidos (blockIndex < 0) con HTTP 400 vía SecuenciaGenerateInputSchema', async () => {
    await expect(
      planeacionesOrchestrator.buildSequence({ blockIndex: -1 })
    ).rejects.toThrow(PlaneacionOrchestratorError);

    try {
      await planeacionesOrchestrator.buildSequence({ blockIndex: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(PlaneacionOrchestratorError);
      expect((err as PlaneacionOrchestratorError).status).toBe(400);
      expect((err as PlaneacionOrchestratorError).message).toContain('blockIndex debe ser un número entero mayor o igual a 0');
    }
  });

  it('9. Fase 1: buildSequence() valida actualización estructurada con SecuenciaUpdateInputSchema', async () => {
    const customSession = {
      sessionNum: 1,
      phase: 'Apertura' as const,
      title: 'Sesión 1: Problematización Comunitaria',
      teachingActivity: 'Presentación del problema y detonación reflexiva',
      learningActivity: 'Diagnóstico contextual y planteamiento del reto',
      evidence: 'Registro diagnóstico',
      evaluation: 'Lista de cotejo',
    };

    const res = await planeacionesOrchestrator.buildSequence({
      blockIndex: 1,
      sessions: [customSession],
      retoSituado: '¿Cómo diseñar un sistema de captación pluvial en la comunidad?',
    });

    expect(res.success).toBe(true);
    expect(res.blockIndex).toBe(1);
    expect(res.retoSituado).toContain('captación pluvial');
    expect((res.sessions as unknown[])).toHaveLength(1);
  });

  it('10. Fase 1: generate() estructura planeación integral con Tres Saberes y NEM', async () => {
    const res = await planeacionesOrchestrator.generate({
      asignatura: 'Pensamiento Matemático I',
      semestre: 1,
      docenteNombre: 'Prof. Mario Alberto',
      contextoComunitario: 'Comunidad de Tepeaca Puebla',
      horasSemanales: 4,
    });

    expect(res.success).toBe(true);
    expect(res.uacName).toBe('Pensamiento Matemático I');
    expect(res.semester).toBe(1);
    expect(res.weeklyHours).toBe(4);
    expect(res.teacherName).toBe('Prof. Mario Alberto');
    expect(res.status).toBe('DRAFT_ESTRUCTURADO');

    const tresSaberes = res.tresSaberes as { conceptual: string; procedimental: string; actitudinal: string };
    expect(tresSaberes.conceptual).toContain('Pensamiento Matemático I');
    expect(tresSaberes.procedimental).toContain('semestre 1');
    expect(tresSaberes.actitudinal).toContain('responsabilidad social');
  });

  it('11. Fase 1: generate() rechaza entradas incompletas o sin asignatura con HTTP 400', async () => {
    await expect(
      planeacionesOrchestrator.generate({ asignatura: '', semestre: 1 })
    ).rejects.toThrow(PlaneacionOrchestratorError);

    await expect(
      planeacionesOrchestrator.generate({ asignatura: 'Física I', semestre: 7 })
    ).rejects.toThrow(PlaneacionOrchestratorError);

    try {
      await planeacionesOrchestrator.generate({ asignatura: '', semestre: 1 });
    } catch (err) {
      expect(err).toBeInstanceOf(PlaneacionOrchestratorError);
      expect((err as PlaneacionOrchestratorError).status).toBe(400);
      expect((err as PlaneacionOrchestratorError).message).toContain('asignatura (UAC) es obligatoria');
    }
  });

  it('12. Fase 1 / F-46: buildSequence() rechaza actualización con sesiones inválidas (sessions: []) con HTTP 400 vía SecuenciaUpdateInputSchema', async () => {
    await expect(
      planeacionesOrchestrator.buildSequence({
        blockIndex: 0,
        sessions: [], // Array vacío rechazado por .min(1) de SecuenciaUpdateInputSchema
      })
    ).rejects.toThrow(PlaneacionOrchestratorError);

    try {
      await planeacionesOrchestrator.buildSequence({
        blockIndex: 0,
        sessions: [],
      });
    } catch (err) {
      expect(err).toBeInstanceOf(PlaneacionOrchestratorError);
      expect((err as PlaneacionOrchestratorError).status).toBe(400);
      expect((err as PlaneacionOrchestratorError).message).toContain('Estructura de sesiones inválida');
      expect((err as PlaneacionOrchestratorError).message).toContain('sessions debe contener al menos una sesión didáctica válida');
    }

    // Rechazo de sesión con campos requeridos faltantes
    await expect(
      planeacionesOrchestrator.buildSequence({
        blockIndex: 0,
        sessions: [{ sessionNum: 1 } as unknown as { sessionNum: number; phase: 'Apertura'; title: string; teachingActivity: string; learningActivity: string; evidence: string; evaluation: string }],
      })
    ).rejects.toThrow(PlaneacionOrchestratorError);
  });

  it('5. Valida salud y métricas de Planeaciones bajo el contrato IProgramSystem (Nivel 2)', async () => {
    expect(planeacionesOrchestrator).toBeInstanceOf(PlaneacionOrchestrator);
    expect(planeacionesOrchestrator.programId).toBe('planeaciones');

    // Estado con dependencias configuradas
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', 'test-key-mock');

    const health = await planeacionesOrchestrator.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.checks.databaseConfigured).toBe(true);
    expect(health.checks.aiServiceConfigured).toBe(true);
    expect(health.checks.featureFlagService).toBe(true);

    // Estado degradado cuando falta configuración crítica (BD o IA)
    vi.stubEnv('DATABASE_URL', '');
    const degradedHealth = await planeacionesOrchestrator.healthCheck();
    expect(degradedHealth.status).toBe('degraded');
    expect(degradedHealth.checks.databaseConfigured).toBe(false);

    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/sigpda_test');
    vi.stubEnv('GEMINI_API_KEY', '');
    const degradedAiHealth = await planeacionesOrchestrator.healthCheck();
    expect(degradedAiHealth.status).toBe('degraded');
    expect(degradedAiHealth.checks.aiServiceConfigured).toBe(false);

    vi.unstubAllEnvs();

    const metrics = await planeacionesOrchestrator.getMetrics('escuela-zona-004');
    expect(metrics.programId).toBe('planeaciones');
    expect(metrics.tenantId).toBe('escuela-zona-004');
  });

  it('6. Invariante Reto Situado / Modelo Finlandés: valida integridad estricta de planning-evaluator.ts', async () => {
    // Valida criptográficamente que planning-evaluator.ts no ha sufrido ninguna modificación en su código fuente
    const fs = await import('node:fs');
    const path = await import('node:path');
    const crypto = await import('node:crypto');

    const filePath = path.resolve(process.cwd(), 'src/lib/planning-evaluator.ts');
    const fileContent = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

    // Hash canónico del evaluador Reto Situado (Modelo Finlandés 4/4)
    expect(fileHash).toBe('d030d785788c2b41a13abb83fa0e24b46f1ebd4cc82cfaf6b1cb8c852cf5a653');

    const planningEvaluatorModule = await import('@/lib/planning-evaluator');
    expect(planningEvaluatorModule.validateRetoSituado).toBeDefined();
    expect(typeof planningEvaluatorModule.validateRetoSituado).toBe('function');
    expect(planningEvaluatorModule.autoRepairRetoSituado).toBeDefined();
    expect(planningEvaluatorModule.ensureRetoSituadoCalidad).toBeDefined();
  });
});
