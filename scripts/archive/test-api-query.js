const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Test with no filters (equivalent to todos)
  const rows = await sql`
    SELECT id, uac_name, semester, component, subsystem, model_type, total_hours
    FROM programs_catalog
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;
  console.log('Query result count (all):', rows.length);

  // Group by semester
  const bySem = {};
  rows.forEach(r => {
    bySem[r.semester] = (bySem[r.semester] || 0) + 1;
  });
  console.log('By semester:', bySem);

  // Group by model_type
  const byModel = {};
  rows.forEach(r => {
    byModel[r.model_type || 'default'] = (byModel[r.model_type || 'default'] || 0) + 1;
  });
  console.log('By model_type:', byModel);
}

main().catch(console.error);
