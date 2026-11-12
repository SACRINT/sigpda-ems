import { neon } from '@neondatabase/serverless';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { loadEnvLocal } from './lib/load-env';
import { COMPUTACION_REDES_TRAJECTORY } from '../src/lib/curriculum/trajectories/computacion-redes';
import { buildFormativeContents } from '../src/lib/curriculum/trajectory-contents';

loadEnvLocal();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const EXPECTED_HASH = 'b5838d111dfc2fe561ce2a39b8d8b94ef6ae9af4173c784b36d67210668ea769';
const pdfRelPath = '../documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2023 - 2026/Curriculum Laboral BGE 2024/Redes_y_Mantenimiento_2024.pdf';

async function main() {
  console.log('💻 enriqueciendo catálogo oficial de Computación y Redes...\n');

  // 1. Verificación criptográfica del PDF oficial fuente
  const fullPdfPath = path.resolve(pdfRelPath);
  if (!fs.existsSync(fullPdfPath)) {
    throw new Error(`PDF oficial no encontrado en disco: ${fullPdfPath}`);
  }
  const pdfBytes = fs.readFileSync(fullPdfPath);
  const actualHash = createHash('sha256').update(pdfBytes).digest('hex');
  console.log(`📄 Documento: Redes_y_Mantenimiento_2024.pdf (${pdfBytes.length} bytes)`);
  console.log(`🔒 SHA-256: ${actualHash}`);

  if (actualHash !== EXPECTED_HASH) {
    throw new Error(`El hash criptográfico del PDF (${actualHash}) no coincide con el esperado (${EXPECTED_HASH})`);
  }
  console.log('✅ Hash criptográfico validado con éxito.\n');

  // 2. Ingesta idempotente de las 8 UACs canónicas
  const nodes = COMPUTACION_REDES_TRAJECTORY.nodes;
  console.log(`📦 Procesando ${nodes.length} UACs canónicas de Computación y Redes...`);

  for (const node of nodes) {
    const activities = node.keyActivities.map((act, idx) => ({
      name: act.name,
      hours: act.hours,
      order: idx + 1,
    }));

    const evidences = node.keyActivities.map((act) => {
      return `Protocolo técnico de comprobación y evidencia de desempeño para ${act.name}`;
    });

    const contenidosFormativos = buildFormativeContents(node);

    await sql`
      INSERT INTO programs_catalog (
        uac_name, semester, component, total_hours, learning_outcome,
        activities, evidences, contenidos_formativos, subsystem, curriculum_name
      )
      VALUES (
        ${node.uacName},
        ${node.semester},
        'laboral',
        ${node.totalHours},
        ${node.learningOutcome},
        ${JSON.stringify(activities)}::jsonb,
        ${JSON.stringify(evidences)}::jsonb,
        ${JSON.stringify(contenidosFormativos)}::jsonb,
        'bge',
        'Redes y Mantenimiento'
      )
      ON CONFLICT (uac_name, semester, component, subsystem) DO UPDATE SET
        total_hours = EXCLUDED.total_hours,
        learning_outcome = EXCLUDED.learning_outcome,
        activities = EXCLUDED.activities,
        evidences = EXCLUDED.evidences,
        contenidos_formativos = EXCLUDED.contenidos_formativos,
        curriculum_name = EXCLUDED.curriculum_name;
    `;
    console.log(`  ✅ Ingerida UAC Sem ${node.semester}: "${node.uacName}"`);
  }

  // 3. Verificación post-ingesta
  const verification = await sql`
    SELECT uac_name, semester, 
           jsonb_array_length(activities) as num_act,
           contenidos_formativos->0->>'needs_review' as needs_rev
    FROM programs_catalog
    WHERE curriculum_name = 'Redes y Mantenimiento'
    ORDER BY semester, uac_name
  `;

  console.log(`\n📋 Verificación en Neon DB (${verification.length} UACs registradas):`);
  let hasErrors = false;
  for (const r of verification) {
    const ok = r.num_act === 3 && r.needs_rev === 'false';
    if (!ok) hasErrors = true;
    console.log(`  - [Sem ${r.semester}] "${r.uac_name}" | acts=${r.num_act} | needs_review=${r.needs_rev} ${ok ? '🟢' : '🔴'}`);
  }

  if (hasErrors || verification.length !== 8) {
    throw new Error('La verificación en base de datos falló: se esperaban 8 UACs con 3 actividades y needs_review=false');
  }

  console.log('\n🎉 ¡Capacitación de Computación y Redes ingerida exitosamente con datos oficiales verificados!');
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
