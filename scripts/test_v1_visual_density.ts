import fs from 'fs';
import path from 'path';

// Cargar variables de entorno locales si existen
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  }
}

import { resolveVisualForMission } from '../src/lib/visual-engine/visual-asset-manager';
import { extractCalloutBox } from '../src/lib/visual-engine/callout-box';
import { extractComparisonTable } from '../src/lib/visual-engine/comparison-table';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';
import { renderWorkbookToDocx } from '../src/lib/docx-workbook-renderer';
import type { ActiveWorkTextbook, MissionSection } from '../src/types/work-textbook';
import type { Planning } from '../src/types/planning';

interface TestCase {
  uacName: string;
  missionTitle: string;
  sessionFocus: string;
  story: string;
  detonatingQuestion: string;
  physicalAnalogy: string;
  coreExplanation: string;
  narrativeExplanation: string;
  demo: string;
  guidedPractice: string;
  autonomousChallenge: string;
  hasContrastTable?: boolean;
}

const TEST_MISSIONS: TestCase[] = [
  {
    uacName: 'Ciencias Naturales, Experimentales y Tecnología I',
    missionTitle: 'Estructura celular y diferenciación de tejidos vegetales',
    sessionFocus: 'Identificación morfológica y transporte celular',
    story: 'En los invernaderos de la región de Atlixco, más del 42% de los cultivos experimentan pérdidas por marchitez bacteriana si la pared celular sufre deshidratación osmótica prematura.',
    detonatingQuestion: '¿Cómo influye la permeabilidad de la membrana en la conservación de hortalizas?',
    physicalAnalogy: 'La célula vegetal funciona como un contenedor hidráulico con compuertas regulables.',
    coreExplanation: 'Estructura celular vegetal y organelos:\nPared celular: estructura rígida de celulosa que otorga soporte.\nMembrana plasmática: bicapa lipídica que regula la homeostasis.\nCloroplastos: organelos fotosintéticos donde ocurre la fase luminosa.',
    narrativeExplanation: 'Las células vegetales mantienen presión de turgencia gracias a la vacuola central.',
    demo: 'Paso 1: Preparar la muestra de cebolla en el portaobjetos aplicando una gota de lugol al 1%. "La tinción uniforme revela los límites celulares con nitidez".',
    guidedPractice: '1. Colocar el cubreobjetos a 45 grados para evitar burbujas.\n2. Ajustar el micrómetro en 40x.\n3. Registrar la forma de las células epidérmicas.',
    autonomousChallenge: '1. Comparar muestras de hoja verde frente a tallo leñoso.\n2. Explicar el efecto de sumergir la muestra en solución salina.',
  },
  {
    uacName: 'Conciencia Histórica II',
    missionTitle: 'Revolución Mexicana y transformaciones agrarias de 1910',
    sessionFocus: 'Movimientos sociales y tenencia de la tierra',
    story: 'El conflicto armado iniciado en 1910 transformó de raíz la distribución territorial de los pueblos campesinos.',
    detonatingQuestion: '¿Por qué la demanda de "Tierra y Libertad" articuló a comunidades tan diversas?',
    physicalAnalogy: 'La tenencia comunal de la tierra funcionó como un tejido social que sobrevivió al latifundio.',
    coreExplanation: 'El Plan de Ayala de noviembre de 1911 desconoció al régimen de Madero y exigió la restitución inmediata de los montes y aguas comunales despojados.',
    narrativeExplanation: 'Hacia 1917, el artículo 27 constitucional consagró la propiedad originaria de la nación.',
    demo: 'El docente analiza la proclama zapatista y modela la extracción de demandas centrales.',
    guidedPractice: 'Los estudiantes discuten en mesas de trabajo las causas económicas del movimiento zapatista.',
    autonomousChallenge: 'Elaborar un ensayo breve sobre el impacto del reparto agrario en su municipio.',
  },
  {
    uacName: 'Pensamiento Matemático I',
    missionTitle: 'Modelación algebraica de sistemas de costos lineales',
    sessionFocus: 'Ecuaciones lineales y puntos de equilibrio',
    story: 'Una cooperativa escolar de Tepeaca produce artesanías con un costo fijo de 450 pesos y un costo variable de 35 pesos por pieza.',
    detonatingQuestion: '¿A partir de qué volumen de venta la cooperativa deja de registrar pérdidas?',
    physicalAnalogy: 'Dos rectas que se intersectan representan el balance exacto entre inversión y retorno.',
    coreExplanation: 'Ingreso total vs Costo total:\nIngreso total: representa el precio de venta multiplicado por las unidades producidas.\nCosto total: suma de los costos fijos más el costo variable unitario acumulado.',
    narrativeExplanation: 'El punto de equilibrio se localiza donde la función de ingreso iguala a la función de costos.',
    demo: 'Demostración paso a paso: igualar R(x) = C(x) despejando la variable independiente x.',
    guidedPractice: '1. Plantear la ecuación con los datos del problema.\n2. Despejar algebraicamente el valor crítico.\n3. Graficar ambas rectas en el plano cartesiano.',
    autonomousChallenge: '1. Simular un incremento del 15% en los insumos.\n2. Determinar el nuevo precio sugerido al público.',
  },
  {
    uacName: 'Humanidades I',
    missionTitle: 'Filosofía clásica y vida en comunidad',
    sessionFocus: 'Ética y examen crítico de la coexistencia',
    story: 'En asambleas comunitarias, el acuerdo reflexivo es indispensable para resolver disputas legítimas sobre bienes comunes.',
    detonatingQuestion: '¿Es posible una vida justa sin el diálogo deliberativo entre pares?',
    physicalAnalogy: 'El diálogo socrático actúa como una balanza donde cada argumento somete a prueba su propio peso.',
    coreExplanation: 'La reflexión ética clásica postula que una vida no examinada carece de sentido para la autorrealización ciudadana y comunitaria.',
    narrativeExplanation: 'Examinar los supuestos de nuestras convicciones permite distinguir entre prejuicio y juicio razonado.',
    demo: 'El docente formula preguntas sucesivas desarticulando contradicciones evidentes en dilemas morales.',
    guidedPractice: 'Los alumnos debaten en parejas un caso práctico de dilema comunitario.',
    autonomousChallenge: 'Redactar un juicio valorativo individual sobre la responsabilidad colectiva.',
  }
];

