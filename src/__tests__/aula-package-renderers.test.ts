import { describe, expect, it } from 'vitest';
import {
  generateExitTicketsPdf,
  generateFallbackPptx,
  generateFallbackRubricsPdf,
  generateWorksheetsPdf,
} from '@/lib/aula-package-renderers';
import type { GeneratedPlanningContent } from '@/types/planning';

const content = {
  sectionI: {
    teacherName: 'Docente de Prueba',
    uacName: 'Pensamiento Matemático II',
    semester: 2,
    groups: '2A',
    schoolYear: '2026-2027',
    applicationPeriod: 'Semestre par',
    estimatedSessions: '18',
    component: 'Formación básica',
    totalHours: 54,
    subsystem: 'Bachillerato General Estatal',
    schoolName: 'Plantel de Prueba',
    cct: '21EBH0001X',
  },
  sectionII: {
    purpose: 'Diseñar una solución comunitaria al desabasto de agua aplicando modelos matemáticos.',
    learningOutcomes: ['Resuelve problemas de volumen en contextos comunitarios.'],
    paecConnection: 'Proyecto PAEC de captación de agua pluvial.',
    activities: [{ name: 'Captación de agua', hours: 54, order: 1 }],
  },
  sectionIII: { fundamentalCurriculum: [], expandedCurriculum: [] },
  sectionIV: {
    note: '',
    activities: [
      {
        name: 'Diagnóstico del consumo de agua',
        hours: 18,
        methodology: 'ABP',
        apertura: { activities: 'Presentar el reto y recuperar saberes.', processes: 'Asombro', materials: 'Guía' },
        ejecucion: { activities: 'Medir el consumo y calcular volúmenes.', processes: 'Razonamiento', materials: 'Calculadora' },
        conclusion: { activities: 'Presentar resultados y reflexionar.', processes: 'Reflexión', materials: 'Rúbrica' },
        saberes: {
          saber: 'Concepto de volumen y proporcionalidad.',
          saberHacer: 'Cálculo de volúmenes de almacenamiento.',
          saberSer: 'Compromiso con el cuidado del agua.',
        },
      },
    ],
  },
  sectionV: {
    evaluations: [
      {
        type: 'Formativa',
        agent: 'Docente',
        moment: 'Formativa',
        evidence: 'Bitácora de cálculo',
        instrument: 'Rúbrica',
        percentage: 100,
      },
    ],
  },
  sectionVI: { studentMaterials: [], teacherMaterials: [], digital: [], spaces: [], references: [] },
  sectionVII: {},
} as GeneratedPlanningContent;

const meta = {
  uacName: 'Pensamiento Matemático II',
  teacherName: 'Docente de Prueba',
  schoolName: 'Plantel de Prueba',
  semester: 2,
  component: 'Formación básica',
  cct: '21EBH0001X',
};

describe('Aula package renderers', () => {
  it('genera tickets de salida en PDF', () => {
    const pdf = generateExitTicketsPdf(content, meta);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('genera fichas de trabajo en PDF', () => {
    const pdf = generateWorksheetsPdf(content, meta);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('genera rúbrica determinista en PDF', () => {
    const pdf = generateFallbackRubricsPdf(content, meta);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('genera presentación PPTX determinista', async () => {
    const pptx = await generateFallbackPptx(content, meta);
    expect(pptx.length).toBeGreaterThan(1000);
    expect(pptx.subarray(0, 2).toString()).toBe('PK');
  });
});
