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

const FUTURE_TITLE_RE = /\b(?:Aprender[áa]s|Evaluar[áa]s|Integrar[áa]s|Optimizar[áa]s|Representar[áa]s|Dominar[áa]s|Identificar[áa]s|Resolver[áa]s|Aplicar[áa]s|Visualizar[áa]s|Calcular[áa]s|Construir[áa]s|Comprender[áa]s|Clasificar[áa]s|Medir[áa]s|Analizar[áa]s|Recuperar[áa]s|Presentar[áa]s|Delimitar[áa]s|Validar[áa]s|Consolidar[áa]s|Vas\s+a\s+[a-záéíóúñ]+r)\b/i;

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
    ['malformed_currency', /\$\d{1,3},\$\d/],
    ['literal_x_v', /\bx_v\b/],
    ['raw_not_equal', /!=/],
    ['misconception_vas_a', /\bVas\s+a\s+(?!aprender\b)[a-záéíóúüñ]+:/i],
    ['literal_ok_marker', /\[OK\]/],
    ['raw_markdown_table', /\|[\s]*:?-{3,}:?[\s]*\|/],
    ['generic_figure_caption', /Representaci[oó]n\s+gr[áa]fica\s+conceptual\s+y\s+espacio/i],
    ['semaforo_truncated_word', /\b(?:Identi|Expl|Optimi|Compr|Clasif|Analiz)\s+con\b/i],
    ['meta_conclusion_instruction', /(?:Conclusi[oó]n\s*:\s*|^[ \t]*)Redacta\s+la\s+conclusi[oó]n\s+t[ée]cnica\s*\./im],
    ['exercise_dot_colon', /\bEjercicio\s+\d+\.\s*:/],
    ['generic_ej6_report', /Reporte\s+t[ée]cnico\s+justificando\s+que\s+el\s+terreno\s+propuesto\s+es\s+geom[ée]tricamente\s+imposible/i],
    ['orphan_paso_number', /(?:^|\n)[ \t]*\d+\.\s*\n+[ \t]*Paso\s+\d+\s*:/i],
    ['truncated_quadratic_formula', /(?:MODELO Y F[ÓO]RMULA CENTRAL|F[ÓO]RMULA CENTRAL)\s*\n?\s*c\s*=\s*0\b/i],
    ['truncated_angles_formula', /(?:^|[:•])\s*\(2x\s*\+\s*20\)\s*=\s*180/i],
    ['latex_monomial_leak', /\$[+-]?\d+(?:[.,]\d+)?[a-zA-Zα-ωΑ-Ω²³₀-₉]+(?:\^[a-zA-Z0-9]+)?\$/],
    ['literal_sqrt_notation', /\b(?:raiz|sqrt)\s*\(/i],
    ['raw_subscript_formula', /\bM_\((?:simple|compuesto)\)/i],
    [
      'dangling_question',
      /¿[^?]{0,90}(?<![\p{L}\p{N}_])(?:entre|de|del|la|el|los|las|un|una|que|por|para|con|en|y|o|sus?)\s*\?/iu,
    ],
    [
      'incomplete_concept_ending',
      /\b(?:a los que llamamos|valor desconocido llamado|expresado en el lado|miembro derecho para)\.\s*(?:\n|$)|(?:equivalencia|expresiones|miembros|valores)[^.]{0,50}\bentre dos\.\s*(?:\n|$)/i,
    ],
  ];

  for (const [key, re] of rules) {
    const hits = collectPatternMatches(text, re);
    if (hits.length > 0) findings[key] = hits;
  }
  const genericActivityHits = collectPatternMatches(
    text,
    /Resuelve la situación y justifica tu respuesta\./gi,
    5
  );
  if (genericActivityHits.length > 2) {
    findings['generic_activity_filler'] = genericActivityHits;
  }
  return findings;
}

