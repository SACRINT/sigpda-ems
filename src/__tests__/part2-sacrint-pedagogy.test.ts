import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import sharp from 'sharp';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import {
  buildSacrintDeck,
  buildSacrintDecksForWorkbook,
  buildSacrintInfographic,
} from '@/lib/visual-engine/sacrint/spec';
import { buildSacrintDiagram, diagramModelLabel } from '@/lib/visual-engine/sacrint/diagrams';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { renderInfographicSvg } from '@/lib/visual-engine/sacrint/infographic-renderer';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderInfographicPng } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { INFOGRAPHIC } from '@/lib/visual-engine/sacrint/tokens';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';

function buildMultiTopicWorkbook(): ActiveWorkTextbook {
  const wb = structuredClone(MATH_DEMO_WORKBOOK);
  wb.coverData.subjectName = 'Pensamiento Matemático III';
  wb.coverData.blockNumber = 2;
  wb.missions![0]!.title = 'Sesión 22: Optimización y Consolidación de la Evidencia — Modelación Algebraica';
  wb.missions![0]!.sessionTopic = 'Sesión 22: Optimización y Consolidación de la Evidencia — Ecuaciones y Modelos';
  wb.missions![0]!.conceptZero.solvedExample = {
    problemStatement: '',
    solutionSteps: [],
    interpretation: '',
  };
  wb.missions![0]!.iDoSection.stepByStepDemo =
    '### Rúbrica Analítica Oficial NEM\nCriterio: Participación Ponderación: 20% Excelente (40 pts) [[material:ecuacion-lineal]]';
  wb.missions![0]!.weDoSection.guidedPractice =
    'Resuelve los ejercicios en tu cuaderno [[material:ecuacion-lineal]].';
  wb.missions![0]!.youDoSection.autonomousChallenge =
    'Fases del proyecto formativo: aplica las ecuaciones a tu huerto comunitario. [[material:huerto]]';

  const sessions: SessionPlan[] = [
    {
      sessionNumber: 1,
      objetivo: 'Modelar costos lineales con ecuaciones de primer grado como 350x + 1500 = 5300',
      motivacion: 'Un emprendedor paga $1500 de renta fija y $350 por cada lote producido.',
      saberesPrevios: 'Ya sabes despejar una incógnita sumando y restando en ambos lados.',
      contenido:
        'Una **ecuación lineal** tiene la forma `ax + b = c`, donde `a` es la razón de cambio por unidad y `b` el costo fijo inicial.\n\nPara despejar, aplica operaciones inversas simétricas en ambos lados de la igualdad.',
      ejemploResuelto:
        'Problema: Con un presupuesto total de $5300, renta de $1500 y $350 por lote (`350x + 1500 = 5300`), calcula lotes `x`.\n1. Resta 1500 en ambos lados: 350x = 3800.\n2. Divide entre 350: x = 10.86 lotes (máximo 10 completos).',
      practica: [
        {
          enunciado: 'Una papelería cobra $200 fijos más $25 por engargolado. ¿Cuántos engargolados alcanzan con $950?',
          pista: 'Plantea 25x + 200 = 950 y resta 200 primero.',
          solucion: ['SECRET_ANSWER_KEY_DO_NOT_LEAK_LINEAR: x = 30'],
        },
        {
          enunciado: 'Verifica qué ocurre con el costo si se producen 6 lotes en el taller.',
          pista: 'Sustituye x = 6 en C(x) = 350x + 1500.',
          solucion: ['SECRET_ANSWER_KEY_DO_NOT_LEAK_LINEAR_2: 3600'],
        },
      ],
      aplicacion: 'Sirve para calcular puntos de equilibrio y presupuestos mensuales en comercios locales.',
      autoevaluacion: ['Identifico pendiente y ordenada al origen en un problema real.'],
      recursos: [],
      productoIntegrador: 'Tabla de costos fijos y variables del proyecto escolar.',
    },
    {
      sessionNumber: 2,
      objetivo: 'Resolver sistemas de ecuaciones lineales 2x2 para hallar puntos de equilibrio',
      motivacion: 'Dos tarifas de transporte compiten por el mismo recorrido escolar.',
      saberesPrevios: 'Cada ecuación lineal representa una recta en el plano cartesiano.',
      contenido:
        'Un sistema de ecuaciones 2x2 combina dos rectas simultáneas: `2x + 3y = 12` y `x - y = 1`. El punto `(x, y)` donde se cruzan satisface ambas condiciones.',
      ejemploResuelto:
        'Resuelve el sistema 2x + 3y = 12 | x - y = 1.\n1. Despeja x en la segunda: x = y + 1.\n2. Sustituye en la primera: 2(y + 1) + 3y = 12 -> 5y = 10 -> y = 2.\n3. Halla x = 2 + 1 = 3. Solución: (3, 2).',
      practica: [
        {
          enunciado: 'Resuelve el sistema x + y = 10 y x - y = 2 por sustitución.',
          pista: 'Despeja x = y + 2 y reemplaza en la suma.',
          solucion: ['SECRET_ANSWER_KEY_DO_NOT_LEAK_SYSTEM: (6, 4)'],
        },
      ],
      aplicacion: 'Se aplica al comparar planes de telefonía, mezclas químicas y equilibrio oferta-demanda.',
      autoevaluacion: ['Verifico que el par (x, y) cumple ambas ecuaciones simultáneamente.'],
      recursos: [],
      productoIntegrador: 'Comparativo gráfico de dos proveedores para la cooperativa.',
    },
    {
      sessionNumber: 3,
      objetivo: 'Modelar superficies y optimizar áreas mediante ecuaciones cuadráticas 2x² + 5x - 300 = 0',
      motivacion: 'Necesitamos cercar un huerto rectangular comunitario con área exacta de 300 m².',
      saberesPrevios: 'El área de un rectángulo multiplica largo por ancho, generando un término al cuadrado.',
      contenido:
        'Una **ecuación cuadrática** completa es `ax² + bx + c = 0` cuya gráfica es una parábola.\n\nSu vértice indica el punto extremo y las raíces reales muestran dónde corta el eje horizontal.',
      ejemploResuelto:
        'Resuelve 2x² + 5x - 300 = 0.\n1. Identifica a = 2, b = 5, c = -300.\n2. Calcula el discriminante Δ = 25 + 2400 = 2425.\n3. Toma la raíz positiva: x ≈ 11.06 m.',
      practica: [
        {
          enunciado: 'Resuelve x² - 9 = 0 e interpreta la solución geométrica positiva.',
          pista: 'Factoriza como diferencia de cuadrados (x - 3)(x + 3) = 0.',
          solucion: ['SECRET_ANSWER_KEY_DO_NOT_LEAK_QUAD: x = 3'],
        },
      ],
      aplicacion: 'Se emplea en arquitectura rural, trayectorias parabólicas y maximización de áreas.',
      autoevaluacion: ['Evalúo el discriminante e interpreto solo las raíces con sentido físico.'],
      recursos: [],
      productoIntegrador: 'Plano optimizado del huerto con sus dimensiones máximas.',
    },
  ];

  wb.missions![0]!.sessionPlans = sessions;
  return wb;
}

