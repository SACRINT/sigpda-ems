/**
 * qa-sacrint-materials.ts
 * Script QA reutilizable para auditar entregables reales (01_ a 09_ en PDF y PPTX).
 * Uso:
 *   node scripts/qa-sacrint-materials.ts --dir "<carpeta-de-materiales>" [--json] [--strict]
 */

import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfQaReport {
  file: string;
  pages: number;
  totalChars: number;
  wordCount: number;
  avgCharsPerPage: number;
  fullPageRasterCount: number;
  totalImagePaintOps: number;
  findings: Record<string, string[]>;
}

export interface PptxSlideCollision {
  slideNumber: number;
  shapeA: string;
  shapeB: string;
  overlapRatioA: number;
}

export interface PptxQaReport {
  file: string;
  slideCount: number;
  wrapNoneShapes: number;
  outOfBoundsShapes: number;
  collisions: PptxSlideCollision[];
  wordStats: {
    slide12Avg: number;
    slide12Over200: number;
    slide12Under80: number;
    slide22Avg: number;
    slide22Over200: number;
    slide22MissingRubricOrObjectives: number;
  };
  repeatedMisconceptions: Array<{ text: string; count: number }>;
  findings: Record<string, string[]>;
}

export interface MaterialQaSummary {
  dir: string;
  passed: boolean;
  failures: string[];
  warnings: string[];
  pdfs: PdfQaReport[];
  pptx: PptxQaReport[];
}

const EMU_PER_INCH = 914400;

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

function collectPatternMatches(text: string, regex: RegExp, limit = 10): string[] {
  const results: string[] = [];
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 28);
    const end = Math.min(text.length, m.index + m[0].length + 28);
    results.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
    if (results.length >= limit) break;
  }
  return results;
}

export function scanEditorialDefects(text: string): Record<string, string[]> {
  const findings: Record<string, string[]> = {};
  const rules: Array<[string, RegExp]> = [
    ['tab_times_corruption', /(?:\t|[\s=(×])[iI]mes(?=\s|[A-Za-z0-9(]|$)/],
    ['lost_asterisk_known', /\b(?:2largo|2ancho|base\s{2,}altura|largo\s{2,}ancho|C\s{2,}i\s{2,}t)\b|\(\s*12\s+9\s*\)/],
    ['double_dots', /(?<![.\d])\.\.(?![.\d])(?!\s*$)/],
    ['dup_session_header', /Sesi[oó]n\s+(\d{1,2})\s*[:.\-–—]*\s*Sesi[oó]n\s+\1\b/i],
    ['dangling_activaras_tus', /y\s+activar[aá]s\s+tus(?:\s*["".»)]|\s+[—–-]|\s*\[|\s*$)/i],
    ['placeholder_modelo', /Modelo\s+por\s+construir|MODELO\s+POR\s+CONSTRUIR|Contenido\s+por\s+completar|Por\s+completar\s+en\s+el\s+libro/i],
    ['glued_paso_inline', /[^\n.?!][ \t]+\d+\)[ \t]+[^\n.?!]{3,60}[ \t]+Paso[ \t]+\d+[ \t]*:|[=x0-9)][ \t]+Paso[ \t]+\d+[ \t]*:/i],
    ['uninterpolated_template', /\$\{[A-Za-z0-9_.]+\}|\[\[(?:material|img|tag):[^\]]+\]\]/],
    ['meta_boilerplate', /\b(?:Cálculos y mediciones en aula|Paso\s+1:\s+Comprensi[oó]n\s+e\s+identificaci[oó]n\s+de\s+datos)\b|\ben aula(?=\s*[.]?\s*$)/i],
  ];

  for (const [key, re] of rules) {
    const hits = collectPatternMatches(text, re);
    if (hits.length > 0) findings[key] = hits;
  }
  return findings;
}

