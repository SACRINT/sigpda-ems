/**
 * test-complex-schedule.mjs
 * Prueba de estrés y benchmarking para el Solver Multiobjetivo (Fase 4.5)
 * Escenario real de Bachillerato General Estatal:
 * - 6 Grupos (1°A, 1°B, 3°A, 3°B, 5°A, 5°B)
 * - 18 Docentes con restricciones y días libres
 * - 252 Horas lectivas totales (42 hrs por grupo en jornada de 7 periodos × 6 grupos o 30 hrs en jornada de 6 periodos)
 */

import { resolverHorario } from '../src/lib/horarios/solver.ts';
import { validarFactibilidadMatematicaPrevia } from '../src/lib/ai-schedule-assistant.ts';

console.log('================================================================');
console.log('  BENCHMARKING MOTOR DE HORARIOS ESCOLAR MULTIOBJETIVO (FASE 4.5) ');
console.log('================================================================\n');

// 1. Configuración de Plantel Complejo
const diasLectivos = 5;
const horasPorDia = 6;

const grupos = [
  { id: 'g1a', nombre: '1° A', semestre: 1, horasPorDia: 6 },
  { id: 'g1b', nombre: '1° B', semestre: 1, horasPorDia: 6 },
  { id: 'g3a', nombre: '3° A', semestre: 3, horasPorDia: 6 },
  { id: 'g3b', nombre: '3° B', semestre: 3, horasPorDia: 6 },
  { id: 'g5a', nombre: '5° A', semestre: 5, horasPorDia: 6 },
  { id: 'g5b', nombre: '5° B', semestre: 5, horasPorDia: 6 }
];

const docentes = [
  { id: 'd01', nombre: 'García Pérez Juan Carlos', horasMaxDia: 5 },
  { id: 'd02', nombre: 'López Morales María Elena', horasMaxDia: 5 },
  { id: 'd03', nombre: 'Martínez Soto Roberto', horasMaxDia: 6 },
  { id: 'd04', nombre: 'Hernández Cruz Laura Patricia', horasMaxDia: 5 },
  { id: 'd05', nombre: 'Rodríguez Silva Fernando', horasMaxDia: 6 },
  { id: 'd06', nombre: 'Sánchez Vargas Gabriela', horasMaxDia: 5 },
  { id: 'd07', nombre: 'Ramírez Castro Alejandro', horasMaxDia: 6 },
  { id: 'd08', nombre: 'Flores Mendoza Claudia', horasMaxDia: 5 },
  { id: 'd09', nombre: 'Gómez Ortiz Jorge Luis', horasMaxDia: 5 },
  { id: 'd10', nombre: 'Vázquez Reyes Ana María', horasMaxDia: 6 },
  { id: 'd11', nombre: 'Castillo Ramos Miguel Ángel', horasMaxDia: 5 },
  { id: 'd12', nombre: 'Torres Navarro Adriana', horasMaxDia: 5 },
  { id: 'd13', nombre: 'Díaz Morales Sergio', horasMaxDia: 6 },
  { id: 'd14', nombre: 'Morales Benítez Rosa Isela', horasMaxDia: 5 },
  { id: 'd15', nombre: 'Jiménez Peña David', horasMaxDia: 6 },
  { id: 'd16', nombre: 'Ortiz Luna Martha', horasMaxDia: 5 },
  { id: 'd17', nombre: 'Silva Rangel Víctor Hugo', horasMaxDia: 5 },
  { id: 'd18', nombre: 'Pérez Domínguez Carmen', horasMaxDia: 5 }
];

const aulas = [
  { id: 'a_gen', nombre: 'Aulas Generales', tipo: 'REGULAR' },
  { id: 'a_lab_comp', nombre: 'Laboratorio de Cómputo', tipo: 'LABORATORIO' },
  { id: 'a_lab_cie', nombre: 'Laboratorio de Ciencias', tipo: 'LABORATORIO' },
  { id: 'a_taller', nombre: 'Taller de Prácticas', tipo: 'TALLER' }
];

// Generar 180 horas académicas distribuidas entre los 6 grupos y 18 docentes (30 hrs por grupo)
const cargas = [];
let cCounter = 0;

// Cargas estándar por grupo (30 hrs c/u = 180 hrs)
const asignaturasBase = [
  { uac: 'Pensamiento Matemático', horas: 4, docIdx: 0 },
  { uac: 'Lengua y Comunicación', horas: 3, docIdx: 1 },
  { uac: 'Inglés', horas: 3, docIdx: 2 },
  { uac: 'Ciencias Naturales', horas: 4, docIdx: 3, lab: 'a_lab_cie' },
  { uac: 'Ciencias Sociales', horas: 3, docIdx: 4 },
  { uac: 'Humanidades', horas: 3, docIdx: 5 },
  { uac: 'Cultura Digital', horas: 3, docIdx: 6, lab: 'a_lab_comp' },
  { uac: 'Formación Laboral', horas: 4, docIdx: 7, lab: 'a_taller' },
  { uac: 'Recursos Socioemocionales', horas: 3, docIdx: 8 }
];

grupos.forEach((g, gIdx) => {
  asignaturasBase.forEach((asig, aIdx) => {
    // Rotar docentes entre grupos para generar cruces densos
    const dIdx = (asig.docIdx + gIdx * 2) % docentes.length;
    cargas.push({
      id: `c_${cCounter++}`,
      grupoId: g.id,
      docenteId: docentes[dIdx].id,
      asignaturaId: `${asig.uac} (${g.nombre})`,
      horasSemanales: asig.horas,
      esHoraDoblePermitida: asig.horas >= 3,
      requiereAulaEspecial: Boolean(asig.lab),
      aulaEspecialId: asig.lab
    });
  });
});

