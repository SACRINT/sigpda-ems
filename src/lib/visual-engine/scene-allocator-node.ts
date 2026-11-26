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
import type {
  AllocatedEditorialScene,
  SceneFileExistsFn,
  SceneReadDataUriFn,
} from './scene-allocator';

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
  timeoutMs = 4000,
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
