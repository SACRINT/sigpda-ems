/**
 * scene-allocator-node.ts — Adaptador de servidor (Node FS + Sharp + fallback serverless fetch)
 * SIGPDA-EMS · Fase 2 Motor Editorial Unificado
 *
 * SOLO importar desde Route Handlers, servicios servidor o pruebas (NUNCA desde componentes
 * `'use client'` ni módulos reexportados por `spec.ts`).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import {
  allocateEditorialScene,
  type AllocatedEditorialScene,
  type SceneFileExistsFn,
  type SceneReadDataUriFn,
} from './scene-allocator';
import type { SacrintDeckSpec, SacrintInfographicSpec } from './sacrint/types';

const DEFAULT_PUBLIC_DIR = () => path.join(process.cwd(), 'public');

function normalizeRelPath(relativePath: string): string {
  return relativePath.replace(/^\/+/, '');
}

function inferMimeType(relativePath: string): string {
  if (/\.webp$/i.test(relativePath)) return 'image/webp';
  if (/\.jpe?g$/i.test(relativePath)) return 'image/jpeg';
  return 'image/png';
}

/**
 * Crea un predicado `fileExists` respaldado por `fs.existsSync` bajo `publicDir`.
 */
export function createNodeSceneFileExists(publicDir = DEFAULT_PUBLIC_DIR()): SceneFileExistsFn {
  return (relativePath: string): boolean => {
    try {
      return fs.existsSync(path.join(publicDir, normalizeRelPath(relativePath)));
    } catch {
      return false;
    }
  };
}

/**
 * Crea un lector síncrono `readDataUri` con caché en memoria por instancia para inline base64
 * en renderers SVG / PPTX / PDF.
 */
export function createNodeSceneDataUriReader(publicDir = DEFAULT_PUBLIC_DIR()): SceneReadDataUriFn {
  const cache = new Map<string, string | undefined>();
  return (relativePath: string): string | undefined => {
    const absPath = path.join(publicDir, normalizeRelPath(relativePath));
    if (cache.has(absPath)) return cache.get(absPath);
    try {
      if (!fs.existsSync(absPath)) {
        cache.set(absPath, undefined);
        return undefined;
      }
      const bytes = fs.readFileSync(absPath);
      const mime = inferMimeType(relativePath);
      const uri = `data:${mime};base64,${bytes.toString('base64')}`;
      cache.set(absPath, uri);
      return uri;
    } catch {
      cache.set(absPath, undefined);
      return undefined;
    }
  };
}

/**
 * Conveniencia para rutas servidor que invocan `buildSacrintDeck` / `buildSacrintInfographic`.
 */
export function createNodeSceneLoader(publicDir = DEFAULT_PUBLIC_DIR()): {
  sceneFileExists: SceneFileExistsFn;
  sceneReadDataUri: SceneReadDataUriFn;
} {
  return {
    sceneFileExists: createNodeSceneFileExists(publicDir),
    sceneReadDataUri: createNodeSceneDataUriReader(publicDir),
  };
}

/**
 * Convierte un `data:image/webp;base64,...` a `data:image/png;base64,...` vía `sharp`
 * para garantizar compatibilidad universal en PowerPoint (PPTX), jsPDF y Resvg.
 * Si ya es PNG o JPEG, devuelve el `dataUri` intacto.
 */
export async function ensurePngDataUri(dataUri: string): Promise<string> {
  const match = /^data:image\/webp;base64,(.+)$/i.exec(dataUri.trim());
  if (!match) return dataUri;
  const webpBuf = Buffer.from(match[1], 'base64');
  const pngBuf = await sharp(webpBuf).png().toBuffer();
  return `data:image/png;base64,${pngBuf.toString('base64')}`;
}

/**
 * Fallback serverless (Vercel/Blob): hidrata `scene.dataUri` haciendo `fetch` a la URL pública
 * o de Blob cuando `fs` local no contiene `public/` en tiempo de ejecución.
 */
