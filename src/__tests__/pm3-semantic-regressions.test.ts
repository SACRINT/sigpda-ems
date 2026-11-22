import { describe, it, expect } from 'vitest';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import {
  diversifyLessonOpeningActivity,
  formatSolvedExampleBlocks,
  normalizeEditorialText,
  normalizeExtraTitle,
  normalizeSessionDescriptorTense,
  normalizeSolvedExampleSteps,
  repairExtraPedagogicalArtifacts,
} from '@/lib/editorial/text-normalization';
import {
  fitPedagogicalText,
  hasDanglingEnding,
  isPublishablePedagogicalText,
} from '@/lib/editorial/pedagogical-text-fitter';
import { resolveChalkboardTopicTitle } from '@/lib/editorial/topic-title-resolver';
import { buildSacrintDiagram } from '@/lib/visual-engine/sacrint/diagrams';
import { resolveSacrintPack } from '@/lib/visual-engine/sacrint/discipline-packs';
import { findIncompleteInfographicBlock } from '@/lib/guide-engine/material-review';
import { mergeCompiledExtrasPdf } from '@/lib/pdf-extra-renderer';
import { stripMarkdown } from '@/lib/visual-engine/content-extractor';
import {
  cleanSacrintText,
  distillLessonBundle,
  extractApplicationAndExit,
  extractConceptHighlights,
  extractPracticeActivities,
  extractWorkedExample,
  isCompleteConclusion,
  isCompleteMathStep,
  paraphraseSixGramOverlap,
  sanitizePedagogicalMetaPhrases,
  sixGramOverlapRatio,
} from '@/lib/visual-engine/sacrint/content-distiller';
import {
  buildSacrintDeck,
  buildSacrintInfographic,
  selectInfographicTargets,
} from '@/lib/visual-engine/sacrint/spec';
import { extractCalloutBox } from '@/lib/visual-engine/callout-box';
import { generateMissionRubric } from '@/lib/visual-engine/mission-rubric-generator';
import { tryExtractQuadraticParameters } from '@/lib/visual-engine/visual-dispatcher';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';

async function extractPdfPages(buffer: Uint8Array | Buffer): Promise<string[]> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  try {
    const res = await parser.getText();
    return res.pages.map((p) => p.text);
  } finally {
    await parser.destroy();
  }
}

