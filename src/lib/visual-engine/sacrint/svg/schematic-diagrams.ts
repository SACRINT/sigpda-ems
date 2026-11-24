import type {
  ArgumentDiagramSpec,
  BlockDiagramSpec,
  ClinicalFlowDiagramSpec,
  ConceptDiagramSpec,
  CreativeCycleDiagramSpec,
  LanguageDiagramSpec,
  ReactionDiagramSpec,
  RegulationFlowDiagramSpec,
  SacrintDiagramNode,
  SacrintDiagramSpec,
  SopFlowDiagramSpec,
  SystemMapDiagramSpec,
  TimelineDiagramSpec,
  TrainingCycleDiagramSpec,
} from '../types';
import { resolveLightAccent, SACRINT } from '../tokens';
import { singleLine, textBlock, uppercaseLabel } from '../text-layout';
import {
  adaptSchematicForLight,
  arrowHead,
  circle,
  diagramColors,
  diagramConnector,
  line,
  nodeCard,
  panel,
  path,
  rect,
  speciesCard,
  type DiagramRenderOptions,
} from './core-primitives';
import {
  exponentialGraph,
  geometryDiagram,
  linearGraph,
  quadraticGraph,
  system2x2Graph,
} from './math-graphs';

export function reactionScheme(
  diagram: ReactionDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 460;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 8 : 12;
  const cardW = Math.min(compact ? 190 : 260, width * 0.29);
  const cardH = compact ? 62 : 94;
  const leftX = x + pad;
  const rightX = x + width - pad - cardW;
  const arrowStart = leftX + cardW + 18;
  const arrowEnd = rightX - 18;
  const arrowY = y + height * 0.47;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.3, 'none', `stroke="${accent2}" stroke-opacity="0.08" stroke-width="18"`));
  parts.push(circle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.2, 'none', `stroke="${accent}" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="4 8"`));

  const stack = (nodes: SacrintDiagramNode[], startX: number, side: 'reactant' | 'product') => {
    const total = nodes.length * cardH + Math.max(0, nodes.length - 1) * gap;
    const startY = y + (height - total) / 2;
    return nodes
      .map((node, index) => speciesCard(node, startX, startY + index * (cardH + gap), cardW, cardH, side === 'reactant' ? accent : accent2, compact))
      .join('');
  };

  parts.push(stack(diagram.reactants.slice(0, 2), leftX, 'reactant'));
  parts.push(stack(diagram.products.slice(0, 2), rightX, 'product'));

  const conditionW = Math.max(80, arrowEnd - arrowStart - 16);
  const condition = textBlock(diagram.condition, conditionW, {
    x: arrowStart + 8,
    y: arrowY - 34,
    fill: SACRINT.textSoft,
    maxFontSize: compact ? 9 : 12,
    minFontSize: 7,
    maxLines: 2,
    lineHeightRatio: 1.25,
    truncate: true,
    anchor: 'middle',
  });
  parts.push(condition.svg);
  parts.push(diagramConnector(arrowStart, arrowY, arrowEnd, arrowY, diagram.available ? accent : SACRINT.muted, {
    width: compact ? 1.4 : 2,
    dash: diagram.available ? undefined : '6 6',
  }));
  parts.push(singleLine(diagram.available ? 'TRANSFORMACIÓN' : 'RELACIÓN CONCEPTUAL', (arrowStart + arrowEnd) / 2, arrowY + 24, {
    fill: diagram.available ? accent2 : SACRINT.muted,
    fontSize: compact ? 7 : 8,
    weight: 'semibold',
    letterSpacing: 1.4,
    anchor: 'middle',
  }));

  if (height > 250) {
    const note = textBlock(diagram.note, width - pad * 2, {
      x: x + pad,
      y: y + height - (compact ? 28 : 34),
      fill: SACRINT.muted,
      maxFontSize: compact ? 8 : 9,
      minFontSize: 7,
      maxLines: 3,
      lineHeightRatio: 1.2,
      truncate: false,
      anchor: 'middle',
    });
    parts.push(note.svg);
  }

  return parts.join('');
}

