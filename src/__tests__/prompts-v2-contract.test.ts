import { describe, expect, it } from 'vitest';
import {
  getDisciplinaryAdapter,
  type EpistemologicalFamily,
} from '@/lib/prompts/disciplinary-adapters';
import {
  buildCanonicalSessionPlanInstructions,
  buildCanonicalSessionPlanJsonExample,
} from '@/lib/guide-engine/writers/session-prompt-contract';
import {
  hasCompleteWorkedExampleClosure,
  sanitizeSessionPlans,
} from '@/lib/guide-engine/writers/writer-contract';
import {
  densityThresholdsFor,
  evaluateSessionPlanDensity,
} from '@/lib/guide-engine/writers/session-shard';
import {
  extractConceptHighlights,
  extractWorkedExample,
} from '@/lib/visual-engine/sacrint/content-distiller';
import { buildSacrintInfographic } from '@/lib/visual-engine/sacrint/spec';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import type { ActiveWorkTextbook, SessionPlan, SessionVisualSynthesis } from '@/types/work-textbook';

const VISUAL: SessionVisualSynthesis = {
  conceptoBreve:
    'La razón de cambio describe cómo varía una cantidad respecto de otra y permite interpretar situaciones reales con evidencia numérica.',
  formulaOReglaClave: 'm = (y2 - y1) / (x2 - x1)',
  ejemploBreve: {
    planteamiento:
      'Una cooperativa registra el costo de producir 4 y 10 piezas: $1,200 y $2,400. Determina la razón de cambio del costo.',
    pasos: [
      'Identifica los pares ordenados (4, 1200) y (10, 2400).',
      'Sustituye en m = (y2 - y1) / (x2 - x1).',
      'Calcula m = 1200 / 6 = 200 pesos por pieza.',
    ],
    conclusion: 'La razón de cambio es $200 por pieza producida.',
  },
  mapaConceptual: {
    definicionClave:
      'La razón de cambio compara dos magnitudes y expresa cuánto cambia una cuando la otra aumenta una unidad.',
    criterioDesarrollo:
      'Identifica los pares ordenados, conserva el orden de la sustracción y verifica las unidades del resultado.',
    errorComun:
      'Invertir el orden de los datos o restar valores que no corresponden al mismo intervalo.',
    correccionBreve:
      'Escribe primero los pares ordenados, aplica la fórmula completa y comprueba el signo del resultado.',
  },
};

function makeSession(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionNumber: 1,
    objetivo: 'Comprendes la razón de cambio y la aplicas en situaciones de tu comunidad.',
    motivacion:
      'En tu comunidad una cooperativa necesita comparar cómo cambian sus costos cuando produce más piezas y requiere tomar decisiones con datos.',
    saberesPrevios:
      'Recuerda cómo ubicar pares ordenados en el plano y cómo calcular diferencias entre dos valores. ¿Qué relación observas entre ambos datos?',
    contenido:
      'La razón de cambio relaciona dos magnitudes y permite describir la variación de una respecto de la otra.\n\nLa fórmula m = (y2 - y1) / (x2 - x1) organiza los datos y exige conservar el orden de los pares ordenados.\n\nVerifica siempre las unidades y el signo del resultado para interpretar correctamente la situación.',
    ejemploResuelto:
      'Planteamiento: Una cooperativa compara costos de producción.\nPaso 1: Registra los pares ordenados.\nPaso 2: Aplica la fórmula completa.\nPaso 3: Desarrolla las diferencias.\nPaso 4: Verifica el resultado y las unidades.',
    practica: [
      {
        enunciado:
          'Una cooperativa registra costos de $800 y $1,400 para 2 y 5 piezas. Calcula la razón de cambio y explica qué representa.',
        pista: 'Organiza los pares ordenados y conserva el orden de la sustracción.',
        solucion: ['Paso 1: pares (2, 800) y (5, 1400).', 'Respuesta final: $200 por pieza.'],
      },
      {
        enunciado:
          'Una tienda compara sus ventas de 3 y 8 días con ingresos de $900 y $2,400. Determina la razón de cambio e interprétala.',
        pista: 'Identifica las magnitudes y aplica la fórmula completa antes de concluir.',
        solucion: ['Paso 1: pares (3, 900) y (8, 2400).', 'Respuesta final: $300 por día.'],
      },
    ],
    aplicacion:
      'Aplica la razón de cambio para comparar costos, ingresos o distancias de una situación cotidiana y explica tu conclusión con datos.',
    autoevaluacion: [
      '¿Puedo explicar la razón de cambio con un ejemplo de mi entorno?',
      '¿Cómo verifico que el orden de los datos y las unidades son correctos?',
    ],
    recursos: [],
    productoIntegrador:
      'Incorporas a tu portafolio una tabla con pares ordenados, el cálculo de la razón de cambio y una interpretación situada.',
    ...overrides,
  };
}

