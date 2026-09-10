/**
 * OpenAI-compatible AI Provider implementation.
 * Works with: OpenAI, Nvidia NIM, Qwen, Mistral, and any OpenAI-compatible API.
 */

import OpenAI from 'openai';
import type { AIProvider } from './types';

// Base URLs for OpenAI-compatible providers
const BASE_URLS: Record<string, string> = {
  openai:     'https://api.openai.com/v1',
  nvidia:     'https://integrate.api.nvidia.com/v1',
  qwen:       'https://dashscope.aliyuncs.com/compatible-mode/v1',
  mistral:    'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

export class OpenAICompatibleProvider implements AIProvider {
  providerId: string;
  modelId: string;
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, providerId: string, modelId: string) {
    this.apiKey = apiKey;
    this.providerId = providerId;
    this.modelId = modelId;
    this.baseURL = BASE_URLS[providerId] || BASE_URLS.openai;
  }

  private getClient() {
    return new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
  }

  async generate(systemPrompt: string, userPrompt: string, options?: { temperature?: number }): Promise<string> {
    const client = this.getClient();

    const response = await client.chat.completions.create({
      model: this.modelId,
      temperature: options?.temperature !== undefined ? options.temperature : undefined,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 8192,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error(`Empty response from ${this.providerId} API`);
    return text;
  }

  async *generateStream(systemPrompt: string, userPrompt: string): AsyncGenerator<string> {
    const client = this.getClient();

    const stream = await client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 8192,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }
}
