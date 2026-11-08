import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiProvider } from '@/lib/ai-provider/gemini';

function sseResponse(lines: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      for (const l of lines) c.enqueue(enc.encode(l));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const evt = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const c of gen) out += c;
  return out;
}

afterEach(() => vi.restoreAllMocks());

describe('GeminiProvider.generateStream: terminación del stream', () => {
  it('concatena todas las parts y procesa el último evento sin salto final', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([
        evt({ candidates: [{ content: { parts: [{ text: 'A' }, { text: 'B' }] } }] }),
        // Último evento SIN \n\n final
        `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'C' }] }, finishReason: 'STOP' }] })}`,
      ])
    );
    const p = new GeminiProvider('k');
    expect(await collect(p.generateStream('s', 'u'))).toBe('ABC');
  });

  it.each(['MAX_TOKENS', 'SAFETY', 'RECITATION'])('lanza error explícito si finishReason=%s', async (reason) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      sseResponse([evt({ candidates: [{ content: { parts: [{ text: '{"a":' }] }, finishReason: reason }] })])
    );
    const p = new GeminiProvider('k');
    await expect(collect(p.generateStream('s', 'u'))).rejects.toThrow(reason);
  });

  it('respeta maxTokens en el payload', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(sseResponse([evt({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'STOP' }] })]));
    await collect(new GeminiProvider('k').generateStream('s', 'u', { maxTokens: 32768 }));
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.generationConfig.maxOutputTokens).toBe(32768);
  });
});

