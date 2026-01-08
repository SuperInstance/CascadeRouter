/**
 * Cascade Router - Ollama Provider
 *
 * Local Ollama provider implementation
 */

import { BaseProvider } from './base.js';
import type { ProviderConfig, ChatRequest, ChatResponse } from '../types.js';

// ============================================================================
// OLLAMA API TYPES
// ============================================================================

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// ============================================================================
// OLLAMA PROVIDER
// ============================================================================

export class OllamaProvider extends BaseProvider {
  readonly id: string;
  config: ProviderConfig;
  private baseUrl: string;
  private model: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.id = config.id;
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.validateConfig();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(request);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 500,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data = await response.json() as OllamaGenerateResponse;

      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(data.response);
      const tokens = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const duration = Date.now() - startTime;

      return this.createResponse(
        data.response,
        this.model,
        tokens,
        duration,
        data.done ? 'stop' : 'length'
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
    let fullResponse = '';

    try {
      const prompt = this.buildPrompt(request);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: true,
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 500,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
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
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              onChunk(data.response);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      const inputTokens = this.estimateTokens(prompt);
      const outputTokens = this.estimateTokens(fullResponse);
      const tokens = {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      };

      const duration = Date.now() - startTime;

      return this.createResponse(
        fullResponse,
        this.model,
        tokens,
        duration,
        'stop'
      );
    } catch (error) {
      this.handleError(error, 'chatStream');
    }
  }

  estimateTokens(text: string): number {
    // Ollama models vary, using simple heuristic
    return this.estimateTokensSimple(text);
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private buildPrompt(request: ChatRequest): string {
    let prompt = '';

    // Add conversation history
    if (request.messages && request.messages.length > 0) {
      // Take last N messages to avoid context overflow
      const recentMessages = request.messages.slice(-10);

      for (const msg of recentMessages) {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        prompt += `${role}: ${msg.content}\n`;
      }
    }

    // Add current prompt
    prompt += `User: ${request.prompt}\nAssistant:`;

    return prompt;
  }
}
