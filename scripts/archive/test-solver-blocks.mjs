import { resolverHorario } from '../src/lib/horarios/solver.ts';

const diasLectivos = 5;
const horasPorDia = 6;

const grupos = [
  { id: 'g1a', nombre: '1° A', semestre: 1, horasPorDia: 6 },
  { id: 'g1b', nombre: '1° B', semestre: 1, horasPorDia: 6 }
];

const docentes = [
  { id: 'd01', nombre: 'Docente 1', horasMaxDia: 6 },
  { id: 'd02', nombre: 'Docente 2', horasMaxDia: 6 },
  { id: 'd03', nombre: 'Docente 3', horasMaxDia: 6 },
  { id: 'd04', nombre: 'Docente 4', horasMaxDia: 6 }
];

const cargas = [
  { id: 'c1', grupoId: 'g1a', docenteId: 'd01', asignaturaId: 'Matemáticas', horasSemanales: 5 },
  { id: 'c2', grupoId: 'g1a', docenteId: 'd02', asignaturaId: 'Español', horasSemanales: 5 },
  { id: 'c3', grupoId: 'g1a', docenteId: 'd03', asignaturaId: 'Historia', horasSemanales: 4 },
  { id: 'c4', grupoId: 'g1a', docenteId: 'd04', asignaturaId: 'Módulo Taller', horasSemanales: 6 },

  { id: 'c5', grupoId: 'g1b', docenteId: 'd01', asignaturaId: 'Matemáticas B', horasSemanales: 5 },
  { id: 'c6', grupoId: 'g1b', docenteId: 'd02', asignaturaId: 'Español B', horasSemanales: 5 },
  { id: 'c7', grupoId: 'g1b', docenteId: 'd03', asignaturaId: 'Historia B', horasSemanales: 4 },
  { id: 'c8', grupoId: 'g1b', docenteId: 'd04', asignaturaId: 'Módulo Taller B', horasSemanales: 6 }
];

// Celdas con candado (fijas)
const celdasFijas = [
  { diaSemana: 1, periodo: 1, grupoId: 'g1a', docenteId: 'd01', asignaturaId: 'Matemáticas' },
  { diaSemana: 2, periodo: 2, grupoId: 'g1b', docenteId: 'd02', asignaturaId: 'Español B' }
];

// Bloqueos fijados por el usuario:
// 1. d01 tiene Viernes (Día 5) completamente bloqueado
// 2. g1a tiene Día 2 Periodo 1 bloqueado
// 3. g1b tiene Día 4 Periodo 5 y 6 bloqueados
const slotsLibresBloqueados = [
  '5_1_d01', '5_2_d01', '5_3_d01', '5_4_d01', '5_5_d01', '5_6_d01',
  '2_1_g1a',
  '4_5_g1b', '4_6_g1b'
];

// Restricciones formales de docente: d02 libre Miércoles (Día 3)
const restriccionesDocentes = [
  { docenteId: 'd02', diasIndisponibles: [3] }
];

const res = resolverHorario({
  diasLectivos,
  horasPorDia,
  grupos,
  docentes,
  aulas: [],
  cargas,
  celdasFijas,
  slotsLibresBloqueados,
  restriccionesDocentes
});

console.log('--- TEST DE INVARIANTES Y BLOQUEOS ---');
console.log('Éxito Solver:', res.exito);
console.log('Total clases requeridas:', 40);
console.log('Total clases programadas:', res.celdas.length);

let violaciones = 0;

// Test 1: d01 en viernes (debe ser 0)
const d01Viernes = res.celdas.filter(c => c.docenteId === 'd01' && c.diaSemana === 5);
console.log('1. d01 en viernes (debe ser 0):', d01Viernes.length);
if (d01Viernes.length > 0) {
  console.error('   FALLO: d01 tiene clases en viernes bloqueado:', d01Viernes);
  violaciones++;
}

