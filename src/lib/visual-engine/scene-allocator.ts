/**
 * scene-allocator.ts — Asignador Determinista y Puro de Escenas Contextuales (3-en-1: Libros + 08 + 09)
 * SIGPDA-EMS · Fase 2 Motor Editorial Unificado
 *
 * Módulo 100 % puro (cero imports de `node:fs` / `node:path`) compatible con bundles cliente y servidor.
 * El acceso a disco o red/Blob se inyecta mediante `fileExists` y `readDataUri` desde
 * `scene-allocator-node.ts` en rutas servidor.
 *
 * Matriz exacta de roles y deduplicación del Catálogo Maestro:
 * - Portadas de Bloque: B1 → `portada`, B2 → `concepto`, B3 → `comunidad` (0 portadas repetidas en semestre).
 * - 4 Misiones por bloque: M1 → `concepto` (`top_band`), M2 → `practica` (`horizontal_editorial`),
 *   M3 → `portada` (`detail_right`), M4 → `comunidad` (`full`) (0 repeticiones entre misiones del bloque).
 * - Entregable `08`: `slides_hero` → `portada`, `slides_concept` → `concepto`.
 * - Entregable `09`: `infographic_activity` → `practica` (vertical 4:5 dedicado).
 * - Prioridad de resolución: `overrides/` → dominio primario → fallback `indagacion_interdisciplinaria_general`.
 */

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

export type SceneFileExistsFn = (relativePath: string) => boolean;
export type SceneReadDataUriFn = (relativePath: string) => string | undefined;

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
  /** Imagen inline `data:image/webp;base64,...` o `data:image/png;base64,...` para renderers 08/09 y serverless. */
  dataUri?: string;
}

