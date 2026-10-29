import fs from 'fs/promises';
import path from 'path';
import { MATH_DEMO_WORKBOOK } from '../src/lib/visual-engine/sacrint/fixtures/math-demo-workbook';
import { buildSacrintDeck, buildSacrintInfographic } from '../src/lib/visual-engine/sacrint/spec';
import { renderDeckSvgs } from '../src/lib/visual-engine/sacrint/slide-renderer';
import { renderInfographicSvg } from '../src/lib/visual-engine/sacrint/infographic-renderer';
import { renderDeckPngs, renderInfographicPng, writeRenderedPngs } from '../src/lib/visual-engine/sacrint/sacrint-rasterizer';
import { generateSacrintPptx } from '../src/lib/visual-engine/sacrint/sacrint-pptx-generator';

async function main() {
  const outDir = path.join(process.cwd(), 'scratch', 'output', 'sacrint-f0');
  await fs.mkdir(outDir, { recursive: true });

  const deck = buildSacrintDeck(MATH_DEMO_WORKBOOK, {
    xLabel: 'AÑOS DESDE EL PRIMER REGISTRO (x)',
    yLabel: 'TONELADAS COSECHADAS (y)',
  });
  const wide = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'wide', {
    xLabel: 'AÑOS DESDE EL PRIMER REGISTRO (x)',
    yLabel: 'TONELADAS COSECHADAS (y)',
  });
  const letter = buildSacrintInfographic(MATH_DEMO_WORKBOOK, 'letter', {
    xLabel: 'AÑOS DESDE EL PRIMER REGISTRO (x)',
    yLabel: 'TONELADAS COSECHADAS (y)',
  });

  for (const item of renderDeckSvgs(deck)) {
    await fs.writeFile(path.join(outDir, item.filename), item.svg, 'utf8');
  }
  await fs.writeFile(path.join(outDir, 'infografia-16x9.svg'), renderInfographicSvg(wide), 'utf8');
  await fs.writeFile(path.join(outDir, 'infografia-carta.svg'), renderInfographicSvg(letter), 'utf8');

  const pngPaths = await writeRenderedPngs(await renderDeckPngs(deck), outDir);
  pngPaths.push(...(await writeRenderedPngs([await renderInfographicPng(wide), await renderInfographicPng(letter)], outDir)));

  const pptxPath = path.join(outDir, 'sacrint-matematicas-m1.pptx');
  await fs.writeFile(pptxPath, await generateSacrintPptx(deck));

  console.log(JSON.stringify({ outDir, pptxPath, files: pngPaths }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
