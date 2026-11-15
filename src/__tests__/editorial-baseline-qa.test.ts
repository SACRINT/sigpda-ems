/**
 * editorial-baseline-qa.test.ts
 * Fase 0: Pruebas de regresión basadas en casos reales reproducidos de los
 * 9 entregables de Pensamiento Matemático III.
 */

import { describe, it, expect } from 'vitest';
import {
  BASELINE_ARITHMETIC_ASTERISK_CASES,
  BASELINE_TAB_TIMES_AND_PUNCTUATION_CASES,
  BASELINE_DANGLING_FRAGMENTS,
  BASELINE_SESSION_HEADING_CASES,
  BASELINE_SLIDE_90_QUADRATIC,
  BASELINE_SLIDE_7_AND_141_ACTIVITIES,
} from './fixtures/baseline-pm3-cases';
import { stripMarkdown } from '@/lib/visual-engine/content-extractor';
import { stripInlineMarkdownEmphasis } from '@/lib/utils/inline-markdown';
import * as textNorm from '@/lib/editorial/text-normalization';
import * as fitter from '@/lib/editorial/pedagogical-text-fitter';
import * as topicResolver from '@/lib/editorial/topic-title-resolver';
import { fitText } from '@/lib/visual-engine/sacrint/text-layout';
import { tryBuildQuadraticDiagram, buildDiagramVariables } from '@/lib/visual-engine/sacrint/diagrams';
import {
  distillLessonBundle,
  distillStepPreservingMath,
  extractFormulasFromText,
  preventSixGramTheoryOverlap,
} from '@/lib/visual-engine/sacrint/content-distiller';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';
import { dispatchVisual } from '@/lib/visual-engine/visual-dispatcher';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck, buildSacrintInfographic } from '@/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { renderCombinedSacrintInfographicsPdf } from '@/lib/visual-engine/sacrint/sacrint-rasterizer';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';

