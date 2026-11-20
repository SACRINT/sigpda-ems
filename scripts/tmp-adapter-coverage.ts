import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDisciplinaryAdapter } from '../src/lib/prompts/disciplinary-adapters';

type Row = {
  uac_name?: string;
  component?: string;
  curriculum_name?: string;
  career_or_program_name?: string;
};

const rows = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts/data/curriculum_canonical_203.json'), 'utf8')
) as Row[];

const counts = new Map<string, number>();
const fallback: Array<{ uac: string; component: string; career: string }> = [];
const seen = new Set<string>();

for (const row of rows) {
  const uac = (row.uac_name || '').trim();
  if (!uac) continue;
  const key = `${uac}|${row.component || ''}|${row.curriculum_name || row.career_or_program_name || ''}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const a = getDisciplinaryAdapter(
    uac,
    row.component,
    row.curriculum_name || row.career_or_program_name
  );
  counts.set(a.id, (counts.get(a.id) || 0) + 1);
  if (a.id === 'indagacion_interdisciplinaria_general') {
    fallback.push({ uac, component: row.component || '', career: row.curriculum_name || row.career_or_program_name || '' });
  }
}

console.log(JSON.stringify({
  uniqueUacs: seen.size,
  counts: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])),
  fallbackCount: fallback.length,
  fallbackSamples: fallback.slice(0, 80),
}, null, 2));