export function argumentMap(
  diagram: ArgumentDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 470;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 10 : 18;
  const thesisH = compact ? 54 : 76;
  const premiseH = compact ? 66 : 92;
  const bottomH = compact ? 64 : 90;
  const thesisW = width * 0.64;
  const thesisX = x + (width - thesisW) / 2;
  const contentH = thesisH + premiseH + bottomH + gap * 2;
  const thesisY = y + Math.max(pad, (height - contentH) / 2);
  const premiseW = (width - pad * 2 - gap) / 2;
  const premiseY = thesisY + thesisH + gap;
  const bottomY = premiseY + premiseH + gap;
  const bottomW = (width - pad * 2 - gap) / 2;
  const leftPremiseX = x + pad;
  const rightPremiseX = leftPremiseX + premiseW + gap;
  const objectionX = x + pad;
  const conclusionX = objectionX + bottomW + gap;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.46, Math.min(width, height) * 0.3, 'none', `stroke="${accent}" stroke-opacity="0.1" stroke-width="1" stroke-dasharray="3 8"`));

  const validPremises = diagram.premises.filter((p) => Boolean(p?.detail?.trim())).slice(0, 2);
  const hasObjection = Boolean(diagram.objection?.detail?.trim());
  const fullRowW = width - pad * 2;

  parts.push(nodeCard(diagram.thesis, thesisX, thesisY, thesisW, thesisH, {
    accent,
    accent2,
    compact,
    border: accent,
    maxLines: 2,
  }));
  if (validPremises.length === 2) {
    parts.push(nodeCard(validPremises[0]!, leftPremiseX, premiseY, premiseW, premiseH, {
      accent,
      accent2,
      compact,
      maxLines: 2,
    }));
    parts.push(nodeCard(validPremises[1]!, rightPremiseX, premiseY, premiseW, premiseH, {
      accent,
      accent2,
      compact,
      maxLines: 2,
    }));
  } else if (validPremises.length === 1) {
    parts.push(nodeCard(validPremises[0]!, leftPremiseX, premiseY, fullRowW, premiseH, {
      accent,
      accent2,
      compact,
      maxLines: 2,
    }));
  }
  if (hasObjection) {
    parts.push(nodeCard(diagram.objection, objectionX, bottomY, bottomW, bottomH, {
      accent,
      accent2,
      compact,
      border: 'rgba(255,49,49,0.58)',
      maxLines: 2,
    }));
    parts.push(nodeCard(diagram.conclusion, conclusionX, bottomY, bottomW, bottomH, {
      accent,
      accent2,
      compact,
      border: accent,
      maxLines: 2,
    }));
  } else {
    parts.push(nodeCard(diagram.conclusion, objectionX, bottomY, fullRowW, bottomH, {
      accent,
      accent2,
      compact,
      border: accent,
      maxLines: 2,
    }));
  }

  const thesisBottom = thesisY + thesisH;
  if (validPremises.length === 2) {
    parts.push(diagramConnector(thesisX + thesisW * 0.32, thesisBottom, leftPremiseX + premiseW / 2, premiseY, accent2, { width: 1 }));
    parts.push(diagramConnector(thesisX + thesisW * 0.68, thesisBottom, rightPremiseX + premiseW / 2, premiseY, accent2, { width: 1 }));
    if (hasObjection) {
      parts.push(diagramConnector(leftPremiseX + premiseW / 2, premiseY + premiseH, objectionX + bottomW / 2, bottomY, SACRINT.red, { width: 1, dash: '4 4' }));
      parts.push(diagramConnector(rightPremiseX + premiseW / 2, premiseY + premiseH, conclusionX + bottomW / 2, bottomY, accent, { width: 1 }));
    } else {
      parts.push(diagramConnector(x + width / 2, premiseY + premiseH, x + width / 2, bottomY, accent, { width: 1 }));
    }
  } else if (validPremises.length === 1) {
    parts.push(diagramConnector(x + width / 2, thesisBottom, x + width / 2, premiseY, accent2, { width: 1 }));
    if (hasObjection) {
      parts.push(diagramConnector(x + width * 0.35, premiseY + premiseH, objectionX + bottomW / 2, bottomY, SACRINT.red, { width: 1, dash: '4 4' }));
      parts.push(diagramConnector(x + width * 0.65, premiseY + premiseH, conclusionX + bottomW / 2, bottomY, accent, { width: 1 }));
    } else {
      parts.push(diagramConnector(x + width / 2, premiseY + premiseH, x + width / 2, bottomY, accent, { width: 1 }));
    }
  }

  return parts.join('');
}

