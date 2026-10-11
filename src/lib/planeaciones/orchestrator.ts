/**
 * orchestrator.ts — Orquestador Central de Planeaciones V2 (Nivel 1)
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Implementa el contrato formal IProgramSystem de Plataforma Nivel 2 y orquesta
 * la evaluación cuantitativa/cualitativa de planeaciones didácticas bajo el modelo
 * del Anexo 12 USICAMM / Guía Laboral MCCEMS y el patrón Strangler Fig
 * (controlado por la feature flag PLANEACION_ORCHESTRATOR_V2).
 */

import type { IProgramSystem, HealthCheckResult, ProgramId } from '@/lib/platform/interfaces';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  evaluarPlaneacion,
  type InputEvaluacion,
  type ResultadoEvaluacion,
} from '@/lib/planeaciones-evaluator';
import {
  SecuenciaGenerateInputSchema,
  SecuenciaUpdateInputSchema,
  type SecuenciaGenerateInputDTO,
} from '@/lib/ai-schemas';
import { logger } from '@/lib/logger';
import { generatePlanningPDF } from '@/lib/planning-pdf-renderer';
import type { Planning } from '@/types/planning';
import { getPlanningById } from '@/lib/db';

export class PlaneacionOrchestratorError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PlaneacionOrchestratorError';
    this.status = status;
  }
}

export interface SecuenciaInput {
  blockIndex: number;
  totalHours?: number;
  planningId?: string;
  sessions?: unknown[];
  retoSituado?: unknown;
}

export interface PlaneacionGenInput {
  asignatura: string;
  semestre: number;
  docenteNombre?: string;
  textoPlanificacion?: string;
  component?: string;
  plantel?: string;
  bloques?: number;
  horasSemanales?: number;
  contextoComunitario?: string;
  planningId?: string;
  teacherId?: string;
  isPremium?: boolean;
}

export interface RenderPdfOptions {
  planning?: Planning;
  logos?: { gobierno?: string; sep?: string; supervision?: string };
}

export interface IPlaneacionOrchestrator extends IProgramSystem {
  evaluate(input: InputEvaluacion): Promise<ResultadoEvaluacion>;
  generate(input: PlaneacionGenInput): Promise<Record<string, unknown>>;
  buildSequence(input: SecuenciaInput): Promise<Record<string, unknown>>;
  renderPDF(idOrPlanning?: string | Planning, options?: RenderPdfOptions): Promise<Buffer>;
}

export class PlaneacionOrchestrator implements IPlaneacionOrchestrator {
  public readonly programId: ProgramId = 'planeaciones';
  public readonly version: string = '2.0.0';

  /**
   * Evalúa una planeación didáctica ejecutando la rúbrica oficial (Anexo 12 / Guía Laboral).
   */
  public async evaluate(input: InputEvaluacion): Promise<ResultadoEvaluacion> {
    if (!input.textoPlanificacion || input.textoPlanificacion.trim().length < 50) {
      throw new PlaneacionOrchestratorError(
        'El contenido de la planeación es demasiado corto o inválido para evaluar.',
        400
      );
    }

    logger.info(`[planeaciones-orchestrator] Evaluating planning for UAC: ${input.asignatura}, semester: ${input.semestre}`);

    const resultado = await evaluarPlaneacion(input);
    return resultado;
  }

