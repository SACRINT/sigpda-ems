/* eslint-disable @typescript-eslint/no-explicit-any */
import type jsPDF from 'jspdf';
import type { PmcProject } from '@/types/pmc';

export const NAVY: [number, number, number] = [31, 56, 100];       // #1F3864 - Azul Institucional MCCEMS
export const BLUE_MID: [number, number, number] = [46, 116, 181];   // #2E74B5 - Azul Secundario
export const BLUE_LIGHT: [number, number, number] = [220, 228, 245]; // #DCE4F5 - Fondo Encabezados Suaves
export const GOLD_LINE: [number, number, number] = [232, 160, 32];  // #E8A020 - Dorado Oficial SEP
export const GRAY_BG: [number, number, number] = [242, 244, 248];   // #F2F4F8 - Fondo Alternado
export const TEXT_DARK: [number, number, number] = [30, 41, 59];    // #1E293B - Texto Primario
export const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // #64748B - Texto Secundario

export function safeStr(val: unknown, fallback = 'N/D'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

export function parseJson<T = any>(val: unknown): T {
  if (!val) return {} as T;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return {} as T;
  }
}

export function drawJustifiedParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  gapAfter = 0
): number {
  const clean = String(text ?? '').trim();
  if (!clean) return y;
  const lines = doc.splitTextToSize(clean, maxWidth);
  doc.text(lines, x, y, { align: 'justify', maxWidth });
  return y + lines.length * lineHeight + gapAfter;
}


export interface PmcPdfRenderState {
  doc: jsPDF;
  project: PmcProject;
  logos: { gobierno?: string; sep?: string; supervision?: string };
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  curY: number;
  cicloTexto: string;
  diag: Record<string, any>;
  sectionPageMap: Map<string, number>;
  tocEntries: Array<{ key: string; isSection: boolean }>;
  pageCellCoords: Array<{ x: number; y: number; width: number; height: number; key: string; isSection: boolean }>;
  drawHeaderOnNewPage: () => void;
  addSectionHeader: (titulo: string, currentY: number) => number;
}
