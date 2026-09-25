/**
 * orchestrator.ts — Orquestador Central del PMC CREAA (Nivel 1)
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Implementa el contrato IProgramSystem de Plataforma Nivel 2 y centraliza la
 * ingesta documental (F11, Estadística 911, PMC anterior), generación de diagnósticos
 * y exportación DOCX/PDF bajo el patrón Strangler Fig (controlado por la feature flag
 * PMC_ORCHESTRATOR_V2).
 */

import type { IProgramSystem, HealthCheckResult, ProgramId } from '@/lib/platform/interfaces';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { ingestDocument } from '@/lib/document-ingestion';
import { generateWithRotation, resolveUserIsPremium } from '@/lib/ai-provider';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { logger } from '@/lib/logger';
import {
  F11_EXTRACTION_SYSTEM_PROMPT,
  buildF11ExtractionPrompt,
  F11ExtractSchema,
} from '@/lib/prompts/f11-extraction';
import {
  ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT,
  buildEstadistica911ExtractionPrompt,
  Estadistica911ExtractSchema,
} from '@/lib/prompts/estadistica-911-extraction';
import {
  PMC_EXTRACTION_SYSTEM_PROMPT,
  buildPmcExtractionPrompt,
  PmcPreviousExtractSchema,
} from '@/lib/prompts/pmc-extraction';
import {
  normalizePmcCategoria,
  normalizePmcTema,
} from '@/lib/constants/pmc-categorias';
import { reconcilePmcStaff } from '@/lib/pmc/staff-reconciler';

export type PmcDocumentType = 'f11' | '911' | 'previous';

export interface PmcIngestOptions {
  filename: string;
  mimeType?: string;
  teacherId: string;
  requestedMomento?: string;
  isPremium?: boolean;
}

export interface PmcExtractionSuccess<T = unknown> {
  success: true;
  filename: string;
  data: T;
  warnings?: string[];
}

export class PmcOrchestratorError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PmcOrchestratorError';
    this.status = status;
  }
}

import {
  withTimeoutBudget,
  isUpstreamAIError,
  AI_OUTAGE_USER_MESSAGE,
  correctiveRetry,
} from '@/lib/ai-resilience';

export {
  withTimeoutBudget,
  isUpstreamAIError,
  AI_OUTAGE_USER_MESSAGE,
  correctiveRetry,
};

export interface IPmcOrchestrator extends IProgramSystem {
  ingestDocument(
    type: PmcDocumentType,
    buffer: Buffer,
    options: PmcIngestOptions
  ): Promise<PmcExtractionSuccess>;

  generate(projectId: string, step?: number): Promise<{ success: boolean; projectId: string }>;
  importPaec(paecId: string): Promise<Record<string, unknown>>;
  renderDOCX(projectId: string): Promise<Buffer>;
}

export class PmcOrchestrator implements IPmcOrchestrator {
  public readonly programId: ProgramId = 'pmc';
  public readonly version: string = '2.0.0';

  /**
   * Ingesta y extrae datos estructurados de documentos del PMC (F11, 911, PMC anterior).
   */
  public async ingestDocument(
    type: PmcDocumentType,
    buffer: Buffer,
    options: PmcIngestOptions
  ): Promise<PmcExtractionSuccess> {
    return withTimeoutBudget(
      this.executeIngestDocument(type, buffer, options),
      90000
    );
  }

