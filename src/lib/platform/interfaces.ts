/**
 * interfaces.ts — Contratos Formales Transversales de Plataforma (Nivel 2)
 *
 * Define las interfaces canónicas para la arquitectura de Dos Niveles de SIGPDA-EMS:
 * - IProgramSystem: Contrato universal que implementa cada uno de los 5 Sistemas Centrales
 *   (Nivel 1: Planeaciones, PAEC, PMC, Cartografía, Horarios).
 * - IProgramRepository: Contrato canónico para repositorios de persistencia DAL.
 */

export type ProgramId = 'planeaciones' | 'paec' | 'pmc' | 'cartografia' | 'horarios';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  latencyMs?: number;
  timestamp?: string;
  error?: string;
}

export interface IProgramSystem {
  readonly programId: ProgramId;
  readonly version: string;
  healthCheck(): Promise<HealthCheckResult>;
  getMetrics(tenantId: string): Promise<Record<string, unknown>>;
}

export interface IProgramRepository<Entity, Id, Filters = Record<string, unknown>> {
  findById(id: Id): Promise<Entity | null>;
  findAll(filters?: Filters): Promise<Entity[]>;
  create(entity: Entity): Promise<Entity>;
  update(id: Id, patch: Partial<Entity>): Promise<Entity>;
  delete(id: Id): Promise<void>;
}
