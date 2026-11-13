import fs from 'fs';
import path from 'path';

const testsRoot = path.resolve(process.cwd(), 'src', '__tests__');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

if (!fs.existsSync(testsRoot)) {
  console.log('[test:isolation] No src/__tests__ directory found, skipping.');
  process.exit(0);
}

const unitTests = walk(testsRoot).filter((file) => {
  const base = path.basename(file);
  if (!/\.test\.(ts|tsx)$/.test(base)) return false;
  if (/\.(integration|live)\.test\.(ts|tsx)$/.test(base)) return false;
  return true;
});

const violations = [];
const warnings = [];

for (const file of unitTests) {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(process.cwd(), file);
  if (/\bneon\s*\(/.test(code)) violations.push(`${rel}: llama a neon(...)`);
  if (/\.env\.local/.test(code)) violations.push(`${rel}: lee .env.local`);

  const importsDb = /^\s*import\s+(?!type\b)[^;]*?from\s+['"]@\/lib\/db['"]/m.test(code);
  const mocksDb = /vi\.mock\(\s*['"](?:@\/lib\/db|@neondatabase\/serverless)['"]/.test(code);
  if (importsDb && !mocksDb) {
    warnings.push(`${rel}: importa @/lib/db sin vi.mock(...)`);
  }
}

if (violations.length > 0) {
  console.error('\n[test:isolation] ERROR: los tests unitarios deben ser 100% offline.');
  console.error('Mueve el acceso a Neon a un archivo *.integration.test.ts y vuelve a intentar.\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error('');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(`\n[test:isolation] ADVERTENCIA: ${warnings.length} test(s) unitarios importan @/lib/db sin vi.mock(...).`);
  console.warn('Verifica que no abran una conexión real a Neon.\n');
  for (const w of warnings) console.warn(`  - ${w}`);
  console.warn('');
}

console.log(`[test:isolation] OK: ${unitTests.length} archivos unitarios sin acceso directo a Neon.`);
