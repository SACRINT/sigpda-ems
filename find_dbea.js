const fs = require('fs');

function findFiles(dir, pattern) {
  const files = fs.readdirSync(dir);
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = dir + '/' + f;
    const stat = fs.statSync(full);
    if (stat.isDirectory() && f !== 'node_modules' && f !== '.git') {
      results = results.concat(findFiles(full, f));
    } else if (stat.isFile() && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
      const c = fs.readFileSync(full, 'utf8');
      if (pattern.test(c)) { results.push(full); }
    }
    return results;
  }

const results = findFiles('src', /DBEPA PUEBLA/);
console.log(results.join('\n'));