// Test 2: d02 en miércoles (debe ser 0)
const d02Miercoles = res.celdas.filter(c => c.docenteId === 'd02' && c.diaSemana === 3);
console.log('2. d02 en miércoles (debe ser 0):', d02Miercoles.length);
if (d02Miercoles.length > 0) {
  console.error('   FALLO: d02 tiene clases en miércoles bloqueado:', d02Miercoles);
  violaciones++;
}

// Test 3: g1a en día 2 periodo 1 (debe ser 0)
const g1aD2P1 = res.celdas.filter(c => c.grupoId === 'g1a' && c.diaSemana === 2 && c.periodo === 1);
console.log('3. g1a en día 2 periodo 1 (debe ser 0):', g1aD2P1.length);
if (g1aD2P1.length > 0) {
  console.error('   FALLO: g1a tiene clase en slot bloqueado 2_1:', g1aD2P1);
  violaciones++;
}

// Test 4: g1b en día 4 periodo 5 y 6 (debe ser 0)
const g1bD4Bloq = res.celdas.filter(c => c.grupoId === 'g1b' && c.diaSemana === 4 && (c.periodo === 5 || c.periodo === 6));
console.log('4. g1b en día 4 periodos 5 y 6 (debe ser 0):', g1bD4Bloq.length);
if (g1bD4Bloq.length > 0) {
  console.error('   FALLO: g1b tiene clase en slots bloqueados:', g1bD4Bloq);
  violaciones++;
}

// Test 5: Celdas fijas deben permanecer intactas
const fija1 = res.celdas.find(c => c.diaSemana === 1 && c.periodo === 1 && c.grupoId === 'g1a' && c.asignaturaId === 'Matemáticas');
const fija2 = res.celdas.find(c => c.diaSemana === 2 && c.periodo === 2 && c.grupoId === 'g1b' && c.asignaturaId === 'Español B');
console.log('5. Celdas fijas preservadas:', Boolean(fija1 && fija1.esBloqueado && fija2 && fija2.esBloqueado));
if (!fija1 || !fija2) {
  console.error('   FALLO: Celdas fijas fueron movidas o eliminadas');
  violaciones++;
}

// Test 6: Jamás 3 horas de la misma materia el mismo día
let triples = 0;
for (const g of grupos) {
  for (let d = 1; d <= diasLectivos; d++) {
    const celdasDia = res.celdas.filter(c => c.grupoId === g.id && c.diaSemana === d);
    const counts = {};
    for (const c of celdasDia) {
      counts[c.asignaturaId] = (counts[c.asignaturaId] || 0) + 1;
      if (counts[c.asignaturaId] > 2) {
        triples++;
        console.error(`   FALLO: ${g.nombre} tiene ${counts[c.asignaturaId]} horas de ${c.asignaturaId} en día ${d}`);
      }
    }
  }
}
console.log('6. Materias con 3 o más horas el mismo día (debe ser 0):', triples);
if (triples > 0) violaciones++;

// Test 7: Módulos con 2 horas juntas
let dualesModulo = 0;
for (const g of grupos) {
  for (let d = 1; d <= diasLectivos; d++) {
    const celdasDia = res.celdas.filter(c => c.grupoId === g.id && c.diaSemana === d);
    const modCeldas = celdasDia.filter(c => c.asignaturaId.startsWith('Módulo'));
    if (modCeldas.length === 2) {
      const p = modCeldas.map(c => c.periodo).sort((a,b) => a-b);
      if (p[1] === p[0] + 1) dualesModulo++;
    }
  }
}
console.log('7. Bloques duales continuos para módulos:', dualesModulo);

console.log('\n==========================================');
if (violaciones === 0) {
  console.log('✅ TODAS LAS PRUEBAS PASARON CON ÉXITO (0 VIOLACIONES)');
} else {
  console.error(`❌ HUBO ${violaciones} VIOLACIONES EN LAS PRUEBAS`);
  process.exit(1);
}
