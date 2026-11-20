import { describe, expect, it } from 'vitest';
import {
  fitPedagogicalText,
  hasDanglingEnding,
  repairDanglingEnding,
} from '@/lib/editorial/pedagogical-text-fitter';
import {
  extractDisciplinaryConceptPhrase,
  resolveChalkboardTopicTitle,
  resolveInfographicConceptTitle,
} from '@/lib/editorial/topic-title-resolver';
import {
  distillExerciseStatement,
  distillStepPreservingMath,
  extractFormulasFromText,
  paraphraseSixGramOverlap,
  sanitizePedagogicalMetaPhrases,
} from '@/lib/visual-engine/sacrint/content-distiller';
import {
  buildSacrintDeck,
  buildSacrintDecksForWorkbook,
  buildSacrintInfographic,
  countSlideWords,
} from '@/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import {
  auditInfographicSpec,
  auditPptxFile,
  auditWorkbookVisualQuality,
} from '../../scripts/qa-sacrint-materials';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function makeV2Workbook(params: {
  subjectName: string;
  title: string;
  concept: string;
  formulaRule: string;
  errorComun: string;
  correccionBreve: string;
  ejemplo: string;
  practica1: string;
  practica2: string;
  aplicacion: string;
  producto: string;
  contenido?: string;
}): ActiveWorkTextbook {
  const session = (sn: number): SessionPlan =>
    ({
      sessionNumber: sn,
      objetivo: `Aplicar ${params.title.toLowerCase()} en el análisis de casos reales (${sn}).`,
      motivacion: `En tu plantel se analiza ${params.title.toLowerCase()} con evidencias concretas.`,
      saberesPrevios: `Recupera experiencias previas sobre ${params.title.toLowerCase()}.`,
      contenido: params.contenido ?? params.concept,
      ejemploResuelto: params.ejemplo,
      practica: [
        {
          enunciado: params.practica1,
          pista: 'Revisa los datos y criterios centrales antes de formular tu respuesta.',
        },
        {
          enunciado: params.practica2,
          pista: 'Sustenta tu procedimiento y conclusión con evidencia verificable.',
        },
      ],
      aplicacion: params.aplicacion,
      productoIntegrador: params.producto,
      autoevaluacion: [
        'Identifico los criterios principales y respaldo cada conclusión con evidencia verificable.',
        'Contrasté mi procedimiento evitando errores conceptuales frecuentes.',
      ],
      recursos: [],
      sintesisVisual: {
        conceptoBreve: params.concept,
        formulaOReglaClave: params.formulaRule,
        ejemploBreve: {
          planteamiento: params.ejemplo.split('\n')[0] || params.ejemplo,
          pasos: [
            'Identifica los datos o evidencias centrales del caso.',
            'Aplica el procedimiento o criterio disciplinar correspondiente.',
            'Verifica la coherencia de la conclusión con las condiciones iniciales.',
          ],
          conclusion: 'El análisis cumple rigor metodológico y coherencia con la situación.',
        },
        mapaConceptual: {
          definicionClave: params.concept,
          criterioDesarrollo: 'Articular criterio disciplinar y evidencia verificable antes de concluir.',
          errorComun: params.errorComun,
          correccionBreve: params.correccionBreve,
        },
      },
    }) as unknown as SessionPlan;

  const mission = {
    missionIndex: 1,
    title: `Misión 1: ${params.title}`,
    coveredSessions: [1, 2],
    sessionTopic: params.title,
    sessionFocus: params.concept,
    phenomenonHook: { story: params.concept, detonatingQuestion: `¿Cómo aplicar ${params.title.toLowerCase()}?` },
    conceptZero: { physicalAnalogy: '', coreExplanation: params.contenido ?? params.concept, contrastTable: [] },
    iDoSection: { stepByStepDemo: params.ejemplo },
    weDoSection: { guidedPractice: params.practica1, workbookElements: [] },
    youDoSection: { autonomousChallenge: params.practica2, workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
    wordCount: 500,
    sessionPlans: [session(1), session(2)],
  } as unknown as MissionSection;

  return {
    subsystem: 'fundamental',
    blockIndex: 0,
    blockName: `Bloque I · ${params.title}`,
    coverData: {
      title: `Cuaderno ${params.subjectName}`,
      subjectName: params.subjectName,
      schoolName: 'Bachillerato General',
      blockNumber: 1,
    },
    missions: [mission],
    projectSection: {
      artifactName: 'Dossier analítico comunitario',
      communityUtility: 'Compartir hallazgos verificados con la comunidad escolar.',
    },
  } as unknown as ActiveWorkTextbook;
}

describe('Auditoría V2 — Integridad editorial, fórmulas, títulos y compatibilidad multi-asignatura', () => {
  it('detecta finales colgados, ecuaciones mutiladas, gerundios y cláusulas acéfalas en hasDanglingEnding', () => {
    expect(hasDanglingEnding('El costo total se modela mediante la ecuación lineal 3(2x - 4)')).toBe(true);
    expect(hasDanglingEnding('Modela la situación con la ecuación 600x.')).toBe(true);
    expect(hasDanglingEnding('Como -12 + 12 = 0, la ecuación.')).toBe(true);
    expect(hasDanglingEnding('Evalúa de 2 a 6 horas para ver.')).toBe(true);
    expect(hasDanglingEnding('Estructurar mis argumentos combinando.')).toBe(true);
    expect(hasDanglingEnding('En tu comunidad del estado de Puebla.')).toBe(true);
    expect(hasDanglingEnding('Incluye en tu expediente de evidencias.')).toBe(true);
    expect(hasDanglingEnding('Convierto porcentajes de error a decimales antes.')).toBe(true);

    // Oraciones completas válidas no deben ser falsos positivos
    expect(hasDanglingEnding('El costo total se modela con la ecuación lineal 3(2x - 4) = 60.')).toBe(false);
    expect(hasDanglingEnding('Como -12 + 12 = 0, la ecuación se reduce a 6x = 60.')).toBe(false);
  });

  it('fitPedagogicalText preserva ecuaciones completas sin amputar = 60, + 400x ni + 300y = 1800', () => {
    const eq1 = fitPedagogicalText(
      'El costo total para adquirir el equipamiento se modela mediante la ecuación lineal 3(2x - 4) = 60.',
      { maxChars: 92, maxWords: 15, role: 'problem' }
    );
    expect(eq1).toContain('3(2x - 4) = 60');
    expect(hasDanglingEnding(eq1)).toBe(false);

    const eq2 = fitPedagogicalText(
      'Dispones de un presupuesto de $5,000 para comprar kits de pintura. Modela con la ecuación C = 200 + 400x y calcula el máximo de kits.',
      { maxChars: 118, maxWords: 20, role: 'activity' }
    );
    expect(eq2).toContain('C = 200 + 400x');
    expect(hasDanglingEnding(eq2)).toBe(false);

    const eq3 = fitPedagogicalText(
      'Compra mallas (x) a $600 y postes (y) a $300 con $1,800. Modela con la ecuación 600x + 300y = 1800 y tabula 3 pares ordenados.',
      { maxChars: 116, maxWords: 20, role: 'activity' }
    );
    expect(eq3).toContain('600x + 300y = 1800');
    expect(hasDanglingEnding(eq3)).toBe(false);
  });

  it('extractFormulasFromText preserva Unicode/Cochran y rechaza fórmulas rotas o tautológicas', () => {
    const expFormulas = extractFormulasFromText(
      'El crecimiento exponencial sigue P(t) = P₀(1 + r)ᵗ con P₀ = 800 y r = 0.04.',
      3
    );
    expect(expFormulas[0]).toBe('P(t) = P₀(1 + r)ᵗ');
    expect(expFormulas).not.toContain('P(t) = P');

    const cochran = extractFormulasFromText(
      'Aplica la fórmula muestral n = (Z² * p * q * N) / (e² * (N-1) + Z² * p * q) para N = 2000.',
      3
    );
    expect(cochran[0]).toBe('n = (Z² * p * q * N) / (e² * (N-1) + Z² * p * q)');
    expect(cochran).not.toContain('n = (Z² * p * q * N)');

    const badText =
      'Comprobamos 15 = 15. Con $4500 - 1200 = 150x. El área es base * altura / 2 = 30 m² y escala 1 cm = 0.2 m. Ecuación 1: 4x + 3y = 290.';
    const cleaned = extractFormulasFromText(badText, 5);
    expect(cleaned).not.toContain('15 = 15');
    expect(cleaned).not.toContain('- 1200 = 150x');
    expect(cleaned).not.toContain('/ 2 = 30 m²');
    expect(cleaned).not.toContain('cm = 0.2');
    expect(cleaned).toContain('4x + 3y = 290');
  });

  it('topic-title-resolver no reduce títulos a un solo adjetivo ni deja colas meta-formativas', () => {
    expect(extractDisciplinaryConceptPhrase('Optimizar los modelos matemáticos')).not.toBe('Matemáticos');
    expect(extractDisciplinaryConceptPhrase('Contrastar métodos analíticos')).not.toBe('Analíticos');

    const titleClosure = resolveInfographicConceptTitle({
      sessionObjective: 'Evaluar de manera formativa, sintetizar y realizar una reflexión sobre tus aprendizajes',
      missionSessionTopic: 'Modelos de crecimiento exponencial',
    });
    expect(titleClosure.toLowerCase()).not.toContain('manera formativa');
    expect(titleClosure.toLowerCase()).toContain('crecimiento exponencial');

    const titleGeom = resolveInfographicConceptTitle({
      sessionObjective:
        'Integrarás los resultados de tus encuestas comunitarias con los fundamentos de la geometría plana para diseñar un espacio recreativo funcional.',
      missionSessionTopic: 'Geometría plana aplicada',
    });
    expect(titleGeom.toLowerCase()).not.toMatch(/con los fundamentos$/);
    expect(titleGeom.toLowerCase()).toContain('geometría plana');
  });

  it('preserva sintesisVisual en 08 y 09 para Lengua, Historia y Cultura Digital sin fallbacks matemáticos', async () => {
    const subjects = [
      makeV2Workbook({
        subjectName: 'Lengua y Comunicación I',
        title: 'Estructura argumentativa y validez de fuentes',
        concept:
          'Un texto argumentativo sólido articula una tesis clara, evidencias verificables y una garantía lógica que conecta ambas.',
        formulaRule: 'Tesis + Evidencia Verificable + Garantía → Conclusión Argumentada',
        errorComun: 'Confundir una opinión personal sin respaldo con un argumento documentado.',
        correccionBreve: 'Exige al menos una fuente verificable o dato empírico que respalde cada afirmación.',
        ejemplo:
          'Planteamiento: Analiza el editorial sobre transporte escolar comunitario.\nPaso 1: Identifica la tesis central del autor.\nPaso 2: Señala la evidencia de 120 familias encuestadas.\nPaso 3: Evalúa la garantía lógica entre dato y postura.\nConclusión: El argumento es válido porque une tesis con datos verificables.',
        practica1:
          'Lee el informe sobre reciclaje escolar: el plantel redujo en 45% sus residuos tras instalar dos composteras. Identifica la tesis y redacta una premisa con evidencia.',
        practica2:
          'Compara dos opiniones vecinales sobre iluminación en el parque y señala cuál presenta una falacia argumentativa y por qué.',
        aplicacion: 'Revisa un cartel informativo de tu escuela y evalúa si presenta argumentos verificables para la comunidad.',
        producto: 'Integra el borrador de párrafo argumentativo con tesis, dos premisas y fuente citada.',
      }),
      makeV2Workbook({
        subjectName: 'Conciencia Histórica I',
        title: 'Multicausalidad y análisis de fuentes primarias',
        concept:
          'La explicación histórica distingue causas estructurales de largo plazo, coyunturales y detonantes usando fuentes primarias contextualizadas.',
        formulaRule: 'Fuente Primaria + Contexto Temporal → Causa Estructural vs. Detonante',
        errorComun: 'Juzgar hechos del pasado con valores actuales (anacronismo) sin contextualizar la fuente.',
        correccionBreve: 'Ubica autor, fecha, propósito e intereses de la época antes de interpretar el documento.',
        ejemplo:
          'Planteamiento: Analiza un periódico de 1911 sobre demandas agrarias locales.\nPaso 1: Identifica autor, fecha y destinatario de la fuente.\nPaso 2: Ubica las demandas económicas como causas estructurales.\nPaso 3: Señala el hecho inmediato detonante de la movilización.\nConclusión: La fuente revela múltiples causas históricas articuladas.',
        practica1:
          'Analiza las dos fuentes de inicios del siglo XX elaborando una matriz comparativa con contexto de producción y postura del autor.',
        practica2:
          'Clasifica cuatro factores históricos de la lectura en causas estructurales, coyunturales y detonantes justificando cada elección.',
        aplicacion: 'Contrasta una nota actual de tu comunidad con documentos de archivo municipal para identificar cambios y permanencias.',
        producto: 'Integra la ficha de análisis de fuente primaria con matriz multicausal verificada.',
      }),
      makeV2Workbook({
        subjectName: 'Cultura Digital I',
        title: 'Algoritmos, descomposición y complejidad lógica',
        concept:
          'Todo algoritmo bien diseñado descompone un problema en entradas validadas, control de flujo determinista y salidas verificables.',
        formulaRule: 'Entrada → Proceso (Secuencia / Decisión / Ciclo) → Salida Verificable',
        errorComun: 'Codificar ciclos sin condición de paro ni validación de casos frontera en la entrada.',
        correccionBreve: 'Ejecuta una prueba de escritorio con valores límite antes de codificar.',
        ejemplo:
          'Planteamiento: Diseña un pseudocódigo para promediar 30 calificaciones válidas entre 0 y 10.\nPaso 1: Define entrada y rango válido de 0 a 10.\nPaso 2: Itera 30 veces acumulando datos válidos.\nPaso 3: Calcula el promedio final e imprime el estatus.\nConclusión: La validación de entradas evita promedios erróneos.',
        practica1:
          'Traza el diagrama de flujo y la prueba de escritorio del algoritmo para detectar temperaturas fuera de 18 °C a 26 °C.',
        practica2:
          'Corrige el pseudocódigo dado identificando por qué genera un ciclo infinito cuando la entrada es negativa.',
        aplicacion: 'Automatiza la verificación de asistencia escolar definiendo reglas de entrada y alertas de rango.',
        producto: 'Integra el pseudocódigo validado y la tabla completa de prueba de escritorio.',
      }),
    ];

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigpda-v2-qa-'));
    try {
      for (const wb of subjects) {
        const decks = buildSacrintDecksForWorkbook(wb, { mode: 'lesson-guide' });
        const conceptSlide = decks[0]!.slides.find((s) => s.kind === 'concept');
        expect(conceptSlide?.kind).toBe('concept');
        if (conceptSlide?.kind === 'concept') {
          const expectedErr = wb.missions![0]!.sessionPlans![0]!.sintesisVisual!.mapaConceptual!.errorComun!;
          const expectedRule = wb.missions![0]!.sessionPlans![0]!.sintesisVisual!.formulaOReglaClave!;
          expect(conceptSlide.formula).toBe(expectedRule);
          expect(conceptSlide.formula).not.toBe('P1 + P2 → T');
          expect(conceptSlide.misconception.toLowerCase()).toContain(expectedErr.toLowerCase().slice(0, 22));
          expect(countSlideWords(conceptSlide)).toBeLessThanOrEqual(180);
        }

        const info = buildSacrintInfographic(wb, 'wide', { missionIndex: 0, sessionIndex: 0 });
        expect(info.misconception).not.toMatch(/condiciones y unidades|antes de operar/i);
        expect(auditInfographicSpec(info, wb.coverData.subjectName).findings).toEqual([]);

        const visAudit = auditWorkbookVisualQuality(wb, decks);
        expect(visAudit.presentationFindings).toEqual([]);
        expect(visAudit.infographicFindings).toEqual([]);
        expect(visAudit.passed).toBe(true);

        const pptxFile = path.join(tmpDir, `${wb.coverData.subjectName.replace(/[^a-z0-9]/gi, '_')}.pptx`);
        fs.writeFileSync(pptxFile, await generateCombinedSacrintPptx(decks));
        const pptxQa = await auditPptxFile(pptxFile);
        expect(pptxQa.collisions).toEqual([]);
        expect(pptxQa.wordStats.slide12Over200).toBe(0);
        expect(pptxQa.wordStats.slide22Over200).toBe(0);
        expect(pptxQa.findings).toEqual({});
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('preserva ambas opciones de comparación, ecuaciones y explicación completa sin estado global compartido', () => {
    const mathWb = makeV2Workbook({
      subjectName: 'Pensamiento Matemático III',
      title: 'Ecuaciones de primer grado',
      concept:
        'Una ecuación de primer grado con una incógnita es una igualdad algebraica en la que el exponente máximo de la variable es uno. Para resolverla aplicamos propiedades de equivalencia.',
      contenido:
        'Una ecuación de primer grado con una incógnita es una igualdad algebraica en la que el exponente máximo de la variable es uno. Para resolverla y encontrar el valor exacto de la incógnita, aplicamos las propiedades fundamentales de la igualdad.',
      formulaRule: '3(2x - 4) = 60',
      errorComun: 'Agrupar el término independiente con el coeficiente de la variable x.',
      correccionBreve: 'Separa términos con variable de los constantes usando la operación inversa.',
      ejemplo:
        'Planteamiento: El costo total para adquirir el equipamiento se modela mediante la ecuación lineal 3(2x - 4) = 60.\nPaso 1: Aplica la propiedad distributiva: 6x - 12 = 60.\nPaso 2: Suma 12 en ambos miembros: 6x = 72.\nPaso 3: Divide entre 6 para aislar la incógnita: x = 12.\nConclusión: Sustituye x = 12 en 3(2(12) - 4) = 60 y verifica que se cumple la igualdad.',
      practica1:
        'La opción A cobra fijo $1200 más $300 por hora (300x + 1200) y la opción B cobra fijo $500 más $450 por hora (450x + 500). Evalúa de 2 a 6 horas para determinar cuándo se igualan los costos.',
      practica2:
        'Dispones de un presupuesto de $5,000 para comprar kits de pintura. Modela la situación con la ecuación C = 200 + 400x y calcula cuántos kits puedes adquirir.',
      aplicacion: 'Aplica ecuaciones lineales para comparar cotizaciones reales de servicios en tu plantel escolar.',
      producto: 'Integra la tabla comparativa de costos y su ecuación lineal validada al portafolio.',
    });

    // Compilar dos veces de forma aislada debe ser determinista (sin fuga por Map global de módulo)
    const deckA = buildSacrintDeck(mathWb, { mode: 'lesson-guide', missionIndex: 0 });
    const deckB = buildSacrintDeck(mathWb, { mode: 'lesson-guide', missionIndex: 0 });
    const conceptA = deckA.slides.find((s) => s.kind === 'concept');
    const conceptB = deckB.slides.find((s) => s.kind === 'concept');
    expect(conceptA?.kind === 'concept' && conceptB?.kind === 'concept').toBe(true);
    if (conceptA?.kind === 'concept' && conceptB?.kind === 'concept') {
      expect(conceptA.misconception).toBe(conceptB.misconception);
      expect(conceptA.explanation).not.toMatch(/^Para\s+resolverla/i);
      expect(conceptA.workedExample?.problemStatement).toContain('3(2x - 4) = 60');
    }

    const practice = deckA.slides.find((s) => s.kind === 'practice');
    expect(practice?.kind).toBe('practice');
    if (practice?.kind === 'practice') {
      const a1 = practice.activities?.[0]?.statement ?? '';
      const a2 = practice.activities?.[1]?.statement ?? '';
      expect(a1).toContain('1200');
      expect(a1).toContain('300');
      expect(a1).toContain('500');
      expect(a1).toContain('450');
      expect(a2).toContain('C = 200 + 400x');
    }
  });

  it('auditInfographicSpec detecta fórmulas rotas, títulos de 1 adjetivo y fugas matemáticas en no-STEM', () => {
    const broken = auditInfographicSpec(
      {
        title: 'Analíticos',
        formula: '/ 2 = 30 m²',
        misconception: 'Aplicar una regla sin comprobar las condiciones específicas del problema.',
        misconceptionFix: {
          error: 'Aplicar una regla sin comprobar las condiciones específicas del problema.',
          correction: 'Identifica datos, condiciones y unidades; verifica antes de operar.',
        },
      } as never,
      'Conciencia Histórica I'
    );
    expect(broken.findings.length).toBeGreaterThanOrEqual(3);
  });

  it('detecta conjunción truncada "y.", sustantivos de evidencia amputados y definiciones rotas', () => {
    // Conjunción "y." tras dígito, ecuación o paréntesis SIEMPRE es truncamiento
    expect(hasDanglingEnding('Plantea el sistema: x + y = 50 y.')).toBe(true);
    expect(hasDanglingEnding('La solución analítica es x = 38 y.')).toBe(true);
    expect(hasDanglingEnding('Las dimensiones espaciales exactas son x = 4.6 y.')).toBe(true);
    expect(hasDanglingEnding("Despeja 'x' en ambas: x = (13-3y)/2 y.")).toBe(true);
    expect(hasDanglingEnding('Buscamos dos números que multiplicados den menos 300 y.')).toBe(true);
    expect(hasDanglingEnding('Ubica el eje X de 0 a 6 y.')).toBe(true);

    // Variable matemática legítima "y" sigue siendo válida
    expect(hasDanglingEnding('Calcula los valores de y.')).toBe(false);
    expect(hasDanglingEnding('Despeja la variable y.')).toBe(false);
    expect(hasDanglingEnding('El valor resultante es igual a f(x) = y.')).toBe(false);

    // Cortes estructurales en definiciones, pasos y avances de evidencia
    expect(hasDanglingEnding('Una ecuación cuadrática con una variable es aquella que se puede escribir en su forma.')).toBe(true);
    expect(hasDanglingEnding('Escribe primero la ecuación en la forma.')).toBe(true);
    expect(hasDanglingEnding('Agrega hoy a tu portafolio de evidencias la memoria.')).toBe(true);
    expect(hasDanglingEnding('Incorpora a tu carpeta de evidencias el reporte.')).toBe(true);
    expect(hasDanglingEnding('Incluye en tu expediente de evidencias la versión.')).toBe(true);
    expect(hasDanglingEnding('Integra hoy en la sección de memorias.')).toBe(true);
    expect(hasDanglingEnding('El método de reducción, también conocido como suma y resta.')).toBe(true);
    expect(hasDanglingEnding('La validación en el pensamiento matemático no es un mero trámite.')).toBe(true);
    expect(hasDanglingEnding('Validación gráfica: la recta x + y = 60 cruza.')).toBe(true);
    expect(hasDanglingEnding('Aplica directamente la fórmula de interés simple I = C ·.')).toBe(true);
    expect(hasDanglingEnding('Inversión de $100,000 bajo interés compuesto del 9% anual durante 3.')).toBe(true);
    expect(hasDanglingEnding('Cuando se proyecta la mejora de un parque o espacio.')).toBe(true);
    expect(hasDanglingEnding('Integra en la primera sección de tu bitácora de trabajo.')).toBe(true);
    expect(hasDanglingEnding('El uso de modelos gráficos y tabulares te posibilita.')).toBe(true);

    // Pronombre definido completo ("en la otra") sigue siendo válido
    expect(hasDanglingEnding('Busca una esquina en tu casa o escuela. Mide 30 cm en una pared y 40 cm en la otra.')).toBe(false);

    // Ecuaciones con términos de dos letras (mx, ax, by) se conservan íntegras al ajustar pistas
    const linearFormHint = fitPedagogicalText(
      'Escribe primero la ecuación en la forma y = mx + b identificando la pendiente y la ordenada al origen.',
      { maxChars: 62, maxWords: 11, role: 'hint' }
    );
    expect(linearFormHint).toContain('y = mx + b');

    // repairDanglingEnding no debe partir listas numéricas separadas por coma
    expect(repairDanglingEnding('Sustituye los valores x = 1, 3 y 5 en la ecuación y')).toContain('1, 3 y 5');
  });

  it('distillExerciseStatement preserva todos los datos numéricos, no duplica cláusulas condicionales ni inicia en minúscula', () => {
    const withFixedAndUnit =
      'Un grupo de jóvenes organiza un taller y gasta $120 pesos en impresiones de una guía, además de $25 pesos por cada cuaderno adquirido. Si el gasto total asciende a $520 pesos, plantea una ecuación lineal y determina cuántos cuadernos se compraron.';
    const out1 = distillExerciseStatement(withFixedAndUnit, 360, 70);
    expect(out1).toContain('120');
    expect(out1).toContain('25');
    expect(out1).toContain('520');
    expect(out1).toMatch(/^[A-ZÁÉÍÓÚÑ]/);

    const noDupSrc =
      'Ejercicio 1: Un grupo de jóvenes planea comprar 5 paquetes deportivos idénticos y un botiquín valuado en 350 pesos para su centro comunitario. Si el costo total de la compra asciende a 1350 pesos, plantea la ecuación utilizando la balanza algebraica y determina el costo exacto de cada paquete deportivo.';
    const out2 = distillExerciseStatement(noDupSrc, 360, 70);
    const matches1350 = out2.match(/1350/g) ?? [];
    expect(matches1350).toHaveLength(1);
    expect(out2).toContain('350');
    expect(out2).toContain('plantea');

    const twoPurchases =
      'Para el proyecto comunitario juvenil, se adquieren 4 balones de fútbol y 3 balones de básquetbol por un costo total de 2900 pesos. En una segunda compra institucional, se adquieren 2 balones de fútbol y 5 balones de básquetbol por un costo total de 3100 pesos. Aplica el método de reducción para determinar el costo unitario de cada balón.';
    const out3 = distillExerciseStatement(twoPurchases, 360, 70);
    expect(out3).toContain('2900');
    expect(out3).toContain('3100');
    expect(out3).toMatch(/^[A-ZÁÉÍÓÚÑ]/);

    const descriptiveModela =
      "Ejercicio 2: Un club deportivo comunitario modela el costo total 'y' para organizar un torneo según la expresión y = 200x + 1200, donde 'x' representa el número de equipos. Calcula la tabulación para x = 1, 3 y 5, y explica el punto (3, 1800).";
    const out4 = distillExerciseStatement(descriptiveModela, 360, 70);
    expect(out4).toContain('Calcula');
    expect(out4).toContain('1800');
  });

  it('distillStepPreservingMath evita inicios acéfalos "Para ello, multiplicamos toda:" y conserva coeficientes completos', () => {
    const stepMul = distillStepPreservingMath(
      'Paso 2 Ecuación: Para ello, multiplicamos toda la Ecuación 2 por el factor 3, obteniendo: 3(2x - y) = 3(30) => 6x - 3y = 90.',
      90,
      12
    );
    expect(stepMul).not.toMatch(/^Para\s+ello/i);
    expect(stepMul).not.toMatch(/\btoda\s*:/i);
    expect(stepMul).toContain('3(2x - y) = 3(30)');

    const stepCoefs = distillStepPreservingMath(
      'En la ecuación x² + 6x - 160 = 0, los coeficientes son a = 1, b = 6 y c = -160.',
      64,
      10
    );
    expect(stepCoefs).toContain('a = 1');
    expect(stepCoefs).toContain('b = 6');
    expect(stepCoefs).toContain('c = -160');
  });

  it('extractFormulasFromText y 09_Infografías evitan prefijos sucios, "e = 80,000", ecuaciones pegadas y errores cruzados de Estadística en Geometría', () => {
    const simpleInterest = extractFormulasFromText(
      'Interés Simple: M = C(1 + i*t). Año 1: Simple = 80,000(1 + 0.12) = 89,600.',
      3
    );
    expect(simpleInterest.some((f) => /^e\s*=/.test(f))).toBe(false);
    expect(simpleInterest.some((f) => f.includes('M = C(1 + i*t)'))).toBe(true);

    const prefixed = extractFormulasFromText(
      'Las ecuaciones son: (1) x + y = 10 y (2) 100x + 50y = 800. Evalúa (x): 350x + 800 = 450x + 300.',
      3
    );
    for (const f of prefixed) {
      expect(f).not.toMatch(/^\(\s*[A-Za-z0-9]+\s*\)|^[A-Za-z0-9]+\s*:/);
    }

    const pythagoras = extractFormulasFromText('c² = a² + b² c² = (3.6)² + (4.8)²', 2);
    expect(pythagoras[0]).toBe('c² = a² + b²');

    // No debe convertir variable física minúscula v = Δx / Δt en V = ...
    expect(sanitizePedagogicalMetaPhrases('v = Δx / Δt ⇒ x(t) = x₀ + v · t')).toMatch(/^v\s*=/);

    // Inglés V2: conserva ambas reglas separadas por "|" en 09_Infografía
    const englishWb = makeV2Workbook({
      subjectName: 'Inglés I',
      title: 'Rutinas cotidianas en presente simple',
      concept: 'El presente simple describe hábitos cotidianos usando do/does en preguntas y -s/-es en tercera persona.',
      formulaRule: 'Sujeto (He/She/It) + Verbo(-s/-es) | Do/Does + Sujeto + Verbo base',
      errorComun: 'Omitir la terminación -s/-es en tercera persona singular o duplicarla tras does.',
      correccionBreve: 'Usa -s solo en afirmativo de he/she/it y verbo base tras does.',
      ejemplo:
        'Planteamiento: Transforma la rutina de Laura.\nPaso 1: Laura studies at 7:00.\nPaso 2: She does not skip math.\nPaso 3: Does she practice?\nConclusión: El auxiliar does absorbe la flexión.',
      practica1: 'Completa cinco oraciones sobre rutinas usando correctamente -s/-es, do o does.',
      practica2: 'Redacta un diálogo breve de cuatro turnos preguntando por hábitos semanales.',
      aplicacion: 'Entrevista en inglés a un docente sobre su horario semanal y registra tres oraciones.',
      producto: 'Integra la ficha bilingüe de rutinas escolares al portafolio de evidencias.',
    });
    const engInfo = buildSacrintInfographic(englishWb, 'wide', { missionIndex: 0, sessionIndex: 0 });
    expect(engInfo.formula).toBe('Sujeto (He/She/It) + Verbo(-s/-es) | Do/Does + Sujeto + Verbo base');

    // Geometría plana NO debe heredar error común de Estadística ("muestra sesgada")
    const geomWb = makeV2Workbook({
      subjectName: 'Pensamiento Matemático III',
      title: 'Geometría plana para diseñar un espacio recreativo funcional',
      concept: 'La geometría plana calcula áreas y perímetros para distribuir un espacio recreativo funcional.',
      formulaRule: '(10 * h) / 2 = 30',
      errorComun: 'Generalizar desde una muestra sesgada o insuficiente.',
      correccionBreve: 'Definir tamaño muestral representativo.',
      ejemplo:
        'Planteamiento: Calcula la altura h de un triángulo con base 10 m y área 30 m².\nPaso 1: Plantea (10 * h) / 2 = 30.\nPaso 2: Despeja 5h = 30.\nPaso 3: Obtiene h = 6 m.\nConclusión: La altura es 6 m.',
      practica1: 'Calcula el área de un triángulo de base 12 m y altura 8 m para una zona de sombra.',
      practica2: 'Determina el perímetro de un rectángulo de 15 m por 9 m para cercar el patio.',
      aplicacion: 'Mide un área escolar y verifica que su perímetro y superficie cumplan las normas.',
      producto: 'Integra el plano acotado con áreas y perímetros validados al expediente.',
    });
    const geomInfo = buildSacrintInfographic(geomWb, 'wide', { missionIndex: 0, sessionIndex: 0 });
    expect(geomInfo.misconception.toLowerCase()).not.toContain('muestra sesgada');
    expect(geomInfo.misconception.toLowerCase()).toMatch(/per[ií]metro|[aá]rea|geom[eé]trica|unidades/);
  });

  it('previene cláusulas subordinadas huérfanas, fracciones truncadas, corrupción aritmética y títulos rotos', () => {
    // Cláusulas subordinadas sin principal, verbos colgados, listas rotas y paréntesis desbalanceados
    expect(hasDanglingEnding('Para realizar una comparación rigurosa entre el interés simple y el compuesto.')).toBe(true);
    expect(hasDanglingEnding('Al aplicar la validación entre métodos analíticos y gráficos en la construcción.')).toBe(true);
    expect(hasDanglingEnding('Cuando se proyecta la mejora de un parque o espacio deportivo, los vecinos.')).toBe(true);
    expect(hasDanglingEnding("Si el ancho es 'x'.")).toBe(true);
    expect(hasDanglingEnding('Hoy incorporas a tu problemario de la misión el reporte.')).toBe(true);
    expect(hasDanglingEnding('Hoy integras a tu expediente el reporte técnico final, que incluye.')).toBe(true);
    expect(hasDanglingEnding('Agrega hoy a tu dossier técnico la memoria de cálculo del tamaño.')).toBe(true);
    expect(hasDanglingEnding('Estructurar mis argumentos combinando con fluidez.')).toBe(true);
    expect(hasDanglingEnding('Elabora un cuadro síntesis: 1) Interés, 2) Población, 3) Muestras, y 4).')).toBe(true);
    expect(hasDanglingEnding('En cientos de pesos): y = 15x + 50.')).toBe(true);

    // Fracciones parentetizadas y radicales completos nunca se amputan tras el paréntesis
    const cochran = fitPedagogicalText(
      'Ecuación. n = (1000 * 1.96² * 0.5 * 0.5) / (0.05² * 999 + 1.96² * 0.5 * 0.5).',
      { maxChars: 64, maxWords: 12, role: 'step' }
    );
    expect(cochran).toContain('/ (0.05² * 999 + 1.96² * 0.5 * 0.5)');

    const baricentro = fitPedagogicalText(
      'Su centro geométrico se ubica a una distancia vertical de h = (4.5 · √3) / 6 ≈ 1.299 metros respecto al punto medio del lado base.',
      { maxChars: 96, maxWords: 15, role: 'conclusion' }
    );
    expect(baricentro).toContain('/ 6');
    expect(baricentro).toContain('1.299');

    // Promoción de cláusula principal en oraciones con subordinada extensa inicial
    const promotedConcept = fitPedagogicalText(
      'Para garantizar que las estructuras de soporte en tu cenador comunitario sean totalmente idénticas y garanticen una distribución uniforme de cargas, la geometría euclidiana establece los criterios de congruencia de triángulos.',
      { maxChars: 135, maxWords: 20, role: 'concept' }
    );
    expect(hasDanglingEnding(promotedConcept)).toBe(false);
    expect(promotedConcept).not.toMatch(/^Para\s+garantizar\b/i);
    expect(promotedConcept).toContain('geometría euclidiana');

    // No corromper dos igualdades separadas ((3.6)² = 12.96 y (4.8)² = 23.04) en "(3.6)² = 23.04"
    const pythagStep = distillStepPreservingMath(
      'Paso 2: Eleva al cuadrado cada término y realiza la suma aritmética correspondiente.\n(3.6)² = 12.96\n(4.8)² = 23.04\nc² = 12.96 + 23.04 = 36.00',
      120,
      18
    );
    expect(pythagStep).not.toMatch(/\(3\.6\)²\s*=\s*23\.04/);
    expect(pythagStep).toContain('12.96');
    expect(pythagStep).toContain('23.04');

    // Sin doble punto final en paso de determinantes
    const cramerStep = distillStepPreservingMath(
      'Cálculo de los determinantes para aplicar la Regla de Cramer: D = (2)(-3) - (1)(1) = -7. Dx = (120)(-3) - (1)(10) = -370. Dy = (2)(10) - (120)(1) = 20 - 120 = -100.',
      90,
      12
    );
    expect(cramerStep).not.toContain('..');

    // Concordancia de género en paráfrasis de 6-gramas ("los criterios" -> "las reglas", nunca "los reglas")
    expect(paraphraseSixGramOverlap('Aplica los criterios de congruencia en triángulos.')).not.toContain('los reglas');

    // Títulos de pizarrón limpios sin adverbios, futuros ni fallbacks genéricos
    const tCong = resolveChalkboardTopicTitle({
      sessionObjective:
        'Vas a aplicar rigurosamente los criterios de congruencia de triángulos y los fundamentos geométricos del Teorema de Napoleón.',
      maxChars: 52,
    });
    expect(tCong).not.toMatch(/^Rigurosamente\b/i);
    expect(tCong.toLowerCase()).toContain('congruencia');

    const tRed = resolveChalkboardTopicTitle({
      sessionObjective:
        'Socializarás tus hallazgos analíticos y defenderás la solución obtenida mediante el método de reducción ante tus compañeros.',
      conceptosClave:
        'El método de reducción, también conocido como suma y resta, es una de las técnicas analíticas más potentes.',
      maxChars: 52,
    });
    expect(tRed).not.toBe('Concepto clave de la sesión');
    expect(tRed.toLowerCase()).toContain('reducción');

    const tClosure = resolveChalkboardTopicTitle({
      sessionObjective:
        'Integrarás, depurarás y validarás la versión final de tu evidencia formativa, consolidando el reporte técnico completo.',
      maxChars: 52,
    });
    expect(tClosure).not.toMatch(/depurar[aá]s/i);

    const tMeta = resolveChalkboardTopicTitle({
      sessionObjective:
        'Evaluarás de manera formativa, sintetizarás y realizarás una reflexión metacognitiva sobre el cálculo de muestras estadísticas y modelos.',
      maxChars: 52,
    });
    expect(tMeta).not.toMatch(/^Manera\s+formativa/i);
    expect(tMeta.toLowerCase()).toContain('muestras');
  });
});
