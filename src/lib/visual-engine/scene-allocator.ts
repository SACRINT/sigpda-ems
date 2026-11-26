/**
 * scene-allocator.ts — Asignador Determinista de Escenas Contextuales (3-en-1: Libros + 08 + 09)
 * SIGPDA-EMS · Fase 2 Motor Editorial Unificado
 *
 * Implementa la matriz exacta de roles y deduplicación del Catálogo Maestro:
 * - Portadas de Bloque: B1 → `portada`, B2 → `concepto`, B3 → `comunidad` (0 portadas repetidas en semestre).
 * - 4 Misiones por bloque: M1 → `concepto` (`top_band`), M2 → `practica` (`horizontal_editorial`),
 *   M3 → `portada` (`detail_right`), M4 → `comunidad` (`full`) (0 repeticiones entre misiones del bloque).
 * - Entregable `08`: `slides_hero` → `portada`, `slides_concept` → `concepto`.
 * - Entregable `09`: `infographic_activity` → `practica` (vertical 4:5 dedicado).
 * - Prioridad de resolución: `overrides/` → dominio primario → fallback `indagacion_interdisciplinaria_general`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getDisciplinaryAdapter,
  type DisciplinaryDomainId,
} from '@/lib/prompts/disciplinary-adapters';
import {
  EDITORIAL_SCENES_CATALOG,
  EDITORIAL_SCENES_OVERRIDES_PATH,
  type EditorialSceneArchetype,
  type EditorialSceneCrop,
  type EditorialSceneEntry,
  type EditorialSceneRole,
} from './editorial-scenes-catalog';

export interface AllocatedEditorialScene {
  id: string;
  domainId: DisciplinaryDomainId;
  resolvedDomainId: DisciplinaryDomainId;
  archetype: EditorialSceneArchetype;
  role: EditorialSceneRole;
  crop: EditorialSceneCrop;
  relativePath: string;
  alt: string;
  aspectRatio: '16:9' | '4:5';
  source: 'override' | 'domain' | 'fallback_general';
  existsOnDisk: boolean;
}

export interface SceneAllocationRequest {
  uacName?: string | null;
  component?: string | null;
  domainId?: DisciplinaryDomainId;
  /** Número de bloque 1-based (1, 2, 3...). */
  blockNumber?: number;
  role: EditorialSceneRole;
  /** Slug opcional para buscar override específico en `public/images/escenas/overrides/`. */
  overrideSlug?: string | null;
  /** Directorio raíz `public/` (inyectable en pruebas). */
  publicDir?: string;
  /** Rastreador de deduplicación por rol dentro del bloque/semestre. */
  tracker?: BlockSceneTracker;
}

export interface BlockSceneTracker {
  usedByRole: Map<EditorialSceneRole, Set<string>>;
}

export function createBlockSceneTracker(): BlockSceneTracker {
  return {
    usedByRole: new Map<EditorialSceneRole, Set<string>>(),
  };
}

const BLOCK_COVER_ROTATION: readonly EditorialSceneArchetype[] = [
  'portada',
  'concepto',
  'comunidad',
];

const ARCHETYPE_FALLBACK_ORDER: readonly EditorialSceneArchetype[] = [
  'portada',
  'concepto',
  'comunidad',
  'practica',
];