export function languageMap(
  diagram: LanguageDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 460;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 14 : 24;
  const cardW = (width - pad * 2 - gap * 2) / 3;
  const cardH = compact ? 94 : 148;
  const contextH = compact ? 66 : 96;
  const contentH = cardH + contextH + gap;
  const topY = y + Math.max(pad, (height - contentH) / 2);
  const contextY = topY + cardH + gap;
  const inputX = x + pad;
  const ruleX = inputX + cardW + gap;
  const outputX = ruleX + cardW + gap;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.42, Math.min(width, height) * 0.3, 'none', `stroke="${accent2}" stroke-opacity="0.09" stroke-width="16"`));
  parts.push(nodeCard(diagram.input, inputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(nodeCard(diagram.rule, ruleX, topY, cardW, cardH, { accent, accent2, compact, border: accent, maxLines: 3 }));
  parts.push(nodeCard(diagram.output, outputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(nodeCard(diagram.context, x + pad, contextY, width - pad * 2, contextH, { accent, accent2, compact, maxLines: 2 }));

  const arrowY = topY + cardH / 2;
  parts.push(diagramConnector(inputX + cardW, arrowY, ruleX - 2, arrowY, accent, { width: 1.2 }));
  parts.push(diagramConnector(ruleX + cardW, arrowY, outputX - 2, arrowY, accent2, { width: 1.2 }));
  parts.push(diagramConnector(x + width / 2, topY + cardH + 2, x + width / 2, contextY - 6, accent, { width: 1, dash: '4 4' }));

  return parts.join('');
}

export function conceptMap(
  diagram: ConceptDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 470;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const nodeW = width * 0.32;
  const nodeH = compact ? 66 : 98;
  const centerW = width * 0.3;
  const centerH = compact ? 70 : 104;
  const centerX = x + (width - centerW) / 2;
  const centerY = y + (height - centerH) / 2;
  const positions = [
    { x: x + pad, y: y + pad },
    { x: x + width - pad - nodeW, y: y + pad },
    { x: x + pad, y: y + height - pad - nodeH },
    { x: x + width - pad - nodeW, y: y + height - pad - nodeH },
  ];
  const parts: string[] = [];

  parts.push(circle(x + width / 2, y + height / 2, Math.min(width, height) * 0.32, 'none', `stroke="${accent}" stroke-opacity="0.14" stroke-width="1" stroke-dasharray="3 8"`));
  const midX = centerX + centerW / 2;
  const midY = centerY + centerH / 2;
  for (const position of positions) {
    const targetX = position.x + nodeW / 2;
    const targetY = position.y + nodeH / 2;
    parts.push(`<path d="M ${midX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}" fill="none" stroke="${accent2}" stroke-opacity="0.72" stroke-width="1.2" stroke-dasharray="4 4"/>`);
    parts.push(circle(targetX, targetY, 3.2, accent2));
  }

  parts.push(nodeCard(diagram.center, centerX, centerY, centerW, centerH, {
    accent,
    accent2,
    compact,
    border: accent,
    fill: 'rgba(8,18,30,0.92)',
    maxLines: 2,
  }));
  diagram.nodes.slice(0, 4).forEach((node, index) => {
    const position = positions[index];
    if (!position) return;
    parts.push(nodeCard(node, position.x, position.y, nodeW, nodeH, {
      accent,
      accent2,
      compact,
      border: index % 2 === 0 ? accent2 : SACRINT.strokeSoft,
      maxLines: 2,
    }));
  });

  return parts.join('');
}

export function timelineDiagram(
  diagram: TimelineDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const events = diagram.events.slice(0, 4);
  const count = Math.max(1, events.length);
  const railY = y + height * 0.52;
  const slot = (width - pad * 2) / count;
  const cardW = Math.min(compact ? 200 : 244, slot - 14);
  const cardH = compact ? 84 : 108;
  const stemGap = compact ? 16 : 24;
  const parts: string[] = [];

  parts.push(circle(x + width * 0.5, y + height * 0.5, Math.min(width, height) * 0.3, 'none', `stroke="${accent}" stroke-opacity="0.08" stroke-width="16"`));
  parts.push(line(x + pad, railY, x + width - pad, railY, accent, compact ? 1.4 : 1.8, 'stroke-opacity="0.85"'));

  events.forEach((event, index) => {
    const cx = x + pad + slot * (index + 0.5);
    const above = index % 2 === 0;
    const cardY = above ? railY - stemGap - cardH : railY + stemGap;
    const cardX = Math.max(x + pad, Math.min(cx - cardW / 2, x + width - pad - cardW));
    parts.push(line(cx, railY, cx, above ? cardY + cardH : cardY, above ? accent : accent2, 1, 'stroke-opacity="0.55"'));
    parts.push(circle(cx, railY, compact ? 5 : 6.5, above ? accent : accent2, 'stroke="#050C15" stroke-width="2"'));
    parts.push(nodeCard(event, cardX, cardY, cardW, cardH, { accent, accent2, compact, maxLines: 2 }));
    if (index < events.length - 1) {
      const nextCx = x + pad + slot * (index + 1.5);
      parts.push(diagramConnector(cx + 10, railY, nextCx - 12, railY, accent2, { width: 1 }));
    }
  });

  const spanW = Math.min(width * 0.52, 320);
  parts.push(rect(x + width / 2 - spanW / 2, y + pad, spanW, compact ? 26 : 32, `rx="13" fill="#050C15" fill-opacity="0.82" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"`));
  parts.push(singleLine(uppercaseLabel(diagram.span), x + width / 2, y + pad + (compact ? 18 : 22), {
    fill: accent,
    fontSize: compact ? 9 : 10,
    weight: 'semibold',
    letterSpacing: 1.6,
    anchor: 'middle',
  }));

  return parts.join('');
}

export function systemMapDiagram(
  diagram: SystemMapDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 8 : 12;
  const centerW = Math.min(width * 0.55, compact ? 380 : 460);
  const centerH = compact ? 64 : 90;
  const centerX = x + (width - centerW) / 2;
  const centerY = y + pad;
  const compW = (width - pad * 2 - gap * 3) / 4;
  const compH = compact ? 88 : 118;
  const compY = centerY + centerH + (compact ? 18 : 24);
  const envH = compact ? 52 : 66;
  const envY = y + height - pad - envH;
  const parts: string[] = [];

  parts.push(circle(x + width / 2, centerY + centerH / 2, Math.min(width, height) * 0.26, 'none', `stroke="${accent2}" stroke-opacity="0.09" stroke-width="14"`));

  diagram.components.slice(0, 4).forEach((component, index) => {
    const compX = x + pad + index * (compW + gap);
    parts.push(diagramConnector(centerX + centerW / 2, centerY + centerH, compX + compW / 2, compY, accent2, { width: 1, dash: '4 4', head: false }));
    parts.push(nodeCard(component, compX, compY, compW, compH, { accent, accent2, compact, maxLines: 3 }));
  });

  parts.push(nodeCard(diagram.center, centerX, centerY, centerW, centerH, {
    accent,
    accent2,
    compact,
    border: accent,
    fill: 'rgba(8,18,30,0.9)',
    maxLines: 2,
  }));
  parts.push(diagramConnector(x + width / 2, compY + compH, x + width / 2, envY - 4, accent, { width: 1.2 }));
  parts.push(nodeCard(diagram.environment, x + pad, envY, width - pad * 2, envH, { accent, accent2, compact, maxLines: 2 }));

  return parts.join('');
}

export function clinicalFlowDiagram(
  diagram: ClinicalFlowDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const stages = diagram.stages.slice(0, 4);
  const count = Math.max(1, stages.length);
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const noteH = height > 240 ? (compact ? 34 : 40) : 0;
  const cardH = height - pad * 2 - noteH - (noteH ? 14 : 0);
  const cardY = y + pad;
  const parts: string[] = [];

  parts.push(rect(x + pad, cardY, width - pad * 2, cardH, `fill="#050C15" fill-opacity="0.35" rx="12"`));

  stages.forEach((stage, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const stageColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(stage, cardX, cardY + 10, cardW, cardH - 20, { accent, accent2, compact, border: stageColor, maxLines: compact ? 3 : 4 }));
    if (index < stages.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  if (noteH > 0) {
    const note = textBlock(diagram.note, width - pad * 2, {
      x: x + pad,
      y: y + height - pad - noteH + 12,
      fill: SACRINT.muted,
      maxFontSize: compact ? 8 : 9,
      minFontSize: 7,
      maxLines: 3,
      lineHeightRatio: 1.2,
      truncate: false,
      anchor: 'middle',
    });
    parts.push(note.svg);
  }

  return parts.join('');
}

export function blockDiagram(
  diagram: BlockDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 18;
  const gap = compact ? 12 : 18;
  const cardW = (width - pad * 2 - gap * 2) / 3;
  const feedbackH = compact ? 56 : 72;
  const loopGap = compact ? 20 : 30;
  const cardH = height - pad * 2 - feedbackH - loopGap;
  const topY = y + pad;
  const feedbackW = Math.min(width * 0.52, cardW * 1.6);
  const feedbackX = x + (width - feedbackW) / 2;
  const feedbackY = topY + cardH + loopGap;
  const inputX = x + pad;
  const processX = inputX + cardW + gap;
  const outputX = processX + cardW + gap;
  const arrowY = topY + cardH / 2;
  const parts: string[] = [];

  parts.push(circle(x + width / 2, topY + cardH / 2, Math.min(width, height) * 0.28, 'none', `stroke="${accent2}" stroke-opacity="0.08" stroke-width="14"`));

  parts.push(nodeCard(diagram.input, inputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(nodeCard(diagram.process, processX, topY, cardW, cardH, { accent, accent2, compact, border: accent, maxLines: 3 }));
  parts.push(nodeCard(diagram.output, outputX, topY, cardW, cardH, { accent, accent2, compact, border: accent2, maxLines: 3 }));
  parts.push(diagramConnector(inputX + cardW, arrowY, processX - 2, arrowY, accent, { width: 1.3 }));
  parts.push(diagramConnector(processX + cardW, arrowY, outputX - 2, arrowY, accent2, { width: 1.3 }));

  parts.push(nodeCard(diagram.feedback, feedbackX, feedbackY, feedbackW, feedbackH, { accent, accent2, compact, maxLines: 2 }));
  parts.push(diagramConnector(outputX + cardW / 2, topY + cardH + 4, feedbackX + feedbackW - 20, feedbackY + feedbackH / 2, accent2, { width: 1, dash: '4 4' }));
  parts.push(diagramConnector(feedbackX + 20, feedbackY + feedbackH / 2, inputX + cardW / 2, topY + cardH + 4, accent, { width: 1, dash: '4 4' }));

  return parts.join('');
}

export function sopFlowDiagram(
  diagram: SopFlowDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const steps = diagram.steps.slice(0, 4);
  const count = Math.max(1, steps.length);
  const standardH = compact ? 46 : 58;
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const cardH = height - pad * 2 - standardH - 16;
  const cardY = y + pad;
  const standardY = y + height - pad - standardH;
  const parts: string[] = [];

  steps.forEach((step, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const stepColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(step, cardX, cardY + 8, cardW, cardH - 8, { accent, accent2, compact, border: stepColor, maxLines: compact ? 3 : 4 }));
    parts.push(circle(cardX + 18, cardY + 8, compact ? 11 : 13, stepColor, 'stroke="#050C15" stroke-width="2"'));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), cardX + 18, cardY + (compact ? 12 : 14), {
      fill: '#050C15',
      fontSize: compact ? 9 : 11,
      family: 'display',
      weight: 'bold',
      anchor: 'middle',
    }));
    if (index < steps.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  parts.push(panel(x + pad, standardY, width - pad * 2, standardH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
  parts.push(singleLine(uppercaseLabel(diagram.standard), x + width / 2, standardY + standardH / 2 + (compact ? 3 : 4), {
    fill: SACRINT.textSoft,
    fontSize: compact ? 9 : 10,
    weight: 'semibold',
    letterSpacing: 1,
    anchor: 'middle',
  }));

  return parts.join('');
}

export function creativeCycleDiagram(
  diagram: CreativeCycleDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const phases = diagram.phases.filter((p) => Boolean(p?.detail?.trim())).slice(0, 4);
  const count = Math.max(1, phases.length);
  const statementText = (diagram.statement || '').trim();
  const hasStrip = Boolean(statementText);
  const stripH = hasStrip ? (compact ? 44 : 56) : 0;
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const cardH = height - pad * 2 - stripH - (hasStrip ? 16 : 8);
  const cardY = y + pad;
  const stripY = y + height - pad - stripH;
  const parts: string[] = [];

  phases.forEach((phase, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const phaseColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(phase, cardX, cardY + 8, cardW, cardH - 8, { accent, accent2, compact, border: phaseColor, maxLines: compact ? 3 : 4 }));
    parts.push(circle(cardX + cardW - 16, cardY + 8, compact ? 10 : 12, phaseColor, 'stroke="#050C15" stroke-width="2"'));
    parts.push(singleLine(String(index + 1).padStart(2, '0'), cardX + cardW - 16, cardY + (compact ? 11 : 13), {
      fill: '#050C15',
      fontSize: compact ? 8 : 10,
      family: 'display',
      weight: 'bold',
      anchor: 'middle',
    }));
    if (index < phases.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  if (hasStrip) {
    parts.push(panel(x + pad, stripY, width - pad * 2, stripH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
    parts.push(singleLine(statementText, x + width / 2, stripY + stripH / 2 + (compact ? 3 : 4), {
      fill: SACRINT.textSoft,
      fontSize: compact ? 8 : 9,
      weight: 'semibold',
      anchor: 'middle',
    }));
  }

  return parts.join('');
}

export function trainingCycleDiagram(
  diagram: TrainingCycleDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const phases = diagram.phases.filter((p) => Boolean(p?.detail?.trim())).slice(0, 4);
  const count = Math.max(1, phases.length);
  const principleText = (diagram.principle || '').trim();
  const hasStrip = Boolean(principleText);
  const stripH = hasStrip ? (compact ? 42 : 52) : 0;
  const returnGap = compact ? 16 : 22;
  const cardW = (width - pad * 2 - gap * (count - 1)) / count;
  const cardH = height - pad * 2 - stripH - returnGap - (hasStrip ? 12 : 4);
  const cardY = y + pad;
  const returnY = cardY + cardH + returnGap / 2;
  const stripY = y + height - pad - stripH;
  const parts: string[] = [];

  parts.push(panel(x + pad, cardY, width - pad * 2, cardH + 8, { fill: 'rgba(5,12,20,0.35)', radius: 12, stroke: SACRINT.strokeSoft }));

  phases.forEach((phase, index) => {
    const cardX = x + pad + index * (cardW + gap);
    const phaseColor = index % 2 === 0 ? accent : accent2;
    const intensity = 0.32 + index * 0.16;
    parts.push(rect(cardX + 10, cardY + cardH - 6, cardW - 20, 4, `fill="${phaseColor}" fill-opacity="${intensity.toFixed(2)}" rx="2"`));
    parts.push(nodeCard(phase, cardX, cardY + 10, cardW, cardH - 18, { accent, accent2, compact, border: phaseColor, maxLines: compact ? 3 : 4 }));
    if (index < phases.length - 1) {
      parts.push(diagramConnector(cardX + cardW + 1, cardY + cardH / 2, cardX + cardW + gap - 2, cardY + cardH / 2, accent, { width: 1.4 }));
    }
  });

  if (phases.length > 1) {
    const firstX = x + pad + cardW / 2;
    const lastX = x + pad + (phases.length - 1) * (cardW + gap) + cardW / 2;
    const bottomY = cardY + cardH + 4;
    parts.push(path(`M ${lastX} ${bottomY} L ${lastX} ${returnY} L ${firstX} ${returnY} L ${firstX} ${bottomY}`, `fill="none" stroke="${accent2}" stroke-opacity="0.75" stroke-width="1.2" stroke-dasharray="4 4"`));
    parts.push(arrowHead(firstX, returnY, firstX, bottomY, accent2, 8));
  }

  if (hasStrip) {
    parts.push(panel(x + pad, stripY, width - pad * 2, stripH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
    parts.push(singleLine(principleText, x + width / 2, stripY + stripH / 2 + (compact ? 3 : 4), {
      fill: SACRINT.textSoft,
      fontSize: compact ? 8 : 9,
      weight: 'semibold',
      anchor: 'middle',
    }));
  }

  return parts.join('');
}

export function regulationFlowDiagram(
  diagram: RegulationFlowDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const compact = options.compact ?? height < 400;
  const { accent, accent2 } = diagramColors(options);
  const pad = compact ? 12 : 16;
  const gap = compact ? 8 : 12;
  const anchorText = (diagram.anchor || '').trim();
  const hasAnchor = Boolean(anchorText);
  const anchorH = hasAnchor ? (compact ? 42 : 52) : 0;
  const gridH = height - pad * 2 - anchorH - (hasAnchor ? 14 : 0);
  const cardW = (width - pad * 2 - gap) / 2;
  const cardH = (gridH - gap) / 2;
  const gridX = x + pad;
  const gridY = y + pad;
  const anchorY = y + height - pad - anchorH;
  const stages = diagram.stages.filter((s) => Boolean(s?.detail?.trim())).slice(0, 4);
  const positions = [
    { cardX: gridX, cardY: gridY },
    { cardX: gridX + cardW + gap, cardY: gridY },
    { cardX: gridX + cardW + gap, cardY: gridY + cardH + gap },
    { cardX: gridX, cardY: gridY + cardH + gap },
  ];
  const parts: string[] = [];

  stages.forEach((stage, index) => {
    const position = positions[index];
    if (!position) return;
    const stageColor = index % 2 === 0 ? accent : accent2;
    parts.push(nodeCard(stage, position.cardX, position.cardY, cardW, cardH, { accent, accent2, compact, border: stageColor, maxLines: compact ? 2 : 3 }));
  });

  if (stages.length > 1) parts.push(diagramConnector(gridX + cardW + 2, gridY + cardH / 2, gridX + cardW + gap - 2, gridY + cardH / 2, accent, { width: 1.3 }));
  if (stages.length > 2) parts.push(diagramConnector(gridX + cardW + gap + cardW / 2, gridY + cardH + 2, gridX + cardW + gap + cardW / 2, gridY + cardH + gap - 2, accent2, { width: 1.3 }));
  if (stages.length > 3) parts.push(diagramConnector(gridX + cardW + gap - 2, gridY + cardH + gap + cardH / 2, gridX + cardW + 2, gridY + cardH + gap + cardH / 2, accent, { width: 1.3 }));
  if (stages.length > 3) parts.push(diagramConnector(gridX + cardW / 2, gridY + cardH + gap - 2, gridX + cardW / 2, gridY + cardH + 2, accent2, { width: 1.3, dash: '4 4' }));

  if (hasAnchor) {
    parts.push(panel(x + pad, anchorY, width - pad * 2, anchorH, { fill: 'rgba(5,12,20,0.8)', radius: 10, stroke: accent, strokeWidth: 1 }));
    parts.push(singleLine(anchorText, x + width / 2, anchorY + anchorH / 2 + (compact ? 3 : 4), {
      fill: SACRINT.textSoft,
      fontSize: compact ? 8 : 9,
      weight: 'semibold',
      anchor: 'middle',
    }));
  }

  return parts.join('');
}

export function diagramSvg(
  diagram: SacrintDiagramSpec,
  x: number,
  y: number,
  width: number,
  height: number,
  options: DiagramRenderOptions = {}
): string {
  const theme = options.theme ?? 'dark';
  const rawAccent = options.accent ?? SACRINT.gold;
  const rawAccent2 = options.accent2 ?? SACRINT.blue;
  const resolvedOpts: DiagramRenderOptions =
    theme === 'light'
      ? {
          ...options,
          accent: resolveLightAccent(rawAccent),
          accent2: resolveLightAccent(rawAccent2),
          theme: 'light',
        }
      : options;

  let svg: string;
  switch (diagram.kind) {
    case 'linear':
      return linearGraph(diagram, x, y, width, height, resolvedOpts);
    case 'quadratic':
      return quadraticGraph(diagram, x, y, width, height, resolvedOpts);
    case 'system-2x2':
      return system2x2Graph(diagram, x, y, width, height, resolvedOpts);
    case 'exponential':
      return exponentialGraph(diagram, x, y, width, height, resolvedOpts);
    case 'geometry':
      return geometryDiagram(diagram, x, y, width, height, resolvedOpts);
    case 'reaction':
      svg = reactionScheme(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'argument':
      svg = argumentMap(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'language':
      svg = languageMap(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'concept':
      svg = conceptMap(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'timeline':
      svg = timelineDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'system-map':
      svg = systemMapDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'clinical-flow':
      svg = clinicalFlowDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'block-diagram':
      svg = blockDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'sop-flow':
      svg = sopFlowDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'creative-cycle':
      svg = creativeCycleDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'training-cycle':
      svg = trainingCycleDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
    case 'regulation-flow':
      svg = regulationFlowDiagram(diagram, x, y, width, height, resolvedOpts);
      break;
  }
  return theme === 'light' ? adaptSchematicForLight(svg, rawAccent, rawAccent2) : svg;
}
