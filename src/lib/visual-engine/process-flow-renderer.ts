/**
 * process-flow-renderer.ts — Widget de Flujo de Procesos y Fases 100% Offline (Fase 4)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Renderiza banners horizontales de etapas y fases con:
 * - Renderizado vectorial 100% offline (sin llamadas a red, IA ni Kroki/Mermaid)
 * - Píldoras horizontales con badges numéricos y flechas vectoriales de conexión
 * - Extractor determinista de etapas desde ProjectSection o arrays de fases/pasos
 * - Paginación atómica estricta (ensureVerticalSpace por bloque completo)
 * - Sanitización WinAnsi obligatoria en todos los textos impresos con doc.text
 * - Degradación canónica D9 (si < 2 pasos, retorna sin renderizar)
 */

import type { jsPDF } from 'jspdf';
import type { ProcessFlowStep, ProjectPhase } from '@/types/work-textbook';
import { PROCESS_FLOW } from './design-tokens';
import { sanitizePdfText } from './pdf-components-core';

export interface ProcessFlowBannerOptions {
  margin: number;
  drawWidth: number;
  y: number;
  pageHeight: number;
  bannerTitle?: string;
  ensureVerticalSpace: (doc: jsPDF, y: number, neededH: number, margin: number, pageHeight: number) => number;
}

/**
 * Extractor determinista de etapas de flujo de proceso.
 * Acepta:
 *   - ProjectPhase[] o un objeto con `phases`
 *   - string[] (pasos de ejecución numerados)
 * Si el resultado contiene < 2 etapas, retorna [] para activar degradación D9.
 */
export function extractProcessFlowSteps(
  source: unknown
): ProcessFlowStep[] {
  if (!source) return [];

  // 1. Si es un array de fases del proyecto (ProjectPhase[])
  if (Array.isArray(source)) {
    if (source.length === 0) return [];

    // Verificar si son objetos de fase
    if (typeof source[0] === 'object' && source[0] !== null && 'phaseNum' in source[0]) {
      const phases = source as ProjectPhase[];
      const steps: ProcessFlowStep[] = phases
        .filter(p => p && (p.title || p.phaseNum))
        .map(p => {
          let cleanTitle = (p.title || `Fase ${p.phaseNum}`).trim();
          // Limpiar prefijo redundante "Fase X:"
          cleanTitle = cleanTitle.replace(/^Fase\s*\d+[:\s-]*/i, '').trim() || cleanTitle;
          if (cleanTitle.length > 22) {
            cleanTitle = cleanTitle.slice(0, 20).trim() + '...';
          }
          const subtitle = p.allocatedHours ? `${p.allocatedHours} hrs` : undefined;
          return {
            stepNumber: p.phaseNum,
            title: cleanTitle,
            subtitle,
          };
        });

      return steps.length >= 2 ? steps.slice(0, 6) : [];
    }

    // Verificar si es un array de strings (pasos de ejecución)
    if (typeof source[0] === 'string') {
      const stringList = source as string[];
      const steps: ProcessFlowStep[] = [];
      stringList.forEach((line, idx) => {
        const clean = line.trim();
        if (!clean) return;
        const match = clean.match(/^(\d+)[.)\s:-]+(.*)/);
        const stepNum = match ? parseInt(match[1], 10) : idx + 1;
        let title = match ? match[2].trim() : clean;
        if (title.length > 22) {
          title = title.slice(0, 20).trim() + '...';
        }
        steps.push({
          stepNumber: stepNum,
          title,
        });
      });

      return steps.length >= 2 ? steps.slice(0, 6) : [];
    }
  }

  // 2. Si es un objeto que contiene phases o executionSteps
  if (typeof source === 'object' && source !== null) {
    const obj = source as { phases?: ProjectPhase[]; executionSteps?: string[]; steps?: string[] };
    if (Array.isArray(obj.phases) && obj.phases.length >= 2) {
      return extractProcessFlowSteps(obj.phases);
    }
    if (Array.isArray(obj.executionSteps) && obj.executionSteps.length >= 2) {
      return extractProcessFlowSteps(obj.executionSteps);
    }
    if (Array.isArray(obj.steps) && obj.steps.length >= 2) {
      return extractProcessFlowSteps(obj.steps);
    }
  }

  return [];
}

/**
 * Renderiza el Process Flow Banner 100% offline con geometría vectorial y flechas.
 * Si `steps` tiene < 2 elementos, retorna `options.y` intacto (Degradación canónica D9).
 */
