import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

import type { ActiveWorkTextbook } from '@/types/work-textbook';
import {
  buildSacrintDecksForWorkbook,
  buildSacrintInfographic,
  countSlideWords,
  dedupeInfographicSpecs,
  selectInfographicTargets,
  type SacrintDiagramSpec,
  type SacrintSlide,
} from '@/lib/visual-engine/sacrint/spec';
import { diagramModelLabel } from '@/lib/visual-engine/sacrint/diagrams';
import { generateCombinedSacrintPptx } from '@/lib/visual-engine/sacrint/sacrint-pptx-generator';
import { auditPptxFile } from './qa-sacrint-materials';
import { buildSyntheticGoldenWorkbooks } from '../tests/fixtures/sacrint-golden/synthetic-workbooks';

const GOLDEN_DIR = path.resolve(process.cwd(), 'tests/fixtures/sacrint-golden');
const REAL_WORKBOOKS_PATH = path.join(GOLDEN_DIR, 'real-workbooks.json');
const BASELINE_PATH = path.join(GOLDEN_DIR, 'baseline.golden.json');

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractDiagramLabels(diagram: SacrintDiagramSpec | undefined): string[] {
  if (!diagram || !diagram.available) return [];
  switch (diagram.kind) {
    case 'argument':
      return [
        diagram.thesis.label,
        ...diagram.premises.map((p) => p.label),
        ...(diagram.objection.detail.trim() ? [diagram.objection.label] : []),
        diagram.conclusion.label,
      ];
    case 'creative-cycle':
    case 'training-cycle':
      return diagram.phases.filter((p) => p.detail.trim()).map((p) => p.label);
    case 'regulation-flow':
    case 'clinical-flow':
      return diagram.stages.filter((s) => s.detail.trim()).map((s) => s.label);
    case 'concept':
      return [diagram.center.label, ...diagram.nodes.filter((n) => n.detail.trim()).map((n) => n.label)];
    case 'system-map':
      return [diagram.center.label, ...diagram.components.filter((c) => c.detail.trim()).map((c) => c.label)];
    case 'timeline':
      return diagram.events.filter((e) => e.detail.trim()).map((e) => e.label);
    case 'sop-flow':
      return diagram.steps.filter((s) => s.detail.trim()).map((s) => s.label);
    case 'block-diagram':
      return [diagram.input.label, diagram.process.label, diagram.output.label, diagram.feedback.label];
    case 'language':
      return [diagram.input.label, diagram.rule.label, diagram.output.label, diagram.context.label];
    case 'reaction':
      return [...diagram.reactants.map((r) => r.label), ...diagram.products.map((p) => p.label)];
    default:
      return [];
  }
}

async function computeNormalizedPptxSemanticHash(pptxBuffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(pptxBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));

  const normalizedSlides = [];
  for (const sf of slideFiles) {
    const xml = await zip.files[sf]!.async('string');
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map((m) => {
      const sp = m[0];
      const off = sp.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"/);
      const ext = sp.match(/<a:ext\s+cx="(-?\d+)"\s+cy="(-?\d+)"/);
      const text = [...sp.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
        .map((t) => decodeXml(t[1]!))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        x: off ? Math.round(Number(off[1]) / 9144) : 0, // ~0.01 in precision
        y: off ? Math.round(Number(off[2]) / 9144) : 0,
        w: ext ? Math.round(Number(ext[1]) / 9144) : 0,
        h: ext ? Math.round(Number(ext[2]) / 9144) : 0,
        text,
      };
    });
    normalizedSlides.push(shapes);
  }
  return sha256(normalizedSlides);
}

export interface GoldenFixtureSnapshot {
  key: string;
  subjectName: string;
  deckCount: number;
  slideCount: number;
  slides: Array<{
    kind: SacrintSlide['kind'];
    title: string;
    wordCount: number;
    diagramKind?: string;
    diagramAvailable?: boolean;
    diagramModelLabel?: string;
    diagramLabels?: string[];
    contentHash: string;
  }>;
  infographicCount: number;
  infographics: Array<{
    title: string;
    formula: string;
    diagramKind?: string;
    contentHash: string;
  }>;
  pptxSemanticHash: string;
  pptxQa: {
    slideCount: number;
    collisions: number;
    wrapNoneShapes: number;
    slide12Avg: number;
    slide12Over200: number;
    slide22Avg: number;
    slide22Over200: number;
    slide22MissingRubricOrObjectives: number;
    findingKeys: string[];
  };
}

export interface GoldenBaselineFile {
  version: number;
  fixtures: Record<string, GoldenFixtureSnapshot>;
}

