import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { auditPaecProject } from '../src/lib/paec-validator';
import { generatePaecDocx } from '../src/lib/paec-docx-generator';
import type { PaecProject } from '../src/types/paec';

export async function runPaecE2ETest() {
  console.log('================================================================');
  console.log('  SIGPDA-EMS: PRUEBA E2E COMPLETA — PAEC CICLO A (PASOS 1-7)');
  console.log('================================================================\n');

  const results: { step: string; passed: boolean; details: string }[] = [];

  function record(step: string, passed: boolean, details: string) {
    results.push({ step, passed, details });
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${icon}] ${step}: ${details}`);
  }

  // --------------------------------------------------------------------------
  // 1. Configuración de Proyecto PAEC Ciclo A (Semestres 1, 3 y 5)
  // --------------------------------------------------------------------------
  const project: PaecProject = {
    id: 'paec-e2e-ciclo-a-2026',
    teacherId: 'teacher-e2e-001',
    projectName: 'Transformando Nuestra Comunidad: Campaña Escolar de Sostenibilidad y Salud Integral 2026',
    problemStatement: 'Acumulación desmedida de residuos sólidos, contaminación de áreas verdes comunales y hábitos alimenticios perjudiciales que afectan el bienestar de las familias y del entorno escolar.',
    cycleType: 'A',
    currentStep: 7,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),

    // Contexto
    communityContext: {
      location: 'San Pedro Cholula, Puebla',
      demographics: 'Localidad periurbana con 45,000 habitantes, alta densidad juvenil y actividades comerciales activas.',
      security: 'Zona con comités de vigilancia vecinal y rondines escolares coordinados.',
      environment: 'Generación diaria estimada de 1.2 kg de residuos por persona y déficit de áreas verdes públicas.',
    },
    schoolContext: {
      facilities: 'Bachillerato General Estatal con 14 aulas, laboratorio de ciencias, biblioteca y canchas de usos múltiples.',
      enrollment: '520 estudiantes matriculados en turnos matutino y vespertino.',
      teacherCount: '26 docentes activos con colegiado académico interdisciplinar.',
      activeLaboralUacs: ['Manejo de Residuos y Tecnologías Sustentables'],
      activeFfeUacs: ['Salud Integral I (CNET)', 'Derecho y Sociedad I (CS)'],
      groupsCount: '4',
      groupsConfig: '1°A, 1°B, 3°A, 5°A',
    },

    // PASO 1: Fase 1 Diagnóstico (Canonical Schema)
    fase1Diagnostico: {
      tabla1: [
        { col1: 'Acceso a servicios básicos', col2: '95% de cobertura de agua potable y red eléctrica pública' },
        { col1: 'Actividades económicas', col2: 'Comercio local, agricultura periurbana y servicios técnicos' },
        { col1: 'Equipamiento urbano', col2: 'Centros de salud, parques públicos y canchas deportivas' },
        { col1: 'Condiciones de vivienda', col2: 'Predominio de construcciones de concreto y tabique' },
        { col1: 'Conectividad y transporte', col2: 'Rutas colectivas urbanas e internet en el 80% de hogares' },
        { col1: 'Problemáticas ambientales', col2: 'Puntos clandestinos de tiro de basura en lotes baldíos' },
      ],
      tabla2: [
        { col1: 'Infraestructura física', col2: 'Aulas equipadas, laboratorios y áreas deportivas escolares' },
        { col1: 'Capital humano', col2: 'Docentes especialistas, alumnos motivados y padres colaboradores' },
        { col1: 'Vinculación comunitaria', col2: 'Alianzas con centros de salud y comités de vecinos' },
      ],
      tabla3: [
        { aspect: 'Fortalezas (F)', analysis: 'Cuerpo docente colegiado y alumnado participativo en actividades sociales.' },
        { aspect: 'Oportunidades (O)', analysis: 'Apoyo de organizaciones civiles ecológicas y programas municipales.' },
        { aspect: 'Debilidades (D)', analysis: 'Recursos limitados para recolección técnica y separación de plásticos.' },
        { aspect: 'Amenazas (A)', analysis: 'Falta de sanciones locales a tiraderos clandestinos y apatía comunitaria.' },
      ],
      tabla4: [
        { col1: 'Recuperación de información', col2: 'Aplicación de encuestas diagnósticas a 350 vecinos y padres de familia.' },
        { col1: 'Sistematización y análisis', col2: 'Sesión plenaria del Comité PAEC para jerarquizar prioridades comunitarias.' },
        { col1: 'Selección del problema', col2: 'Aprobación consensuada de la problemática de salud y manejo de residuos.' },
      ],
    },

    // PASO 2: Fase 2 Justificación y Propósitos
    fase2Justificacion: {
      projectName: 'Transformando Nuestra Comunidad: Campaña Escolar de Sostenibilidad y Salud Integral 2026',
      introduction: 'El presente Proyecto Escolar Comunitario (PEC) se fundamenta en los postulados de la Nueva Escuela Mexicana (NEM), buscando transformar la realidad socioambiental de la comunidad escolar a través de la integración de saberes disciplinares con la acción comunitaria directa. La acumulación desmedida de residuos sólidos y el deterioro de la salud ambiental demandan una respuesta pedagógica estructurada e interdisciplinar.',
      pilares: [
        'Pilar 1: Diagnóstico participativo y codiseño comunitario territorial',
        'Pilar 2: Articulación curricular transversal bajo el MCCEMS',
        'Pilar 3: Aprendizaje basado en proyectos de impacto social tangible',
        'Pilar 4: Sostenibilidad, economía circular y preservación ecológica',
        'Pilar 5: Rendición de cuentas, evaluación formativa y mejora continua',
      ],
      proposito: {
        educativo: 'Desarrollar en el estudiantado de 1°, 3° y 5° semestre una conciencia ecológica crítica mediante la aplicación práctica de saberes en Ciencias Naturales, Matemáticas, Lenguaje y Ciencias Sociales.',
        social: 'Vincular activamente a los comités vecinales y familias en jornadas quincenales de reciclaje y saneamiento de espacios públicos.',
        funcional: 'Instalar 4 estaciones escolares de separación de residuos y elaborar 100 composteros caseros con materiales reciclados.',
      },
      alcance: {
        metas: [
          'Meta 1: Disminuir en un 40% la generación de basura inorgánica no reciclada en el plantel escolar.',
          'Meta 2: Capacitar al 100% de los 520 alumnos en técnicas de separación en la fuente y reciclaje artesanal.',
          'Meta 3: Realizar 4 ferias comunitarias de concientización ambiental con participación de al menos 300 familias.',
          'Meta 4: Vincular el 100% de las UACs del Ciclo A con actividades formativas evaluables en el proyecto.',
        ],
        participantes: [
          'Directivos y personal administrativo',
          'Comité escolar colegiado de 26 docentes',
          '520 estudiantes de 1°, 3° y 5° semestre',
          'Familias y comités de vecinos de San Pedro Cholula',
        ],
        recursos: [
          'Instalaciones escolares y canchas deportivas',
          'Contenedores de acopio y básculas de pesaje',
        ],
      },
    },

    // PASO 3: Fase 2 Mapeo de UACs (Semestres 1, 3 y 5)
    fase2Mapeo: [
      // Semestre 1
      { semester: 1, uacName: 'Lengua y Comunicación I', uac: 'Lengua y Comunicación I', topic: 'Textos expositivos', linking: 'Redacción de folletos informativos comunitarios sobre el reciclaje' },
      { semester: 1, uacName: 'Pensamiento Matemático I', uac: 'Pensamiento Matemático I', topic: 'Estadística descriptiva', linking: 'Cálculo de volúmenes y medias de residuos generados por habitante' },
      { semester: 1, uacName: 'La Materia y sus Interacciones', uac: 'La Materia y sus Interacciones', topic: 'Propiedades de la materia', linking: 'Clasificación físico-química de polímeros y biodegradabilidad' },
      { semester: 1, uacName: 'Cultura Digital I', uac: 'Cultura Digital I', topic: 'Herramientas digitales', linking: 'Diseño de campañas digitales en redes sociales e infografías' },
      // Semestre 3
      { semester: 3, uacName: 'Lengua y Comunicación III', uac: 'Lengua y Comunicación III', topic: 'Ensayos y reportajes', linking: 'Elaboración de ensayos argumentativos sobre justicia socioambiental' },
      { semester: 3, uacName: 'Pensamiento Matemático III', uac: 'Pensamiento Matemático III', topic: 'Modelación algebraica', linking: 'Modelación de tasas de acopio y proyección de costos logísticos' },
      { semester: 3, uacName: 'Ecosistemas y Conservación', uac: 'Ecosistemas y Conservación', topic: 'Ciclos biogeoquímicos', linking: 'Estudio de suelos impactados y diseño de huertos agroecológicos' },
      { semester: 3, uacName: 'Cultura Digital III', uac: 'Cultura Digital III', topic: 'Gestión de datos', linking: 'Manejo de hojas de cálculo para el pesaje de reciclables acopiados' },
      // Semestre 5
      { semester: 5, uacName: 'Pensamiento Matemático V', uac: 'Pensamiento Matemático V', topic: 'Inferencia estadística', linking: 'Optimización de rutas de acopio y contraste de hipótesis de impacto' },
      { semester: 5, uacName: 'Ciencias Sociales V', uac: 'Ciencias Sociales V', topic: 'Políticas públicas', linking: 'Análisis de normatividad municipal y mecanismos de participación vecinal' },
      { semester: 5, uacName: 'Humanidades V', uac: 'Humanidades V', topic: 'Ética y responsabilidad', linking: 'Debates éticos sobre justicia climática y responsabilidad intergeneracional' },
      { semester: 5, uacName: 'Salud Integral I (CNET)', uac: 'Salud Integral I (CNET)', topic: 'Promoción comunitaria', linking: 'Prevención de vectores infecciosos y fauna nociva en focos de basura' },
    ],

    // PASO 4: Fase 2 Cronograma Macro (5 columnas)
    fase2Cronograma: [
      {
        phase: 'Fase 1: Diagnóstico y Sensibilización',
        objective: 'Identificar puntos críticos de basura y concientizar a la comunidad escolar',
        bimonthlyGoal: 'Identificar puntos críticos de basura y concientizar a la comunidad escolar',
        macroActivities: 'Levantamiento de encuestas diagnósticas y asamblea informativa con padres de familia',
        responsibleSubjects: 'Lengua y Comunicación I y Ciencias Sociales V: desarrollo del pensamiento analítico y deliberativo',
        semesterInvolved: '1° y 5° Semestre',
      },
      {
        phase: 'Fase 2: Planificación y Organización',
        objective: 'Diseñar el plan logístico de acopio y mapeo de brigadas estudiantiles',
        bimonthlyGoal: 'Diseñar el plan logístico de acopio y mapeo de brigadas estudiantiles',
        macroActivities: 'Formación de comités de aula y delimitación de áreas de trabajo escolar y comunal',
        responsibleSubjects: 'Cultura Digital I y Pensamiento Matemático III: gestión de datos e insumos',
        semesterInvolved: '1° y 3° Semestre',
      },
      {
        phase: 'Fase 3: Implementación de Infraestructura',
        objective: 'Habilitar centros de acopio y estaciones de separación en el plantel',
        bimonthlyGoal: 'Habilitar centros de acopio y estaciones de separación en el plantel',
        macroActivities: 'Construcción e instalación de 4 islas de reciclaje y composteros de materia orgánica',
        responsibleSubjects: 'La Materia y sus Interacciones y Ecosistemas: principios de degradación física',
        semesterInvolved: '1° y 3° Semestre',
      },
      {
        phase: 'Fase 4: Campaña de Acción Comunitaria',
        objective: 'Ejecutar brigadas comunitarias de recolección y canje ecológico',
        bimonthlyGoal: 'Ejecutar brigadas comunitarias de recolección y canje ecológico',
        macroActivities: 'Jornada sabatina de limpieza barrial y recolecta de envases plásticos y cartón',
        responsibleSubjects: 'Salud Integral I y Humanidades V: fomento de la corresponsabilidad cívica',
        semesterInvolved: '3° y 5° Semestre',
      },
      {
        phase: 'Fase 5: Difusión y Educación Abierta',
        objective: 'Presentar resultados preliminares en la Feria Escolar de Sostenibilidad',
        bimonthlyGoal: 'Presentar resultados preliminares en la Feria Escolar de Sostenibilidad',
        macroActivities: 'Exposición de prototipos reciclados, talleres infantiles y mesas de diálogo ecológico',
        responsibleSubjects: 'Lengua y Comunicación III y Cultura Digital III: divulgación científica',
        semesterInvolved: '3° Semestre',
      },
      {
        phase: 'Fase 6: Evaluación y Sistematización',
        objective: 'Medir el impacto cuantitativo y cualitativo y redactar memoria técnica',
        bimonthlyGoal: 'Medir el impacto cuantitativo y cualitativo y redactar memoria técnica',
        macroActivities: 'Análisis estadístico comparativo pre/post intervención y entrega de reconocimientos',
        responsibleSubjects: 'Pensamiento Matemático V y Dirección: informe colegiado final',
        semesterInvolved: '1°, 3° y 5° Semestre',
      },
    ],

    // PASO 5: Fase 2 Detalle Curricular (Matriz de 5 columnas - Nomenclatura NEM respetada)
    fase2DetalleCurricular: [
      {
        semester: 1,
        uacName: 'Lengua y Comunicación I',
        uac: 'Lengua y Comunicación I',
        progressionsOrPurposes: 'Propósito Formativo 2: Comunica asertivamente propuestas y recomendaciones para transformar positivamente su entorno comunitario.',
        projectPhases: 'Fase 1 y 5',
        projectPhase: 'Fase 1 y 5',
        curricularJustification: 'Permite a los estudiantes redactar instructivos y trípticos sobre la correcta separación de basura.',
      },
      {
        semester: 1,
        uacName: 'Pensamiento Matemático I',
        uac: 'Pensamiento Matemático I',
        progressionsOrPurposes: 'Propósito Formativo 4: Interpreta fenómenos socioambientales a través de tablas de frecuencias y medidas de tendencia central.',
        projectPhases: 'Fase 1 y 6',
        projectPhase: 'Fase 1 y 6',
        curricularJustification: 'Facilita la cuantificación en kilogramos de residuos plásticos acopiados semanalmente.',
      },
      {
        semester: 1,
        uacName: 'La Materia y sus Interacciones',
        uac: 'La Materia y sus Interacciones',
        progressionsOrPurposes: 'Propósito Formativo 3: Relaciona la estructura y composición de los materiales con su persistencia y degradación ecológica.',
        projectPhases: 'Fase 3',
        projectPhase: 'Fase 3',
        curricularJustification: 'Brinda sustento químico para comprender el impacto de los microplásticos en los mantos freáticos.',
      },
      {
        semester: 3,
        uacName: 'Pensamiento Matemático III',
        uac: 'Pensamiento Matemático III',
        progressionsOrPurposes: 'Propósito Formativo 5: Modela relaciones algebraicas y proyecciones lineales en contextos productivos sustentables.',
        projectPhases: 'Fase 2 y 6',
        projectPhase: 'Fase 2 y 6',
        curricularJustification: 'Permite proyectar el ahorro económico y la reducción de huella de carbono escolar.',
      },
      {
        semester: 3,
        uacName: 'Ecosistemas y Conservación',
        uac: 'Ecosistemas y Conservación',
        progressionsOrPurposes: 'Propósito Formativo 4: Formula alternativas viables de conservación y aprovechamiento equilibrado de los recursos naturales.',
        projectPhases: 'Fase 3 y 4',
        projectPhase: 'Fase 3 y 4',
        curricularJustification: 'Aporta la fundamentación ecológica para la elaboración del compostero y aprovechamiento de biorresiduos.',
      },
      {
        semester: 5,
        uacName: 'Pensamiento Matemático V',
        uac: 'Pensamiento Matemático V',
        progressionsOrPurposes: 'Progresión 10: Aplica la inferencia estadística para validar hipótesis de mejora en proyectos de impacto comunitario.',
        projectPhases: 'Fase 6',
        projectPhase: 'Fase 6',
        curricularJustification: 'Permite contrastar estadísticamente los niveles de satisfacción y reducción de residuos.',
      },
      {
        semester: 5,
        uacName: 'Ciencias Sociales V',
        uac: 'Ciencias Sociales V',
        progressionsOrPurposes: 'Progresión 8: Evalúa los mecanismos de participación ciudadana y gobernanza en la gestión de políticas medioambientales.',
        projectPhases: 'Fase 1 y 4',
        projectPhase: 'Fase 1 y 4',
        curricularJustification: 'Sustenta la organización vecinal y la vinculación con el marco normativo municipal de aseo urbano.',
      },
      {
        semester: 5,
        uacName: 'Salud Integral I (CNET)',
        uac: 'Salud Integral I (CNET)',
        progressionsOrPurposes: 'Progresión 6: Diseña estrategias de promoción comunitaria de la salud ambiental y entornos habitacionales dignos.',
        projectPhases: 'Fase 4',
        projectPhase: 'Fase 4',
        curricularJustification: 'Previene focos de infección por fauna nociva asociada a basureros clandestinos.',
      },
    ],

    // PASO 6: Fase 2 Plan Operativo Detallado (8 Columnas Oficiales)
    fase2PlanOperativo: {
      semestreA: [
        {
          phase: 'Fase 1: Diagnóstico',
          activity: 'Aplicación del cuestionario diagnóstico sobre generación de residuos en 350 hogares',
          uac: 'Lengua y Comunicación I',
          progression: 'Prop. 2',
          strategy: 'Aprendizaje Basado en Proyectos (ABP)',
          week: 'Semana 1-2',
          responsibles: 'Mtro. Juan Carlos López y Alumnos 1°A',
          responsible: 'Mtro. Juan Carlos López y Alumnos 1°A',
          evaluationInstrument: 'Rúbrica de levantamiento de campo',
        },
        {
          phase: 'Fase 1: Diagnóstico',
          activity: 'Consolidación de base de datos de volúmenes de residuos y cálculo de medias estadísticas',
          uac: 'Pensamiento Matemático I',
          progression: 'Prop. 4',
          strategy: 'Aprendizaje Basado en Indagación (STEAM)',
          week: 'Semana 3',
          responsibles: 'Ing. Patricia Domínguez y Alumnos 1°B',
          responsible: 'Ing. Patricia Domínguez y Alumnos 1°B',
          evaluationInstrument: 'Lista de cotejo de reporte estadístico',
        },
        {
          phase: 'Fase 2: Planificación',
          activity: 'Mapeo de zonas comunitarias prioritarias y conformación de brigadas juveniles',
          uac: 'Ciencias Sociales V',
          progression: 'Prog. 8',
          strategy: 'Aprendizaje en el Servicio (AS)',
          week: 'Semana 4-5',
          responsibles: 'Lic. Jorge Mendoza y Alumnos 5°A',
          responsible: 'Lic. Jorge Mendoza y Alumnos 5°A',
          evaluationInstrument: 'Escala estimativa de colaboración',
        },
        {
          phase: 'Fase 2: Planificación',
          activity: 'Elaboración del presupuesto de contenedores ecológicos con madera reciclada',
          uac: 'Pensamiento Matemático III',
          progression: 'Prop. 5',
          strategy: 'Resolución de Problemas Reales',
          week: 'Semana 6',
          responsibles: 'Mtro. Luis Fernando Aguilar y Alumnos 3°A',
          responsible: 'Mtro. Luis Fernando Aguilar y Alumnos 3°A',
          evaluationInstrument: 'Rúbrica de presupuesto analítico',
        },
        {
          phase: 'Fase 3: Infraestructura',
          activity: 'Taller de clasificación molecular de polímeros y construcción de 4 islas de separación',
          uac: 'La Materia y sus Interacciones',
          progression: 'Prop. 3',
          strategy: 'Prácticas Experimentales de Taller',
          week: 'Semana 7-8',
          responsibles: 'Dra. Carmen Salinas y Alumnos 1°A/1°B',
          responsible: 'Dra. Carmen Salinas y Alumnos 1°A/1°B',
          evaluationInstrument: 'Guía de observación técnica',
        },
        {
          phase: 'Fase 3: Infraestructura',
          activity: 'Instalación de letreros informativos y módulos de compostaje escolar',
          uac: 'Ecosistemas y Conservación',
          progression: 'Prop. 4',
          strategy: 'Laboratorio Vivo Agroecológico',
          week: 'Semana 9',
          responsibles: 'Biól. Sandra Morales y Alumnos 3°A',
          responsible: 'Biól. Sandra Morales y Alumnos 3°A',
          evaluationInstrument: 'Rúbrica de compostero funcional',
        },
        {
          phase: 'Fase 4: Campaña Comunitaria',
          activity: 'Megajornada comunitaria de limpieza de áreas verdes y acopio de plástico PET',
          uac: 'Salud Integral I (CNET)',
          progression: 'Prog. 6',
          strategy: 'Jornada Comunitaria de Servicio',
          week: 'Semana 10-12',
          responsibles: 'Dra. Verónica Méndez y Alumnos 5°A',
          responsible: 'Dra. Verónica Méndez y Alumnos 5°A',
          evaluationInstrument: 'Registro anecdótico de participación',
        },
        {
          phase: 'Fase 4: Campaña Comunitaria',
          activity: 'Diseño de infografías digitales y cápsulas para redes sociales comunitarias',
          uac: 'Cultura Digital I',
          progression: 'Prop. 2',
          strategy: 'Producción de Contenido Digital',
          week: 'Semana 10',
          responsibles: 'Mtro. Héctor Cruz y Alumnos 1°A',
          responsible: 'Mtro. Héctor Cruz y Alumnos 1°A',
          evaluationInstrument: 'Rúbrica de producto digital',
        },
        {
          phase: 'Fase 2: Planificación',
          activity: 'Estructuración de base de datos en hoja de cálculo en la nube para registro de pesaje',
          uac: 'Cultura Digital III',
          progression: 'Prop. 4',
          strategy: 'Gestión Colaborativa de Datos',
          week: 'Semana 5',
          responsibles: 'Mtra. Lucía Herrera y Alumnos 3°A',
          responsible: 'Mtra. Lucía Herrera y Alumnos 3°A',
          evaluationInstrument: 'Lista de cotejo de base de datos',
        },
        {
          phase: 'Fase 4: Campaña Comunitaria',
          activity: 'Círculos de diálogo y debate ético sobre justicia climática y responsabilidad intergeneracional',
          uac: 'Humanidades V',
          progression: 'Prog. 7',
          strategy: 'Comunidad de Diálogo Filosófico',
          week: 'Semana 11',
          responsibles: 'Lic. Fernando Ortiz y Alumnos 5°A',
          responsible: 'Lic. Fernando Ortiz y Alumnos 5°A',
          evaluationInstrument: 'Guía de observación de debate ético',
        },
        {
          phase: 'Fase 5: Difusión',
          activity: 'Montaje de stands en la Feria Ambiental Comunitaria y demostración de reciclaje',
          uac: 'Lengua y Comunicación III',
          progression: 'Prop. 3',
          strategy: 'Muestra Pública de Aprendizaje',
          week: 'Semana 13-14',
          responsibles: 'Mtra. Ana Luisa Gómez y Alumnos 3°A',
          responsible: 'Mtra. Ana Luisa Gómez y Alumnos 3°A',
          evaluationInstrument: 'Rúbrica de exposición oral formal',
        },
        {
          phase: 'Fase 6: Evaluación',
          activity: 'Pruebas de hipótesis estadística sobre reducción de residuos e informe comparativo',
          uac: 'Pensamiento Matemático V',
          progression: 'Prog. 10',
          strategy: 'Análisis de Datos Cuantitativos',
          week: 'Semana 15',
          responsibles: 'Mtro. David Ramos y Alumnos 5°A',
          responsible: 'Mtro. David Ramos y Alumnos 5°A',
          evaluationInstrument: 'Reporte de inferencia estadística',
        },
        {
          phase: 'Fase 6: Evaluación',
          activity: 'Asamblea final de rendición de cuentas ante autoridades comunales y padres',
          uac: 'Comité PAEC Colegiado',
          progression: 'Integral',
          strategy: 'Encuentro Cívico Comunitario',
          week: 'Semana 16',
          responsibles: 'Dirección del Plantel y Colegiado Docente',
          responsible: 'Dirección del Plantel y Colegiado Docente',
          evaluationInstrument: 'Acta de sesión plenaria y firmas',
        },
      ],
      semestreB: [],
    },

    // PASO 7: Fase 2 Anexos Técnicos (6 Anexos Estructurados)
    fase2Anexos: {
      anexo1Minuta: {
        cct: '21EBH0245M',
        fecha: '15 de Septiembre de 2026',
        tipoReunion: 'Instalación Oficial del Comité Escolar Comunitario PAEC',
        acuerdos: [
          { no: 1, acuerdo: 'Aprobar por unanimidad el proyecto de Sostenibilidad y Manejo de Residuos 2026', responsable: 'Comité Plenario', fechaLimite: '15/09/2026', estatus: 'Cumplido' },
          { no: 2, acuerdo: 'Designar docentes enlaces para las brigadas estudiantiles de 1°, 3° y 5° semestre', responsable: 'Mtra. Carmen Salinas', fechaLimite: '22/09/2026', estatus: 'Cumplido' },
          { no: 3, acuerdo: 'Establecer los días viernes como jornadas fijas de pesaje y separación de materiales', responsable: 'Mtro. Luis Fernando Aguilar', fechaLimite: '29/09/2026', estatus: 'En Proceso' },
        ],
        firmas: [
          { cargo: 'Director del Plantel', nombre: 'Mtro. Roberto Hernández Morales' },
          { cargo: 'Presidente del Comité de Padres', nombre: 'Sr. Manuel Cordero Téllez' },
          { cargo: 'Coordinadora Académica', nombre: 'Dra. Carmen Salinas Ruiz' },
          { cargo: 'Representante Estudiantil', nombre: 'Alumna Sofía Castro Nieto' },
        ],
      },
      anexo2Seguimiento: [
        { semana: 'Semana 1', fase: 'Fase 1', uac: 'Lengua y Comunicación I', metaOperativa: 'Instalación del Comité y difusión inicial del proyecto', evidencia: 'Minuta de asamblea escolar', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 2', fase: 'Fase 1', uac: 'Lengua y Comunicación I', metaOperativa: 'Aplicar 350 encuestas diagnósticas en la comunidad', evidencia: 'Formatos de encuesta capturados', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 3', fase: 'Fase 1', uac: 'Pensamiento Matemático I', metaOperativa: 'Procesar datos cuantitativos del diagnóstico socioambiental', evidencia: 'Gráficas de tendencia y reporte estadístico', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 4', fase: 'Fase 2', uac: 'Ciencias Sociales V', metaOperativa: 'Mapeo territorial de basureros clandestinos y puntos de acopio', evidencia: 'Croquis comunitario y brigadas asignadas', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 5', fase: 'Fase 2', uac: 'Cultura Digital III', metaOperativa: 'Creación de la base de datos digital para control de residuos', evidencia: 'Hoja de cálculo compartida en la nube', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 6', fase: 'Fase 2', uac: 'Pensamiento Matemático III', metaOperativa: 'Elaborar presupuesto analítico de materiales para estaciones', evidencia: 'Presupuesto firmado y cotizado', avancePorcentaje: 95, semaforo: 'verde' },
        { semana: 'Semana 7', fase: 'Fase 3', uac: 'La Materia y sus Interacciones', metaOperativa: 'Taller de clasificación molecular de plásticos y separación', evidencia: 'Muestrario de polímeros y bitácora técnica', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 8', fase: 'Fase 3', uac: 'La Materia y sus Interacciones', metaOperativa: 'Construir e instalar 4 islas ecológicas en el plantel', evidencia: '4 islas operando con señalética reglamentaria', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 9', fase: 'Fase 3', uac: 'Ecosistemas y Conservación', metaOperativa: 'Construcción de dos composteros escolares para cafetería', evidencia: 'Módulos de compostaje en funcionamiento', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 10', fase: 'Fase 4', uac: 'Cultura Digital I', metaOperativa: 'Lanzamiento de campaña multimedia en redes comunitarias', evidencia: 'Infografías y videos publicados', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 11', fase: 'Fase 4', uac: 'Humanidades V', metaOperativa: 'Círculo de diálogo reflexivo sobre justicia socioambiental', evidencia: 'Relatoría ética y manifiesto escolar', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 12', fase: 'Fase 4', uac: 'Salud Integral I (CNET)', metaOperativa: 'Megajornada comunitaria de limpieza barrial y recolecta PET', evidencia: 'Boletas de pesaje del centro de reciclaje (850 kg)', avancePorcentaje: 95, semaforo: 'verde' },
        { semana: 'Semana 13', fase: 'Fase 5', uac: 'Lengua y Comunicación III', metaOperativa: 'Redacción de guiones y preparación de stands para feria', evidencia: 'Ensayos y paneles temáticos validados', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 14', fase: 'Fase 5', uac: 'Lengua y Comunicación III', metaOperativa: 'Celebración de la Feria Escolar Comunitaria de Sostenibilidad', evidencia: 'Memoria fotográfica y 320 visitantes registrados', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 15', fase: 'Fase 6', uac: 'Pensamiento Matemático V', metaOperativa: 'Análisis inferencial pre/post intervención y contraste de metas', evidencia: 'Reporte técnico estadístico de impacto', avancePorcentaje: 100, semaforo: 'verde' },
        { semana: 'Semana 16', fase: 'Fase 6', uac: 'Pensamiento Matemático V', metaOperativa: 'Asamblea final de rendición de cuentas y entrega de memoria', evidencia: 'Acta de sesión plenaria y firmas de clausura', avancePorcentaje: 100, semaforo: 'verde' },
      ],
      anexo3ReporteMensual: {
        periodo: 'Septiembre - Noviembre 2026 (Bimestre I)',
        resumenEjecutivo: 'Durante el primer bimestre del ciclo 2026-2027 se logró la plena instalación del Comité PAEC y la adopción de las estaciones de reciclaje por los semestres impares (1°, 3° y 5°).',
        logros: [
          'Acopio de 1,240 kg de plástico y cartón durante los dos primeros meses de operación.',
          'Participación de más de 480 estudiantes en talleres formativos transversales de aula.',
          'Construcción de 2 composteros escolares para residuos orgánicos de cafetería.',
        ],
        dificultades: [
          'Espacio reducido de resguardo de material reciclable antes de su transporte al centro de acopio.',
          'Puntualidad en la entrega de reportes semanales por parte de dos academias docentes.',
        ],
        accionesAjuste: [
          'Habilitación de una bodega techada auxiliar en la parte posterior del taller escolar.',
          'Implementación de un formulario digital en Google Forms para el reporte ágil de pesajes.',
        ],
      },
      anexo4ImpactoComunidad: {
        titulo: 'Cuestionario de Percepción e Impacto Ambiental Comunitario',
        tipoAplicacion: 'PRE/POST',
        reactivos: [
          { reactivo: '1. Se percibe una reducción visible de basura plástica tirada en las calles colindantes al bachillerato.', dimension: 'Impacto en el Entorno Físico' },
          { reactivo: '2. Las brigadas estudiantiles transmiten información útil y práctica sobre el reciclaje en los hogares.', dimension: 'Apropiación del Conocimiento' },
          { reactivo: '3. Las familias del vecindario han adoptado el hábito de separar residuos orgánicos e inorgánicos en casa.', dimension: 'Transformación de Hábitos' },
          { reactivo: '4. La colaboración entre la escuela y la comunidad fortalece la seguridad y el tejido social del barrio.', dimension: 'Cohesión Social y Convivencia' },
          { reactivo: '5. Considera que el proyecto PAEC debe continuar y ampliarse en los siguientes ciclos escolares.', dimension: 'Sostenibilidad Comunitaria' },
        ],
        escala: {
          '1': 'Totalmente en desacuerdo',
          '2': 'En desacuerdo',
          '3': 'Neutro / Indiferente',
          '4': 'De acuerdo',
          '5': 'Totalmente de acuerdo',
        },
      },
      anexo5AutoevaluacionEstudiantes: {
        titulo: 'Cuestionario de Autoevaluación del Aprendizaje y Compromiso Social Estudiantil',
        tipoAplicacion: 'FINAL',
        reactivos: [
          { reactivo: '1. Comprendí cómo los conceptos teóricos de mis materias se aplican en la solución de problemas reales de mi localidad.', dimension: 'Aprendizaje Significativo' },
          { reactivo: '2. Participé activamente con mi equipo de brigada en las tareas de campo y en la elaboración de evidencias.', dimension: 'Trabajo Colaborativo' },
          { reactivo: '3. Desarrollé mayor empatía y compromiso con el cuidado del medio ambiente y la salud de mi comunidad.', dimension: 'Responsabilidad Cívica' },
          { reactivo: '4. Mejoré mis habilidades de comunicación oral y escrita al interactuar con vecinos y compañeros.', dimension: 'Competencias Comunicativas' },
          { reactivo: '5. Me siento orgulloso del impacto logrado por nuestro plantel en beneficio del entorno comunitario.', dimension: 'Sentido de Pertenencia' },
        ],
        escala: {
          '1': 'Nunca',
          '2': 'Raras veces',
          '3': 'Ocasionalmente',
          '4': 'Casi siempre',
          '5': 'Siempre',
        },
      },
      anexo6EvaluacionColegiado: {
        titulo: 'Cuestionario de Evaluación del Trabajo Docente Colegiado e Interdisciplinariedad',
        tipoAplicacion: 'FINAL',
        reactivos: [
          { reactivo: '1. Las reuniones de colegiado permitieron una coordinación efectiva entre distintas áreas del conocimiento.', dimension: 'Interdisciplinariedad' },
          { reactivo: '2. Las progresiones y propósitos formativos de mi UAC se vincularon coherentemente con las fases del proyecto.', dimension: 'Alineación Curricular MCCEMS' },
          { reactivo: '3. Los instrumentos de evaluación formativa permitieron valorar el desempeño auténtico del alumnado.', dimension: 'Evaluación Auténtica' },
          { reactivo: '4. La participación del Comité Escolar Comunitario facilitó el acceso y respaldo en la comunidad.', dimension: 'Gobernanza del Proyecto' },
          { reactivo: '5. La experiencia del PAEC fortaleció la cultura de trabajo cooperativo entre el personal docente del plantel.', dimension: 'Cultura Institucional' },
        ],
        escala: {
          '1': 'Muy Insatisfactorio',
          '2': 'Insatisfactorio',
          '3': 'Regular',
          '4': 'Satisfactorio',
          '5': 'Altamente Satisfactorio',
        },
      },
    },
  };

  // --------------------------------------------------------------------------
  // VERIFICACIÓN 1: Paso 3 incluye semestres 1, 3 y 5 (Ciclo A)
  // --------------------------------------------------------------------------
  const semestersInMapeo = Array.from(new Set(project.fase2Mapeo?.map(m => m.semester) || []));
  const hasSem1 = semestersInMapeo.includes(1);
  const hasSem3 = semestersInMapeo.includes(3);
  const hasSem5 = semestersInMapeo.includes(5);
  const step3Valid = hasSem1 && hasSem3 && hasSem5 && (project.fase2Mapeo?.length || 0) >= 10;
  record(
    'Paso 3 (Mapeo UACs Ciclo A)',
    step3Valid,
    `Semestres presentes: [${semestersInMapeo.join(', ')}]. Total filas UAC: ${project.fase2Mapeo?.length}`
  );

  // --------------------------------------------------------------------------
  // VERIFICACIÓN 2: Paso 5 genera la matriz curricular
  // --------------------------------------------------------------------------
  const detalleRows = project.fase2DetalleCurricular || [];
  const detalleValid = detalleRows.length >= 6 && detalleRows.every(r => 
    r.semester && 
    (r.uacName || (r as any).uac) && 
    (r.progressionsOrPurposes || (r as any).progressions) && 
    (r.projectPhases || (r as any).projectPhase) && 
    r.curricularJustification
  );
  record(
    'Paso 5 (Matriz Curricular)',
    detalleValid,
    `Total registros en matriz: ${detalleRows.length}. Cada fila contiene semestre, UAC, progresión, fase y justificación curricular.`
  );

  // --------------------------------------------------------------------------
  // VERIFICACIÓN 3: Paso 6 genera 8 columnas
  // --------------------------------------------------------------------------
  const operativeRows = project.fase2PlanOperativo?.semestreA || [];
  const requiredCols = ['phase', 'activity', 'uac', 'progression', 'strategy', 'week', 'responsible', 'evaluationInstrument'];
  const hasAll8Cols = operativeRows.length >= 8 && operativeRows.every(r => requiredCols.every(col => (r as any)[col] !== undefined && (r as any)[col] !== ''));
  record(
    'Paso 6 (Plan Operativo 8 Columnas)',
    hasAll8Cols,
    `Total actividades: ${operativeRows.length}. Todas cumplen las 8 columnas oficiales: [${requiredCols.join(', ')}].`
  );

  // --------------------------------------------------------------------------
  // VERIFICACIÓN 4: Paso 7 genera los 6 anexos técnicos estructurados
  // --------------------------------------------------------------------------
  const anexos = project.fase2Anexos;
  const hasAnexo1 = !!anexos?.anexo1Minuta?.acuerdos?.length && !!anexos?.anexo1Minuta?.firmas?.length;
  const hasAnexo2 = !!anexos?.anexo2Seguimiento?.length && (anexos?.anexo2Seguimiento?.length || 0) >= 4;
  const hasAnexo3 = !!anexos?.anexo3ReporteMensual?.logros?.length && !!anexos?.anexo3ReporteMensual?.dificultades?.length;
  const hasAnexo4 = !!anexos?.anexo4ImpactoComunidad?.reactivos?.length && (anexos?.anexo4ImpactoComunidad?.reactivos?.length || 0) >= 4;
  const hasAnexo5 = !!anexos?.anexo5AutoevaluacionEstudiantes?.reactivos?.length && (anexos?.anexo5AutoevaluacionEstudiantes?.reactivos?.length || 0) >= 4;
  const hasAnexo6 = !!anexos?.anexo6EvaluacionColegiado?.reactivos?.length && (anexos?.anexo6EvaluacionColegiado?.reactivos?.length || 0) >= 4;
  const step7Valid = hasAnexo1 && hasAnexo2 && hasAnexo3 && hasAnexo4 && hasAnexo5 && hasAnexo6;
  record(
    'Paso 7 (6 Anexos Técnicos Estructurados)',
    step7Valid,
    `Anexo 1 (Minuta con firmas): ${hasAnexo1} | Anexo 2 (Seguimiento semáforo): ${hasAnexo2} | Anexo 3 (Reporte mensual): ${hasAnexo3} | Anexo 4 (Impacto Likert): ${hasAnexo4} | Anexo 5 (Autoevaluación): ${hasAnexo5} | Anexo 6 (Colegiado): ${hasAnexo6}`
  );

  // --------------------------------------------------------------------------
  // VERIFICACIÓN 5: Ejecución del Auditor de Calidad (23 Criterios DBEPA/NEM)
  // --------------------------------------------------------------------------
  console.log('\n--- Ejecutando Auditoría de Calidad Técnica PAEC (23 Criterios) ---');
  const auditResult = auditPaecProject(project);
  auditResult.criteria.filter(c => c.status !== 'pass').forEach(c => {
    console.log(`[AUDIT ${c.status.toUpperCase()}] ${c.id} - ${c.name}: ${c.feedback}`);
  });
  const auditScoreValid = auditResult.percentage >= 90 && auditResult.status === 'aprobado_excelente' && auditResult.summary.failedCount === 0;
  record(
    'Auditor de Calidad (23 Criterios)',
    auditScoreValid,
    `Puntaje: ${auditResult.totalScore}/92 (${auditResult.percentage}%) | Estatus: ${auditResult.status} | Pasados: ${auditResult.summary.passedCount} | Advertencias: ${auditResult.summary.warningCount} | Fallidos: ${auditResult.summary.failedCount}`
  );

  // --------------------------------------------------------------------------
  // VERIFICACIÓN 6: Generación y Validación de DOCX con las 9 Secciones Nativas
  // --------------------------------------------------------------------------
  console.log('\n--- Generando Documento Word Oficial (DOCX con 9 Secciones) ---');
  const docxBuffer = await generatePaecDocx(project);
  const docxSize = docxBuffer.length;
  const docxValid = docxSize > 25000; // Expected >25 KB
  const docxOutputPath = path.join(process.cwd(), 'scratch', 'test_paec_e2e_cycle_a.docx');
  writeFileSync(docxOutputPath, docxBuffer);
  record(
    'Generador DOCX (9 Secciones Nativas)',
    docxValid,
    `Tamaño generado: ${docxSize} bytes (~${(docxSize / 1024).toFixed(1)} KB). Archivo guardado en: ${docxOutputPath}`
  );

  // Resumen Final
  const allPassed = results.every(r => r.passed);
  console.log('\n================================================================');
  console.log(`  RESULTADO GLOBAL E2E: ${allPassed ? '✅ TODOS LOS CHECKS PASARON EXITOSAMENTE' : '❌ SE ENCONTRARON FALLOS'}`);
  console.log(`  Total verificaciones: ${results.length} | Aprobadas: ${results.filter(r => r.passed).length}`);
  console.log('================================================================\n');

  return { allPassed, results, auditResult, docxSize, docxOutputPath };
}

if (require.main === module) {
  runPaecE2ETest().then((res) => {
    if (!res.allPassed) {
      process.exit(1);
    }
  }).catch((err) => {
    console.error('Error en prueba E2E:', err);
    process.exit(1);
  });
}
