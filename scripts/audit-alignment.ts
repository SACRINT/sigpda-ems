/**
 * audit-alignment.ts — Auditoría COMPLETA de alineación documentos generados ↔ fuente BD.
 *
 * Cubre la cadena entera de una planeación:
 *   1. Plan de clase PDF        (generatePlanningPDF)         ↔ workbooks_json.sessionPlans
 *   2. Extras PDF               (generateExtraPDF)            ↔ planning_extras.content_text
 *   3. Extras DOCX              (buildExtraDocx)              ↔ planning_extras.content_text
 *   4. Libro de bloque PDF      (renderWorkbookToPdf)         ↔ workbooks_json sessionPlans
 *   5. Libro de bloque DOCX     (renderWorkbookToDocx)        ↔ workbooks_json sessionPlans
 *   6. Infografías              (buildInfographic)            ↔ viewBox + export PNG
 *
 * Chequeos: paridad de contenido (fold normalizado + fallback sin espacios para cortes),
 * páginas casi vacías (<600 chars), tokens/basura literales, identidad escolar y
 * desborde de texto en infografías. Reporte en scripts/output/audit-alignment/report.md
 *
 * Uso:
 *   npx tsx scripts/audit-alignment.ts                       (planning con más extras)
 *   npx tsx scripts/audit-alignment.ts <planningId>          (planeación específica)
 *   npx tsx scripts/audit-alignment.ts [planningId] --fast   (omite libro de bloque)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import type { Planning } from '../src/types/planning';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';
import { stripMaterialTokens } from '../src/lib/materials/material-tokens';
import { generateExtraPDF } from '../src/lib/pdf-extra-generator';
import { buildExtraDocx } from '../src/lib/docx-helpers';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val && !process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* opcional */
  }
}

/**
 * Quita prefijos markdown de línea (citas, listas, numeración, almohadillas) que el
 * renderer no imprime literalmente.
 */