  /**
   * Generación integral de planeación didáctica basada en Tres Saberes y NEM (Fase 1).
   */
  public async generate(input: PlaneacionGenInput): Promise<Record<string, unknown>> {
    if (!input || typeof input !== 'object') {
      throw new PlaneacionOrchestratorError(
        'El parámetro input es requerido y debe ser un objeto válido para generar la planeación.',
        400
      );
    }

    if (!input.asignatura || typeof input.asignatura !== 'string' || input.asignatura.trim().length === 0) {
      throw new PlaneacionOrchestratorError(
        'La asignatura (UAC) es obligatoria para generar la planeación didáctica.',
        400
      );
    }

    if (typeof input.semestre !== 'number' || input.semestre < 1 || input.semestre > 6) {
      throw new PlaneacionOrchestratorError(
        'El semestre es obligatorio y debe ser un número entero entre 1 y 6.',
        400
      );
    }

    logger.info(`[planeaciones-orchestrator] Generating planning for UAC: ${input.asignatura}, semester: ${input.semestre}`);

    const component = input.component || (input.semestre >= 5 ? 'fundamental_5_6' : 'fundamental_1_4');
    const totalBlocks = input.bloques || 3;
    const weeklyHours = input.horasSemanales || (component === 'laboral' ? 18 : 4);

    return {
      success: true,
      uacName: input.asignatura.trim(),
      semester: input.semestre,
      component,
      weeklyHours,
      totalBlocks,
      teacherName: input.docenteNombre || 'Docente Titular',
      communityContext: input.contextoComunitario || 'Contexto de Vinculación Regional Puebla NEM',
      tresSaberes: {
        conceptual: `Saberes conceptuales fundamentales para ${input.asignatura.trim()}`,
        procedimental: `Aplicación metodológica y desarrollo de habilidades prácticas en semestre ${input.semestre}`,
        actitudinal: 'Colaboración, pensamiento crítico, responsabilidad social y ética comunitaria',
      },
      status: 'DRAFT_ESTRUCTURADO',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Construcción de secuencias didácticas por momentos pedagógicos (Fase 1).
   * Valida parámetros con SecuenciaGenerateInputSchema y SecuenciaUpdateInputSchema.
   */
  public async buildSequence(input: SecuenciaInput): Promise<Record<string, unknown>> {
    if (!input || typeof input !== 'object') {
      throw new PlaneacionOrchestratorError(
        'El parámetro input es requerido y debe ser un objeto válido para construir la secuencia.',
        400
      );
    }

    const parseResult = SecuenciaGenerateInputSchema.safeParse(input);
    if (!parseResult.success) {
      throw new PlaneacionOrchestratorError(
        `Parámetros inválidos para construcción de secuencia: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
        400
      );
    }

    // Si se proveen sesiones explícitas, validar esquema de actualización estructurada
    if (input.sessions && Array.isArray(input.sessions)) {
      const updateResult = SecuenciaUpdateInputSchema.safeParse(input);
      if (!updateResult.success) {
        throw new PlaneacionOrchestratorError(
          `Estructura de sesiones inválida: ${updateResult.error.issues.map((i) => i.message).join(', ')}`,
          400
        );
      }
      return {
        success: true,
        blockIndex: updateResult.data.blockIndex,
        sessions: updateResult.data.sessions,
        retoSituado: updateResult.data.retoSituado,
        totalHours: input.totalHours ?? updateResult.data.sessions.length,
      };
    }

    const { blockIndex, totalHours: customHours }: SecuenciaGenerateInputDTO = parseResult.data;
    const hours = customHours && customHours > 0 ? customHours : 12;
    const sessionsCount = hours;

    // Distribución pedagógica oficial MCCEMS por fases (Apertura, Desarrollo, Cierre)
    let aperturaCount = 1;
    let cierreCount = 1;
    if (sessionsCount >= 16) {
      aperturaCount = 3;
      cierreCount = 3;
    } else if (sessionsCount >= 10) {
      aperturaCount = 2;
      cierreCount = 2;
    }
    const desarrolloCount = Math.max(1, sessionsCount - aperturaCount - cierreCount);

    const sessions = [];
    let sessionNumber = 1;

    // Fase 1: Apertura (Diagnóstico, detonador situado, motivación y saberes previos)
    for (let i = 0; i < aperturaCount; i++) {
      sessions.push({
        sessionNum: sessionNumber,
        phase: 'Apertura' as const,
        title: `Sesión ${sessionNumber}: Exploración y Vinculación Situada`,
        teachingActivity: 'Presentación del detonador situado y dinamización de saberes previos.',
        learningActivity: 'Análisis de la problemática comunitaria y planteamiento de hipótesis.',
        evidence: 'Cuestionario de diagnóstico / mapa conceptual inicial',
        evaluation: 'Lista de cotejo formativa',
      });
      sessionNumber++;
    }

    // Fase 2: Desarrollo (Construcción activa, modelado docente, práctica guiada y autónoma)
    for (let i = 0; i < desarrolloCount; i++) {
      sessions.push({
        sessionNum: sessionNumber,
        phase: 'Desarrollo' as const,
        title: `Sesión ${sessionNumber}: Desarrollo y Aplicación Práctica`,
        teachingActivity: 'Modelado procedimental, asesoría metodológica y acompañamiento guiado.',
        learningActivity: 'Resolución de retos situados y construcción de artefactos didácticos en equipo.',
        evidence: 'Bitácora de taller / reporte procedimental',
        evaluation: 'Rúbrica formativa procesual',
      });
      sessionNumber++;
    }

    // Fase 3: Cierre (Síntesis, evaluación formativa, metacognición y producto integrador)
    for (let i = 0; i < cierreCount; i++) {
      sessions.push({
        sessionNum: sessionNumber,
        phase: 'Cierre' as const,
        title: `Sesión ${sessionNumber}: Consolidación y Evaluación Formativa`,
        teachingActivity: 'Coordinación de plenaria de socialización y retroalimentación formativa.',
        learningActivity: 'Socialización comunitaria, coevaluación y síntesis metacognitiva.',
        evidence: 'Producto integrador / síntesis metacognitiva',
        evaluation: 'Rúbrica analítica sumativa',
      });
      sessionNumber++;
    }

    logger.info(`[planeaciones-orchestrator] Sequence built successfully for block ${blockIndex} with ${sessions.length} sessions`);

    return {
      success: true,
      blockIndex,
      totalHours: hours,
      sessions,
      distribution: {
        apertura: aperturaCount,
        desarrollo: desarrolloCount,
        cierre: cierreCount,
      },
    };
  }

  /**
   * Renderizado a PDF de la planeación didáctica oficial (Contrato N1 — Fase 2).
   * Delega en planning-pdf-renderer.ts para tipografía Lato/Montserrat y diseño oficial Carta.
   */
  public async renderPDF(
    idOrPlanning?: string | Planning,
    options?: RenderPdfOptions
  ): Promise<Buffer> {
    if (!idOrPlanning && !options?.planning) {
      throw new PlaneacionOrchestratorError(
        'Se requiere un ID o una instancia de Planeación para renderizar el PDF.',
        400
      );
    }

    let planning: Planning | null = null;

    if (typeof idOrPlanning === 'object' && idOrPlanning !== null) {
      planning = idOrPlanning as Planning;
    } else if (options?.planning) {
      planning = options.planning;
    } else if (typeof idOrPlanning === 'string') {
      try {
        const rawPlanning = await getPlanningById(idOrPlanning);
        if (!rawPlanning) {
          throw new PlaneacionOrchestratorError(
            `Planeación con ID ${idOrPlanning} no encontrada en la base de datos.`,
            404
          );
        }
        planning = {
          id: rawPlanning.id,
          teacherId: rawPlanning.teacher_id,
          uacName: rawPlanning.uac_name,
          semester: rawPlanning.semester,
          component: rawPlanning.component,
          curriculumName: rawPlanning.curriculum_name || '',
          paecContext: rawPlanning.paec_context || '',
          extractedData: rawPlanning.extracted_data,
          contentJson: rawPlanning.content_json,
          status: rawPlanning.status,
          createdAt: rawPlanning.created_at,
          updatedAt: rawPlanning.updated_at,
          sequenceJson: rawPlanning.sequence_json,
          evaluationJson: rawPlanning.evaluation_json,
        };
      } catch (err) {
        if (err instanceof PlaneacionOrchestratorError) {
          throw err;
        }
        logger.error('[planeaciones-orchestrator] Error al consultar planeación de BD:', { error: err });
        throw new PlaneacionOrchestratorError(
          `Error al consultar la planeación ${idOrPlanning}: ${(err as Error).message}`,
          500
        );
      }
    }

    if (!planning) {
      throw new PlaneacionOrchestratorError(
        'Estructura de planeación no disponible para renderizado.',
        400
      );
    }

    try {
      const doc = await generatePlanningPDF(planning, options?.logos);
      const arrayBuffer = doc.output('arraybuffer');
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (err instanceof PlaneacionOrchestratorError) {
        throw err;
      }
      logger.error('[planeaciones-orchestrator] Error en renderizado editorial de PDF:', { error: err });
      throw new PlaneacionOrchestratorError(
        `Fallo en el motor editorial al generar PDF: ${(err as Error).message}`,
        500
      );
    }
  }

  /**
   * Comprueba la salud del subsistema Planeaciones (Contrato Nivel 2).
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    const checks: Record<string, boolean> = {
      databaseConfigured: Boolean(process.env.DATABASE_URL),
      // Credencial de IA base disponible (en producción el pool dinámico reside en api_keys)
      aiServiceConfigured: Boolean(process.env.GEMINI_API_KEY),
      featureFlagService: typeof isFeatureEnabled === 'function',
    };

    const isAllPassing = Object.values(checks).every(Boolean);

    return {
      status: isAllPassing ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retorna métricas del subsistema Planeaciones para agregación de plataforma (Contrato Nivel 2).
   */
  public async getMetrics(tenantId: string): Promise<Record<string, unknown>> {
    return {
      programId: this.programId,
      version: this.version,
      tenantId,
      flags: {
        PLANEACION_ORCHESTRATOR_V2: isFeatureEnabled('PLANEACION_ORCHESTRATOR_V2'),
      },
    };
  }
}

// Instancia singleton para el Sistema Central de Planeaciones V2
export const planeacionesOrchestrator = new PlaneacionOrchestrator();