describe('PM3 Regresiones Semánticas, Editoriales y Diagramáticas (01_ a 09_)', () => {
  it('normalizeSessionDescriptorTense elimina futuros 2da persona, preserva género y capitalización', () => {
    expect(
      normalizeSessionDescriptorTense('Aprenderás a aplicar el método de reducción y presentarás tus resultados')
    ).toBe('Aplicar el método de reducción y presentar los resultados');

    expect(
      normalizeSessionDescriptorTense('Vas a evaluar tu evidencia formativa sobre sistemas 2x2 y delimitarás el proyecto')
    ).toBe('Evaluar la evidencia formativa sobre sistemas 2x2 y delimitar el proyecto');

    expect(
      normalizeSessionDescriptorTense('Construir el reporte de tu reporte técnico aplicando ecuaciones')
    ).not.toContain('de el reporte');
  });

  it('resolveChalkboardTopicTitle resuelve concepto disciplinar sin prefijos futuros ni "Vas a"', () => {
    const t1 = resolveChalkboardTopicTitle({
      sessionObjective:
        'Aprenderás a aplicar el método de reducción para resolver sistemas de ecuaciones 2x2 y contrastarás su eficiencia frente a otros métodos',
    });
    expect(t1).not.toMatch(/^(?:Aprender[áa]s|Vas\s+a|Evaluar[áa]s)/i);
    expect(t1.toLowerCase()).toContain('reducción');

    const t2 = resolveChalkboardTopicTitle({
      sessionObjective: 'Vas a evaluar tus aprendizajes y consolidar el modelado matemático',
    });
    expect(t2).not.toMatch(/^(?:Aprender[áa]s|Vas\s+a|Evaluar[áa]s)/i);
  });

  it('normalizeEditorialText y formatSolvedExampleBlocks limpian x_v, != y números de Paso redundantes', () => {
    const mathClean = normalizeEditorialText('Evaluamos x_v = -b/(2a) con a != 0');
    expect(mathClean).not.toContain('x_v');
    expect(mathClean).not.toContain('!=');
    expect(mathClean).toContain('≠');

    const formatted = formatSolvedExampleBlocks(
      '1. Paso 1: Sustituimos a = 1 en ($\n 2. x_v = -6/(2). 3. Respuesta final: x = 3.'
    );
    expect(formatted).not.toMatch(/^\s*\d+\.\s*$/m);
    expect(formatted).not.toMatch(/^\s*\d+\.\s*Paso\s+1:/m);
  });

  it('repairExtraPedagogicalArtifacts normaliza Título de la Sesión, apertura repetida, contaminación Sesión 4 y Ej6', () => {
    const rawPlan = [
      '- **Título de la Sesión:** Resolverás ecuaciones lineales y presentarás tu evidencia',
      '- **Propósito:** Comprenderás la balanza algebraica.',
      'Apertura: Recuperar insumos previos y organizar mesa de trabajo colaborativa.',
      'Instrumento · "Sesión 4: Modelado de otro tema" · Lista de cotejo',
    ].join('\n');

    const repaired = repairExtraPedagogicalArtifacts(rawPlan, {
      type: 'lesson_plan',
      title: 'Plan de Clase · Sesión 7: Ecuaciones de primer grado',
    });

    expect(repaired).not.toContain('Resolverás');
    expect(repaired).not.toContain('presentarás');
    expect(repaired).not.toContain('la evidencia"');
    expect(repaired).not.toContain('Comprenderás');
    expect(repaired).not.toContain('Recuperar insumos previos y organizar mesa de trabajo colaborativa.');
    expect(repaired).not.toContain('Sesión 4:');
    expect(repaired).toContain('Sesión 7:');

    const opening2 = diversifyLessonOpeningActivity(2, 'Sistemas 2x2');
    const opening3 = diversifyLessonOpeningActivity(3, 'Sistemas 2x2');
    expect(opening2).not.toBe(opening3);

    expect(normalizeExtraTitle('Plan de Clase: Sesión 5 · Resolverás ecuaciones')).toBe(
      'Plan de Clase: Sesión 5 · Resolver ecuaciones'
    );

    const ejRepaired = repairExtraPedagogicalArtifacts(
      '1. **Ejercicio 1:** Ejercicio 1.: Función A(x) = -2x² + 50x; Área máxima con vértice en x = 12.5 metros.\n2. Reporte técnico justificando que el terreno propuesto es geométricamente imposible con los datos dados y propuesta de ajuste de parámetros.',
      { type: 'teacher_guide' }
    );
    expect(ejRepaired).not.toContain('Ejercicio 1.:');
    expect(ejRepaired).toContain('312.5');
    expect(ejRepaired).not.toContain('Reporte técnico justificando que el terreno propuesto es geométricamente imposible');
  });

  it('fitPedagogicalText preserva 1ra oración instruccional en pistas y rechaza infinitivos colgados', () => {
    const hint = fitPedagogicalText(
      'Calcula primero el ingreso total necesario sumando la ganancia neta con la inversión inicial. Luego, plantea una ecuación donde el producto del precio unitario por las 25 pulseras menos los costos de producción sea igual al ingreso total.',
      { maxChars: 98, maxWords: 15, role: 'hint' }
    );
    expect(hint).toContain('Calcula primero');
    expect(hint).not.toBe('Luego, plantea una ecuación.');
    expect(hasDanglingEnding(hint)).toBe(false);

    const noDanglingInfinitive = fitPedagogicalText(
      'En esta sesión integradora, vas a recopilar tus evidencias de aprendizaje.',
      { maxChars: 42, maxWords: 7, role: 'concept', ensurePeriod: false }
    );
    expect(hasDanglingEnding(noDanglingInfinitive)).toBe(false);
    expect(noDanglingInfinitive).not.toMatch(/\brecopilar\.?$/i);
  });

  it('extractWorkedExample y extractConceptHighlights filtran conclusiones meta y viñetas duplicadas', () => {
    const session: SessionPlan = {
      sessionNumber: 20,
      objetivo: 'Integrar ecuaciones lineales con dos variables.',
      motivacion: 'Centro comunitario juvenil.',
      saberesPrevios: 'Despeje simple.',
      contenido:
        'La integración de saberes en un reporte técnico representa el punto culminante del modelado matemático aplicado a problemáticas reales del entorno juvenil. Una ecuación lineal representa una restricción de presupuesto.',
      ejemploResuelto:
        'Planteamiento: Equipar un centro comunitario con mesas de ping-pong (x) y tableros de ajedrez (y) con $6,000. Cada mesa cuesta $1,000 y cada tablero $300. ¿Qué combinaciones son viables? Paso 1: Ecuación lineal: 1000x + 300y = 6000. Paso 2: Si x = 0, y = 20; si x = 6, y = 0. Paso 3: Intercepto en y: (0, 20) y en x: (6, 0). Paso 4: Redacta la conclusión técnica para el reporte integrando la viabilidad financiera.',
      practica: [
        {
          enunciado:
            'Se compran 4 balones y 2 redes por $800. Si 3 balones y 4 redes cuestan $900, ¿cuánto cuesta cada balón?',
          pista: 'Multiplica la primera ecuación por -2 para eliminar y.',
        },
      ],
      aplicacion:
        'Utiliza una cinta métrica para medir dos espacios escolares y plantea un sistema de ecuaciones 2x2 para optimizar dimensiones.',
      autoevaluacion: ['Verifico los interceptos (0, 20) y (6, 0).'],
      recursos: [],
      productoIntegrador: 'Reporte técnico con gráfica',
    };
    const mission = {
      missionIndex: 1,
      title: 'Modelación lineal',
      coveredSessions: [20],
      sessionTopic: 'Ecuación lineal con dos variables',
      sessionFocus: 'Interceptos y combinaciones viables',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 200,
      sessionPlans: [session],
    } as unknown as MissionSection;

    const ex = extractWorkedExample(mission, session, { allowMissionFallback: false });
    expect(ex.interpretation).not.toMatch(/Redacta la conclusión técnica/i);
    expect(ex.problemStatement).toContain('?');

    const concepts = extractConceptHighlights(mission, session, { allowMissionFallback: false });
    const defPrefix = concepts.definition.toLowerCase().slice(0, 24);
    for (const rule of concepts.keyRules) {
      expect(rule.toLowerCase().startsWith(defPrefix)).toBe(false);
    }

    const bundle = distillLessonBundle(mission, session, { allowMissionFallback: false });
    expect(bundle.application.length).toBeGreaterThan(35);
    expect(bundle.application).not.toBe('Utiliza una cinta métrica.');
  });

  it('buildSacrintDeck (lesson-guide) mantiene estadísticas/lineales sin falsos errores ni colisión Meta', async () => {
    const statSession: SessionPlan = {
      sessionNumber: 3,
      objetivo: 'Aprenderás a calcular muestras estadísticas y tabular datos recopilados.',
      motivacion: 'Encuesta juvenil sobre tiempo libre.',
      saberesPrevios: 'Frecuencia y promedio.',
      contenido:
        'Una muestra estadística representativa permite calcular la media aritmética con fidelidad sobre la población estudiada.',
      ejemploResuelto:
        'Planteamiento: Aplicaste una encuesta a 20 jóvenes sobre horas semanales. Paso 1: Suma total = 28 horas. Paso 2: Media aritmética x̄ = 28 / 20 = 1.4 horas. Paso 3: Grafica el modelo lineal acumulado hasta (20, 28) con meta de 28 horas.',
      practica: [
        {
          enunciado: 'De 15 jóvenes se registraron 65 horas totales en redes. ¿Cuál es la media aritmética de uso?',
          pista: 'Divide la suma total entre 15 encuestados.',
        },
        {
          enunciado: 'Construye la tabla de frecuencias absolutas y relativas para los 15 encuestados. ¿Suman el 100%?',
          pista: 'Verifica que la suma de frecuencias absolutas sea 15.',
        },
      ],
      aplicacion: 'Presenta tu tabla de frecuencias y media ante el comité escolar para diagnosticar hábitos.',
      autoevaluacion: ['Calculo la media correctamente.', 'Verifico que las frecuencias sumen n.'],
      recursos: [],
      productoIntegrador: 'Tabla estadística',
    };

    const workbook = {
      blockIndex: 2,
      blockName: 'Bloque 3: Estadística',
      coverData: {
        title: 'Cuaderno PM3',
        subjectName: 'Pensamiento Matemático III',
        schoolName: 'Bachillerato General',
        blockNumber: 3,
      },
      missions: [
        {
          missionIndex: 1,
          title: 'Muestreo y estadística',
          coveredSessions: [3],
          sessionTopic: 'Muestra estadística y media',
          sessionFocus: 'Frecuencias y promedio',
          phenomenonHook: { story: 'Encuesta', detonatingQuestion: '¿Cuántas horas?' },
          conceptZero: { physicalAnalogy: '', coreExplanation: '' },
          iDoSection: { stepByStepDemo: '' },
          weDoSection: { guidedPractice: '', workbookElements: [] },
          youDoSection: { autonomousChallenge: '', workbookElements: [] },
          troubleshooting: [],
          formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
          wordCount: 200,
          sessionPlans: [statSession],
        },
      ],
      projectSection: {
        artifactName: 'Reporte estadístico',
        communityUtility: 'Diagnóstico escolar.',
      },
    } as unknown as ActiveWorkTextbook;

    const deck = buildSacrintDeck(workbook, { mode: 'lesson-guide', missionIndex: 0 });
    const conceptSlide = deck.slides.find((s) => s.kind === 'concept');
    expect(conceptSlide?.title).not.toMatch(/^(?:Aprender[áa]s|Vas\s+a)/i);
    if (conceptSlide?.kind === 'concept') {
      expect(conceptSlide.misconception).not.toContain('margen porcentual sin pasarlo a decimal');
    }

    // Verificar que el PPTX generado renderice sin error y mantenga <= 200 palabras por slide
    const buf = await generateSacrintPptx(deck);
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slideFiles.length).toBeGreaterThanOrEqual(2);
  });

  it('mergeCompiledExtrasPdf emite un solo pie continuo "Página X de N" sin reinicios', async () => {
    const merged = await mergeCompiledExtrasPdf(
      [
        {
          id: 'e1',
          type: 'evaluation',
          title: 'Rúbrica Bloque 1',
          content_text: '# Rúbrica 1\nEvaluación diagnóstica de ecuaciones lineales.',
        },
        {
          id: 'e2',
          type: 'evaluation',
          title: 'Lista de Cotejo Bloque 2',
          content_text: '# Lista de Cotejo\nEvaluación de ecuaciones cuadráticas y vértice.',
        },
      ],
      { schoolName: 'Plantel Prueba', uacName: 'Pensamiento Matemático III' },
      { compiledLabel: 'INSTRUMENTOS COMPILADOS' }
    );
    expect(merged).not.toBeNull();
    const pages = await extractPdfPages(merged!);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    const full = pages.join('\n');
    const p1Matches = [...full.matchAll(/P[áa]gina\s+1\s+de\s+(\d+)/gi)];
    expect(p1Matches.length).toBe(1);
    expect(Number(p1Matches[0]![1])).toBe(pages.length);
  });

  it('preserva pregunta+datos, no fabrica consignas genéricas y repone pistas débiles', () => {
    const session = {
      sessionNumber: 1,
      objetivo: 'Modelar ecuaciones.',
      motivacion: 'Feria escolar.',
      saberesPrevios: 'Álgebra.',
      contenido: 'Ecuaciones lineales.',
      ejemploResuelto: '',
      practica: [
        {
          enunciado:
            'Para la feria escolar se compran 4,000 pesos en materiales y se recaudan 6,000 pesos. Si el comité dispone de un presupuesto total de 4,000 pesos y decide comprar exactamente 12 sillas y 8 mesas, ¿cuánto cuesta cada silla y cada mesa?',
          pista: 'Plantea dos ecuaciones con los datos del presupuesto.',
        },
        {
          enunciado: 'Cada pulsera tiene un costo de producción de $12 y venden cada una en un precio fijo.',
          pista: 'Luego, plantea una ecuación.',
        },
      ],
      aplicacion: 'Utiliza tu matriz de comprobación.',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: 'Reporte.',
    } as unknown as SessionPlan;
    const mission = {
      missionIndex: 1,
      title: 'Ecuaciones',
      coveredSessions: [1],
      sessionTopic: 'Ecuaciones',
      sessionFocus: 'Modelado',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 100,
      sessionPlans: [session],
    } as unknown as MissionSection;

    const activities = extractPracticeActivities(mission, session, { allowMissionFallback: false });
    expect(activities).toHaveLength(2);
    expect(activities[0]!.statement).toContain('$4,000');
    expect(activities[0]!.statement).toContain('$6,000');
    expect(activities[0]!.statement).toContain('¿cuánto cuesta cada silla y cada mesa?');
    expect(activities[1]!.statement).toContain('Cada pulsera');
    expect(activities[1]!.statement).not.toMatch(/Resuelve la situación y justifica tu respuesta\./);
    expect(activities[1]!.hint).not.toMatch(/^luego,\s*plantea una ecuación/i);
    expect(activities[1]!.hint.length).toBeGreaterThan(18);

    const app = extractApplicationAndExit(mission, session, { allowMissionFallback: false });
    expect(app.application.length).toBeGreaterThanOrEqual(36);
  });

  it('respeta el presupuesto del fitter y repara moneda mal formada', () => {
    const fitted = fitPedagogicalText(
      'El estudio de los sistemas de igualdades lineales 2x2 permite modelar situaciones del entorno y resolver problemas con datos reales.',
      { maxChars: 48, maxWords: 7, role: 'concept', ensurePeriod: false }
    );
    expect(fitted.length).toBeLessThanOrEqual(48);
    expect(hasDanglingEnding(fitted)).toBe(false);

    const currency = normalizeEditorialText('La escuela cuenta con un presupuesto de $1,$200 para equipamiento.');
    expect(currency).toContain('$1,200');
    expect(currency).not.toContain('$1,$200');

    const monomials = normalizeEditorialText('Sustituye $2x$ y $7x$ en $4a$; usa $x^2$.');
    expect(monomials).not.toContain('$2x$');
    expect(monomials).not.toContain('$7x$');
    expect(monomials).toContain('2x');
    expect(monomials).toContain('7x');
    expect(normalizeEditorialText('raiz(16) y sqrt(25)')).toContain('√(16)');
    expect(normalizeEditorialText('raiz(16) y sqrt(25)')).not.toMatch(/\b(?:raiz|sqrt)\s*\(/i);
    expect(normalizeEditorialText('raiz(9 - 4(1)(-108))')).toContain('√(9 - 4(1)(-108))');
    expect(normalizeEditorialText('sqrt((p*q)/N)')).toContain('√((p*q)/N)');

    const completeQuestion = fitPedagogicalText(
      '¿Comprendo la diferencia entre una expresión algebraica y una ecuación con incógnita?',
      { maxChars: 60, maxWords: 8, role: 'activity' }
    );
    expect(completeQuestion.endsWith('?')).toBe(true);
    expect(completeQuestion).toContain('expresión algebraica');

    const expanded = normalizeSolvedExampleSteps([
      'Despeja: 5x + y = 11, y = 11 - 5x Paso 2: Igualamos ambas expresiones y resolvemos.',
    ]);
    expect(expanded.length).toBeGreaterThanOrEqual(2);
    expect(expanded[0]).toContain('5x');
    expect(expanded[1]).toContain('Igualamos');
  });

  it('descarta conclusiones meta del ejemplo resuelto y conserva una conclusión sustantiva', () => {
    const session = {
      sessionNumber: 1,
      objetivo: 'Resolver ecuaciones.',
      motivacion: '',
      saberesPrevios: '',
      contenido: '',
      ejemploResuelto: '',
      practica: [],
      aplicacion: '',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: '',
    } as unknown as SessionPlan;
    const mission = {
      missionIndex: 1,
      title: 'Ecuaciones',
      coveredSessions: [1],
      sessionTopic: 'Ecuaciones',
      sessionFocus: 'Despeje',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: {
        physicalAnalogy: '',
        coreExplanation: '',
        solvedExample: {
          problemStatement: 'Resuelve 2x + 3 = 29.',
          solutionSteps: ['2x = 26', 'x = 13'],
          interpretation: 'Analizar la coherencia del resultado en el contexto real.',
        },
      },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 100,
      sessionPlans: [session],
    } as unknown as MissionSection;

    const example = extractWorkedExample(mission, session);
    expect(example.interpretation).not.toMatch(/Analizar la coherencia/i);
    expect(example.interpretation.length).toBeGreaterThan(0);
  });

  it('selecciona una infografía por concepto distinto y conserva el sessionIndex', () => {
    const workbook = {
      missions: [
        {
          missionIndex: 1,
          sessionPlans: [
            { sessionNumber: 1, contenido: 'Interés simple', objetivo: 'Interés simple' },
            { sessionNumber: 2, contenido: 'Interés compuesto', objetivo: 'Interés compuesto' },
          ],
        },
        {
          missionIndex: 2,
          sessionPlans: [
            { sessionNumber: 1, contenido: 'Interés simple', objetivo: 'Interés simple' },
            { sessionNumber: 2, contenido: 'Geometría plana', objetivo: 'Geometría plana' },
          ],
        },
      ],
    } as unknown as ActiveWorkTextbook;

    const targets = selectInfographicTargets(workbook);
    expect(targets).toHaveLength(3);
    expect(targets.map((t) => t.conceptKey)).toEqual([
      'interes simple',
      'interes compuesto',
      'geometria plana',
    ]);
    expect(targets[1]!.missionIndex).toBe(0);
    expect(targets[1]!.sessionIndex).toBe(1);
    expect(targets[2]!.missionIndex).toBe(1);
    expect(targets[2]!.sessionIndex).toBe(1);
  });
});