  private async executeIngestDocument(
    type: PmcDocumentType,
    buffer: Buffer,
    options: PmcIngestOptions
  ): Promise<PmcExtractionSuccess> {
    const isPremium = options.isPremium !== undefined
      ? options.isPremium
      : await resolveUserIsPremium(options.teacherId);

    // 1. Ingesta y normalización del documento a texto plano / markdown
    let ingested;
    try {
      ingested = await ingestDocument(buffer, {
        filename: options.filename,
        mimeType: options.mimeType,
        enableOcr: true,
        teacherId: options.teacherId,
      });
    } catch (ingestErr: unknown) {
      logger.error(`[pmc-orchestrator:${type}] Document ingestion failed:`, ingestErr);
      if (isUpstreamAIError(ingestErr)) {
        throw new PmcOrchestratorError(AI_OUTAGE_USER_MESSAGE, 503);
      }
      const ingestMsg = ingestErr instanceof Error ? ingestErr.message : 'Formato no soportado';
      throw new PmcOrchestratorError(`No se pudo procesar el archivo: ${ingestMsg}`, 400);
    }

    if (!ingested || (!ingested.fullText && !ingested.markdown)) {
      throw new PmcOrchestratorError('El documento no contiene texto legible ni datos extraíbles.', 400);
    }

    const documentText = (ingested.markdown || ingested.fullText || '').trim();
    if (documentText.length < 40) {
      throw new PmcOrchestratorError('El documento no contiene texto legible ni datos extraíbles.', 400);
    }

    // 2. Extracción y estructuración asistida por IA según el tipo de documento
    const deadline = Date.now() + 90000;
    try {
      switch (type) {
      case 'f11': {
        const systemPrompt = F11_EXTRACTION_SYSTEM_PROMPT;
        const userPrompt = buildF11ExtractionPrompt(documentText);

        const aiRaw = await withTimeoutBudget(
          generateWithRotation(
            systemPrompt,
            userPrompt,
            options.teacherId,
            isPremium,
            { temperature: 0.1, jsonMode: true }
          ),
          Math.max(1, deadline - Date.now())
        );

        let parsed = parseAIResponse(aiRaw, F11ExtractSchema, {
          contextName: 'pmc-f11-orchestrator',
          repairNullStrings: true,
        });

        if (!parsed.success) {
          parsed = await correctiveRetry({
            systemPrompt,
            previousRaw: aiRaw,
            zodIssues: parsed.error || '',
            schema: F11ExtractSchema,
            callAI: (sys, user, remaining) =>
              withTimeoutBudget(
                generateWithRotation(sys, user, options.teacherId, isPremium, { temperature: 0, jsonMode: true }),
                remaining
              ),
            deadline,
            contextName: 'pmc-f11-orchestrator',
          });
        }

        if (!parsed.success) {
          logger.error('[pmc-orchestrator:f11] AI response parsing failed:', parsed.error);
          throw new PmcOrchestratorError(
            `No se pudieron estructurar los datos del F11: ${parsed.error}`,
            422
          );
        }

        return {
          success: true,
          filename: options.filename,
          data: parsed.data,
          warnings: parsed.warnings,
        };
      }

      case '911': {
        const systemPrompt = ESTADISTICA_911_EXTRACTION_SYSTEM_PROMPT;
        const userPrompt = buildEstadistica911ExtractionPrompt(documentText);

        const aiRaw = await withTimeoutBudget(
          generateWithRotation(
            systemPrompt,
            userPrompt,
            options.teacherId,
            isPremium,
            { temperature: 0.1, jsonMode: true }
          ),
          Math.max(1, deadline - Date.now())
        );

        let parsed = parseAIResponse(aiRaw, Estadistica911ExtractSchema, {
          contextName: 'pmc-911-orchestrator',
          repairNullStrings: true,
        });

        if (!parsed.success) {
          parsed = await correctiveRetry({
            systemPrompt,
            previousRaw: aiRaw,
            zodIssues: parsed.error || '',
            schema: Estadistica911ExtractSchema,
            callAI: (sys, user, remaining) =>
              withTimeoutBudget(
                generateWithRotation(sys, user, options.teacherId, isPremium, { temperature: 0, jsonMode: true }),
                remaining
              ),
            deadline,
            contextName: 'pmc-911-orchestrator',
          });
        }

        if (!parsed.success) {
          logger.error('[pmc-orchestrator:911] AI response parsing failed:', parsed.error);
          throw new PmcOrchestratorError(
            `No se pudieron estructurar los datos de Estadística 911: ${parsed.error}`,
            422
          );
        }

        const finalData = {
          ...parsed.data,
          ...(options.requestedMomento ? { momento: options.requestedMomento } : {}),
        };

        return {
          success: true,
          filename: options.filename,
          data: finalData,
          warnings: parsed.warnings,
        };
      }

      case 'previous': {
        const systemPrompt = PMC_EXTRACTION_SYSTEM_PROMPT;
        const userPrompt = buildPmcExtractionPrompt(documentText);

        const aiRaw = await withTimeoutBudget(
          generateWithRotation(
            systemPrompt,
            userPrompt,
            options.teacherId,
            isPremium,
            { temperature: 0.1, jsonMode: true }
          ),
          Math.max(1, deadline - Date.now())
        );

        let parsed = parseAIResponse(aiRaw, PmcPreviousExtractSchema, {
          contextName: 'pmc-previous-orchestrator',
          repairNullStrings: true,
        });

        if (!parsed.success) {
          parsed = await correctiveRetry({
            systemPrompt,
            previousRaw: aiRaw,
            zodIssues: parsed.error || '',
            schema: PmcPreviousExtractSchema,
            callAI: (sys, user, remaining) =>
              withTimeoutBudget(
                generateWithRotation(sys, user, options.teacherId, isPremium, { temperature: 0, jsonMode: true }),
                remaining
              ),
            deadline,
            contextName: 'pmc-previous-orchestrator',
          });
        }

        if (!parsed.success) {
          logger.error('[pmc-orchestrator:previous] AI response parsing failed:', parsed.error);
          throw new PmcOrchestratorError(
            `No se pudieron estructurar los datos del PMC anterior: ${parsed.error}`,
            422
          );
        }

        // Reconciliación arquitectónica de plantilla: consolida staffData, participantes y directorName
        const reconciled = reconcilePmcStaff({
          extractedStaff: parsed.data.staffData,
          participantes: parsed.data.participantes,
          directorName: parsed.data.directorName,
          targetTotalStaff: parsed.data.totalStaff,
          cicloEscolar: parsed.data.cicloEscolar,
        });

        const normalizedMetasPrevias = parsed.data.metas_institucionales_previas?.map((m) => {
          const catNorm = normalizePmcCategoria(m.categoria);
          const temaNorm = normalizePmcTema(m.tema, catNorm);
          return {
            ...m,
            categoria: catNorm,
            tema: temaNorm,
          };
        }) || [];

        const categoriasMap = new Map<string, Set<string>>();
        for (const cp of parsed.data.categorias_priorizadas || []) {
          if (cp && cp.categoria) {
            const catNorm = normalizePmcCategoria(cp.categoria);
            if (!categoriasMap.has(catNorm)) {
              categoriasMap.set(catNorm, new Set());
            }
            for (const t of cp.temas || []) {
              const tNorm = normalizePmcTema(t, catNorm);
              if (tNorm) categoriasMap.get(catNorm)!.add(tNorm);
            }
          }
        }
        for (const m of normalizedMetasPrevias) {
          if (m.categoria) {
            if (!categoriasMap.has(m.categoria)) {
              categoriasMap.set(m.categoria, new Set());
            }
            if (m.tema) {
              categoriasMap.get(m.categoria)!.add(m.tema);
            }
          }
        }

        const reconciledCategoriasPriorizadas = Array.from(categoriasMap.entries()).map(
          ([categoria, temasSet]) => ({
            categoria,
            temas: Array.from(temasSet),
          })
        );

        return {
          success: true,
          filename: options.filename,
          data: {
            ...parsed.data,
            totalStaff: reconciled.totalStaff,
            staffData: reconciled.staff,
            participantes: parsed.data.participantes || [],
            metas_institucionales_previas: normalizedMetasPrevias,
            categorias_priorizadas: reconciledCategoriasPriorizadas,
          },
          warnings: parsed.warnings,
        };
      }

      default:
        throw new PmcOrchestratorError(`Tipo de documento desconocido: ${type}`, 400);
      }
    } catch (err: unknown) {
      if (err instanceof PmcOrchestratorError) throw err;
      if (isUpstreamAIError(err)) {
        throw new PmcOrchestratorError(AI_OUTAGE_USER_MESSAGE, 503);
      }
      throw err;
    }
  }

