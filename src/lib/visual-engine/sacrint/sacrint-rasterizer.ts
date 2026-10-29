import fs from 'fs/promises';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import type { SacrintDeckSpec, SacrintInfographicSpec } from './spec';
import { renderDeckSvgs } from './slide-renderer';
import { infographicFilename, renderInfographicSvg } from './infographic-renderer';
import { ensureSacrintFontsRegistered, getSacrintFontFiles } from './sacrint-font-bootstrap';
import { INFOGRAPHIC, SLIDE } from './tokens';

export interface RenderedPng {
  filename: string;
  buffer: Buffer;
}

export async function renderSvgToPng(svg: string, width: number, height: number, scale = 1): Promise<Buffer> {
  ensureSacrintFontsRegistered();
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);
  const raster = new Resvg(svg, {
    font: {
      fontFiles: getSacrintFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
      sansSerifFamily: 'Inter',
      defaultFontSize: 16,
    },
    fitTo: scale === 1 ? { mode: 'original' } : { mode: 'zoom', value: scale },
    background: 'rgba(0,0,0,0)',
    logLevel: 'error',
  });
  const rendered = raster.render();
  if (rendered.width !== targetWidth || rendered.height !== targetHeight) {
    throw new Error(
      `SACRINT render size mismatch: expected ${targetWidth}x${targetHeight}, got ${rendered.width}x${rendered.height}`
    );
  }
  return rendered.asPng();
}

export async function renderDeckPngs(deck: SacrintDeckSpec): Promise<RenderedPng[]> {
  const svgs = renderDeckSvgs(deck);
  const out: RenderedPng[] = [];
  for (const item of svgs) {
    out.push({
      filename: item.filename.replace(/\.svg$/, '.png'),
      buffer: await renderSvgToPng(item.svg, SLIDE.width, SLIDE.height),
    });
  }
  return out;
}

export async function renderInfographicPng(spec: SacrintInfographicSpec, scale = 1): Promise<RenderedPng> {
  const size = spec.format === 'wide' ? INFOGRAPHIC.wide : INFOGRAPHIC.letter;
  return {
    filename: infographicFilename(spec).replace(/\.svg$/, '.png'),
    buffer: await renderSvgToPng(renderInfographicSvg(spec), size.width, size.height, scale),
  };
}

export async function writeRenderedPngs(items: RenderedPng[], outDir: string): Promise<string[]> {
  await fs.mkdir(outDir, { recursive: true });
  const paths: string[] = [];
  for (const item of items) {
    const target = path.join(outDir, item.filename);
    await fs.writeFile(target, item.buffer);
    paths.push(target);
  }
  return paths;
}