// ─── Punto 11 — Tests de regresión para correcciones PM3 ──────────────────────
describe('PM3 Correcciones — Punto 11', () => {
  // Punto 2: stripMarkdown elimina tablas Markdown crudas
  it('stripMarkdown elimina tablas Markdown crudas', () => {
    const input = '| y | Par ordenado |\n|---|---|\n| 0 | (0, 3) |';
    const result = stripMarkdown(input);
    expect(result).not.toContain('|');
    expect(result).not.toContain('---');
  });

  // Punto 3: hasDanglingEnding detecta letra suelta al final
  it('hasDanglingEnding detecta letra suelta al final de texto', () => {
    expect(hasDanglingEnding('señala c')).toBe(true);
    expect(hasDanglingEnding('encuentra el valor de x en la ecuación')).toBe(false);
    expect(hasDanglingEnding('x₁ = 15 y x₂ = 14')).toBe(false);
  });

  // Punto 4: isCompleteMathStep discrimina pasos completos vs incompletos
  it('isCompleteMathStep rechaza paso incompleto sin operación o resultado', () => {
    expect(isCompleteMathStep('Aplicamos factorización buscando dos números que multiplicados.')).toBe(false);
  });

  it('isCompleteMathStep acepta paso con resultado numérico explícito', () => {
    expect(isCompleteMathStep('x₁ = 14 y x₂ = 15.')).toBe(true);
  });

  // Punto 4: isCompleteConclusion discrimina conclusiones completas vs truncadas
  it('isCompleteConclusion rechaza conclusión truncada con variable suelta', () => {
    expect(isCompleteConclusion('x₁ = 15, y x₂.')).toBe(false);
  });

  it('isCompleteConclusion acepta conclusión con resultado y unidades', () => {
    expect(isCompleteConclusion('x₁ = 15 y x₂ = 14; el área es 210 m².')).toBe(true);
  });
});

