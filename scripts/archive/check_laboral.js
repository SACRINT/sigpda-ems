const fs = require('fs');

const grouped = JSON.parse(fs.readFileSync('C:\\Users\\samue\\.gemini\\antigravity\\brain\\ed37a3e5-9696-4fbc-8cdc-fecebfd91fe5\\scratch\\laboral_grouped.json', 'utf8'));

console.log('=== VERIFICANDO CAPACITACIONES LABORALES (15) ===');
let totalLaboral = 0;
Object.keys(grouped).forEach(cap => {
  let countCap = 0;
  [3, 4, 5, 6].forEach(sem => {
    const list = grouped[cap][sem] || [];
    countCap += list.length;
    if (list.length !== 2) {
      console.log(`⚠️ ALERTA: ${cap} en Semestre ${sem} tiene ${list.length} materias (se esperaban 2)`);
    }
  });
  totalLaboral += countCap;
  console.log(`Capacitación: ${cap} -> ${countCap} materias`);
});

console.log('Total asignaturas laborales:', totalLaboral);
