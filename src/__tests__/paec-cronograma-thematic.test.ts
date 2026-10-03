// src/__tests__/paec-cronograma-thematic.test.ts
/**
 * Test suite para H-313: Fases Cronograma 5 Columnas y Sincronización de Evaluadores
 * Verifica que el Cronograma mantenga 5 columnas oficiales con el título temático y periodo
 * fusionados en la primera columna, sincronizando PaecPaso4Schema, evaluateCriterio11 y C12/C13/C14.
 */

import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import { PaecPaso4Schema } from '@/lib/ai-schemas';
import { evaluateCriterio11 } from '@/lib/paec-quality-gate';
import { auditPaecProject } from '@/lib/paec-validator';
import { generatePaecDocx } from '@/lib/paec-docx-generator';
import { generatePaecPDF } from '@/lib/paec-pdf-generator';
import type { CronogramaRow, PaecProject } from '@/types/paec';

const canonical6Phases: CronogramaRow[] = [
  {
    phase: 'Fase 1: Diagnóstico Comunitario y Cartografía Social (Septiembre - Octubre)',
    objective: 'Levantar el diagnóstico de necesidades prioritarias con participación de vecinos y asamblea escolar.',
    macroActivities: 'Recorridos de campo, aplicación de cédulas diagnósticas y asamblea general comunitaria.',
    responsibleSubjects: 'Ciencias Sociales I, Humanidades I, Lengua y Comunicación I',
    semesterInvolved: 'Primer y Tercer Semestre',
  },
  {
    phase: 'Fase 2: Diseño de Prototipos y Articulación Pedagógica (Noviembre - Diciembre)',
    objective: 'Estructurar propuestas técnicas de solución sustentable vinculadas a las progresiones de aprendizaje.',
    macroActivities: 'Talleres de diseño, cálculo de insumos y elaboración de maquetas y prototipos escolares.',
    responsibleSubjects: 'Pensamiento Matemático I y III, La Materia y sus Interacciones',
    semesterInvolved: 'Todos los semestres',
  },
  {
    phase: 'Fase 3: Gestión Institucional y Acuerdos con Aliados (Enero - Febrero)',
    objective: 'Establecer convenios de colaboración y permisos con autoridades ejidales y municipales.',
    macroActivities: 'Mesas de diálogo, gestión de permisos y recolección de donaciones comunitarias.',
    responsibleSubjects: 'Cultura Digital I, Formación para el Trabajo, Tutorías',
    semesterInvolved: 'Segundo y Cuarto Semestre',
  },
  {
    phase: 'Fase 4: Ejecución Territorial e Intervención Situada (Marzo - Abril)',
    objective: 'Implementar las acciones de mejora en el espacio comunitario con brigadas estudiantiles.',
    macroActivities: 'Faenas colectivas de reforestación, instalación de contenedores y talleres vecinales.',
    responsibleSubjects: 'Conservación de la Energía, Ciencias Sociales II, Ética',
    semesterInvolved: 'Todos los semestres',
  },
  {
    phase: 'Fase 5: Monitoreo, Evaluación de Impacto y Rendición (Mayo)',
    objective: 'Medir los avances e indicadores de logro ambiental y formativo mediante encuestas territoriales.',
    macroActivities: 'Aplicación de encuestas de satisfacción, análisis estadístico y elaboración de memorias.',
    responsibleSubjects: 'Pensamiento Matemático II y IV, Conciencia Histórica',
    semesterInvolved: 'Segundo, Cuarto y Sexto Semestre',
  },
  {
    phase: 'Fase 6: Cierre, Feria Comunitaria y Transferencia (Junio)',
    objective: 'Socializar los resultados con la comunidad y transferir la custodia del proyecto a comités locales.',
    macroActivities: 'Feria comunitaria de ciencias y humanidades, entrega de reconocimientos y acta de custodia.',
    responsibleSubjects: 'Colegiado Docente Completo y Comunidad Escolar',
    semesterInvolved: 'Todos los semestres',
  },
];

