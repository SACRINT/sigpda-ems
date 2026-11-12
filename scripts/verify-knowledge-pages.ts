import { neon } from '@neondatabase/serverless';
import { loadEnvLocal } from './lib/load-env';

loadEnvLocal();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const pages = await sql`
    SELECT slug, dominio, titulo, token_count, publicado, uac_slugs
    FROM knowledge_pages
    ORDER BY dominio, slug
  `;
  console.log(`Total knowledge pages in DB: ${pages.length}`);
  for (const p of pages) {
    console.log(`- [${p.dominio}] ${p.slug} | pub=${p.publicado} | tokens=${p.token_count} | uacs=${JSON.stringify(p.uac_slugs)}`);
  }
}

main().catch(console.error);
