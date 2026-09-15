// scripts/test_lote3.ts
import { calculateGlobalPmcScore, formatPmcAuditReport } from '@/lib/pmc-quality-gate';
import { calculateGlobalPipsScore, formatPipsAuditReport } from '@/lib/pips-quality-gate';
import { exportSacrintCourseManifest } from '@/lib/sacrint-manifest-exporter';
import { resolveVisualForMission } from '@/lib/visual-engine/visual-asset-manager';
import type { PmcProject } from '@/types/pmc';
import type { PipsProject } from '@/types/pips';
import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

async function main() {
  console.log('=== TEST LOTE 3: EVOLUCIÓN ARQUITECTÓNICA ===\n');

  // 1. Test PMC Quality Gate
  console.log('1. Probando PMC Quality Gate...');
  const samplePmc: PmcProject = {
    id: '11111111-1111-1111-1111-111111111111',
    school_name: 'Bachillerato General Héroes de la Patria',
    school_cct: '21EBH0234Z',
    school_zone: '004',
    municipality: 'Puebla',
    locality: 'Heroica Puebla de Zaragoza',
    director_name: 'Prof. Roberto González M.',
    supervisor_name: 'Mtra. Patricia Morales S.',
    ciclo_escolar: '2026-2027',
    subsystem: 'BGE',
    total_staff: 14,
    staff_data: [
      { nombre: 'Prof. Roberto González', cargo: 'Director' },
      { nombre: 'Mtra. Elena Gómez', cargo: 'Docente Matemáticas' },
      { nombre: 'Prof. Carlos Fuentes', cargo: 'Docente Ciencias' },
      { nombre: 'Mtra. Lucía Pérez', cargo: 'Docente Humanidades' },
      { nombre: 'Lic. Sofía Ramos', cargo: 'Orientadora Educativa' },
    ],
    indicadores_academicos: {
      matricula: 420,
      aprobacion_ant: 84.5,
      reprobacion_ant: 15.5,
      abandono_ant: 6.2,
      et_ant: 78.4,
      aprobacion_meta: 90.0,
      abandono_meta: 4.0,
      et_meta: 85.0,
    },
    diagnostico_comunidad: 'El plantel se localiza en una zona periurbana de alta movilidad laboral. La comunidad cuenta con servicios básicos completos, aunque un 35% de las familias enfrenta dificultades económicas. Se detecta alta necesidad de fortalecer el pensamiento matemático y las habilidades socioemocionales para mitigar la deserción escolar.',
    foda: {
      fortalezas: 'Planta docente completa y con posgrado, infraestructura de laboratorios en buen estado, participación activa de padres de familia.',
      oportunidades: 'Convenios con universidades tecnológicas locales, programas de becas estatales, acceso a fibra óptica comunitaria.',
      debilidades: 'Brecha digital en hogares, rezago en competencias lectoras al ingreso, falta de biblioteca digital estructurada.',
      amenazas: 'Migración temporal por motivos laborales, deserción por incorporación temprana al mercado informal.',
    },
    categorias_priorizadas: [
      { id: 'cat1', nombre: 'Aprovechamiento Académico', temas: ['Rezago en Álgebra', 'Comprensión Lectora'] },
      { id: 'cat2', nombre: 'Permanencia Escolar', temas: ['Alerta Temprana de Deserción', 'Tutorías'] },
    ],
    diagnostico_generado: {
      presentacion: 'Presentación formal del PMC 2026-2027 orientada al logro educativo bajo el marco de la NEM.',
      contexto: 'Contexto sociocultural situado en la región Angelópolis con enfoque comunitario.',
      analisis_indicadores: 'Análisis detallado de la cohorte 2023-2026 con tasas de eficiencia y retención.',
      sintesis_foda: 'Articulación de fortalezas institucionales con oportunidades del entorno productivo.',
      priorizacion: 'Focalización en 2 categorías con impacto directo en los semestres 1° y 3°.',
    },
    plan_accion: {
      metas_institucionales: [
        {
          categoria: 'cat1',
          nombre_categoria: 'Aprovechamiento Académico',
          tema: 'Rezago en Álgebra',
          meta: 'Incrementar el índice de aprobación en Matemáticas del 84% al 90% al término del ciclo.',
          estrategia: 'Implementación de talleres vespertinos de resolución situada y cuadernos activos.',
          personal_designado: 'Mtra. Elena Gómez y Academia de Matemáticas',
          entregable: 'Registro bimestral de calificaciones y portafolio de evidencias de asesorías.',
          periodo_inicio: 'Septiembre 2026',
          periodo_fin: 'Julio 2027',
        },
        {
          categoria: 'cat2',
          nombre_categoria: 'Permanencia Escolar',
          tema: 'Alerta Temprana',
          meta: 'Reducir el abandono escolar del 6.2% al 4.0% mediante acompañamiento socioemocional.',
          estrategia: 'Activación del semáforo de ausentismo semanal y tutorías personalizadas.',
          personal_designado: 'Lic. Sofía Ramos y tutores de grupo',
          entregable: 'Bitácora de seguimiento de tutorías e informe de casos atendidos.',
          periodo_inicio: 'Septiembre 2026',
          periodo_fin: 'Julio 2027',
        },
      ],
      metas_personales: [
        {
          nombre: 'Prof. Roberto González',
          cargo: 'Director',
          meta_individual: 'Gestionar el 100% de las reuniones de Consejo Técnico Escolar enfocadas a resultados PMC.',
          estrategia: 'Monitoreo mensual de avances de metas institucionales en sesión colegiada.',
          entregable: 'Minutas de CTE firmadas con acuerdos y evidencias.',
          periodo: 'Anual 2026-2027',
        },
        {
          nombre: 'Mtra. Elena Gómez',
          cargo: 'Docente Matemáticas',
          meta_individual: 'Diseñar e impartir 32 sesiones de regularización matemática activa.',
          estrategia: 'Uso de secuencias didácticas basadas en problemas de la comunidad.',
          entregable: 'Cuadernillo de reactivos resueltos por estudiantes en asesoría.',
          periodo: 'Semestral A y B',
        },
        {
          nombre: 'Lic. Sofía Ramos',
          cargo: 'Orientadora',
          meta_individual: 'Atender al 100% de estudiantes en riesgo de abandono canalizados por docentes.',
          estrategia: 'Entrevistas sociofamiliares y canalización institucional.',
          entregable: 'Expediente confidencial de casos de orientación concluidos.',
          periodo: 'Permanente',
        },
      ],
    },
    current_step: 6,
    status: 'completed',
  };

  const pmcAudit = calculateGlobalPmcScore(samplePmc);
  console.log(`Puntaje PMC: ${pmcAudit.totalScore}/${pmcAudit.maxPossibleScore} (${pmcAudit.percentage}%) - Estatus: ${pmcAudit.overallStatus}`);
  console.log(`Criterios: ${pmcAudit.passedCriteria} Aprobados, ${pmcAudit.warningCriteria} Con Observación, ${pmcAudit.failedCriteria} Fallidos.`);
  if (pmcAudit.percentage < 85) {
    throw new Error(`Fallo en evaluación PMC: esperado >= 85%, obtenido ${pmcAudit.percentage}%`);
  }
  console.log('Reporte PMC:\n' + formatPmcAuditReport(pmcAudit));

  // 2. Test PIPS Quality Gate
  console.log('\n2. Probando PIPS Quality Gate...');
  const samplePips: PipsProject = {
    zona_clave: '004',
    zona_nombre: 'Zona Escolar 004 Bachilleratos Generales',
    supervisor_name: 'Mtra. Patricia Morales Sandoval',
    municipio_sede: 'Puebla',
    municipios_atiende: 'Puebla, San Andrés Cholula, San Pedro Cholula',
    num_planteles: 12,
    subsistema: 'Bachilleratos Estatales',
    modalidad: 'Escolarizada',
    ciclo_escolar: '2026-2027',
    atps: 'Mtro. Fernando Castillo, Mtra. Gabriela Ortiz',
    presentacion_supervisor: 'El presente Plan de Intervención para la Práctica Supervisora (PIPS) articula las acciones de acompañamiento técnico-pedagógico para los 12 centros escolares adscritos a la Zona 004, priorizando la consolidación del MCCEMS y la convivencia armónica.',
    pips_anterior_realizado: true,
    reflexion_pips_anterior: 'En el ciclo escolar 2025-2026 se logró la visita presencial al 100% de planteles, detectando avances significativos en planeación docente.',
    fortalezas_anterior: 'Excelente disposición del colegiado docente y consolidación de los Consejos Técnicos de Zona.',
    areas_oportunidad_anterior: 'Fortalecer el acompañamiento formativo en evaluación auténtica y diversificar instrumentos de supervisión.',
    planteles_json: [
      { no: 1, cct: '21EBH0234Z', nombre: 'Héroes de la Patria', localidad: 'Puebla', municipio: 'Puebla', hombres: 210, mujeres: 210, total: 420 },
      { no: 2, cct: '21EBH0112A', nombre: 'Venustiano Carranza', localidad: 'Cholula', municipio: 'San Pedro Cholula', hombres: 180, mujeres: 190, total: 370 },
    ],
    diagnostico_contexto: 'La zona escolar 004 atiende a una matrícula consolidada de más de 3,500 estudiantes en 12 planteles. Predomina un contexto urbano y conurbado con amplia cobertura de conectividad pero con retos notables en deserción durante el primer año y necesidad de actualización en metodologías sociocríticas.',
    problematicas_json: [
      { id: 'prob1', titulo: 'Deserción en 1er año', descripcion: 'Transición secundaria-bachillerato con pérdida de matrícula.', prioridad: 'alta', planteles_afectados: ['21EBH0234Z'] },
      { id: 'prob2', titulo: 'Evaluación formativa', descripcion: 'Uso arraigado de exámenes tradicionales en detrimento de rúbricas auténticas.', prioridad: 'media', planteles_afectados: ['21EBH0112A'] },
    ],
    objetivo_general: 'Fortalecer la práctica docente y directiva mediante el acompañamiento técnico-pedagógico situado, asegurando la permanencia y el logro de aprendizajes significativos.',
    objetivos_especificos_json: [
      {
        id: 'obj1',
        numero: 1,
        descripcion: 'Disminuir el abandono escolar temprano en los planteles de la zona.',
        metas: [
          { meta: 'Lograr 95% de retención en primer semestre', indicador: 'Porcentaje de retención semestral', responsable: 'Supervisor y ATPs', fecha: 'Enero 2027' },
        ],
      },
      {
        id: 'obj2',
        numero: 2,
        descripcion: 'Acompañar a las academias docentes en la evaluación formativa bajo el MCCEMS.',
        metas: [
          { meta: 'Capacitar al 100% de docentes en diseño de rúbricas situadas', indicador: 'Docentes capacitados / total', responsable: 'Equipo ATP Zonal', fecha: 'Noviembre 2026' },
        ],
      },
    ],
    cronograma_json: [
      { actividad: 'Reunión de Consejo Técnico Zonal 1', objetivo: 'Encuadre y diagnóstico PIPS', responsable: 'Supervisora', mes: 'Septiembre', recursos: 'Guías DBEPA', indicador: 'Minuta de acuerdos firmada' },
      { actividad: 'Visita de asesoría técnica al Plantel Héroes', objetivo: 'Acompañamiento a planeaciones didácticas', responsable: 'ATP Mtro. Fernando', mes: 'Octubre', recursos: 'Rúbrica de observación', indicador: 'Ficha de visita entregada' },
      { actividad: 'Taller zonal de evaluación auténtica', objetivo: 'Diseño de instrumentos DUA/BAP', responsable: 'Equipo ATP', mes: 'Noviembre', recursos: 'Material digital', indicador: 'Portafolio de rúbricas' },
      { actividad: 'Evaluación de medio término PIPS', objetivo: 'Corte semestral de metas zonales', responsable: 'Supervisora', mes: 'Enero', recursos: 'Tablero de indicadores', indicador: 'Informe semestral 004' },
    ],
    evaluacion_json: [
      { indicador: 'Porcentaje de visitas diagnósticas realizadas', meta: '100% de planteles visitados', instrumento: 'Ficha de Visita de Supervisión DBEPA' },
      { indicador: 'Cumplimiento de metas de aprobación zonal', meta: 'Alcanzar el 88% de aprobación zonal', instrumento: 'Estadística 911 consolidada' },
    ],
    current_step: 8,
    status: 'completed',
  };

  const pipsAudit = calculateGlobalPipsScore(samplePips);
  console.log(`Puntaje PIPS: ${pipsAudit.totalScore}/${pipsAudit.maxPossibleScore} (${pipsAudit.percentage}%) - Estatus: ${pipsAudit.overallStatus}`);
  console.log(`Criterios: ${pipsAudit.passedCriteria} Aprobados, ${pipsAudit.warningCriteria} Con Observación, ${pipsAudit.failedCriteria} Fallidos.`);
  if (pipsAudit.percentage < 85) {
    throw new Error(`Fallo en evaluación PIPS: esperado >= 85%, obtenido ${pipsAudit.percentage}%`);
  }
  console.log('Reporte PIPS:\n' + formatPipsAuditReport(pipsAudit));

  // 3. Test SACRINT Course Manifest Export
  console.log('\n3. Probando SACRINT Course Manifest Exporter...');
  const samplePlanning: Planning = {
    id: 'plan-12345',
    teacherId: 'teacher-1',
    uacName: 'La Materia y sus Interacciones',
    semester: 1,
    component: 'fundamental',
    curriculumName: 'MCCEMS 2026-2027',
    paecContext: 'Agua limpia y saneamiento en el Valle de Tehuacán',
    extractedData: {},
    contentJson: {
      sectionI: {
        schoolName: 'Bachillerato Héroes de la Patria',
        cct: '21EBH0234Z',
        subsystem: 'BGE',
        teacherName: 'Prof. Juan Pérez',
      },
      sectionII: {
        learningOutcomes: ['Identifica la materia a nivel corpuscular y sus propiedades'],
      },
      sectionIV: {
        activities: [
          { name: 'Bloque 1: Materia y Enlaces', hours: 16 },
        ],
      },
    },
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleWorkbook: ActiveWorkTextbook = {
    planningId: 'plan-12345',
    blockIndex: 0,
    blockName: 'Bloque 1: Materia y Enlaces',
    uacName: 'La Materia y sus Interacciones',
    semester: 1,
    component: 'fundamental',
    academicHours: 16,
    totalWords: 5200,
    generatedAt: new Date().toISOString(),
    missions: [
      {
        missionIndex: 1,
        title: 'Misión 1: Estructura atómica y filtración comunitaria',
        coveredSessions: [1, 2],
        sessionTopic: 'El átomo y la materia',
        sessionFocus: 'Diferenciación de átomos y moléculas en filtros caseros',
        phenomenonHook: {
          story: 'En la junta auxiliar de San Lorenzo Teotipilco, los pozos presentan turbidez mineral...',
          detonatingQuestion: '¿Cómo interactúan las partículas minerales con el medio filtrante a nivel atómico?',
        },
        conceptZero: {
          physicalAnalogy: 'Imagina un colador de café donde solo ciertas partículas pueden deslizarse...',
          coreExplanation: 'La materia está formada por átomos que se enlazan formando moléculas con cargas específicas.',
        },
        iDoSection: {
          stepByStepDemo: 'Paso 1: Identificamos el solvente y el soluto...',
          visualOrDiagram: '<svg viewBox="0 0 500 300"><circle cx="250" cy="150" r="50" fill="#1B6B8A"/></svg>',
        },
        weDoSection: {
          guidedPractice: 'Construimos en equipo una tabla de densidades...',
          workbookElements: [],
        },
        youDoSection: {
          autonomousChallenge: 'Calcula la masa molecular del carbonato de calcio...',
          workbookElements: [],
        },
        troubleshooting: [
          {
            id: 't1',
            symptom: 'Confusión entre peso atómico y número atómico',
            rootCause: 'No distinguir entre protones y masa total',
            solutionSteps: ['Revisar tabla periódica', 'Contar neutrones'],
            preventionTip: 'Recuerda que Z es el número atómico',
          },
        ],
        formativeCheckpoint: {
          question: '¿Por qué la filtración mecánica no remueve sales disueltas?',
          reflectionPrompts: ['Analiza el tamaño de poro vs tamaño iónico'],
          criteriaChecklist: ['Explica solubilidad', 'Menciona enlaces químicos'],
        },
        wordCount: 1200,
      },
    ],
  };

  const manifest = exportSacrintCourseManifest(samplePlanning, [sampleWorkbook]);
  console.log(`Manifiesto generado versión ${manifest.manifestVersion} con ${manifest.modules.length} módulo(s).`);
  console.log(`Misión 1 visual: ${manifest.modules[0].missions[0].visualOrDiagram ? 'Presente' : 'Ausente'}`);
  console.log(`Auditoría Global: Grado ${manifest.globalPedagogicalAudit?.healthGrade}, HOTS ${manifest.globalPedagogicalAudit?.hotsPercentage}%`);
  if (!manifest.course.planningId || manifest.modules.length === 0) {
    throw new Error('Fallo en generación de manifiesto SACRINT');
  }

  // 4. Test Visual Asset Manager (Capa 0 determinístico)
  console.log('\n4. Probando Visual Asset Manager (Capa 0 determinístico)...');
  const visualResult = await resolveVisualForMission({
    uacName: 'Física I',
    blockIndex: 0,
    missionIndex: 1,
    missionTitle: 'Leyes de Newton y Movimiento Rectilíneo',
    contextText: 'Fuerza, masa y aceleración en rampas inclinadas',
    preferOpenverseForSciences: false,
  });

  console.log(`Visual resuelto: tipo ${visualResult?.type}, SVG longitud ${visualResult?.svg?.length || 0}`);
  if (!visualResult || visualResult.type !== 'vector_svg' || !visualResult.svg) {
    throw new Error('Fallo al resolver gráfico vectorial en Capa 0');
  }

  console.log('\n=== TODOS LOS TESTS DE LOTE 3 PASARON EXITOSAMENTE (100%) ===');
}

main().catch((err) => {
  console.error('Error en pruebas de Lote 3:', err);
  process.exit(1);
});
