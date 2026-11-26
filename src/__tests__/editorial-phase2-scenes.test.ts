/**
 * editorial-phase2-scenes.test.ts — Pruebas de Aceptación Fase 2 (Motor de Escenas Contextuales)
 *
 * Valida:
 * 1. Cobertura total tipada: 17 dominios `DisciplinaryDomainId` × 4 arquetipos = 68 escenas `.webp`.
 * 2. Matriz exacta de roles + fixes menores:
 *    - 0 portadas repetidas entre Bloques 1, 2 y 3 (`portada` → `concepto` → `comunidad`).
 *    - 0 repeticiones entre las 4 misiones dentro del mismo bloque.
 *    - 0 repeticiones en el mismo rol bajo `createBlockSceneTracker()`.
 *    - Roles 16:9 NUNCA rotan a `practica` (4:5).
 *    - `existsOnDisk: false` NUNCA contamina el tracker.
 * 3. Prioridad de `public/images/escenas/overrides/` (incluye `${key}.png`) sobre escenas de dominio
 *    y fallback determinista a `indagacion_interdisciplinaria_general`.
 * 4. Soporte `.webp` en `SpotMaterialSchema`/`EditorialSceneSchema` + compilación real en Typst
 *    de `StudentChapter` con `coverScene` `.webp` sobre `worker-editorial/server.js`.
 * 5. Integración 3-en-1 REAL hasta los renderers de salida:
 *    - 08 SVG (`slide-renderer.ts`): `<image href="data:image/..."` en portada y concepto.
 *    - 08 PPTX (`generateSacrintPptx`): descomprimido con `JSZip` contiene archivos reales en `ppt/media/`.
 *    - 09 SVG (`infographic-renderer.ts`) + PNG (`renderInfographicPng`) + PDF vectorial (`renderCombinedSacrintInfographicsPdf`):
 *      contiene `<image` en SVG (wide y letter), rasteriza `.webp` y embebe XObject `/Subtype /Image` en el PDF.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
import JSZip from 'jszip';
import { DISCIPLINARY_DOMAIN_IDS, resolveEditorialDisciplinaryUi } from '@/lib/editorial/disciplinary-ui';
import {
  EDITORIAL_SCENES_CATALOG,
  listAllEditorialScenes,
} from '@/lib/visual-engine/editorial-scenes-catalog';
import {
  allocateEditorialScene,
  allocateEditorialSceneOnDisk,
  createBlockSceneTracker,
  resolveSacrintDeckEditorialScenes,
  resolveSacrintInfographicEditorialScene,
} from '@/lib/visual-engine/scene-allocator';
import {
  createNodeSceneDataUriReader,
  createNodeSceneFileExists,
  createNodeSceneLoader,
} from '@/lib/visual-engine/scene-allocator-node';
import { resolveEditorialSceneForMission } from '@/lib/visual-engine/visual-asset-manager';
import {
  EditorialSceneSchema,
  SpotMaterialSchema,
  StudentChapterSchema,
  type StudentChapter,
} from '@/lib/editorial/student-content-model';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck, buildSacrintInfographic } from '@/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderInfographicSvg } from '@/lib/visual-engine/sacrint/infographic-renderer';
import {
  renderCombinedSacrintInfographicsPdf,
  renderInfographicPng,
} from '@/lib/visual-engine/sacrint/sacrint-rasterizer';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRequest } = require('../../worker-editorial/server.js');

async function writeSampleWebp(filePath: string, width = 320, height = 180): Promise<void> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await sharp({
    create: { width, height, channels: 3, background: { r: 18, g: 59, b: 93 } },
  })
    .webp({ quality: 88 })
    .toFile(filePath);
}

async function writeSamplePng(filePath: string, width = 320, height = 180): Promise<void> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await sharp({
    create: { width, height, channels: 3, background: { r: 31, g: 122, b: 90 } },
  })
    .png()
    .toFile(filePath);
}

describe('Fase 2 — Motor de Escenas Contextuales (68 Escenas · Matriz de Roles · WebP · Renderers 08/09)', () => {
  let tmpPublicDir: string;

  beforeAll(async () => {
    tmpPublicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigpda-phase2-public-'));
    for (const entry of Object.values(EDITORIAL_SCENES_CATALOG.pensamiento_matematico)) {
      await writeSampleWebp(
        path.join(tmpPublicDir, entry.relativePath.replace(/^\/+/, '')),
        entry.width / 4,
        entry.height / 4,
      );
    }
    for (const entry of Object.values(EDITORIAL_SCENES_CATALOG.indagacion_interdisciplinaria_general)) {
      await writeSampleWebp(
        path.join(tmpPublicDir, entry.relativePath.replace(/^\/+/, '')),
        entry.width / 4,
        entry.height / 4,
      );
    }
    await writeSampleWebp(
      path.join(tmpPublicDir, 'images', 'escenas', 'overrides', 'cecbv-portada.webp'),
      320,
      180,
    );
    await writeSamplePng(
      path.join(tmpPublicDir, 'images', 'escenas', 'overrides', 'aecaef.png'),
      320,
      180,
    );
  });

  afterAll(() => {
    fs.rmSync(tmpPublicDir, { recursive: true, force: true });
  });

  it('cubre los 17 dominios de DisciplinaryDomainId × 4 arquetipos = 68 escenas únicas en .webp', () => {
    expect(DISCIPLINARY_DOMAIN_IDS).toHaveLength(17);
    const all = listAllEditorialScenes();
    expect(all).toHaveLength(68);

    expect(new Set(all.map((s) => s.id)).size).toBe(68);
    expect(new Set(all.map((s) => s.relativePath)).size).toBe(68);

    for (const domainId of DISCIPLINARY_DOMAIN_IDS) {
      const set = EDITORIAL_SCENES_CATALOG[domainId];
      expect(set).toBeDefined();
      expect(set.portada.aspectRatio).toBe('16:9');
      expect(set.concepto.aspectRatio).toBe('16:9');
      expect(set.practica.aspectRatio).toBe('4:5');
      expect(set.comunidad.aspectRatio).toBe('16:9');
      for (const entry of Object.values(set)) {
        expect(entry.relativePath).toMatch(/^\/images\/escenas\/[a-z_]+\/[a-z0-9-]+\.webp$/);
        expect(entry.alt.length).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it('cumple matriz de roles: 0 portadas B1–B3, 0 repeticiones M1–M4, 16:9 no rota a practica y existsOnDisk:false no contamina tracker', () => {
    const fileExists = createNodeSceneFileExists(tmpPublicDir);

    const coverB1 = allocateEditorialScene({ uacName: 'Pensamiento Matemático I', blockNumber: 1, role: 'block_cover', fileExists });
    const coverB2 = allocateEditorialScene({ uacName: 'Pensamiento Matemático I', blockNumber: 2, role: 'block_cover', fileExists });
    const coverB3 = allocateEditorialScene({ uacName: 'Pensamiento Matemático I', blockNumber: 3, role: 'block_cover', fileExists });

    expect([coverB1.archetype, coverB2.archetype, coverB3.archetype]).toEqual(['portada', 'concepto', 'comunidad']);
    expect(new Set([coverB1.id, coverB2.id, coverB3.id]).size).toBe(3);

    const m1 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_1', fileExists });
    const m2 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_2', fileExists });
    const m3 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_3', fileExists });
    const m4 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_4', fileExists });

    expect(new Set([m1.id, m2.id, m3.id, m4.id]).size).toBe(4);
    expect([m1.crop, m2.crop, m3.crop, m4.crop]).toEqual([
      'top_band',
      'horizontal_editorial',
      'detail_right',
      'full',
    ]);

    // Roles 16:9 nunca rotan a practica (4:5), ni tras agotar las 3 panorámicas
    const tracker = createBlockSceneTracker();
    const h1 = allocateEditorialScene({ domainId: 'pensamiento_matematico', role: 'slides_hero', fileExists, tracker });
    const h2 = allocateEditorialScene({ domainId: 'pensamiento_matematico', role: 'slides_hero', fileExists, tracker });
    const h3 = allocateEditorialScene({ domainId: 'pensamiento_matematico', role: 'slides_hero', fileExists, tracker });
    const h4 = allocateEditorialScene({ domainId: 'pensamiento_matematico', role: 'slides_hero', fileExists, tracker });
    expect([h1.archetype, h2.archetype, h3.archetype]).toEqual(['portada', 'concepto', 'comunidad']);
    expect([h1, h2, h3, h4].every((s) => s.archetype !== 'practica')).toBe(true);

    // existsOnDisk:false NO contamina el tracker para una asignación válida posterior
    const cleanTracker = createBlockSceneTracker();
    const missed = allocateEditorialScene({
      domainId: 'pensamiento_matematico',
      role: 'slides_hero',
      fileExists: () => false,
      tracker: cleanTracker,
    });
    expect(missed.existsOnDisk).toBe(false);
    expect(cleanTracker.usedByRole.size).toBe(0);
    const hitAfterMiss = allocateEditorialScene({
      domainId: 'pensamiento_matematico',
      role: 'slides_hero',
      fileExists,
      tracker: cleanTracker,
    });
    expect(hitAfterMiss.existsOnDisk).toBe(true);
    expect(hitAfterMiss.archetype).toBe('portada');
  });

  it('prioriza overrides/ (.webp y ${key}.png) y cae a indagacion_interdisciplinaria_general si falta dominio en disco', () => {
    const fileExists = createNodeSceneFileExists(tmpPublicDir);

    const overrideWebp = allocateEditorialSceneOnDisk({
      uacName: 'Coloca elementos constructivos básicos',
      overrideSlug: 'cecbv',
      blockNumber: 1,
      role: 'block_cover',
      fileExists,
    });
    expect(overrideWebp?.source).toBe('override');
    expect(overrideWebp?.relativePath).toBe('/images/escenas/overrides/cecbv-portada.webp');

    const overridePng = allocateEditorialSceneOnDisk({
      uacName: 'Actualiza equipos de cómputo',
      overrideSlug: 'aecaef',
      blockNumber: 1,
      role: 'block_cover',
      fileExists,
    });
    expect(overridePng?.source).toBe('override');
    expect(overridePng?.relativePath).toBe('/images/escenas/overrides/aecaef.png');

    const fallbackScene = allocateEditorialSceneOnDisk({
      uacName: 'Pensamiento Literario',
      blockNumber: 1,
      role: 'block_cover',
      fileExists,
    });
    expect(fallbackScene?.domainId).toBe('lengua_comunicacion_literatura');
    expect(fallbackScene?.resolvedDomainId).toBe('indagacion_interdisciplinaria_general');
    expect(fallbackScene?.source).toBe('fallback_general');

    const none = allocateEditorialSceneOnDisk({
      uacName: 'Pensamiento Literario',
      blockNumber: 1,
      role: 'block_cover',
      fileExists: () => false,
    });
    expect(none).toBeNull();
  });

  it('renderiza escenas reales en 08 (SVG <image> + PPTX ppt/media/) y 09 (SVG <image> + PNG + PDF XObject /Subtype /Image)', async () => {
    expect(
      SpotMaterialSchema.safeParse({
        nombre: 'Escena de laboratorio',
        archivo: 'bio-01-portada.webp',
        anchoCm: 3.6,
      }).success,
    ).toBe(true);

    const sceneLoader = createNodeSceneLoader(tmpPublicDir);
    const fileExists = createNodeSceneFileExists(tmpPublicDir);
    const readDataUri = createNodeSceneDataUriReader(tmpPublicDir);

    // 3-en-1 helpers + visual-asset-manager
    const deckScenes = resolveSacrintDeckEditorialScenes('Pensamiento Matemático I', 1, { fileExists, readDataUri });
    expect(deckScenes.hero?.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(deckScenes.concept?.dataUri).toMatch(/^data:image\/webp;base64,/);
    expect(deckScenes.hero?.id).not.toBe(deckScenes.concept?.id);

    const infoScene = resolveSacrintInfographicEditorialScene('Pensamiento Matemático I', 1, { fileExists, readDataUri });
    expect(infoScene?.archetype).toBe('practica');
    expect(infoScene?.aspectRatio).toBe('4:5');
    expect(infoScene?.dataUri).toMatch(/^data:image\/webp;base64,/);

    const missionVisuals = [0, 1, 2, 3].map((missionIndex) =>
      resolveEditorialSceneForMission({
        uacName: 'Pensamiento Matemático I',
        blockIndex: 0,
        missionIndex,
        publicDir: tmpPublicDir,
      }),
    );
    expect(missionVisuals.every((v) => v?.type === 'editorial_scene')).toBe(true);
    expect(new Set(missionVisuals.map((v) => v?.scene?.id)).size).toBe(4);
    expect(EditorialSceneSchema.safeParse(missionVisuals[0]?.scene).success).toBe(true);

    // 08 SVG: portada (cover) contiene <image href="data:image/..."
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, {
      missionIndex: 0,
      mode: 'full',
      ...sceneLoader,
    });
    const renderedSlides = renderDeckSvgs(deck);
    const coverSlideSvg = renderedSlides.find((s) => s.kind === 'cover')?.svg ?? '';
    expect(coverSlideSvg).toContain('<image href="data:image/webp;base64,');

    // 08 PPTX: archivo ZIP contiene imagen real embebida en ppt/media/
    const pptxBuffer = await generateSacrintPptx(deck);
    const zip = await JSZip.loadAsync(pptxBuffer);
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThanOrEqual(1);

    // 09 SVG (wide + letter) + PNG raster + PDF vectorial con XObject de imagen real
    const infoWide = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'wide', {
      missionIndex: 0,
      ...sceneLoader,
    });
    const wideSvg = renderInfographicSvg(infoWide);
    expect(wideSvg).toContain('<image href="data:image/webp;base64,');

    const infoLetter = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'letter', {
      missionIndex: 0,
      ...sceneLoader,
    });
    const letterSvg = renderInfographicSvg(infoLetter);
    expect(letterSvg).toContain('<image href="data:image/webp;base64,');

    const renderedPng = await renderInfographicPng(infoWide, 0.25);
    expect(renderedPng.buffer.length).toBeGreaterThan(5_000);

    const pdfBuffer = await renderCombinedSacrintInfographicsPdf([infoWide, infoLetter], 'wide');
    const pdfLatin1 = pdfBuffer.toString('latin1');
    expect(pdfLatin1).toContain('/Subtype /Image');
  });

  it('compila un StudentChapter real con coverScene .webp a PDF válido mediante worker-editorial/server.js', async () => {
    const origPublicDir = process.env.PUBLIC_DIR;
    const origUrl = process.env.EDITORIAL_WORKER_URL;
    const origSecret = process.env.EDITORIAL_WORKER_SECRET;
    let server: http.Server | null = null;

    try {
      process.env.PUBLIC_DIR = tmpPublicDir;
      process.env.EDITORIAL_WORKER_SECRET = 'phase2-webp-cover-secret';

      await new Promise<void>((resolve, reject) => {
        server = http.createServer(handleRequest);
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address();
          if (!addr || typeof addr === 'string') return reject(new Error('Puerto efímero inválido'));
          process.env.EDITORIAL_WORKER_URL = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      const coverScene = allocateEditorialSceneOnDisk({
        uacName: 'Pensamiento Matemático I',
        blockNumber: 1,
        role: 'block_cover',
        fileExists: createNodeSceneFileExists(tmpPublicDir),
      });
      expect(coverScene).not.toBeNull();

      const chapter: StudentChapter = StudentChapterSchema.parse({
        uac: 'Pensamiento Matemático I',
        bloque: 'Bloque 1',
        semestre: '1',
        cicloEscolar: '2026-2027',
        plantel: 'Bachillerato General Oficial Héroes de la Patria',
        cct: '21EBH0123A',
        zonaEscolar: 'Zona 004',
        disciplinaUi: resolveEditorialDisciplinaryUi('Pensamiento Matemático I'),
        coverScene: coverScene!,
        sesiones: [
          {
            numero: 1,
            titulo: 'Sesión 1: Medición y proporcionalidad en el entorno escolar',
            objetivo: 'Aplicar razones y proporciones para resolver problemas reales de medición en el plantel.',
            motivacion: 'En tu bachillerato es necesario estimar materiales para el huerto escolar sin desperdicio.',
            saberesPrevios: 'Ya utilizas operaciones básicas con fracciones y decimales en compras cotidianas.',
            contenido: [
              {
                tipo: 'parrafo',
                texto: 'Una razón compara dos magnitudes homogéneas y permite construir modelos proporcionales directos.',
              },
            ],
            ejemploResuelto: {
              enunciado: 'Si 3 metros de malla cuestan 180 pesos, calcula el costo de 7 metros.',
              pasos: [
                'Calcula el costo unitario: 180 / 3 = 60 pesos por metro.',
                'Multiplica por la longitud deseada: 60 × 7 = 420 pesos.',
              ],
            },
            practica: [
              {
                enunciado: 'Calcula cuántos litros de agua se requieren para 12 macetas si 4 macetas usan 6 litros.',
                pista: 'Encuentra primero los litros por cada maceta.',
              },
            ],
            aplicacion: 'Estima el presupuesto de riego para tu proyecto comunitario PAEC.',
            autoevaluacion: [
              'Identifico la constante de proporcionalidad en un problema real.',
              'Verifico la coherencia de las unidades en mi resultado.',
            ],
            recursos: [
              {
                titulo: 'GeoGebra — Proporcionalidad directa',
                url: 'https://www.geogebra.org/',
                tipo: 'web',
              },
            ],
            sidenote: 'La constante de proporcionalidad k = y/x permanece invariante en relaciones directas.',
          },
        ],
      });

      const result = await dispatchToEditorialWorker(chapter, {
        sourceDateEpoch: 0,
        timeoutMs: 30000,
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe('remote_worker');
      expect(result.pdfBuffer).toBeDefined();
      expect(result.pdfBuffer!.length).toBeGreaterThan(20_000);
      expect(result.pageCount).toBeGreaterThanOrEqual(3);
    } finally {
      if (origPublicDir !== undefined) process.env.PUBLIC_DIR = origPublicDir;
      else delete process.env.PUBLIC_DIR;
      if (origUrl !== undefined) process.env.EDITORIAL_WORKER_URL = origUrl;
      else delete process.env.EDITORIAL_WORKER_URL;
      if (origSecret !== undefined) process.env.EDITORIAL_WORKER_SECRET = origSecret;
      else delete process.env.EDITORIAL_WORKER_SECRET;
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server!.close((err) => (err ? reject(err) : resolve()));
        });
      }
    }
  });
});
