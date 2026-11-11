import { readFileSync } from 'fs';
import path from 'path';

/**
 * Carga `.env.local` (raíz del repo o un nivel arriba) sin dependencias externas.
 * No sobreescribe variables ya presentes en el entorno.
 */
export function loadEnvLocal(): void {
  if (process.env.DATABASE_URL) return;
  for (const candidate of ['.env.local', path.join('..', '.env.local')]) {
    try {
      const content = readFileSync(candidate, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      if (process.env.DATABASE_URL) return;
    } catch {
      // siguiente candidato
    }
  }
}
