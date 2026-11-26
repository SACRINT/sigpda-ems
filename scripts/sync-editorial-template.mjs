#!/usr/bin/env node
/**
 * sync-editorial-template.mjs — Sincroniza la plantilla Typst canónica hacia worker-editorial/
 * Garantiza paridad SHA-256 bit-a-bit entre templates/editorial/workbook-template.typ
 * y worker-editorial/templates/editorial/workbook-template.typ.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const src = path.join(rootDir, 'templates', 'editorial', 'workbook-template.typ');
const dest = path.join(rootDir, 'worker-editorial', 'templates', 'editorial', 'workbook-template.typ');

if (!fs.existsSync(src)) {
  console.error(`[sync-editorial-template] ERROR: no existe la plantilla canónica en ${src}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);

const srcSha = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
const destSha = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');

if (srcSha !== destSha) {
  console.error('[sync-editorial-template] ERROR: SHA-256 no coincide tras copia');
  process.exit(1);
}

console.log(`[sync-editorial-template] OK — SHA-256 ${srcSha.slice(0, 16)} sincronizado en worker-editorial/`);
