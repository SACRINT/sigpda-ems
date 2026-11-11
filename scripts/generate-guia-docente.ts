import fs from 'node:fs';
import path from 'node:path';
import { INSTALACIONES_RESIDENCIALES_TRAJECTORY } from '../src/lib/curriculum/trajectories/instalaciones-residenciales';
import { buildTeacherGuideMarkdown } from '../src/lib/curriculum/teacher-guide';

const root = process.cwd();
const outputPath = path.join(
  root,
  'docs',
  'GUIA_DIDACTICA_DOCENTE_INSTALACIONES_RESIDENCIALES_2024.md'
);

const markdown = buildTeacherGuideMarkdown(INSTALACIONES_RESIDENCIALES_TRAJECTORY);
fs.writeFileSync(outputPath, markdown, 'utf8');

const activityCount = INSTALACIONES_RESIDENCIALES_TRAJECTORY.nodes.reduce(
  (total, node) => total + node.keyActivities.length,
  0
);

console.log(`Guía generada: ${outputPath}`);
console.log(
  `UAC: ${INSTALACIONES_RESIDENCIALES_TRAJECTORY.totalUacs} · Actividades: ${activityCount} · Horas: ${INSTALACIONES_RESIDENCIALES_TRAJECTORY.totalHours}`
);
