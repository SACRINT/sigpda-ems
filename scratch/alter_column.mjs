import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function run() {
  await sql`ALTER TABLE programs_catalog ALTER COLUMN learning_outcome DROP NOT NULL`;
  console.log('✓ learning_outcome is now NULLABLE in programs_catalog');
}

run().catch(console.error);
