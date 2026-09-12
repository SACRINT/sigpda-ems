import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const envText = fs.readFileSync('.env.local', 'utf8');
const m = envText.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = m[1].trim().replace(/['"]/g, '');
const sql = neon(dbUrl);

async function main() {
  const teachersWithPass = await sql`
    SELECT id, email, name, role, cct, subsystem, (password_hash IS NOT NULL) as has_pass
    FROM teachers
    WHERE password_hash IS NOT NULL
    LIMIT 5
  `;
  console.log('Teachers with password:', teachersWithPass);
}

main().catch(console.error);
