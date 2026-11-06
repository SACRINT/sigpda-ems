/**
 * verify-p3-editorial-calibration.ts
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Script de verificación formal de la Fase P3.1:
 * 1. Compatibilidad contentJson vs content_json (DB Neon).
 * 2. Fórmula única de presupuesto y calibración por sesiones (1h a 5h).
 * 3. Presupuesto dinámico por misión (computeMissionBudget) sin dobles fuentes de verdad.
 * 4. Calibración estricta de Quality Gates (allSessionsPresent + withinTargetRange).
 * 5. Compilación y renderizado E2E de libro de 18 sesiones a PDF formal (45-50 páginas).
 *
 * Uso:
 *   npx tsx scripts/verify-p3-editorial-calibration.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import {
  computeContentBudget,
  computeMissionBudget,
  resolveWeeklyHours,
  countSessionPlanWords,
  validateSessionCoverage,
  WORDS_PER_PAGE,
} from '../src/lib/guide-engine/content-budget';
import { renderWorkbookToPdf } from '../src/lib/pdf-workbook-renderer';
import {
  buildRichFallbackPlan,
  detectFallbackWords,
} from '../src/lib/guide-engine/writers/writer-contract';
import type {
  ActiveWorkTextbook,
  SessionPlan,
  MissionSection,
  ProjectSection,
  EvaluationSection,
} from '../src/types/work-textbook';

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (val && !process.env[key]) process.env[key] = val;
    }
  }
}

function makeMockSessionPlan(sessionNumber: number, wordsPerPlan = 890): SessionPlan {
  const wordsPerField = Math.max(10, Math.floor((wordsPerPlan - 30) / 7));
  const dummyText = 'término conceptual explicativo del tema curricular '.repeat(Math.ceil(wordsPerField / 7)).trim().split(/\s+/).slice(0, wordsPerField).join(' ');
  return {
    sessionNumber,
    objetivo: `Objetivo de aprendizaje sesión ${sessionNumber}: ${dummyText}`,
    motivacion: `Motivación cotidiana situada: ${dummyText}`,
    saberesPrevios: `Saberes previos: ${dummyText}`,
    contenido: `Fundamentación teórica paso a paso: ${dummyText}`,
    ejemploResuelto: `Ejemplo resuelto numérico: ${dummyText}`,
    practica: [
      { enunciado: `Ejercicio 1 con datos: ${dummyText}`, pista: 'Pista guiada para resolver' },
      { enunciado: `Ejercicio 2 con datos: ${dummyText}`, pista: 'Pista guiada para resolver' },
    ],
    aplicacion: `Aplicación en el entorno real o comunidad: ${dummyText}`,
    autoevaluacion: ['¿Comprendo el concepto principal?', '¿Puedo resolver el ejercicio solo?'],
    recursos: [{ titulo: 'Video explicativo', url: 'https://youtube.com/watch?v=demo', tipo: 'video' }],
    productoIntegrador: `Avance del artefacto en sesión ${sessionNumber}`,
  };
}

function makeMissionSection(params: {
  index: number;
  type: 'foundation' | 'lab' | 'project' | 'evaluation';
  sessions: number[];
  baseWords: number;
}): MissionSection {
  const { index, type, sessions, baseWords } = params;
  const sessionPlans = sessions.map((s) => makeMockSessionPlan(s));
  const plansWords = sessionPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  const totalWords = baseWords + plansWords;

  const pTheory1 =
    'El análisis formal de la variación requiere la integración de representaciones algebraicas, tabulares y gráficas situadas en el entorno comunitario. Mediante el estudio sistemático de las razones de cambio, los estudiantes identifican comportamientos tendenciales, puntos críticos de inflexión y condiciones de estabilidad en problemáticas reales del Estado de Puebla, vinculando la teoría matemática con la toma de decisiones informada y transformadora.';
  const pTheory2 =
    'Para caracterizar este comportamiento con rigor científico, definimos formalmente la tasa de variación media como el cociente entre el cambio observado en la magnitud dependiente y el cambio en la variable de control. Esta relación nos permite no solo describir el estado actual de un sistema, sino también proyectar tendencias futuras y estimar puntos críticos de estabilidad o riesgo en los proyectos comunitarios escolares.';

  return {
    missionIndex: index,
    title: `Misión ${index}: ${type.toUpperCase()}`,
    coveredSessions: sessions,
    sessionTopic: `Tópico Curricular de la Misión ${index}`,
    sessionFocus: `Enfoque Pedagógico Situado de ${type}`,
    phenomenonHook: {
      story: `Caso situado en una comunidad escolar del Estado de Puebla para contextualizar el aprendizaje formativo en la misión ${index}. ${pTheory1}`,
      detonatingQuestion: '¿Cómo podemos modelar e intervenir positivamente ante este reto comunitario mediante pensamiento cuantitativo?',
    },
    conceptZero: {
      physicalAnalogy: 'Analogía física cotidiana que ilustra el fenómeno con elementos del entorno del estudiante y recursos locales comprobables.',
      coreExplanation: `${pTheory1}\n\n${pTheory2}`,
    },
    iDoSection: { stepByStepDemo: `Demostración paso a paso modelada por el docente con variables claras y procedimiento cuantitativo.\n\n${pTheory1}` },
    weDoSection: { guidedPractice: `Práctica guiada en equipos de trabajo colaborativo para resolución situada en el aula escolar.\n\n${pTheory2}`, workbookElements: [] },
    youDoSection: { autonomousChallenge: `Reto autónomo individual en el cuaderno activo con 5 pasos numerados para consolidar el aprendizaje significativo.\n\n${pTheory1}`, workbookElements: [] },
    troubleshooting: [
      { symptom: 'Desviación en el cálculo de la razón de cambio', rootCause: 'Inversión en los pares ordenados delta y y delta x', solutionSteps: ['Verificar coordenadas iniciales y finales', 'Recalcular cociente'], preventionTip: 'Rotular explícitamente variables dependiente e independiente' }
    ],
    formativeCheckpoint: {
      question: '¿Qué aprendizajes clave y procedimientos analíticos consolidaste en esta misión formativa?',
      reflectionPrompts: ['Analiza los pasos seguidos y su justificación', 'Identifica oportunidades de mejora técnica en tu modelo'],
      criteriaChecklist: ['Rigor metodológico y conceptual', 'Precisión en los cálculos y gráficas'],
    },
    sessionPlans,
    wordCount: totalWords,
  };
}

async function runVerification(): Promise<void> {
  console.log('='.repeat(70));
  console.log('  SIGPDA-EMS · VERIFICACIÓN FORMAL DE CALIBRACIÓN EDITORIAL (P3.1)');
  console.log('='.repeat(70));
  loadEnvLocal();

  let passed = true;

  // 1. Verificación de resolveWeeklyHours con content_json (DB Neon)
  console.log('\n[1/5] Verificando compatibilidad de resolveWeeklyHours con DB Neon...');
  const hoursFromJson = resolveWeeklyHours({
    content_json: { sectionI: { totalHoursWeekly: 3, totalHours: 54 } },
  } as any);
  const hoursFromCamel = resolveWeeklyHours({
    contentJson: { sectionI: { totalHoursWeekly: 4 } },
  } as any);
  const hoursFromTotal = resolveWeeklyHours({
    content_json: { sectionI: { totalHours: 2 } },
  } as any);
  const hoursFromDefault = resolveWeeklyHours(null);

  if (hoursFromJson === 3 && hoursFromCamel === 4 && hoursFromTotal === 2 && hoursFromDefault === 3) {
    console.log('  ✓ resolveWeeklyHours resuelve correctamente content_json, contentJson y fallbacks.');
  } else {
    console.error('  ❌ Falló resolveWeeklyHours:', { hoursFromJson, hoursFromCamel, hoursFromTotal, hoursFromDefault });
    passed = false;
  }

  // 2. Verificación de tabla canónica (1h a 5h)
  console.log('\n[2/5] Verificando tabla canónica de calibración de 1 a 5 h/semana...');
  const hoursToCheck = [1, 2, 3, 4, 5];
  for (const h of hoursToCheck) {
    const b = computeContentBudget(h);
    const expectedSessions = h * 6;
    const expectedMinPages = Math.round(expectedSessions * 2.5);
    const expectedMaxPages = Math.round(expectedSessions * (50 / 18));
    const expectedMinWords = expectedSessions * 1125;
    const expectedMaxWords = expectedSessions * 1250;

    const ok =
      b.sessionsPerBlock === expectedSessions &&
      b.targetPages.min === expectedMinPages &&
      b.targetPages.max === expectedMaxPages &&
      b.targetWords.min === expectedMinWords &&
      b.targetWords.max === expectedMaxWords;

    if (!ok) {
      console.error(`  ❌ Error en calibración de ${h} h/semana:`, b);
      passed = false;
    } else {
      console.log(`  ✓ ${h} h/semana -> ${expectedSessions} sesiones, ${expectedMinPages}-${expectedMaxPages} págs, ${expectedMinWords}-${expectedMaxWords} palabras.`);
    }
  }

  // 3. Verificación de computeMissionBudget
  console.log('\n[3/5] Verificando computeMissionBudget y proporciones por misión...');
  const mb3 = computeMissionBudget(3);
  const mb6 = computeMissionBudget(6);
  if (
    mb3.targetWords.min === 3375 &&
    mb3.targetWords.ideal === 3563 &&
    mb3.targetWords.max === 3750 &&
    mb6.targetWords.min === 6750 &&
    mb6.targetWords.ideal === 7125 &&
    mb6.targetWords.max === 7500
  ) {
    console.log('  ✓ computeMissionBudget escala exactamente: S=3 -> ~3,563 palabras; S=6 -> ~7,125 palabras.');
  } else {
    console.error('  ❌ Error en computeMissionBudget:', { mb3, mb6 });
    passed = false;
  }

  // 4. Verificación de Quality Gates estrictos
  console.log('\n[4/5] Verificando Quality Gates estrictos de validateSessionCoverage...');
  const budget3h = computeContentBudget(3); // 20,250 a 22,500 palabras
  const fullSessions = Array.from({ length: 18 }, (_, i) => ({ sessionNumber: i + 1 }));

  const gateOk = validateSessionCoverage({
    sessions: fullSessions,
    expectedSessionsCount: 18,
    totalWords: 21375, // ideal
    budget: budget3h,
  });

  const gateIncomplete = validateSessionCoverage({
    sessions: fullSessions.slice(0, 12),
    expectedSessionsCount: 18,
    totalWords: 21375,
    budget: budget3h,
  });

  const gateTooShort = validateSessionCoverage({
    sessions: fullSessions,
    expectedSessionsCount: 18,
    totalWords: 15000, // < 20,250 palabras
    budget: budget3h,
  });

  if (gateOk.allSessionsPresent && gateOk.withinTargetRange && !gateIncomplete.allSessionsPresent && !gateTooShort.withinTargetRange) {
    console.log('  ✓ Quality Gates estrictos validan al 100%: rechazan sesiones incompletas y palabras fuera de rango.');
  } else {
    console.error('  ❌ Falló validación de Quality Gates:', { gateOk, gateIncomplete, gateTooShort });
    passed = false;
  }

  // 5. Compilación y renderizado E2E a PDF formal
  console.log('\n[5/5] Ejecutando compilación E2E del libro de 18 sesiones a PDF formal...');
  const sFoundation = makeMissionSection({ index: 1, type: 'foundation', sessions: [1, 2, 3], baseWords: 1200 });
  const sLab = makeMissionSection({ index: 2, type: 'lab', sessions: [4, 5, 6, 7, 8, 9], baseWords: 1400 });
  const sProject = makeMissionSection({ index: 3, type: 'project', sessions: [10, 11, 12, 13, 14, 15], baseWords: 1400 });
  const sEval = makeMissionSection({ index: 4, type: 'evaluation', sessions: [16, 17, 18], baseWords: 1200 });

  const totalWords = sFoundation.wordCount + sLab.wordCount + sProject.wordCount + sEval.wordCount;
  const allSessions = [sFoundation, sLab, sProject, sEval].flatMap((m) => m.sessionPlans || []);
  const fallbackWords = detectFallbackWords(allSessions);
  const aiWords = Math.max(0, totalWords - fallbackWords);

  // Validación mediante el Quality Gate oficial validateSessionCoverage (sin auto-aprobación sintética)
  const coverageReport = validateSessionCoverage({
    sessions: allSessions,
    expectedSessionsCount: budget3h.sessionsPerBlock,
    totalWords,
    fallbackWords,
    budget: budget3h,
  });

  const defaultProjectSection: ProjectSection = {
    artifactName: 'Artefacto Demostrativo Comunitario',
    communityUtility: 'Solución técnica comunitaria orientada a la sostenibilidad del agua en Puebla.',
    phases: [
      { phaseNum: 1, title: 'Fase 1: Diagnóstico', allocatedHours: 2, deliverables: ['Boceto'], instructions: 'Definir especificaciones técnicas.' },
      { phaseNum: 2, title: 'Fase 2: Construcción', allocatedHours: 4, deliverables: ['Prototipo'], instructions: 'Montaje de la solución comunitaria.' },
    ],
  };

  const defaultEvaluationSection: EvaluationSection = {
    source: 'generated_fresh',
    rubric: [
      {
        criterion: 'Calidad Técnica y Procedimental',
        weightPercent: 50,
        levels: {
          inicial: 'Identifica conceptos básicos sin aplicarlos.',
          basico: 'Aplica conceptos con apoyo continuo.',
          autonomo: 'Aplica conceptos con autonomía y precisión.',
          estrategico: 'Aplica e innova proponiendo soluciones comunitarias.',
        },
      },
      {
        criterion: 'Impacto Comunitario y Trabajo Colaborativo',
        weightPercent: 50,
        levels: {
          inicial: 'Participación pasiva en el equipo.',
          basico: 'Cumple tareas asignadas con supervisión.',
          autonomo: 'Colabora activamente y entrega productos a tiempo.',
          estrategico: 'Lidera la vinculación comunitaria y propone mejoras.',
        },
      },
    ],
    checklist: [
      { item: 'Bitácora de campo completa con registros cuantitativos.', required: true },
      { item: 'Prototipo funcional verificado con pruebas comunitarias.', required: true },
    ],
  };

  const mockWorkbook: ActiveWorkTextbook = {
    id: 'wtb-verify-p3',
    planningId: 'plan-verify',
    blockIndex: 0,
    blockName: 'Bloque 1: Modelación y Pensamiento Matemático',
    version: 1,
    subsystem: 'bge',
    targetPages: budget3h.targetPages.ideal,
    totalPages: coverageReport.totalPages,
    totalWords,
    aiWords,
    fallbackWords,
    sessionsPerBlock: 18,
    targetWords: budget3h.targetWords.ideal,
    pagesDelta: coverageReport.pagesDelta,
    wordsDelta: coverageReport.wordsDelta,
    coverageReport,
    generatedAt: new Date().toISOString(),
    qualityScore: 92,
    qualityWarning: !coverageReport.allSessionsPresent || !coverageReport.withinTargetRange || fallbackWords > 0,
    coverData: {
      title: 'Cuaderno de Aprendizaje Activo: Bloque 1',
      subtitle: 'Misiones Didácticas Orientadas al Proyecto PAEC Comunitario',
      subjectName: 'Pensamiento Matemático I',
      semester: 1,
      blockNumber: 1,
      teacherName: 'Mtro. Titular de Academia',
      schoolName: 'Bachillerato General Oficial',
      cct: '21EBH0001A',
      paecProjectName: 'Sostenibilidad y Cuidado del Agua en la Comunidad Escolar',
    },
    tableOfContents: [
      { missionIndex: 1, title: 'Misión 1: Fundamentación e Intuición', sessionsRange: 'Sesiones 1-3', pageEstimate: 8 },
      { missionIndex: 2, title: 'Misión 2: Laboratorio Experimental', sessionsRange: 'Sesiones 4-9', pageEstimate: 16 },
      { missionIndex: 3, title: 'Misión 3: Construcción del Artefacto Real', sessionsRange: 'Sesiones 10-15', pageEstimate: 16 },
      { missionIndex: 4, title: 'Misión 4: Demostración y Evaluación Formativa', sessionsRange: 'Sesiones 16-18', pageEstimate: 8 },
    ],
    missions: [sFoundation, sLab, sProject, sEval],
    projectSection: defaultProjectSection,
    evaluationSection: defaultEvaluationSection,
  };

  const mockPlanning = {
    id: 'plan-verify',
    teacherId: 'teacher-1',
    uacName: 'Pensamiento Matemático I',
    semester: 1,
    component: 'fundamental',
    contentJson: {
      sectionI: {
        totalHoursWeekly: 3,
        teacherName: 'Mtro. Titular de Academia',
      },
    },
  } as any;

  console.log(`  - Total palabras calculadas en libro: ${totalWords.toLocaleString()} (Rango esperado: 20,250 a 22,500)`);
  console.log(`  - Total páginas estimadas: ${coverageReport.totalPages} páginas (Rango esperado: 45 a 50)`);
  console.log(`  - Cobertura validada: allSessionsPresent=${coverageReport.allSessionsPresent}, withinTargetRange=${coverageReport.withinTargetRange}, qualityWarning=${mockWorkbook.qualityWarning}`);

  const startTime = Date.now();
  const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning, { forceFallbackCover: true });
  const renderDuration = Date.now() - startTime;

  console.log(`  - Renderizado PDF completado en ${renderDuration} ms. Tamaño del buffer: ${(pdfBuffer.length / 1024).toFixed(1)} KB.`);

  const parser = new PDFParse({ data: pdfBuffer });
  const pdfData = await parser.getText();
  await parser.destroy();

  console.log(`  - Páginas binarias reales en el PDF: ${pdfData.total} páginas.`);
  if (pdfData.pages) {
    console.log('--- CONTENT OF P.11 ---');
    console.log(pdfData.pages[10]?.text);
    console.log('--- CONTENT OF P.12 ---');
    console.log(pdfData.pages[11]?.text);
  }

  const lowerText = pdfData.text.toLowerCase();
  let missingSessionsCount = 0;
  for (let s = 1; s <= 18; s++) {
    if (!lowerText.includes(`sesion ${s}`) && !lowerText.includes(`sesión ${s}`) && !lowerText.includes(`sesiones ${s}`)) {
      console.error(`    ❌ Sesión ${s} no encontrada en el texto del PDF.`);
      missingSessionsCount++;
    }
  }

  if (
    pdfData.total >= 45 &&
    pdfData.total <= 50 &&
    missingSessionsCount === 0 &&
    coverageReport.withinTargetRange &&
    !mockWorkbook.qualityWarning
  ) {
    console.log(`  ✓ PDF validado con éxito: ${pdfData.total} páginas (estrictamente entre 45-50), ${totalWords.toLocaleString()} palabras (dentro de [20250, 22500]), 18/18 sesiones impresas con rigor editorial.`);
  } else {
    console.error(`  ❌ Validación del PDF insatisfecha: páginas=${pdfData.total}, faltantes=${missingSessionsCount}, withinTargetRange=${coverageReport.withinTargetRange}, qualityWarning=${mockWorkbook.qualityWarning}`);
    passed = false;
  }

  console.log('\n' + '='.repeat(70));
  if (passed) {
    console.log('  ✅ VERIFICACIÓN FORMAL P3.1: 100% EXITOSA Y APROBADA.');
    console.log('  Todos los criterios de revisión editorial y arquitectónica están cumplidos.');
  } else {
    console.error('  ❌ HUBO DISCREPANCIAS EN LA VERIFICACIÓN P3.1.');
    process.exit(1);
  }
  console.log('='.repeat(70));
}

runVerification().catch((err) => {
  console.error('Error fatal durante la verificación P3.1:', err);
  process.exit(1);
});
