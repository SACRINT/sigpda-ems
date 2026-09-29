/**
 * structural-confidence.test.ts
 * Tests unitarios y discriminantes para Structural Confidence Score por campo (CP-1 / M2).
 */

import { describe, it, expect } from 'vitest';
import {
  createExtractedField,
  methodToFuente,
  type ExtractionMethod,
  type FuenteExtraccion,
} from '@/lib/document-ingestion/types';
import { parseConcentrado911Layout } from '@/lib/concentrado-911-calculator';
import { parseF11Layout } from '@/lib/f11-layout-calculator';

describe('CP-1 / M2: Structural Confidence Score por Campo', () => {
  describe('createExtractedField y methodToFuente', () => {
    it('asigna la fuente en español correspondiente a cada ExtractionMethod', () => {
      const mappings: Array<[ExtractionMethod, FuenteExtraccion]> = [
        ['structural_anchor', 'ancla_estructural'],
        ['coordinate_band', 'banda_coordenadas'],
        ['regex_fulltext', 'regex_texto'],
        ['cross_validated', 'validacion_cruzada'],
        ['inferred', 'inferencia'],
      ];

      for (const [method, expectedFuente] of mappings) {
        expect(methodToFuente(method)).toBe(expectedFuente);
        const field = createExtractedField('valor', method, 0.9);
        expect(field.method).toBe(method);
        expect(field.fuente).toBe(expectedFuente);
      }
    });

    it('normaliza confidence entre 0.0 y 1.0 con dos decimales', () => {
      expect(createExtractedField('test', 'structural_anchor', 1.5).confidence).toBe(1.0);
      expect(createExtractedField('test', 'structural_anchor', -0.5).confidence).toBe(0.0);
      expect(createExtractedField('test', 'structural_anchor', 0.9567).confidence).toBe(0.96);
    });

    it('activa requiresManualValidation cuando el método es inferred', () => {
      const field = createExtractedField('inferred_val', 'inferred', 0.99);
      expect(field.requiresManualValidation).toBe(true);
    });

    it('activa requiresManualValidation cuando la confianza es menor a 0.75', () => {
      const fieldBajo = createExtractedField(100, 'coordinate_band', 0.65);
      expect(fieldBajo.requiresManualValidation).toBe(true);

      const fieldAlto = createExtractedField(100, 'coordinate_band', 0.85);
      expect(fieldAlto.requiresManualValidation).toBe(false);
    });
  });

  describe('Concentrado 911 — Evaluación de Confianza Estructural', () => {
    it('asigna alta confianza y ancla estructural a escuela y matrícula validada', async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA', 20, 20);
      doc.text('NOMBRE OFICIAL DE LA ESCUELA SEGUN CATALOGO DE CENTROS DE TRABAJO', 20, 30);
      doc.text('BACHILLERATO HEROES DE PUEBLA', 20, 35);
      doc.text('21EBH0001A', 120, 30);
      doc.text('2025-2026', 150, 30);
      doc.text('AL INICIO DEL PERIODO ESCOLAR', 50, 60);
      doc.text('GENERAL', 180, 50);
      doc.text('TOTAL', 50, 80);
      // Fila total: 50 + 70 = 120
      doc.text('50', 160, 80);
      doc.text('70', 170, 80);
      doc.text('120', 180, 80);

      const buf = Buffer.from(doc.output('arraybuffer'));
      const parsed = await parseConcentrado911Layout(buf, { momento: 'inicio' });

      // Verificación de presencia de fieldConfidence
      expect(parsed.fieldConfidence).toBeDefined();

      // CCT vía regex
      expect(parsed.fieldConfidence.schoolCct.value).toBe('21EBH0001A');
      expect(parsed.fieldConfidence.schoolCct.method).toBe('regex_fulltext');
      expect(parsed.fieldConfidence.schoolCct.confidence).toBe(0.95);
      expect(parsed.fieldConfidence.schoolCct.requiresManualValidation).toBe(false);

      // Nombre de escuela vía ancla estructural
      expect(parsed.fieldConfidence.schoolName.value).toBe('BACHILLERATO HEROES DE PUEBLA');
      expect(parsed.fieldConfidence.schoolName.method).toBe('structural_anchor');
      expect(parsed.fieldConfidence.schoolName.fuente).toBe('ancla_estructural');
      expect(parsed.fieldConfidence.schoolName.confidence).toBeGreaterThanOrEqual(0.95);
      expect(parsed.fieldConfidence.schoolName.requiresManualValidation).toBe(false);

      // Matrícula de inicio con validación cruzada (columna GENERAL / suma 50+70)
      expect(parsed.fieldConfidence.matriculaInicio.value).toBe(120);
      expect(parsed.fieldConfidence.matriculaInicio.method).toBe('cross_validated');
      expect(parsed.fieldConfidence.matriculaInicio.fuente).toBe('validacion_cruzada');
      expect(parsed.fieldConfidence.matriculaInicio.confidence).toBeGreaterThanOrEqual(0.95);
      expect(parsed.fieldConfidence.matriculaInicio.requiresManualValidation).toBe(false);
    });

    it('asigna inferencia con validación manual cuando el documento está vacío o escaneado', async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF(); // Página en blanco sin texto
      const buf = Buffer.from(doc.output('arraybuffer'));
      const parsed = await parseConcentrado911Layout(buf);

      expect(parsed.isScanned).toBe(true);
      expect(parsed.fieldConfidence.schoolName.value).toBeNull();
      expect(parsed.fieldConfidence.schoolName.method).toBe('inferred');
      expect(parsed.fieldConfidence.schoolName.confidence).toBe(0.0);
      expect(parsed.fieldConfidence.schoolName.requiresManualValidation).toBe(true);
      expect(parsed.fieldConfidence.matriculaInicio.requiresManualValidation).toBe(true);
    });
  });

  describe('Formato 11 (F11) — Evaluación de Confianza Estructural', () => {
    it('asigna ancla estructural a banda de grupo cuando ESTATAL está presente y validado', async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [1008, 612] });
      // Cabecera institucional: en jsPDF (origen superior, alto=612), y = 612 - pdfjsY
      // Para pdfjs Y=503 -> jsPDF y=109; para pdfjs Y=525 -> jsPDF y=87; para pdfjs Y=500 -> jsPDF y=112
      doc.text('21EBH0200X', 63, 109);
      doc.text('BACHILLERATO GENERAL ESTATAL HEROES DE LA PATRIA', 63, 87);
      doc.text('2025-2026', 925, 109);
      // Encabezado de grupo dinámico en Y=500
      doc.text('ESTATAL 0324 2 A MATUTINO', 63, 112);

      const buf = Buffer.from(doc.output('arraybuffer'));
      const parsed = await parseF11Layout(buf);

      expect(parsed.fieldConfidence).toBeDefined();
      expect(parsed.fieldConfidence.schoolCct.method).toBe('regex_fulltext');
      expect(parsed.fieldConfidence.schoolCct.value).toBe('21EBH0200X');
      expect(parsed.fieldConfidence.schoolName.method).toBe('coordinate_band');
      expect(parsed.fieldConfidence.schoolName.confidence).toBe(0.85);

      // Banda de grupo dinámica detectada por ancla ESTATAL
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.method).toBe('structural_anchor');
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.fuente).toBe('ancla_estructural');
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.confidence).toBe(0.98);
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.requiresManualValidation).toBe(false);
    });

    it('asigna coordinate_band con menor confianza cuando la banda de grupo usa el fallback por defecto', async () => {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [1008, 612] });
      // Sin clave ESTATAL ni patrón de grupo
      doc.text('DOCUMENTO SIN ENCABEZADO OFICIAL', 100, 300);

      const buf = Buffer.from(doc.output('arraybuffer'));
      const parsed = await parseF11Layout(buf);

      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.method).toBe('coordinate_band');
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.fuente).toBe('banda_coordenadas');
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.confidence).toBe(0.65);
      expect(parsed.fieldConfidence.bandaEncabezadoGrupo.requiresManualValidation).toBe(true);
    });
  });
});
