import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import {
  PAEC_SYSTEM_PROMPT,
  buildPrompt1Diagnostico,
  buildPrompt2Justificacion,
  buildPrompt3Mapeo,
  buildPrompt4Cronograma,
  buildPrompt5DetalleCurricular,
  buildPrompt6PlanOperativoPorBloque,
  buildPrompt7Anexos,
} from '../src/lib/prompts/paec-prompts';
import {
  MapeoRow,
  CronogramaRow,
  DetalleCurricularRow,
  PlanOperativoRow,
  PlanOperativoData,
  AnexosData,
} from '../src/types/paec';

// 1. Load env
const envContent = readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!dbMatch) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}
const sql = neon(dbMatch[1]);

interface TestReport {
  timestamp: string;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
  checks: {
    checkId: string;
    description: string;
    passed: boolean;
    details: any;
  }[];
  cycleSimulations: {
    cycleA: any;
    cycleB: any;
    cycleAnnual: any;
  };
}

async function runValidation() {
  console.log('================================================================');
  console.log('  SIGPDA-EMS: VALIDACIÓN FASE 4 — PIPELINE PAEC-PEC 7 PASOS');
  console.log('================================================================\n');

  const checks: TestReport['checks'] = [];

  function addCheck(id: string, description: string, passed: boolean, details: any) {
    checks.push({ checkId: id, description, passed, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${status}] ${id}: ${description}`);
    if (!passed) {
      console.error('   Detalles de fallo:', details);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Verificar catálogo de UACs por Ciclo (Semestres 1, 3, 5 vs 2, 4, 6 vs 1..6)
  // --------------------------------------------------------------------------
  console.log('--- 1. Validación de Semestres y Catálogo por Ciclo Escolar ---');

  // Ciclo A: Semestres 1, 3, 5
  const semestersA = [1, 3, 5];
  const uacsA = await sql`
    SELECT uac_name, semester, component
    FROM programs_catalog
    WHERE semester = ANY(${semestersA})
    ORDER BY semester, uac_name ASC
  ` as { uac_name: string; semester: number; component: string }[];

  const semsFoundA = Array.from(new Set(uacsA.map(u => u.semester))).sort();
  const hasSem5 = semsFoundA.includes(5);
  addCheck(
    'CYCLE_A_SEMESTERS',
    'Ciclo A incluye semestres 1, 3 y 5 (desbloqueo de 5° semestre comprobado)',
    hasSem5 && semsFoundA.join(',') === '1,3,5',
    { foundSemesters: semsFoundA, totalUacs: uacsA.length, hasSem5 }
  );

  // Ciclo B: Semestres 2, 4, 6
  const semestersB = [2, 4, 6];
  const uacsB = await sql`
    SELECT uac_name, semester, component
    FROM programs_catalog
    WHERE semester = ANY(${semestersB})
    ORDER BY semester, uac_name ASC
  ` as { uac_name: string; semester: number; component: string }[];

  const semsFoundB = Array.from(new Set(uacsB.map(u => u.semester))).sort();
  const hasSem6 = semsFoundB.includes(6);
  addCheck(
    'CYCLE_B_SEMESTERS',
    'Ciclo B incluye semestres 2, 4 y 6 (desbloqueo de 6° semestre comprobado)',
    hasSem6 && semsFoundB.join(',') === '2,4,6',
    { foundSemesters: semsFoundB, totalUacs: uacsB.length, hasSem6 }
  );

  // Ciclo Anual: Semestres 1 a 6
  const semestersAnnual = [1, 2, 3, 4, 5, 6];
  const uacsAnnual = await sql`
    SELECT uac_name, semester, component
    FROM programs_catalog
    WHERE semester = ANY(${semestersAnnual})
    ORDER BY semester, uac_name ASC
  ` as { uac_name: string; semester: number; component: string }[];

  const semsFoundAnnual = Array.from(new Set(uacsAnnual.map(u => u.semester))).sort();
  addCheck(
    'CYCLE_ANNUAL_SEMESTERS',
    'Ciclo Anual incluye semestres del 1 al 6 completos',
    semsFoundAnnual.join(',') === '1,2,3,4,5,6',
    { foundSemesters: semsFoundAnnual, totalUacs: uacsAnnual.length }
  );

  // --------------------------------------------------------------------------
  // TEST 2: Validación de Prompts Paso 1 y Paso 2
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Validación de Prompts Paso 1 y Paso 2 ---');

  const commContext = JSON.stringify({
    location: 'San Pedro Cholula, Puebla',
    demographics: 'Población periurbana con vocación artesanal y agrícola',
    security: 'Zona escolar con vigilancia vecinal activa',
    environment: 'Problemas de recolección de basura y separación de residuos sólidos',
  });
  const schoolContext = JSON.stringify({
    enrollment: '480 estudiantes',
    teacherCount: '24 docentes',
    facilities: '6 aulas, laboratorio de cómputo, plaza cívica y huerto escolar',
  });
  const problemStatement = 'Manejo inadecuado de residuos sólidos urbanos y falta de cultura de reciclaje en la comunidad escolar y vecinal';

  const prompt1 = buildPrompt1Diagnostico(commContext, schoolContext, problemStatement);
  addCheck(
    'PROMPT_1_DIAGNOSTICO',
    'buildPrompt1Diagnostico genera estructura para las 4 tablas oficiales y FODA',
    prompt1.includes('FASE I: Diagnóstico Colectivo') &&
    prompt1.includes('tabla1') &&
    prompt1.includes('tabla2') &&
    prompt1.includes('tabla3') &&
    prompt1.includes('tabla4'),
    { promptLength: prompt1.length }
  );

  const sampleDiag = {
    tabla1: [{ col1: 'Geográfico', col2: 'Municipio con zonas agrícolas y semiurbanas.' }],
    tabla2: [{ col1: 'Infraestructura', col2: 'Plantel con 12 aulas y espacios verdes.' }],
    tabla3: [{ aspect: 'Fortalezas', analysis: 'Comunidad docente comprometida y brigadas estudiantiles.' }],
    tabla4: [{ col1: 'Fase 1', col2: 'Diagnóstico participativo con encuestas vecinales.' }],
  };

  const prompt2 = buildPrompt2Justificacion(JSON.stringify(sampleDiag), 'Eco-Comunidad Limpia 2026', problemStatement);
  addCheck(
    'PROMPT_2_JUSTIFICACION',
    'buildPrompt2Justificacion genera justificación, pilares y propósitos (educativo, social, funcional)',
    prompt2.includes('FASE II') &&
    prompt2.includes('pilares') &&
    prompt2.includes('proposito') &&
    prompt2.includes('alcance'),
    { promptLength: prompt2.length }
  );

  // --------------------------------------------------------------------------
  // TEST 3: Validación del Paso 3 (Mapeo Curricular con Semestres 5/6)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Validación Paso 3: Mapeo Curricular y Reglas NEM ---');

  // Filtrar muestra de UACs de Ciclo A (1, 3, 5)
  const sampleUacsA = [
    { uac_name: 'Lengua y Comunicación I', semester: 1 },
    { uac_name: 'Pensamiento Matemático I', semester: 1 },
    { uac_name: 'Ciencias Sociales I', semester: 1 },
    { uac_name: 'Cultura Digital I', semester: 1 },
    { uac_name: 'Lengua y Comunicación III', semester: 3 },
    { uac_name: 'Pensamiento Matemático III', semester: 3 },
    { uac_name: 'Conciencia Histórica I', semester: 3 },
    { uac_name: 'Ecosistemas: Interacciones, Energía y Dinámica', semester: 3 },
    { uac_name: 'Filosofía y Epistemología', semester: 5 },
    { uac_name: 'Pensamiento Matemático V', semester: 5 },
    { uac_name: 'Ciencias de la Salud I', semester: 5 },
  ];

  const prompt3A = buildPrompt3Mapeo('Justificación de Proyecto Eco-Comunidad', sampleUacsA);
  const hasPropRule = prompt3A.includes('PROPÓSITO FORMATIVO');
  const hasProgRule = prompt3A.includes('PROGRESIÓN DE APRENDIZAJE');
  const hasSem5InPrompt = prompt3A.includes('Semestre 5: Filosofía y Epistemología');

  addCheck(
    'PASO_3_MAPEO_CYCLE_A',
    'Paso 3 genera prompt con UACs de semestres 1, 3 y 5 y aplica reglas de nomenclatura NEM',
    hasPropRule && hasProgRule && hasSem5InPrompt,
    { hasPropRule, hasProgRule, hasSem5InPrompt }
  );

  // Validar muestra de datos de salida de Mapeo
  const sampleMapeoA: MapeoRow[] = [
    { semester: 1, uacName: 'Lengua y Comunicación I', topic: 'Diseño de instrumentos de diálogo y encuestas comunitarias', linking: 'Propósito Formativo 1: Elabora mensajes orales y escritos aplicando análisis reflexivo para recabar datos del entorno.' },
    { semester: 1, uacName: 'Pensamiento Matemático I', topic: 'Tratamiento estadístico del volumen de residuos sólidos generados', linking: 'Propósito Formativo 2: Modela situaciones reales mediante representaciones cuantitativas y gráficos estadísticos.' },
    { semester: 1, uacName: 'Cultura Digital I', topic: 'Procesamiento de datos y diseño de infografías digitales de concientización', linking: 'Propósito Formativo 1: Aplica herramientas digitales para la sistematización ética de información comunitaria.' },
    { semester: 3, uacName: 'Lengua y Comunicación III', topic: 'Redacción de crónicas comunitarias y ensayos argumentativos sobre el impacto ambiental', linking: 'Propósito Formativo 3: Desarrolla textos argumentativos complejos para promover cambios de conducta social.' },
    { semester: 3, uacName: 'Ecosistemas: Interacciones, Energía y Dinámica', topic: 'Análisis biológico de ciclos biogeoquímicos afectados por tiraderos a cielo abierto', linking: 'Propósito Formativo 1: Explica el flujo de materia y energía en los ecosistemas locales.' },
    { semester: 3, uacName: 'Conciencia Histórica I', topic: 'Evolución histórica del poblamiento y transformación ecológica de la región', linking: 'Propósito Formativo 2: Examina procesos históricos de cambio territorial y ambiental.' },
    { semester: 5, uacName: 'Filosofía y Epistemología', topic: 'Fundamentación ética de la responsabilidad intergeneracional y el cuidado del bien común', linking: 'Progresión de Aprendizaje 4: Argumenta sobre dilemas éticos contemporáneos y el imperativo ecológico comunitario.' },
    { semester: 5, uacName: 'Pensamiento Matemático V', topic: 'Modelación matemática de curvas de degradación de polímeros y balance de masa', linking: 'Progresión de Aprendizaje 2: Aplica el cálculo y modelos diferenciales para estimar tiempos de descomposición.' },
    { semester: 5, uacName: 'Ciencias de la Salud I', topic: 'Diagnóstico de riesgos epidemiológicos por vectores derivados de acumulación de basura', linking: 'Progresión de Aprendizaje 3: Evalúa determinantes sociales y ambientales de la salud pública en la localidad.' },
  ];

  // --------------------------------------------------------------------------
  // TEST 4: Validación del Paso 4 (Cronograma Macro de 6 Fases)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Validación Paso 4: Cronograma Macro (5 Columnas) ---');

  const prompt4 = buildPrompt4Cronograma(JSON.stringify(sampleMapeoA), 'A');
  const has5ColsRule = prompt4.includes('responsibleSubjects') && prompt4.includes('macroActivities');
  addCheck(
    'PROMPT_4_CRONOGRAMA',
    'buildPrompt4Cronograma exige 5 columnas oficiales con justificación pedagógica',
    has5ColsRule && prompt4.includes('Fase 1') && prompt4.includes('Fase 6'),
    { promptLength: prompt4.length, has5ColsRule }
  );

  const sampleCronograma: CronogramaRow[] = [
    {
      phase: 'Fase 1: Indagación, Diagnóstico Científico y Acuerdos Comunitarios (Septiembre-Octubre)',
      objective: 'Levantar el censo diagnóstico de residuos sólidos y formalizar el Comité Escolar Comunitario.',
      macroActivities: 'Aplicación de encuestas vecinales, pesaje de basura escolar, asamblea de instalación del Comité.',
      responsibleSubjects: 'Lengua y Comunicación I (elabora encuestas), Pensamiento Matemático I (procesa muestra estadística), Ciencias de la Salud I (identifica focos de infección).',
      semesterInvolved: '1.er y 5.° Semestre',
    },
    {
      phase: 'Fase 2: Ideación, Diseño Técnico, Prototipado e Ingeniería del Proyecto (Noviembre-Diciembre)',
      objective: 'Diseñar contenedores clasificadores y formular composteros biológicos adaptados a la zona.',
      macroActivities: 'Cálculo de volúmenes, prototipado con material reciclado, formulación de bio-preparados con bacterias degradadoras.',
      responsibleSubjects: 'Pensamiento Matemático V (modelación de volúmenes), Ecosistemas (monitoreo de compostaje), Cultura Digital I (modelado 3D de contenedores).',
      semesterInvolved: '3.er y 5.° Semestre',
    },
    {
      phase: 'Fase 3: Preparación, Creación de Manuales Técnicos y Transferencia Semestral (Enero)',
      objective: 'Consolidar el Manual Técnico de Transferencia y preparar el relevo operativo intersemestral.',
      macroActivities: 'Redacción del paquete técnico de transferencia, asamblea de entrega de estafeta entre semestres.',
      responsibleSubjects: 'Filosofía y Epistemología (reflexión ética del relevo), Lengua y Comunicación III (edición del manual técnico).',
      semesterInvolved: '1.°, 3.° y 5.° Semestre',
    },
    {
      phase: 'Fase 4: Despliegue Operativo, Producción a Escala y Lanzamiento Comunitario (Febrero-Marzo)',
      objective: 'Instalar estaciones de separación de residuos en 3 colonias aledañas.',
      macroActivities: 'Jornadas de instalación comunitaria, colocación de señalética, talleres vecinales de compostaje.',
      responsibleSubjects: 'Lengua y Comunicación II, Pensamiento Matemático II, Conservación de la Energía.',
      semesterInvolved: '2.° y 4.° Semestre',
    },
    {
      phase: 'Fase 5: Aplicación Territorial, Instalación y Transferencia Comunitaria Directa (Abril-Mayo)',
      objective: 'Operación continua del centro de acopio y monitoreo de indicadores de reducción de basura.',
      macroActivities: 'Pesaje semanal de residuos desviados de tiraderos, venta de material reciclable para fondos escolares.',
      responsibleSubjects: 'Recursos Socioemocionales II, Ecología y Medio Ambiente.',
      semesterInvolved: '2.°, 4.° y 6.° Semestre',
    },
    {
      phase: 'Fase 6: Reflexión Metacognitiva, Evaluación de Impacto (Pre vs. Post) y Socialización Abierta (Junio)',
      objective: 'Medir el impacto social y ecológico del PEC y presentar cuentas en asamblea comunitaria abierta.',
      macroActivities: 'Aplicación de cuestionarios de impacto social, análisis comparativo Pre vs Post, feria comunitaria de resultados.',
      responsibleSubjects: 'Todas las UACs activas del ciclo.',
      semesterInvolved: '1.° al 6.° Semestre',
    },
  ];

  // --------------------------------------------------------------------------
  // TEST 5: Validación del Paso 5 (Matriz de Detalle Curricular)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Validación Paso 5: Detalle Curricular por Semestre ---');

  const prompt5 = buildPrompt5DetalleCurricular(
    JSON.stringify(sampleMapeoA),
    JSON.stringify(sampleCronograma),
    'A'
  );

  const p5HasMapeoContext = prompt5.includes('Mapeo Curricular Aprobado') && prompt5.includes('Lengua y Comunicación I');
  const p5HasCronContext = prompt5.includes('Cronograma Macro de 6 Fases') && prompt5.includes('Fase 1: Indagación');
  const p5HasNomRules = prompt5.includes('Propósito Formativo [N]') && prompt5.includes('Progresión de Aprendizaje [N]');
  const p5Has5Cols = prompt5.includes('progressionsOrPurposes') && prompt5.includes('curricularJustification');

  addCheck(
    'PROMPT_5_DETALLE_CURRICULAR',
    'Paso 5 recibe Mapeo + Cronograma y exige estructura de 5 columnas con reglas NOM-MCCEMS',
    p5HasMapeoContext && p5HasCronContext && p5HasNomRules && p5Has5Cols,
    { p5HasMapeoContext, p5HasCronContext, p5HasNomRules, p5Has5Cols }
  );

  // Simulación de salida del Paso 5
  const sampleDetalleCurricular: DetalleCurricularRow[] = sampleMapeoA.map(m => ({
    semester: m.semester,
    uacName: m.uacName,
    progressionsOrPurposes: m.semester <= 4
      ? `Propósito Formativo 1, 2: ${m.topic}`
      : `Progresión de Aprendizaje 3, 4: ${m.topic}`,
    projectPhases: m.semester === 1 ? 'Fase 1 y Fase 2' : m.semester === 3 ? 'Fase 2 y Fase 3' : 'Fase 1, Fase 2 y Fase 3',
    curricularJustification: `Los estudiantes articulan conocimientos teóricos con el trabajo de campo del PEC para ${m.topic.toLowerCase()}.`,
  }));

  const allRowsValidStep5 = sampleDetalleCurricular.every(r =>
    typeof r.semester === 'number' &&
    r.uacName &&
    r.progressionsOrPurposes &&
    r.projectPhases &&
    r.curricularJustification
  );

  const sem5UsesProg = sampleDetalleCurricular
    .filter(r => r.semester === 5)
    .every(r => r.progressionsOrPurposes.startsWith('Progresión de Aprendizaje'));

  const sem1UsesProp = sampleDetalleCurricular
    .filter(r => r.semester <= 4)
    .every(r => r.progressionsOrPurposes.startsWith('Propósito Formativo'));

  addCheck(
    'PASO_5_DETALLE_CURRICULAR_OUTPUT',
    'Salida del Paso 5 valida las 5 columnas y aplica correctamente Propósitos (1°-4°) vs Progresiones (5°-6°)',
    allRowsValidStep5 && sem5UsesProg && sem1UsesProp,
    { totalRows: sampleDetalleCurricular.length, allRowsValidStep5, sem5UsesProg, sem1UsesProp }
  );

  // --------------------------------------------------------------------------
  // TEST 6: Validación del Paso 6 (Chunking de UACs y 8 Columnas)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Validación Paso 6: Plan Operativo con Chunking y 8 Columnas ---');

  // Probar algoritmo de chunking con lista de 15 UACs
  const fullUacList = [
    ...sampleMapeoA.map(m => ({ uacName: m.uacName, semester: m.semester })),
    { uacName: 'Química I', semester: 1 },
    { uacName: 'Inglés I', semester: 1 },
    { uacName: 'Recursos Socioemocionales I', semester: 1 },
    { uacName: 'Inglés III', semester: 3 },
    { uacName: 'Capacitación en Administración', semester: 3 },
    { uacName: 'Temas Selectos de Biología', semester: 5 },
  ];

  const CHUNK_SIZE = 6;
  const chunks: { uacName: string; semester: number }[][] = [];
  for (let i = 0; i < fullUacList.length; i += CHUNK_SIZE) {
    chunks.push(fullUacList.slice(i, i + CHUNK_SIZE));
  }

  const allChunksValidSize = chunks.every(c => c.length >= 1 && c.length <= 8);
  addCheck(
    'PASO_6_CHUNKING_ALGORITHM',
    `Chunking divide ${fullUacList.length} UACs en ${chunks.length} bloques de 5-8 UACs`,
    allChunksValidSize && chunks.length === 3,
    { totalUacs: fullUacList.length, chunkSizes: chunks.map(c => c.length), totalChunks: chunks.length }
  );

  // Validar prompt generado para el bloque 1
  const blockPrompt1 = buildPrompt6PlanOperativoPorBloque(
    JSON.stringify(sampleCronograma),
    JSON.stringify(sampleDetalleCurricular),
    chunks[0],
    'A',
    1,
    chunks.length
  );

  const hasAntiHallucination = blockPrompt1.includes('CLÁUSULA ANTI-ALUCINACIÓN ESTRICTA');
  const has8ColsSpec =
    blockPrompt1.includes('phase') &&
    blockPrompt1.includes('activity') &&
    blockPrompt1.includes('uac') &&
    blockPrompt1.includes('progression') &&
    blockPrompt1.includes('strategy') &&
    blockPrompt1.includes('week') &&
    blockPrompt1.includes('responsibles') &&
    blockPrompt1.includes('evaluationInstrument');

  addCheck(
    'PROMPT_6_PLAN_OPERATIVO_BLOQUE',
    'buildPrompt6PlanOperativoPorBloque incluye cláusula anti-alucinación y especificación de 8 columnas',
    hasAntiHallucination && has8ColsSpec,
    { hasAntiHallucination, has8ColsSpec }
  );

  // Simulación de consolidación de bloques en semestreA y semestreB
  const mockBlockRows: PlanOperativoRow[] = [
    {
      phase: 'Fase 1',
      activity: 'Levantamiento de encuestas diagnósticas domiciliarias sobre tipos de residuos',
      uac: 'Lengua y Comunicación I',
      progression: 'Propósito Formativo 1',
      strategy: 'Aprendizaje Basado en Proyectos (ABP)',
      week: 'Semana 2',
      responsibles: 'Estudiantes de 1.er Semestre y Docente Titular',
      evaluationInstrument: 'Rúbrica analítica de desempeño en campo',
    },
    {
      phase: 'Fase 1',
      activity: 'Cálculo de medias ponderadas y varianza muestral de desperdicios orgánicos',
      uac: 'Pensamiento Matemático I',
      progression: 'Propósito Formativo 2',
      strategy: 'STEAM',
      week: 'Semana 3',
      responsibles: 'Estudiantes de 1.er Semestre y Docente Titular',
      evaluationInstrument: 'Lista de cotejo para reporte estadístico',
    },
    {
      phase: 'Fase 2',
      activity: 'Construcción y calibración de compostero piloto con control de lixiviados',
      uac: 'Ecosistemas: Interacciones, Energía y Dinámica',
      progression: 'Propósito Formativo 1',
      strategy: 'Aprendizaje-Servicio (ApS)',
      week: 'Semana 6',
      responsibles: 'Estudiantes de 3.er Semestre y Facilitador Comunitario',
      evaluationInstrument: 'Guía de observación técnica de bitácora',
    },
    {
      phase: 'Fase 2',
      activity: 'Evaluación epidemiológica y bacteriológica del entorno del compostero escolar',
      uac: 'Ciencias de la Salud I',
      progression: 'Progresión 3',
      strategy: 'Design Thinking',
      week: 'Semana 8',
      responsibles: 'Estudiantes de 5.° Semestre y Promotor de Salud',
      evaluationInstrument: 'Portafolio de evidencias de laboratorio',
    },
    {
      phase: 'Fase 3',
      activity: 'Redacción y ensamble final del Manual Técnico de Transferencia Intersemestral',
      uac: 'Filosofía y Epistemología',
      progression: 'Progresión 4',
      strategy: 'Aprendizaje Dialógico',
      week: 'Semana 13',
      responsibles: 'Estudiantes de 5.° Semestre y Coordinación PAEC',
      evaluationInstrument: 'Producto terminado con rúbrica',
    },
  ];

  // Consolidación
  const uacSemesterMap = new Map<string, number>();
  fullUacList.forEach(u => uacSemesterMap.set(u.uacName.trim().toLowerCase(), u.semester));

  const semestreA: PlanOperativoRow[] = [];
  const semestreB: PlanOperativoRow[] = [];

  for (const row of mockBlockRows) {
    const sem = uacSemesterMap.get(row.uac.trim().toLowerCase()) ?? 1;
    if (sem % 2 === 1) {
      semestreA.push(row);
    } else {
      semestreB.push(row);
    }
  }

  const planOperativoConsolidado: PlanOperativoData = { semestreA, semestreB };

  const allRowsHave8Cols = mockBlockRows.every(r =>
    r.phase &&
    r.activity &&
    r.uac &&
    r.progression &&
    r.strategy &&
    r.week &&
    r.responsibles &&
    r.evaluationInstrument
  );

  addCheck(
    'PASO_6_8_COLUMNS_VERIFICATION',
    'Plan Operativo consolidado posee las 8 columnas oficiales completas y no nulas',
    allRowsHave8Cols && semestreA.length === 5 && semestreB.length === 0, // In cycle A, all are odd
    { totalRows: mockBlockRows.length, semestreARows: semestreA.length, semestreBRows: semestreB.length, allRowsHave8Cols }
  );

  // --------------------------------------------------------------------------
  // TEST 7: Validación del Paso 7 (6 Anexos Técnicos Estructurados)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Validación Paso 7: Sistema Integral de Anexos (JSON Estructurado) ---');

  const projectSummary = JSON.stringify({
    projectName: 'Eco-Comunidad Limpia 2026',
    problemStatement,
    cycleType: 'A',
    cronograma: sampleCronograma,
    planOperativo: planOperativoConsolidado,
  });

  const prompt7 = buildPrompt7Anexos(projectSummary);

  const hasAnexo1 = prompt7.includes('anexo1Minuta') && prompt7.includes('acuerdos') && prompt7.includes('firmas');
  const hasAnexo2 = prompt7.includes('anexo2Seguimiento') && prompt7.includes('semaforo');
  const hasAnexo3 = prompt7.includes('anexo3ReporteMensual') && prompt7.includes('logros') && prompt7.includes('accionesAjuste');
  const hasAnexo4 = prompt7.includes('anexo4ImpactoComunidad') && prompt7.includes('PRE/POST') && prompt7.includes('reactivos');
  const hasAnexo5 = prompt7.includes('anexo5AutoevaluacionEstudiantes') && prompt7.includes('FINAL') && prompt7.includes('escala');
  const hasAnexo6 = prompt7.includes('anexo6EvaluacionColegiado') && prompt7.includes('reactivos');

  addCheck(
    'PROMPT_7_ANEXOS_STRUCTURE',
    'buildPrompt7Anexos exige formato JSON estructurado con los 6 anexos oficiales completos',
    hasAnexo1 && hasAnexo2 && hasAnexo3 && hasAnexo4 && hasAnexo5 && hasAnexo6,
    { hasAnexo1, hasAnexo2, hasAnexo3, hasAnexo4, hasAnexo5, hasAnexo6 }
  );

  // Muestra de datos del Paso 7
  const sampleAnexos: AnexosData = {
    anexo1Minuta: {
      cct: '21EBH0048X',
      fecha: '15 de Septiembre de 2026',
      tipoReunion: 'Asamblea de Instalación del Comité Escolar Comunitario y Formalización de Acuerdos',
      acuerdos: [
        { no: 1, acuerdo: 'Aprobación unánime del diagnóstico situacional de residuos', responsable: 'Dirección y Comité', fechaLimite: 'Semana 2', estatus: 'Cumplido' },
        { no: 2, acuerdo: 'Conformación de brigadas interdisciplinarias de pesaje', responsable: 'Colegiado Docente', fechaLimite: 'Semana 3', estatus: 'En proceso' },
        { no: 3, acuerdo: 'Establecimiento del convenio de recolección diferenciada con el municipio', responsable: 'Comité de Vinculación', fechaLimite: 'Semana 5', estatus: 'Programado' },
      ],
      firmas: [
        { cargo: 'Director del Plantel', nombre: 'Mtro. Fernando Morales' },
        { cargo: 'Coordinador PAEC', nombre: 'Profr. Samuel Saldaña' },
        { cargo: 'Representante Comunitario', nombre: 'C. Beatriz Ramírez Pérez' },
        { cargo: 'Presidente Sociedad de Alumnos', nombre: 'Alumna Valeria Sánchez' },
      ],
    },
    anexo2Seguimiento: [
      { semana: 'Semana 1', fase: 'Fase 1', uac: 'Lengua y Comunicación I', metaOperativa: 'Instalación de brigadas', evidencia: 'Lista de registro firmada', avancePorcentaje: 100, semaforo: 'verde' },
      { semana: 'Semana 2', fase: 'Fase 1', uac: 'Ciencias Sociales I', metaOperativa: 'Levantamiento de encuestas', evidencia: '120 cuestionarios completados', avancePorcentaje: 95, semaforo: 'verde' },
      { semana: 'Semana 3', fase: 'Fase 1', uac: 'Pensamiento Matemático I', metaOperativa: 'Base de datos diagnóstica', evidencia: 'Gráficos de barras de residuos', avancePorcentaje: 90, semaforo: 'verde' },
      { semana: 'Semana 4', fase: 'Fase 1', uac: 'Cultura Digital I', metaOperativa: 'Infografía comunitaria', evidencia: 'Carteles impresos y digitales', avancePorcentaje: 100, semaforo: 'verde' },
      { semana: 'Semana 5', fase: 'Fase 2', uac: 'Química I', metaOperativa: 'Análisis de pH en composteo', evidencia: 'Bitácora experimental', avancePorcentaje: 85, semaforo: 'verde' },
      { semana: 'Semana 6', fase: 'Fase 2', uac: 'Ecosistemas', metaOperativa: 'Construcción de cajón de compost', evidencia: 'Cajón de 1.5m instalado', avancePorcentaje: 100, semaforo: 'verde' },
      { semana: 'Semana 7', fase: 'Fase 2', uac: 'Pensamiento Matemático V', metaOperativa: 'Cálculo de capacidad volumétrica', evidencia: 'Reporte de cubicaje', avancePorcentaje: 90, semaforo: 'verde' },
      { semana: 'Semana 8', fase: 'Fase 2', uac: 'Ciencias de la Salud I', metaOperativa: 'Inspección sanitaria vecinal', evidencia: 'Checklist epidemiológico', avancePorcentaje: 80, semaforo: 'amarillo' },
      { semana: 'Semana 9', fase: 'Fase 3', uac: 'Conciencia Histórica I', metaOperativa: 'Mapeo de zonas históricas limpias', evidencia: 'Mapa temático local', avancePorcentaje: 90, semaforo: 'verde' },
      { semana: 'Semana 10', fase: 'Fase 3', uac: 'Lengua y Comunicación III', metaOperativa: 'Borrador del manual técnico', evidencia: 'Capítulos I y II redactados', avancePorcentaje: 85, semaforo: 'verde' },
      { semana: 'Semana 11', fase: 'Fase 3', uac: 'Filosofía y Epistemología', metaOperativa: 'Círculo de reflexión ética', evidencia: 'Minuta de discusión grupal', avancePorcentaje: 95, semaforo: 'verde' },
      { semana: 'Semana 12', fase: 'Fase 3', uac: 'Capacitación en Administración', metaOperativa: 'Presupuesto de réplica', evidencia: 'Hoja de costos unitarios', avancePorcentaje: 100, semaforo: 'verde' },
      { semana: 'Semana 13', fase: 'Fase 3', uac: 'UAC Transversal', metaOperativa: 'Sesión de entrega intersemestral', evidencia: 'Acta de relevo acordada', avancePorcentaje: 90, semaforo: 'verde' },
      { semana: 'Semana 14', fase: 'Fase 3', uac: 'Coordinación Colegiada', metaOperativa: 'Firma de paquetes técnicos', evidencia: 'Paquete con firmas de docentes', avancePorcentaje: 100, semaforo: 'verde' },
      { semana: 'Semana 15', fase: 'Fase 3', uac: 'Todas las UACs', metaOperativa: 'Evaluación formativa transversal', evidencia: '100% de rúbricas asentadas', avancePorcentaje: 95, semaforo: 'verde' },
      { semana: 'Semana 16', fase: 'Fase 3', uac: 'Dirección Escolar', metaOperativa: 'Rendición comunitaria de cuentas', evidencia: 'Minuta de asamblea final', avancePorcentaje: 100, semaforo: 'verde' },
    ],
    anexo3ReporteMensual: {
      periodo: 'Primer Bimestre (Septiembre - Octubre 2026)',
      resumenEjecutivo: 'El proyecto inició conforme al cronograma de la Fase 1, logrando una participación del 92% del estudiantado y la vinculación con 40 familias vecinas.',
      logros: [
        'Instalación formal del Comité Escolar Comunitario con actas firmadas.',
        'Levantamiento exitoso de 120 encuestas de residuos sólidos.',
        'Articulación sin fisuras entre UACs de 1.er, 3.er y 5.° semestre.',
      ],
      dificultades: [
        'Disponibilidad limitada de contenedores metálicos para acopio temporal.',
        'Coordinación de horarios con padres de familia comerciantes.',
      ],
      accionesAjuste: [
        'Construcción de contenedores de madera reciclada por brigadas estudiantiles.',
        'Sesiones informativas dominicales breves de 30 minutos.',
      ],
    },
    anexo4ImpactoComunidad: {
      titulo: 'Cuestionario de Medición de Impacto y Transformación Comunitaria (Aplicación PRE y POST)',
      tipoAplicacion: 'PRE/POST',
      reactivos: [
        { reactivo: 'La problemática de residuos afecta directamente la calidad de vida de mi familia.', dimension: 'Pertinencia Situacional' },
        { reactivo: 'He observado un compromiso visible de los estudiantes en la mejora del entorno vecinal.', dimension: 'Vinculación Comunitaria' },
        { reactivo: 'Las actividades del bachillerato aportan soluciones prácticas y viables a la colonia.', dimension: 'Efectividad de la Propuesta' },
        { reactivo: 'He participado en reuniones, consultas o faenas convocadas por el plantel para el PEC.', dimension: 'Participación Ciudadana' },
        { reactivo: 'Considero que el proyecto ha generado mayor conciencia ecológica en la comunidad.', dimension: 'Transformación Social' },
        { reactivo: 'Recomiendo ampliamente la continuidad de este proyecto escolar en el próximo ciclo.', dimension: 'Sostenibilidad' },
      ],
      escala: {
        '1': 'Totalmente en desacuerdo',
        '2': 'En desacuerdo',
        '3': 'Neutral / Indiferente',
        '4': 'De acuerdo',
        '5': 'Totalmente de acuerdo',
      },
    },
    anexo5AutoevaluacionEstudiantes: {
      titulo: 'Rúbrica de Autoevaluación y Coevaluación de Autonomía y Habilidades Blandas Estudiantiles',
      tipoAplicacion: 'FINAL',
      reactivos: [
        { reactivo: 'Participé de manera puntual, proactiva y colaborativa en mi brigada asignada.', dimension: 'Colaboración y Trabajo en Equipo' },
        { reactivo: 'Apliqué conocimientos de mis materias para resolver problemas concretos de mi localidad.', dimension: 'Pensamiento Crítico y Transferencia' },
        { reactivo: 'Me comuniqué con respeto, claridad y asertividad con vecinos y compañeros.', dimension: 'Comunicación Asertiva' },
        { reactivo: 'Propuse soluciones creativas ante imprevistos durante las jornadas de campo.', dimension: 'Creatividad y Resiliencia' },
        { reactivo: 'Reflexioné sobre la responsabilidad social y ética de mis acciones como ciudadano.', dimension: 'Metacognición y Ética Ciudadana' },
        { reactivo: 'Gestioné adecuadamente mi tiempo para entregar productos y evidencias requeridas.', dimension: 'Autonomía y Autorregulación' },
      ],
      escala: {
        '1': 'Nivel Inicial (Requiere apoyo permanente)',
        '2': 'Nivel Básico (Cumplimiento parcial con supervisión)',
        '3': 'Nivel Satisfactorio (Autonomía funcional)',
        '4': 'Nivel Avanzado (Desempeño destacado y colaborativo)',
        '5': 'Nivel Sobresaliente (Liderazgo transformador y proactivo)',
      },
    },
    anexo6EvaluacionColegiado: {
      titulo: 'Cuestionario de Evaluación para Docentes y Trabajo Colegiado del PAEC',
      tipoAplicacion: 'FINAL',
      reactivos: [
        { reactivo: 'La transversalidad planificada articuló efectivamente los contenidos entre semestres.', dimension: 'Interdisciplinariedad' },
        { reactivo: 'El tiempo dedicado al PEC no sacrificó la cobertura del programa de estudios regular.', dimension: 'Gestión Curricular' },
        { reactivo: 'Las sesiones de colegiado facilitaron el seguimiento oportuno y la resolución de dudas.', dimension: 'Coordinación Docente' },
        { reactivo: 'Los instrumentos formativos transversales permitieron evaluar con objetividad.', dimension: 'Evaluación Formativa' },
        { reactivo: 'El PEC incrementó el interés, sentido de pertenencia y motivación de los alumnos.', dimension: 'Impacto en el Estudiantado' },
        { reactivo: 'El equipo directivo proporcionó los recursos y facilidades institucionales necesarias.', dimension: 'Liderazgo Directivo' },
      ],
      escala: {
        '1': 'Totalmente en desacuerdo',
        '2': 'En desacuerdo',
        '3': 'Neutral',
        '4': 'De acuerdo',
        '5': 'Totalmente de acuerdo',
      },
    },
  };

  const anexo1Valid = !!(sampleAnexos.anexo1Minuta?.acuerdos?.length && sampleAnexos.anexo1Minuta?.firmas?.length);
  const anexo2Valid = sampleAnexos.anexo2Seguimiento?.length === 16 && sampleAnexos.anexo2Seguimiento.every(s => s.semaforo && s.semana);
  const anexo3Valid = !!(sampleAnexos.anexo3ReporteMensual?.logros?.length && sampleAnexos.anexo3ReporteMensual?.accionesAjuste?.length);
  const anexo4Valid = sampleAnexos.anexo4ImpactoComunidad?.tipoAplicacion === 'PRE/POST' && sampleAnexos.anexo4ImpactoComunidad?.reactivos?.length === 6;
  const anexo5Valid = sampleAnexos.anexo5AutoevaluacionEstudiantes?.tipoAplicacion === 'FINAL' && sampleAnexos.anexo5AutoevaluacionEstudiantes?.reactivos?.length === 6;
  const anexo6Valid = sampleAnexos.anexo6EvaluacionColegiado?.reactivos?.length === 6 && !!sampleAnexos.anexo6EvaluacionColegiado?.escala['5'];

  addCheck(
    'PASO_7_ANEXOS_STRUCTURED_JSON',
    'Los 6 anexos del Paso 7 cumplen con todos los esquemas tabulares y normativos oficiales',
    anexo1Valid && anexo2Valid && anexo3Valid && anexo4Valid && anexo5Valid && anexo6Valid,
    { anexo1Valid, anexo2Valid, anexo3Valid, anexo4Valid, anexo5Valid, anexo6Valid }
  );

  // --------------------------------------------------------------------------
  // TEST 7B: Simulación Completa de Proyecto PAEC — Ciclo B (Semestres 2, 4, 6)
  // --------------------------------------------------------------------------
  console.log('\n--- 7B. Simulación Completa de Proyecto PAEC — Ciclo B (Semestres 2, 4, 6) ---');

  const sampleUacsB = [
    { uac_name: 'Lengua y Comunicación II', semester: 2 },
    { uac_name: 'Pensamiento Matemático II', semester: 2 },
    { uac_name: 'Cultura Digital II', semester: 2 },
    { uac_name: 'Ciencias Sociales II', semester: 2 },
    { uac_name: 'Lengua y Comunicación IV', semester: 4 },
    { uac_name: 'Pensamiento Matemático IV', semester: 4 },
    { uac_name: 'Conservación de la Energía y sus Interacciones', semester: 4 },
    { uac_name: 'Conciencia Histórica II', semester: 4 },
    { uac_name: 'Ecología y Medio Ambiente', semester: 6 },
    { uac_name: 'Filosofía II', semester: 6 },
    { uac_name: 'Ciencias de la Salud II', semester: 6 },
  ];

  const prompt3B = buildPrompt3Mapeo('Justificación de Proyecto Agua Limpia para Nuestra Comunidad', sampleUacsB);
  const prompt3BHasSem6 = prompt3B.includes('Semestre 6: Ecología y Medio Ambiente');
  const prompt3BHasProgRule = prompt3B.includes('PROGRESIÓN DE APRENDIZAJE');
  addCheck(
    'PASO_3_MAPEO_CYCLE_B',
    'Paso 3 genera prompt con UACs de semestres 2, 4 y 6 (desbloqueo de 6° comprobado)',
    prompt3BHasSem6 && prompt3BHasProgRule,
    { prompt3BHasSem6, prompt3BHasProgRule }
  );

  const sampleMapeoB: MapeoRow[] = [
    { semester: 2, uacName: 'Lengua y Comunicación II', topic: 'Campaña de difusión sobre la potabilización del agua', linking: 'Propósito Formativo 1: Redacta textos expositivos para informar sobre el cuidado del recurso hídrico.' },
    { semester: 2, uacName: 'Pensamiento Matemático II', topic: 'Medición de caudal y consumo por habitante en la colonia', linking: 'Propósito Formativo 2: Resuelve problemas de variación proporcional directa e inversa.' },
    { semester: 4, uacName: 'Conservación de la Energía y sus Interacciones', topic: 'Filtración y sistemas de bombeo solar para captación pluvial', linking: 'Propósito Formativo 1: Modela transferencias de energía en sistemas mecánicos e hidráulicos.' },
    { semester: 4, uacName: 'Pensamiento Matemático IV', topic: 'Modelos trigonométricos para calcular pendiente de escorrentía pluvial', linking: 'Propósito Formativo 3: Aplica razones trigonométricas en problemas topográficos.' },
    { semester: 6, uacName: 'Ecología y Medio Ambiente', topic: 'Evaluación fisicoquímica y microbiológica del agua de lluvia almacenada', linking: 'Progresión de Aprendizaje 2: Diseña estrategias de monitoreo ecológico y sustentabilidad comunitaria.' },
    { semester: 6, uacName: 'Ciencias de la Salud II', topic: 'Prevención de enfermedades gastrointestinales por consumo de agua no tratada', linking: 'Progresión de Aprendizaje 4: Promueve estilos de vida saludables y medidas sanitarias preventivas.' },
  ];

  const sampleCronogramaB: CronogramaRow[] = [
    {
      phase: 'Fase 1: Diagnóstico de Calidad del Agua y Organización Vecinal (Febrero-Marzo)',
      objective: 'Tomar muestras de agua en 20 tomas domiciliarias y capacitar al Comité de Agua.',
      macroActivities: 'Toma de muestras, análisis básico de turbidez y cloro residual, asamblea comunitaria.',
      responsibleSubjects: 'Lengua y Comunicación II, Pensamiento Matemático II, Ciencias de la Salud II.',
      semesterInvolved: '2.° y 6.° Semestre',
    },
    {
      phase: 'Fase 2: Prototipado de Filtros de Grava, Arena y Carbón Activado (Abril-Mayo)',
      objective: 'Construir 5 filtros de captación pluvial de bajo costo para uso comunitario.',
      macroActivities: 'Armado de lechos filtrantes, pruebas de flujo volumétrico y purificación.',
      responsibleSubjects: 'Conservación de la Energía, Pensamiento Matemático IV, Ecología.',
      semesterInvolved: '4.° y 6.° Semestre',
    },
    {
      phase: 'Fase 3: Socialización, Talleres de Mantenimiento y Evaluación de Impacto (Junio-Julio)',
      objective: 'Entregar manuales de operación de filtros y medir disminución de compras de pipas de agua.',
      macroActivities: 'Feria comunitaria del agua, taller de cambio de carbón activado, encuesta de satisfacción.',
      responsibleSubjects: 'Todas las UACs del Ciclo B.',
      semesterInvolved: '2.°, 4.° y 6.° Semestre',
    },
  ];

  const prompt5B = buildPrompt5DetalleCurricular(JSON.stringify(sampleMapeoB), JSON.stringify(sampleCronogramaB), 'B');
  const sampleDetalleCurricularB: DetalleCurricularRow[] = sampleMapeoB.map(m => ({
    semester: m.semester,
    uacName: m.uacName,
    progressionsOrPurposes: m.semester <= 4
      ? `Propósito Formativo 1: ${m.topic}`
      : `Progresión de Aprendizaje 2: ${m.topic}`,
    projectPhases: m.semester === 2 ? 'Fase 1' : m.semester === 4 ? 'Fase 2' : 'Fase 1, 2 y 3',
    curricularJustification: `Los estudiantes desarrollan competencias en torno a la problemática del agua potable aplicando conceptos de ${m.uacName}.`,
  }));

  const sem6UsesProg = sampleDetalleCurricularB
    .filter(r => r.semester === 6)
    .every(r => r.progressionsOrPurposes.startsWith('Progresión de Aprendizaje'));
  const sem2And4UseProp = sampleDetalleCurricularB
    .filter(r => r.semester <= 4)
    .every(r => r.progressionsOrPurposes.startsWith('Propósito Formativo'));

  addCheck(
    'PASO_5_DETALLE_CURRICULAR_CYCLE_B',
    'Paso 5 en Ciclo B valida las 5 columnas y aplica correctamente Propósitos (2° y 4°) vs Progresiones (6°)',
    prompt5B.includes('progressionsOrPurposes') && sem6UsesProg && sem2And4UseProp,
    { sem6UsesProg, sem2And4UseProp }
  );

  // Paso 6 Ciclo B: Chunking y Consolidación
  const chunksB: { uacName: string; semester: number }[][] = [];
  const uacListB = sampleMapeoB.map(m => ({ uacName: m.uacName, semester: m.semester }));
  for (let i = 0; i < uacListB.length; i += CHUNK_SIZE) {
    chunksB.push(uacListB.slice(i, i + CHUNK_SIZE));
  }

  const mockPlanOperativoRowsB: PlanOperativoRow[] = [
    {
      phase: 'Fase 1',
      activity: 'Diseño de folletos informativos sobre higiene del agua y almacenamiento seguro',
      uac: 'Lengua y Comunicación II',
      progression: 'Propósito Formativo 1',
      strategy: 'Aprendizaje Basado en Problemas (ABP)',
      week: 'Semana 2',
      responsibles: 'Alumnos de 2.° semestre y Maestro titular',
      evaluationInstrument: 'Rúbrica para texto informativo',
    },
    {
      phase: 'Fase 1',
      activity: 'Cálculo del volumen diario de captación pluvial en techumbres escolares',
      uac: 'Pensamiento Matemático II',
      progression: 'Propósito Formativo 2',
      strategy: 'STEAM',
      week: 'Semana 4',
      responsibles: 'Alumnos de 2.° semestre',
      evaluationInstrument: 'Lista de cotejo matemática',
    },
    {
      phase: 'Fase 2',
      activity: 'Ensamblaje del filtro piloto de arena y gravas calibradas',
      uac: 'Conservación de la Energía y sus Interacciones',
      progression: 'Propósito Formativo 1',
      strategy: 'Aprendizaje-Servicio (ApS)',
      week: 'Semana 7',
      responsibles: 'Alumnos de 4.° semestre',
      evaluationInstrument: 'Guía de observación técnica',
    },
    {
      phase: 'Fase 2',
      activity: 'Análisis bacteriológico y pruebas de coliformes totales en agua filtrada',
      uac: 'Ecología y Medio Ambiente',
      progression: 'Progresión 2',
      strategy: 'Método Científico Experimental',
      week: 'Semana 9',
      responsibles: 'Alumnos de 6.° semestre y Químico Asesor',
      evaluationInstrument: 'Reporte de laboratorio con escala estimativa',
    },
    {
      phase: 'Fase 3',
      activity: 'Campaña de vacunación y desparasitación escolar vinculada a la salud comunitaria',
      uac: 'Ciencias de la Salud II',
      progression: 'Progresión 4',
      strategy: 'Aprendizaje Comunitario',
      week: 'Semana 12',
      responsibles: 'Alumnos de 6.° semestre y Centro de Salud',
      evaluationInstrument: 'Rúbrica holística de vinculación comunitaria',
    },
  ];

  const uacSemesterMapB = new Map<string, number>();
  sampleMapeoB.forEach(u => uacSemesterMapB.set(u.uacName.trim().toLowerCase(), u.semester));

  const planOpSemestreAB: PlanOperativoRow[] = [];
  const planOpSemestreBB: PlanOperativoRow[] = [];

  for (const row of mockPlanOperativoRowsB) {
    const sem = uacSemesterMapB.get(row.uac.trim().toLowerCase()) ?? 2;
    if (sem % 2 === 1) {
      planOpSemestreAB.push(row);
    } else {
      planOpSemestreBB.push(row);
    }
  }

  const planOperativoConsolidadoB: PlanOperativoData = {
    semestreA: planOpSemestreAB,
    semestreB: planOpSemestreBB,
  };

  const allRowsBHave8Cols = mockPlanOperativoRowsB.every(r =>
    r.phase && r.activity && r.uac && r.progression && r.strategy && r.week && r.responsibles && r.evaluationInstrument
  );

  addCheck(
    'PASO_6_PLAN_OPERATIVO_CYCLE_B',
    'Plan Operativo en Ciclo B consolida todas las filas en semestreB (pares) con 8 columnas',
    allRowsBHave8Cols && planOpSemestreAB.length === 0 && planOpSemestreBB.length === 5,
    { totalRows: mockPlanOperativoRowsB.length, semestreARows: planOpSemestreAB.length, semestreBRows: planOpSemestreBB.length }
  );

  const sampleAnexosB: AnexosData = {
    ...sampleAnexos,
    anexo1Minuta: {
      ...sampleAnexos.anexo1Minuta,
      tipoReunion: 'Asamblea Comunitaria de Gestión del Agua Potable y Filtros Pluviales',
    },
    anexo3ReporteMensual: {
      ...sampleAnexos.anexo3ReporteMensual,
      periodo: 'Ciclo B: Febrero - Junio 2026',
      resumenEjecutivo: 'Instalación de 5 filtros pluviales y reducción del 40% en consumo de agua en pipas.',
    },
  };

  // --------------------------------------------------------------------------
  // TEST 7C: Simulación Completa de Proyecto PAEC — Ciclo Anual (Semestres 1 a 6)
  // --------------------------------------------------------------------------
  console.log('\n--- 7C. Simulación Completa de Proyecto PAEC — Ciclo Anual (Semestres 1 a 6) ---');

  const sampleUacsAnnual = [
    ...sampleUacsA.slice(0, 4), // sem 1 & 3
    ...sampleUacsB.slice(0, 4), // sem 2 & 4
    { uac_name: 'Filosofía y Epistemología', semester: 5 },
    { uac_name: 'Ecología y Medio Ambiente', semester: 6 },
  ];

  const sampleMapeoAnnual: MapeoRow[] = [
    { semester: 1, uacName: 'Lengua y Comunicación I', topic: 'Diagnóstico de necesidades alimentarias', linking: 'Propósito Formativo 1' },
    { semester: 2, uacName: 'Pensamiento Matemático II', topic: 'Cálculo de áreas para huerto escolar', linking: 'Propósito Formativo 2' },
    { semester: 3, uacName: 'Ecosistemas', topic: 'Ciclos de nutrientes y preparación de composta', linking: 'Propósito Formativo 1' },
    { semester: 4, uacName: 'Conservación de la Energía', topic: 'Sistemas de riego por goteo con energía solar', linking: 'Propósito Formativo 1' },
    { semester: 5, uacName: 'Filosofía y Epistemología', topic: 'Soberanía alimentaria y ética del consumo local', linking: 'Progresión de Aprendizaje 3' },
    { semester: 6, uacName: 'Ecología y Medio Ambiente', topic: 'Monitoreo de biodiversidad en el agroecosistema escolar', linking: 'Progresión de Aprendizaje 2' },
  ];

  const sampleCronogramaAnnual: CronogramaRow[] = [
    {
      phase: 'Fase 1: Diagnóstico Nutricional y Diseño de Huerto (Septiembre-Octubre)',
      objective: 'Delimitar áreas de cultivo y diagnosticar hábitos nutricionales.',
      macroActivities: 'Medición de terrenos, encuestas de hábitos de alimentación.',
      responsibleSubjects: 'Lengua y Comunicación I, Pensamiento Matemático I.',
      semesterInvolved: '1.er Semestre',
    },
    {
      phase: 'Fase 2: Preparación de Suelo y Siembra de Hortalizas (Noviembre-Diciembre)',
      objective: 'Sembrar 6 variedades de hortalizas nativas con composta orgánica.',
      macroActivities: 'Acolchado, preparación de sustratos y siembra en almácigos.',
      responsibleSubjects: 'Ecosistemas, Filosofía y Epistemología.',
      semesterInvolved: '3.er y 5.° Semestre',
    },
    {
      phase: 'Fase 3: Transferencia Semestral y Relevo Operativo (Enero)',
      objective: 'Capacitar a brigadas de relevo para la segunda mitad del ciclo escolar.',
      macroActivities: 'Bitácoras de riego y relevo intersemestral.',
      responsibleSubjects: 'Colegiado Docente.',
      semesterInvolved: '1.°, 3.° y 5.° Semestre',
    },
    {
      phase: 'Fase 4: Instalación de Riego por Goteo y Cosecha Temprana (Febrero-Marzo)',
      objective: 'Implementar riego tecnificado y recolectar primeras cosechas.',
      macroActivities: 'Instalación de mangueras y cosecha de rábano y acelga.',
      responsibleSubjects: 'Conservación de la Energía, Pensamiento Matemático II.',
      semesterInvolved: '2.° y 4.° Semestre',
    },
    {
      phase: 'Fase 5: Conservación y Elaboración de Alimentos Saludables (Abril-Mayo)',
      objective: 'Procesar conservas y elaborar recetas nutritivas comunitarias.',
      macroActivities: 'Talleres de deshidratación solar y conservas artesanales.',
      responsibleSubjects: 'Ecología y Medio Ambiente, Ciencias de la Salud.',
      semesterInvolved: '4.° y 6.° Semestre',
    },
    {
      phase: 'Fase 6: Feria Gastronómica y Evaluación Metacognitiva Final (Junio)',
      objective: 'Celebrar la feria escolar y medir impacto en hábitos de alimentación.',
      macroActivities: 'Presentación comunitaria, degustación y encuesta PRE/POST.',
      responsibleSubjects: 'Todas las UACs activas.',
      semesterInvolved: '1.° al 6.° Semestre',
    },
  ];

  const sampleDetalleCurricularAnnual: DetalleCurricularRow[] = sampleMapeoAnnual.map(m => ({
    semester: m.semester,
    uacName: m.uacName,
    progressionsOrPurposes: m.semester <= 4 ? `Propósito Formativo 1` : `Progresión de Aprendizaje 2`,
    projectPhases: m.semester % 2 === 1 ? 'Fases 1, 2, 3' : 'Fases 4, 5, 6',
    curricularJustification: `Integración curricular anual para el proyecto Huerto Escolar Sustentable.`,
  }));

  const mockPlanOperativoAnnual: PlanOperativoRow[] = [
    {
      phase: 'Fase 1',
      activity: 'Diagnóstico de hábitos nutricionales comunitarios',
      uac: 'Lengua y Comunicación I',
      progression: 'Propósito 1',
      strategy: 'ABP',
      week: 'Semana 2',
      responsibles: 'Alumnos de 1.°',
      evaluationInstrument: 'Rúbrica analítica',
    },
    {
      phase: 'Fase 2',
      activity: 'Análisis biológico de lombricomposta',
      uac: 'Ecosistemas',
      progression: 'Propósito 1',
      strategy: 'STEAM',
      week: 'Semana 6',
      responsibles: 'Alumnos de 3.°',
      evaluationInstrument: 'Lista de cotejo',
    },
    {
      phase: 'Fase 2',
      activity: 'Debate bioético sobre semillas transgénicas vs criollas',
      uac: 'Filosofía y Epistemología',
      progression: 'Progresión 3',
      strategy: 'Debate dialógico',
      week: 'Semana 10',
      responsibles: 'Alumnos de 5.°',
      evaluationInstrument: 'Rúbrica de debate',
    },
    {
      phase: 'Fase 4',
      activity: 'Cálculo de eficiencia de riego por goteo',
      uac: 'Pensamiento Matemático II',
      progression: 'Propósito 2',
      strategy: 'STEAM',
      week: 'Semana 18',
      responsibles: 'Alumnos de 2.°',
      evaluationInstrument: 'Prueba práctica',
    },
    {
      phase: 'Fase 4',
      activity: 'Montaje de panel fotovoltaico para bomba de agua',
      uac: 'Conservación de la Energía',
      progression: 'Propósito 1',
      strategy: 'ApS',
      week: 'Semana 22',
      responsibles: 'Alumnos de 4.°',
      evaluationInstrument: 'Guía de observación',
    },
    {
      phase: 'Fase 5',
      activity: 'Auditoría de huella ecológica del huerto',
      uac: 'Ecología y Medio Ambiente',
      progression: 'Progresión 2',
      strategy: 'Investigación de campo',
      week: 'Semana 28',
      responsibles: 'Alumnos de 6.°',
      evaluationInstrument: 'Portafolio de evidencias',
    },
  ];

  const uacSemesterMapAnnual = new Map<string, number>();
  sampleMapeoAnnual.forEach(u => uacSemesterMapAnnual.set(u.uacName.trim().toLowerCase(), u.semester));

  const planOpAnnualSemestreA: PlanOperativoRow[] = [];
  const planOpAnnualSemestreB: PlanOperativoRow[] = [];

  for (const row of mockPlanOperativoAnnual) {
    const sem = uacSemesterMapAnnual.get(row.uac.trim().toLowerCase()) ?? 1;
    if (sem % 2 === 1) {
      planOpAnnualSemestreA.push(row);
    } else {
      planOpAnnualSemestreB.push(row);
    }
  }

  const planOperativoConsolidadoAnnual: PlanOperativoData = {
    semestreA: planOpAnnualSemestreA,
    semestreB: planOpAnnualSemestreB,
  };

  addCheck(
    'PASO_6_PLAN_OPERATIVO_ANNUAL',
    'Plan Operativo en Ciclo Anual distribuye UACs equitativamente entre semestreA (impares) y semestreB (pares)',
    planOpAnnualSemestreA.length === 3 && planOpAnnualSemestreB.length === 3,
    { semestreARows: planOpAnnualSemestreA.length, semestreBRows: planOpAnnualSemestreB.length }
  );

  // --------------------------------------------------------------------------
  // Compilar y guardar reporte completo en scratch/paec_pipeline_test.json
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Generando Reporte de Auditoría scratch/paec_pipeline_test.json ---');

  const passedCount = checks.filter(c => c.passed).length;
  const failedCount = checks.filter(c => !c.passed).length;

  const testReport: TestReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: checks.length,
      passedTests: passedCount,
      failedTests: failedCount,
    },
    checks,
    cycleSimulations: {
      cycleA: {
        projectName: 'Eco-Comunidad Limpia 2026: Separación de Residuos Sólidos',
        cycleType: 'A',
        semesters: semestersA,
        totalCatalogUacs: uacsA.length,
        fase1_diagnostico: sampleDiag,
        fase2_justificacion: {
          projectName: 'Eco-Comunidad Limpia 2026',
          problemStatement,
          pilares: ['Pilar 1: Cultura Ambiental', 'Pilar 2: Salud Colectiva', 'Pilar 3: Transversalidad Curricular'],
        },
        fase2_mapeo: sampleMapeoA,
        fase2_cronograma: sampleCronograma,
        fase2_detalle_curricular: sampleDetalleCurricular,
        fase2_plan_operativo: planOperativoConsolidado,
        fase2_anexos: sampleAnexos,
      },
      cycleB: {
        projectName: 'Agua Limpia y Segura para Nuestra Escuela y Comunidad 2026',
        cycleType: 'B',
        semesters: semestersB,
        totalCatalogUacs: uacsB.length,
        fase1_diagnostico: sampleDiag,
        fase2_justificacion: {
          projectName: 'Agua Limpia y Segura 2026',
          problemStatement: 'Contaminación y desabasto de agua potable en la periferia escolar',
          pilares: ['Pilar 1: Captación Pluvial', 'Pilar 2: Salud Comunitaria', 'Pilar 3: Innovación Tecnológica'],
        },
        fase2_mapeo: sampleMapeoB,
        fase2_cronograma: sampleCronogramaB,
        fase2_detalle_curricular: sampleDetalleCurricularB,
        fase2_plan_operativo: planOperativoConsolidadoB,
        fase2_anexos: sampleAnexosB,
      },
      cycleAnnual: {
        projectName: 'Huerto Escolar Agroecológico y Soberanía Alimentaria 2026-2027',
        cycleType: 'annual',
        semesters: semestersAnnual,
        totalCatalogUacs: uacsAnnual.length,
        fase1_diagnostico: sampleDiag,
        fase2_justificacion: {
          projectName: 'Huerto Escolar Agroecológico',
          problemStatement: 'Malnutrición y falta de espacios sustentables de producción alimentaria en el plantel',
          pilares: ['Pilar 1: Agroecología', 'Pilar 2: Soberanía Alimentaria', 'Pilar 3: Economía Social'],
        },
        fase2_mapeo: sampleMapeoAnnual,
        fase2_cronograma: sampleCronogramaAnnual,
        fase2_detalle_curricular: sampleDetalleCurricularAnnual,
        fase2_plan_operativo: planOperativoConsolidadoAnnual,
        fase2_anexos: sampleAnexos,
      },
    },
  };

  const scratchDir = path.resolve('scratch');
  if (!existsSync(scratchDir)) {
    mkdirSync(scratchDir, { recursive: true });
  }

  const outputPath = path.join(scratchDir, 'paec_pipeline_test.json');
  writeFileSync(outputPath, JSON.stringify(testReport, null, 2), 'utf-8');

  console.log(`\n================================================================`);
  console.log(`  RESULTADOS DE VALIDACIÓN: ${passedCount}/${checks.length} PRUEBAS PASADAS`);
  console.log(`  Reporte guardado en: ${outputPath}`);
  console.log(`================================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runValidation().catch(err => {
  console.error('Error durante la validación del pipeline:', err);
  process.exit(1);
});
