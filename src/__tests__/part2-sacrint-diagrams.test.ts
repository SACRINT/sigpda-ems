import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDiagram, buildDiagramVariables, diagramFormula } from '@/lib/visual-engine/sacrint/diagrams';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';
import { buildSacrintDeck } from '@/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import type { SessionPlan } from '@/types/work-textbook';

function makeSession(overrides: Partial<SessionPlan>): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: '',
    motivacion: '',
    saberesPrevios: '',
    contenido: '',
    ejemploResuelto: '',
    practica: [],
    aplicacion: '',
    autoevaluacion: [],
    recursos: [],
    productoIntegrador: '',
    ...overrides,
  };
}

describe('SACRINT Part 2 — Non-Fabricated Mathematical Diagrams', () => {
  const pack = resolveSacrintPack('Pensamiento Matemático III', 'BGE');
  const mission = structuredClone(MATH_DEMO_WORKBOOK.missions![0]!);

  it('returns available=false without fabricated coefficients when text mentions quadratic keywords without a real equation', async () => {
    const session = makeSession({
      sessionNumber: 1,
      objetivo: 'Comprender el uso de la fórmula general y el discriminante en ecuaciones de segundo grado',
      contenido: 'Una ecuación cuadrática describe una parábola cuyo discriminante indica la naturaleza de las raíces.',
      ejemploResuelto: 'Analiza cómo cambia la concavidad según el signo del término cuadrático.',
    });

    const diag = buildSacrintDiagram(mission, pack, { session, allowMissionFallback: false });
    expect(diag.kind).toBe('quadratic');
    expect(diag.available).toBe(false);
    if (diag.kind === 'quadratic') {
      expect(diag.equation).toBe('Modelo por construir');
      expect(diag.samples).toHaveLength(0);
      expect(diag.roots).toHaveLength(0);
    }

    const vars = buildDiagramVariables(diag);
    expect(JSON.stringify(vars)).not.toContain('x² - 6x + 5');
    expect(vars.every((v) => v.meaning === 'Por construir')).toBe(true);
    expect(diagramFormula(diag)).toBe('Modelo por construir');

    // Verify SVG and PPTX render "MODELO POR CONSTRUIR" instead of fake parabola
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    wb.missions![0]!.sessionPlans = [session];
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
    const svgs = renderDeckSvgs(deck);
    expect(svgs[1]!.svg).toContain('MODELO POR CONSTRUIR');
    expect(svgs[1]!.svg).not.toContain('x² - 6x + 5');

    const pptxBuf = await generateSacrintPptx(deck);
    const zip = await JSZip.loadAsync(pptxBuf);
    const slide2Xml = await zip.files['ppt/slides/slide2.xml']!.async('text');
    expect(slide2Xml).toContain('MODELO POR CONSTRUIR');
    expect(slide2Xml).not.toContain('x² - 6x + 5');
  });

  it('returns available=false without fabricated equations when text mentions determinantes or Cramer without two equations', async () => {
    const session = makeSession({
      sessionNumber: 2,
      objetivo: 'Explicar el método de determinantes y la regla de Cramer para sistemas 2x2 con dos incógnitas',
      contenido: 'El método de igualación y los determinantes permiten hallar la intersección de dos rectas.',
      ejemploResuelto: 'Organiza los coeficientes en la matriz principal antes de calcular el determinante.',
    });

    const diag = buildSacrintDiagram(mission, pack, { session, allowMissionFallback: false });
    expect(diag.kind).toBe('system-2x2');
    expect(diag.available).toBe(false);
    if (diag.kind === 'system-2x2') {
      expect(diag.equation1).toBe('Modelo por construir');
      expect(diag.equation2).toBe('Modelo por construir');
      expect(diag.intersection).toBeNull();
    }

    const vars = buildDiagramVariables(diag);
    expect(JSON.stringify(vars)).not.toContain('2x + 3y = 12');
    expect(JSON.stringify(vars)).not.toContain('x - y = 1');
    expect(diagramFormula(diag)).toBe('Modelo por construir');
  });

  it('returns available=false when text mentions compound interest without principal or rate numbers', () => {
    const session = makeSession({
      sessionNumber: 3,
      objetivo: 'Distinguir entre interés simple e interés compuesto en el crecimiento exponencial',
      contenido: 'La capitalización periódica reinvierte los intereses generados en cada etapa.',
    });

    const diag = buildSacrintDiagram(mission, pack, { session, allowMissionFallback: false });
    expect(diag.kind).toBe('exponential');
    expect(diag.available).toBe(false);
    if (diag.kind === 'exponential') {
      expect(diag.equation).toBe('Modelo por construir');
      expect(diag.compoundSeries).toHaveLength(0);
    }
  });

  it('extracts authentic quadratic and system-2x2 models when real equations are present', () => {
    const quadSession = makeSession({
      objetivo: 'Resolver ecuaciones cuadráticas reales',
      ejemploResuelto: 'f(x) = x² - 4x + 3',
    });
    const quadDiag = buildSacrintDiagram(mission, pack, { session: quadSession, allowMissionFallback: false });
    expect(quadDiag.kind).toBe('quadratic');
    expect(quadDiag.available).toBe(true);
    if (quadDiag.kind === 'quadratic') {
      expect(quadDiag.a).toBe(1);
      expect(quadDiag.b).toBe(-4);
      expect(quadDiag.c).toBe(3);
      expect(quadDiag.roots).toEqual([1, 3]);
    }

    const sysSession = makeSession({
      objetivo: 'Resolver sistema lineal 2x2',
      ejemploResuelto: '3x + y = 7 y x - y = 1',
    });
    const sysDiag = buildSacrintDiagram(mission, pack, { session: sysSession, allowMissionFallback: false });
    expect(sysDiag.kind).toBe('system-2x2');
    expect(sysDiag.available).toBe(true);
    if (sysDiag.kind === 'system-2x2') {
      expect(sysDiag.intersection).toEqual({ x: 2, y: 1 });
    }
  });
});
