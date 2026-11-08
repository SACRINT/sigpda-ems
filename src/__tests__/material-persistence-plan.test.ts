import { describe, expect, it } from 'vitest';
import {
  buildMaterialPersistencePlan,
  collectOmittedFromReview,
  type BuildMaterialPersistencePlanInput,
} from '@/lib/guide-engine/material-persistence-plan';
import type { ExtractedBlockMaterials, PlanDeClaseDerivado } from '@/lib/guide-engine/material-extractor';
import type { MaterialReviewReport, MaterialType } from '@/lib/guide-engine/material-review';

const ALL_STREAMS: MaterialType[] = [
  'lesson_plan',
  'student_guide',
  'rubric',
  'checklist',
  'answer_key',
  'didactic_material',
  'recovery_cards',
  'deck',
  'infographic',
  'visual_asset',
];

function buildReview(overrides: Partial<Record<MaterialType, boolean>> = {}): MaterialReviewReport {
  const byMaterial = {} as MaterialReviewReport['byMaterial'];
  for (const type of ALL_STREAMS) {
    byMaterial[type] = { ok: overrides[type] ?? true, issues: [] };
  }
  return { ok: true, score: 100, issues: [], errors: [], warnings: [], byMaterial };
}

function buildPlan(session: number): PlanDeClaseDerivado {
  return {
    numeroSesion: session,
    duracionMinutos: 50,
    tituloSesion: `Sesión ${session}: Tema ${session}`,
    propósitoOMeta: `Propósito ${session}`,
    transversalidad: `Transversalidad ${session}`,
    apertura: {
      actividadDocente: 'Docente abre',
      actividadEstudiante: 'Estudiante abre',
      saberesPrevios: 'Saberes previos',
      tiempoMinutos: 10,
    },
    desarrollo: {
      actividadDocente: 'Docente desarrolla',
      actividadEstudiante: 'Estudiante desarrolla',
      metodologiaActiva: 'Aprendizaje basado en retos',
      recursosDidacticos: 'Recursos',
      tiempoMinutos: 30,
    },
    cierre: {
      actividadDocente: 'Docente cierra',
      actividadEstudiante: 'Estudiante cierra',
      evaluacionFormativa: 'Evaluación',
      metacognicion: 'Metacognición',
      productoEsperado: 'Producto',
      tiempoMinutos: 10,
    },
    instrumentoEvaluacion: 'Rúbrica',
  };
}

function buildExtracted(overrides: Partial<ExtractedBlockMaterials> = {}): ExtractedBlockMaterials {
  return {
    metadata: {
      extractedAt: new Date().toISOString(),
      blockIndex: 0,
      blockName: 'Bloque 1',
      totalPlanesClase: 1,
      subjectName: 'UAC',
      schoolName: 'Escuela',
      executionTimeMs: 0,
    },
    planesDeClase: [],
    guiaDelBloque: '',
    solucionarioDocente: '',
    instrumentosEvaluacion: '',
    materialDidactico: '',
    fichasTrabajo: '',
    quiz: [],
    ...overrides,
  };
}

function buildInput(overrides: Partial<BuildMaterialPersistencePlanInput> = {}): BuildMaterialPersistencePlanInput {
  const plans = overrides.plans ?? [buildPlan(1)];
  const planMarkdownBySession =
    overrides.planMarkdownBySession ??
    new Map(plans.map((plan) => [plan.numeroSesion, `# Plan de Clase ${plan.numeroSesion}`]));
  return {
    review: buildReview(),
    extracted: buildExtracted(),
    plans,
    blockNum: 1,
    blockTitle: 'Bloque 1',
    rubricContent: '',
    checklistContent: '',
    planMarkdownBySession,
    validVisuals: [],
    omittedVisualMissions: [],
    ...overrides,
  };
}

describe('material-persistence-plan — invariantes de no destrucción', () => {
  it('no borra visuales cuando no hay ningún visual válido resuelto', () => {
    const plan = buildMaterialPersistencePlan(
      buildInput({ extracted: buildExtracted({ materialDidactico: 'Material didáctico válido' }) })
    );

    expect(plan.deletes).toContainEqual({ kind: 'material_non_visual' });
    expect(plan.deletes.some((d) => d.kind === 'visual_missions')).toBe(false);
    expect(plan.deletes.some((d) => d.kind === 'types' && d.types.includes('material'))).toBe(false);
    expect(plan.omitted).not.toContain('visual_asset');
  });

  it('reemplaza solo las misiones con visual válido y preserva las demás', () => {
    const plan = buildMaterialPersistencePlan(
      buildInput({
        validVisuals: [
          { missionNumber: 1, title: '[Visual] Recurso Gráfico Misión 1: A', payload: '{"type":"vector_svg","svg":"<svg/>"}' },
        ],
      })
    );

    expect(plan.deletes).toContainEqual({ kind: 'visual_missions', missionNumbers: [1] });
    expect(plan.deletes.some((d) => d.kind === 'material_non_visual')).toBe(false);
    expect(plan.inserts.filter((i) => i.title.startsWith('[Visual]'))).toHaveLength(1);
  });

  it('trata didáctico y visuales como streams independientes', () => {
    const plan = buildMaterialPersistencePlan(
      buildInput({
        extracted: buildExtracted({ materialDidactico: 'Material didáctico válido' }),
        validVisuals: [
          { missionNumber: 2, title: '[Visual] Recurso Gráfico Misión 2: B', payload: '{"type":"vector_svg","svg":"<svg/>"}' },
        ],
      })
    );

    expect(plan.deletes).toContainEqual({ kind: 'material_non_visual' });
    expect(plan.deletes).toContainEqual({ kind: 'visual_missions', missionNumbers: [2] });
    expect(plan.persistedStreams).toEqual(expect.arrayContaining(['didactic_material', 'visual_asset']));
  });

  it('marca visual_asset omitido solo cuando hay misiones visuales inválidas', () => {
    const plan = buildMaterialPersistencePlan(buildInput({ omittedVisualMissions: [3] }));
    expect(plan.omitted).toContain('visual_asset');
  });

  it('no borra ni reinserta un stream con error estructural', () => {
    const plan = buildMaterialPersistencePlan(
      buildInput({
        review: buildReview({ rubric: false }),
        rubricContent: 'Rúbrica con error',
      })
    );

    expect(plan.deletes.some((d) => d.kind === 'types' && d.types.includes('rubric'))).toBe(false);
    expect(plan.inserts.some((i) => i.extraType === 'rubric')).toBe(false);
    expect(plan.omitted).toContain('rubric');
  });

  it('collectOmittedFromReview reporta solo los streams con error', () => {
    const omitted = collectOmittedFromReview(buildReview({ checklist: false, answer_key: false }));
    expect(omitted).toEqual(['checklist', 'answer_key']);
  });
});
