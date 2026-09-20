import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import {
  renderFormattedBlock,
  renderExtraDocument,
  generateExtraPdfDocument,
  type ExtraInput,
} from '@/lib/pdf-extra-renderer';
import { areEditorialFontsLoaded } from '@/lib/visual-engine/font-loader';

describe('Fase 2 — pdf-extra-renderer.ts (Motor Visual Unificado)', () => {
  it('renderFormattedBlock divide por palabras y respeta el ancho máximo sin desbordar', () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    let pageCount = 1;
    const addNewPage = () => {
      doc.addPage();
      pageCount++;
    };

    const longMarkdownText =
      '**Rol del Docente:** Presentar el fenómeno contextual en la comunidad de Coronel Tito Hernández, donde la producción citrícola requiere cálculo meticuloso de costos variables y costos fijos para determinar el punto de equilibrio financiero del productor rural.';

    const startY = 30;
    const finalY = renderFormattedBlock(doc, longMarkdownText, {
      x: 15,
      y: startY,
      maxWidth: 100, // Forzar varias líneas
      pageHeight: 279.4,
      lineHeight: 5,
      addNewPage,
    });

    // Debe haber avanzado verticalmente al menos 3 renglones (> 15mm)
    expect(finalY).toBeGreaterThan(startY + 12);
  });

  it('renderExtraDocument orquesta ribbons, callouts y formato institucional', () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const extra: ExtraInput = {
      id: 'test-lesson-visual',
      title: 'Plan de Clase — Ecuaciones Lineales',
      type: 'lesson_plan',
      content_text: `
# PLAN DE CLASE OFICIAL
## Apertura: Activación de Saberes [10 min]
> NOTA DOCENTE: Verificar conocimientos previos de álgebra básica.
- **Punto Clave:** La balanza representa la igualdad matemática estricta.

## Desarrollo: Modelado Matemático [30 min]
Los estudiantes en parejas resuelven el problema de costos en GeoGebra.

## Cierre: Evaluación Formativa [10 min]
[x] Entrega de apunte formativo con gráfico de punto de equilibrio.
      `.trim(),
    };

    renderExtraDocument(doc, extra, {
      schoolName: 'Bachillerato General Hermanos Serdán',
      cycle: '2026-2027',
      cct: '21EBH9999Z',
    });

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(2000);
  });

  it('generateExtraPdfDocument inicializa fuentes editoriales automáticamente y compila sin pasar por la fachada', () => {
    const extra: ExtraInput = {
      id: 'test-direct-renderer',
      title: 'Rúbrica de Pensamiento Matemático',
      type: 'rubric',
      content_text: `
| Criterio | Sobresaliente | Suficiente |
| --- | --- | --- |
| Planteamiento | Modela variables con precisión | Identifica datos básicos |
      `.trim(),
    };

    const doc = generateExtraPdfDocument(extra, {
      schoolName: 'Bachillerato Digital Núm. 10',
      cycle: '2026-2027',
    });

    expect(doc).toBeDefined();
    expect(areEditorialFontsLoaded(doc)).toBe(true);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight()); // Landscape para rubric
    const buffer = doc.output('arraybuffer');
    expect(buffer.byteLength).toBeGreaterThan(5000);
  });
});
