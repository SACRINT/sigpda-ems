/**
 * pmc-pdf-generator.ts — Generador PDF Oficial del Plan de Mejora Continua (PMC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (SEMS / MCCEMS)
 * Fachada delgada que orquesta los módulos en ./pmc/pdf/* manteniendo paridad exacta.
 */

import jsPDF from 'jspdf';
import { loadAllLogos } from './pdf-logos';
import { SCHOOL_YEAR } from '@/lib/config';
import type { PmcProject } from '@/types/pmc';
import { safeStr, type PmcPdfRenderState } from './pmc/pdf/helpers';
import { renderPmcPdfPortadaYDiagnostico } from './pmc/pdf/sections-diagnostico';
import { renderPmcPdfPlanYCierre } from './pmc/pdf/sections-plan-cierre';

export async function generatePmcPDF(
  project: PmcProject,
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<Buffer> {
  const logos = providedLogos || (await loadAllLogos());

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const state: PmcPdfRenderState = {
    doc,
    project,
    logos,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    curY: 12,
    cicloTexto: safeStr(project.ciclo_escolar, SCHOOL_YEAR),
    diag: {},
    sectionPageMap: new Map(),
    tocEntries: [],
    pageCellCoords: [],
    drawHeaderOnNewPage: () => {},
    addSectionHeader: (_titulo: string, y: number) => y,
  };

  renderPmcPdfPortadaYDiagnostico(state);
  renderPmcPdfPlanYCierre(state);

  return Buffer.from(doc.output('arraybuffer'));
}
