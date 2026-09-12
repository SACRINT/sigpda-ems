import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { generatePaecDocx } from '../src/lib/paec-docx-generator';
import type { PaecProject } from '../src/types/paec';

async function runDocxValidation() {
  console.log('================================================================');
  console.log('  SIGPDA-EMS: VALIDACIÓN FASE 5 — GENERADOR DOCX NATIVO');
  console.log('================================================================\n');

  const scratchDir = path.resolve('scratch');
  if (!existsSync(scratchDir)) {
    mkdirSync(scratchDir, { recursive: true });
  }

  // 1. Cargar datos de simulación de Fase 4
  const testJsonPath = path.join(scratchDir, 'paec_pipeline_test.json');
  if (!existsSync(testJsonPath)) {
    console.error('No se encontró scratch/paec_pipeline_test.json');
    process.exit(1);
  }

  const pipelineData = JSON.parse(readFileSync(testJsonPath, 'utf-8'));
  const { cycleA, cycleB, cycleAnnual } = pipelineData.cycleSimulations;

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
  // TEST 1: Generación y Validación de DOCX para Ciclo A
  // --------------------------------------------------------------------------
  console.log('--- 1. Generando y Validando DOCX Ciclo A (1°, 3°, 5°) ---');
  const projectA: PaecProject = {
    id: 'test-paec-cycle-a',
    teacherId: 'teacher-001',
    projectName: cycleA.projectName,
    problemStatement: cycleA.fase2_justificacion.problemStatement,
    cycleType: 'A',
    currentStep: 7,
    communityContext: { location: 'San Pedro Cholula', demographics: 'Periurbana', security: 'Vigilada', environment: 'Residuos sólidos' } as any,
    schoolContext: { facilities: 'BGE Emiliano Zapata', enrollment: '480', teacherCount: '24' } as any,
    fase1Diagnostico: cycleA.fase1_diagnostico,
    fase2Justificacion: cycleA.fase2_justificacion,
    fase2Mapeo: cycleA.fase2_mapeo,
    fase2Cronograma: cycleA.fase2_cronograma,
    fase2DetalleCurricular: cycleA.fase2_detalle_curricular,
    fase2PlanOperativo: cycleA.fase2_plan_operativo,
    fase2Anexos: cycleA.fase2_anexos,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const bufferA = await generatePaecDocx(projectA, 'Mtro. Fernando Morales');
  const docxPathA = path.join(scratchDir, 'test_paec_cycle_a.docx');
  writeFileSync(docxPathA, bufferA);

  const parsedA = await mammoth.extractRawText({ buffer: bufferA });
  const textA = parsedA.value;

  assertCheck('DOCX_CYCLE_A_GENERATED', bufferA.length > 20000, { bytes: bufferA.length, path: docxPathA });
  assertCheck('DOCX_CYCLE_A_SECTION_V_5_COLS', textA.includes('Asignaturas Responsables y Justificación Pedagógica') && textA.includes('Semestre Involucrado'), { found: true });
  assertCheck('DOCX_CYCLE_A_SECTION_VI_DETALLE', textA.includes('VI. DETALLE CURRICULAR Y ARTICULACIÓN POR SEMESTRE') && textA.includes('Matriz Curricular — 5° Semestre'), { found: true });
  assertCheck('DOCX_CYCLE_A_SECTION_VII_PLAN_8_COLS', textA.includes('VII. PLAN OPERATIVO DETALLADO DE TRABAJO') && textA.includes('Instrumento de Evaluación'), { found: true });
  assertCheck('DOCX_CYCLE_A_SECTION_VIII_6_ANEXOS',
    textA.includes('Anexo 1: Minuta') &&
    textA.includes('Anexo 2: Cuadro de Seguimiento Operativo Semanal') &&
    textA.includes('Anexo 3: Reporte Mensual de Avances') &&
    textA.includes('Anexo 4:') &&
    textA.includes('Anexo 5:') &&
    textA.includes('Anexo 6:'),
    { found: true }
  );
  assertCheck('DOCX_CYCLE_A_SECTION_IX_GOBERNANZA',
    textA.includes('IX. GOBERNANZA, SISTEMA DE EVALUACIÓN E INFORME FINAL') &&
    textA.includes('Calendario de Seguimiento Institucional') &&
    textA.includes('Estructura del Informe Final para Supervisión Escolar'),
    { found: true }
  );

  // --------------------------------------------------------------------------
  // TEST 2: Generación y Validación de DOCX para Ciclo B
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Generando y Validando DOCX Ciclo B (2°, 4°, 6°) ---');
  const projectB: PaecProject = {
    id: 'test-paec-cycle-b',
    teacherId: 'teacher-002',
    projectName: cycleB.projectName,
    problemStatement: cycleB.fase2_justificacion.problemStatement,
    cycleType: 'B',
    currentStep: 7,
    communityContext: { location: 'Amozoc de Mota', demographics: 'Rural-urbana', security: 'Tranquila', environment: 'Desabasto de agua' } as any,
    schoolContext: { facilities: 'BGE General Ignacio Zaragoza', enrollment: '350', teacherCount: '18' } as any,
    fase1Diagnostico: cycleB.fase1_diagnostico,
    fase2Justificacion: cycleB.fase2_justificacion,
    fase2Mapeo: cycleB.fase2_mapeo,
    fase2Cronograma: cycleB.fase2_cronograma,
    fase2DetalleCurricular: cycleB.fase2_detalle_curricular,
    fase2PlanOperativo: cycleB.fase2_plan_operativo,
    fase2Anexos: cycleB.fase2_anexos,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const bufferB = await generatePaecDocx(projectB, 'Mtra. Beatriz Ramírez');
  const docxPathB = path.join(scratchDir, 'test_paec_cycle_b.docx');
  writeFileSync(docxPathB, bufferB);

  const parsedB = await mammoth.extractRawText({ buffer: bufferB });
  const textB = parsedB.value;

  assertCheck('DOCX_CYCLE_B_GENERATED', bufferB.length > 20000, { bytes: bufferB.length, path: docxPathB });
  assertCheck('DOCX_CYCLE_B_DETALLE_SEM_6', textB.includes('Matriz Curricular — 6° Semestre de Bachillerato'), { found: true });
  assertCheck('DOCX_CYCLE_B_PLAN_RELEVO_B', textB.includes('Plan Operativo: Semestre B (2°, 4° y 6° Semestre - Bloque de Relevo B)'), { found: true });
  assertCheck('DOCX_CYCLE_B_ANEXO_1_MINUTA_FIRMAS', textB.includes('Formalización y Firmas Colegiadas') && textB.includes('Acuerdos Aprobados por el Comité'), { found: true });

  // --------------------------------------------------------------------------
  // TEST 3: Generación y Validación de DOCX para Ciclo Anual
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Generando y Validando DOCX Ciclo Anual (1° a 6°) ---');
  const projectAnnual: PaecProject = {
    id: 'test-paec-cycle-annual',
    teacherId: 'teacher-003',
    projectName: cycleAnnual.projectName,
    problemStatement: cycleAnnual.fase2_justificacion.problemStatement,
    cycleType: 'annual',
    currentStep: 7,
    communityContext: { location: 'Tepeaca, Puebla', demographics: 'Comunidad escolar agrícola', security: 'Comité de paz', environment: 'Suelo y cultivo' } as any,
    schoolContext: { facilities: 'BGE Manuel Ávila Camacho', enrollment: '620', teacherCount: '32' } as any,
    fase1Diagnostico: cycleAnnual.fase1_diagnostico,
    fase2Justificacion: cycleAnnual.fase2_justificacion,
    fase2Mapeo: cycleAnnual.fase2_mapeo,
    fase2Cronograma: cycleAnnual.fase2_cronograma,
    fase2DetalleCurricular: cycleAnnual.fase2_detalle_curricular,
    fase2PlanOperativo: cycleAnnual.fase2_plan_operativo,
    fase2Anexos: cycleAnnual.fase2_anexos,
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const bufferAnnual = await generatePaecDocx(projectAnnual, 'Dr. Samuel Saldaña');
  const docxPathAnnual = path.join(scratchDir, 'test_paec_cycle_annual.docx');
  writeFileSync(docxPathAnnual, bufferAnnual);

  const parsedAnnual = await mammoth.extractRawText({ buffer: bufferAnnual });
  const textAnnual = parsedAnnual.value;

  assertCheck('DOCX_ANNUAL_GENERATED', bufferAnnual.length > 20000, { bytes: bufferAnnual.length, path: docxPathAnnual });
  assertCheck('DOCX_ANNUAL_BOTH_SEMESTERS_OPERATIONAL',
    textAnnual.includes('Plan Operativo: Semestre A (1°, 3° y 5° Semestre') &&
    textAnnual.includes('Plan Operativo: Semestre B (2°, 4° y 6° Semestre'),
    { found: true }
  );

  // --------------------------------------------------------------------------
  // TEST 4: Compatibilidad con Proyectos Antiguos (Fallback Markdown)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Validación de Compatibilidad Hacia Atrás (Legacy Projects) ---');
  const legacyProject: PaecProject = {
    id: 'legacy-project-001',
    teacherId: 'teacher-001',
    projectName: 'Proyecto PAEC 2025 Antiguo',
    problemStatement: 'Problemática comunitaria antigua',
    cycleType: 'A',
    currentStep: 6,
    communityContext: {} as any,
    schoolContext: {} as any,
    fase1Diagnostico: cycleA.fase1_diagnostico,
    fase2Justificacion: cycleA.fase2_justificacion,
    fase2Mapeo: cycleA.fase2_mapeo,
    fase2Cronograma: cycleA.fase2_cronograma,
    fase2DetalleCurricular: null, // Sin Detalle Curricular (versión vieja)
    fase2PlanOperativo: cycleA.fase2_plan_operativo,
    fase2Anexos: {
      anexo1: '## Minuta Antigua de Reunión\n- Acuerdo 1: Mantener actividades.\n- Acuerdo 2: Evaluación.',
      anexo2: '## Seguimiento Semanal Antiguo\n- Semana 1: Diagnóstico completado.',
      anexo3: '## Reporte Mensual Antiguo\n- Logros principales reportados.',
      anexo4: '## Encuesta Antigua Comunitaria\n- Reactivo 1: Nivel de satisfacción.',
      anexo5: '## Autoevaluación Antigua\n- Criterio 1: Desempeño.',
      anexo6: '## Informe Final Antiguo\n- Conclusiones del ciclo.',
    },
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const bufferLegacy = await generatePaecDocx(legacyProject, 'Profesor Histórico');
  const docxPathLegacy = path.join(scratchDir, 'test_paec_legacy_fallback.docx');
  writeFileSync(docxPathLegacy, bufferLegacy);

  const parsedLegacy = await mammoth.extractRawText({ buffer: bufferLegacy });
  const textLegacy = parsedLegacy.value;

  assertCheck('DOCX_LEGACY_FALLBACK_GENERATED', bufferLegacy.length > 15000, { bytes: bufferLegacy.length });
  assertCheck('DOCX_LEGACY_FALLBACK_TEXT_PARSED',
    textLegacy.includes('Minuta Antigua de Reunión') &&
    textLegacy.includes('Seguimiento Semanal Antiguo') &&
    textLegacy.includes('Reporte Mensual Antiguo'),
    { found: true }
  );

  // --------------------------------------------------------------------------
  // Resumen Final
  // --------------------------------------------------------------------------
  const passed = checks.filter(c => c.passed).length;
  const failed = checks.filter(c => !c.passed).length;

  console.log('\n================================================================');
  console.log(`  RESULTADOS DE VALIDACIÓN DOCX: ${passed}/${checks.length} PRUEBAS PASADAS`);
  console.log('  Archivos generados en carpeta scratch/:');
  console.log(`  - ${docxPathA}`);
  console.log(`  - ${docxPathB}`);
  console.log(`  - ${docxPathAnnual}`);
  console.log(`  - ${docxPathLegacy}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDocxValidation().catch(err => {
  console.error('Error fatal durante la validación DOCX:', err);
  process.exit(1);
});
