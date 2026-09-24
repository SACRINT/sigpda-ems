/**
 * feature-flags.ts — Servicio de Feature Flags para SIGPDA-EMS (Nivel 2 Plataforma)
 * 
 * Permite controlar el despliegue progresivo (Strangler Fig pattern) de subsistemas
 * y orquestadores (PMC, Planeaciones, PAEC, etc.) mediante banderas en memoria
 * con fallback a variables de entorno (process.env).
 */

export type KnownFeatureFlag =
  | 'PMC_ORCHESTRATOR_V2'
  | 'PLANEACION_ORCHESTRATOR_V2'
  | 'PAEC_ORCHESTRATOR_V2'
  | 'CARTOGRAFIA_ORCHESTRATOR_V2'
  | 'HORARIOS_ORCHESTRATOR_V2';

export type FlagSource = 'override' | 'env' | 'default';

export interface FeatureFlagEvaluation {
  flag: string;
  enabled: boolean;
  source: FlagSource;
}

const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'on', 'enabled']);
const FALSY_VALUES = new Set(['false', '0', 'no', 'off', 'disabled']);

export class FeatureFlagService {
  private overrides: Map<string, boolean> = new Map();
  private defaults: Map<string, boolean> = new Map([
    ['PMC_ORCHESTRATOR_V2', false],
    ['PLANEACION_ORCHESTRATOR_V2', false],
    ['PAEC_ORCHESTRATOR_V2', false],
    ['CARTOGRAFIA_ORCHESTRATOR_V2', false],
    ['HORARIOS_ORCHESTRATOR_V2', false],
  ]);

  /**
   * Resuelve el valor booleano desde variables de entorno.
   * Busca: FLAG_NAME, FEATURE_FLAG_FLAG_NAME, FF_FLAG_NAME.
   */
  private resolveEnvValue(flag: string): boolean | undefined {
    if (typeof process === 'undefined' || !process.env) {
      return undefined;
    }

    const normalizedKey = flag.toUpperCase().replace(/[-.]/g, '_');
    const candidates = [
      flag,
      normalizedKey,
      `FEATURE_FLAG_${normalizedKey}`,
      `FF_${normalizedKey}`,
    ];

    for (const key of candidates) {
      const raw = process.env[key];
      if (raw !== undefined) {
        const val = raw.trim().toLowerCase();
        if (TRUTHY_VALUES.has(val)) return true;
        if (FALSY_VALUES.has(val)) return false;
      }
    }

    return undefined;
  }

  /**
   * Evalúa si una funcionalidad está activa.
   * Prioridad de resolución:
   * 1. In-memory override (runtime)
   * 2. Variable de entorno (process.env)
   * 3. Fallback explícito o default preconfigurado
   */
  public isEnabled(flag: string, defaultValue?: boolean): boolean {
    return this.evaluate(flag, defaultValue).enabled;
  }

  /**
   * Obtiene la evaluación detallada indicando el valor y la fuente de resolución.
   */
  public evaluate(flag: string, defaultValue?: boolean): FeatureFlagEvaluation {
    if (this.overrides.has(flag)) {
      return {
        flag,
        enabled: Boolean(this.overrides.get(flag)),
        source: 'override',
      };
    }

    const envVal = this.resolveEnvValue(flag);
    if (envVal !== undefined) {
      return {
        flag,
        enabled: envVal,
        source: 'env',
      };
    }

    const finalDefault = defaultValue !== undefined
      ? defaultValue
      : this.defaults.get(flag) ?? false;

    return {
      flag,
      enabled: finalDefault,
      source: 'default',
    };
  }

  /**
   * Establece un override en memoria para pruebas o cambios dinámicos.
   */
  public setOverride(flag: string, enabled: boolean): void {
    this.overrides.set(flag, enabled);
  }

  /**
   * Elimina el override en memoria de una bandera.
   */
  public clearOverride(flag: string): void {
    this.overrides.delete(flag);
  }

  /**
   * Limpia todos los overrides en memoria.
   */
  public clearAllOverrides(): void {
    this.overrides.clear();
  }

  /**
   * Registra o actualiza el valor por defecto de una bandera.
   */
  public setDefault(flag: string, defaultValue: boolean): void {
    this.defaults.set(flag, defaultValue);
  }

  /**
   * Retorna un mapa con el estado evaluado de todas las banderas conocidas y registradas.
   */
  public getAllFlags(): Record<string, boolean> {
    const allKeys = new Set([...this.defaults.keys(), ...this.overrides.keys()]);
    const result: Record<string, boolean> = {};

    for (const key of allKeys) {
      result[key] = this.isEnabled(key);
    }

    return result;
  }
}

// Instancia singleton para toda la plataforma
export const featureFlags = new FeatureFlagService();

// Funciones helper directas
export function isFeatureEnabled(flag: KnownFeatureFlag | string, defaultValue?: boolean): boolean {
  return featureFlags.isEnabled(flag, defaultValue);
}

export function setFeatureFlag(flag: KnownFeatureFlag | string, enabled: boolean): void {
  featureFlags.setOverride(flag, enabled);
}

export function resetFeatureFlags(): void {
  featureFlags.clearAllOverrides();
}
