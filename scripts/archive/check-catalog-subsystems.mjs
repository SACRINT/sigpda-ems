import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

const progs = await sql`
  SELECT subsystem, component, count(*) as count
  FROM programs_catalog 
  GROUP BY subsystem, component 
  ORDER BY subsystem, component
`;

console.table(progs);
