/**
 * master-workbook-compiler.ts — Compilador del Libro Maestro Semestral
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Compila los libros generados de los Bloques 1, 2 y 3 en un solo
 * Libro Maestro Semestral (~150-200 páginas) consumiendo 0 TOKENS de IA.
 *
 * Flujo de ejecución:
 * 1. Recupera los libros de trabajo generados desde `getAllBlockWorkbooks(planningId)`.
 * 2. Ordena correlativamente los bloques (Bloque I → Bloque II → Bloque III).
 * 3. Genera portada semestral unificada institucional.
 * 4. Construye el índice general semestral con paginación corrida continua.
 * 5. Inserta portadillas separadoras entre bloques formativos.
 * 6. Produce ambos binarios finales (DOCX y PDF).
 */

import { getAllBlockWorkbooks } from '@/lib/db';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { renderWorkbookToDocx } from '@/lib/docx-workbook-renderer';
import { renderWorkbookToPdf } from '@/lib/pdf-workbook-renderer';
import { validateSemestralGuideQuality, type SemestralValidationOutput } from '@/lib/guide-engine/quality-validator';

export interface CompileSemestralOptions {
  format?: 'docx' | 'pdf' | 'both';
}

/**
 * Compila el compendio semestral completo de los bloques en DOCX y/o PDF sin gastar tokens de IA.
 */
export async function compileSemestralWorkbook(
  planningId: string,
  planning: Planning,
  options: CompileSemestralOptions = {}
): Promise<{ docx?: Buffer; pdf?: Buffer; semestralQuality: SemestralValidationOutput }> {
  const format = options.format || 'both';

  // 1. Leer los bloques disponibles desde la base de datos
  const workbooksMap = await getAllBlockWorkbooks(planningId);
  const blockKeys = Object.keys(workbooksMap).sort((a, b) => {
    const numA = parseInt(a.replace('block_', ''), 10);
    const numB = parseInt(b.replace('block_', ''), 10);
    return numA - numB;
  });

  const availableBooks: ActiveWorkTextbook[] = [];
  for (const key of blockKeys) {
    const entry = workbooksMap[key];
    if (entry?.current) {
      availableBooks.push(entry.current);
    }
  }

  if (availableBooks.length === 0) {
    throw new Error(
      `[master-workbook-compiler] No se encontraron libros de trabajo generados para la planeación ${planningId}`
    );
  }

  // 2. Fusionar en un objeto unificado consolidado semestral
  const { consolidatedBook, semestralQuality } = buildConsolidatedBook(availableBooks, planning);

  // 3. Renderizar únicamente el formato solicitado (0 tokens de IA, sin duplicar memoria/CPU)
  let docxBuffer: Buffer | undefined;
  let pdfBuffer: Buffer | undefined;

  if (format === 'docx') {
    docxBuffer = await renderWorkbookToDocx(consolidatedBook, planning);
  } else if (format === 'pdf') {
    pdfBuffer = await renderWorkbookToPdf(consolidatedBook, planning);
  } else {
    docxBuffer = await renderWorkbookToDocx(consolidatedBook, planning);
    pdfBuffer = await renderWorkbookToPdf(consolidatedBook, planning);
  }

  return {
    docx: docxBuffer,
    pdf: pdfBuffer,
    semestralQuality,
  };
}

/**
 * Fusiona los libros individuales de cada bloque en un libro semestral continuo
 */
