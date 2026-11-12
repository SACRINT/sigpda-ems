import { describe, expect, it } from 'vitest';
import { evaluateDBEPA } from '@/lib/planning/dbepa-quality-gate';
import { buildDeterministicDUA } from '@/lib/planning/dua-generator';
import type { GeneratedPlanningContent } from '@/types/planning';

function buildCompleteContent(): GeneratedPlanningContent {
  const activityBase = {
    methodology: 'ABP',
    apertura: {
      activities: 'Presentar el reto situado y recuperar saberes previos del contexto comunitario.',
      processes: 'Asombro y problematización',
      materials: 'Guía de trabajo',
    },
    ejecucion: {
      activities: 'Desarrollar el producto del reto con acompañamiento docente y trabajo colaborativo.',
      processes: 'Conceptualización y razonamiento',
      materials: 'Material del taller',
    },
    conclusion: {
      activities: 'Presentar evidencias, coevaluar y reflexionar sobre la transferencia del aprendizaje.',
      processes: 'Reflexión y transferencia',
      materials: 'Rúbrica',
    },
    saberes: {
      saber: 'Conceptos y normativa aplicables al reto comunitario.',
      saberHacer: 'Procedimientos técnicos para construir el producto solicitado.',
      saberSer: 'Colaboración, ética y compromiso con la comunidad.',
    },
  };

  return {
    sectionI: {
      teacherName: 'Docente de Prueba',
      directorName: 'Director de Prueba',
      supervisorName: 'Supervisor de Prueba',
      uacName: 'Pensamiento Matemático II',
      semester: 2,
      groups: '2A, 2B',
      schoolYear: '2026-2027',
      applicationPeriod: 'Semestre par',
      estimatedSessions: '18',
      component: 'Formación básica',
      totalHours: 54,
      totalHoursWeekly: 3,
      subsystem: 'Bachillerato General Estatal',
      schoolName: 'Plantel de Prueba',
      cct: '21EBH0001X',
      schoolZone: 'Zona 004',
      municipality: 'Tepeaca',
      paecOperationalActivity: {
        actividad: 'Captación de agua pluvial',
      } as GeneratedPlanningContent['sectionI']['paecOperationalActivity'],
    },
    sectionII: {
      purpose:
        'Diseñar una solución comunitaria al desabasto de agua aplicando modelos matemáticos y cálculo de volúmenes.',
      learningOutcomes: [
        'Resuelve problemas de volumen y proporcionalidad en contextos comunitarios.',
      ],
      paecConnection:
        'Vinculación directa con el proyecto PAEC de captación de agua pluvial y cuidado del entorno escolar.',
      activities: [
        {
          name: 'Captación de agua pluvial',
          hours: 54,
          order: 1,
        },
      ],
      retoSituado: {
        titulo: 'Captación de agua pluvial',
        verboInfinitivo: 'Diseñar',
        contextoLocal: 'en el municipio de Tepeaca, Puebla',
        problematicaReal: 'para mitigar el desabasto de agua en el plantel',
        propositoCurricular:
          'aplicando modelos matemáticos y cálculo de volúmenes de Pensamiento Matemático II',
        retoCompleto:
          'Diseñar un sistema de captación pluvial en Tepeaca, Puebla para mitigar el desabasto de agua aplicando Pensamiento Matemático II.',
      },
      diagnosticoSituado3D: {
        dimensionTerritorial:
          'El plantel se ubica en una zona con baja disponibilidad de agua y transporte limitado.',
        dimensionPraxisJuvenil:
          'Estudiantes trabajadores que aportan saberes empíricos sobre el cuidado del agua.',
        dimensionAulaEdiems:
          'Línea base EDIEMS con oportunidades en razonamiento matemático y BAP visual.',
      },
    },
    sectionIII: {
      fundamentalCurriculum: [
        { area: 'Ciencias Sociales', description: 'Análisis del territorio y participación ciudadana.' },
      ],
      expandedCurriculum: [],
    },
    sectionIV: {
      note: 'Secuencia articulada con el reto situado.',
      activities: [
        {
          name: 'Diagnóstico del consumo de agua',
          hours: 18,
          ...activityBase,
        },
        {
          name: 'Diseño del sistema de captación',
          hours: 18,
          ...activityBase,
        },
        {
          name: 'Prototipo y presentación comunitaria',
          hours: 18,
          ...activityBase,
        },
      ],
    },
    sectionV: {
      evaluationAgreement: 'Evaluación formativa con retroalimentación permanente.',
      evaluations: [
        {
          type: 'Diagnóstica',
          agent: 'Docente',
          moment: 'Diagnóstico',
          evidence: 'Cuestionario de saberes previos',
          instrument: 'Cuestionario',
          percentage: 20,
        },
        {
          type: 'Formativa',
          agent: 'Docente y pares',
          moment: 'Formativa',
          evidence: 'Bitácora de avance del prototipo',
          instrument: 'Rúbrica',
          percentage: 40,
        },
        {
          type: 'Sumativa',
          agent: 'Docente',
          moment: 'Sumativa',
          evidence: 'Prototipo y presentación comunitaria',
          instrument: 'Lista de cotejo',
          percentage: 40,
        },
      ],
    },
    sectionVI: {
      studentMaterials: ['Cuaderno', 'Calculadora'],
      teacherMaterials: ['Guía didáctica'],
      digital: ['Hoja de cálculo'],
      spaces: ['Aula', 'Patio escolar'],
      references: ['Programa MCCEMS'],
    },
    sectionVII: {},
  };
}

describe('DBEPA Quality Gate', () => {
  it('marca en rojo una planeación vacía y evalúa 12 criterios', () => {
    const result = evaluateDBEPA(null);
    expect(result.total).toBe(12);
    expect(result.criteria).toHaveLength(12);
    expect(result.score).toBe(0);
    expect(result.semaforo).toBe('rojo');
  });

  it('marca en verde una planeación completa y consistente', () => {
    const result = evaluateDBEPA(buildCompleteContent(), {
      uacName: 'Pensamiento Matemático II',
      semester: 2,
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.semaforo).toBe('verde');
    expect(result.passed).toBeGreaterThanOrEqual(10);
  });

  it('detecta ponderaciones distintas de 100%', () => {
    const content = buildCompleteContent();
    content.sectionV.evaluations[0].percentage = 10;
    const result = evaluateDBEPA(content);
    const criterion = result.criteria.find((item) => item.id === 'evaluacion_integral');
    expect(criterion?.status).not.toBe('cumple');
  });
});

describe('DUA generator', () => {
  it('genera los cuatro ajustes predefinidos de forma determinista', () => {
    const content = buildCompleteContent();
    const result = buildDeterministicDUA(content);
    expect(result.fuente).toBe('determinista');
    expect(result.ajustes).toHaveLength(4);
    expect(result.ajustes.map((ajuste) => ajuste.categoria)).toEqual([
      'bap_sensorial',
      'bap_motriz',
      'ritmos_rezago',
      'sobresalientes',
    ]);
    expect(result.ajustes.every((ajuste) => ajuste.estrategias.length >= 2)).toBe(true);
  });

  it('respeta la selección de categorías solicitada', () => {
    const content = buildCompleteContent();
    const result = buildDeterministicDUA(content, ['bap_sensorial', 'sobresalientes']);
    expect(result.ajustes).toHaveLength(2);
    expect(result.ajustes.map((ajuste) => ajuste.categoria)).toEqual([
      'bap_sensorial',
      'sobresalientes',
    ]);
  });
});
