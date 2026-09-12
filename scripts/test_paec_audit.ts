import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { auditPaecProject } from '../src/lib/paec-validator';
import type { PaecProject } from '../src/types/paec';
import { neon } from '@neondatabase/serverless';

async function runAuditValidation() {
  console.log('================================================================');
  console.log('  SIGPDA-EMS: VALIDACIÓN FASE 6 — AUDITOR DE CALIDAD PAEC (23)');
  console.log('================================================================\n');

  const checks: { name: string; passed: boolean; details: any }[] = [];

  function assertCheck(name: string, condition: boolean, details: any) {
    checks.push({ name, passed: condition, details });
    const status = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`[${status}] ${name}`);
    if (!condition) {
      console.error('   Error details:', details);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Proyecto 100% Cumplido — Nivel Excelente (Todos los 23 Criterios)
  // --------------------------------------------------------------------------
  console.log('--- 1. Auditando Proyecto Excelente (Cumplimiento Total de 23 Criterios) ---');

  const uacNames = [
    'Lengua y Comunicación I',
    'Pensamiento Matemático I',
    'Cultura Digital I',
    'La Materia y sus Interacciones',
    'Lengua y Comunicación III',
    'Pensamiento Matemático III',
    'Cultura Digital III',
    'Ecosistemas y Conservación',
    'Pensamiento Matemático V',
    'Ciencias Sociales V',
    'Humanidades V',
    'Lengua Extranjera V',
  ];

  const perfectProject: PaecProject = {
    id: 'test-audit-perfect-001',
    teacherId: 'teacher-001',
    projectName: 'Eco-Comunidad Sustentable 2026-2027: Manejo Integral de Residuos',
    problemStatement: 'Manejo inadecuado de residuos sólidos y falta de cultura ecológica en el entorno escolar y comunitario',
    cycleType: 'A',
    currentStep: 7,
    communityContext: {
      location: 'San Pedro Cholula, Puebla',
      demographics: 'Comunidad periurbana con 45,000 habitantes',
      security: 'Zona con comités vecinales activos',
      environment: 'Generación de 1.2 kg de residuos por persona al día',
    },
    schoolContext: {
      facilities: 'Bachillerato General Estatal con 12 aulas y laboratorio',
      enrollment: '480 estudiantes',
      teacherCount: '24 docentes colegiados',
    },
    fase1Diagnostico: {
      tabla1: [
        { col1: 'Ubicación geográfica', col2: 'Entorno semiurbano colindante con parcelas escolares' },
        { col1: 'Situación demográfica', col2: 'Familias con promedio de 4 integrantes' },
        { col1: 'Situación socioeconómica', col2: 'Actividades de comercio, servicios y agricultura' },
        { col1: 'Situación sociocultural', col2: 'Tradiciones comunitarias y faenas colectivas' },
        { col1: 'Seguridad y convivencia', col2: 'Vigilancia comunitaria y redes escolares' },
        { col1: 'Participación comunitaria', col2: 'Comités de padres de familia y comités vecinales' },
        { col1: 'Recursos y servicios', col2: 'Agua entubada, drenaje y electricidad general' },
        { col1: 'Situación medioambiental', col2: 'Falta de separación en la fuente de desechos sólidos' },
      ],
      tabla2: [
        { col1: 'Cobertura educativa', col2: 'Atención al 85% de la demanda en la microrregión' },
        { col1: 'Contexto familiar', col2: 'Padres de familia trabajadores con escolaridad secundaria' },
        { col1: 'Características estudiantado', col2: 'Jóvenes participativos con interés ecológico' },
        { col1: 'Infraestructura plantel', col2: '12 aulas didácticas, biblioteca y canchas' },
        { col1: 'Indicadores académicos', col2: 'Aprobación del 88% y eficiencia terminal del 82%' },
        { col1: 'Programas previos', col2: 'Proyectos de reciclaje escolar en ciclos pasados' },
      ],
      tabla3: [
        { aspect: 'Fortalezas (F)', analysis: 'Cuerpo docente capacitado en la NEM y comités activos.' },
        { aspect: 'Oportunidades (O)', analysis: 'Vinculación con el centro de acopio municipal.' },
        { aspect: 'Debilidades (D)', analysis: 'Falta de contenedores diferenciados en el plantel.' },
        { aspect: 'Amenazas (A)', analysis: 'Tiraderos clandestinos en terrenos baldíos aledaños.' },
      ],
      tabla4: [
        { col1: 'Recuperación de información', col2: 'Aplicación de encuestas vecinales y diagnóstico escolar.' },
        { col1: 'Sistematización y análisis', col2: 'Tabulación de datos y priorización en sesión de colegiado.' },
        { col1: 'Selección del problema', col2: 'Consenso colectivo para enfocar el PAEC en residuos sólidos.' },
      ],
    },
    fase2Justificacion: {
      projectName: 'Eco-Comunidad Sustentable 2026-2027: Manejo Integral de Residuos',
      introduction: 'La presente justificación técnica aborda con rigor metodológico los cuatro factores sustantivos de la problemática: Magnitud situacional que afecta a más de 480 estudiantes y familias colindantes; Interés colectivo patente en las asambleas escolares; Factibilidad operativa mediante recursos propios del plantel y alianzas locales; y Oportunidad histórica de consolidar los ejes formativos de la Nueva Escuela Mexicana.',
      pilares: [
        'Pilar 1: Cultura ambiental y bioética social',
        'Pilar 2: Salud comunitaria y entornos dignos',
        'Pilar 3: Transversalidad curricular en el MCCEMS',
        'Pilar 4: Participación democrática de la comunidad',
        'Pilar 5: Innovación escolar y reciclaje técnico',
      ],
      proposito: {
        educativo: 'Consolidar propósitos formativos y progresiones de aprendizaje en sustentabilidad ambiental.',
        social: 'Erradicar puntos de acumulación de basura y sensibilizar a la población circundante.',
        funcional: 'Instalar una estación modular de reciclaje y composta escolar autosostenible.',
      },
      alcance: {
        metas: [
          'Meta 1: Reducir un 40% la generación de basura escolar en el ciclo 2026-2027.',
          'Meta 2: Instalar 6 puntos limpios de separación orgánica e inorgánica.',
          'Meta 3: Capacitar al 100% de la comunidad estudiantil y 150 familias vecinas.',
          'Meta 4: Lograr el 90% de aprobación en las UACs transversales del proyecto.',
        ],
        participantes: [
          'Directivos: Liderazgo institucional y gestión',
          'Docentes: Diseño y articulación didáctica',
          'Estudiantes: Ejecución protagónica de brigadas',
          'Comunidad: Colaboración en recolección y talleres',
        ],
        recursos: [
          'Materiales de separación y compostaje',
          'Aulas audiovisuales para talleres',
          'Contenedores clasificados institucionales',
        ],
      },
    },
    fase2Mapeo: uacNames.map((name, i) => ({
      semester: i < 4 ? 1 : i < 8 ? 3 : 5,
      uacName: name,
      topic: 'Sustentabilidad y análisis situacional',
      linking: i < 8
        ? 'Aporta los propósitos formativos esenciales para comprender el fenómeno.'
        : 'Desarrolla la progresión de aprendizaje orientada a soluciones complejas.',
    })),
    fase2Cronograma: [
      {
        phase: 'Fase I: Diagnóstico y Sensibilización (Sep-Oct)',
        objective: 'Reconocer el impacto ambiental de los residuos en la comunidad.',
        macroActivities: 'Aplicación de encuestas y mapeo de tiraderos clandestinos.',
        responsibleSubjects: 'Ciencias Sociales y Humanidades',
        semesterInvolved: '1°, 3° y 5° Semestre',
      },
      {
        phase: 'Fase II: Diseño de Estrategias y Contenedores (Nov-Dic)',
        objective: 'Proyectar los prototipos de separación de residuos y estaciones escolares.',
        macroActivities: 'Cálculo de volúmenes y diseño técnico de contenedores.',
        responsibleSubjects: 'Pensamiento Matemático y Cultura Digital',
        semesterInvolved: '1°, 3° y 5° Semestre',
      },
      {
        phase: 'Fase III: Campaña Escolar de Acopio (Ene-Feb)',
        objective: 'Implementar brigadas estudiantiles de recolección y clasificación.',
        macroActivities: 'Instalación de contenedores y pesaje semanal de plástico y cartón.',
        responsibleSubjects: 'La Materia y sus Interacciones',
        semesterInvolved: '1°, 3° y 5° Semestre',
      },
      {
        phase: 'Fase IV: Transformación y Composta Orgánica (Mar-Abr)',
        objective: 'Aprovechar residuos orgánicos de la cafetería escolar para abono.',
        macroActivities: 'Construcción de cama de lombricomposta y huerto escolar.',
        responsibleSubjects: 'Ecosistemas y Conservación',
        semesterInvolved: '3° y 5° Semestre',
      },
      {
        phase: 'Fase V: Vinculación Comunitaria y Feria Ecológica (Mayo)',
        objective: 'Presentar resultados del proyecto a padres de familia y autoridades.',
        macroActivities: 'Feria demostrativa de reciclaje y foro vecinal de sustentabilidad.',
        responsibleSubjects: 'Lengua y Comunicación y Ciencias Sociales',
        semesterInvolved: '1°, 3° y 5° Semestre',
      },
      {
        phase: 'Fase VI: Evaluación y Rendición de Cuentas (Junio)',
        objective: 'Sistematizar la experiencia y evaluar el impacto del proyecto.',
        macroActivities: 'Redacción del informe final para supervisión y entrega de reconocimientos.',
        responsibleSubjects: 'Cuerpo Colegiado Docente',
        semesterInvolved: 'Todos los semestres',
      },
    ],
    fase2DetalleCurricular: uacNames.map((name, i) => ({
      semester: i < 4 ? 1 : i < 8 ? 3 : 5,
      uacName: name,
      progressionsOrPurposes: i < 8
        ? 'Propósito Formativo: Comprende el impacto de las actividades humanas en el entorno local.'
        : 'Progresión 4: Modela fenómenos de degradación ambiental mediante herramientas matemáticas.',
      projectPhases: 'Fases I, II y III',
      curricularJustification: 'Permite fundamentar teórica y cuantitativamente la propuesta de reciclaje comunitario.',
    })),
    fase2PlanOperativo: {
      semestreA: uacNames.map((name, i) => ({
        phase: `Fase ${(i % 6) + 1}`,
        activity: `Diseño y ejecución de actividad transversal para ${name}`,
        uac: name,
        progression: i < 8 ? 'Propósito Formativo Institucional' : 'Progresión 4',
        strategy: 'Aprendizaje Basado en Proyectos Comunitarios (ABPC)',
        week: `Semana ${(i % 16) + 1}`,
        responsibles: 'Docente titular y brigada estudiantil',
        evaluationInstrument: 'Rúbrica analítica formativa',
      })),
      semestreB: [],
    },
    fase2Anexos: {
      anexo1Minuta: {
        cct: '21EBH0123Z',
        fecha: '2026-09-08',
        tipoReunion: 'Reunión Ordinaria de Instalación Colegiada',
        acuerdos: [
          { no: 1, acuerdo: 'Aprobar el proyecto escolar comunitario', responsable: 'Director', fechaLimite: '2026-09-15', estatus: 'Cumplido' },
          { no: 2, acuerdo: 'Conformar brigadas ecológicas estudiantiles', responsable: 'Coordinador', fechaLimite: '2026-09-22', estatus: 'En proceso' },
        ],
        firmas: [
          { cargo: 'Director del Plantel', nombre: 'Mtro. Roberto Hernández' },
          { cargo: 'Coordinador PAEC', nombre: 'Mtra. Elena Vázquez' },
          { cargo: 'Representante Comunitario', nombre: 'C. Juan Morales' },
          { cargo: 'Representante Estudiantil', nombre: 'Est. Sofía Torres' },
        ],
      },
      anexo2Seguimiento: Array.from({ length: 16 }, (_, idx) => ({
        semana: `Semana ${idx + 1}`,
        fase: `Fase ${Math.floor(idx / 3) + 1}`,
        uac: uacNames[idx % uacNames.length],
        metaOperativa: `Cumplimiento de la meta de la semana ${idx + 1}`,
        evidencia: `Bitácora de campo y producto de la semana ${idx + 1}`,
        avancePorcentaje: Math.min(100, (idx + 1) * 6),
        semaforo: idx < 12 ? 'verde' : 'amarillo',
      })),
      anexo3ReporteMensual: {
        periodo: 'Septiembre - Octubre 2026',
        resumenEjecutivo: 'Inicio exitoso de la etapa diagnóstica comunitaria.',
        logros: ['100% de docentes integrados', 'Estaciones de reciclaje aprobadas'],
        dificultades: ['Retraso en entrega de madera para contenedores'],
        accionesAjuste: ['Uso provisional de materiales reutilizados del plantel'],
      },
      anexo4ImpactoComunidad: {
        titulo: 'Encuesta de Impacto Comunitario (PRE/POST)',
        reactivos: [
          { reactivo: 'La comunidad cuenta con cultura de separación de residuos.', dimension: 'Cultura Ambiental' },
          { reactivo: 'El bachillerato se vincula positivamente con los vecinos.', dimension: 'Sinergia Social' },
          { reactivo: 'Se observa menor acumulación de basura en calles aledañas.', dimension: 'Entorno Físico' },
          { reactivo: 'Los vecinos participan en las convocatorias del plantel.', dimension: 'Participación' },
          { reactivo: 'Las familias conocen los proyectos ecológicos escolares.', dimension: 'Difusión' },
          { reactivo: 'El proyecto beneficia directamente a la salud colectiva.', dimension: 'Impacto en Salud' },
        ],
        escala: { '1': 'Totalmente en desacuerdo', '5': 'Totalmente de acuerdo' },
      },
      anexo5AutoevaluacionEstudiantes: {
        titulo: 'Rúbrica de Autoevaluación Estudiantil',
        reactivos: [
          { reactivo: 'Participé activamente en las brigadas de acopio y reciclaje.', dimension: 'Compromiso' },
          { reactivo: 'Colaboré de forma respetuosa y solidaria con mis compañeros.', dimension: 'Trabajo en equipo' },
          { reactivo: 'Apliqué conocimientos de mis asignaturas en el proyecto.', dimension: 'Aprendizaje cognitivo' },
          { reactivo: 'Propuse ideas y soluciones para optimizar la separación.', dimension: 'Iniciativa' },
          { reactivo: 'Reconozco el valor de cuidar el entorno de mi comunidad.', dimension: 'Conciencia ciudadana' },
          { reactivo: 'Entregué mis evidencias y tareas en los tiempos establecidos.', dimension: 'Responsabilidad' },
        ],
        escala: { '1': 'Nunca', '5': 'Siempre' },
      },
      anexo6EvaluacionColegiado: {
        titulo: 'Evaluación del Trabajo Colegiado Interdisciplinar',
        reactivos: [
          { reactivo: 'Existió coordinación efectiva entre docentes de diferentes UACs.', dimension: 'Interdisciplinariedad' },
          { reactivo: 'Se articularon los propósitos formativos con el proyecto.', dimension: 'Alineación Curricular' },
          { reactivo: 'Las sesiones de colegiado permitieron resolver contingencias.', dimension: 'Gobernanza' },
          { reactivo: 'Se aplicaron instrumentos de evaluación técnica transparentes.', dimension: 'Evaluación Formativa' },
          { reactivo: 'Se promovió el protagonismo estudiantil auténtico.', dimension: 'Pedagogía NEM' },
          { reactivo: 'Se mantuvo comunicación constante con directivos y familias.', dimension: 'Vinculación Social' },
        ],
        escala: { '1': 'Insuficiente', '5': 'Excelente' },
      },
    },
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const auditPerfect = auditPaecProject(perfectProject);
  console.log(`Puntuación Proyecto Excelente: ${auditPerfect.totalScore}/100 (${auditPerfect.status})`);
  console.log(`Resumen: ${auditPerfect.summary.passedCount} aprobados, ${auditPerfect.summary.warningCount} advertencias, ${auditPerfect.summary.failedCount} no aprobados`);

  assertCheck('PERFECT_23_CRITERIA_EVALUATED', auditPerfect.criteria.length === 23, { count: auditPerfect.criteria.length });
  assertCheck('PERFECT_SCORE_100', auditPerfect.totalScore === 100 && auditPerfect.percentage === 100, { score: auditPerfect.totalScore });
  assertCheck('PERFECT_STATUS_EXCELENTE', auditPerfect.status === 'aprobado_excelente', { status: auditPerfect.status });
  assertCheck('PERFECT_ALL_23_PASS', auditPerfect.summary.passedCount === 23 && auditPerfect.summary.failedCount === 0 && auditPerfect.summary.warningCount === 0, {
    passed: auditPerfect.summary.passedCount,
    warnings: auditPerfect.summary.warningCount,
    failed: auditPerfect.summary.failedCount,
  });

  // --------------------------------------------------------------------------
  // TEST 2: Verificación Detallada de cada uno de los 23 Criterios en Proyecto Excelente
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Verificación Individual de Criterios C1 a C23 ---');
  for (let i = 1; i <= 23; i++) {
    const crit = auditPerfect.criteria.find(c => c.id === i);
    assertCheck(`CRITERION_C${i}_${crit?.name.substring(0, 25)}`, crit?.score === 4 && crit?.status === 'pass', {
      id: crit?.id,
      name: crit?.name,
      score: crit?.score,
      status: crit?.status,
    });
  }

  // --------------------------------------------------------------------------
  // TEST 3: Proyecto Deficiente / Incompleto (Paso 1 sin datos)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Auditando Proyecto Deficiente / Incompleto (Paso 1) ---');
  const deficientProject: PaecProject = {
    id: 'test-audit-deficient',
    teacherId: 'teacher-003',
    projectName: '',
    problemStatement: '',
    cycleType: 'A',
    currentStep: 1,
    communityContext: {} as any,
    schoolContext: {} as any,
    fase1Diagnostico: null,
    fase2Justificacion: null,
    fase2Mapeo: null,
    fase2Cronograma: null,
    fase2DetalleCurricular: null,
    fase2PlanOperativo: null,
    fase2Anexos: null,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const auditDeficient = auditPaecProject(deficientProject);
  console.log(`Puntuación Proyecto Incompleto: ${auditDeficient.totalScore}/100 (${auditDeficient.status})`);
  console.log(`Fallas detectadas: ${auditDeficient.summary.failedCount}/23`);

  assertCheck('AUDIT_DEFICIENT_REQUIRES_ADJUSTMENTS', auditDeficient.status === 'requiere_ajustes', { status: auditDeficient.status });
  assertCheck('AUDIT_DEFICIENT_LOW_SCORE', auditDeficient.percentage < 50, { score: auditDeficient.percentage });
  assertCheck('AUDIT_DEFICIENT_MULTIPLE_FAILS', auditDeficient.summary.failedCount >= 15, { fails: auditDeficient.summary.failedCount });

  // --------------------------------------------------------------------------
  // TEST 4: Prueba de Integración con Base de Datos (Simulando Endpoint de Auditoría)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Prueba de Integración con Base de Datos (Endpoint Logic) ---');
  const envPath = path.resolve('.env.local');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
    if (match) {
      const sql = neon(match[1]);

      const teachers = await sql`SELECT id, name, email FROM teachers LIMIT 1;`;
      if (teachers.length > 0) {
        const teacher = teachers[0];
        console.log(`Docente de prueba en BD: ${teacher.name} (${teacher.email})`);

        // Insertar temporalmente el proyecto perfecto en BD
        const insertRes = await sql`
          INSERT INTO paec_projects (
            teacher_id, project_name, problem_statement, cycle_type,
            community_context, school_context, current_step, status,
            fase1_diagnostico, fase2_justificacion, fase2_mapeo,
            fase2_cronograma, fase2_detalle_curricular, fase2_plan_operativo, fase2_anexos
          ) VALUES (
            ${teacher.id}::uuid,
            ${perfectProject.projectName},
            ${perfectProject.problemStatement},
            ${perfectProject.cycleType},
            ${JSON.stringify(perfectProject.communityContext)}::jsonb,
            ${JSON.stringify(perfectProject.schoolContext)}::jsonb,
            7,
            'completed',
            ${JSON.stringify(perfectProject.fase1Diagnostico)}::jsonb,
            ${JSON.stringify(perfectProject.fase2Justificacion)}::jsonb,
            ${JSON.stringify(perfectProject.fase2Mapeo)}::jsonb,
            ${JSON.stringify(perfectProject.fase2Cronograma)}::jsonb,
            ${JSON.stringify(perfectProject.fase2DetalleCurricular)}::jsonb,
            ${JSON.stringify(perfectProject.fase2PlanOperativo)}::jsonb,
            ${JSON.stringify(perfectProject.fase2Anexos)}::jsonb
          )
          RETURNING id;
        `;

        const insertedId = insertRes[0].id;
        console.log(`Proyecto insertado en BD con ID: ${insertedId}`);

        // Leerlo con la lógica del endpoint GET /api/paec/[id]/audit
        const rows = await sql`
          SELECT * FROM paec_projects WHERE id = ${insertedId}::uuid AND teacher_id = ${teacher.id}::uuid;
        `;
        const raw = rows[0];

        const dbProject: PaecProject = {
          id: raw.id,
          teacherId: raw.teacher_id,
          projectName: raw.project_name,
          problemStatement: raw.problem_statement,
          cycleType: raw.cycle_type,
          currentStep: raw.current_step,
          communityContext: raw.community_context || {},
          schoolContext: raw.school_context || {},
          fase1Diagnostico: raw.fase1_diagnostico || null,
          fase2Justificacion: raw.fase2_justificacion || null,
          fase2Mapeo: raw.fase2_mapeo || null,
          fase2Cronograma: raw.fase2_cronograma || null,
          fase2DetalleCurricular: raw.fase2_detalle_curricular || null,
          fase2PlanOperativo: raw.fase2_plan_operativo || null,
          fase2Anexos: raw.fase2_anexos || null,
          status: raw.status,
          createdAt: raw.created_at,
          updatedAt: raw.updated_at,
        };

        const dbAudit = auditPaecProject(dbProject);
        assertCheck('DB_PROJECT_AUDITED_PERFECT', dbAudit.percentage === 100 && dbAudit.status === 'aprobado_excelente', {
          id: insertedId,
          score: dbAudit.percentage,
          status: dbAudit.status,
        });

        // Limpiar el registro de prueba de la BD
        await sql`DELETE FROM paec_projects WHERE id = ${insertedId}::uuid;`;
        console.log(`Proyecto de prueba eliminado limpiamente de la BD.`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Resumen Final
  // --------------------------------------------------------------------------
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  console.log('\n================================================================');
  console.log(`  RESULTADOS DE VALIDACIÓN: ${passed}/${checks.length} PRUEBAS PASADAS`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditValidation().catch(err => {
  console.error('Error fatal durante la validación del auditor:', err);
  process.exit(1);
});
