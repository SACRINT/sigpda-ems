// src/__tests__/pmc-docx-maestro.test.ts
import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import {
  generatePmcDocxMaestro,
  resolveMaestroRejection,
  type PmcProjectMasterData,
  type PmcPersonalItem,
} from '../lib/pmc-docx-maestro-builder';
import { PmcPlanAccionSchema } from '../lib/ai-schemas';

describe('FASE 3: Generador de Documento Maestro Oficial del PMC (8 Capítulos Formato 5.2 DBEPA)', () => {
  const mockCompleteProject: PmcProjectMasterData = {
    id: 'pmc-test-uuid-001',
    teacher_id: 'teacher-uuid-123',
    school_name: 'Bachillerato General Oficial Licenciado Moisés Sáenz Garza',
    school_cct: '21EBH0004Z',
    municipality: 'Puebla',
    locality: 'San Jerónimo Caleras',
    school_zone: 'Zona Escolar 004',
    ciclo_escolar: '2025-2026',
    subsystem: 'Bachillerato General Estatal',
    director_name: 'Dr. Roberto Mendoza Herrera',
    supervisor_name: 'Mtra. Patricia González Morales',
    diagnostico_generado: {
      presentacion:
        'El presente PMC surge del esfuerzo colegiado de la comunidad escolar para abatir el rezago educativo y fortalecer la formación integral.',
      contexto:
        'Plantel ubicado en zona semiurbana con alta participación social de los padres de familia y comités vecinales.',
      analisis_indicadores:
        'Tasa de aprobación del 89.4%, eficiencia terminal del 84.2% y abandono escolar reducido al 5.1%.',
      sintesis_foda:
        'Fortalezas: Docentes con posgrado. Oportunidades: Vinculación comunitaria. Debilidades: Infraestructura tecnológica. Amenazas: Entorno vial.',
      priorizacion:
        'Se prioriza el fortalecimiento del trabajo colegiado, clubes de lectura y tutoría académica.',
    },
    plan_accion: {
      metas_institucionales: [
        {
          tema: 'Aprovechamiento Académico',
          diagnostico_meta: 'Existen áreas de oportunidad en comprensión lectora y pensamiento matemático.',
          meta: 'Alcanzar el 92% de aprobación general en el primer semestre.',
          estrategia: 'Implementación de talleres situados y asesorías entre pares.',
          linea_base: '89.4% de aprobación inicial en ciclo 2024-2025.',
          personal_designado: 'Academia de Matemáticas y Lenguaje',
          entregable: 'Listas de cotejo y actas de evaluación bimestral',
          periodo_inicio: 'Agosto 2025',
          periodo_fin: 'Diciembre 2025',
        },
        {
          tema: 'Permanencia Escolar',
          diagnostico_meta: 'Factores socioeconómicos inciden en el riesgo de abandono en segundo año.',
          meta: 'Reducir la tasa de abandono por debajo del 4.5% anual.',
          estrategia: 'Sistema de alerta temprana y acompañamiento psicopedagógico.',
          linea_base: '5.1% de abandono escolar en ciclo anterior.',
          personal_designado: 'Comité de Tutoría y Orientación Educativa',
          entregable: 'Expedientes de seguimiento tutorial y bitácora de canalización',
          periodo_inicio: 'Septiembre 2025',
          periodo_fin: 'Junio 2026',
        },
      ],
      metas_personales: [
        {
          nombre: 'Prof. Carlos Mendoza',
          cargo: 'Docente de Matemáticas',
          categoria: 'Aprovechamiento Académico',
          tema: 'Pensamiento Matemático',
          meta_individual: 'Diseñar 4 secuencias didácticas basadas en el MCCEMS.',
          estrategia: 'Participar activamente en las sesiones de colegiado.',
          entregable: '4 secuencias didácticas autorizadas',
          periodo: 'Ciclo Escolar 2025-2026',
        },
      ],
    },
  };

  const mockPersonal: PmcPersonalItem[] = [
    {
      id: 'p1',
      nombre: 'Carlos',
      apellido_paterno: 'Mendoza',
      apellido_materno: 'López',
      cargo: 'Docente de Matemáticas',
      horas_base: 30,
      email: 'carlos.mendoza@puebla.gob.mx',
      activo: true,
    },
    {
      id: 'p2',
      nombre: 'María Elena',
      apellido_paterno: 'Rosas',
      apellido_materno: 'Castillo',
      cargo: 'Orientadora Educativa',
      horas_base: 40,
      email: 'elena.rosas@puebla.gob.mx',
      activo: true,
    },
  ];

  it('1. Genera un archivo DOCX no vacío y con encabezados canónicos para los 8 capítulos oficiales', async () => {
    const buffer = await generatePmcDocxMaestro(mockCompleteProject, {
      personal: mockPersonal,
    });

    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(15000); // Documento DOCX sustantivo con estructura OpenXML

    // Extracción de texto crudo con mammoth para verificar capítulos
    const { value: rawText } = await mammoth.extractRawText({ buffer });

    // 1. Verificación de los 8 encabezados canónicos obligatorios
    expect(rawText).toContain('Capítulo I. Identificación Institucional');
    expect(rawText).toContain('Capítulo II. Marco Normativo y Catálogo de Metas Institucionales');
    expect(rawText).toContain('Capítulo III. Diagnóstico Integral del Plantel');
    expect(rawText).toContain('Capítulo IV. Objetivos Generales y Estrategias del PMC');
    expect(rawText).toContain('Capítulo V. Plan de Acción y Metas Anuales Institucionales');
    expect(rawText).toContain('Capítulo VI. Mecanismos de Seguimiento y Monitoreo Trimestral');
    expect(rawText).toContain('Capítulo VII. Recursos, Vinculación y Plantilla del Plantel');
    expect(rawText).toContain('Capítulo VIII. Evaluación, Rendición de Cuentas y Firmas Colegiadas');

    // 2. Verificación de contenido institucional en portada y cuerpo
    expect(rawText).toContain('PROGRAMA DE MEJORA CONTINUA (PMC)');
    expect(rawText).toContain('Bachillerato General Oficial Licenciado Moisés Sáenz Garza');
    expect(rawText).toContain('21EBH0004Z');
    expect(rawText).toContain('San Jerónimo Caleras, Puebla, Puebla');

    // 3. Verificación de parseo estricto del schema y contenido de sección 5.2 (H-071)
    expect(() => PmcPlanAccionSchema.parse(mockCompleteProject.plan_accion)).not.toThrow();
    expect(rawText).toContain('5.2 Metas y Compromisos Personales Docentes');
    expect(rawText).toContain('Prof. Carlos Mendoza');
    expect(rawText).toContain('Docente de Matemáticas');
    expect(rawText).toContain('Diseñar 4 secuencias didácticas basadas en el MCCEMS.');
    expect(rawText).toContain('4 secuencias didácticas autorizadas');
    expect(rawText).toContain('Ciclo Escolar 2025-2026');
  });

  it('2. Fallback de Sección 2: Si pmc_catalogo_metas está vacía, recurre a getCatalogoMetasPmc() y marca la fuente', async () => {
    // Generar pasando catalogoMetas vacío explícitamente
    const buffer = await generatePmcDocxMaestro(mockCompleteProject, {
      catalogoMetas: [],
      personal: mockPersonal,
    });

    const { value: rawText } = await mammoth.extractRawText({ buffer });

    // Debe contener la leyenda de respaldo canónico local
    expect(rawText).toContain('Fuente: Catálogo Canónico Institucional SIGPDA-EMS (Respaldo Local).');

    // Debe contener metas canónicas del Formato 5.2
    expect(rawText).toContain('TRABAJO COLEGIADO');
    expect(rawText).toContain('CLUBES DE LECTURA');
    expect(rawText).toContain('SEGUIMIENTO AL DESEMPEÑO DOCENTE EN EL AULA');
  });

  it('3. Fuente honesta para Capítulos 6 y 8 (H-068): deriva de metas existentes y rotula texto pendiente sin inventar cifras', async () => {
    const buffer = await generatePmcDocxMaestro(mockCompleteProject, {
      personal: mockPersonal,
    });

    const { value: rawText } = await mammoth.extractRawText({ buffer });

    // En Capítulo 6: seguimiento derivado de metas con leyenda honesta
    expect(rawText).toContain('Capítulo VI. Mecanismos de Seguimiento y Monitoreo Trimestral');
    expect(rawText).toContain('Agosto 2025 a Diciembre 2025');
    expect(rawText).toContain('Contenido pendiente de captura en el wizard');

    // En Capítulo 8: evaluación comparativa línea base vs meta y bloque de firmas
    expect(rawText).toContain('Capítulo VIII. Evaluación, Rendición de Cuentas y Firmas Colegiadas');
    expect(rawText).toContain('89.4% de aprobación inicial en ciclo 2024-2025.');
    expect(rawText).toContain('Comité Colegiado de Planeación');
    expect(rawText).toContain('Dirección del Plantel');
    expect(rawText).toContain('Supervisión Escolar');
  });

  it('4. Contrato C2 (Anti-Stub B-001 / H-074): Validación de resolveMaestroRejection para 422 ante borrador incompleto', () => {
    // Caso 1: Falta diagnostico_generado
    const draftWithoutDiag = {
      diagnostico_generado: undefined,
      plan_accion: mockCompleteProject.plan_accion,
    };
    const rejDiag = resolveMaestroRejection(draftWithoutDiag);
    expect(rejDiag.rejected).toBe(true);
    expect(rejDiag.status).toBe(422);
    expect(rejDiag.body?.error).toBe('PROYECTO_INCOMPLETO_BORRADOR');
    expect(rejDiag.body?.faltantes).toEqual({
      diagnostico: true,
      plan_accion: false,
    });

    // Caso 2: Falta plan_accion
    const draftWithoutPlan = {
      diagnostico_generado: mockCompleteProject.diagnostico_generado,
      plan_accion: undefined,
    };
    const rejPlan = resolveMaestroRejection(draftWithoutPlan);
    expect(rejPlan.rejected).toBe(true);
    expect(rejPlan.status).toBe(422);
    expect(rejPlan.body?.faltantes).toEqual({
      diagnostico: false,
      plan_accion: true,
    });

    // Caso 3: Proyecto completo con diagnóstico y plan
    const completeProject = {
      diagnostico_generado: mockCompleteProject.diagnostico_generado,
      plan_accion: mockCompleteProject.plan_accion,
    };
    const rejComplete = resolveMaestroRejection(completeProject);
    expect(rejComplete.rejected).toBe(false);
    expect(rejComplete.status).toBeUndefined();
    expect(rejComplete.body).toBeUndefined();
  });

  it('5. Mapeo estricto de plantilla en Capítulo 7 desde escuela_personal', async () => {
    const buffer = await generatePmcDocxMaestro(mockCompleteProject, {
      personal: mockPersonal,
    });

    const { value: rawText } = await mammoth.extractRawText({ buffer });

    expect(rawText).toContain('Mendoza López Carlos');
    expect(rawText).toContain('Docente de Matemáticas');
    expect(rawText).toContain('Rosas Castillo María Elena');
    expect(rawText).toContain('Orientadora Educativa');
  });

  it('6. Presupuesto de rendimiento: El ensamble determinista se completa en ≤ 7.0 s (CI) / ≤ 3.5 s (local)', async () => {
    // Generar proyecto masivo con 2 metas y 25 docentes
    const largePersonal: PmcPersonalItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `p-${i}`,
      nombre: `Docente${i}`,
      apellido_paterno: `ApellidoP${i}`,
      apellido_materno: `ApellidoM${i}`,
      cargo: 'Docente de Asignatura',
      horas_base: 20 + (i % 20),
      email: `docente${i}@puebla.gob.mx`,
      activo: true,
    }));

    const startTime = Date.now();
    const buffer = await generatePmcDocxMaestro(mockCompleteProject, {
      personal: largePersonal,
    });
    const durationMs = Date.now() - startTime;

    expect(buffer).toBeDefined();
    expect(durationMs).toBeLessThan(7000); // Umbral de tolerancia para CI (≤ 7.0 s)
  });
});
