import type { SacrintDeckSpec, SacrintFact, SacrintSlide } from './spec';
import { diagramFooterLabel, diagramModelLabel, diagramSubtitle } from './diagrams';
import { SACRINT, SACRINT_TYPE, SLIDE } from './tokens';
import { measureText, singleLine, textBlock, uppercaseLabel } from './text-layout';
import { styleCoverArt } from './style-art';
import {
  chip,
  circle,
  cornerMarks,
  diagramSvg,
  footer,
  line,
  panel,
  progressRail,
  rect,
  sectionLabel,
  svgDocument,
  topHud,
} from './svg-primitives';

const W = SLIDE.width;
const H = SLIDE.height;

function accentPair(deck: SacrintDeckSpec): { accent: string; accent2: string } {
  return { accent: deck.pack.accent, accent2: deck.pack.accent2 };
}

function glow(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  return circle(cx, cy, r, fill, `opacity="${opacity}"`);
}

function factStrip(facts: SacrintFact[], x: number, y: number, width: number): string {
  const gap = 12;
  const tileWidth = (width - gap * (facts.length - 1)) / facts.length;
  return facts
    .map((fact, index) => {
      const tx = x + index * (tileWidth + gap);
      return `<g>${panel(tx, y, tileWidth, 84, { fill: 'rgba(5,12,20,0.58)', radius: 12, stroke: SACRINT.strokeSoft })}
${singleLine(uppercaseLabel(fact.label), tx + 16, y + 26, { fill: SACRINT.muted, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 })}
${singleLine(fact.value, tx + 16, y + 62, { fill: SACRINT.white, fontSize: 28, family: 'display', weight: 'bold' })}</g>`;
    })
    .join('');
}

