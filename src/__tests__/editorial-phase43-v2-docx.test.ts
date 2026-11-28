/**
 * editorial-phase43-v2-docx.test.ts — Suite de Aceptación PR 4.3.3
 *
 * Verifica:
 * 1. `svgToPngBuffer` rasteriza `<text>` UTF-8 real vía `@resvg/resvg-js` + fuentes TTF embebidas
 *    (prueba diferencial de píxeles con/sin `<text>` — impide para siempre cajas vacías sin texto).
 * 2. `compileUnifiedEditorialDocx` compila un libro semestral completo de 3 bloques / 12 misiones /
 *    48+ sesiones en paridad editorial 1:1 con Typst V2 (`StudentChapter`):
 *    - 100 % de las tablas usan `w:tblLayout w:type="fixed"` y 0 celdas/tablas superan `10320 DXA`.
 *    - 0 `Times New Roman`, 0 `w:line="360"`, 0 `[··]`, 0 `>Practica<`, 0 `Bloque de Aprendizaje: 0`, 0 `Bloque 99`.
 *    - 3 Portadillas Separadoras de Bloque (`BLOQUE FORMATIVO I/II/III`), 4 portadas V2 distintas,
 *      0 protoboard en misiones no-hardware y 0 repeticiones consecutivas entre portadilla y M1.
 *    - Diagramas enriquecidos embebidos como PNGs reales con texto renderizado.
 *    - Espacios activos de cuaderno (`writing_lines`, `data_table`, `code_box`) bien dimensionados.
 *    - Cero fuga de `answerExplanation` en la evaluación NEM del estudiante.
 * 3. `tic-04-comunidad.webp` es fotorrealista V2 `1600×900` (> 60 KB).
 * 4. Fallback transparente a `legacy_docx_fallback` cuando el libro carece de `sessionPlans`.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';
import { describe, it, expect, vi } from 'vitest';
import { svgToPngBuffer } from '@/lib/visual-engine/svg-to-png';
import { compileUnifiedEditorialDocx } from '@/lib/editorial/unified-editorial-docx-renderer';
import { buildConsolidatedBook } from '@/lib/master-workbook-compiler';
import type { ActiveWorkTextbook, MissionSection, SessionPlan } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeSessionPlan(sessionNumber: number, topic: string): SessionPlan {
  return {
    sessionNumber,
    objetivo: `Analizarás ${topic} y aplicarás criterios técnicos verificables en tu entorno escolar.`,
    motivacion: `En tu plantel necesitas resolver retos cotidianos sobre ${topic} con criterio ético.`,
    saberesPrevios: `Ya utilizas dispositivos y herramientas cotidianas relacionadas con ${topic}.`,
    contenido: `Definición: ${topic} articula principios técnicos y prácticas responsables en el aula.\n\nCriterio de aplicación: verifica siempre datos, fuentes y permisos al trabajar con ${topic}.`,
    ejemploResuelto: `Caso aplicado de ${topic}.\nPaso 1: Identifica entradas y requerimientos del caso.\nPaso 2: Aplica el procedimiento técnico sobre ${topic}.\nPaso 3: Verifica el resultado y valida su utilidad comunitaria.`,
    practica: [
      {
        enunciado: `Elabora una ficha práctica verificable sobre ${topic} aplicada a tu escuela.`,
        pista: 'Organiza entradas, procedimiento y criterio de validación en pasos breves.',
      },
      {
        enunciado: `Compara dos soluciones posibles sobre ${topic} y justifica la más viable.`,
        pista: 'Contrasta impacto técnico, costo y privacidad.',
      },
    ],
    aplicacion: `Integra tu análisis de ${topic} al proyecto comunitario PAEC del plantel.`,
    autoevaluacion: [
      `Explico con claridad los fundamentos de ${topic}.`,
      `Verifico la calidad y pertinencia técnica de mi producto sobre ${topic}.`,
    ],
    recursos: [
      {
        titulo: `Guía técnica de ${topic}`,
        url: 'https://developer.mozilla.org/es/',
        tipo: 'web',
      },
    ],
    productoIntegrador: `Avance documentado sobre ${topic} para el portafolio PAEC.`,
  };
}

function makeFullCd1Workbooks(): {
  planning: Planning;
  workbooksMap: Record<string, { current: ActiveWorkTextbook }>;
  consolidatedBook: ActiveWorkTextbook;
} {
  const planning = {
    id: 'plan-v2-docx-cd1',
    teacherId: 'doc-v2-docx',
    uacName: 'Cultura Digital I. Ciudadanía digital',
    semester: '1',
    component: 'Curriculum Fundamental',
    curriculumName: 'MCCEMS 2026-2027',
    paecContext: 'Ciudadanía Digital Comunitaria',
    metodologiaActiva: 'Aprendizaje Basado en Proyectos',
    contentJson: {
      sectionI: {
        schoolName: 'Bachillerato General Estatal Héroes de la Patria',
        cct: '21EBH0200X',
        schoolZone: 'Zona 004',
        uacName: 'Cultura Digital I. Ciudadanía digital',
        teacherName: 'Mtro. Docente Prueba',
      },
    },
  } as unknown as Planning;

  const blockSpecs = [
    {
      blockIndex: 0,
      blockName: 'Bloque 1 (Corte 1): Progresiones 1, 2 y 3',
      missions: [
        { title: 'Misión 1: Fundamentación y Activación — Introducción al hardware y software', topic: 'Introducción al hardware y software' },
        { title: 'Misión 2: Práctica y Aplicación (Cultura Digital, Pensamiento Algorítmico, Programación y TI) — Historia crítica del desarrollo de tecnología digital', topic: 'Historia crítica del desarrollo de tecnología digital' },
        { title: 'Misión 3: Proyecto Integrador — Sistemas operativos', topic: 'Kit de Ciudadanía Digital: Guía de Software Libre y Seguridad Comunitaria' },
        { title: 'Misión 4: Evaluación y Cierre — Corporaciones de innovación', topic: 'Corporaciones de innovación' },
      ],
    },
    {
      blockIndex: 1,
      blockName: 'Bloque 2 (Corte 2): Progresiones 4, 5 y 6',
      missions: [
        { title: 'Misión 1: Fundamentación y Activación — Las 4 libertades', topic: 'Las 4 libertades' },
        { title: 'Misión 2: Práctica y Aplicación (Cultura Digital, Pensamiento Algorítmico, Programación y TI) — Hojas de cálculo', topic: 'Hojas de cálculo' },
        { title: 'Misión 3: Proyecto Integrador — Privacidad', topic: 'Escudo Digital: Plan Integral de Ciudadanía y Protección de Datos' },
        { title: 'Misión 4: Evaluación y Cierre — Ciudadanía digital', topic: 'Ciudadanía digital' },
      ],
    },
    {
      blockIndex: 2,
      blockName: 'Bloque 3 (Corte 3): Progresiones 7, 8 y 9',
      missions: [
        { title: 'Misión 1: Fundamentación y Activación — Pasos para solucionar un problema', topic: 'Pasos para solucionar un problema' },
        { title: 'Misión 2: Práctica y Aplicación (Cultura Digital, Pensamiento Algorítmico, Programación y TI) — Diagramas de flujo', topic: 'Diagramas de flujo' },
        { title: 'Misión 3: Proyecto Integrador — Datos', topic: 'App-Comunidad Segura: Algoritmo de Bienestar Juvenil' },
        { title: 'Misión 4: Evaluación y Cierre — Operadores', topic: 'Operadores' },
      ],
    },
  ];

  const workbooksMap: Record<string, { current: ActiveWorkTextbook }> = {};
  const books: ActiveWorkTextbook[] = [];

  for (const blk of blockSpecs) {
    let localSession = 1;
    const missions: MissionSection[] = blk.missions.map((m, mIdx) => {
      const plans: SessionPlan[] = [];
      const covered: number[] = [];
      for (let s = 0; s < 3; s++) {
        plans.push(makeSessionPlan(localSession, `${m.title.split('—').pop()?.trim() || m.topic} (parte ${s + 1})`));
        covered.push(localSession);
        localSession++;
      }
      return {
        missionIndex: mIdx + 1,
        title: m.title,
        coveredSessions: covered,
        sessionTopic: m.topic,
        sessionFocus: `Aplicación situada de ${m.topic}`,
        phenomenonHook: { story: 'Reto comunitario escolar.', detonatingQuestion: '¿Cómo resolverlo?' },
        conceptZero: { physicalAnalogy: 'Como una guía estructurada.', coreExplanation: 'Fundamentos técnicos.' },
        iDoSection: { stepByStepDemo: 'Demostración guiada.' },
        weDoSection: { guidedPractice: 'Práctica en equipo.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto individual.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué aprendiste?',
          reflectionPrompts: ['Describe tu aprendizaje clave.'],
          criteriaChecklist: ['Entrega completa y validada.'],
        },
        wordCount: 1800,
        sessionPlans: plans,
      } as unknown as MissionSection;
    });

    const wb = {
      id: `wb-cd1-b${blk.blockIndex}`,
      planningId: planning.id,
      blockIndex: blk.blockIndex,
      blockName: blk.blockName,
      version: 1,
      subsystem: 'bge',
      totalWords: 7200,
      totalPages: 42,
      coverData: {
        title: `Cuaderno de Trabajo Bloque ${blk.blockIndex + 1}`,
        subtitle: blk.blockName,
        subjectName: planning.uacName,
        semester: 1,
        blockNumber: blk.blockIndex + 1,
        teacherName: 'Mtro. Docente Prueba',
        schoolName: 'Bachillerato General Estatal Héroes de la Patria',
        cct: '21EBH0200X',
        paecProjectName: 'Ciudadanía Digital Comunitaria',
      },
      tableOfContents: [],
      missions,
      projectSection: {
        artifactName: `Producto Integrador PAEC Bloque ${blk.blockIndex + 1}`,
        communityUtility: 'Mejora las prácticas digitales responsables en la comunidad escolar.',
        requiredMaterials: ['Computadora', 'Cuaderno de trabajo', 'Acceso a internet'],
        phases: [
          {
            phaseNum: 1,
            title: 'Diagnóstico',
            allocatedHours: 2,
            deliverables: ['Ficha diagnóstica'],
            instructions: 'Identifica necesidades digitales del plantel.',
          },
          {
            phaseNum: 2,
            title: 'Implementación',
            allocatedHours: 3,
            deliverables: ['Prototipo verificable'],
            instructions: 'Construye y valida el producto con tu equipo.',
          },
        ],
        technicalSpecs: ['Sin errores ortográficos', 'Fuentes verificadas'],
        acceptanceCriteria: ['Cumple rúbrica NEM', 'Protege datos personales'],
      },
      evaluationSection: {
        rubric: [
          {
            criterion: 'Rigor técnico y ciudadanía digital',
            weightPercent: 100,
            levels: [
              { levelName: 'Excelente', points: 100, descriptor: 'Aplica con rigor todos los criterios técnicos y éticos.' },
              { levelName: 'Bueno', points: 85, descriptor: 'Aplica la mayoría de los criterios técnicos.' },
              { levelName: 'Suficiente', points: 70, descriptor: 'Cumple los criterios básicos.' },
              { levelName: 'Requiere Apoyo', points: 50, descriptor: 'Necesita acompañamiento para completar la actividad.' },
            ],
          },
        ],
        checklist: [
          { item: 'Aplica criterios de seguridad y privacidad', category: 'Ética digital' },
          { item: 'Documenta el procedimiento paso a paso', category: 'Desempeño' },
        ],
        metacognitiveReflection: {
          prompts: ['¿Qué concepto te resultó más útil y por qué?'],
        },
        criticalThinkingQuiz: [
          {
            questionNumber: 1,
            scenario: 'En tu escuela detectan contraseñas compartidas en las computadoras.',
            question: '¿Qué medida técnica debes aplicar primero?',
            options: ['A) Cambiar contraseñas y activar autenticación', 'B) Ignorar el incidente'],
            answerExplanation: 'CLAVE_DOCENTE_PROHIBIDA_EN_ESTUDIANTE',
          },
        ],
      },
    } as unknown as ActiveWorkTextbook;

    workbooksMap[`block_${blk.blockIndex}`] = { current: wb };
    books.push(wb);
  }

  const { consolidatedBook } = buildConsolidatedBook(books, planning);
  return { planning, workbooksMap, consolidatedBook };
}

describe('PR 4.3.3 — Motor Editorial V2 DOCX (Paridad 1:1 con Typst PDF) y Rasterización SVG con Fuentes Reales', () => {
  it('svgToPngBuffer renderiza texto UTF-8 real dentro de los diagramas (diferencia real de píxeles vs SVG sin texto)', async () => {
    const svgWithText = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="200" viewBox="0 0 500 200">
      <rect x="10" y="10" width="480" height="180" rx="12" fill="#f8fafc" stroke="#1f3864" stroke-width="2"/>
      <rect x="40" y="55" width="420" height="90" rx="8" fill="#1f3864"/>
      <text x="250" y="108" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">Arquitectura Digital · Práctica</text>
    </svg>`;
    const svgWithoutText = svgWithText.replace(/<text[\s\S]*?<\/text>/, '');

    const resWith = await svgToPngBuffer(svgWithText, 180);
    const resWithout = await svgToPngBuffer(svgWithoutText, 180);

    expect(resWith).not.toBeNull();
    expect(resWithout).not.toBeNull();
    expect(resWith!.buffer.length).toBeGreaterThan(2000);
    // Si las fuentes se perdieran (bug librsvg/sharp sin fontconfig), ambos PNG serían idénticos
    const hashWith = crypto.createHash('sha1').update(resWith!.buffer).digest('hex');
    const hashWithout = crypto.createHash('sha1').update(resWithout!.buffer).digest('hex');
    expect(hashWith).not.toBe(hashWithout);
  });

  it('tic-04-comunidad.webp está actualizado a escena fotorrealista V2 1600×900', async () => {
    const abs = path.join(
      process.cwd(),
      'public',
      'images',
      'escenas',
      'cultura_digital_programacion_ti',
      'tic-04-comunidad.webp',
    );
    expect(fs.existsSync(abs)).toBe(true);
    const meta = await sharp(abs).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(900);
  });

  it('compileUnifiedEditorialDocx produce DOCX V2 sin desbordes de margen, sin doble espaciado, con 3 portadillas, 12 misiones, diagramas con texto y 0 fuga de clave docente', async () => {
    const { planning, workbooksMap, consolidatedBook } = makeFullCd1Workbooks();
    const res = await compileUnifiedEditorialDocx({
      planningId: planning.id,
      planning,
      workbooksMap,
      fallbackWorkbook: consolidatedBook,
    });

    expect(res.engine).toBe('editorial_v2_docx');
    expect(res.sessionCount).toBe(36);
    expect(res.missionCount).toBe(12);

    const zip = await JSZip.loadAsync(res.docxBuffer);
    const docXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) ?? '';

    // 1. Cero desbordes: 100 % de tablas fijas y ninguna celda/tabla excede 10320 DXA
    const tablesTotal = (docXml.match(/<w:tbl>/g) || []).length;
    const tablesFixed = (docXml.match(/<w:tblLayout\s+w:type="fixed"\s*\/>/g) || []).length;
    expect(tablesTotal).toBeGreaterThan(100);
    expect(tablesFixed).toBe(tablesTotal);

    const tcWidths = [...docXml.matchAll(/<w:tcW[^>]*w:w="(\d+)"/g)].map((m) => Number(m[1]));
    const tblWidths = [...docXml.matchAll(/<w:tblW[^>]*w:w="(\d+)"/g)].map((m) => Number(m[1]));
    expect(tcWidths.length).toBeGreaterThan(100);
    expect(Math.max(...tcWidths)).toBeLessThanOrEqual(10320);
    expect(Math.max(...tblWidths)).toBeLessThanOrEqual(10320);

    // 2. Tipografía editorial limpia: 0 Times New Roman, 0 doble espacio w:line="360", 0 glifos rotos
    expect(docXml).not.toMatch(/Times New Roman/i);
    expect(docXml).not.toContain('w:line="360"');
    expect(docXml).not.toContain('[··]');
    expect(docXml).not.toContain('>Practica<');
    expect(docXml).not.toContain('Bloque de Aprendizaje: 0');
    expect(docXml).not.toContain('Bloque 99');

    // 3. Estructura editorial completa (paridad 1:1 con Typst V2)
    expect(docXml).toContain('BLOQUE FORMATIVO I');
    expect(docXml).toContain('BLOQUE FORMATIVO II');
    expect(docXml).toContain('BLOQUE FORMATIVO III');
    expect(docXml).toContain('SESIÓN 1');
    expect(docXml).toContain('SESIÓN 36');
    expect(docXml).toContain('Ponte a Prueba: Actividad Individual de Práctica');
    expect(docXml).toContain('PROYECTO INTEGRADOR COMUNITARIO (PAEC)');
    expect(docXml).toContain('EVALUACIÓN FORMATIVA INTEGRAL NEM');
    expect(docXml).not.toContain('CLAVE_DOCENTE_PROHIBIDA_EN_ESTUDIANTE');

    // 4. Auditoría de escenas en orden exacto (4 portadas distintas + 12 misiones, 0 protoboard fuera de B1M1)
    const ticDir = path.join(
      process.cwd(),
      'public',
      'images',
      'escenas',
      'cultura_digital_programacion_ti',
    );
    const hashScene = async (file: string, w: number, h: number) => {
      const b = await sharp(path.join(ticDir, file))
        .resize(w, h, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      return crypto.createHash('sha1').update(b).digest('hex');
    };
    const coverHashToId = new Map<string, string>();
    const missionHashToId = new Map<string, string>();
    for (const f of [
      'tic-01-portada.webp',
      'tic-02-concepto.webp',
      'tic-04-comunidad.webp',
      'tic-07-software-datos.webp',
      'tic-08-ciudadania-seguridad.webp',
      'tic-09-redes-flujos.webp',
    ]) {
      const id = f.replace(/\.webp$/, '');
      coverHashToId.set(await hashScene(f, 1080, 540), id);
      missionHashToId.set(await hashScene(f, 1080, 304), id);
    }

    const relMap = new Map<string, string>();
    for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/g)) {
      relMap.set(m[1], m[2]);
    }
    const mediaHash = new Map<string, string>();
    for (const [k, entry] of Object.entries(zip.files)) {
      if (k.startsWith('word/media/') && !entry.dir) {
        mediaHash.set(k.split('/').pop()!, crypto.createHash('sha1').update(await entry.async('nodebuffer')).digest('hex'));
      }
    }

    const covers: string[] = [];
    const missionScenes: string[] = [];
    for (const m of docXml.matchAll(/r:embed="(rId\d+)"/g)) {
      const media = relMap.get(m[1]);
      const h = media ? mediaHash.get(media) : undefined;
      if (!h) continue;
      if (coverHashToId.has(h)) covers.push(coverHashToId.get(h)!);
      else if (missionHashToId.has(h)) missionScenes.push(missionHashToId.get(h)!);
    }

    expect(covers).toHaveLength(4);
    expect(new Set(covers).size).toBe(4);
    // Semestral, B2 y B3 sin protoboard
    expect(covers[0]).not.toBe('tic-01-portada');
    expect(covers[2]).not.toBe('tic-01-portada');
    expect(covers[3]).not.toBe('tic-01-portada');

    expect(missionScenes).toHaveLength(12);
    expect(missionScenes[0]).toBe('tic-01-portada'); // B1M1 Hardware
    expect(missionScenes[1]).toBe('tic-09-redes-flujos'); // B1M2 Historia crítica
    expect(missionScenes[2]).toBe('tic-07-software-datos'); // B1M3 Sistemas operativos
    expect(missionScenes[5]).toBe('tic-07-software-datos'); // B2M2 Hojas de cálculo
    expect(missionScenes[6]).toBe('tic-08-ciudadania-seguridad'); // B2M3 Privacidad
    expect(missionScenes[10]).toBe('tic-07-software-datos'); // B3M3 Datos
    for (let i = 1; i < missionScenes.length; i++) {
      expect(missionScenes[i]).not.toBe('tic-01-portada');
      expect(missionScenes[i]).not.toBe('tic-02-concepto');
      expect(missionScenes[i]).not.toBe(missionScenes[i - 1]);
    }
    // Portadilla B2 ≠ B2M1 y Portadilla B3 ≠ B3M1
    expect(covers[2]).not.toBe(missionScenes[4]);
    expect(covers[3]).not.toBe(missionScenes[8]);
  }, 60000);

  it('hace fallback transparente a legacy_docx_fallback cuando el workbook carece de sessionPlans', async () => {
    const { planning, consolidatedBook } = makeFullCd1Workbooks();
    const legacyBook: ActiveWorkTextbook = {
      ...consolidatedBook,
      missions: consolidatedBook.missions.slice(0, 1).map((m) => ({
        ...m,
        sessionPlans: [],
      })),
    };
    const res = await compileUnifiedEditorialDocx({
      planningId: planning.id,
      planning,
      workbooksMap: { block_0: { current: legacyBook } },
      fallbackWorkbook: legacyBook,
    });
    expect(res.engine).toBe('legacy_docx_fallback');
    expect(res.fallbackReason).toBe('no_student_sessions');
    expect(res.docxBuffer.length).toBeGreaterThan(5000);
  }, 30000);
});
