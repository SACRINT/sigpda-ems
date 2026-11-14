import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import {
  parseInlineMarkdownSegments,
  stripInlineMarkdownEmphasis,
} from '@/lib/utils/inline-markdown';
import {
  resolveFooterBranding,
  truncateLabelAtWordBoundary,
} from '@/lib/document-branding';
import {
  trimAtCleanBoundary,
  buildBlockSequenceFromWorkbook,
} from '@/lib/planning/workbook-sequence-sync';
import { generateExtraPdfDocument } from '@/lib/pdf-extra-renderer';
import { buildExtraDocx, parseTextRuns } from '@/lib/docx-helpers';
import {
  generatePlanningPDF,
  generateSecuenciaPDF,
} from '@/lib/planning-pdf-renderer';
import { generateDocx, generateSecuenciaDocx } from '@/lib/docx-generator';
import { dispatchVisual } from '@/lib/visual-engine/visual-dispatcher';
import { resolveDemoCalloutTitle } from '@/lib/visual-engine/callout-box';
import {
  drawMissionBanner,
  drawCalloutBox,
} from '@/lib/visual-engine/pdf-components-core';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import type { Planning, SecuenciaBloque } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

async function extractPdfText(buffer: Uint8Array | ArrayBuffer): Promise<string> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  try {
    const res = await parser.getText();
    return res.text;
  } finally {
    await parser.destroy();
  }
}

