/**
 * Anthropic Claude AI Provider implementation.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './types';

export class ClaudeProvider implements AIProvider {
  providerId = 'claude';
  modelId: string;
  private apiKey: string;

  constructor(apiKey: string, modelId = 'claude-haiku-4-5') {
    this.apiKey = apiKey;
    this.modelId = modelId;
  }

  async generate(systemPrompt: string, userPrompt: string, options?: { temperature?: number }): Promise<string> {
    const client = new Anthropic({ apiKey: this.apiKey });

    const response = await client.messages.create({
      model: this.modelId,
      max_tokens: 8192,
      temperature: options?.temperature !== undefined ? options.temperature : undefined,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude API');
    return block.text;
  }

  async *generateStream(systemPrompt: string, userPrompt: string): AsyncGenerator<string> {
    const client = new Anthropic({ apiKey: this.apiKey });

    const stream = await client.messages.stream({
      model: this.modelId,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
