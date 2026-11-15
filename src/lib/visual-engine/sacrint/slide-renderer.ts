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

  if (slide.topicsCovered && slide.topicsCovered.length > 0) {
    const topicsY = subtitleY + subtitle.fitted.height + 76;
    parts.push(panel(leftX, topicsY, leftW, 250, { fill: 'rgba(6,14,24,0.72)', radius: 16, stroke: SACRINT.strokeSoft }));
    parts.push(sectionLabel(leftX + 20, topicsY + 24, leftW - 40, 'Temas y clases incluidas', accent, `${slide.topicsCovered.length}`));
    slide.topicsCovered.slice(0, 6).forEach((topic, idx) => {
      const ty = topicsY + 46 + idx * 32;
      const itemBlock = textBlock(topic, leftW - 44, {
        x: leftX + 22,
        y: ty + 8,
        fill: SACRINT.textSoft,
        maxFontSize: 14,
        minFontSize: 10.5,
        maxLines: 1,
        lineHeightRatio: 1.2,
        truncate: false,
      });
      parts.push(itemBlock.svg);
    });
  }

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
    maxFontSize: 52,
    minFontSize: 32,
    maxLines: 2,
    lineHeightRatio: 1.04,
    letterSpacing: -0.8,
    truncate: true,
  });
  parts.push(title.svg);
  const subY = 220 + title.fitted.height + 18;
  parts.push(singleLine(uppercaseLabel(slide.subtitle ?? ''), leftX, subY, { fill: accent, fontSize: 13, weight: 'semibold', letterSpacing: 2.2 }));

  const storyY = Math.max(370, subY + 32);
  parts.push(singleLine('“', leftX + 2, storyY + 22, { fill: accent, fontSize: 80, family: 'display', weight: 'bold', opacity: 0.45 }));
  const story = textBlock(slide.story, leftW - 70, {
    x: leftX + 66,
    y: storyY,
    fill: SACRINT.text,
    family: 'body',
    weight: 'regular',
    maxFontSize: 23,
    minFontSize: 17,
    maxLines: 6,
    lineHeightRatio: 1.35,
    truncate: true,
  });
  parts.push(story.svg);
  parts.push(line(leftX + 66, Math.min(826, storyY + story.fitted.height + 20), leftX + leftW, Math.min(826, storyY + story.fitted.height + 20), accent, 1, 'stroke-opacity="0.35"'));

  parts.push(panel(rightX, 166, rightW, 250, { fill: 'rgba(7,17,29,0.86)', radius: 22 }));
  parts.push(rect(rightX, 166, 4, 250, `fill="${accent}"`));
  parts.push(chip(rightX + 28, 194, 'PREGUNTA DETONADORA', accent));
  const question = textBlock(slide.question, rightW - 56, {
    x: rightX + 28,
    y: 260,
    fill: SACRINT.white,
    family: 'display',
    weight: 'medium',
    maxFontSize: 28,
    minFontSize: 20,
    maxLines: 4,
    lineHeightRatio: 1.28,
  });
  parts.push(question.svg);

  const nodeY = 446;
  const nodeH = 96;
  const nodeGap = 14;
  slide.nodes.slice(0, 3).forEach((node, index) => {
    const y = nodeY + index * (nodeH + nodeGap);
    parts.push(panel(rightX, y, rightW, nodeH, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), rightX + 22, y + 30, { fill: accent2, fontSize: 13, weight: 'semibold', letterSpacing: 1.6 }));
    parts.push(singleLine(uppercaseLabel(node.label), rightX + 62, y + 30, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 1.8 }));
    const detail = textBlock(node.detail, rightW - 92, {
      x: rightX + 62,
      y: y + 56,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 14,
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
  const hasDiagram = Boolean(slide.diagram?.available);
  const isGuide = Boolean(slide.isLessonGuide);
  const leftX = 80;
  const leftW = hasDiagram ? 700 : 860;
  const graphX = 824;
  const graphY = 174;
  const graphW = 1016;
  const graphH = 574;

  const sesTag = slide.sessionNumber ? `SESIÓN ${String(slide.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;

  parts.push(glow(1420, 420, 700, 'url(#sacrint-glow-blue)', 0.75));
  parts.push(glow(260, 300, 430, 'url(#sacrint-glow-gold)', 0.45));
  parts.push(topHud(
    W,
    isGuide ? 'CONOCIMIENTO NUEVO' : 'NÚCLEO TÉCNICO',
    isGuide ? `${sesTag} // PIZARRÓN DOCENTE (1/2)` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONCEPTO CERO`,
    accent
  ));
  parts.push(progressRail(80, 116, 420, isGuide ? 1 : 3, isGuide ? 2 : 8, accent, deck.style.id));

  const title = textBlock(slide.title, hasDiagram ? 700 : 1760, {
    x: leftX,
    y: 162,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 40,
    minFontSize: 22,
    maxLines: 2,
    lineHeightRatio: 1.08,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  const subText = isGuide ? slide.subtitle ?? '' : uppercaseLabel(slide.subtitle ?? '');
  const hasSubtitle = Boolean(subText.trim());
  const subY = 162 + title.fitted.height + (hasSubtitle ? 12 : 4);
  const subBlock = hasSubtitle
    ? textBlock(subText, hasDiagram ? 700 : 1760, {
        x: leftX,
        y: subY,
        fill: accent,
        maxFontSize: isGuide ? 16 : 13,
        minFontSize: 11,
        maxLines: 2,
        lineHeightRatio: 1.25,
        truncate: false,
      })
    : { svg: '', fitted: { height: 0 } };
  if (hasSubtitle) parts.push(subBlock.svg);

  if (isGuide && !hasDiagram) {
    const bodyTop = Math.max(242, subY + subBlock.fitted.height + 10);
    const colRightX = 968;
    const colRightW = 872;
    const takeaways = (slide.keyTakeaways ?? []).slice(0, 2);
    const conceptH = 400;
    parts.push(panel(leftX, bodyTop, leftW, conceptH, { fill: 'rgba(8,17,29,0.82)', radius: 18 }));
    parts.push(sectionLabel(leftX + 24, bodyTop + 26, leftW - 48, 'Conocimiento nuevo', accent2, '1'));
    const conceptLines = [slide.explanation, ...takeaways.map((t) => `• ${t}`)].filter(Boolean).join('\n');
    const conceptBody = textBlock(conceptLines, leftW - 48, {
      x: leftX + 24,
      y: bodyTop + 58,
      fill: SACRINT.text,
      maxFontSize: 17,
      minFontSize: 11,
      maxLines: 10,
      lineHeightRatio: 1.3,
      truncate: false,
    });
    parts.push(conceptBody.svg);

    const lowerY = bodyTop + conceptH + 16;
    const lowerH = Math.max(120, 940 - lowerY);
    parts.push(panel(leftX, lowerY, leftW, lowerH, { fill: 'rgba(30,8,12,0.48)', radius: 18, stroke: 'rgba(255,49,49,0.4)' }));
    parts.push(sectionLabel(leftX + 24, lowerY + 26, leftW - 48, 'Error común', SACRINT.red, '2'));
    const lowerBody = textBlock(slide.misconception, leftW - 48, {
      x: leftX + 24,
      y: lowerY + 56,
      fill: SACRINT.textSoft,
      maxFontSize: 16,
      minFontSize: 11,
      maxLines: 5,
      lineHeightRatio: 1.28,
      truncate: false,
    });
    parts.push(lowerBody.svg);

    const formulas = (slide.formulas && slide.formulas.length > 0 ? slide.formulas : slide.formula ? [slide.formula] : [])
      .map((f) => f.trim())
      .filter(Boolean);
    let exTop = bodyTop;
    if (formulas.length > 0) {
      parts.push(panel(colRightX, bodyTop, colRightW, 114, { fill: 'rgba(4,10,18,0.85)', radius: 18, stroke: accent }));
      parts.push(sectionLabel(colRightX + 24, bodyTop + 24, colRightW - 48, 'Expresión clave', accent, 'F'));
      parts.push(singleLine(formulas[0]!, colRightX + 24, bodyTop + 76, { fill: accent, fontSize: 22, family: 'display', weight: 'bold' }));
      exTop = bodyTop + 130;
    }
    const exH = Math.max(240, 940 - exTop);
    parts.push(panel(colRightX, exTop, colRightW, exH, { fill: 'rgba(8,17,29,0.82)', radius: 18 }));
    parts.push(sectionLabel(colRightX + 24, exTop + 26, colRightW - 48, 'Ejemplo resuelto', accent, 'E'));
    const exStatement = slide.workedExample?.problemStatement || slide.explanation;
    const exSteps = (slide.workedExample?.steps ?? []).slice(0, 3);
    const exResult = slide.workedExample?.interpretation;
    const exLines = [exStatement, ...exSteps.map((step, idx) => `0${idx + 1}. ${step}`), exResult ? `Conclusión: ${exResult}` : '']
      .filter(Boolean)
      .join('\n');
    const exBody = textBlock(exLines, colRightW - 48, {
      x: colRightX + 24,
      y: exTop + 58,
      fill: SACRINT.text,
      maxFontSize: 17,
      minFontSize: 11,
      maxLines: 12,
      lineHeightRatio: 1.32,
      truncate: false,
    });
    parts.push(exBody.svg);

    parts.push(footer(W, H, `${sesTag} · concepto y ejemplo`, 'PIZARRÓN 1/2', accent));
    return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
  }

  if (isGuide) {
    const knowledgeY = Math.max(248, subY + subBlock.fitted.height + 10);
    const knowledgeH = 390;
    parts.push(panel(leftX, knowledgeY, leftW, knowledgeH, { fill: 'rgba(8,17,29,0.82)', radius: 18 }));
    parts.push(sectionLabel(leftX + 24, knowledgeY + 26, leftW - 48, 'Conocimiento nuevo y ejemplo', accent, '1'));
    const exStatement = slide.workedExample?.problemStatement || slide.explanation;
    const exSteps = (slide.workedExample?.steps ?? []).slice(0, 3);
    const exResult = slide.workedExample?.interpretation;
    const bulletLines = [
      slide.explanation,
      exStatement !== slide.explanation ? `Ejemplo: ${exStatement}` : '',
      ...exSteps.map((step, idx) => `0${idx + 1}. ${step}`),
      exResult ? `Conclusión: ${exResult}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const knowledgeBody = textBlock(bulletLines, leftW - 48, {
      x: leftX + 24,
      y: knowledgeY + 54,
      fill: SACRINT.text,
      maxFontSize: 15.5,
      minFontSize: 10.5,
      maxLines: 11,
      lineHeightRatio: 1.25,
      truncate: false,
    });
    parts.push(knowledgeBody.svg);

    const lowerY = knowledgeY + knowledgeH + 12;
    const lowerH = Math.max(100, 774 - lowerY);
    parts.push(panel(leftX, lowerY, leftW, lowerH, { fill: 'rgba(30,8,12,0.48)', radius: 18, stroke: 'rgba(255,49,49,0.4)' }));
    parts.push(sectionLabel(leftX + 24, lowerY + 24, leftW - 48, 'Error común', SACRINT.red, '2'));
    const lowerBody = textBlock(slide.misconception, leftW - 48, {
      x: leftX + 24,
      y: lowerY + 50,
      fill: SACRINT.textSoft,
      maxFontSize: 14,
      minFontSize: 10.5,
      maxLines: 4,
      lineHeightRatio: 1.24,
      truncate: false,
    });
    parts.push(lowerBody.svg);
  } else {
    const wide = !hasDiagram;
    const blockW = wide ? 1760 : leftW;
    const analogyPanelY = Math.max(330, subY + subBlock.fitted.height + 16);
    const analogyPanelH = 215;
    parts.push(panel(leftX, analogyPanelY, blockW, analogyPanelH, { fill: 'rgba(8,17,29,0.78)', radius: 18 }));
    parts.push(sectionLabel(leftX + 24, analogyPanelY + 28, blockW - 48, 'Analogía física', accent, 'A'));
    const analogy = textBlock(slide.analogy, blockW - 48, {
      x: leftX + 24,
      y: analogyPanelY + 58,
      fill: SACRINT.text,
      maxFontSize: 19,
      minFontSize: 12,
      maxLines: 6,
      lineHeightRatio: 1.35,
      truncate: false,
    });
    parts.push(analogy.svg);

    const misconceptionY = analogyPanelY + analogyPanelH + 16;
    const misconceptionH = Math.min(180, 785 - misconceptionY);
    parts.push(panel(leftX, misconceptionY, blockW, misconceptionH, { fill: 'rgba(30,8,12,0.5)', radius: 18, stroke: 'rgba(255,49,49,0.42)' }));
    parts.push(sectionLabel(leftX + 24, misconceptionY + 28, blockW - 48, 'Error común', SACRINT.red, 'B'));
    const misconception = textBlock(slide.misconception, blockW - 48, {
      x: leftX + 24,
      y: misconceptionY + 56,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 12,
      maxLines: 4,
      lineHeightRatio: 1.32,
      truncate: false,
    });
    parts.push(misconception.svg);
  }

  if (hasDiagram) {
    parts.push(panel(graphX, graphY, graphW, graphH, { fill: 'rgba(4,10,18,0.8)', radius: 22 }));
    parts.push(cornerMarks(graphX, graphY, graphW, graphH, accent, 18, 14));
    parts.push(sectionLabel(graphX + 28, graphY + 42, graphW - 56, diagramModelLabel(slide.diagram), accent2, 'FIG. 01'));

    if (slide.formula.trim()) {
      const formulaW = Math.min(graphW - 56, Math.max(320, measureText(slide.formula, 28, 'display', 'bold') + 56));
      parts.push(rect(graphX + 28, graphY + 62, formulaW, 54, `rx="12" fill="${SACRINT.canvas}" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"`));
      parts.push(singleLine(slide.formula, graphX + 56, graphY + 98, { fill: accent, fontSize: 25, family: 'display', weight: 'bold', letterSpacing: 0.4 }));
    }

    parts.push(diagramSvg(slide.diagram, graphX + 20, graphY + 132, graphW - 40, graphH - 152, { accent, accent2, showTriangle: true }));
  }

  if (slide.variables.length > 0 && hasDiagram) {
    const varY = 802;
    const varGap = 12;
    const varW = (W - 160 - varGap * 3) / 4;
    slide.variables.forEach((variable, index) => {
      const x = 80 + index * (varW + varGap);
      parts.push(panel(x, varY, varW, 132, { fill: 'rgba(6,14,24,0.72)', radius: 14, stroke: SACRINT.strokeSoft }));
      parts.push(singleLine(variable.symbol, x + 20, varY + 52, { fill: index % 2 === 0 ? accent : accent2, fontSize: 32, family: 'display', weight: 'bold' }));
      parts.push(singleLine(uppercaseLabel(variable.label), x + 62, varY + 38, { fill: SACRINT.muted, fontSize: 10, weight: 'semibold', letterSpacing: 1.2 }));
      const meaning = textBlock(variable.meaning, varW - 82, {
        x: x + 62,
        y: varY + 64,
        fill: SACRINT.textSoft,
        maxFontSize: 14,
        minFontSize: 10,
        maxLines: 3,
        lineHeightRatio: 1.28,
        truncate: false,
      });
      parts.push(meaning.svg);
    });
  }

  parts.push(footer(W, H, `${diagramSubtitle(slide.diagram)} · ${isGuide ? sesTag : 'Concepto cero'}`, diagramFooterLabel(slide.diagram), accent));
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
  const isGuide = Boolean(slide.isLessonGuide);
  const sesTag = slide.sessionNumber ? `SESIÓN ${String(slide.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;

  parts.push(glow(1480, 300, 620, 'url(#sacrint-glow-blue)', 0.7));
  parts.push(glow(240, 860, 520, 'url(#sacrint-glow-gold)', 0.5));
  parts.push(topHud(
    W,
    isGuide ? 'EJEMPLO RESUELTO' : 'YO HAGO',
    isGuide ? `${sesTag} // MODELADO PASO A PASO` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // DEMOSTRACIÓN`,
    accent
  ));
  parts.push(progressRail(80, 116, 420, isGuide ? 2 : 4, isGuide ? 4 : 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 214,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 44,
    minFontSize: 24,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 214 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 344, leftW, 268, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
  parts.push(sectionLabel(leftX + 24, 376, leftW - 48, isGuide ? 'Situación problema modelo' : 'Demostración guiada', accent, 'A'));
  const demoText = textBlock(slide.demoText, leftW - 48, {
    x: leftX + 24,
    y: 416,
    fill: SACRINT.text,
    maxFontSize: 20,
    minFontSize: 12,
    maxLines: 9,
    lineHeightRatio: 1.38,
    truncate: false,
  });
  parts.push(demoText.svg);

  if (slide.problemStatement && !isGuide) {
    parts.push(panel(leftX, 632, leftW, 128, { fill: 'rgba(5,12,20,0.62)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(sectionLabel(leftX + 24, 660, leftW - 48, 'Problema resuelto', accent2, 'B'));
    const problem = textBlock(slide.problemStatement, leftW - 48, {
      x: leftX + 24,
      y: 696,
      fill: SACRINT.textSoft,
      maxFontSize: 16,
      minFontSize: 11,
      maxLines: 3,
      lineHeightRatio: 1.3,
      truncate: false,
    });
    parts.push(problem.svg);
  }

  if (slide.interpretation) {
    const interpY = isGuide ? 632 : 778;
    const interpH = isGuide ? 164 : 100;
    parts.push(panel(leftX, interpY, leftW, interpH, { fill: 'rgba(6,20,16,0.55)', radius: 14, stroke: 'rgba(52,211,153,0.35)' }));
    parts.push(singleLine(uppercaseLabel('¿Qué significa el resultado?'), leftX + 24, interpY + 30, { fill: SACRINT.emerald, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
    const interp = textBlock(slide.interpretation, leftW - 48, {
      x: leftX + 24,
      y: interpY + 56,
      fill: SACRINT.textSoft,
      maxFontSize: isGuide ? 17 : 15,
      minFontSize: 11,
      maxLines: 4,
      lineHeightRatio: 1.32,
      truncate: false,
    });
    parts.push(interp.svg);
  }

  parts.push(sectionLabel(rightX, 190, rightW, 'Resolución paso a paso', accent2, `${slide.steps.length}`));
  const visibleSteps = slide.steps.slice(0, 5);
  const stepStride = visibleSteps.length >= 5 ? 118 : 138;
  const stepHeight = stepStride - 14;
  visibleSteps.forEach((step, index) => {
    const y = 226 + index * stepStride;
    parts.push(panel(rightX, y, rightW, stepHeight, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), rightX + 22, y + 36, { fill: accent2, fontSize: 14, weight: 'semibold', letterSpacing: 1.6 }));
    const body = textBlock(step, rightW - 84, {
      x: rightX + 62,
      y: y + 26,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 11,
      maxLines: 4,
      lineHeightRatio: 1.3,
      truncate: false,
    });
    parts.push(body.svg);
  });

  parts.push(footer(W, H, `${deck.meta.blockName} · ${isGuide ? `${sesTag} · Ejemplo` : 'Yo hago'}`, 'modelar · explicar · verificar', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderPractice(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'practice' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 760;
  const rightX = 880;
  const rightW = 960;
  const isGuide = Boolean(slide.isLessonGuide);
  const sesTag = slide.sessionNumber ? `SESIÓN ${String(slide.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;

  parts.push(glow(320, 260, 520, 'url(#sacrint-glow-gold)', 0.55));
  parts.push(glow(1560, 820, 600, 'url(#sacrint-glow-blue)', 0.65));
  parts.push(topHud(
    W,
    isGuide ? 'EJERCICIOS Y APLICACIÓN' : 'HACEMOS',
    isGuide ? `${sesTag} // PIZARRÓN DOCENTE (2/2)` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // PRÁCTICA GUIADA`,
    accent
  ));
  parts.push(progressRail(80, 116, 420, isGuide ? 2 : 5, isGuide ? 2 : 8, accent, deck.style.id));

  const title = textBlock(slide.title, isGuide ? 1760 : leftW, {
    x: leftX,
    y: isGuide ? 156 : 204,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: isGuide ? 34 : 40,
    minFontSize: 22,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  if (!isGuide || Boolean(slide.subtitle?.trim())) {
    parts.push(singleLine(uppercaseLabel(slide.subtitle || slide.eyebrow), leftX, (isGuide ? 156 : 204) + title.fitted.height + 16, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));
  }

  const activityItems = slide.activities && slide.activities.length > 0
    ? slide.activities
    : slide.checkpoints.map((cp, idx) => ({ label: `Actividad ${idx + 1}`, statement: cp, hint: '' }));

  if (isGuide) {
    const gLeftW = 940;
    const gRightX = 1056;
    const gRightW = 784;
    const objectives = (slide.objectiveBullets && slide.objectiveBullets.length > 0
      ? slide.objectiveBullets
      : [slide.subtitle || 'Comprender y aplicar los conceptos centrales de la sesión.']
    ).slice(0, 2);
    parts.push(panel(leftX, 248, gLeftW, 134, { fill: 'rgba(7,16,28,0.82)', radius: 16 }));
    parts.push(sectionLabel(leftX + 24, 274, gLeftW - 48, 'Objetivo de la sesión', accent, `${objectives.length}`));
    const objBlock = textBlock(objectives.map((o) => `• ${o}`).join('\n'), gLeftW - 48, {
      x: leftX + 24,
      y: 304,
      fill: SACRINT.text,
      maxFontSize: 15,
      minFontSize: 10.5,
      maxLines: 3,
      lineHeightRatio: 1.28,
      truncate: false,
    });
    parts.push(objBlock.svg);

    parts.push(sectionLabel(leftX, 404, gLeftW, 'Ejercicios del libro', accent2, `${Math.min(2, activityItems.length)}`));
    const visibleActivities = activityItems.slice(0, 2);
    const actStride = 258;
    visibleActivities.forEach((act, index) => {
      const y = 434 + index * actStride;
      const cardH = 242;
      parts.push(panel(leftX, y, gLeftW, cardH, { fill: 'rgba(5,12,20,0.68)', radius: 14, stroke: SACRINT.strokeSoft }));
      parts.push(singleLine(uppercaseLabel(act.label), leftX + 22, y + 26, { fill: accent2, fontSize: 11, weight: 'semibold', letterSpacing: 1.5 }));
      const body = textBlock(act.statement, gLeftW - 44, {
        x: leftX + 22,
        y: y + 48,
        fill: SACRINT.text,
        maxFontSize: 15.5,
        minFontSize: 10.5,
        maxLines: 5,
        lineHeightRatio: 1.24,
        truncate: false,
      });
      parts.push(body.svg);
      if (act.hint) {
        parts.push(singleLine(`Pista: ${act.hint}`, leftX + 22, y + cardH - 24, { fill: SACRINT.amber, fontSize: 11.5, weight: 'medium' }));
      }
    });

    parts.push(panel(gRightX, 248, gRightW, 218, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
    parts.push(sectionLabel(gRightX + 24, 276, gRightW - 48, 'Aplicación real', accent, 'A'));
    const appText = textBlock(slide.applicationText || slide.practiceText, gRightW - 48, {
      x: gRightX + 24,
      y: 310,
      fill: SACRINT.text,
      maxFontSize: 15.5,
      minFontSize: 10.5,
      maxLines: 5,
      lineHeightRatio: 1.28,
      truncate: false,
    });
    parts.push(appText.svg);

    const evalCriteria = (slide.evaluationCriteria && slide.evaluationCriteria.length > 0
      ? slide.evaluationCriteria
      : ['Procedimiento ordenado y respuesta interpretada con coherencia contextual.']
    ).slice(0, 2);
    parts.push(panel(gRightX, 482, gRightW, 226, { fill: 'rgba(20,16,6,0.62)', radius: 16, stroke: 'rgba(251,191,36,0.4)' }));
    parts.push(sectionLabel(gRightX + 24, 510, gRightW - 48, 'Evaluación', SACRINT.amber, `${evalCriteria.length}`));
    const evalBlock = textBlock(evalCriteria.map((c) => `✓ ${c}`).join('\n'), gRightW - 48, {
      x: gRightX + 24,
      y: 542,
      fill: SACRINT.textSoft,
      maxFontSize: 14.5,
      minFontSize: 10,
      maxLines: 6,
      lineHeightRatio: 1.26,
      truncate: false,
    });
    parts.push(evalBlock.svg);

    parts.push(panel(gRightX, 724, gRightW, 210, { fill: 'rgba(6,20,16,0.55)', radius: 14, stroke: 'rgba(52,211,153,0.35)' }));
    parts.push(sectionLabel(gRightX + 24, 752, gRightW - 48, 'Evidencia', SACRINT.emerald, 'C'));
    const artifactBody = [slide.artifactName || 'Evidencia de la sesión', slide.artifactStep || '']
      .filter(Boolean)
      .join(' — ');
    const artBlock = textBlock(artifactBody, gRightW - 48, {
      x: gRightX + 24,
      y: 786,
      fill: SACRINT.textSoft,
      maxFontSize: 14.5,
      minFontSize: 10.5,
      maxLines: 5,
      lineHeightRatio: 1.26,
      truncate: false,
    });
    parts.push(artBlock.svg);
  } else {
    parts.push(panel(leftX, 344, leftW, 300, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
    parts.push(sectionLabel(leftX + 24, 376, leftW - 48, 'Práctica colaborativa', accent, 'A'));
    const practiceText = textBlock(slide.practiceText, leftW - 48, {
      x: leftX + 24,
      y: 416,
      fill: SACRINT.text,
      maxFontSize: 20,
      minFontSize: 12,
      maxLines: 9,
      lineHeightRatio: 1.38,
      truncate: false,
    });
    parts.push(practiceText.svg);

    if (slide.hint) {
      parts.push(panel(leftX, 668, leftW, 172, { fill: 'rgba(30,24,8,0.5)', radius: 14, stroke: 'rgba(251,191,36,0.4)' }));
      parts.push(sectionLabel(leftX + 24, 696, leftW - 48, 'Pista docente · Apoyo sin dar la respuesta', SACRINT.amber, 'B'));
      const hint = textBlock(slide.hint, leftW - 48, {
        x: leftX + 24,
        y: 734,
        fill: SACRINT.textSoft,
        maxFontSize: 16,
        minFontSize: 11,
        maxLines: 4,
        lineHeightRatio: 1.32,
        truncate: false,
      });
      parts.push(hint.svg);
    }

    parts.push(sectionLabel(rightX, 190, rightW, 'Andamiaje de la práctica', accent2, `${activityItems.length}`));
    const visibleActivities = activityItems.slice(0, 4);
    const actStride = visibleActivities.length >= 4 ? 148 : 185;
    visibleActivities.forEach((act, index) => {
      const y = 226 + index * actStride;
      parts.push(panel(rightX, y, rightW, actStride - 16, { fill: 'rgba(5,12,20,0.68)', radius: 14, stroke: SACRINT.strokeSoft }));
      parts.push(singleLine(uppercaseLabel(act.label), rightX + 22, y + 30, { fill: accent2, fontSize: 11, weight: 'semibold', letterSpacing: 1.5 }));
      const body = textBlock(act.statement, rightW - 44, {
        x: rightX + 22,
        y: y + 52,
        fill: SACRINT.text,
        maxFontSize: 17,
        minFontSize: 11,
        maxLines: 3,
        lineHeightRatio: 1.28,
        truncate: false,
      });
      parts.push(body.svg);
      if (act.hint) {
        parts.push(singleLine(`Pista: ${act.hint}`, rightX + 22, y + actStride - 32, { fill: SACRINT.amber, fontSize: 12, weight: 'medium' }));
      }
    });
  }

  parts.push(footer(W, H, `${deck.meta.blockName} · ${isGuide ? `${sesTag} · Pizarrón` : 'Hacemos juntos'}`, 'ejercitar · aplicar · verificar', accent));
  return svgDocument(W, H, parts.join(''), accent, accent2, deck.style.id);
}

function renderChallenge(deck: SacrintDeckSpec, slide: Extract<SacrintSlide, { kind: 'challenge' }>): string {
  const { accent, accent2 } = accentPair(deck);
  const parts: string[] = [];
  const leftX = 80;
  const leftW = 940;
  const rightX = 1072;
  const rightW = 768;
  const isGuide = Boolean(slide.isLessonGuide);
  const sesTag = slide.sessionNumber ? `SESIÓN ${String(slide.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;

  parts.push(glow(1500, 280, 620, 'url(#sacrint-glow-gold)', 0.6));
  parts.push(glow(260, 880, 520, 'url(#sacrint-glow-blue)', 0.55));
  parts.push(topHud(
    W,
    isGuide ? 'APLICACIÓN Y CIERRE' : 'TÚ HACES',
    isGuide ? `${sesTag} // TRANSFERENCIA Y EVIDENCIA` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RETO Y PROYECTO`,
    accent
  ));
  parts.push(progressRail(80, 116, 420, isGuide ? 4 : 6, isGuide ? 4 : 8, accent, deck.style.id));

  const title = textBlock(slide.title, leftW, {
    x: leftX,
    y: 214,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 44,
    minFontSize: 24,
    maxLines: 2,
    lineHeightRatio: 1.06,
    letterSpacing: -0.6,
    truncate: false,
  });
  parts.push(title.svg);
  parts.push(singleLine(uppercaseLabel(slide.eyebrow), leftX, 214 + title.fitted.height + 24, { fill: accent, fontSize: 12, weight: 'semibold', letterSpacing: 2 }));

  parts.push(panel(leftX, 344, leftW, 288, { fill: 'rgba(7,16,28,0.82)', radius: 18 }));
  parts.push(sectionLabel(leftX + 24, 376, leftW - 48, isGuide ? '¿Dónde se aplica este conocimiento?' : 'Reto autónomo', accent, 'A'));
  const mainLeftBody = isGuide ? slide.applicationText || slide.challengeText : slide.challengeText;
  const challengeText = textBlock(mainLeftBody, leftW - 48, {
    x: leftX + 24,
    y: 416,
    fill: SACRINT.text,
    maxFontSize: 20,
    minFontSize: 12,
    maxLines: 9,
    lineHeightRatio: 1.38,
    truncate: false,
  });
  parts.push(challengeText.svg);

  parts.push(panel(leftX, 654, leftW, 180, { fill: 'rgba(5,12,20,0.62)', radius: 14, stroke: SACRINT.strokeSoft }));
  parts.push(sectionLabel(leftX + 24, 682, leftW - 48, 'Producto integrador', accent2, 'B'));
  const artifact = textBlock(slide.artifactName, leftW - 48, {
    x: leftX + 24,
    y: 720,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 21,
    minFontSize: 13,
    maxLines: 2,
    lineHeightRatio: 1.14,
    truncate: false,
  });
  parts.push(artifact.svg);
  const utility = textBlock(isGuide ? slide.challengeText : slide.communityUtility, leftW - 48, {
    x: leftX + 24,
    y: 720 + artifact.fitted.height + 10,
    fill: SACRINT.textSoft,
    maxFontSize: 14,
    minFontSize: 10,
    maxLines: 3,
    lineHeightRatio: 1.28,
    truncate: false,
  });
  parts.push(utility.svg);

  if (isGuide && slide.exitChecks && slide.exitChecks.length > 0) {
    parts.push(sectionLabel(rightX, 190, rightW, 'Ticket de salida · Verificación', accent2, `${slide.exitChecks.length}`));
    slide.exitChecks.slice(0, 3).forEach((check, index) => {
      const y = 226 + index * 124;
      parts.push(panel(rightX, y, rightW, 108, { fill: 'rgba(5,12,20,0.66)', radius: 14, stroke: SACRINT.strokeSoft }));
      parts.push(singleLine(`CHECK ${String(index + 1).padStart(2, '0')}`, rightX + 22, y + 32, { fill: accent2, fontSize: 11, weight: 'semibold', letterSpacing: 1.5 }));
      const body = textBlock(check, rightW - 44, {
        x: rightX + 22,
        y: y + 52,
        fill: SACRINT.textSoft,
        maxFontSize: 16,
        minFontSize: 11,
        maxLines: 3,
        lineHeightRatio: 1.28,
        truncate: false,
      });
      parts.push(body.svg);
    });
  } else if (slide.phases.length > 0) {
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
        minFontSize: 11,
        maxLines: 2,
        lineHeightRatio: 1.3,
        truncate: false,
      });
      parts.push(body.svg);
    });
  }

  parts.push(panel(rightX, 654, rightW, 180, { fill: 'rgba(6,20,16,0.55)', radius: 14, stroke: 'rgba(52,211,153,0.35)' }));
  parts.push(singleLine(uppercaseLabel('Entrega e impacto comunitario'), rightX + 24, 686, { fill: SACRINT.emerald, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
  const delivery = textBlock(slide.communityUtility || 'Integra la solución al producto del proyecto y compártela con el grupo.', rightW - 48, {
    x: rightX + 24,
    y: 720,
    fill: SACRINT.textSoft,
    maxFontSize: 16,
    minFontSize: 11,
    maxLines: 4,
    lineHeightRatio: 1.32,
    truncate: false,
  });
  parts.push(delivery.svg);

  parts.push(footer(W, H, `${deck.meta.blockName} · ${isGuide ? `${sesTag} · Cierre` : 'Tú haces'}`, 'aplicar · integrar · entregar', accent));
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
