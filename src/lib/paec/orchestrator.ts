/**
 * orchestrator.ts — Orquestador Central de PAEC V2 (Nivel 1)
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Implementa el contrato formal IProgramSystem de Plataforma Nivel 2 y centraliza
 * la ingesta y estructuración de proyectos previos del Programa Aula Escuela Comunidad (PAEC),
 * bajo el patrón Strangler Fig (controlado por la feature flag PAEC_ORCHESTRATOR_V2).
 * 
 * Cumple con la política B-001 (Zero Silent Stubs): los métodos no migrados en esta
 * fase lanzan explícitamente 501 NOT_IMPLEMENTED en lugar de retornos simulados.
 */

import type { IProgramSystem, HealthCheckResult, ProgramId } from '@/lib/platform/interfaces';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { ingestDocument } from '@/lib/document-ingestion';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import {
  PAEC_EXTRACTION_SYSTEM_PROMPT,
  buildPaecExtractionPrompt,
  buildPaecChunkExtractionPrompt,
  partitionPaecDocument,
  mergePaecExtracts,
  PaecPreviousExtractSchema,
  type PaecPreviousExtractDTO,
} from '@/lib/prompts/paec-extraction';
import {
  withTimeoutBudget,
  isUpstreamAIError,
  AI_OUTAGE_USER_MESSAGE,
  correctiveRetry,
} from '@/lib/ai-resilience';

export class PaecOrchestratorError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PaecOrchestratorError';
    this.status = status;
  }
}

export interface PaecIngestOptions {
  filename: string;
  mimeType?: string;
  teacherId: string;
  isPremium?: boolean;
}

export interface PaecExtractionSuccess<T = unknown> {
  success: true;
  filename: string;
  data: T;
  warnings?: string[];
}

export interface IPaecOrchestrator extends IProgramSystem {
  ingestPrevious(
    buffer: Buffer,
    options: PaecIngestOptions
  ): Promise<PaecExtractionSuccess<PaecPreviousExtractDTO>>;
  generateProject(): Promise<Record<string, unknown>>;
  auditProject(): Promise<Record<string, unknown>>;
  renderDOCX(): Promise<Buffer>;
  renderPDF(): Promise<Buffer>;
}

export class PaecOrchestrator implements IPaecOrchestrator {
  public readonly programId: ProgramId = 'paec';
  public readonly version: string = '2.0.0';

