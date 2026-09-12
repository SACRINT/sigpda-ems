const fs = require('fs');

const jsonPath = 'C:\\Users\\samue\\.gemini\\antigravity\\brain\\ed37a3e5-9696-4fbc-8cdc-fecebfd91fe5\\scratch\\uacs_list.json';
const uacs = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log('=== RESUMEN DE MATERIAS / UACS ===');
console.log('Total de registros:', uacs.length);

const bySem = {};
uacs.forEach(u => {
  const sem = u.semester || 0;
  if (!bySem[sem]) bySem[sem] = [];
  bySem[sem].push(u);
});

let markdown = '# Catálogo Completo de Asignaturas / UACs (MCCEMS Puebla 2026-2027)\n\n';
markdown += 'Este documento contiene la lista **100% completa** de todas las asignaturas por semestre registradas en el catálogo del sistema DidácticaIA, organizadas por componente curricular (Fundamental, Ampliado Obligatorio, Ampliado Optativo, Formación Laboral / Capacitaciones, FFE y FFEO).\n\n';

Object.keys(bySem).sort((a,b) => Number(a) - Number(b)).forEach(sem => {
  const list = bySem[sem];
  markdown += `## Semestre ${sem} (${list.length} asignaturas)\n\n`;
  
  // Group by component
  const byComp = {};
  list.forEach(item => {
    const comp = item.component || 'general';
    if (!byComp[comp]) byComp[comp] = [];
    byComp[comp].push(item);
  });

  Object.keys(byComp).sort().forEach(comp => {
    let compTitle = comp;
    if (comp === 'fundamental') compTitle = 'Currículum Fundamental';
    else if (comp === 'ampliado' || comp === 'ext_obligatorio') compTitle = 'Currículum Ampliado (Obligatorio)';
    else if (comp === 'ext_optativo') compTitle = 'Currículum Ampliado (Optativo)';
    else if (comp === 'laboral') compTitle = 'Formación Laboral (Capacitaciones)';
    else if (comp === 'ffe') compTitle = 'Formación Fundamental Extendida (FFE)';
    else if (comp === 'ffeo') compTitle = 'Formación Fundamental Extendida Optativa (FFEO)';

    markdown += `### ${compTitle}\n\n`;
    markdown += `| # | Nombre de la Asignatura / UAC | Componente | Horas Totales | Áreas / Notas |\n`;
    markdown += `|---|-------------------------------|------------|---------------|---------------|\n`;
    
    byComp[comp].sort((a,b) => a.uac_name.localeCompare(b.uac_name)).forEach((item, idx) => {
      const name = item.uac_name || item.name || '';
      const hrs = item.total_hours || item.hours || 64;
      const curr = item.curriculum_name || '-';
      markdown += `| ${idx + 1} | ${name} | \`${item.component}\` | ${hrs} hrs | ${curr} |\n`;
    });
    markdown += '\n';
  });
});

fs.writeFileSync('C:\\Users\\samue\\.gemini\\antigravity\\brain\\ed37a3e5-9696-4fbc-8cdc-fecebfd91fe5\\catalogo_asignaturas_completo.md', markdown);
console.log('Archivo catalogo_asignaturas_completo.md generado exitosamente!');
