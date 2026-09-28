import { describe, it, expect } from 'vitest';
import {
  PmcPreviousExtractSchema,
  type PmcPlanElement,
} from '@/lib/prompts/pmc-extraction';
import {
  validateNormalizedText,
  deriveMetasPreviasFromElementos,
  deriveElementosFromMetasPrevias,
  calculatePmcCoverage,
} from '@/lib/pmc/plan-element-normalizer';

describe('FASE B — Extractor semántico por contenido e invariantes de datos', () => {
  // ── TEST (i): Schema límites de metas y elementos ─────────────────────────
  describe('(i) PmcPreviousExtractSchema límites de elementos_plan y metas', () => {
    it('acepta 40 metas en metas_institucionales_previas y 40 elementos en elementos_plan', () => {
      const sampleMeta = {
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Aprobación',
        meta: 'Aprobar al 85% de los estudiantes',
        linea_base: '',
        estrategia: '',
        responsable: '',
        entregable: '',
        periodo: '',
      };

      const sampleElemento: PmcPlanElement = {
        tipo: 'meta',
        texto_original: 'Aprobar al 85% de los alumnos de primer semestre',
        texto_normalizado: 'Aprobar al 85% de los alumnos de primer semestre mediante tutorías',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Aprobación',
        responsable: 'Academia de matemáticas',
        periodo: '2026-2027',
        requiere_revision: false,
      };

      const payload = {
        metas_institucionales_previas: Array.from({ length: 40 }, () => ({ ...sampleMeta })),
        elementos_plan: Array.from({ length: 40 }, () => ({ ...sampleElemento })),
      };

      const result = PmcPreviousExtractSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metas_institucionales_previas).toHaveLength(40);
        expect(result.data.elementos_plan).toHaveLength(40);
      }
    });

    it('rechaza cuando elementos_plan contiene 201 elementos (> 200 cap)', () => {
      const sampleElemento: PmcPlanElement = {
        tipo: 'actividad',
        texto_original: 'Taller de lectura',
        texto_normalizado: 'Taller de lectura',
        categoria: 'Desarrollo académico y aprendizaje',
        tema: 'Lectura',
        responsable: '',
        periodo: '',
        requiere_revision: false,
      };

      const payload = {
        elementos_plan: Array.from({ length: 201 }, () => ({ ...sampleElemento })),
      };

      const result = PmcPreviousExtractSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('acepta hasta 200 elementos_plan y 100 metas_institucionales_previas', () => {
      const sampleElemento: PmcPlanElement = {
        tipo: 'otro',
        texto_original: 'Reunión de academia',
        texto_normalizado: 'Reunión de academia',
        categoria: '',
        tema: '',
        responsable: '',
        periodo: '',
        requiere_revision: false,
      };

      const payload = {
        elementos_plan: Array.from({ length: 200 }, () => ({ ...sampleElemento })),
        metas_institucionales_previas: Array.from({ length: 100 }, () => ({
          categoria: '',
          tema: '',
          meta: 'Meta X',
          linea_base: '',
          estrategia: '',
          responsable: '',
          entregable: '',
          periodo: '',
        })),
      };

      const result = PmcPreviousExtractSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  // ── TEST (ii): Invariante numérico ────────────────────────────────────────
  describe('(ii) validateNormalizedText invariante numérico (Cero fabricación B-001)', () => {
    it('rechaza normalización que pierde un porcentaje (%)', () => {
      const original = 'Lograr que el 70% de los alumnos aprueben el semestre 2026-2027';
      const normalizado = 'Lograr que la mayoría de los alumnos aprueben el semestre 2026-2027';

      const validation = validateNormalizedText(original, normalizado);
      expect(validation.ok).toBe(false);
      expect(validation.faltantes).toContain('70%');
    });

    it('rechaza normalización que modifica o pierde un año o número', () => {
      const original = 'Alcanzar una matrícula de 350 estudiantes en el ciclo 2025-2026';
      const normalizado = 'Alcanzar una matrícula incrementada en el ciclo escolar';

      const validation = validateNormalizedText(original, normalizado);
      expect(validation.ok).toBe(false);
      expect(validation.faltantes).toContain('350');
      expect(validation.faltantes).toContain('2025');
      expect(validation.faltantes).toContain('2026');
    });

    it('acepta normalización que preserva todas las cifras y porcentajes, tolerando espacios', () => {
      const original = 'Disminuir en 5.5 % la reprobación del 25 % al 19.5% de alumnos';
      const normalizado = 'Reducir en 5.5% la tasa de reprobación escolar, pasando del 25% al 19.5% durante el ciclo';

      const validation = validateNormalizedText(original, normalizado);
      expect(validation.ok).toBe(true);
      expect(validation.faltantes).toHaveLength(0);
    });

    it('acepta textos descriptivos sin números', () => {
      const original = 'Organizar círculos de lectura semanales con docentes y estudiantes';
      const normalizado = 'Implementar círculos comunitarios de lectura semanales con el colectivo docente';

      const validation = validateNormalizedText(original, normalizado);
      expect(validation.ok).toBe(true);
      expect(validation.faltantes).toHaveLength(0);
    });
  });

  // ── TEST (iii): Derivación de elementos_plan a metas_institucionales_previas
  describe('(iii) deriveMetasPreviasFromElementos', () => {
    it('deriva metas_institucionales_previas filtrando tipo=meta y asociando estrategias/actividades', () => {
      const elementos: PmcPlanElement[] = [
        {
          tipo: 'meta',
          texto_original: 'Lograr que el 80% apruebe',
          texto_normalizado: 'Aprobar al 80% de los alumnos de primer semestre en Puebla',
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Aprobación',
          responsable: 'Academia General',
          periodo: '2026-2027',
          requiere_revision: false,
        },
        {
          tipo: 'actividad',
          texto_original: 'Impartir asesorías sabatinas',
          texto_normalizado: 'Impartir asesorías sabatinas de regularización',
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Aprobación',
          responsable: 'Docentes de matemáticas',
          periodo: 'Sábados',
          requiere_revision: false,
        },
        {
          tipo: 'estrategia',
          texto_original: 'Tutoría entre pares',
          texto_normalizado: 'Programa de tutorías entre pares en el aula',
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Aprobación',
          responsable: '',
          periodo: '',
          requiere_revision: false,
        },
        {
          tipo: 'meta',
          texto_original: 'Reducir el abandono a 2%',
          texto_normalizado: 'Reducir el abandono escolar al 2% en bachillerato',
          categoria: 'Gestión y administración escolar',
          tema: 'Permanencia',
          responsable: 'Dirección',
          periodo: 'Anual',
          requiere_revision: false,
        },
      ];

      const derived = deriveMetasPreviasFromElementos(elementos);

      expect(derived).toHaveLength(2);
      expect(derived[0].meta).toBe('Aprobar al 80% de los alumnos de primer semestre en Puebla');
      expect(derived[0].categoria).toBe('Desarrollo académico y aprendizaje');
      expect(derived[0].responsable).toBe('Academia General');
      // Las actividades y estrategias del mismo tema se agrupan en estrategia
      expect(derived[0].estrategia).toContain('Impartir asesorías sabatinas de regularización');
      expect(derived[0].estrategia).toContain('Programa de tutorías entre pares en el aula');

      expect(derived[1].meta).toBe('Reducir el abandono escolar al 2% en bachillerato');
      expect(derived[1].estrategia).toBe('');
    });

    it('usa metas existentes si elementos_plan no contiene ninguna meta', () => {
      const existing = [
        {
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Matemáticas',
          meta: 'Meta legacy existente',
          linea_base: '',
          estrategia: '',
          responsable: 'Profesor X',
          entregable: '',
          periodo: '2025',
        },
      ];

      const derived = deriveMetasPreviasFromElementos([], existing);
      expect(derived).toEqual(existing);
    });

    it('H-185: preserva linea_base, entregable y estrategia de existingMetas al derivar', () => {
      const elementos: PmcPlanElement[] = [
        {
          tipo: 'meta',
          texto_original: 'Lograr que el 85% apruebe el ciclo escolar',
          texto_normalizado: 'Aprobar al 85% de los alumnos de bachillerato general',
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Aprobación',
          responsable: 'Academia de Matemáticas',
          periodo: '2026-2027',
          requiere_revision: false,
        },
      ];

      const existingMetas = [
        {
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Aprobación',
          meta: 'Lograr que el 85% apruebe el ciclo escolar',
          linea_base: 'Diagnóstico 2024: Aprobación previa del 78%',
          estrategia: 'Estrategia institucional acordada en CTE',
          responsable: 'Academia General',
          entregable: 'Listas de calificaciones y reportes bimestrales',
          periodo: '2026-2027',
        },
      ];

      const derived = deriveMetasPreviasFromElementos(elementos, existingMetas);

      expect(derived).toHaveLength(1);
      expect(derived[0].meta).toBe('Aprobar al 85% de los alumnos de bachillerato general');
      expect(derived[0].linea_base).toBe('Diagnóstico 2024: Aprobación previa del 78%');
      expect(derived[0].entregable).toBe('Listas de calificaciones y reportes bimestrales');
      expect(derived[0].estrategia).toBe('Estrategia institucional acordada en CTE');
    });

    it('deriveElementosFromMetasPrevias genera elementos_plan sintéticos a partir de metas legacy', () => {
      const existing = [
        {
          categoria: 'Desarrollo socioemocional y prevención de la violencia en la escuela',
          tema: 'Convivencia',
          meta: 'Fomentar la cultura de paz con 3 talleres anuales',
          linea_base: '',
          estrategia: 'Charlas semanales',
          responsable: 'Comité de Convivencia',
          entregable: '',
          periodo: '2026',
        },
      ];

      const elements = deriveElementosFromMetasPrevias(existing);
      expect(elements).toHaveLength(1);
      expect(elements[0].tipo).toBe('meta');
      expect(elements[0].texto_original).toBe('Fomentar la cultura de paz con 3 talleres anuales');
      expect(elements[0].texto_normalizado).toBe('Fomentar la cultura de paz con 3 talleres anuales');
      expect(elements[0].categoria).toBe('Desarrollo socioemocional y prevención de la violencia en la escuela');
    });
  });

  // ── TEST (iv): Cobertura parcial ──────────────────────────────────────────
  describe('(iv) calculatePmcCoverage cobertura completa y parcial', () => {
    it('marca parcial: true cuando detectados > extraidos en metas', () => {
      const totales = { metas: 35, actividades: 10 };
      const coverage = calculatePmcCoverage(totales, 3, 10);

      expect(coverage.parcial).toBe(true);
      expect(coverage.detectados).toBe(35);
      expect(coverage.extraidos).toBe(3);
      expect(coverage.detalles?.metas.parcial).toBe(true);
      expect(coverage.detalles?.actividades.parcial).toBe(false);
    });

    it('marca parcial: true cuando detectados > extraidos en actividades', () => {
      const totales = { metas: 15, actividades: 25 };
      const coverage = calculatePmcCoverage(totales, 15, 12);

      expect(coverage.parcial).toBe(true);
      expect(coverage.detalles?.metas.parcial).toBe(false);
      expect(coverage.detalles?.actividades.parcial).toBe(true);
    });

    it('marca parcial: false cuando se extrajeron todas o más de las detectadas', () => {
      const totales = { metas: 10, actividades: 5 };
      const coverage = calculatePmcCoverage(totales, 12, 6);

      expect(coverage.parcial).toBe(false);
      expect(coverage.detalles?.metas.parcial).toBe(false);
      expect(coverage.detalles?.actividades.parcial).toBe(false);
    });

    it('maneja totales nulos o indefinidos sin marcar parcial falso', () => {
      const coverage = calculatePmcCoverage(undefined, 8, 4);

      expect(coverage.parcial).toBe(false);
      expect(coverage.detectados).toBeNull();
      expect(coverage.extraidos).toBe(8);
    });
  });
});
