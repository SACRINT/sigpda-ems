import { describe, it, expect } from 'vitest';
import mammoth from 'mammoth';
import { PmcNormalizedGoalResponseSchema } from '@/lib/ai-schemas';
import { deduplicateMetasInstitucionales } from '@/lib/pmc-meta-deduplicator';
import { generatePmcDocx, generatePmcInformeDocx } from '@/lib/pmc-docx-generator';
import { generatePmcPDF } from '@/lib/pmc-pdf-generator';

describe('Surgical AI Meta Normalization and Ingestion Suite', () => {
  it('PmcNormalizedGoalResponseSchema valida una respuesta completa de normalización para Docente 1', () => {
    const aiResponse = {
      meta_individual: {
        nombre: 'Docente 1',
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
        personal_designado: 'Docente 1 y Academia de Lenguaje y Comunicación',
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
      expect(parseResult.data.meta_individual?.nombre).toBe('Docente 1');
      expect(parseResult.data.meta_institucional?.categoria).toBe('aprovechamiento');
    }
  });

  it('PmcNormalizedGoalResponseSchema valida respuesta múltiple con array de metas (ej. COSFAC y Vive Saludable)', () => {
    const aiMultiResponse = {
      metas: [
        {
          meta_individual: {
            nombre: 'Docente 1',
            cargo: 'Docente y tutor de grupo',
            categoria: 'Práctica docente y formación continua',
            tema: 'Formación y Actualización Continua',
            meta_individual:
              'Realizar y acreditar satisfactoriamente al 100% los 2 cursos de formación y actualización docente del COSFAC obteniendo las constancias correspondientes durante el ciclo escolar 2026-2027.',
            estrategia: 'Participar activamente en la calendarización establecida por COSFAC.',
            entregable: 'Constancias oficiales de acreditación emitidas por COSFAC.',
            periodo: 'Ciclo Escolar 2026-2027',
          },
          meta_institucional: {
            categoria: 'practica_docente',
            nombre_categoria: '2. Práctica docente y formación continua',
            tema: 'Actualización y Formación Continua COSFAC',
            meta: 'Lograr que el 100% de los docentes programados acrediten los cursos de formación continua del COSFAC.',
            estrategia: 'Calendarización, seguimiento colegiado y monitoreo de constancias en CTE.',
            linea_base: 'Diagnóstico institucional de necesidades formativas.',
            personal_designado: 'Docente 1 y Academia Docente',
            entregable: 'Constancias de acreditación y reporte de formación.',
            periodo_inicio: 'Septiembre',
            periodo_fin: 'Julio',
            diagnostico_meta: 'Necesidad de actualización pedagógica continua en el marco del MCCEMS.',
            accion_especifica: 'Inscripción y acreditación de cursos COSFAC.',
            finalidad: 'Fortalecer las competencias didácticas docentes.',
            necesidad: 'Actualización en estrategias de enseñanza activas.',
            proceso_evaluacion: 'Revisión periódica de avances en CTE.',
            subcategorias_vinculadas: ['Formación Docente', 'Práctica Educativa'],
            estrategias_seguimiento: 'Cortes bimestrales en CTE.',
            observaciones: 'Alineado a lineamientos de COSFAC.',
          },
        },
        {
          meta_individual: {
            nombre: 'Docente 1',
            cargo: 'Docente y tutor de grupo',
            categoria: 'Convivencia escolar y Proyecto Escolar Comunitario (PAEC)',
            tema: 'Bienestar y Estilos de Vida Saludable',
            meta_individual:
              'Participar en el 100% de las actividades del programa “Vive Saludable y Vive Feliz”, fomentando en los estudiantes hábitos de vida saludable, bienestar físico y emocional durante el ciclo escolar 2026-2027.',
            estrategia: 'Talleres quincenales de hábitos saludables, activación física y convivencia socioemocional.',
            entregable: 'Portafolio de evidencias de actividades del programa y bitácoras de participación.',
            periodo: 'Ciclo Escolar 2026-2027',
          },
          meta_institucional: {
            categoria: 'convivencia_paec',
            nombre_categoria: '4. Convivencia escolar y Proyecto Escolar Comunitario (PAEC)',
            tema: 'Programa Vive Saludable y Vive Feliz',
            meta: 'Involucrar al 90% de la comunidad estudiantil en las actividades de bienestar y hábitos saludables del programa “Vive Saludable y Vive Feliz” durante el ciclo 2026-2027.',
            estrategia: 'Jornadas de activación, talleres socioemocionales y proyectos escolares de nutrición y autocuidado.',
            linea_base: 'Diagnóstico inicial de salud socioemocional escolar.',
            personal_designado: 'Docente 1 y Comité Escolar de Salud',
            entregable: 'Reporte fotográfico y bitácoras bimestrales de bienestar estudiantil.',
            periodo_inicio: 'Septiembre',
            periodo_fin: 'Julio',
            diagnostico_meta: 'Necesidad de fortalecer el autocuidado y la salud emocional.',
            accion_especifica: 'Talleres mensuales y ferias de la salud escolar.',
            finalidad: 'Fomentar estilos de vida saludables y convivencia armónica.',
            necesidad: 'Promover hábitos preventivos en los jóvenes.',
            proceso_evaluacion: 'Encuestas de satisfacción y bitácoras de participación en CTE.',
            subcategorias_vinculadas: ['Vida Saludable', 'Convivencia Escolar'],
            estrategias_seguimiento: 'Cortes bimestrales en CTE.',
            observaciones: 'Vinculado a los ejes articuladores de la NEM.',
          },
        },
      ],
    };

    const parseResult = PmcNormalizedGoalResponseSchema.safeParse(aiMultiResponse);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.metas).toHaveLength(2);
      expect(parseResult.data.metas[0].meta_institucional?.categoria).toBe('practica_docente');
      expect(parseResult.data.metas[1].meta_institucional?.categoria).toBe('convivencia_paec');
      // Verificación de retrocompatibilidad
      expect(parseResult.data.meta_individual?.nombre).toBe('Docente 1');
      expect(parseResult.data.meta_institucional?.categoria).toBe('practica_docente');
    }
  });

  it('Inserción quirúrgica: preserva estrictamente las metas de otros docentes sin alterarlas', () => {
    // Escenario: Los demás docentes ya tienen sus metas aprobadas y NO deben modificarse.
    const docentesAprobados = [
      {
        nombre: 'Docente 2',
        cargo: 'Docente de Matemáticas',
        meta_individual: 'Alcanzar 90% de aprobación en Pensamiento Matemático I.',
        estrategia: 'Asesorías sabatinas.',
        entregable: 'Listas de cotejo bimestrales.',
        periodo: 'Ciclo Escolar 2025-2026',
      },
      {
        nombre: 'Docente 3',
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

    // Docente 1 solicita agregar 2 metas adicionales sin afectar a Docente 2 ni Docente 3
    const nuevaMeta1Docente = {
      nombre: 'Docente 1',
      cargo: 'Docente de Lenguaje',
      meta_individual: 'Meta 1: Implementar talleres de lectura los viernes con 85% de logro.',
      estrategia: 'Círculos de lectura reflexiva.',
      entregable: 'Portafolio de evidencias.',
      periodo: 'Ciclo Escolar 2025-2026',
    };

    const nuevaMeta2Docente = {
      nombre: 'Docente 1',
      cargo: 'Docente de Lenguaje',
      meta_individual: 'Meta 2: Diseñar e implementar 2 proyectos interdisciplinarios PAEC.',
      estrategia: 'Vinculación comunitaria con artesanos locales.',
      entregable: 'Informe fotográfico y rúbricas comunitarias.',
      periodo: 'Ciclo Escolar 2025-2026',
    };

    const nuevaInstDocente = {
      categoria: 'aprovechamiento',
      nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
      tema: 'Lectura Comprensiva',
      meta: 'Reducir la reprobación en Lengua y Comunicación en 5 puntos porcentuales.',
      estrategia: 'Círculos de lectura dirigidos por Docente 1 y academia.',
      linea_base: '28% de reprobación inicial.',
      personal_designado: 'Docente 1',
      entregable: 'Portafolio e informe bimestral.',
      periodo_inicio: 'Septiembre',
      periodo_fin: 'Julio',
      diagnostico_meta: 'Rezago en comprensión lectora.',
    };

    // Inserción quirúrgica
    const planActualizado = {
      metas_personales: [
        ...planOriginal.metas_personales,
        nuevaMeta1Docente,
        nuevaMeta2Docente,
      ],
      metas_institucionales: deduplicateMetasInstitucionales(
        [...planOriginal.metas_institucionales, nuevaInstDocente] as any
      ),
    };

    // Verificaciones de invariantes:
    // 1. Los docentes aprobados originales deben existir EXACTAMENTE en el mismo orden y contenido
    expect(planActualizado.metas_personales[0]).toEqual(docentesAprobados[0]);
    expect(planActualizado.metas_personales[1]).toEqual(docentesAprobados[1]);

    // 2. Docente 1 tiene sus 2 metas añadidas
    expect(planActualizado.metas_personales).toHaveLength(4);
    expect(planActualizado.metas_personales[2].nombre).toBe('Docente 1');
    expect(planActualizado.metas_personales[3].nombre).toBe('Docente 1');

    // 3. La meta institucional existente permanece intacta
    expect(planActualizado.metas_institucionales).toHaveLength(2);
    expect(planActualizado.metas_institucionales[0].tema).toBe('Acompañamiento Pedagógico');
    expect(planActualizado.metas_institucionales[1].tema).toBe('Lectura Comprensiva');
  });

  it('Verifica que la meta quirúrgica se refleja en DOCX y PDF en las 5 secciones requeridas', async () => {
    const mockProject = {
      id: 'mock-pmc-uuid-heroes',
      school_name: 'Bachillerato General Oficial',
      school_cct: '21EBH0001A',
      municipality: 'Puebla',
      locality: 'Puebla',
      ciclo_escolar: '2025-2026',
      subsystem: 'Bachillerato General Estatal',
      director_name: 'Director del Plantel',
      total_staff: 3,
      staff_data: JSON.stringify([
        { nombre: 'Docente 2', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Docente 3', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Docente 1', cargo: 'Docente de Lenguaje', horas_base: 20 },
      ]),
      plan_accion: JSON.stringify({
        metas_institucionales: [
          {
            categoria: 'aprovechamiento',
            nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
            tema: 'Comprensión Lectora y Reducción de Reprobación',
            meta: 'Incrementar el porcentaje de alumnos con comprensión lectora satisfactoria al 85%.',
            estrategia: 'Talleres los viernes dirigidos por Docente 1.',
            linea_base: 'Diagnóstico inicial con 30% de rezago.',
            personal_designado: 'Docente 1 y Academia de Lenguaje',
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
            nombre: 'Docente 1',
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

  it('Verifica que las metas nuevas de Docente 1 se integran en el Informe Parcial y en el Informe Final', async () => {
    const mockProject = {
      id: 'mock-pmc-uuid-heroes',
      school_name: 'Bachillerato General Oficial',
      school_cct: '21EBH0001A',
      municipality: 'Puebla',
      locality: 'Puebla',
      ciclo_escolar: '2025-2026',
      subsystem: 'Bachillerato General Estatal',
      director_name: 'Director del Plantel',
      supervisor_name: 'Supervisor Escolar',
      total_staff: 3,
      staff_data: JSON.stringify([
        { nombre: 'Docente 2', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Docente 3', cargo: 'Docente', horas_base: 20 },
        { nombre: 'Docente 1', cargo: 'Docente de Lenguaje', horas_base: 20 },
      ]),
      plan_accion: JSON.stringify({
        metas_institucionales: [
          {
            categoria: 'aprovechamiento',
            nombre_categoria: '1. Aprovechamiento académico y asistencia educativa',
            tema: 'Comprensión Lectora y Reducción de Reprobación',
            meta: 'Incrementar el porcentaje de alumnos con comprensión lectora satisfactoria al 85%.',
            estrategia: 'Talleres los viernes dirigidos por Docente 1.',
            linea_base: 'Diagnóstico inicial con 30% de rezago.',
            personal_designado: 'Docente 1 y Academia de Lenguaje',
            entregable: 'Portafolio de evidencias y listas de cotejo.',
            periodo_inicio: 'Septiembre',
            periodo_fin: 'Julio',
            diagnostico_meta: 'Rezago detectado en comprensión lectora.',
          },
        ],
        metas_personales: [
          {
            nombre: 'Docente 1',
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
    // Verifica que la meta institucional de Docente 1 está en Sección II
    expect(parcialText).toContain('Comprensión Lectora y Reducción de Reprobación');
    expect(parcialText).toContain('Docente 1 y Academia de Lenguaje');
    // Verifica que la meta individual de Docente 1 está en Sección III
    expect(parcialText).toContain('Docente 1');
    expect(parcialText).toContain('Realizar talleres de lectura los viernes para mejorar la comprensión lectora.');
    // Verifica que el entregable de Docente 1 está en el inventario de Sección V
    expect(parcialText).toContain('Portafolio de evidencias de lecturas reflexivas.');

    // 2. Informe Final
    const finalBuffer = await generatePmcInformeDocx(mockProject as any, 'final');
    expect(finalBuffer).toBeDefined();
    expect(finalBuffer.length).toBeGreaterThan(4000);

    const { value: finalText } = await mammoth.extractRawText({ buffer: finalBuffer });
    expect(finalText).toContain('INFORME FINAL DEL PLAN DE MEJORA CONTINUA (PMC) 2025-2026');
    // Verifica Sección II, III y V en el Informe Final
    expect(finalText).toContain('Comprensión Lectora y Reducción de Reprobación');
    expect(finalText).toContain('Docente 1');
    expect(finalText).toContain('Realizar talleres de lectura los viernes para mejorar la comprensión lectora.');
    expect(finalText).toContain('Cumplida al 100% (Evidencias validadas)');
  });
});
