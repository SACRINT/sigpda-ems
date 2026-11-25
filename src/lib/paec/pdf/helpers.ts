import type jsPDF from 'jspdf';
import { logger } from '@/lib/logger';
import type { PaecProject, SchoolContext, CommunityContext } from '@/types/paec';

// Paleta Institucional MCCEMS / SEP Puebla
export const NAVY: [number, number, number]       = [31, 56, 100];   // #1F3864 - Azul Marino Institucional MCCEMS
export const BLUE_MID: [number, number, number]   = [46, 116, 181];  // #2E74B5 - Azul Medio Secundario
export const GOLD_LINE: [number, number, number]  = [232, 160, 32];  // #E8A020 - Dorado Oficial SEP
export const GOLD_LIGHT: [number, number, number] = [254, 243, 199]; // #FEF3C7 - Resaltado Semana 16
export const GRAY_BG: [number, number, number]    = [242, 244, 248]; // #F2F4F8 - Fondo Alternado
export const TEXT_DARK: [number, number, number]  = [30, 41, 59];    // #1E293B - Texto Primario
export const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // #64748B - Texto Secundario
export const GREEN_BG: [number, number, number]   = [236, 253, 245]; // Cumple

export function safeStr(val: unknown, fallback = 'Sin información registrada'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

export function addSectionBar(doc: jsPDF, title: string, y: number, x: number, width: number): void {
  doc.setFillColor(...NAVY);
  doc.rect(x, y - 4.5, 3.5, 7, 'F');

  doc.setFillColor(...GRAY_BG);
  doc.rect(x + 3.5, y - 4.5, width - 3.5, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(title.toUpperCase(), x + 7, y);

  doc.setDrawColor(...GOLD_LINE);
  doc.setLineWidth(0.5);
  doc.line(x, y + 3, x + width, y + 3);
}

export interface PaecPdfRenderState {
  doc: jsPDF;
  p: PaecProject;
  sCtx: SchoolContext;
  cCtx: CommunityContext;
  teacherName: string;
  logos: { gobierno?: string; sep?: string; supervision?: string };
  zonaTexto: string;
  zonaNum: string | null;
  supervisionDeZona: string;
  supervisionFirma: string;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  communityLabel: string;
  cycleLabel: string;
  curY: number;
}

/**
 * Aplica el membrete superior institucional y pie de página en páginas 2..N
 * adaptándose automáticamente a orientación Portrait o Landscape.
 */
export function addOfficialHybridHeadersAndFooters(
  doc: jsPDF,
  projectName: string,
  cct?: string,
  logos?: { sep?: string; supervision?: string },
  zonaTexto: string = 'Zona no registrada'
): void {
  const totalPages = doc.getNumberOfPages();
  const margin = 14;

  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const isLandscape = pW > pH;

    // Membrete superior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text('SEP PUEBLA · DIRECCIÓN DE EDUCACIÓN MEDIA SUPERIOR', margin, 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    const sectionTag = isLandscape
      ? '· PLAN OPERATIVO TERRITORIAL (16 SEMANAS)'
      : `· PROYECTO PEC: ${projectName.substring(0, 45)}`;
    doc.text(sectionTag, pW - margin - (logos?.sep ? 26 : 0), 9, { align: 'right' });

    // Línea de separación superior dorada
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(0.4);
    doc.line(margin, 12, pW - margin, 12);

    // Mini logotipo en encabezado
    if (logos?.sep) {
      try {
        const fmt = logos.sep.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(logos.sep, fmt, pW - margin - 22, 4.5, 20, 6);
      } catch (err) {
        logger.warn('[PAEC-PDF] Error agregando logotipo SEP en encabezado de página', { page: i, error: err });
      }
    }

    // Pie de página institucional
    doc.setDrawColor(...GOLD_LINE);
    doc.setLineWidth(0.4);
    doc.line(margin, pH - 11, pW - margin, pH - 11);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    const footerSchool = cct ? `CCT: ${cct} · ${zonaTexto} · Puebla` : `Bachilleratos Estatales Puebla · ${zonaTexto}`;
    doc.text(footerSchool, margin, pH - 7);

    // Paginación "Página X de Y"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(`Página ${i} de ${totalPages}`, pW - margin, pH - 7, { align: 'right' });
  }
}

