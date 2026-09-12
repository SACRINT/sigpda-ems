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
  const plannings = await db`
    SELECT id, uac_name, semester, component, curriculum_name, content_json, extracted_data
    FROM plannings
    WHERE id = '6764fc5e-d1ce-4ff1-96fe-5d88885260ee'
  `;
  if (plannings.length === 0) {
    console.log('Not found');
    return;
  }
  const p = plannings[0];
  const c = p.content_json || p.extracted_data || {};
  console.log('UAC:', p.uac_name, 'Semester:', p.semester);
  console.log('Section IV Activities:');
  for (const [idx, act] of (c.sectionIV?.activities || []).entries()) {
    console.log(`Bloque ${idx + 1}: ${act.name} (${act.hours} hrs)`);
    console.log(` - Learning Outcome: ${act.learningOutcome}`);
    console.log(` - Methodology: ${act.methodology}`);
  }
  console.log('\nSection II:');
  console.log(JSON.stringify(c.sectionII, null, 2)?.slice(0, 1000));
}
main().catch(console.error);
