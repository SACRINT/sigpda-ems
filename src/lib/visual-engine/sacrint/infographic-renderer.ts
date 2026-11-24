import type { SacrintInfographicSpec, SacrintRubricItem } from './types';
import { diagramModelLabel } from './diagrams/registry';
import { isValidRenderableFormula } from '@/lib/editorial/text-normalization';
import { INFOGRAPHIC, SACRINT, SACRINT_LIGHT, resolveLightAccent, type SacrintThemeMode } from './tokens';
import { fitText, singleLine, textBlock, uppercaseLabel } from './text-layout';
import {
  cornerMarks,
  dotGrid,
  footer,
  line,
  panel,
  progressRail,
  rect,
  sectionLabel,
  svgDocument,
  topHud,
} from './svg/core-primitives';
import { diagramSvg } from './svg/schematic-diagrams';

interface ResolvedPalette {
  theme: SacrintThemeMode;
  isLight: boolean;
  pal: typeof SACRINT | typeof SACRINT_LIGHT;
  accent: string;
  accent2: string;
  cardFill: string;
  cardSoftFill: string;
  cardInnerFill: string;
  errorFill: string;
  errorStroke: string;
  appFill: string;
  appStroke: string;
  stroke: string;
  badgeFillOpacity: string;
}

function resolvePalette(spec: SacrintInfographicSpec): ResolvedPalette {
  const theme: SacrintThemeMode = spec.theme ?? 'light';
  const isLight = theme === 'light';
  const pal = isLight ? SACRINT_LIGHT : SACRINT;
  const accent = isLight ? resolveLightAccent(spec.pack.accent) : spec.pack.accent;
  const accent2 = isLight ? resolveLightAccent(spec.pack.accent2) : spec.pack.accent2;
  return {
    theme,
    isLight,
    pal,
    accent,
    accent2,
    cardFill: isLight ? '#FFFFFF' : 'rgba(5,12,20,0.78)',
    cardSoftFill: isLight ? '#F8FAFC' : 'rgba(4,10,18,0.68)',
    cardInnerFill: isLight ? '#F1F5F9' : 'rgba(3,8,15,0.52)',
    errorFill: isLight ? '#FEF2F2' : 'rgba(30,8,12,0.5)',
    errorStroke: isLight ? '#FCA5A5' : 'rgba(255,49,49,0.4)',
    appFill: isLight ? '#ECFDF5' : 'rgba(6,24,18,0.48)',
    appStroke: isLight ? '#6EE7B7' : 'rgba(52,211,153,0.35)',
    stroke: isLight ? SACRINT_LIGHT.stroke : SACRINT.strokeSoft,
    badgeFillOpacity: isLight ? '0.12' : '0.1',
  };
}

function glow(cx: number, cy: number, r: number, fill: string, opacity = 1): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`;
}

function formulaPanel(
  spec: SacrintInfographicSpec,
  p: ResolvedPalette,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number
): string {
  const validList = (spec.formulasList ?? []).filter((f) => isValidRenderableFormula(f));
  const primaryFormula = isValidRenderableFormula(spec.formula) ? spec.formula : validList[0] ?? '';
  if (!primaryFormula) {
    const def = spec.conceptManual?.definitions[0];
    const label = def?.term ? `CONCEPTO CENTRAL: ${def.term}` : 'CONCEPTO CENTRAL';
    const body = def?.definition || spec.claim;
    const defBlock = textBlock(body, width - 36, {
      x: x + 20,
      y: y + 32,
      fill: p.pal.text,
      maxFontSize: Math.min(15, fontSize - 6),
      minFontSize: 10,
      maxLines: 3,
      lineHeightRatio: 1.24,
      truncate: false,
    });
    return `<g>${panel(x, y, width, height, { fill: p.cardFill, radius: 14, stroke: p.stroke })}
${rect(x, y, 4, height, `rx="2" fill="url(#sacrint-accent)"`)}
${singleLine(uppercaseLabel(label), x + 20, y + 20, { fill: p.accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.4 })}
${defBlock.svg}</g>`;
  }

  const extraFormulas = validList.filter((f) => f !== primaryFormula).slice(0, 1);
  const formulaFit = fitText(primaryFormula, width - 56, {
    family: 'display',
    weight: 'bold',
    maxFontSize: fontSize,
    minFontSize: Math.max(14, fontSize - 10),
    maxLines: 1,
    truncate: false,
  });
  const formulaBaseline = extraFormulas.length > 0 ? y + height - 28 : y + height - 14;
  return `<g>${panel(x, y, width, height, { fill: p.cardFill, radius: 14, stroke: p.stroke })}
