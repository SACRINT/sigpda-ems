/**
 * index.ts — Catálogo Maestro Unificado de Instrumental Técnico Curricular V7
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Agrupa las 9 Familias Tecnológicas oficiales y provee utilidades de búsqueda y filtro:
 * - electronica_mecatronica
 * - electricidad_energia
 * - agropecuaria
 * - biotecnologia
 * - salud
 * - gastronomia
 * - tics_ciberseguridad
 * - diseno_grafico
 * - ciencias_experimentales
 */

import type { CatalogItem, TechnologyFamilyId, EquipmentCategory } from './types';
import { ELECTRONICA_MECATRONICA_CATALOG } from './electronica-mecatronica';
import { ELECTRICIDAD_ENERGIA_CATALOG } from './electricidad-energia';
import { AGROPECUARIA_CATALOG } from './agropecuaria';
import { BIOTECNOLOGIA_CATALOG } from './biotecnologia';
import { SALUD_CATALOG } from './salud';
import { GASTRONOMIA_CATALOG } from './gastronomia';
import { TICS_CIBERSEGURIDAD_CATALOG } from './tics-ciberseguridad';
import { DISENO_GRAFICO_CATALOG } from './diseno-grafico';
import { CIENCIAS_EXPERIMENTALES_CATALOG } from './ciencias-experimentales';
import { MECANICA_SOLDADURA_CATALOG } from './mecanica-soldadura';

export * from './types';
export { ELECTRONICA_MECATRONICA_CATALOG } from './electronica-mecatronica';
export { ELECTRICIDAD_ENERGIA_CATALOG } from './electricidad-energia';
export { AGROPECUARIA_CATALOG } from './agropecuaria';
export { BIOTECNOLOGIA_CATALOG } from './biotecnologia';
export { SALUD_CATALOG } from './salud';
export { GASTRONOMIA_CATALOG } from './gastronomia';
export { TICS_CIBERSEGURIDAD_CATALOG } from './tics-ciberseguridad';
export { DISENO_GRAFICO_CATALOG } from './diseno-grafico';
export { CIENCIAS_EXPERIMENTALES_CATALOG } from './ciencias-experimentales';
export { MECANICA_SOLDADURA_CATALOG } from './mecanica-soldadura';

/**
 * Catálogo Maestro Desduplicado por `id`
 */
function buildMasterCatalog(): CatalogItem[] {
  const allItems: CatalogItem[] = [
    ...ELECTRONICA_MECATRONICA_CATALOG,
    ...ELECTRICIDAD_ENERGIA_CATALOG,
    ...AGROPECUARIA_CATALOG,
    ...BIOTECNOLOGIA_CATALOG,
    ...SALUD_CATALOG,
    ...GASTRONOMIA_CATALOG,
    ...TICS_CIBERSEGURIDAD_CATALOG,
    ...DISENO_GRAFICO_CATALOG,
    ...CIENCIAS_EXPERIMENTALES_CATALOG,
    ...MECANICA_SOLDADURA_CATALOG,
  ];

  const map = new Map<string, CatalogItem>();
  for (const item of allItems) {
    if (map.has(item.id)) {
      // Si ya existe, combinamos las familias y aliases
      const existing = map.get(item.id)!;
      const combinedFamilias = Array.from(new Set([...existing.familias, ...item.familias]));
      const combinedAliases = Array.from(new Set([...existing.aliases, ...item.aliases]));
      const combinedKeywords = Array.from(new Set([...existing.keywordsBilingual, ...item.keywordsBilingual]));
      map.set(item.id, {
        ...existing,
        familias: combinedFamilias,
        aliases: combinedAliases,
        keywordsBilingual: combinedKeywords,
      });
    } else {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

export const MASTER_EQUIPMENT_CATALOG: CatalogItem[] = buildMasterCatalog();

/**
 * Obtiene todos los instrumentos asociados a una familia tecnológica específica.
 */
export function getEquipmentByFamily(familyId: TechnologyFamilyId): CatalogItem[] {
  return MASTER_EQUIPMENT_CATALOG.filter((item) => item.familias.includes(familyId));
}

/**
 * Obtiene todos los instrumentos asociados a una categoría técnica.
 */
export function getEquipmentByCategory(category: EquipmentCategory): CatalogItem[] {
  return MASTER_EQUIPMENT_CATALOG.filter((item) => item.category === category);
}
