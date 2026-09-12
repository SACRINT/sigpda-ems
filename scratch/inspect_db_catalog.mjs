import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_Tec5LgY7KIfC@ep-divine-grass-atatmg66-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

async function inspect() {
  const total = await sql`SELECT COUNT(*)::int as count FROM programs_catalog`;
  console.log('TOTAL ROWS IN programs_catalog:', total[0].count);

  const duplicates = await sql`
    SELECT uac_name, semester, component, COUNT(*)::int as cnt
    FROM programs_catalog
    GROUP BY uac_name, semester, component
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `;
  console.log('\nDUPLICATE GROUPS:', duplicates.length);
  duplicates.slice(0, 15).forEach(d => {
    console.log(`  "${d.uac_name}" (Sem ${d.semester}, Comp: ${d.component}) -> ${d.cnt} copias`);
  });

  const components = await sql`
    SELECT component, COUNT(*)::int as cnt
    FROM programs_catalog
    GROUP BY component
    ORDER BY cnt DESC
  `;
  console.log('\nBY COMPONENT:');
  components.forEach(c => console.log(`  ${c.component}: ${c.cnt}`));

  const semesters = await sql`
    SELECT semester, COUNT(*)::int as cnt
    FROM programs_catalog
    GROUP BY semester
    ORDER BY semester
  `;
  console.log('\nBY SEMESTER:');
  semesters.forEach(s => console.log(`  Semestre ${s.semester}: ${s.cnt}`));

  // Check how many have synthetic placeholders like 'Desarrollo y análisis conceptual de' or 'Actividad Clave 1: Diagnóstico técnico, fundamentación'
  const mocks = await sql`
    SELECT COUNT(*)::int as cnt
    FROM programs_catalog
    WHERE contenidos_formativos::text ILIKE '%Desarrollo y análisis conceptual%'
       OR contenidos_formativos::text ILIKE '%Fundamentos técnicos y marco conceptual de%'
       OR learning_outcome ILIKE '%Aplica el pensamiento geométrico y trigonométrico%'
  `;
  console.log('\nROWS WITH KNOWN MOCK / SYNTHETIC PLACEHOLDERS:', mocks[0].cnt);
}

inspect().catch(console.error);
