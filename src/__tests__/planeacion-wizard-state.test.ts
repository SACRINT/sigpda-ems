import { describe, it, expect } from 'vitest';
import {
  applyUacSelection,
  isSameUacSelection,
  preserveContextForNewUac,
  type PlaneacionWizardDraft,
  type WizardUacSelection,
} from '@/lib/planeacion-wizard-state';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';

const selection: WizardUacSelection = {
  uacName: 'Pensamiento Matematico I',
  semester: 3,
  component: 'fundamental',
  subsystem: 'bge',
  curriculumName: 'Curriculo vigente',
};

const context: TeacherContext = {
  teacherName: 'Docente de prueba',
  schoolName: 'Plantel de prueba',
  cct: '21EBH0001X',
  locality: 'Centro',
  municipality: 'Puebla',
  state: 'Puebla',
  region: 'Puebla',
  subsystem: 'bge',
  groupInfo: '3-A',
  applicationPeriod: 'Ago-Dic 2026',
  paecProjectName: 'Proyecto comunitario',
  paecObjective: 'Mejorar el entorno escolar',
  paecProblem: 'Falta de areas verdes',
  paecOperationalActivity: {
    asignatura: 'Pensamiento Matematico I',
    actividad: 'Medir espacios disponibles',
    propositoFormativo: 'Aplicar mediciones',
    isPrescheduled: false,
  },
  usePaecActivity: true,
  schoolResources: 'Patio y herramientas',
  studentContext: 'Estudiantes del tercer semestre',
  metodologiaActiva: 'abp',
};

const extracted: ExtractedPdfData = {
  uacName: 'Pensamiento Matematico I',
  learningOutcome: 'Resolver problemas del entorno',
  totalHours: 54,
  activities: [{ order: 1, name: 'Diagnostico', hours: 18 }],
  evidences: ['Reporte de diagnostico'],
  parseConfidence: 'high',
};

function draft(overrides: Partial<PlaneacionWizardDraft> = {}): PlaneacionWizardDraft {
  return {
    step: 1,
    uacSelection: selection,
    extractedData: extracted,
    context,
    planningId: 'planning-1',
    ...overrides,
  };
}

describe('planeacion-wizard-state', () => {
  describe('isSameUacSelection', () => {
    it('returns false when there is no previous selection', () => {
      expect(isSameUacSelection(null, selection)).toBe(false);
    });

    it('compares UAC, semester, component and subsystem', () => {
      expect(isSameUacSelection(selection, { ...selection })).toBe(true);
      expect(isSameUacSelection(selection, { ...selection, uacName: 'Otra UAC' })).toBe(false);
      expect(isSameUacSelection(selection, { ...selection, semester: 5 })).toBe(false);
      expect(isSameUacSelection(selection, { ...selection, component: 'laboral' })).toBe(false);
      expect(isSameUacSelection(selection, { ...selection, subsystem: 'tecnologico' })).toBe(false);
    });

    it('ignores curriculumName and normalizes whitespace', () => {
      expect(isSameUacSelection(selection, {
        ...selection,
        uacName: '  Pensamiento   Matematico I ',
        curriculumName: 'Otro plan',
      })).toBe(true);
    });
  });

  describe('applyUacSelection', () => {
    it('preserves edits, context and planning id when the UAC does not change', () => {
      const nextData = { ...extracted, learningOutcome: 'Dato inicial distinto' };

      const result = applyUacSelection(
        draft({ step: 4 }),
        { ...selection, curriculumName: 'Otro nombre de curriculo' },
        nextData
      );

      expect(result.step).toBe(2);
      expect(result.uacSelection?.curriculumName).toBe('Otro nombre de curriculo');
      expect(result.extractedData).toBe(extracted);
      expect(result.context).toBe(context);
      expect(result.planningId).toBe('planning-1');
    });

    it('uses initial data for a same-UAC selection when there is no previous extraction', () => {
      const result = applyUacSelection(
        draft({ extractedData: null, planningId: null }),
        selection,
        extracted
      );

      expect(result.extractedData).toBe(extracted);
    });

    it('resets UAC-dependent data when the UAC changes', () => {
      const nextSelection = { ...selection, uacName: 'Ciencias Sociales I' };
      const nextData = { ...extracted, uacName: 'Ciencias Sociales I' };

      const result = applyUacSelection(draft({ step: 4 }), nextSelection, nextData);

      expect(result.step).toBe(2);
      expect(result.uacSelection).toEqual(nextSelection);
      expect(result.extractedData).toBe(nextData);
      expect(result.planningId).toBeNull();
    });

    it('preserves school, teacher and PAEC context but resets methodology and activity when the UAC changes', () => {
      const nextSelection = { ...selection, uacName: 'Ciencias Sociales I' };

      const result = applyUacSelection(draft(), nextSelection, extracted);

      expect(result.context).toEqual({
        ...context,
        metodologiaActiva: undefined,
        paecOperationalActivity: null,
        usePaecActivity: false,
      });
      expect(result.context?.teacherName).toBe(context.teacherName);
      expect(result.context?.schoolName).toBe(context.schoolName);
      expect(result.context?.paecProjectName).toBe(context.paecProjectName);
      expect(result.context?.paecProblem).toBe(context.paecProblem);
      expect(result.context?.studentContext).toBe(context.studentContext);
    });
  });

  describe('preserveContextForNewUac', () => {
    it('returns null when there is no previous context', () => {
      expect(preserveContextForNewUac(null, selection)).toBeNull();
    });

    it('uses the new subsystem while preserving the rest of the context', () => {
      const nextSelection = { ...selection, subsystem: 'tecnologico' };

      const result = preserveContextForNewUac(context, nextSelection);

      expect(result?.subsystem).toBe('tecnologico');
      expect(result?.groupInfo).toBe(context.groupInfo);
      expect(result?.metodologiaActiva).toBeUndefined();
      expect(result?.paecOperationalActivity).toBeNull();
      expect(result?.usePaecActivity).toBe(false);
    });
  });
});
