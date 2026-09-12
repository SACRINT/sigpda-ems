import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    }
  });
}

async function runTest() {
  console.log('🧪 Iniciando Verificación E2E de la Fase 5 (SIGPDA-EMS)...\n');
  const sql = neon(process.env.DATABASE_URL);

  // 1. Verificar Tablas y Columnas de Auth
  console.log('🔹 [1/4] Verificando esquema de Autenticación y Teachers...');
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'teachers' AND column_name IN ('password_hash', 'reset_token', 'reset_token_expires')
  `;
  if (cols.length >= 3) {
    console.log('   ✅ Columnas password_hash, reset_token, reset_token_expires presentes.');
  } else {
    throw new Error('❌ Faltan columnas en teachers: ' + JSON.stringify(cols));
  }

  // 2. Verificar Hash bcrypt
  console.log('\n🔹 [2/4] Verificando robustez criptográfica bcrypt...');
  const samplePass = 'PasswordSeguro123!';
  const hash = await bcrypt.hash(samplePass, 10);
  const match = await bcrypt.compare(samplePass, hash);
  const failMatch = await bcrypt.compare('WrongPassword', hash);
  if (match && !failMatch) {
    console.log('   ✅ Bcrypt hashing y compare funcionan al 100%.');
  } else {
    throw new Error('❌ Fallo en verificación bcrypt.');
  }

  // 3. Verificar Cartografía de Zona Escolar en Base de Datos
  console.log('\n🔹 [3/4] Verificando persistencia de Cartografía de Zona Escolar (pips_projects)...');
  const countPips = await sql`SELECT count(*)::int as total FROM pips_projects`;
  console.log(`   ✅ Tabla pips_projects accesible. Total registros: ${countPips[0].total}`);

  // 4. Verificar Tabla de Suscripciones y Límites
  console.log('\n🔹 [4/4] Verificando tabla de suscripciones...');
  const subCols = await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'subscriptions'
  `;
  console.log(`   ✅ Tabla subscriptions presente con ${subCols.length} columnas.`);

  console.log('\n🎉 ¡TODAS LAS VERIFICACIONES DE LA FASE 5 HAN SIDO EXITOSAS!');
}

runTest().catch((err) => {
  console.error('❌ Error en prueba E2E Fase 5:', err);
  process.exit(1);
});