export async function computeCurrentGolden(): Promise<GoldenBaselineFile> {
  const realWorkbooks = JSON.parse(fs.readFileSync(REAL_WORKBOOKS_PATH, 'utf8')) as Record<
    string,
    ActiveWorkTextbook
  >;
  const syntheticWorkbooks = buildSyntheticGoldenWorkbooks();
  const allWorkbooks: Record<string, ActiveWorkTextbook> = {
    ...realWorkbooks,
    ...syntheticWorkbooks,
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sacrint-golden-'));
  const fixtures: Record<string, GoldenFixtureSnapshot> = {};

  try {
    for (const key of Object.keys(allWorkbooks).sort()) {
      const wb = allWorkbooks[key]!;
      const decks = buildSacrintDecksForWorkbook(wb, { mode: 'lesson-guide' });
      const allSlides = decks.flatMap((d) => d.slides);
      const slideSummaries = allSlides.map((slide) => {
        const base: GoldenFixtureSnapshot['slides'][number] = {
          kind: slide.kind,
          title: slide.title,
          wordCount: countSlideWords(slide),
          contentHash: sha256(slide),
        };
        if (slide.kind === 'concept' && slide.diagram) {
          base.diagramKind = slide.diagram.kind;
          base.diagramAvailable = slide.diagram.available;
          base.diagramModelLabel = diagramModelLabel(slide.diagram);
          base.diagramLabels = extractDiagramLabels(slide.diagram);
        }
        return base;
      });

      const infoTargets = selectInfographicTargets(wb);
      const infoSpecs = dedupeInfographicSpecs(
        infoTargets.map((t) =>
          buildSacrintInfographic(wb, 'wide', {
            missionIndex: t.missionIndex,
            sessionIndex: t.sessionIndex,
          })
        )
      );
      const infographicSummaries = infoSpecs.map((spec) => ({
        title: spec.title,
        formula: spec.formula || '',
        diagramKind: spec.diagram?.kind,
        contentHash: sha256(spec),
      }));

      const pptxBuf = await generateCombinedSacrintPptx(decks);
      const pptxSemanticHash = await computeNormalizedPptxSemanticHash(pptxBuf);
      const pptxPath = path.join(tmpDir, `08_${key}.pptx`);
      fs.writeFileSync(pptxPath, pptxBuf);
      const qa = await auditPptxFile(pptxPath);

      fixtures[key] = {
        key,
        subjectName: wb.coverData?.subjectName || key,
        deckCount: decks.length,
        slideCount: allSlides.length,
        slides: slideSummaries,
        infographicCount: infoSpecs.length,
        infographics: infographicSummaries,
        pptxSemanticHash,
        pptxQa: {
          slideCount: qa.slideCount,
          collisions: qa.collisions.length,
          wrapNoneShapes: qa.wrapNoneShapes,
          slide12Avg: qa.wordStats.slide12Avg,
          slide12Over200: qa.wordStats.slide12Over200,
          slide22Avg: qa.wordStats.slide22Avg,
          slide22Over200: qa.wordStats.slide22Over200,
          slide22MissingRubricOrObjectives: qa.wordStats.slide22MissingRubricOrObjectives,
          findingKeys: Object.keys(qa.findings).sort(),
        },
      };
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return {
    version: 1,
    fixtures,
  };
}

export async function verifySacrintGolden(): Promise<{
  passed: boolean;
  diffs: string[];
  qaFailures: string[];
  fixtureCount: number;
}> {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`Golden baseline no encontrado en ${BASELINE_PATH}. Ejecuta con --update primero.`);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as GoldenBaselineFile;
  const current = await computeCurrentGolden();
  const diffs: string[] = [];
  const qaFailures: string[] = [];

  const allKeys = new Set([...Object.keys(baseline.fixtures), ...Object.keys(current.fixtures)]);
  for (const key of [...allKeys].sort()) {
    const exp = baseline.fixtures[key];
    const act = current.fixtures[key];
    if (!exp) {
      diffs.push(`[${key}] Fixture nuevo no presente en baseline`);
      continue;
    }
    if (!act) {
      diffs.push(`[${key}] Fixture faltante en ejecución actual`);
      continue;
    }

    // Invariantes QA estrictos sobre el PPTX real
    if (act.pptxQa.collisions > 0) qaFailures.push(`[${key}] collisions=${act.pptxQa.collisions}`);
    if (act.pptxQa.wrapNoneShapes > 0) qaFailures.push(`[${key}] wrapNone=${act.pptxQa.wrapNoneShapes}`);
    if (act.pptxQa.slide12Over200 > 0) qaFailures.push(`[${key}] slide12Over200=${act.pptxQa.slide12Over200}`);
    if (act.pptxQa.slide22Over200 > 0) qaFailures.push(`[${key}] slide22Over200=${act.pptxQa.slide22Over200}`);
    if (act.pptxQa.slide22MissingRubricOrObjectives > 0) {
      qaFailures.push(`[${key}] missEval=${act.pptxQa.slide22MissingRubricOrObjectives}`);
    }
    if (act.pptxQa.findingKeys.length > 0) {
      qaFailures.push(`[${key}] findings=${act.pptxQa.findingKeys.join(',')}`);
    }

    // Comparación exacta contra baseline congelado (0-diff)
    if (exp.slideCount !== act.slideCount) {
      diffs.push(`[${key}] slideCount: expected=${exp.slideCount}, actual=${act.slideCount}`);
    }
    if (exp.infographicCount !== act.infographicCount) {
      diffs.push(`[${key}] infographicCount: expected=${exp.infographicCount}, actual=${act.infographicCount}`);
    }
    if (exp.pptxSemanticHash !== act.pptxSemanticHash) {
      diffs.push(`[${key}] pptxSemanticHash difiere (${exp.pptxSemanticHash.slice(0, 12)} -> ${act.pptxSemanticHash.slice(0, 12)})`);
    }
    if (JSON.stringify(exp.pptxQa) !== JSON.stringify(act.pptxQa)) {
      diffs.push(`[${key}] pptxQa difiere: expected=${JSON.stringify(exp.pptxQa)} actual=${JSON.stringify(act.pptxQa)}`);
    }
    const maxSlides = Math.max(exp.slides.length, act.slides.length);
    for (let i = 0; i < maxSlides; i++) {
      const es = exp.slides[i];
      const as = act.slides[i];
      if (JSON.stringify(es) !== JSON.stringify(as)) {
        diffs.push(
          `[${key}] slide[${i}] (${es?.kind ?? 'none'} "${es?.title ?? ''}") difiere: hash ${es?.contentHash.slice(0, 8)} -> ${as?.contentHash.slice(0, 8)} (words ${es?.wordCount} -> ${as?.wordCount})`
        );
      }
    }
    const maxInfos = Math.max(exp.infographics.length, act.infographics.length);
    for (let i = 0; i < maxInfos; i++) {
      const ei = exp.infographics[i];
      const ai = act.infographics[i];
      if (JSON.stringify(ei) !== JSON.stringify(ai)) {
        diffs.push(
          `[${key}] infographic[${i}] ("${ei?.title ?? ''}") difiere: hash ${ei?.contentHash.slice(0, 8)} -> ${ai?.contentHash.slice(0, 8)}`
        );
      }
    }
  }

  return {
    passed: diffs.length === 0 && qaFailures.length === 0,
    diffs,
    qaFailures,
    fixtureCount: Object.keys(current.fixtures).length,
  };
}

async function main() {
  const isUpdate = process.argv.includes('--update');
  if (isUpdate) {
    const golden = await computeCurrentGolden();
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(golden, null, 2) + '\n', 'utf8');
    const keys = Object.keys(golden.fixtures);
    console.log(`[sacrint-golden] Baseline congelado en ${BASELINE_PATH} (${keys.length} fixtures):`);
    for (const k of keys) {
      const f = golden.fixtures[k]!;
      console.log(
        `  ${k.padEnd(14)} slides=${String(f.slideCount).padStart(2)} | infos=${String(f.infographicCount).padStart(2)} | 1/2avg=${f.pptxQa.slide12Avg}w (>200:${f.pptxQa.slide12Over200}) | 2/2avg=${f.pptxQa.slide22Avg}w (>200:${f.pptxQa.slide22Over200}) | col=${f.pptxQa.collisions} | findings=[${f.pptxQa.findingKeys.join(',')}] | pptxHash=${f.pptxSemanticHash.slice(0, 12)}`
      );
    }
    return;
  }

  const res = await verifySacrintGolden();
  console.log(
    `[sacrint-golden] fixtures=${res.fixtureCount} | diffs=${res.diffs.length} | qaFailures=${res.qaFailures.length} | passed=${res.passed}`
  );
  if (res.diffs.length > 0) {
    console.error('GOLDEN DIFFS:');
    for (const d of res.diffs.slice(0, 20)) console.error('  -', d);
  }
  if (res.qaFailures.length > 0) {
    console.error('QA FAILURES:');
    for (const q of res.qaFailures) console.error('  -', q);
  }
  process.exit(res.passed ? 0 : 1);
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]).endsWith('verify-sacrint-golden.ts');
if (isEntrypoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
