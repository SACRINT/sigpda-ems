import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const envContent = readFileSync(join(__dir, '../.env.local'), 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

// Get actual column names
const cols = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'programs_catalog'
  ORDER BY ordinal_position
`;
console.log('Columns in programs_catalog:');
cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

// Sample 2 BGE laboral rows
const rows = await sql`
  SELECT id, curriculum_name, semester, uac_name, component
  FROM programs_catalog
  WHERE component = 'laboral' AND curriculum_name = 'Instalaciones Residenciales'
  ORDER BY id
  LIMIT 4
`;
console.log('\nSample Instalaciones Residenciales rows:');
rows.forEach(r => console.log(`  id=${r.id} sem=${r.semester} component=${r.component} uac=${r.uac_name?.substring(0,50)}`));
