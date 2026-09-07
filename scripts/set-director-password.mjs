import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const envText = fs.readFileSync('.env.local', 'utf8');
const m = envText.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = m[1].trim().replace(/['"]/g, '');
const sql = neon(dbUrl);

async function main() {
  const hash = await bcrypt.hash('Director2026!', 10);
  await sql`
    UPDATE teachers
    SET password_hash = ${hash},
        role = 'administrador',
        profile_completed = true
    WHERE email = 'sci211270@gmail.com'
  `;
  console.log('Password hash & admin role updated for sci211270@gmail.com');
}

main().catch(console.error);
