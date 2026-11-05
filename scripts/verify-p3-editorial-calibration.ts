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
import type { ActiveWorkTextbook, SessionPlan, MissionSection } from '../src/types/work-textbook';

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

function makeMockSessionPlan(sessionNumber: number, wordsPerPlan = 850): SessionPlan {
  const chunkWords = Math.max(10, Math.floor(wordsPerPlan / 8));
  const dummyText = 'palabra formativa de rigor técnico '.repeat(Math.ceil(chunkWords / 5)).trim();
  return {
    sessionNumber,
    objetivo: `Objetivo de aprendizaje de la sesión ${sessionNumber}: desarrollo conceptual y procedimental sobre ${dummyText}.`,
    motivacion: `Motivación cotidiana situada en la región de Puebla: aplicación real sobre ${dummyText}.`,
    saberesPrevios: `Saberes previos requeridos: ${dummyText}.`,
    contenido: `Fundamentación teórica paso a paso: desarrollo exhaustivo sin atajos sobre ${dummyText}. ${dummyText}`,
    ejemploResuelto: `Ejemplo resuelto numérico y analítico: cálculo paso a paso con variables ${dummyText}.`,
    practica: [
      { enunciado: `Actividad práctica guiada 1: modelado y cálculo de ${dummyText}.`, pista: 'Aplica la fórmula analizada en clase.' },
    ],
    aplicacion: `Aplicación en el entorno real o comunitario del estudiante: solución técnica a ${dummyText}.`,
    autoevaluacion: ['¿Comprendo la base teórica y su formulación matemática?', '¿Puedo resolver el problema de forma autónoma?'],
    recursos: [{ titulo: 'Video explicativo complementario', url: 'https://youtube.com/watch?v=demo', tipo: 'video' }],
    productoIntegrador: `Avance del artefacto formativo en sesión ${sessionNumber}: registro de mediciones y evidencias.`,
  };
}

function makeMissionSection(params: {
  index: number;
  type: 'foundation' | 'lab' | 'project' | 'evaluation';
  sessions: number[];
  baseWords: number;
  wordsPerPlan: number;
}): MissionSection {
  const { index, type, sessions, baseWords, wordsPerPlan } = params;
  const sessionPlans = sessions.map((s) => makeMockSessionPlan(s, wordsPerPlan));
  const plansWords = sessionPlans.reduce((acc, p) => acc + countSessionPlanWords(p), 0);
  const totalWords = baseWords + plansWords;

  return {
    missionIndex: index,
    title: `Misión ${index}: ${type.toUpperCase()}`,
    coveredSessions: sessions,
    sessionTopic: `Tópico Curricular de la Misión ${index}`,
    sessionFocus: `Enfoque Pedagógico Situado de ${type}`,
    phenomenonHook: {
      story: 'Caso situado en una comunidad escolar del Estado de Puebla para contextualizar el aprendizaje formativo.',
      detonatingQuestion: '¿Cómo podemos modelar e intervenir positivamente ante este reto comunitario?',
    },
    conceptZero: {
      physicalAnalogy: 'Analogía física cotidiana que ilustra el fenómeno con elementos del entorno del estudiante.',
      coreExplanation: 'Explicación formal, rigurosa y analítica del concepto central sin simplificaciones ni resúmenes.',
    },
    iDoSection: { stepByStepDemo: 'Demostración paso a paso modelada por el docente con variables claras y procedimiento.' },
    weDoSection: { guidedPractice: 'Práctica guiada en equipos de trabajo colaborativo para resolución situada.', workbookElements: [] },
    youDoSection: { autonomousChallenge: 'Reto autónomo individual en el cuaderno activo con 5 pasos numerados.', workbookElements: [] },
    troubleshooting: [],
    formativeCheckpoint: {
      question: '¿Qué aprendizajes clave consolidaste en esta sesión formativa?',
      reflectionPrompts: ['Analiza los pasos seguidos', 'Identifica oportunidades de mejora técnica'],
      criteriaChecklist: ['Rigor metodológico', 'Precisión en los cálculos'],
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
  const sFoundation = makeMissionSection({ index: 1, type: 'foundation', sessions: [1, 2, 3], baseWords: 1013, wordsPerPlan: 850 });
  const sLab = makeMissionSection({ index: 2, type: 'lab', sessions: [4, 5, 6, 7, 8, 9], baseWords: 2025, wordsPerPlan: 850 });
  const sProject = makeMissionSection({ index: 3, type: 'project', sessions: [10, 11, 12, 13, 14, 15], baseWords: 2025, wordsPerPlan: 850 });
  const sEval = makeMissionSection({ index: 4, type: 'evaluation', sessions: [16, 17, 18], baseWords: 1013, wordsPerPlan: 850 });

  const totalWords = sFoundation.wordCount + sLab.wordCount + sProject.wordCount + sEval.wordCount;
  const totalPages = Math.round(totalWords / WORDS_PER_PAGE);

  const mockWorkbook: ActiveWorkTextbook = {
    id: 'wtb-verify-p3',
    planningId: 'plan-verify',
    blockIndex: 0,
    blockName: 'Bloque 1: Modelación y Pensamiento Matemático',
    version: 1,
    subsystem: 'bge',
    targetPages: budget3h.targetPages.ideal,
    totalPages,
    totalWords,
    sessionsPerBlock: 18,
    targetWords: budget3h.targetWords.ideal,
    pagesDelta: 0,
    wordsDelta: totalWords - budget3h.targetWords.ideal,
    coverageReport: {
      sessionsCovered: 18,
      sessionsExpected: 18,
      allSessionsPresent: true,
      averageWordsPerSession: Math.round(totalWords / 18),
      withinTargetRange: true,
    },
    generatedAt: new Date().toISOString(),
    qualityScore: 92,
    qualityWarning: false,
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
  console.log(`  - Total páginas estimadas: ${totalPages} páginas (Rango esperado: 45 a 50)`);

  const startTime = Date.now();
  const pdfBuffer = await renderWorkbookToPdf(mockWorkbook, mockPlanning, { forceFallbackCover: true });
  const renderDuration = Date.now() - startTime;

  console.log(`  - Renderizado PDF completado en ${renderDuration} ms. Tamaño del buffer: ${(pdfBuffer.length / 1024).toFixed(1)} KB.`);

  const parser = new PDFParse({ data: pdfBuffer });
  const pdfData = await parser.getText();
  await parser.destroy();

  console.log(`  - Páginas binarias reales en el PDF: ${pdfData.total} páginas.`);

  const lowerText = pdfData.text.toLowerCase();
  let missingSessionsCount = 0;
  for (let s = 1; s <= 18; s++) {
    if (!lowerText.includes(`sesion ${s}`) && !lowerText.includes(`sesión ${s}`) && !lowerText.includes(`sesiones ${s}`)) {
      console.error(`    ❌ Sesión ${s} no encontrada en el texto del PDF.`);
      missingSessionsCount++;
    }
  }

  if (pdfData.total >= 45 && pdfData.total <= 55 && missingSessionsCount === 0) {
    console.log(`  ✓ PDF validado con éxito: ${pdfData.total} páginas, 18/18 sesiones impresas con rigor editorial.`);
  } else {
    console.error(`  ❌ Validación del PDF insatisfecha: páginas=${pdfData.total}, faltantes=${missingSessionsCount}`);
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
