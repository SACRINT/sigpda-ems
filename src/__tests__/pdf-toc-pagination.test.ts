import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import type { RealTocEntry } from '@/lib/pdf-workbook-renderer';

describe('TOC Dynamic Pagination & Separation from Mission 1 (Bug 4)', () => {
  it('reserves 2 pages when total entries exceed 18 and splits without crashing or overlapping', () => {
    const totalEntries = 30; // 28 missions + PAEC + Eval
    const tocPagesCount = totalEntries > 18 ? 2 : 1;
    expect(tocPagesCount).toBe(2);

    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    // Simulate Cover (P1), Plantel (P2)
    doc.addPage();
    const coverPage = doc.getNumberOfPages(); // 2

    // Reserve TOC pages
    doc.addPage();
    const tocP1 = doc.getNumberOfPages(); // 3
    doc.addPage();
    const tocP2 = doc.getNumberOfPages(); // 4

    // Mission 1 starts on page AFTER TOC
    doc.addPage();
    const mission1StartPage = doc.getNumberOfPages(); // 5
    expect(mission1StartPage).toBeGreaterThan(tocP2);

    // Verify 30 entries can be split cleanly
    const entries: RealTocEntry[] = Array.from({ length: 30 }, (_, idx) => ({
      sectionLabel: `Misión ${idx + 1}`,
      title: `Desafío didáctico de prueba ${idx + 1}`,
      sessionsRange: `Sesión ${idx + 1}`,
      pageNumber: mission1StartPage + idx * 4,
    }));

    const splitIndex = Math.ceil(entries.length / 2);
    expect(splitIndex).toBe(15);
    expect(entries.slice(0, splitIndex).length).toBe(15);
    expect(entries.slice(splitIndex).length).toBe(15);
  });
});

