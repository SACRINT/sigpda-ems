/**
 * paec-pdf-generator.ts — Generador PDF Editorial Oficial del Proyecto Escolar Comunitario (PEC / PAEC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (SEMS / MCCEMS / NEM)
 * Fachada delgada que orquesta los módulos en ./paec/pdf/* preservando paginación y diseño exactos.
 */

import jsPDF from 'jspdf';
import { loadAllLogos } from './pdf-logos';
import type { PaecProject } from '@/types/paec';
import {
  safeStr,
  addOfficialHybridHeadersAndFooters,
  type PaecPdfRenderState,
} from './paec/pdf/helpers';
import { renderPaecPdfFase1 } from './paec/pdf/sections-fase1';
import { renderPaecPdfCurriculoYPlan } from './paec/pdf/sections-curriculo-plan';
import { renderPaecPdfAnexos } from './paec/pdf/sections-anexos';
import { renderPaecPdfFase4 } from './paec/pdf/sections-fase4';

export async function generatePaecPDF(
  project: PaecProject,
  teacherName: string = 'Docente Coordinador',
  providedLogos?: { gobierno?: string; sep?: string; supervision?: string }
): Promise<Buffer> {
  const logos = providedLogos || (await loadAllLogos());

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const p = project;
  const sCtx = p.schoolContext || {};
  const cCtx = p.communityContext || {};

  const zonaTexto = safeStr(sCtx.schoolZone, 'Zona no registrada');
  const zonaNum = zonaTexto.match(/\d{2,4}/)?.[0] ?? null;
  const supervisionDeZona = zonaNum
    ? `Supervisión Escolar de la Zona ${zonaNum}`
    : 'Supervisión Escolar (zona no registrada)';
  const supervisionFirma = zonaNum ? `Supervisión Escolar Zona ${zonaNum}` : 'Supervisión Escolar';

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  const communityLabel =
    (cCtx as Record<string, unknown>).communityName && typeof (cCtx as Record<string, unknown>).communityName === 'string'
      ? String((cCtx as Record<string, unknown>).communityName)
      : cCtx.location || 'Comunidad Territorial';
  const cycleLabel =
    p.cycleType === 'A'
      ? 'Semestre A (Semestres 1°, 3° y 5° — 16 Semanas)'
      : p.cycleType === 'B'
      ? 'Semestre B (Semestres 2°, 4° y 6° — 16 Semanas)'
      : 'Ciclo Escolar Completo Anual (Semestres A y B — 32 Semanas)';

  const state: PaecPdfRenderState = {
    doc,
    p,
    sCtx,
    cCtx,
    teacherName,
    logos,
    zonaTexto,
    zonaNum,
    supervisionDeZona,
    supervisionFirma,
    margin,
    pageWidth,
    pageHeight,
    contentWidth,
    communityLabel,
    cycleLabel,
    curY: 14,
  };

  renderPaecPdfFase1(state);
  renderPaecPdfCurriculoYPlan(state);
  renderPaecPdfAnexos(state);
  renderPaecPdfFase4(state);

  addOfficialHybridHeadersAndFooters(doc, p.projectName, sCtx.cct, logos, zonaTexto);

  return Buffer.from(doc.output('arraybuffer'));
}
