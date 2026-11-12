import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAndPersistPlanningContent } from '@/lib/planning/planning-persistence';

vi.mock('@/lib/db', () => ({
  updatePlanningContent: vi.fn(),
}));

import { updatePlanningContent } from '@/lib/db';

function createValidPlanningFixture() {
  const phases = {
    apertura: { activities: 'Actividad de apertura con problema real y saberes previos.', processes: 'asombro', materials: 'cuaderno' },
    ejecucion: { activities: 'Actividad de desarrollo con procedimiento técnico y registro.', processes: 'indagacion', materials: 'herramientas' },
    conclusion: { activities: 'Actividad de cierre con evidencia y reflexión.', processes: 'transferencia', materials: 'rúbrica' },
  };
  return {
    sectionI: {
      uacName: 'Coloca elementos constructivos básicos de una vivienda',
      teacherName: 'Docente Titular',
      schoolName: 'Plantel Héroes de la Patria',
      semester: 5,
      component: 'laboral',
      subsystem: 'Bachillerato General Estatal (BGE)',
      groups: '5°A',
      totalHours: 54,
      totalHoursWeekly: 3,
      applicationPeriod: 'Agosto 2026 – Enero 2027',
    },
    sectionII: {
      purpose: 'Construir elementos básicos de una vivienda aplicando normas técnicas y seguridad.',
      learningOutcomes: ['Aplica procedimientos constructivos con tolerancias verificables.'],
      paecConnection: 'Vinculación con el problema comunitario de espacios recreativos seguros.',
      activities: [{ name: 'A1' }, { name: 'A2' }, { name: 'A3' }],
      retoSituado: {
        verboInfinitivo: 'Construir',
        contextoLocal: 'Comunidad de Venustiano Carranza, Puebla',
        problematicaReal: 'Falta de espacios recreativos seguros para jóvenes.',
        propositoCurricular: 'Aplicar el contenido formativo de la UAC en un producto real.',
        validacion: { score: 4 },
      },
      diagnosticoSituado3D: {
        dimensionTerritorial: 'Comunidad rural con dispersión y transporte limitado.',
        dimensionPraxisJuvenil: 'Estudiantes que combinan estudio y trabajo.',
        dimensionAulaEdiems: 'Línea base EDIEMS y barreras para el aprendizaje.',
      },
    },
    sectionIII: {
      fundamentalCurriculum: [{ area: 'Matemáticas', description: 'Cálculo de materiales.' }],
      expandedCurriculum: [],
      productoIntegrador: 'Murete y banca de concreto para el circuito comunitario.',
    },
    sectionIV: {
      activities: [1, 2, 3].map((n) => ({
        name: `Actividad ${n}`,
        hours: 18,
        methodology: 'Aprendizaje Basado en Proyectos',
        ...phases,
        saberes: {
          saber: 'Normas y especificaciones de materiales.',
          saberHacer: 'Ejecuta el procedimiento con herramientas.',
          saberSer: 'Aplica EPP y trabaja colaborativamente.',
        },
      })),
      procesosPensamiento: [{ proceso: 'asombro' }, { proceso: 'indagacion' }, { proceso: 'transferencia' }],
    },
    sectionV: {
      evaluationAgreement: 'Acuerdo de acreditación firmado con el grupo y el docente.',
      evaluations: [
        { moment: 'Diagnóstica', agent: 'Heteroevaluación', evidence: 'Cuestionario diagnóstico', instrument: 'Lista de cotejo', percentage: 20 },
        { moment: 'Formativa', agent: 'Coevaluación', evidence: 'Bitácora de taller', instrument: 'Guía de observación', percentage: 30 },
        { moment: 'Sumativa', agent: 'Heteroevaluación', evidence: 'Producto integrador', instrument: 'Rúbrica analítica', percentage: 50 },
      ],
      bitacora502030: {
        uacName: 'Coloca elementos constructivos básicos de una vivienda',
        corteEvaluativo: 'Corte 1',
        criterioProceso50: 'Observación continua de participación y diálogo.',
        evidenciaColectiva20: 'Murete construido en equipo.',
        evidenciaIndividual30: 'Bitácora y ticket de salida.',
        ticketSalidaPregunta: '¿Qué tolerancia aplicaste y cómo la verificaste?',
        filasEstudiantes: [
          {
            no: 1,
            nombreEstudiante: 'Estudiante Uno',
            participativo: true,
            dialogante: true,
            cuestionador: false,
            apoyo: true,
            evidenciaColectivaCalificacion: 9,
            evidenciaIndividualCalificacion: 8,
            notasAcompanamiento: 'Cumple con el procedimiento y usa EPP.',
          },
        ],
      },
    },
    sectionVI: {
      studentMaterials: ['Cuaderno', 'EPP'],
      teacherMaterials: ['Guía', 'Rúbrica'],
      facilities: ['Taller'],
      equipment: ['Herramientas'],
      bibliography: ['Norma Oficial Mexicana'],
    },
    sectionVII: {
      endorsements: {
        teacher: { name: 'Docente Titular', signed: true },
        director: { name: 'Director del Plantel', signed: false },
      },
    },
  };
}

