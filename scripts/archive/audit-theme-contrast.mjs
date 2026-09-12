import fs from 'fs';
import path from 'path';

/**
 * Audit script to detect hardcoded light backgrounds in UI components.
 * Prevents text-on-background contrast collisions in dark mode.
 */

const SRC_DIR = path.resolve('src');

// Excluded files (e.g. print/PDF/Excel generators where white paper sheets are intentional)
const EXCLUDED_FILES = [
  path.normalize('src/lib/horarios/exportador.ts'),
  path.normalize('src/lib/horarios/subject-colors.ts'),
  path.normalize('src/lib/excel-plantilla.ts'),
  path.normalize('src/lib/excel-matriz.ts'),
];

// Regex patterns to detect hardcoded light backgrounds
const FORBIDDEN_PATTERNS = [
  {
    name: 'Inline background with hardcoded light hex',
    regex: /background(?:Color)?\s*:\s*['"]#(?:fff|ffffff|f8fafc|f1f5f9|f5f5f5|f0fdf4|fffbeb|fff1f2|fff7ed|fafafa|f3f4f6|f4f4f5)['"]/i
  },
  {
    name: 'var() with hardcoded light fallback',
    regex: /var\(--c-[a-z0-9-_]+,\s*['"]?#(?:fff|ffffff|f8fafc|f1f5f9|f5f5f5)['"]?\)/i
  },
  {
    name: 'Tailwind light background class without dark modifier',
    regex: /(?:className|class)\s*=\s*['"][^'"]*\b(?:bg-white|bg-slate-50|bg-gray-50|bg-zinc-50)(?!\/)\b(?![^'"]*dark:)/i
  }
];

function getAllSourceFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('🔍 Iniciando Auditoría de Contraste y Superficies Oscuras (SIGPDA-EMS)...\n');

const allFiles = getAllSourceFiles(SRC_DIR);
let violations = 0;

for (const filePath of allFiles) {
  const relativePath = path.relative(process.cwd(), filePath);
  if (EXCLUDED_FILES.some(ex => relativePath.endsWith(ex))) {
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, lineIdx) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        console.error(`❌ [${pattern.name}] en ${relativePath}:${lineIdx + 1}`);
        console.error(`   ${line.trim()}\n`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`🚨 Se encontraron ${violations} violaciones de contraste/fondos claros.`);
  console.error(`👉 Corrige los estilos usando tokens semánticos (var(--c-bg-surface), var(--c-bg-elevated), etc.).\n`);
  process.exit(1);
} else {
  console.log(`✅ ¡Auditoría exitosa! Cero fondos claros residuales encontrados en ${allFiles.length} archivos analizados.\n`);
  process.exit(0);
}
