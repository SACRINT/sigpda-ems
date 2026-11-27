#!/usr/bin/env node
/**
 * sync-editorial-template.mjs — Sincroniza la plantilla Typst canónica y sus componentes
 * hacia `worker-editorial/templates/editorial/`, verificando SHA-256 compuesto bit-a-bit.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'templates', 'editorial');
const destDir = path.join(rootDir, 'worker-editorial', 'templates', 'editorial');

function listTypFilesRecursive(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTypFilesRecursive(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.typ')) {
      results.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

function hashTypDir(dir, files) {
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    hash.update(rel);
    hash.update(fs.readFileSync(path.join(dir, rel)));
  }
  return hash.digest('hex');
}

const srcFiles = listTypFilesRecursive(srcDir);
if (!srcFiles.includes('workbook-template.typ')) {
  console.error(`[sync-editorial-template] ERROR: falta workbook-template.typ en ${srcDir}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
for (const rel of srcFiles) {
  const srcPath = path.join(srcDir, rel);
  const destPath = path.join(destDir, rel);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

// Limpiar archivos .typ huérfanos en worker-editorial si se eliminó algún componente
for (const rel of listTypFilesRecursive(destDir)) {
  if (!srcFiles.includes(rel)) {
    fs.unlinkSync(path.join(destDir, rel));
  }
}

const srcSha = hashTypDir(srcDir, srcFiles);
const destSha = hashTypDir(destDir, listTypFilesRecursive(destDir));

if (srcSha !== destSha) {
  console.error('[sync-editorial-template] ERROR: SHA-256 compuesto no coincide tras copia');
  process.exit(1);
}

console.log(
  `[sync-editorial-template] OK — ${srcFiles.length} archivo(s) .typ sincronizados · SHA-256 ${srcSha.slice(0, 16)}`
);
