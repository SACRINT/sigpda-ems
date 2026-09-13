import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { createDecipheriv } from 'crypto';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';
import { API_CONFIG } from '@/lib/config';

function getDb() { return neon(process.env.DATABASE_URL!); }

function getEncKey(): Buffer {
  const key = process.env.ADMIN_ENCRYPTION_KEY;
  if (!key || key.length !== 32) throw new Error('ADMIN_ENCRYPTION_KEY must be 32 characters');
  return Buffer.from(key);
}

function decryptKey(encrypted: string): string {
  const [ivHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', getEncKey(), iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Sends a minimal test prompt to the provider using the given API key.
 * Returns { ok, latencyMs, model, message }
 */
async function pingProvider(provider: string, model: string, apiKey: string): Promise<{ ok: boolean; latencyMs: number; model: string; message: string }> {
  const t0 = Date.now();
  const testPrompt = 'Responde únicamente con la palabra: OK';

  try {
    if (provider === 'gemini') {
      // Gemini REST API
      const url = `${API_CONFIG.gemini}/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
        signal: AbortSignal.timeout(12000),
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err?.error?.message || res.statusText || `HTTP ${res.status}`;
        return { ok: false, latencyMs, model, message: errMsg };
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { ok: true, latencyMs, model, message: text.trim() || 'OK' };
    }

    if (provider === 'claude') {
      // Anthropic Messages API
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: 'user', content: testPrompt }],
        }),
        signal: AbortSignal.timeout(12000),
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, latencyMs, model, message: err?.error?.message || `HTTP ${res.status}` };
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      return { ok: true, latencyMs, model, message: text.trim() || 'OK' };
    }

    // OpenRouter: validate key using /api/v1/auth/key (no tokens consumed)
    if (provider === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://sigpda-ems.vercel.app',
          'X-Title': 'SIGPDA-EMS',
        },
        signal: AbortSignal.timeout(12000),
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errMsg = err?.error?.message || `HTTP ${res.status} - Llave inválida`;
        return { ok: false, latencyMs, model: 'openrouter/auth', message: errMsg };
      }
      const data = await res.json();
      const label = data?.data?.label || 'API Key válida';
      const credits = data?.data?.usage !== undefined ? ` | Uso: $${(data.data.usage / 1000000).toFixed(4)}` : '';
      return { ok: true, latencyMs, model: 'openrouter/auth', message: `${label}${credits}` };
    }

    // OpenAI-compatible (openai, nvidia, qwen, mistral)
    const BASE_URLS: Record<string, string> = {
      openai:  'https://api.openai.com/v1',
      nvidia:  'https://integrate.api.nvidia.com/v1',
      qwen:    'https://dashscope.aliyuncs.com/compatible-mode/v1',
      mistral: 'https://api.mistral.ai/v1',
    };
    const baseURL = BASE_URLS[provider] || BASE_URLS.openai;
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errMsg = err?.error?.message || `HTTP ${res.status}`;
      return { ok: false, latencyMs, model, message: errMsg };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { ok: true, latencyMs, model, message: text.trim() || 'OK' };

  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - t0, model, message: err?.message || 'Timeout o error de red' };
  }
}

/**
 * POST /api/admin/api-keys/test
 * Body: { id: string }            → test a single key by DB id
 *       { testAll: true }         → test all active keys
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const sql = getDb();

    if (body.testAll) {
      // Test all keys
      const rows = await sql`
        SELECT id, label, provider, model_default, key_encrypted
        FROM api_keys
        ORDER BY provider, priority ASC
      `;

      const results = await Promise.all(
        rows.map(async (row: any) => {
          try {
            const apiKey = decryptKey(row.key_encrypted);
            // Use the key's model_default or a safe default
            const model = row.model_default || (
              row.provider === 'gemini'     ? 'gemini-3.5-flash-lite' :
              row.provider === 'claude'     ? 'claude-haiku-4-5' :
              row.provider === 'openai'     ? 'gpt-4o-mini' :
              row.provider === 'mistral'    ? 'mistral-small-latest' :
              row.provider === 'nvidia'     ? 'meta/llama-3.1-70b-instruct' :
              row.provider === 'openrouter' ? 'openrouter/auth' :
              'gpt-4o-mini'
            );
            const result = await pingProvider(row.provider, model, apiKey);
            return { id: row.id, label: row.label, provider: row.provider, ...result };
          } catch {
            return { id: row.id, label: row.label, provider: row.provider, ok: false, latencyMs: 0, model: '', message: 'Error al descifrar la key' };
          }
        })
      );

      return NextResponse.json({ results });
    }

    // Test single key by id
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Se requiere id o testAll' }, { status: 400 });

    const rows = await sql`
      SELECT id, label, provider, model_default, key_encrypted
      FROM api_keys WHERE id = ${id} LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'API Key no encontrada' }, { status: 404 });

    const row = rows[0];
    const apiKey = decryptKey(row.key_encrypted);
    const model = row.model_default || (
      row.provider === 'gemini'     ? 'gemini-3.5-flash-lite' :
      row.provider === 'claude'     ? 'claude-haiku-4-5' :
      row.provider === 'openai'     ? 'gpt-4o-mini' :
      row.provider === 'mistral'    ? 'mistral-small-latest' :
      row.provider === 'nvidia'     ? 'meta/llama-3.1-70b-instruct' :
      row.provider === 'openrouter' ? 'openrouter/auth' :
      'gpt-4o-mini'
    );

    const result = await pingProvider(row.provider, model, apiKey);
    return NextResponse.json({ id: row.id, label: row.label, provider: row.provider, ...result });

  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