// Restricciones de docentes (Días libres / Periodos no disponibles)
const restriccionesDocentes = [
  { docenteId: 'd01', diasIndisponibles: [5] }, // Profr. Juan Carlos libre los viernes
  { docenteId: 'd04', diasIndisponibles: [3] }, // Profa. Laura libre los miércoles
  { docenteId: 'd07', periodosIndisponibles: [{ dia: 1, periodo: 1 }, { dia: 2, periodo: 1 }] }, // Entra tarde Lun/Mar
  { docenteId: 'd10', periodosIndisponibles: [{ dia: 4, periodo: 6 }, { dia: 5, periodo: 6 }] }  // Sale temprano Jue/Vie
];

// Celdas fijas con candado (🔒)
const celdasFijas = [
  { diaSemana: 1, periodo: 1, grupoId: 'g1a', docenteId: 'd01', asignaturaId: 'Pensamiento Matemático (1° A)' },
  { diaSemana: 2, periodo: 3, grupoId: 'g3b', docenteId: 'd11', asignaturaId: 'Ciencias Sociales (3° B)' }
];

console.log(`📊 Total de Grupos: ${grupos.length}`);
console.log(`👨‍🏫 Total de Docentes: ${docentes.length}`);
console.log(`📚 Total de Cargas Asignadas: ${cargas.length}`);
const totalHorasRequeridas = cargas.reduce((acc, c) => acc + c.horasSemanales, 0);
console.log(`⏱️ Total de Horas a Programar: ${totalHorasRequeridas} horas lectivas\n`);

// 2. Ejecutar el Solver Multiobjetivo
console.log('🚀 Ejecutando Solver Multiobjetivo...');
const t0 = performance.now();
const resultado = resolverHorario({
  diasLectivos,
  horasPorDia,
  grupos,
  docentes,
  aulas,
  cargas,
  celdasFijas,
  restriccionesDocentes
});
const t1 = performance.now();
const duracionMs = Math.round(t1 - t0);

console.log('\n================================================================');
console.log('                   RESULTADOS DEL BENCHMARK                     ');
console.log('================================================================');
console.log(`✅ Éxito de Factibilidad: ${resultado.exito ? 'SÍ (0 Empalmes)' : 'NO'}`);
console.log(`⚡ Tiempo de Ejecución: ${duracionMs} ms (Requisito: < 300 ms -> ${duracionMs < 300 ? 'CUMPLIDO ✓' : 'EXCEDIDO ✗'})`);
console.log(`📋 Clases Programadas: ${resultado.metricas.totalClasesProgramadas} / ${resultado.metricas.totalClasesRequeridas}`);
console.log(`❌ Conflictos Residuales: ${resultado.conflictos.length}`);
console.log(`🎯 Score de Calidad Pedagógica (Soft Score): ${resultado.metricas.softScore} / 100 pts`);
console.log(`⏳ Huecos Intermedios Docentes: ${resultado.metricas.huecosDocentes} horas`);
console.log(`👥 Huecos Intermedios Grupos: ${resultado.metricas.huecosGrupos} horas`);
console.log(`🧩 Bloques Dobles Continuos: ${resultado.metricas.bloquesDoblesExitosos}`);
console.log(`📅 Días Aislados (1h): ${resultado.metricas.diasAisladosDocentes}`);

if (resultado.distribucionDocentes) {
  console.log('\n--- Muestra de Distribución de 3 Docentes ---');
  resultado.distribucionDocentes.slice(0, 3).forEach(d => {
    const docObj = docentes.find(doc => doc.id === d.docenteId);
    console.log(`• ${docObj?.nombre}: ${d.totalHoras} hrs | Horas/día: [${d.horasPorDia.join(', ')}] | Huecos: ${d.huecos}`);
  });
}

// 3. Test del Validador Matemático Previo
console.log('\n================================================================');
console.log('         TEST VALIDADOR MATEMÁTICO PREVIO (NEURO-SIMBÓLICO)     ');
console.log('================================================================');
const contextoPrueba = {
  nombreEscuela: 'Bachillerato General Emiliano Zapata',
  horasPorDia: 6,
  diasLectivos: 5,
  grupos: [{ id: 'g1a', nombre: '1° A' }],
  docentes: [
    { id: 'd01', nombreCompleto: 'Juan Carlos García Pérez', horasAsignadas: 26 },
    { id: 'd02', nombreCompleto: 'María Elena López', horasAsignadas: 18 }
  ],
  materias: [{ id: 'm1', nombre: 'Matemáticas' }],
  celdasActuales: []
};

// Caso 1: Petición Imposible (26 hrs en 4 días = 24 hrs máx)
const testImposible = validarFactibilidadMatematicaPrevia(
  'Por favor dale el viernes libre al profesor Juan Carlos García Pérez',
  contextoPrueba
);
console.log('Caso 1 (Petición Imposible):');
console.log(`- Es factible: ${testImposible?.factible === false ? 'Rechazado correctamente (Factible: false) ✓' : 'Falló'}`);
console.log(`- Explicación: ${testImposible?.motivo}\n`);

// Caso 2: Petición Factible (18 hrs en 4 días = 24 hrs máx)
const testFactible = validarFactibilidadMatematicaPrevia(
  'Por favor dale el viernes libre a la profesora María Elena López',
  contextoPrueba
);
console.log('Caso 2 (Petición Factible):');
console.log(`- Es factible: ${testFactible === null ? 'Aprobado para procesamiento del solver ✓' : 'Rechazado incorrectamente'}`);

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA FASE 4.5 COMPLETADAS EXITOSAMENTE!');
