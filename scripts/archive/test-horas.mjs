import { obtenerAsignaturasParaGrupoTecnologico, obtenerAsignaturasParaGrupo } from '../src/lib/escuela-grupos.ts';

console.log('--- TAREA 1: Bachillerato Tecnologico ---');
const sem1 = obtenerAsignaturasParaGrupoTecnologico(1, 'contabilidad');
const sem3 = obtenerAsignaturasParaGrupoTecnologico(3, 'contabilidad', 'nuevo');
const sem5 = obtenerAsignaturasParaGrupoTecnologico(5, 'contabilidad', 'nuevo', 'Derecho y Sociedad I');

const h1 = sem1.reduce((s, a) => s + a.horas, 0);
const h3 = sem3.reduce((s, a) => s + a.horas, 0);
const h5 = sem5.reduce((s, a) => s + a.horas, 0);

console.log('Sem 1:', h1, 'horas');
console.log('Sem 3:', h3, 'horas');
console.log('Sem 5:', h5, 'horas');

console.log('\n--- TAREA 2: BGE Regresion ---');
const bge3 = obtenerAsignaturasParaGrupo(3, 'Administracion');
const bge5 = obtenerAsignaturasParaGrupo(5, 'Administracion');

const hbge3 = bge3.reduce((s, a) => s + a.horas, 0);
const hbge5 = bge5.reduce((s, a) => s + a.horas, 0);

console.log('BGE Sem 3:', hbge3, 'horas');
console.log('BGE Sem 5:', hbge5, 'horas');
