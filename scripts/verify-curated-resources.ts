/**
 * verify-curated-resources.ts — Verifica disponibilidad HTTP de la biblioteca curada.
 *
 * Uso:
 *   npx tsx scripts/verify-curated-resources.ts
 *
 * Sale con código 1 si algún recurso no responde 2xx/3xx.
 */

import { CURATED_RESOURCES } from '../src/lib/resources/curated-resources';

async function check(url: string): Promise<{ ok: boolean; status: number | string }> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const response = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': 'SIGPDA-EMS-resource-verifier/1.0' },
    });
    return response.status;
  };

  try {
    let status = await attempt('HEAD');
    if (status === 405 || status === 403 || status === 0) status = await attempt('GET');
    return { ok: status >= 200 && status < 400, status };
  } catch (error) {
    return { ok: false, status: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  console.log(`Verificando ${CURATED_RESOURCES.length} recursos curados...\n`);
  let failures = 0;
  for (const resource of CURATED_RESOURCES) {
    const result = await check(resource.url);
    if (!result.ok) failures++;
    console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${String(result.status).padEnd(14)} ${resource.id.padEnd(24)} ${resource.url}`);
  }
  console.log(`\n${CURATED_RESOURCES.length - failures}/${CURATED_RESOURCES.length} recursos disponibles.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
