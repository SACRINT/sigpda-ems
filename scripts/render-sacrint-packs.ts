import fs from 'fs/promises';
import path from 'path';
import { MATH_DEMO_WORKBOOK } from '../src/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import {
  CHEMISTRY_DEMO_WORKBOOK,
  ENGLISH_DEMO_WORKBOOK,
  PHILOSOPHY_DEMO_WORKBOOK,
} from '../src/lib/visual-engine/sacrint/fixtures/pilot-workbooks';
import {
  BIOLOGY_DEMO_WORKBOOK,
  GENERAL_DEMO_WORKBOOK,
  HEALTH_DEMO_WORKBOOK,
  HISTORY_DEMO_WORKBOOK,
  LABOR_DEMO_WORKBOOK,
  LITERATURE_DEMO_WORKBOOK,
  PHYSICS_DEMO_WORKBOOK,
  TECHNOLOGY_DEMO_WORKBOOK,
} from '../src/lib/visual-engine/sacrint/fixtures/extended-workbooks';
import {
  ARTS_DEMO_WORKBOOK,
  PHYSICAL_EDUCATION_DEMO_WORKBOOK,
  SOCIOEMOTIONAL_DEMO_WORKBOOK,
} from '../src/lib/visual-engine/sacrint/fixtures/new-packs-workbooks';
import { buildSacrintDeck, buildSacrintInfographic } from '../src/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '../src/lib/visual-engine/sacrint/slide-renderer';
import { renderInfographicSvg } from '../src/lib/visual-engine/sacrint/infographic-renderer';
import { renderInfographicPng, renderSvgToPng } from '../src/lib/visual-engine/sacrint/sacrint-rasterizer';
import { generateSacrintPptx } from '../src/lib/visual-engine/sacrint/sacrint-pptx-generator';

const packs = [
  { id: 'matematicas', workbook: MATH_DEMO_WORKBOOK },
  { id: 'fisica', workbook: PHYSICS_DEMO_WORKBOOK },
  { id: 'quimica', workbook: CHEMISTRY_DEMO_WORKBOOK },
  { id: 'biologia', workbook: BIOLOGY_DEMO_WORKBOOK },
  { id: 'salud', workbook: HEALTH_DEMO_WORKBOOK },
  { id: 'filosofia', workbook: PHILOSOPHY_DEMO_WORKBOOK },
  { id: 'literatura', workbook: LITERATURE_DEMO_WORKBOOK },
  { id: 'ingles', workbook: ENGLISH_DEMO_WORKBOOK },
  { id: 'historia', workbook: HISTORY_DEMO_WORKBOOK },
  { id: 'tecnologia', workbook: TECHNOLOGY_DEMO_WORKBOOK },
  { id: 'laboral', workbook: LABOR_DEMO_WORKBOOK },
  { id: 'artes', workbook: ARTS_DEMO_WORKBOOK },
  { id: 'educacion_fisica', workbook: PHYSICAL_EDUCATION_DEMO_WORKBOOK },
  { id: 'socioemocional', workbook: SOCIOEMOTIONAL_DEMO_WORKBOOK },
  { id: 'general', workbook: GENERAL_DEMO_WORKBOOK },
];

async function main() {
  const outRoot = path.join(process.cwd(), 'scratch', 'output', 'sacrint-packs');
  await fs.mkdir(outRoot, { recursive: true });
  const summary: Array<{
    id: string;
    pack: string;
    diagram: string;
    outDir: string;
    conceptPng: string;
    infographicPng: string;
    letterPng: string;
    pptx: string;
  }> = [];

  for (const pilot of packs) {
    const outDir = path.join(outRoot, pilot.id);
    await fs.mkdir(outDir, { recursive: true });
    const deck = buildSacrintDeck(pilot.workbook);
    const svgs = renderDeckSvgs(deck);
    const concept = svgs[2]!;
    const infographic = buildSacrintInfographic(pilot.workbook, 'wide');
    const letter = buildSacrintInfographic(pilot.workbook, 'letter');

    await fs.writeFile(path.join(outDir, 'concepto.svg'), concept.svg, 'utf8');
    await fs.writeFile(path.join(outDir, 'infografia-wide.svg'), renderInfographicSvg(infographic), 'utf8');
    await fs.writeFile(path.join(outDir, 'infografia-letter.svg'), renderInfographicSvg(letter), 'utf8');

    const slidesDir = path.join(outDir, 'slides');
    await fs.mkdir(slidesDir, { recursive: true });
    const newKinds = new Set(['demo', 'practice', 'challenge', 'evidence']);
    for (const slideSvg of svgs) {
      await fs.writeFile(path.join(slidesDir, slideSvg.filename), slideSvg.svg, 'utf8');
      if (newKinds.has(slideSvg.kind)) {
        const pngName = slideSvg.filename.replace(/\.svg$/, '.png');
        await fs.writeFile(path.join(slidesDir, pngName), await renderSvgToPng(slideSvg.svg, 1920, 1080));
      }
    }

    const conceptPng = path.join(outDir, 'concepto.png');
    const infographicPng = path.join(outDir, 'infografia-wide.png');
    const letterPng = path.join(outDir, 'infografia-letter.png');
    const pptx = path.join(outDir, `sacrint-${pilot.id}-m1.pptx`);
    await fs.writeFile(conceptPng, await renderSvgToPng(concept.svg, 1920, 1080));
    await fs.writeFile(infographicPng, (await renderInfographicPng(infographic)).buffer);
    await fs.writeFile(letterPng, (await renderInfographicPng(letter)).buffer);
    await fs.writeFile(pptx, await generateSacrintPptx(deck));

    const conceptSlide = deck.slides[2];
    const diagram = conceptSlide.kind === 'concept' ? conceptSlide.diagram.kind : 'unknown';
    summary.push({
      id: pilot.id,
      pack: deck.pack.id,
      diagram,
      outDir,
      conceptPng,
      infographicPng,
      letterPng,
      pptx,
    });
  }

  console.log(JSON.stringify({ outRoot, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
