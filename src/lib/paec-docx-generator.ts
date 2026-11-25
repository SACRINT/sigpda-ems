/**
 * paec-docx-generator.ts — Generador Editorial DOCX Oficial del Proyecto Escolar Comunitario (PEC / PAEC)
 * SIGPDA-EMS · Estándar Oficial SEP Puebla (MCCEMS / NEM)
 * Fachada delgada que orquesta los módulos en ./paec/docx/* manteniendo paridad exacta.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  PageOrientation,
} from 'docx';
import type { PaecProject } from '@/types/paec';
import {
  C,
  PORTRAIT_W,
  PORTRAIT_H,
  LANDSCAPE_W,
  LANDSCAPE_H,
  MARGIN,
  safeStr,
  parseFodaData,
  type ParsedFoda,
  type PaecDocxContext,
} from './paec/docx/helpers';
import { buildPaecDocxSection1 } from './paec/docx/section1-diagnostico-curriculo';
import { buildPaecDocxSection2 } from './paec/docx/section2-plan-operativo';
import { buildPaecDocxSection3 } from './paec/docx/section3-anexos-cierre';

export { parseFodaData, type ParsedFoda };

export async function generatePaecDocx(
  project: PaecProject,
  teacherName: string = 'Docente Coordinador'
): Promise<Buffer> {
  const p = project;
  const sCtx = p.schoolContext || {};
  const cCtx = p.communityContext || {};

  const zonaTexto = safeStr(sCtx.schoolZone, 'Zona no registrada');
  const zonaNum = zonaTexto.match(/\d{2,4}/)?.[0] ?? null;
  const supervisionFirma = zonaNum ? `Supervisión Escolar Zona ${zonaNum}` : 'Supervisión Escolar';
  const zonaFirmaTexto = zonaNum ? `Zona Escolar ${zonaNum} Puebla` : 'Zona no registrada';

  const ctx: PaecDocxContext = {
    p,
    sCtx,
    cCtx,
    teacherName,
    zonaTexto,
    zonaNum,
    supervisionFirma,
    zonaFirmaTexto,
  };

  const makeHeader = (subtitle: string) =>
    new Header({
      children: [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.mid, space: 4 } },
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `SEP PUEBLA · DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR ${subtitle}`,
              size: 15,
              color: C.dark,
              bold: true,
              font: 'Arial',
            }),
          ],
        }),
      ],
    });

  const makeFooter = () =>
    new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
          spacing: { before: 120 },
          children: [
            new TextRun({
              text: `PAEC-PEC · CCT: ${safeStr(sCtx.cct, 'N/D')} · Página `,
              size: 15,
              color: C.textMuted,
              font: 'Arial',
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 15,
              color: C.dark,
              bold: true,
              font: 'Arial',
            }),
            new TextRun({
              text: ' de ',
              size: 15,
              color: C.textMuted,
              font: 'Arial',
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              size: 15,
              color: C.dark,
              bold: true,
              font: 'Arial',
            }),
          ],
        }),
      ],
    });

  const { children: s1Children, communityLabel } = buildPaecDocxSection1(ctx);
  const s2Children = buildPaecDocxSection2(ctx);
  const s3Children = buildPaecDocxSection3(ctx, communityLabel);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: PORTRAIT_W, height: PORTRAIT_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: { default: makeHeader('· Fases I y II') },
        footers: { default: makeFooter() },
        children: s1Children,
      },
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: LANDSCAPE_W, height: LANDSCAPE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: { default: makeHeader('· Plan Operativo Territorial (16 Semanas)') },
        footers: { default: makeFooter() },
        children: s2Children,
      },
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: PORTRAIT_W, height: PORTRAIT_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: { default: makeHeader('· Formalización, Anexos e Informe Final') },
        footers: { default: makeFooter() },
        children: s3Children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
