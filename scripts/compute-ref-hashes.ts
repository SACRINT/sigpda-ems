import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const refDir = path.resolve('../documentos_referencia');

function getHash(relPath: string) {
  const full = path.join(refDir, relPath);
  if (!fs.existsSync(full)) return 'NOT_FOUND: ' + full;
  const buf = fs.readFileSync(full);
  return createHash('sha256').update(buf).digest('hex');
}

console.log('Calculating reference hashes:');
const files = [
  '[01]Planeaciones-Secuencias-Plan_de_Clase/04 ANEXO 12 CC 1-4.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/ANEXO 12 CC 5-6.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/Curso Autogestivo-Guía Temática para la Planeación Didáctica ciclo escolar 2026-2027.docx',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/2025_1_BN_MODELO EDUCATIVO 2025 MCCMS.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2023 - 2026/Curriculum Laboral BGE 2024/Redes_y_Mantenimiento_2024.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2023 - 2026/Curriculum Laboral BGE 2024/Instalaciones_Residenciales_2024.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_PENSAMIENTO MATEMATICO_BN.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_LENGUA Y COMUNICACION_BN.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_MCC_CIENCIAS NATURALES_BN.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_CIENCIAS SOCIALES_BN.pdf',
  '[01]Planeaciones-Secuencias-Plan_de_Clase/[02] Programas_de_Estudio BG/Programas de Estudio para la Generación 2025 - 2028/Currículum Fundamental/2025_ MCC_MCC_INGLES_BN.pdf'
];

for (const f of files) {
  console.log(`${f} | ${getHash(f)}`);
}
