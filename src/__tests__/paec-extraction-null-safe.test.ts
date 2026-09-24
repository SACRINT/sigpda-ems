import { describe, it, expect } from 'vitest';
import { PaecPreviousExtractSchema } from '@/lib/prompts/paec-extraction';
import { PmcPlanAccionSchema, PaecExtractedDocSchema } from '@/lib/ai-schemas';

describe('A-01: Contratos null-safe en PAEC y schemas LLM-facing', () => {
  it('PaecPreviousExtractSchema tolera null en los 14 campos migrados y normaliza a cadena vacía', () => {
    const rawPayloadWithNulls = {
      projectName: null,
      problemStatement: null,
      cycleType: 'A',
      schoolType: 'general',
      school: {
        schoolName: null,
        cct: null,
        municipality: null,
        locality: null,
        schoolZone: null,
        directorName: null,
        supervisorName: null,
      },
      community: {
        context: null,
        location: null,
        problematics: null,
        economicActivities: null,
        culturalAspects: null,
      },
      selectedLaboral: [],
      selectedFfe: [],
    };

    const result = PaecPreviousExtractSchema.safeParse(rawPayloadWithNulls);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.projectName).toBe('');
      expect(result.data.problemStatement).toBe('');
      expect(result.data.school?.schoolName).toBe('');
      expect(result.data.school?.cct).toBe('');
      expect(result.data.school?.municipality).toBe('');
      expect(result.data.school?.locality).toBe('');
      expect(result.data.school?.schoolZone).toBe('');
      expect(result.data.school?.directorName).toBe('');
      expect(result.data.school?.supervisorName).toBe('');
      expect(result.data.community?.context).toBe('');
      expect(result.data.community?.location).toBe('');
      expect(result.data.community?.problematics).toBe('');
      expect(result.data.community?.economicActivities).toBe('');
      expect(result.data.community?.culturalAspects).toBe('');
    }
  });

  it('PmcPlanAccionSchema tolera null en metas_personales y normaliza a cadena vacía', () => {
    const rawPayload = {
      metas_institucionales: [
        {
          categoria: 'Académica',
          tema: 'Aprovechamiento escolar',
          diagnostico_meta: 'Bajo rendimiento en matemáticas',
          meta: 'Elevar el aprovechamiento a 8.5 en el ciclo escolar',
          estrategia: 'Tutorías personalizadas y talleres vespertinos',
          entregable: 'Reporte semestral de calificaciones',
        },
      ],
      metas_personales: [
        {
          nombre: 'Juan Pérez',
          cargo: 'Docente',
          categoria: null,
          tema: null,
          meta_individual: null,
          estrategia: null,
          entregable: null,
          periodo: null,
        },
      ],
    };

    const result = PmcPlanAccionSchema.safeParse(rawPayload);
    expect(result.success).toBe(true);

    if (result.success) {
      const personal = result.data.metas_personales[0];
      expect(personal.categoria).toBe('');
      expect(personal.tema).toBe('');
      expect(personal.meta_individual).toBe('');
      expect(personal.estrategia).toBe('');
      expect(personal.entregable).toBe('');
      expect(personal.periodo).toBe('');
    }
  });

  it('PaecExtractedDocSchema tolera null en planOperativo y normaliza a cadena vacía', () => {
    const rawPayload = {
      projectName: null,
      planOperativo: [
        {
          asignatura: null,
          actividad: null,
          propositoFormativo: null,
          estrategiaDidactica: null,
          semana: null,
          fase: null,
          progresion: null,
        },
      ],
    };

    const result = PaecExtractedDocSchema.safeParse(rawPayload);
    expect(result.success).toBe(true);

    if (result.success) {
      const op = result.data.planOperativo[0];
      expect(op.asignatura).toBe('');
      expect(op.actividad).toBe('');
      expect(op.propositoFormativo).toBe('');
      expect(op.estrategiaDidactica).toBe('');
      expect(op.semana).toBe('');
      expect(op.fase).toBe('');
      expect(op.progresion).toBe('');
    }
  });
});