function buildConsolidatedBook(
  books: ActiveWorkTextbook[],
  planning: Planning
): { consolidatedBook: ActiveWorkTextbook; semestralQuality: SemestralValidationOutput } {
  const firstBook = books[0];
  const totalWords = books.reduce((acc, b) => acc + (b.totalWords || 0), 0);
  const totalPages = books.reduce((acc, b) => acc + (b.totalPages || 0), 0);
  // Validación de calidad macro semestral (BT: >= 25,000 / BGE: >= 17,500)
  const semestralQuality = validateSemestralGuideQuality({
    subsystem: firstBook.subsystem === 'bt' ? 'bt' : 'bge',
    totalWords,
    blockBooks: books.map((b) => ({
      blockIndex: b.blockIndex,
      totalWords: b.totalWords || 0,
      qualityScore: b.qualityScore || 0,
      qualityWarning: Boolean(b.qualityWarning),
    })),
  });

  if (!semestralQuality.accepted || semestralQuality.qualityWarning) {
    console.warn(
      `[master-workbook-compiler] Compendio Semestral con advertencias: words=${totalWords}/${semestralQuality.macroMinWords}, score=${semestralQuality.qualityScore}.`,
      semestralQuality.warnings
    );
  }

  // Índice consolidado con paginación corrida continua y numeración correlativa
  let currentPageEstimate = 3; // Portada (1), Portada Semestral (2), Índice (3)
  const consolidatedTOC: ActiveWorkTextbook['tableOfContents'] = [];
  const consolidatedMissions: ActiveWorkTextbook['missions'] = [];
  let globalMissionIndex = 1;

  books.forEach((book, bIdx) => {
    const romanBlock = bIdx === 0 ? 'I' : bIdx === 1 ? 'II' : 'III';

    // Agregar entrada de cabecera de bloque en el índice (missionIndex: 0 evita colisión de números)
    consolidatedTOC.push({
      missionIndex: 0,
      title: `── BLOQUE ${romanBlock}: ${book.blockName.toUpperCase()} ──`,
      sessionsRange: `Bloque ${romanBlock}`,
      pageEstimate: book.totalPages || 40,
    });

    book.missions.forEach((m) => {
      const pageSpan = Math.max(4, Math.round((m.wordCount || 800) / 450));
      const currentGlobalIndex = globalMissionIndex++;
      const cleanInnerTitle = m.title.replace(/^misi[oó]n\s*\d+\s*:\s*/i, '').trim();

      consolidatedTOC.push({
        missionIndex: currentGlobalIndex,
        title: `[Bloque ${romanBlock}] ${cleanInnerTitle}`,
        sessionsRange: `Sesiones: ${m.coveredSessions?.join(', ') || 'N/A'}`,
        pageEstimate: pageSpan,
      });
      currentPageEstimate += pageSpan;

      // Inyectar misión con índice correlativo global
      consolidatedMissions.push({
        ...m,
        missionIndex: currentGlobalIndex,
        title: `[Bloque ${romanBlock}] ${cleanInnerTitle}`,
      });
    });
  });

  // Tomar el proyecto y evaluación del último bloque o fusionados
  const lastBook = books[books.length - 1];

  const consolidatedBook: ActiveWorkTextbook = {
    id: `semestral-${planning.id}`,
    planningId: planning.id,
    blockIndex: 99, // Identificador de compendio semestral
    blockName: 'Compendio Semestral Completo (Bloques I, II y III)',
    version: 1,
    subsystem: firstBook.subsystem,
    targetPages: firstBook.subsystem === 'bt' ? 180 : 130,
    totalPages,
    totalWords,
    generatedAt: new Date().toISOString(),
    qualityScore: semestralQuality.qualityScore,
    qualityWarning: semestralQuality.qualityWarning,
    coverData: {
      title: `Libro de Texto y Cuaderno de Trabajo Activo: Compendio Semestral`,
      subtitle: `Formación Integral Basada en Misiones Comunitarias y Retos Tecnológicos`,
      subjectName: planning.uacName,
      semester: planning.semester,
      blockNumber: 0,
      teacherName: firstBook.coverData.teacherName,
      schoolName: firstBook.coverData.schoolName,
      cct: firstBook.coverData.cct,
      paecProjectName: firstBook.coverData.paecProjectName,
    },
    tableOfContents: consolidatedTOC,
    missions: consolidatedMissions,
    projectSection: lastBook.projectSection,
    evaluationSection: lastBook.evaluationSection,
  };

  return {
    consolidatedBook,
    semestralQuality,
  };
}