function makeWorkbook(session: SessionPlan): ActiveWorkTextbook {
  const workbook = structuredClone(MATH_DEMO_WORKBOOK);
  workbook.missions![0]!.sessionPlans = [session];
  workbook.missions![0]!.sessionTopic = 'Razón de cambio y variación';
  workbook.coverData.subjectName = 'Pensamiento Matemático III';
  return workbook;
}

describe('Prompts V2 — adaptadores y contrato canónico', () => {
  it('usa el adaptador interdisciplinario general como fallback seguro', () => {
    const adapter = getDisciplinaryAdapter('Asignatura Experimental Desconocida XYZ');
    expect(adapter.id).toBe('indagacion_interdisciplinaria_general');
    expect(adapter.id).not.toBe('ciencias_quimica_biologia_ambiental');
    expect(adapter.family).toBe('humanistica_comunicativa_social');
  });

  it('expone las 5 familias epistemológicas con directivas y columnas de tabla', () => {
    const cases: Array<[string, EpistemologicalFamily]> = [
      ['Pensamiento Matemático III', 'cuantitativa_experimental'],
      ['Lengua y Comunicación', 'humanistica_comunicativa_social'],
      ['Cultura Digital y Programación', 'computacional_algoritmica'],
      ['Actividades Físicas y Deportivas', 'corporal_motriz'],
      ['Administración y Contabilidad', 'tecnica_laboral'],
    ];

    for (const [uac, family] of cases) {
      const adapter = getDisciplinaryAdapter(uac);
      expect(adapter.family).toBe(family);
      expect(adapter.workedExampleDirective.length).toBeGreaterThan(80);
      expect(adapter.defaultTableColumns.length).toBeGreaterThanOrEqual(5);
      expect(adapter.keyFormulaOrRuleDirective.length).toBeGreaterThan(20);
    }
  });

  it('genera el contrato canónico con presupuesto V2, sintesisVisual e higiene Unicode', () => {
    const adapter = getDisciplinaryAdapter('Pensamiento Matemático III');
    const instructions = buildCanonicalSessionPlanInstructions(adapter, 'foundation', {
      firstSession: 4,
    });
    expect(instructions).toContain('345 a 435 palabras');
    expect(instructions).toContain('250 a 300 palabras');
    expect(instructions).not.toContain('220 a 300 palabras');
    expect(instructions).toContain('de 115 a 145 palabras CADA párrafo');
    expect(instructions).toContain('"Paso 4: Conclusión:" o "Paso 4: Resultado:"');
    expect(instructions).toContain('AUTOCHEQUEO ANTES DE RESPONDER');
    expect(instructions).toContain('"sintesisVisual"');
    expect(instructions).toContain(adapter.workedExampleDirective);
    expect(instructions).toContain(adapter.keyFormulaOrRuleDirective);
    expect(instructions).toContain('PROHIBIDO escribir "raiz(...)"');
    expect(instructions).toContain('"Paso 1:"');
    expect(instructions).toContain('PROHIBIDO remitir a otro ejercicio');

    const example = JSON.parse(
      buildCanonicalSessionPlanJsonExample(adapter, 4)
    ) as { sessionPlans: SessionPlan[] };
    const plan = example.sessionPlans[0]!;
    expect(plan.sessionNumber).toBe(4);
    expect(plan.sintesisVisual?.mapaConceptual.errorComun).toBeTruthy();
    expect(plan.practica).toHaveLength(2);

    const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
    for (const item of plan.practica) {
      expect(wc(item.enunciado)).toBeGreaterThanOrEqual(45);
      expect(wc(item.enunciado)).toBeLessThanOrEqual(75);
      expect(wc(item.pista)).toBeGreaterThanOrEqual(18);
      expect(wc(item.pista)).toBeLessThanOrEqual(30);
    }
    const paragraphs = plan.contenido.split(/\n\s*\n/);
    expect(paragraphs).toHaveLength(3);
    for (const p of paragraphs) {
      expect(wc(p)).toBeGreaterThanOrEqual(115);
      expect(wc(p)).toBeLessThanOrEqual(145);
    }
    expect(wc(plan.ejemploResuelto)).toBeGreaterThanOrEqual(250);
    expect(wc(plan.ejemploResuelto)).toBeLessThanOrEqual(300);

    const report = evaluateSessionPlanDensity(plan, densityThresholdsFor(1120, false, true));
    expect(report.deficits).toEqual([]);
    expect(report.ok).toBe(true);
  });
});

