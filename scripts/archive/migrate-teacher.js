const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

async function main() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const dbUrlMatch = envFile.match(/DATABASE_URL=(.*)/);
  if (!dbUrlMatch) {
    console.error('DATABASE_URL not found');
    return;
  }
  const dbUrl = dbUrlMatch[1].replace(/['"]/g, '').trim();
  
  const sql = neon(dbUrl);
  
  try {
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`;
    console.log('Added updated_at');
  } catch (e) { console.error('Error adding updated_at:', e.message); }
  
  try {
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS city TEXT;`;
    console.log('Added city');
  } catch (e) { console.error('Error adding city:', e.message); }
  
  try {
    await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS cct TEXT;`;
    console.log('Added cct');
  } catch (e) { console.error('Error adding cct:', e.message); }
}

main();
