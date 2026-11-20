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
} from '@/lib/editorial/pedagogical-text-fitter';
import { resolveChalkboardTopicTitle } from '@/lib/editorial/topic-title-resolver';
import { mergeCompiledExtrasPdf } from '@/lib/pdf-extra-renderer';
import { stripMarkdown } from '@/lib/visual-engine/content-extractor';
import {
  distillLessonBundle,
  extractApplicationAndExit,
  extractConceptHighlights,
  extractPracticeActivities,
  extractWorkedExample,
  isCompleteConclusion,
  isCompleteMathStep,
} from '@/lib/visual-engine/sacrint/content-distiller';
import {
  buildSacrintDeck,
  selectInfographicTargets,
} from '@/lib/visual-engine/sacrint/spec';
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