async function runVisualDensityVerification() {
  console.log('================================================================');
  console.log('  SIGPDA-EMS · AUDITORÍA DE DENSIDAD VISUAL EDITORIAL FASE V1   ');
  console.log('  Verificación Estricta: Cero Relleno Genérico (PDF + DOCX)     ');
  console.log('================================================================\n');

  const outDir = path.resolve(process.cwd(), 'scratch/output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const missions: MissionSection[] = [];
  const auditReport: Array<{
    missionNum: number;
    title: string;
    uac: string;
    photoType: 'openverse_media' | 'vector_svg' | 'none';
    photoName: string;
    hasRealTable: boolean;
    tableTitle: string;
    hasRealCallout: boolean;
    calloutTitle: string;
    calloutAccent: string;
    totalRealVisuals: number;
  }> = [];

  for (let i = 0; i < TEST_MISSIONS.length; i++) {
    const tm = TEST_MISSIONS[i];
    const missionNum = i + 1;
    const cleanTitle = tm.missionTitle;

    // 1. Evaluar Recurso Visual Principal (Foto CC o SVG)
    const contextText = `${tm.physicalAnalogy} ${tm.coreExplanation}`;
    const resolvedVisual = await resolveVisualForMission({
      uacName: tm.uacName,
      blockIndex: 0,
      missionIndex: missionNum,
      missionTitle: cleanTitle,
      contextText,
      preferOpenverseMedia: true,
    });

    const photoType = resolvedVisual ? (resolvedVisual.type as 'openverse_media' | 'vector_svg') : 'none';
    const photoName = resolvedVisual?.caption?.slice(0, 45) || 'Sin recurso';

    // 2. Evaluar Extracción de Tabla Comparativa Real
    const conceptFullText = `${tm.physicalAnalogy}\n${tm.coreExplanation}\n${tm.narrativeExplanation}`;
    const compTable = extractComparisonTable(conceptFullText, cleanTitle, tm.uacName, { allowSynthetic: false });
    const hasRealTable = compTable !== null && compTable.rows.length >= 2;

    // 3. Evaluar Extracción de Callout Box Real
    const conceptCallout = extractCalloutBox(conceptFullText, {
      missionNumber: missionNum,
      defaultSubjectName: tm.uacName,
      allowSynthetic: false,
    });
    const hasRealCallout = conceptCallout !== null;

    let realVisualCount = 0;
    if (photoType !== 'none') realVisualCount++;
    if (hasRealTable) realVisualCount++;
    if (hasRealCallout) realVisualCount++;

    auditReport.push({
      missionNum,
      title: cleanTitle,
      uac: tm.uacName,
      photoType,
      photoName,
      hasRealTable,
      tableTitle: compTable?.title || 'NINGUNA (sin pares detectables)',
      hasRealCallout,
      calloutTitle: conceptCallout?.title || 'NINGUNO (sin dato/cita detectable)',
      calloutAccent: conceptCallout?.accent || 'N/A',
      totalRealVisuals: realVisualCount,
    });

    missions.push({
      missionNumber: missionNum,
      title: cleanTitle,
      coveredSessions: [1, 2, 3, 4],
      sessionFocus: tm.sessionFocus,
      phenomenonHook: {
        story: tm.story,
        detonatingQuestion: tm.detonatingQuestion,
      },
      conceptZero: {
        physicalAnalogy: tm.physicalAnalogy,
        coreExplanation: tm.coreExplanation,
        narrativeExplanation: tm.narrativeExplanation,
        solvedExample: {
          problemStatement: 'Situación contextualizada en la entidad poblana.',
          solutionSteps: ['Paso 1: Identificar datos', 'Paso 2: Operar analíticamente', 'Paso 3: Concluir'],
          interpretation: 'Interpretación del resultado formativo.',
        },
      },
      iDoSection: {
        stepByStepDemo: tm.demo,
      },
      weDoSection: {
        guidedPractice: tm.guidedPractice,
      },
      youDoSection: {
        autonomousChallenge: tm.autonomousChallenge,
      },
      troubleshooting: [
        {
          symptom: 'Desviación en la medición o cálculo inicial.',
          rootCause: 'Error de apreciación en el protocolo.',
          solutionSteps: ['Revisar instrumentos', 'Recalcular con fórmula base'],
          preventionTip: 'Comprobar variables antes de la ejecución.',
        },
      ],
      formativeCheckpoint: {
        question: '¿Qué criterio asegura que el resultado obtenido es válido y aplicable?',
        reflectionPrompts: ['¿Cómo verificaste la hipótesis?', '¿Qué alternativa tecnológica resolvería el problema?'],
        criteriaChecklist: ['Comprensión teórica demostrada', 'Protocolo ejecutado con precisión', 'Evidencia registrada'],
      },
    });
  }

  const dummyWorkbook: ActiveWorkTextbook = {
    blockIndex: 0,
    blockName: 'Bloque I: Fundamentos y Aplicación Situada',
    subsystem: 'bge',
    coverData: {
      title: 'Cuaderno de Aprendizaje Activo MCCEMS',
      subtitle: 'Bloque I: Fundamentos y Aplicación Situada en la Comunidad',
      subjectName: 'Programa Integrado MCCEMS 2026-2027',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Prof. Titular',
      schoolName: 'Bachillerato General Estatal Puebla',
      cct: '21EBH0099Z',
    },
    tableOfContents: missions.map((m, i) => ({
      missionIndex: i + 1,
      title: m.title,
      sessionsRange: 'Sesiones 1 a 4',
      pageEstimate: 6,
    })),
    missions,
  };

  const dummyPlanning: Planning = {
    teacher_id: 'b0000000-0000-0000-0000-000000000001',
    uac_name: 'Programa Integrado MCCEMS',
    semester: 1,
    subsystem: 'bge',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Planning;

  console.log('1. Generando documento PDF...');
  const pdfBuffer = await renderWorkbookToPdf(dummyWorkbook);
  const pdfPath = path.join(outDir, 'test_v1_libro_densidad.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`   -> PDF generado con éxito: ${pdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)\n`);

  console.log('2. Generando documento DOCX...');
  const docxBuffer = await renderWorkbookToDocx(dummyWorkbook, dummyPlanning);
  const docxPath = path.join(outDir, 'test_v1_libro_densidad.docx');
  fs.writeFileSync(docxPath, docxBuffer);
  console.log(`   -> DOCX generado con éxito: ${docxPath} (${Math.round(docxBuffer.length / 1024)} KB)\n`);

  // Reporte honesto y métricas
  console.log('================================================================');
  console.log('           INFORME DE AUDITORÍA Y CONTEO HONESTO                ');
  console.log('================================================================');

  let totalPhotos = 0;
  let totalSvgs = 0;
  let totalTables = 0;
  let totalCallouts = 0;
  let missionsWithoutTable = 0;
  let missionsWithoutCallout = 0;
  let missionsMeetingGoal = 0;

  for (const rep of auditReport) {
    console.log(`\n[MISIÓN ${rep.missionNum}] ${rep.title}`);
    console.log(`   UAC: ${rep.uac}`);
    console.log(`   • Foto/Gráfico : [${rep.photoType}] ${rep.photoName}`);
    console.log(`   • Tabla Real   : ${rep.hasRealTable ? '✅ ' + rep.tableTitle : '❌ SIN TABLA (no se forzó plantilla)'}`);
    console.log(`   • Callout Real : ${rep.hasRealCallout ? '✅ ' + rep.calloutTitle + ' (Acento: ' + rep.calloutAccent + ')' : '❌ SIN CALLOUT (no se forzó plantilla)'}`);
    console.log(`   -> Total Visuales REALES: ${rep.totalRealVisuals} ${rep.totalRealVisuals >= 2 ? '✅ (Meta >= 2 alcanzada)' : '⚠️ (< 2)'}`);

    if (rep.photoType === 'openverse_media') totalPhotos++;
    if (rep.photoType === 'vector_svg') totalSvgs++;
    if (rep.hasRealTable) totalTables++; else missionsWithoutTable++;
    if (rep.hasRealCallout) totalCallouts++; else missionsWithoutCallout++;
    if (rep.totalRealVisuals >= 2) missionsMeetingGoal++;
  }

  console.log('\n----------------------------------------------------------------');
  console.log('                      MÉTRICAS CONSOLIDADAS                     ');
  console.log('----------------------------------------------------------------');
  console.log(`Total Misiones Auditadas              : ${TEST_MISSIONS.length}`);
  console.log(`Fotos Reales Openverse CC             : ${totalPhotos}`);
  console.log(`Esquemas Vectoriales SVG              : ${totalSvgs}`);
  console.log(`Tablas Comparativas Reales Detectadas : ${totalTables}`);
  console.log(`Misiones sin tabla (sin pares)        : ${missionsWithoutTable} (Cero relleno forzado)`);
  console.log(`Callouts con Contenido Real Extraído  : ${totalCallouts}`);
  console.log(`Misiones sin callout (sin dato/cita)  : ${missionsWithoutCallout} (Cero plantilla forzada)`);
  console.log(`Misiones cumpliendo meta (>=2 reales) : ${missionsMeetingGoal}/${TEST_MISSIONS.length} (${Math.round((missionsMeetingGoal / TEST_MISSIONS.length) * 100)}%)`);

  if (missionsMeetingGoal === TEST_MISSIONS.length) {
    console.log('\n>>> VERIFICACIÓN FASE V1 EXITOSA: 100% DE MISIONES CON >= 2 RECURSOS VISUALES REALES Y CERO RELLENOS GENÉRICOS <<<\n');
    process.exit(0);
  } else {
    console.warn('\n>>> ALERTA: Algunas misiones no alcanzaron 2 visuales reales <<<\n');
    process.exit(1);
  }
}

runVisualDensityVerification().catch((err) => {
  console.error('Error fatal durante la verificación:', err);
  process.exit(1);
});
