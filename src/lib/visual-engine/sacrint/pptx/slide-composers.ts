import PptxGenJS from 'pptxgenjs';
import { getRuntimePlatformName } from '@/lib/platform/platform-name-shared';
import type {
  SacrintChallengeSlide,
  SacrintConceptSlide,
  SacrintDeckSpec,
  SacrintDemoSlide,
  SacrintEvidenceSlide,
  SacrintHookSlide,
  SacrintPracticeSlide,
  SacrintSlide,
} from '../types';
import { diagramFooterLabel, diagramModelLabel } from '../diagrams/registry';
import {
  addEllipse,
  addFactStrip,
  addFooter,
  addHud,
  addLabel,
  addLine,
  addPanel,
  addStyleBackdrop,
  addText,
  C,
  coverArt,
  FONT_DISPLAY,
  inch,
  pt,
} from './theme-and-primitives';
import { addDiagram } from './diagram-drawers';
import { ensureCroppedPngDataUri } from '../../scene-allocator-node';

interface PreparedDeckScenes {
  /** Recorte exacto 700×760 (ratio 0.921) para panel lateral de portada sin estiramiento. */
  heroDataUri?: string;
  /** Recorte exacto 872×148 para banda superior con fórmula en slide de concepto. */
  conceptWithFormulaDataUri?: string;
  /** Recorte exacto 872×182 para banda superior sin fórmula en slide de concepto. */
  conceptWideDataUri?: string;
  /** Respaldo 872×148 / 872×182 seguro (sin protoboard) para slides de software/ofimática. */
  softwareSafeWithFormulaDataUri?: string;
  softwareSafeWideDataUri?: string;
  conceptIsHardwareProtoboard?: boolean;
}

const SOFTWARE_CONCEPT_SLIDE_RE =
  /\b(?:hojas?\s+de\s+c[aá]lculo|excel|f[oó]rmula|funci[oó]n\s+si|promedio|ciudadan[ií]a|privacidad|identidad\s+digital|licencias?|creative\s+commons|gpl|software\s+libre|contaminaci[oó]n\s+digital|desigualdad|datos|tabul|gr[aá]fic)\b/i;
const HARDWARE_CONCEPT_SLIDE_RE =
  /\b(?:hardware|protoboard|arduino|circuito|sensor|perif[eé]ric|microcontrolador)\b/i;

async function prepareDeckScenesForPptx(deck: SacrintDeckSpec): Promise<PreparedDeckScenes> {
  const heroScene = deck.editorialScenes?.hero;
  const conceptScene = deck.editorialScenes?.concept;
  const heroRaw = heroScene?.dataUri;
  const conceptRaw = conceptScene?.dataUri;
  // Basado en etiquetas semánticas del catálogo (evita hardcodear nombres de archivo o arquetipos):
  // cualquier escena etiquetada como `protoboard` queda bloqueada en diapositivas de software/ofimática/ciudadanía.
  const conceptIsHardwareProtoboard = Boolean(
    conceptScene?.visualTags?.includes('protoboard') ||
      (conceptScene &&
        conceptScene.domainId === 'cultura_digital_programacion_ti' &&
        (conceptScene.id === 'tic-01-portada' || conceptScene.id === 'tic-02-concepto')),
  );
  const heroIsSoftwareSafe = Boolean(
    heroRaw &&
      heroScene &&
      !heroScene.visualTags?.includes('protoboard') &&
      heroScene.id !== 'tic-01-portada' &&
      heroScene.id !== 'tic-02-concepto',
  );
  const [
    heroDataUri,
    conceptWithFormulaDataUri,
    conceptWideDataUri,
    softwareSafeWithFormulaDataUri,
    softwareSafeWideDataUri,
  ] = await Promise.all([
    heroRaw ? ensureCroppedPngDataUri(heroRaw, 700, 760).catch(() => undefined) : Promise.resolve(undefined),
    conceptRaw ? ensureCroppedPngDataUri(conceptRaw, 872, 148).catch(() => undefined) : Promise.resolve(undefined),
    conceptRaw ? ensureCroppedPngDataUri(conceptRaw, 872, 182).catch(() => undefined) : Promise.resolve(undefined),
    heroIsSoftwareSafe && conceptIsHardwareProtoboard && heroRaw
      ? ensureCroppedPngDataUri(heroRaw, 872, 148).catch(() => undefined)
      : Promise.resolve(undefined),
    heroIsSoftwareSafe && conceptIsHardwareProtoboard && heroRaw
      ? ensureCroppedPngDataUri(heroRaw, 872, 182).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);
  return {
    heroDataUri,
    conceptWithFormulaDataUri,
    conceptWideDataUri,
    softwareSafeWithFormulaDataUri,
    softwareSafeWideDataUri,
    conceptIsHardwareProtoboard,
  };
}

function renderCover(
  slide: PptxGenJS.Slide,
  deck: SacrintDeckSpec,
  spec: Extract<SacrintSlide, { kind: 'cover' }>,
  preparedScenes?: PreparedDeckScenes
) {
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, `${deck.pack.short} / SACRINT`, `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} · BLOQUE ${String(deck.meta.blockNumber).padStart(2, '0')}`, 0, accent);
  addLabel(slide, spec.eyebrow, 80, 206, 620, 20, accent, 10);
  addLine(slide, 80, 236, 420, 236, accent, 1.5);
  addText(slide, spec.title, 80, 246, 940, 210, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(spec.title.length > 55 ? 44 : 58),
    bold: true,
    color: C.white,
    valign: 'middle',
    maxLines: 3,
  });
  addText(slide, spec.subtitle ?? '', 80, 464, 920, 52, {
    fontSize: pt(20),
    color: C.textSoft,
    maxLines: 2,
  });
  const metaUpper = (spec.metaLine || '').toLocaleUpperCase('es-MX');
  addText(slide, metaUpper, 80, 518, 940, 44, {
    fontSize: pt(metaUpper.length > 68 ? 11.5 : 14),
    bold: true,
    color: C.muted,
    maxLines: 2,
  });

  if (spec.topicsCovered && spec.topicsCovered.length > 0) {
    addPanel(slide, 80, 576, 940, 232, { fill: C.panel, transparency: 14, stroke: C.strokeSoft });
    addLabel(slide, 'Temas y clases incluidas en esta presentación', 102, 590, 620, 18, accent, 8);
    spec.topicsCovered.slice(0, 6).forEach((topic, idx) => {
      addText(slide, `• ${topic}`, 102, 616 + idx * 30, 896, 26, {
        fontSize: pt(14),
        color: C.textSoft,
        maxLines: 1,
      });
    });
  }

  addPanel(slide, 80, 820, 940, 54, { fill: C.panel, transparency: 22 });
  addText(slide, spec.footerNote, 102, 828, 890, 38, { fontSize: pt(spec.footerNote.length > 90 ? 13 : 16), color: C.textSoft, maxLines: 2 });
  addFactStrip(slide, spec.facts, 80, 880, 940, 84);
  if (preparedScenes?.heroDataUri) {
    addPanel(slide, 1140, 150, 700, 760, { fill: C.panel, transparency: 10, stroke: accent });
    slide.addImage({
      data: preparedScenes.heroDataUri,
      x: inch(1140),
      y: inch(150),
      w: inch(700),
      h: inch(760),
    });
  } else {
    coverArt(slide, deck, accent, accent2);
  }
  addFooter(slide, deck, 'SACRINT · EMS', accent);
}

