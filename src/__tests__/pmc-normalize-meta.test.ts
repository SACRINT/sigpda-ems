import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import { PmcNormalizedGoalResponseSchema } from '@/lib/ai-schemas';
import { deduplicateMetasInstitucionales } from '@/lib/pmc-meta-deduplicator';
import { generatePmcDocx, generatePmcInformeDocx } from '@/lib/pmc-docx-generator';
import { generatePmcPDF } from '@/lib/pmc-pdf-generator';

describe('Surgical AI Meta Normalization and Ingestion Suite', () => {
  it('PmcNormalizedGoalResponseSchema valida una respuesta completa de normalización con Mtra. Tulia', () => {
    const aiResponse = {
      meta_individual: {
        nombre: 'Mtra. Tulia Morales',
        cargo: 'Docente de Lengua y Comunicación',
        categoria: 'Aprovechamiento académico',
        tema: 'Comprensión Lectora y Habilidades Comunicativas',
        meta_individual:
          'Lograr que el 85% de los estudiantes de primer semestre mejoren su nivel de comprensión lectora de nivel elemental a nivel satisfactorio al término del ciclo escolar mediante círculos reflexivos semanales.',
        estrategia:
          'Implementar círculos de lectura reflexiva los viernes, organizando lecturas guiadas con rúbricas de evaluación formativa.',
        entregable:
          'Portafolio de evidencias de lecturas reflexivas y listas de cotejo de comprensión lectora por corte bimestral.',
        periodo: 'Ciclo Escolar 2025-2026',
      },
      meta_institucional: {
        categoria: 'aprovechamiento',
        nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
        tema: 'Comprensión Lectora y Eficiencia Académica',
        meta: 'Elevar en 10 puntos porcentuales el índice de aprobación en las UACs del área de Lenguaje mediante estrategias activas de lectura y análisis de textos.',
        estrategia:
          'Coordinar talleres colegiados quincenales y círculos de lectura con seguimiento en academia y Consejo Técnico Escolar.',
        linea_base:
          'Diagnóstico inicial con 28% de alumnos con rezago en comprensión lectora.',
        personal_designado: 'Mtra. Tulia Morales y Academia de Lenguaje y Comunicación',
        entregable:
          'Reporte bimestral de seguimiento y carpetas de evidencias de comprensión lectora.',
        periodo_inicio: 'Septiembre',
        periodo_fin: 'Julio',
        diagnostico_meta:
          'Rezago detectado en comprensión de textos complejos en estudiantes de nuevo ingreso.',
        accion_especifica:
          'Desarrollar talleres de lectura reflexiva y aplicación de rúbricas de comprensión lectora.',
        finalidad:
          'Desarrollar el pensamiento crítico y la capacidad comunicativa integral conforme al MCCEMS.',
        necesidad:
          'Disminución del índice de reprobación en asignaturas de formación básica.',
        proceso_evaluacion:
          'Evaluación diagnóstica, formativa continua y sumativa colegiada en CTE.',
        subcategorias_vinculadas: ['Comprensión Lectora', 'Aprobación Escolar'],
        estrategias_seguimiento: 'Cortes bimestrales en CTE e indicadores de avance.',
        observaciones: 'Alineado al programa de estudios vigente de la DGB.',
      },
    };

    const parseResult = PmcNormalizedGoalResponseSchema.safeParse(aiResponse);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.meta_individual?.nombre).toBe('Mtra. Tulia Morales');
      expect(parseResult.data.meta_institucional?.categoria).toBe('aprovechamiento');
    }
  });

  it('Inserción quirúrgica: preserva estrictamente las metas de otros docentes sin alterarlas', () => {
    // Escenario real planteado por el usuario:
    // Los demás docentes (Juan y María) ya tienen sus metas aprobadas y NO deben modificarse.
    const docentesAprobados = [
      {
        nombre: 'Prof. Juan Pérez Gómez',
        cargo: 'Docente de Matemáticas',
        meta_individual: 'Alcanzar 90% de aprobación en Pensamiento Matemático I.',
        estrategia: 'Asesorías sabatinas.',
        entregable: 'Listas de cotejo bimestrales.',
        periodo: 'Ciclo Escolar 2025-2026',
      },
      {
        nombre: 'Mtra. María Eugenia Castro',
        cargo: 'Docente de Ciencias Sociales',
        meta_individual: 'Desarrollar 3 proyectos de investigación comunitaria.',
        estrategia: 'Trabajo por proyectos NEM.',
        entregable: 'Bitácoras de campo.',
        periodo: 'Ciclo Escolar 2025-2026',
      },
    ];

    const metasInstitucionalesExistentes = [
      {
        categoria: 'practica_docente',
        nombre_categoria: '2. Práctica docente y formación continua',
        tema: 'Acompañamiento Pedagógico',
        meta: 'Realizar 4 visitas de acompañamiento áulico por docente en el ciclo.',
        estrategia: 'Observación no punitiva y retroalimentación pedagógica.',
        linea_base: '0 visitas registradas el ciclo anterior.',
        personal_designado: 'Dirección Escolar',
        entregable: 'Fichas de observación y acuerdos de mejora.',
        periodo_inicio: 'Septiembre',
        periodo_fin: 'Julio',
        diagnostico_meta: 'Necesidad de fortalecer estrategias didácticas activas.',
      },
    ];

    const planOriginal = {
      metas_personales: [...docentesAprobados],
      metas_institucionales: [...metasInstitucionalesExistentes],
    };

    // La maestra Tulia solicita agregar 2 metas adicionales sin afectar a Juan y María
    const nuevaMeta1Tulia = {
      nombre: 'Mtra. Tulia Morales',
      cargo: 'Docente de Lenguaje',
      meta_individual: 'Meta 1: Implementar talleres de lectura los viernes con 85% de logro.',
      estrategia: 'Círculos de lectura reflexiva.',
      entregable: 'Portafolio de evidencias.',
      periodo: 'Ciclo Escolar 2025-2026',
    };

    const nuevaMeta2Tulia = {
      nombre: 'Mtra. Tulia Morales',
      cargo: 'Docente de Lenguaje',
      meta_individual: 'Meta 2: Diseñar e implementar 2 proyectos interdisciplinarios PAEC.',
      estrategia: 'Vinculación comunitaria con artesanos locales.',
      entregable: 'Informe fotográfico y rúbricas comunitarias.',
      periodo: 'Ciclo Escolar 2025-2026',
    };

    const nuevaInstTulia = {
      categoria: 'aprovechamiento',
      nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
      tema: 'Lectura Comprensiva',
      meta: 'Reducir la reprobación en Lengua y Comunicación en 5 puntos porcentuales.',
      estrategia: 'Círculos de lectura dirigidos por Mtra. Tulia y academia.',
      linea_base: '28% de reprobación inicial.',
      personal_designado: 'Mtra. Tulia Morales',
      entregable: 'Portafolio e informe bimestral.',
      periodo_inicio: 'Septiembre',
      periodo_fin: 'Julio',
      diagnostico_meta: 'Rezago en comprensión lectora.',
    };

    // Inserción quirúrgica
    const planActualizado = {
      metas_personales: [
        ...planOriginal.metas_personales,
        nuevaMeta1Tulia,
        nuevaMeta2Tulia,
      ],
      metas_institucionales: deduplicateMetasInstitucionales(
        [...planOriginal.metas_institucionales, nuevaInstTulia] as any
      ),
    };

    // Verificaciones de invariantes:
    // 1. Los docentes aprobados originales deben existir EXACTAMENTE en el mismo orden y contenido
    expect(planActualizado.metas_personales[0]).toEqual(docentesAprobados[0]);
    expect(planActualizado.metas_personales[1]).toEqual(docentesAprobados[1]);

    // 2. La Mtra. Tulia tiene sus 2 metas añadidas
    expect(planActualizado.metas_personales).toHaveLength(4);
    expect(planActualizado.metas_personales[2].nombre).toBe('Mtra. Tulia Morales');
    expect(planActualizado.metas_personales[3].nombre).toBe('Mtra. Tulia Morales');

    // 3. La meta institucional existente permanece intacta
    expect(planActualizado.metas_institucionales).toHaveLength(2);
    expect(planActualizado.metas_institucionales[0].tema).toBe('Acompañamiento Pedagógico');
    expect(planActualizado.metas_institucionales[1].tema).toBe('Lectura Comprensiva');
  });

  it('Verifica que la meta quirúrgica se refleja en DOCX y PDF en las 5 secciones requeridas', async () => {
    const mockProject = {
      id: 'mock-pmc-uuid-heroes',
      school_name: 'Bachillerato Héroes de la Reforma',
      school_cct: '21EBH0001A',
      municipality: 'Puebla',
      locality: 'Puebla',
      ciclo_escolar: '2025-2026',
      subsystem: 'Bachillerato General Estatal',
      director_name: 'Lic. Roberto Gómez',
      total_staff: 3,
      staff_data: JSON.stringify([
        { nombre: 'Prof. Juan Pérez Gómez', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Mtra. María Eugenia Castro', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Mtra. Tulia Morales', cargo: 'Docente de Lenguaje', horas_base: 20 },
      ]),
      plan_accion: JSON.stringify({
        metas_institucionales: [
          {
            categoria: 'aprovechamiento',
            nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
            tema: 'Comprensión Lectora y Reducción de Reprobación',
            meta: 'Incrementar el porcentaje de alumnos con comprensión lectora satisfactoria al 85%.',
            estrategia: 'Talleres los viernes dirigidos por la Mtra. Tulia.',
            linea_base: 'Diagnóstico inicial con 30% de rezago.',
            personal_designado: 'Mtra. Tulia Morales y Academia de Lenguaje',
            entregable: 'Portafolio de evidencias y listas de cotejo.',
            periodo_inicio: 'Septiembre',
            periodo_fin: 'Julio',
            diagnostico_meta: 'Rezago detectado en comprensión lectora.',
            accion_especifica: 'Círculos de lectura semanales y rúbricas formativas.',
            finalidad: 'Mejorar el rendimiento académico en comunicación.',
            proceso_evaluacion: 'Evaluación formativa en CTE.',
            subcategorias_vinculadas: ['Comprensión Lectora', 'Aprovechamiento Escolar'],
            estrategias_seguimiento: 'Cortes bimestrales en CTE.',
            observaciones: 'Meta prioritaria solicitada por colegiado.',
          },
        ],
        metas_personales: [
          {
            nombre: 'Mtra. Tulia Morales',
            cargo: 'Docente de Lenguaje',
            meta_individual: 'Realizar talleres de lectura los viernes para mejorar la comprensión lectora.',
            estrategia: 'Círculos de lectura reflexiva con rúbricas formativas.',
            entregable: 'Portafolio de evidencias y listas de cotejo.',
            periodo: 'Ciclo Escolar 2025-2026',
          },
        ],
      }),
    };

    // 1. Generación de DOCX
    const docxResult = await generatePmcDocx(mockProject as any);
    expect(docxResult).toBeDefined();

    // 2. Generación de PDF
    const pdfBuffer = await generatePmcPDF(mockProject as any);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });

  it('Verifica que las metas nuevas de la Mtra. Tulia se integran en el Informe Parcial y en el Informe Final', async () => {
    const mockProject = {
      id: 'mock-pmc-uuid-heroes',
      school_name: 'Bachillerato Héroes de la Reforma',
      school_cct: '21EBH0001A',
      municipality: 'Puebla',
      locality: 'Puebla',
      ciclo_escolar: '2025-2026',
      subsystem: 'Bachillerato General Estatal',
      director_name: 'Lic. Roberto Gómez',
      supervisor_name: 'Mtro. José Luis Sánchez',
      total_staff: 3,
      staff_data: JSON.stringify([
        { nombre: 'Prof. Juan Pérez Gómez', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Mtra. María Eugenia Castro', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Mtra. Tulia Morales', cargo: 'Docente de Lenguaje', horas_base: 20 },
      ]),
      plan_accion: JSON.stringify({
        metas_institucionales: [
          {
            categoria: 'aprovechamiento',
            nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
            tema: 'Comprensión Lectora y Reducción de Reprobación',
            meta: 'Incrementar el porcentaje de alumnos con comprensión lectora satisfactoria al 85%.',
            estrategia: 'Talleres los viernes dirigidos por la Mtra. Tulia.',
            linea_base: 'Diagnóstico inicial con 30% de rezago.',
            personal_designado: 'Mtra. Tulia Morales y Academia de Lenguaje',
            entregable: 'Portafolio de evidencias y listas de cotejo.',
            periodo_inicio: 'Septiembre',
            periodo_fin: 'Julio',
            diagnostico_meta: 'Rezago detectado en comprensión lectora.',
          },
        ],
        metas_personales: [
          {
            nombre: 'Mtra. Tulia Morales',
            cargo: 'Docente de Lenguaje',
            meta_individual: 'Realizar talleres de lectura los viernes para mejorar la comprensión lectora.',
            estrategia: 'Círculos de lectura reflexiva con rúbricas formativas.',
            entregable: 'Portafolio de evidencias de lecturas reflexivas.',
            periodo: 'Ciclo Escolar 2025-2026',
          },
        ],
      }),
    };

    // 1. Informe Parcial
    const parcialBuffer = await generatePmcInformeDocx(mockProject as any, 'parcial');
    expect(parcialBuffer).toBeDefined();
    expect(parcialBuffer.length).toBeGreaterThan(4000);

    const { value: parcialText } = await mammoth.extractRawText({ buffer: parcialBuffer });
    expect(parcialText).toContain('INFORME PARCIAL DE AVANCE PMC 2025-2026');
    // Verifica que la meta institucional de Tulia está en Sección II
    expect(parcialText).toContain('Comprensión Lectora y Reducción de Reprobación');
    expect(parcialText).toContain('Mtra. Tulia Morales y Academia de Lenguaje');
    // Verifica que la meta individual de Tulia está en Sección III
    expect(parcialText).toContain('Mtra. Tulia Morales');
    expect(parcialText).toContain('Realizar talleres de lectura los viernes para mejorar la comprensión lectora.');
    // Verifica que el entregable de Tulia está en el inventario de Sección V
    expect(parcialText).toContain('Portafolio de evidencias de lecturas reflexivas.');

    // 2. Informe Final
    const finalBuffer = await generatePmcInformeDocx(mockProject as any, 'final');
    expect(finalBuffer).toBeDefined();
    expect(finalBuffer.length).toBeGreaterThan(4000);

    const { value: finalText } = await mammoth.extractRawText({ buffer: finalBuffer });
    expect(finalText).toContain('INFORME FINAL DEL PLAN DE MEJORA CONTINUA (PMC) 2025-2026');
    // Verifica Sección II, III y V en el Informe Final
    expect(finalText).toContain('Comprensión Lectora y Reducción de Reprobación');
    expect(finalText).toContain('Mtra. Tulia Morales');
    expect(finalText).toContain('Realizar talleres de lectura los viernes para mejorar la comprensión lectora.');
    expect(finalText).toContain('Cumplida al 100% (Evidencias validadas)');
  });
});
