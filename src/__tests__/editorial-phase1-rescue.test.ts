/**
 * editorial-phase1-rescue.test.ts — Pruebas de Aceptación Fase 1 (Rescate del Libro Editorial)
 *
 * Verifica:
 * 1. Anti-hardcode matemático: Literatura, Inglés, Filosofía y Educación para la Salud NO
 *    renderizan "Modelado Matemático", "con Números" ni "Procedimientos numéricos explícitos"
 *    en PDFs reales compilados con Typst; Pensamiento Matemático sí los conserva.
 * 2. Poblamiento de `materialSpot` (schema real { nombre, archivo, pie, anchoCm } con PNG en disco)
 *    antes de `stripMaterialTokensDeep`, y `sidenote` desde `sintesisVisual.mapaConceptual.definicionClave`
 *    (más fallback determinista sin tokens extra de IA).
 * 3. `GET /health` del worker incluye fuentes cargadas (`fontsDir`, `fontsCount`, `fontsLoaded`).
 * 4. Gate duro `.webp`: `Dockerfile` fija `TYPST_VERSION >= 0.14` (`0.15.1`) y `typst` compila `.webp`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { PDFParse } from 'pdf-parse';
import { resolveEditorialDisciplinaryUi } from '@/lib/editorial/disciplinary-ui';
import {
  StudentChapterSchema,
  adaptSessionPlanToStudentSession,
  type StudentChapter,
} from '@/lib/editorial/student-content-model';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import type { SessionPlan } from '@/types/work-textbook';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRequest, resolveTypstBinary } = require('../../worker-editorial/server.js');

function makeSamplePlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: 'Analizar críticamente un relato contemporáneo identificando narrador, tiempo y conflicto social.',
    motivacion: 'En tu comunidad en Puebla existen crónicas orales que retratan cambios recientes del barrio.',
    saberesPrevios: 'Ya reconoces la diferencia entre un texto informativo y uno literario a partir de tu experiencia lectora.',
    contenido:
      'La narrativa breve organiza el sentido mediante la focalización del narrador y la tensión dramática. Utiliza tu [[material:cuaderno-trabajo]] para registrar evidencias textuales.',
    ejemploResuelto:
      'Lectura guiada del fragmento inicial:\nPaso 1: Identifica el tipo de narrador y la marca temporal dominante.\nPaso 2: Relaciona el conflicto principal con el entorno comunitario del personaje.',
    practica: [
      {
        enunciado: 'Subraya dos marcas de tiempo en el cuento y redacta en tres líneas su efecto narrativo.',
        pista: 'Observa los verbos en pasado y los conectores de simultaneidad.',
      },
    ],
    aplicacion: 'Integra una ficha de análisis a tu antología comunitaria del proyecto PAEC.',
    autoevaluacion: [
      'Identifiqué con precisión la voz narrativa del fragmento.',
      'Justifiqué con citas breves el conflicto central del relato.',
    ],
    recursos: [
      {
        titulo: 'Biblioteca Digital Mexicana — Antología literaria',
        url: 'https://bdmx.mx/',
        tipo: 'lectura',
      },
    ],
    productoIntegrador: 'Ficha analítica del primer relato para la antología comunitaria.',
    sintesisVisual: {
      conceptoBreve: 'Focalización narrativa y conflicto dramático',
      formulaOReglaClave: 'Narrador + Tiempo + Conflicto = Sentido narrativo',
      ejemploBreve: {
        planteamiento: 'Análisis de un microcuento comunitario',
        pasos: ['Ubicar la voz narrativa', 'Identificar el giro del conflicto'],
        conclusion: 'El punto de vista transforma la empatía lectora.',
      },
      mapaConceptual: {
        definicionClave: 'La focalización determina desde qué perspectiva y límites de conocimiento se narra la historia.',
        criterioDesarrollo: 'Respalda cada interpretación con una cita textual exacta.',
        errorComun: 'Confundir al autor real con el narrador ficticio.',
        correccionBreve: 'Distingue siempre la biografía autoral de la instancia narrativa.',
      },
    },
    ...overrides,
  };
}

describe('Fase 1 — Rescate del Libro Editorial (Anti-hardcode, Spot/Sidenote, Health y Gate WebP)', () => {
  let server: http.Server;
  let workerBaseUrl: string;
  const TEST_SECRET = 'phase1-editorial-rescue-secret';
  const origUrl = process.env.EDITORIAL_WORKER_URL;
  const origSecret = process.env.EDITORIAL_WORKER_SECRET;

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server = http.createServer(handleRequest);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') return reject(new Error('No se pudo abrir puerto efímero'));
        workerBaseUrl = `http://127.0.0.1:${addr.port}`;
        process.env.EDITORIAL_WORKER_URL = workerBaseUrl;
        process.env.EDITORIAL_WORKER_SECRET = TEST_SECRET;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (origUrl !== undefined) process.env.EDITORIAL_WORKER_URL = origUrl;
    else delete process.env.EDITORIAL_WORKER_URL;
    if (origSecret !== undefined) process.env.EDITORIAL_WORKER_SECRET = origSecret;
    else delete process.env.EDITORIAL_WORKER_SECRET;

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('asigna encabezados no matemáticos para Literatura, Inglés, Filosofía y Salud, y conserva modelado matemático en Matemáticas', () => {
    const nonMathSubjects = [
      'Pensamiento Literario',
      'Inglés II',
      'Pensamiento Filosófico y Humanidades II',
      'Educación para la Salud',
    ];

    for (const uac of nonMathSubjects) {
      const ui = resolveEditorialDisciplinaryUi(uac);
      expect(ui.labels.conceptHeading).not.toMatch(/Modelado Matemático/i);
      expect(ui.labels.exampleHeading).not.toMatch(/con Números/i);
      expect(ui.labels.methodologyExampleBullet).not.toMatch(/Procedimientos numéricos explícitos/i);
    }

    const mathUi = resolveEditorialDisciplinaryUi('Pensamiento Matemático I');
    expect(mathUi.labels.conceptHeading).toBe('Conceptos Fundamentales y Modelado Matemático');
    expect(mathUi.labels.exampleHeading).toBe('Ejemplo Resuelto con Números: Paso a Paso');
  });

  it('puebla materialSpot (schema real con PNG en disco) ANTES de limpiar [[material:...]] y puebla sidenote desde sintesisVisual', () => {
    const plan = makeSamplePlan({
      contenido:
        'Para medir el tiempo y las etapas del experimento usa tu [[material:microscopio-optico]] con cuidado en el laboratorio.',
    });

    const session = adaptSessionPlanToStudentSession(plan, undefined, {
      uacName: 'Ciencias Naturales, Experimentales y Tecnología I',
    });

    // Tokens removidos del texto visible del estudiante
    expect(JSON.stringify(session.contenido)).not.toContain('[[material:');

    // materialSpot poblado con el schema REAL { nombre, archivo, pie, anchoCm }
    expect(session.materialSpot).toBeDefined();
    expect(session.materialSpot?.archivo).toBe('microscopio-optico.png');
    expect(session.materialSpot?.nombre).toBeTruthy();
    expect(session.materialSpot?.anchoCm).toBeLessThanOrEqual(4.2);

    const pngPath = path.join(process.cwd(), 'public', 'images', 'materiales', session.materialSpot!.archivo);
    expect(fs.existsSync(pngPath)).toBe(true);

    // sidenote poblado desde sintesisVisual.mapaConceptual.definicionClave
    expect(session.sidenote).toContain('La focalización determina');

    // Fallback determinista cuando no existe sintesisVisual
    const withoutSynth = adaptSessionPlanToStudentSession(
      makeSamplePlan({ sintesisVisual: undefined }),
      undefined,
      { uacName: 'Pensamiento Literario' },
    );
    expect(withoutSynth.sidenote).toBeTruthy();
    expect(withoutSynth.sidenote!.length).toBeGreaterThanOrEqual(15);
  });

  it('compila PDF real en Typst para Literatura sin textos matemáticos hardcodeados y con materialSpot + sidenote visibles', async () => {
    const plan = makeSamplePlan({
      contenido:
        'Registra tu análisis narrativo y las citas textuales con [[material:lupa-campo]] sobre copias de archivo comunitario.',
    });
    const session = adaptSessionPlanToStudentSession(plan, undefined, {
      uacName: 'Pensamiento Literario',
    });

    const chapter: StudentChapter = StudentChapterSchema.parse({
      uac: 'Pensamiento Literario',
      bloque: 'Bloque 1',
      semestre: '4',
      cicloEscolar: '2026-2027',
      plantel: 'Bachillerato General Oficial Héroes de la Patria',
      cct: '21EBH0123A',
      zonaEscolar: 'Zona 004',
      disciplinaUi: resolveEditorialDisciplinaryUi('Pensamiento Literario'),
      sesiones: [session],
    });

    const result = await dispatchToEditorialWorker(chapter, {
      sourceDateEpoch: 0,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('remote_worker');
    expect(result.pdfBuffer).toBeDefined();

    const parser = new PDFParse({ data: result.pdfBuffer! });
    const parsed = await parser.getText();
    await parser.destroy();
    const pdfText = parsed.text;

    expect(pdfText).not.toMatch(/Modelado Matemático/i);
    expect(pdfText).not.toMatch(/Ejemplo Resuelto con Números/i);
    expect(pdfText).not.toMatch(/Procedimientos numéricos explícitos/i);
    expect(pdfText).toMatch(/Fundamentos Textuales y Análisis Comunicativo/i);
    expect(pdfText).toMatch(/Ejemplo Comentado y Analizado/i);
    expect(pdfText).toMatch(/La focalización determina/i);
  });

  it('expone fontsDir, fontsCount y fontsLoaded en GET /health del worker', async () => {
    const res = await fetch(`${workerBaseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.typstVersion).toContain('typst');
    expect(typeof body.fontsDir).toBe('string');
    expect(typeof body.fontsCount).toBe('number');
    expect(Array.isArray(body.fontsLoaded)).toBe(true);
  });

  it('cumple gate duro .webp: Dockerfile >= Typst 0.14 (0.15.1) y Typst local compila .webp a PDF válido', async () => {
    const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
    const verMatch = dockerfile.match(/TYPST_VERSION=(\d+)\.(\d+)\.(\d+)/);
    expect(verMatch).not.toBeNull();
    const minor = Number(verMatch![2]);
    expect(minor).toBeGreaterThanOrEqual(14);

    const typstBin = resolveTypstBinary();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigpda-webp-gate-'));
    try {
      const webpPath = path.join(tmpDir, 'scene.webp');
      await sharp({
        create: { width: 160, height: 90, channels: 3, background: { r: 18, g: 59, b: 93 } },
      })
        .webp({ quality: 88 })
        .toFile(webpPath);

      const typPath = path.join(tmpDir, 'entry.typ');
      const pdfPath = path.join(tmpDir, 'out.pdf');
      fs.writeFileSync(
        typPath,
        '#set page(width: 10cm, height: 10cm)\n#image("scene.webp", width: 8cm)\n',
        'utf8',
      );
      execFileSync(typstBin, ['compile', typPath, pdfPath], { stdio: 'pipe' });
      expect(fs.statSync(pdfPath).size).toBeGreaterThan(1000);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
