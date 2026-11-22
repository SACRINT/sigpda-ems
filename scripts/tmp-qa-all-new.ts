import fs from 'node:fs';
import path from 'node:path';
import { runMaterialsQa } from './qa-sacrint-materials';

const BASE =
  'C:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/documentos_referencia/[01]Planeaciones-Secuencias-Plan_de_Clase/Libros Planeaciones 2026';
const OUT = path.join(process.env.TEMP || 'C:/Users/samue/AppData/Local/Temp', 'opencode', 'qa-all-new.json');

async function main() {
  const dirs = fs
    .readdirSync(BASE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.endsWith('_PDF'))
    .map((d) => d.name)
    .sort();
  const all: unknown[] = [];
  for (const dir of dirs) {
    const full = path.join(BASE, dir);
    const summary = await runMaterialsQa(full, { strict: true });
    all.push(summary);
    const pptx = summary.pptx[0];
    console.log(
      `### ${dir} | passed=${summary.passed} | failures=${summary.failures.length} | 08slides=${pptx?.slideCount ?? '?'} | 08 words 1/2=${pptx?.wordStats.slide12Avg ?? '?'} >200=${(pptx?.wordStats.slide12Over200 ?? 0) + (pptx?.wordStats.slide22Over200 ?? 0)}`
    );
    for (const failure of summary.failures) console.log('  FAIL ' + failure);
    for (const warning of summary.warnings) console.log('  WARN ' + warning);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2), 'utf8');
  console.log(`\nJSON: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
