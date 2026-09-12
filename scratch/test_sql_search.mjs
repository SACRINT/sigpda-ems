import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const env = readFileSync('.env.local', 'utf-8');
const match = env.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const sql = neon(match[1]);

async function test() {
  const query = "Pensamiento Matemático ecuaciones cuadráticas";
  const searchTerms = query.split(/\s+/).filter(t => t.length > 3).slice(0, 5);
  const patterns = searchTerms.length > 0 ? searchTerms.map(t => `%${t}%`) : ['%'];
  const semester = 3;
  const matchCount = 3;

  const results = await sql`
    SELECT id, program_id, uac_name, semester, component, chunk_text, 0.5 as similarity
    FROM curriculum_embeddings
    WHERE (
      ${patterns.length === 0} = true
      OR chunk_text ILIKE ANY(${patterns})
    )
    AND (${semester || null}::int IS NULL OR semester = ${semester || null}::int)
    LIMIT ${matchCount}
  `;
  console.log('Results found:', results.length);
  for (const r of results) {
    console.log(`- ${r.uac_name} (Sem: ${r.semester})`);
  }
}
test();
