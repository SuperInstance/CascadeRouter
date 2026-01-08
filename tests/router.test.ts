/**
 * Router Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../src/core/router.js';
import type {
  Provider,
  ChatRequest,
  ChatResponse,
  ProviderConfig,
  RoutingConfig,
} from '../src/types.js';

// Mock provider for testing
class MockProvider implements Provider {
  id: string;
  config: ProviderConfig;

  constructor(
    id: string,
    config: ProviderConfig,
    private shouldFail: boolean = false,
    private latency: number = 100
  ) {
    this.id = id;
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail) {
      throw new Error('Provider failed');
    }

    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, this.latency));

    return {
      content: `Mock response from ${this.id}`,
      model: this.config.model || 'mock-model',
      provider: this.id,
      tokens: {
        input: 10,
        output: 20,
        total: 30,
      },
      cost: 0.001,
      duration: this.latency,
      finishReason: 'stop',
    };
  }

  async chatStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const response = await this.chat(request);
    onChunk(response.content);
    return response;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  getMaxTokens(): number {
    return this.config.maxTokens;
  }
}

describe('Router', () => {
  let router: Router;
  let mockProviders: Provider[];

  beforeEach(() => {
    // Create mock providers
    mockProviders = [
      new MockProvider(
        'provider-1',
        {
          id: 'provider-1',
          name: 'Provider 1',
          type: 'openai',
          enabled: true,
          priority: 10,
          maxTokens: 128000,
          costPerMillionTokens: 0.15,
          latency: 500,
          availability: 0.99,
        }
      ),
      new MockProvider(
        'provider-2',
        {
          id: 'provider-2',
          name: 'Provider 2',
          type: 'anthropic',
          enabled: true,
          priority: 20,
          maxTokens: 200000,
          costPerMillionTokens: 0.25,
          latency: 600,
          availability: 0.99,
        }
      ),
      new MockProvider(
        'provider-3',
        {
          id: 'provider-3',
          name: 'Provider 3',
          type: 'ollama',
          enabled: true,
          priority: 30,
          maxTokens: 4096,
          costPerMillionTokens: 0,
          latency: 2000,
          availability: 0.9,
        }
      ),
    ];

    const config: RoutingConfig = {
      strategy: 'balanced',
      providers: mockProviders.map((p) => p.config),
      fallbackEnabled: true,
      maxRetries: 3,
      timeout: 60000,
    };

    router = new Router(config);

    // Register providers
    for (const provider of mockProviders) {
      router.registerProvider(provider);
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(router.initialize()).resolves.not.toThrow();
    });

    it('should register providers', () => {
      const metrics = router.getMetrics();
      expect(metrics.providerMetrics.size).toBe(3);
    });

    it('should fail to route before initialization', async () => {
      await expect(
        router.route({ prompt: 'test' })
      ).rejects.toThrow('Router not initialized');
    });
  });

  describe('routing strategies', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    it('should route with cost strategy', async () => {
      (router as any).config.strategy = 'cost';
      const result = await router.route({ prompt: 'test' });
      expect(result.provider).toBe('provider-3'); // Cheapest (free)
    });

    it('should route with speed strategy', async () => {
      const fastProvider = new MockProvider(
        'fast',
        {
          id: 'fast',
          name: 'Fast',
          type: 'custom',
          enabled: true,
          priority: 10,
          maxTokens: 128000,
          costPerMillionTokens: 0.15,
          latency: 100, // Fastest
          availability: 0.99,
        },
        false,
        100
      );

      router.registerProvider(fastProvider);
      await router.initialize();

      (router as any).config.strategy = 'speed';
      const result = await router.route({ prompt: 'test' });
      expect(result.provider).toBe('fast');
    });

    it('should route with quality strategy', async () => {
      (router as any).config.strategy = 'quality';
      const result = await router.route({ prompt: 'test' });
      expect(result.provider).toBe('provider-1'); // Highest priority
    });

    it('should route with priority strategy', async () => {
      (router as any).config.strategy = 'priority';
      const result = await router.route({ prompt: 'test' });
      expect(result.provider).toBe('provider-1'); // Lowest priority number
    });

    it('should route with balanced strategy', async () => {
      (router as any).config.strategy = 'balanced';
      const result = await router.route({ prompt: 'test' });
      expect(result).toBeDefined();
      expect(result.provider).toBeTruthy();
    });
  });

  describe('fallback behavior', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    it('should fallback to next provider on failure', async () => {
      const failingProvider = new MockProvider(
        'failing',
        {
          id: 'failing',
          name: 'Failing',
          type: 'custom',
          enabled: true,
          priority: 1,
          maxTokens: 128000,
          costPerMillionTokens: 0.15,
          latency: 500,
          availability: 0.99,
        },
        true // Should fail
      );

      router.registerProvider(failingProvider);

      const result = await router.route({ prompt: 'test' });

      expect(result.attempts.length).toBeGreaterThan(1);
      expect(result.attempts[0].success).toBe(false);
      expect(result.routingDecision.fallbackTriggered).toBe(true);
    });

    it('should not fallback when disabled', async () => {
      (router as any).config.fallbackEnabled = false;

      const failingProvider = new MockProvider(
        'failing',
        {
          id: 'failing',
          name: 'Failing',
          type: 'custom',
          enabled: true,
          priority: 1,
          maxTokens: 128000,
          costPerMillionTokens: 0.15,
          latency: 500,
          availability: 0.99,
        },
        true // Should fail
      );

      router.registerProvider(failingProvider);

      await expect(router.route({ prompt: 'test' })).rejects.toThrow();
    });

    it('should fail when all providers fail', async () => {
      const allFailingRouter = new Router({
        strategy: 'priority',
        providers: [
          {
            id: 'failing-1',
            name: 'Failing 1',
            type: 'custom',
            enabled: true,
            priority: 10,
            maxTokens: 128000,
            costPerMillionTokens: 0.15,
            latency: 500,
            availability: 0.99,
          },
        ],
        fallbackEnabled: true,
        maxRetries: 3,
        timeout: 60000,
      });

      const failingProvider = new MockProvider(
        'failing-1',
        {
          id: 'failing-1',
          name: 'Failing 1',
          type: 'custom',
          enabled: true,
          priority: 10,
          maxTokens: 128000,
          costPerMillionTokens: 0.15,
          latency: 500,
          availability: 0.99,
        },
        true // Should fail
      );

      allFailingRouter.registerProvider(failingProvider);
      await allFailingRouter.initialize();

      await expect(
        allFailingRouter.route({ prompt: 'test' })
      ).rejects.toThrow('All providers failed');
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    it('should track request metrics', async () => {
      await router.route({ prompt: 'test' });

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalCost).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBe(30);
    });

    it('should track per-provider metrics', async () => {
      await router.route({ prompt: 'test' });

      const metrics = router.getMetrics();
      const providerMetrics = metrics.providerMetrics.get('provider-1');

      if (providerMetrics) {
        expect(providerMetrics.requestCount).toBeGreaterThanOrEqual(1);
        expect(providerMetrics.totalCost).toBeGreaterThan(0);
      }
    });

    it('should reset metrics', async () => {
      await router.route({ prompt: 'test' });
      router.resetMetrics();

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalCost).toBe(0);
    });
  });

  describe('streaming', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    it('should handle streaming requests', async () => {
      const onChunk = vi.fn();
      const result = await router.routeStream({ prompt: 'test' }, onChunk);

      expect(result).toBeDefined();
      expect(onChunk).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    beforeEach(async () => {
      await router.initialize();
    });

    it('should return router status', async () => {
      const status = await router.getStatus();

      expect(status.healthy).toBe(true);
      expect(status.availableProviders.length).toBeGreaterThan(0);
    });
  });
});