export async function auditPdfFile(filePath: string): Promise<PdfQaReport> {
  const fileName = path.basename(filePath);
  const rawBuffer = fs.readFileSync(filePath);
  const data = new Uint8Array(rawBuffer);

  const parser = new PDFParse({ data });
  let text = '';
  let pages = 0;
  try {
    const res = await parser.getText();
    text = res.text || '';
    pages = res.total || 0;
  } finally {
    await parser.destroy();
  }

  let fullPageRasterCount = 0;
  let totalImagePaintOps = 0;
  const globalObj = globalThis as { pdfjsWorker?: unknown };
  const pdfParseWorker = globalObj.pdfjsWorker;
  try {
    // pdf-parse bundles pdfjs 5.x worker on globalThis.pdfjsWorker; clear temporarily for pdfjs-dist 6.x
    globalObj.pdfjsWorker = undefined;
    const ops = pdfjs.OPS ?? (pdfjs as unknown as { default?: { OPS?: typeof pdfjs.OPS } }).default?.OPS;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(rawBuffer), verbosity: 0 });
    const pdfDoc = await loadingTask.promise;
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);
      const opList = await page.getOperatorList();
      let pageImgs = 0;
      if (ops) {
        for (const fnId of opList.fnArray) {
          if (fnId === ops.paintImageXObject || fnId === ops.paintInlineImageXObject) {
            pageImgs++;
            totalImagePaintOps++;
          }
        }
      }
      // If a page in 09_ has very little selectable text (< 120 chars) and >= 1 raster image, it's raster-bound
      const tc = await page.getTextContent();
      const pageTextLen = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join('')
        .replace(/\s+/g, '').length;
      if (fileName.startsWith('09_') && pageImgs >= 1 && pageTextLen < 120) {
        fullPageRasterCount++;
      }
      page.cleanup();
    }
    await pdfDoc.destroy();
  } catch (err) {
    if (process.env.DEBUG_QA) {
      console.warn(`[qa] pdfjs inspection failed for ${fileName}:`, err);
    }
  } finally {
    globalObj.pdfjsWorker = pdfParseWorker;
  }

  const normalizedWords = text.trim() ? text.trim().split(/\s+/).length : 0;
  const findings = scanEditorialDefects(text);

  if (fileName.startsWith('09_') && /RUTA\s+DE\s+APRENDIZAJE/i.test(text)) {
    findings['legacy_ruta_aprendizaje'] = ['RUTA DE APRENDIZAJE encontrada en 09_'];
  }

  return {
    file: fileName,
    pages,
    totalChars: text.replace(/\s+/g, '').length,
    wordCount: normalizedWords,
    avgCharsPerPage: pages > 0 ? Math.round(text.replace(/\s+/g, '').length / pages) : 0,
    fullPageRasterCount,
    totalImagePaintOps,
    findings,
  };
}

interface ParsedShapeBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  hasText: boolean;
  wrapNone: boolean;
  fontSizePt: number;
}

export function extractShapesFromSlideXml(xml: string): ParsedShapeBox[] {
  const shapes: ParsedShapeBox[] = [];
  const spMatches = xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g);
  for (const m of spMatches) {
    const sp = m[0];
    const nameM = sp.match(/<p:cNvPr[^>]*name="([^"]*)"/);
    const offM = sp.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/);
    const extM = sp.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (!offM || !extM) continue;
    let x = Number(offM[1]) / EMU_PER_INCH;
    let y = Number(offM[2]) / EMU_PER_INCH;
    let w = Number(extM[1]) / EMU_PER_INCH;
    let h = Number(extM[2]) / EMU_PER_INCH;
    const rotM = sp.match(/<a:xfrm[^>]*rot="(\d+)"/);
    const rotUnits = rotM ? Number(rotM[1]) : 0;
    if (rotUnits === 5400000 || rotUnits === 16200000) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const origW = w;
      const origH = h;
      w = origH;
      h = origW;
      x = cx - w / 2;
      y = cy - h / 2;
    }
    const texts = [...sp.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decodeXmlEntities(t[1]));
    const fullText = texts.join(' ').replace(/\s+/g, ' ').trim();
    const wrapNone = /wrap="none"/.test(sp);
    const szM = sp.match(/<a:rPr[^>]*\bsz="(\d+)"/);
    const fontSizePt = szM ? Number(szM[1]) / 100 : 12;
    shapes.push({
      id: nameM?.[1] || 'shape',
      x,
      y,
      w,
      h,
      text: fullText,
      hasText: fullText.length > 0,
      wrapNone,
      fontSizePt,
    });
  }
  return shapes;
}

export function detectTextBoxCollisions(
  shapes: ParsedShapeBox[],
  slideNumber: number,
  toleranceIn = 0.03
): PptxSlideCollision[] {
  const textBoxes = shapes.filter((s) => s.hasText && s.w > 0.1 && s.h > 0.08);
  const collisions: PptxSlideCollision[] = [];
  for (let i = 0; i < textBoxes.length; i++) {
    const a = textBoxes[i];
    for (let j = i + 1; j < textBoxes.length; j++) {
      const b = textBoxes[j];
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) - toleranceIn);
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) - toleranceIn);
      if (ix > 0 && iy > 0) {
        const interArea = ix * iy;
        const minArea = Math.min(a.w * a.h, b.w * b.h);
        const ratio = minArea > 0 ? interArea / minArea : 0;
        if (ratio > 0.05) {
          collisions.push({
            slideNumber,
            shapeA: a.text.slice(0, 35),
            shapeB: b.text.slice(0, 35),
            overlapRatioA: Number(ratio.toFixed(2)),
          });
        }
      }
    }
  }
  return collisions;
}

