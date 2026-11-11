/**
 * validate-instalaciones-trajectory.ts — Valida la malla DAG de Instalaciones
 * Residenciales (BGE 2024) contra el programa oficial.
 *
 * Uso: npx tsx scripts/validate-instalaciones-trajectory.ts
 */

import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '../src/lib/curriculum/trajectories/instalaciones-residenciales';
import { validateCurriculumTrajectory } from '../src/lib/curriculum/trajectory-validator';

const trajectory = INSTALACIONES_RESIDENCIALES_TRAJECTORY;
const report = validateCurriculumTrajectory(trajectory);

console.log(`\n=== ${trajectory.name} — ${trajectory.generation} ===`);
console.log(`Fuente: ${trajectory.sourceDocument} (${trajectory.sourcePages})`);
console.log(`UAC: ${report.stats.nodes} | Actividades clave: ${report.stats.activities} | Horas: ${report.stats.totalHours}`);
console.log(`Semestres: ${report.stats.semesters.join(', ')} | Hitos del proyecto: ${report.stats.projectMilestones}\n`);

for (const node of trajectory.nodes) {
  const prerequisites = node.prerequisites.length > 0 ? node.prerequisites.join(', ') : '—';
  console.log(
    `${node.semester}° UAC ${node.order} [${node.id}] ${node.uacName} (${node.totalHours} h)`
  );
  console.log(`   Prerrequisitos: ${prerequisites}`);
  console.log(`   Hito: ${node.projectMilestone}`);
  for (const activity of node.keyActivities) {
    console.log(`   · ${activity.id} (${activity.hours} h): ${activity.name}`);
  }
}

console.log(`\nProyecto: ${trajectory.project.name}`);
console.log(`Producto final: ${trajectory.project.finalProduct}`);
for (const milestone of trajectory.project.milestones) {
  console.log(`   ${milestone.semester}°: ${milestone.title} → ${milestone.linkedUacs.join(', ')}`);
}

if (report.errors.length > 0) {
  console.error(`\n✗ ${report.errors.length} error(es):`);
  for (const error of report.errors) {
    console.error(`  - [${error.code}] ${error.message}${error.nodeId ? ` (${error.nodeId})` : ''}`);
  }
}
if (report.warnings.length > 0) {
  console.warn(`\n⚠ ${report.warnings.length} advertencia(s):`);
  for (const warning of report.warnings) {
    console.warn(`  - [${warning.code}] ${warning.message}${warning.nodeId ? ` (${warning.nodeId})` : ''}`);
  }
}

if (!report.ok) {
  process.exit(1);
}
console.log('\n✓ Trayectoria válida: DAG sin ciclos, horas y cobertura completas.');
