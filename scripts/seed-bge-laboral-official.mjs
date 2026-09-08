import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const envContent = readFileSync(join(__dir, '../.env.local'), 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) throw new Error('DATABASE_URL not found');
const sql = neon(match[1]);

const catalogPath = join(__dir, 'bge-laboral-official-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));

console.log('='.repeat(60));
console.log('PILAR 2 v2: SEED BGE ACTIVIDADES CLAVE (match by uac_name)');
console.log('='.repeat(60));

// Get ALL BGE laboral rows
const allRows = await sql`
  SELECT id, curriculum_name, semester, uac_name, activities
  FROM programs_catalog
  WHERE component = 'laboral'
  AND curriculum_name IN (
    'Administración','Agricultura Sostenible de Traspatio','Área de la Salud',
    'Comunicación Gráfica','Contabilidad','Domótica','Instalaciones Residenciales',
    'Mecánica Dental','Preparación de Alimentos Artesanales','Procesos Culinarios y Repostería',
    'Redes y Mantenimiento','Servicios Ecosistémicos','Sistemas Eléctricos',
    'Tecnología Informática','Turismo'
  )
  ORDER BY curriculum_name, semester, uac_name
`;

console.log(`\nFound ${allRows.length} BGE laboral rows in DB`);

// Helper: normalize for matching
function normalize(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Build index: curriculum -> semester -> [rows sorted by semester then uac_name]
const dbIndex = {};
for (const row of allRows) {
  const key = normalize(row.curriculum_name);
  if (!dbIndex[key]) dbIndex[key] = {};
  if (!dbIndex[key][row.semester]) dbIndex[key][row.semester] = [];
  dbIndex[key][row.semester].push(row);
}

// Strategy: For each catalog entry, find the DB row by matching uac_name to learning_outcome
// The PDF's learning_outcome starts with the UAC name (e.g. "Interpreta croquis de diferentes instalaciones...")
// The DB uac_name IS that UAC name directly

let updated = 0;
let notFound = [];
let errors = 0;

for (const [currName, uacs] of Object.entries(catalog)) {
  const normCurr = normalize(currName);
  const dbRows = dbIndex[normCurr];
  
  if (!dbRows) {
    console.log(`  [MISSING CURRICULUM] ${currName}`);
    notFound.push(currName);
    continue;
  }

  for (const uac of uacs) {
    if (!uac.semester || !uac.uac_num) continue;
    
    const semRows = dbRows[uac.semester] || [];
    
    if (semRows.length === 0) {
      console.log(`  [MISSING SEM] ${currName} sem=${uac.semester}`);
      notFound.push(`${currName} sem=${uac.semester}`);
      continue;
    }

    // Match strategy: learning_outcome contains the uac_name
    // The learning_outcome from PDF starts with the full UAC name
    // The uac_num (1 or 2) tells us which of the 2 rows in a semester this is
    // Rows are sorted by uac_name alphabetically in DB - but better to use uac_num as index
    // UAC 1 = first UAC in that semester (lower sort order), UAC 2 = second

    let targetRow = null;

    // Try to match by learning_outcome containing the UAC name
    if (uac.learning_outcome && uac.learning_outcome.length > 10) {
      // Extract first sentence of learning_outcome as the UAC name
      const firstSentence = uac.learning_outcome.split('.')[0].trim();
      const normOutcome = normalize(firstSentence);
      
      for (const row of semRows) {
        const normUacName = normalize(row.uac_name);
        if (normOutcome.includes(normUacName) || normUacName.includes(normOutcome)) {
          targetRow = row;
          break;
        }
      }
    }

    // Fallback: use uac_num as index into sorted semester rows
    if (!targetRow) {
      if (semRows.length >= uac.uac_num) {
        // Sort by uac_name to get consistent ordering
        const sorted = [...semRows].sort((a, b) => a.uac_name.localeCompare(b.uac_name));
        targetRow = sorted[uac.uac_num - 1];
      }
    }

    if (!targetRow) {
      console.log(`  [NOT FOUND] ${currName} sem=${uac.semester} UAC${uac.uac_num}`);
      notFound.push(`${currName} sem=${uac.semester} UAC${uac.uac_num}`);
      continue;
    }

    // Update the row
    const activitiesJson = JSON.stringify(uac.activities.map(a => ({
      order: a.order,
      name: a.name,
      hours: a.hours
    })));

    try {
      const newOutcome = uac.learning_outcome || '';
      await sql`
        UPDATE programs_catalog
        SET 
          activities = ${activitiesJson}::jsonb,
          learning_outcome = CASE WHEN ${newOutcome} = '' THEN learning_outcome ELSE ${newOutcome} END
        WHERE id = ${targetRow.id}
      `;
      updated++;
      console.log(`  [OK] ${currName} Sem${uac.semester} UAC${uac.uac_num} -> "${targetRow.uac_name.substring(0, 45)}..."`);
    } catch (err) {
      errors++;
      console.error(`  [ERROR] ${currName} sem=${uac.semester} UAC${uac.uac_num}: ${err.message}`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log(`RESULT: ${updated} rows updated | ${errors} errors | ${notFound.length} not found`);

// Post-audit
const after = await sql`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN activities::text ILIKE '%Diagn%stico t%cnico%' THEN 1 ELSE 0 END) as boilerplate1,
    SUM(CASE WHEN activities::text ILIKE '%fundamentaci%n%' THEN 1 ELSE 0 END) as boilerplate2
  FROM programs_catalog
  WHERE component = 'laboral'
  AND curriculum_name IN (
    'Administración','Agricultura Sostenible de Traspatio','Área de la Salud',
    'Comunicación Gráfica','Contabilidad','Domótica','Instalaciones Residenciales',
    'Mecánica Dental','Preparación de Alimentos Artesanales','Procesos Culinarios y Repostería',
    'Redes y Mantenimiento','Servicios Ecosistémicos','Sistemas Eléctricos',
    'Tecnología Informática','Turismo'
  )
`;

console.log(`\nAUDIT AFTER:`);
console.log(`  Total BGE laboral rows: ${after[0].total}`);
console.log(`  Boilerplate 'Diagnostico tecnico': ${after[0].boilerplate1}`);
console.log(`  Boilerplate 'fundamentacion': ${after[0].boilerplate2}`);

if (parseInt(after[0].boilerplate1) === 0 && parseInt(after[0].boilerplate2) === 0) {
  console.log('\n[SUCCESS] DB fully updated with official activities. 0 boilerplate rows.');
} else {
  console.log('\n[WARNING] Boilerplate rows remain!');
}

if (notFound.length > 0) {
  console.log('\nNot matched:');
  notFound.forEach(s => console.log(`  - ${s}`));
}
