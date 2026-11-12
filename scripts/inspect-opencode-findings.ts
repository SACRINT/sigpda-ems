import { neon } from '@neondatabase/serverless';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const dbUrl = env.split('\n').find(l => l.startsWith('DATABASE_URL='))!.replace('DATABASE_URL=', '').trim().replace(/^['"]|['"]$/g, '');
const sql = neon(dbUrl);

async function inspect() {
  // 1. Ver páginas en knowledge_pages
  const published = await sql`SELECT count(*)::int as count FROM knowledge_pages WHERE publicado = true`;
  const draft = await sql`SELECT count(*)::int as count FROM knowledge_pages WHERE publicado = false`;
  console.log(`\n=== KNOWLEDGE PAGES ===`);
  console.log(`Publicadas: ${published[0].count}, En borrador (draft / no publicadas): ${draft[0].count}`);
  
  const draftRows = await sql`SELECT id, slug, dominio, titulo, applicable_a FROM knowledge_pages WHERE publicado = false`;
  console.log('\n--- 12 PÁGINAS EN DRAFT ---');
  console.table(draftRows.map(r => ({ id: r.id, slug: r.slug.substring(0, 40), dominio: r.dominio, app: JSON.stringify(r.applicable_a) })));

  // 2. ¿Cuáles son las "7 filas BT corruptas" que menciona OpenCode?
  console.log('\n=== BUSCANDO LAS 7 FILAS BT QUE MENCIONA OPENCODE ===');
  const btAll = await sql`
    SELECT id, uac_name, semester, component, contenidos_formativos, activities
    FROM programs_catalog
    WHERE subsystem = 'tecnologico'
  `;
  const btIssues: any[] = [];
  for (const r of btAll) {
    const cf = typeof r.contenidos_formativos === 'string' ? JSON.parse(r.contenidos_formativos) : (r.contenidos_formativos || []);
    const acts = typeof r.activities === 'string' ? JSON.parse(r.activities) : (r.activities || []);
    
    // Check for any corrupt or anomalous structure
    const hasEmptyCF = !cf || cf.length === 0;
    const hasEmptyActs = !acts || acts.length === 0;
    const hasUnparsedSaberes = cf.some((c: any) => !c.saberes || (Array.isArray(c.saberes) && c.saberes.length === 0));
    
    if (hasEmptyCF || hasEmptyActs || hasUnparsedSaberes) {
      btIssues.push({ id: r.id, uac_name: r.uac_name, issue: { hasEmptyCF, hasEmptyActs, hasUnparsedSaberes } });
    }
  }
  console.log(`BT con cf/acts/saberes vacíos: ${btIssues.length}`);
  if (btIssues.length > 0) console.log(btIssues);

  // 2. Investigar qué 7 filas de BT señala OpenCode
  console.log('\n=== INVESTIGANDO FILAS BT TECNOLÓGICO ===');
  const allBt = await sql`
    SELECT id, uac_name, semester, component,
           contenidos_formativos, activities
    FROM programs_catalog
    WHERE subsystem = 'tecnologico'
  `;
  console.log(`Total UACs tecnologico: ${allBt.length}`);

  const problematicBt: any[] = [];
  for (const r of allBt) {
    const cf = typeof r.contenidos_formativos === 'string' ? JSON.parse(r.contenidos_formativos) : (r.contenidos_formativos || []);
    const acts = typeof r.activities === 'string' ? JSON.parse(r.activities) : (r.activities || []);
    
    let issue = '';
    if (!cf || cf.length === 0) issue += 'cf_empty; ';
    if (!acts || acts.length === 0) issue += 'acts_empty; ';
    
    // Check if any saberes inside cf is invalid or empty
    for (const c of cf) {
      if (!c.saberes) issue += 'saberes_null; ';
      else if (Array.isArray(c.saberes) && c.saberes.length === 0) issue += 'saberes_empty_array; ';
      else if (typeof c.saberes === 'object' && !c.saberes.saber && !c.saberes.conceptual) issue += 'saberes_empty_obj; ';
    }

    // Check if title has strange chars or unparsed
    if (r.uac_name.includes('') || r.uac_name.includes('?') || r.uac_name.includes('undefined')) {
      issue += 'uac_name_glitch; ';
    }

    if (issue) {
      problematicBt.push({ id: r.id, uac_name: r.uac_name.substring(0, 50), sem: r.semester, issue });
    }
  }

  console.log(`Filas BT con problemas detectados: ${problematicBt.length}`);
  if (problematicBt.length > 0) {
    console.table(problematicBt);
  }

  // 3. Revisar si hay otras tablas o filas con problemas
  const nonUtf8 = await sql`
    SELECT id, uac_name, subsystem, component
    FROM programs_catalog
    WHERE uac_name LIKE '%\uFFFD%' OR learning_outcome LIKE '%\uFFFD%'
  `;
  console.log(`\nFilas con caracteres corruptos (uFFFD) en todo el catálogo: ${nonUtf8.length}`);
}

inspect().catch(console.error);
