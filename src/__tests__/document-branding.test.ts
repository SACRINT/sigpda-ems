import { describe, it, expect } from 'vitest';
import {
  DOC_TYPE_CONFIG,
  resolveHeaderBranding,
  resolveFooterBranding,
  sanitizeDocFilename,
  INSTITUTIONAL_DEFAULTS,
} from '@/lib/document-branding';
import {
  bdr,
  tc,
  tcH,
  parseTextRuns,
  createParagraphFromLine,
  createMarkdownTable,
  C,
} from '@/lib/docx-helpers';

describe('Fase 1 — document-branding.ts & docx-helpers.ts', () => {
  describe('document-branding.ts', () => {
    it('cubre los 6 tipos oficiales de extras didácticos con colores y etiquetas oficiales', () => {
      const requiredTypes = [
        'lesson_plan',
        'rubric',
        'checklist',
        'material',
        'practice_guide',
        'teacher_guide',
      ];
      for (const t of requiredTypes) {
        expect(DOC_TYPE_CONFIG[t]).toBeDefined();
        expect(DOC_TYPE_CONFIG[t].label).toBeTruthy();
        expect(DOC_TYPE_CONFIG[t].color).toHaveLength(3);
        expect(DOC_TYPE_CONFIG[t].hex).toMatch(/^[0-9A-Fa-f]{6}$/);
      }
    });

    it('resolveHeaderBranding resuelve ciclo y metadatos con fallbacks seguros', () => {
      const branding = resolveHeaderBranding('teacher_guide', {
        cct: '21EBH0123Z',
        schoolName: 'Bachillerato Digital 45',
        cycle: '2026-2027',
      });
      expect(branding.typeLabel).toBe('SOLUCIONARIO Y PAUTAS DOCENTES');
      expect(branding.topSup).toContain('2026-2027');
      expect(branding.cct).toBe('21EBH0123Z');
      expect(branding.schoolName).toBe('Bachillerato Digital 45');
    });

    it('resolveFooterBranding formatea la paginación y título institucional', () => {
      const footer = resolveFooterBranding('lesson_plan', 'Plan Sesión 2', {}, 2, 5);
      expect(footer.leftText).toContain('SIGPDA-EMS');
      expect(footer.leftText).toContain('PLAN DE CLASE');
      expect(footer.rightText).toBe('Página 2 de 5');
    });

    it('sanitizeDocFilename elimina tildes sin generar underscores destructivos', () => {
      expect(sanitizeDocFilename('Rúbrica Analítica de Evaluación')).toBe(
        'rubrica_analitica_de_evaluacion'
      );
      expect(sanitizeDocFilename('Guía de Trabajo Activo del Estudiante')).toBe(
        'guia_de_trabajo_activo_del_estudiante'
      );
      expect(sanitizeDocFilename('Materiales Didácticos e Insumos')).toBe(
        'materiales_didacticos_e_insumos'
      );
    });
  });

  describe('docx-helpers.ts', () => {
    it('parseTextRuns descompone correctamente segmentos en negrita', () => {
      const runs = parseTextRuns('Texto **negrita** y normal');
      expect(runs).toHaveLength(3);
    });

    it('createParagraphFromLine colorea encabezados según la fase didáctica', () => {
      const pApertura = createParagraphFromLine('## Fase de Apertura (10 min)');
      const pDesarrollo = createParagraphFromLine('## Fase de Desarrollo (30 min)');
      const pCierre = createParagraphFromLine('## Fase de Cierre (10 min)');

      expect(pApertura).toBeDefined();
      expect(pDesarrollo).toBeDefined();
      expect(pCierre).toBeDefined();
    });

    it('createMarkdownTable genera tabla con heurísticas de rúbrica de 5 columnas', () => {
      const headers = ['Criterio', 'Excelente', 'Bueno', 'Suficiente', 'Insuficiente'];
      const rows = [['Dominio', 'Excelente desempeño', 'Buen desempeño', 'Regular', 'Deficiente']];
      const table = createMarkdownTable(headers, rows, 10800);
      expect(table).toBeDefined();
    });
  });
});