describe('SACRINT Part 2 — Pedagogical Redesign & Diagram Authenticity', () => {
  it('renders dedicated authentic math models instead of flattening to MODELO LINEAL or rescaling coefficients', () => {
    const wb = buildMultiTopicWorkbook();
    const pack = resolveSacrintPack(wb.coverData.subjectName, wb.subsystem);
    const mission = wb.missions![0]!;

    const linearDiag = buildSacrintDiagram(mission, pack, { session: mission.sessionPlans![0] });
    expect(linearDiag.kind).toBe('linear');
    if (linearDiag.kind === 'linear') {
      expect(linearDiag.slope).toBe(350);
      expect(linearDiag.intercept).toBe(1500);
      expect(linearDiag.targetY).toBe(5300);
      expect(linearDiag.rangeMax).toBeGreaterThanOrEqual(5300);
    }

    const sysDiag = buildSacrintDiagram(mission, pack, { session: mission.sessionPlans![1] });
    expect(sysDiag.kind).toBe('system-2x2');
    expect(diagramModelLabel(sysDiag)).toBe('Sistema lineal 2×2');
    if (sysDiag.kind === 'system-2x2') {
      expect(sysDiag.intersection?.x).toBeCloseTo(3, 2);
      expect(sysDiag.intersection?.y).toBeCloseTo(2, 2);
    }

    const quadDiag = buildSacrintDiagram(mission, pack, { session: mission.sessionPlans![2] });
    expect(quadDiag.kind).toBe('quadratic');
    expect(diagramModelLabel(quadDiag)).toBe('Modelo cuadrático');
    if (quadDiag.kind === 'quadratic') {
      expect(quadDiag.a).toBe(2);
      expect(quadDiag.b).toBe(5);
      expect(quadDiag.c).toBe(-300);
      expect(quadDiag.roots.some((r) => Math.abs(r - 11.06) < 0.15)).toBe(true);
      expect(quadDiag.samples.length).toBeGreaterThanOrEqual(20);
    }

    const expSession: SessionPlan = {
      sessionNumber: 4,
      objetivo: 'Analizar crecimiento exponencial e interés compuesto con tasa del 12% anual',
      motivacion: 'Ahorro cooperativo a 6 años.',
      saberesPrevios: 'Porcentajes.',
      contenido: 'El interés compuesto capitaliza cada periodo multiplicando por (1 + 0.12)^n sobre $5000.',
      ejemploResuelto: 'M = 5000(1 + 0.12)^6',
      practica: [],
      aplicacion: 'Fondos comunitarios.',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: 'Proyección.',
    };
    const expDiag = buildSacrintDiagram(mission, pack, { session: expSession });
    expect(expDiag.kind).toBe('exponential');
    expect(diagramModelLabel(expDiag)).toBe('Interés simple vs. compuesto');
    if (expDiag.kind === 'exponential') {
      const last = expDiag.compoundSeries.length - 1;
      expect(expDiag.compoundSeries[last]!.value).toBeGreaterThan(expDiag.simpleSeries[last]!.value);
    }

    const geoSession: SessionPlan = {
      sessionNumber: 5,
      objetivo: 'Calcular lados y ángulos en triángulo rectángulo mediante teorema de Pitágoras',
      motivacion: 'Rampa escolar.',
      saberesPrevios: 'Ángulos rectos.',
      contenido: 'En todo triángulo rectángulo con catetos 3 y 4, la hipotenusa vale 5 y los ángulos miden 36.9°.',
      ejemploResuelto: 'c = √(3² + 4²) = 5',
      practica: [],
      aplicacion: 'Construcción de rampas.',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: 'Croquis.',
    };
    const geoDiag = buildSacrintDiagram(mission, pack, { session: geoSession });
    expect(geoDiag.kind).toBe('geometry');
    expect(diagramModelLabel(geoDiag)).toBe('Modelo geométrico');
  });

  it('generates class-by-class lesson-guide deck with zero boilerplate/rubric/solution leaks and clean PPTX XML axes', async () => {
    const wb = buildMultiTopicWorkbook();
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });

    // 1 Cover + 3 sessions × 2 chalkboard slides = 7 slides
    expect(deck.mode).toBe('lesson-guide');
    expect(deck.slides).toHaveLength(7);
    expect(deck.slides[0]!.kind).toBe('cover');
    expect(deck.slides.slice(1, 3).map((s) => s.kind)).toEqual(['concept', 'practice']);

    // Check material-review accepts lesson-guide cleanly
    const review = reviewBlockMaterials({ workbook: wb, deck });
    expect(review.byMaterial.deck.issues.some((i) => i.code === 'S6_INVALID_SLIDE_COUNT')).toBe(false);

    const svgs = renderDeckSvgs(deck);
    expect(svgs).toHaveLength(7);

    for (const item of svgs) {
      expect(item.svg).not.toContain('Sin pasos resueltos registrados.');
      expect(item.svg).not.toContain('[[material:');
      expect(item.svg).not.toContain('Rúbrica Analítica');
      expect(item.svg).not.toContain('Ponderación:');
      expect(item.svg).not.toContain('SECRET_ANSWER_KEY_DO_NOT_LEAK');
      expect(item.svg).not.toContain('undefined');
      expect(item.svg).not.toContain('${');
    }

    // Export combined PPTX and verify OOXML integrity + bounded tick labels
    const pptxBuf = await generateCombinedSacrintPptx(buildSacrintDecksForWorkbook(wb, { mode: 'lesson-guide' }));
    const zip = await JSZip.loadAsync(pptxBuf);
    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

    expect(slideFiles).toHaveLength(7);

    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile]!.async('text');
      expect(xml).not.toContain('Sin pasos resueltos registrados.');
      expect(xml).not.toContain('[[material:');
      expect(xml).not.toContain('Rúbrica Analítica');
      expect(xml).not.toContain('SECRET_ANSWER_KEY_DO_NOT_LEAK');
      // Slide 2 is Session 1 Linear Concept (slope=350, intercept=1500, targetY=5300) — must stay clean and bounded, NOT 591+ ticks!
      const shapeMatches = xml.match(/<p:sp>/g) ?? [];
      expect(shapeMatches.length).toBeLessThan(140);
      const tickMatches = [...xml.matchAll(/<a:t>(\d+(?:\.\d+)?k?)<\/a:t>/g)].map((m) => m[1]);
      expect(tickMatches.length).toBeLessThanOrEqual(24);
    }
  }, 60000);

  it('produces light editorial print-friendly infographics with clean topic titles, formulas and PNG export', async () => {
    const wb = buildMultiTopicWorkbook();
    const wide = buildSacrintInfographic(wb, 'wide');
    const letter = buildSacrintInfographic(wb, 'letter');

    expect(wide.theme).toBe('light');
    expect(letter.theme).toBe('light');
    expect(wide.title).not.toMatch(/^Sesión\s*22\s*:/i);

    const wideSvg = renderInfographicSvg(wide);
    const letterSvg = renderInfographicSvg(letter);

    for (const svg of [wideSvg, letterSvg]) {
      expect(svg).toContain('#F8FAFC');
      expect(svg).toContain('RUTA DE APRENDIZAJE');
      expect(svg).not.toContain('[[material:');
      expect(svg).not.toContain('SECRET_ANSWER_KEY_DO_NOT_LEAK');
      expect(svg).not.toContain('Rúbrica Analítica');
      expect(svg).not.toContain('…');
      expect(svg).not.toContain('undefined');
      expect(svg).not.toContain('${');
    }
    expect(letterSvg).toContain('SACRINT · CARTA');

    const png = await renderInfographicPng(letter, 2);
    const meta = await sharp(png.buffer).metadata();
    expect(png.filename).toMatch(/\.png$/);
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(INFOGRAPHIC.printWidth);
    expect(meta.height).toBe(3300);
  }, 60000);
});
