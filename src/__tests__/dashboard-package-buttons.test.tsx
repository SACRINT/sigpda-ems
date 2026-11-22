/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { buildPlanningPackageSpec } from '@/lib/planning-package-items';
import { DashboardPackageDownloadButtons } from '@/components/planeacion/BulkDownloadButton';

describe('DashboardPackageDownloadButtons y SSoT de Paquete Completo (9 entregables)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('genera exactamente los 9 entregables consolidados para DOCX y PDF con código corto', () => {
    const docxSpec = buildPlanningPackageSpec('plan-123', 'Pensamiento Matemático III', 'docx');
    const pdfSpec = buildPlanningPackageSpec('plan-123', 'Pensamiento Matemático III', 'pdf');

    expect(docxSpec.items).toHaveLength(9);
    expect(pdfSpec.items).toHaveLength(9);
    expect(docxSpec.zipFileName).toBe('Paquete_PM3_Word.zip');
    expect(pdfSpec.zipFileName).toBe('Paquete_PM3_PDF.zip');
    expect(docxSpec.href).toBe('/api/docx/extra/bulk?planningId=plan-123');
    expect(pdfSpec.href).toBe('/api/pdf/extra/bulk?planningId=plan-123');

    expect(docxSpec.items.map((item) => item.fileName)).toEqual([
      '01_Planeacion_PM3.docx',
      '02_Secuencia_PM3.docx',
      '03_Planes_Clase_PM3.docx',
      '04_Solucionario_PM3.docx',
      '05_Guias_Practica_PM3.docx',
      '06_Libro_Semestral_PM3.docx',
      '07_Instrumentos_PM3.docx',
      '08_Presentaciones_PM3.pptx',
      '09_Infografias_PM3.pdf',
    ]);

    expect(pdfSpec.items.map((item) => item.fileName)).toEqual([
      '01_Planeacion_PM3.pdf',
      '02_Secuencia_PM3.pdf',
      '03_Planes_Clase_PM3.pdf',
      '04_Solucionario_PM3.pdf',
      '05_Guias_Practica_PM3.pdf',
      '06_Libro_Semestral_PM3.pdf',
      '07_Instrumentos_PM3.pdf',
      '08_Presentaciones_PM3.pptx',
      '09_Infografias_PM3.pdf',
    ]);
  });

  it('renderiza botones compactos "DOCX" y "PDF" con los mismos href y tooltips que el Centro de Descargas', () => {
    render(
      <DashboardPackageDownloadButtons
        planningId="plan-456"
        uacName="Dibujo Técnico I"
      />
    );

    const docxLink = screen.getByRole('link', { name: 'DOCX' });
    const pdfLink = screen.getByRole('link', { name: 'PDF' });

    expect(docxLink.getAttribute('href')).toBe('/api/docx/extra/bulk?planningId=plan-456');
    expect(docxLink.getAttribute('title')).toMatch(/9 entregables.*Word/i);
    expect(pdfLink.getAttribute('href')).toBe('/api/pdf/extra/bulk?planningId=plan-456');
    expect(pdfLink.getAttribute('title')).toMatch(/9 entregables.*PDF/i);
  });

  it('al hacer clic en PDF descarga los 9 entregables en orden y genera el ZIP', async () => {
    const fetchedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      fetchedUrls.push(String(input));
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const createObjectURLSpy = vi.fn(() => 'blob:mock-zip-url');
    const revokeObjectURLSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLSpy, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLSpy, configurable: true });

    const clickedDownloads: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      if (this.download) clickedDownloads.push(this.download);
    });

    render(
      <DashboardPackageDownloadButtons
        planningId="plan-789"
        uacName="Pensamiento Matemático III"
      />
    );

    fireEvent.click(screen.getByRole('link', { name: 'PDF' }));

    await waitFor(() => {
      expect(clickedDownloads).toEqual(['Paquete_PM3_PDF.zip']);
    });

    expect(fetchedUrls).toEqual([
      '/api/planeaciones/plan-789/pdf',
      '/api/planeaciones/plan-789/secuencia/pdf',
      '/api/pdf/extra/combined?planningId=plan-789&type=lesson_plan',
      '/api/pdf/extra/combined?planningId=plan-789&type=teacher_guide',
      '/api/pdf/extra/combined?planningId=plan-789&type=practice_guide',
      '/api/pdf/libro-semestral/plan-789',
      '/api/pdf/extra/combined?planningId=plan-789&type=evaluation',
      '/api/planeaciones/plan-789/presentacion/combinada',
      '/api/planeaciones/plan-789/infografia/combinada?format=pdf',
    ]);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
