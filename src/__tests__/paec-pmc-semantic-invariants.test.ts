import { describe, expect, it } from 'vitest';
import {
  auditPaecPlan,
  auditPmcProject,
  computeRecommendedReprobacionMeta,
  detectCrossFodaPresence,
  isMetaCreaaCompliant,
  resolveBajasPercentage,
  resolveExpectedMccemsLabel,
  type PaecPlanRowLike,
  type PaecUacCatalogMeta,
  type PmcProjectLike,
} from '@/lib/qa/paec-pmc-semantic-qa';

function make16WeekPaecPlan(overrides: Partial<PaecPlanRowLike>[] = []): PaecPlanRowLike[] {
  const rows: PaecPlanRowLike[] = [];
  for (let w = 1; w <= 16; w++) {
    rows.push({
      phase: w <= 5 ? 'Fase 1' : w <= 11 ? 'Fase 2' : 'Fase 3',
      activity:
        w === 16
          ? 'Feria comunitaria y entrega del Manual Técnico de Transferencia con evaluación final de resultados.'
          : `Diseño y aplicación de protocolo técnico número ${w} para diagnóstico comunitario en la localidad.`,
      uac: w % 2 === 1 ? 'Ciencias Sociales I' : 'Pensamiento Matemático III',
      progression: `Propósito Formativo ${(w % 4) + 1}: Analiza problemas de su entorno con rigor metodológico.`,
      strategy: 'Aprendizaje Basado en Proyectos (ABP)',
      week: `Semana ${w}`,
      responsibles: 'Estudiantes y Docente Titular',
      evaluationInstrument: `Rúbrica analítica de desempeño semana ${w}`,
      ...(overrides[w - 1] ?? {}),
    });
  }
  return rows;
}

const SAMPLE_CATALOG: PaecUacCatalogMeta[] = [
  { uacName: 'Ciencias Sociales I', semester: 1, component: 'fundamental' },
  { uacName: 'Ciencias Sociales II', semester: 2, component: 'fundamental' },
  { uacName: 'Pensamiento Matemático III', semester: 3, component: 'fundamental' },
  { uacName: 'Conciencia Histórica II. México Durante el Expansionismo Capitalista', semester: 5, component: 'fundamental' },
  { uacName: 'Temas Selectos de Matemáticas V', semester: 5, component: 'fundamental' },
  { uacName: 'Elabora productos lácteos por métodos tradicionales', semester: 4, component: 'competencias_laborales' },
];

function makeValidPmc(): PmcProjectLike {
  return {
    school_name: 'Bachillerato General Oficial Benito Juárez',
    school_cct: '21EBH0123A',
    indicadores_academicos: {
      aprobacion_ant: 83.1,
      aprobacion_meta: 88.1,
      reprobacion_ant: 11.6,
      reprobacion_meta: 6.6,
      abandono_ant: 5.2,
      abandono_meta: 3.9,
      et_ant: 93.2,
      et_meta: 98.2,
      matricula: 192,
      bajas: 10,
      totalAlumnosF11: 192,
      porcentajes: { aprobados: 83.1, reprobados: 11.6, bajas: 5.2 },
      _calc: {
        et: { valor: 93.2, formula: '(179/192)*100', fuentes: ['911_inicio', '911_fin'] },
      },
    },
    foda: {
      fortalezas: '• Planta docente completa\n• Trabajo colegiado constante\n• Alta vinculación comunitaria',
      debilidades: '• Rezago en cálculo inicial\n• Infraestructura limitada\n• Falta de tutoría psicológica',
      oportunidades: '• Convenios con universidades\n• Apoyo de junta auxiliar\n• Talleres de centro de salud',
      amenazas: '• Traslados largos\n• Migración juvenil\n• Riesgo de abandono económico',
      cruzado: {
        fo: 'Aprovechar la planta docente y convenios universitarios para mentorías.',
        do: 'Atender el rezago en cálculo mediante talleres con instituciones aliadas.',
        fa: 'Usar el trabajo colegiado para alertas tempranas ante abandono económico.',
        da: 'Mitigar traslados largos con guías impresas y acompañamiento focalizado.',
      },
    },
    diagnostico_generado: {
      presentacion: 'P'.repeat(240),
      contexto: 'C'.repeat(240),
      priorizacion: 'R'.repeat(240),
      analisis_indicadores: 'A'.repeat(240),
      sintesis_foda: 'S'.repeat(240),
    },
    plan_accion: {
      metas_institucionales: [
        {
          categoria: 'Desarrollo académico y aprendizaje',
          meta: 'Incrementar en 5% la tasa de aprobación de los estudiantes de 1° a 6° semestre mediante tutorías académicas focalizadas durante el ciclo escolar 2026-2027.',
          estrategia: 'Tutorías académicas por academia con cortes bimestrales y seguimiento F11.',
          entregable: 'Informe de análisis de resultados F11 y bitácora de tutorías',
          periodo_inicio: '08/2026',
          periodo_fin: '06/2027',
        },
      ],
      metas_personales: [
        {
          nombre: 'Ana López Pérez',
          cargo: 'Docente frente a grupo',
          meta_individual: 'Alcanzar 90% de aprobación en Pensamiento Matemático I mediante asesorías semanales.',
          entregable: 'Bitácora de asesorías y concentrado F11',
        },
      ],
    },
  };
}

