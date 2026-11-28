import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import sharp from 'sharp';
import {
  sanitizePdfText,
  separatePasoInline,
  resolveWorkbookMethodology,
  ensureVerticalSpace,
  printParagraph,
  sanitizeEducationalResourceUrl,
  type RealTocEntry,
} from '@/lib/workbook-shared-helpers';
import {
  sanitizePdfText as reexportedSanitizePdfText,
  separatePasoInline as reexportedSeparatePasoInline,
  resolveWorkbookMethodology as reexportedResolveWorkbookMethodology,
  ensureVerticalSpace as reexportedEnsureVerticalSpace,
  printParagraph as reexportedPrintParagraph,
  sanitizeEducationalResourceUrl as reexportedSanitizeEducationalResourceUrl,
} from '@/lib/pdf-workbook-renderer';
import {
  renderWorkbookToDocx,
  resolveDocxDisciplinaryTheme,
} from '@/lib/docx-workbook-renderer';
import { EDITORIAL_SCENES_CATALOG } from '@/lib/visual-engine/editorial-scenes-catalog';
import { allocateEditorialScene, createBlockSceneTracker } from '@/lib/visual-engine/scene-allocator';
import { createNodeSceneFileExists } from '@/lib/visual-engine/scene-allocator-node';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { Planning } from '@/types/planning';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function makeDocxFixtures(subjectName: string, missionTopic: string): {
  workbook: ActiveWorkTextbook;
  planning: Planning;
} {
  const planning = {
    id: `plan-pr43-${subjectName.slice(0, 6)}`,
    title: subjectName,
    subject: subjectName,
    uacName: subjectName,
    subsystem: 'bge',
    semester: 'Primero',
    targetGrade: 1,
    school: 'Bachillerato General Estatal Prueba',
    schoolId: '21EBH0001Z',
    teacherId: 'doc-pr43',
    unitOrBlock: 'Bloque I',
    metodologiaActiva: 'Aprendizaje Basado en Proyectos',
  } as unknown as Planning;

  const workbook = {
    id: 'wb-pr43-01',
    planningId: planning.id,
    subsystem: 'bge',
    blockIndex: 0,
    blockName: 'Bloque I · Fundamentos',
    coverData: {
      title: `Cuaderno de ${subjectName}`,
      subtitle: 'Bloque Formativo I',
      subjectName,
      schoolName: 'Bachillerato General Estatal Prueba',
      cct: '21EBH0001Z',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Docente Prueba',
      paecProjectName: 'Proyecto Comunitario Escolar',
    },
    missions: [
      {
        missionIndex: 1,
        title: `Misión 1: ${missionTopic}`,
        coveredSessions: [1, 2],
        sessionTopic: missionTopic,
        sessionFocus: `Aplicación situada de ${missionTopic}`,
        phenomenonHook: {
          story: `En la escuela se analiza un caso real sobre ${missionTopic}.`,
          detonatingQuestion: `¿Cómo aplicar ${missionTopic} en tu comunidad?`,
        },
        conceptZero: {
          physicalAnalogy: 'Como una guía de laboratorio bien organizada.',
          coreExplanation: `Principios fundamentales de ${missionTopic} aplicados al contexto escolar.`,
        },
        iDoSection: { stepByStepDemo: 'Demostración guiada paso a paso.' },
        weDoSection: { guidedPractice: '1. Práctica colaborativa guiada en equipos.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Reto autónomo de integración.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué aprendiste en esta misión?',
          reflectionPrompts: ['Explica el criterio aplicado.'],
          criteriaChecklist: ['Valida tu procedimiento con evidencia.'],
        },
        wordCount: 350,
      },
    ],
    projectSection: undefined,
    evaluationSection: undefined,
  } as unknown as ActiveWorkTextbook;

  return { workbook, planning };
}

