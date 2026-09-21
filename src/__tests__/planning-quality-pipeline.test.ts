import { describe, it, expect } from 'vitest';
import {
  validateRetoSituado44,
  validateTresSaberes,
  validateCoherenciaMetodologica,
  validateHorasPorCorte,
  evaluatePlanningQuality,
} from '@/lib/planning/quality-pipeline';
import type { Planning, RetoSituado, KeyActivityPlan, SecuenciaBloque } from '@/types/planning';

describe('PlanningQualityPipeline', () => {
  describe('validateRetoSituado44', () => {
    it('valida un Reto Situado que cumple 4/4 criterios de DBEPA', () => {
      const retoValido: RetoSituado = {
        titulo: 'Reto de Captación de Agua',
        verboInfinitivo: 'Diseñar',
        contextoLocal: 'en el municipio de Tepeaca, Puebla',
        problematicaReal: 'para mitigar el desabasto y contaminación del agua potable en el plantel',
        propositoCurricular: 'aplicando los modelos matemáticos y cálculo de volúmenes de Pensamiento Matemático II',
        retoCompleto: 'Diseñar un sistema de captación pluvial en Tepeaca, Puebla para mitigar el desabasto de agua aplicando Pensamiento Matemático II.',
      };

      const result = validateRetoSituado44(retoValido, { uacName: 'Pensamiento Matemático II', municipality: 'Tepeaca' });
      expect(result.isValid).toBe(true);
      expect(result.score).toBe(4);
      expect(result.feedback.length).toBe(0);
    });

    it('detecta cuando el Reto Situado es nulo o vacío', () => {
      const result = validateRetoSituado44(null);
      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback[0]).toContain('No se ha definido un Reto Situado');
    });

    it('detecta verbos pasivos prohibidos como Aprender o Memorizar', () => {
      const retoInvalido: RetoSituado = {
        titulo: 'Aprender Matemáticas',
        verboInfinitivo: 'Aprender',
        contextoLocal: 'en Puebla',
        problematicaReal: 'problemas de agua',
        propositoCurricular: 'para pasar el examen',
        retoCompleto: 'Aprender las fórmulas de matemáticas en Puebla para resolver problemas.',
      };

      const result = validateRetoSituado44(retoInvalido);
      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(4);
      expect(result.details.hasInfinitiveVerb).toBe(false);
    });
  });

  describe('validateTresSaberes', () => {
    it('valida cobertura completa cuando las actividades definen Saber, Saber Hacer y Saber Ser', () => {
      const activities: KeyActivityPlan[] = [
        {
          name: 'Levantamiento técnico de instalaciones',
          hours: 18,
          methodology: 'ABP',
          apertura: { activities: 'Encuadre', processes: 'Análisis', materials: 'Guía' },
          ejecucion: { activities: 'Taller', processes: 'Medición', materials: 'Flexómetro' },
          conclusion: { activities: 'Cierre', processes: 'Evaluación', materials: 'Rúbrica' },
          saberes: {
            saber: 'Normativa NOM-001-SEDE y conceptos de instalaciones eléctricas residenciales.',
            saberHacer: 'Manejo seguro de multímetro, trazo de planos unifilares y cableado en maqueta.',
            saberSer: 'Cumplimiento estricto de normas de seguridad industrial y trabajo colaborativo.',
          },
        },
      ];

      const result = validateTresSaberes(null, null, activities);
      expect(result.isValid).toBe(true);
      expect(result.coverageScore).toBe(3);
      expect(result.hasSaber).toBe(true);
      expect(result.hasSaberHacer).toBe(true);
      expect(result.hasSaberSer).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('detecta ausencia de Saber Ser cuando solo hay conceptual y procedimental', () => {
      const activities: KeyActivityPlan[] = [
        {
          name: 'Cálculo de derivadas',
          hours: 18,
          methodology: 'ABP',
          apertura: { activities: 'A', processes: 'P', materials: 'M' },
          ejecucion: { activities: 'E', processes: 'P', materials: 'M' },
          conclusion: { activities: 'C', processes: 'P', materials: 'M' },
          saberes: {
            saber: 'Concepto de razón de cambio y reglas de derivación.',
            saberHacer: 'Resolución algebraica de funciones polinomiales en pizarrón.',
            saberSer: '',
          },
        },
      ];

      const result = validateTresSaberes(null, null, activities);
      expect(result.isValid).toBe(false);
      expect(result.coverageScore).toBe(2);
      expect(result.hasSaberSer).toBe(false);
      expect(result.missing).toContain('Saber Ser');
    });

    it('detecta saberes a partir de secuencias didácticas detalladas', () => {
      const sequenceJson: Record<number, SecuenciaBloque> = {
        1: {
          blockIndex: 1,
          blockName: 'Bloque 1',
          hours: 18,
          sessions: [
            {
              sessionNum: 1,
              totalSessions: 6,
              phase: 'Apertura',
              title: 'Fundamento teórico y marco conceptual de circuitos',
              teachingActivity: 'Explica el fundamento teórico y la normativa NOM',
              learningActivity: 'Investiga conceptos clave',
              evidence: 'Mapa conceptual',
            },
            {
              sessionNum: 2,
              totalSessions: 6,
              phase: 'Desarrollo',
              title: 'Práctica en taller de mediciones',
              teachingActivity: 'Supervisa la práctica en taller y ejecución técnica',
              learningActivity: 'Realiza mediciones con multímetro',
              evidence: 'Reporte técnico',
            },
            {
              sessionNum: 3,
              totalSessions: 6,
              phase: 'Cierre',
              title: 'Seguridad industrial y coevaluación',
              teachingActivity: 'Evalúa la seguridad industrial y la ética',
              learningActivity: 'Aplica lista de cotejo de trabajo en equipo y convivencia',
              evidence: 'Rúbrica actitudinal',
            },
          ],
        },
      };

      const result = validateTresSaberes(sequenceJson, null, null);
      expect(result.isValid).toBe(true);
      expect(result.coverageScore).toBe(3);
    });
  });

  describe('validateCoherenciaMetodologica', () => {
    it('valida ABP con sesiones activas y palabras clave congruentes', () => {
      const sequenceJson: Record<number, SecuenciaBloque> = {
        1: {
          blockIndex: 1,
          blockName: 'Fase 1 del Proyecto',
          hours: 18,
          sessions: [
            {
              sessionNum: 1,
              totalSessions: 6,
              phase: 'Apertura',
              title: 'Pregunta detonadora del reto comunitario',
              teachingActivity: 'Facilita la delimitación del problema comunitario y el reto de indagación',
              learningActivity: 'Construye en equipo la propuesta del prototipo y producto integrador',
              evidence: 'Plan de proyecto',
            },
          ],
        },
      };

      const result = validateCoherenciaMetodologica('abp', sequenceJson);
      expect(result.isValid).toBe(true);
      expect(result.isRecognized).toBe(true);
      expect(result.hasPassivePractices).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('penaliza severamente prácticas pasivas prohibidas como dictado o copiado', () => {
      const sequenceJson: Record<number, SecuenciaBloque> = {
        1: {
          blockIndex: 1,
          blockName: 'Clase Tradicional',
          hours: 18,
          sessions: [
            {
              sessionNum: 1,
              totalSessions: 6,
              phase: 'Desarrollo',
              title: 'Dictado de conceptos',
              teachingActivity: 'Realiza dictado y pide transcribir del libro',
              learningActivity: 'Copiar del libro las páginas 40 a 50',
              evidence: 'Apuntes',
            },
          ],
        },
      };

      const result = validateCoherenciaMetodologica('abp', sequenceJson);
      expect(result.isValid).toBe(false);
      expect(result.hasPassivePractices).toBe(true);
      expect(result.feedback.some((f) => f.includes('prácticas pasivas'))).toBe(true);
    });

    it('rechaza cuando no se especifica metodología', () => {
      const result = validateCoherenciaMetodologica(null);
      expect(result.isValid).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback[0]).toContain('No se ha especificado una metodología');
    });
  });

  describe('validateHorasPorCorte', () => {
    it('valida Pensamiento Matemático con 72h distribuidas en [24, 24, 24]', () => {
      const result = validateHorasPorCorte('Pensamiento Matemático II', 72, {
        horasPorCorte: [24, 24, 24],
      });

      expect(result.isValid).toBe(true);
      expect(result.expectedWeeklyHours).toBe(4);
      expect(result.expectedTotalHours).toBe(72);
      expect(result.expectedHoursPerCorte).toBe(24);
      expect(result.discrepancy).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('valida Lengua y Comunicación con 54h distribuidas en [18, 18, 18]', () => {
      const result = validateHorasPorCorte('Lengua y Comunicación I', 54, {
        horasPorCorte: [18, 18, 18],
      });

      expect(result.isValid).toBe(true);
      expect(result.expectedWeeklyHours).toBe(3);
      expect(result.expectedTotalHours).toBe(54);
      expect(result.expectedHoursPerCorte).toBe(18);
      expect(result.discrepancy).toBe(0);
      expect(result.isBalanced).toBe(true);
    });

    it('detecta discrepancia cuando las horas totales no coinciden con la carga oficial', () => {
      const result = validateHorasPorCorte('Pensamiento Matemático II', 45, {
        horasPorCorte: [15, 15, 15],
      });

      expect(result.isValid).toBe(false);
      expect(result.discrepancy).toBe(-27); // 45 - 72
      expect(result.feedback.some((f) => f.includes('Discrepancia horaria'))).toBe(true);
    });

    it('detecta desbalance si los cortes no tienen la cuota exacta de 6 semanas de mediación', () => {
      const result = validateHorasPorCorte('Pensamiento Matemático II', 72, {
        horasPorCorte: [10, 30, 32],
      });

      expect(result.isValid).toBe(false);
      expect(result.discrepancy).toBe(0);
      expect(result.isBalanced).toBe(false);
      expect(result.feedback.some((f) => f.includes('Desbalance en cortes'))).toBe(true);
    });

    it('reconoce UACs con o sin acentos de forma insensible a diacríticos', () => {
      const conAcento = validateHorasPorCorte('Pensamiento Matemático I', 72);
      const sinAcento = validateHorasPorCorte('pensamiento matematico i', 72);
      expect(conAcento.expectedWeeklyHours).toBe(4);
      expect(sinAcento.expectedWeeklyHours).toBe(4);
    });
  });

  describe('evaluatePlanningQuality', () => {
    it('otorga estatus excelente/aprobada a una planeación completa y alineada', () => {
      const mockPlanning: Partial<Planning> = {
        uacName: 'Pensamiento Matemático II',
        metodologiaActiva: 'steam',
        contentJson: {
          sectionI: {
            teacherName: 'Profesor Test',
            uacName: 'Pensamiento Matemático II',
            semester: 2,
            groups: '2° A',
            schoolYear: '2026-2027',
            applicationPeriod: 'Feb-Jul 2026',
            estimatedSessions: '72',
            component: 'fundamental',
            totalHours: 72,
            subsystem: 'bge',
            schoolName: 'Bachillerato Emiliano Zapata',
            metodologiaActiva: 'steam',
          },
          sectionII: {
            purpose: 'Modelado matemático de volúmenes',
            learningOutcomes: ['Calcula volúmenes'],
            paecConnection: 'Optimización de agua',
            activities: [],
            retoSituado: {
              titulo: 'Reto de Captación de Agua Pluvial',
              verboInfinitivo: 'Diseñar',
              contextoLocal: 'en el municipio de Tepeaca, Puebla',
              problematicaReal: 'para mitigar el desabasto crítico de agua potable en el plantel escolar',
              propositoCurricular: 'aplicando el modelado matemático y optimización de volúmenes de Pensamiento Matemático II',
              retoCompleto: 'Diseñar un sistema sustentable en Tepeaca, Puebla para mitigar el desabasto de agua aplicando Pensamiento Matemático II.',
            },
          },
          sectionIII: { fundamentalCurriculum: [], expandedCurriculum: [] },
          sectionIV: {
            note: 'Secuencia didáctica STEAM',
            activities: [
              {
                name: 'Modelado experimental en laboratorio',
                hours: 24,
                methodology: 'STEAM',
                order: 1,
                corte: 'Corte 1',
                apertura: { activities: 'Incógnita empírica', processes: 'Análisis', materials: 'Guía' },
                ejecucion: { activities: 'Experimentación con prototipo y recolección de datos', processes: 'Medición', materials: 'Sensor' },
                conclusion: { activities: 'Defensa técnica', processes: 'Evaluación', materials: 'Rúbrica' },
                saberes: {
                  saber: 'Geometría analítica y ecuaciones de segundo grado.',
                  saberHacer: 'Construcción y calibración del prototipo a escala en laboratorio.',
                  saberSer: 'Responsabilidad y compromiso con la sustentabilidad comunitaria.',
                },
              } as KeyActivityPlan & { corte: string },
              {
                name: 'Optimización matemática',
                hours: 24,
                methodology: 'STEAM',
                order: 2,
                corte: 'Corte 2',
                apertura: { activities: 'A', processes: 'P', materials: 'M' },
                ejecucion: { activities: 'Análisis estadístico y modelado', processes: 'P', materials: 'M' },
                conclusion: { activities: 'C', processes: 'P', materials: 'M' },
                saberes: {
                  saber: 'Cálculo diferencial aplicado.',
                  saberHacer: 'Mediciones y pruebas piloto.',
                  saberSer: 'Ética científica.',
                },
              } as KeyActivityPlan & { corte: string },
              {
                name: 'Exposición y transferencia',
                hours: 24,
                methodology: 'STEAM',
                order: 3,
                corte: 'Corte 3',
                apertura: { activities: 'A', processes: 'P', materials: 'M' },
                ejecucion: { activities: 'Exposición técnica y validación comunitaria', processes: 'P', materials: 'M' },
                conclusion: { activities: 'C', processes: 'P', materials: 'M' },
                saberes: {
                  saber: 'Modelado matemático integral.',
                  saberHacer: 'Instalación y monitoreo.',
                  saberSer: 'Colaboración social.',
                },
              } as KeyActivityPlan & { corte: string },
            ],
          },
          sectionV: { evaluations: [] },
          sectionVI: { studentMaterials: [], teacherMaterials: [], digital: [], spaces: [], references: [] },
          sectionVII: {},
        },
      };

      const report = evaluatePlanningQuality(mockPlanning);
      expect(report.score).toBeGreaterThanOrEqual(90);
      expect(report.status).toBe('excelente');
      expect(report.checks.retoSituado.isValid).toBe(true);
      expect(report.checks.tresSaberes.isValid).toBe(true);
      expect(report.checks.coherenciaMetodologica.isValid).toBe(true);
      expect(report.checks.horasPorCorte.isValid).toBe(true);
    });

    it('clasifica como requiere_ajustes o insuficiente cuando faltan componentes esenciales', () => {
      const mockPlanningIncompleta: Partial<Planning> = {
        uacName: 'Pensamiento Matemático II',
        contentJson: {
          sectionI: {
            teacherName: '',
            uacName: 'Pensamiento Matemático II',
            semester: 2,
            groups: '',
            schoolYear: '',
            applicationPeriod: '',
            estimatedSessions: '20',
            component: 'fundamental',
            totalHours: 20, // 20 vs 72h
            subsystem: 'bge',
          },
          sectionII: {
            purpose: '',
            learningOutcomes: [],
            paecConnection: '',
            activities: [],
          },
          sectionIII: { fundamentalCurriculum: [], expandedCurriculum: [] },
          sectionIV: { note: '', activities: [] },
          sectionV: { evaluations: [] },
          sectionVI: { studentMaterials: [], teacherMaterials: [], digital: [], spaces: [], references: [] },
          sectionVII: {},
        },
      };

      const report = evaluatePlanningQuality(mockPlanningIncompleta);
      expect(report.score).toBeLessThan(50);
      expect(['requiere_ajustes', 'insuficiente']).toContain(report.status);
      expect(report.feedback.length).toBeGreaterThan(0);
    });
  });
});
