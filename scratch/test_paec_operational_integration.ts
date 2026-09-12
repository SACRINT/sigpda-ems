import { buildUserPrompt } from '../src/lib/prompts/build-prompt';
import { PaecOperationalActivity, TeacherContext, ExtractedPdfData } from '../src/types/planning';

// 1. Test subject matching logic
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function romanToArabic(roman: string): string {
  const map: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };
  return roman.replace(/\b(i{1,3}|iv|v|vi)\b/gi, (m) => map[m.toLowerCase()] || m);
}

function matchSubject(targetUac: string, paecSubject: string): boolean {
  if (!targetUac || !paecSubject) return false;
  const tNorm = romanToArabic(normalizeText(targetUac));
  const pNorm = romanToArabic(normalizeText(paecSubject));

  if (tNorm === pNorm) return true;
  if (tNorm.includes(pNorm) || pNorm.includes(tNorm)) return true;

  const tWords = tNorm.split(' ').filter(w => w.length > 2 && !['para', 'del', 'los', 'las', 'con', 'sus', 'por'].includes(w));
  const pWords = pNorm.split(' ').filter(w => w.length > 2 && !['para', 'del', 'los', 'las', 'con', 'sus', 'por'].includes(w));

  if (tWords.length === 0 || pWords.length === 0) return false;
  const common = tWords.filter(w => pWords.includes(w));
  return common.length >= Math.min(2, tWords.length);
}

console.log('=== TEST 1: FUZZY SUBJECT MATCHING ===');
const testCases = [
  { target: 'Pensamiento Matemático I', paec: 'Pensamiento Matemático 1', expected: true },
  { target: 'La Materia y sus Interacciones', paec: 'La materia y sus interacciones I', expected: true },
  { target: 'Lengua y Comunicación I', paec: 'Lengua y Comunicación 1', expected: true },
  { target: 'Cultura Digital I', paec: 'Cultura Digital 1', expected: true },
  { target: 'Inglés I', paec: 'Ingles 1', expected: true },
  { target: 'Ciencias Sociales I', paec: 'Ciencias Sociales', expected: true },
  { target: 'Pensamiento Matemático I', paec: 'Química II', expected: false },
  { target: 'Conservación de la Energía', paec: 'Pensamiento Matemático', expected: false },
];

let matchPass = 0;
for (const tc of testCases) {
  const matched = matchSubject(tc.target, tc.paec);
  const ok = matched === tc.expected;
  if (ok) matchPass++;
  console.log(`- "${tc.target}" vs "${tc.paec}": ${matched ? 'MATCH' : 'NO MATCH'} [${ok ? 'OK' : 'FAIL'}]`);
}
console.log(`Result: ${matchPass}/${testCases.length} passed.`);

// 2. Test prompt generation with PaecOperationalActivity
console.log('\n=== TEST 2: PROMPT INJECTION WITH PAEC OPERATIONAL ACTIVITY ===');
const sampleActivity: PaecOperationalActivity = {
  asignatura: 'Pensamiento Matemático 1',
  actividad: 'Diseño de un croquis a escala con plano cartesiano y cálculo de áreas para el huerto escolar sustentable',
  semana: 'Semana 3',
  fase: 'Fase 2',
  estrategiaDidactica: 'Aprendizaje Basado en Proyectos (ABP)',
  propositoFormativo: 'Aplica conceptos de coordenadas y áreas en situaciones contextuales reales',
  isPrescheduled: true,
};

const sampleContextWithActivity: TeacherContext = {
  teacherName: 'Prof. Juan Pérez',
  schoolName: 'Bachillerato Héroes de la Patria',
  municipality: 'Puebla',
  state: 'Puebla',
  region: 'Zona 004',
  subsystem: 'bge',
  groupInfo: '1° Semestre',
  paecProjectName: 'Huerto Escolar Sustentable para la Soberanía Alimentaria',
  paecProblem: 'Falta de espacios verdes productivos y mala nutrición en la comunidad estudiantil.',
  paecObjective: 'Crear un huerto escolar para cultivar hortalizas y fomentar el consumo saludable.',
  paecOperationalActivity: sampleActivity,
  usePaecActivity: true,
  studentContext: 'Estudiantes de bachillerato general de 15-18 años en Puebla.',
};

const sampleExtractedData: ExtractedPdfData = {
  uacName: 'Pensamiento Matemático I',
  totalHours: 64,
  activities: [
    { name: 'Propósito Formativo 1: Coordenadas y modelación geométrica', hours: 21, order: 1 },
    { name: 'Propósito Formativo 2: Razones de cambio y proporciones', hours: 21, order: 2 },
    { name: 'Propósito Formativo 3: Estadística descriptiva aplicada', hours: 22, order: 3 },
  ],
  learningOutcome: 'Modela matemáticamente fenómenos del entorno cotidiano.',
  evidences: ['Croquis a escala del huerto', 'Reporte de cubicación'],
  parseConfidence: 'high',
};

const promptWithActivity = buildUserPrompt(
  sampleExtractedData,
  sampleContextWithActivity,
  1,
  'fundamental'
);

const hasOperationalActivityInPrompt = promptWithActivity.includes('Diseño de un croquis a escala con plano cartesiano');
const hasSectionIIIInstruction = promptWithActivity.includes('SECCIÓN III (Transversalidad y PAEC)');
const hasSectionIVInstruction = promptWithActivity.includes('SECCIÓN IV (Secuencia Didáctica)');
const hasQualityObligation = promptWithActivity.includes('Integra OBLIGATORIAMENTE en la Sección III y en la secuencia de la Sección IV la actividad oficial del Plan Operativo');

console.log('Checks with activity:');
console.log('- Contains assigned activity:', hasOperationalActivityInPrompt ? 'YES' : 'NO');
console.log('- Injects Section III rule:', hasSectionIIIInstruction ? 'YES' : 'NO');
console.log('- Injects Section IV rule:', hasSectionIVInstruction ? 'YES' : 'NO');
console.log('- Quality instruction #1 updated:', hasQualityObligation ? 'YES' : 'NO');

// 3. Test prompt generation WITHOUT PaecOperationalActivity (Subject not in PAEC)
console.log('\n=== TEST 3: PROMPT INJECTION WITHOUT PAEC OPERATIONAL ACTIVITY ===');
const sampleContextWithoutActivity: TeacherContext = {
  ...sampleContextWithActivity,
  paecOperationalActivity: null,
  usePaecActivity: false,
};

const promptWithoutActivity = buildUserPrompt(
  sampleExtractedData,
  sampleContextWithoutActivity,
  1,
  'fundamental'
);

const hasFallbackInstruction = promptWithoutActivity.includes('Esta asignatura (Pensamiento Matemático I) no cuenta con una actividad preasignada en el Plan Operativo');
const hasProposeInstruction = promptWithoutActivity.includes('Propón actividades transversales pertinentes');

console.log('Checks without activity:');
console.log('- Injects fallback info for unassigned UAC:', hasFallbackInstruction ? 'YES' : 'NO');
console.log('- Injects proposal instruction:', hasProposeInstruction ? 'YES' : 'NO');

if (
  matchPass === testCases.length &&
  hasOperationalActivityInPrompt &&
  hasSectionIIIInstruction &&
  hasSectionIVInstruction &&
  hasQualityObligation &&
  hasFallbackInstruction &&
  hasProposeInstruction
) {
  console.log('\n>>> ALL PAEC OPERATIONAL TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error('\n>>> SOME CHECKS FAILED! <<<');
  process.exit(1);
}
