/**
 * template-version.ts — Cálculo del hash compuesto de templates/editorial/**.typ
 * SIGPDA-EMS · Motor Editorial Unificado (Fase 4)
 *
 * Extraído del route handler para ser compartido limpiamente por
 * `/api/pdf/libro-editorial/[id]` y `unified-editorial-compiler.ts` sin
 * violar fronteras de capas.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const EDITORIAL_TEMPLATE_VERSION_FALLBACK = 'v2026.10.20.2';

let cachedTemplateVersion: string | null = null;

export function resetEditorialTemplateVersionCache(): void {
  cachedTemplateVersion = null;
}

/**
 * Calcula `tpl:<sha256-16hex>` determinista sobre todos los `.typ` de `templates/editorial/`.
 */
export function resolveEditorialTemplateVersion(): string {
  if (cachedTemplateVersion !== null) {
    return cachedTemplateVersion;
  }
  try {
    const templateDir = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      'templates',
      'editorial',
    );
    const collectTyp = (dir: string, base = dir): string[] => {
      if (!fs.existsSync(dir)) return [];
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...collectTyp(full, base));
        else if (entry.isFile() && entry.name.endsWith('.typ')) {
          out.push(path.relative(base, full).replace(/\\/g, '/'));
        }
      }
      return out.sort();
    };
    const files = collectTyp(templateDir);
    if (!files.includes('workbook-template.typ')) {
      throw new Error('workbook-template.typ missing');
    }
    const hash = crypto.createHash('sha256');
    for (const rel of files) {
      hash.update(rel);
      hash.update(fs.readFileSync(path.join(templateDir, rel)));
    }
    cachedTemplateVersion = `tpl:${hash.digest('hex').slice(0, 16)}`;
  } catch {
    cachedTemplateVersion = EDITORIAL_TEMPLATE_VERSION_FALLBACK;
  }
  return cachedTemplateVersion;
}