describe('H-313: Cronograma en 5 Columnas y Sincronización de Evaluadores', () => {
  it('1. PaecPaso4Schema fusiona phaseTitle y period en la primera columna preservando 5 columnas', () => {
    const rawAiOutput = [
      {
        phase: 'Fase 1',
        phaseTitle: 'Diagnóstico Participativo de Campo',
        period: 'Septiembre - Octubre',
        objective: 'Identificar problemáticas hídricas en la colonia con apoyo vecinal.',
        macroActivities: 'Aplicación de entrevistas y mapeo de fugas en el cuadrante norte.',
        responsibleSubjects: 'Ciencias Sociales I',
        semesterInvolved: '1er semestre',
      },
      {
        phase: 'Fase 2: Diseño de Filtros Caseros',
        objective: 'Construir prototipos de biofiltros con grava y arena silica.',
        macroActivities: 'Pruebas de filtrado en laboratorio de ciencias.',
        responsibleSubjects: 'Química I',
        semesterInvolved: '1er semestre',
      },
      {
        phase: 'Fase 3: Campaña de Concientización',
        objective: 'Diseñar infografías sobre el uso responsable del agua.',
        macroActivities: 'Pegado de carteles en comercios y pláticas en primarias.',
        responsibleSubjects: 'Lengua y Comunicación I',
        semesterInvolved: '1er semestre',
      },
      {
        phase: 'Fase 4: Instalación de Filtros en Espacios Comunes',
        objective: 'Montar tres biofiltros comunitarios en el parque central.',
        macroActivities: 'Faena sabatina con el comité de agua potable.',
        responsibleSubjects: 'Física I',
        semesterInvolved: '3er semestre',
      },
    ];

    const parsed = PaecPaso4Schema.parse(rawAiOutput);
    expect(parsed.length).toBe(4);
    expect(parsed[0].phase).toBe('Fase 1: Diagnóstico Participativo de Campo (Septiembre - Octubre)');
    expect(parsed[0].objective).toBe('Identificar problemáticas hídricas en la colonia con apoyo vecinal.');
    expect(parsed[0].macroActivities).toBe('Aplicación de entrevistas y mapeo de fugas en el cuadrante norte.');
    expect(parsed[0].responsibleSubjects).toBe('Ciencias Sociales I');
    expect(parsed[0].semesterInvolved).toBe('1er semestre');
  });

  it('2. evaluateCriterio11 evalúa con 4/4 (Excelente) las 6 fases con 5 columnas y títulos temáticos', () => {
    const result = evaluateCriterio11(canonical6Phases);

    expect(result.id).toBe(11);
    expect(result.score).toBe(4);
    expect(result.status).toBe('pass');
    expect(result.evidenceFound).toContain('6/6 fases bimestrales con 5 columnas completas y títulos temáticos');
  });

  it('3. evaluateCriterio11 es tolerante a inputs con phaseTitle separado y los unifica sin penalizar', () => {
    const hybridPhases = canonical6Phases.map((p, idx) => ({
      ...p,
      phase: `Fase ${idx + 1}`,
      phaseTitle: `Título Temático ${idx + 1}`,
    })) as unknown as CronogramaRow[];

    const result = evaluateCriterio11(hybridPhases);

    expect(result.score).toBe(4);
    expect(result.status).toBe('pass');
  });

  it('4. auditPaecProject en paec-validator asigna 4/4 en C12, C13 y C14 reconociendo cronograma temático', () => {
    const mockProject = {
      fase2Cronograma: canonical6Phases,
    } as unknown as PaecProject;

    const audit = auditPaecProject(mockProject);
    const c12 = audit.criteria.find(c => c.id === 12);
    const c13 = audit.criteria.find(c => c.id === 13);
    const c14 = audit.criteria.find(c => c.id === 14);

    expect(c12).toBeDefined();
    expect(c12?.score).toBe(4);
    expect(c12?.status).toBe('pass');
    expect(c12?.evidenceFound).toContain('títulos temáticos situados');

    expect(c13).toBeDefined();
    expect(c13?.score).toBe(4);
    expect(c13?.status).toBe('pass');

    expect(c14).toBeDefined();
    expect(c14?.score).toBe(4);
    expect(c14?.status).toBe('pass');
  });

  it('5. DOCX y PDF renderizan las 5 columnas normativas con los títulos temáticos unificados', async () => {
    const project: PaecProject = {
      id: 'paec-thematic-crono-001',
      projectName: 'Proyecto Escuela y Comunidad de Prueba Temática',
      problemStatement: 'Problemática comunitaria para test de cronograma temático.',
      cycleType: 'annual',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      schoolContext: {
        schoolName: 'Bachillerato Oficial Vicente Guerrero',
        cct: '21EBH0100X',
        schoolZone: '005',
        municipality: 'Puebla',
        locality: 'Puebla',
        enrollment: '450',
        teacherCount: '22',
        schoolType: 'general',
      },
      communityContext: {
        location: 'Colonia El Refugio, Puebla, Pue.',
      },
      teacherId: 'teacher-thematic-001',
      currentStep: 9,
      fase1Diagnostico: {
        tabla1: [],
        tabla2: [],
        tabla3: [],
        tabla4: [],
      },
      fase2Justificacion: {
        projectName: 'Proyecto Escuela y Comunidad de Prueba Temática',
        introduction: 'Introducción al proyecto temático.',
        pilares: ['Pilar 1', 'Pilar 2'],
        proposito: { educativo: 'Propósito E', social: 'Propósito S', funcional: 'Propósito F' },
        alcance: { metas: [], participantes: [], recursos: [] },
      },
      fase2Mapeo: [],
      fase2Cronograma: canonical6Phases,
      fase2DetalleCurricular: null,
      fase2PlanOperativo: null,
      fase2Anexos: null,
      fase3PlanOperativoA: null,
      fase3PlanOperativoB: null,
      fase3Implementacion: null,
      fase4Gobernanza: null,
      fase4InformeSupervision: null,
      qualityAudit: null,
    };

    // Generar DOCX y verificar presencia de encabezados y títulos temáticos
    const docxBuf = await generatePaecDocx(project);
    const { value: text } = await mammoth.extractRawText({ buffer: docxBuf });

    expect(text).toContain('Fase Temática y Periodo');
    expect(text).toContain('Asignaturas Viga Maestra');
    expect(text).toContain('Fase 1: Diagnóstico Comunitario y Cartografía Social');
    expect(text).toContain('Fase 6: Cierre, Feria Comunitaria y Transferencia');

    // Generar PDF y verificar que compile exitosamente con las 5 columnas
    const pdfBuf = await generatePaecPDF(project);
    expect(pdfBuf).toBeDefined();
    expect(pdfBuf.length).toBeGreaterThan(10000);
  });
});