export async function auditPptxFile(filePath: string): Promise<PptxQaReport> {
  const fileName = path.basename(filePath);
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));

  let slideWidthIn = 13.333;
  let slideHeightIn = 7.5;
  const presFile = zip.files['ppt/presentation.xml'];
  if (presFile) {
    const presXml = await presFile.async('text');
    const sldSz = presXml.match(/<p:sldSz\s+cx="(\d+)"\s+cy="(\d+)"/);
    if (sldSz) {
      slideWidthIn = Number(sldSz[1]) / EMU_PER_INCH;
      slideHeightIn = Number(sldSz[2]) / EMU_PER_INCH;
    }
  }

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  let wrapNoneShapes = 0;
  let outOfBoundsShapes = 0;
  const collisions: PptxSlideCollision[] = [];
  const findings: Record<string, string[]> = {};
  const slide12Counts: number[] = [];
  const slide22Counts: number[] = [];
  let slide12Over200 = 0;
  let slide12Under80 = 0;
  let slide22Over200 = 0;
  let slide22MissingRubricOrObjectives = 0;
  const errorComunCounts = new Map<string, number>();

  for (let i = 0; i < slideFiles.length; i++) {
    const slideNumber = i + 1;
    const xml = await zip.files[slideFiles[i]]!.async('text');
    const shapes = extractShapesFromSlideXml(xml);
    for (const s of shapes) {
      if (s.wrapNone && s.hasText && s.text.length > 24) {
        wrapNoneShapes++;
      }
      if (
        s.hasText &&
        (s.x < -0.05 || s.y < -0.05 || s.x + s.w > slideWidthIn + 0.08 || s.y + s.h > slideHeightIn + 0.08)
      ) {
        outOfBoundsShapes++;
      }
    }
    collisions.push(...detectTextBoxCollisions(shapes, slideNumber));

    const allSlideText = shapes.map((s) => s.text).filter(Boolean).join('\n');
    const words = allSlideText.trim() ? allSlideText.trim().split(/\s+/).length : 0;

    if (allSlideText.includes('PIZARRÓN DOCENTE (1/2)')) {
      slide12Counts.push(words);
      if (words > 200) slide12Over200++;
      if (words < 80) slide12Under80++;
    } else if (allSlideText.includes('PIZARRÓN DOCENTE (2/2)')) {
      slide22Counts.push(words);
      if (words > 200) slide22Over200++;
      if (!/EVALUACI[OÓ]N|CRITERIO|R[UÚ]BRICA/i.test(allSlideText) || !/OBJETIVO|META|PROP[OÓ]SITO/i.test(allSlideText)) {
        slide22MissingRubricOrObjectives++;
      }
    }

    // Track ERROR COMÚN repetition across slides
    const errIdx = shapes.findIndex((s) => /ERROR COM[UÚ]N/i.test(s.text));
    if (errIdx !== -1 && errIdx + 1 < shapes.length) {
      const candidate = shapes
        .slice(errIdx + 1)
        .find((s) => s.hasText && s.y >= shapes[errIdx]!.y && s.y < shapes[errIdx]!.y + 1.5);
      if (candidate && candidate.text.length > 15) {
        const key = candidate.text.slice(0, 90);
        errorComunCounts.set(key, (errorComunCounts.get(key) ?? 0) + 1);
      }
    }

    // Check negative quadratic sign mismatch (-x² described, rendered as 1x²)
    if (/y\s*=\s*-x(?:²|\^2)/i.test(allSlideText) && /\b1x(?:²|\^2)/i.test(allSlideText)) {
      findings['negative_quadratic_sign_bug'] = findings['negative_quadratic_sign_bug'] || [];
      findings['negative_quadratic_sign_bug'].push(`Slide ${slideNumber}: -x² mostrado como 1x²`);
    }

    const slideDefects = scanEditorialDefects(allSlideText);
    for (const [k, v] of Object.entries(slideDefects)) {
      findings[k] = (findings[k] || []).concat(v.map((item) => `S${slideNumber}: ${item}`)).slice(0, 12);
    }
  }

  const repeatedMisconceptions = [...errorComunCounts.entries()]
    .filter(([, count]) => count > 2)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);

  const avg = (arr: number[]) =>
    arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;

  return {
    file: fileName,
    slideCount: slideFiles.length,
    wrapNoneShapes,
    outOfBoundsShapes,
    collisions,
    wordStats: {
      slide12Avg: avg(slide12Counts),
      slide12Over200,
      slide12Under80,
      slide22Avg: avg(slide22Counts),
      slide22Over200,
      slide22MissingRubricOrObjectives,
    },
    repeatedMisconceptions,
    findings,
  };
}