describe('Fase 0 Baseline QA — Regresiones editoriales, visuales y pedagógicas', () => {
  it('stripMarkdown preserva operadores aritméticos (*) o los convierte a × sin borrarlos', () => {
    for (const c of BASELINE_ARITHMETIC_ASTERISK_CASES) {
      const cleaned = stripMarkdown(c.input);
      for (const bad of c.forbiddenBroken) {
        expect(cleaned).not.toContain(bad);
      }
      if ('expectedStrippedEmphasis' in c) {
        for (const ok of c.expectedStrippedEmphasis) {
          expect(cleaned).toContain(ok);
        }
      }
      // Debe conservar un operador visible (* o ×)
      expect(cleaned).toMatch(/[*×]/);
    }

    // stripInlineMarkdownEmphasis tampoco debe destruir a * b + c * d
    const spacedMath = stripInlineMarkdownEmphasis('Área = base * altura y P = 2 * largo');
    expect(spacedMath).toContain('*');
  });

  it('normalizeEditorialText repara tab+imes, .. y espacios antes de puntuación sin dañar decimales, versiones ni URLs', () => {
    const tabFixed = textNorm.normalizeEditorialText(BASELINE_TAB_TIMES_AND_PUNCTUATION_CASES.tabTimesRaw);
    expect(tabFixed).not.toMatch(/\bimes\b/);
    expect(tabFixed).toContain('×');

    const dotsFixed = textNorm.normalizeEditorialText(BASELINE_TAB_TIMES_AND_PUNCTUATION_CASES.doubleDotsRaw);
    expect(dotsFixed).not.toMatch(/(?<!\.)\.\.(?!\.)/);

    const spacingFixed = textNorm.normalizeEditorialText(
      BASELINE_TAB_TIMES_AND_PUNCTUATION_CASES.spaceBeforePunctuationRaw
    );
    expect(spacingFixed).not.toMatch(/\s+[,.;:!?]/);

    const preserved = textNorm.normalizeEditorialText(
      BASELINE_TAB_TIMES_AND_PUNCTUATION_CASES.preserveDecimalsAndUrls
    );
    expect(preserved).toContain('3.1416');
    expect(preserved).toContain('v1.2.3');
    expect(preserved).toContain('etc...');
    expect(preserved).toContain('https://example.org/a..b/v1.0');
  });

  it('finalizeVisibleText y composeSessionHeading eliminan cortes colgantes y encabezados duplicados', () => {
    const finalize = (fitter as unknown as { finalizeVisibleText?: (s: string, opts?: Record<string, unknown>) => string })
      .finalizeVisibleText;
    expect(typeof finalize).toBe('function');
    if (finalize) {
      for (const frag of BASELINE_DANGLING_FRAGMENTS) {
        const clean = finalize(frag);
        expect(clean.toLowerCase()).not.toContain('activarás tus');
        expect(fitter.hasDanglingEnding(clean)).toBe(false);
      }
    }

    const compose = (
      topicResolver as unknown as {
        composeSessionHeading?: (input: { number: number; objective?: string; fallback?: string }) => string;
      }
    ).composeSessionHeading;
    expect(typeof compose).toBe('function');
    if (compose) {
      for (const c of BASELINE_SESSION_HEADING_CASES) {
        const heading = compose({ number: c.number, objective: c.objective });
        expect(heading).toBe(c.expected);
        expect(heading).not.toMatch(/Sesi[oó]n\s+\d+\s*[:.\-–—]+\s*Sesi[oó]n\s+\d+/i);
      }
    }
  });

  it('fitText reporta overflow y requiredHeight y nunca excede maxLines sin indicarlo', () => {
    const longText =
      'Este bloque contiene un planteamiento extenso con múltiples condiciones, datos numéricos detallados y pasos que superan claramente tres líneas en una caja estrecha.';
    const fitted = fitText(longText, 240, {
      maxFontSize: 18,
      minFontSize: 12,
      maxLines: 3,
      truncate: false,
    }) as unknown as { lines: string[]; overflow?: boolean; requiredHeight?: number; height: number };

    expect(typeof fitted.overflow).toBe('boolean');
    expect(typeof fitted.requiredHeight).toBe('number');
    expect(fitted.requiredHeight).toBeGreaterThanOrEqual(fitted.height);
    if (!fitted.overflow) {
      expect(fitted.lines.length).toBeLessThanOrEqual(3);
    } else {
      expect(fitted.requiredHeight).toBeGreaterThan(fitted.height);
    }
  });

  it('tryBuildQuadraticDiagram respeta el signo negativo implícito de y = -x² + 6x - 8', () => {
    const sourceText = [
      BASELINE_SLIDE_90_QUADRATIC.objetivo,
      BASELINE_SLIDE_90_QUADRATIC.contenido,
      BASELINE_SLIDE_90_QUADRATIC.ejemploResuelto,
    ].join(' ');
    const diag = tryBuildQuadraticDiagram(sourceText);
    expect(diag).not.toBeNull();
    expect(diag!.available).toBe(true);
    expect(diag!.a).toBe(-1);
    expect(diag!.b).toBe(6);
    expect(diag!.c).toBe(-8);
    expect(diag!.vertexX).toBe(3);
    expect(diag!.vertexY).toBe(1);
    expect(diag!.equation).not.toContain('1x²');
  });

  it('08 lesson-guide mantiene presupuesto compacto, actividades íntegras, objetivos/evaluación en 2/2 y cero wrap=none en PPTX', async () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    wb.missions![0]!.sessionPlans = [
      {
        sessionNumber: 17,
        objetivo: 'Aplicar perímetro y área en terrenos mediante descomposición en triángulos y cuadriláteros',
        motivacion: 'En la cancha escolar necesitamos medir superficies compuestas.',
        saberesPrevios: 'Fórmulas de área de rectángulo y triángulo.',
        contenido: 'Todo polígono irregular puede dividirse en triángulos mediante una diagonal para calcular su área total.',
        ejemploResuelto:
          'Planteamiento: Rectángulo de 8 m por 5 m.\nPaso 1: Multiplica 8 × 5 = 40 m².\nConclusión: El área total es 40 m².',
        practica: [
          {
            enunciado: BASELINE_SLIDE_7_AND_141_ACTIVITIES.slide141Practice,
            pista: 'Calcula el área de cada triángulo por separado con (base × altura)/2 y luego suma ambos resultados.',
            solucion: ['50 m²'],
          },
        ],
        aplicacion: BASELINE_SLIDE_7_AND_141_ACTIVITIES.slide141App,
        autoevaluacion: ['¿Calculé correctamente el área por triangulación?', '¿Verifiqué las unidades cuadradas?'],
        recursos: [],
        productoIntegrador: 'Croquis acotado del polígono escolar con cálculo de áreas parciales.',
      },
    ];

    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide', sessionIndex: 0 });
    expect(deck.slides).toHaveLength(3);

    const svgs = renderDeckSvgs(deck);
    const s1Text = svgs[1]!.svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const s2Text = svgs[2]!.svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Slide 2/2 conserva oración inicial completa de práctica y aplicación (sin recortar "El terreno..." ni "Observa...")
    expect(s2Text).toContain('El terreno comunitario');
    expect(s2Text).toContain('Observa el salón');
    expect(s2Text).toMatch(/OBJETIVOS?|METAS?|PROP[OÓ]SITO/i);
    expect(s2Text).toMatch(/EVALUACI[OÓ]N|CRITERIOS?|R[UÚ]BRICA/i);

    const words1 = s1Text.split(/\s+/).length;
    const words2 = s2Text.split(/\s+/).length;
    expect(words1).toBeLessThanOrEqual(165);
    expect(words2).toBeLessThanOrEqual(200);

    const pptxBuf = await generateSacrintPptx(deck);
    const zip = await JSZip.loadAsync(pptxBuf);
    for (const f of Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))) {
      const xml = await zip.files[f]!.async('text');
      // Cero cajas con wrap="none" en párrafos multi-palabra
      const longWrapNone = [...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)].filter((m) => {
        const sp = m[0];
        const txt = [...sp.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join(' ').trim();
        return /wrap="none"/.test(sp) && txt.length > 24;
      });
      expect(longWrapNone).toHaveLength(0);
    }
  });

  it('09 infografías generan PDF vectorial con texto seleccionable real y modelo ConceptManual (sin RUTA DE APRENDIZAJE)', async () => {
    const info = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'wide', { missionIndex: 0 });
    const pdfBytes = await renderCombinedSacrintInfographicsPdf([info], 'wide');
    const parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
    const parsed = await parser.getText();
    await parser.destroy();

    const extracted = parsed.text.replace(/\s+/g, ' ').trim();
    expect(extracted.length).toBeGreaterThan(220);
    expect(extracted).not.toMatch(/RUTA\s+DE\s+APRENDIZAJE/i);
    expect(extracted).toContain(info.title.slice(0, 18));
  });

  it('08/09 no-matemáticas omiten diagramas no disponibles, pueblan ConceptManual, emiten PDF vectorial sin alucinaciones y limitan repeatErrComun <= 2 en multi-sesión', async () => {
    for (const subject of ['Historia de México II', 'Biología I']) {
      const isHist = subject.includes('Historia');
      const nonMathWb = structuredClone(MATH_DEMO_WORKBOOK);
      nonMathWb.coverData.subjectName = subject;
      nonMathWb.blockName = `Bloque 1 · ${subject}`;
      if (nonMathWb.projectSection) {
        nonMathWb.projectSection = {
          ...nonMathWb.projectSection,
          artifactName: isHist ? 'Archivo histórico comunitario' : 'Bitácora de metabolismo celular',
          communityUtility: isHist
            ? 'Preservar la memoria agraria y cívica de la comunidad.'
            : 'Comprender procesos energéticos en cultivos y salud escolar.',
        };
      }
      nonMathWb.missions = [
        {
          ...nonMathWb.missions![0]!,
          title: `Misión 1 · ${subject}`,
          sessionTopic: isHist
            ? 'Revolución Mexicana y reforma agraria'
            : 'Metabolismo celular y respiración aerobia',
          sessionFocus: isHist
            ? 'Contrastar fuentes primarias y reformas constitucionales.'
            : 'Explicar rutas energéticas y síntesis de ATP.',
          phenomenonHook: {
            story: isHist
              ? 'Documentos parroquiales muestran demandas campesinas de 1910.'
              : 'Durante el ejercicio intenso, el músculo incrementa la demanda de ATP.',
            detonatingQuestion: isHist
              ? '¿Qué transformaciones impulsó el artículo 27?'
              : '¿Cómo produce ATP cada ruta metabólica?',
          },
          conceptZero: {
            physicalAnalogy: 'Un archivo vivo conecta testimonios y causas históricas.',
            coreExplanation: isHist
              ? 'Las fuentes primarias documentan los acuerdos sociales y transformaciones agrarias de 1910.'
              : 'Las células obtienen energía química mediante rutas metabólicas reguladas por enzimas.',
            contrastTable: [],
            solvedExample: { problemStatement: '', solutionSteps: [], interpretation: '' },
          },
          iDoSection: {
            stepByStepDemo: isHist
              ? 'Lectura guiada del texto constitucional identificando actores.'
              : 'Análisis comparativo entre glucólisis y ciclo de Krebs.',
            visualOrDiagram: '',
          },
          weDoSection: {
            guidedPractice: 'En equipos, redacten una síntesis basada en evidencias documentales.',
            workbookElements: [],
          },
          youDoSection: {
            autonomousChallenge: 'Conecta los hallazgos con un caso observable en tu comunidad.',
            workbookElements: [],
          },
          formativeCheckpoint: {
            question: '¿Qué evidencia sustenta tu análisis?',
            criteriaChecklist: [
              'Identifico causas, actores o mecanismos clave del fenómeno.',
              'Justifico conclusiones con evidencias verificables de la asignatura.',
            ],
            reflectionPrompts: [],
          },
          sessionPlans: [
            {
              sessionNumber: 1,
              objetivo: isHist
                ? 'Analizar fuentes primarias sobre el reparto agrario'
                : 'Explicar la función energética del ATP en la célula',
              motivacion: 'Contexto comunitario inicial.',
              saberesPrevios: 'Lectura comprensiva de textos.',
              contenido: isHist
                ? 'La Constitución de 1917 recogió demandas agrarias y laborales de distintos sectores.'
                : 'El ATP transfiere energía química hacia reacciones celulares esenciales.',
              ejemploResuelto: isHist
                ? 'Planteamiento: Analizar el artículo 27.\n1. Identificar el principio de propiedad nacional.\n2. Relacionar con ejidos locales.'
                : 'Planteamiento: Balance energético celular.\n1. Glucólisis en citosol.\n2. Ciclo de Krebs en mitocondria.',
              practica: [
                {
                  enunciado: 'Sintetiza dos argumentos centrales en tu cuaderno.',
                  pista: 'Subraya ideas principales.',
                  solucion: ['CLAVE_SECRETA'],
                },
              ],
              aplicacion: 'Conexión con problemáticas de tu comunidad.',
              autoevaluacion: ['Identifico causas y evidencias principales.'],
              recursos: [],
              productoIntegrador: 'Cuadro comparativo comentado.',
            },
          ],
        },
      ];

      const deck = buildSacrintDeck(nonMathWb, { mode: 'lesson-guide', missionIndex: 0 });
      const deckSerialized = JSON.stringify(deck);
      expect(deckSerialized).not.toMatch(/MODELO\s+POR\s+CONSTRUIR|Por\s+construir|Por\s+completar\s+en\s+el\s+libro/i);
      expect(deckSerialized).not.toMatch(/y\s*=\s*mx\s*\+\s*b|modelo\s+o\s+regla\s+matem[aá]tica/i);

      const info = buildSacrintInfographic(nonMathWb, 'wide', { missionIndex: 0 });
      expect(info.conceptManual).toBeDefined();
      expect(info.conceptManual!.conceptMap.length).toBeGreaterThanOrEqual(2);
      expect(info.conceptManual!.definitions.length).toBeGreaterThan(0);
      expect(info.conceptManual!.usageGuidance.length).toBeGreaterThan(0);

      const pdfBytes = await renderCombinedSacrintInfographicsPdf([info], 'wide');
      const parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
      const parsed = await parser.getText();
      await parser.destroy();
      const extracted = parsed.text.replace(/\s+/g, ' ').trim();
      expect(extracted.length).toBeGreaterThan(180);
      expect(extracted).not.toMatch(/RUTA\s+DE\s+APRENDIZAJE|MODELO\s+POR\s+CONSTRUIR/i);
      expect(extracted).not.toMatch(/y\s*=\s*mx\s*\+\s*b/i);
    }

    // Multi-session math deck: repeatErrComun <= 2 and clean formula without step number bleed
    const mathMultiWb = structuredClone(MATH_DEMO_WORKBOOK);
    mathMultiWb.missions = [
      {
        ...mathMultiWb.missions![0]!,
        conceptZero: {
          ...mathMultiWb.missions![0]!.conceptZero,
          contrastTable: [],
        },
        sessionPlans: [1, 2, 3, 4].map((num) => ({
          sessionNumber: num,
          objetivo: `Resolver ecuaciones lineales de costo en la situación ${num}`,
          motivacion: `Contexto comercial ${num}.`,
          saberesPrevios: 'Despeje básico.',
          contenido: 'Una ecuación lineal ax + b = c modela un costo total constante por unidad.',
          ejemploResuelto: `Problema: Resuelve 350x + 1500 = 5300.\n1. Resta 1500 en ambos lados: 350x = 3800.\n2. Divide entre 350: x = 10.86.`,
          practica: [
            {
              enunciado: `Calcula el costo total para ${num + 3} piezas con tarifa base $150.`,
              pista: 'Plantea la expresión lineal.',
              solucion: ['SECRETO'],
            },
          ],
          aplicacion: 'Presupuestos del negocio familiar.',
          autoevaluacion: ['Verifico el resultado sustituyendo x.'],
          recursos: [],
          productoIntegrador: 'Tabla comparativa.',
        })),
      },
    ];

    const mathDeck = buildSacrintDeck(mathMultiWb, { mode: 'lesson-guide', missionIndex: 0 });
    const misconceptionCounts = new Map<string, number>();
    for (const slide of mathDeck.slides) {
      if (slide.kind === 'concept') {
        const key = (slide.misconception || '').trim().toLowerCase();
        if (key) misconceptionCounts.set(key, (misconceptionCounts.get(key) || 0) + 1);
        for (const f of slide.formulas ?? []) {
          expect(f).not.toContain('3800. 2');
        }
      }
    }
    const maxRepeatErrComun = Math.max(0, ...misconceptionCounts.values());
    expect(maxRepeatErrComun).toBeLessThanOrEqual(2);
  });

  it('previene solapamiento 6-gram sin corromper Unicode ni género gramatical', () => {
    const overlapSource =
      'Evalúa el planteamiento geométrico se basa en la evidencia, el rigor, los criterios y el proyecto de clase.';
    const result = preventSixGramTheoryOverlap(
      'Evalúa el planteamiento geométrico se basa en la evidencia y el rigor de los criterios del proyecto.',
      [overlapSource]
    );
    expect(result).not.toContain('Evalúal');
    expect(result).not.toContain('se basa dentro de');
    expect(result).not.toContain('la producto');
    expect(result).not.toContain('un exactitud');
    expect(result).not.toContain('los pautas');
    expect(result).not.toContain('del iniciativa');
    expect(result).toContain('Evalúa el planteamiento geométrico');
  });

  it('normaliza puntuación huérfana, approx, artículos capitalizados tras preposición y flechas de prosa', () => {
    const out = textNorm.normalizeEditorialText(
      'Calcula (1.06)⁵ approx 1.33, ; estudia , : puntos.. críticos y sigue... para la difusión de La información. Esto => revisar.'
    );
    expect(out).toContain('≈ 1.33;');
    expect(out).toContain('estudia: puntos.');
    expect(out).toContain('sigue...');
    expect(out).not.toContain(', ;');
    expect(out).not.toContain(', :');
    expect(out).toContain('de la información');
    expect(out).toContain('Esto implica revisar');

    const properNoun = textNorm.normalizeEditorialText('Encuentro regional de La Paz en El Salvador.');
    expect(properNoun).toContain('de La Paz');
  });

  it('compacta pasos matemáticos conservando sistemas, pares tabulares, potencias y cadenas numéricas de raíces', () => {
    const sys = distillStepPreservingMath('Ecuación 1: 10x + 5y = 150 Ecuación 2: 2x + 3y = 50.', 80, 12);
    expect(sys).toContain('10x + 5y = 150');
    expect(sys).toContain('2x + 3y = 50');

    const fin = distillStepPreservingMath(
      'Identifica datos: Capital inicial (C) = $15,000 Tasa de interés anual (i) = 12% Tiempo (t) = 4 años.',
      80,
      12
    );
    expect(fin).toContain('C = $15,000');
    expect(fin).toContain('12%');
    expect(fin).toContain('4 años');

    const pair = distillStepPreservingMath('Despejando ambas variables obtenemos x = 4 e y = 9.', 80, 12);
    expect(pair).toContain('x = 4');
    expect(pair).toContain('y = 9');

    const tab = distillStepPreservingMath(
      'Evaluando: Si x = 0, y = 10 - 0.5(0) = 10; Si x = 2, y = 10 - 0.5(2) = 9; Si x = 4, y = 10 - 0.5(4) = 8; Si x = 6, y = 10 - 0.5(6) = 7.',
      80,
      12
    );
    expect(tab).toContain('(0,10)');
    expect(tab).toContain('(6,7)');

    const pythagoras = distillStepPreservingMath(
      'Aplica seis al cuadrado más ocho al cuadrado es igual a diez al cuadrado.',
      80,
      12
    );
    expect(pythagoras).toContain('6² + 8² = 10²');
    expect(pythagoras).not.toContain('ocho² = igual a');

    const disc = distillStepPreservingMath(
      'Calcula el discriminante Δ = b² - 4ac = (5)² - 4(2)(-3) = 25 - (-24) = 25 + 24 = 49.',
      80,
      12
    );
    expect(disc).toContain('Δ = b² - 4ac = 49');
  });

  it('filtra colas sueltas en fórmulas y colas de Rúbrica / raíces en ejemplos destilados', () => {
    const formulas = extractFormulasFromText('Modela con y = (3000 - 150x) / 300 y además x = -6 y x', 3);
    for (const f of formulas) {
      expect(f).not.toMatch(/\s+[xy]\s*$/i);
    }

    const bundle = distillLessonBundle(
      {
        missionIndex: 1,
        missionTitle: 'Ángulos',
        sessionTopic: 'Ángulos suplementarios',
        conceptZero: {
          coreExplanation: 'Dos ángulos suplementarios suman 180 grados en una recta.',
          physicalAnalogy: 'Un giro llano repartido en dos aberturas.',
          contrastTable: [],
          solvedExample: { problemStatement: '', solutionSteps: [], interpretation: '' },
        },
        weDoSection: { guidedPractice: 'Resuelve en parejas.', steps: [], collaborativePrompt: '' },
        youDoSection: { autonomousChallenge: 'Traza dos ángulos suplementarios en tu entorno.', checkpoints: [] },
        formativeCheckpoint: { question: '¿Cuánto suman?', criteriaChecklist: ['Plantea la suma igual a 180°.'] },
        reinforcement: { hints: [] },
      } as never,
      {
        sessionNumber: 1,
        objetivo: 'Resolver ángulos suplementarios',
        motivacion: 'Ángulos sobre una recta.',
        saberesPrevios: 'Suma de ángulos.',
        contenido: 'Dos ángulos suplementarios suman 180 grados.',
        ejemploResuelto:
          'Planteamiento: Determina x sabiendo que el primer ángulo mide 4x + 10°, mientras que el segundo ángulo mide 2x + 20°.\n1. Plantea (4x + 10) + (2x + 20) = 180.\n2. Resuelve 6x + 30 = 180 ⇒ 6x = 150.\n3. Con signos: x₁ = (-7 + 35.3412)/(2(1)) = 28.3412/2 = 14.1706 y x₂ = (-7 - 35.3412)/(2(1)) = -42.3412/2 = -21.1706.\nInterpretación: Raíces x₁ = 14.1706 y x₂ = -21.1706. Rúbrica: Coherencia 100%.',
        practica: [{ enunciado: 'Calcula ángulos suplementarios.', pista: 'Iguala la suma a 180°.' }],
        aplicacion: 'Diseño geométrico escolar.',
        autoevaluacion: ['Identifico ángulos suplementarios.'],
      } as never,
      { allowMissionFallback: false }
    );

    expect(bundle.example.problemStatement).toContain('4x + 10°');
    expect(bundle.example.problemStatement).toContain('2x + 20°');
    expect(fitter.hasDanglingEnding(bundle.example.problemStatement)).toBe(false);
    expect(bundle.example.interpretation).toContain('14.1706');
    expect(bundle.example.interpretation).toContain('-21.1706');
    expect(bundle.example.interpretation).not.toMatch(/R[uú]brica/i);
  });

  it('mantiene signo de cierre en preguntas, evita cortes huérfanos en pistas/verbos transitivos y reenumera premisas', () => {
    const q = fitter.fitPedagogicalText(
      '¿Cómo puedes modelar con ecuaciones lineales el consumo diario de agua y la tarifa mensual de servicio en tu comunidad?',
      { maxChars: 90, maxWords: 13, role: 'activity' }
    );
    expect(q.endsWith('?')).toBe(true);

    const hint = fitter.fitPedagogicalText(
      'Para determinar el punto de equilibrio entre dos tarifas mensuales distintas, iguala ambas expresiones lineales y despeja la incógnita x paso a paso.',
      { maxChars: 95, maxWords: 14, role: 'hint' }
    );
    expect(hint).not.toMatch(/^Para\s+[a-záéíóúñ]{3,}r\.?$/i);
    expect(fitter.hasDanglingEnding(hint)).toBe(false);

    const transitiveCut = fitter.repairDanglingEnding('Observa los datos del problema e indica.');
    expect(transitiveCut).not.toMatch(/\bindica\.?$/i);
    expect(fitter.hasDanglingEnding(transitiveCut)).toBe(false);

    const dupThesisWb = {
      coverData: { subjectName: 'Filosofía y Argumentación', schoolName: 'Plantel Test', teacherName: 'Docente Test' },
      subsystem: 'TELEBACHILLERATO',
      missions: [
        {
          missionIndex: 1,
          missionTitle: 'Argumentación racional',
          sessionTopic: 'Estructura de argumentos',
          sessionFocus: 'La argumentación ética exige razones verificables.',
          conceptZero: {
            coreExplanation: 'Un argumento articula tesis, premisas y conclusión.',
            physicalAnalogy: 'Puente sostenido por pilares.',
            contrastTable: [
              {
                commonMisconception: '',
                correctConcept: 'La conclusión deriva lógicamente de premisas válidas.',
                reasoning: 'Cada premisa respalda la tesis principal.',
              },
            ],
            solvedExample: {
              problemStatement: 'Evalúa un dilema comunitario.',
              solutionSteps: [
                'La argumentación ética exige razones verificables.',
                'Identifica evidencias concretas antes de concluir.',
              ],
              interpretation: 'La conclusión se apoya en hechos comprobables.',
            },
          },
          weDoSection: { guidedPractice: 'Analiza dos posturas.', steps: [], collaborativePrompt: '' },
          youDoSection: { autonomousChallenge: 'Redacta un argumento breve.', checkpoints: [] },
          formativeCheckpoint: { question: '¿Tu tesis tiene respaldo?', criteriaChecklist: ['Presenta premisas claras.'] },
          reinforcement: { hints: [] },
          sessionPlans: [
            {
              sessionNumber: 1,
              objetivo: 'Construir argumentos racionales con evidencias verificables',
              motivacion: 'Dilemas del entorno escolar.',
              saberesPrevios: 'Identificación de ideas principales.',
              contenido: 'La argumentación ética exige razones verificables.',
              ejemploResuelto:
                'Planteamiento: Evalúa un dilema comunitario.\n1. Identifica evidencias concretas antes de concluir.\n2. Redacta la conclusión con base en hechos comprobables.',
              practica: [
                {
                  enunciado: 'Analiza dos posturas y redacta un argumento breve.',
                  pista: 'Verifica cada evidencia antes de concluir.',
                },
              ],
              aplicacion: 'Debate escolar.',
              autoevaluacion: ['Presento premisas claras.'],
            },
          ],
        },
      ],
      projectSection: { artifactName: 'Ensayo breve', communityUtility: 'Debate escolar.' },
    } as unknown as Parameters<typeof buildSacrintDeck>[0];

    expect(() =>
      buildSacrintDeck(
        {
          ...dupThesisWb,
          missions: [{ ...dupThesisWb.missions![0]!, sessionPlans: [] }],
        } as unknown as Parameters<typeof buildSacrintDeck>[0],
        { mode: 'lesson-guide', missionIndex: 0 }
      )
    ).toThrow(/LESSON_GUIDE_NO_SESSIONS/);

    const philDeck = buildSacrintDeck(dupThesisWb, { mode: 'lesson-guide', missionIndex: 0 });
    const conceptSlide = philDeck.slides.find((s) => s.kind === 'concept');
    expect(conceptSlide?.kind).toBe('concept');
    if (conceptSlide?.kind === 'concept' && conceptSlide.diagram.kind === 'argument') {
      expect(conceptSlide.diagram.premises[0]?.label).toBe('PREMISA 1');
      const vars = buildDiagramVariables(conceptSlide.diagram);
      expect(vars.some((v) => v.symbol === 'O')).toBe(false);
      for (const v of vars) {
        expect(fitter.hasDanglingEnding(v.meaning)).toBe(false);
      }
    }
  });

  it('repara verbos futuros colgados en títulos cortos, compacta costos 2x2 y no confunde triángulos rectángulos con rectángulos', () => {
    const fixedTitle = fitter.finalizeVisibleText('Reducción para solucionar sistemas de ecuaciones 2x2 y contrastarás', {
      ensurePeriod: false,
    });
    expect(fixedTitle).toBe('Reducción para solucionar sistemas de ecuaciones 2x2');
    expect(fitter.hasDanglingEnding(fixedTitle)).toBe(false);

    const compactCost = fitter.fitPedagogicalText(
      'Precio unitario de balón (x) y de una red deportiva (y): 3 balones y 2 redes cuestan 1,700 pesos; 2 balones y 4 redes cuestan 1,600 pesos.',
      { maxChars: 96, maxWords: 15, role: 'problem' }
    );
    expect(compactCost).toContain('$1,700');
    expect(compactCost).toContain('$1,600');
    expect(compactCost.split(/\s+/).length).toBeLessThanOrEqual(22);

    const triVisual = dispatchVisual({
      subject: 'Pensamiento Matemático III',
      topic: 'Teorema de Pitágoras y triángulos rectángulos',
      context: 'En todo triángulo rectángulo con catetos 6 m y 8 m, c² = a² + b².',
      scope: 'session',
      sessionNumber: 6,
      missionNumber: 2,
    });
    expect(triVisual?.metadata?.isFallback).toBe(false);
    expect(triVisual?.metadata?.type).toBe('stem-triangle');
  });
});