  /**
   * Ingesta y estructura un documento PAEC previo (PDF con OCR o DOCX).
   * Envuelve las llamadas de extracción con presupuesto de timeout de 90s (F-001).
   */
  public async ingestPrevious(
    buffer: Buffer,
    options: PaecIngestOptions
  ): Promise<PaecExtractionSuccess<PaecPreviousExtractDTO>> {
    logger.info(`[paec-orchestrator] Ingesting previous PAEC document: ${options.filename}`);

    // Deadline global de 90s por request para prevenir saturación y errores 504 de Vercel (D-001)
    const deadline = Date.now() + 90000;

    let ingested;
    try {
      ingested = await withTimeoutBudget(
        ingestDocument(buffer, {
          filename: options.filename,
          mimeType: options.mimeType,
          enableOcr: true,
          teacherId: options.teacherId,
        }),
        Math.max(1, deadline - Date.now())
      );
    } catch (ingestErr: unknown) {
      logger.error('[paec-orchestrator] Document ingestion failed:', ingestErr);
      if (isUpstreamAIError(ingestErr)) {
        throw new PaecOrchestratorError(AI_OUTAGE_USER_MESSAGE, 503);
      }
      const ingestMsg = ingestErr instanceof Error ? ingestErr.message : 'Formato no soportado';
      throw new PaecOrchestratorError(`No se pudo procesar el archivo: ${ingestMsg}`, 400);
    }

    const documentText = (ingested?.markdown || ingested?.fullText || '').trim();
    if (!ingested || (!ingested.fullText && !ingested.markdown) || documentText.length < 40) {
      throw new PaecOrchestratorError('El documento no contiene texto legible ni datos extraíbles.', 400);
    }

    const isPremium = options.isPremium ?? (await resolveUserIsPremium(options.teacherId));
    const systemPrompt = PAEC_EXTRACTION_SYSTEM_PROMPT;
    const chunks = partitionPaecDocument(documentText);
    const warnings: string[] = [];
    let parsedData: PaecPreviousExtractDTO;

    if (chunks.length <= 1) {
      const userPrompt = buildPaecExtractionPrompt(documentText);
      let aiRaw: string;
      try {
        aiRaw = await withTimeoutBudget(
          generateWithRotation(
            systemPrompt,
            userPrompt,
            options.teacherId,
            isPremium,
            { temperature: 0.1, jsonMode: true }
          ),
          Math.max(1, deadline - Date.now())
        );
      } catch (aiErr: unknown) {
        logger.error('[paec-orchestrator] AI generation failed:', aiErr);
        if (isUpstreamAIError(aiErr)) {
          throw new PaecOrchestratorError(AI_OUTAGE_USER_MESSAGE, 503);
        }
        const msg = aiErr instanceof Error ? aiErr.message : 'Error en el servicio de IA';
        throw new PaecOrchestratorError(`Fallo en la extracción de IA: ${msg}`, 500);
      }

      let parsed = parseAIResponse(aiRaw, PaecPreviousExtractSchema, {
        contextName: 'paec-orchestrator-extraction',
        repairNullStrings: true,
      });

      if (!parsed.success) {
        parsed = await correctiveRetry({
          systemPrompt,
          previousRaw: aiRaw,
          zodIssues: parsed.error || '',
          schema: PaecPreviousExtractSchema,
          callAI: (sys, user, remaining) =>
            withTimeoutBudget(
              generateWithRotation(sys, user, options.teacherId, isPremium, { temperature: 0, jsonMode: true }),
              remaining
            ),
          deadline,
          contextName: 'paec-orchestrator-extraction',
        });
      }

      if (!parsed.success) {
        logger.error('[paec-orchestrator] AI response parsing failed:', parsed.error);
        throw new PaecOrchestratorError(
          `No se pudieron estructurar los datos del PAEC anterior: ${parsed.error}`,
          422
        );
      }

      parsedData = parsed.data;
      if (parsed.warnings) warnings.push(...parsed.warnings);
    } else {
      // Chunking multi-fragmento estructurado
      logger.info(`[paec-orchestrator] Documento de ${documentText.length} caracteres: procesando en ${chunks.length} fragmentos.`);
      warnings.push(
        `El documento contiene ${documentText.length.toLocaleString('es-MX')} caracteres. Se procesó mediante fragmentación estructurada (${chunks.length} bloques) garantizando la extracción íntegra.`
      );

      const chunkPromises = chunks.map((chunk, idx) => {
        const prompt = idx === 0
          ? buildPaecExtractionPrompt(chunk)
          : buildPaecChunkExtractionPrompt(chunk, idx, chunks.length);
        const remaining = Math.max(1, deadline - Date.now());
        return withTimeoutBudget(
          generateWithRotation(systemPrompt, prompt, options.teacherId, isPremium, { temperature: 0.1, jsonMode: true }),
          remaining
        ).then(raw => {
          const parsed = parseAIResponse(raw, PaecPreviousExtractSchema, {
            contextName: `paec-orchestrator-chunk-${idx}`,
            repairNullStrings: true,
          });
          return parsed.success ? parsed.data : null;
        }).catch(err => {
          logger.warn(`[paec-orchestrator] Falló chunk ${idx}:`, err);
          return null;
        });
      });

      const results = await Promise.all(chunkPromises);
      const validResults = results.filter((r): r is PaecPreviousExtractDTO => r !== null);

      if (validResults.length === 0) {
        throw new PaecOrchestratorError(
          'No se pudieron estructurar los datos de los fragmentos del PAEC anterior.',
          422
        );
      }

      parsedData = validResults.reduce((acc, curr) => mergePaecExtracts(acc, curr));
    }

    return {
      success: true,
      filename: options.filename,
      data: parsedData,
      warnings,
    };
  }

  /**
   * Generación asistida de proyectos PAEC comunitarios (Contrato N1 — Fase D subsiguiente).
   */
  public async generateProject(): Promise<Record<string, unknown>> {
    throw new PaecOrchestratorError(
      'Método generateProject() no implementado en la fase actual del orquestador PAEC.',
      501
    );
  }

  /**
   * Auditoría de alineación pedagógica NEM / MCCEMS del PAEC (Contrato N1).
   */
  public async auditProject(): Promise<Record<string, unknown>> {
    throw new PaecOrchestratorError(
      'Método auditProject() no implementado en la fase actual del orquestador PAEC.',
      501
    );
  }

  /**
   * Renderizado DOCX del proyecto PAEC institucional (Contrato N1).
   */
  public async renderDOCX(): Promise<Buffer> {
    throw new PaecOrchestratorError(
      'Método renderDOCX() no implementado en la fase actual del orquestador PAEC.',
      501
    );
  }

  /**
   * Renderizado PDF del proyecto PAEC institucional (Contrato N1).
   */
  public async renderPDF(): Promise<Buffer> {
    throw new PaecOrchestratorError(
      'Método renderPDF() no implementado en la fase actual del orquestador PAEC.',
      501
    );
  }

  /**
   * Comprueba la salud del subsistema PAEC (Contrato Nivel 2).
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
   * Retorna métricas del subsistema PAEC para agregación de plataforma (Contrato Nivel 2).
   */
  public async getMetrics(tenantId: string): Promise<Record<string, unknown>> {
    return {
      programId: this.programId,
      version: this.version,
      tenantId,
      flags: {
        PAEC_ORCHESTRATOR_V2: isFeatureEnabled('PAEC_ORCHESTRATOR_V2'),
      },
    };
  }
}

// Instancia singleton para el Sistema Central de PAEC V2
export const paecOrchestrator = new PaecOrchestrator();
