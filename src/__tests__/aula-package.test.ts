import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/db', () => ({
  getAllBlockWorkbooks: vi.fn(async () => ({})),
}));

import { buildAulaPackageZip } from '@/lib/aula-package';
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
    schoolZone: 'Zona 004',
    municipality: 'Tepeaca',
  },
  sectionII: {
    purpose: 'Diseñar una solución comunitaria al desabasto de agua aplicando modelos matemáticos.',
    learningOutcomes: ['Resuelve problemas de volumen en contextos comunitarios.'],
    paecConnection: 'Proyecto PAEC de captación de agua pluvial con impacto comunitario.',
    activities: [{ name: 'Captación de agua', hours: 54, order: 1 }],
    retoSituado: {
      titulo: 'Captación de agua pluvial',
      verboInfinitivo: 'Diseñar',
      contextoLocal: 'en Tepeaca, Puebla',
      problematicaReal: 'para mitigar el desabasto de agua',
      propositoCurricular: 'aplicando Pensamiento Matemático II',
      retoCompleto: 'Diseñar un sistema de captación pluvial en Tepeaca, Puebla aplicando Pensamiento Matemático II.',
    },
    diagnosticoSituado3D: {
      dimensionTerritorial: 'Zona con baja disponibilidad de agua y transporte limitado.',
      dimensionPraxisJuvenil: 'Estudiantes trabajadores con saberes empíricos sobre el agua.',
      dimensionAulaEdiems: 'Línea base con oportunidades en razonamiento matemático.',
    },
  },
  sectionIII: {
    fundamentalCurriculum: [{ area: 'Ciencias Sociales', description: 'Territorio y ciudadanía.' }],
    expandedCurriculum: [],
  },
  sectionIV: {
    note: 'Secuencia articulada con el reto.',
    activities: [
      {
        name: 'Diagnóstico del consumo de agua',
        hours: 54,
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

const planning = {
  id: '11111111-1111-4111-8111-111111111111',
  teacher_id: '22222222-2222-4222-8222-222222222222',
  uac_name: 'Pensamiento Matemático II',
  semester: 2,
  component: 'Formación básica',
  curriculum_name: 'Bachillerato General Estatal',
  paec_context: null,
  extracted_data: { schoolName: 'Plantel de Prueba', cct: '21EBH0001X' },
  content_json: content,
  sequence_json: null,
  workbooks_json: null,
  metodologia_activa: 'ABP',
  status: 'generated',
  created_at: new Date(),
  updated_at: new Date(),
} as unknown as Parameters<typeof buildAulaPackageZip>[0];

describe('buildAulaPackageZip', () => {
  it('empaqueta los recursos base y manifiesto en un ZIP', async () => {
    const result = await buildAulaPackageZip(planning, []);
    expect(result.buffer.length).toBeGreaterThan(1000);
    expect(result.fileName.endsWith('.zip')).toBe(true);

    const zip = await JSZip.loadAsync(result.buffer);
    const names = Object.keys(zip.files);
    expect(names.some((name) => name.startsWith('01_Planeacion_Didactica_Semestral_') && name.endsWith('.pdf'))).toBe(true);
    expect(names.some((name) => name.startsWith('01_Planeacion_Didactica_Semestral_') && name.endsWith('.docx'))).toBe(true);
    expect(names.some((name) => name.startsWith('05_Fichas_de_Trabajo_'))).toBe(true);
    expect(names.some((name) => name.startsWith('07_Instrumentos_de_Evaluacion_'))).toBe(true);
    expect(names.some((name) => name.startsWith('08_Presentacion_'))).toBe(true);
    expect(names.some((name) => name.startsWith('09_Tickets_de_Salida_'))).toBe(true);
    expect(names).toContain('LEEME_PAQUETE_AULA.txt');
  }, 30000);
});
