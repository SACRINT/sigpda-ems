// scripts/fix-mccms-acuerdo.mjs
// Run with: node --env-file=.env.local scripts/fix-mccms-acuerdo.mjs

import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ Falta DATABASE_URL en el entorno.');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  console.log('🔍 Consultando estado previo de normativa_documentos id=4...');
  const prevRows = await sql`
    SELECT id, titulo, vigente
    FROM normativa_documentos
    WHERE id = 4
  `;

  if (prevRows.length === 0) {
    console.error('❌ No se encontró documento con id=4 en normativa_documentos.');
    process.exit(1);
  }

  console.log('Estado previo:', prevRows[0]);

  const nuevoTitulo = 'Acuerdo Secretarial 09/08/23 — MCCEMS';

  console.log('🔧 Ejecutando UPDATE idempotente en normativa_documentos id=4...');
  const updateResult = await sql`
    UPDATE normativa_documentos
    SET titulo = ${nuevoTitulo}
    WHERE id = 4
    RETURNING id, titulo, vigente
  `;

  console.log('Filas actualizadas:', updateResult.length);
  console.log('Estado posterior:', updateResult[0]);

  if (updateResult.length !== 1 || updateResult[0].titulo !== nuevoTitulo) {
    console.error('❌ Falló la verificación post-UPDATE.');
    process.exit(1);
  }

  console.log('✅ Fix MCCEMS completado exitosamente.');
}

main().catch((err) => {
  console.error('❌ Error ejecutando script:', err);
  process.exit(1);
});
