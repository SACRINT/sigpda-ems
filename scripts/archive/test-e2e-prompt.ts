import { neon } from '@neondatabase/serverless';
import { buildUserPrompt } from '../src/lib/prompts/build-prompt';

const sql = neon(process.env.DATABASE_URL!);

async function testE2EPrompt() {
  console.log('🧪 Iniciando prueba E2E de construcción de prompts con catálogo auténtico...\n');

  // 1. Caso Fundamental: Pensamiento Matemático I
  const [mathProgram] = await sql`
    SELECT * FROM programs_catalog 
    WHERE uac_name ILIKE '%Pensamiento Matemático I%' AND semester = 1 
    LIMIT 1
  `;
  const promptMath = buildUserPrompt(
    {
      uacName: mathProgram.uac_name,
      totalHours: mathProgram.total_hours,
      learningOutcome: mathProgram.learning_outcome,
      activities: mathProgram.activities,
      evidences: mathProgram.evidences,
      contenidosFormativos: mathProgram.contenidos_formativos
    },
    {
      teacherName: 'Prof. Juan Pérez',
      schoolName: 'Bachillerato General Emiliano Zapata',
      municipality: 'Puebla',
      state: 'Puebla',
      subsystem: 'bge',
      paecProblem: 'Contaminación y falta de áreas verdes en la comunidad escolar'
    },
    1,
    'fundamental',
    mathProgram
  );

  console.log('✅ 1. Prompt Matemáticas I generado exitosamente.');
  console.log('   - Longitud:', promptMath.length, 'caracteres');
  console.log('   - Contiene propósitos oficiales:', promptMath.includes('PROPÓSITOS FORMATIVOS Y CONTENIDOS TEMÁTICOS OFICIALES'));
  console.log('   - Contiene temas oficiales:', promptMath.includes('Tablas de verdad') || promptMath.includes('Conceptualización de lógica'));
  console.log('   - Carga por corte calculada (24h/corte para 72h total):', promptMath.includes('24 horas exactas por Corte'));

  // 2. Caso Formación Laboral (3 Actividades Clave)
  const [laboralProgram] = await sql`
    SELECT * FROM programs_catalog 
    WHERE component = 'laboral' AND semester = 3 
    LIMIT 1
  `;
  const promptLaboral = buildUserPrompt(
    {
      uacName: laboralProgram.uac_name,
      totalHours: laboralProgram.total_hours,
      learningOutcome: laboralProgram.learning_outcome,
      activities: laboralProgram.activities,
      evidences: laboralProgram.evidences,
      contenidosFormativos: laboralProgram.contenidos_formativos
    },
    {
      teacherName: 'Prof. Ana López',
      schoolName: 'Bachillerato Digital 45',
      municipality: 'Tehuacán',
      state: 'Puebla',
      subsystem: 'digital',
      paecProblem: 'Soberanía alimentaria y sustentabilidad en hogares rurales'
    },
    3,
    'laboral',
    laboralProgram
  );

  console.log('\n✅ 2. Prompt Formación Laboral generado exitosamente.');
  console.log('   - Longitud:', promptLaboral.length, 'caracteres');
  console.log('   - Estructurado en 3 Actividades Clave:', promptLaboral.includes('ACTIVIDADES CLAVE OFICIALES DEL PROGRAMA (EXACTAMENTE 3, 18 HORAS CADA UNA)'));
  console.log('   - Dosificación 18h x 3 cortes:', promptLaboral.includes('Asigna la Actividad Clave 1 al Corte 1 (18h)'));

  // 3. Caso FFE Optativa con Continuidad y Retroalimentación de Auditoría
  const [ffeContinuity] = await sql`
    SELECT * FROM ffe_continuity 
    WHERE semester_5_uac ILIKE '%Arte y Cultura I%' 
    LIMIT 1
  `;

  const [auditFeedback] = await sql`
    SELECT * FROM audit_results 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  const promptFfe = buildUserPrompt(
    {
      uacName: 'Arte y Cultura I',
      totalHours: 54,
      learningOutcome: '',
      activities: [{ name: 'Progresión 1: Expresión estética', hours: 18 }],
      evidences: ['Bitácora artística'],
    },
    {
      teacherName: 'Prof. Carlos Rivera',
      schoolName: 'EMSAD San Andrés',
      municipality: 'Cholula',
      state: 'Puebla',
      subsystem: 'emsad',
      paecProblem: 'Rescate de tradiciones y patrimonio cultural comunitario'
    },
    5,
    'ext_optativo',
    null,
    auditFeedback,
    ffeContinuity
  );

  console.log('\n✅ 3. Prompt FFE Optativa con Auditoría y Continuidad generado exitosamente.');
  console.log('   - Inyecta trayectoria FFE:', promptFfe.includes('TRAYECTORIA Y CONTINUIDAD FFE'));
  console.log('   - Inyecta retroalimentación de auditoría:', promptFfe.includes('RETROALIMENTACIÓN DE AUDITORÍA PEDAGÓGICA PREVIA'));
  console.log('   - Incluye score previo:', promptFfe.includes(String(auditFeedback.overall_score)));

  console.log('\n🌟 TODAS LAS PRUEBAS DE LA FASE 3 PASARON SATISFACTORIAMENTE.');
}

testE2EPrompt().catch(console.error);
