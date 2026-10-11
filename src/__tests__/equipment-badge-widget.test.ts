import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { drawEquipmentCardWidget } from '@/lib/visual-engine/pdf-components-widgets';
import type { DetectedObject } from '@/lib/visual-engine/object-extractor';

describe('F-66: Equipment Badge Widget Complete Description Rendering', () => {
  it('renderiza safetyRule larga de 4+ líneas completa sin truncar a 2 líneas', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const detected: DetectedObject = {
      id: 'multimetro',
      name: 'Multímetro Digital de Rango Automático con Calibración de Precisión',
      category: 'instrumento_medicion',
      englishQuery: 'digital multimeter auto range',
      keywordsBilingual: ['multimeter'],
      technicalRole: 'Medición de voltaje, corriente y resistencia',
      safetyRule:
        'Regla de seguridad 1: Verificar que las puntas estén conectadas en COM y V/Omega antes de medir tensión. ' +
        'Regla 2: Nunca cambiar el selector de escala con las puntas conectadas al circuito bajo prueba. ' +
        'Regla 3: Utilizar equipo de protección dieléctrico adecuado en tensiones mayores a 50V AC. ' +
        'Regla 4: Descargar todos los capacitores antes de realizar pruebas de continuidad.',
      normaNOM: 'NOM-001-SCFI-2018',
      familias: ['electronica_mecatronica'],
      svgKey: 'multimetro',
      matchedText: 'multímetro',
      source: 'catalog',
      confidence: 1.0,
    };

    const sideXAbs = 150;
    const sideW = 50;
    const startY = 30;
    const sideBottom = 250;

    const nextY = drawEquipmentCardWidget(doc, {
      detected,
      imageBuffer: Buffer.from('fake-image-bytes'),
      imageFormat: 'PNG',
      sideXAbs,
      sideW,
      startY,
      sideBottom,
    });

    expect(nextY).toBeGreaterThan(startY + 54);
    // Verificar que el card acomodó la altura requerida (mayor a la cota previa fija de 54mm)
    expect(nextY - startY).toBeGreaterThan(55);
  });
});
