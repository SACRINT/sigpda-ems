import fs from 'fs';
import path from 'path';

const archiveDir = path.join('scripts', 'archive');
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

const keepFiles = new Set([
  'backup-programs-catalog.mjs',
  'archive-legacy.mjs',
  'run-migration.ts',
  'run-migration.js',
  'migrate-admin.sql',
  'migrate-subscriptions.sql',
  'migrate-profile-lock.sql',
  'apply-stripe-schema.js',
  'apply-last-seen-at.js',
  'apply-biblioteca-schema.js',
  'apply-analytics-schema.js',
  'apply-schema-horarios.js',
  'apply-normativa-schema.js',
  'apply-phase4-schema.mjs',
  'apply-phase8-schema.mjs',
  'apply-signature-schema.mjs',
  'apply-workbooks-schema.mjs',
  'apply-evaluation-and-sequence-schema.mjs',
  'apply-curriculum-subsystems.js',
  'apply-audit-schema.mjs',
  'apply-ffe-continuity-schema.mjs',
  'apply-laboral-capacitaciones.mjs',
  'init-db.mjs',
  'schema.js',
  'sync-official-curriculum.ts'
]);

const files = fs.readdirSync('scripts');
let movedCount = 0;

for (const file of files) {
  const filePath = path.join('scripts', file);
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) continue; // skip subdirectories (data, archive)
  if (keepFiles.has(file)) continue;

  // Move legacy files
  fs.renameSync(filePath, path.join(archiveDir, file));
  movedCount++;
}

console.log(`✅ Se movieron ${movedCount} archivos obsoletos/legacy a scripts/archive/`);