export async function hydrateEditorialSceneViaUrl(
  scene: AllocatedEditorialScene,
  baseUrl: string,
  timeoutMs = 3000,
): Promise<AllocatedEditorialScene> {
  if (scene.dataUri) return scene;
  try {
    const targetUrl = new URL(scene.relativePath, baseUrl).toString();
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return scene;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type')?.split(';')[0] || inferMimeType(scene.relativePath);
    return {
      ...scene,
      existsOnDisk: true,
      dataUri: `data:${mime};base64,${buf.toString('base64')}`,
    };
  } catch {
    return scene;
  }
}

/**
 * Fallback serverless (Vercel/Blob) para presentaciones `08`: si `fs` local no encontró
 * `public/images/escenas/`, intenta hidratar hero + concepto vía HTTP desde `origin`.
 * En local o contenedor con `public/` montado retorna inmediatamente (costo 0).
 */
export async function hydrateDeckEditorialScenesViaUrl(
  deck: SacrintDeckSpec,
  origin?: string | null,
): Promise<SacrintDeckSpec> {
  if (!origin) return deck;
  if (deck.editorialScenes?.hero?.dataUri && deck.editorialScenes?.concept?.dataUri) {
    return deck;
  }
  const missionIndex = Math.max(0, (deck.meta.missionNumber || 1) - 1);
  const [hero, concept] = await Promise.all([
    deck.editorialScenes?.hero?.dataUri
      ? Promise.resolve(deck.editorialScenes.hero)
      : hydrateEditorialSceneViaUrl(
          allocateEditorialScene({
            uacName: deck.meta.subjectName,
            blockNumber: deck.meta.blockNumber,
            missionIndex,
            role: 'slides_hero',
          }),
          origin,
        ),
    deck.editorialScenes?.concept?.dataUri
      ? Promise.resolve(deck.editorialScenes.concept)
      : hydrateEditorialSceneViaUrl(
          allocateEditorialScene({
            uacName: deck.meta.subjectName,
            blockNumber: deck.meta.blockNumber,
            missionIndex,
            role: 'slides_concept',
          }),
          origin,
        ),
  ]);
  const validHero = hero.dataUri ? hero : undefined;
  const validConcept = concept.dataUri ? concept : undefined;
  if (!validHero && !validConcept) return deck;
  return {
    ...deck,
    editorialScenes: {
      ...(validHero ? { hero: validHero } : {}),
      ...(validConcept ? { concept: validConcept } : {}),
    },
  };
}

/**
 * Fallback serverless (Vercel/Blob) para infografías `09`: si `fs` local no encontró
 * la escena 4:5, intenta hidratarla vía HTTP desde `origin` respetando la rotación
 * de 3 variantes verticales Parte D (`03-practica`, `05-infografia-b`, `06-infografia-c`).
 */
export async function hydrateInfographicEditorialSceneViaUrl(
  spec: SacrintInfographicSpec,
  origin?: string | null,
): Promise<SacrintInfographicSpec> {
  if (!origin || spec.editorialScene?.dataUri) return spec;
  const safeBlock = Math.max(1, Math.floor(spec.meta.blockNumber || 1));
  const safeMission = Math.max(0, Math.floor((spec.meta.missionNumber || 1) - 1));
  const baseScene = allocateEditorialScene({
    uacName: spec.meta.subjectName,
    blockNumber: safeBlock,
    missionIndex: safeMission,
    role: 'infographic_activity',
  });

  const variantSlot = ((safeBlock - 1) * 4 + safeMission) % 3;
  if (variantSlot > 0) {
    const suffix = variantSlot === 1 ? '05-infografia-b' : '06-infografia-c';
    const variantPath = baseScene.relativePath.replace(/-03-practica\.webp$/i, `-${suffix}.webp`);
    if (variantPath !== baseScene.relativePath) {
      const variantHydrated = await hydrateEditorialSceneViaUrl(
        {
          ...baseScene,
          id: baseScene.id.replace(/-03-practica$/i, `-${suffix}`),
          relativePath: variantPath,
        },
        origin,
      );
      if (variantHydrated.dataUri) {
        return { ...spec, editorialScene: variantHydrated };
      }
    }
  }

  const hydrated = await hydrateEditorialSceneViaUrl(baseScene, origin);
  if (!hydrated.dataUri) return spec;
  return { ...spec, editorialScene: hydrated };
}
