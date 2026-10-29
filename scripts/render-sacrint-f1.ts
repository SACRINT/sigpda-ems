import fs from 'fs/promises';
import path from 'path';
import { MATH_DEMO_WORKBOOK } from '../src/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import {
  CHEMISTRY_DEMO_WORKBOOK,
  ENGLISH_DEMO_WORKBOOK,
  PHILOSOPHY_DEMO_WORKBOOK,
} from '../src/lib/visual-engine/sacrint/fixtures/pilot-workbooks';
import { buildSacrintDeck, buildSacrintInfographic } from '../src/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '../src/lib/visual-engine/sacrint/slide-renderer';
import { renderInfographicSvg } from '../src/lib/visual-engine/sacrint/infographic-renderer';
import { renderInfographicPng, renderSvgToPng } from '../src/lib/visual-engine/sacrint/sacrint-rasterizer';
import { generateSacrintPptx } from '../src/lib/visual-engine/sacrint/sacrint-pptx-generator';

const pilots = [
  { id: 'matematicas', workbook: MATH_DEMO_WORKBOOK },
  { id: 'quimica', workbook: CHEMISTRY_DEMO_WORKBOOK },
  { id: 'filosofia', workbook: PHILOSOPHY_DEMO_WORKBOOK },
  { id: 'ingles', workbook: ENGLISH_DEMO_WORKBOOK },
];

async function main() {
  const outRoot = path.join(process.cwd(), 'scratch', 'output', 'sacrint-f1');
  await fs.mkdir(outRoot, { recursive: true });
  const summary: Array<{ id: string; outDir: string; conceptPng: string; infographicPng: string; letterPng: string; pptx: string }> = [];

  for (const pilot of pilots) {
    const outDir = path.join(outRoot, pilot.id);
    await fs.mkdir(outDir, { recursive: true });
    const deck = buildSacrintDeck(pilot.workbook);
    const concept = renderDeckSvgs(deck)[2]!;
    const infographic = buildSacrintInfographic(pilot.workbook, 'wide');
    const letter = buildSacrintInfographic(pilot.workbook, 'letter');

    await fs.writeFile(path.join(outDir, 'concepto.svg'), concept.svg, 'utf8');
    await fs.writeFile(path.join(outDir, 'infografia-wide.svg'), renderInfographicSvg(infographic), 'utf8');
    await fs.writeFile(path.join(outDir, 'infografia-letter.svg'), renderInfographicSvg(letter), 'utf8');

    const conceptPng = path.join(outDir, 'concepto.png');
    const infographicPng = path.join(outDir, 'infografia-wide.png');
    const letterPng = path.join(outDir, 'infografia-letter.png');
    const pptx = path.join(outDir, `sacrint-${pilot.id}-m1.pptx`);
    await fs.writeFile(conceptPng, await renderSvgToPng(concept.svg, 1920, 1080));
    await fs.writeFile(infographicPng, (await renderInfographicPng(infographic)).buffer);
    await fs.writeFile(letterPng, (await renderInfographicPng(letter)).buffer);
    await fs.writeFile(pptx, await generateSacrintPptx(deck));

    summary.push({ id: pilot.id, outDir, conceptPng, infographicPng, letterPng, pptx });
  }

  console.log(JSON.stringify({ outRoot, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