function renderHook(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintHookSlide, { kind: 'hook' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Fenómeno situado', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONTEXTO`, 1, accent);
  addText(slide, spec.title, 80, 214, 980, 130, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(spec.title.length > 45 ? 38 : 48),
    bold: true,
    color: C.white,
    maxLines: 2,
  });
  addLabel(slide, spec.subtitle ?? '', 80, 354, 600, 20, accent, 10);
  addText(slide, '“', 82, 400, 80, 72, { fontFace: FONT_DISPLAY, fontSize: pt(72), bold: true, color: accent });
  addText(slide, spec.story, 146, 420, 860, 360, {
    fontSize: pt(spec.story.length > 520 ? 16 : spec.story.length > 360 ? 19 : 22),
    color: C.text,
    lineSpacingMultiple: 1.06,
    maxLines: 14,
  });
  addLine(slide, 146, 792, 1020, 792, accent, 0.75);

  addPanel(slide, 1120, 166, 720, 276, { fill: C.panel, transparency: 10 });
  slide.addShape('rect', { x: inch(1120), y: inch(166), w: inch(4), h: inch(276), fill: { color: accent }, line: { color: accent, transparency: 100 } });
  addLabel(slide, 'Pregunta detonadora', 1148, 194, 400, 18, accent, 9);
  addText(slide, spec.question, 1148, 270, 664, 176, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(24),
    color: C.white,
    maxLines: 4,
    lineHeightRatio: 1.34,
  });

  spec.nodes.slice(0, 3).forEach((node, index) => {
    const y = 486 + index * 132;
    addPanel(slide, 1120, y, 720, 118, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addText(slide, String(index + 1).padStart(2, '0'), 1142, y + 22, 30, 20, { fontSize: pt(11), bold: true, color: accent2 });
    addLabel(slide, node.label, 1180, y + 22, 240, 18, accent, 9);
    addText(slide, node.detail, 1180, y + 54, 620, 48, { fontSize: pt(18), color: C.textSoft });
  });

  addFactStrip(slide, spec.facts, 80, 854, 980, 84);
  addFooter(slide, deck, 'observar · modelar · decidir', accent);
}

