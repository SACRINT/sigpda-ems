import fs from 'fs';

const matched = JSON.parse(fs.readFileSync('scripts/matched-laboral.json', 'utf-8'));

// Add the 2 missing ones to Procesos Culinarios y Reposteria
matched["Procesos Culinarios y Reposteria"]["sem5"].push("Prepara banquetes y servicios gastronómicos para eventos especiales");
matched["Procesos Culinarios y Reposteria"]["sem6"].push("Diseña y comercializa menús y servicios gastronómicos sustentables");

let total = 0;
for (const [cap, sems] of Object.entries(matched)) {
  console.log(`\n${cap}:`);
  for (const s of [3, 4, 5, 6]) {
    const list = sems[`sem${s}`] || [];
    console.log(`  Sem ${s} (${list.length}): ${list.join(' | ')}`);
    total += list.length;
  }
}

console.log(`\nTotal UACs in matched: ${total}`);

fs.writeFileSync('scripts/matched-laboral-complete.json', JSON.stringify(matched, null, 2), 'utf-8');