export async function runMaterialsQa(targetDir: string, options?: { strict?: boolean }): Promise<MaterialQaSummary> {
  const entries = fs.readdirSync(targetDir).sort();
  const pdfReports: PdfQaReport[] = [];
  const pptxReports: PptxQaReport[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const name of entries) {
    const full = path.join(targetDir, name);
    if (!fs.statSync(full).isFile()) continue;
    if (name.toLowerCase().endsWith('.pdf')) {
      const report = await auditPdfFile(full);
      pdfReports.push(report);
      for (const [k, hits] of Object.entries(report.findings)) {
        failures.push(`[${report.file}] ${k} (${hits.length}): ${hits[0]}`);
      }
      if (report.file.startsWith('09_') && report.fullPageRasterCount > 0) {
        failures.push(
          `[${report.file}] Infografía rasterizada sin texto seleccionable en ${report.fullPageRasterCount}/${report.pages} páginas (avgChars=${report.avgCharsPerPage})`
        );
      }
      if (report.file.startsWith('09_') && report.avgCharsPerPage < 150) {
        failures.push(`[${report.file}] Bajo texto seleccionable promedio por página: ${report.avgCharsPerPage} chars`);
      }
    } else if (name.toLowerCase().endsWith('.pptx')) {
      const report = await auditPptxFile(full);
      pptxReports.push(report);
      for (const [k, hits] of Object.entries(report.findings)) {
        failures.push(`[${report.file}] ${k} (${hits.length}): ${hits[0]}`);
      }
      if (report.wrapNoneShapes > 0) {
        failures.push(`[${report.file}] ${report.wrapNoneShapes} cajas de texto multi-palabra con wrap="none"`);
      }
      if (report.collisions.length > 0) {
        failures.push(`[${report.file}] ${report.collisions.length} colisiones geométricas detectadas (ej. Slide ${report.collisions[0]!.slideNumber}: "${report.collisions[0]!.shapeA}" vs "${report.collisions[0]!.shapeB}")`);
      }
      if (report.wordStats.slide12Over200 > 0 || report.wordStats.slide22Over200 > 0) {
        failures.push(`[${report.file}] Slides > 200 palabras: 1/2=${report.wordStats.slide12Over200}, 2/2=${report.wordStats.slide22Over200}`);
      }
      if (options?.strict && report.wordStats.slide12Avg > 140) {
        warnings.push(`[${report.file}] Promedio 1/2 (${report.wordStats.slide12Avg}w) excede presupuesto 90–130w`);
      }
      if (report.wordStats.slide22MissingRubricOrObjectives > 0) {
        failures.push(`[${report.file}] ${report.wordStats.slide22MissingRubricOrObjectives} slides 2/2 sin criterios de evaluación/objetivos`);
      }
      if (report.repeatedMisconceptions.length > 0) {
        failures.push(`[${report.file}] Errores comunes repetidos > 2 veces (máx=${report.repeatedMisconceptions[0]!.count})`);
      }
    }
  }

  return {
    dir: targetDir,
    passed: failures.length === 0,
    failures,
    warnings,
    pdfs: pdfReports,
    pptx: pptxReports,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--dir');
  if (dirIdx === -1 || !args[dirIdx + 1]) {
    console.error('Uso: node scripts/qa-sacrint-materials.ts --dir "<ruta>" [--json] [--strict]');
    process.exit(2);
  }
  const targetDir = path.resolve(args[dirIdx + 1]);
  const asJson = args.includes('--json');
  const strict = args.includes('--strict');
  const summary = await runMaterialsQa(targetDir, { strict });

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n=== QA SACRINT MATERIALS: ${summary.dir} ===`);
    for (const p of summary.pdfs) {
      const fCount = Object.values(p.findings).reduce((a, b) => a + b.length, 0);
      console.log(`PDF  ${p.file}: ${p.pages}p | chars=${p.totalChars} (avg ${p.avgCharsPerPage}/p) | rasterLowText=${p.fullPageRasterCount} | findings=${fCount}`);
    }
    for (const x of summary.pptx) {
      console.log(`PPTX ${x.file}: ${x.slideCount}s | collisions=${x.collisions.length} | wrapNone=${x.wrapNoneShapes} | 1/2avg=${x.wordStats.slide12Avg}w (>200:${x.wordStats.slide12Over200}) | 2/2avg=${x.wordStats.slide22Avg}w (missEval:${x.wordStats.slide22MissingRubricOrObjectives}) | repeatErrComun=${x.repeatedMisconceptions.length}`);
    }
    if (summary.failures.length > 0) {
      console.log('\nFALLOS CRÍTICOS:');
      for (const f of summary.failures) console.log('  - ' + f);
    } else {
      console.log('\nRESULTADO: TODOS LOS CONTROLES PASARON.');
    }
  }
  process.exit(summary.passed ? 0 : 1);
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]).endsWith('qa-sacrint-materials.ts');
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
