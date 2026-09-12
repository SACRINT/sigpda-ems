// Obtener todas las capacitaciones del generador de horarios y UACs laborales
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  env[k] = v;
}
const sql = neon(env['DATABASE_URL'] || env['POSTGRES_URL']);

// 1. Capacitaciones únicas en horario_grupos
const caps = await sql`
  SELECT DISTINCT capacitacion_nombre
  FROM horario_grupos
  WHERE capacitacion_nombre IS NOT NULL AND capacitacion_nombre != ''
  ORDER BY capacitacion_nombre
`;
console.log(`\n=== Capacitaciones únicas en horario_grupos ===`);
console.log(`Total: ${caps.length}`);
for (const c of caps) console.log(`  - "${c.capacitacion_nombre}"`);

// 2. Ver las UACs laborales en programs_catalog con su curriculum_name
const uacs = await sql`
  SELECT DISTINCT curriculum_name, uac_name, semester, subsystem
  FROM programs_catalog
  WHERE component = 'laboral'
  ORDER BY curriculum_name, semester, uac_name
  LIMIT 50
`;
console.log(`\n=== UACs laborales en programs_catalog (primeras 50) ===`);
for (const u of uacs) {
  console.log(`  [${u.curriculum_name}] sem${u.semester}: ${u.uac_name} (${u.subsystem})`);
}

// 3. Ver si hay alguna tabla que relacione capacitación → UACs laborales (en el generador de horarios)
// Revisar el código del generador para ver las rutas usadas
const { readdirSync, readFileSync: rfs } = await import('fs');
const scriptsDir = './scripts';
const files = readdirSync(scriptsDir).filter(f => f.includes('horario'));
console.log('\n=== Scripts del horario ===');
for (const f of files) console.log(`  - ${f}`);

// 4. Revisar carreas técnicas para bachilleratos tecnológicos
const techRoutes = await sql`
  SELECT DISTINCT carrera_tecnica_id, version_programa, semestre
  FROM horario_grupos
  WHERE carrera_tecnica_id IS NOT NULL AND carrera_tecnica_id != ''
  ORDER BY carrera_tecnica_id, semestre
  LIMIT 20
`;
console.log('\n=== Carreras técnicas en horario_grupos ===');
for (const t of techRoutes) {
  console.log(`  carrera="${t.carrera_tecnica_id}" version="${t.version_programa}" sem=${t.semestre}`);
}