describe('Parte 1 — Regresiones Editoriales en Entregables 01_ a 07_', () => {
  describe('1. Inline Markdown y Protección de Multiplicación Matemática', () => {
    it('separa **bold**, *italic* y ***bolditalic*** respetando expresiones matemáticas', () => {
      const segments = parseInlineMarkdownSegments(
        '*Foco instruccional:* resuelve **2x + 3** y verifica `3 * x` o 2*x + 3*y, más ***cierre clave***.'
      );
      expect(segments.some((s) => s.italic && s.text.includes('Foco instruccional:'))).toBe(true);
      expect(segments.some((s) => s.bold && s.text === '2x + 3')).toBe(true);
      expect(segments.some((s) => s.bold && s.italic && s.text === 'cierre clave')).toBe(true);

      const stripped = stripInlineMarkdownEmphasis(
        '*Foco instruccional:* si f(x) = a * x^2 + b * x y 2*x + 3*y = 12, calcula **resultado**.'
      );
      expect(stripped).toBe(
        'Foco instruccional: si f(x) = a * x^2 + b * x y 2*x + 3*y = 12, calcula resultado.'
      );
    });

    it('parseTextRuns mantiene 3 runs para bold básico y soporta *itálica* en DOCX', () => {
      expect(parseTextRuns('Texto **negrita** y normal')).toHaveLength(3);
      const runs = parseTextRuns('*Foco instruccional:* calcula 3 * x + 2*y');
      expect(runs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. PDF/DOCX Extras: Tablas Markdown, Itálicas y Encabezados Limpios', () => {
    it('omite filas separadoras |---|---|---|, limpia ** e *itálicas* en tablas PDF y conserva multiplicaciones', async () => {
      const doc = generateExtraPdfDocument(
        {
          id: 'extra-rubric-1',
          title: 'Instrumento de Evaluación — Pensamiento Matemático III',
          type: 'evaluation',
          content_text: [
            '# Instrumento de Evaluación',
            '',
            '*Foco instruccional:* Verifica que 2*x + 3*y = 12 y 3 * x = 15 en cada ejercicio.',
            '',
            '| **Criterio** | *Nivel Alto* | **Nivel Básico** | Puntaje |',
            '|---|---|---|---|',
            '| **Planteamiento** | Usa *modelos lineales* correctos | Omite incógnitas | 40% |',
            '| **Verificación** | Comprueba **3 * x = 15** | Solo resultado parcial | 60% |',
          ].join('\n'),
        },
        {
          uacName: 'Pensamiento Matemático III: Modelación Algebraica y Geométrica Aplicada',
        }
      );

      const pdfText = await extractPdfText(doc.output('arraybuffer'));
      expect(pdfText).not.toContain('---');
      expect(pdfText).not.toContain('**');
      expect(pdfText).not.toContain('*Foco instruccional:*');
      expect(pdfText).not.toContain('*modelos lineales*');
      expect(pdfText).toContain('Foco instruccional:');
      expect(pdfText).toContain('modelos lineales');
      expect(pdfText).toContain('2*x + 3*y = 12');
      expect(pdfText).toContain('3 * x = 15');
    });

    it('buildExtraDocx convierte *itálicas* en XML limpio y respeta 2*x + 3*y', async () => {
      const docxBuf = await buildExtraDocx(
        {
          type: 'lesson_plan',
          title: 'Plan de Clase Sesión 1',
          content_text: '*Foco instruccional:* despeja 2*x + 3*y = 12 paso a paso.',
          keyIndex: 0,
        },
        {
          uacName: 'Pensamiento Matemático III',
        }
      );

      const zip = await JSZip.loadAsync(docxBuf);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('Foco instruccional:');
      expect(xml).not.toContain('*Foco instruccional:*');
      expect(xml).toContain('2*x + 3*y = 12');
      expect(xml).toMatch(/<w:i(?:\s|\/|>)/);
    });

    it('truncateLabelAtWordBoundary y resolveFooterBranding nunca cortan palabras a la mitad', () => {
      const longTitle = 'Bloque 1: Pensamiento Matemático III y Geometría Analítica Comunitaria';
      const truncated = truncateLabelAtWordBoundary(longTitle, 55);
      expect(truncated.length).toBeLessThanOrEqual(55);
      expect(truncated).not.toMatch(/[:·,;.\-–—]$/);
      expect(truncated).not.toMatch(/\bBloq$/);
      expect(truncated).toBe('Bloque 1: Pensamiento Matemático III y Geometría');

      const footer = resolveFooterBranding(
        'evaluation',
        'Bloque 1: Pensamiento Matemático III · Evaluación Bloque',
        { uacName: longTitle },
        1,
        3,
        0
      );
      expect(footer.leftText).not.toContain('Bloq ');
      expect(footer.leftText).toContain('Bloque 1:');
      expect(footer.leftText.split(' · ').pop()!.length).toBeLessThanOrEqual(55);
    });
  });

  describe('3. Planeación y Secuencia (PDF y DOCX): Tokens [[material:...]] y Logotipo Header', () => {
    it('elimina tokens [[material:...]] en actividades macro y sesiones micro en PDF y DOCX', async () => {
      const sequenceJson: Record<number, SecuenciaBloque> = {
        0: {
          blockIndex: 0,
          blockName: 'Bloque 1: Pensamiento Matemático III',
          hours: 2,
          sessions: [
            {
              sessionNum: 1,
              totalSessions: 2,
              phase: 'Apertura',
              title: 'Medición angular con [[material:transportador|transportador escolar graduado]]',
              teachingActivity: 'Modelar trazo usando [[material:regla-t|regla de madera de 30 cm]] en pizarrón.',
              learningActivity: 'Trazar ángulos en [[material:cuaderno-cuadricula|cuaderno profesional cuadriculado]].',
              evidence: 'Lámina resuelta con [[material:lapiz-hb|lápiz de grafito HB]].',
              evaluation: 'Lista de cotejo',
            },
            {
              sessionNum: 2,
              totalSessions: 2,
              phase: 'Cierre',
              title: 'Cierre geométrico',
              teachingActivity: 'Retroalimentación grupal.',
              learningActivity: 'Resolución autónoma.',
              evidence: 'Portafolio firmado',
              evaluation: 'Rúbrica',
            },
          ],
        },
      };

      const planning = {
        id: 'plan-part1-tokens',
        uacName: 'Pensamiento Matemático III',
        semester: 3,
        component: 'fundamental',
        contentJson: {
          sectionI: {
            uacName: 'Pensamiento Matemático III',
            semester: 3,
            totalHours: 12,
            weeklyHours: 4,
            component: 'Currículum Fundamental',
            teacherName: 'Docente Demo',
            schoolName: 'Bachillerato Oficial',
            cct: '21EBH0200X',
          },
          sectionII: {
            purpose: 'Desarrollar pensamiento geométrico.',
            learningOutcomes: ['Trazo angular'],
            paecConnection: 'Proyecto comunitario',
            activities: [{ name: 'Ángulos en el entorno', corte: 'Corte 1', hours: 12 }],
          },
          sectionIII: {
            fundamentalCurriculum: [],
            expandedCurriculum: [],
          },
          sectionIV: {
            note: 'Secuencia activa',
            activities: [
              {
                name: 'Ángulos en el entorno',
                hours: 12,
                methodology: 'ABProblemas',
                apertura: {
                  activities: 'Exploración con [[material:juego-geometrico|Juego geométrico completo]].',
                  processes: 'Observación',
                  materials: '[[material:juego-geometrico|Juego geométrico completo]]',
                },
                ejecucion: {
                  activities: 'Trazos con [[material:compas-precision|compás de precisión metálico]].',
                  processes: 'Medición',
                  materials: '[[material:compas-precision|compás de precisión metálico]]',
                },
                conclusion: {
                  activities: 'Registro en [[material:bitacora|bitácora de geometría]].',
                  processes: 'Síntesis',
                  materials: '[[material:bitacora|bitácora de geometría]]',
                },
              },
            ],
          },
          sectionV: { evaluations: [] },
          sectionVI: {
            materials: ['Juego geométrico'],
            digitalResources: [],
            studentMaterials: [],
            teacherMaterials: [],
            digital: [],
            spaces: ['Aula'],
            references: [],
          },
        },
        sequenceJson,
      } as unknown as Planning;

      const tinyPngBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const docPlan = await generatePlanningPDF(planning, {
        gobierno: '',
        sep: tinyPngBase64,
        supervision: '',
      });
      const planText = (await extractPdfText(docPlan.output('arraybuffer'))).replace(/\s+/g, ' ');
      expect(planText).not.toContain('[[material:');
      expect(planText).toContain('Juego geométrico completo');
      expect(planText).toContain('compás de precisión metálico');
      expect(planText).toContain('bitácora de geometría');
      expect(planText).toContain('transportador escolar graduado');

      const docSec = await generateSecuenciaPDF(planning, {
        gobierno: '',
        sep: tinyPngBase64,
        supervision: '',
      });
      const secText = (await extractPdfText(docSec.output('arraybuffer'))).replace(/\s+/g, ' ');
      expect(secText).not.toContain('[[material:');
      expect(secText).toContain('transportador escolar graduado');
      expect(secText).toContain('regla de madera de 30 cm');

      const docxBuf = await generateDocx(planning.contentJson!, sequenceJson);
      const zip = await JSZip.loadAsync(docxBuf);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).not.toContain('[[material:');
      expect(xml).toContain('Juego geométrico completo');
      expect(xml).toContain('compás de precisión metálico');
      expect(xml).toContain('bitácora de geometría');
      expect(xml).toContain('transportador escolar graduado');
      expect(xml).toContain('regla de madera de 30 cm');

      const secDocxBuf = await generateSecuenciaDocx(planning.contentJson!, sequenceJson);
      const secZip = await JSZip.loadAsync(secDocxBuf);
      const secXml = await secZip.file('word/document.xml')!.async('string');
      expect(secXml).not.toContain('[[material:');
      expect(secXml).toContain('transportador escolar graduado');
    });
  });

  describe('4. Cortes Limpios en Sincronización Libro ↔ Secuencia', () => {
    it('trimAtCleanBoundary evita comas huérfanas, preposiciones y gerundios colgantes', () => {
      const sample1 =
        'Analizar relaciones geométricas entre ángulos y triángulos del entorno, utilizando instrumentos de medición escolar en campo.';
      const cut1 = trimAtCleanBoundary(sample1, 80);
      expect(cut1.length).toBeLessThanOrEqual(80);
      expect(cut1).not.toMatch(/[,;:\-–—]$/);
      expect(cut1.toLowerCase()).not.toMatch(/\b(utilizando|de|en|con|el|la|y)\.?\s*$/);

      const sample2 =
        'Fomentar la convivencia respetuosa y prevenir conductas de riesgo escolar mediante acuerdos colectivos de aula.';
      const cut2 = trimAtCleanBoundary(sample2, 62);
      expect(cut2.toLowerCase()).not.toMatch(/\bconductas de\.?$/);

      const wb = {
        blockIndex: 0,
        blockName: 'Bloque 1',
        missions: [
          {
            missionIndex: 1,
            title: 'Misión 1: Medición de ángulos',
            coveredSessions: [1],
            sessionTopic: 'Ángulos',
            sessionFocus: 'Medición',
            phenomenonHook: { story: 'Caso.', detonatingQuestion: '¿Cómo?' },
            conceptZero: { physicalAnalogy: 'Puerta.', coreExplanation: 'Abertura.' },
            iDoSection: { stepByStepDemo: 'Demo.' },
            weDoSection: { guidedPractice: 'Práctica.', workbookElements: [] },
            youDoSection: { autonomousChallenge: 'Reto.', workbookElements: [] },
            troubleshooting: [],
            formativeCheckpoint: { question: '¿Listo?', reflectionPrompts: [], criteriaChecklist: [] },
            wordCount: 300,
            sessionPlans: [
              {
                sessionNumber: 1,
                objetivo:
                  'Reconocer ángulos agudos, rectos y obtusos presentes en estructuras del entorno, utilizando un transportador graduado de manera precisa.',
                motivacion: 'Puente peatonal.',
                saberesPrevios: 'Rectas.',
                contenido: 'Clasificación angular.',
                ejemploResuelto: '45 grados.',
                practica: [{ enunciado: 'Mide 3 ángulos.', pista: 'Centra el vértice.', solucion: ['45°'] }],
                aplicacion: 'Rampa escolar.',
                autoevaluacion: ['¿Mediste con precisión?'],
                recursos: ['Transportador'],
                productoIntegrador: 'Tabla de mediciones',
              },
            ],
          },
        ],
      } as unknown as ActiveWorkTextbook;

      const seq = buildBlockSequenceFromWorkbook(wb, 0);
      expect(seq).not.toBeNull();
      const s1Title = seq!.sessions[0].title;
      expect(s1Title).not.toMatch(/,\s*$/);
      expect(s1Title.toLowerCase()).not.toMatch(/\b(utilizando|de|con)\.?$/);
    });
  });

  describe('5. Enrutamiento Visual y Títulos de Callouts por Disciplina', () => {
    it('no confunde "vértice del ángulo" ni transportador con gráfica cuadrática, pero conserva parábola explícita', () => {
      const geoVisual = dispatchVisual(
        'Pensamiento Matemático III',
        'Medición de ángulos con transportador y vértice del ángulo',
        'Identificación del vértice del ángulo y bisectriz con juego geométrico.',
        1
      );
      expect(geoVisual).not.toBeNull();
      const geoBundle = [
        geoVisual!.svg,
        ...geoVisual!.annotations.map((a) => a.text),
      ].join(' ');
      expect(geoBundle).toMatch(/Geometr[íi]a|Tri[áa]ngulo/i);
      expect(geoBundle).not.toMatch(/Par[áa]bola|Cuadr[áa]tica/i);

      const quadVisual = dispatchVisual(
        'Pensamiento Matemático III',
        'Optimización y vértice de la parábola y = x^2 - 4x + 3',
        'Función cuadrática f(x) = x^2 - 4x + 3 y discriminante.',
        1
      );
      expect(quadVisual).not.toBeNull();
      const quadBundle = [
        quadVisual!.svg,
        ...quadVisual!.annotations.map((a) => a.text),
      ].join(' ');
      expect(quadBundle).toMatch(/Cuadr[áa]tica|Par[áa]bola|x²/i);
    });

    it('resolveDemoCalloutTitle asigna títulos disciplinares correctos (y Matemáticas gana antes que "taller")', () => {
      expect(resolveDemoCalloutTitle('Pensamiento Matemático III')).toBe(
        'Estrategia Metodológica y Verificación'
      );
      expect(resolveDemoCalloutTitle('Taller de Pensamiento Variacional I')).toBe(
        'Estrategia Metodológica y Verificación'
      );
      expect(resolveDemoCalloutTitle('Dibujo Técnico I')).toBe(
        'Tip de Trazo Técnico y Precisión'
      );
      expect(resolveDemoCalloutTitle('Taller de Soldadura Industrial')).toBe(
        'Tip de Taller y Seguridad Operativa'
      );
      expect(resolveDemoCalloutTitle('Física I')).toBe(
        'Tip Metodológico y Precisión Científica'
      );
      expect(resolveDemoCalloutTitle('Humanidades I')).toBe(
        'Pauta Metodológica de Resolución'
      );
    });
  });

  describe('6. Banners, Badges sin Doble Corchete y Recursos Concretos en Material Extractor', () => {
    it('drawMissionBanner evita "MISIÓN 1: MISIÓN 1:" y drawCalloutBox evita "[ [IDEA] ... ]"', () => {
      const doc = new jsPDF();
      const recordedTexts: string[] = [];
      const origText = doc.text.bind(doc);
      vi.spyOn(doc, 'text').mockImplementation((...args: Parameters<typeof doc.text>) => {
        const first = args[0];
        if (typeof first === 'string') {
          recordedTexts.push(first);
        } else if (Array.isArray(first)) {
          recordedTexts.push(first.join(' '));
        }
        return origText(...args);
      });

      drawMissionBanner(doc, {
        missionNumber: 1,
        title: 'Misión 1: El enigma del vértice',
        sessionFocus: 'Análisis geométrico',
        uacLabel: 'PM3',
        sessionsStr: 'Sesiones 1-4',
        momentColor: [30, 58, 95],
        margin: 15,
        mainW: 130,
        contentWidth: 180,
        y: 20,
      });

      drawCalloutBox(
        doc,
        {
          title: 'Estrategia Metodológica y Verificación',
          body: 'Verifica el vértice paso a paso.',
          content: 'Verifica el vértice paso a paso.',
          accent: '#1E3A5F',
          accentRgb: [30, 58, 95],
          bgHex: '#EFF6FF',
          bgRgb: [239, 246, 255],
          type: 'demo',
          badge: 'IDEA',
          icon: '💡',
        },
        15,
        180,
        80
      );

      const joined = recordedTexts.join(' || ');
      expect(joined).toContain('MISIÓN 1: EL ENIGMA DEL VÉRTICE');
      expect(joined).not.toContain('MISIÓN 1: MISIÓN 1:');
      expect(joined).toContain('[ IDEA ·');
      expect(joined).not.toContain('[ [IDEA]');
    });

    it('material-extractor limpia prefijo "Misión N:" en 02_/03_ y llena recursos concretos en 05_ fichasTrabajo', () => {
      const wb = {
        blockIndex: 0,
        blockName: 'Bloque 1: Geometría Plana',
        coverData: {
          title: 'Cuaderno de Trabajo Activo',
          subjectName: 'Pensamiento Matemático III',
          schoolName: 'Preparatoria Oficial',
          blockNumber: 1,
        },
        projectSection: {
          artifactName: 'Prototipo de rampa accesible',
          communityUtility: 'Medir pendientes escolares',
          requiredMaterials: ['Transportador escolar graduado'],
          executionSteps: [],
          learningObjectives: [],
          phases: [],
          technicalSpecs: [],
          acceptanceCriteria: [],
        },
        missions: [
          {
            missionIndex: 1,
            title: 'Misión 1: El enigma de los ángulos',
            coveredSessions: [1],
            sessionTopic: 'Ángulos en el plano',
            sessionFocus: 'Medición con transportador',
            phenomenonHook: { story: 'Rampa escolar.', detonatingQuestion: '¿Qué ángulo tiene?' },
            conceptZero: { physicalAnalogy: 'Abanico.', coreExplanation: 'Abertura entre rayos.' },
            iDoSection: { stepByStepDemo: 'Colocar el centro del transportador.' },
            weDoSection: { guidedPractice: 'Medir ángulos agudos.', workbookElements: [] },
            youDoSection: { autonomousChallenge: 'Trazar 3 ángulos.', workbookElements: [] },
            troubleshooting: [],
            formativeCheckpoint: { question: '¿Cómo alineas el 0°?', reflectionPrompts: [], criteriaChecklist: [] },
            wordCount: 400,
            sessionPlans: [
              {
                sessionNumber: 1,
                objetivo: 'Medir ángulos con transportador.',
                motivacion: 'Rampas escolares.',
                saberesPrevios: 'Segmentos.',
                contenido: 'Uso del transportador.',
                ejemploResuelto: '30 grados.',
                practica: [{ enunciado: 'Mide el ángulo A.', pista: 'Alinea el centro.', solucion: ['30°'] }],
                aplicacion: 'Señalética escolar.',
                autoevaluacion: ['¿Mediste con exactitud?'],
                recursos: [],
                productoIntegrador: 'Registro de ángulos',
              },
            ],
          },
        ],
      } as unknown as ActiveWorkTextbook;

      const extracted = extractMaterialsFromWorkbook(wb);
      expect(extracted.guiaDelBloque).not.toContain('MISIÓN 1: MISIÓN 1:');
      expect(extracted.solucionarioDocente).not.toContain('MISIÓN 1: MISIÓN 1:');
      expect(extracted.fichasTrabajo).not.toContain(
        'Materiales del inventario del bloque (ver material didáctico)'
      );
      expect(extracted.fichasTrabajo).toContain('Transportador');
      expect(extracted.materialDidactico).toContain('Transportador');
    });
  });
});
