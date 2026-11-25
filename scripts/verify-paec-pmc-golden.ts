/**
 * scripts/verify-paec-pmc-golden.ts — Verificador Golden Determinista para PAEC y PMC (Fase C.5 / D)
 *
 * Uso:
 *   npx tsx scripts/verify-paec-pmc-golden.ts --write   (congela tests/fixtures/paec-pmc-golden/baseline.golden.json)
 *   npx tsx scripts/verify-paec-pmc-golden.ts           (verifica diff === 0 contra baseline)
 *
 * Cubre:
 * - PMC: generatePmcDocx, generatePmcDocxMaestro, generatePmcPDF, calculateGlobalPmcScore, auditPmcProject
 * - PAEC: generatePaecDocx, generatePaecPDF, calculateGlobalPaecScore, auditPaecPlan (Sem A + Sem B)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

import {
  GOLDEN_PAEC_PROJECT,
  GOLDEN_PMC_MAESTRO_OPTIONS,
  GOLDEN_PMC_MAESTRO_PROJECT,
  GOLDEN_PMC_PROJECT,
} from '../tests/fixtures/paec-pmc-golden/fixtures';
import { generatePmcDocx } from '@/lib/pmc-docx-generator';
import { generatePmcDocxMaestro } from '@/lib/pmc-docx-maestro-builder';
import { generatePmcPDF } from '@/lib/pmc-pdf-generator';
import { calculateGlobalPmcScore } from '@/lib/pmc-quality-gate';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import { calculateGlobalPaecScore } from '@/lib/paec-quality-gate';
import { auditPaecPlan, auditPmcProject, type PmcProjectLike } from '@/lib/qa/paec-pmc-semantic-qa';

const GOLDEN_DIR = path.resolve(process.cwd(), 'tests/fixtures/paec-pmc-golden');
const BASELINE_PATH = path.join(GOLDEN_DIR, 'baseline.golden.json');

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeVolatileDates(text: string): string {
  return text
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '<DATE>')
    .replace(/\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}\b/gi, '<DATE_ES>')
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, '<ISO_TS>');
}

async function computeNormalizedDocxSnapshot(docxBuffer: Buffer): Promise<{
  paragraphCount: number;
  tableCount: number;
  wordCount: number;
  semanticHash: string;
}> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const docXml = await zip.files['word/document.xml']!.async('string');

  const paragraphs = [...docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) =>
    normalizeVolatileDates(
      [...m[0].matchAll(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((t) => decodeXml(t[1] ?? ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
    )
  );
  const nonEmptyParagraphs = paragraphs.filter((p) => p.length > 0);
  const tableCount = (docXml.match(/<w:tbl\b/g) || []).length;
  const wordCount = nonEmptyParagraphs
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    paragraphCount: nonEmptyParagraphs.length,
    tableCount,
    wordCount,
    semanticHash: sha256(nonEmptyParagraphs),
  };
}

function computeNormalizedPdfSnapshot(pdfBuffer: Buffer): {
  pageCount: number;
  normalizedLength: number;
  semanticHash: string;
} {
  const raw = pdfBuffer.toString('latin1');
  const pageMatches = raw.match(/\/Type\s*\/Page\b(?!s)/g) || [];
  const normalized = raw
    .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate (D:FIXED)')
    .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate (D:FIXED)')
    .replace(/\/ID\s*\[[^\]]*\]/g, '/ID [<FIXED> <FIXED>]')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '<DATE>')
    .replace(/\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}\b/gi, '<DATE_ES>');

  return {
    pageCount: pageMatches.length,
    normalizedLength: normalized.length,
    semanticHash: sha256(normalized),
  };
}

export interface PaecPmcGoldenBaseline {
  version: number;
  pmc: {
    semanticQaPassed: boolean;
    semanticFails: string[];
    semanticWarns: string[];
    qualityGatePercentage: number;
    qualityGateStatus: string;
    criteriaSnapshot: Array<{ id: string; status: string; score: number }>;
    docx: { paragraphCount: number; tableCount: number; wordCount: number; semanticHash: string };
    docxMaestro: { paragraphCount: number; tableCount: number; wordCount: number; semanticHash: string };
    pdf: { pageCount: number; normalizedLength: number; semanticHash: string };
  };
  paec: {
    semAPassed: boolean;
    semAFails: string[];
    semBPassed: boolean;
    semBFails: string[];
    qualityGateScore: number;
    qualityGateStatus: string;
    criteriaSnapshot: Array<{ id: number; status: string; score: number }>;
    docx: { paragraphCount: number; tableCount: number; wordCount: number; semanticHash: string };
    pdf: { pageCount: number; normalizedLength: number; semanticHash: string };
  };
}

export async function computeCurrentPaecPmcGolden(): Promise<PaecPmcGoldenBaseline> {
  // ── 1. PMC ──────────────────────────────────────────────────────────────────
  const pmcSemantic = auditPmcProject(GOLDEN_PMC_PROJECT as unknown as PmcProjectLike, { strict: false });
  const pmcAudit = calculateGlobalPmcScore(GOLDEN_PMC_PROJECT);
  const [pmcDocxBuf, pmcMaestroBuf, pmcPdfBuf] = await Promise.all([
    generatePmcDocx(GOLDEN_PMC_PROJECT as Parameters<typeof generatePmcDocx>[0]),
    generatePmcDocxMaestro(GOLDEN_PMC_MAESTRO_PROJECT, GOLDEN_PMC_MAESTRO_OPTIONS),
    generatePmcPDF(GOLDEN_PMC_PROJECT, {}),
  ]);

  const [pmcDocxSnap, pmcMaestroSnap] = await Promise.all([
    computeNormalizedDocxSnapshot(pmcDocxBuf),
    computeNormalizedDocxSnapshot(pmcMaestroBuf),
  ]);
  const pmcPdfSnap = computeNormalizedPdfSnapshot(pmcPdfBuf);

  // ── 2. PAEC ─────────────────────────────────────────────────────────────────
  const mapeoCatalog = (GOLDEN_PAEC_PROJECT.fase2Mapeo ?? []).map((m) => ({
    uacName: m.uacName,
    semester: Number(m.semester),
    component: '',
  }));
  const paecQaA = auditPaecPlan(GOLDEN_PAEC_PROJECT.fase3PlanOperativoA ?? [], mapeoCatalog, {
    parity: 1,
    cicloEscolar: '2026-2027',
    strict: true,
  });
  const paecQaB = auditPaecPlan(GOLDEN_PAEC_PROJECT.fase3PlanOperativoB ?? [], mapeoCatalog, {
    parity: 0,
    cicloEscolar: '2026-2027',
    strict: true,
  });
  const paecAudit = calculateGlobalPaecScore(GOLDEN_PAEC_PROJECT);
  const [paecDocxBuf, paecPdfBuf] = await Promise.all([
    generatePaecDocx(GOLDEN_PAEC_PROJECT, 'Mtra. Elena Morales Castro'),
    generatePaecPDF(GOLDEN_PAEC_PROJECT, 'Mtra. Elena Morales Castro', {}),
  ]);

  const paecDocxSnap = await computeNormalizedDocxSnapshot(paecDocxBuf);
  const paecPdfSnap = computeNormalizedPdfSnapshot(paecPdfBuf);

  return {
    version: 1,
    pmc: {
      semanticQaPassed: pmcSemantic.passed,
      semanticFails: pmcSemantic.fails,
      semanticWarns: pmcSemantic.warns,
      qualityGatePercentage: pmcAudit.percentage,
      qualityGateStatus: pmcAudit.overallStatus,
      criteriaSnapshot: pmcAudit.criteria.map((c) => ({ id: c.id, status: c.status, score: c.score })),
      docx: pmcDocxSnap,
      docxMaestro: pmcMaestroSnap,
      pdf: pmcPdfSnap,
    },
    paec: {
      semAPassed: paecQaA.passed,
      semAFails: paecQaA.fails,
      semBPassed: paecQaB.passed,
      semBFails: paecQaB.fails,
      qualityGateScore: paecAudit.score,
      qualityGateStatus: paecAudit.estatus,
      criteriaSnapshot: paecAudit.criterios.map((c) => ({ id: c.id, status: c.status, score: c.score })),
      docx: paecDocxSnap,
      pdf: paecPdfSnap,
    },
  };
}

export function diffGoldenSnapshots(expected: unknown, actual: unknown, prefix = ''): string[] {
  if (expected === actual) return [];
  if (typeof expected !== typeof actual || expected === null || actual === null) {
    return [`${prefix || '<root>'}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`];
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const diffs: string[] = [];
    const maxLen = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxLen; i++) {
      diffs.push(...diffGoldenSnapshots(expected[i], actual[i], `${prefix}[${i}]`));
    }
    return diffs;
  }
  if (typeof expected === 'object' && typeof actual === 'object') {
    const eObj = expected as Record<string, unknown>;
    const aObj = actual as Record<string, unknown>;
    const keys = new Set([...Object.keys(eObj), ...Object.keys(aObj)]);
    const diffs: string[] = [];
    for (const k of keys) {
      diffs.push(...diffGoldenSnapshots(eObj[k], aObj[k], prefix ? `${prefix}.${k}` : k));
    }
    return diffs;
  }
  return [`${prefix}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`];
}

async function main(): Promise<void> {
  const writeMode = process.argv.includes('--write');
  const current = await computeCurrentPaecPmcGolden();

  if (!current.pmc.semanticQaPassed) {
    throw new Error(`Golden PMC fixture failed semantic QA: ${current.pmc.semanticFails.join(' | ')}`);
  }
  if (!current.paec.semAPassed || !current.paec.semBPassed) {
    throw new Error(
      `Golden PAEC fixture failed semantic QA: A=[${current.paec.semAFails.join('|')}] B=[${current.paec.semBFails.join('|')}]`
    );
  }

  if (writeMode) {
    // Verificar determinismo interno antes de congelar (2 corridas idénticas)
    const second = await computeCurrentPaecPmcGolden();
    const detDiffs = diffGoldenSnapshots(current, second);
    if (detDiffs.length > 0) {
      throw new Error(`Golden generator is NOT deterministic across 2 runs:\n${detDiffs.join('\n')}`);
    }
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + '\n', 'utf8');
    console.log(`[PAEC/PMC GOLDEN] Baseline congelado y verificado determinista (0 diffs) en ${BASELINE_PATH}`);
    console.log(
      `  PMC:  qa=PASS gate=${current.pmc.qualityGatePercentage}% docx=${current.pmc.docx.wordCount}w maestro=${current.pmc.docxMaestro.wordCount}w pdf=${current.pmc.pdf.pageCount}p`
    );
    console.log(
      `  PAEC: qaA=PASS qaB=PASS gate=${current.paec.qualityGateScore}% docx=${current.paec.docx.wordCount}w pdf=${current.paec.pdf.pageCount}p`
    );
    return;
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`Baseline no encontrado en ${BASELINE_PATH}. Ejecute con --write primero.`);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as PaecPmcGoldenBaseline;
  const diffs = diffGoldenSnapshots(baseline, current);
  if (diffs.length > 0) {
    console.error(`[PAEC/PMC GOLDEN FAIL] ${diffs.length} diferencia(s) detectada(s):`);
    diffs.slice(0, 30).forEach((d) => console.error(`  - ${d}`));
    process.exit(1);
  }
  console.log(
    `[PAEC/PMC GOLDEN PASS] 0 diffs — PMC(docx=${current.pmc.docx.wordCount}w, maestro=${current.pmc.docxMaestro.wordCount}w, pdf=${current.pmc.pdf.pageCount}p, gate=${current.pmc.qualityGatePercentage}%) · PAEC(docx=${current.paec.docx.wordCount}w, pdf=${current.paec.pdf.pageCount}p, gate=${current.paec.qualityGateScore}%)`
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith('verify-paec-pmc-golden.ts');
if (isMain) {
  main().catch((err) => {
    console.error('[verify-paec-pmc-golden] Error fatal:', err);
    process.exit(1);
  });
}
