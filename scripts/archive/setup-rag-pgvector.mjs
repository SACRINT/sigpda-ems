/**
 * Phase 6B: Setup pgvector extension and curriculum_embeddings table
 * Run: node scripts/setup-rag-pgvector.mjs
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
} catch { /* .env.local not found */ }

const sql = neon(process.env.DATABASE_URL);

async function setupPgvector() {
  console.log('🔧 Setting up pgvector extension and curriculum_embeddings table...\n');

  // 1. Enable pgvector extension
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✅ pgvector extension enabled');
  } catch (err) {
    console.error('❌ Failed to enable pgvector:', err.message);
    console.log('   Neon DB may not support pgvector on your plan. Using cosine similarity in JS instead.');
    console.log('   Continuing with JSON-based fallback...\n');
  }

  // 2. Create curriculum_embeddings table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS curriculum_embeddings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        program_id TEXT NOT NULL,
        uac_name TEXT NOT NULL,
        semester INTEGER NOT NULL,
        component TEXT NOT NULL,
        subsystem TEXT NOT NULL,
        chunk_type TEXT NOT NULL DEFAULT 'full_program',
        chunk_text TEXT NOT NULL,
        embedding VECTOR(768),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ curriculum_embeddings table created');
  } catch (err) {
    console.error('❌ Failed to create table:', err.message);
    return;
  }

  // 3. Create indexes
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_curriculum_embeddings_program_id ON curriculum_embeddings(program_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_curriculum_embeddings_semester ON curriculum_embeddings(semester)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_curriculum_embeddings_component ON curriculum_embeddings(component)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_curriculum_embeddings_subsystem ON curriculum_embeddings(subsystem)`;
    console.log('✅ Standard indexes created');
  } catch (err) {
    console.error('❌ Failed to create standard indexes:', err.message);
  }

  // 4. Try to create HNSW vector index (requires pgvector)
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_curriculum_embeddings_vector ON curriculum_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`;
    console.log('✅ HNSW vector index created');
  } catch (err) {
    console.log('⚠️  HNSW index skipped (pgvector may not be available). Vector search will use JS fallback.');
  }

  // 5. Create similarity search function
  try {
    await sql`
      CREATE OR REPLACE FUNCTION search_curriculum(
        query_embedding VECTOR(768),
        match_count INTEGER DEFAULT 5,
        filter_semester INTEGER DEFAULT NULL,
        filter_component TEXT DEFAULT NULL,
        filter_subsystem TEXT DEFAULT NULL
      )
      RETURNS TABLE (
        id UUID,
        program_id TEXT,
        uac_name TEXT,
        semester INTEGER,
        component TEXT,
        chunk_text TEXT,
        similarity FLOAT
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          ce.id,
          ce.program_id,
          ce.uac_name,
          ce.semester,
          ce.component,
          ce.chunk_text,
          1 - (ce.embedding <=> query_embedding) AS similarity
        FROM curriculum_embeddings ce
        WHERE
          (filter_semester IS NULL OR ce.semester = filter_semester)
          AND (filter_component IS NULL OR ce.component = filter_component)
          AND (filter_subsystem IS NULL OR ce.subsystem = filter_subsystem)
        ORDER BY ce.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `;
    console.log('✅ search_curriculum function created');
  } catch (err) {
    console.log('⚠️  Vector search function skipped (pgvector not available). Using JS fallback.');
  }

  console.log('\n🎉 RAG infrastructure setup complete!');
}

setupPgvector().catch(console.error);
