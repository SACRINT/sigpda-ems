import { describe, expect, it } from 'vitest';
import { validateAnexo12 } from '@/lib/planning/anexo12-validator';

function validPlanning() {
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
      teacherMaterials: ['Guía de práctica'],
      spaces: ['Taller'],
      digital: ['Simulador'],
      references: ['Norma NOM-017-STPS'],
    },
    sectionVII: {},
  };
}

describe('validateAnexo12 — gate determinista USICAMM', () => {
  it('aprueba una planeación laboral completa de 3 actividades y 54 h', () => {
    const report = validateAnexo12(validPlanning(), {
      uacName: 'Coloca elementos constructivos básicos de una vivienda',
      semester: 5,
      component: 'laboral',
    });
    expect(report.ok).toBe(true);
    expect(report.criticalFailures).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it('falla si falta la bitácora 50-20-30', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    delete (planning.sectionV as { bitacora502030?: unknown }).bitacora502030;
    const report = validateAnexo12(planning, { component: 'laboral' });
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.id === 'v_bitacora')?.ok).toBe(false);
  });

  it('falla si las ponderaciones no suman 100%', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    (planning.sectionV.evaluations[0] as { percentage: number }).percentage = 10;
    const report = validateAnexo12(planning, { component: 'laboral' });
    expect(report.checks.find((c) => c.id === 'v_ponderacion_100')?.ok).toBe(false);
  });

  it('falla si hay recursos de búsqueda genérica', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    planning.sectionVI.references.push('https://www.google.com/search?q=materiales');
    const report = validateAnexo12(planning, { component: 'laboral' });
    expect(report.checks.find((c) => c.id === 'x_recursos_curados')?.ok).toBe(false);
  });

  it('falla si una formación laboral no tiene exactamente 3 Actividades Clave', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    planning.sectionIV.activities = planning.sectionIV.activities.slice(0, 2);
    const report = validateAnexo12(planning, { component: 'laboral' });
    expect(report.checks.find((c) => c.id === 'iv_laboral_3_actividades')?.ok).toBe(false);
  });

  it('falla con placeholders sin completar', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    planning.sectionII.purpose = '[completar]';
    const report = validateAnexo12(planning, { component: 'laboral' });
    expect(report.checks.find((c) => c.id === 'x_placeholders')?.ok).toBe(false);
    expect(report.checks.find((c) => c.id === 'ii_proposito')?.ok).toBe(false);
  });

  it('BT modular: 4 actividades y 120 h no generan falso crítico laboral', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    planning.sectionI.subsystem = 'Bachillerato Tecnológico (BT)';
    planning.sectionI.totalHours = 120;
    planning.sectionI.totalHoursWeekly = 6;
    planning.sectionIV.activities = [1, 2, 3, 4].map((n) => ({
      ...planning.sectionIV.activities[0],
      name: `Actividad ${n}`,
      hours: 30,
    }));

    const report = validateAnexo12(planning, {
      component: 'laboral',
      subsystem: 'Bachillerato Tecnológico (BT)',
    });

    const laboral = report.checks.find((c) => c.id === 'iv_laboral_3_actividades');
    expect(laboral?.ok).toBe(true);
    expect(laboral?.severity).toBe('warning');
    expect(report.checks.find((c) => c.id === 'iv_bt_carga_modular')?.ok).toBe(true);
    expect(report.checks.find((c) => c.id === 'iv_laboral_54h')).toBeUndefined();
    expect(report.ok).toBe(true);
  });

  it('BT modular: 2 actividades son advertencia, no crítico laboral', () => {
    const planning = validPlanning() as ReturnType<typeof validPlanning>;
    planning.sectionI.subsystem = 'Bachillerato Tecnológico (BT)';
    planning.sectionI.totalHours = 120;
    planning.sectionI.totalHoursWeekly = 6;
    planning.sectionIV.activities = planning.sectionIV.activities.slice(0, 2).map((a) => ({
      ...a,
      hours: 60,
    }));

    const report = validateAnexo12(planning, {
      component: 'laboral',
      subsystem: 'Bachillerato Tecnológico (BT)',
    });

    const laboral = report.checks.find((c) => c.id === 'iv_laboral_3_actividades');
    expect(laboral?.ok).toBe(false);
    expect(laboral?.severity).toBe('warning');
  });
});
