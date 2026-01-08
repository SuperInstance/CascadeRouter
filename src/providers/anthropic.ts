/**
 * Cascade Router - Anthropic Provider
 *
 * Anthropic Claude API provider implementation
 */

import { BaseProvider } from './base.js';
import type { ProviderConfig, ChatRequest, ChatResponse } from '../types.js';

// ============================================================================
// ANTHROPIC API TYPES
// ============================================================================

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicContent {
  type: string;
  text: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContent[];
  model: string;
  stop_reason: string;
  usage: AnthropicUsage;
}

// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

export class AnthropicProvider extends BaseProvider {
  readonly id: string;
  config: ProviderConfig;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.id = config.id;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.validateConfig();
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Try a simple request to check availability
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok || response.status === 400; // 400 means API is up, just invalid request
    } catch {
      return false;
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const messages = this.formatMessages(request);
      const systemPrompt = this.getSystemPrompt(request);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-haiku-20240307',
          max_tokens: request.maxTokens || 500,
          system: systemPrompt,
          messages,
          temperature: request.temperature || 0.7,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
        );
      }

      const data = await response.json() as AnthropicResponse;

      const tokens = {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      };

      const duration = Date.now() - startTime;

      return this.createResponse(
        data.content[0].text,
        data.model,
        tokens,
        duration,
        data.stop_reason
      );
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  async chatStream(
    _request: ChatRequest,
    _onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    // For simplicity, using non-streaming for now
    // Can be extended to support streaming
    return this.chat(_request);
  }

  estimateTokens(text: string): number {
    // Claude uses a different tokenizer, but for now using simple heuristic
    return this.estimateTokensSimple(text);
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private formatMessages(request: ChatRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history
    if (request.messages && request.messages.length > 0) {
      // Filter out system messages as Anthropic handles them separately
      for (const msg of request.messages) {
        if (msg.role !== 'system') {
          messages.push(msg);
        }
      }
    }

    // Add current prompt
    messages.push({
      role: 'user',
      content: request.prompt,
    });

    return messages;
  }

  private getSystemPrompt(request: ChatRequest): string {
    // Extract system message from history if present
    if (request.messages && request.messages.length > 0) {
      const systemMsg = request.messages.find((msg) => msg.role === 'system');
      if (systemMsg) {
        return systemMsg.content;
      }
    }

    // Default system prompt
    return 'You are a helpful AI assistant.';
  }
}
