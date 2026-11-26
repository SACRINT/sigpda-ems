/**
 * editorial-phase2-scenes.test.ts — Pruebas de Aceptación Fase 2 (Motor de Escenas Contextuales)
 *
 * Valida:
 * 1. Cobertura total tipada: 17 dominios `DisciplinaryDomainId` × 4 arquetipos = 68 escenas `.webp`.
 * 2. Matriz exacta de roles:
 *    - 0 portadas repetidas entre Bloques 1, 2 y 3 (`portada` → `concepto` → `comunidad`).
 *    - 0 repeticiones entre las 4 misiones dentro del mismo bloque (`concepto/top_band`,
 *      `practica/horizontal_editorial`, `portada/detail_right`, `comunidad/full`).
 *    - 0 repeticiones en el mismo rol bajo `createBlockSceneTracker()`.
 * 3. Prioridad de `public/images/escenas/overrides/` sobre escenas de dominio.
 * 4. Fallback determinista a `indagacion_interdisciplinaria_general` cuando falta el dominio en disco,
 *    y retorno seguro `null` en `allocateEditorialSceneOnDisk` cuando no hay ningún activo en disco.
 * 5. Soporte `.webp` en `SpotMaterialSchema` y `EditorialSceneSchema` + compilación real en Typst
 *    de un `StudentChapter` con `coverScene` `.webp` sobre `worker-editorial/server.js`.
 * 6. Integración 3-en-1: Libro (`coverScene`), `08 Presentaciones` (`slides_hero`/`slides_concept`),
 *    `09 Infografías` (`infographic_activity` 4:5) y `visual-asset-manager` (`resolveEditorialSceneForMission`).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
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
import { resolveEditorialSceneForMission } from '@/lib/visual-engine/visual-asset-manager';
import {
  EditorialSceneSchema,
  SpotMaterialSchema,
  StudentChapterSchema,
  type StudentChapter,
} from '@/lib/editorial/student-content-model';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';

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

describe('Fase 2 — Motor de Escenas Contextuales (68 Escenas · Matriz de Roles · WebP · 3-en-1)', () => {
  let tmpPublicDir: string;

  beforeAll(async () => {
    tmpPublicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigpda-phase2-public-'));
    // Crear escenas reales `.webp` en tmpPublicDir para pruebas deterministas en disco:
    // 1) Dominio completo `pensamiento_matematico` (4 arquetipos)
    for (const entry of Object.values(EDITORIAL_SCENES_CATALOG.pensamiento_matematico)) {
      await writeSampleWebp(
        path.join(tmpPublicDir, entry.relativePath.replace(/^\/+/, '')),
        entry.width / 4,
        entry.height / 4,
      );
    }
    // 2) Fallback general `indagacion_interdisciplinaria_general` (4 arquetipos)
    for (const entry of Object.values(EDITORIAL_SCENES_CATALOG.indagacion_interdisciplinaria_general)) {
      await writeSampleWebp(
        path.join(tmpPublicDir, entry.relativePath.replace(/^\/+/, '')),
        entry.width / 4,
        entry.height / 4,
      );
    }
    // 3) Override específico para UAC piloto `cecbv`
    await writeSampleWebp(
      path.join(tmpPublicDir, 'images', 'escenas', 'overrides', 'cecbv-portada.webp'),
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

    const uniqueIds = new Set(all.map((s) => s.id));
    const uniquePaths = new Set(all.map((s) => s.relativePath));
    expect(uniqueIds.size).toBe(68);
    expect(uniquePaths.size).toBe(68);

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

  it('cumple la matriz de roles exacta: 0 portadas repetidas B1/B2/B3, 0 repeticiones entre M1–M4 y 0 repeticiones en el mismo rol', () => {
    // 1. Portadas de Bloques 1, 2 y 3 del semestre
    const coverB1 = allocateEditorialScene({
      uacName: 'Pensamiento Matemático I',
      blockNumber: 1,
      role: 'block_cover',
      publicDir: tmpPublicDir,
    });
    const coverB2 = allocateEditorialScene({
      uacName: 'Pensamiento Matemático I',
      blockNumber: 2,
      role: 'block_cover',
      publicDir: tmpPublicDir,
    });
    const coverB3 = allocateEditorialScene({
      uacName: 'Pensamiento Matemático I',
      blockNumber: 3,
      role: 'block_cover',
      publicDir: tmpPublicDir,
    });

    expect(coverB1.archetype).toBe('portada');
    expect(coverB2.archetype).toBe('concepto');
    expect(coverB3.archetype).toBe('comunidad');
    expect(new Set([coverB1.id, coverB2.id, coverB3.id]).size).toBe(3);

    // 2. 4 Misiones dentro del mismo bloque: 4 arquetipos distintos y crops diferenciados
    const m1 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_1', publicDir: tmpPublicDir });
    const m2 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_2', publicDir: tmpPublicDir });
    const m3 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_3', publicDir: tmpPublicDir });
    const m4 = allocateEditorialScene({ domainId: 'pensamiento_matematico', blockNumber: 1, role: 'mission_4', publicDir: tmpPublicDir });

    expect(new Set([m1.id, m2.id, m3.id, m4.id]).size).toBe(4);
    expect([m1.crop, m2.crop, m3.crop, m4.crop]).toEqual([
      'top_band',
      'horizontal_editorial',
      'detail_right',
      'full',
    ]);

    // 3. Dedupe dinámico en el mismo rol con tracker
    const tracker = createBlockSceneTracker();
    const firstHero = allocateEditorialScene({
      domainId: 'pensamiento_matematico',
      role: 'slides_hero',
      publicDir: tmpPublicDir,
      tracker,
    });
    const secondHero = allocateEditorialScene({
      domainId: 'pensamiento_matematico',
      role: 'slides_hero',
      publicDir: tmpPublicDir,
      tracker,
    });
    expect(firstHero.id).not.toBe(secondHero.id);
  });

  it('prioriza overrides/ sobre el dominio y cae a indagacion_interdisciplinaria_general si falta el dominio en disco', () => {
    // Prioridad overrides/
    const overrideScene = allocateEditorialSceneOnDisk({
      uacName: 'Coloca elementos constructivos básicos',
      overrideSlug: 'cecbv',
      blockNumber: 1,
      role: 'block_cover',
      publicDir: tmpPublicDir,
    });
    expect(overrideScene).not.toBeNull();
    expect(overrideScene?.source).toBe('override');
    expect(overrideScene?.relativePath).toBe('/images/escenas/overrides/cecbv-portada.webp');

    // Fallback determinista a indagacion_interdisciplinaria_general (literatura no existe en tmpPublicDir)
    const fallbackScene = allocateEditorialSceneOnDisk({
      uacName: 'Pensamiento Literario',
      blockNumber: 1,
      role: 'block_cover',
      publicDir: tmpPublicDir,
    });
    expect(fallbackScene).not.toBeNull();
    expect(fallbackScene?.domainId).toBe('lengua_comunicacion_literatura');
    expect(fallbackScene?.resolvedDomainId).toBe('indagacion_interdisciplinaria_general');
    expect(fallbackScene?.source).toBe('fallback_general');

    // Directorio vacío -> null seguro (cero crashes en Typst mientras no se suben lotes)
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigpda-empty-public-'));
    try {
      const none = allocateEditorialSceneOnDisk({
        uacName: 'Pensamiento Literario',
        blockNumber: 1,
        role: 'block_cover',
        publicDir: emptyDir,
      });
      expect(none).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('habilita .webp en SpotMaterialSchema y EditorialSceneSchema y conecta 3-en-1 (08, 09 y visual-asset-manager)', () => {
    expect(
      SpotMaterialSchema.safeParse({
        nombre: 'Escena de laboratorio',
        archivo: 'bio-01-portada.webp',
        anchoCm: 3.6,
      }).success,
    ).toBe(true);

    // 08 Presentaciones: hero (portada) + concept (concepto), 0 repeticiones
    const deckScenes = resolveSacrintDeckEditorialScenes('Pensamiento Matemático I', 1, {
      publicDir: tmpPublicDir,
    });
    expect(deckScenes.hero?.archetype).toBe('portada');
    expect(deckScenes.concept?.archetype).toBe('concepto');
    expect(deckScenes.hero?.id).not.toBe(deckScenes.concept?.id);

    // 09 Infografías: vertical 4:5 dedicado
    const infoScene = resolveSacrintInfographicEditorialScene('Pensamiento Matemático I', 1, {
      publicDir: tmpPublicDir,
    });
    expect(infoScene?.archetype).toBe('practica');
    expect(infoScene?.aspectRatio).toBe('4:5');

    // visual-asset-manager: 4 misiones distintas del mismo bloque
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
  });

  it('compila un StudentChapter real con coverScene .webp a PDF válido mediante worker-editorial/server.js', async () => {
    const origPublicDir = process.env.PUBLIC_DIR;
    const origUrl = process.env.EDITORIAL_WORKER_URL;
    const origSecret = process.env.EDITORIAL_WORKER_SECRET;
    let server: http.Server | null = null;

    try {
      process.env.PUBLIC_DIR = tmpPublicDir;
      const secret = 'phase2-webp-cover-secret';
      process.env.EDITORIAL_WORKER_SECRET = secret;

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
        publicDir: tmpPublicDir,
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
