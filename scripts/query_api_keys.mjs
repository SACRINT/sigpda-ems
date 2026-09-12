import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
const dbMatch = envContent.match(/DATABASE_URL=([^\r\n]+)/);
const dbUrl = dbMatch[1].trim();

const sql = neon(dbUrl);
const rows = await sql`SELECT id, label, provider, model_default, is_active, error_count FROM api_keys`;
console.log('KEYS IN DB:', rows);
