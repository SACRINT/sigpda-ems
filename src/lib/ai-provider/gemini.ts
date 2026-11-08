import type { AIProvider, MultimodalResult } from './types';
import { API_CONFIG } from '@/lib/config';

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

export interface GeminiGenerateOptions {
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  remainingBudgetMs?: number;
  signal?: AbortSignal;
  responseSchema?: object;
}

export interface GeminiMultimodalOptions {
  timeoutMs?: number;
  remainingBudgetMs?: number;
  signal?: AbortSignal;
  responseSchema?: object;
  jsonMode?: boolean;
}

export class GeminiProvider implements AIProvider {
  providerId = 'gemini';
  modelId: string;
  private apiKey: string;

  constructor(apiKey: string, modelId = 'gemini-3.5-flash-lite') {
    this.apiKey = apiKey;
    this.modelId = sanitizeGeminiModel(modelId);
  }

  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: GeminiGenerateOptions
  ): Promise<string> {
    const url = `${API_CONFIG.gemini}/${this.modelId}:generateContent?key=${this.apiKey}`;
    const wantsJson = Boolean(options?.jsonMode || options?.responseSchema);
    const payload: {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      systemInstruction: { parts: Array<{ text: string }> };
      generationConfig: {
        temperature: number;
        topP: number;
        maxOutputTokens: number;
        responseMimeType: string;
        responseSchema?: object;
      };
    } = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: options?.temperature !== undefined ? options.temperature : 0.4,
        topP: 0.95,
        maxOutputTokens: options?.maxTokens || 8192,
        responseMimeType: wantsJson ? 'application/json' : 'text/plain',
      },
    };

    if (options?.responseSchema) {
      payload.generationConfig.responseSchema = options.responseSchema;
    }

    // Dynamic timeout: min(timeoutPorIntento, tiempoRestante), clamped >= 1ms
    const timeoutLimit = Math.max(
      1,
      Math.min(options?.timeoutMs ?? 60000, options?.remainingBudgetMs ?? 60000)
    );
    const timeoutSignal = AbortSignal.timeout(timeoutLimit);
    const effectiveSignal = options?.signal
      ? (typeof AbortSignal.any === 'function'
          ? AbortSignal.any([options.signal, timeoutSignal])
          : timeoutSignal)
      : timeoutSignal;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: effectiveSignal,
    });

    if (!res.ok) {
      const errText = await res.text();
      const err: Error & { status?: number; statusCode?: number } = new Error(
        `HTTP ${res.status}: ${errText}`
      );
      err.status = res.status;
      err.statusCode = res.status;
      throw err;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini API');
    return text;
  }

  async generateMultimodal(
    systemPrompt: string,
    userPrompt: string,
    inlineData: { mimeType: string; data: string },
    options?: GeminiMultimodalOptions
  ): Promise<string> {
    const result = await this.generateMultimodalWithUsage(systemPrompt, userPrompt, inlineData, options);
    return result.text;
  }

  async generateMultimodalWithUsage(
    systemPrompt: string,
    userPrompt: string,
    inlineData: { mimeType: string; data: string },
    options?: GeminiMultimodalOptions
  ): Promise<MultimodalResult> {
    const url = `${API_CONFIG.gemini}/${this.modelId}:generateContent?key=${this.apiKey}`;
    const wantsJson = Boolean(options?.jsonMode || options?.responseSchema);
    const payload: {
      contents: Array<{
        role: string;
        parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }>;
      }>;
      systemInstruction: { parts: Array<{ text: string }> };
      generationConfig: {
        temperature: number;
        topP: number;
        maxOutputTokens: number;
        responseMimeType: string;
        responseSchema?: object;
      };
    } = {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: inlineData.mimeType, data: inlineData.data } },
            { text: userPrompt },
          ],
        },
      ],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 8192,
        responseMimeType: wantsJson ? 'application/json' : 'text/plain',
      },
    };

    if (options?.responseSchema) {
      payload.generationConfig.responseSchema = options.responseSchema;
    }

    const timeoutLimit = Math.max(
      1,
      Math.min(options?.timeoutMs ?? 90000, options?.remainingBudgetMs ?? 90000)
    );
    const timeoutSignal = AbortSignal.timeout(timeoutLimit);
    const effectiveSignal = options?.signal
      ? (typeof AbortSignal.any === 'function'
          ? AbortSignal.any([options.signal, timeoutSignal])
          : timeoutSignal)
      : timeoutSignal;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: effectiveSignal,
    });

    if (!res.ok) {
      const errText = await res.text();
      const err: Error & { status?: number; statusCode?: number } = new Error(
        `HTTP ${res.status}: ${errText}`
      );
      err.status = res.status;
      err.statusCode = res.status;
      throw err;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty multimodal response from Gemini API');
    const usageMetadata = data?.usageMetadata;
    const usage = {
      promptTokenCount: typeof usageMetadata?.promptTokenCount === 'number' ? usageMetadata.promptTokenCount : undefined,
      candidatesTokenCount: typeof usageMetadata?.candidatesTokenCount === 'number' ? usageMetadata.candidatesTokenCount : undefined,
      totalTokenCount: typeof usageMetadata?.totalTokenCount === 'number' ? usageMetadata.totalTokenCount : undefined,
    };
    const hasUsage = Object.values(usage).some(v => v !== undefined);
    return { text, usage: hasUsage ? usage : undefined };
  }

  async *generateStream(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      timeoutMs?: number;
      remainingBudgetMs?: number;
      signal?: AbortSignal;
      jsonMode?: boolean;
      maxTokens?: number;
      responseSchema?: object;
    }
  ): AsyncGenerator<string> {
    const url = `${API_CONFIG.gemini}/${this.modelId}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
    const wantsJson = Boolean(options?.jsonMode || options?.responseSchema);
    const payload: {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      systemInstruction: { parts: Array<{ text: string }> };
      generationConfig: {
        temperature: number;
        topP: number;
        maxOutputTokens: number;
        responseMimeType: string;
        responseSchema?: object;
      };
    } = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: options?.maxTokens || 8192,
        responseMimeType: wantsJson ? 'application/json' : 'text/plain',
      },
    };

    if (options?.responseSchema) {
      payload.generationConfig.responseSchema = options.responseSchema;
    }

    const timeoutLimit = Math.max(
      1,
      Math.min(options?.timeoutMs ?? 110000, options?.remainingBudgetMs ?? 110000)
    );
    const timeoutSignal = AbortSignal.timeout(timeoutLimit);
    const effectiveSignal = options?.signal
      ? (typeof AbortSignal.any === 'function'
          ? AbortSignal.any([options.signal, timeoutSignal])
          : timeoutSignal)
      : timeoutSignal;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: effectiveSignal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      const err: Error & { status?: number; statusCode?: number } = new Error(
        `HTTP ${res.status}: ${errText}`
      );
      err.status = res.status;
      err.statusCode = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finishReason: string | undefined;

    // Procesa una línea SSE; devuelve el texto (todas las parts) y registra finishReason.
    const processLine = (line: string): string => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) return '';
      try {
        const data = JSON.parse(trimmed.substring(6));
        const candidate = data?.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        const parts: Array<{ text?: string }> = candidate?.content?.parts ?? [];
        return parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
      } catch {
        return ''; // Non-JSON line in SSE
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const chunkText = processLine(line);
        if (chunkText) yield chunkText;
      }
    }

    // Procesar el buffer SSE restante al terminar (última línea sin salto final)
    buffer += decoder.decode();
    if (buffer.trim()) {
      const tail = processLine(buffer);
      if (tail) yield tail;
    }

    // Terminación anómala: nunca dejar pasar un JSON truncado en silencio
    if (finishReason && finishReason !== 'STOP') {
      throw new Error(`Gemini terminó la generación de forma anómala (finishReason=${finishReason}).`);
    }
  }
}