${rect(x, y, 4, height, `rx="2" fill="url(#sacrint-accent)"`)}
${singleLine('MODELO Y FÓRMULA CENTRAL', x + 20, y + 20, { fill: p.accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.6 })}
${singleLine(formulaFit.lines[0] ?? primaryFormula, x + 20, formulaBaseline, { fill: p.accent, fontSize: formulaFit.fontSize, family: 'display', weight: 'bold', letterSpacing: 0.4 })}
${extraFormulas.length > 0 ? singleLine(`Regla adicional: ${extraFormulas[0]}`, x + 20, y + height - 9, { fill: p.pal.muted, fontSize: 11, weight: 'medium' }) : ''}</g>`;
}

function variableTiles(
  spec: SacrintInfographicSpec,
  p: ResolvedPalette,
  x: number,
  y: number,
  width: number,
  height: number,
  gap: number,
  fontSize: number
): string {
  const tileWidth = (width - gap * 3) / 4;
  const badgeSize = Math.min(40, height * 0.44);
  return spec.variables
    .slice(0, 4)
    .map((variable, index) => {
      const tx = x + index * (tileWidth + gap);
      const badgeX = tx + 12;
      const badgeY = y + (height - badgeSize) / 2;
      const textX = badgeX + badgeSize + 10;
      const textW = tx + tileWidth - 10 - textX;
      const color = index % 2 === 0 ? p.accent : p.accent2;
      const label = textBlock(uppercaseLabel(variable.label), textW, {
        x: textX,
        y: y + height * 0.3,
        fill: p.pal.muted,
        maxFontSize: fontSize * 0.68,
        minFontSize: 8,
        maxLines: 1,
        lineHeightRatio: 1.15,
        letterSpacing: 0.7,
        truncate: false,
      });
      const meaning = textBlock(variable.meaning, textW, {
        x: textX,
        y: y + height * 0.56,
        fill: p.pal.textSoft,
        maxFontSize: fontSize * 0.82,
        minFontSize: 8.5,
        maxLines: 2,
        lineHeightRatio: 1.24,
        truncate: false,
      });
      return `<g>${panel(tx, y, tileWidth, height, { fill: p.cardFill, radius: 12, stroke: p.stroke })}
${rect(badgeX, badgeY, badgeSize, badgeSize, `rx="9" fill="${color}" fill-opacity="${p.badgeFillOpacity}" stroke="${color}" stroke-opacity="0.55" stroke-width="1"`)}
${singleLine(variable.symbol, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + fontSize * 0.42, { fill: color, fontSize: fontSize * 1.15, family: 'display', weight: 'bold', anchor: 'middle' })}
${label.svg}${meaning.svg}</g>`;
    })
    .join('');
}

function rubricRows(
  rubric: SacrintRubricItem[],
  p: ResolvedPalette,
  x: number,
  y: number,
  width: number,
  maxRows = 4,
  rowGap = 30
): string {
  return rubric
    .slice(0, maxRows)
    .map((item, index) => {
      const rowY = y + index * rowGap;
      const fitted = fitText(item.label, width - (item.weight != null ? 82 : 34), {
        maxFontSize: 12,
        minFontSize: 9,
        maxLines: 1,
        truncate: false,
      });
      return `<g>${singleLine(String(index + 1).padStart(2, '0'), x, rowY, { fill: p.accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.2 })}
