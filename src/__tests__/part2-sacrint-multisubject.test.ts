import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { MATH_DEMO_WORKBOOK } from '@/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import {
  buildSacrintDeck,
  buildSacrintInfographic,
} from '@/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '@/lib/visual-engine/sacrint/slide-renderer';
import { generateSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import type { ActiveWorkTextbook, SessionPlan } from '@/types/work-textbook';

const FORBIDDEN_MATH_FALLBACK_RE =
  /modelo o regla matem[aá]tica|signos y jerarqu[ií]a de operaciones|resultado num[eé]rico|medici[oó]n,\s*presupuesto\s*o\s*dise[ñn]o|datos e inc[oó]gnitas|antes de calcular|antes de operar/i;

function buildNonMathIncompleteWorkbook(subjectName: string): ActiveWorkTextbook {
  const wb = structuredClone(MATH_DEMO_WORKBOOK);
  wb.coverData.subjectName = subjectName;
  wb.coverData.title = `Cuaderno de Trabajo — ${subjectName}`;
  wb.blockName = 'Bloque 1: Procesos Históricos y Expresión Documental';

  const mission = wb.missions![0]!;
  mission.title = 'Misión 1: Memoria, Fuentes y Argumentación Colectiva';
  mission.sessionTopic = 'Análisis de crónicas y fuentes primarias';
  mission.sessionFocus = 'Contrastar testimonios históricos de la comunidad.';
  mission.phenomenonHook = {
    story: 'HISTORIA_MISION_GLOBAL_UNICA: Archivo municipal resguarda cartas del siglo XIX.',
    detonatingQuestion: '¿PREGUNTA_DETONADORA_MISION_GLOBAL_QUE_NO_DEBE_REPETIRSE?',
  };
  mission.conceptZero = {
    physicalAnalogy: 'ANALOGIA_MISION_GLOBAL_UNICA: Un archivo funciona como la memoria viva del pueblo.',
    coreExplanation: 'EXPLICACION_MISION_GLOBAL_UNICA: Las fuentes primarias permiten reconstruir procesos sociales.',
    contrastTable: [
      {
        commonMisconception: 'ERROR_COMUN_MISION_GLOBAL_UNICO',
        correctConcept: 'CORRECCION_MISION_GLOBAL_UNICA',
        reasoning: 'RAZONAMIENTO_MISION_GLOBAL_UNICO',
      },
    ],
    solvedExample: {
      problemStatement: 'EJEMPLO_MISION_GLOBAL_UNICO: Análisis de un manifiesto agrario.',
      solutionSteps: [
        'PASO_MISION_1_UNICO: Identificar autor y fecha del documento.',
        'PASO_MISION_2_UNICO: Contrastar demandas sociales con el contexto regional.',
      ],
      interpretation: 'INTERPRETACION_MISION_GLOBAL_UNICA: El texto refleja tensiones agrarias locales.',
    },
  };
  mission.iDoSection = {
    stepByStepDemo: 'DEMO_MISION_GLOBAL_UNICA: Lectura comentada de una crónica periodística.',
    visualOrDiagram: '',
  };
  mission.weDoSection = {
    guidedPractice: 'PRACTICA_GUIADA_MISION_GLOBAL_UNICA: Subraya actores sociales en equipos.',
    workbookElements: [],
  };
  mission.youDoSection = {
    autonomousChallenge: 'RETO_AUTONOMO_MISION_GLOBAL_UNICO: Redacta una reseña crítica del archivo local.',
    workbookElements: [],
  };
  mission.realLifeConnection = {
    context: 'CONTEXTO_MISION_GLOBAL_UNICO',
    householdApplication: 'APLICACION_HOGAR_MISION_GLOBAL_UNICA',
    communityImpact: 'IMPACTO_COMUNIDAD_MISION_GLOBAL_UNICO',
  };
  mission.formativeCheckpoint = {
    question: 'CHECKPOINT_MISION_GLOBAL_UNICO',
    criteriaChecklist: ['CRITERIO_MISION_GLOBAL_UNICO'],
    reflectionPrompts: ['REFLEXION_MISION_GLOBAL_UNICA'],
  };
  mission.troubleshooting = [];

  const sessions: SessionPlan[] = [
    {
      sessionNumber: 1,
      objetivo: 'Analizar causas sociales de la Revolución Mexicana mediante fuentes primarias',
      motivacion: 'En el archivo parroquial aparecieron cartas de 1910. ¿Qué motivó a los campesinos a organizarse?',
      saberesPrevios: 'Distinguir entre hechos históricos y opiniones editoriales.',
      contenido:
        'Las fuentes primarias son testimonios directos de una época histórica.\n\nPermiten contrastar versiones oficiales con la experiencia cotidiana de las comunidades.',
      ejemploResuelto:
        'Planteamiento: Analizar el Plan de San Luis en su artículo 3.\n1. Identificar la demanda de restitución de tierras.\n2. Relacionar la demanda con el despojo sufrido por comunidades rurales.',
      practica: [
        {
          enunciado: 'Lee el fragmento del periódico Regeneración y señala dos demandas laborales.',
          pista: 'Observa los párrafos donde se menciona la jornada de trabajo.',
          solucion: ['RESPUESTA_SECRETA_HISTORIA_S1'],
        },
      ],
      aplicacion: 'Explicar el origen histórico de los ejidos y tierras comunales del municipio.',
      autoevaluacion: ['Distingo el contexto político y social de una fuente primaria de 1910.'],
      recursos: [],
      productoIntegrador: 'Ficha comentada de una fuente primaria local.',
    },
    {
      // Sesión 2 deliberadamente incompleta (sin ejemploResuelto, sin practica, sin aplicacion ni autoevaluacion)
      sessionNumber: 2,
      objetivo: 'Redactar un ensayo argumentativo sobre patrimonio cultural comunitario',
      motivacion: '',
      saberesPrevios: '',
      contenido: '',
      ejemploResuelto: '',
      practica: [],
      aplicacion: '',
      autoevaluacion: [],
      recursos: [],
      productoIntegrador: '',
    },
  ];

  mission.sessionPlans = sessions;
  return wb;
}

describe('SACRINT Part 2 — Multi-Subject Neutrality & Session Isolation', () => {
  it.each(['Historia de México II', 'Lengua y Comunicación III', 'La Materia y sus Interacciones'])(
    'never injects math fallback phrases into %s decks or infographics when sessions are incomplete',
    async (subjectName) => {
      const wb = buildNonMathIncompleteWorkbook(subjectName);
      const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });
      const info = buildSacrintInfographic(wb, 'letter');

      const deckText = JSON.stringify(deck);
      const infoText = JSON.stringify(info);

      expect(deckText).not.toMatch(FORBIDDEN_MATH_FALLBACK_RE);
      expect(infoText).not.toMatch(FORBIDDEN_MATH_FALLBACK_RE);
      expect(deckText).not.toContain('RESPUESTA_SECRETA_HISTORIA_S1');

      const svgs = renderDeckSvgs(deck);
      for (const item of svgs) {
        expect(item.svg).not.toMatch(FORBIDDEN_MATH_FALLBACK_RE);
        expect(item.svg).not.toContain('undefined');
        expect(item.svg).not.toContain('${');
      }

      const pptxBuf = await generateSacrintPptx(deck);
      const zip = await JSZip.loadAsync(pptxBuf);
      const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
      expect(slideFiles).toHaveLength(5);
      for (const f of slideFiles) {
        const xml = await zip.files[f]!.async('text');
        expect(xml).not.toMatch(FORBIDDEN_MATH_FALLBACK_RE);
        expect(xml).not.toContain('undefined');
      }
    }
  );

  it('isolates lesson-guide slides per session without leaking mission-level or Session 1 content into incomplete Session 2', () => {
    const wb = buildNonMathIncompleteWorkbook('Historia de México II');
    const deck = buildSacrintDeck(wb, { mode: 'lesson-guide' });

    // 1 cover + 2 sessions * 2 slides = 5 slides
    expect(deck.slides).toHaveLength(5);

    const session1Slides = deck.slides.slice(1, 3);
    const session2Slides = deck.slides.slice(3, 5);

    const s1Serialized = JSON.stringify(session1Slides);
    const s2Serialized = JSON.stringify(session2Slides);

    // Session 1 has its own specific content
    expect(s1Serialized).toContain('Plan de San Luis');
    expect(s1Serialized).toContain('periódico Regeneración');
    expect(s1Serialized).toContain('ejidos y tierras comunales');

    // Session 2 is incomplete: it must NOT copy Session 1's example/practice/application or Mission global fields
    expect(s2Serialized).not.toContain('Plan de San Luis');
    expect(s2Serialized).not.toContain('periódico Regeneración');
    expect(s2Serialized).not.toContain('ejidos y tierras comunales');
    expect(s2Serialized).not.toContain('PREGUNTA_DETONADORA_MISION_GLOBAL_QUE_NO_DEBE_REPETIRSE');
    expect(s2Serialized).not.toContain('EJEMPLO_MISION_GLOBAL_UNICO');
    expect(s2Serialized).not.toContain('PASO_MISION_1_UNICO');
    expect(s2Serialized).not.toContain('DEMO_MISION_GLOBAL_UNICA');
    expect(s2Serialized).not.toContain('PRACTICA_GUIADA_MISION_GLOBAL_UNICA');
    expect(s2Serialized).not.toContain('RETO_AUTONOMO_MISION_GLOBAL_UNICO');
    expect(s2Serialized).not.toContain('APLICACION_HOGAR_MISION_GLOBAL_UNICA');
    expect(s2Serialized).not.toContain('ERROR_COMUN_MISION_GLOBAL_UNICO');

    // Instead, Session 2 explicitly marks missing sections as "Por completar en el libro"
    expect(s2Serialized).toContain('Por completar en el libro');
  });
});
