/**
 * pptx-generator.ts — Generador nativo de presentaciones PowerPoint (.pptx).
 * SIGPDA-EMS · Motor de Presentaciones (H-317)
 *
 * Convierte un SlideDeck en un archivo .pptx editable (PowerPoint, Google Slides,
 * LibreOffice Impress). Layout 16:9 (10 x 5.625 pulgadas). Determinístico, sin IA.
 */

import PptxGenJS from 'pptxgenjs';
import type { Slide, SlideDeck } from './slide-model';

const FONT_TITLE = 'Calibri';
const FONT_BODY = 'Calibri';
const W = 10;
const H = 5.625;

/** Tamaño de fuente de viñetas según cantidad y longitud total (escalado determinista). */
export function bodyFontSize(bullets: string[]): number {
  const total = bullets.reduce((s, b) => s + b.length, 0);
  if (bullets.length <= 2 && total < 260) return 20;
  if (total < 330) return 18;
  if (total < 480) return 16;
  return 14;
}

function addFooter(s: PptxGenJS.Slide, deck: SlideDeck, index: number, total: number) {
  s.addText(`${deck.meta.subjectName} · Bloque ${deck.meta.blockNumber}`, {
    x: 0.4, y: H - 0.38, w: 7, h: 0.28,
    fontFace: FONT_BODY, fontSize: 10, color: '7A8794',
  });
  s.addText(`${index} / ${total}`, {
    x: W - 1.4, y: H - 0.38, w: 1, h: 0.28,
    fontFace: FONT_BODY, fontSize: 10, color: '7A8794', align: 'right',
  });
}

function renderDark(pptx: PptxGenJS, deck: SlideDeck, slide: Slide) {
  const p = deck.palette;
  const s = pptx.addSlide();
  s.background = { color: p.primary };
  s.addShape('rect', { x: 0, y: 0, w: 0.25, h: H, fill: { color: p.accent }, line: { color: p.accent } });
  s.addText(slide.title, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.6,
    fontFace: FONT_TITLE, fontSize: slide.kind === 'cover' ? 34 : 30, bold: true,
    color: p.onPrimary, valign: 'middle', fit: 'shrink',
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.8, y: 2.85, w: 8.4, h: 0.6,
      fontFace: FONT_BODY, fontSize: 18, color: p.accent, bold: true, fit: 'shrink',
    });
  }
  if (slide.bullets?.length) {
    s.addText(slide.bullets.map((b) => ({ text: b, options: { breakLine: true } })), {
      x: 0.8, y: 3.55, w: 8.4, h: 1.5,
      fontFace: FONT_BODY, fontSize: 14, color: p.onPrimary, valign: 'top', fit: 'shrink',
    });
  }
  s.addNotes(slide.notes);
}

function renderContent(pptx: PptxGenJS, deck: SlideDeck, slide: Slide, index: number, total: number) {
  const p = deck.palette;
  const s = pptx.addSlide();
  s.background = { color: p.surface };

  // Banda superior de título
  s.addShape('rect', { x: 0, y: 0, w: W, h: 1.1, fill: { color: p.primary }, line: { color: p.primary } });
  s.addShape('rect', { x: 0, y: 1.1, w: W, h: 0.06, fill: { color: p.accent }, line: { color: p.accent } });
  s.addText(slide.title, {
    x: 0.5, y: 0.1, w: 9, h: 0.6,
    fontFace: FONT_TITLE, fontSize: 24, bold: true, color: p.onPrimary, valign: 'middle', fit: 'shrink',
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 0.5, y: 0.68, w: 9, h: 0.35,
      fontFace: FONT_BODY, fontSize: 13, color: p.highlight, valign: 'middle', fit: 'shrink',
    });
  }

  const bullets = slide.bullets ?? [];
  const hasCallout = Boolean(slide.callout);
  const bodyH = hasCallout ? 2.35 : 3.5;

  if (bullets.length) {
    s.addText(
      bullets.map((b) => ({
        text: b,
        options: { bullet: { code: '25CF' }, breakLine: true, paraSpaceAfter: 6 },
      })),
      {
        x: 0.6, y: 1.4, w: 8.8, h: bodyH,
        fontFace: FONT_BODY, fontSize: bodyFontSize(bullets), color: p.text,
        valign: 'top', fit: 'shrink',
      }
    );
  }

  if (slide.callout) {
    const cy = 1.4 + (bullets.length ? bodyH + 0.1 : 0);
    const ch = H - 0.55 - cy;
    s.addShape('roundRect', {
      x: 0.6, y: cy, w: 8.8, h: ch,
      fill: { color: p.highlight }, line: { color: p.accent, width: 1.5 }, rectRadius: 0.08,
    });
    s.addText(
      [
        { text: `${slide.callout.label}\n`, options: { bold: true, color: p.primary, fontSize: 13 } },
        { text: slide.callout.text, options: { color: p.text, fontSize: 15 } },
      ],
      { x: 0.8, y: cy + 0.05, w: 8.4, h: ch - 0.1, fontFace: FONT_BODY, valign: 'middle', fit: 'shrink' }
    );
  }

  addFooter(s, deck, index, total);
  s.addNotes(slide.notes);
}

/** Genera el binario .pptx del mazo de diapositivas. */
export async function generatePptxBuffer(deck: SlideDeck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.meta.title;
  pptx.subject = deck.meta.subjectName;
  pptx.company = deck.meta.schoolName || 'SIGPDA-EMS';
  pptx.author = deck.meta.teacherName || 'SIGPDA-EMS';

  const total = deck.slides.length;
  deck.slides.forEach((slide, i) => {
    if (slide.kind === 'cover' || slide.kind === 'closing') {
      renderDark(pptx, deck, slide);
    } else {
      renderContent(pptx, deck, slide, i + 1, total);
    }
  });

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return out as Buffer;
}
