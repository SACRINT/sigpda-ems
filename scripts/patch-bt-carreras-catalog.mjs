import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const canonical = JSON.parse(readFileSync(path.join(__dirname, 'data', 'bt_canonical_25.json'), 'utf-8'));
const targetFile = path.join(rootDir, 'src', 'lib', 'bt-carreras-catalog.ts');
const originalContent = readFileSync(targetFile, 'utf-8');

// Extraer cabecera hasta "export const CARRERAS_TECNICAS_BT: BTCarrera[] = ["
const startMarker = 'export const CARRERAS_TECNICAS_BT: BTCarrera[] = [';
const endMarker = '\n];\n\n// ── Métodos Helper';

const startIdx = originalContent.indexOf(startMarker);
const endIdx = originalContent.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('No se encontraron los marcadores en bt-carreras-catalog.ts');
  process.exit(1);
}

let header = originalContent.substring(0, startIdx);
const footer = originalContent.substring(endIdx);

// Asegurar que las interfaces incluyan los campos opcionales auténticos
if (!header.includes('export interface BTActividadClave')) {
  header = header.replace(
    'export interface BTSubmodulo {',
`export interface BTActividadClave {
  order: number;
  name: string;
  hours: number;
  saberes?: string[];
}

export interface BTSubmodulo {
  uac_name?: string;
  actividades?: BTActividadClave[];`
  );

  header = header.replace(
    'export interface BTModulo {',
`export interface BTModulo {
  resultadoAprendizaje?: string;`
  );
}

const jsonStr = originalContent.substring(startIdx + startMarker.length - 1, endIdx + 2);
const allCareers = JSON.parse(jsonStr);

console.log(`Carreras originales: ${allCareers.length}`);

// Conservar las 41 carreras anteriores intactas
const manualMap = {
  'diseno_grafico': 'diseno-grafic-digital',
  'salud_integral': 'salud-integral-y-estilos-de-vida-saludables',
  'soporte_ti': 'soporte-y-gestion-de-tecnologias-de-la-informacion'
};

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

const updatedCareers = allCareers.map(existingCareer => {
  if (existingCareer.tipoPrograma !== 'nuevo') {
    return existingCareer;
  }

  // Buscar coincidencia en canonical 25
  const normExisting = normalize(existingCareer.nombre);
  const canon = canonical.find(c =>
    (manualMap[c.id] && existingCareer.id === manualMap[c.id]) ||
    normalize(c.name) === normExisting ||
    c.id === existingCareer.id ||
    normalize(c.id) === normalize(existingCareer.id)
  );

  if (!canon) {
    console.warn(`⚠️ No se encontró match canónico para: ${existingCareer.nombre} (${existingCareer.id})`);
    return existingCareer;
  }

  // Normalizar el nombre de la carrera si tenía error tipográfico
  let officialName = canon.name;
  if (canon.id === 'diseno_grafico') officialName = 'Diseño Gráfico Digital';
  if (canon.id === 'salud_integral') officialName = 'Salud Integral y Estilos de Vida Saludables';
  if (canon.id === 'soporte_ti') officialName = 'Soporte y Gestión de Tecnologías de la Información';

  const updatedModulos = canon.modules.map(m => {
    return {
      nombre: `Módulo ${m.modulo_romano}. ${m.modulo_nombre.replace(/^Módulo\s+[IVXLCDM]+\.?\s*/i, '').trim() || m.modulo_nombre}`,
      semestre: m.semestre,
      horasSemanales: m.horas_semanales,
      resultadoAprendizaje: m.resultado_aprendizaje,
      submodulos: m.submodulos.map(s => ({
        nombre: s.nombre,
        abreviatura: `SUB${s.submodulo_num}-M${m.modulo_romano}`,
        horasSemanales: s.horas_semanales,
        horasTotales: s.horas_totales,
        uac_name: s.uac_name,
        actividades: s.actividades.map(a => ({
          order: a.order,
          name: a.name,
          hours: a.hours,
          saberes: a.saberes
        }))
      }))
    };
  });

  return {
    ...existingCareer,
    nombre: officialName,
    tipoPrograma: 'nuevo',
    acuerdo: '09/05/24',
    edicion: 'Mayo, 2024',
    horasTotales: 1200,
    modulos: updatedModulos
  };
});

console.log(`Carreras procesadas: ${updatedCareers.length}`);

// Construir nuevo contenido
const newFileContent = `${header}${startMarker}\n${JSON.stringify(updatedCareers, null, 2).slice(1, -1)}\n${footer}`;

writeFileSync(targetFile, newFileContent, 'utf-8');
console.log(`✓ Archivo guardado con éxito: ${targetFile}`);