function appendPdfSemanticFindings(
  fileName: string,
  fullText: string,
  pageTexts: string[],
  findings: Record<string, string[]>
): void {
  const pushFinding = (key: string, msg: string) => {
    findings[key] = (findings[key] || []).concat(msg).slice(0, 12);
  };

  if (/^0[3457]_/.test(fileName)) {
    const p1Matches = [...fullText.matchAll(/P[áa]gina\s+1\s+de\s+(\d+)/gi)];
    if (p1Matches.some((m) => m[1] === '1') || p1Matches.length > 1) {
      pushFinding('fragmented_compiled_footer', `${fileName}: ${p1Matches.length} pies "Página 1 de N" detectados`);
    }
  }

  if (fileName.startsWith('03_')) {
    const repHits = collectPatternMatches(fullText, /Recuperar insumos previos y organizar mesa de trabajo colaborativa/gi, 100);
    if (repHits.length > 1) {
      pushFinding('repeated_lesson_opening', `${repHits.length} repeticiones de apertura genérica`);
    }
    pageTexts.forEach((pTxt, idx) => {
      const sesM = /Sesi[oó]n\s*(\d+)\s*[:·\-–—]/i.exec(pTxt);
      const sesNum = sesM ? Number(sesM[1]) : null;
      if (sesNum !== null && sesNum !== 4 && /(?:"|·\s*)Sesi[oó]n\s*4\s*:/i.test(pTxt)) {
        pushFinding('cross_session_4_leak', `Pág. ${idx + 1} (Sesión ${sesNum}) cita "Sesión 4:"`);
      }
      const planHdr = /Plan\s+de\s+Clase:\s*Sesi[oó]n\s*\d+\s*·[^|]{4,140}/i.exec(pTxt);
      if (planHdr && FUTURE_TITLE_RE.test(planHdr[0])) {
        pushFinding('future_tense_heading', `Pág. ${idx + 1}: "${planHdr[0].slice(0, 80)}"`);
      }
    });
    const titleFieldHits = collectPatternMatches(
      fullText,
      new RegExp(`(?:T[ií]tulo\\s+de\\s+la\\s+Sesi[oó]n|Plan\\s+de\\s+Clase\\s*:\\s*Sesi[oó]n\\s*\\d+\\s*·)\\s*[^\\n]*${FUTURE_TITLE_RE.source}[^\\n]*`, 'gi')
    );
    for (const h of titleFieldHits) pushFinding('future_tense_heading', h);
  }

  if (fileName.startsWith('04_')) {
    const lines = fullText.split('\n');
    const orphanCount = lines.filter((l) => /^\s*[1-9]\d*\.\s*$/.test(l)).length;
    if (orphanCount > 0) {
      pushFinding('orphan_numbered_lines', `${orphanCount} líneas huérfanas con número solo (ej. "1.")`);
    }
    if (/x\s*=\s*12\.5\s*metros/i.test(fullText) && !/312\.5/.test(fullText)) {
      pushFinding('missing_vertex_max_area', 'Ejercicio con vértice x = 12.5 m omite Área máxima = 312.5 m²');
    }
  }

  if (fileName.startsWith('05_')) {
    const headHits = collectPatternMatches(
      fullText,
      new RegExp(`FICHA DE TRABAJO\\s*·\\s*SESI[ÓO]N\\s*\\d+\\s*:[^\\n]*${FUTURE_TITLE_RE.source}`, 'gi')
    );
    for (const h of headHits) pushFinding('future_tense_heading', h);
  }

  if (fileName.startsWith('09_')) {
    pageTexts.forEach((pTxt, idx) => {
      if (/\bV\s*\(\s*2\.5\s*,\s*\)/.test(pTxt)) {
        pushFinding('incomplete_vertex_pair', `Pág. ${idx + 1}: vértice incompleto V(2.5, )`);
      }
      if (/y\s*=\s*-x(?:²|\^2)/i.test(pTxt) && /\b1x(?:²|\^2)/i.test(pTxt)) {
        pushFinding('negative_quadratic_sign_bug', `Pág. ${idx + 1}: -x² impreso como 1x²`);
      }
      if (/Concepto\s+Clave/i.test(pTxt)) {
        const headerPart = pTxt.split('\n').slice(0, 8).join(' ');
        if (FUTURE_TITLE_RE.test(headerPart)) {
          pushFinding('future_tense_heading', `Pág. ${idx + 1}: título en futuro`);
        }
      }
    });
    // Detectar títulos duplicados entre páginas de infografía (H1 repetidos)
    const h1Titles: string[] = [];
    for (const pTxt of pageTexts) {
      const firstMeaningfulLine = pTxt.split('\n').map((l) => l.trim()).find((l) => l.length > 5 && l.length < 100);
      if (firstMeaningfulLine) h1Titles.push(firstMeaningfulLine.toLowerCase().replace(/\s+/g, ' ').trim());
    }
    const titleCounts = new Map<string, number>();
    for (const t of h1Titles) titleCounts.set(t, (titleCounts.get(t) ?? 0) + 1);
    for (const [title, count] of titleCounts) {
      if (count > 1) pushFinding('duplicate_infographic_title', `"${title.slice(0, 60)}" aparece ${count} veces`);
    }
  }
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
  const pageTexts: string[] = [];
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
      const pageStr = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ');
      pageTexts.push(pageStr);
      const pageTextLen = pageStr.replace(/\s+/g, '').length;
      if (fileName.startsWith('09_') && pageImgs >= 1 && pageTextLen < 120) {
        fullPageRasterCount++;
      }
      page.cleanup();
    }
    await (pdfDoc as unknown as { destroy?: () => Promise<void> }).destroy?.();
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
  appendPdfSemanticFindings(fileName, text, pageTexts, findings);

  const report: PdfQaReport = {
    file: fileName,
    pages,
    totalChars: text.replace(/\s+/g, '').length,
    wordCount: normalizedWords,
    avgCharsPerPage: pages > 0 ? Math.round(text.replace(/\s+/g, '').length / pages) : 0,
    fullPageRasterCount,
    totalImagePaintOps,
    findings,
  };
  Object.defineProperty(report, '_text', { value: text, enumerable: false });
  return report;
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
  const documentText: string[] = [];
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
    documentText.push(allSlideText);
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

    const pushSlideFinding = (key: string, detail: string) => {
      findings[key] = (findings[key] || []).concat(`S${slideNumber}: ${detail}`).slice(0, 15);
    };

    // Semantic checks on PIZARRÓN DOCENTE (1/2) & (2/2)
    if (allSlideText.includes('PIZARRÓN DOCENTE')) {
      const titleBox = shapes.find((s) => s.hasText && s.y >= 0.45 && s.y <= 1.2 && s.x < 9.5 && s.fontSizePt >= 16);
      if (titleBox && FUTURE_TITLE_RE.test(titleBox.text)) {
        pushSlideFinding('future_tense_slide_title', titleBox.text.slice(0, 80));
      }
    }

    if (allSlideText.includes('PIZARRÓN DOCENTE (1/2)')) {
      const cnHeader = shapes.find(
        (s) => s.hasText && /^CONOCIMIENTO NUEVO$/i.test(s.text) && s.x >= 0.3 && s.x <= 1.2 && s.y >= 1.0 && s.y <= 2.5
      );
      const cnBox = cnHeader
        ? shapes.find(
            (s) =>
              s.hasText &&
              s.x >= cnHeader.x - 0.1 &&
              s.x <= cnHeader.x + 1.0 &&
              s.y > cnHeader.y &&
              s.y <= cnHeader.y + 0.5 &&
              !/^CONOCIMIENTO NUEVO|EJEMPLO|ERROR COM[UÚ]N$/i.test(s.text)
          )
        : undefined;
      if (!cnBox || cnBox.text.replace(/\s+/g, ' ').trim().length < 55) {
        pushSlideFinding('weak_conocimiento_nuevo', cnBox ? cnBox.text : 'sin cuerpo de concepto');
      }
      const conclBox = shapes.find((s) => s.hasText && /Conclusi[oó]n\s*:/i.test(s.text));
      if (conclBox) {
        const after = conclBox.text.replace(/^[\s\S]*?Conclusi[oó]n\s*:\s*/i, '').trim();
        if (
          after.length < 15 ||
          /Redacta la conclusi[oó]n|F[oó]rmula\/valor pendiente|Por determinar|(?:Analizar|Evaluar|Revisar|Comprobar)\s+la\s+coherencia\s+del\s+resultado/i.test(after)
        ) {
          pushSlideFinding('empty_or_meta_conclusion', conclBox.text.slice(0, 80));
        }
      }
      if (/3\s*a[ñn]os/i.test(allSlideText) && /\bsemestral\b/i.test(allSlideText) && /\b6\s*per[íi]odos\b/i.test(allSlideText)) {
        pushSlideFinding('exp_period_rate_mismatch', '3 años semestral inconsistente con 6 períodos');
      }
    }

    if (allSlideText.includes('PIZARRÓN DOCENTE (2/2)')) {
      const actHeaders = shapes
        .filter((s) => s.hasText && s.x < 5.5 && s.y >= 1.8 && s.y <= 5.0 && /^ACTIVIDAD\s*[12]$/i.test(s.text))
        .sort((a, b) => a.y - b.y);
      for (let aIdx = 0; aIdx < actHeaders.length; aIdx++) {
        const hdr = actHeaders[aIdx]!;
        const bodyBox = shapes.find(
          (s) =>
            s.hasText &&
            s.x < 5.5 &&
            s.y > hdr.y &&
            s.y <= hdr.y + 0.35 &&
            !/^ACTIVIDAD\s*[12]$|^Pista:/i.test(s.text)
        );
        const txt = bodyBox?.text.trim() ?? '';
        const hasTaskOrQuestion =
          txt.includes('?') ||
          /\b(?:resuelve|calcula|determina|encuentra|halla|plantea|construye|verifica|comprueba|analiza|transforma|convierte|grafica|traza|dibuja|explica|revisa|identifica|modela|estima|proyecta|dise[ñn]a|elabora|aplica|eval[uú]a|indica|compara|justifica|formula|se\u00F1ala|localiza|completa|escribe|obt[e\u00E9]n|delimita)\b/i.test(
            txt
          );
        const isTruncated =
          txt.length < 55 ||
          !hasTaskOrQuestion ||
          (txt.length < 72 && !txt.includes('=') && !txt.includes('?')) ||
          txt.endsWith('...') ||
          /(?:,|\b(?:de|del|en|para|con|la|el|y|o|un|una|que|su|sus|si))\s*$/i.test(txt);
        if (isTruncated) {
          pushSlideFinding('weak_or_truncated_activity', `Act ${aIdx + 1} (${txt.length}c): "${txt.slice(0, 90)}"`);
        }
      }
      const appHeader = shapes.find((s) => s.hasText && s.x >= 5.0 && /^APLICACI[ÓO]N REAL$/i.test(s.text));
      const appBody = appHeader
        ? shapes.find((s) => s.hasText && s.x >= appHeader.x - 0.1 && s.y > appHeader.y && s.y <= appHeader.y + 0.35)
        : undefined;
      if (appBody && appBody.text.trim().length < 36) {
        pushSlideFinding('weak_or_truncated_activity', `Aplicación corta (${appBody.text.trim().length}c): "${appBody.text.trim()}"`);
      }
      const hintBoxes = shapes
        .filter((s) => s.hasText && s.x < 5.5 && s.y >= 2.3 && s.y <= 5.2 && /^Pista:/i.test(s.text))
        .map((s) => s.text.replace(/^Pista:\s*/i, '').trim().toLowerCase());
      if (hintBoxes.length >= 2 && hintBoxes[0] === hintBoxes[1]) {
        pushSlideFinding('duplicate_activity_hint', hintBoxes[0]!.slice(0, 80));
      }
      for (const h of hintBoxes) {
        if (/^luego,\s*plantea\s+una\s+ecuaci[oó]n\.?$/i.test(h) || h.length < 18) {
          pushSlideFinding('weak_or_truncated_activity', `Pista débil: "${h}"`);
        }
      }
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

  const report: PptxQaReport = {
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
  Object.defineProperty(report, '_text', { value: documentText.join('\n'), enumerable: false });
  return report;
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
      if (report.file.startsWith('08_') && report.wordStats.slide12Avg > 135) {
        failures.push(
          `[${report.file}] Promedio 1/2 (${report.wordStats.slide12Avg}w) excede el presupuesto estricto 90–130w`
        );
      } else if (options?.strict && report.wordStats.slide12Avg > 140) {
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

  if (options?.strict) {
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const ngrams = (value: string, n: number) => {
      const words = normalize(value).split(' ').filter(Boolean);
      const out = new Set<string>();
      for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(' '));
      return out;
    };
    const book = pdfReports.find((report) => report.file.startsWith('06_')) as
      | (PdfQaReport & { _text?: string })
      | undefined;
    if (book?._text) {
      const bookGrams = ngrams(book._text, 6);
      const compare = (file: string, text: string | undefined, label: string) => {
        if (!text || bookGrams.size === 0) return;
        const grams = ngrams(text, 6);
        if (grams.size === 0) return;
        let shared = 0;
        for (const gram of grams) if (bookGrams.has(gram)) shared++;
        const ratio = shared / grams.size;
        if (ratio > 0.2) {
          failures.push(
            `[${file}] Solapamiento de 6-gramas con el libro 06 (${label}): ${(ratio * 100).toFixed(1)}% (máx. 20%)`
          );
        }
      };
      for (const pdf of pdfReports) {
        if (pdf.file.startsWith('09_')) compare(pdf.file, (pdf as PdfQaReport & { _text?: string })._text, 'infografía');
      }
      for (const pptx of pptxReports) {
        if (pptx.file.startsWith('08_')) compare(pptx.file, (pptx as PptxQaReport & { _text?: string })._text, 'presentación');
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
