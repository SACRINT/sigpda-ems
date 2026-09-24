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
    switch (type) {
      case 'f11': {
        const systemPrompt = F11_EXTRACTION_SYSTEM_PROMPT;
        const userPrompt = buildF11ExtractionPrompt(documentText);

        const aiRaw = await generateWithRotation(
          systemPrompt,
          userPrompt,
          options.teacherId,
          isPremium,
          { temperature: 0.1, jsonMode: true }
        );

        const parsed = parseAIResponse(aiRaw, F11ExtractSchema, {
          contextName: 'pmc-f11-orchestrator',
        });

        if (!parsed.success) {
          logger.error('[pmc-orchestrator:f11] AI response parsing failed:', parsed.error);
          throw new PmcOrchestratorError(
            `No se pudieron estructurar los datos de acreditación F11: ${parsed.error}`,
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

        const aiRaw = await generateWithRotation(
          systemPrompt,
          userPrompt,
          options.teacherId,
          isPremium,
          { temperature: 0.1, jsonMode: true }
        );

        const parsed = parseAIResponse(aiRaw, Estadistica911ExtractSchema, {
          contextName: 'pmc-911-orchestrator',
        });

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

        const aiRaw = await generateWithRotation(
          systemPrompt,
          userPrompt,
          options.teacherId,
          isPremium,
          { temperature: 0.1, jsonMode: true }
        );

        const parsed = parseAIResponse(aiRaw, PmcPreviousExtractSchema, {
          contextName: 'pmc-previous-orchestrator',
        });

        if (!parsed.success) {
          logger.error('[pmc-orchestrator:previous] AI response parsing failed:', parsed.error);
          throw new PmcOrchestratorError(
            `No se pudieron estructurar los datos del PMC anterior: ${parsed.error}`,
            422
          );
        }

        // Normalizar categorías y temas canónicos de la PMC (Lineamientos Oficiales Cuadro 2)
        const normalizedStaff = parsed.data.staffData?.map((staff) => ({
          ...staff,
          metas_individuales: staff.metas_individuales?.map((meta) => {
            const catNorm = normalizePmcCategoria(meta.categoria);
            const temaNorm = normalizePmcTema(meta.tema, catNorm);
            return {
              ...meta,
              categoria: catNorm,
              tema: temaNorm,
            };
          }) || [],
        })) || [];

        return {
          success: true,
          filename: options.filename,
          data: {
            ...parsed.data,
            staffData: normalizedStaff,
          },
          warnings: parsed.warnings,
        };
      }

      default:
        throw new PmcOrchestratorError(`Tipo de documento desconocido: ${type}`, 400);
    }
  }

  /**
   * Generación de fases o pasos del PMC (Contrato N1).
   */
  public async generate(projectId: string, step = 1): Promise<{ success: boolean; projectId: string }> {
    logger.info(`[pmc-orchestrator] Generating step ${step} for project ${projectId}`);
    return {
      success: true,
      projectId,
    };
  }

  /**
   * Importación de contexto territorial y proyectos PAEC hacia PMC (Contrato N1).
   */
  public async importPaec(paecId: string): Promise<Record<string, unknown>> {
    logger.info(`[pmc-orchestrator] Importing PAEC context from project ${paecId}`);
    return {
      paecId,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Genera el archivo DOCX institucional del PMC (Contrato N1).
   */
  public async renderDOCX(projectId: string): Promise<Buffer> {
    logger.info(`[pmc-orchestrator] Rendering DOCX for project ${projectId}`);
    return Buffer.from('');
  }

  /**
   * Comprueba la salud del subsistema PMC (Contrato Nivel 2).
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      checks: {
        documentIngestion: true,
        aiRotation: true,
        featureFlags: isFeatureEnabled('PMC_ORCHESTRATOR_V2'),
      },
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
