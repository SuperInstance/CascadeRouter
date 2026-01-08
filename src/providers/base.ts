/**
 * Cascade Router - Base Provider Interface
 *
 * Abstract base class for all LLM providers
 */

import type {
  Provider,
  ProviderConfig,
  ChatRequest,
  ChatResponse,
} from '../types.js';

// ============================================================================
// ABSTRACT PROVIDER BASE
// ============================================================================

export abstract class BaseProvider implements Provider {
  abstract readonly id: string;
  abstract config: ProviderConfig;

  /**
   * Check if provider is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Process a chat request
   */
  abstract chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Process a streaming chat request
   */
  abstract chatStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse>;

  /**
   * Estimate token count for text
   */
  abstract estimateTokens(text: string): number;

  /**
   * Get maximum context window
   */
  getMaxTokens(): number {
    return this.config.maxTokens;
  }

  /**
   * Calculate cost for token usage
   */
  protected calculateCost(tokens: number): number {
    const costPerMillion = this.config.costPerMillionTokens;
    return (tokens / 1_000_000) * costPerMillion;
  }

  /**
   * Create a response object
   */
  protected createResponse(
    content: string,
    model: string,
    tokens: { input: number; output: number; total: number },
    duration: number,
    finishReason: string = 'stop'
  ): ChatResponse {
    return {
      content,
      model,
      provider: this.id,
      tokens,
      cost: this.calculateCost(tokens.total),
      duration,
      finishReason,
    };
  }

  /**
   * Estimate tokens using a simple heuristic
   * (Can be overridden by providers with tokenizers)
   */
  protected estimateTokensSimple(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    // This is a rough approximation, actual tokenization varies by model
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate that provider is properly configured
   */
  protected validateConfig(): void {
    if (!this.config.id) {
      throw new Error('Provider config must have an id');
    }
    if (!this.config.name) {
      throw new Error('Provider config must have a name');
    }
    if (!this.config.type) {
      throw new Error('Provider config must have a type');
    }
  }

  /**
   * Handle provider-specific errors
   */
  protected handleError(error: unknown, context: string): never {
    if (error instanceof Error) {
      throw new Error(
        `${this.config.name} provider error in ${context}: ${error.message}`
      );
    }
    throw new Error(
      `${this.config.name} provider error in ${context}: Unknown error`
    );
  }
}