describe('Prompts V2 — sintesisVisual y retrocompatibilidad', () => {
  it('preserva y sanitiza sintesisVisual en sanitizeSessionPlans', () => {
    const plans = sanitizeSessionPlans(
      [
        {
          ...makeSession(),
          sintesisVisual: VISUAL,
        },
      ],
      [1]
    );
    expect(plans).toHaveLength(1);
    expect(plans?.[0]?.sintesisVisual?.conceptoBreve).toBe(VISUAL.conceptoBreve);
    expect(plans?.[0]?.sintesisVisual?.ejemploBreve.pasos).toHaveLength(3);
    expect(plans?.[0]?.sintesisVisual?.mapaConceptual.criterioDesarrollo).toBe(
      VISUAL.mapaConceptual.criterioDesarrollo
    );
  });

  it('consume sintesisVisual prioritariamente en 08 y 09', () => {
    const session = makeSession({ sintesisVisual: VISUAL });
    const mission = makeWorkbook(session).missions![0]!;
    const concepts = extractConceptHighlights(mission, session, {
      allowMissionFallback: false,
    });
    expect(concepts.definition).toContain('La razón de cambio describe cómo varía');
    expect(
      concepts.formulas.some((formula) =>
        formula.toLowerCase().includes(VISUAL.formulaOReglaClave.toLowerCase())
      )
    ).toBe(true);
    expect(concepts.keyRules).toContain(VISUAL.mapaConceptual.criterioDesarrollo);

    const example = extractWorkedExample(mission, session, {
      allowMissionFallback: false,
    });
    expect(example.problemStatement).toBe(VISUAL.ejemploBreve.planteamiento);
    expect(example.steps).toEqual(VISUAL.ejemploBreve.pasos);
    expect(example.interpretation).toBe(VISUAL.ejemploBreve.conclusion);

    const infographic = buildSacrintInfographic(makeWorkbook(session), 'wide', {
      sessionIndex: 0,
    });
    expect(infographic.claim).toContain('La razón de cambio describe cómo varía');
    expect(infographic.quickExample?.problemStatement).toContain('Una cooperativa registra');
    expect(infographic.misconceptionFix?.error).toContain('Invertir el orden');
    expect(infographic.misconceptionFix?.correction).toContain('Escribe primero los pares');
  });

  it('mantiene el destilador V1 cuando no existe sintesisVisual', () => {
    const session = makeSession();
    const mission = makeWorkbook(session).missions![0]!;
    const concepts = extractConceptHighlights(mission, session, {
      allowMissionFallback: false,
    });
    expect(concepts.definition).not.toContain('La razón de cambio describe cómo varía');
    expect(concepts.definition.length).toBeGreaterThan(30);
    const example = extractWorkedExample(mission, session, {
      allowMissionFallback: false,
    });
    expect(example.problemStatement.length).toBeGreaterThan(20);
    expect(example.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('preserva saltos de párrafo y pasos tras sanitizeSessionPlans y valida cierres no cuantitativos en Humanidades', () => {
    const raw = makeSession({
      contenido:
        'Docente: Un texto argumentativo articula una tesis defendible, razones fundamentadas y evidencias verificables que persuaden al lector crítico.\n\nAl redactar sobre tu comunidad, conviene distinguir hechos observables de opiniones personales, citar fuentes locales confiables y verificar la cohesión entre párrafos.\n\nFinalmente, revisa que tus conectores causales y concesivos sostengan la conclusión sin caer en generalizaciones vacías ni contradicciones lógicas.',
      ejemploResuelto:
        'Planteamiento: Analizas un editorial vecinal sobre el uso responsable del agua potable.\nPaso 1: Subraya la tesis central que propone el autor en el primer párrafo.\nPaso 2: Identifica las razones empíricas y testimonios que respaldan esa postura.\nPaso 3: Evalúa la garantía argumentativa que enlaza las evidencias con la tesis.\nConclusión: El argumento resulta sólido porque combina evidencia local verificable con una relación lógica coherente.',
    });
    const plans = sanitizeSessionPlans([raw], [1]);
    expect(plans).toHaveLength(1);
    const cleaned = plans![0]!;
    expect(cleaned.contenido).not.toMatch(/\bDocente:/i);
    expect(cleaned.contenido.split(/\n\s*\n/)).toHaveLength(3);
    expect(cleaned.ejemploResuelto.split('\n')).toHaveLength(5);

    expect(hasCompleteWorkedExampleClosure(cleaned.ejemploResuelto)).toBe(true);
    expect(
      hasCompleteWorkedExampleClosure(cleaned.ejemploResuelto, { requireNumeric: true })
    ).toBe(false);
    expect(hasCompleteWorkedExampleClosure('Paso 1: analiza y concluye.')).toBe(false);

    const longHumSession = makeSession({
      contenido: Array.from(
        { length: 3 },
        () =>
          'El análisis crítico de textos argumentativos exige identificar la tesis principal, distinguir argumentos basados en evidencia empírica de opiniones sin sustento, examinar la intención comunicativa del emisor y valorar los recursos retóricos utilizados en situaciones reales de la comunidad escolar de Puebla. Asimismo, necesitas verificar la confiabilidad de las fuentes consultadas, reconocer sesgos implícitos y construir una postura ética sustentada en razones claras, datos observables y conectores cohesivos pertinentes para tus interlocutores cotidianos. '.repeat(2)
      ).join('\n\n'),
      ejemploResuelto:
        'Planteamiento: Revisas un artículo de opinión estudiantil acerca del transporte público juvenil en Puebla y la organización de rutas seguras escolares para toda la comunidad educativa de bachillerato, buscando evaluar si su propuesta está argumentada con rigor y sustento verificable.\n' +
        'Paso 1: Identifica la tesis explícita del texto donde se propone reorganizar los horarios de llegada y salida comunitaria considerando los tiempos reales de traslado desde las juntas auxiliares cercanas al plantel y el flujo de estudiantes en horas pico.\n' +
        'Paso 2: Subraya las evidencias cualitativas, testimonios vecinales, minutas escolares, actas de asamblea, registros de asistencia y ejemplos locales presentados por los autores para sustentar su postura crítica frente a opiniones sin respaldo documental alguno.\n' +
        'Paso 3: Analiza la relación de causalidad, pertinencia social y coherencia argumentativa entre las premisas expuestas, el contexto cotidiano de las familias trabajadoras y posibles objeciones administrativas sobre disponibilidad de unidades de transporte y seguridad vial.\n' +
        'Paso 4: Redacta una valoración crítica de pertinencia y suficiencia revisando cohesión textual, conectores lógicos causales y concesivos, claridad expositiva, verificación de fuentes y respeto hacia todas las posturas involucradas en la deliberación escolar.\n' +
        'Conclusión: El editorial analizado sostiene una tesis clara y viable, respaldada por evidencias pertinentes, citas comunitarias verificadas y una garantía lógica consistente que orienta acuerdos responsables en beneficio de la comunidad escolar poblana y regional sin caer en generalizaciones vacías ni falacias.',
      aplicacion:
        'Revisa un aviso o postura pública de tu comunidad escolar en Puebla, identifica su tesis central, contrasta al menos dos evidencias verificables y redacta un comentario argumentativo breve que oriente decisiones informadas entre pares. '.repeat(2),
      productoIntegrador:
        'Integra al portafolio del bloque el borrador de párrafo argumentativo con tesis explícita, dos argumentos respaldados por fuentes locales, refutación de una posible objeción y conclusión coherente para difusión comunitaria.',
      practica: [
        {
          enunciado:
            'Lee el texto breve sobre hábitos de lectura comunitaria en Puebla, identifica la tesis del autor y redacta dos argumentos con evidencias concretas para respaldar o refutar esa postura con claridad.',
          pista: 'Subraya primero la afirmación central antes de buscar sus respaldos.',
        },
        {
          enunciado:
            'Compara dos comentarios sobre el cuidado de áreas verdes del plantel, explica cuál presenta una falacia de generalización apresurada y propone una reformulación fundamentada para tu periódico mural.',
          pista: 'Observa si la conclusión generaliza a partir de un solo caso aislado.',
        },
      ],
    });
    const humReport = evaluateSessionPlanDensity(
      longHumSession,
      densityThresholdsFor(900, false)
    );
    expect(humReport.deficits).toEqual([]);
    expect(humReport.ok).toBe(true);
  });

  it('extractWorkedExample preserva sintesisVisual.ejemploBreve en sesiones humanísticas/sociales/inglés aunque ejemploResuelto tenga "Paso 1" o trate sobre rúbricas analíticas', () => {
    const rubricEvalSession = makeSession({
      sessionNumber: 53,
      objetivo: 'Evaluar el criterio de diseño accesible del periódico mural usando una rúbrica.',
      ejemploResuelto:
        'Planteamiento: Debes evaluar el criterio de Diseño accesible de tu periódico mural utilizando la rúbrica analítica del bloque con niveles Excelente, Satisfactorio y Necesita mejorar.\n' +
        'Paso 1: Compara el mural final con los descriptores de la rúbrica.\n' +
        'Paso 2: Justifica el nivel asignado con evidencias de legibilidad.\n' +
        'Paso 3: Define acciones de mejora concretas.\n' +
        'Paso 4: Conclusión: La evaluación objetiva orienta mejoras futuras.',
      sintesisVisual: {
        conceptoBreve:
          'La rúbrica analítica permite valorar con objetividad cada dimensión del producto comunicativo y orientar mejoras concretas.',
        formulaOReglaClave: 'Evidencia + Descriptores de Rúbrica → Nivel y Mejora',
        ejemploBreve: {
          planteamiento:
            'Evaluar el criterio de Diseño accesible usando una rúbrica de tres niveles (Excelente, Satisfactorio, Necesita mejorar).',
          pasos: [
            'Comparar el mural final con los descriptores de la rúbrica.',
            'Justificar el nivel Excelente mediante la aplicación de técnicas de legibilidad.',
            'Asignar puntaje y establecer compromiso de mejora.',
          ],
          conclusion:
            'La evaluación objetiva permite identificar fortalezas y áreas de oportunidad para futuras producciones.',
        },
        mapaConceptual: {
          definicionClave: 'Instrumento con niveles graduados para valorar evidencias de aprendizaje.',
          criterioDesarrollo: 'Contrastar cada descriptor con evidencias visibles del producto.',
          errorComun: 'Asignar calificación global sin justificar cada criterio de desempeño.',
          correccionBreve: 'Revisar criterio por criterio y documentar una acción concreta de mejora.',
        },
      },
    });
    const mission = makeWorkbook(rubricEvalSession).missions![0]!;
    const extracted = extractWorkedExample(mission, rubricEvalSession, { allowMissionFallback: false });
    expect(extracted.problemStatement).toContain('Diseño accesible');
    expect(extracted.steps).toHaveLength(3);
    expect(extracted.interpretation).toContain('fortalezas');
  });
});