describe('PAEC / PMC Semantic QA Invariants (Fase A)', () => {
  describe('MCCEMS data-driven nomenclature by ciclo + semester + component', () => {
    it('returns Actividad Clave for Formación Laboral regardless of cycle', () => {
      expect(resolveExpectedMccemsLabel(2, 'competencias_laborales', '2026-2027')).toBe('Actividad Clave');
      expect(resolveExpectedMccemsLabel(5, 'Formación Laboral Básica', '2027-2028')).toBe('Actividad Clave');
    });

    it('returns Propósito Formativo for 1–4 and Progresión for 5–6 in cycles < 2027-2028', () => {
      expect(resolveExpectedMccemsLabel(1, 'fundamental', '2026-2027')).toBe('Propósito Formativo');
      expect(resolveExpectedMccemsLabel(4, 'fundamental', '2026-2027')).toBe('Propósito Formativo');
      expect(resolveExpectedMccemsLabel(5, 'fundamental', '2026-2027')).toBe('Progresión');
      expect(resolveExpectedMccemsLabel(6, 'fundamental', '2026-2027')).toBe('Progresión');
    });

    it('returns Propósito Formativo for ALL fundamental semesters in cycles >= 2027-2028', () => {
      expect(resolveExpectedMccemsLabel(5, 'fundamental', '2027-2028')).toBe('Propósito Formativo');
      expect(resolveExpectedMccemsLabel(6, 'fundamental', '2028-2029')).toBe('Propósito Formativo');
    });
  });

  describe('PAEC Plan Operativo invariants', () => {
    it('passes a clean 16-week Semestre A plan with operational nominalizations', () => {
      const rows = make16WeekPaecPlan();
      const res = auditPaecPlan(rows, SAMPLE_CATALOG, {
        parity: 1,
        cicloEscolar: '2026-2027',
        strict: true,
      });
      expect(res.passed).toBe(true);
      expect(res.fails).toEqual([]);
      expect(res.metrics.noActionCount).toBe(0);
    });

    it('excludes shared Semana 16 closing activity from exact duplicate FAIL, but FAILS non-S16 duplicates', () => {
      const rows = make16WeekPaecPlan();
      // Add 2 extra Semana 16 rows with identical closing text (legitimate shared event)
      rows.push(
        { ...rows[15], uac: 'Pensamiento Matemático III' },
        { ...rows[15], uac: 'Ciencias Sociales I' }
      );
      const resSharedS16 = auditPaecPlan(rows, SAMPLE_CATALOG, { parity: 1, cicloEscolar: '2026-2027' });
      expect(resSharedS16.passed).toBe(true);

      // Duplicate a Semana 4 activity -> must FAIL
      rows.push({ ...rows[3], week: 'Semana 5' });
      const resDup = auditPaecPlan(rows, SAMPLE_CATALOG, { parity: 1, cicloEscolar: '2026-2027' });
      expect(resDup.passed).toBe(false);
      expect(resDup.fails.some((f) => f.includes('duplicado exacto'))).toBe(true);
    });

    it('FAILS when an even-semester UAC leaks into Semestre A, but ALLOWS sem-5 Conciencia Histórica II in Semestre A', () => {
      const validSem5 = make16WeekPaecPlan([
        {
          uac: 'Conciencia Histórica II',
          progression: 'Progresión 2: Analiza el expansionismo capitalista en México.',
        },
      ]);
      const resValid = auditPaecPlan(validSem5, SAMPLE_CATALOG, { parity: 1, cicloEscolar: '2026-2027' });
      expect(resValid.passed).toBe(true);

      const leakedSem2 = make16WeekPaecPlan([
        { uac: 'Ciencias Sociales II' },
      ]);
      const resLeak = auditPaecPlan(leakedSem2, SAMPLE_CATALOG, { parity: 1, cicloEscolar: '2026-2027' });
      expect(resLeak.passed).toBe(false);
      expect(resLeak.fails.some((f) => f.includes('paridad rota') && f.includes('Ciencias Sociales II'))).toBe(true);
    });

    it('escalates raw Contenidos dump and Progresión in sem 1-4 to FAIL in strict mode', () => {
      const rows = make16WeekPaecPlan([
        {
          uac: 'Ciencias Sociales I',
          progression: 'Progresión 1: Analiza conflictos locales. [Contenidos: ' + 'x'.repeat(280) + ']',
        },
      ]);
      const baseline = auditPaecPlan(rows, SAMPLE_CATALOG, { parity: 1, strict: false });
      expect(baseline.passed).toBe(true);
      expect(baseline.warns.length).toBeGreaterThanOrEqual(2);

      const strict = auditPaecPlan(rows, SAMPLE_CATALOG, { parity: 1, strict: true });
      expect(strict.passed).toBe(false);
      expect(strict.fails.some((f) => f.includes('progression cruda'))).toBe(true);
      expect(strict.fails.some((f) => f.includes('Propósito Formativo'))).toBe(true);
    });
  });

  describe('PMC indicators, F11 reprobación math, taxonomy, and FODA invariants', () => {
    it('computes F11-consistent reprobacion_meta discounting bajas_pct and never worsening reprobacion_ant', () => {
      // Moisés Sáenz Garza case: aprob_ant=87.5, rep_ant=0, bajas=12.5, aprob_meta=92.5 -> rep_meta MUST be 0 (not 7.5!)
      expect(
        computeRecommendedReprobacionMeta({ aprobacionMeta: 92.5, reprobacionAnt: 0, bajasPct: 12.5 })
      ).toBe(0);

      // Héroes de la Patria case: aprob_ant=83.1, rep_ant=11.6, bajas=5.2, aprob_meta=88.1 -> 100 - 88.1 - 5.2 = 6.7 <= 11.6
      expect(
        computeRecommendedReprobacionMeta({ aprobacionMeta: 88.1, reprobacionAnt: 11.6, bajasPct: 5.2 })
      ).toBe(6.7);

      // Without bajasPct, clamps to <= reprobacionAnt
      expect(
        computeRecommendedReprobacionMeta({ aprobacionMeta: 85, reprobacionAnt: 10 })
      ).toBe(10);
    });

    it('resolves bajas percentage without confusing raw student count for %', () => {
      expect(resolveBajasPercentage({ bajas: 10, totalAlumnosF11: 192 })).toBe(5.2);
      expect(resolveBajasPercentage({ bajas: 10, porcentajes: { bajas: 5.3 } })).toBe(5.3);
    });

    it('passes a clean canonical PMC in strict mode and allows manual PMC without _calc', () => {
      const clean = makeValidPmc();
      expect(auditPmcProject(clean, { strict: true }).passed).toBe(true);

      const manual = makeValidPmc();
      delete (manual.indicadores_academicos as Record<string, unknown>)._calc;
      const resManual = auditPmcProject(manual, { strict: true });
      expect(resManual.passed).toBe(true);
    });

    it('FAILS on inverted reprobacion_meta (0->7.5 or 11.6->11.9) and non-canonical categories', () => {
      const bad = makeValidPmc();
      (bad.indicadores_academicos as Record<string, unknown>).reprobacion_ant = 0;
      (bad.indicadores_academicos as Record<string, unknown>).reprobacion_meta = 7.5;
      ((bad.plan_accion as Record<string, unknown>).metas_institucionales as Record<string, unknown>[])[0].categoria = '2';

      const res = auditPmcProject(bad, { strict: false });
      expect(res.passed).toBe(false);
      expect(res.fails.some((f) => f.includes('reprobacion_meta (7.5%) > reprobacion_ant (0%)'))).toBe(true);
      expect(res.fails.some((f) => f.includes('categoría no canónica "2"'))).toBe(true);
    });

    it('detects cross-FODA in structured object and narrative sintesis_foda and validates CREAA', () => {
      const pmc = makeValidPmc();
      expect(detectCrossFodaPresence(pmc)).toEqual({ fo: true, do: true, fa: true, da: true });
      const meta = ((pmc.plan_accion as Record<string, unknown>).metas_institucionales as Record<string, unknown>[])[0];
      expect(isMetaCreaaCompliant(meta)).toBe(true);
    });
  });
});
