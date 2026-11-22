import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  distillExerciseStatement,
  isCompleteProblemStatement,
  sixGramOverlapRatio,
} from '@/lib/visual-engine/sacrint/content-distiller';
import {
  buildSacrintDeck,
  buildSacrintInfographic,
  conceptFamily,
  countSlideWords,
  isFormulaCoherentWithTitle,
} from '@/lib/visual-engine/sacrint/spec';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';

async function extractPptxSlideWordCounts(buffer: Uint8Array | Buffer): Promise<number[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file))
    .sort((a, b) => {
      const aNumber = Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0);
      const bNumber = Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);
      return aNumber - bNumber;
    });
  const counts: number[] = [];
  for (const file of slideFiles) {
    const xml = await zip.files[file]!.async('text');
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => match[1] ?? '')
      .join(' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    counts.push(text.trim() ? text.trim().split(/\s+/).length : 0);
  }
  return counts;
}

function angleWorkbook(theory: string, longText = theory): ActiveWorkTextbook {
  const session = {
    sessionNumber: 1,
    objetivo: 'Clasificar tipos de ángulos y aplicar sus relaciones en el diseño de espacios.',
    motivacion: longText,
    saberesPrevios: longText,
    contenido: theory,
    ejemploResuelto:
      'Planteamiento: Un soporte estructural forma ángulos de 30°, 90° y 120°. Paso 1: c² = a² + b². Paso 2: 30° + 60° = 90°. Conclusión: el ángulo recto mide 90° y el llano 180°.',
    practica: [
      {
        enunciado:
          'Clasifica los ángulos de 30°, 90° y 120° y calcula la suma de los ángulos complementarios.',
        pista: 'Compara cada abertura con 90° y con 180°.',
      },
      {
        enunciado:
          'Determina si dos ángulos de 120° y 60° son suplementarios y explica tu respuesta.',
        pista: 'Verifica si la suma es 180°.',
      },
    ],
    aplicacion: 'Señala en el plano de la escuela los ángulos rectos y agudos.',
    autoevaluacion: ['Clasifico ángulos por su abertura.'],
    recursos: [],
    productoIntegrador: 'Croquis con ángulos señalados.',
  } as unknown as SessionPlan;
  const mission = {
    missionIndex: 1,
    title: 'Ángulos en el diseño',
    coveredSessions: [1],
    sessionTopic: 'Tipos de ángulos',
    sessionFocus: 'Clasificación angular',
    phenomenonHook: { story: '', detonatingQuestion: '' },
    conceptZero: { physicalAnalogy: '', coreExplanation: theory },
    iDoSection: { stepByStepDemo: '' },
    weDoSection: { guidedPractice: '', workbookElements: [] },
    youDoSection: { autonomousChallenge: longText, workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: { question: '', criteriaChecklist: [], reflectionPrompts: [] },
    wordCount: 500,
    sessionPlans: [session],
  } as unknown as MissionSection;
  return {
    subsystem: 'fundamental',
    coverData: {
      title: 'Cuaderno PM3',
      subjectName: 'Pensamiento Matemático III',
      schoolName: 'Bachillerato General',
      blockNumber: 3,
    },
    missions: [mission],
    projectSection: {
      artifactName: 'Croquis con ángulos',
      communityUtility: 'Mejorar la señalización escolar.',
    },
  } as unknown as ActiveWorkTextbook;
}

describe('PM3 presupuesto, coherencia y solapamiento', () => {
  it('valida el enunciado con datos, consigna y unidad', () => {
    expect(isCompleteProblemStatement('La superficie exacta de 210.')).toBe(false);
    expect(
      isCompleteProblemStatement(
        'El área de un jardín rectangular es de 210 m²; calcula sus dimensiones exactas.'
      )
    ).toBe(true);
  });

  it('conserva completa la consigna S3 sin terminar en letra suelta', () => {
    const s3 =
      'Si el desembolso total es de $1,000, formula la igualdad lineal correspondiente y señala claramente cuál es el factor y cuál es el componente independiente.';
    const result = distillExerciseStatement(s3, 190, 30);
    expect(result).toContain('independiente');
    expect(result).not.toMatch(/señala\s+c\.?$/i);
    expect(result).not.toMatch(/\b[a-z]$/i);
  });

  it('distingue familias de ángulos y Pitágoras y descarta fórmulas incoherentes', () => {
    expect(conceptFamily('Tipos de ángulos aplicados en el diseño estructural')).toBe('angles');
    expect(conceptFamily('Teorema de Pitágoras')).toBe('pythagoras');
    expect(
      isFormulaCoherentWithTitle(
        'Tipos de ángulos aplicados en el diseño estructural',
        'c² = a² + b² | ángulo A + ángulo B = 90°'
      )
    ).toBe(true);
    expect(
      isFormulaCoherentWithTitle('Tipos de ángulos aplicados en el diseño estructural', 'c² = a² + b²')
    ).toBe(false);
    expect(isFormulaCoherentWithTitle('Teorema de Pitágoras', 'c² = a² + b²')).toBe(true);
  });

  it('genera 09 sin R/A/B, sin fórmula de Pitágoras y sin copia del libro', () => {
    const theory =
      'Los tipos de ángulos se clasifican por su abertura: agudo menor de 90°, recto igual a 90°, obtuso mayor de 90° y llano igual a 180°.';
    const workbook = angleWorkbook(theory);
    const spec = buildSacrintInfographic(workbook, 'wide', { missionIndex: 0, sessionIndex: 0 });

    expect(conceptFamily(spec.title)).toBe('angles');
    expect(spec.formula).not.toMatch(/c\s*[²^]?2\s*=\s*a/i);
    expect(spec.variables.some((variable) => /^[RAB]$/i.test(variable.symbol))).toBe(false);
    expect(spec.diagram.available).toBe(true);

    const visibleTexts = [
      spec.claim,
      ...(spec.keyConcepts ?? []),
      ...(spec.conceptManual?.definitions ?? []).flatMap((item) => [item.term, item.definition]),
      ...(spec.conceptManual?.conceptMap ?? []).map((item) => item.detail),
      ...spec.criteria,
    ].filter(Boolean);
    for (const text of visibleTexts) {
      expect(sixGramOverlapRatio(text, [theory])).toBeLessThanOrEqual(0.15);
    }
  });

  it('mantiene el presupuesto de palabras en las láminas 1/2 y 2/2', async () => {
    const theory =
      'La clasificación de ángulos permite interpretar el diseño estructural de espacios escolares y comunitarios con precisión, porque cada abertura angular condiciona la estabilidad de las estructuras y la seguridad de las personas que las utilizan.';
    const workbook = angleWorkbook(theory, theory);
    const deck = buildSacrintDeck(workbook, { mode: 'lesson-guide', missionIndex: 0 });

    for (const slide of deck.slides) {
      if (slide.kind === 'concept' || slide.kind === 'practice') {
        expect(countSlideWords(slide)).toBeLessThanOrEqual(200);
      }
    }

    const buffer = await generateSacrintPptx(deck);
    const counts = await extractPptxSlideWordCounts(buffer);
    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(200);
  });
});
