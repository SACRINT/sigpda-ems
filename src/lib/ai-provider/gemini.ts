import type { AIProvider } from './types';

/**
 * Normalizes Gemini model names to enforce strictly authorized models:
 * - gemini-3.5-flash-lite (default)
 * - gemini-3.1-flash-lite
 * Any legacy or prohibited models (e.g. gemini-2.5-flash, gemini-1.5-flash)
 * are mapped safely to gemini-3.5-flash-lite.
 */
export function sanitizeGeminiModel(model?: string | null): string {
  if (!model) return 'gemini-3.5-flash-lite';
  const clean = model.trim().toLowerCase();
  if (clean === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite';
  return 'gemini-3.5-flash-lite';
}

export class GeminiProvider implements AIProvider {
  providerId = 'gemini';
  modelId: string;
  private apiKey: string;

  constructor(apiKey: string, modelId = 'gemini-3.5-flash-lite') {
    this.apiKey = apiKey;
    this.modelId = sanitizeGeminiModel(modelId);
  }

  async generate(systemPrompt: string, userPrompt: string, options?: { temperature?: number }): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: options?.temperature !== undefined ? options.temperature : 0.4,
        topP: 0.95,
        responseMimeType: 'text/plain',
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini API');
    return text;
  }

  async *generateStream(systemPrompt: string, userPrompt: string): AsyncGenerator<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.substring(6));
            const chunkText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunkText) yield chunkText;
          } catch {
            // Non-JSON line in SSE
          }
        }
      }
    }
  }
}
