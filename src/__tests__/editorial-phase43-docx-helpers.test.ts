import { describe, it, expect, vi } from 'vitest';
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
});