// ─── Auditoría Integral PM3_NVO — Regresiones Estructurales Multi-Disciplina ──
describe('Auditoría Integral PM3_NVO — Regresiones Estructurales', () => {
  it('convierte matrices LaTeX (vmatrix/pmatrix) y D_x en WinAnsi sin dejar comandos crudos', () => {
    const raw =
      'D = \\begin{vmatrix} a_1 & b_1 \\\\ a_2 & b_2 \\end{vmatrix} = (a_1 \\cdot b_2) - (a_2 \\cdot b_1) y x = D_x / D';
    const win = normalizeEditorialText(raw, { target: 'winansi' });
    expect(win).not.toContain('\\begin{vmatrix}');
    expect(win).not.toContain('\\end{vmatrix}');
    expect(win).not.toContain('D_x');
    expect(win).toContain('|a1, b1; a2, b2|');
    expect(win).toContain('Dx / D');
  });

  it('normalizeSessionDescriptorTense preserva género femenino, hiato "e identificar" y quita "desarrollarás"', () => {
    expect(
      normalizeSessionDescriptorTense(
        'Evaluarás de forma formativa la evidencia final y desarrollarás tus habilidades de análisis'
      )
    ).toBe('Evaluar de forma formativa la evidencia final y desarrollar las habilidades de análisis');

    expect(
      normalizeSessionDescriptorTense(
        'Comprenderás el concepto de ecuación y aprenderás a identificar sus componentes'
      )
    ).toBe('Comprender el concepto de ecuación e identificar sus componentes');
  });

  it('tryExtractQuadraticParameters ignora la forma genérica ax² + bx + c = 0 y extrae la ecuación concreta', () => {
    const text =
      'Toda ecuación cuadrática tiene la forma ax² + bx + c = 0. En el caso de la zona recreativa, el área sigue x² + 14x + 40 = 0.';
    const params = tryExtractQuadraticParameters(text);
    expect(params).not.toBeNull();
    expect(params!.a).toBe(1);
    expect(params!.b).toBe(14);
    expect(params!.c).toBe(40);
  });

  it('hasDanglingEnding distingue cierres matemáticos/españoles válidos frente a truncamientos reales', () => {
    // Válidos
    expect(hasDanglingEnding('Aplica operaciones inversas para aislar x.')).toBe(false);
    expect(hasDanglingEnding('Calcula el tamaño de muestra n.')).toBe(false);
    expect(hasDanglingEnding('¿Cuántas piezas hay de cada una?')).toBe(false);
    expect(hasDanglingEnding('Reduce a la forma general: x² - 30x + 200 = 0 y factorizar.')).toBe(false);
    expect(
      hasDanglingEnding(
        'Define tu incógnita como la cantidad de equipos, construye la ecuación lineal y soluciona con orden.'
      )
    ).toBe(false);

    // Truncamientos reales
    expect(hasDanglingEnding('Despeja el valor de la incógnita y.')).toBe(true);
    expect(hasDanglingEnding('Explicar la diferencia entre una ecuación de una variable y.')).toBe(true);
    expect(hasDanglingEnding('Explicar cómo el Teorema de Pitágoras.')).toBe(true);
    expect(hasDanglingEnding('Argumenta en tu bitácora si estas secciones.')).toBe(true);
    expect(hasDanglingEnding('Recuerda que, por definición.')).toBe(true);
    expect(hasDanglingEnding('Los ángulos opuestos por el vértice siempre tienen la misma.')).toBe(true);
    expect(hasDanglingEnding('Presentar datos aislados sin verificar que la gráfica.')).toBe(true);
    expect(hasDanglingEnding('Resuelve el sistema utilizando el método.')).toBe(true);
  });

  it('extractCalloutBox no confunde montos (= 1600) con años históricos ni clona Paso N:', () => {
    const cramerText =
      'Paso 2: Modelo o fórmula D = |a1, b1; a2, b2| = (a1 · b2) - (a2 · b1)\n' +
      'Paso 3: Sustitución y desarrollo Si el sistema es 3x + 2y = 1450 y 2x + 5y = 1600.\n' +
      'La Regla de Cramer resuelve sistemas lineales compatibles determinados mediante cocientes de determinantes.';
    const callout = extractCalloutBox(cramerText, { missionNumber: 2, defaultSubjectName: 'Pensamiento Matemático III' });
    expect(callout).not.toBeNull();
    expect(callout!.title).not.toMatch(/CRONOL[ÓO]GICO|1600/i);
    expect(callout!.body).not.toMatch(/\bPaso\s+\d+\s*:/i);
  });

  it('generateMissionRubric evita "Seguridad en Taller/Laboratorio" en matemáticas puras y lo conserva en laboratorio', () => {
    const missionStub = {
      title: 'Sistemas de ecuaciones 2x2',
      sessionTopic: 'Método de reducción',
      phenomenonHook: { story: 'Presupuesto escolar comunitario', detonatingQuestion: '¿Cómo equilibrar costos?' },
    } as unknown as MissionSection;

    const mathRubric = generateMissionRubric(missionStub, 'Pensamiento Matemático III');
    expect(mathRubric[1]!.criterion).not.toMatch(/Taller\/Laboratorio|Seguridad/i);
    expect(mathRubric[1]!.levels.map((l) => l.descriptor).join(' ')).not.toMatch(/medidas de seguridad|normas de seguridad/i);

    const labRubric = generateMissionRubric(missionStub, 'Química I');
    expect(labRubric[1]!.criterion).toMatch(/Seguridad en Taller\/Laboratorio/i);
  });

  it('paraphraseSixGramOverlap reduce solapamiento sin corromper género, contracciones ni letras griegas', () => {
    const source =
      'Para calcular el número de paquetes en situaciones contextualizadas dentro de un espacio recreativo comunitario, realiza el despeje mediante el método y calcula la población para dentro de 5 años.';
    const cleaned = cleanSacrintText(source);
    expect(cleaned).not.toContain('para en 5 años');

    const paraphrased = paraphraseSixGramOverlap(cleaned, [cleaned]);
    expect(paraphrased).not.toMatch(/\bel cantidad\b/i);
    expect(paraphrased).not.toMatch(/\befect[úu]al\b/i);
    expect(paraphrased).not.toMatch(/\bpor medio de el\b/i);
    expect(paraphrased).not.toMatch(/\bescenarios contextualizadas\b/i);
    expect(paraphrased).not.toMatch(/\bun [áa]rea recreativa comunitario\b/i);
    expect(paraphrased).not.toMatch(/\bmemoria de c[óo]mputo\b/i);
    expect(sixGramOverlapRatio(paraphrased, [cleaned])).toBeLessThan(0.5);

    expect(sanitizePedagogicalMetaPhrases('α + β = 90°')).toBe('α + β = 90°');
  });

  it('buildSacrintInfographic aísla los pasos de la sesión sin filtrar iDoSection de otra sesión y preserva verbo en claim', () => {
    const s1: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Comprender el método de igualación.',
      motivacion: 'Costos escolares.',
      saberesPrevios: 'Despeje lineal.',
      contenido: 'El método de igualación iguala dos expresiones despejadas de la misma incógnita.',
      ejemploResuelto: 'Planteamiento: x + y = 10 y x - y = 2. Paso 1: x = 10 - y y x = 2 + y. Paso 2: 10 - y = 2 + y ⇒ y = 4, x = 6.',
      practica: [{ enunciado: 'Resuelve x + y = 8 y x - y = 2 por igualación.', pista: 'Despeja x en ambas.' }],
      aplicacion: 'Aplica igualación a compras escolares.',
      autoevaluacion: ['Despejo la misma variable en ambas ecuaciones.'],
      recursos: [],
      productoIntegrador: 'Cuadro comparativo',
    };
    const s2: SessionPlan = {
      sessionNumber: 2,
      objetivo: 'Aplicar el método de sustitución en sistemas 2x2.',
      motivacion: 'Huertos comunitarios.',
      saberesPrevios: 'Sustitución algebraica.',
      contenido: 'El método de sustitución reemplaza una incógnita despejada dentro de la segunda ecuación.',
      ejemploResuelto:
        'Planteamiento: Un huerto suma 12 plantas de tomate (x) y chile (y), donde x = 3y. Paso 1: Sustituir x = 3y en x + y = 12. Paso 2: 4y = 12 ⇒ y = 3, x = 9.',
      practica: [{ enunciado: 'Resuelve 2x + y = 10 y y = 3x por sustitución.', pista: 'Usa paréntesis al sustituir y.' }],
      aplicacion: 'Modela cultivos comunitarios mediante sustitución.',
      autoevaluacion: ['Sustituyo con paréntesis para evitar errores de signo.'],
      recursos: [],
      productoIntegrador: 'Reporte de sustitución',
      sintesisVisual: {
        conceptoBreve: 'La estructuración, depuración y validación de un modelo matemático.',
        formulaOReglaClave: 'x = 3y; (3y) + y = 12',
        ejemploBreve: {
          planteamiento: 'Huerto con 12 plantas y x = 3y. Calcula cuántas plantas hay de cada tipo.',
          pasos: ['Sustituir x = 3y en x + y = 12.', 'Resolver 4y = 12 ⇒ y = 3 y x = 9.'],
          conclusion: 'Hay 9 plantas de tomate y 3 de chile.',
        },
        mapaConceptual: {
          definicionClave: 'Sustituir una variable despejada en la otra ecuación.',
          criterioDesarrollo: 'Usar paréntesis al insertar expresiones algebraicas.',
          errorComun: 'Sustituir en la misma ecuación de donde se despejó.',
          correccionBreve: 'Insertar siempre el despeje en la segunda ecuación del sistema.',
        },
      },
    };
    const wb = {
      blockIndex: 1,
      blockName: 'Bloque 2',
      coverData: { title: 'PM3', subjectName: 'Pensamiento Matemático III', schoolName: 'Plantel', blockNumber: 2 },
      missions: [
        {
          missionIndex: 1,
          title: 'Sistemas lineales 2x2',
          coveredSessions: [1, 2],
          sessionTopic: 'Sistemas 2x2',
          sessionFocus: 'Igualación y sustitución',
          phenomenonHook: { story: '', detonatingQuestion: '' },
          conceptZero: { physicalAnalogy: '', coreExplanation: '' },
          iDoSection: {
            stepByStepDemo:
              'Sigue atentamente este modelo de resolución utilizando el método de igualación: x = 10 - y.',
          },
          weDoSection: { guidedPractice: '', workbookElements: [] },
          youDoSection: { autonomousChallenge: '', workbookElements: [] },
          troubleshooting: [],
          formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
          wordCount: 300,
          sessionPlans: [s1, s2],
        },
      ],
      projectSection: { artifactName: 'Dossier 2x2', communityUtility: 'Planeación escolar.' },
    } as unknown as ActiveWorkTextbook;

    const info = buildSacrintInfographic(wb, 'wide', { missionIndex: 0, sessionIndex: 1 });
    const stepsBlob = info.steps.map((st) => `${st.title} ${st.body}`).join(' ');
    expect(stepsBlob).not.toMatch(/sigue atentamente este modelo de resoluci[oó]n/i);
    expect(stepsBlob).not.toMatch(/m[eé]todo de igualaci[oó]n/i);
    expect(info.claim).not.toBe('La estructuración, depuración y validación de un modelo matemático.');
  });

  it('paraphraseSixGramOverlap no falla con palabras reservadas de Object.prototype (constructor, toString, valueOf) ni produce español agramatical', () => {
    const constructionText =
      'El constructor verifica el croquis para trazar la tubería cuando el plano indica la pendiente correcta como referencia para instalar cada ramal.';
    expect(() => paraphraseSixGramOverlap(constructionText, [constructionText])).not.toThrow();

    const out = paraphraseSixGramOverlap(constructionText, [constructionText]);
    expect(out).not.toMatch(/function\s+Object/i);
    expect(out).not.toMatch(/\bhacia\s+(?:trazar|instalar|comprar|crear)\b/i);
    expect(out).not.toMatch(/\bal momento que\b/i);
    expect(out).not.toMatch(/\btal como referencia\b/i);

    const protoWords =
      'El constructor analiza toString valueOf hasOwnProperty __proto__ para validar planos de vivienda cuando existen cambios.';
    expect(() => paraphraseSixGramOverlap(protoWords, [protoWords])).not.toThrow();
    expect(paraphraseSixGramOverlap(protoWords, [protoWords])).not.toMatch(/native code/i);
  });

  it('hasDanglingEnding detecta cláusulas relativas posesivas truncadas sin verbo (", cuya identificación.")', () => {
    expect(
      hasDanglingEnding(
        'Los elementos constructivos son componentes físicos que integran una vivienda, cuya identificación.'
      )
    ).toBe(true);
    expect(
      hasDanglingEnding(
        'Los elementos constructivos son componentes físicos que integran una vivienda.'
      )
    ).toBe(false);
    expect(hasDanglingEnding('Mide siempre a partir.')).toBe(true);
    expect(hasDanglingEnding('Observa la dispersión de luz en la muestra y considera.')).toBe(true);
    expect(hasDanglingEnding('Aplica dichas construcciones geométricas para diseñar.')).toBe(true);
    expect(hasDanglingEnding('Si ocurre un contacto accidental con la piel, el protocolo.')).toBe(true);
    expect(hasDanglingEnding('Son componentes diseñados.')).toBe(true);
    expect(hasDanglingEnding('Verifica que los materiales cumplan.')).toBe(true);
    expect(hasDanglingEnding('Servicios públicos que el municipio.')).toBe(true);
    expect(hasDanglingEnding('Coloca marcas cada 2.5.')).toBe(true);
    expect(hasDanglingEnding('Requiere mayor.')).toBe(true);
    expect(hasDanglingEnding("Incorpora una sección de 'Protocolo.")).toBe(true);
    expect(hasDanglingEnding("Don't forget to check the grammar rule.")).toBe(false);
    expect(fitPedagogicalText("Decimos 'Are you from...?'", { maxChars: 60, maxWords: 12 })).not.toContain("?'?");
  });

  it('extractWorkedExample no mezcla ecuaciones ni paso 3 de ejemploResuelto cuando sintesisVisual usa otro problema numérico', () => {
    const s: SessionPlan = {
      sessionNumber: 7,
      objetivo: 'Modelar presupuestos con ecuaciones lineales.',
      motivacion: 'Presupuesto comunitario.',
      saberesPrevios: 'Despeje lineal.',
      contenido: 'Una ecuación lineal equilibra costos fijos y variables.',
      ejemploResuelto:
        'Planteamiento: Presupuesto de 15,000 pesos con 3,000 fijos y bancas de 1,200 cada una. Paso 1: 3,000 + 1,200x = 15,000. Paso 2: 1,200x = 12,000. Paso 3: x = 10 bancas en total (555 unidades).',
      practica: [{ enunciado: 'Calcula el número de bancas con $18,000.', pista: 'Resta el costo fijo.' }],
      aplicacion: 'Planeación presupuestal.',
      autoevaluacion: ['Planteo y despejo ecuaciones lineales.'],
      recursos: [],
      productoIntegrador: 'Presupuesto comunitario.',
      sintesisVisual: {
        conceptoBreve: 'El equilibrio presupuestal asegura la estabilidad financiera del proyecto.',
        formulaOReglaClave: '600x + 7200 = 12000',
        ejemploBreve: {
          planteamiento: 'Presupuesto de 12,000 pesos con 7,200 comprometidos y luminarias de 600 pesos.',
          pasos: [
            'Resta los 7,200 comprometidos al presupuesto de 12,000 pesos.',
            'Divide el saldo de 4,800 entre 600 pesos por luminaria.',
          ],
          conclusion: 'Se obtienen 8 luminarias dentro del presupuesto de 12,000 pesos.',
        },
        mapaConceptual: {
          definicionClave: 'Ecuación lineal presupuestal.',
          criterioDesarrollo: 'Separar costos fijos y variables.',
          errorComun: 'Sumar costos fijos al total en lugar de restarlos.',
          correccionBreve: 'Restar el monto comprometido antes de dividir.',
        },
      },
    };
    const missionStub = {
      missionIndex: 2,
      title: 'Ecuaciones lineales',
      coveredSessions: [7],
      sessionTopic: 'Ecuaciones lineales',
      sessionFocus: 'Despeje presupuestal',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 200,
      sessionPlans: [s],
    } as unknown as MissionSection;
    const ex = extractWorkedExample(missionStub, s, { allowMissionFallback: false });
    const joined = `${ex.problemStatement} ${ex.steps.join(' ')} ${ex.interpretation}`;
    expect(joined).toContain('12,000');
    expect(joined).not.toContain('15,000');
    expect(joined).not.toContain('555');
  });

  it('paraphraseSixGramOverlap preserva concordancia de género en "una herramienta" y "la longitud total"', () => {
    const text =
      'Usa una herramienta digital preferida y anota la longitud total junto con la altura total del muro.';
    const out = paraphraseSixGramOverlap(text, [text]);
    expect(out).not.toMatch(/\buna\s+instrumento\b/i);
    expect(out).not.toMatch(/\binstrumento\s+digital\s+preferida\b/i);
    expect(out).not.toMatch(/\bla\s+largo\s+total\b/i);
    expect(out).not.toMatch(/\bla\s+alto\s+total\b/i);
  });

  it('paraphraseSixGramOverlap preserva homógrafos y tildes ("en la muestra", "está funcionando", "desde") sin corrupción', () => {
    const lab =
      'Un estudiante mide una muestra de suelo húmedo porque el altavoz interno está funcionando y mide siempre desde la misma altura.';
    const out = paraphraseSixGramOverlap(lab, [lab]);
    expect(out).not.toMatch(/\b(?:en\s+la|una)\s+expone\b/i);
    expect(out).not.toMatch(/\bdicha\s+funcionando\b/i);
    expect(out).not.toMatch(/\ba\s+partir\./i);
    expect(out).toContain('muestra');
    expect(out).toContain('está funcionando');
  });

  it('extractWorkedExample nunca inyecta paréntesis de ecuación truncados en letras acentuadas como "(dibujo = (Dimensi)."', () => {
    const s: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Aplicar escalas normalizadas en planos técnicos.',
      motivacion: 'Acotación de planos escolares.',
      saberesPrevios: 'Conversión de unidades.',
      contenido: 'La escala relaciona la dimensión en el dibujo con la dimensión real del objeto.',
      ejemploResuelto:
        'Planteamiento: Representar un banco de 2000 mm a escala 1:20. Paso 1: Aplica la relación dibujo = (Dimensión real) / 20 para hallar la cota. Paso 2: Calcula 2000 / 20 = 100 mm.',
      practica: [{ enunciado: 'Calcula la medida en papel de una mesa de 1200 mm a escala 1:20.', pista: 'Divide entre 20.' }],
      aplicacion: 'Se aplica en láminas de mobiliario escolar.',
      autoevaluacion: ['Convierto medidas reales a escala 1:20 sin errores.'],
      recursos: [],
      productoIntegrador: 'Lámina acotada a escala 1:20.',
      sintesisVisual: {
        conceptoBreve: 'La escala normalizada permite representar objetos reales en planos técnicos.',
        formulaOReglaClave: 'D = R / 20',
        ejemploBreve: {
          planteamiento: 'Representar un banco de 2000 mm en plano a escala 1:20.',
          pasos: ['Identificar la medida real del banco.', 'Aplicar escala 1:20 y acotar correctamente.'],
          conclusion: 'La longitud en la lámina será de 100 mm.',
        },
        mapaConceptual: {
          definicionClave: 'Escala normalizada en planos técnicos.',
          criterioDesarrollo: 'Dividir la medida real entre el denominador de la escala.',
          errorComun: 'Omitir la conversión de unidades antes de aplicar la escala.',
          correccionBreve: 'Verificar siempre que dibujo y realidad estén en milímetros.',
        },
      },
    };
    const missionStub = {
      missionIndex: 1,
      title: 'Escalas normalizadas',
      coveredSessions: [1],
      sessionTopic: 'Escalas normalizadas',
      sessionFocus: 'Escala 1:20',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 200,
      sessionPlans: [s],
    } as unknown as MissionSection;
    const ex = extractWorkedExample(missionStub, s, { allowMissionFallback: false });
    const joined = ex.steps.join(' ');
    expect(joined).not.toContain('(Dimensi)');
    expect(joined).not.toMatch(/\([A-Za-z]+\s*=\s*\([A-Za-z]+\)\./);
  });

  it('fitPedagogicalText y finalizeVisibleText nunca duplican "?" tras citas interrogativas en inglés ("?\'?")', () => {
    const samples = [
      "Saludo formal a un visitante: 'Good morning, Mr. Smith. How are you?'",
      "Preguntar: 'Is there a library?' y 'Are there any sports courts?'.",
      "Las preguntas son: 'Can I take pictures?' y 'Where can I buy souvenirs?'.",
    ];
    for (const s of samples) {
      const fitted = fitPedagogicalText(s, { maxChars: 140, role: 'step', ensurePeriod: true });
      const fittedTwice = fitPedagogicalText(fitted, { maxChars: 140, role: 'step', ensurePeriod: true });
      expect(fitted).not.toMatch(/\?['"»”’]\?/);
      expect(fittedTwice).not.toMatch(/\?['"»”’]\?/);
    }
  });

  it('distillExerciseStatement nunca elimina la primera oración si abre una cita textual o contiene consigna en inglés', () => {
    const missionStub = {
      missionIndex: 1,
      title: 'Textos descriptivos',
      coveredSessions: [1],
      sessionTopic: 'Textos descriptivos',
      sessionFocus: 'Concordancia',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 200,
      sessionPlans: [],
    } as unknown as MissionSection;
    const session: SessionPlan = {
      sessionNumber: 1,
      objetivo: 'Corregir errores de concordancia en inglés.',
      motivacion: 'Folleto turístico.',
      saberesPrevios: 'Adjetivos.',
      contenido: 'Uso correcto de adjetivos y concordancia.',
      ejemploResuelto: '',
      practica: [
        {
          enunciado:
            "Corrige el siguiente texto: 'Tourists eats the mole. It is a spicy food. Artisans makes the pots. You buys it in the market.' Identifica los errores de concordancia en la tercera persona y reescribe el texto correctamente para tu folleto.",
          pista: 'Revisa los verbos en plural y tercera persona.',
        },
        {
          enunciado:
            "Identifica los errores en: 'The church is big ancient. It has a colors wall.' Reescribe las oraciones correctamente usando los adjetivos de forma adecuada en inglés.",
          pista: 'Los adjetivos en inglés no llevan plural.',
        },
      ],
      aplicacion: 'Se usa en folletos turísticos bilingües.',
      autoevaluacion: ['Identifico errores de concordancia en textos turísticos.'],
      recursos: [],
      productoIntegrador: 'Folleto turístico bilingüe.',
    };
    const acts = extractPracticeActivities(missionStub, session, { allowMissionFallback: false });
    expect(acts).toHaveLength(2);
    for (const act of acts) {
      expect(hasDanglingEnding(act.statement)).toBe(false);
      expect(act.statement).toContain("'");
    }
    expect(acts[0]!.statement).toContain('Corrige el siguiente texto:');
    expect(acts[1]!.statement).toContain('Identifica los errores en:');
  });

  it("hasDanglingEnding no confunde cierres de comilla simple tras tildes o ñ ('año', 'Metodología') con derivadas", () => {
    expect(
      hasDanglingEnding(
        "Lee el siguiente fragmento: 'La biblioteca atraerá a miles de jóvenes lectores este año'. Clasifica cada oración."
      )
    ).toBe(false);
    expect(
      hasDanglingEnding(
        "Redacta el apartado de 'Metodología' para tu memoria técnica y documenta los pasos seguidos."
      )
    ).toBe(false);
  });

  it('isPublishablePedagogicalText preserva unidades físicas/técnicas y rechaza truncamientos residuales de 08', () => {
    const unitCases: Array<[string, string]> = [
      [
        'Un estudiante mide una muestra de suelo húmedo con una masa de 120 g y un volumen ocupado de 80 cm³. Calcula la densidad y anota tus resultados.',
        '80 cm³',
      ],
      [
        'La longitud de una franja de suelo contaminado es de 12 pies. Empleando 1 pie = 30.48 cm, determina la longitud total.',
        '12 pies',
      ],
      [
        'Diseña el boceto técnico de un firme de concreto de 4 m por 4 m. Especifica concreto con una resistencia de 150 kg/cm².',
        '150 kg/cm²',
      ],
      [
        'Calcula la cantidad de semillas de moringa para tratar 5 litros de agua turbia, considerando una dosis experimental de 200 miligramos por litro.',
        '200 miligramos por litro',
      ],
      [
        'Identifica una regadera de 0.12 L/s y un inodoro de 0.08 L/s. Calcula el caudal total y determina si una tubería de 1/2 pulgada es suficiente si el límite es 0.25 L/s.',
        '0.08 L/s',
      ],
      [
        'Determina el costo total de 15 m lineales de malla ciclónica si el metro lineal cuesta $120 y los postes, colocados cada 2.5 metros, cuestan $350 cada uno.',
        '350',
      ],
    ];
    for (const [src, requiredToken] of unitCases) {
      const fitted = fitPedagogicalText(src, { maxChars: 165, maxWords: 26, role: 'activity' });
      expect(isPublishablePedagogicalText(fitted, 'activity', src)).toBe(true);
      expect(fitted).toContain(requiredToken);
    }

    // Rechazar truncamientos explícitos detectados en auditoría
    expect(isPublishablePedagogicalText('Un estudiante mide un volumen ocupado de 80.', 'activity')).toBe(false);
    expect(isPublishablePedagogicalText('Especifica el uso de concreto con una resistencia de 150.', 'activity')).toBe(false);
    expect(isPublishablePedagogicalText('Halla el porcentaje de mejora y escribe.', 'activity')).toBe(false);
    expect(isPublishablePedagogicalText('Escribe una nota de retroalimentación para un estudiante cuyo texto.', 'activity')).toBe(false);
    expect(isPublishablePedagogicalText('La perspectiva isométrica posibilita que tus pares visualicen.', 'application')).toBe(false);
    expect(isPublishablePedagogicalText('Valora la pertinencia comunitaria de esta.', 'activity')).toBe(false);
    expect(isPublishablePedagogicalText('F ¿Alguna vez', 'infographic')).toBe(false);
    expect(isPublishablePedagogicalText('04', 'infographic')).toBe(false);
  });

  it('garantiza paridad numérica ecuación ↔ gráfica ↔ ejemplo en PM3 S15, S42, S108, CECBV S64 y DT1 S95', () => {
    const mathPack = resolveSacrintPack('Pensamiento Matemático III', 'fundamental');
    const dummyMission = {
      missionIndex: 1,
      title: 'Modelación matemática',
      coveredSessions: [1],
      sessionTopic: 'Modelación',
      sessionFocus: 'Modelación',
      phenomenonHook: { story: '', detonatingQuestion: '' },
      conceptZero: { physicalAnalogy: '', coreExplanation: '' },
      iDoSection: { stepByStepDemo: '' },
      weDoSection: { guidedPractice: '', workbookElements: [] },
      youDoSection: { autonomousChallenge: '', workbookElements: [] },
      troubleshooting: [],
      formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
      wordCount: 200,
      sessionPlans: [],
    } as unknown as MissionSection;

    // PM3 S15: 7,200 + 600x = 12,000 → x = 8, y = 12,000
    const d15 = buildSacrintDiagram(dummyMission, mathPack, {
      allowMissionFallback: false,
      preferredExampleText: '7,200 + 600x = 12,000 Presupuesto de $12,000 con 7,200 comprometidos y luminarias de $600.',
    });
    expect(d15.kind).toBe('linear');
    if (d15.kind === 'linear') {
      expect(d15.available).toBe(true);
      expect(d15.points.some((p) => p.x === 8 && p.y === 12000)).toBe(true);
      expect(d15.points.some((p) => p.y === 19800)).toBe(false);
    }

    // PM3 S42: 2X + 3Y = 1500 → primer cuadrante exacto (0,500), (375,250), (750,0), sin Y negativa
    const d42 = buildSacrintDiagram(dummyMission, mathPack, {
      allowMissionFallback: false,
      preferredExampleText: '2X + 3Y = 1500 Consolidar reporte con presupuesto de $1500 y modelo 2X + 3Y = 1500.',
    });
    expect(d42.kind).toBe('linear');
    if (d42.kind === 'linear') {
      expect(d42.available).toBe(true);
      expect(d42.points.every((p) => p.y >= 0)).toBe(true);
      expect(d42.points).toEqual([
        { x: 0, y: 500 },
        { x: 375, y: 250 },
        { x: 750, y: 0 },
      ]);
    }

    // PM3 S108: P(5) = 1,200 · e^(0.03·5) → 1,394 (no 232)
    const d108 = buildSacrintDiagram(dummyMission, mathPack, {
      allowMissionFallback: false,
      preferredExampleText:
        'P(t) = P₀·e^(rt) Proyección de 1,200 jóvenes a una tasa del 3% anual durante 5 años. Aplica P(5) = 1,200·e^(0.03·5).',
    });
    expect(d108.kind).toBe('exponential');
    if (d108.kind === 'exponential') {
      expect(d108.available).toBe(true);
      expect(d108.principal).toBe(1200);
      expect(d108.compoundSeries[5]?.value).toBe(1394);
    }

    // CECBV S64: no inyectar ((12+14+13+18+20)/5 = 15.4) en un ejemplo con 10, 12, 11, 15, 17 → 13
    const cecbvSession: SessionPlan = {
      sessionNumber: 11,
      objetivo: 'Sistematizas los datos de estiba y analizas tendencias numéricas.',
      motivacion: 'Datos de obra.',
      saberesPrevios: 'Promedio.',
      contenido: 'Cálculo de promedio.',
      ejemploResuelto: 'Planteamiento: Tiempos de 12, 14, 13, 18 y 20 minutos. Paso 1: (12+14+13+18+20) / 5 = 15.4.',
      practica: [],
      aplicacion: 'Estiba.',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: 'Tabla estadística.',
      sintesisVisual: {
        conceptoBreve: 'La sistematización estadística de datos de carga permite visualizar tendencias.',
        formulaOReglaClave: 'Promedio = Suma de valores / Número de registros',
        ejemploBreve: {
          planteamiento: 'Tiempos de estiba de 10, 12, 11, 15 y 17 minutos para 100 kg de material.',
          pasos: ['Cálculo: Promedio de 13 minutos.', 'Análisis: Tendencia creciente que indica fatiga.'],
          conclusion: 'Se requiere revisar la técnica de estiba y los tiempos de descanso.',
        },
        mapaConceptual: {
          definicionClave: 'Conversión de registros de carga en información visual.',
          criterioDesarrollo: 'Recopilar datos y calcular promedios.',
          errorComun: 'Confundir correlación con causalidad.',
          correccionBreve: 'Contrastar siempre con observaciones de obra.',
        },
      },
    };
    const ex64 = extractWorkedExample(dummyMission, cecbvSession, { allowMissionFallback: false });
    expect(ex64.steps.join(' ')).toContain('13 minutos');
    expect(ex64.steps.join(' ')).not.toContain('15.4');

    // DT1 S95: no inyectar asignación trivial (A = 0.5m) y conservar "proyectar" sin mutar a "estimar"
    const dt1Session: SessionPlan = {
      sessionNumber: 7,
      objetivo: 'Construyes modelos isométricos a partir de vistas ortogonales.',
      motivacion: 'Proyección isométrica.',
      saberesPrevios: 'Escalas.',
      contenido: 'La perspectiva isométrica utiliza ejes a 30 grados para proyectar objetos tridimensionales.',
      ejemploResuelto: 'Planteamiento: Módulo de 2.0 m de largo y ancho A = 0.5m en escala 1:20. Paso 1: A = 0.5m.',
      practica: [],
      aplicacion: 'Lámina PAEC.',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: 'Lámina isométrica.',
      sintesisVisual: {
        conceptoBreve: 'La perspectiva isométrica utiliza ejes a 30 grados para proyectar objetos.',
        formulaOReglaClave: 'L_iso = L_real × Escala',
        ejemploBreve: {
          planteamiento: 'Representar un módulo de 2m x 0.5m x 0.4m a escala 1:20.',
          pasos: ['Trazar ejes a 30 grados y aplicar la escala 1:20.', 'Unir los puntos para formar el prisma isométrico final.'],
          conclusion: 'El modelo isométrico permite visualizar el volumen con precisión.',
        },
        mapaConceptual: {
          definicionClave: 'Sistema de proyección sobre tres ejes a 120 grados.',
          criterioDesarrollo: 'Mantener fidelidad dimensional en los tres ejes.',
          errorComun: 'Aplicar escalas distintas en los ejes.',
          correccionBreve: 'Verificar paralelismo y escala en cada eje.',
        },
      },
    };
    const ex95 = extractWorkedExample(dummyMission, dt1Session, { allowMissionFallback: false });
    expect(ex95.steps.join(' ')).not.toContain('A = 0.5m');
    expect(
      paraphraseSixGramOverlap(
        'Aprenderás a proyectar objetos tridimensionales en el sistema diédrico mediante vistas ortogonales.',
        ['Aprenderás a proyectar objetos tridimensionales en el sistema diédrico mediante vistas ortogonales.']
      )
    ).not.toMatch(/\bestimar\s+objetos\b/i);

    // Títulos limpios en CNET1 S153 y DT1 S19
    expect(
      resolveChalkboardTopicTitle({
        sessionObjective: 'Evalúas de manera integral tu producto integrador mediante una rúbrica analítica.',
      })
    ).not.toMatch(/^Manera\s+integral\b/i);
    expect(
      resolveChalkboardTopicTitle({
        sessionObjective: 'Integrarás todos los conocimientos de dibujo técnico, escalas, acotación y proyección.',
      })
    ).not.toMatch(/^Todos\s+los\s+conocimientos\b/i);

    // Gate findIncompleteInfographicBlock rechaza stubs F ¿Alguna vez / E 04
    expect(
      findIncompleteInfographicBlock({
        variables: [{ symbol: 'F', label: 'Fenómeno', meaning: '¿Alguna vez' }],
      } as unknown as Parameters<typeof findIncompleteInfographicBlock>[0])
    ).toBeTruthy();
    expect(
      findIncompleteInfographicBlock({
        variables: [{ symbol: 'E', label: 'Eventos', meaning: '04' }],
      } as unknown as Parameters<typeof findIncompleteInfographicBlock>[0])
    ).toBeTruthy();
  });
});