function slugifyUacForOverride(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Mapea rol + bloque al arquetipo y crop canónicos según la matriz oficial.
 */
export function resolveCanonicalRoleSlot(
  role: EditorialSceneRole,
  blockNumber = 1,
): { archetype: EditorialSceneArchetype; crop: EditorialSceneCrop } {
  const safeBlock = Math.max(1, Math.floor(blockNumber || 1));
  switch (role) {
    case 'block_cover': {
      const archetype = BLOCK_COVER_ROTATION[(safeBlock - 1) % BLOCK_COVER_ROTATION.length];
      return { archetype, crop: 'full' };
    }
    case 'mission_1':
      return { archetype: 'concepto', crop: 'top_band' };
    case 'mission_2':
      return { archetype: 'practica', crop: 'horizontal_editorial' };
    case 'mission_3':
      return { archetype: 'portada', crop: 'detail_right' };
    case 'mission_4':
      return { archetype: 'comunidad', crop: 'full' };
    case 'slides_hero':
      return { archetype: 'portada', crop: 'full' };
    case 'slides_concept':
      return { archetype: 'concepto', crop: 'full' };
    case 'infographic_activity':
      return { archetype: 'practica', crop: 'full' };
  }
}

export function missionIndexToSceneRole(missionIndex: number): EditorialSceneRole {
  const normalized = ((Math.floor(missionIndex) % 4) + 4) % 4;
  switch (normalized) {
    case 0:
      return 'mission_1';
    case 1:
      return 'mission_2';
    case 2:
      return 'mission_3';
    default:
      return 'mission_4';
  }
}

function getDefaultPublicDir(): string {
  return path.join(process.cwd(), 'public');
}

function fileExistsUnderPublic(publicDir: string, relativePath: string): boolean {
  if (typeof window !== 'undefined') return false;
  try {
    const cleaned = relativePath.replace(/^\/+/, '');
    return fs.existsSync(path.join(publicDir, cleaned));
  } catch {
    return false;
  }
}

function findOverrideSceneOnDisk(
  publicDir: string,
  overrideKeys: string[],
  archetype: EditorialSceneArchetype,
): { id: string; relativePath: string } | null {
  for (const key of overrideKeys) {
    if (!key) continue;
    const candidates = [
      `${key}-${archetype}.webp`,
      `${key}-${archetype}.png`,
      `${key}.webp`,
    ];
    for (const filename of candidates) {
      const rel = `${EDITORIAL_SCENES_OVERRIDES_PATH}/${filename}`;
      if (fileExistsUnderPublic(publicDir, rel)) {
        return {
          id: `override:${filename.replace(/\.(webp|png)$/i, '')}`,
          relativePath: rel,
        };
      }
    }
  }
  return null;
}

function pickNonRepeatingArchetype(
  domainId: DisciplinaryDomainId,
  preferred: EditorialSceneArchetype,
  role: EditorialSceneRole,
  tracker?: BlockSceneTracker,
): EditorialSceneArchetype {
  if (!tracker) return preferred;
  const used = tracker.usedByRole.get(role);
  if (!used || used.size === 0) return preferred;

  const preferredId = EDITORIAL_SCENES_CATALOG[domainId][preferred].id;
  if (!used.has(preferredId)) return preferred;

  for (const altArch of ARCHETYPE_FALLBACK_ORDER) {
    const candidateId = EDITORIAL_SCENES_CATALOG[domainId][altArch].id;
    if (!used.has(candidateId)) return altArch;
  }
  return preferred;
}

function recordRoleAllocation(tracker: BlockSceneTracker | undefined, role: EditorialSceneRole, id: string): void {
  if (!tracker) return;
  let set = tracker.usedByRole.get(role);
  if (!set) {
    set = new Set<string>();
    tracker.usedByRole.set(role, set);
  }
  set.add(id);
}

/**
 * Asigna la escena editorial canónica (con detección de `overrides/` y fallback a
 * `indagacion_interdisciplinaria_general` cuando el activo de dominio aún no existe en disco).
 */
export function allocateEditorialScene(request: SceneAllocationRequest): AllocatedEditorialScene {
  const publicDir = request.publicDir ?? getDefaultPublicDir();
  const domainId: DisciplinaryDomainId =
    request.domainId ??
    getDisciplinaryAdapter(request.uacName || '', request.component || undefined).id;

  const slot = resolveCanonicalRoleSlot(request.role, request.blockNumber ?? 1);
  const archetype = pickNonRepeatingArchetype(domainId, slot.archetype, request.role, request.tracker);
  const domainEntry: EditorialSceneEntry = EDITORIAL_SCENES_CATALOG[domainId][archetype];

  // 1. Prioridad máxima: `public/images/escenas/overrides/`
  const overrideKeys = [
    request.overrideSlug ? slugifyUacForOverride(request.overrideSlug) : '',
    request.uacName ? slugifyUacForOverride(request.uacName) : '',
  ].filter(Boolean);

  const overrideHit = findOverrideSceneOnDisk(publicDir, overrideKeys, archetype);
  if (overrideHit) {
    const usedInRole = request.tracker?.usedByRole.get(request.role);
    if (!usedInRole || !usedInRole.has(overrideHit.id)) {
      recordRoleAllocation(request.tracker, request.role, overrideHit.id);
      return {
        id: overrideHit.id,
        domainId,
        resolvedDomainId: domainId,
        archetype,
        role: request.role,
        crop: slot.crop,
        relativePath: overrideHit.relativePath,
        alt: domainEntry.alt,
        aspectRatio: domainEntry.aspectRatio,
        source: 'override',
        existsOnDisk: true,
      };
    }
  }

  // 2. Escena del dominio primario
  const domainExists = fileExistsUnderPublic(publicDir, domainEntry.relativePath);
  if (domainExists) {
    recordRoleAllocation(request.tracker, request.role, domainEntry.id);
    return {
      id: domainEntry.id,
      domainId,
      resolvedDomainId: domainId,
      archetype,
      role: request.role,
      crop: slot.crop,
      relativePath: domainEntry.relativePath,
      alt: domainEntry.alt,
      aspectRatio: domainEntry.aspectRatio,
      source: 'domain',
      existsOnDisk: true,
    };
  }

  // 3. Fallback determinista a `indagacion_interdisciplinaria_general` si existe en disco
  if (domainId !== 'indagacion_interdisciplinaria_general') {
    const generalEntry = EDITORIAL_SCENES_CATALOG.indagacion_interdisciplinaria_general[archetype];
    const generalExists = fileExistsUnderPublic(publicDir, generalEntry.relativePath);
    if (generalExists) {
      recordRoleAllocation(request.tracker, request.role, generalEntry.id);
      return {
        id: generalEntry.id,
        domainId,
        resolvedDomainId: 'indagacion_interdisciplinaria_general',
        archetype,
        role: request.role,
        crop: slot.crop,
        relativePath: generalEntry.relativePath,
        alt: generalEntry.alt,
        aspectRatio: generalEntry.aspectRatio,
        source: 'fallback_general',
        existsOnDisk: true,
      };
    }
  }

  // 4. Ningún archivo existe aún en disco: devuelve el descriptor esperado con `existsOnDisk: false`
  recordRoleAllocation(request.tracker, request.role, domainEntry.id);
  return {
    id: domainEntry.id,
    domainId,
    resolvedDomainId: domainId,
    archetype,
    role: request.role,
    crop: slot.crop,
    relativePath: domainEntry.relativePath,
    alt: domainEntry.alt,
    aspectRatio: domainEntry.aspectRatio,
    source: 'domain',
    existsOnDisk: false,
  };
}

/**
 * Variante segura para renderers (Typst, DOCX, 08, 09): devuelve la escena SOLO si el
 * archivo `.webp`/`.png` resuelto existe físicamente en `public/images/escenas/`.
 */
export function allocateEditorialSceneOnDisk(
  request: SceneAllocationRequest,
): AllocatedEditorialScene | null {
  const allocated = allocateEditorialScene(request);
  return allocated.existsOnDisk ? allocated : null;
}

/**
 * Helper 3-en-1 para entregables `08 Presentaciones`: resuelve hero + concepto con dedupe por rol.
 */
export function resolveSacrintDeckEditorialScenes(
  uacName: string,
  blockNumber = 1,
  options?: { publicDir?: string; overrideSlug?: string },
): {
  hero: AllocatedEditorialScene | null;
  concept: AllocatedEditorialScene | null;
} {
  const tracker = createBlockSceneTracker();
  return {
    hero: allocateEditorialSceneOnDisk({
      uacName,
      blockNumber,
      role: 'slides_hero',
      publicDir: options?.publicDir,
      overrideSlug: options?.overrideSlug,
      tracker,
    }),
    concept: allocateEditorialSceneOnDisk({
      uacName,
      blockNumber,
      role: 'slides_concept',
      publicDir: options?.publicDir,
      overrideSlug: options?.overrideSlug,
      tracker,
    }),
  };
}

/**
 * Helper 3-en-1 para entregables `09 Infografías`: resuelve escena vertical 4:5 dedicada.
 */
export function resolveSacrintInfographicEditorialScene(
  uacName: string,
  blockNumber = 1,
  options?: { publicDir?: string; overrideSlug?: string },
): AllocatedEditorialScene | null {
  return allocateEditorialSceneOnDisk({
    uacName,
    blockNumber,
    role: 'infographic_activity',
    publicDir: options?.publicDir,
    overrideSlug: options?.overrideSlug,
  });
}
