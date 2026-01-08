/**
 * Cascade Router - OpenAI Provider
 *
 * OpenAI API provider implementation
 */

import { BaseProvider } from './base.js';
import type { ProviderConfig, ChatRequest, ChatResponse } from '../types.js';

// ============================================================================
// OPENAI API TYPES
// ============================================================================

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChoice {
  message: {
    content: string;
    role: string;
  };
  finish_reason: string;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

// Note: Stream types reserved for future streaming implementation
// interface OpenAIStreamDelta {
//   content?: string;
// }
//
// interface OpenAIStreamChoice {
//   delta: OpenAIStreamDelta;
//   finish_reason: string | null;
// }

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

export class OpenAIProvider extends BaseProvider {
  readonly id: string;
  config: ProviderConfig;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.id = config.id;
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.validateConfig();
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const messages = this.formatMessages(request);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o-mini',
          messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 500,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
        );
      }

      const data: OpenAIChatResponse = await response.json() as OpenAIChatResponse;

      const tokens = {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      };

      const duration = Date.now() - startTime;

      return this.createResponse(
        data.choices[0].message.content,
        data.model,
        tokens,
        duration,
        data.choices[0].finish_reason
      );
    } catch (error) {
      this.handleError(error, 'chat');
    }
  }

  async chatStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const messages = this.formatMessages(request);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o-mini',
          messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 500,
          stream: true,
        }),
        signal: AbortSignal.timeout(this.config.timeout || 60000),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;

            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Estimate tokens for streaming response
      inputTokens = this.estimateTokens(JSON.stringify(messages));
      outputTokens = this.estimateTokens(fullContent);

      const duration = Date.now() - startTime;

      return this.createResponse(
        fullContent,
        this.config.model || 'gpt-4o-mini',
        {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        duration,
        'stop'
      );
    } catch (error) {
      this.handleError(error, 'chatStream');
    }
  }

  estimateTokens(text: string): number {
    // For OpenAI, we can use a more accurate estimate if needed
    // For now, using the simple heuristic
    return this.estimateTokensSimple(text);
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private formatMessages(request: ChatRequest): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history
    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages);
    }

    // Add current prompt
    messages.push({
      role: 'user',
      content: request.prompt,
    });

    return messages;
  }
}
