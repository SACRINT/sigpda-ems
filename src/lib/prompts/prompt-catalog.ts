/**
 * prompt-catalog.ts — Loader experimental del catálogo de prompts de planeación (F6).
 *
 * ESTADO: DESACTIVADO INTENCIONALMENTE EN PRODUCCIÓN (`PROMPT_CATALOG_ENABLED = false`).
 * No debe conectarse en los generadores ni prompts activos: el pipeline actual
 * (`system-prompt.ts`, `build-prompt.ts`, Wiki SEP y validadores Anexo 12 / DBEPA)
 * es la única fuente operativa; inyectar estos fragmentos duplicaría o diluiría
 * instrucciones críticas.
 *
 * El catálogo vive como fragmentos markdown versionados en Git
 * (`src/prompts/catalog/planeacion/`) y se compila a un módulo TypeScript con
 * `scripts/build-prompt-catalog.ts`. Este loader solo lo expone con tipado.
 */

import { isFeatureEnabled } from '@/lib/platform/feature-flags';
import {
  PROMPT_CATALOG,
  type PlanningPromptType,
  type PromptCatalogEntry,
} from './generated/prompt-catalog.generated';

export type { PlanningPromptType, PromptCatalogEntry };

const EXTENDED_COMPONENTS = new Set([
  'ffe',
  'ffe_optativa',
  'ffe_obligatoria',
  'ffeo',
  'ext_optativo',
  'ext_obligatorio',
  'optativa',
]);

export function isPromptCatalogEnabled(): boolean {
  return isFeatureEnabled('PROMPT_CATALOG_ENABLED');
}

export function getPromptCatalogEntry(tipo: PlanningPromptType): PromptCatalogEntry {
  return PROMPT_CATALOG[tipo];
}

export function listPromptCatalogEntries(): PromptCatalogEntry[] {
  return Object.values(PROMPT_CATALOG);
}

/**
 * Traduce el componente curricular de la planeación al tipo de fragmento del
 * catálogo. `laboral` cubre Formación Laboral y Carrera Técnica; los componentes
 * extendidos (FFE/optativas) usan el fragmento `extendido`.
 */
export function resolvePlanningPromptType(component: string): PlanningPromptType {
  const normalized = (component || '').trim().toLowerCase();
  if (normalized === 'laboral') return 'laboral';
  if (EXTENDED_COMPONENTS.has(normalized) || normalized.startsWith('ffe') || normalized.startsWith('ext')) {
    return 'extendido';
  }
  return 'fundamental';
}
