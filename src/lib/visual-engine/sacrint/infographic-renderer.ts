import type { SacrintInfographicSpec, SacrintRubricItem } from './spec';
import { diagramModelLabel } from './diagrams';
import { INFOGRAPHIC, SACRINT } from './tokens';
import { fitText, singleLine, textBlock, uppercaseLabel } from './text-layout';
import {
  cornerMarks,
  diagramSvg,
  dotGrid,
  footer,
  line,
  panel,
  progressRail,
  rect,
  sectionLabel,
  svgDocument,
  topHud,
} from './svg-primitives';

function glow(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

function formulaPanel(spec: SacrintInfographicSpec, x: number, y: number, width: number, height: number, fontSize: number): string {
  const { accent, accent2 } = spec.pack;
  return `<g>${panel(x, y, width, height, { fill: 'rgba(5,12,20,0.74)', radius: 16, stroke: SACRINT.strokeSoft })}
${rect(x, y, 4, height, `rx="2" fill="url(#sacrint-accent)"`)}
${singleLine('MODELO', x + 22, y + 19, { fill: accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 })}
${singleLine(spec.formula, x + 22, y + height - 12, { fill: accent, fontSize, family: 'display', weight: 'bold', letterSpacing: 0.6 })}</g>`;
}

function variableTiles(spec: SacrintInfographicSpec, x: number, y: number, width: number, height: number, gap: number, fontSize: number): string {
  const tileWidth = (width - gap * 3) / 4;
  const badgeSize = Math.min(42, height * 0.44);
  return spec.variables
    .map((variable, index) => {
      const tx = x + index * (tileWidth + gap);
      const badgeX = tx + 12;
      const badgeY = y + (height - badgeSize) / 2;
      const textX = badgeX + badgeSize + 12;
      const textW = tx + tileWidth - 12 - textX;
      const color = index % 2 === 0 ? spec.pack.accent : spec.pack.accent2;
      const label = textBlock(uppercaseLabel(variable.label), textW, {
        x: textX,
        y: y + height * 0.34,
        fill: SACRINT.muted,
        maxFontSize: fontSize * 0.64,
        minFontSize: 8,
        maxLines: 1,
        lineHeightRatio: 1.15,
        letterSpacing: 0.8,
        truncate: true,
      });
      const meaning = textBlock(variable.meaning, textW, {
        x: textX,
        y: y + height * 0.58,
        fill: SACRINT.textSoft,
        maxFontSize: fontSize * 0.8,
        minFontSize: 8,
        maxLines: 2,
        lineHeightRatio: 1.25,
        truncate: true,
      });
      return `<g>${panel(tx, y, tileWidth, height, { fill: 'rgba(4,10,18,0.55)', radius: 12, stroke: SACRINT.strokeSoft })}
${rect(badgeX, badgeY, badgeSize, badgeSize, `rx="9" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-opacity="0.55" stroke-width="1"`)}
${singleLine(variable.symbol, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + fontSize * 0.42, { fill: color, fontSize: fontSize * 1.25, family: 'display', weight: 'bold', anchor: 'middle' })}
${label.svg}${meaning.svg}</g>`;
    })
    .join('');
}

function rubricRows(rubric: SacrintRubricItem[], x: number, y: number, width: number, color: string, maxRows = 4, rowGap = 34): string {
  return rubric
    .slice(0, maxRows)
    .map((item, index) => {
      const rowY = y + index * rowGap;
      return `<g>${singleLine(String(index + 1).padStart(2, '0'), x, rowY, { fill: color, fontSize: 10, weight: 'semibold', letterSpacing: 1.2 })}
${singleLine(item.label, x + 28, rowY, { fill: SACRINT.textSoft, fontSize: 12, weight: 'regular' })}
${item.weight != null ? singleLine(`${item.weight}%`, x + width, rowY, { fill: color, fontSize: 12, weight: 'semibold', anchor: 'end' }) : ''}</g>`;
    })
    .join('');
}

function renderWide(spec: SacrintInfographicSpec): string {
  const { width, height } = INFOGRAPHIC.wide;
  const accent = spec.pack.accent;
  const accent2 = spec.pack.accent2;
  const parts: string[] = [];
  const margin = 100;
  const contentW = width - margin * 2;

  parts.push(glow(250, 160, 640, 'url(#sacrint-glow-gold)', 0.6));
  parts.push(glow(2450, 1180, 760, 'url(#sacrint-glow-blue)', 0.8));
  parts.push(topHud(width, `${spec.pack.short} / INFOGRAFÍA`, `MISIÓN ${String(spec.meta.missionNumber).padStart(2, '0')} · ${spec.meta.blockName}`, accent));
  parts.push(dotGrid(margin, 112, contentW, 8, 0.5));

  const title = textBlock(spec.title, 1920, {
    x: margin,
    y: 226,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 82,
    minFontSize: 48,
    maxLines: 2,
    lineHeightRatio: 1.02,
    letterSpacing: -2,
    truncate: true,
  });
  parts.push(title.svg);
  const subtitleY = 226 + title.fitted.height + 22;
  parts.push(singleLine(uppercaseLabel(spec.subtitle), margin, subtitleY, { fill: accent, fontSize: 14, weight: 'semibold', letterSpacing: 2.4 }));
  parts.push(line(margin, subtitleY + 20, margin + 760, subtitleY + 20, accent, 1.5, 'stroke-opacity="0.6"'));

  const claimY = subtitleY + 52;
  const claim = textBlock(spec.claim, 1720, {
    x: margin,
    y: claimY,
    fill: SACRINT.textSoft,
    family: 'body',
    maxFontSize: 27,
    minFontSize: 18,
    maxLines: 1,
    lineHeightRatio: 1.3,
    truncate: true,
  });
  parts.push(claim.svg);
  parts.push(progressRail(width - margin - 320, claimY, 320, 1, 4, accent2));

  const leftX = margin;
  const leftY = 490;
  const leftW = 1200;
  const leftH = 900;
  parts.push(panel(leftX, leftY, leftW, leftH, { fill: 'rgba(4,10,18,0.76)', radius: 22 }));
  parts.push(cornerMarks(leftX, leftY, leftW, leftH, accent, 20, 16));
  parts.push(sectionLabel(leftX + 28, leftY + 46, leftW - 56, `Fig. 01 · ${diagramModelLabel(spec.diagram)}`, accent2, spec.formula));
  parts.push(formulaPanel(spec, leftX + 28, leftY + 74, leftW - 56, 72, 28));
  parts.push(diagramSvg(spec.diagram, leftX + 24, leftY + 168, leftW - 48, 586, { accent, accent2, showTriangle: true }));
  parts.push(variableTiles(spec, leftX + 28, leftY + 776, leftW - 56, 96, 10, 16));

  const rightX = margin + leftW + 32;
  const rightW = width - margin - rightX;
  parts.push(panel(rightX, leftY, rightW, 480, { fill: 'rgba(5,12,20,0.7)', radius: 22 }));
  parts.push(sectionLabel(rightX + 28, leftY + 46, rightW - 56, 'Ruta de aprendizaje', accent, '4 PASOS'));
  const stepW = (rightW - 84) / 2;
  const stepH = 186;
  spec.steps.slice(0, 4).forEach((step, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = rightX + 28 + col * (stepW + 28);
    const y = leftY + 76 + row * (stepH + 18);
    parts.push(panel(x, y, stepW, stepH, { fill: 'rgba(3,8,15,0.52)', radius: 14, stroke: SACRINT.strokeSoft }));
    parts.push(singleLine(String(step.number).padStart(2, '0'), x + 20, y + 40, { fill: accent, fontSize: 28, family: 'display', weight: 'bold' }));
    parts.push(singleLine(uppercaseLabel(step.title), x + 66, y + 32, { fill: SACRINT.muted, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 }));
    const body = textBlock(step.body, stepW - 46, {
      x: x + 20,
      y: y + 70,
      fill: SACRINT.textSoft,
      maxFontSize: 17,
      minFontSize: 12,
      maxLines: 5,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(body.svg);
    parts.push(line(x + 20, y + stepH - 24, x + stepW - 20, y + stepH - 24, accent2, 1, 'stroke-opacity="0.28"'));
  });

  const bottomY = leftY + 500;
  const bottomH = 400;
  const errorW = 590;
  const arrowIndex = spec.misconception.indexOf('→');
  const errorText = arrowIndex >= 0 ? spec.misconception.slice(0, arrowIndex).trim() : spec.misconception;
  const correctionText = arrowIndex >= 0 ? spec.misconception.slice(arrowIndex + 1).trim() : '';
  parts.push(panel(rightX, bottomY, errorW, bottomH, { fill: 'rgba(30,8,12,0.5)', radius: 22, stroke: 'rgba(255,49,49,0.4)' }));
  parts.push(rect(rightX, bottomY, 4, bottomH, `rx="2" fill="${SACRINT.red}"`));
  parts.push(sectionLabel(rightX + 28, bottomY + 46, errorW - 56, 'Error común', SACRINT.red, 'ALERTA'));
  const misconception = textBlock(errorText, errorW - 56, {
    x: rightX + 28,
    y: bottomY + 86,
    fill: SACRINT.text,
    maxFontSize: 17,
    minFontSize: 12,
    maxLines: 3,
    lineHeightRatio: 1.4,
    truncate: true,
  });
  parts.push(misconception.svg);
  if (correctionText) {
    const dividerY = bottomY + 172;
    parts.push(line(rightX + 28, dividerY, rightX + errorW - 28, dividerY, SACRINT.strokeSoft, 1, 'stroke-opacity="0.55"'));
    parts.push(singleLine('CÓMO CORREGIRLO', rightX + 28, dividerY + 24, { fill: accent2, fontSize: 9, weight: 'semibold', letterSpacing: 1.6 }));
    const correction = textBlock(correctionText, errorW - 56, {
      x: rightX + 28,
      y: dividerY + 46,
      fill: SACRINT.textSoft,
      maxFontSize: 15,
      minFontSize: 11,
      maxLines: 2,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(correction.svg);
  }
  parts.push(singleLine('CRITERIOS DE LOGRO', rightX + 28, bottomY + bottomH - 116, { fill: accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.8 }));
  parts.push(
    spec.criteria
      .slice(0, 3)
      .map((criterion, index) => {
        const rowY = bottomY + bottomH - 94 + index * 28;
        const fitted = fitText(criterion, errorW - 100, { maxFontSize: 10, minFontSize: 8, maxLines: 1, truncate: true });
        return `<g>${singleLine(String(index + 1).padStart(2, '0'), rightX + 28, rowY, { fill: accent2, fontSize: 9, weight: 'semibold', letterSpacing: 1 })}
${singleLine(fitted.lines[0] ?? '', rightX + 52, rowY, { fill: SACRINT.textSoft, fontSize: fitted.fontSize, weight: 'regular' })}</g>`;
      })
      .join('')
  );

  const projectX = rightX + errorW + 24;
  const projectW = rightW - errorW - 24;
  parts.push(panel(projectX, bottomY, projectW, bottomH, { fill: 'rgba(5,12,20,0.7)', radius: 22 }));
  parts.push(sectionLabel(projectX + 28, bottomY + 46, projectW - 56, 'Producto y evaluación', accent, 'PAEC'));
  parts.push(singleLine(uppercaseLabel(spec.project.artifactName), projectX + 28, bottomY + 94, { fill: SACRINT.white, fontSize: 24, family: 'display', weight: 'bold' }));
  const utility = textBlock(spec.project.communityUtility, projectW - 56, {
    x: projectX + 28,
    y: bottomY + 128,
    fill: SACRINT.textSoft,
    maxFontSize: 16,
    minFontSize: 11,
    maxLines: 3,
    lineHeightRatio: 1.35,
    truncate: true,
  });
  parts.push(utility.svg);
  parts.push(sectionLabel(projectX + 28, bottomY + 226, projectW - 56, 'Rúbrica', accent2, `${spec.rubric.length}`));
  parts.push(rubricRows(spec.rubric, projectX + 28, bottomY + 262, projectW - 56, accent2));

  parts.push(footer(width, height, `${spec.meta.schoolName} · ${spec.meta.teacherName}`, 'SACRINT · INFOGRAFÍA 16:9', accent));
  return svgDocument(width, height, parts.join(''), accent, accent2, spec.style.id, 'infographic');
}

function renderLetter(spec: SacrintInfographicSpec): string {
  const { width, height } = INFOGRAPHIC.letter;
  const accent = spec.pack.accent;
  const accent2 = spec.pack.accent2;
  const parts: string[] = [];
  const margin = 60;
  const contentW = width - margin * 2;

  parts.push(glow(200, 180, 430, 'url(#sacrint-glow-gold)', 0.52));
  parts.push(glow(1080, 1280, 520, 'url(#sacrint-glow-blue)', 0.7));
  parts.push(topHud(width, `${spec.pack.short} / CARTA`, `MISIÓN ${String(spec.meta.missionNumber).padStart(2, '0')}`, accent));
  parts.push(dotGrid(margin, 104, contentW, 6, 0.35));

  const title = textBlock(spec.title, contentW, {
    x: margin,
    y: 168,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 58,
    minFontSize: 34,
    maxLines: 3,
    lineHeightRatio: 1.04,
    letterSpacing: -1.2,
    truncate: true,
  });
  parts.push(title.svg);
  const subtitleY = 168 + title.fitted.height + 24;
  parts.push(singleLine(uppercaseLabel(spec.subtitle), margin, subtitleY, { fill: accent, fontSize: 11, weight: 'semibold', letterSpacing: 2 }));
  parts.push(line(margin, subtitleY + 16, margin + 520, subtitleY + 16, accent, 1.2, 'stroke-opacity="0.55"'));

  let y = subtitleY + 38;
  const formulaH = 78;
  parts.push(formulaPanel(spec, margin, y, contentW, formulaH, 26));
  y += formulaH + 16;

  const graphH = 412;
  parts.push(panel(margin, y, contentW, graphH, { fill: 'rgba(4,10,18,0.72)', radius: 18 }));
  parts.push(sectionLabel(margin + 22, y + 34, contentW - 44, diagramModelLabel(spec.diagram), accent2, 'FIG. 01'));
  parts.push(diagramSvg(spec.diagram, margin + 16, y + 50, contentW - 32, graphH - 66, { accent, accent2, showTriangle: false, compact: true }));
  y += graphH + 16;

  parts.push(variableTiles(spec, margin, y, contentW, 92, 10, 13));
  y += 108;

  const stepsH = 304;
  parts.push(panel(margin, y, contentW, stepsH, { fill: 'rgba(5,12,20,0.66)', radius: 18 }));
  parts.push(sectionLabel(margin + 22, y + 34, contentW - 44, 'Ruta de aprendizaje', accent, '4 PASOS'));
  spec.steps.slice(0, 4).forEach((step, index) => {
    const rowY = y + 54 + index * 60;
    parts.push(singleLine(String(step.number).padStart(2, '0'), margin + 24, rowY + 18, { fill: accent, fontSize: 19, family: 'display', weight: 'bold' }));
    parts.push(singleLine(uppercaseLabel(step.title), margin + 66, rowY + 8, { fill: SACRINT.muted, fontSize: 9, weight: 'semibold', letterSpacing: 1.2 }));
    const body = textBlock(step.body, contentW - 120, {
      x: margin + 66,
      y: rowY + 26,
      fill: SACRINT.textSoft,
      maxFontSize: 13,
      minFontSize: 9,
      maxLines: 2,
      lineHeightRatio: 1.3,
      truncate: true,
    });
    parts.push(body.svg);
    if (index < 3) parts.push(line(margin + 24, rowY + 50, margin + contentW - 24, rowY + 50, SACRINT.strokeSoft, 1, 'stroke-opacity="0.42"'));
  });
  y += stepsH + 16;

  const bottomH = height - y - 76;
  const errorW = contentW * 0.48;
  const arrowIndex = spec.misconception.indexOf('→');
  const errorText = arrowIndex >= 0 ? spec.misconception.slice(0, arrowIndex).trim() : spec.misconception;
  const correctionText = arrowIndex >= 0 ? spec.misconception.slice(arrowIndex + 1).trim() : '';
  parts.push(panel(margin, y, errorW, bottomH, { fill: 'rgba(30,8,12,0.48)', radius: 16, stroke: 'rgba(255,49,49,0.38)' }));
  parts.push(rect(margin, y, 3, bottomH, `rx="1.5" fill="${SACRINT.red}"`));
  parts.push(singleLine('ERROR COMÚN', margin + 20, y + 28, { fill: SACRINT.red, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 }));
  const misconception = textBlock(errorText, errorW - 40, {
    x: margin + 20,
    y: y + 54,
    fill: SACRINT.textSoft,
    maxFontSize: 13,
    minFontSize: 9,
    maxLines: 3,
    lineHeightRatio: 1.35,
    truncate: true,
  });
  parts.push(misconception.svg);
  if (correctionText) {
    const dividerY = y + 118;
    parts.push(line(margin + 20, dividerY, margin + errorW - 20, dividerY, SACRINT.strokeSoft, 1, 'stroke-opacity="0.55"'));
    parts.push(singleLine('CÓMO CORREGIRLO', margin + 20, dividerY + 24, { fill: accent2, fontSize: 9, weight: 'semibold', letterSpacing: 1.4 }));
    const correction = textBlock(correctionText, errorW - 40, {
      x: margin + 20,
      y: dividerY + 46,
      fill: SACRINT.text,
      maxFontSize: 13,
      minFontSize: 9,
      maxLines: 3,
      lineHeightRatio: 1.35,
      truncate: true,
    });
    parts.push(correction.svg);
  }

  const projectX = margin + errorW + 14;
  const projectW = contentW - errorW - 14;
  parts.push(panel(projectX, y, projectW, bottomH, { fill: 'rgba(5,12,20,0.66)', radius: 16 }));
  parts.push(singleLine('PROYECTO PAEC', projectX + 20, y + 28, { fill: accent, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 }));
  const artifact = textBlock(spec.project.artifactName, projectW - 40, {
    x: projectX + 20,
    y: y + 54,
    fill: SACRINT.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 17,
    minFontSize: 11,
    maxLines: 2,
    lineHeightRatio: 1.25,
    truncate: true,
  });
  parts.push(artifact.svg);
  const utility = textBlock(spec.project.communityUtility, projectW - 40, {
    x: projectX + 20,
    y: y + 54 + artifact.fitted.height + 8,
    fill: SACRINT.textSoft,
    maxFontSize: 11,
    minFontSize: 8,
    maxLines: 2,
    lineHeightRatio: 1.3,
    truncate: true,
  });
  parts.push(utility.svg);
  parts.push(sectionLabel(projectX + 20, y + bottomH - 128, projectW - 40, 'Criterios de logro', accent2, `${spec.rubric.length}`));
  parts.push(rubricRows(spec.rubric, projectX + 20, y + bottomH - 102, projectW - 40, accent2, 4, 26));

  parts.push(footer(width, height, `${spec.meta.schoolName} · ${spec.meta.teacherName}`, 'SACRINT · CARTA', accent));
  return svgDocument(width, height, parts.join(''), accent, accent2, spec.style.id, 'infographic');
}

export function renderInfographicSvg(spec: SacrintInfographicSpec): string {
  return spec.format === 'wide' ? renderWide(spec) : renderLetter(spec);
}

export function infographicFilename(spec: SacrintInfographicSpec): string {
  return spec.format === 'wide' ? 'sacrint-infografia-16x9.svg' : 'sacrint-infografia-carta.svg';
}