export interface SceneAllocationRequest {
  uacName?: string | null;
  component?: string | null;
  domainId?: DisciplinaryDomainId;
  /** Número de bloque 1-based (1, 2, 3...). */
  blockNumber?: number;
  /** Índice de misión 0-based opcional para rotar escenas 16:9 en `slides_hero`. */
  missionIndex?: number;
  role: EditorialSceneRole;
  /** Slug opcional para buscar override específico en `public/images/escenas/overrides/`. */
  overrideSlug?: string | null;
  /** Predicado inyectado de existencia del asset (default `() => false`, seguro en cliente). */
  fileExists?: SceneFileExistsFn;
  /** Lector opcional inyectado que devuelve `data:image/...;base64,...` para renderers SVG/PPTX/PDF. */
  readDataUri?: SceneReadDataUriFn;
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

/** Roles panorámicos 16:9 NUNCA deben rotar a `practica` (4:5 vertical). */
const LANDSCAPE_ROTATION_ORDER: readonly EditorialSceneArchetype[] = [
  'portada',
  'concepto',
  'comunidad',
];

const PORTRAIT_OR_FLEX_ROTATION_ORDER: readonly EditorialSceneArchetype[] = [
  'practica',
  'portada',
  'concepto',
  'comunidad',
];

const LANDSCAPE_ROLES: ReadonlySet<EditorialSceneRole> = new Set<EditorialSceneRole>([
  'block_cover',
  'mission_1',
  'mission_3',
  'mission_4',
  'slides_hero',
  'slides_concept',
]);

const DEFAULT_FILE_EXISTS: SceneFileExistsFn = () => false;

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
  missionIndex = 0,
): { archetype: EditorialSceneArchetype; crop: EditorialSceneCrop } {
  const safeBlock = Math.max(1, Math.floor(blockNumber || 1));
  const safeMission = Math.max(0, Math.floor(missionIndex || 0));
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
    case 'slides_hero': {
      // Rota entre los 3 arquetipos panorámicos 16:9 (nunca 4:5 `practica`),
      // conservando B1M1 = `portada` para paridad exacta con baseline/goldens.
      const archetype =
        LANDSCAPE_ROTATION_ORDER[(safeBlock - 1 + safeMission) % LANDSCAPE_ROTATION_ORDER.length];
      return { archetype, crop: 'full' };
    }
    case 'slides_concept': {
      const archetype =
        LANDSCAPE_ROTATION_ORDER[(safeBlock + safeMission) % LANDSCAPE_ROTATION_ORDER.length];
      return { archetype, crop: 'full' };
    }
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

function findOverrideScene(
  fileExists: SceneFileExistsFn,
  overrideKeys: string[],
  archetype: EditorialSceneArchetype,
): { id: string; relativePath: string } | null {
  for (const key of overrideKeys) {
    if (!key) continue;
    const candidates = [
      `${key}-${archetype}.webp`,
      `${key}-${archetype}.png`,
      `${key}.webp`,
      `${key}.png`,
    ];
    for (const filename of candidates) {
      const rel = `${EDITORIAL_SCENES_OVERRIDES_PATH}/${filename}`;
      if (fileExists(rel)) {
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

  const order = LANDSCAPE_ROLES.has(role)
    ? LANDSCAPE_ROTATION_ORDER
    : PORTRAIT_OR_FLEX_ROTATION_ORDER;

  for (const altArch of order) {
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
 * Nunca registra en el tracker cuando `existsOnDisk: false` para no bloquear asignaciones posteriores.
 */
export function allocateEditorialScene(request: SceneAllocationRequest): AllocatedEditorialScene {
  const fileExists = request.fileExists ?? DEFAULT_FILE_EXISTS;
  const readDataUri = request.readDataUri;
  const domainId: DisciplinaryDomainId =
    request.domainId ??
    getDisciplinaryAdapter(request.uacName || '', request.component || undefined).id;

  const slot = resolveCanonicalRoleSlot(
    request.role,
    request.blockNumber ?? 1,
    request.missionIndex ?? 0,
  );
  const archetype = pickNonRepeatingArchetype(domainId, slot.archetype, request.role, request.tracker);
  const domainEntry: EditorialSceneEntry = EDITORIAL_SCENES_CATALOG[domainId][archetype];

  // 1. Prioridad máxima: `public/images/escenas/overrides/`
  const overrideKeys = [
    request.overrideSlug ? slugifyUacForOverride(request.overrideSlug) : '',
    request.uacName ? slugifyUacForOverride(request.uacName) : '',
  ].filter(Boolean);

  const overrideHit = findOverrideScene(fileExists, overrideKeys, archetype);
  if (overrideHit) {
    const usedInRole = request.tracker?.usedByRole.get(request.role);
    if (!usedInRole || !usedInRole.has(overrideHit.id)) {
      recordRoleAllocation(request.tracker, request.role, overrideHit.id);
      const dataUri = readDataUri?.(overrideHit.relativePath);
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
        ...(dataUri ? { dataUri } : {}),
      };
    }
  }

  // 2. Escena del dominio primario
  if (fileExists(domainEntry.relativePath)) {
    recordRoleAllocation(request.tracker, request.role, domainEntry.id);
    const dataUri = readDataUri?.(domainEntry.relativePath);
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
      ...(dataUri ? { dataUri } : {}),
    };
  }

  // 3. Fallback determinista a `indagacion_interdisciplinaria_general` si existe
  if (domainId !== 'indagacion_interdisciplinaria_general') {
    const generalEntry = EDITORIAL_SCENES_CATALOG.indagacion_interdisciplinaria_general[archetype];
    if (fileExists(generalEntry.relativePath)) {
      recordRoleAllocation(request.tracker, request.role, generalEntry.id);
      const dataUri = readDataUri?.(generalEntry.relativePath);
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
        ...(dataUri ? { dataUri } : {}),
      };
    }
  }

  // 4. Ningún archivo disponible: devuelve el descriptor esperado SIN contaminar el tracker
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
 * archivo `.webp`/`.png` resuelto existe según `fileExists`.
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
  options?: {
    missionIndex?: number;
    fileExists?: SceneFileExistsFn;
    readDataUri?: SceneReadDataUriFn;
    overrideSlug?: string;
  },
): {
  hero: AllocatedEditorialScene | null;
  concept: AllocatedEditorialScene | null;
} {
  if (!options?.fileExists) {
    return { hero: null, concept: null };
  }
  const tracker = createBlockSceneTracker();
  const missionIndex = options.missionIndex ?? 0;
  return {
    hero: allocateEditorialSceneOnDisk({
      uacName,
      blockNumber,
      missionIndex,
      role: 'slides_hero',
      fileExists: options.fileExists,
      readDataUri: options.readDataUri,
      overrideSlug: options.overrideSlug,
      tracker,
    }),
    concept: allocateEditorialSceneOnDisk({
      uacName,
      blockNumber,
      missionIndex,
      role: 'slides_concept',
      fileExists: options.fileExists,
      readDataUri: options.readDataUri,
      overrideSlug: options.overrideSlug,
      tracker,
    }),
  };
}

/**
 * Helper 3-en-1 para entregables `09 Infografías`: resuelve escena vertical 4:5 dedicada.
 * Soporta rotación automática entre hasta 3 variantes verticales 4:5 por dominio cuando existen
 * en disco (`03-practica.webp`, `05-infografia-b.webp`, `06-infografia-c.webp`), conservando
 * B1M1 (block=1, missionIndex=0) en `03-practica.webp` para paridad exacta con goldens.
 */
export function resolveSacrintInfographicEditorialScene(
  uacName: string,
  blockNumber = 1,
  options?: {
    missionIndex?: number;
    fileExists?: SceneFileExistsFn;
    readDataUri?: SceneReadDataUriFn;
    overrideSlug?: string;
  },
): AllocatedEditorialScene | null {
  if (!options?.fileExists) return null;
  const baseScene = allocateEditorialSceneOnDisk({
    uacName,
    blockNumber,
    missionIndex: options.missionIndex ?? 0,
    role: 'infographic_activity',
    fileExists: options.fileExists,
    readDataUri: options.readDataUri,
    overrideSlug: options.overrideSlug,
  });
  if (!baseScene || baseScene.source === 'override') {
    return baseScene;
  }

  const safeBlock = Math.max(1, Math.floor(blockNumber || 1));
  const safeMission = Math.max(0, Math.floor(options.missionIndex ?? 0));
  const variantSlot = ((safeBlock - 1) * 4 + safeMission) % 3;
  if (variantSlot === 0) {
    return baseScene;
  }

  const suffix = variantSlot === 1 ? '05-infografia-b' : '06-infografia-c';
  const variantPath = baseScene.relativePath.replace(/-03-practica\.webp$/i, `-${suffix}.webp`);
  if (variantPath !== baseScene.relativePath && options.fileExists(variantPath)) {
    const variantId = baseScene.id.replace(/-03-practica$/i, `-${suffix}`);
    return {
      ...baseScene,
      id: variantId,
      relativePath: variantPath,
      dataUri: options.readDataUri?.(variantPath),
    };
  }

  return baseScene;
}
