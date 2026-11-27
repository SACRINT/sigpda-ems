#!/usr/bin/env node
/**
 * check-editorial-worker.mjs — Verifica salud, versión Typst >= 0.15.1, fuentes
 * cargadas y paridad de templateVersion del worker editorial en Render.
 *
 * Uso:
 *   npm run editorial:health
 *   EDITORIAL_WORKER_URL=https://sigpda-editorial-worker.onrender.com npm run editorial:health
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_RENDER_URL = 'https://sigpda-editorial-worker.onrender.com';
const baseUrl = (process.env.EDITORIAL_WORKER_URL || DEFAULT_RENDER_URL).replace(/\/+$/, '');
const healthUrl = `${baseUrl}/health`;

function computeLocalTemplateVersion() {
  const templateDir = path.join(process.cwd(), 'templates', 'editorial');
  const collect = (dir, base = dir) => {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collect(full, base));
      else if (entry.isFile() && entry.name.endsWith('.typ')) {
        out.push(path.relative(base, full).replace(/\\/g, '/'));
      }
    }
    return out.sort();
  };
  const files = collect(templateDir);
  const hash = crypto.createHash('sha256');
  for (const rel of files) {
    hash.update(rel);
    hash.update(fs.readFileSync(path.join(templateDir, rel)));
  }
  return `tpl:${hash.digest('hex').slice(0, 16)}`;
}

async function main() {
  const localVersion = computeLocalTemplateVersion();
  console.log(`[editorial:health] Consultando ${healthUrl} (local=${localVersion})...`);
  const res = await fetch(healthUrl, { signal: AbortSignal.timeout(65_000) });
  if (!res.ok) {
    console.error(`[editorial:health] ERROR HTTP ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  const fontsCount = Array.isArray(data.fontsLoaded)
    ? data.fontsLoaded.length
    : Number(data.fontsCount ?? data.fontsLoaded ?? 0);
  console.log(JSON.stringify({
    url: healthUrl,
    status: data.status,
    typstVersion: data.typstVersion,
    templateVersion: data.templateVersion,
    localTemplateVersion: localVersion,
    templateMatches: data.templateVersion === localVersion,
    fontsCount,
    uptimeSec: data.uptimeSec ?? data.uptimeSeconds ?? null,
  }, null, 2));

  const versionMatch = /typst\s+(\d+)\.(\d+)\.(\d+)/i.exec(String(data.typstVersion || ''));
  const isWebpCapable =
    versionMatch &&
    (Number(versionMatch[1]) > 0 ||
      Number(versionMatch[2]) > 15 ||
      (Number(versionMatch[2]) === 15 && Number(versionMatch[3]) >= 1));

  if (!isWebpCapable) {
    console.error('[editorial:health] ERROR: Typst debe ser >= 0.15.1 para soporte nativo WebP.');
    process.exit(1);
  }
  if (!Number.isFinite(fontsCount) || fontsCount <= 0) {
    console.error('[editorial:health] ERROR: fontsCount debe ser > 0.');
    process.exit(1);
  }
  if (data.templateVersion !== localVersion) {
    console.warn(`[editorial:health] AVISO: templateVersion remoto (${data.templateVersion}) difiere del local (${localVersion}). Haz push a main para que Render despliegue.`);
  }
}

main().catch((err) => {
  console.error('[editorial:health] Fallo consultando worker:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