const stripMdPrefix = (s: string): string =>
  s.replace(/^[\s>|•*\-+#]+/, '').replace(/^\d+[.)]\s+/, '');

/**
 * Fold normalizado agresivo: solo letras/números/espacios (mata `·`, `—`, paréntesis,
 * comillas y artefactos de pdf-parse de forma SIMÉTRICA en fuente y extraído).
 */
const fold = (s: string): string =>
  stripMdPrefix(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type Level = 'OK' | 'WARN' | 'FAIL';
interface Finding { level: Level; section: string; msg: string }
const findings: Finding[] = [];
const seenMsgs = new Set<string>();
let dupFindings = 0;
const add = (level: Level, section: string, msg: string) => {
  const key = `${level}|${section}|${msg}`;
  if (seenMsgs.has(key)) {
    dupFindings++;
    return;
  }
  seenMsgs.add(key);
  findings.push({ level, section, msg });
};

const GARBAGE_LITERAL = /####?[^#]/;
// TODO/undefined/NaN solo son basura si NO existen literal en la fuente (evita "todo" en minúsculas)
const GARBAGE_WORDS: { kw: string; re: RegExp }[] = [
  { kw: 'TODO', re: /\bTODO\b/ },
  { kw: 'undefined', re: /\bundefined\b/ },
  { kw: 'NaN', re: /\bNaN\b/ },
];

function checkGarbage(section: string, extracted: string, source = ''): void {
  if (GARBAGE_LITERAL.test(extracted)) {
    const m = extracted.match(GARBAGE_LITERAL);
    add('FAIL', section, `encabezado markdown literal impreso: "${m?.[0]}"`);
  }
  // Los tokens [[material:...]] son legítimos en la fuente, pero el documento DEBE
  // imprimir la etiqueta humana (stripMaterialTokens) — siempre es FAIL si aparecen.
  const mat = extracted.match(/\[\[material:/);
  if (mat) {
    const i = mat.index ?? 0;
    add('FAIL', section, `token [[material:...]] impreso sin strippear → ${JSON.stringify(extracted.slice(Math.max(0, i - 60), i + 80))}`);
  }
  for (const { kw, re } of GARBAGE_WORDS) {
    if (re.test(extracted) && !re.test(source)) {
      const m = extracted.match(re);
      add('FAIL', section, `basura literal en el documento (no existe en la fuente): "${kw}" → ${JSON.stringify(extracted.slice(Math.max(0, (m?.index ?? 0) - 60), (m?.index ?? 0) + 60))}`);
    }
  }
}

/** Paridad: cada párrafo fuente (>= minChars tras fold) debe hallarse en el texto extraído. */
function checkParity(
  section: string,
  source: string,
  extracted: string,
  opts: { minChars?: number; probeLen?: number; label?: string; materialTokens?: boolean } = {}
): { probes: number; missing: string[] } {
  const minChars = opts.minChars ?? 40;
  const probeLen = opts.probeLen ?? 50;
  const src = opts.materialTokens ? stripMaterialTokens(source) : source;
  const hay = fold(extracted);
  const hayNoSpace = hay.replace(/ /g, '');
  const missing: string[] = [];
  let probes = 0;
  for (const rawLine of src.split('\n')) {
    // Tablas markdown: verificar celda por celda (el renderer imprime celdas, no la fila con pipes)
    const cells = rawLine.includes('|')
      ? rawLine.split('|').map((c) => c.trim()).filter((c) => c.length > 0)
      : [rawLine];
    for (const cell of cells) {
      const line = fold(cell);
      if (line.length < minChars) continue;
      probes++;
      const probe = line.slice(0, probeLen);
      if (hay.includes(probe)) continue;
      if (hayNoSpace.includes(probe.replace(/ /g, ''))) continue;
      // 3er nivel: pdf-parse entremezcla columnas de tablas que cruzan salto de página;
      // si TODOS los tokens significativos del probe existen (orden libre), se da por bueno.
      const tokens = probe.split(' ').filter((t) => t.length >= 5);
      if (tokens.length > 0 && tokens.every((t) => hay.includes(t))) continue;
      missing.push(cell.trim().slice(0, 90));
    }
  }
  if (missing.length > 0) {
    add('FAIL', section, `${missing.length}/${probes} párrafos de la fuente NO aparecen en el documento`);
    for (const m of missing.slice(0, 5)) add('FAIL', section, `   ↳ falta: ${m}`);
    if (missing.length > 5) add('FAIL', section, `   ↳ … y ${missing.length - 5} más`);
  }
  return { probes, missing };
}

async function pdfText(buf: Buffer): Promise<{ pages: { num: number; text: string }[]; text: string }> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const r = await parser.getText();
    return { pages: r.pages, text: r.text };
  } finally {
    await parser.destroy();
  }
}

const SIGNATURE_PAGE = /(firma|sello|validaci[oó]n|autorizaci[oó]n|presidente de academia|direcci[oó]n del plantel)/i;

function checkBlankPages(section: string, pages: { num: number; text: string }[]): void {
  // Páginas de firmas/institucionales y portadas tienen poco texto por diseño
  const isBenign = (p: { num: number; text: string }, i: number) =>
    i === 0 || i === pages.length - 1 || SIGNATURE_PAGE.test(p.text);
  const blanks = pages.filter((p, i) => p.text.replace(/\s/g, '').length < 600 && !isBenign(p, i));
  const trulyEmpty = pages.filter((p) => p.text.replace(/\s/g, '').length < 100);
  if (trulyEmpty.length > 0) {
    add('FAIL', section, `${trulyEmpty.length} página(s) VACÍA(s) de verdad: pág ${trulyEmpty.map((b) => b.num).join(', ')}`);
  } else if (blanks.length > 0) {
    add('WARN', section, `${blanks.length}/${pages.length} página(s) con poco texto: pág ${blanks.map((b) => b.num).join(', ')}`);
  } else {
    add('OK', section, `${pages.length} página(s), ninguna casi vacía`);
  }
}

function toPlanning(raw: Record<string, unknown>): Planning {
  const cj = raw.content_json as Record<string, unknown> | null;
  return {
    id: raw.id as string,
    teacherId: raw.teacher_id as string,
    uacName: raw.uac_name as string,
    semester: raw.semester as number,
    component: raw.component as string,
    curriculumName: (raw.curriculum_name as string) || '',
    paecContext: (raw.paec_context as string) || '',
    extractedData: raw.extracted_data as Planning['extractedData'],
    contentJson: cj as Planning['contentJson'],
    metodologiaActiva:
      (raw.metodologia_activa as string | null) ||
      ((cj?.sectionI as Record<string, unknown> | undefined)?.metodologiaActiva as string | undefined),
    status: raw.status as Planning['status'],
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL no disponible.');
    process.exit(1);
  }
  const sql = neon(url);
  const args = process.argv.slice(2);
  const fast = args.includes('--fast');
  const planningIdArg = args.find((a) => !a.startsWith('--'));

  // ── Planeación objetivo ──
  let planningId = planningIdArg;
  if (!planningId) {
    const t = (await sql`
      SELECT planning_id FROM planning_extras GROUP BY planning_id ORDER BY COUNT(*) DESC LIMIT 1
    `) as unknown as { planning_id: string }[];
    planningId = t[0]?.planning_id;
    if (!planningId) {
      console.error('❌ No hay planning_extras en la BD.');
      process.exit(1);
    }
  }

  const planRows = (await sql`SELECT * FROM plannings WHERE id = ${planningId}::uuid LIMIT 1`) as unknown as Record<
    string,
    unknown
  >[];
  if (!planRows || planRows.length === 0) {
    console.error(`❌ Planeación ${planningId} no encontrada.`);
    process.exit(1);
  }
  const rawPlan = planRows[0];
  const planning = toPlanning(rawPlan);
  const workbooks = (rawPlan.workbooks_json ?? {}) as Record<
    string,
    { current?: ActiveWorkTextbook } | undefined
  >;
  const component = ((rawPlan.content_json as Record<string, unknown> | null)?.sectionI as
    | Record<string, unknown>
    | undefined)?.component as string | undefined;

  console.log(`\n══ AUDITORÍA DE ALINEACIÓN ══`);
  console.log(`planeación: ${planningId}`);
  console.log(`UAC: ${planning.uacName} · semestre ${planning.semester} · componente ${planning.component}`);

  const extras = (await sql`
    SELECT e.id, e.type, e.title, e.content_text, e.key_index, e.created_at
    FROM planning_extras e
    WHERE e.planning_id = ${planningId}
    ORDER BY e.type, e.key_index, e.created_at
  `) as unknown as { id: string; type: string; title: string | null; content_text: string | null }[];
  console.log(`extras: ${extras.length}`);

  const outDir = join(process.cwd(), 'scripts', 'output', 'audit-alignment');
  mkdirSync(outDir, { recursive: true });

  // Enunciados/pistas del libro (fuente workbooks_json) — la paridad contra los
  // "Planes de Clase" aplica a los extras tipo lesson_plan (mismo nombre, otro documento).
  const enunciadosAll = new Set<string>();
  const pistasAll = new Set<string>();
  for (const [, v] of Object.entries(workbooks)) {
    if (!v?.current) continue;
    for (const m of v.current.missions ?? []) {
      for (const sp of m.sessionPlans ?? []) {
        for (const pr of sp.practica ?? []) {
          if ((pr.enunciado ?? '').length >= 30) enunciadosAll.add(pr.enunciado);
          if ((pr.pista ?? '').length >= 20) pistasAll.add(pr.pista);
        }
      }
    }
  }

  // ── 1. Plan de clase PDF (instrumento institucional MCCEMS — no imprime prácticas) ──
  console.log('\n── 1. Plan de clase (PDF institucional) ──');
  try {
    const { generatePlanningPDF } = await import('../src/lib/planning-pdf-renderer');
    const doc = await generatePlanningPDF(planning);
    const buf = Buffer.from(doc.output('arraybuffer'));
    writeFileSync(join(outDir, 'plan-de-clase.pdf'), buf);
    const { pages, text } = await pdfText(buf);
    const contentJson = (rawPlan.content_json ?? {}) as Record<string, Record<string, unknown> | undefined>;
    checkGarbage('Plan de clase PDF', text, JSON.stringify(rawPlan.content_json ?? ''));
    checkBlankPages('Plan de clase PDF', pages);

    const planText = fold(text);
    if (rawPlan.uac_name && !planText.includes(fold(rawPlan.uac_name as string))) {
      add('FAIL', 'Plan de clase PDF', `UAC "${rawPlan.uac_name}" no aparece en el documento`);
    } else {
      add('OK', 'Plan de clase PDF', 'UAC presente (identidad del documento)');
    }
    // Identidad escolar (Sesión 1): CCT y plantel del Paso 3 / catálogo
    const s1 = contentJson?.sectionI;
    const cct = (s1?.cct as string | undefined) ?? undefined;
    if (cct && !planText.includes(fold(cct))) {
      add('FAIL', 'Plan de clase PDF', `CCT "${cct}" no aparece en el documento`);
    } else if (cct) {
      add('OK', 'Plan de clase PDF', `CCT ${cct} presente`);
    }
    const school = (s1?.schoolName as string | undefined) ?? undefined;
    if (school && !planText.includes(fold(school))) {
      add('FAIL', 'Plan de clase PDF', `plantel "${school}" no aparece en el documento`);
    } else if (school) {
      add('OK', 'Plan de clase PDF', `plantel "${school}" presente`);
    }
    console.log(`   ${pages.length} páginas / ${text.length} chars → scripts/output/audit-alignment/plan-de-clase.pdf`);
  } catch (err) {
    add('FAIL', 'Plan de clase PDF', `error renderizando: ${(err as Error).message}`);
    console.error('   ❌', (err as Error).message);
  }

  /**
   * Paridad libro ↔ un extra lesson_plan: cada extra cubre SOLO su sesión, así que por
   * documento se exige "al menos un enunciado del libro" (extra desconectado si 0) y la
   * cobertura total se evalúa con la unión de todos los lesson_plan al final.
   */
  const countPractice = (extracted: string): { found: number; missing: string[] } => {
    const hay = fold(extracted);
    const hayNS = hay.replace(/ /g, '');
    const missing: string[] = [];
    let found = 0;
    for (const e of enunciadosAll) {
      const probe = fold(stripMaterialTokens(e)).slice(0, 60);
      if (hay.includes(probe) || hayNS.includes(probe.replace(/ /g, ''))) found++;
      else missing.push(probe.slice(0, 70));
    }
    for (const p of pistasAll) {
      const probe = fold(stripMaterialTokens(p)).slice(0, 40);
      if (hay.includes(probe) || hayNS.includes(probe.replace(/ /g, ''))) found++;
      else missing.push(probe.slice(0, 70));
    }
    return { found, missing };
  };
  const checkPracticeParity = (section: string, extracted: string) => {
    if (enunciadosAll.size === 0) return;
    const { found } = countPractice(extracted);
    if (found === 0) {
      add('FAIL', section, `el extra NO contiene NINGÚN enunciado/pista del libro (${enunciadosAll.size} en la fuente) — desconectado de workbooks_json`);
    } else {
      add('OK', section, `${found} enunciado(s)/pista(s) del libro presentes`);
    }
  };
  const lessonPlanTexts: string[] = [];

  // ── 2/3. Extras PDF + DOCX ──
  let pdfTotal = 0;
  let docxTotal = 0;
  for (const [i, row] of extras.entries()) {
    const content = row.content_text ?? '';
    const sectionPdf = `Extra PDF [${row.type}] ${row.id.slice(0, 8)}`;
    const sectionDocx = `Extra DOCX [${row.type}] ${row.id.slice(0, 8)}`;
    console.log(`── ${4 + i}. Extra [${row.type}] ${row.title ?? ''} (${i + 1}/${extras.length}) ──`);

    if (content.length === 0) {
      add('WARN', sectionPdf, `extra ${row.id} sin content_text`);
      continue;
    }

    // PDF
    try {
      const doc = generateExtraPDF({ id: row.id, title: row.title || 'Recurso Extra', type: row.type, content_text: content });
      const buf = Buffer.from(doc.output('arraybuffer'));
      const fname = `${row.type}-${row.id}.pdf`;
      writeFileSync(join(outDir, fname), buf);
      const { pages, text } = await pdfText(buf);
      pdfTotal += pages.length;
      checkGarbage(sectionPdf, text, content);
      checkBlankPages(sectionPdf, pages);
      const { probes, missing } = checkParity(sectionPdf, content, text, { materialTokens: true });
      if (missing.length === 0 && probes > 0) add('OK', sectionPdf, `${probes} párrafos alineados con el markdown`);
      if (row.type === 'lesson_plan') {
        checkPracticeParity(sectionPdf, text);
        lessonPlanTexts.push(text);
      }
      if (/…/.test(text) && !/…/.test(content)) {
        add('WARN', sectionPdf, 'elipsis "…" en el PDF que no existe en la fuente (posible truncado de layout)');
      }
    } catch (err) {
      add('FAIL', sectionPdf, `error renderizando: ${(err as Error).message}`);
    }

    // DOCX
    try {
      const buf = await buildExtraDocx({ type: row.type, title: row.title || 'Recurso Extra', content_text: content });
      const fname = `${row.type}-${row.id}.docx`;
      writeFileSync(join(outDir, fname), buf);
      const { value: docxText } = await mammoth.extractRawText({ buffer: buf });
      docxTotal += docxText.length;
      checkGarbage(sectionDocx, docxText, content);
      if (docxText.replace(/\s/g, '').length < 200) {
        add('FAIL', sectionDocx, 'documento prácticamente vacío');
      }
      const { probes, missing } = checkParity(sectionDocx, content, docxText, { materialTokens: true });
      if (missing.length === 0 && probes > 0) add('OK', sectionDocx, `${probes} párrafos alineados con el markdown`);
      if (row.type === 'lesson_plan') checkPracticeParity(sectionDocx, docxText);
    } catch (err) {
      add('FAIL', sectionDocx, `error renderizando: ${(err as Error).message}`);
    }
  }

  // ── Cobertura global: unión de todos los lesson_plan vs workbooks_json ──
  if (lessonPlanTexts.length > 0 && enunciadosAll.size > 0) {
    const union = lessonPlanTexts.join('\n');
    const { found } = countPractice(union);
    const total = enunciadosAll.size + pistasAll.size;
    const pct = Math.round((found / total) * 100);
    if (found === total) {
      add('OK', 'Paridad libro ↔ lesson_plan (unión)', `${found}/${total} enunciados y pistas cubiertos por los ${lessonPlanTexts.length} planes de clase`);
    } else {
      add('WARN', 'Paridad libro ↔ lesson_plan (unión)', `${found}/${total} (${pct}%) enunciados/pistas del libro presentes en la unión de los ${lessonPlanTexts.length} planes — las sesiones sin extra no son cubiertas (la validación por sesión es verify-lesson-plans-parity.ts)`);
    }
  } else if (enunciadosAll.size > 0 && lessonPlanTexts.length === 0) {
    add('WARN', 'Paridad libro ↔ lesson_plan (unión)', 'la planeación no tiene extras tipo lesson_plan para evaluar');
  }

  // ── 4/5. Libro de bloque PDF + DOCX ──
  if (!fast) {
    const blockKeys = Object.keys(workbooks).filter((k) => workbooks[k]?.current);
    if (blockKeys.length === 0) {
      add('WARN', 'Libro de bloque', 'la planeación no tiene workbooks_json con bloque vigente (omitido)');
    } else {
      const blockKey = blockKeys[0];
      const workbook = workbooks[blockKey]!.current!;
      console.log(`── Libro de bloque ${blockKey} ──`);
      try {
        const { renderWorkbookToPdf } = await import('../src/lib/pdf-workbook-renderer');
        const buf = await renderWorkbookToPdf(workbook, planning);
        writeFileSync(join(outDir, `libro-${blockKey}.pdf`), buf);
        const { pages, text } = await pdfText(buf);
        checkGarbage(`Libro PDF ${blockKey}`, text, JSON.stringify(workbook));
        checkBlankPages(`Libro PDF ${blockKey}`, pages);
        const enunciados: string[] = [];
        for (const m of workbook.missions ?? []) {
          for (const sp of m.sessionPlans ?? []) {
            for (const pr of sp.practica ?? []) {
              if ((pr.enunciado ?? '').length >= 30) enunciados.push(pr.enunciado);
            }
          }
        }
        const hay = fold(text);
        const hayNS = hay.replace(/ /g, '');
        let miss = 0;
        for (const e of [...new Set(enunciados)]) {
          const probe = fold(stripMaterialTokens(e)).slice(0, 60);
          if (!hay.includes(probe) && !hayNS.includes(probe.replace(/ /g, ''))) {
            miss++;
            if (miss <= 3) add('FAIL', `Libro PDF ${blockKey}`, `enunciado ausente: ${probe.slice(0, 70)}…`);
          }
        }
        if (enunciados.length > 0 && miss === 0) {
          add('OK', `Libro PDF ${blockKey}`, `${new Set(enunciados).size} enunciados de práctica presentes`);
        }
        console.log(`   ${pages.length} páginas / ${text.length} chars`);
      } catch (err) {
        add('FAIL', `Libro PDF ${blockKey}`, `error renderizando: ${(err as Error).message}`);
        console.error('   ❌', (err as Error).message);
      }

      try {
        const { renderWorkbookToDocx } = await import('../src/lib/docx-workbook-renderer');
        const buf = await renderWorkbookToDocx(workbook, planning);
        writeFileSync(join(outDir, `libro-${blockKey}.docx`), buf);
        const { value: docxText } = await mammoth.extractRawText({ buffer: buf });
        checkGarbage(`Libro DOCX ${blockKey}`, docxText, JSON.stringify(workbook));
        if (docxText.replace(/\s/g, '').length < 5000) {
          add('FAIL', `Libro DOCX ${blockKey}`, 'texto extraído sospechosamente corto');
        }
        const enunciados: string[] = [];
        for (const m of workbook.missions ?? []) {
          for (const sp of m.sessionPlans ?? []) {
            for (const pr of sp.practica ?? []) {
              if ((pr.enunciado ?? '').length >= 30) enunciados.push(pr.enunciado);
            }
          }
        }
        const hay = fold(docxText);
        const hayNS = hay.replace(/ /g, '');
        let miss = 0;
        for (const e of [...new Set(enunciados)]) {
          const probe = fold(stripMaterialTokens(e)).slice(0, 60);
          if (!hay.includes(probe) && !hayNS.includes(probe.replace(/ /g, ''))) miss++;
        }
        if (enunciados.length > 0 && miss === 0) {
          add('OK', `Libro DOCX ${blockKey}`, `${new Set(enunciados).size} enunciados de práctica presentes`);
        } else if (miss > 0) {
          add('FAIL', `Libro DOCX ${blockKey}`, `${miss} enunciados ausentes en el DOCX`);
        }
        console.log(`   docx: ${docxText.length} chars`);
      } catch (err) {
        add('FAIL', `Libro DOCX ${blockKey}`, `error renderizando: ${(err as Error).message}`);
        console.error('   ❌', (err as Error).message);
      }
    }
  }

  // ── 6. Infografías (todas las misiones del primer bloque con libro) ──
  {
    const blockKeys = Object.keys(workbooks).filter((k) => workbooks[k]?.current);
    if (blockKeys.length === 0) {
      add('WARN', 'Infografías', 'sin libro vigente (no derivables)');
    } else {
      const workbook = workbooks[blockKeys[0]]!.current!;
      const { buildInfographic, INFOGRAPHIC_WIDTH, INFOGRAPHIC_HEIGHT } = await import(
        '../src/lib/visual-engine/infographic-generator'
      );
      const EM: Record<string, number> = { normal: 0.58, '500': 0.6, '600': 0.62, '700': 0.64, bold: 0.64 };
      const emOf = (fw: string) => EM[fw] ?? (Number(fw) >= 600 ? 0.64 : Number(fw) >= 500 ? 0.6 : 0.58);
      const re =
        /<text x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*font-weight="([^"]+)"[^>]*text-anchor="([^"]+)">([^<]*)<\/text>/g;
      let built = 0;
      let overflows = 0;
      let outOfBounds = 0;
      for (let mi = 0; mi < (workbook.missions ?? []).length; mi++) {
        const info = buildInfographic(workbook, mi, { component });
        if (!info) continue;
        built++;
        for (const m of info.svg.matchAll(re)) {
          const x = Number(m[1]);
          const y = Number(m[2]);
          const fs = Number(m[3]);
          const em = emOf(m[4]);
          const anchor = m[5];
          const content = m[6]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
          const est = content.length * fs * em;
          const left = anchor === 'middle' ? x - est / 2 : x;
          const right = anchor === 'middle' ? x + est / 2 : x + est;
          if (right > INFOGRAPHIC_WIDTH - 5 || left < 0) {
            overflows++;
            if (overflows <= 3) {
              add('FAIL', `Infografía m${mi + 1}`, `texto desborda el borde derecho (${Math.round(right)} > ${INFOGRAPHIC_WIDTH - 5}): "${content.slice(0, 50)}"`);
            }
          }
          if (y > INFOGRAPHIC_HEIGHT - 10 || y < 10) {
            outOfBounds++;
            add('FAIL', `Infografía m${mi + 1}`, `baseline fuera de la página (y=${y}): "${content.slice(0, 50)}"`);
          }
        }
      }
      if (built === 0) {
        add('WARN', 'Infografías', 'no se generó ninguna infografía');
      } else if (overflows === 0 && outOfBounds === 0) {
        add('OK', 'Infografías', `${built} infografía(s): ningún <text>` + ' desborda el viewBox');
      }
      // Export PNG de la primera para validar rasterizado Carta 300dpi
      const first = buildInfographic(workbook, 0, { component });
      if (first) {
        try {
          const { infographicToPng, LETTER_300DPI_WIDTH } = await import('../src/lib/visual-engine/infographic-exporter');
          const png = Buffer.from(await infographicToPng(first));
          writeFileSync(join(outDir, 'infografia-mision-1.png'), png);
          const sharp = (await import('sharp')).default;
          const meta = await sharp(png).metadata();
          if (meta.width === LETTER_300DPI_WIDTH) {
            add('OK', 'Infografías', `PNG Carta 300 DPI (${meta.width}x${meta.height})`);
          } else {
            add('WARN', 'Infografías', `PNG con ancho ${meta.width} (esperado ${LETTER_300DPI_WIDTH})`);
          }
        } catch (err) {
          add('FAIL', 'Infografías', `export PNG falló: ${(err as Error).message}`);
        }
      }
    }
  }

  // ── Reporte ──
  const count = (l: Level) => findings.filter((f) => f.level === l).length;
  const lines: string[] = [];
  lines.push(`# Auditoría de alineación — planeación ${planningId}`);
  lines.push('');
  lines.push(`- UAC: ${planning.uacName} · semestre ${planning.semester} · componente ${planning.component}`);
  lines.push(`- Extras auditados: ${extras.length} (${pdfTotal} pág PDF · ${docxTotal} chars DOCX)`);
  lines.push(`- Fecha: ${new Date().toISOString()}`);
  lines.push(`- Resultado: **${count('FAIL')} FAIL · ${count('WARN')} WARN · ${count('OK')} OK**${dupFindings > 0 ? ` (${dupFindings} hallazgos repetidos deduplicados)` : ''}`);
  lines.push('');
  let current = '';
  for (const f of findings) {
    if (f.section !== current) {
      current = f.section;
      lines.push(`## ${current}`);
    }
    lines.push(`- ${f.level === 'OK' ? '✅' : f.level === 'WARN' ? '⚠️' : '❌'} ${f.msg}`);
  }
  lines.push('');
  writeFileSync(join(outDir, 'report.md'), lines.join('\n'));

  console.log('\n══ HALLAZGOS ══');
  for (const f of findings) {
    if (f.level !== 'OK') console.log(` [${f.level}] ${f.section}: ${f.msg}`);
  }
  console.log(`\n${count('FAIL')} FAIL · ${count('WARN')} WARN · ${count('OK')} OK`);
  console.log(`📄 scripts/output/audit-alignment/report.md`);
  process.exit(count('FAIL') > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Error en auditoría:', err);
  process.exit(1);
});