function renderCover(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'cover' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const leftX = 80;
  const leftW = 940;
  const parts: string[] = [];

  parts.push(glow(300, 240, 560, 'url(#sacrint-glow-gold)', 0.9));
  parts.push(glow(1750, 900, 620, 'url(#sacrint-glow-blue)', 0.85));
  parts.push(topHud(W, `${deck.pack.short} / SACRINT`, `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} · ${deck.meta.blockName}`, accent));

  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 224, { fill: accent, fontSize: 14, weight: 'semibold', letterSpacing: 2.4 }));
  parts.push(line(leftX, 242, leftX + 340, 242, accent, 2, 'stroke-opacity="0.9"'));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 332,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: SACRINT_TYPE.h1,
    minFontSize: 46,
    maxLines: 4,
    lineHeightRatio: 1.03,
    letterSpacing: -1.4,
    truncate: false,
  });
  parts.push(title.svg);

  const subtitleY = 332 + title.fitted.height + 30;
  const subtitle = textBlock(slide.subtitle ?? '', leftW, {
    x: leftX,
    y: subtitleY,
    fill: SACRINT.textSoft,
    family: 'body',
    weight: 'regular',
    maxFontSize: 26,
    minFontSize: 18,
    maxLines: 2,
    lineHeightRatio: 1.3,
  });
  parts.push(subtitle.svg);

  parts.push(singleLine(uppercaseLabel(slide.metaLine), leftX, subtitleY + subtitle.fitted.height + 42, { fill: SACRINT.muted, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(factStrip(slide.facts, leftX, 876, leftW));
  const paecNote = textBlock(slide.footerNote, leftW, {
    x: leftX,
    y: 984,
    fill: SACRINT.muted,
    maxFontSize: 12,
    minFontSize: 9.5,
    maxLines: 2,
    lineHeightRatio: 1.25,
    truncate: false,
  });
  parts.push(paecNote.svg);
  parts.push(styleCoverArt(deck.style.id, 1140, 150, 700, 760, accent, accent2));
  parts.push(footer(W, H, `${deck.meta.schoolName}  ·  ${deck.meta.teacherName}`, `${accent2 === SACRINT.blue ? 'SIGPDA / EMS' : 'SACRINT'}  ·  EMS`, accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderHook(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'hook' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 980;
  const rightX = 1120;
  const rightW = 720;

  parts.push(glow(1450, 260, 620, 'url(#sacrint-glow-blue)', 0.8));
  parts.push(glow(200, 900, 560, 'url(#sacrint-glow-gold)', 0.55));
  parts.push(topHud(W, 'FENÓMENO SITUADO', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONTEXTO`, accent));
  parts.push(progressRail(80, 116, 420, 2, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 220,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 58,
    minFontSize: 36,
    maxLines: 2,
    lineHeightRatio: 1.04,
    letterSpacing: -0.8,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.subtitle ?? ''), leftX, 220 + title.fitted.height + 26, { fill: accent, fontSize: 13, weight: 'semibold', letterSpacing: 2.2 }));

  parts.push(singleLine('“', leftX + 2, 442, { fill: accent, fontSize: 92, family: 'display', weight: 'bold', opacity: 0.45 }));
  const story = textBlock(slide.story, leftW - 70, {
    x: leftX + 66,
    y: 420,
    fill: SACRINT.text,
    family: 'body',
    weight: 'regular',
    maxFontSize: 25,
    minFontSize: 13.5,
    maxLines: 14,
    lineHeightRatio: 1.35,
    truncate: false,
  });
  parts.push(story.svg);
  parts.push(line(leftX + 66, Math.min(826, 420 + story.fitted.height + 24), leftX + leftW, Math.min(826, 420 + story.fitted.height + 24), accent, 1, 'stroke-opacity="0.35"'));

  parts.push(panel(rightX, 166, rightW, 276, { fill: 'rgba(7,17,29,0.86)', radius: 22 }));
  parts.push(rect(rightX, 166, 4, 276, `fill="${accent}"`));
  parts.push(chip(rightX + 28, 194, 'PREGUNTA DETONADORA', accent));
  const question = textBlock(slide.question, rightW - 56, {
    x: rightX + 28,
    y: 282,
    fill: SACRINT.white,
    family: 'display',
    weight: 'medium',
    maxFontSize: 31,
    minFontSize: 20,
    maxLines: 4,
    lineHeightRatio: 1.28,
  });
  parts.push(question.svg);

  const nodeY = 486;
  const nodeH = 118;
  slide.nodes.slice(0, 3).forEach((node, index) => {
    const y = nodeY + index * (nodeH + 14);
    parts.push(panel(rightX, y, rightW, nodeH, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), rightX + 22, y + 34, { fill: accent2, fontSize: 12, weight: 'semibold', letterSpacing: 1.6 }));
    parts.push(singleLine(uppercaseLabel(node.label), rightX + 62, y + 34, { fill: accent, fontSize: 11, weight: 'semibold', letterSpacing: 1.8 }));
    const detail = textBlock(node.detail, rightW - 92, {
      x: rightX + 62,
      y: y + 66,
      fill: SACRINT.textSoft,
      maxFontSize: 16,
      minFontSize: 12,
      maxLines: 2,
      lineHeightRatio: 1.35,
    });
    parts.push(detail.svg);
  });

  parts.push(factStrip(slide.facts, leftX, 854, leftW));
  parts.push(footer(W, H, deck.meta.blockName, 'observar · modelar · decidir', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderConcept(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'concept' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 700;
  const graphX = 824;
  const graphY = 174;
  const graphW = 1016;
  const graphH = 574;

  parts.push(glow(1420, 420, 700, 'url(#sacrint-glow-blue)', 0.75));
  parts.push(glow(260, 300, 430, 'url(#sacrint-glow-gold)', 0.45));
  parts.push(topHud(W, 'NÚCLEO TÉCNICO', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONCEPTO CERO`, accent));
  parts.push(progressRail(80, 116, 420, 3, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 216,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 46,
    minFontSize: 30,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.subtitle ?? ''), leftX, 216 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 354, leftW, 232, { fill: 'rgba(8,17,29,0.78)', radius: 18 }));
  parts.push(sectionLabel(leftX + 24, 386, leftW - 48, 'Analogía física', accent, 'A'));
  const analogy = textBlock(slide.analogy, leftW - 48, {
    x: leftX + 24,
    y: 424,
    fill: SACRINT.text,
    maxFontSize: 19,
    minFontSize: 13,
    maxLines: 7,
    lineHeightRatio: 1.42,
    truncate: true,
  });
  parts.push(analogy.svg);

  parts.push(panel(leftX, 606, leftW, 182, { fill: 'rgba(30,8,12,0.5)', radius: 18, stroke: 'rgba(255,49,49,0.42)' }));
  parts.push(sectionLabel(leftX + 24, 638, leftW - 48, 'Error común', SACRINT.red, 'B'));
  const misconception = textBlock(slide.misconception, leftW - 48, {
    x: leftX + 24,
    y: 676,
    fill: SACRINT.textSoft,
    maxFontSize: 17,
    minFontSize: 12,
    maxLines: 4,
    lineHeightRatio: 1.4,
    truncate: true,
  });
  parts.push(misconception.svg);

  parts.push(panel(graphX, graphY, graphW, graphH, { fill: 'rgba(4,10,18,0.8)', radius: 22 }));
  parts.push(cornerMarks(graphX, graphY, graphW, graphH, accent, 18, 14));
  parts.push(sectionLabel(graphX + 28, graphY + 42, graphW - 56, diagramModelLabel(slide.diagram), accent2, 'FIG. 01'));

  const formulaW = Math.min(graphW - 56, Math.max(320, measureText(slide.formula, 30, 'display', 'bold') + 56));
  parts.push(rect(graphX + 28, graphY + 62, formulaW, 54, `rx="12" fill="${SACRINT.canvas}" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"`));
  parts.push(singleLine(slide.formula, graphX + 56, graphY + 98, { fill: accent, fontSize: 27, family: 'display', weight: 'bold', letterSpacing: 0.6 }));

  parts.push(diagramSvg(slide.diagram, graphX + 20, graphY + 132, graphW - 40, graphH - 152, { accent, accent2, showTriangle: true }));

  const varY = 802;
  const varGap = 12;
  const varW = (W - 160 - varGap * 3) / 4;
  slide.variables.forEach((variable, index) => {
    const x = 80 + index * (varW + varGap);
    parts.push(panel(x, varY, varW, 132, { fill: 'rgba(6,14,24,0.72)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(singleLine(variable.symbol, x + 20, varY + 52, { fill: index % 2 === 0 ? accent : accent2, fontSize: 34, family: 'display', weight: 'bold' }));
    parts.push(singleLine(uppercaseLabel(variable.label), x + 62, varY + 38, { fill: SACRINT.muted, fontSize: 10, weight: 'semibold', letterSpacing: 1.2 }));
    const meaning = textBlock(variable.meaning, varW - 82, {
      x: x + 62,
      y: varY + 64,
      fill: SACRINT.textSoft,
      maxFontSize: 14,
      minFontSize: 10,
      maxLines: 3,
      lineHeightRatio: 1.3,
    });
    parts.push(meaning.svg);
  });

  parts.push(footer(W, H, `${diagramSubtitle(slide.diagram)} · Concepto cero`, diagramFooterLabel(slide.diagram), accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderClosing(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'closing' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 1000;
  const rightX = 1136;
  const rightW = 704;

  parts.push(glow(1500, 760, 600, 'url(#sacrint-glow-gold)', 0.6));
  parts.push(glow(320, 240, 460, 'url(#sacrint-glow-blue)', 0.55));
  parts.push(topHud(W, 'CIERRE FORMATIVO', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // METACOGNICIÓN`, accent));
  parts.push(progressRail(80, 116, 420, 8, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 220,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 54,
    minFontSize: 36,
    maxLines: 1,
    letterSpacing: -0.8,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 220 + title.fitted.height + 28, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 344, leftW, 232, { fill: 'rgba(7,16,28,0.82)', radius: 20 }));
  parts.push(chip(leftX + 24, 370, 'TICKET DE SALIDA', accent));
  const checkpoint = textBlock(slide.checkpoint, leftW - 48, {
    x: leftX + 24,
    y: 444,
    fill: SACRINT.white,
    family: 'display',
    weight: 'medium',
    maxFontSize: 30,
    minFontSize: 19,
    maxLines: 4,
    lineHeightRatio: 1.28,
  });
  parts.push(checkpoint.svg);

  parts.push(sectionLabel(leftX, 626, leftW, 'Criterios de logro', accent2, `${slide.criteria.length}`));
  const criteria = slide.criteria.slice(0, 4);
  criteria.forEach((criterion, index) => {
    const y = 664 + index * 62;
    parts.push(panel(leftX, y, leftW, 50, { fill: 'rgba(5,12,20,0.52)', radius: 10, stroke: SACRINT.strokeSoft }));
    parts.push(circle(leftX + 24, y + 25, 5, index === 0 ? accent : accent2));
    const text = textBlock(criterion, leftW - 72, {
      x: leftX + 42,
      y: y + 20,
      fill: SACRINT.textSoft,
      maxFontSize: 16,
      minFontSize: 11,
      maxLines: 2,
      lineHeightRatio: 1.25,
      truncate: true,
    });
    parts.push(text.svg);
  });

  parts.push(panel(rightX, 166, rightW, 570, { fill: 'rgba(6,14,24,0.78)', radius: 22 }));
  parts.push(sectionLabel(rightX + 26, 204, rightW - 52, 'Semáforo metacognitivo', accent, '3'));
  const lights: Array<{ color: string; label: string; text: string }> = [
    { color: SACRINT.emerald, label: 'VERDE', text: slide.trafficLight.green },
    { color: SACRINT.amber, label: 'ÁMBAR', text: slide.trafficLight.yellow },
    { color: SACRINT.red, label: 'ROJO', text: slide.trafficLight.red },
  ];
  lights.forEach((light, index) => {
    const y = 232 + index * 148;
    parts.push(panel(rightX + 26, y, rightW - 52, 130, { fill: 'rgba(4,10,18,0.52)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(circle(rightX + 62, y + 40, 15, light.color, `fill-opacity="0.18" stroke="${light.color}" stroke-width="2"`));
    parts.push(circle(rightX + 62, y + 40, 6, light.color));
    parts.push(singleLine(light.label, rightX + 92, y + 34, { fill: light.color, fontSize: 12, weight: 'semibold', letterSpacing: 1.8 }));
    const text = textBlock(light.text, rightW - 150, {
      x: rightX + 92,
      y: y + 58,
      fill: SACRINT.textSoft,
      maxFontSize: 15,
      minFontSize: 10,
      maxLines: 3,
      lineHeightRatio: 1.3,
      truncate: true,
    });
    parts.push(text.svg);
  });

  parts.push(singleLine('REGISTRO DE LA MISIÓN', rightX + 26, 776, { fill: accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
  parts.push(factStrip(slide.facts, rightX + 26, 794, rightW - 52));

  parts.push(panel(leftX, 902, W - 160, 76, { fill: 'rgba(5,12,20,0.6)', radius: 12, stroke: SACRINT.strokeSoft }));
  parts.push(singleLine('REFLEXIÓN', leftX + 22, 930, { fill: accent, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
  const reflection = textBlock(slide.reflection, W - 260, {
    x: leftX + 112,
    y: 930,
    fill: SACRINT.textSoft,
    maxFontSize: 16,
    minFontSize: 11,
    maxLines: 2,
    lineHeightRatio: 1.3,
  });
  parts.push(reflection.svg);
  parts.push(footer(W, H, 'Cierre formativo · Metacognición', 'evidencia · autonomía · mejora', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderDemo(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'demo' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 860;
  const rightX = 992;
  const rightW = 848;

  parts.push(glow(1480, 300, 620, 'url(#sacrint-glow-blue)', 0.7));
  parts.push(glow(240, 860, 520, 'url(#sacrint-glow-gold)', 0.5));
  parts.push(topHud(W, 'YO HAGO', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // DEMOSTRACIÓN`, accent));
  parts.push(progressRail(80, 116, 420, 4, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 214,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 46,
    minFontSize: 30,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 214 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 344, leftW, 268, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
  parts.push(sectionLabel(leftX + 24, 376, leftW - 48, 'Demostración guiada', accent, 'A'));
  const demoText = textBlock(slide.demoText, leftW - 48, {
    x: leftX + 24,
    y: 416,
    fill: SACRINT.text,
    maxFontSize: 20,
    minFontSize: 13,
    maxLines: 9,
    lineHeightRatio: 1.4,
    truncate: true,
  });
  parts.push(demoText.svg);

  if (slide.problemStatement) {
    parts.push(panel(leftX, 632, leftW, 128, { fill: 'rgba(5,12,20,0.62)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(sectionLabel(leftX + 24, 660, leftW - 48, 'Problema resuelto', accent2, 'B'));
    const problem = textBlock(slide.problemStatement, leftW - 48, {
      x: leftX + 24,
      y: 696,
      fill: SACRINT.textSoft,
      maxFontSize: 16,
      minFontSize: 12,
      maxLines: 2,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(problem.svg);
  }

  if (slide.interpretation) {
    parts.push(panel(leftX, 778, leftW, 100, { fill: 'rgba(6,20,16,0.55)', radius: 14, stroke: 'rgba(52,211,153,0.35)' }));
    parts.push(singleLine(uppercaseLabel('Interpretación'), leftX + 24, 808, { fill: SACRINT.emerald, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
    const interp = textBlock(slide.interpretation, leftW - 48, {
      x: leftX + 24,
      y: 832,
      fill: SACRINT.textSoft,
      maxFontSize: 15,
      minFontSize: 11,
      maxLines: 2,
      lineHeightRatio: 1.3,
      truncate: true,
    });
    parts.push(interp.svg);
  }

  parts.push(sectionLabel(rightX, 190, rightW, 'Pasos del procedimiento', accent2, `${slide.steps.length}`));
  slide.steps.slice(0, 5).forEach((step, index) => {
    const y = 226 + index * 118;
    parts.push(panel(rightX, y, rightW, 104, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), rightX + 22, y + 38, { fill: accent2, fontSize: 13, weight: 'semibold', letterSpacing: 1.6 }));
    const body = textBlock(step, rightW - 80, {
      x: rightX + 62,
      y: y + 30,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 12,
      maxLines: 3,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(body.svg);
  });

  parts.push(footer(W, H, `${deck.meta.blockName} · Yo hago`, 'modelar · explicar · verificar', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderPractice(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'practice' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 900;
  const rightX = 1032;
  const rightW = 808;

  parts.push(glow(320, 260, 520, 'url(#sacrint-glow-gold)', 0.55));
  parts.push(glow(1560, 820, 600, 'url(#sacrint-glow-blue)', 0.65));
  parts.push(topHud(W, 'HACEMOS', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // PRÁCTICA GUIADA`, accent));
  parts.push(progressRail(80, 116, 420, 5, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 214,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 46,
    minFontSize: 30,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 214 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 344, leftW, 330, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
  parts.push(sectionLabel(leftX + 24, 376, leftW - 48, 'Práctica colaborativa', accent, 'A'));
  const practiceText = textBlock(slide.practiceText, leftW - 48, {
    x: leftX + 24,
    y: 416,
    fill: SACRINT.text,
    maxFontSize: 21,
    minFontSize: 13,
    maxLines: 11,
    lineHeightRatio: 1.42,
    truncate: true,
  });
  parts.push(practiceText.svg);

  if (slide.hint) {
    parts.push(panel(leftX, 696, leftW, 140, { fill: 'rgba(30,24,8,0.5)', radius: 14, stroke: 'rgba(251,191,36,0.4)' }));
    parts.push(sectionLabel(leftX + 24, 724, leftW - 48, 'Pista · Prevención de errores', SACRINT.amber, 'B'));
    const hint = textBlock(slide.hint, leftW - 48, {
      x: leftX + 24,
      y: 762,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 12,
      maxLines: 3,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(hint.svg);
  }

  parts.push(sectionLabel(rightX, 190, rightW, 'Andamiaje de la práctica', accent2, `${slide.checkpoints.length}`));
  slide.checkpoints.slice(0, 4).forEach((checkpoint, index) => {
    const y = 226 + index * 142;
    parts.push(panel(rightX, y, rightW, 124, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(circle(rightX + 34, y + 36, 12, 'none', `stroke="${accent2}" stroke-width="2"`));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), rightX + 26, y + 40, { fill: accent2, fontSize: 10, weight: 'semibold' }));
    const body = textBlock(checkpoint, rightW - 96, {
      x: rightX + 62,
      y: y + 28,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 12,
      maxLines: 4,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(body.svg);
  });

  parts.push(footer(W, H, `${deck.meta.blockName} · Hacemos juntos`, 'practicar · comparar · ajustar', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderChallenge(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'challenge' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 940;
  const rightX = 1072;
  const rightW = 768;

  parts.push(glow(1500, 280, 620, 'url(#sacrint-glow-gold)', 0.6));
  parts.push(glow(260, 880, 520, 'url(#sacrint-glow-blue)', 0.55));
  parts.push(topHud(W, 'TÚ HACES', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RETO Y PROYECTO`, accent));
  parts.push(progressRail(80, 116, 420, 6, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 214,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 46,
    minFontSize: 30,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 214 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 344, leftW, 288, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
  parts.push(sectionLabel(leftX + 24, 376, leftW - 48, 'Reto autónomo', accent, 'A'));
  const challengeText = textBlock(slide.challengeText, leftW - 48, {
    x: leftX + 24,
    y: 416,
    fill: SACRINT.text,
    maxFontSize: 21,
    minFontSize: 13,
    maxLines: 10,
    lineHeightRatio: 1.42,
    truncate: true,
  });
  parts.push(challengeText.svg);

  parts.push(panel(leftX, 654, leftW, 158, { fill: 'rgba(5,12,20,0.62)', radius: 14, stroke: SACRINT.strokeSoft }));
  parts.push(sectionLabel(leftX + 24, 682, leftW - 48, 'Producto integrador', accent2, 'B'));
  const artifact = textBlock(slide.artifactName, leftW - 48, {
    x: leftX + 24,
    y: 722,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 22,
    minFontSize: 13,
    maxLines: 2,
    lineHeightRatio: 1.14,
    truncate: true,
  });
  parts.push(artifact.svg);
  const utility = textBlock(slide.communityUtility, leftW - 48, {
    x: leftX + 24,
    y: 722 + artifact.fitted.height + 9,
    fill: SACRINT.textSoft,
    maxFontSize: 13,
    minFontSize: 10,
    maxLines: 2,
    lineHeightRatio: 1.25,
    truncate: true,
  });
  parts.push(utility.svg);

  if (slide.phases.length > 0) {
    parts.push(sectionLabel(rightX, 190, rightW, 'Fases del proyecto', accent2, `${slide.phases.length}`));
    slide.phases.slice(0, 3).forEach((phase, index) => {
      const y = 226 + index * 118;
      parts.push(panel(rightX, y, rightW, 102, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
      parts.push(singleLine(`FASE ${String(index + 1).padStart(2, '0')}`, rightX + 22, y + 34, { fill: accent2, fontSize: 11, weight: 'semibold', letterSpacing: 1.6 }));
      parts.push(singleLine(`${phase.hours} h`, rightX + rightW - 90, y + 34, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 1.2 }));
      const body = textBlock(phase.title, rightW - 130, {
        x: rightX + 22,
        y: y + 56,
        fill: SACRINT.textSoft,
        maxFontSize: 17,
        minFontSize: 12,
        maxLines: 2,
        lineHeightRatio: 1.3,
        truncate: true,
      });
      parts.push(body.svg);
    });
  }

  parts.push(panel(rightX, 654, rightW, 158, { fill: 'rgba(6,20,16,0.55)', radius: 14, stroke: 'rgba(52,211,153,0.35)' }));
  parts.push(singleLine(uppercaseLabel('Entrega comunitaria'), rightX + 24, 686, { fill: SACRINT.emerald, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
  const delivery = textBlock('Integra el reto al producto del proyecto y regístralo en tu bitácora de avance.', rightW - 48, {
    x: rightX + 24,
    y: 720,
    fill: SACRINT.textSoft,
    maxFontSize: 16,
    minFontSize: 11,
    maxLines: 3,
    lineHeightRatio: 1.35,
    truncate: true,
  });
  parts.push(delivery.svg);

  parts.push(footer(W, H, `${deck.meta.blockName} · Tú haces`, 'aplicar · integrar · entregar', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderEvidence(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'evidence' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 1020;
  const rightX = 1152;
  const rightW = 688;

  parts.push(glow(1420, 760, 600, 'url(#sacrint-glow-blue)', 0.6));
  parts.push(glow(300, 240, 460, 'url(#sacrint-glow-gold)', 0.5));
  parts.push(topHud(W, 'EVIDENCIA', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RÚBRICA Y CRITERIOS`, accent));
  parts.push(progressRail(80, 116, 420, 7, 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 214,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 50,
    minFontSize: 34,
    maxLines: 1,
    letterSpacing: -0.8,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 214 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 320, leftW, 138, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
  parts.push(chip(leftX + 24, 346, 'PREGUNTA GUÍA', accent));
  const checkpoint = textBlock(slide.checkpoint, leftW - 48, {
    x: leftX + 24,
    y: 404,
    fill: SACRINT.white,
    family: 'display',
    weight: 'medium',
    maxFontSize: 26,
    minFontSize: 17,
    maxLines: 2,
    lineHeightRatio: 1.28,
    truncate: true,
  });
  parts.push(checkpoint.svg);

  parts.push(sectionLabel(leftX, 492, leftW, 'Rúbrica de evaluación', accent2, `${slide.rubric.length}`));
  slide.rubric.slice(0, 4).forEach((item, index) => {
    const y = 528 + index * 84;
    parts.push(panel(leftX, y, leftW, 70, { fill: 'rgba(5,12,20,0.55)', radius: 12, stroke: SACRINT.strokeSoft }));
    parts.push(circle(leftX + 26, y + 35, 5, index % 2 === 0 ? accent : accent2));
    const label = textBlock(item.label, leftW - 180, {
      x: leftX + 46,
      y: y + 22,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 12,
      maxLines: 2,
      lineHeightRatio: 1.25,
      truncate: true,
    });
    parts.push(label.svg);
    if (item.weight != null) {
      parts.push(singleLine(`${item.weight}%`, leftX + leftW - 86, y + 44, { fill: accent, fontSize: 18, family: 'display', weight: 'bold' }));
    }
  });

  const validChecklist = slide.checklist.map((c) => c.trim()).filter(Boolean).slice(0, 5);
  const slotCount = Math.max(1, validChecklist.length);
  const slotStep = Math.floor(540 / slotCount);
  const slotHeight = Math.min(108, slotStep - 14);
  parts.push(panel(rightX, 166, rightW, 646, { fill: 'rgba(6,14,24,0.78)', radius: 22 }));
  parts.push(sectionLabel(rightX + 26, 204, rightW - 52, 'Checklist de verificación', accent, `${validChecklist.length}`));
  validChecklist.forEach((item, index) => {
    const y = 248 + index * slotStep;
    parts.push(panel(rightX + 26, y, rightW - 52, slotHeight, { fill: 'rgba(4,10,18,0.52)', radius: 12, stroke: SACRINT.strokeSoft }));
    parts.push(rect(rightX + 46, y + Math.floor((slotHeight - 16) / 2), 16, 16, `rx="4" fill="none" stroke="${accent2}" stroke-width="2"`));
    const body = textBlock(item, rightW - 120, {
      x: rightX + 78,
      y: y + 22,
      fill: SACRINT.textSoft,
      maxFontSize: 15,
      minFontSize: 11,
      maxLines: 3,
      lineHeightRatio: 1.3,
      truncate: false,
    });
    parts.push(body.svg);
  });

  parts.push(panel(rightX, 832, rightW, 76, { fill: 'rgba(5,12,20,0.6)', radius: 12, stroke: SACRINT.strokeSoft }));
  parts.push(singleLine('REFLEXIÓN', rightX + 22, 860, { fill: accent, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
  const reflection = textBlock(slide.reflection, rightW - 130, {
    x: rightX + 112,
    y: 856,
    fill: SACRINT.textSoft,
    maxFontSize: 14,
    minFontSize: 10,
    maxLines: 2,
    lineHeightRatio: 1.3,
    truncate: true,
  });
  parts.push(reflection.svg);

  parts.push(footer(W, H, `${deck.meta.blockName} · Evidencia de logro`, 'criterios · rúbrica · verificación', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

export function renderSlideSvg(deck: SacrintDeckSpec, slide: SacrintSlide): string {
  switch (slide.kind) {
    case 'cover':
      return renderCover(deck, slide);
    case 'hook':
      return renderHook(deck, slide);
    case 'concept':
      return renderConcept(deck, slide);
    case 'demo':
      return renderDemo(deck, slide);
    case 'practice':
      return renderPractice(deck, slide);
    case 'challenge':
      return renderChallenge(deck, slide);
    case 'evidence':
      return renderEvidence(deck, slide);
    case 'closing':
      return renderClosing(deck, slide);
  }
}

export function renderDeckSvgs(deck: SacrintDeckSpec): Array<{ kind: SacrintSlide['kind']; filename: string; svg: string }> {
  return deck.slides.map((slide, index) => ({
    kind: slide.kind,
    filename: `${String(index + 1).padStart(2, '0')}-${slide.kind}.svg`,
    svg: renderSlideSvg(deck, slide),
  }));
}