function renderConcept(
  slide: PptxGenJS.Slide,
  deck: SacrintDeckSpec,
  spec: Extract<SacrintConceptSlide, { kind: 'concept' }>,
  preparedScenes?: PreparedDeckScenes
) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  const isGuide = Boolean(spec.isLessonGuide);
  const hasDiagram = Boolean(spec.diagram?.available);
  const sesTag = spec.sessionNumber ? `SESIÓN ${String(spec.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;
  addHud(
    slide,
    isGuide ? 'Conocimiento nuevo' : 'Núcleo técnico',
    isGuide ? `${sesTag} // PIZARRÓN DOCENTE (1/2)` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // CONCEPTO CERO`,
    isGuide ? 0 : 2,
    accent,
    isGuide ? 2 : 8
  );

  const headerW = hasDiagram ? 712 : 1760;
  addText(slide, spec.title, 80, 132, headerW, hasDiagram ? 78 : 70, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(spec.title.length > 38 ? 26 : 32),
    bold: true,
    color: C.white,
    maxLines: 2,
  });
  const hasSubtitle = Boolean(spec.subtitle?.trim());
  if (hasSubtitle) {
    addText(slide, spec.subtitle ?? '', 80, hasDiagram ? 216 : 210, headerW, hasDiagram ? 44 : 40, {
      fontSize: pt(isGuide ? 18 : 17),
      color: accent,
      bold: !isGuide,
      maxLines: 2,
    });
  }

  if (isGuide && !hasDiagram) {
    const topY = hasSubtitle ? 276 : 228;
    const conceptH = hasSubtitle ? 402 : 446;
    const takeaways = (spec.keyTakeaways && spec.keyTakeaways.length > 0 ? spec.keyTakeaways : []).slice(0, 2);
    addPanel(slide, 80, topY, 860, conceptH, { fill: C.panel, transparency: 10 });
    addLabel(slide, 'Conocimiento nuevo', 106, topY + 20, 620, 18, accent2, 9);
    addText(slide, spec.explanation, 106, topY + 50, 808, takeaways.length > 0 ? 124 : 330, {
      fontSize: pt(22),
      color: C.white,
      bold: true,
      lineSpacingMultiple: 1.12,
      maxLines: 5,
    });
    takeaways.forEach((rule, idx) => {
      const ry = topY + 184 + idx * 82;
      addText(slide, `• ${rule}`, 106, ry, 808, 72, {
        fontSize: pt(19),
        color: C.textSoft,
        lineSpacingMultiple: 1.12,
        maxLines: 3,
      });
    });

    const errY = topY + conceptH + 16;
    const errH = 948 - errY;
    addPanel(slide, 80, errY, 860, errH, { fill: '1E080C', transparency: 32, stroke: C.red });
    addLabel(slide, 'Error común', 106, errY + 20, 620, 18, C.red, 9);
    addText(slide, spec.misconception, 106, errY + 48, 808, Math.max(120, errH - 64), {
      fontSize: pt(20),
      color: C.textSoft,
      lineSpacingMultiple: 1.12,
      maxLines: 5,
    });

    const effectiveFormulas = (spec.formulas && spec.formulas.length > 0 ? spec.formulas : spec.formula ? [spec.formula] : [])
      .map((f) => f.trim())
      .filter(Boolean);
    const hasFormula = effectiveFormulas.length > 0;
    if (hasFormula) {
      addPanel(slide, 968, topY, 872, 118, { fill: C.canvas, transparency: 8, stroke: accent });
      addLabel(slide, 'Expresión clave', 994, topY + 18, 520, 18, accent, 8);
      addText(slide, effectiveFormulas[0]!, 994, topY + 44, 820, 58, {
        fontFace: FONT_DISPLAY,
        fontSize: pt(effectiveFormulas[0]!.length > 48 ? 20 : 26),
        bold: true,
        color: accent,
        maxLines: 2,
      });
    }

    let exPanelY = hasFormula ? topY + 134 : topY;
    const slideTopicSample = `${spec.title} ${spec.subtitle ?? ''} ${spec.explanation ?? ''}`;
    const avoidProtoboardForSlide =
      Boolean(preparedScenes?.conceptIsHardwareProtoboard) &&
      SOFTWARE_CONCEPT_SLIDE_RE.test(slideTopicSample) &&
      !HARDWARE_CONCEPT_SLIDE_RE.test(slideTopicSample);
    const conceptSceneUri = avoidProtoboardForSlide
      ? hasFormula
        ? preparedScenes?.softwareSafeWithFormulaDataUri
        : preparedScenes?.softwareSafeWideDataUri
      : hasFormula
        ? preparedScenes?.conceptWithFormulaDataUri
        : preparedScenes?.conceptWideDataUri;
    if (conceptSceneUri) {
      const sceneH = hasFormula ? 148 : 182;
      addPanel(slide, 968, exPanelY, 872, sceneH, { fill: C.panel, transparency: 10, stroke: accent2 });
      slide.addImage({
        data: conceptSceneUri,
        x: inch(968),
        y: inch(exPanelY),
        w: inch(872),
        h: inch(sceneH),
      });
      exPanelY += sceneH + 14;
    }
    const exPanelH = Math.max(220, 948 - exPanelY);
    const exStatement = spec.workedExample?.problemStatement || '';
    const exSteps = (spec.workedExample?.steps ?? []).slice(0, 3);
    const exResult = spec.workedExample?.interpretation;

    addPanel(slide, 968, exPanelY, 872, exPanelH, { fill: C.panel, transparency: 10 });
    addLabel(slide, 'Ejemplo resuelto', 994, exPanelY + 20, 560, 18, accent, 9);
    const stmtH = hasFormula ? 96 : 114;
    addText(slide, exStatement, 994, exPanelY + 46, 820, stmtH, {
      fontSize: pt(21),
      color: C.white,
      bold: true,
      lineSpacingMultiple: 1.1,
      maxLines: 4,
    });
    const stepBaseY = exPanelY + 54 + stmtH;
    const stepStride = hasFormula ? 84 : 102;
    exSteps.forEach((step, idx) => {
      const sy = stepBaseY + idx * stepStride;
      addText(slide, `0${idx + 1}`, 994, sy, 36, 26, { fontSize: pt(18), bold: true, color: accent2, maxLines: 1 });
      addText(slide, step, 1036, sy - 2, 778, stepStride - 10, { fontSize: pt(18), color: C.textSoft, maxLines: 3 });
    });
    if (exResult) {
      const multiLineConcl = exResult.length > 125 && /\d\.\s+[A-ZÁÉÍÓÚÑ]/.test(exResult);
      addText(
        slide,
        `Conclusión: ${exResult}`,
        994,
        exPanelY + exPanelH - (multiLineConcl ? 76 : 72),
        820,
        multiLineConcl ? 64 : 58,
        {
          fontSize: pt(18),
          color: C.emerald,
          bold: true,
          maxLines: multiLineConcl ? 3 : 2,
        }
      );
    }

    addFooter(slide, deck, `${sesTag} · concepto y ejemplo`, accent);
    return;
  }

  if (isGuide) {
    const exStatement = spec.workedExample?.problemStatement || '';
    const exSteps = (spec.workedExample?.steps ?? []).slice(0, 3);
    const exResult = spec.workedExample?.interpretation;
    const leftTopY = hasSubtitle ? 276 : 228;
    const conceptBoxH = hasSubtitle ? 158 : 186;

    addPanel(slide, 80, leftTopY, 712, conceptBoxH, { fill: C.panel, transparency: 12 });
    addLabel(slide, 'Conocimiento nuevo', 102, leftTopY + 14, 520, 18, accent2, 9);
    addText(slide, spec.explanation, 102, leftTopY + 40, 668, conceptBoxH - 52, {
      fontSize: pt(17),
      color: C.text,
      lineSpacingMultiple: 1.1,
      maxLines: 5,
    });

    const exBoxY = leftTopY + conceptBoxH + 14;
    const exBoxH = 778 - exBoxY;
    addPanel(slide, 80, exBoxY, 712, exBoxH, { fill: C.panel, transparency: 10 });
    addLabel(slide, 'Ejemplo resuelto', 102, exBoxY + 14, 560, 18, accent, 9);
    addText(slide, exStatement, 102, exBoxY + 40, 668, 84, {
      fontSize: pt(17),
      color: C.white,
      bold: true,
      lineSpacingMultiple: 1.06,
      maxLines: 4,
    });
    exSteps.forEach((step, idx) => {
      const sy = exBoxY + 132 + idx * 52;
      addText(slide, `0${idx + 1}`, 102, sy, 32, 22, { fontSize: pt(15), bold: true, color: accent2, maxLines: 1 });
      addText(slide, step, 138, sy - 2, 632, 44, { fontSize: pt(15.5), color: C.textSoft, maxLines: 2 });
    });
    if (exResult) {
      const multiLineConcl = exResult.length > 125 && /\d\.\s+[A-ZÁÉÍÓÚÑ]/.test(exResult);
      addText(
        slide,
        `Conclusión: ${exResult}`,
        102,
        exBoxY + exBoxH - (multiLineConcl ? 54 : 48),
        668,
        multiLineConcl ? 48 : 40,
        {
          fontSize: pt(15.5),
          color: C.emerald,
          bold: true,
          maxLines: multiLineConcl ? 3 : 2,
        }
      );
    }

    addPanel(slide, 80, 792, 712, 156, { fill: '1E080C', transparency: 32, stroke: C.red });
    addLabel(slide, 'Error común', 102, 806, 520, 18, C.red, 8);
    addText(slide, spec.misconception, 102, 832, 668, 104, {
      fontSize: pt(17.5),
      color: C.textSoft,
      lineSpacingMultiple: 1.12,
      maxLines: 4,
    });
  } else {
    addPanel(slide, 80, 354, hasDiagram ? 712 : 1760, 232, { fill: C.panel, transparency: 12 });
    addLabel(slide, 'Analogía y núcleo', 104, 382, 400, 18, accent, 9);
    addText(slide, spec.analogy, 104, 420, hasDiagram ? 664 : 1712, 146, {
      fontSize: pt(20),
      color: C.text,
      lineSpacingMultiple: 1.08,
    });

    addPanel(slide, 80, 606, hasDiagram ? 712 : 1760, 182, { fill: '1E080C', transparency: 35, stroke: C.red });
    addLabel(slide, 'Error común', 104, 634, 400, 18, C.red, 9);
    addText(slide, spec.misconception, 104, 672, hasDiagram ? 664 : 1712, 100, {
      fontSize: pt(18),
      color: C.textSoft,
      lineSpacingMultiple: 1.08,
    });
  }

  if (hasDiagram) {
    addPanel(slide, 824, 168, 1016, 610, { fill: C.canvas, transparency: 8 });
    addLabel(slide, diagramModelLabel(spec.diagram), 852, 194, 480, 18, accent2, 9);
    addText(slide, 'FIG. 01', 1710, 194, 100, 18, { fontSize: pt(16), color: C.muted, align: 'right', maxLines: 1 });
    if (spec.formula.trim()) {
      const formulaW = Math.min(960, Math.max(320, spec.formula.length * 16 + 56));
      slide.addShape('roundRect', {
        x: inch(852),
        y: inch(224),
        w: inch(formulaW),
        h: inch(54),
        fill: { color: C.canvas },
        line: { color: accent, width: 1.2, transparency: 30 },
        rectRadius: 0.05,
      });
      addText(slide, spec.formula, 874, 234, formulaW - 44, 34, {
        fontFace: FONT_DISPLAY,
        fontSize: pt(spec.formula.length > 44 ? 17 : 22),
        bold: true,
        color: accent,
        maxLines: 1,
      });
    }
    addDiagram(slide, spec.diagram, accent, accent2);
  }

  const vars = spec.variables.slice(0, isGuide ? 2 : 4);
  if (isGuide && hasDiagram && vars.length > 0) {
    const colGap = 16;
    const rowGap = 12;
    const colW = (1016 - colGap) / 2;
    const rowH = 72;
    vars.forEach((variable, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const vx = 824 + col * (colW + colGap);
      const vy = 792 + row * (rowH + rowGap);
      const color = index % 2 === 0 ? accent : accent2;
      addPanel(slide, vx, vy, colW, rowH, { fill: C.panel, transparency: 16, stroke: C.strokeSoft });
      addText(slide, variable.symbol, vx + 14, vy + 14, 52, 42, { fontFace: FONT_DISPLAY, fontSize: pt(24), bold: true, color, maxLines: 1 });
      addLabel(slide, variable.label, vx + 72, vy + 8, colW - 86, 16, C.muted, 7);
      addText(slide, variable.meaning, vx + 72, vy + 28, colW - 86, 36, { fontSize: pt(15), color: C.textSoft, maxLines: 2 });
    });
  } else if (isGuide && hasDiagram && spec.keyTakeaways && spec.keyTakeaways.length > 0) {
    const guideKeys = spec.keyTakeaways.slice(0, 1);
    const colGap = 16;
    const colW = guideKeys.length === 1 ? 1016 : (1016 - colGap) / 2;
    guideKeys.forEach((rule, index) => {
      const vx = 824 + index * (colW + colGap);
      const color = index % 2 === 0 ? accent : accent2;
      addPanel(slide, vx, 792, colW, 156, { fill: C.panel, transparency: 16, stroke: C.strokeSoft });
      addLabel(slide, `Punto clave 0${index + 1}`, vx + 18, 808, colW - 36, 18, color, 8);
      addText(slide, rule, vx + 18, 834, colW - 36, 98, { fontSize: pt(17), color: C.textSoft, lineSpacingMultiple: 1.12, maxLines: 3 });
    });
  } else if (!isGuide && vars.length > 0) {
    const gap = 12;
    const tileW = (1760 - gap * 3) / 4;
    vars.forEach((variable, index) => {
      const x = 80 + index * (tileW + gap);
      const color = index % 2 === 0 ? accent : accent2;
      addPanel(slide, x, 802, tileW, 132, { fill: C.panel, transparency: 16, stroke: C.strokeSoft });
      addText(slide, variable.symbol, x + 18, 826, 44, 40, { fontFace: FONT_DISPLAY, fontSize: pt(28), bold: true, color, maxLines: 1 });
      addLabel(slide, variable.label, x + 62, 820, tileW - 78, 18, C.muted, 7);
      addText(slide, variable.meaning, x + 62, 846, tileW - 78, 68, { fontSize: pt(15), color: C.textSoft, maxLines: 3 });
    });
  }

  addFooter(slide, deck, `${diagramFooterLabel(spec.diagram)} · ${sesTag}`, accent);
}

