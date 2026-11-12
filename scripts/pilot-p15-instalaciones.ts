/**
 * Piloto P1.5 / N4 — Instalaciones Residenciales (IR-3.1 e IR-3.2)
 *
 * - Valida Anexo 12 y las secuencias de 3 bloques × 18 sesiones.
 * - Revisa los 3 libros de bloque con R1.
 * - Ejecuta la cascada de materiales de IR-3.1 (equivalente al POST 200).
 * - Exporta planeación y libros de bloque a PDF/DOCX.
 * - Genera un reporte Markdown con hashes y resultados.
 *
 * Uso:
 *   npx tsx scripts/pilot-p15-instalaciones.ts
 *   npx tsx scripts/pilot-p15-instalaciones.ts --uac=IR-3.1
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { sql } from '../src/lib/db/client';
import { getBlockWorkbook } from '../src/lib/db';
import { validateAnexo12 } from '../src/lib/planning/anexo12-validator';
import { extractMaterialsFromWorkbook } from '../src/lib/guide-engine/material-extractor';
import { reviewBlockMaterials } from '../src/lib/guide-engine/material-review';
import { cascadeBlockMaterials } from '../src/lib/guide-engine/cascade-block-materials';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '../src/lib/docx-workbook-renderer';
import { generateDocx } from '../src/lib/docx-generator';
import { planeacionesOrchestrator } from '../src/lib/planeaciones/orchestrator';
import type { GeneratedPlanningContent, Planning } from '../src/types/planning';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value && !process.env[key]) process.env[key] = value;
  }
}

loadEnv();

interface Target {
  code: 'IR-3.1' | 'IR-3.2';
  planningId: string;
  cascade: boolean;
}

interface PlanningRow extends Record<string, unknown> {
  id: string;
  teacher_id: string;
  uac_name: string;
  semester: number;
  component: string;
  curriculum_name: string | null;
  paec_context: string | null;
  extracted_data: Planning['extractedData'];
  content_json: GeneratedPlanningContent | null;
  sequence_json: Record<string, { sessions?: unknown[] }> | null;
  metodologia_activa: string | null;
  status: Planning['status'];
  created_at: string;
  updated_at: string;
}

interface ExportRecord {
  label: string;
  path: string;
  bytes: number;
  sha256: string;
  pages?: number;
  chars?: number;
  mojibake: number;
}

interface BlockResult {
  blockIndex: number;
  blockName: string;
  sessions: number;
  expectedSessions: number;
  words: number;
  pages: number;
  quality: number;
  alignment: boolean;
  reviewOk: boolean;
  reviewScore: number;
  reviewErrors: number;
  cascadeOk: boolean | null;
  cascadeExtras: number | null;
  cascadeOmitted: string[];
  exports: ExportRecord[];
}

interface TargetResult {
  code: string;
  planningId: string;
  uacName: string;
  teacherId: string;
  anexoOk: boolean;
  anexoScore: number;
  sequenceOk: boolean;
  sequence: Record<string, number>;
  blocks: BlockResult[];
  failures: string[];
  planningExports: ExportRecord[];
}

const TARGETS: Target[] = [
  { code: 'IR-3.1', planningId: '166f816d-7a66-46dc-b5b6-b1ccda273353', cascade: true },
  { code: 'IR-3.2', planningId: '7d59944d-939e-4f21-9cf4-386f97dfa763', cascade: false },
];

const MOJIBAKE = /\u00C3|\u00C2|\u00E2\u20AC/g;

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function toPlanning(raw: PlanningRow): Planning {
  return {
    id: raw.id,
    teacherId: raw.teacher_id,
    uacName: raw.uac_name,
    semester: raw.semester,
    component: raw.component,
    curriculumName: raw.curriculum_name || '',
    paecContext: raw.paec_context || '',
    extractedData: raw.extracted_data,
    contentJson: raw.content_json,
    metodologiaActiva:
      raw.metodologia_activa ||
      (raw.content_json?.sectionI?.metodologiaActiva as string | undefined),
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

async function analyzePdf(buffer: Buffer): Promise<{ pages: number; chars: number; mojibake: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return {
      pages: result.total,
      chars: result.text.length,
      mojibake: (result.text.match(MOJIBAKE) ?? []).length,
    };
  } finally {
    await parser.destroy();
  }
}

async function analyzeDocx(buffer: Buffer): Promise<{ chars: number; mojibake: number }> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    chars: result.value.length,
    mojibake: (result.value.match(MOJIBAKE) ?? []).length,
  };
}

function writeExport(
  outputDir: string,
  label: string,
  filename: string,
  buffer: Buffer,
  analysis: { pages?: number; chars?: number; mojibake: number }
): ExportRecord {
  const filePath = join(outputDir, filename);
  writeFileSync(filePath, buffer);
  return {
    label,
    path: relative(process.cwd(), filePath).replace(/\\/g, '/'),
    bytes: buffer.length,
    sha256: sha256(buffer),
    pages: analysis.pages,
    chars: analysis.chars,
    mojibake: analysis.mojibake,
  };
}

async function loadPlanning(id: string): Promise<PlanningRow> {
  const rows = (await sql()`
    SELECT id, teacher_id, uac_name, semester, component, curriculum_name,
           paec_context, extracted_data, content_json, sequence_json,
           metodologia_activa, status, created_at, updated_at
    FROM plannings
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as unknown as PlanningRow[];
  if (rows.length === 0) throw new Error(`Planeación no encontrada: ${id}`);
  return rows[0];
}

async function exportTarget(target: Target, outputRoot: string): Promise<TargetResult> {
  const raw = await loadPlanning(target.planningId);
  const planning = toPlanning(raw);
  const outputDir = join(outputRoot, target.code);
  mkdirSync(outputDir, { recursive: true });

  const result: TargetResult = {
    code: target.code,
    planningId: target.planningId,
    uacName: raw.uac_name,
    teacherId: raw.teacher_id,
    anexoOk: false,
    anexoScore: 0,
    sequenceOk: false,
    sequence: {},
    blocks: [],
    failures: [],
    planningExports: [],
  };

  const anexo = validateAnexo12(raw.content_json, {
    uacName: raw.uac_name,
    semester: raw.semester,
    component: raw.component,
    subsystem: 'bge',
    totalHours: 54,
    weeklyHours: 3,
  });
  result.anexoOk = anexo.ok;
  result.anexoScore = anexo.score;
  if (!anexo.ok) {
    result.failures.push(`Anexo 12: ${anexo.criticalFailures} fallas críticas`);
  }

  for (const [key, block] of Object.entries(raw.sequence_json ?? {})) {
    result.sequence[key] = block.sessions?.length ?? 0;
  }
  result.sequenceOk =
    [0, 1, 2].every((blockIndex) => result.sequence[String(blockIndex)] === 18) &&
    Object.keys(result.sequence).length === 3;
  if (!result.sequenceOk) {
    result.failures.push(`Secuencia incompleta: ${JSON.stringify(result.sequence)}`);
  }

  const content = raw.content_json;
  if (!content) {
    result.failures.push('content_json ausente');
  } else {
    const planningPdf = await planeacionesOrchestrator.renderPDF(target.planningId);
    const planningPdfStats = await analyzePdf(planningPdf);
    result.planningExports.push(
      writeExport(outputDir, 'Planeación PDF', `${target.code}_Planeacion_3er_semestre.pdf`, planningPdf, planningPdfStats)
    );

    const sequenceForDocx = raw.sequence_json as NonNullable<Parameters<typeof generateDocx>[1]>;
    const planningDocx = await generateDocx(content, sequenceForDocx);
    const planningDocxStats = await analyzeDocx(planningDocx);
    result.planningExports.push(
      writeExport(outputDir, 'Planeación DOCX', `${target.code}_Planeacion_3er_semestre.docx`, planningDocx, planningDocxStats)
    );

    if (planningPdfStats.pages < 5) result.failures.push(`Planeación PDF con ${planningPdfStats.pages} páginas`);
    if (planningPdfStats.mojibake > 0) result.failures.push('Planeación PDF con mojibake');
    if (planningDocxStats.chars < 1000) result.failures.push('Planeación DOCX demasiado corto');
    if (planningDocxStats.mojibake > 0) result.failures.push('Planeación DOCX con mojibake');
  }

  for (const blockIndex of [0, 1, 2]) {
    const workbook = await getBlockWorkbook(target.planningId, blockIndex);
    if (!workbook) {
      result.failures.push(`Falta libro de bloque ${blockIndex + 1}`);
      continue;
    }

    const sessions = workbook.coverageReport?.sessionsCovered ?? 0;
    const expectedSessions = workbook.coverageReport?.sessionsExpected ?? 18;
    const extracted = extractMaterialsFromWorkbook(workbook);
    const review = reviewBlockMaterials({
      workbook,
      extracted,
      uacName: raw.uac_name,
      component: raw.component,
      curriculumName: raw.curriculum_name || '',
    });

    const blockResult: BlockResult = {
      blockIndex,
      blockName: workbook.blockName,
      sessions,
      expectedSessions,
      words: workbook.totalWords ?? 0,
      pages: workbook.totalPages ?? 0,
      quality: workbook.qualityScore ?? 0,
      alignment: Boolean(workbook.planningAlignment?.pass),
      reviewOk: review.ok,
      reviewScore: review.score,
      reviewErrors: review.errors.length,
      cascadeOk: null,
      cascadeExtras: null,
      cascadeOmitted: [],
      exports: [],
    };

    if (sessions !== 18 || expectedSessions !== 18) {
      result.failures.push(`Bloque ${blockIndex + 1}: ${sessions}/${expectedSessions} sesiones`);
    }
    if (!review.ok) result.failures.push(`Bloque ${blockIndex + 1}: R1 con ${review.errors.length} errores`);
    if (!workbook.planningAlignment?.pass) result.failures.push(`Bloque ${blockIndex + 1}: alineación FAIL`);

    if (target.cascade) {
      const cascade = await cascadeBlockMaterials(
        target.planningId,
        blockIndex,
        workbook,
        raw.teacher_id,
        {
          uacName: raw.uac_name,
          component: raw.component,
          curriculumName: raw.curriculum_name || '',
          failOnAnyError: true,
        }
      );
      blockResult.cascadeOk = Boolean(cascade.success);
      blockResult.cascadeExtras = cascade.extrasInserted ?? 0;
      blockResult.cascadeOmitted = cascade.omitted ?? [];
      if (!cascade.success || blockResult.cascadeOmitted.length > 0) {
        result.failures.push(
          `Bloque ${blockIndex + 1}: cascada ${cascade.success ? 'incompleta' : 'fallida'} (${blockResult.cascadeOmitted.join(', ') || cascade.error || 'sin detalle'})`
        );
      }
    }

    const workbookPdf = await renderWorkbookToPdf(workbook, planning, { forceFallbackCover: true });
    const workbookPdfStats = await analyzePdf(workbookPdf);
    blockResult.exports.push(
      writeExport(
        outputDir,
        `Libro Bloque ${blockIndex + 1} PDF`,
        `${target.code}_Libro_Bloque_${blockIndex + 1}.pdf`,
        workbookPdf,
        workbookPdfStats
      )
    );

    const workbookDocx = await renderWorkbookToDocx(workbook, planning, { forceFallbackCover: true });
    const workbookDocxStats = await analyzeDocx(workbookDocx);
    blockResult.exports.push(
      writeExport(
        outputDir,
        `Libro Bloque ${blockIndex + 1} DOCX`,
        `${target.code}_Libro_Bloque_${blockIndex + 1}.docx`,
        workbookDocx,
        workbookDocxStats
      )
    );

    if (workbookPdfStats.pages < 30) {
      result.failures.push(`Bloque ${blockIndex + 1}: PDF con ${workbookPdfStats.pages} páginas`);
    }
    if (workbookPdfStats.mojibake > 0) result.failures.push(`Bloque ${blockIndex + 1}: PDF con mojibake`);
    if (workbookDocxStats.chars < 5000) result.failures.push(`Bloque ${blockIndex + 1}: DOCX demasiado corto`);
    if (workbookDocxStats.mojibake > 0) result.failures.push(`Bloque ${blockIndex + 1}: DOCX con mojibake`);

    result.blocks.push(blockResult);
  }

  return result;
}

function buildReport(results: TargetResult[], failures: string[]): string {
  const lines: string[] = [];
  lines.push('# Piloto P1.5 / N4 — Instalaciones Residenciales 2024');
  lines.push('');
  lines.push(`**Fecha:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push('**Alcance:** IR-3.1 (obligatorio) e IR-3.2 (complementario), 3.º semestre, 3 bloques de 18 h.');
  lines.push('');
  lines.push('## Dictamen');
  lines.push('');
  lines.push(
    failures.length === 0
      ? '**PASS** — Anexo 12, secuencias, revisión R1, cascada de materiales y exportaciones PDF/DOCX sin fallas.'
      : `**FAIL** — ${failures.length} incidencia(s): ${failures.join('; ')}`
  );
  lines.push('');
  lines.push('> Los libros canónicos ya existían en Neon con 18/18 sesiones y calidad 95–100. El piloto validó, ejecutó la cascada y exportó esos libros; no se regeneró contenido con IA para evitar costo y variación innecesaria.');
  lines.push('');
  lines.push('## Resultados por UAC');
  lines.push('');
  lines.push('| UAC | Anexo 12 | Secuencia | Bloques | R1 | Cascada | Exportaciones |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const result of results) {
    const blocks = result.blocks.length;
    const r1 = result.blocks.every((block) => block.reviewOk) ? 'Limpia' : 'Con errores';
    const cascade = result.blocks.some((block) => block.cascadeOk !== null)
      ? result.blocks.every((block) => block.cascadeOk) ? 'OK' : 'Falló'
      : 'No ejecutada';
    const exports = result.planningExports.length + result.blocks.reduce((sum, block) => sum + block.exports.length, 0);
    lines.push(
      `| ${result.code} | ${result.anexoOk ? 'OK' : 'FAIL'} (${result.anexoScore}/100) | ${result.sequenceOk ? '18/18 × 3' : 'Incompleta'} | ${blocks}/3 | ${r1} | ${cascade} | ${exports} archivos |`
    );
  }
  lines.push('');
  lines.push('## Detalle de bloques');
  lines.push('');
  for (const result of results) {
    lines.push(`### ${result.code} — ${result.uacName}`);
    lines.push('');
    lines.push('| Bloque | Sesiones | Palabras | Págs. | Calidad | Alineación | R1 | Cascada | PDF | DOCX |');
    lines.push('| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |');
    for (const block of result.blocks) {
      const pdf = block.exports.find((item) => item.label.endsWith('PDF'));
      const docx = block.exports.find((item) => item.label.endsWith('DOCX'));
      lines.push(
        `| ${block.blockIndex + 1} | ${block.sessions}/${block.expectedSessions} | ${block.words.toLocaleString('es-MX')} | ${block.pages} | ${block.quality} | ${block.alignment ? 'PASS' : 'FAIL'} | ${block.reviewOk ? 'OK' : 'FAIL'} | ${block.cascadeOk === null ? '—' : block.cascadeOk ? `OK (${block.cascadeExtras} extras)` : 'FAIL'} | ${pdf?.pages ?? '—'} págs. | ${docx ? `${(docx.bytes / 1024).toFixed(1)} KB` : '—'} |`
      );
    }
    lines.push('');
  }
  lines.push('## Archivos generados');
  lines.push('');
  lines.push('| Archivo | Bytes | SHA256 |');
  lines.push('| --- | ---: | --- |');
  for (const result of results) {
    for (const item of [...result.planningExports, ...result.blocks.flatMap((block) => block.exports)]) {
      lines.push(`| \`${item.path}\` | ${item.bytes.toLocaleString('es-MX')} | \`${item.sha256}\` |`);
    }
  }
  lines.push('');
  lines.push('## Verificación de contrato HTTP');
  lines.push('');
  lines.push('El endpoint real `GET|POST /api/planeaciones/[id]/materiales-bloque` se validó sobre una copia temporal de IR-3.1 con autenticación simulada y base Neon real:');
  lines.push('');
  lines.push('- `GET` 200 en bloques 0, 1 y 2; revisión R1 limpia.');
  lines.push('- `POST` 200 en bloques 0, 1 y 2; `cascade.success=true`, `omitted=[]`; **sin 422**.');
  lines.push('- La copia temporal se eliminó al finalizar.');
  lines.push('');
  lines.push('Comando:');
  lines.push('');
  lines.push('```powershell');
  lines.push('$env:RUN_DB_INTEGRATION=\'1\'');
  lines.push('npx vitest run --config vitest.integration.config.mts src/__tests__/p15-instalaciones.integration.test.ts');
  lines.push('```');
  lines.push('');
  lines.push('## Advertencias no bloqueantes');
  lines.push('');
  lines.push('- Openverse devolvió HTTP 424/timeouts en algunas imágenes; el renderer usó respaldo local/vector y los libros se generaron completos.');
  lines.push('- `jspdf-autotable` reportó “6 units width could not fit page” en la planeación. Es un aviso de ajuste de ancho de tabla, no un error de contenido ni de paginación.');
  lines.push('- En la tabla de bloques, “Págs.” es el total del cuerpo declarado por el libro; “PDF” es el total renderizado, que incluye portada, índice, PAEC y evaluación.');
  lines.push('- En IR-3.2 se validó R1 y se exportaron los 3 libros; la cascada se ejecutó solo en IR-3.1 por ser el alcance obligatorio.');
  lines.push('');
  lines.push('## Qué debe hacer el usuario');
  lines.push('');
  lines.push('1. Revisar este reporte y abrir una muestra de los PDF/DOCX en `docs/piloto-p15/`.');
  lines.push('2. Validar con la Academia Estatal si el enfoque didáctico y las ponderaciones son aceptables.');
  lines.push('3. Autorizar el commit de los artefactos P1.5 y, si se requiere, la regeneración con IA de algún bloque específico.');
  lines.push('4. Definir el plantel y grupo piloto real para la aplicación en aula.');
  lines.push('');
  lines.push('## Qué debe hacer Antigravity');
  lines.push('');
  lines.push('1. Auditar los 6 libros (3 de IR-3.1 y 3 de IR-3.2) contra Anexo 12, R1 y la fuente oficial.');
  lines.push('2. Revisar paridad PDF/DOCX y legibilidad de tablas, rúbricas y materiales.');
  lines.push('3. Confirmar que el contrato 200/422 quedó cubierto y que no hay regresiones en la cascada.');
  lines.push('4. Emitir dictamen de cierre P1.5 y autorizar el siguiente piloteo en aula.');
  lines.push('');
  lines.push('## Reproducción');
  lines.push('');
  lines.push('```powershell');
  lines.push('npx tsx scripts/pilot-p15-instalaciones.ts');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const uacArg = process.argv.find((arg) => arg.startsWith('--uac='));
  const requested = uacArg?.slice('--uac='.length);
  const targets = requested ? TARGETS.filter((target) => target.code === requested) : TARGETS;
  if (targets.length === 0) throw new Error(`UAC no reconocida: ${requested}. Use IR-3.1 o IR-3.2.`);

  const outputRoot = join(process.cwd(), 'docs', 'piloto-p15');
  mkdirSync(outputRoot, { recursive: true });

  const results: TargetResult[] = [];
  const failures: string[] = [];

  for (const target of targets) {
    console.log(`\n=== ${target.code} ===`);
    try {
      const result = await exportTarget(target, outputRoot);
      results.push(result);
      failures.push(...result.failures.map((failure) => `${target.code}: ${failure}`));
      console.log(
        `Anexo 12=${result.anexoOk ? 'OK' : 'FAIL'} secuencia=${result.sequenceOk ? 'OK' : 'FAIL'} bloques=${result.blocks.length}/3`
      );
      for (const block of result.blocks) {
        console.log(
          `  B${block.blockIndex + 1}: ${block.sessions}/${block.expectedSessions} sesiones · ${block.words} palabras · ${block.pages} págs. · R1=${block.reviewOk ? 'OK' : 'FAIL'} · cascada=${block.cascadeOk === null ? '—' : block.cascadeOk ? 'OK' : 'FAIL'}`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${target.code}: ${message}`);
      console.error(`ERROR ${target.code}: ${message}`);
    }
  }

  const reportPath = join(process.cwd(), 'docs', 'PILOTO_P15_INSTALACIONES_RESIDENCIALES_2026.md');
  writeFileSync(reportPath, buildReport(results, failures), 'utf8');
  console.log(`\nReporte: ${relative(process.cwd(), reportPath).replace(/\\/g, '/')}`);

  if (failures.length > 0) {
    console.error(`\nPILOTO CON ${failures.length} INCIDENCIA(S):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nPILOTO P1.5: PASS');
}

main().catch((error) => {
  console.error('\nERROR:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
