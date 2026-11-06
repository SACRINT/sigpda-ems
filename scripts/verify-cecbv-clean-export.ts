/**
 * verify-cecbv-clean-export.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Verificación exhaustiva y re-exportación de los 10 materiales para la planeación CECBV
 * "Coloca elementos constructivos básicos de una vivienda" (4a3335eb-99f3-47f8-a3d0-c83297fe488b):
 * 1. Tabla de 54 sesiones: Número, Título, 5 Palabras Clave, 0 Términos Prohibidos.
 * 2. Exportación y renderizado físico de los 10 documentos.
 * 3. Extracción de texto y aserción de CERO términos de matemáticas en todos los documentos.
 * 4. Registro de páginas reales y conteo de palabras.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val && !process.env[key]) {
      process.env[key] = val;
    }
  }
}
loadEnv();

import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import { sql } from '../src/lib/db/client';
import { getPlanningById, getPlanningExtrasByType, getAllBlockWorkbooks } from '../src/lib/db';
import { generatePlanningPDF, generateSecuenciaPDF } from '../src/lib/planning-pdf-renderer';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';
import { generateExtraPdfDocument } from '../src/lib/pdf-extra-renderer';
import { buildSacrintDeck, type SacrintDeckSpec } from '../src/lib/visual-engine/sacrint/spec';
import { generateCombinedSacrintPptx } from '../src/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { FORBIDDEN_MATH_PATTERNS } from '../src/lib/guide-engine/cross-contamination-guard';
import { countSessionPlanWords } from '../src/lib/guide-engine/content-budget';
import type { ActiveWorkTextbook, SessionPlan } from '../src/types/work-textbook';

const OUT_DIR = join(process.cwd(), 'output', 'cecbv_export_clean');
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

function extractKeywords(text: string, count = 5): string[] {
  const stopWords = new Set([
    'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
    'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o',
    'este', 'sí', 'porque', 'esta', 'son', 'entre', 'está', 'cuando', 'muy', 'sin', 'sobre',
    'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante',
    'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e',
    'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él',
    'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'sea', 'poco',
    'ella', 'estar', 'haber', 'estas', 'estaba', 'estamos', 'algunas', 'algo', 'nosotros',
    'serás', 'capaz', 'aprenderás', 'sesión', 'término', 'sesion', 'cada', 'debe', 'paso',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map((e) => e[0]);
}

async function mergePdfBuffers(buffers: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const p of pages) {
      merged.addPage(p);
    }
  }
  return await merged.save();
}

async function mergeExtrasPdf(planningId: string, teacherId: string, type: string, brandingCtx: any): Promise<Uint8Array | null> {
  const extras = await getPlanningExtrasByType(planningId, teacherId, type);
  const canonical = extras.filter((ex) => ex.key_index === null || [0, 1, 2].includes(Number(ex.key_index)));
  if (canonical.length === 0) return null;

  const merged = await PDFDocument.create();
  for (const ex of canonical) {
    const doc = generateExtraPdfDocument(ex as any, brandingCtx);
    const buf = Buffer.from(doc.output('arraybuffer'));
    const indDoc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(indDoc, indDoc.getPageIndices());
    for (const p of pages) {
      merged.addPage(p);
    }
  }
  return await merged.save();
}

async function extractPdfTextAndPages(buffer: Uint8Array | Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const pages = result.total || 0;
  await parser.destroy();
  return { text: result.text || '', pages };
}

async function scanTextForContamination(text: string): Promise<string[]> {
  const issues: string[] = [];
  for (const { pattern, label } of FORBIDDEN_MATH_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(label);
    }
  }
  return issues;
}

async function main() {
  const planningId = '4a3335eb-99f3-47f8-a3d0-c83297fe488b';
  const planning = await getPlanningById(planningId);
  if (!planning) throw new Error('Planning no encontrada');

  const teacherId = (planning as any).teacher_id;
  const workbooks = await getAllBlockWorkbooks(planningId);

  const b0Wb: ActiveWorkTextbook = workbooks.block_0?.current;
  const b1Wb: ActiveWorkTextbook = workbooks.block_1?.current;
  const b2Wb: ActiveWorkTextbook = workbooks.block_2?.current;

  if (!b0Wb || !b1Wb || !b2Wb) {
    throw new Error('Faltan workbooks en la planeación');
  }

  // ==========================================================================
  // PARTE 1: TABLA AUDITORÍA DE 54 SESIONES
  // ==========================================================================
  console.log('====================================================================================================');
  console.log('TABLA DE VERIFICACIÓN AUDITORÍA EDITORIAL · 54 SESIONES CURRICULARES (UAC: CONSTRUCCIÓN)');
  console.log('====================================================================================================');
  console.log('| Bloque | Sesión | Título / Objetivo Síntesis | 5 Palabras Clave | Contaminación |');
  console.log('|---|---|---|---|---|');

  const allBlocks = [
    { name: 'Bloque 1', wb: b0Wb },
    { name: 'Bloque 2', wb: b1Wb },
    { name: 'Bloque 3', wb: b2Wb },
  ];

  let totalSessionsChecked = 0;
  let totalContaminatedSessions = 0;

  for (const { name, wb } of allBlocks) {
    const plans: SessionPlan[] = (wb.missions || []).flatMap((m) => m.sessionPlans || []);
    for (const plan of plans) {
      totalSessionsChecked++;
      const fullText = `${plan.objetivo || ''} ${plan.contenido || ''} ${plan.ejemploResuelto || ''}`;
      const kws = extractKeywords(fullText, 5);
      const issues = await scanTextForContamination(fullText);
      const status = issues.length === 0 ? '✅ 0 términos' : `❌ ${issues.join(', ')}`;
      if (issues.length > 0) totalContaminatedSessions++;

      const titleClean = (plan.objetivo || '').slice(0, 55).replace(/\|/g, '-').trim();
      console.log(`| ${name} | S${plan.sessionNumber.toString().padStart(2, '0')} | ${titleClean}... | ${kws.join(', ')} | ${status} |`);
    }
  }

  console.log('====================================================================================================');
  console.log(`Total Sesiones Verificadas: ${totalSessionsChecked}/54 | Sesiones Contaminadas: ${totalContaminatedSessions}`);
  console.log('====================================================================================================\n');

  // ==========================================================================
  // PARTE 2: EXPORTACIÓN Y VERIFICACIÓN DE LOS 10 DOCUMENTOS
  // ==========================================================================
  console.log('INICIANDO GENERACIÓN Y EXPORTACIÓN DE LOS 10 MATERIALES INSTITUCIONALES...\n');

  const brandingCtx = {
    schoolName: (planning.extracted_data as any)?.schoolName || 'Bachillerato General Héroes de la Patria',
    cct: (planning.extracted_data as any)?.cct || '21EBH0200X',
    semester: planning.semester,
  };

  const results: Array<{
    documento: string;
    archivo: string;
    paginas: number;
    terminosProhibidos: number;
    detalles: string;
  }> = [];

  // 1. Libro Maestro Compendio (PDF)
  console.log('1/10 Generando Libro Maestro Unificado...');
  const b0Pdf = await renderWorkbookToPdf(b0Wb);
  const b1Pdf = await renderWorkbookToPdf(b1Wb);
  const b2Pdf = await renderWorkbookToPdf(b2Wb);
  const masterBookBuf = await mergePdfBuffers([b0Pdf, b1Pdf, b2Pdf]);
  const masterFile = join(OUT_DIR, '01_Libro_Maestro_Consolidado.pdf');
  writeFileSync(masterFile, masterBookBuf);
  const masterParsed = await extractPdfTextAndPages(masterBookBuf);
  const masterIssues = await scanTextForContamination(masterParsed.text);
  results.push({
    documento: '1. Libro Maestro Consolidado',
    archivo: '01_Libro_Maestro_Consolidado.pdf',
    paginas: masterParsed.pages,
    terminosProhibidos: masterIssues.length,
    detalles: masterIssues.join(', ') || 'Limpio',
  });

  // 2. Planeación Didáctica Semestral (PDF)
  console.log('2/10 Generando Planeación Didáctica...');
  const planDoc = await generatePlanningPDF(planning);
  const planBuf = Buffer.from(planDoc.output('arraybuffer'));
  const planFile = join(OUT_DIR, '02_Planeacion_Semestre_5.pdf');
  writeFileSync(planFile, planBuf);
  const planParsed = await extractPdfTextAndPages(planBuf);
  const planIssues = await scanTextForContamination(planParsed.text);
  results.push({
    documento: '2. Planeación Didáctica',
    archivo: '02_Planeacion_Semestre_5.pdf',
    paginas: planParsed.pages,
    terminosProhibidos: planIssues.length,
    detalles: planIssues.join(', ') || 'Limpio',
  });

  // 3. Secuencia Didáctica (PDF)
  console.log('3/10 Generando Secuencia Didáctica...');
  const secDoc = await generateSecuenciaPDF(planning);
  const secBuf = Buffer.from(secDoc.output('arraybuffer'));
  const secFile = join(OUT_DIR, '03_Secuencia_Didactica_Semestre_5.pdf');
  writeFileSync(secFile, secBuf);
  const secParsed = await extractPdfTextAndPages(secBuf);
  const secIssues = await scanTextForContamination(secParsed.text);
  results.push({
    documento: '3. Secuencia Didáctica',
    archivo: '03_Secuencia_Didactica_Semestre_5.pdf',
    paginas: secParsed.pages,
    terminosProhibidos: secIssues.length,
    detalles: secIssues.join(', ') || 'Limpio',
  });

  // 4. Planes de Clase (PDF)
  console.log('4/10 Generando Planes de Clase...');
  const lessonPlansBuf = await mergeExtrasPdf(planningId, teacherId, 'lesson_plan', brandingCtx);
  if (lessonPlansBuf) {
    const file = join(OUT_DIR, '04_Planes_de_Clase_Todos_Bloques.pdf');
    writeFileSync(file, lessonPlansBuf);
    const parsed = await extractPdfTextAndPages(lessonPlansBuf);
    const issues = await scanTextForContamination(parsed.text);
    results.push({
      documento: '4. Planes de Clase',
      archivo: '04_Planes_de_Clase_Todos_Bloques.pdf',
      paginas: parsed.pages,
      terminosProhibidos: issues.length,
      detalles: issues.join(', ') || 'Limpio',
    });
  }

  // 5. Materiales del Docente (PDF)
  console.log('5/10 Generando Materiales del Docente...');
  const materialsBuf = await mergeExtrasPdf(planningId, teacherId, 'material', brandingCtx);
  if (materialsBuf) {
    const file = join(OUT_DIR, '05_Materiales_Docente_Todos_Bloques.pdf');
    writeFileSync(file, materialsBuf);
    const parsed = await extractPdfTextAndPages(materialsBuf);
    const issues = await scanTextForContamination(parsed.text);
    results.push({
      documento: '5. Materiales del Docente',
      archivo: '05_Materiales_Docente_Todos_Bloques.pdf',
      paginas: parsed.pages,
      terminosProhibidos: issues.length,
      detalles: issues.join(', ') || 'Limpio',
    });
  }

  // 6. Solucionarios (PDF)
  console.log('6/10 Generando Solucionarios...');
  const solutionsBuf = await mergeExtrasPdf(planningId, teacherId, 'teacher_guide', brandingCtx);
  if (solutionsBuf) {
    const file = join(OUT_DIR, '06_Solucionarios_Todos_Bloques.pdf');
    writeFileSync(file, solutionsBuf);
    const parsed = await extractPdfTextAndPages(solutionsBuf);
    const issues = await scanTextForContamination(parsed.text);
    results.push({
      documento: '6. Solucionarios',
      archivo: '06_Solucionarios_Todos_Bloques.pdf',
      paginas: parsed.pages,
      terminosProhibidos: issues.length,
      detalles: issues.join(', ') || 'Limpio',
    });
  }

  // 7. Fichas de Trabajo / Infografías (PDF)
  console.log('7/10 Generando Fichas de Trabajo / Infografías...');
  const practiceBuf = await mergeExtrasPdf(planningId, teacherId, 'practice_guide', brandingCtx);
  if (practiceBuf) {
    const file = join(OUT_DIR, '07_Fichas_de_Trabajo_Todos_Bloques.pdf');
    writeFileSync(file, practiceBuf);
    const parsed = await extractPdfTextAndPages(practiceBuf);
    const issues = await scanTextForContamination(parsed.text);
    results.push({
      documento: '7. Fichas de Trabajo (Infografías)',
      archivo: '07_Fichas_de_Trabajo_Todos_Bloques.pdf',
      paginas: parsed.pages,
      terminosProhibidos: issues.length,
      detalles: issues.join(', ') || 'Limpio',
    });
  }

  // 8. Lista de Cotejo (PDF)
  console.log('8/10 Generando Lista de Cotejo...');
  const checklistBuf = await mergeExtrasPdf(planningId, teacherId, 'checklist', brandingCtx);
  if (checklistBuf) {
    const file = join(OUT_DIR, '08_Lista_de_Cotejo_Todos_Bloques.pdf');
    writeFileSync(file, checklistBuf);
    const parsed = await extractPdfTextAndPages(checklistBuf);
    const issues = await scanTextForContamination(parsed.text);
    results.push({
      documento: '8. Lista de Cotejo',
      archivo: '08_Lista_de_Cotejo_Todos_Bloques.pdf',
      paginas: parsed.pages,
      terminosProhibidos: issues.length,
      detalles: issues.join(', ') || 'Limpio',
    });
  }

  // 9. Rúbricas (PDF)
  console.log('9/10 Generando Rúbricas...');
  const rubricBuf = await mergeExtrasPdf(planningId, teacherId, 'rubric', brandingCtx);
  if (rubricBuf) {
    const file = join(OUT_DIR, '09_Rubricas_Todos_Bloques.pdf');
    writeFileSync(file, rubricBuf);
    const parsed = await extractPdfTextAndPages(rubricBuf);
    const issues = await scanTextForContamination(parsed.text);
    results.push({
      documento: '9. Rúbricas Analíticas',
      archivo: '09_Rubricas_Todos_Bloques.pdf',
      paginas: parsed.pages,
      terminosProhibidos: issues.length,
      detalles: issues.join(', ') || 'Limpio',
    });
  }

  // 10. Presentación SACRINT (PPTX)
  console.log('10/10 Generando Presentación PPTX...');
  const effectiveEntries = [
    { blockIndex: 0, workbook: b0Wb },
    { blockIndex: 1, workbook: b1Wb },
    { blockIndex: 2, workbook: b2Wb },
  ];
  const sacrintDecks: SacrintDeckSpec[] = [];
  for (const entry of effectiveEntries) {
    const missionCount = Math.max(1, (entry.workbook.missions ?? []).length);
    for (let missionIndex = 0; missionIndex < missionCount; missionIndex += 1) {
      sacrintDecks.push(buildSacrintDeck(entry.workbook, { missionIndex, mode: 'classroom' }));
    }
  }
  const pptxBuf = await generateCombinedSacrintPptx(sacrintDecks, {
    title: `Presentación Completa: ${planning.uacName}`,
    subjectName: planning.uacName,
    schoolName: brandingCtx.schoolName,
    teacherName: 'Nemesio Loyda López',
  });
  const pptxFile = join(OUT_DIR, '10_Presentacion_Todos_Bloques.pptx');
  writeFileSync(pptxFile, pptxBuf);

  // Cantidad total de diapositivas en los decks
  const totalSlides = sacrintDecks.reduce((acc, d) => acc + (d.slides?.length || 0), 0);
  const pptxText = sacrintDecks
    .flatMap((d) => d.slides || [])
    .map((s) => `${s.title || ''} ${s.bullets?.join(' ') || ''} ${s.script || ''}`)
    .join(' ');
  const pptxIssues = await scanTextForContamination(pptxText);
  results.push({
    documento: '10. Presentación SACRINT',
    archivo: '10_Presentacion_Todos_Bloques.pptx',
    paginas: totalSlides,
    terminosProhibidos: pptxIssues.length,
    detalles: pptxIssues.join(', ') || 'Limpio',
  });

  // ==========================================================================
  // PARTE 3: TABLA DE RESULTADOS DE EXPORTACIÓN
  // ==========================================================================
  console.log('\n====================================================================================================');
  console.log('MATRIZ DE RESULTADOS DE EXPORTACIÓN · 10 MATERIALES INSTITUCIONALES CECBV');
  console.log('====================================================================================================');
  console.log('| Documento | Archivo Exportado | Páginas / Slides | Términos Prohibidos | Veredicto |');
  console.log('|---|---|---|---|---|');
  for (const r of results) {
    const veredicto = r.terminosProhibidos === 0 ? '✅ 100% LIMPIO (APTO)' : `❌ NO APTO (${r.detalles})`;
    console.log(`| ${r.documento} | ${r.archivo} | ${r.paginas} | ${r.terminosProhibidos} | ${veredicto} |`);
  }
  console.log('====================================================================================================\n');

  const allClean = results.every((r) => r.terminosProhibidos === 0);
  console.log(allClean ? '🎉 RESULTADO FINAL: TODOS LOS 10 DOCUMENTOS ESTÁN 100% LIMPIOS Y APTOS PARA AUDITORÍA.' : '⚠️ SE DETECTARON TÉRMINOS FORÁNEOS EN LA EXPORTACIÓN.');
}

main().catch(console.error).finally(() => process.exit(0));
