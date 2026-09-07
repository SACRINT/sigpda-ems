import { CARRERAS_TECNOLOGICAS } from '../src/lib/carreras-tecnologicas.ts';

console.log('Total Carreras Tecnologicas:', CARRERAS_TECNOLOGICAS.length);
let totalSubmodulos = 0;

for (const c of CARRERAS_TECNOLOGICAS) {
  console.log(`\nCarrera: ${c.nombre} (${c.tipoPrograma}) - Acuerdo: ${c.acuerdo}`);
  for (const m of c.modulos) {
    console.log(`  Semestre ${m.semestre} (${m.nombre}):`);
    for (const s of m.submodulos) {
      console.log(`    - ${s.nombre} (${s.horasSemanales} hrs/sem = ${s.horasSemanales * 18} hrs)`);
      totalSubmodulos++;
    }
  }
}

console.log(`\nTotal submodulos to insert: ${totalSubmodulos}`);