  /**
   * Generación de fases o pasos del PMC (Contrato N1).
   */
  public async generate(): Promise<{ success: boolean; projectId: string }> {
    throw new PmcOrchestratorError('Método generate() no implementado en la fase actual del orquestador PMC.', 501);
  }

  /**
   * Importación de contexto territorial y proyectos PAEC hacia PMC (Contrato N1).
   */
  public async importPaec(): Promise<Record<string, unknown>> {
    throw new PmcOrchestratorError('Método importPaec() no implementado en la fase actual del orquestador PMC.', 501);
  }

  /**
   * Genera el archivo DOCX institucional del PMC (Contrato N1).
   */
  public async renderDOCX(): Promise<Buffer> {
    throw new PmcOrchestratorError('Método renderDOCX() no implementado en la fase actual del orquestador PMC.', 501);
  }

  /**
   * Comprueba la salud del subsistema PMC (Contrato Nivel 2).
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
   * Retorna métricas del subsistema PMC para agregación de plataforma (Contrato Nivel 2).
   */
  public async getMetrics(tenantId: string): Promise<Record<string, unknown>> {
    return {
      programId: this.programId,
      version: this.version,
      tenantId,
      flags: {
        PMC_ORCHESTRATOR_V2: isFeatureEnabled('PMC_ORCHESTRATOR_V2'),
      },
    };
  }
}

// Instancia singleton para el Sistema Central PMC
export const pmcOrchestrator = new PmcOrchestrator();
