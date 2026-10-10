import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  drawIcon,
  type IconName,
} from '@/lib/visual-engine/icon-renderer';
import * as iconRenderer from '@/lib/visual-engine/icon-renderer';
import { drawStepCardGrid } from '@/lib/visual-engine/step-card-renderer';
import type { LabStepCard } from '@/types/work-textbook';

describe('Motor de Iconografía Vectorial Offline — Pruebas Unitarias y Anti-WinAnsi (Fase 6B)', () => {
  const CANONICAL_ICONS: IconName[] = [
    'check',
    'bombilla',
    'engranaje',
    'herramienta',
    'warning',
    'libro',
    'lupa',
    'gota',
    'chip',
    'flecha-doble',
  ];

  it('dibuja exitosamente los 10 iconos vectoriales canónicos con retorno true', () => {
    const doc = new jsPDF();

    CANONICAL_ICONS.forEach((name) => {
      const drawn = drawIcon(doc, name, 20, 20, 4);
      expect(drawn).toBe(true);
    });

    // Alias flechaDoble (camelCase)
    expect(drawIcon(doc, 'flechaDoble', 20, 20, 4)).toBe(true);
  });

  it('GARANTÍA ANTI-WINANSI: ninguno de los 10 iconos invoca doc.text (cero llamadas a texto)', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    CANONICAL_ICONS.forEach((name) => {
      textSpy.mockClear();
      drawIcon(doc, name, 15, 15, 3.5);
      expect(textSpy).toHaveBeenCalledTimes(0);
    });

    textSpy.mockRestore();
  });

  it('DEGRADACIÓN D9: nombres inexistentes, valores inválidos o tamaño <= 0 retornan false sin arrojar error', () => {
    const doc = new jsPDF();
    const textSpy = vi.spyOn(doc, 'text');

    expect(drawIcon(doc, 'icono-inexistente', 10, 10, 3.5)).toBe(false);
    expect(drawIcon(doc, '', 10, 10, 3.5)).toBe(false);
    expect(drawIcon(doc, 'check', 10, 10, 0)).toBe(false);
    expect(drawIcon(doc, 'check', 10, 10, -5)).toBe(false);

    // Cero llamadas a doc.text en degradación
    expect(textSpy).toHaveBeenCalledTimes(0);
    textSpy.mockRestore();
  });

  it('CONSUMIDOR STEP-CARDS & PRUEBA ANTI-F11: drawStepCardGrid invoca drawIcon para badges [OK] y [IDEA]', () => {
    const doc = new jsPDF();
    const drawIconSpy = vi.spyOn(iconRenderer, 'drawIcon');

    const mockCards: LabStepCard[] = [
      {
        stepNumber: 1,
        title: 'Verificación de Sensores',
        actionDescription: 'Comprobar continuidad eléctrica.',
        codeSnippet: '$ test-sensor --all',
        expectedOutput: 'Todos los sensores responden OK',
        tipOrNote: 'Revisa que la polaridad sea la adecuada.',
      },
    ];

    const nextY = drawStepCardGrid(doc, mockCards, {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: (_d, curY) => curY,
    });

    expect(nextY).toBeGreaterThan(20);

    // Anti-F11: Debe invocar drawIcon para 'check' y 'bombilla'
    expect(drawIconSpy).toHaveBeenCalledWith(
      doc,
      'check',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Array)
    );
    expect(drawIconSpy).toHaveBeenCalledWith(
      doc,
      'bombilla',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Array)
    );

    drawIconSpy.mockRestore();
  });

  it('CONSUMIDOR STEP-CARDS DEGRADACIÓN D9: si drawIcon falla/retorna false, el renderer cae al texto [OK] y [IDEA]', () => {
    const doc = new jsPDF();
    const drawIconSpy = vi.spyOn(iconRenderer, 'drawIcon').mockReturnValue(false);
    const textSpy = vi.spyOn(doc, 'text');

    const mockCards: LabStepCard[] = [
      {
        stepNumber: 1,
        title: 'Prueba de Degradación D9',
        actionDescription: 'Simulación de fallo en motor de iconos.',
        expectedOutput: 'Degradación limpia a texto',
        tipOrNote: 'Consejo técnico en modo texto',
      },
    ];

    const nextY = drawStepCardGrid(doc, mockCards, {
      margin: 15,
      drawWidth: 180,
      y: 20,
      pageHeight: 279,
      ensureVerticalSpace: (_d, curY) => curY,
    });

    expect(nextY).toBeGreaterThan(20);
    // Verificamos que cayó a las etiquetas de texto canónicas WinAnsi
    expect(textSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OK] Salida esperada:'),
      expect.any(Number),
      expect.any(Number)
    );
    expect(textSpy).toHaveBeenCalledWith(
      expect.stringContaining('[IDEA] Tip / Pista técnica:'),
      expect.any(Number),
      expect.any(Number)
    );

    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(1000);

    drawIconSpy.mockRestore();
    textSpy.mockRestore();
  });

  it('PREVENCIÓN DE FUGA DE ESTADO (F-37): drawIcon preserva y restaura setDrawColor y setFillColor del documento', () => {
    const doc = new jsPDF();
    doc.setDrawColor(33, 44, 55);
    doc.setFillColor(77, 88, 99);
    const initialDraw = doc.getDrawColor();
    const initialFill = doc.getFillColor();

    const ok = drawIcon(doc, 'check', 10, 10, 3.5);
    expect(ok).toBe(true);

    // Debe haber restaurado exactamente los colores previos del documento
    expect(doc.getDrawColor()).toBe(initialDraw);
    expect(doc.getFillColor()).toBe(initialFill);
  });
});

