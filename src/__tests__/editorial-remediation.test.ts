import { describe, it, expect } from 'vitest';
import {
  isValidRenderableFormula,
  normalizeEditorialText,
} from '@/lib/editorial/text-normalization';
import { fitPedagogicalText, hasDanglingEnding, repairDanglingEnding } from '@/lib/editorial/pedagogical-text-fitter';
import {
  resolveChalkboardTopicTitle,
  resolveInfographicConceptTitle,
  sanitizeWorkbookTocTitle,
} from '@/lib/editorial/topic-title-resolver';
import { parseEjemploResuelto } from '@/lib/editorial/student-content-model';
import { composeDocumentTitle, normalizeBlockTitle } from '@/lib/document-branding';
import { classifyTopic } from '@/lib/visual-engine/topic-classifier';
import { dispatchVisual } from '@/lib/visual-engine/visual-dispatcher';
import { buildSacrintDiagram } from '@/lib/visual-engine/sacrint/diagrams';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';
import {
  buildSacrintDeck,
  buildSacrintInfographic,
} from '@/lib/visual-engine/sacrint/spec';
import {
  distillLessonBundle,
  distillStepPreservingMath,
  extractFormulasFromText,
  preventSixGramTheoryOverlap,
} from '@/lib/visual-engine/sacrint/content-distiller';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import { reviewBlockMaterials } from '@/lib/guide-engine/material-review';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import type { SessionPlan } from '@/types/work-textbook';
import JSZip from 'jszip';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { sanitizeMissionFocus } from '@/lib/editorial/topic-title-resolver';

function extractWordNGrams(text: string, n: number): Set<string> {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    grams.add(words.slice(i, i + n).join(' '));
  }
  return grams;
}

