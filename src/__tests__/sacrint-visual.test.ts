import { describe, it, expect } from 'vitest';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import {
  CHEMISTRY_DEMO_WORKBOOK,
  ENGLISH_DEMO_WORKBOOK,
  PHILOSOPHY_DEMO_WORKBOOK,
} from '@/lib/visual-engine/sacrint/fixtures/pilot-workbooks';
import {
  BIOLOGY_DEMO_WORKBOOK,
  GENERAL_DEMO_WORKBOOK,
  HEALTH_DEMO_WORKBOOK,
  HISTORY_DEMO_WORKBOOK,
  LABOR_DEMO_WORKBOOK,
  LITERATURE_DEMO_WORKBOOK,
  PHYSICS_DEMO_WORKBOOK,
  TECHNOLOGY_DEMO_WORKBOOK,
} from '@/lib/visual-engine/sacrint/fixtures/extended-workbooks';
import {
  ARTS_DEMO_WORKBOOK,
  PHYSICAL_EDUCATION_DEMO_WORKBOOK,
  SOCIOEMOTIONAL_DEMO_WORKBOOK,
} from '@/lib/visual-engine/sacrint/fixtures/new-packs-workbooks';
import { buildSacrintDeck, buildSacrintInfographic } from '@/lib/visual-engine/sacrint/spec';
import { diagramModelLabel } from '@/lib/visual-engine/sacrint/diagrams';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { renderInfographicSvg } from '@/lib/visual-engine/sacrint/infographic-renderer';
import { renderInfographicPng, renderSvgToPng } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';
import { fitText, measureText } from '@/lib/visual-engine/sacrint/text-layout';
import { INFOGRAPHIC, SLIDE } from '@/lib/visual-engine/sacrint/tokens';

const EXPECTED_STYLES: Record<string, string> = {
  matematicas: 'exactas',
  fisica: 'exactas',
  quimica: 'naturales',
  biologia: 'naturales',
  salud: 'naturales',
  filosofia: 'humanidades',
  literatura: 'humanidades',
  ingles: 'humanidades',
  historia: 'humanidades',
  tecnologia: 'tecnica',
  laboral: 'tecnica',
  artes: 'tecnica',
  educacion_fisica: 'tecnica',
  socioemocional: 'socioemocional',
  general: 'general',
};

const PACK_CASES = [
  { id: 'matematicas', subject: 'Pensamiento Matemático I', workbook: MATH_DEMO_WORKBOOK, diagram: 'linear' },
  { id: 'fisica', subject: 'Física I', workbook: PHYSICS_DEMO_WORKBOOK, diagram: 'concept' },
  { id: 'quimica', subject: 'Química', workbook: CHEMISTRY_DEMO_WORKBOOK, diagram: 'reaction' },
  { id: 'biologia', subject: 'Biología I', workbook: BIOLOGY_DEMO_WORKBOOK, diagram: 'system-map' },
  { id: 'salud', subject: 'Ciencias de la Salud', workbook: HEALTH_DEMO_WORKBOOK, diagram: 'clinical-flow' },
  { id: 'filosofia', subject: 'Filosofía', workbook: PHILOSOPHY_DEMO_WORKBOOK, diagram: 'argument' },
  { id: 'literatura', subject: 'Lengua y Literatura', workbook: LITERATURE_DEMO_WORKBOOK, diagram: 'argument' },
  { id: 'ingles', subject: 'Inglés', workbook: ENGLISH_DEMO_WORKBOOK, diagram: 'language' },
  { id: 'historia', subject: 'Historia de México', workbook: HISTORY_DEMO_WORKBOOK, diagram: 'timeline' },
  { id: 'tecnologia', subject: 'Tecnología e Ingeniería', workbook: TECHNOLOGY_DEMO_WORKBOOK, diagram: 'block-diagram' },
  { id: 'laboral', subject: 'Formación para el Trabajo', workbook: LABOR_DEMO_WORKBOOK, diagram: 'sop-flow' },
  { id: 'artes', subject: 'Artes', workbook: ARTS_DEMO_WORKBOOK, diagram: 'creative-cycle' },
  { id: 'educacion_fisica', subject: 'Educación Física', workbook: PHYSICAL_EDUCATION_DEMO_WORKBOOK, diagram: 'training-cycle' },
  { id: 'socioemocional', subject: 'Desarrollo Socioemocional', workbook: SOCIOEMOTIONAL_DEMO_WORKBOOK, diagram: 'regulation-flow' },
  { id: 'general', subject: 'Asignatura sin catálogo', workbook: GENERAL_DEMO_WORKBOOK, diagram: 'concept' },
] as const;

