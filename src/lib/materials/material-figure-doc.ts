// src/lib/materials/material-figure-doc.ts
/**
 * Helper de backend / Node.js para renderizado de figuras de materiales en PDF y DOCX.
 * SIGPDA-EMS · Ciclo Escolar 2026-2027
 */

import fs from 'fs';
import path from 'path';

/**
 * Lee el archivo PNG correspondiente al slug de material.
 * Si el asset individual aún no ha sido provisto, devuelve el buffer
 * de _placeholder.png garantizando renderizado determinista offline (D4/D9).
 */
export function readMaterialPng(slug: string): Buffer | null {
  if (!slug || typeof slug !== 'string') return null;
  const cleanSlug = slug.trim().toLowerCase();
  const baseDir = path.join(process.cwd(), 'public', 'images', 'materiales');
  const targetPath = path.join(baseDir, `${cleanSlug}.png`);

  if (fs.existsSync(targetPath)) {
    try {
      return fs.readFileSync(targetPath);
    } catch {
      // Fallback defensivo a placeholder
    }
  }

  const placeholderPath = path.join(baseDir, '_placeholder.png');
  if (fs.existsSync(placeholderPath)) {
    try {
      return fs.readFileSync(placeholderPath);
    } catch {
      return null;
    }
  }

  return null;
}