describe('Gate Pedagógico Dual y Persistencia (Fase A.2)', () => {
  const mockPlanningId = '11111111-2222-3333-4444-555555555555';
  const mockTeacherId = '66666666-7777-8888-9999-000000000000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite persistencia y adjunta anexo12Audit y dbepaAudit cuando los datos son válidos', async () => {
    vi.mocked(updatePlanningContent).mockResolvedValueOnce({ id: mockPlanningId, status: 'generated' } as any);

    const validPlanning = createValidPlanningFixture();

    const result = await validateAndPersistPlanningContent(
      mockPlanningId,
      mockTeacherId,
      validPlanning,
      { isNewOrStrictMode: true }
    );

    expect(result.success).toBe(true);
    expect(result.anexo12Report).toBeDefined();
    expect(result.anexo12Report.criticalFailures).toBe(0);
    expect(result.dbepaReport).toBeDefined();
    expect(updatePlanningContent).toHaveBeenCalledTimes(1);

    const savedContent = vi.mocked(updatePlanningContent).mock.calls[0][2] as any;
    expect(savedContent.anexo12Audit).toBeDefined();
    expect(savedContent.anexo12Audit.criticalFailures).toBe(0);
    expect(savedContent.dbepaAudit).toBeDefined();
  });

  it('bloquea (fail-closed) en modo estricto si existen fallas críticas sin mutar la BD', async () => {
    const invalidContent = {
      sectionI: {},
      sectionII: {},
      sectionIV: {},
    };

    const result = await validateAndPersistPlanningContent(
      mockPlanningId,
      mockTeacherId,
      invalidContent,
      { isNewOrStrictMode: true }
    );

    expect(result.success).toBe(false);
    expect(result.anexo12Report.criticalFailures).toBeGreaterThan(0);
    expect(result.error).toContain('inconsistencias críticas');
    expect(updatePlanningContent).not.toHaveBeenCalled();
  });

  it('permite modo permisivo (DUA / backfill) persistiendo reportes sin abortar aunque existan fallas', async () => {
    vi.mocked(updatePlanningContent).mockResolvedValueOnce({ id: mockPlanningId, status: 'generated' } as any);

    const imperfectContent = {
      sectionI: { subjectName: 'Dibujo Técnico' },
      sectionII: {},
    };

    const result = await validateAndPersistPlanningContent(
      mockPlanningId,
      mockTeacherId,
      imperfectContent,
      { isNewOrStrictMode: false } // Modo permisivo para DUA o backfill
    );

    expect(result.success).toBe(true);
    expect(updatePlanningContent).toHaveBeenCalledTimes(1);
    const savedContent = vi.mocked(updatePlanningContent).mock.calls[0][2] as any;
    expect(savedContent.anexo12Audit).toBeDefined();
    expect(savedContent.dbepaAudit).toBeDefined();
  });
});
