// check-rag-bd.mjs — verifica curriculum_embeddings usando @neondatabase/serverless
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = match ? match[1].trim().replace(/^["']|["']$/g, '') : '';

if (!dbUrl) { console.error('No DATABASE_URL en .env.local'); process.exit(1); }

const sql = neon(dbUrl);

try {
  // Verificar si la tabla existe
  const tableCheck = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='curriculum_embeddings'
  `;
  
  if (tableCheck.length === 0) {
    console.log('RESULTADO: La tabla curriculum_embeddings NO EXISTE en la BD');
    console.log('Accion requerida: Ejecutar migration SQL para crearla con pgvector');
  } else {
    const r = await sql`SELECT COUNT(*)::int as total FROM curriculum_embeddings`;
    console.log('RESULTADO curriculum_embeddings COUNT:', r[0].total);
    
    if (r[0].total === 0) {
      const p = await sql`SELECT COUNT(*)::int as total FROM programs_catalog`;
      console.log('programs_catalog disponibles para seed:', p[0].total);
      console.log('DECISION: Tabla VACIA — ejecutar PASO 6 (seed de embeddings)');
    } else {
      console.log('RAG ya tiene datos — solo activar en generate/route.ts (PASO 2)');
      const sample = await sql`SELECT uac_name, semester, component, LEFT(chunk_text,80) as preview FROM curriculum_embeddings LIMIT 3`;
      console.log('Muestra de chunks:', JSON.stringify(sample, null, 2));
    }
  }
} catch(e) {
  console.error('Error al consultar:', e.message);
}
