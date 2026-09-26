// scripts/seed-catalogo-metas.ts
import { applyCatalogoMetasSchemaAndSeed } from './apply-catalogo-metas-schema.mjs';
import { CATALOGO_METAS_CANONICO } from '../src/lib/catalogo-metas-pmc.ts';

async function main() {
  console.log('🚀 Iniciando sincronización del catálogo canónico de metas...');
  const count = await applyCatalogoMetasSchemaAndSeed(CATALOGO_METAS_CANONICO);
  console.log(`✅ Catálogo de metas sincronizado exitosamente (${count} registros).`);
}

main().catch((err) => {
  console.error('❌ Error al sincronizar catálogo de metas:', err);
  process.exit(1);
});