describe('PR 4.3 — workbook-shared-helpers, sincronía visual DOCX y 17/17 portadas V2', () => {
  it('desacopla los 6 helpers compartidos y RealTocEntry en workbook-shared-helpers.ts manteniendo equivalencia exacta con el re-export temporal', () => {
    expect(reexportedSanitizePdfText).toBe(sanitizePdfText);
    expect(reexportedSeparatePasoInline).toBe(separatePasoInline);
    expect(reexportedResolveWorkbookMethodology).toBe(resolveWorkbookMethodology);
    expect(reexportedEnsureVerticalSpace).toBe(ensureVerticalSpace);
    expect(reexportedPrintParagraph).toBe(printParagraph);
    expect(reexportedSanitizeEducationalResourceUrl).toBe(sanitizeEducationalResourceUrl);

    expect(sanitizePdfText('💡 Fórmula: √9 = 3')).toBe('IDEA Fórmula: √9 = 3');
    expect(separatePasoInline('Inicio. Paso 1: analiza el caso.')).toContain('\n\nPaso 1:');

    const { workbook, planning } = makeDocxFixtures('Cultura Digital I', 'Hojas de cálculo');
    expect(resolveWorkbookMethodology(workbook, planning)).toBe('Aprendizaje Basado en Proyectos');

    const safeUrl = sanitizeEducationalResourceUrl('https://youtube.com/results?search_query=algo', 'Hojas de cálculo', 'video');
    expect(safeUrl).toMatch(/^https:\/\//);
    expect(safeUrl).not.toContain('search_query');

    const tocSample: RealTocEntry = {
      sectionLabel: 'Misión 1',
      title: 'Hojas de cálculo',
      sessionsRange: 'Sesiones 1-4',
      pageNumber: 5,
    };
    expect(tocSample.pageNumber).toBe(5);
  });

  it('sincroniza paleta disciplinar y escenas arquetipo de apertura en DOCX sin romper ribbons golden (SECTION_HEX)', async () => {
    const artsTheme = resolveDocxDisciplinaryTheme('Artes Visuales y Expresión Cultural');
    const bioTheme = resolveDocxDisciplinaryTheme('Biología y Conservación Ambiental');
    const cdTheme = resolveDocxDisciplinaryTheme('Cultura Digital I');

    expect(artsTheme.primary).toBe('4C2A5C');
    expect(bioTheme.primary).toBe('14453D');
    expect(cdTheme.primary).toBe('0F3557');
    expect(artsTheme.primary).not.toBe(bioTheme.primary);

    const { workbook, planning } = makeDocxFixtures('Artes Visuales y Expresión Cultural', 'Composición plástica y color');
    const docxBuffer = await renderWorkbookToDocx(workbook, planning, { coverBuffer: undefined });
    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = (await zip.file('word/document.xml')?.async('text')) || '';
    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));

    // Paleta disciplinar de Artes presente en portada, TOC y banner de misión
    expect(docXml).toContain(`w:fill="${artsTheme.primary}"`);
    expect(docXml).toContain(`w:color="${artsTheme.accent}"`);
    // Ribbons golden intactos (paridad con docx-lote-c-visual-quality.test.ts)
    expect(docXml).toContain('w:fill="1F3864"');
    expect(docXml).toContain('w:fill="2563EB"');
    // Escenas arquetipo embebidas como PNG reales en word/media/ (portada + apertura de misión)
    expect(mediaFiles.length).toBeGreaterThanOrEqual(2);
    expect(docXml).toContain('Escena de apertura');
  }, 20000);

  it('verifica que los 17 dominios (incluidas las 9 portadas V2 nuevas: art, bio, efd, dib, gen, lex, ind, sal, srv) existen en disco como WebP 1600×900 reales', async () => {
    const publicDir = path.join(process.cwd(), 'public');
    const entries = Object.values(EDITORIAL_SCENES_CATALOG).map((set) => set.portada);
    expect(entries).toHaveLength(17);

    const newNineIds = new Set([
      'art-01-portada',
      'bio-01-portada',
      'efd-01-portada',
      'dib-01-portada',
      'gen-01-portada',
      'lex-01-portada',
      'ind-01-portada',
      'sal-01-portada',
      'srv-01-portada',
    ]);
    let verifiedNewNine = 0;

    for (const cover of entries) {
      const absPath = path.join(publicDir, cover.relativePath.replace(/^\/+/, ''));
      expect(fs.existsSync(absPath), `Falta portada en disco: ${cover.relativePath}`).toBe(true);
      const stat = fs.statSync(absPath);
      expect(stat.size, `Portada demasiado pequeña: ${cover.id}`).toBeGreaterThan(40_000);
      const meta = await sharp(absPath).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(900);
      if (newNineIds.has(cover.id)) verifiedNewNine += 1;
    }

    expect(verifiedNewNine).toBe(9);
  });

  it('PR 4.3.1 — CD1 real B1/B2/B3 en DOCX y allocator: 0 protoboard en M3 Sistemas operativos y las 11 misiones no-hardware, 0 consecutivas repetidas y portadas V2 en B1/B2/B3', async () => {
    const fileExists = createNodeSceneFileExists();
    const ticDir = path.join(
      process.cwd(),
      'public',
      'images',
      'escenas',
      'cultura_digital_programacion_ti',
    );
    const hashCropped = async (file: string, w: number, h: number) => {
      const buf = await sharp(path.join(ticDir, file))
        .resize(w, h, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      return crypto.createHash('sha1').update(buf).digest('hex');
    };

    const protoCoverHashes = new Set([
      await hashCropped('tic-01-portada.webp', 1080, 540),
      await hashCropped('tic-02-concepto.webp', 1080, 540),
    ]);
    const protoMissionHashes = new Set([
      await hashCropped('tic-01-portada.webp', 1080, 304),
      await hashCropped('tic-02-concepto.webp', 1080, 304),
    ]);
    const tic07CoverHash = await hashCropped('tic-07-software-datos.webp', 1080, 540);
    const tic08CoverHash = await hashCropped('tic-08-ciudadania-seguridad.webp', 1080, 540);
    const tic07MissionHash = await hashCropped('tic-07-software-datos.webp', 1080, 304);

    const blocksSpec = [
      {
        blockIndex: 0,
        blockName: 'Bloque 1 · Fundamentos Digitales',
        missions: [
          { title: 'Misión 1: Introducción al hardware y software', topic: 'Hardware y software', isHardware: true },
          { title: 'Misión 2: Historia crítica de la tecnología digital', topic: 'Historia crítica de la tecnología digital', isHardware: false },
          { title: 'Misión 3: Sistemas operativos', topic: 'Sistemas operativos y gestión de archivos', isHardware: false },
          { title: 'Misión 4: Corporaciones de innovación', topic: 'Corporaciones de innovación y plataformas digitales', isHardware: false },
        ],
      },
      {
        blockIndex: 1,
        blockName: 'Bloque 2 · Ciudadanía Digital y Hojas de Cálculo',
        missions: [
          { title: 'Misión 1: Las 4 libertades del software libre', topic: 'Cuatro libertades del software libre', isHardware: false },
          { title: 'Misión 2: Práctica y Aplicación — Hojas de cálculo', topic: 'Hojas de cálculo y fórmulas condicionales', isHardware: false },
          { title: 'Misión 3: Proyecto Integrador — Privacidad', topic: 'Privacidad y protección de datos', isHardware: false },
          { title: 'Misión 4: Evaluación y Cierre — Ciudadanía digital', topic: 'Ciudadanía digital y seguridad', isHardware: false },
        ],
      },
      {
        blockIndex: 2,
        blockName: 'Bloque 3 · Pensamiento Algorítmico y Datos',
        missions: [
          { title: 'Misión 1: Pasos para solucionar un problema', topic: 'Resolución de problemas y algoritmos', isHardware: false },
          { title: 'Misión 2: Práctica y Aplicación — Diagramas de flujo', topic: 'Diagramas de flujo y pseudocódigo', isHardware: false },
          { title: 'Misión 3: Proyecto Integrador — Datos', topic: 'Representación gráfica y tabular de datos', isHardware: false },
          { title: 'Misión 4: Evaluación y Cierre — Operadores', topic: 'Operadores y estructuras condicionales', isHardware: false },
        ],
      },
    ];

    for (const blk of blocksSpec) {
      const tracker = createBlockSceneTracker();
      const blockTopicSummary = `${blk.blockName} ${blk.missions.map((m) => `${m.title} ${m.topic}`).join(' ')}`;
      const coverAlloc = allocateEditorialScene({
        uacName: 'Cultura Digital I',
        blockNumber: blk.blockIndex + 1,
        role: 'block_cover',
        topicText: blockTopicSummary,
        preferPortadaV2: true,
        tracker,
        fileExists,
      });

      if (blk.blockIndex === 0) {
        expect(coverAlloc.id).toBe('tic-01-portada');
      } else if (blk.blockIndex === 1) {
        expect(coverAlloc.id).toBe('tic-08-ciudadania-seguridad');
        expect(coverAlloc.visualTags ?? []).not.toContain('protoboard');
      } else {
        expect(coverAlloc.id).toBe('tic-07-software-datos');
        expect(coverAlloc.visualTags ?? []).not.toContain('protoboard');
      }

      const roles = ['mission_1', 'mission_2', 'mission_3', 'mission_4'] as const;
      let prevId: string | undefined;
      for (let mIdx = 0; mIdx < blk.missions.length; mIdx++) {
        const spec = blk.missions[mIdx]!;
        const alloc = allocateEditorialScene({
          uacName: 'Cultura Digital I',
          blockNumber: blk.blockIndex + 1,
          role: roles[mIdx]!,
          topicText: `${spec.title} ${spec.topic}`,
          avoidSceneIds: prevId ? [prevId] : undefined,
          tracker,
          fileExists,
        });
        if (!spec.isHardware) {
          expect(alloc.id, `B${blk.blockIndex + 1}M${mIdx + 1} (${spec.title}) no debe llevar tic-01`).not.toBe('tic-01-portada');
          expect(alloc.id, `B${blk.blockIndex + 1}M${mIdx + 1} (${spec.title}) no debe llevar tic-02`).not.toBe('tic-02-concepto');
          expect(alloc.visualTags ?? []).not.toContain('protoboard');
        }
        if (blk.blockIndex === 0 && mIdx === 2) {
          // B1M3 "Sistemas operativos" debe usar tic-07-software-datos (jamás protoboard)
          expect(alloc.id).toBe('tic-07-software-datos');
        }
        if (prevId) {
          expect(alloc.id, `Repetición consecutiva en B${blk.blockIndex + 1}M${mIdx + 1}`).not.toBe(prevId);
        }
        prevId = alloc.id;
      }

      // Renderizar DOCX binario real por cada bloque CD1 y auditar los PNG embebidos en word/media/
      const { workbook, planning } = makeDocxFixtures('Cultura Digital I', blk.missions[0]!.topic);
      workbook.blockIndex = blk.blockIndex;
      workbook.blockName = blk.blockName;
      workbook.coverData.blockNumber = blk.blockIndex + 1;
      workbook.missions = blk.missions.map((m, idx) => ({
        ...workbook.missions[0]!,
        missionIndex: idx + 1,
        title: m.title,
        sessionTopic: m.topic,
        sessionFocus: m.topic,
        coveredSessions: [idx * 2 + 1, idx * 2 + 2],
      }));

      const docxBuf = await renderWorkbookToDocx(workbook, planning, { coverBuffer: undefined });
      const zip = await JSZip.loadAsync(docxBuf);
      const mediaNames = Object.keys(zip.files)
        .filter((f) => f.startsWith('word/media/') && f.endsWith('.png'))
        .sort();
      const mediaHashes = new Set<string>();
      for (const name of mediaNames) {
        const buf = await zip.file(name)!.async('nodebuffer');
        mediaHashes.add(crypto.createHash('sha1').update(buf).digest('hex'));
      }

      if (blk.blockIndex === 0) {
        // B1M3 Sistemas operativos está presente como tic-07 (1080×304) en el DOCX real
        expect(mediaHashes.has(tic07MissionHash)).toBe(true);
      } else if (blk.blockIndex === 1) {
        // B2: portada es tic-08 (V2) y CERO imágenes protoboard (ni en portada ni en ninguna misión)
        expect(mediaHashes.has(tic08CoverHash)).toBe(true);
        for (const h of protoCoverHashes) expect(mediaHashes.has(h)).toBe(false);
        for (const h of protoMissionHashes) expect(mediaHashes.has(h)).toBe(false);
      } else {
        // B3: portada es tic-07 (V2) y CERO imágenes protoboard (ni en portada ni en ninguna misión)
        expect(mediaHashes.has(tic07CoverHash)).toBe(true);
        for (const h of protoCoverHashes) expect(mediaHashes.has(h)).toBe(false);
        for (const h of protoMissionHashes) expect(mediaHashes.has(h)).toBe(false);
      }
    }

    // Dominio sin variantes 07/08 (Biología) en B2 y B3: portadas de bloque en DOCX conservan bio-01-portada.webp (V2)
    const bioB2 = allocateEditorialScene({
      uacName: 'Biología I',
      blockNumber: 2,
      role: 'block_cover',
      topicText: 'Bloque 2 · Metabolismo celular',
      preferPortadaV2: true,
      fileExists,
    });
    const bioB3 = allocateEditorialScene({
      uacName: 'Biología I',
      blockNumber: 3,
      role: 'block_cover',
      topicText: 'Bloque 3 · Genética y evolución',
      preferPortadaV2: true,
      fileExists,
    });
    expect(bioB2.id).toBe('bio-01-portada');
    expect(bioB3.id).toBe('bio-01-portada');
  }, 45000);
});
