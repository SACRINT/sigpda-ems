/**
 * editorial-phase44-rollout-print.test.ts — Pruebas de Aceptación PR 4.4
 *
 * Valida:
 * 1. Política determinista de rollout controlado: Kill-Switch Rollback (`PUBLISHING_ENGINE_V2=false`),
 *    Canary progresivo (10% → 50% → 100% por hash SHA-256 estable), Allowlist QA y Shadow Mode.
 * 2. Compuerta contractual `evaluateLegacyRetirementReadiness` (< 1% fallback, >= 14 días, >= 20 compilaciones, 0 P0).
 * 3. Compilación real en Typst 0.15.1 (`worker-editorial/server.js`) sobre 5 familias epistemológicas
 *    (Matemáticas/STEM, Ciencias Experimentales, Humanidades/Historia, Cultura Digital/TI, Formación Laboral).
 * 4. Edición Imprenta (`printEdition: true`) en Typst real: expansión de caja física Carta + bleed 3mm + slug,
 *    marcas de corte, franja de lomo/CCT y página de Colofón Técnico de Preprensa verificados con `pdfjs-dist`.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  computeCanaryBucket,
  evaluateEditorialRollout,
  evaluateLegacyRetirementReadiness,
} from '@/lib/editorial/rollout-policy';
import { featureFlags } from '@/lib/platform/feature-flags';
import { StudentChapterSchema, type StudentChapter } from '@/lib/editorial/student-content-model';
import { resolveEditorialDisciplinaryUi } from '@/lib/editorial/disciplinary-ui';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import { allocateEditorialSceneOnDisk } from '@/lib/visual-engine/scene-allocator';
import { createNodeSceneFileExists } from '@/lib/visual-engine/scene-allocator-node';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRequest } = require('../../worker-editorial/server.js');

async function inspectPdfPages(pdfBuf: Buffer): Promise<{
  numPages: number;
  page1WidthPt: number;
  page1HeightPt: number;
  fullText: string;
}> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuf),
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const page1 = await doc.getPage(1);
  const vp = page1.getViewport({ scale: 1 });
  const chunks: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p);
    const tc = await pg.getTextContent();
    chunks.push(
      tc.items
        .map((it) => ('str' in it ? String(it.str) : ''))
        .join(' '),
    );
  }
  const result = {
    numPages: doc.numPages,
    page1WidthPt: Math.round(vp.width),
    page1HeightPt: Math.round(vp.height),
    fullText: chunks.join('\n'),
  };
  await loadingTask.destroy();
  return result;
}

function makeFamilyChapter(params: {
  uac: string;
  bloque: string;
  titulo: string;
  objetivo: string;
  motivacion: string;
  teoria: string;
  ejemploEnunciado: string;
  pasos: string[];
  printEdition?: boolean;
}): StudentChapter {
  const fileExists = createNodeSceneFileExists();
  const coverScene = allocateEditorialSceneOnDisk({
    uacName: params.uac,
    blockNumber: 1,
    role: 'block_cover',
    topicText: `${params.bloque} ${params.titulo}`,
    preferPortadaV2: true,
    fileExists,
  });

  return StudentChapterSchema.parse({
    uac: params.uac,
    bloque: params.bloque,
    semestre: '2',
    cicloEscolar: '2026-2027',
    plantel: 'Bachillerato General Estatal Puebla',
    cct: '21EBH0412K',
    zonaEscolar: 'Zona 004',
    disciplinaUi: resolveEditorialDisciplinaryUi(params.uac),
    ...(coverScene ? { coverScene } : {}),
    ...(params.printEdition
      ? {
          printEdition: {
            enabled: true,
            bleedMm: 3,
            cropMarks: true,
            includeColophonSpine: true,
          },
        }
      : {}),
    sesiones: [
      {
        numero: 1,
        titulo: params.titulo,
        objetivo: params.objetivo,
        motivacion: params.motivacion,
        saberesPrevios: 'Recupera en tu cuaderno un ejemplo cercano de tu comunidad escolar.',
        contenido: [{ tipo: 'parrafo', texto: params.teoria }],
        ejemploResuelto: {
          enunciado: params.ejemploEnunciado,
          pasos: params.pasos,
        },
        practica: [
          {
            enunciado: `Aplica los criterios revisados sobre ${params.titulo.toLowerCase()} en un caso breve de tu localidad.`,
            pista: 'Organiza primero los datos clave antes de redactar tu conclusión.',
          },
        ],
        aplicacion: 'Vincula este aprendizaje con el proyecto escolar comunitario PAEC de tu plantel.',
        autoevaluacion: [
          'Identifico el concepto principal y lo explico con claridad.',
          'Aplico el procedimiento paso a paso y valido mi conclusión con evidencia.',
        ],
        recursos: [
          {
            titulo: 'Biblioteca Digital MCCEMS',
            url: 'https://educacionmediasuperior.sep.gob.mx',
            tipo: 'web',
          },
        ],
      },
    ],
  });
}

describe('PR 4.4 — Despliegue Controlado (Shadow/Canary/Rollback), Golden 5 Familias y Edición Imprenta', () => {
  let server: http.Server;
  let workerUrl = '';

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      void handleRequest(req, res);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    workerUrl = `http://127.0.0.1:${port}`;
    vi.stubEnv('EDITORIAL_WORKER_URL', workerUrl);
    vi.stubEnv('EDITORIAL_WORKER_SECRET', 'test-pr44-secret');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    featureFlags.clearAllOverrides();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('política Canary/Shadow/Rollback: determinista por seed, kill-switch instantáneo y allowlist QA', () => {
    // 1. Kill-switch inmediato sin redeploy: PUBLISHING_ENGINE_V2=false → 0% V2
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', false);
    const rolledBack = evaluateEditorialRollout({
      seed: 'teacher-qa-01',
      teacherEmail: 'qa@puebla.edu.mx',
      env: { PUBLISHING_ENGINE_V2_CANARY_PCT: '100', PUBLISHING_ENGINE_V2_ALLOWLIST: 'qa@puebla.edu.mx' },
    });
    expect(rolledBack.useV2).toBe(false);
    expect(rolledBack.decision).toBe('legacy_rollback');

    // 2. Shadow mode: sirve jsPDF clásico sin cobro de cuota mientras ejecuta sombra V2
    featureFlags.setOverride('PUBLISHING_ENGINE_V2', true);
    const shadow = evaluateEditorialRollout({
      seed: 'teacher-shadow-01',
      env: { PUBLISHING_ENGINE_V2_SHADOW: 'true', PUBLISHING_ENGINE_V2_CANARY_PCT: '100' },
    });
    expect(shadow.useV2).toBe(false);
    expect(shadow.shadowMode).toBe(true);
    expect(shadow.decision).toBe('shadow_legacy');

    // 3. Allowlist QA recibe V2 incluso en Canary 0%
    const allowlisted = evaluateEditorialRollout({
      seed: 'teacher-qa-99',
      teacherEmail: 'qa@puebla.edu.mx',
      env: { PUBLISHING_ENGINE_V2_CANARY_PCT: '0', PUBLISHING_ENGINE_V2_ALLOWLIST: 'qa@puebla.edu.mx' },
    });
    expect(allowlisted.useV2).toBe(true);
    expect(allowlisted.decision).toBe('v2_allowlist');

    // 4. Canary progresivo 10% → 50% → 100% es estrictamente monotónico y determinista por seed
    const seeds = Array.from({ length: 200 }, (_, i) => `teacher-canary-${i}`);
    const buckets = seeds.map((s) => computeCanaryBucket(s));
    expect(seeds.map((s) => computeCanaryBucket(s))).toEqual(buckets);

    const v2At10 = seeds.filter((s) => evaluateEditorialRollout({ seed: s, env: { PUBLISHING_ENGINE_V2_CANARY_PCT: '10' } }).useV2).length;
    const v2At50 = seeds.filter((s) => evaluateEditorialRollout({ seed: s, env: { PUBLISHING_ENGINE_V2_CANARY_PCT: '50' } }).useV2).length;
    const v2At100 = seeds.filter((s) => evaluateEditorialRollout({ seed: s, env: { PUBLISHING_ENGINE_V2_CANARY_PCT: '100' } }).useV2).length;

    expect(v2At10).toBeGreaterThan(0);
    expect(v2At10).toBeLessThan(v2At50);
    expect(v2At50).toBeLessThan(v2At100);
    expect(v2At100).toBe(200);
    featureFlags.clearAllOverrides();
  });

  it('compuerta contractual de retiro de jsPDF exige >= 14 días, >= 20 compilaciones, fallback < 1% y 0 P0', () => {
    const tooEarly = evaluateLegacyRetirementReadiness({
      windowDays: 14,
      observedSpanDays: 5,
      totalCompiles: 80,
      typstCount: 30,
      typstCachedCount: 50,
      jspdfFallbackCount: 0,
      jspdfLegacyCount: 0,
      cacheHitRatePct: 62.5,
      fallbackRatePct: 0,
      p95DurationMs: 2400,
    });
    expect(tooEarly.readyToRetireLegacyJsPdf).toBe(false);
    expect(tooEarly.reasons.some((r) => r.includes('Ventana observada'))).toBe(true);

    const highFallback = evaluateLegacyRetirementReadiness({
      windowDays: 14,
      observedSpanDays: 14,
      totalCompiles: 100,
      typstCount: 50,
      typstCachedCount: 48,
      jspdfFallbackCount: 2,
      jspdfLegacyCount: 0,
      cacheHitRatePct: 48.98,
      fallbackRatePct: 2.0,
      p95DurationMs: 2800,
    });
    expect(highFallback.readyToRetireLegacyJsPdf).toBe(false);
    expect(highFallback.reasons.some((r) => r.includes('fallback'))).toBe(true);

    const ready = evaluateLegacyRetirementReadiness(
      {
        windowDays: 14,
        observedSpanDays: 14,
        totalCompiles: 150,
        typstCount: 40,
        typstCachedCount: 109,
        jspdfFallbackCount: 1,
        jspdfLegacyCount: 0,
        cacheHitRatePct: 73.15,
        fallbackRatePct: 0.67,
        p95DurationMs: 2100,
      },
      0,
    );
    expect(ready.readyToRetireLegacyJsPdf).toBe(true);
    expect(ready.reasons).toHaveLength(0);
  });

  it('Golden 5 familias epistemológicas en Typst 0.15.1 real + Edición Imprenta (bleed 3mm, marcas de corte y colofón/lomo)', async () => {
    const families = [
      {
        family: 'STEM/Matemáticas',
        uac: 'Pensamiento Matemático II',
        bloque: 'Bloque 1 · Modelado Lineal',
        titulo: 'Ecuaciones lineales en presupuestos escolares',
        objetivo: 'Modelarás costos fijos y variables mediante ecuaciones lineales.',
        motivacion: 'Organizas el presupuesto para rehabilitar las bancas del patio escolar.',
        teoria: 'Una ecuación lineal expresa una relación proporcional constante entre dos variables reales.',
        ejemploEnunciado: 'Un taller cobra 250 pesos fijos más 40 pesos por banca. Calcula el costo de 6 bancas.',
        pasos: ['Paso 1: Sustituye x = 6 en C = 250 + 40x.', 'Paso 2: C = 250 + 240 = 490 pesos.'],
      },
      {
        family: 'Ciencias Experimentales',
        uac: 'Biología y Conservación Ambiental',
        bloque: 'Bloque 1 · Ecosistemas Locales',
        titulo: 'Fotosíntesis y balance de carbono',
        objetivo: 'Explicarás la transformación de energía lumínica en energía química en plantas locales.',
        motivacion: 'Observas cómo la reforestación en tu plantel reduce la temperatura del patio.',
        teoria: 'Las plantas capturan dióxido de carbono y agua para sintetizar glucosa y liberar oxígeno.',
        ejemploEnunciado: 'Analiza dos plántulas de frijol bajo luz directa y sombra durante siete días.',
        pasos: ['Paso 1: Registra la altura diaria en milímetros.', 'Paso 2: Contrasta la producción foliar entre ambos grupos.'],
      },
      {
        family: 'Humanidades/Sociales',
        uac: 'Conciencia Histórica II',
        bloque: 'Bloque 1 · Fuentes Primarias',
        titulo: 'Análisis crítico de fuentes históricas regionales',
        objetivo: 'Contrastarás fuentes primarias y secundarias sobre transformaciones sociales en Puebla.',
        motivacion: 'En tu comunidad existen fotografías y actas antiguas que narran su historia.',
        teoria: 'Una fuente primaria surge en el momento histórico estudiado y requiere contextualización crítica.',
        ejemploEnunciado: 'Compara un acta ejidal de 1938 con un ensayo historiográfico contemporáneo.',
        pasos: ['Paso 1: Identifica autor, fecha y propósito del documento.', 'Paso 2: Contrasta hechos verificables con interpretaciones posteriores.'],
      },
      {
        family: 'Cultura Digital/TI',
        uac: 'Cultura Digital I',
        bloque: 'Bloque 2 · Ciudadanía y Hojas de Cálculo',
        titulo: 'Fórmulas condicionales y privacidad de datos',
        objetivo: 'Aplicarás funciones lógicas protegiendo datos personales en hojas de cálculo.',
        motivacion: 'Procesas una encuesta estudiantil sin exponer nombres ni datos sensibles.',
        teoria: 'La anonimización y las fórmulas condicionales permiten analizar indicadores cuidando la privacidad.',
        ejemploEnunciado: 'Evalúa si el promedio de estudio semanal de un grupo anónimo supera las 15 horas.',
        pasos: ['Paso 1: Aplica PROMEDIO sobre el rango numérico anónimo.', 'Paso 2: Evalúa la condición con la función SI sin incluir identificadores personales.'],
      },
      {
        family: 'Formación Laboral/Taller',
        uac: 'Formación Laboral Industrial y Taller',
        bloque: 'Bloque 1 · Metrología y Seguridad',
        titulo: 'Medición de precisión con calibrador vernier',
        objetivo: 'Aplicarás normas de seguridad industrial y lectura milimétrica en piezas de taller.',
        motivacion: 'Debes verificar el diámetro exacto de un acople de cobre antes del ensamble.',
        teoria: 'La metrología de taller asegura tolerancias seguras y previene fallas mecánicas.',
        ejemploEnunciado: 'Verifica el diámetro exterior de una tubería de 12.7 mm usando equipo de protección.',
        pasos: ['Paso 1: Coloca lentes de seguridad y limpia las mordazas del calibrador.', 'Paso 2: Toma la lectura principal y confirma la décima en el nonio.'],
      },
    ];

    for (const f of families) {
      const chapter = makeFamilyChapter(f);
      const compiled = await dispatchToEditorialWorker(chapter, {
        timeoutMs: 30000,
        sourceDateEpoch: 0,
      });
      expect(compiled.success, `Falló compilación Typst en ${f.family}`).toBe(true);
      expect(compiled.pdfBuffer.subarray(0, 5).toString('utf8')).toBe('%PDF-');
      const info = await inspectPdfPages(compiled.pdfBuffer);
      expect(info.numPages).toBeGreaterThanOrEqual(3);
      // Formato Carta digital estándar = 612 × 792 pt (±2 pt)
      expect(Math.abs(info.page1WidthPt - 612)).toBeLessThanOrEqual(2);
      expect(Math.abs(info.page1HeightPt - 792)).toBeLessThanOrEqual(2);
      expect(info.fullText).toContain(f.uac);
      expect(info.fullText).toContain('21EBH0412K');
    }

    // Validar modo Edición Imprenta (`printEdition: true`): Carta + 2*(3mm bleed + 6mm slug) = 233.9 × 297.4 mm (≈ 663 × 843 pt)
    const printChapter = makeFamilyChapter({ ...families[0]!, printEdition: true });
    const printCompiled = await dispatchToEditorialWorker(printChapter, {
      timeoutMs: 30000,
      sourceDateEpoch: 0,
    });
    expect(printCompiled.success).toBe(true);
    const printInfo = await inspectPdfPages(printCompiled.pdfBuffer);
    expect(printInfo.page1WidthPt).toBeGreaterThanOrEqual(660);
    expect(printInfo.page1HeightPt).toBeGreaterThanOrEqual(840);
    expect(printInfo.fullText).toContain('COLOFÓN TÉCNICO DE PREPRENSA');
    expect(printInfo.fullText).toMatch(/Sangrado \(Bleed\):\s+3 mm/);
    expect(printInfo.fullText).toContain('Ancho estimado de lomo');
    expect(printInfo.fullText).toContain('21EBH0412K');

    // Invariante de paridad de despliegue: la plantilla raíz y la empaquetada en worker-editorial/ deben coincidir byte a byte
    const rootTpl = fs.readFileSync(path.join(process.cwd(), 'templates', 'editorial', 'workbook-template.typ'), 'utf8');
    const workerTpl = fs.readFileSync(
      path.join(process.cwd(), 'worker-editorial', 'templates', 'editorial', 'workbook-template.typ'),
      'utf8',
    );
    expect(workerTpl).toBe(rootTpl);
  }, 60000);
});
