/**
 * Cascade Router - Provider Factory
 *
 * Factory for creating provider instances
 */

import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import type { Provider, ProviderConfig } from '../types.js';

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

export class ProviderFactory {
  /**
   * Create a provider from config
   */
  static createProvider(config: ProviderConfig): Provider {
    switch (config.type) {
      case 'openai':
        return new OpenAIProvider(config);

      case 'anthropic':
        return new AnthropicProvider(config);

      case 'ollama':
        return new OllamaProvider(config);

      case 'custom':
      case 'mcp':
        throw new Error(
          `Custom providers must be created manually. Provider type: ${config.type}`
        );

      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  /**
   * Create multiple providers from configs
   */
  static createProviders(configs: ProviderConfig[]): Provider[] {
    return configs.map((config) => this.createProvider(config));
  }

  /**
   * Create OpenAI provider
   */
  static createOpenAI(config: Partial<ProviderConfig> = {}): OpenAIProvider {
    const fullConfig: ProviderConfig = {
      id: config.id || 'openai-default',
      name: config.name || 'OpenAI',
      type: 'openai',
      enabled: config.enabled ?? true,
      priority: config.priority ?? 10,
      maxTokens: config.maxTokens ?? 128000,
      costPerMillionTokens: config.costPerMillionTokens ?? 0.15,
      latency: config.latency ?? 500,
      availability: config.availability ?? 0.99,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o-mini',
      config: config.config || {},
    };

    return new OpenAIProvider(fullConfig);
  }

  /**
   * Create Anthropic provider
   */
  static createAnthropic(config: Partial<ProviderConfig> = {}): AnthropicProvider {
    const fullConfig: ProviderConfig = {
      id: config.id || 'anthropic-default',
      name: config.name || 'Anthropic',
      type: 'anthropic',
      enabled: config.enabled ?? true,
      priority: config.priority ?? 5,
      maxTokens: config.maxTokens ?? 200000,
      costPerMillionTokens: config.costPerMillionTokens ?? 0.25,
      latency: config.latency ?? 600,
      availability: config.availability ?? 0.99,
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
      baseUrl: config.baseUrl || 'https://api.anthropic.com',
      model: config.model || 'claude-3-haiku-20240307',
      config: config.config || {},
    };

    return new AnthropicProvider(fullConfig);
  }

  /**
   * Create Ollama provider
   */
  static createOllama(config: Partial<ProviderConfig> = {}): OllamaProvider {
    const fullConfig: ProviderConfig = {
      id: config.id || 'ollama-default',
      name: config.name || 'Ollama',
      type: 'ollama',
      enabled: config.enabled ?? true,
      priority: config.priority ?? 20,
      maxTokens: config.maxTokens ?? 4096,
      costPerMillionTokens: config.costPerMillionTokens ?? 0, // Free
      latency: config.latency ?? 2000,
      availability: config.availability ?? 0.9,
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model || 'llama2',
      config: config.config || {},
    };

    return new OllamaProvider(fullConfig);
  }

  /**
   * Create a default set of providers
   */
  static createDefaultProviders(): Provider[] {
    const providers: Provider[] = [];

    // Try to create OpenAI provider if API key is available
    if (process.env.OPENAI_API_KEY) {
      providers.push(this.createOpenAI());
    }

    // Try to create Anthropic provider if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push(this.createAnthropic());
    }

    // Always try to add Ollama (local)
    try {
      providers.push(this.createOllama());
    } catch {
      // Ollama might not be available
    }

    return providers;
  }
}
