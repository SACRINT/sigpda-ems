/**
 * editorial-phase3-parity.test.ts — Pruebas de Aceptación Fase 3 (`PUBLISHING_ENGINE_V2`)
 *
 * Valida de punta a punta:
 * 1. Paridad 72/72 sesiones sin falsos 422 + extracción de `missions`, `projectSections` y
 *    `evaluationSections` (con 0 fugas de clave docente `answerExplanation`).
 * 2. Enriquecedor V2: diagramas SVG STEM puros (`dispatchVisual`), QR deterministas en SVG
 *    (`QRCode`) y espacios de Cuaderno Activo diferenciados por familia epistemológica.
 * 3. Compilación PDF real en Typst `0.15.1` (vía `worker-editorial/server.js`) con los
 *    componentes modulares (`mission-banner`, `active-workbook`, `project-section`, `evaluation-section`)
 *    y las **68 escenas `.webp` reales** en `public/images/escenas/`.
 * 4. Prueba real de `08` (SVG + PPTX) y `09` (SVG + PDF XObject) consumiendo las escenas `.webp`
 *    reales del repositorio en `public/images/escenas/`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import { featureFlags } from '@/lib/platform/feature-flags';
import { listAllEditorialScenes } from '@/lib/visual-engine/editorial-scenes-catalog';
import {
  createNodeSceneFileExists,
  createNodeSceneLoader,
} from '@/lib/visual-engine/scene-allocator-node';
import { composeStudentSessionsFromWorkbooks } from '@/lib/editorial/compose-student-sessions';
import { resolveEditorialDisciplinaryUi } from '@/lib/editorial/disciplinary-ui';
import {
  buildActiveSpacesForSession,
  enrichEditorialSessionsV2,
} from '@/lib/editorial/editorial-v2-enricher';
import {
  StudentChapterSchema,
  type StudentChapter,
} from '@/lib/editorial/student-content-model';
import { dispatchToEditorialWorker } from '@/lib/editorial/worker-client';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck, buildSacrintInfographic } from '@/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderInfographicSvg } from '@/lib/visual-engine/sacrint/infographic-renderer';
import { renderCombinedSacrintInfographicsPdf } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import type { EvaluationSection, ProjectSection, SessionPlan } from '@/types/work-textbook';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleRequest } = require('../../worker-editorial/server.js');

function makeSessionPlan(n: number, blockNum: number): SessionPlan {
  return {
    sessionNumber: n,
    objetivo: `Aplicar funciones lineales para modelar costos reales de producción comunitaria en el bloque ${blockNum}, sesión ${n}.`,
    motivacion: `En tu plantel de Puebla se busca optimizar el presupuesto escolar para el taller del bloque ${blockNum} (sesión ${n}).`,
    saberesPrevios: 'Ya manejas operaciones con razones, porcentajes y representación de pares ordenados en el plano.',
    contenido: `Una función lineal y = mx + b describe relaciones de variación constante entre variables en el caso ${n}. Usa tu [[material:calculadora-cientifica]] para validar pendientes.`,
    ejemploResuelto:
      'Calcula el costo de producir 15 cuadernos si el costo fijo es 120 y cada unidad cuesta 18:\nPaso 1: Sustituye x = 15 en C(x) = 18x + 120.\nPaso 2: Obtén C(15) = 270 + 120 = 390 pesos.',
    practica: [
      {
        enunciado: `Determina el valor de C(20) para la función C(x) = ${12 + n}x + 100 e interpreta la pendiente.`,
        pista: 'Multiplica primero el coeficiente unitario por 20 y suma el costo fijo.',
      },
    ],
    aplicacion: `Integra la tabla de costos de la sesión ${n} al presupuesto del proyecto comunitario PAEC.`,
    autoevaluacion: [
      'Identifico correctamente la pendiente y la ordenada al origen del modelo.',
      'Interpreto el resultado numérico con sus unidades en el contexto escolar.',
    ],
    recursos: [
      {
        titulo: 'GeoGebra — Funciones lineales interactivas',
        url: 'https://www.geogebra.org/calculator',
        tipo: 'web',
      },
    ],
    productoIntegrador: `Hoja de cálculo de presupuesto parcial #${n} para la feria comunitaria.`,
    sintesisVisual: {
      conceptoBreve: 'Función lineal y razón de cambio constante',
      formulaOReglaClave: 'y = mx + b',
      ejemploBreve: {
        planteamiento: 'Costo de producción con tarifa fija',
        pasos: ['Identificar pendiente m', 'Evaluar en x = 15'],
        conclusion: 'Cada unidad adicional aumenta el costo en m pesos.',
      },
      mapaConceptual: {
        definicionClave: 'La pendiente m representa la tasa de cambio constante de y respecto a x.',
        criterioDesarrollo: 'Verifica siempre las unidades de ambos ejes.',
        errorComun: 'Intercambiar la pendiente por la ordenada al origen.',
        correccionBreve: 'La ordenada b es el valor cuando x = 0.',
      },
    },
  };
}

function makeBlockWorkbook(blockIndex: number, sessionsPerMission: number) {
  const blockNumber = blockIndex + 1;
  const missions = [0, 1, 2, 3].map((mIdx) => {
    const startLocal = mIdx * sessionsPerMission + 1;
    const sessionPlans = Array.from({ length: sessionsPerMission }, (_, offset) =>
      makeSessionPlan(startLocal + offset, blockNumber),
    );
    return {
      missionIndex: mIdx + 1,
      title: `Modelación Lineal Aplicada B${blockNumber}-M${mIdx + 1}`,
      realLifeConnection: {
        context: `Análisis de costos de un microemprendimiento estudiantil en bloque ${blockNumber}.`,
        householdApplication: 'Comparar recibos domésticos de energía y agua.',
        communityImpact: 'Presupuesto transparente para la cooperativa escolar.',
      },
      metacognitiveTrafficLight: {
        green: 'Modelo e interpreto funciones lineales de forma autónoma.',
        yellow: 'Aplico la fórmula pero necesito apoyo interpretando la gráfica.',
        red: 'Requiero repasar plano cartesiano y despejes básicos.',
      },
      sessionPlans,
    };
  });

  const projectSection: ProjectSection = {
    artifactName: `Prototipo Financiero Comunitario Bloque ${blockNumber}`,
    communityUtility: 'Permite proyectar ingresos, costos fijos y punto de equilibrio en proyectos escolares PAEC.',
    requiredMaterials: ['[[material:calculadora-cientifica]]', 'Hojas milimétricas', 'Bitácora de equipo'],
    phases: [
      {
        phaseNum: 1,
        title: 'Levantamiento de costos reales',
        allocatedHours: 4,
        deliverables: ['Tabla de insumos y precios locales'],
        instructions: 'Cotiza en al menos dos comercios de tu localidad y registra promedios.',
      },
      {
        phaseNum: 2,
        title: 'Modelación y validación gráfica',
        allocatedHours: 4,
        deliverables: ['Gráfica de punto de equilibrio'],
        instructions: 'Construye el modelo lineal y contrasta dos escenarios de demanda.',
      },
    ],
    technicalSpecs: ['Escala consistente en ejes cartesianos', 'Unidades monetarias explícitas en cada tabla'],
    acceptanceCriteria: ['Cálculo verificado sin errores aritméticos', 'Interpretación clara para familias'],
  };

  const evaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Modelación algebraica y gráfica',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 50, descriptor: 'Formula, grafica e interpreta con precisión total.' },
          { levelName: 'Bueno', points: 40, descriptor: 'Formula y grafica correctamente con leve imprecisión.' },
          { levelName: 'Suficiente', points: 30, descriptor: 'Aplica el modelo con apoyo guiado.' },
          { levelName: 'Requiere Apoyo', points: 15, descriptor: 'Presenta errores al identificar pendiente u ordenada.' },
        ],
      },
      {
        criterion: 'Aplicación comunitaria PAEC',
        weightPercent: 50,
        levels: [
          { levelName: 'Excelente', points: 50, descriptor: 'Vincula evidencia real del entorno con propuesta viable.' },
          { levelName: 'Bueno', points: 40, descriptor: 'Integra datos locales relevantes.' },
          { levelName: 'Suficiente', points: 30, descriptor: 'Menciona el contexto sin análisis cuantitativo completo.' },
          { levelName: 'Requiere Apoyo', points: 15, descriptor: 'Omite la vinculación comunitaria.' },
        ],
      },
    ],
    checklist: [
      { item: 'Incluye tabla de valores con al menos 5 pares ordenados.', category: 'Procedimiento' },
      { item: 'Comprueba el punto de equilibrio en el contexto escolar.', category: 'Interpretación' },
    ],
    criticalThinkingQuiz: [
      {
        questionNumber: 1,
        scenario: 'Una cooperativa escolar duplica su costo fijo mensual manteniendo igual el costo unitario.',
        question: '¿Cómo cambia la gráfica de la función de costo total?',
        options: ['Se desplaza verticalmente hacia arriba', 'Cambia su pendiente al doble', 'Se vuelve horizontal'],
        answerExplanation: 'CLAVE_DOCENTE_SECRETA_NO_DEBE_APARECER_EN_LIBRO_ESTUDIANTE',
      },
    ],
    metacognitiveReflection: {
      prompts: [
        '¿Qué estrategia te ayudó más a detectar errores en tus cálculos?',
        '¿Cómo aplicarías un modelo lineal en las finanzas de tu hogar?',
      ],
    },
  };

  return {
    current: {
      blockName: `Bloque ${blockNumber} (Corte ${blockNumber})`,
      missions,
      projectSection,
      evaluationSection,
    },
  };
}

describe('Fase 3 — Paridad Total ActiveWorkTextbook → Typst (PUBLISHING_ENGINE_V2) + 68 Escenas Reales', () => {
  let server: http.Server;
  let workerBaseUrl: string;
  const origUrl = process.env.EDITORIAL_WORKER_URL;
  const origSecret = process.env.EDITORIAL_WORKER_SECRET;

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server = http.createServer(handleRequest);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') return reject(new Error('Puerto efímero inválido'));
        workerBaseUrl = `http://127.0.0.1:${addr.port}`;
        process.env.EDITORIAL_WORKER_URL = workerBaseUrl;
        process.env.EDITORIAL_WORKER_SECRET = 'phase3-parity-secret';
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

  it('confirma los 68 archivos .webp reales en public/images/escenas/ y el flag PUBLISHING_ENGINE_V2', () => {
    expect(featureFlags.evaluate('PUBLISHING_ENGINE_V2').source).toBe('default');
    const all = listAllEditorialScenes();
    expect(all).toHaveLength(68);
    const missing = all.filter(
      (s) => !fs.existsSync(path.join(process.cwd(), 'public', s.relativePath.replace(/^\/+/, ''))),
    );
    expect(missing).toEqual([]);
  });

  it('compone 72/72 sesiones sin 422 y proyecta 12 misiones, 3 projectSections y 3 evaluationSections sin clave docente', () => {
    const rawPlanning = {
      uac_name: 'Pensamiento Matemático I',
      workbooks_json: {
        block_0: makeBlockWorkbook(0, 6), // 24 sesiones
        block_1: makeBlockWorkbook(1, 6), // 24 sesiones
        block_2: makeBlockWorkbook(2, 6), // 24 sesiones
      },
    };

    const composed = composeStudentSessionsFromWorkbooks(rawPlanning, {
      sceneFileExists: createNodeSceneFileExists(),
    });

    expect(composed.totalPlans).toBe(72);
    expect(composed.dropped).toEqual([]);
    expect(composed.sessions).toHaveLength(72);
    expect(composed.missions).toHaveLength(12);
    expect(composed.projectSections).toHaveLength(3);
    expect(composed.evaluationSections).toHaveLength(3);

    // Verificar rangos de cierre de bloque: 24, 48, 72
    expect(composed.projectSections.map((p) => p.afterSession)).toEqual([24, 48, 72]);
    expect(composed.evaluationSections.map((e) => e.afterSession)).toEqual([24, 48, 72]);

    // Verificar 0 fugas de clave docente (`answerExplanation`)
    expect(JSON.stringify(composed.evaluationSections)).not.toContain(
      'CLAVE_DOCENTE_SECRETA_NO_DEBE_APARECER_EN_LIBRO_ESTUDIANTE',
    );
    // Verificar que las misiones recibieron escenas reales .webp del disco
    expect(composed.missions[0].scene?.relativePath).toBe(
      '/images/escenas/pensamiento_matematico/mat-02-concepto.webp',
    );
  });

  it('genera espacios de Cuaderno Activo diferenciados por disciplina y compila un libro V2 completo en Typst con SVG STEM, QR, Misiones, Proyecto y Rúbrica', async () => {
    const rawPlanning = {
      uac_name: 'Pensamiento Matemático I',
      workbooks_json: {
        block_0: makeBlockWorkbook(0, 1), // 4 sesiones (1 por misión) + Proyecto + Evaluación
      },
    };

    const composed = composeStudentSessionsFromWorkbooks(rawPlanning, {
      sceneFileExists: createNodeSceneFileExists(),
    });

    // Verificar diferenciación de Cuaderno Activo por familia epistemológica
    const tiSpaces = buildActiveSpacesForSession('Cultura Digital I', composed.sessions[0]);
    expect(tiSpaces.some((s) => s.kind === 'code_box')).toBe(true);
    const litSpaces = buildActiveSpacesForSession('Pensamiento Literario', composed.sessions[0]);
    expect(litSpaces.some((s) => s.kind === 'writing_lines')).toBe(true);
    expect(litSpaces.some((s) => s.kind === 'code_box')).toBe(false);

    const enrichedSessions = await enrichEditorialSessionsV2({
      uacName: 'Pensamiento Matemático I',
      sessions: composed.sessions,
      missions: composed.missions,
    });

    expect(enrichedSessions[0].embeddedDiagram?.svg).toContain('<svg');
    expect(enrichedSessions[0].digitalToolQr?.svg).toContain('<svg');
    expect(enrichedSessions[0].activeSpaces?.some((s) => s.kind === 'data_table')).toBe(true);

    const chapter: StudentChapter = StudentChapterSchema.parse({
      uac: 'Pensamiento Matemático I',
      bloque: 'Bloque 1 (Corte 1)',
      semestre: '1',
      cicloEscolar: '2026-2027',
      plantel: 'Bachillerato General Oficial Héroes de la Patria',
      cct: '21EBH0123A',
      zonaEscolar: 'Zona 004',
      disciplinaUi: resolveEditorialDisciplinaryUi('Pensamiento Matemático I'),
      coverScene: {
        id: 'mat-01-portada',
        domainId: 'pensamiento_matematico',
        archetype: 'portada',
        role: 'block_cover',
        crop: 'full',
        relativePath: '/images/escenas/pensamiento_matematico/mat-01-portada.webp',
        alt: 'Estudiantes aplicando medición geométrica en el patio escolar',
        aspectRatio: '16:9',
      },
      missions: composed.missions,
      projectSections: composed.projectSections,
      evaluationSections: composed.evaluationSections,
      sesiones: enrichedSessions,
    });

    const result = await dispatchToEditorialWorker(chapter, {
      sourceDateEpoch: 0,
      timeoutMs: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.source).toBe('remote_worker');
    expect(result.pdfBuffer).toBeDefined();
    expect(result.pageCount).toBeGreaterThanOrEqual(7);

    const parser = new PDFParse({ data: result.pdfBuffer! });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = parsed.text;

    expect(text).toMatch(/CONCEPTO CERO/i);
    expect(text).toMatch(/PROYECTO INTEGRADOR COMUNITARIO/i);
    expect(text).toMatch(/Prototipo Financiero Comunitario Bloque 1/i);
    expect(text).toMatch(/Rúbrica Analítica de Desempeño/i);
    expect(text).toMatch(/Lista de Cotejo de Evidencias/i);
    expect(text).toMatch(/Herramienta Digital/i);
    expect(text).not.toContain('CLAVE_DOCENTE_SECRETA_NO_DEBE_APARECER_EN_LIBRO_ESTUDIANTE');
  });

  it('prueba real de 08 (SVG/PPTX) y 09 (SVG/PDF) consumiendo las 68 escenas .webp reales de public/images/escenas/', async () => {
    const loader = createNodeSceneLoader();

    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, {
      missionIndex: 0,
      mode: 'full',
      ...loader,
    });
    expect(deck.editorialScenes?.hero?.relativePath).toBe(
      '/images/escenas/pensamiento_matematico/mat-01-portada.webp',
    );
    const coverSvg = renderDeckSvgs(deck).find((s) => s.kind === 'cover')?.svg ?? '';
    expect(coverSvg).toContain('<image href="data:image/webp;base64,');

    const pptxBuf = await generateSacrintPptx(deck);
    const zip = await JSZip.loadAsync(pptxBuf);
    expect(Object.keys(zip.files).some((f) => f.startsWith('ppt/media/'))).toBe(true);

    const info = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'wide', {
      missionIndex: 0,
      ...loader,
    });
    expect(info.editorialScene?.relativePath).toBe(
      '/images/escenas/pensamiento_matematico/mat-03-practica.webp',
    );
    expect(renderInfographicSvg(info)).toContain('<image href="data:image/webp;base64,');
    const pdfBuf = await renderCombinedSacrintInfographicsPdf([info], 'wide');
    expect(pdfBuf.toString('latin1')).toContain('/Subtype /Image');

    // P2: las portadas 08 rotan entre los 3 arquetipos 16:9 por misión sin tocar `practica` (4:5)
    const deckM2 = buildSacrintDeck(MATH_DEMO_WORKBOOK, { missionIndex: 1, mode: 'full', ...loader });
    const deckM3 = buildSacrintDeck(MATH_DEMO_WORKBOOK, { missionIndex: 2, mode: 'full', ...loader });
    expect(deckM2.editorialScenes?.hero?.archetype).toBe('concepto');
    expect(deckM3.editorialScenes?.hero?.archetype).toBe('comunidad');
    expect(deckM2.editorialScenes?.hero?.aspectRatio).toBe('16:9');
    expect(deckM3.editorialScenes?.hero?.aspectRatio).toBe('16:9');
  });

  it('Hotfix 4.1.1 (P0 + P1): Cultura Digital I en V2 produce 0 Planos Cartesianos, 0 Misión 0, 0 HIIT/Tabata e inyecta <text> vectoriales en SVG compilable en Typst', async () => {
    const fileExists = createNodeSceneFileExists();
    const cdWorkbook = makeBlockWorkbook(0, 1);
    cdWorkbook.current.missions[0]!.title = 'Hardware y software en sistemas digitales';
    cdWorkbook.current.missions[0]!.sessionPlans![0]!.objetivo =
      'Analizar la arquitectura de hardware, software y gestión del tiempo de activación del sistema.';
    cdWorkbook.current.missions[1]!.title = 'Algoritmos y diagramas de flujo';
    cdWorkbook.current.missions[2]!.title = 'Ciudadanía digital y protección de datos';

    const composed = composeStudentSessionsFromWorkbooks(
      {
        uac_name: 'Cultura Digital I',
        workbooks_json: { block_0: cdWorkbook },
      },
      { sceneFileExists: fileExists },
    );

    const enriched = await enrichEditorialSessionsV2({
      uacName: 'Cultura Digital I',
      sessions: composed.sessions,
      missions: composed.missions,
    });

    for (const s of enriched) {
      if (s.embeddedDiagram) {
        expect(s.embeddedDiagram.caption).not.toMatch(/plano\s+cartesiano/i);
        expect(s.embeddedDiagram.caption).not.toContain('Misión 0');
        expect(s.embeddedDiagram.svg).not.toMatch(/plano\s+cartesiano/i);
        expect(s.embeddedDiagram.svg).toContain('<text ');
      }
      if (s.digitalToolQr) {
        expect(s.digitalToolQr.name).not.toMatch(/HIIT|Tabata|Kinovea|BioDigital/i);
      }
    }

    expect(enriched[0]?.embeddedDiagram?.caption).toContain('Misión 1');
    expect(enriched[1]?.embeddedDiagram?.caption).toContain('Misión 2');
    expect(enriched[2]?.embeddedDiagram?.caption).toContain('Misión 3');

    // Compilación real con Typst 0.15.1 para validar que los <text> SVG compilan sin errores de fuentes
    const chapter = StudentChapterSchema.parse({
      uac: 'Cultura Digital I',
      bloque: 'Bloque 1',
      editorialSubtitle: 'Verificación Hotfix 4.1.1 Cultura Digital MCCEMS',
      semestre: '1',
      cicloEscolar: '2026-2027',
      plantel: 'Bachillerato General Estatal Puebla',
      cct: '21EBH0123A',
      zonaEscolar: 'Zona 086',
      disciplinaUi: resolveEditorialDisciplinaryUi('Cultura Digital I'),
      missions: composed.missions,
      sesiones: enriched,
    });
    const compiled = await dispatchToEditorialWorker(chapter, { sourceDateEpoch: 0 });
    expect(compiled.success).toBe(true);
    expect(compiled.pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');

    const parser = new PDFParse({ data: new Uint8Array(compiled.pdfBuffer) });
    const parsedText = (await parser.getText()).text;
    await parser.destroy();
    expect(parsedText).not.toMatch(/Plano\s+Cartesiano/i);
    expect(parsedText).not.toContain('Misión 0');
    expect(parsedText).not.toMatch(/HIIT|Tabata/i);
    expect(parsedText).not.toContain('Estructura Social');
  });
});
