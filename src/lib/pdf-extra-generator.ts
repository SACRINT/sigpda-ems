/**
 * pdf-extra-generator.ts — Generador PDF de Extras Didácticos (DBEPA Puebla)
 * SIGPDA-EMS · Rúbricas, Listas de Cotejo, Materiales, Planes de Clase, Guías
 * Usa jsPDF + jspdf-autotable (ya instalados) — sin dependencias nuevas.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Paleta institucional DBEPA ──────────────────────────────────────────────
const NAVY: [number, number, number]     = [26, 26, 46];   // #1A1A2E
const MID: [number, number, number]      = [15, 52, 96];   // #0F3460
const ACCENT: [number, number, number]   = [230, 81, 0];   // #E65100
const GOLD: [number, number, number]     = [255, 213, 128]; // #FFD580 (title highlight)
const GRAY_BG: [number, number, number]  = [238, 243, 251]; // #EEF3FB rowAlt
const TEXT: [number, number, number]     = [26, 26, 26];   // #1A1A1A
const WHITE: [number, number, number]    = [255, 255, 255];

// Accent color per extra type
const TYPE_COLOR: Record<string, [number, number, number]> = {
  rubric:         [15, 52, 96],  // MID blue
  checklist:      [1, 88, 76],   // green
  material:       [120, 53, 15], // brown
  lesson_plan:    [26, 26, 46],  // navy
  practice_guide: [76, 29, 149], // violet #4c1d95
};

const TYPE_LABEL: Record<string, string> = {
  rubric:         'RÚBRICA DE EVALUACIÓN',
  checklist:      'LISTA DE COTEJO',
  material:       'MATERIAL DIDÁCTICO',
  lesson_plan:    'PLAN DE CLASE (50 min)',
  practice_guide: 'GUÍA DE PRÁCTICA DEL ESTUDIANTE',
};

interface ExtraInput {
  id: string;
  title: string;
  type: string;
  content_text: string;
}

export function generateExtraPDF(extra: ExtraInput): jsPDF {
  const typeColor = TYPE_COLOR[extra.type] ?? NAVY;
  const typeLabel = TYPE_LABEL[extra.type] ?? 'RECURSO DIDÁCTICO';

  // Rubrics use landscape orientation for wider tables
  const isRubric = extra.type === 'rubric';
  const doc = new jsPDF({ orientation: isRubric ? 'landscape' : 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth  = doc.internal.pageSize.getWidth();   // 279.4 mm (landscape) or 215.9 mm (portrait)
  const pageHeight = doc.internal.pageSize.getHeight();  // 215.9 mm (landscape) or 279.4 mm (portrait)
  const margin = 13;
  const contentW = pageWidth - margin * 2;
  let y = margin;

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(...typeColor);
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Sup line
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...(GRAY_BG));
  doc.text('DBEPA PUEBLA — SECUENCIAS DIDÁCTICAS 2026-2027', pageWidth / 2, 10, { align: 'center' });

  // Type label (gold)
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text(typeLabel, pageWidth / 2, 19, { align: 'center' });

  // Title
  const titleLines = doc.splitTextToSize(extra.title, contentW - 10) as string[];
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  let titleY = 27;
  titleLines.slice(0, 2).forEach((line) => {
    doc.text(line, pageWidth / 2, titleY, { align: 'center' });
    titleY += 4.5;
  });

  // Gold divider line under header
  y = 39;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ── Parse Markdown ─────────────────────────────────────────────────────────
  const lines = extra.content_text.split('\n');
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableData: string[][] = [];

  const flushTable = () => {
    if (!inTable || tableHeaders.length === 0) return;

    // Determine column widths by count (mirrors docx logic)
    const colCount = tableHeaders.length;
    let colWidths: number[];
    if (colCount === 5) {
      // Rubric: Criterio + 4 levels
      const c1 = Math.round(contentW * 0.24);
      const rest = Math.round((contentW - c1) / 4);
      colWidths = [c1, rest, rest, rest, contentW - c1 - rest * 3];
    } else if (colCount === 4) {
      // Checklist: Criterio Sí No Obs
      const c1 = Math.round(contentW * 0.5);
      const c2 = Math.round(contentW * 0.1);
      colWidths = [c1, c2, c2, contentW - c1 - c2 * 2];
    } else {
      const eq = Math.floor(contentW / colCount);
      colWidths = Array(colCount - 1).fill(eq);
      colWidths.push(contentW - eq * (colCount - 1));
    }

    autoTable(doc, {
      startY: y,
      head: [tableHeaders.map((h) => ({ content: h, styles: { fillColor: MID, textColor: WHITE, fontStyle: 'bold', halign: 'center' } }))],
      body: tableData.map((row, rowIdx) =>
        row.map((cell, cellIdx) => {
          const isCheck = cell === 'Sí' || cell === 'No' || /^\d+%$/.test(cell);
          return {
            content: cell,
            styles: {
              fillColor: rowIdx % 2 === 0 ? WHITE : GRAY_BG,
              halign: (isCheck ? 'center' : (cellIdx === 0 ? 'left' : 'left')) as 'center' | 'left',
            },
          };
        })
      ),
      styles: { fontSize: 7, cellPadding: 2, textColor: TEXT, font: 'helvetica' },
      columnStyles: colWidths.reduce<Record<number, { cellWidth: number }>>((acc, w, i) => {
        acc[i] = { cellWidth: w };
        return acc;
      }, {}),
      margin: { left: margin, right: margin },
      theme: 'grid',
      pageBreak: 'auto',
    });

    y = (doc as any).lastAutoTable.finalY + 4;
    inTable = false;
    tableHeaders = [];
    tableData = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Table detection
    if (line.startsWith('|')) {
      // Skip separator |---|
      if (/^\|[\s:-|]+$/.test(line)) continue;

      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
        tableData = [];
      } else {
        tableData.push(cells);
      }
      continue;
    }

    // Flush pending table
    if (inTable) flushTable();

    if (line === '') {
      y += 2;
      continue;
    }

    // Check page overflow before adding text
    if (y > pageHeight - 20) {
      doc.addPage();
      y = margin + 2;
    }

    // H1
    if (line.startsWith('# ')) {
      const text = line.replace(/^# /, '');
      doc.setFillColor(...typeColor);
      doc.rect(margin, y - 3.5, contentW, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(text, margin + 3, y + 1.8);
      y += 9;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      const text = line.replace(/^## /, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...MID);
      doc.text(text, margin, y);
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 1, margin + doc.getTextWidth(text), y + 1);
      y += 6;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      const text = line.replace(/^### /, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MID);
      doc.text(text, margin, y);
      y += 5.5;
      continue;
    }

    // Bullet
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const text = line.substring(2).replace(/\*\*(.*?)\*\*/g, '$1');
      const wrapped = doc.splitTextToSize(`•  ${text}`, contentW - 6) as string[];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT);
      wrapped.forEach((wl: string, wi: number) => {
        if (y > pageHeight - 16) { doc.addPage(); y = margin + 2; }
        doc.text(wi === 0 ? wl : `   ${wl}`, margin + 4, y);
        y += 4.2;
      });
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      const text = numMatch[2].replace(/\*\*(.*?)\*\*/g, '$1');
      const wrapped = doc.splitTextToSize(`${numMatch[1]}.  ${text}`, contentW - 6) as string[];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT);
      wrapped.forEach((wl: string, wi: number) => {
        if (y > pageHeight - 16) { doc.addPage(); y = margin + 2; }
        doc.text(wi === 0 ? wl : `    ${wl}`, margin + 4, y);
        y += 4.2;
      });
      continue;
    }

    // Regular paragraph (strip bold markers for plain text)
    const plain = line.replace(/\*\*(.*?)\*\*/g, '$1');
    const wrapped = doc.splitTextToSize(plain, contentW) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT);
    wrapped.forEach((wl: string) => {
      if (y > pageHeight - 16) { doc.addPage(); y = margin + 2; }
      doc.text(wl, margin, y);
      y += 4.5;
    });
  }

  // Flush any trailing table
  if (inTable) flushTable();

  // ── Footer on every page ───────────────────────────────────────────────────
  const totalPages: number = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Accent line
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    const footerTitle = extra.title.substring(0, 55);
    doc.text(
      `SIGPDA-EMS · ${typeLabel} · ${footerTitle}  —  Página ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5.5,
      { align: 'center' }
    );
  }

  return doc;
}