export function drawProcessFlowBanner(
  doc: jsPDF,
  steps: ProcessFlowStep[],
  options: ProcessFlowBannerOptions
): number {
  if (!steps || steps.length < 2) {
    return options.y;
  }

  const { margin, drawWidth, pageHeight, bannerTitle, ensureVerticalSpace } = options;
  let curY = options.y;

  const hasTitle = Boolean(bannerTitle && bannerTitle.trim().length > 0);
  const titleAreaH = hasTitle ? 7 : 0;
  const nodeH = 14;
  const paddingY = 4;
  const totalBannerH = paddingY * 2 + titleAreaH + nodeH;

  // 1. Paginación atómica: el banner completo salta a la siguiente página si no cabe
  curY = ensureVerticalSpace(doc, curY, totalBannerH + 4, margin, pageHeight);

  // 2. Chasis exterior redondeado
  doc.setFillColor(...PROCESS_FLOW.bannerBg);
  doc.setDrawColor(...PROCESS_FLOW.bannerBorder);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, curY, drawWidth, totalBannerH, 2, 2, 'FD');

  // 3. Título del banner si aplica
  if (hasTitle) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...PROCESS_FLOW.bannerTitle);
    const cleanBannerTitle = sanitizePdfText(bannerTitle).toUpperCase();
    doc.text(cleanBannerTitle, margin + 5, curY + 5.5);
  }

  // 4. Cálculo geométrico horizontal de nodos y flechas
  const n = steps.length;
  const arrowW = 5.5; // Espacio para la flecha conectora
  const padX = 5;
  const totalArrowW = (n - 1) * arrowW;
  const availW = drawWidth - 2 * padX - totalArrowW;
  const nodeW = Math.max(18, availW / n);
  const nodeY = curY + (hasTitle ? 8 : paddingY);

  // 5. Dibujar nodos y flechas de conexión
  for (let i = 0; i < n; i++) {
    const step = steps[i];
    const nodeX = margin + padX + i * (nodeW + arrowW);

    // 5.1 Píldora del nodo
    doc.setFillColor(...PROCESS_FLOW.nodeBg);
    doc.setDrawColor(...PROCESS_FLOW.nodeBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(nodeX, nodeY, nodeW, nodeH, 1.5, 1.5, 'FD');

    // 5.2 Badge circular con número de paso
    const circleR = 2.4;
    const circleX = nodeX + 4.2;
    const circleY = nodeY + nodeH / 2;
    doc.setFillColor(...PROCESS_FLOW.numberBg);
    doc.circle(circleX, circleY, circleR, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...PROCESS_FLOW.numberText);
    doc.text(String(step.stepNumber), circleX, circleY + 0.9, { align: 'center' });

    // 5.3 Texto del título
    const textAvailableW = nodeW - 8.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(...PROCESS_FLOW.titleText);
    const cleanTitle = sanitizePdfText(step.title);
    const titleLines = doc.splitTextToSize(cleanTitle, textAvailableW).slice(0, 2);

    const titleBaseY = step.subtitle
      ? nodeY + 4.5
      : nodeY + (nodeH / 2) - ((titleLines.length - 1) * 1.5) + 0.8;

    titleLines.forEach((tLine: string, lineIdx: number) => {
      doc.text(tLine, nodeX + 7.8, titleBaseY + lineIdx * 2.8);
    });

    // 5.4 Subtítulo si aplica (ej. "2 hrs")
    if (step.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.0);
      doc.setTextColor(...PROCESS_FLOW.subtitleText);
      const cleanSubtitle = sanitizePdfText(step.subtitle);
      doc.text(cleanSubtitle, nodeX + 7.8, titleBaseY + titleLines.length * 2.8 + 1.2);
    }

    // 5.5 Flecha conectora vectorial hacia el siguiente nodo
    if (i < n - 1) {
      const arrowStartX = nodeX + nodeW + 0.6;
      const arrowEndX = nodeX + nodeW + arrowW - 0.6;
      const arrowMidY = nodeY + nodeH / 2;

      // Línea horizontal del vástago
      doc.setDrawColor(...PROCESS_FLOW.arrowColor);
      doc.setLineWidth(0.45);
      doc.line(arrowStartX, arrowMidY, arrowEndX - 1.2, arrowMidY);

      // Punta de flecha triangular
      doc.setFillColor(...PROCESS_FLOW.arrowColor);
      doc.setDrawColor(...PROCESS_FLOW.arrowColor);
      doc.triangle(
        arrowEndX - 1.4, arrowMidY - 1.1,
        arrowEndX - 1.4, arrowMidY + 1.1,
        arrowEndX, arrowMidY,
        'FD'
      );
    }
  }

  return curY + totalBannerH + 3.0;
}
