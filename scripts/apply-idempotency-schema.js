// scripts/apply-idempotency-schema.js
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('⏳ Applying idempotency_keys schema (Mejora #24)...');

  await sql`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key UUID PRIMARY KEY,
      teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      endpoint VARCHAR(255) NOT NULL,
      result_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `;
  console.log('  ✅ idempotency_keys table ready');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_idempotency_lookup 
    ON idempotency_keys(key, teacher_id, endpoint);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_idempotency_teacher 
    ON idempotency_keys(teacher_id);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_idempotency_expires 
    ON idempotency_keys(expires_at);
  `;
  console.log('  ✅ Indexes on idempotency_keys ready');

  console.log('\n🎉 Idempotency schema applied successfully!');
}

main().catch((err) => {
  console.error('❌ Error applying idempotency schema:', err);
  process.exit(1);
});
