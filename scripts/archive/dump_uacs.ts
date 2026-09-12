import { sql } from './src/lib/db';
import * as fs from 'fs';

async function main() {
  try {
    const uacs = await sql()`SELECT * FROM uacs ORDER BY semester ASC, component ASC, name ASC`;
    console.log(`Encontradas ${uacs.length} UACs.`);
    fs.writeFileSync('all_uacs_db.json', JSON.stringify(uacs, null, 2));
    console.log('Guardado en all_uacs_db.json');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
