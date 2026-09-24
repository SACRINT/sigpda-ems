/**
 * context-provider.ts — Proveedor Central de Contexto Territorial y Cartografía V2 (Nivel 1)
 * SIGPDA-EMS · MCCEMS Ciclo Escolar 2026-2027
 * 
 * Implementa el contrato formal IProgramSystem de Plataforma Nivel 2 y centraliza
 * la ingesta de la Matriz de Zona Escolar (911 / F11) y la estructuración del contexto territorial
 * bajo el patrón Strangler Fig (controlado por la feature flag CARTOGRAFIA_ORCHESTRATOR_V2).
 * 
 * Preserva el flujo metodológico continuo:
 * Cartografía de Zona → PMC → PAEC → Planeación Docente + Bitácora 50-20-30.
 * 
 * Cumple con la política B-001 (Zero Silent Stubs): los métodos no migrados en esta
 * fase lanzan explícitamente 501 NOT_IMPLEMENTED en lugar de retornos simulados.
 */

import type { IProgramSystem, HealthCheckResult, ProgramId } from '@/lib/platform/interfaces';
import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import { parseCartografiaMatriz } from '@/lib/cartografia-parser';
import type {
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
} from '@/types/cartografia';
import { logger } from '@/lib/logger';

export class CartografiaContextProviderError extends Error {
  public status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CartografiaContextProviderError';
    this.status = status;
  }
}

export interface CartografiaIngestOptions {
  filename: string;
  zonaNumero?: string;
  cicloEscolar?: string;
  linkDbPaec?: boolean;
}

export interface CartografiaExtractionSuccess {
  success: true;
  filename: string;
  momento1: CartografiaMomento1Conocer;
  momento2: CartografiaMomento2Organizar;
}

export interface ICartografiaContextProvider extends IProgramSystem {
  ingestZoneMatrix(
    buffer: Buffer,
    options: CartografiaIngestOptions
  ): Promise<CartografiaExtractionSuccess>;
  generateMomento(): Promise<Record<string, unknown>>;
  generatePedagogicalMemory(): Promise<Record<string, unknown>>;
  renderPDF(): Promise<Buffer>;
  exportContextForPmc(): Promise<Record<string, unknown>>;
}

export class CartografiaContextProvider implements ICartografiaContextProvider {
  public readonly programId: ProgramId = 'cartografia';
  public readonly version: string = '2.0.0';

  /**
   * Ingesta y procesa la matriz estadística de Zona Escolar (Excel/CSV 911/F11).
   * Genera los Momentos 1 (Conocer) y 2 (Organizar) con vinculación a proyectos PAEC territoriales.
   */
  public async ingestZoneMatrix(
    buffer: Buffer,
    options: CartografiaIngestOptions
  ): Promise<CartografiaExtractionSuccess> {
    logger.info(`[cartografia-context-provider] Ingesting zone matrix: ${options.filename}`);

    try {
      const result = await parseCartografiaMatriz(buffer, {
        zonaNumero: options.zonaNumero || '004',
        cicloEscolar: options.cicloEscolar || '2026-2027',
        linkDbPaec: options.linkDbPaec ?? true,
      });

      if (!result.success) {
        throw new CartografiaContextProviderError(
          result.error || 'No se pudieron extraer datos válidos del formato 911/F11.',
          422
        );
      }

      return {
        success: true,
        filename: options.filename,
        momento1: result.momento1,
        momento2: result.momento2,
      };
    } catch (err: unknown) {
      if (err instanceof CartografiaContextProviderError) {
        throw err;
      }
      logger.error('[cartografia-context-provider] Error processing zone matrix:', err);
      const msg = err instanceof Error ? err.message : 'Error interno al procesar el archivo Excel';
      throw new CartografiaContextProviderError(msg, 500);
    }
  }

  /**
   * Generación asistida de Momentos 3 a 5 de Cartografía (Contrato N1 — Fase subsiguiente).
   */
  public async generateMomento(): Promise<Record<string, unknown>> {
    throw new CartografiaContextProviderError(
      'Método generateMomento() no implementado en la fase actual de CartografiaContextProvider.',
      501
    );
  }

  /**
   * Generación de la Memoria Pedagógica Territorial (Contrato N1).
   */
  public async generatePedagogicalMemory(): Promise<Record<string, unknown>> {
    throw new CartografiaContextProviderError(
      'Método generatePedagogicalMemory() no implementado en la fase actual de CartografiaContextProvider.',
      501
    );
  }

  /**
   * Renderizado PDF oficial de la Cartografía de Zona (Contrato N1).
   */
  public async renderPDF(): Promise<Buffer> {
    throw new CartografiaContextProviderError(
      'Método renderPDF() no implementado en la fase actual de CartografiaContextProvider.',
      501
    );
  }

  /**
   * Exportación de contexto territorial para inyección en el Programa de Mejora Continua (PMC).
   */
  public async exportContextForPmc(): Promise<Record<string, unknown>> {
    throw new CartografiaContextProviderError(
      'Método exportContextForPmc() no implementado en la fase actual de CartografiaContextProvider.',
      501
    );
  }

  /**
   * Comprueba la salud del subsistema Cartografía (Contrato Nivel 2 Plataforma).
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    const checks: Record<string, boolean> = {
      databaseConfigured: Boolean(process.env.DATABASE_URL),
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
   * Retorna métricas del subsistema Cartografía para agregación de plataforma (Contrato Nivel 2).
   */
  public async getMetrics(tenantId: string): Promise<Record<string, unknown>> {
    return {
      programId: this.programId,
      version: this.version,
      tenantId,
      flags: {
        CARTOGRAFIA_ORCHESTRATOR_V2: isFeatureEnabled('CARTOGRAFIA_ORCHESTRATOR_V2'),
      },
    };
  }
}

// Instancia singleton para el Sistema Central de Cartografía V2
export const cartografiaContextProvider = new CartografiaContextProvider();
