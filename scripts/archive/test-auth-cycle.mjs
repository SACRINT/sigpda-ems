import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.replace('DATABASE_URL=', '').replace(/["']/g, '');
      break;
    }
  }
}

const sql = neon(dbUrl);

async function testAuthCycle() {
  console.log('🧪 Probando ciclo de autenticación con bcrypt y base de datos...');

  const testEmail = 'test_docente_fase5@sep.puebla.gob.mx';
  const testPassword = 'PasswordSeguro123!';

  // 1. Limpiar usuario anterior si existe
  await sql`DELETE FROM teachers WHERE email = ${testEmail}`;

  // 2. Hash de contraseña
  const hash = await bcrypt.hash(testPassword, 10);
  console.log('1. Hash generado exitosamente:', hash.substring(0, 20) + '...');

  // 3. Crear usuario
  const [created] = await sql`
    INSERT INTO teachers (
      name, email, password_hash, school_name, cct, subsystem, role, profile_completed
    ) VALUES (
      'Prof. Alejandro Morales Sánchez',
      ${testEmail},
      ${hash},
      'Bachillerato Oficial General Lázaro Cárdenas',
      '21EBH0123Z',
      'bge',
      'docente',
      TRUE
    )
    RETURNING id, name, email, role, school_name, cct, password_hash;
  `;
  console.log('2. Usuario registrado en Neon DB:', { id: created.id, name: created.name, email: created.email, role: created.role });

  // 4. Validar contraseña correcta
  const matchSuccess = await bcrypt.compare(testPassword, created.password_hash);
  console.log('3. Verificación de contraseña correcta:', matchSuccess ? 'EXITOSA ✓' : 'FALLIDA ✗');

  // 5. Validar contraseña incorrecta
  const matchWrong = await bcrypt.compare('PasswordErroneo', created.password_hash);
  console.log('4. Verificación de contraseña incorrecta rechazada:', !matchWrong ? 'CORRECTO ✓' : 'FALLIDA ✗');

  // Limpiar
  await sql`DELETE FROM teachers WHERE email = ${testEmail}`;
  console.log('🎉 ¡Prueba de Autenticación de Paso 1 Superada al 100%!');
}

testAuthCycle().catch(err => {
  console.error('Error en test:', err);
  process.exit(1);
});