describe('Editorial Remediation & Multi-Subject Architectural Guarantees', () => {
  it('strips unit LaTeX delimiters while preserving real currency and cleaning raw LaTeX tokens', () => {
    const input =
      'Un terreno mide $45 \\text{ m}$ de largo con ángulo de $30^{\\circ}$ y pendiente $\\frac{3}{4}$; costo: $1,500.50 MXN.';
    const out = normalizeEditorialText(input);
    expect(out).not.toContain('\\text');
    expect(out).not.toContain('\\frac');
    expect(out).not.toContain('^{\\circ}');
    expect(out).not.toMatch(/\$45/);
    expect(out).not.toMatch(/\$30/);
    expect(out).toContain('$1,500.50');
    expect(out).toContain('30°');

    const logic = normalizeEditorialText('Si $p \\land q \\Rightarrow r$, calcula $\\sqrt{16}$ y $25\\%$.');
    expect(logic).not.toContain('\\land');
    expect(logic).not.toContain('\\Rightarrow');
    expect(logic).not.toContain('\\sqrt');
    expect(logic).not.toContain('\\%');
    expect(logic).toContain('⇒');
    expect(logic).toContain('√');
    expect(logic).toContain('25%');
  });

  it('rejects symbolic template variables and malformed tokens in isValidRenderableFormula', () => {
    expect(isValidRenderableFormula('a1*x + b1*y = c1')).toBe(false);
    expect(isValidRenderableFormula('y = a2*x + b2')).toBe(false);
    expect(isValidRenderableFormula('Modelo: ${formula} undefined')).toBe(false);
    expect(isValidRenderableFormula('2x + 3y = 12')).toBe(true);
    expect(isValidRenderableFormula('P(t) = 1000(1.035)^t')).toBe(true);
    expect(isValidRenderableFormula('2x + 2y = 40 (')).toBe(false);
    expect(isValidRenderableFormula('(x + y) = 10')).toBe(true);
  });

  it('unwraps spaced units, numeric exponent equations, and parenthesized z-score dollars without breaking currency', () => {
    expect(normalizeEditorialText('Ángulo $8 cm = 8 cm$ y lados $3² + 4² = 5²$')).toBe(
      'Ángulo 8 cm = 8 cm y lados 3² + 4² = 5²'
    );
    expect(normalizeEditorialText('Valor crítico ($1.645² = 2.706025) y tasa $0.06²')).toBe(
      'Valor crítico (1.645² = 2.706025) y tasa 0.06²'
    );
    expect(normalizeEditorialText('Presupuesto entre $400 y $200, saldo $1,500.50.')).toBe(
      'Presupuesto entre $400 y $200, saldo $1,500.50.'
    );
  });

  it('strips trailing unclosed parentheses in extractFormulasFromText', () => {
    const extracted = extractFormulasFromText(
      'Planteamos la ecuación 2x + 2y = 40 (que simplificada representa el perímetro).'
    );
    expect(extracted).toContain('2x + 2y = 40');
    expect(extracted.every((f) => !f.endsWith('('))).toBe(true);
  });

  it('splits period-hyphen clauses and preserves complete clause without mid-sentence slicing', () => {
    const slide28Step =
      'Interpreta el valor obtenido en el contexto del problema. - Significado: este parámetro resume las variaciones conjuntas de oferta, demanda, presupuesto disponible y margen operativo a lo largo de todo el semestre escolar para que el equipo decida con certeza técnica sin exceder los límites del taller.';
    const fitted = fitPedagogicalText(slide28Step, { maxChars: 76, maxWords: 10, role: 'step' });
    expect(fitted.length).toBeGreaterThan(10);
    // Invariante arquitectónico anti-truncamiento: selecciona la cláusula sustantiva completa
    // sin amputar palabras a mitad de oración ni dejar finales colgados.
    expect(fitted).not.toMatch(/^Interpreta el valor obtenido/i);
    expect(hasDanglingEnding(fitted)).toBe(false);
    expect(fitted.toLowerCase()).toContain('parámetro');
  });

  it('breaks subtoken 6-gram overlaps with natural Spanish synonyms and never emits rectos', () => {
    const theory =
      'Las ecuaciones lineales en el plano cartesiano con la metodología MGA-ERJ ayudan a optimizar el presupuesto de $1,200 en espacios recreativos juveniles para el bienestar psicosocial.';
    const sample =
      'Construye ecuaciones lineales en el plano cartesiano con la metodología MGA-ERJ para asignar el presupuesto de $1,200 en espacios recreativos juveniles.';
    const rewritten = preventSixGramTheoryOverlap(sample, [theory]);
    expect(rewritten.toLowerCase()).not.toContain('rectos');
    expect(rewritten.toLowerCase()).not.toContain('ecuaciones lineales en el plano cartesiano');
    expect(rewritten.toLowerCase()).not.toContain('presupuesto de $1,200 en espacios recreativos');
  });

  it('sanitizes truncated mission sessionFocus banners without dangling closings', () => {
    expect(
      sanitizeMissionFocus(
        'Sesión 1: Diagnóstico de espacios y activarás tus · Sesión 2: Modelado matemático de'
      )
    ).toBe('Sesión 1: Diagnóstico de espacios · Sesión 2: Modelado matemático');
  });

  it('keeps lesson-guide decks concise (avg <= 180w, max <= 220w) and titles <= 160 chars on rich multi-session workbooks', async () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    const sessions: SessionPlan[] = [1, 2, 3].map((num) => ({
      sessionNumber: num,
      objetivo: `Analizar ecuaciones lineales y variaciones proporcionales en contextos reales de la comunidad escolar paso a paso para la sesión ${num}.`,
      motivacion: '¿Cómo anticipar el costo total del lote escolar con evidencia gráfica y numérica?',
      saberesPrevios:
        'Responde las preguntas iniciales sobre presupuestos familiares, interpreta los datos de la tabla comparativa y comparte tus hipótesis iniciales con tu equipo.',
      contenido:
        'Una relación lineal modela cambios constantes entre dos magnitudes comunitarias mediante una pendiente y una ordenada al origen.',
      ejemploResuelto: [
        'Enunciado: Un taller escolar produce libretas con un costo fijo de $450 más $18 por cada unidad elaborada durante la jornada semanal.',
        'Paso 1: Identifica las variables del problema definiendo x como cantidad de libretas e y como costo total en pesos mexicanos.',
        'Paso 2: Sustituye los datos conocidos en la relación lineal y = 18x + 450 considerando el límite máximo de producción diaria autorizado.',
        'Paso 3: Calcula el costo para 25 libretas evaluando y = 18(25) + 450 = $900 pesos exactos dentro del presupuesto asignado.',
        'Conclusión: Significado: cada lote de 25 libretas requiere $900 totales manteniendo un incremento invariable de $18 por cada unidad.',
      ].join('\n'),
      practica: [
        {
          enunciado:
            'Calcula el importe total de producir 40 libretas si el costo fijo aumenta a $500 y se mantiene el costo variable de $18 por unidad.',
          pista: 'Sustituye x = 40 en la nueva relación y suma el costo fijo inicial antes de interpretar.',
          solucion: ['y = 18(40) + 500 = 1220'],
        },
        {
          enunciado:
            'Determina cuántas libretas completas se pueden elaborar con un presupuesto máximo de $1,220 pesos usando el modelo ajustado.',
          pista: 'Plantea la igualdad 18x + 500 = 1220 y despeja paso a paso.',
          solucion: ['x = 40 libretas'],
        },
      ],
      aplicacion:
        'Permite proyectar costos reales en emprendimientos locales, cooperativas estudiantiles y cotizaciones de servicio comunitario sin desfasar el presupuesto disponible.',
      productoIntegrador:
        'Tabla comparativa de escenarios de costo con ecuación lineal verificada y gráfica etiquetada en la bitácora del equipo.',
      recursos: [],
      autoevaluacion: [
        'Distingo costo fijo y tasa variable en un planteamiento real.',
        'Verifico que la solución numérica tenga sentido en el contexto.',
      ],
    }));

    wb.missions = wb.missions.map((m) => ({ ...m, sessionPlans: sessions }));

    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide', missionIndex: 0 });
    for (const slide of deck.slides) {
      expect(slide.title.length).toBeLessThanOrEqual(160);
    }

    const pptxBuf = await generateSacrintPptx(deck);
    const zip = await JSZip.loadAsync(pptxBuf);
    const slideFiles = Object.keys(zip.files)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort();
    expect(slideFiles.length).toBe(deck.slides.length);

    const wordCounts: number[] = [];
    for (const fname of slideFiles) {
      const xml = await zip.files[fname]!.async('string');
      const pBlocks = Array.from(xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)).map((m) => m[0]);
      const paraTexts = pBlocks
        .map((p) =>
          Array.from(p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
            .map((m) => m[1] || '')
            .join('')
            .trim()
        )
        .filter(Boolean);
      const joined = paraTexts.join(' ').trim();
      wordCounts.push(joined ? joined.split(/\s+/).length : 0);
    }

    const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    const max = Math.max(...wordCounts);
    expect(avg).toBeLessThanOrEqual(180);
    expect(max).toBeLessThanOrEqual(220);
  });

  it('deduplicates repeated Bloque N: Bloque N titles across normalization, extractor and branding', () => {
    expect(normalizeEditorialText('Bloque 1 (Corte 1): Bloque 1 (Corte 1) — Funciones')).toBe(
      'Bloque 1 (Corte 1) — Funciones'
    );
    expect(normalizeEditorialText('Bloque 1: Bloque 1 (Corte 1)')).toBe('Bloque 1 (Corte 1)');
    expect(normalizeBlockTitle('Bloque 1: Bloque 1 (Corte 1)', 1)).toBe('(Corte 1)');
    expect(composeDocumentTitle('Rúbrica de Evaluación', 1, 'Bloque 1: Bloque 1 (Corte 1)')).toBe(
      'Rúbrica de Evaluación · Bloque 1 (Corte 1)'
    );

    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    wb.blockName = 'Bloque 1: Bloque 1 (Corte 1)';
    const extracted = extractMaterialsFromWorkbook(wb);
    expect(extracted.metadata.blockName).toBe('Bloque 1 (Corte 1)');
    expect(extracted.guiaDelBloque).not.toContain('Bloque 1: Bloque 1');
  });

  it('fits pedagogical text cleanly without dangling endings or mid-sentence cuts', () => {
    const longText =
      'En esta actividad introductoria vamos a recordar conceptos generales de clase. Calcula el costo total con 25x + 150 = 650 considerando un presupuesto de $650. ¿Cuántas unidades completas se pueden adquirir?';
    const fitted = fitPedagogicalText(longText, { maxChars: 130, role: 'problem' });
    expect(hasDanglingEnding(fitted)).toBe(false);
    expect(fitted).toContain('25x + 150 = 650');
    expect(fitted).toMatch(/[.?!]$/);
    expect(hasDanglingEnding('Aplica la fórmula para')).toBe(true);
    expect(hasDanglingEnding('x + y =')).toBe(true);
  });

  it('resolves conceptual titles for chalkboard and closure infographics instead of administrative boilerplate', () => {
    const closureTitle = resolveInfographicConceptTitle({
      sessionObjective:
        'Versión depurada y validada de tu evidencia formativa sobre modelos cuadráticos y parábolas',
      missionSessionTopic: 'Evaluación y cierre',
      missionFocus: 'Ecuaciones cuadráticas y análisis del vértice',
      missionTitle: 'Misión 2: Modelos cuadráticos',
    });
    expect(closureTitle.toLowerCase()).not.toContain('versión depurada');
    expect(closureTitle.toLowerCase()).not.toContain('evidencia formativa');
    expect(closureTitle.toLowerCase()).toContain('cuadrátic');

    const chalk = resolveChalkboardTopicTitle({
      sessionObjective: 'Vas a identificar el uso de sistemas de ecuaciones 2x2 para modelar mezclas',
    });
    expect(chalk.toLowerCase()).not.toMatch(/^vas a/);
    expect(hasDanglingEnding(chalk)).toBe(false);
  });

  it('classifies population exponential growth separately from financial KPIs and avoids 3.5000000000000004% float drift', () => {
    const pack = resolveSacrintPack('Pensamiento Matemático III', 'BGE');
    const session: SessionPlan = {
      sessionNumber: 12,
      objetivo: 'Modelar el crecimiento poblacional exponencial con P(t) = 1000(1 + 0.035)^t',
      motivacion: 'Una localidad rural tiene 1,000 habitantes y crece 3.5% anual.',
      saberesPrevios: 'Potencias y porcentajes convertidos a decimal.',
      contenido:
        'El crecimiento poblacional compuesto sigue P(t) = P₀(1 + r)^t, donde r = 0.035 es la tasa demográfica anual.',
      ejemploResuelto:
        'Calcula la población tras t = 10 años usando P(10) = 1000(1.035)^10 = 1,411 habitantes.',
      practica: [
        {
          enunciado: 'Estima la población en t = 5 años con P₀ = 1000 y r = 3.5%.',
          pista: 'Sustituye t = 5 en P(t) = 1000(1.035)^t.',
        },
      ],
      aplicacion: 'Sirve para planear cobertura de agua potable y aulas escolares en el municipio.',
      autoevaluacion: ['Interpreto P₀ y la tasa demográfica en modelos exponenciales.'],
      recursos: [],
      productoIntegrador: 'Proyección demográfica de la localidad a 10 años.',
    };

    const cls = classifyTopic({
      title: session.objetivo,
      concepts: session.contenido,
      example: session.ejemploResuelto,
    });
    expect(cls.kind).toBe('exponential');
    expect(cls.exponentialContext).toBe('population');

    const mission = structuredClone(MATH_DEMO_WORKBOOK.missions![0]!);
    const diag = buildSacrintDiagram(mission, pack, { session, allowMissionFallback: false });
    const serialized = JSON.stringify(diag);
    expect(serialized).not.toContain('3.5000000000000004');
    expect(serialized).not.toMatch(/capitalizaci[oó]n financiera|utilidad|\$1,?000/i);
  });

  it('keeps teacher lesson-guide deck compact (avg<=180, max<=220 words), with 0 six-gram theory overlap and session-scoped misconceptions', () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    const s1: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Modelar el crecimiento poblacional exponencial con tasas demográficas',
      motivacion: 'En la comunidad la población inicial de 2000 habitantes aumenta 3.5% anual.',
      saberesPrevios: 'Conversión de porcentajes a razón decimal.',
      contenido:
        'Un modelo exponencial demográfico multiplica repetidamente por el factor de crecimiento unitario durante cada periodo temporal consecutivo para proyectar censos futuros con precisión estadística.',
      ejemploResuelto:
        'Con P(t) = 2000(1.035)^t, evalúa t = 4 años.\n1. Suma 1 + 0.035 = 1.035.\n2. Eleva 1.035^4 ≈ 1.1475.\n3. Multiplica por 2000 para obtener 2295 habitantes.',
      practica: [
        {
          enunciado: 'Calcula P(6) para 2000 habitantes al 3.5% anual.',
          pista: 'Usa el factor 1.035 elevado a 6.',
        },
      ],
      aplicacion: 'Permite anticipar demanda de servicios comunitarios en años posteriores.',
      autoevaluacion: ['Distingo crecimiento exponencial de crecimiento lineal.'],
      recursos: [],
      productoIntegrador: 'Gráfica de proyección demográfica.',
    };
    const s2: SessionPlan = {
      sessionNumber: 2,
      objetivo: 'Calcular margen de error muestral en encuestas escolares',
      motivacion: 'El plantel aplicará una encuesta de alimentación saludable a 100 estudiantes.',
      saberesPrevios: 'Porcentaje y tamaño de muestra.',
      contenido:
        'El margen de error cuantifica la incertidumbre estadística de una encuesta aleatoria representativa mediante desviaciones estándar y niveles de confianza previamente definidos.',
      ejemploResuelto:
        'Para n = 100 con margen del 5%: e = 0.05.\n1. Convierte 5% a 0.05.\n2. Sustituye en la fórmula de tamaño muestral.',
      practica: [
        {
          enunciado: 'Determina el decimal equivalente a un margen de error de 4%.',
          pista: 'Divide el porcentaje entre 100.',
        },
      ],
      aplicacion: 'Ayuda a diseñar encuestas confiables para diagnóstico escolar.',
      autoevaluacion: ['Convierto porcentajes de error a decimales antes de calcular.'],
      recursos: [],
      productoIntegrador: 'Ficha técnica de encuesta comunitaria.',
    };
    wb.missions![0]!.coveredSessions = [1, 2];
    wb.missions![0]!.sessionPlans = [s1, s2];
    // Ensure infographic closure title regression doesn't trigger
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
    const infographic = buildSacrintInfographic(wb, 'wide');
    expect(infographic.title.toLowerCase()).not.toContain('versión depurada');

    // Word budget check across all slides
    const wordCounts = deck.slides.map((s) => JSON.stringify(Object.values(s)).split(/\s+/).filter(Boolean).length);
    const avgWords = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    const maxWords = Math.max(...wordCounts);
    expect(avgWords).toBeLessThanOrEqual(180);
    expect(maxWords).toBeLessThanOrEqual(220);

    // Check 0 6-grams copied verbatim from student textbook theory (`contenido`) on teaching slides
    const s1TheoryGrams = extractWordNGrams(s1.contenido, 6);
    const s2TheoryGrams = extractWordNGrams(s2.contenido, 6);
    const lessonSlidesText = deck.slides
      .filter((s) => s.kind !== 'cover')
      .map((s) => JSON.stringify(s))
      .join(' ');
    for (const g of [...s1TheoryGrams, ...s2TheoryGrams]) {
      expect(lessonSlidesText.toLowerCase()).not.toContain(g);
    }

    // Check session-scoped misconceptions (no quadratic formula misconception in statistics session)
    const statsConcept = deck.slides.find((s) => s.kind === 'concept' && s.sessionNumber === 2);
    expect(statsConcept?.kind).toBe('concept');
    if (statsConcept && statsConcept.kind === 'concept') {
      expect(statsConcept.misconception.toLowerCase()).not.toContain('discriminante');
      expect(statsConcept.misconception.toLowerCase()).toContain('margen de error');
    }

    const review = reviewBlockMaterials({ workbook: wb, deck, infographic, checkFullBlockPersistence: false });
    expect(review.errors.filter((e) => e.material === 'deck' || e.material === 'infographic')).toHaveLength(0);
  });

  it('distills non-math subjects with incomplete session fields without math fallbacks', () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    wb.coverData.subjectName = 'Biología';
    const mission = structuredClone(wb.missions![0]!);
    const incompleteBioSession: SessionPlan = {
      sessionNumber: 4,
      objetivo: 'Analizar el flujo de energía entre niveles tróficos en un ecosistema',
      motivacion: '',
      saberesPrevios: '',
      contenido: 'Los productores primarios captan energía solar mediante fotosíntesis.',
      ejemploResuelto: '',
      practica: [],
      aplicacion: '',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: '',
    };

    const bundle = distillLessonBundle(mission, incompleteBioSession, { allowMissionFallback: false });
    const joined = JSON.stringify(bundle).toLowerCase();
    expect(joined).not.toContain('datos e incógnitas');
    expect(joined).not.toContain('resultado numérico');
    expect(joined).not.toContain('jerarquía de operaciones');
    expect(joined).not.toContain('medición, presupuesto o diseño');
    expect(joined).not.toContain('undefined');
  });

  it('preserves currency delimiters before inline math variables like ($i$) across newlines', () => {
    const input = 'Capital inicial: $15,000\nTasa de interés anual ($i$): 8% compuesto.';
    const out = normalizeEditorialText(input);
    expect(out).toContain('$15,000');
    expect(out).not.toMatch(/\$(?!\d)/);
    expect(out).toContain('(i)');
  });

  it('keeps numbered sub-equations 1) y 2) inside Paso 1 when explicit Paso N markers exist', () => {
    const parsed = parseEjemploResuelto(
      'Plantea un sistema de ecuaciones.\nPaso 1: Escribe ambas ecuaciones del problema:\n1) x + y = 10\n2) x - y = 4\nPaso 2: Suma término a término para obtener 2x = 14, por lo que x = 7.'
    );
    expect(parsed.pasos).toHaveLength(2);
    expect(parsed.pasos[0]).toContain('x + y = 10');
    expect(parsed.pasos[0]).toContain('x - y = 4');
    expect(parsed.pasos[1]).toContain('2x = 14');
  });

  it('prevents lone "congruencia" rubric prose and geometry analogies from overriding linear/exponential models', () => {
    const cls = classifyTopic({
      title: 'Modelado de costos lineales',
      objective: 'Calcula el costo total y verifica la congruencia total de tu evidencia formativa',
    });
    expect(cls.kind).not.toBe('geometry');

    const linearVisual = dispatchVisual(
      'Pensamiento Matemático III',
      'Modelado de costos lineales',
      'Un servicio cobra f(x) = 15x + 120. Verifica la congruencia total de tu evidencia formativa.',
      1
    );
    const linearAnnot = (linearVisual?.annotations ?? []).map((a) => a.text).join(' ').toLowerCase();
    expect(linearVisual?.metadata?.type).not.toBe('triangle');
    expect(linearAnnot).not.toContain('lll');
    expect(linearAnnot).not.toContain('lal');

    const expVisual = dispatchVisual({
      subject: 'Pensamiento Matemático III',
      topic: 'Interés compuesto y crecimiento exponencial',
      context:
        'Un capital de $15,000 crece al 8% anual con M = C_0(1+i)^t. Como analogía puedes pensar en la congruencia de triángulos o el teorema de Pitágoras.',
      scope: 'session',
      missionNumber: 1,
      sessionNumber: 7,
    });
    const expAnnot = (expVisual?.annotations ?? []).map((a) => a.text).join(' ').toLowerCase();
    expect(expVisual?.metadata?.type).not.toBe('triangle');
    expect(expAnnot).not.toContain('pitágoras');
    expect(expAnnot).not.toContain('hipotenusa');
  });

  it('extracts authentic principal $12,000 over age-range numbers like "población de 15 a 19 años"', () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    const mission = structuredClone(wb.missions![0]!);
    const pack = resolveSacrintPack('Pensamiento Matemático III');
    const session: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Modelar el interés compuesto en finanzas juveniles',
      motivacion: 'Para la población de 15 a 19 años (50 encuestados en la escuela), ahorrar temprano marca la diferencia.',
      saberesPrevios: 'Porcentaje y potencias.',
      contenido: 'La fórmula exponencial es M = C_0(1 + i)^t donde C_0 es el capital inicial.',
      ejemploResuelto: 'Calcula el monto acumulado si inviertes C_0 = $12,000 al 8% anual durante t = 5 años.',
      practica: [{ enunciado: 'Compara con 10 años.', pista: 'Sustituye t = 10.' }],
      aplicacion: 'Proyecta tu fondo universitario.',
      autoevaluacion: ['Verifico C_0 y tasa anual.'],
      recursos: [],
      productoIntegrador: 'Tabla de proyección.',
    };

    const diagram = buildSacrintDiagram(mission, pack, { session, allowMissionFallback: false });
    expect(diagram.kind).toBe('exponential');
    if (diagram.kind === 'exponential') {
      expect(diagram.principal).toBe(12000);
    }
  });

  it('ignores bare "**Sesión N**" headers and cleans verbs/boilerplate in resolveChalkboardTopicTitle and sanitizeWorkbookTocTitle', () => {
    const resolved = resolveChalkboardTopicTitle({
      conceptosClave:
        '**Sesión 4**\nFundamentación teórica, el procedimiento para resolver sistemas de ecuaciones 2x2.\n**Sesión 10**\nCierre de bloque.',
      sessionObjective:
        'Visualizarás las rectas de un sistema 2x2 y presentarás tus resultados ante el grupo',
      missionTitle: 'Sistemas lineales',
    });
    expect(resolved).not.toMatch(/^sesi[oó]n\s*\d+$/i);
    expect(resolved.toLowerCase()).not.toMatch(/^visualizar[aá]s\b/);
    expect(resolved.toLowerCase()).not.toContain('fundamentación teórica');
    expect(resolved.toLowerCase()).not.toContain('y presentarás tus resultados');
    expect(resolved.toLowerCase()).toMatch(/sistema|rectas/);
    expect(hasDanglingEnding(resolved)).toBe(false);

    const fixed1 = sanitizeWorkbookTocTitle('Análisis de costos — y activarás tus', 'Modelado lineal');
    const fixed2 = sanitizeWorkbookTocTitle('Resolución de problemática de', 'Ecuaciones lineales');
    const preserved = sanitizeWorkbookTocTitle('Modelado de funciones lineales en costos');
    expect(hasDanglingEnding(fixed1)).toBe(false);
    expect(hasDanglingEnding(fixed2)).toBe(false);
    expect(preserved).toBe('Modelado de funciones lineales en costos');
  });

  it('strips "(en aula)" splices, meta-boilerplate, and 6-gram textbook overlaps across lesson-guide deck and infographic', () => {
    const wb = structuredClone(MATH_DEMO_WORKBOOK);
    wb.projectSection.artifactName = 'Portafolio en versión depurada con lista de cotejo y escala estimativa';
    wb.evaluationSection.rubric = [
      { criterion: 'Entrega de evidencia formativa con escala estimativa y lista de cotejo', weightPercent: 50, levels: [] },
    ];
    wb.missions = wb.missions!.map((m, idx) => ({
      ...m,
      sessionPlans:
        idx === 0 && !(m.sessionPlans && m.sessionPlans.length > 0)
          ? [
              {
                sessionNumber: 1,
                objetivo: 'Analizar la variación lineal del costo total en un servicio escolar',
                motivacion: 'En la cooperativa escolar se cobra una cuota fija base más un cargo por copia.',
                saberesPrevios: 'Identifica variables dependientes e independientes en una tabla de precios.',
                contenido:
                  'Una función lineal relaciona dos variables mediante una razón de cambio constante llamada pendiente y una ordenada al origen.',
                ejemploResuelto:
                  'Un taller cobra $120 de inscripción y $15 por hora. Paso 1: Identifica pendiente m = 15 y ordenada b = 120. Paso 2: Modela C(x) = 15x + 120.',
                practica: [
                  {
                    enunciado: 'Calcula el costo total para 8 horas de taller.',
                    pista: 'Sustituye x = 8 en C(x) = 15x + 120.',
                  },
                ],
                aplicacion:
                  'Compara tarifas locales donde una función lineal relaciona dos variables mediante cambio constante en versión depurada.',
                autoevaluacion: ['Identifico m y b en tablas cotidianas con evidencia formativa.'],
                recursos: [],
                productoIntegrador: 'Tabla comparativa en versión depurada con lista de cotejo.',
              },
            ]
          : m.sessionPlans,
      troubleshooting: [
        {
          id: 'ts-1',
          symptom: 'Entregar versión depurada sin validar evidencia formativa',
          rootCause: 'Falta revisión con lista de cotejo',
          solutionSteps: ['Revisar con lista de cotejo'],
          preventionTip: 'Revisar antes con la escala estimativa',
        },
      ],
    }));

    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide', missionIndex: 0 });
    const infographic = buildSacrintInfographic(wb, 'wide', { missionIndex: 0 });

    for (const payload of [JSON.stringify(deck).toLowerCase(), JSON.stringify(infographic).toLowerCase()]) {
      expect(payload).not.toContain('(en aula)');
      expect(payload).not.toContain('versión depurada');
      expect(payload).not.toContain('evidencia formativa');
      expect(payload).not.toContain('escala estimativa');
      expect(payload).not.toContain('lista de cotejo');
    }

    const mission = wb.missions![0]!;
    const theoryTexts = [
      mission.conceptZero?.coreExplanation,
      mission.conceptZero?.narrativeExplanation,
      ...(mission.sessionPlans ?? []).map((s) => s.contenido),
    ].filter((t): t is string => Boolean(t));

    const theory6Grams = new Set<string>();
    for (const t of theoryTexts) {
      for (const gram of extractWordNGrams(t, 6)) {
        theory6Grams.add(gram);
      }
    }

    const slideStrings: string[] = [];
    for (const slide of deck.slides) {
      if (slide.kind === 'cover') {
        slideStrings.push(
          slide.title,
          ...(slide.subtitle ? [slide.subtitle] : []),
          ...(slide.footerNote ? [slide.footerNote] : []),
          ...(slide.topicsCovered ?? [])
        );
      } else if (slide.kind === 'concept') {
        slideStrings.push(
          slide.title,
          ...(slide.subtitle ? [slide.subtitle] : []),
          slide.misconception,
          ...(slide.workedExample
            ? [slide.workedExample.problemStatement, ...slide.workedExample.steps, slide.workedExample.interpretation]
            : [])
        );
      } else if (slide.kind === 'practice') {
        slideStrings.push(
          slide.title,
          ...(slide.artifactName ? [slide.artifactName] : []),
          ...(slide.applicationText ? [slide.applicationText] : []),
          ...(slide.exitChecks ?? []),
          ...(slide.activities ?? []).map((a) => `${a.statement} ${a.hint ?? ''}`)
        );
      }
    }

    const foundOverlaps: string[] = [];
    for (const txt of slideStrings) {
      for (const gram of extractWordNGrams(txt, 6)) {
        if (theory6Grams.has(gram)) foundOverlaps.push(gram);
      }
    }
    expect(foundOverlaps).toEqual([]);
  });

  it('unwraps closed numeric LaTeX spans without desynchronizing subsequent math pairs or glueing tokens', () => {
    const quad = normalizeEditorialText(
      'Simplifica dividiendo toda la ecuación entre $4$: $x^2 + 15x - 100 = 0$. Identifica $a = 1$, $b = 15$, $c = -100$. La raíz cuadrada del discriminante es $\\sqrt{625} = 25$. Sustituye en la fórmula: $x = (-15 \\pm 25)/(2(1))$. Con $5\\text{ metros}$ y presupuesto de $400 pesos.'
    );
    expect(quad).not.toMatch(/entre \$4|\$4:|\$4\$/);
    expect(quad).not.toContain('$√');
    expect(quad).not.toContain('Identificaa');
    expect(quad).not.toContain('1,b');
    expect(quad).not.toContain('4:x');
    expect(quad).toContain('entre 4: x² + 15x - 100 = 0');
    expect(quad).toContain('Identifica a = 1, b = 15, c = -100');
    expect(quad).toContain('√625 = 25');
    expect(quad).toContain('$400 pesos');

    const exp = normalizeEditorialText(
      'Multiplica la tasa $0.025$ por el tiempo de 8 años para obtener el exponente de la base $e$, luego eleva $e$ a esa potencia. Población inicial ($P_0$): $4500$, tasa ($r$): $0.035$, proyección: $6348$ jóvenes.'
    );
    expect(exp).not.toContain('$');
    expect(exp).toContain('tasa 0.025 por el tiempo');
    expect(exp).toContain('base e, luego eleva e');
    expect(exp).toContain('6348 jóvenes');
  });

  it('detects and repairs sliced 2-letter prepositional stubs, capitalizes em-dash TOC suffixes, and trims bloated steps/parentheticals', () => {
    expect(hasDanglingEnding('vulnerabilidad ante conductas de riesgo derivadas de fa')).toBe(true);
    const repaired = repairDanglingEnding('vulnerabilidad ante conductas de riesgo derivadas de fa', true);
    expect(hasDanglingEnding(repaired)).toBe(false);
    expect(repaired).not.toMatch(/\bde\s+fa\.?$/i);

    expect(
      sanitizeWorkbookTocTitle('Metodológico y Procedimientos Clave — gráfico y determinantes aplicados a sistemas 2x2.')
    ).toBe('Metodológico y Procedimientos Clave — Gráfico y determinantes aplicados a sistemas 2x2.');

    const bloatedStep = fitPedagogicalText(
      'Evaluamos la función para los valores m = {0, 1, 2, 3, 4, 5} sustituyendo en la ecuación: - Para m = 0: C = 1200(0) + 3500 = 3500 - Para m = 1: C = 1200(1) + 3500 = 4700 - Para m = 2: C = 1200(2) + 3500 = 5900',
      { maxChars: 62, maxWords: 10, role: 'step' }
    );
    expect(bloatedStep.split(/\s+/).length).toBeLessThanOrEqual(15);
    expect(bloatedStep).not.toContain('- Para m = 2');

    const longAct = fitPedagogicalText(
      'Se depositan C = 20,000 pesos en una cuenta que paga interés compuesto del i = 6% anual (lo que equivale a n = 4 periodos semestrales con una tasa semestral de i_s = 3%).',
      { maxChars: 84, maxWords: 13, role: 'activity' }
    );
    expect(longAct).not.toContain('lo que equivale');
    expect(longAct).toContain('i = 6%');
    expect(longAct.split(/\s+/).length).toBeLessThanOrEqual(18);

    const noCommaStep = fitPedagogicalText(
      'Para ello se definen con absoluta precisión seis vértices distintos en el plano cartesiano local unidos mediante segmentos rectos de perímetro constante.',
      { maxChars: 62, maxWords: 9, role: 'step' }
    );
    // Sin recorte destructivo intra-oración: conserva la oración completa sin amputar "perímetro constante."
    expect(noCommaStep).toContain('perímetro constante');
    expect(hasDanglingEnding(noCommaStep)).toBe(false);
  });

  it('prevents adjacent word duplication and breaks newly covered theory 6-grams cleanly', () => {
    const theory = [
      '¿Logré realizar correctamente la tabulación y la representación gráfica en papel milimétrico? Propiedad geométrica de los ángulos suplementarios cuya suma total debe ser 180 grados. Sustituye los valores de a, b y c en la fórmula general x = (-b ± √(b² - 4ac))/(2a). Cálculo de intereses simples y compuestos. Criterios de congruencia de triángulos y el Teorema de Napoleón.',
    ];
    const cleanCheck = preventSixGramTheoryOverlap(
      '¿Logré realizar correctamente la tabulación y la representación gráfica en papel milimétrico?',
      theory
    );
    expect(cleanCheck.toLowerCase()).not.toContain('representación representación');
    expect(cleanCheck.toLowerCase()).not.toContain('hoja milimétrico');
    expect(cleanCheck.toLowerCase()).not.toContain('representación esquema');

    for (const phrase of [
      'Propiedad geométrica de los ángulos suplementarios cuya suma total debe ser 180 grados.',
      'Sustituye los valores de a, b y c en la fórmula general x = (-b ± √(b² - 4ac))/(2a).',
      'Cálculo de intereses simples y compuestos',
      'Criterios de congruencia de triángulos y el Teorema de Napoleón',
    ]) {
      const rewritten = preventSixGramTheoryOverlap(phrase, theory);
      const overlap = [...extractWordNGrams(rewritten, 6)].filter((g) => extractWordNGrams(theory[0]!, 6).has(g));
      expect(overlap).toEqual([]);
    }

    const eqStep = distillStepPreservingMath(
      "Paso 3: Iguala ambas expresiones para eliminar 'x' y resuelve la ecuación lineal resultante con la variable 'y':\n(1700 - 2y) / 3 = (1600 - 4y) / 2\n2(1700 - 2y) = 3(1600 - 4y)\n3400 - 4y = 4800 - 12y\n-4y + 12y = 4800 - 3400\n8y = 1400\ny = 1400 / 8 = 175 pesos (precio de cada red).",
      62,
      9
    );
    expect(eqStep).toContain('(1700 - 2y) / 3 = (1600 - 4y) / 2');
    expect(eqStep).toContain('175 pesos');
    expect(eqStep).not.toMatch(/\(\d+\s*-\s*$/);
  });
});