${singleLine(fitted.lines[0] ?? item.label, x + 26, rowY, { fill: p.pal.textSoft, fontSize: fitted.fontSize, weight: 'regular' })}
${item.weight != null ? singleLine(`${item.weight}%`, x + width, rowY, { fill: p.accent2, fontSize: 11, weight: 'semibold', anchor: 'end' }) : ''}</g>`;
    })
    .join('');
}

function renderWide(spec: SacrintInfographicSpec): string {
  const { width, height } = INFOGRAPHIC.wide;
  const p = resolvePalette(spec);
  const parts: string[] = [];
  const margin = 100;
  const contentW = width - margin * 2;
  const hasDiagram = Boolean(spec.diagram?.available);

  parts.push(glow(250, 160, 640, 'url(#sacrint-glow-gold)', p.isLight ? 0.35 : 0.6));
  parts.push(glow(2450, 1180, 760, 'url(#sacrint-glow-blue)', p.isLight ? 0.35 : 0.8));
  parts.push(topHud(width, `${spec.pack.short} / MANUAL DE CONCEPTOS`, `MISIÓN ${String(spec.meta.missionNumber).padStart(2, '0')} · ${spec.meta.blockName}`, p.accent, p.theme));
  parts.push(dotGrid(margin, 112, contentW, 8, p.isLight ? 0.14 : 0.5));

  const title = textBlock(spec.title, 2060, {
    x: margin,
    y: 214,
    fill: p.pal.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 70,
    minFontSize: 38,
    maxLines: 2,
    lineHeightRatio: 1.04,
    letterSpacing: -1.5,
    truncate: false,
  });
  parts.push(title.svg);
  const subtitleY = 214 + title.fitted.height + 20;
  parts.push(singleLine(uppercaseLabel(spec.subtitle), margin, subtitleY, { fill: p.accent, fontSize: 14, weight: 'semibold', letterSpacing: 2.2 }));
  parts.push(line(margin, subtitleY + 18, margin + 780, subtitleY + 18, p.accent, 1.5, 'stroke-opacity="0.6"'));

  const claimY = subtitleY + 46;
  const claim = textBlock(spec.claim, 1820, {
    x: margin,
    y: claimY,
    fill: p.pal.textSoft,
    family: 'body',
    maxFontSize: 24,
    minFontSize: 15,
    maxLines: 2,
    lineHeightRatio: 1.28,
    truncate: false,
  });
  parts.push(claim.svg);
  parts.push(progressRail(width - margin - 320, claimY, 320, 1, 4, p.accent2, spec.style.id));

  // Columna Izquierda: Esquema / Definiciones + Reglas clave + Mini-ejemplo o Diagrama coherente
  const leftX = margin;
  const leftY = Math.max(468, claimY + claim.fitted.height + 22);
  const leftW = 1200;
  const leftH = height - leftY - 82;
  parts.push(panel(leftX, leftY, leftW, leftH, { fill: p.cardFill, radius: 22, stroke: p.stroke }));
  parts.push(cornerMarks(leftX, leftY, leftW, leftH, p.accent, 18, 14));
  parts.push(
    sectionLabel(
      leftX + 28,
      leftY + 40,
      leftW - 56,
      hasDiagram ? `Fig. 01 · ${diagramModelLabel(spec.diagram)}` : 'Definiciones y fundamentos esenciales',
      p.accent2,
      hasDiagram ? spec.formula : 'MANUAL CLAVE',
      p.pal.muted
    )
  );
  parts.push(formulaPanel(spec, p, leftX + 28, leftY + 64, leftW - 56, 82, 26));

  const conceptsList = (spec.keyConcepts ?? []).slice(0, 2);
  const conceptStripH = conceptsList.length > 0 ? 78 : 0;
  if (conceptsList.length > 0) {
    const cY = leftY + 158;
    const halfW = (leftW - 72) / Math.max(1, conceptsList.length);
    conceptsList.forEach((rule, idx) => {
      const cx = leftX + 28 + idx * (halfW + 16);
      parts.push(panel(cx, cY, halfW, conceptStripH, { fill: p.cardSoftFill, radius: 12, stroke: p.stroke }));
      const ruleBlock = textBlock(`• ${rule}`, halfW - 28, {
        x: cx + 14,
        y: cY + 26,
        fill: p.pal.text,
        maxFontSize: 15,
        minFontSize: 10.5,
        maxLines: 3,
        lineHeightRatio: 1.25,
        truncate: false,
      });
      parts.push(ruleBlock.svg);
    });
  }

  const midTop = leftY + 160 + (conceptStripH > 0 ? conceptStripH + 14 : 0);
  if (hasDiagram) {
    const diagramH = leftH - (midTop - leftY) - 118;
    parts.push(diagramSvg(spec.diagram, leftX + 24, midTop, leftW - 48, diagramH, { accent: p.accent, accent2: p.accent2, showTriangle: true, theme: p.theme }));
    parts.push(variableTiles(spec, p, leftX + 28, leftY + leftH - 108, leftW - 56, 92, 10, 15));
  } else {
    const mapNodes = (spec.conceptManual?.conceptMap ?? []).slice(0, 4);
    const mapH = mapNodes.length > 0 ? 156 : 0;
    if (mapNodes.length > 0) {
      const nodeGap = 18;
      const nodeW = (leftW - 56 - nodeGap * (mapNodes.length - 1)) / mapNodes.length;
      mapNodes.forEach((node, idx) => {
        const nx = leftX + 28 + idx * (nodeW + nodeGap);
        parts.push(panel(nx, midTop, nodeW, mapH, { fill: p.cardSoftFill, radius: 14, stroke: idx === 0 ? p.accent : p.stroke }));
        parts.push(singleLine(uppercaseLabel(node.relation), nx + 14, midTop + 24, { fill: idx === 0 ? p.accent : p.accent2, fontSize: 9.5, weight: 'semibold', letterSpacing: 1.2 }));
        const cTitle = textBlock(node.concept, nodeW - 28, { x: nx + 14, y: midTop + 42, fill: p.pal.white, maxFontSize: 14, minFontSize: 10, maxLines: 2, weight: 'semibold', truncate: false });
        parts.push(cTitle.svg);
        const cDetail = textBlock(node.detail, nodeW - 28, { x: nx + 14, y: midTop + 82, fill: p.pal.textSoft, maxFontSize: 12.5, minFontSize: 9.5, maxLines: 4, lineHeightRatio: 1.24, truncate: false });
        parts.push(cDetail.svg);
        if (idx < mapNodes.length - 1) {
          parts.push(line(nx + nodeW + 2, midTop + mapH / 2, nx + nodeW + nodeGap - 2, midTop + mapH / 2, p.accent2, 1.5, ''));
        }
      });
    }

    const exTop = midTop + (mapH > 0 ? mapH + 16 : 0);
    const exH = leftY + leftH - exTop - 22;
    const ex = spec.quickExample;
    parts.push(panel(leftX + 28, exTop, leftW - 56, exH, { fill: p.cardSoftFill, radius: 16, stroke: p.stroke }));
    parts.push(singleLine('MINI-EJEMPLO RESUELTO', leftX + 48, exTop + 28, { fill: p.accent, fontSize: 10.5, weight: 'semibold', letterSpacing: 1.5 }));
    const exLines = [
      ex?.problemStatement || spec.claim,
      ...(ex?.steps ?? []).slice(0, 3).map((s, i) => `0${i + 1}. ${s}`),
      ex?.interpretation ? `Resultado: ${ex.interpretation}` : '',
    ].filter(Boolean).join('\n');
    const exBlock = textBlock(exLines, leftW - 96, {
      x: leftX + 48,
      y: exTop + 52,
      fill: p.pal.text,
      maxFontSize: 15,
      minFontSize: 10.5,
      maxLines: 8,
      lineHeightRatio: 1.28,
      truncate: false,
    });
    parts.push(exBlock.svg);
  }

  // Columna Derecha Arriba: Guía operativa (4 pasos — nunca "Ruta de aprendizaje")
  const rightX = margin + leftW + 32;
  const rightW = width - margin - rightX;
  const routeH = Math.min(470, Math.round(leftH * 0.52));
  parts.push(panel(rightX, leftY, rightW, routeH, { fill: p.cardFill, radius: 22, stroke: p.stroke }));
  parts.push(sectionLabel(rightX + 28, leftY + 40, rightW - 56, 'Procedimiento clave de estudio', p.accent, '4 CLAVES', p.pal.muted));
  const stepW = (rightW - 84) / 2;
  const stepH = Math.floor((routeH - 104) / 2);
  spec.steps.slice(0, 4).forEach((step, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = rightX + 28 + col * (stepW + 28);
    const y = leftY + 68 + row * (stepH + 14);
    parts.push(panel(x, y, stepW, stepH, { fill: p.cardSoftFill, radius: 14, stroke: p.stroke }));
    parts.push(singleLine(String(step.number).padStart(2, '0'), x + 18, y + 36, { fill: p.accent, fontSize: 25, family: 'display', weight: 'bold' }));
    parts.push(singleLine(uppercaseLabel(step.title), x + 60, y + 30, { fill: p.pal.muted, fontSize: 10, weight: 'semibold', letterSpacing: 1.4 }));
    const body = textBlock(step.body, stepW - 44, {
      x: x + 18,
      y: y + 58,
      fill: p.pal.textSoft,
      maxFontSize: 15,
      minFontSize: 10.5,
      maxLines: 5,
      lineHeightRatio: 1.24,
      truncate: false,
    });
    parts.push(body.svg);
    parts.push(line(x + 18, y + stepH - 16, x + stepW - 18, y + stepH - 16, p.accent2, 1, 'stroke-opacity="0.32"'));
  });

  // Columna Derecha Abajo: Errores a evitar + Cuándo aplicar / Criterios de dominio
  const bottomY = leftY + routeH + 20;
  const bottomH = leftH - routeH - 20;
  const errorW = 610;
  const arrowIndex = spec.misconception.indexOf('→');
  const errorText = spec.misconceptionFix?.error || (arrowIndex >= 0 ? spec.misconception.slice(0, arrowIndex).trim() : spec.misconception);
  const correctionText = spec.misconceptionFix?.correction || (arrowIndex >= 0 ? spec.misconception.slice(arrowIndex + 1).trim() : '');

  parts.push(panel(rightX, bottomY, errorW, bottomH, { fill: p.errorFill, radius: 22, stroke: p.errorStroke }));
  parts.push(rect(rightX, bottomY, 4, bottomH, `rx="2" fill="${p.pal.red}"`));
  parts.push(sectionLabel(rightX + 26, bottomY + 40, errorW - 52, 'Error común y prevención', p.pal.red, 'ALERTA', p.pal.muted));
  const misconception = textBlock(errorText, errorW - 52, {
    x: rightX + 26,
    y: bottomY + 76,
    fill: p.pal.text,
    maxFontSize: 16,
    minFontSize: 11,
    maxLines: 3,
    lineHeightRatio: 1.32,
    truncate: false,
  });
  parts.push(misconception.svg);

  if (correctionText) {
    const dividerY = bottomY + 158;
    parts.push(line(rightX + 26, dividerY, rightX + errorW - 26, dividerY, p.stroke, 1, 'stroke-opacity="0.6"'));
    parts.push(singleLine('CÓMO EVITARLO', rightX + 26, dividerY + 24, { fill: p.accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 }));
    const correction = textBlock(correctionText, errorW - 52, {
      x: rightX + 26,
      y: dividerY + 46,
      fill: p.pal.textSoft,
      maxFontSize: 15,
      minFontSize: 11,
      maxLines: 3,
      lineHeightRatio: 1.3,
      truncate: false,
    });
    parts.push(correction.svg);
  }

  if (spec.applicationSummary) {
    const appBoxY = bottomY + bottomH - 118;
    parts.push(panel(rightX + 20, appBoxY, errorW - 40, 100, { fill: p.appFill, radius: 12, stroke: p.appStroke }));
    parts.push(singleLine('¿CUÁNDO Y DÓNDE SE APLICA?', rightX + 36, appBoxY + 24, { fill: p.pal.emerald, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 }));
    const appBlock = textBlock(spec.applicationSummary, errorW - 72, {
      x: rightX + 36,
      y: appBoxY + 48,
      fill: p.pal.textSoft,
      maxFontSize: 14,
      minFontSize: 10,
      maxLines: 3,
      lineHeightRatio: 1.25,
      truncate: false,
    });
    parts.push(appBlock.svg);
  }

  const projectX = rightX + errorW + 24;
  const projectW = rightW - errorW - 24;
  parts.push(panel(projectX, bottomY, projectW, bottomH, { fill: p.cardFill, radius: 22, stroke: p.stroke }));
  parts.push(sectionLabel(projectX + 26, bottomY + 40, projectW - 52, 'Lista de verificación', p.accent2, 'DOMINIO', p.pal.muted));
  const checkItems = (spec.conceptManual?.masteryChecklist ?? spec.criteria).slice(0, 3);
  parts.push(rubricRows(checkItems.map((c) => ({ label: c })), p, projectX + 26, bottomY + 76, projectW - 52, 3, 52));
  const paecY = bottomY + bottomH - 86;
  parts.push(panel(projectX + 22, paecY, projectW - 44, 68, { fill: p.cardSoftFill, radius: 12, stroke: p.stroke }));
  parts.push(singleLine('VINCULACIÓN PAEC', projectX + 36, paecY + 22, { fill: p.accent, fontSize: 9, weight: 'semibold', letterSpacing: 1.3 }));
  const artifactMini = textBlock(`${spec.project.artifactName} · ${spec.project.communityUtility}`, projectW - 72, {
    x: projectX + 36,
    y: paecY + 40,
    fill: p.pal.textSoft,
    maxFontSize: 12.5,
    minFontSize: 9.5,
    maxLines: 2,
    lineHeightRatio: 1.22,
    truncate: false,
  });
  parts.push(artifactMini.svg);

  parts.push(footer(width, height, `${spec.meta.schoolName} · ${spec.meta.teacherName}`, 'SACRINT · MANUAL DE CONCEPTOS 16:9', p.accent, p.theme));
  return svgDocument(width, height, parts.join(''), spec.pack.accent, spec.pack.accent2, spec.style.id, 'infographic', p.theme);
}

function renderLetter(spec: SacrintInfographicSpec): string {
  const { width, height } = INFOGRAPHIC.letter;
  const p = resolvePalette(spec);
  const parts: string[] = [];
  const margin = 60;
  const contentW = width - margin * 2;
  const hasDiagram = Boolean(spec.diagram?.available);

  parts.push(glow(200, 180, 430, 'url(#sacrint-glow-gold)', p.isLight ? 0.3 : 0.52));
  parts.push(glow(1080, 1280, 520, 'url(#sacrint-glow-blue)', p.isLight ? 0.3 : 0.7));
  parts.push(topHud(width, `${spec.pack.short} / MANUAL DE CONCEPTOS`, `MISIÓN ${String(spec.meta.missionNumber).padStart(2, '0')}`, p.accent, p.theme));
  parts.push(dotGrid(margin, 104, contentW, 6, p.isLight ? 0.14 : 0.35));

  const title = textBlock(spec.title, contentW, {
    x: margin,
    y: 162,
    fill: p.pal.white,
    family: 'display',
    weight: 'bold',
    maxFontSize: 50,
    minFontSize: 26,
    maxLines: 3,
    lineHeightRatio: 1.05,
    letterSpacing: -1,
    truncate: false,
  });
  parts.push(title.svg);
  const subtitleY = 162 + title.fitted.height + 18;
  parts.push(singleLine(uppercaseLabel(spec.subtitle), margin, subtitleY, { fill: p.accent, fontSize: 11, weight: 'semibold', letterSpacing: 1.8 }));
  parts.push(line(margin, subtitleY + 14, margin + 520, subtitleY + 14, p.accent, 1.2, 'stroke-opacity="0.55"'));

  let y = subtitleY + 32;
  const band1H = 104;
  const formulaW = Math.round(contentW * 0.54);
  parts.push(formulaPanel(spec, p, margin, y, formulaW, band1H, 23));

  const keyBoxX = margin + formulaW + 14;
  const keyBoxW = contentW - formulaW - 14;
  parts.push(panel(keyBoxX, y, keyBoxW, band1H, { fill: p.cardFill, radius: 14, stroke: p.stroke }));
  parts.push(singleLine('IDEAS Y REGLAS CLAVE', keyBoxX + 16, y + 20, { fill: p.accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.5 }));
  const keyText = (spec.keyConcepts ?? [spec.claim]).slice(0, 2).map((c) => `• ${c}`).join('\n');
  const keyBlock = textBlock(keyText, keyBoxW - 32, {
    x: keyBoxX + 16,
    y: y + 40,
    fill: p.pal.textSoft,
    maxFontSize: 12.5,
    minFontSize: 9,
    maxLines: 4,
    lineHeightRatio: 1.25,
    truncate: false,
  });
  parts.push(keyBlock.svg);
  y += band1H + 14;

  if (hasDiagram) {
    const graphH = 382;
    parts.push(panel(margin, y, contentW, graphH, { fill: p.cardFill, radius: 18, stroke: p.stroke }));
    parts.push(sectionLabel(margin + 22, y + 32, contentW - 44, diagramModelLabel(spec.diagram), p.accent2, 'FIG. 01', p.pal.muted));
    parts.push(diagramSvg(spec.diagram, margin + 16, y + 48, contentW - 32, graphH - 64, { accent: p.accent, accent2: p.accent2, showTriangle: false, compact: true, theme: p.theme }));
    y += graphH + 14;

    parts.push(variableTiles(spec, p, margin, y, contentW, 88, 10, 12.5));
    y += 102;
  } else {
    const mapH = 220;
    const mapNodes = (spec.conceptManual?.conceptMap ?? []).slice(0, 3);
    parts.push(panel(margin, y, contentW, mapH, { fill: p.cardFill, radius: 18, stroke: p.stroke }));
    parts.push(sectionLabel(margin + 22, y + 30, contentW - 44, 'Mapa conceptual del tema', p.accent2, 'SÍNTESIS', p.pal.muted));
    if (mapNodes.length > 0) {
      const mGap = 14;
      const mW = (contentW - 44 - mGap * (mapNodes.length - 1)) / mapNodes.length;
      mapNodes.forEach((node, idx) => {
        const nx = margin + 22 + idx * (mW + mGap);
        parts.push(panel(nx, y + 48, mW, mapH - 64, { fill: p.cardSoftFill, radius: 12, stroke: idx === 0 ? p.accent : p.stroke }));
        parts.push(singleLine(uppercaseLabel(node.relation), nx + 12, y + 70, { fill: idx === 0 ? p.accent : p.accent2, fontSize: 9, weight: 'semibold', letterSpacing: 1.1 }));
        const ct = textBlock(node.concept, mW - 24, { x: nx + 12, y: y + 88, fill: p.pal.white, maxFontSize: 13, minFontSize: 9.5, maxLines: 2, weight: 'semibold', truncate: false });
        parts.push(ct.svg);
        const cd = textBlock(node.detail, mW - 24, { x: nx + 12, y: y + 124, fill: p.pal.textSoft, maxFontSize: 11.5, minFontSize: 8.5, maxLines: 4, lineHeightRatio: 1.24, truncate: false });
        parts.push(cd.svg);
      });
    }
    y += mapH + 14;

    const exH = 250;
    const ex = spec.quickExample;
    parts.push(panel(margin, y, contentW, exH, { fill: p.cardFill, radius: 18, stroke: p.stroke }));
    parts.push(sectionLabel(margin + 22, y + 30, contentW - 44, 'Mini-ejemplo resuelto', p.accent, 'APLICACIÓN', p.pal.muted));
    const exText = [
      ex?.problemStatement || spec.claim,
      ...(ex?.steps ?? []).slice(0, 3).map((s, idx) => `0${idx + 1}. ${s}`),
      ex?.interpretation ? `Resultado: ${ex.interpretation}` : '',
    ].filter(Boolean).join('\n');
    const exBlock = textBlock(exText, contentW - 44, {
      x: margin + 22,
      y: y + 54,
      fill: p.pal.text,
      maxFontSize: 13,
      minFontSize: 9.5,
      maxLines: 8,
      lineHeightRatio: 1.26,
      truncate: false,
    });
    parts.push(exBlock.svg);
    y += exH + 14;
  }

  const stepsH = 304;
  parts.push(panel(margin, y, contentW, stepsH, { fill: p.cardFill, radius: 18, stroke: p.stroke }));
  parts.push(sectionLabel(margin + 22, y + 32, contentW - 44, 'Procedimiento clave de estudio', p.accent, '4 CLAVES', p.pal.muted));
  spec.steps.slice(0, 4).forEach((step, index) => {
    const rowY = y + 52 + index * 60;
    parts.push(singleLine(String(step.number).padStart(2, '0'), margin + 22, rowY + 18, { fill: p.accent, fontSize: 18, family: 'display', weight: 'bold' }));
    parts.push(singleLine(uppercaseLabel(step.title), margin + 62, rowY + 8, { fill: p.pal.muted, fontSize: 9, weight: 'semibold', letterSpacing: 1.2 }));
    const body = textBlock(step.body, contentW - 110, {
      x: margin + 62,
      y: rowY + 26,
      fill: p.pal.textSoft,
      maxFontSize: 12.5,
      minFontSize: 8.5,
      maxLines: 2,
      lineHeightRatio: 1.28,
      truncate: false,
    });
    parts.push(body.svg);
    if (index < 3) parts.push(line(margin + 22, rowY + 50, margin + contentW - 22, rowY + 50, p.stroke, 1, 'stroke-opacity="0.5"'));
  });
  y += stepsH + 14;

  const bottomH = height - y - 74;
  const errorW = contentW * 0.49;
  const arrowIndex = spec.misconception.indexOf('→');
  const errorText = spec.misconceptionFix?.error || (arrowIndex >= 0 ? spec.misconception.slice(0, arrowIndex).trim() : spec.misconception);
  const correctionText = spec.misconceptionFix?.correction || (arrowIndex >= 0 ? spec.misconception.slice(arrowIndex + 1).trim() : '');

  parts.push(panel(margin, y, errorW, bottomH, { fill: p.errorFill, radius: 16, stroke: p.errorStroke }));
  parts.push(rect(margin, y, 3, bottomH, `rx="1.5" fill="${p.pal.red}"`));
  parts.push(singleLine('ERROR COMÚN', margin + 18, y + 26, { fill: p.pal.red, fontSize: 10, weight: 'semibold', letterSpacing: 1.4 }));
  const misconception = textBlock(errorText, errorW - 36, {
    x: margin + 18,
    y: y + 48,
    fill: p.pal.text,
    maxFontSize: 12.5,
    minFontSize: 8.5,
    maxLines: 3,
    lineHeightRatio: 1.28,
    truncate: false,
  });
  parts.push(misconception.svg);
  if (correctionText) {
    const dividerY = y + 104;
    parts.push(line(margin + 18, dividerY, margin + errorW - 18, dividerY, p.stroke, 1, 'stroke-opacity="0.6"'));
    parts.push(singleLine('CÓMO CORREGIRLO', margin + 18, dividerY + 20, { fill: p.accent2, fontSize: 9.5, weight: 'semibold', letterSpacing: 1.3 }));
    const correction = textBlock(correctionText, errorW - 36, {
      x: margin + 18,
      y: dividerY + 40,
      fill: p.pal.textSoft,
      maxFontSize: 12,
      minFontSize: 8.5,
      maxLines: bottomH < 290 ? 2 : 3,
      lineHeightRatio: 1.26,
      truncate: false,
    });
    parts.push(correction.svg);
  }
  if (spec.applicationSummary && bottomH >= 265) {
    const appY = y + bottomH - 68;
    parts.push(line(margin + 18, appY - 8, margin + errorW - 18, appY - 8, p.appStroke, 1, 'stroke-opacity="0.6"'));
    parts.push(singleLine('CUÁNDO SE APLICA', margin + 18, appY + 10, { fill: p.pal.emerald, fontSize: 9, weight: 'semibold', letterSpacing: 1.3 }));
    const appBlock = textBlock(spec.applicationSummary, errorW - 36, {
      x: margin + 18,
      y: appY + 28,
      fill: p.pal.textSoft,
      maxFontSize: 11.5,
      minFontSize: 8.5,
      maxLines: 2,
      lineHeightRatio: 1.24,
      truncate: false,
    });
    parts.push(appBlock.svg);
  }

  const projectX = margin + errorW + 14;
  const projectW = contentW - errorW - 14;
  parts.push(panel(projectX, y, projectW, bottomH, { fill: p.cardFill, radius: 16, stroke: p.stroke }));
  parts.push(singleLine('LISTA DE VERIFICACIÓN', projectX + 18, y + 26, { fill: p.accent2, fontSize: 10, weight: 'semibold', letterSpacing: 1.4 }));
  const checkItems = (spec.conceptManual?.masteryChecklist ?? spec.criteria).slice(0, 3).map((c) => ({ label: c }));
  parts.push(rubricRows(checkItems, p, projectX + 18, y + 48, projectW - 36, 3, 44));
  const paecMiniY = y + bottomH - 64;
  parts.push(panel(projectX + 14, paecMiniY, projectW - 28, 52, { fill: p.cardSoftFill, radius: 10, stroke: p.stroke }));
  parts.push(singleLine(`PAEC: ${spec.project.artifactName}`, projectX + 26, paecMiniY + 20, { fill: p.accent, fontSize: 9.5, weight: 'semibold' }));
  const utility = textBlock(spec.project.communityUtility, projectW - 52, {
    x: projectX + 26,
    y: paecMiniY + 34,
    fill: p.pal.textSoft,
    maxFontSize: 10,
    minFontSize: 8,
    maxLines: 1,
    truncate: false,
  });
  parts.push(utility.svg);

  parts.push(footer(width, height, `${spec.meta.schoolName} · ${spec.meta.teacherName}`, 'SACRINT · MANUAL CARTA', p.accent, p.theme));
  return svgDocument(width, height, parts.join(''), spec.pack.accent, spec.pack.accent2, spec.style.id, 'infographic', p.theme);
}

export function renderInfographicSvg(spec: SacrintInfographicSpec): string {
  return spec.format === 'wide' ? renderWide(spec) : renderLetter(spec);
}

export function infographicFilename(spec: SacrintInfographicSpec): string {
  return spec.format === 'wide' ? 'sacrint-infografia-16x9.svg' : 'sacrint-infografia-carta.svg';
}
