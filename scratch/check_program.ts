import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { sql } from '../src/lib/db';

async function main() {
  const db = sql();
  const progs = await db`
    SELECT id, uac_name, semester, component, subsystem, model_type, total_hours, activities, contenidos_formativos
    FROM programs_catalog
    WHERE uac_name ILIKE '%Pensamiento Matemático III%'
  `;
  console.log('Programs found in programs_catalog:', progs.length);
  for (const p of progs) {
    console.log('----------------------------------------------------');
    console.log('ID:', p.id, '| UAC:', p.uac_name, '| Subsystem:', p.subsystem, '| Sem:', p.semester, '| Hours:', p.total_hours);
    console.log('Activities count:', (p.activities as any[])?.length);
    for (const a of (p.activities as any[] || [])) {
      console.log(` - Order ${a.order || a.num}: ${a.name || a.proposito} (${a.hours || '?'} hrs)`);
    }
    console.log('Contenidos Formativos count:', (p.contenidos_formativos as any[])?.length);
    for (const cf of (p.contenidos_formativos as any[] || [])) {
      console.log(` - CF Order ${cf.order}: ${cf.proposito?.slice(0, 70)}...`);
      console.log(`   Contenidos: ${(cf.contenidos || []).slice(0, 5).join(', ')}...`);
    }
  }
}
main().catch(console.error);