describe('SACRINT visual engine', () => {
  it('resuelve packs por asignatura', () => {
    expect(resolveSacrintPack('Pensamiento Matemático I').id).toBe('matematicas');
    expect(resolveSacrintPack('Química').id).toBe('quimica');
    expect(resolveSacrintPack('Filosofía').id).toBe('filosofia');
    expect(resolveSacrintPack('Inglés').id).toBe('ingles');
    expect(resolveSacrintPack('Asignatura sin catálogo').id).toBe('general');
  });

  it('resuelve los 15 packs desde sus asignaturas', () => {
    for (const item of PACK_CASES) {
      expect(resolveSacrintPack(item.subject).id).toBe(item.id);
    }
  });

  it('construye el diagrama esperado en los 15 packs sin filtrar el modelo lineal', () => {
    for (const item of PACK_CASES) {
      const deck = buildSacrintDeck(item.workbook);
      expect(deck.pack.id).toBe(item.id);
      expect(deck.slides).toHaveLength(8);
      const concept = deck.slides[2];
      expect(concept.kind).toBe('concept');
      if (concept.kind !== 'concept') continue;
      expect(concept.diagram.kind).toBe(item.diagram);
      const conceptSvg = renderDeckSvgs(deck)[2].svg;
      expect(conceptSvg).not.toContain('undefined');
      expect(conceptSvg).not.toContain('${');
      if (item.id !== 'matematicas') {
        expect(conceptSvg).not.toContain('MODELO LINEAL');
      }
    }
  });

  it('asigna diagrama propio y etiqueta de modelo a los 5 packs extendidos', () => {
    const expectations = [
      { id: 'historia', kind: 'timeline', label: 'Línea de tiempo' },
      { id: 'biologia', kind: 'system-map', label: 'Red de sistemas' },
      { id: 'salud', kind: 'clinical-flow', label: 'Flujo clínico' },
      { id: 'tecnologia', kind: 'block-diagram', label: 'Diagrama de bloques' },
      { id: 'laboral', kind: 'sop-flow', label: 'Flujo de procedimiento' },
    ] as const;
    for (const expected of expectations) {
      const item = PACK_CASES.find((pack) => pack.id === expected.id);
      expect(item).toBeTruthy();
      if (!item) continue;
      const deck = buildSacrintDeck(item.workbook);
      const concept = deck.slides[2];
      expect(concept.kind).toBe('concept');
      if (concept.kind !== 'concept') continue;
      expect(concept.diagram.kind).toBe(expected.kind);
      expect(diagramModelLabel(concept.diagram)).toBe(expected.label);
      const infographic = buildSacrintInfographic(item.workbook, 'wide');
      const infographicSvg = renderInfographicSvg(infographic);
      expect(infographicSvg).toContain(expected.label.toLocaleUpperCase('es-MX'));
      expect(infographicSvg).not.toContain('undefined');
    }
  });

  it('asigna ciclo creativo, ciclo de entrenamiento y flujo de regulación a los 3 packs nuevos', () => {
    const expectations = [
      { id: 'artes', kind: 'creative-cycle', label: 'Ciclo creativo', marker: 'DETONANTE' },
      { id: 'educacion_fisica', kind: 'training-cycle', label: 'Ciclo de entrenamiento', marker: 'CALENTAMIENTO' },
      { id: 'socioemocional', kind: 'regulation-flow', label: 'Flujo de regulación', marker: 'EMOCIÓN' },
    ] as const;
    for (const expected of expectations) {
      const item = PACK_CASES.find((pack) => pack.id === expected.id);
      expect(item).toBeTruthy();
      if (!item) continue;
      const deck = buildSacrintDeck(item.workbook);
      expect(deck.pack.id).toBe(expected.id);
      const concept = deck.slides[2];
      expect(concept.kind).toBe('concept');
      if (concept.kind !== 'concept') continue;
      expect(concept.diagram.kind).toBe(expected.kind);
      expect(diagramModelLabel(concept.diagram)).toBe(expected.label);
      expect(concept.formula.length).toBeGreaterThan(0);
      const conceptSvg = renderDeckSvgs(deck)[2].svg;
      expect(conceptSvg).toContain(expected.label.toLocaleUpperCase('es-MX'));
      expect(conceptSvg).toContain(expected.marker);
      expect(conceptSvg).not.toContain('undefined');
      const infographicSvg = renderInfographicSvg(buildSacrintInfographic(item.workbook, 'wide'));
      expect(infographicSvg).toContain(expected.label.toLocaleUpperCase('es-MX'));
      expect(infographicSvg).not.toContain('undefined');
    }
  });

  it('muestra contexto, pregunta y foco completos en el hook', () => {
    for (const item of PACK_CASES) {
      const deck = buildSacrintDeck(item.workbook);
      const hook = deck.slides[1];
      expect(hook.kind).toBe('hook');
      if (hook.kind !== 'hook') continue;
      expect(hook.nodes).toHaveLength(3);
      expect(hook.nodes[0].detail.endsWith('.')).toBe(true);
      expect(hook.story.startsWith(hook.nodes[0].detail)).toBe(true);
      for (const node of hook.nodes) {
        expect(node.detail.length).toBeGreaterThan(0);
        expect(node.detail).not.toContain('…');
      }
    }
  });

  it('construye un deck de 8 diapositivas desde el libro', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK);
    expect(deck.slides).toHaveLength(8);
    expect(deck.slides.map((slide) => slide.kind)).toEqual([
      'cover',
      'hook',
      'concept',
      'demo',
      'practice',
      'challenge',
      'evidence',
      'closing',
    ]);
    const concept = deck.slides[2];
    expect(concept.kind).toBe('concept');
    if (concept.kind === 'concept') {
      expect(concept.diagram.kind).toBe('linear');
      if (concept.diagram.kind !== 'linear') return;
      expect(concept.diagram.available).toBe(true);
      expect(concept.diagram.slope).toBe(0.85);
      expect(concept.diagram.intercept).toBe(1.2);
      expect(concept.formula).toBe('f(x) = 0.85x + 1.2');
      expect(concept.diagram.points).toContainEqual({ x: 8, y: 8 });
    }
  });

  it('deriva las slides de práctica, reto, demostración y evidencia del libro', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK);

    const demo = deck.slides[3];
    expect(demo.kind).toBe('demo');
    if (demo.kind === 'demo') {
      expect(demo.demoText).toContain('cooperativa');
      expect(demo.steps.length).toBeGreaterThan(0);
      expect(demo.steps[0].length).toBeGreaterThan(0);
    }

    const practice = deck.slides[4];
    expect(practice.kind).toBe('practice');
    if (practice.kind === 'practice') {
      expect(practice.practiceText).toContain('y = 0.85x + 1.2');
      expect(practice.checkpoints.length).toBeGreaterThan(0);
    }

    const challenge = deck.slides[5];
    expect(challenge.kind).toBe('challenge');
    if (challenge.kind === 'challenge') {
      expect(challenge.artifactName).toBe('Panel de decisión: cosecha, ingreso y reinversión');
      expect(challenge.communityUtility.length).toBeGreaterThan(0);
    }

    const evidence = deck.slides[6];
    expect(evidence.kind).toBe('evidence');
    if (evidence.kind === 'evidence') {
      expect(evidence.rubric).toHaveLength(4);
      expect(evidence.rubric[0].weight).toBe(30);
      expect(evidence.checklist).toHaveLength(3);
      expect(evidence.checkpoint).toContain('función lineal');
    }

    const svgs = renderDeckSvgs(deck);
    expect(svgs[3].kind).toBe('demo');
    expect(svgs[4].kind).toBe('practice');
    expect(svgs[5].kind).toBe('challenge');
    expect(svgs[6].kind).toBe('evidence');
    for (const index of [3, 4, 5, 6]) {
      expect(svgs[index].svg).toContain('Space Grotesk');
      expect(svgs[index].svg).not.toContain('undefined');
      expect(svgs[index].svg).not.toContain('${');
    }
    expect(svgs[6].svg).toContain('RÚBRICA DE EVALUACIÓN'.toLocaleUpperCase('es-MX'));
  });

  it('degrada a modelo por construir cuando faltan parámetros', () => {
    const workbook = structuredClone(MATH_DEMO_WORKBOOK);
    const mission = workbook.missions![0]!;
    mission.conceptZero!.coreExplanation =
      'Una función lineal relaciona dos variables con una razón de cambio constante y una intersección con el eje vertical.';
    mission.conceptZero!.solvedExample!.solutionSteps = [
      'Identificamos las variables y describimos la relación sin coeficientes numéricos.',
    ];
    mission.iDoSection!.stepByStepDemo =
      'El docente guía la construcción del modelo con los datos disponibles del grupo.';

    const deck = buildSacrintDeck(workbook);
    const concept = deck.slides[2];
    expect(concept.kind).toBe('concept');
    if (concept.kind !== 'concept') return;
    expect(concept.diagram.kind).toBe('linear');
    if (concept.diagram.kind !== 'linear') return;
    expect(concept.diagram.available).toBe(false);
    expect(concept.diagram.equation).toBe('y = mx + b');
    expect(concept.diagram.points).toEqual([]);

    const slideSvg = renderDeckSvgs(deck)[2].svg;
    expect(slideSvg).toContain('MODELO POR CONSTRUIR');
    expect(slideSvg).not.toContain('0.85x');

    const infographicSvg = renderInfographicSvg(buildSacrintInfographic(workbook, 'letter'));
    expect(infographicSvg).toContain('MODELO POR CONSTRUIR');
  });

  it('deriva pasos y andamiaje desde texto real etiquetado', () => {
    const workbook = structuredClone(MATH_DEMO_WORKBOOK);
    const mission = workbook.missions![0]!;
    mission.conceptZero!.solvedExample!.solutionSteps = [];
    mission.iDoSection!.stepByStepDemo =
      'Introducción que no es un paso. PASO 1: Identificamos los datos del problema. PASO 2: Calculamos $m \\rightarrow b$. PASO 3: Verificamos $p$ y $q$ con la tabla.';
    mission.weDoSection!.workbookElements = [];
    mission.weDoSection!.guidedPractice =
      'Instrucción 1: Lean el caso y registren los datos. Instrucción 2: Construyan la tabla de valores. Instrucción 3: Comparen resultados en equipo.';

    const deck = buildSacrintDeck(workbook);
    const demo = deck.slides[3];
    expect(demo.kind).toBe('demo');
    if (demo.kind !== 'demo') return;
    expect(demo.steps).toHaveLength(3);
    expect(demo.steps[0]).toContain('Identificamos los datos');
    expect(demo.steps[1]).toContain('→');
    expect(demo.steps[1]).not.toContain('$');
    expect(demo.steps[1]).not.toContain('\\rightarrow');
    expect(demo.steps[2]).not.toContain('$');

    const practice = deck.slides[4];
    expect(practice.kind).toBe('practice');
    if (practice.kind !== 'practice') return;
    expect(practice.checkpoints).toHaveLength(3);
    expect(practice.checkpoints[1]).toContain('Construyan la tabla');
  });

  it('ajusta títulos largos de portada sin elipsis', () => {
    const workbook = structuredClone(MATH_DEMO_WORKBOOK);
    workbook.missions![0]!.title =
      'Fundamentación e Intuición — Encuadre, exploración de saberes previos y diagnóstico contextual del entorno comunitario';
    const cover = renderDeckSvgs(buildSacrintDeck(workbook))[0].svg;
    expect(cover).not.toContain('…');
  });

  it('autoajusta texto sin superar líneas ni ancho', () => {
    const text = 'La cooperativa necesita proyectar la cosecha para decidir cuánto reinvertir en un secador comunitario.';
    const fitted = fitText(text, 320, {
      maxFontSize: 32,
      minFontSize: 12,
      maxLines: 3,
      family: 'body',
      weight: 'regular',
    });
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    for (const line of fitted.lines) {
      expect(measureText(line, fitted.fontSize)).toBeLessThanOrEqual(321);
    }
  });

  it('renderiza ocho SVG 1920x1080 sin placeholders', () => {
    const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK);
    const svgs = renderDeckSvgs(deck);
    expect(svgs).toHaveLength(8);
    for (const item of svgs) {
      expect(item.svg).toContain(`width="${SLIDE.width}"`);
      expect(item.svg).toContain(`height="${SLIDE.height}"`);
      expect(item.svg).not.toContain('${');
      expect(item.svg).not.toContain('undefined');
      expect(item.svg).toContain('Space Grotesk');
      expect(item.svg).toContain('Inter');
    }
  });

  it('renderiza infografías 16:9 y Carta', () => {
    const wide = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'wide');
    const letter = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'letter');
    const wideSvg = renderInfographicSvg(wide);
    const letterSvg = renderInfographicSvg(letter);
    expect(wideSvg).toContain(`width="${INFOGRAPHIC.wide.width}"`);
    expect(wideSvg).toContain(`height="${INFOGRAPHIC.wide.height}"`);
    expect(letterSvg).toContain(`width="${INFOGRAPHIC.letter.width}"`);
    expect(letterSvg).toContain(`height="${INFOGRAPHIC.letter.height}"`);
    expect(wideSvg).toContain('RUTA DE APRENDIZAJE');
    expect(letterSvg).toContain('RUTA DE APRENDIZAJE');
    expect(wideSvg).not.toContain('${');
    expect(letterSvg).not.toContain('${');
  });

  it('usa el reto autónomo como cuarto paso cuando solo hay tres pasos resueltos', () => {
    const spec = buildSacrintInfographic(PHYSICS_DEMO_WORKBOOK, 'wide');
    expect(spec.steps).toHaveLength(4);
    expect(spec.steps[0].title).toBe('EL FENÓMENO');
    expect(spec.steps[3].title).toBe('LA DECISIÓN');
    expect(spec.steps[3].body).toContain('Documenta un tramo de tu comunidad');
  });

  it('renderiza los 15 packs en SVG sin placeholders', () => {
    for (const item of PACK_CASES) {
      const deck = buildSacrintDeck(item.workbook);
      for (const slide of renderDeckSvgs(deck)) {
        expect(slide.svg).toContain(`width="${SLIDE.width}"`);
        expect(slide.svg).toContain(`height="${SLIDE.height}"`);
        expect(slide.svg).not.toContain('undefined');
        expect(slide.svg).not.toContain('${');
      }
      for (const format of ['wide', 'letter'] as const) {
        const infographic = buildSacrintInfographic(item.workbook, format);
        const svg = renderInfographicSvg(infographic);
        expect(svg).toContain(`width="${INFOGRAPHIC[format].width}"`);
        expect(svg).toContain(`height="${INFOGRAPHIC[format].height}"`);
        expect(svg).toContain('RUTA DE APRENDIZAJE');
        expect(svg).not.toContain('undefined');
        expect(svg).not.toContain('${');
      }
    }
  });

  it('asigna una familia visual a los 15 packs y la refleja en el SVG', () => {
    for (const item of PACK_CASES) {
      const deck = buildSacrintDeck(item.workbook);
      const expected = EXPECTED_STYLES[item.id];
      expect(deck.style.id).toBe(expected);
      const slides = renderDeckSvgs(deck);
      for (const slide of slides) {
        expect(slide.svg).toContain(`data-style="${expected}"`);
      }
      const infographic = buildSacrintInfographic(item.workbook, 'wide');
      expect(infographic.style.id).toBe(expected);
      expect(renderInfographicSvg(infographic)).toContain(`data-style="${expected}"`);
    }
  });

  it('diferencia el arte de portada y el riel entre familias', () => {
    const math = renderDeckSvgs(buildSacrintDeck(MATH_DEMO_WORKBOOK));
    const biology = renderDeckSvgs(buildSacrintDeck(BIOLOGY_DEMO_WORKBOOK));
    const philosophy = renderDeckSvgs(buildSacrintDeck(PHILOSOPHY_DEMO_WORKBOOK));
    expect(math[0].svg).toContain('ANCLA VISUAL · GEOMETRÍA');
    expect(biology[0].svg).toContain('ANCLA VISUAL · RED MOLECULAR');
    expect(philosophy[0].svg).toContain('ANCLA VISUAL · PÁGINA ABIERTA');
    expect(math[2].svg).not.toBe(biology[2].svg);
    expect(math[2].svg).not.toBe(philosophy[2].svg);
  });

  it('genera un esquema de reacción desde una ecuación química', () => {
    const deck = buildSacrintDeck(CHEMISTRY_DEMO_WORKBOOK);
    expect(deck.pack.id).toBe('quimica');
    const concept = deck.slides[2];
    expect(concept.kind).toBe('concept');
    if (concept.kind !== 'concept') return;
    expect(concept.diagram.kind).toBe('reaction');
    if (concept.diagram.kind !== 'reaction') return;
    expect(concept.diagram.available).toBe(true);
    expect(concept.diagram.equation).toContain('CH₄');
    expect(concept.diagram.reactants).toHaveLength(2);
    expect(concept.diagram.products).toHaveLength(2);
    expect(concept.formula).toContain('→');

    const conceptSvg = renderDeckSvgs(deck)[2].svg;
    expect(conceptSvg).toContain('ESQUEMA DE REACCIÓN');
    expect(conceptSvg).toContain('TRANSFORMACIÓN');
    expect(conceptSvg).toContain('CH₄');
    expect(conceptSvg).not.toContain('MODELO LINEAL');

    const infographicSvg = renderInfographicSvg(buildSacrintInfographic(CHEMISTRY_DEMO_WORKBOOK, 'wide'));
    expect(infographicSvg).toContain('ESQUEMA DE REACCIÓN');
    expect(infographicSvg).toContain('LA REACCIÓN');
    expect(infographicSvg).not.toContain('MODELO LINEAL');
  });

  it('genera un mapa argumental para Filosofía', () => {
    const deck = buildSacrintDeck(PHILOSOPHY_DEMO_WORKBOOK);
    expect(deck.pack.id).toBe('filosofia');
    const concept = deck.slides[2];
    expect(concept.kind).toBe('concept');
    if (concept.kind !== 'concept') return;
    expect(concept.diagram.kind).toBe('argument');
    if (concept.diagram.kind !== 'argument') return;
    expect(concept.diagram.thesis.detail).toContain('libertad');
    expect(concept.diagram.premises).toHaveLength(2);
    expect(concept.diagram.objection.detail).toContain('ausencia');
    expect(concept.diagram.conclusion.detail).toContain('responsabilidad');

    const conceptSvg = renderDeckSvgs(deck)[2].svg;
    expect(conceptSvg).toContain('MAPA ARGUMENTAL');
    expect(conceptSvg).toContain('TESIS');
    expect(conceptSvg).toContain('OBJECIÓN');
    expect(conceptSvg).not.toContain('MODELO LINEAL');

    const infographicSvg = renderInfographicSvg(buildSacrintInfographic(PHILOSOPHY_DEMO_WORKBOOK, 'letter'));
    expect(infographicSvg).toContain('MAPA ARGUMENTAL');
    expect(infographicSvg).toContain('LA TESIS');
  });

  it('genera una red de lengua para Inglés', () => {
    const deck = buildSacrintDeck(ENGLISH_DEMO_WORKBOOK);
    expect(deck.pack.id).toBe('ingles');
    const concept = deck.slides[2];
    expect(concept.kind).toBe('concept');
    if (concept.kind !== 'concept') return;
    expect(concept.diagram.kind).toBe('language');
    if (concept.diagram.kind !== 'language') return;
    expect(concept.diagram.input.detail).toContain('present simple');
    expect(concept.diagram.output.detail).toContain('English');

    const conceptSvg = renderDeckSvgs(deck)[2].svg;
    expect(conceptSvg).toContain('RED DE LENGUA');
    expect(conceptSvg).toContain('ENTRADA / INPUT');
    expect(conceptSvg).toContain('PRODUCCIÓN / OUTPUT');
    expect(conceptSvg).not.toContain('MODELO LINEAL');

    const infographicSvg = renderInfographicSvg(buildSacrintInfographic(ENGLISH_DEMO_WORKBOOK, 'wide'));
    expect(infographicSvg).toContain('RED DE LENGUA');
    expect(infographicSvg).toContain('LA FORMA');
  });

  it('usa un mapa conceptual como fallback para disciplinas sin diagrama propio', () => {
    const workbook = structuredClone(MATH_DEMO_WORKBOOK);
    workbook.coverData.subjectName = 'Asignatura sin catálogo';
    const deck = buildSacrintDeck(workbook);
    expect(deck.pack.id).toBe('general');
    const concept = deck.slides[2];
    expect(concept.kind).toBe('concept');
    if (concept.kind !== 'concept') return;
    expect(concept.diagram.kind).toBe('concept');
    const conceptSvg = renderDeckSvgs(deck)[2].svg;
    expect(conceptSvg).toContain('MAPA CONCEPTUAL');
    expect(conceptSvg).not.toContain('MODELO LINEAL');
  });

  it('rasteriza SVG con fuentes embebidas', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="160"><rect width="640" height="160" fill="#05070B"/><text x="32" y="96" font-family="Space Grotesk, sans-serif" font-size="42" font-weight="700" fill="#D4AF37">SACRINT 2026</text></svg>`;
    const png = await renderSvgToPng(svg, 640, 160);
    expect(png.length).toBeGreaterThan(1500);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });

  it('rasteriza la infografía Carta a 2x para PDF', async () => {
    const spec = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'letter');
    const png = await renderInfographicPng(spec, 2);
    expect(png.buffer.readUInt32BE(16)).toBe(2550);
    expect(png.buffer.readUInt32BE(20)).toBe(3300);
  });
});
