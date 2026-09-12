/**
 * Shared types for the AI Provider abstraction layer.
 * All AI providers (Gemini, Claude, OpenAI, etc.) must implement AIProvider.
 */

export interface AIProvider {
  /** ID of the provider: 'gemini' | 'claude' | 'openai' | 'nvidia' */
  providerId: string;
  /** Model identifier string used in API calls */
  modelId: string;

  /**
   * Generate text (non-streaming). Returns the full response as a string.
   */
  generate(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; jsonMode?: boolean; maxTokens?: number }
  ): Promise<string>;

  /**
   * Generate text as an async stream of string chunks.
   */
  generateStream(systemPrompt: string, userPrompt: string): AsyncGenerator<string>;
}

export interface ApiKeyRecord {
  id: string;
  label: string;
  provider: string;
  model_default: string | null;
  key_encrypted: string;
  key_preview: string;
  is_active: boolean;
  priority: number;
  usage_count: number;
  error_count: number;
  last_used_at: string | null;
  last_error_at: string | null;
}

export interface PlatformConfig {
  active_provider: string;
  active_model: string;
  school_year: string;
  maintenance_mode: string;
  maintenance_message: string;
  max_daily_plannings: string;
  welcome_message: string;
}
