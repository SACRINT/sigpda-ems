import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import {
  MCCEMS_DIGITAL_TOOLS,
  resolveDigitalToolsForMission,
  resolveMultipleDigitalToolsForMission,
  generateToolQrPng,
} from '@/lib/visual-engine/digital-tools-registry';
import { drawDigitalToolCardWidget } from '@/lib/visual-engine/pdf-components-widgets';

describe('Fase 6: Catálogo de Herramientas Digitales y Widget QR en Workbooks', () => {
  it('1. El catálogo cuenta con 12 herramientas digitales normadas del MCCEMS con URL válida', () => {
    expect(MCCEMS_DIGITAL_TOOLS.length).toBe(12);
    for (const tool of MCCEMS_DIGITAL_TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.url.startsWith('https://')).toBe(true);
      expect(tool.platforms.length).toBeGreaterThan(0);
      expect(tool.relevanceKeywords.length).toBeGreaterThan(0);
    }
  });

  it('2. Resuelve pertinentemente herramientas según asignatura y temática', () => {
    // Matemáticas -> GeoGebra o Desmos
    const mathTool = resolveDigitalToolsForMission('Pensamiento Matemático II', 'Gráficas de Funciones Cuadráticas');
    expect(mathTool).not.toBeNull();
    expect(['geogebra', 'desmos']).toContain(mathTool?.id);

    // Física / Circuitos -> PhET o Tinkercad
    const physicsTool = resolveDigitalToolsForMission('Física I', 'Circuitos y Ley de Ohm', 'Análisis de corriente y voltaje');
    expect(physicsTool).not.toBeNull();
    expect(['phet', 'tinkercad', 'phyphox']).toContain(physicsTool?.id);

    // Química -> MolView o PhET
    const chemTool = resolveDigitalToolsForMission('Química I', 'Estructuras Moleculares y Enlaces Covalentes');
    expect(chemTool).not.toBeNull();
    expect(['molview', 'phet']).toContain(chemTool?.id);

    // Texto no relevante -> null (no fuerza herramientas)
    const noneTool = resolveDigitalToolsForMission('Historia Universal', 'Revolución Francesa');
    expect(noneTool).toBeNull();
  });

  it('2b. Resuelve múltiples herramientas ordenadas por relevancia', () => {
    const tools = resolveMultipleDigitalToolsForMission(
      'Pensamiento Matemático II',
      'Gráficas y Funciones Cuadráticas',
      'Simulación con calculadora gráfica',
      2
    );
    expect(tools.length).toBeGreaterThanOrEqual(1);
    expect(tools.length).toBeLessThanOrEqual(2);
    expect(['geogebra', 'desmos']).toContain(tools[0].id);
  });

  it('3. Genera un buffer QR nítido en formato PNG con firma binaria válida', async () => {
    const qrBuffer = await generateToolQrPng('https://www.geogebra.org/calculator');
    expect(qrBuffer).toBeInstanceOf(Buffer);
    expect(qrBuffer.length).toBeGreaterThan(200);

    // Firma mágica PNG: 0x89, 0x50 ('P'), 0x4E ('N'), 0x47 ('G')
    expect(qrBuffer[0]).toBe(0x89);
    expect(qrBuffer[1]).toBe(0x50);
    expect(qrBuffer[2]).toBe(0x4e);
    expect(qrBuffer[3]).toBe(0x47);
  });

  it('4. Renderiza el widget de herramienta digital con QR (14x14mm) en jsPDF sin errores', async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const tool = MCCEMS_DIGITAL_TOOLS[0]; // GeoGebra
    const qrBuffer = await generateToolQrPng(tool.url);

    const startY = 30;
    const endY = drawDigitalToolCardWidget(doc, {
      tool,
      qrPngBuffer: qrBuffer,
      sideXAbs: 140,
      sideW: 55,
      startY,
      sideBottom: 240,
      compact: false,
    });

    expect(endY).toBeGreaterThan(startY + 30);
    expect(endY).toBeLessThan(startY + 55);

    // Verificar que el PDF compila a buffer válido
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    expect(pdfBuffer.toString('ascii', 0, 5)).toBe('%PDF-');
  });
});