function renderClosing(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintSlide, { kind: 'closing' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Cierre formativo', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // METACOGNICIÓN`, 3, accent);
  addText(slide, spec.title, 80, 214, 1000, 74, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(48),
    bold: true,
    color: C.white,
  });
  addLabel(slide, spec.eyebrow, 80, 300, 600, 18, accent, 9);

  addPanel(slide, 80, 344, 1000, 232, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Ticket de salida', 104, 370, 260, 18, accent, 9);
  addText(slide, spec.checkpoint, 104, 416, 952, 120, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(22),
    color: C.white,
  });

  addLabel(slide, 'Criterios de logro', 80, 612, 500, 18, accent2, 9);
  addText(slide, String(spec.criteria.length), 1000, 612, 80, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  spec.criteria.slice(0, 4).forEach((criterion, index) => {
    const y = 650 + index * 62;
    addPanel(slide, 80, y, 1000, 50, { fill: C.panel, transparency: 22, stroke: C.strokeSoft });
    addEllipse(slide, 103, y + 20, 10, 10, { fill: index === 0 ? accent : accent2, stroke: C.canvas, strokeWidth: 1 });
    addText(slide, criterion, 126, y + 11, 930, 32, { fontSize: pt(18), color: C.textSoft });
  });

  addPanel(slide, 1136, 166, 704, 570, { fill: C.panel, transparency: 14 });
  addLabel(slide, 'Semáforo metacognitivo', 1162, 194, 400, 18, accent, 9);
  const lights = [
    { color: C.emerald, label: 'VERDE', text: spec.trafficLight.green },
    { color: C.amber, label: 'ÁMBAR', text: spec.trafficLight.yellow },
    { color: C.red, label: 'ROJO', text: spec.trafficLight.red },
  ];
  lights.forEach((light, index) => {
    const y = 232 + index * 148;
    addPanel(slide, 1162, y, 652, 130, { fill: C.canvas, transparency: 18, stroke: C.strokeSoft });
    addEllipse(slide, 1180, y + 18, 34, 34, { fill: light.color, transparency: 80, stroke: light.color, strokeWidth: 1 });
    addEllipse(slide, 1190, y + 28, 14, 14, { fill: light.color, stroke: light.color });
    addLabel(slide, light.label, 1228, y + 18, 180, 18, light.color, 8);
    addText(slide, light.text, 1228, y + 44, 550, 70, { fontSize: pt(18), color: C.textSoft });
  });

  addLabel(slide, 'Registro de la misión', 1162, 758, 280, 18, accent2, 8);
  addFactStrip(slide, spec.facts, 1162, 780, 652, 76);

  addPanel(slide, 80, 902, 1760, 76, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
  addLabel(slide, 'Reflexión', 102, 924, 160, 18, accent, 8);
  addText(slide, spec.reflection, 212, 918, 1580, 46, { fontSize: pt(18), color: C.textSoft });

  addFooter(slide, deck, 'evidencia · autonomía · mejora', accent);
}

function renderDemo(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintDemoSlide, { kind: 'demo' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  const isGuide = Boolean(spec.isLessonGuide);
  const sesTag = spec.sessionNumber ? `SESIÓN ${String(spec.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;
  addHud(
    slide,
    isGuide ? 'Ejemplo resuelto' : 'Yo hago',
    isGuide ? `${sesTag} // MODELADO PASO A PASO` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // DEMOSTRACIÓN`,
    isGuide ? 1 : 4,
    accent,
    isGuide ? 4 : 8
  );
  addText(slide, spec.title, 80, 204, 860, 110, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(spec.title.length > 45 ? 28 : 36),
    bold: true,
    color: C.white,
    maxLines: 2,
  });
  addLabel(slide, spec.eyebrow, 80, 322, 720, 18, accent, 9);

  addPanel(slide, 80, 344, 860, 268, { fill: C.panel, transparency: 12 });
  addLabel(slide, isGuide ? 'Situación o problema modelo' : 'Demostración guiada', 104, 372, 420, 18, accent, 9);
  addText(slide, spec.demoText, 104, 410, 812, 186, { fontSize: pt(19), color: C.text, lineSpacingMultiple: 1.06, maxLines: 6 });

  if (spec.problemStatement && !isGuide) {
    addPanel(slide, 80, 632, 860, 128, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addLabel(slide, 'Problema resuelto', 104, 658, 300, 18, accent2, 8);
    addText(slide, spec.problemStatement, 104, 692, 812, 56, { fontSize: pt(16), color: C.textSoft, maxLines: 2 });
  }

  if (spec.interpretation) {
    const interpY = isGuide ? 632 : 778;
    const interpH = isGuide ? 164 : 100;
    addPanel(slide, 80, interpY, 860, interpH, { fill: '061410', transparency: 30, stroke: C.emerald });
    addLabel(slide, '¿Qué significa el resultado?', 104, interpY + 22, 380, 18, C.emerald, 8);
    addText(slide, spec.interpretation, 104, interpY + 50, 812, interpH - 64, { fontSize: pt(16), color: C.textSoft, maxLines: 3 });
  }

  addLabel(slide, 'Resolución paso a paso', 992, 190, 440, 18, accent2, 9);
  addText(slide, String(spec.steps.length), 1740, 190, 100, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  const visibleSteps = spec.steps.slice(0, 5);
  const stepStride = visibleSteps.length >= 5 ? 118 : 138;
  visibleSteps.forEach((step, index) => {
    const y = 226 + index * stepStride;
    addPanel(slide, 992, y, 848, stepStride - 14, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
    addText(slide, String(index + 1).padStart(2, '0'), 1014, y + 24, 30, 20, { fontSize: pt(11), bold: true, color: accent2 });
    addText(slide, step, 1054, y + 20, 766, stepStride - 38, { fontSize: pt(17), color: C.textSoft, maxLines: 3 });
  });

  addFooter(slide, deck, `${sesTag} · modelar · explicar · verificar`, accent);
}

function renderPractice(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintPracticeSlide, { kind: 'practice' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  const isGuide = Boolean(spec.isLessonGuide);
  const sesTag = spec.sessionNumber ? `SESIÓN ${String(spec.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;
  addHud(
    slide,
    isGuide ? 'Ejercicios y aplicación' : 'Hacemos',
    isGuide ? `${sesTag} // PIZARRÓN DOCENTE (2/2)` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // PRÁCTICA GUIADA`,
    isGuide ? 1 : 5,
    accent,
    isGuide ? 2 : 8
  );
  addText(slide, spec.title, 80, 142, 1760, 56, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(spec.title.length > 45 ? 26 : 32),
    bold: true,
    color: C.white,
    maxLines: 1,
  });
  const hasPracticeSubtitle = Boolean(spec.subtitle?.trim());
  if (!isGuide || hasPracticeSubtitle) {
    addLabel(slide, spec.subtitle || spec.eyebrow, 80, 202, 1760, 22, accent, 9);
  }

  const activityItems = spec.activities && spec.activities.length > 0
    ? spec.activities
    : spec.checkpoints.map((cp, idx) => ({ label: `Actividad ${idx + 1}`, statement: cp, hint: '' }));

  if (isGuide) {
    const gTop = hasPracticeSubtitle ? 246 : 216;
    const objH = hasPracticeSubtitle ? 148 : 132;
    const objectives = (spec.objectiveBullets && spec.objectiveBullets.length > 0
      ? spec.objectiveBullets
      : [spec.subtitle || 'Comprender y aplicar los conceptos centrales de la sesión.']
    ).slice(0, 2);
    addPanel(slide, 80, gTop, 940, objH, { fill: C.panel, transparency: 10 });
    addLabel(slide, 'Objetivo de la sesión', 104, gTop + 14, 520, 18, accent, 9);
    objectives.forEach((obj, idx) => {
      addText(slide, objectives.length === 1 ? obj : `• ${obj}`, 104, gTop + 42 + idx * 46, 892, objectives.length === 1 ? 78 : 42, {
        fontSize: pt(17.5),
        color: C.text,
        lineSpacingMultiple: 1.12,
        maxLines: objectives.length === 1 ? 3 : 2,
      });
    });

    const actHeaderY = gTop + objH + 14;
    addLabel(slide, 'Ejercicios del libro', 80, actHeaderY, 760, 18, accent2, 9);
    const visibleActivities = activityItems.slice(0, 2);
    const actListTop = actHeaderY + 26;
    const availActH = 948 - actListTop;
    const actStride = Math.floor((availActH + 14) / 2);
    const actCardH = actStride - 14;
    visibleActivities.forEach((act, index) => {
      const y = actListTop + index * actStride;
      addPanel(slide, 80, y, 940, actCardH, { fill: C.panel, transparency: 14, stroke: C.strokeSoft });
      addLabel(slide, act.label, 104, y + 14, 320, 18, accent2, 8);
      addText(slide, act.statement, 104, y + 38, 892, act.hint ? actCardH - 104 : actCardH - 52, {
        fontSize: pt(18),
        color: C.text,
        lineSpacingMultiple: 1.12,
        maxLines: 5,
      });
      if (act.hint) {
        addText(slide, `Pista: ${act.hint}`, 104, y + actCardH - 58, 892, 50, {
          fontSize: pt(15),
          color: C.amber,
          lineSpacingMultiple: 1.1,
          maxLines: 2,
        });
      }
    });

    const rAppH = hasPracticeSubtitle ? 220 : 230;
    addPanel(slide, 1052, gTop, 788, rAppH, { fill: C.panel, transparency: 12 });
    addLabel(slide, 'Aplicación real', 1076, gTop + 16, 520, 18, accent, 9);
    addText(slide, spec.applicationText || spec.practiceText, 1076, gTop + 46, 740, rAppH - 60, {
      fontSize: pt(18),
      color: C.text,
      lineSpacingMultiple: 1.14,
      maxLines: 5,
    });

    const evalCriteria = (spec.evaluationCriteria && spec.evaluationCriteria.length > 0
      ? spec.evaluationCriteria
      : ['Procedimiento completo y respuesta verificada con claridad.']
    ).slice(0, 2);
    const rEvalY = gTop + rAppH + 16;
    const rEvalH = hasPracticeSubtitle ? 224 : 234;
    addPanel(slide, 1052, rEvalY, 788, rEvalH, { fill: C.panel, transparency: 16, stroke: C.amber });
    addLabel(slide, 'Evaluación', 1076, rEvalY + 16, 520, 18, C.amber, 9);
    evalCriteria.forEach((crit, idx) => {
      addText(slide, `✓ ${crit}`, 1076, rEvalY + 48 + idx * 74, 740, 64, {
        fontSize: pt(17),
        color: C.textSoft,
        lineSpacingMultiple: 1.12,
        maxLines: 3,
      });
    });

    const rEvidY = rEvalY + rEvalH + 16;
    const rEvidH = 948 - rEvidY;
    addPanel(slide, 1052, rEvidY, 788, rEvidH, { fill: '061410', transparency: 28, stroke: C.emerald });
    addLabel(slide, 'Evidencia', 1076, rEvidY + 16, 520, 18, C.emerald, 8);
    addText(slide, spec.artifactName || 'Evidencia de la sesión', 1076, rEvidY + 42, 740, 38, {
      fontFace: FONT_DISPLAY,
      fontSize: pt(20),
      bold: true,
      color: C.white,
      maxLines: 1,
    });
    addText(slide, spec.artifactStep || spec.applicationText || '', 1076, rEvidY + 86, 740, Math.max(80, rEvidH - 98), {
      fontSize: pt(16.5),
      color: C.textSoft,
      lineSpacingMultiple: 1.12,
      maxLines: 4,
    });
  } else {
    addPanel(slide, 80, 344, 760, 300, { fill: C.panel, transparency: 12 });
    addLabel(slide, 'Práctica colaborativa', 104, 372, 420, 18, accent, 9);
    addText(slide, spec.practiceText, 104, 410, 712, 212, { fontSize: pt(19), color: C.text, lineSpacingMultiple: 1.06, maxLines: 7 });

    if (spec.hint) {
      addPanel(slide, 80, 668, 760, 172, { fill: '1E1808', transparency: 30, stroke: C.amber });
      addLabel(slide, 'Pista docente · Apoyo sin dar la respuesta', 104, 694, 520, 18, C.amber, 8);
      addText(slide, spec.hint, 104, 728, 712, 92, { fontSize: pt(16), color: C.textSoft, maxLines: 4 });
    }

    addLabel(slide, 'Andamiaje de la práctica', 880, 246, 620, 18, accent2, 9);
    const visibleActivities = activityItems.slice(0, 4);
    const actStride = visibleActivities.length >= 4 ? 160 : 196;
    visibleActivities.forEach((act, index) => {
      const y = 278 + index * actStride;
      addPanel(slide, 880, y, 960, actStride - 16, { fill: C.panel, transparency: 18, stroke: C.strokeSoft });
      addLabel(slide, act.label, 904, y + 18, 320, 18, accent2, 8);
      addText(slide, act.statement, 904, y + 42, 912, actStride - 92, { fontSize: pt(16), color: C.text, maxLines: 3 });
      if (act.hint) {
        addText(slide, `Pista: ${act.hint}`, 904, y + actStride - 44, 912, 24, { fontSize: pt(14), color: C.amber, maxLines: 1 });
      }
    });
  }

  addFooter(slide, deck, `${sesTag} · objetivos · práctica · evaluación`, accent);
}

function renderChallenge(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintChallengeSlide, { kind: 'challenge' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  const isGuide = Boolean(spec.isLessonGuide);
  const sesTag = spec.sessionNumber ? `SESIÓN ${String(spec.sessionNumber).padStart(2, '0')}` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')}`;
  addHud(
    slide,
    isGuide ? 'Aplicación y cierre' : 'Tú haces',
    isGuide ? `${sesTag} // TRANSFERENCIA Y EVIDENCIA` : `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RETO Y PROYECTO`,
    isGuide ? 3 : 6,
    accent,
    isGuide ? 4 : 8
  );
  addText(slide, spec.title, 80, 204, 940, 110, {
    fontFace: FONT_DISPLAY,
    fontSize: pt(spec.title.length > 45 ? 28 : 36),
    bold: true,
    color: C.white,
    maxLines: 2,
  });
  addLabel(slide, spec.eyebrow, 80, 322, 720, 18, accent, 9);

  addPanel(slide, 80, 344, 940, 288, { fill: C.panel, transparency: 12 });
  addLabel(slide, isGuide ? '¿Dónde se aplica este conocimiento?' : 'Reto autónomo', 104, 372, 520, 18, accent, 9);
  addText(slide, isGuide ? spec.applicationText || spec.challengeText : spec.challengeText, 104, 410, 892, 200, {
    fontSize: pt(19),
    color: C.text,
    lineSpacingMultiple: 1.06,
    maxLines: 7,
  });

  addPanel(slide, 80, 654, 940, 178, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
  addLabel(slide, 'Producto integrador', 104, 678, 320, 18, accent2, 9);
  addText(slide, spec.artifactName, 104, 706, 892, 54, { fontFace: FONT_DISPLAY, fontSize: pt(21), bold: true, color: C.white, maxLines: 2, lineHeightRatio: 1.12 });
  addText(slide, isGuide ? spec.challengeText : spec.communityUtility, 104, 766, 892, 52, { fontSize: pt(13), color: C.textSoft, maxLines: 2 });

  if (isGuide && spec.exitChecks && spec.exitChecks.length > 0) {
    addLabel(slide, 'Ticket de salida · Verificación', 1072, 190, 440, 18, accent2, 9);
    spec.exitChecks.slice(0, 3).forEach((check, index) => {
      const y = 226 + index * 124;
      addPanel(slide, 1072, y, 768, 108, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
      addLabel(slide, `CHECK ${String(index + 1).padStart(2, '0')}`, 1094, y + 18, 180, 18, accent2, 8);
      addText(slide, check, 1094, y + 42, 720, 56, { fontSize: pt(16), color: C.textSoft, maxLines: 3 });
    });
  } else if (spec.phases.length > 0) {
    addLabel(slide, 'Fases del proyecto', 1072, 190, 360, 18, accent2, 9);
    spec.phases.slice(0, 3).forEach((phase, index) => {
      const y = 226 + index * 118;
      addPanel(slide, 1072, y, 768, 102, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
      addText(slide, `FASE ${String(index + 1).padStart(2, '0')}`, 1094, y + 22, 160, 18, { fontSize: pt(10), bold: true, color: accent2 });
      addText(slide, `${phase.hours} h`, 1730, y + 22, 90, 18, { fontSize: pt(10), bold: true, color: accent, align: 'right' });
      addText(slide, phase.title, 1094, y + 50, 720, 40, { fontSize: pt(16), color: C.textSoft, maxLines: 2 });
    });
  }

  addPanel(slide, 1072, 654, 768, 178, { fill: '061410', transparency: 30, stroke: C.emerald });
  addLabel(slide, 'Entrega e impacto comunitario', 1096, 682, 420, 18, C.emerald, 8);
  addText(slide, spec.communityUtility || 'Integra la solución al producto del proyecto y regístrala en tu bitácora de avance.', 1096, 716, 720, 96, {
    fontSize: pt(15),
    color: C.textSoft,
    maxLines: 4,
  });

  addFooter(slide, deck, `${sesTag} · aplicar · integrar · entregar`, accent);
}

function renderEvidence(slide: PptxGenJS.Slide, deck: SacrintDeckSpec, spec: Extract<SacrintEvidenceSlide, { kind: 'evidence' }>) {
  addStyleBackdrop(slide, deck);
  const accent = deck.pack.accent;
  const accent2 = deck.pack.accent2;
  addHud(slide, 'Evidencia', `MISIÓN ${String(deck.meta.missionNumber).padStart(2, '0')} // RÚBRICA Y CRITERIOS`, 7, accent);
  addText(slide, spec.title, 80, 214, 1020, 74, { fontFace: FONT_DISPLAY, fontSize: pt(46), bold: true, color: C.white });
  addLabel(slide, spec.eyebrow, 80, 300, 600, 18, accent, 9);

  addPanel(slide, 80, 320, 1020, 138, { fill: C.panel, transparency: 12 });
  addLabel(slide, 'Pregunta guía', 104, 346, 260, 18, accent, 9);
  addText(slide, spec.checkpoint, 104, 392, 972, 50, { fontFace: FONT_DISPLAY, fontSize: pt(22), color: C.white, maxLines: 2 });

  addLabel(slide, 'Rúbrica de evaluación', 80, 480, 400, 18, accent2, 9);
  addText(slide, String(spec.rubric.length), 1020, 480, 80, 18, { fontSize: pt(9), color: C.muted, align: 'right' });
  spec.rubric.slice(0, 4).forEach((item, index) => {
    const y = 516 + index * 84;
    addPanel(slide, 80, y, 1020, 70, { fill: C.panel, transparency: 22, stroke: C.strokeSoft });
    addEllipse(slide, 103, y + 30, 10, 10, { fill: index % 2 === 0 ? accent : accent2, stroke: C.canvas, strokeWidth: 1 });
    addText(slide, item.label, 126, y + 16, 820, 44, { fontSize: pt(16), color: C.textSoft, maxLines: 2 });
    if (item.weight != null) {
      addText(slide, `${item.weight}%`, 960, y + 20, 110, 30, { fontFace: FONT_DISPLAY, fontSize: pt(18), bold: true, color: accent, align: 'right' });
    }
  });

  const validChecklist = spec.checklist.map((c) => c.trim()).filter(Boolean).slice(0, 5);
  const slotCount = Math.max(1, validChecklist.length);
  const slotStep = Math.floor(540 / slotCount);
  const slotHeight = Math.min(108, slotStep - 14);
  addPanel(slide, 1152, 166, 688, 646, { fill: C.panel, transparency: 14 });
  addLabel(slide, 'Checklist de verificación', 1178, 194, 380, 18, accent, 9);
  validChecklist.forEach((item, index) => {
    const y = 248 + index * slotStep;
    addPanel(slide, 1178, y, 636, slotHeight, { fill: C.canvas, transparency: 18, stroke: C.strokeSoft });
    slide.addShape('roundRect', { x: inch(1198), y: inch(y + Math.floor((slotHeight - 16) / 2)), w: inch(16), h: inch(16), fill: { color: C.canvas, transparency: 100 }, line: { color: accent2, width: 1.2 }, rectRadius: 0.03 });
    addText(slide, item, 1230, y + 18, 566, slotHeight - 28, { fontSize: pt(14), color: C.textSoft, maxLines: 3 });
  });

  addPanel(slide, 1152, 832, 688, 76, { fill: C.panel, transparency: 20, stroke: C.strokeSoft });
  addLabel(slide, 'Reflexión', 1174, 854, 140, 18, accent, 8);
  addText(slide, spec.reflection, 1284, 848, 540, 46, { fontSize: pt(13), color: C.textSoft, maxLines: 2 });

  addFooter(slide, deck, 'criterios · rúbrica · verificación', accent);
}

async function renderDeckIntoPptx(pptx: PptxGenJS, deck: SacrintDeckSpec): Promise<void> {
  const preparedScenes = await prepareDeckScenesForPptx(deck);
  for (const spec of deck.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: C.canvas };
    if (spec.kind === 'cover') renderCover(slide, deck, spec, preparedScenes);
    else if (spec.kind === 'hook') renderHook(slide, deck, spec);
    else if (spec.kind === 'concept') renderConcept(slide, deck, spec, preparedScenes);
    else if (spec.kind === 'demo') renderDemo(slide, deck, spec);
    else if (spec.kind === 'practice') renderPractice(slide, deck, spec);
    else if (spec.kind === 'challenge') renderChallenge(slide, deck, spec);
    else if (spec.kind === 'evidence') renderEvidence(slide, deck, spec);
    else renderClosing(slide, deck, spec);
  }
}

export async function generateSacrintPptx(deck: SacrintDeckSpec): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.meta.missionTitle;
  pptx.subject = deck.meta.subjectName;
  pptx.company = deck.meta.schoolName || getRuntimePlatformName();
  pptx.author = deck.meta.teacherName || getRuntimePlatformName();

  await renderDeckIntoPptx(pptx, deck);

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(out as Uint8Array);
}

export async function generateCombinedSacrintPptx(
  decks: SacrintDeckSpec[],
  meta?: { title?: string; subjectName?: string; schoolName?: string; teacherName?: string }
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const first = decks[0];
  pptx.title = meta?.title || first?.meta.subjectName || 'Presentación SACRINT';
  pptx.subject = meta?.subjectName || first?.meta.subjectName || getRuntimePlatformName();
  pptx.company = meta?.schoolName || first?.meta.schoolName || getRuntimePlatformName();
  pptx.author = meta?.teacherName || first?.meta.teacherName || getRuntimePlatformName();

  for (const deck of decks) {
    await renderDeckIntoPptx(pptx, deck);
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(out as Uint8Array);
}
