import { generateBlockSessions } from '../src/lib/session-progression-engine';
import { buildBlockBlueprint } from '../src/lib/guide-engine/blueprint-architect-agent';
import type { KeyActivityPlan, Planning } from '../src/types/planning';

console.log('--- TEST 1: session-progression-engine ---');
const testActivity: KeyActivityPlan = {
  name: 'Desarrollo de Software con Python en el Negocio Local',
  hours: 18,
  methodology: 'abp',
  apertura: {
    activities: 'Planteamiento del reto: Don Filemón necesita automatizar el inventario de su tienda poblana.',
    processes: 'Análisis diagnóstico y preguntas detonadoras',
    materials: 'Pizarrón, libreta de notas',
  },
  ejecucion: {
    activities: 'Codificación en Python de bucles while, estructuras de control y funciones de cálculo de inventario.',
    processes: 'Práctica de laboratorio guiada y trabajo colaborativo',
    materials: 'Computadoras, IDE VS Code, intérprete de Python',
  },
  conclusion: {
    activities: 'Prueba de ejecución del script, coevaluación técnica de código limpio y balance de metacognición.',
    processes: 'Demostración de código y rúbrica formativa',
    materials: 'Rúbrica analítica',
  },
  contenidoFormativo: 'Sintaxis básica de Python, estructuras de control, funciones y modularidad',
  saberes: {
    saber: 'Sintaxis de Python, tipos de datos y estructuras de control',
    saberHacer: 'Escribir scripts estructurados para resolver problemas de inventario',
    saberSer: 'Responsabilidad y ética en la manipulación de datos de negocios',
  },
};

const sessions = generateBlockSessions(testActivity, 0, 18, 'Desarrollar soluciones informáticas para PYMES', true);
console.log(`Generated ${sessions.length} sessions.`);

const s1 = sessions[0];
console.log('Session 1 (Apertura):', {
  phase: s1.phase,
  teachingActivity: s1.teachingActivity,
  learningActivity: s1.learningActivity,
});

const s5 = sessions[4];
console.log('Session 5 (Desarrollo):', {
  phase: s5.phase,
  teachingActivity: s5.teachingActivity,
  learningActivity: s5.learningActivity,
});

const s18 = sessions[17];
console.log('Session 18 (Cierre):', {
  phase: s18.phase,
  teachingActivity: s18.teachingActivity,
  learningActivity: s18.learningActivity,
});

// Verify keywords from Section IV are present in the sessions
const hasDonFilemon = s1.teachingActivity?.includes('Don Filemón') || s1.learningActivity?.includes('Don Filemón') || s1.description?.includes('Don Filemón');
const hasCodificacion = s5.teachingActivity?.includes('Codificación') || s5.learningActivity?.includes('Codificación') || s5.description?.includes('Codificación');
const hasPrueba = s18.teachingActivity?.includes('Prueba de ejecución') || s18.learningActivity?.includes('Prueba de ejecución') || s18.description?.includes('Prueba de ejecución');

console.log('Verification assertions:');
console.log('  Don Filemón in Apertura session:', hasDonFilemon ? 'PASS' : 'FAIL');
console.log('  Codificación in Desarrollo session:', hasCodificacion ? 'PASS' : 'FAIL');
console.log('  Prueba de ejecución in Cierre session:', hasPrueba ? 'PASS' : 'FAIL');

console.log('\n--- TEST 2: blueprint-architect-agent fallback reading Section IV ---');
const mockPlanning: any = {
  id: 'test-uuid',
  teacherId: 'teacher-uuid',
  uacName: 'Programación Modular',
  semester: 2,
  component: 'laboral',
  metodologiaActiva: 'abp',
  contentJson: {
    sectionI: {} as any,
    sectionII: { purpose: 'Propósito', learningOutcomes: ['Resultado 1'] } as any,
    sectionIII: {} as any,
    sectionIV: {
      activities: [testActivity],
    } as any,
    sectionV: {} as any,
    sectionVI: {} as any,
    sectionVII: {} as any,
  },
  status: 'completada' as any,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const blueprint = buildBlockBlueprint({
  blockIndex: 0,
  blockName: testActivity.name,
  planning: mockPlanning,
  curriculum: {
    uacName: 'Programación Modular',
    semester: 2,
    component: 'laboral',
    subsystem: 'bt',
    weeklyHours: 4,
    programYear: 2026,
    hasActiveMethodology: true,
    paecConnection: {
      projectName: 'Digitalización del Comercio Local',
      communityProblem: 'Comercio informal y rezago tecnológico',
      suggestedHooks: ['Inventario Don Filemón'],
    },
  } as any,
});

console.log('Blueprint created:');
console.log('  Total sessions in blueprint:', blueprint.sessions.length);
console.log('  Missions count:', blueprint.missions.length);
console.log('  Mission 1 title:', blueprint.missions[0]?.title);
console.log('  Mission 1 session numbers:', blueprint.missions[0]?.sessionNumbers);

const blueprintS1 = blueprint.sessions[0];
const bpHasDonFilemon = blueprintS1.teachingActivity?.includes('Don Filemón') || blueprintS1.learningActivity?.includes('Don Filemón') || blueprintS1.description?.includes('Don Filemón');
console.log('  Blueprint read real Section IV (Don Filemón):', bpHasDonFilemon ? 'PASS' : 'FAIL');

if (hasDonFilemon && hasCodificacion && hasPrueba && bpHasDonFilemon) {
  console.log('\n>>> ALL ALIGNMENT TESTS PASSED PERFECTLY! <<<');
} else {
  console.error('\n>>> SOME TESTS FAILED <<<');
  process.exit(1);
}
