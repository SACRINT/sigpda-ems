import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// ─── Lazy SQL client ────────────────────────────────────────────────────────
// Instantiated on first call at runtime, not at build time.
// Prevents Vercel build failures when DATABASE_URL is missing during static analysis.
let _client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (!_client) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _client = neon(process.env.DATABASE_URL);
  }
  return _client;
}

export function sql(): NeonQueryFunction<false, false>;
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<any>;
export function sql(...args: unknown[]): unknown {
  const client = getClient();
  if (args.length > 0 && Array.isArray(args[0]) && 'raw' in (args[0] as object)) {
    return (client as any)(args[0], ...args.slice(1));
  }
  return client;
}

