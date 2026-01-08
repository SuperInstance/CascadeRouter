/**
 * Cascade Router - Config Utilities
 */

import type { RouterConfig, ProviderConfig } from '../types.js';

/**
 * Load configuration from a file path
 */
export function loadConfig(configPath: string): RouterConfig {
  // TODO: Implement file loading from configPath
  // For now, return default config
  console.log(`Config path: ${configPath} (not yet implemented)`);
  return createDefaultConfig();
}

/**
 * Create default configuration
 */
export function createDefaultConfig(): RouterConfig {
  const providers: ProviderConfig[] = [];

  // Add OpenAI if API key is available
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      id: 'openai-default',
      name: 'OpenAI',
      type: 'openai',
      enabled: true,
      priority: 10,
      maxTokens: 128000,
      costPerMillionTokens: 0.15,
      latency: 500,
      availability: 0.99,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    });
  }

  // Add Anthropic if API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      id: 'anthropic-default',
      name: 'Anthropic',
      type: 'anthropic',
      enabled: true,
      priority: 5,
      maxTokens: 200000,
      costPerMillionTokens: 0.25,
      latency: 600,
      availability: 0.99,
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-haiku-20240307',
    });
  }

  // Add Ollama (local)
  providers.push({
    id: 'ollama-default',
    name: 'Ollama',
    type: 'ollama',
    enabled: true,
    priority: 20,
    maxTokens: 4096,
    costPerMillionTokens: 0,
    latency: 2000,
    availability: 0.9,
    baseUrl: 'http://localhost:11434',
    model: 'llama2',
  });

  return {
    routing: {
      strategy: 'balanced',
      providers,
      fallbackEnabled: true,
      maxRetries: 3,
      timeout: 60000,
      budgetLimits: {
        dailyTokens: 0,
        dailyCost: 10,
        monthlyTokens: 0,
        monthlyCost: 300,
        alertThreshold: 80,
      },
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000,
        concurrentRequests: 5,
      },
    },
    monitoring: {
      enabled: true,
      logLevel: 'info',
      metricsRetention: 7,
    },
    providers,
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: RouterConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.routing) {
    errors.push('Missing routing configuration');
  }

  if (!config.providers || config.providers.length === 0) {
    errors.push('No providers configured');
  }

  if (config.providers) {
    for (const provider of config.providers) {
      if (!provider.id) {
        errors.push('Provider missing id');
      }
      if (!provider.type) {
        errors.push('Provider missing type');
      }
      if (provider.type === 'openai' || provider.type === 'anthropic') {
        if (!provider.apiKey) {
          errors.push(`${provider.name} provider missing API key`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
