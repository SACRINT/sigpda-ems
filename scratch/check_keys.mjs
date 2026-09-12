import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function check() {
  const keys = await sql`SELECT * FROM api_keys LIMIT 5`;
  console.log('API Keys count:', keys.length);
  if (keys.length > 0) {
    console.log('Columns:', Object.keys(keys[0]));
    keys.forEach(k => console.log('Provider:', k.provider, 'Active:', k.is_active));
  }
}
check();
