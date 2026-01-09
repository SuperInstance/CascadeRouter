/**
 * Tests for Speculative Execution Routing Strategy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '../src/core/router.js';
import type {
  Provider,
  ChatRequest,
  ChatResponse,
  ProviderConfig,
} from '../src/types.js';

// Mock provider implementation
class MockProvider implements Provider {
  id: string;
  config: ProviderConfig;
  private latency: number;
  private shouldFail: boolean = false;

  constructor(config: ProviderConfig, latency: number = 100) {
    this.id = config.id;
    this.config = config;
    this.latency = latency;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail) {
      throw new Error('Provider failed');
    }

    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, this.latency));

    return {
      content: `Response from ${this.id}`,
      model: this.config.model || 'mock-model',
      provider: this.id,
      tokens: {
        input: 10,
        output: 20,
        total: 30,
      },
      cost: this.config.costPerMillionTokens * 30 / 1000000,
      duration: this.latency,
      finishReason: 'stop',
    };
  }

  async chatStream(
    _request: ChatRequest,
    _onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    return this.chat(_request);
  }

  estimateTokens(text: string): number {
    return text.length / 4;
  }

  getMaxTokens(): number {
    return this.config.maxTokens;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  setLatency(latency: number): void {
    this.latency = latency;
  }
}

describe('Speculative Execution Routing', () => {
  let router: Router;
  let fastProvider: MockProvider;
  let slowProvider: MockProvider;
  let mediumProvider: MockProvider;

  beforeEach(() => {
    // Create providers with different latencies
    fastProvider = new MockProvider(
      {
        id: 'fast-provider',
        name: 'Fast Provider',
        type: 'custom',
        enabled: true,
        priority: 1,
        maxTokens: 4000,
        costPerMillionTokens: 10,
        latency: 50,
        availability: 0.95,
      },
      50
    );

    mediumProvider = new MockProvider(
      {
        id: 'medium-provider',
        name: 'Medium Provider',
        type: 'custom',
        enabled: true,
        priority: 2,
        maxTokens: 4000,
        costPerMillionTokens: 8,
        latency: 150,
        availability: 0.90,
      },
      150
    );

    slowProvider = new MockProvider(
      {
        id: 'slow-provider',
        name: 'Slow Provider',
        type: 'custom',
        enabled: true,
        priority: 3,
        maxTokens: 4000,
        costPerMillionTokens: 5,
        latency: 300,
        availability: 0.85,
      },
      300
    );

    router = new Router({
      strategy: 'speculative',
      providers: [
        fastProvider.config,
        mediumProvider.config,
        slowProvider.config,
      ],
      fallbackEnabled: true,
      maxRetries: 3,
      timeout: 10000,
      speculativeConfig: {
        candidateCount: 2,
        candidateStrategy: 'speed',
        enableCostTracking: true,
        maxCostMultiplier: 150,
      },
    });

    router.registerProvider(fastProvider);
    router.registerProvider(mediumProvider);
    router.registerProvider(slowProvider);
  });

  describe('Basic Speculative Execution', () => {
    it('should select fastest provider in race', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      expect(result.provider).toBe('fast-provider');
      expect(result.response.content).toBe('Response from fast-provider');
      expect(result.attempts).toHaveLength(1); // Only winner counted
      expect(result.attempts[0].success).toBe(true);
    });

    it('should race multiple providers simultaneously', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const startTime = Date.now();
      const result = await router.route(request);
      const duration = Date.now() - startTime;

      // Should complete in roughly the time of the fastest provider
      expect(duration).toBeLessThan(150); // Fast provider takes 50ms, buffer for overhead
      expect(result.provider).toBe('fast-provider');
    });

    it('should cancel slower providers when fast one wins', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      // Fast provider should win
      expect(result.provider).toBe('fast-provider');

      // Only the winning attempt should be recorded
      expect(result.attempts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Candidate Selection', () => {
    it('should select candidates based on speed strategy', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      // Should select fastest providers
      expect(result.provider).toBe('fast-provider');
    });

    it('should respect candidateCount limit', async () => {
      // Create router with 3 providers but only race 2
      const limitedRouter = new Router({
        strategy: 'speculative',
        providers: [
          fastProvider.config,
          mediumProvider.config,
          slowProvider.config,
        ],
        fallbackEnabled: true,
        maxRetries: 3,
        timeout: 10000,
        speculativeConfig: {
          candidateCount: 2,
          candidateStrategy: 'speed',
          enableCostTracking: true,
          maxCostMultiplier: 150,
        },
      });

      limitedRouter.registerProvider(fastProvider);
      limitedRouter.registerProvider(mediumProvider);
      limitedRouter.registerProvider(slowProvider);

      await limitedRouter.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await limitedRouter.route(request);

      // Should still work fine
      expect(result.provider).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe('Fallback Handling', () => {
    it('should fallback if fastest provider fails', async () => {
      fastProvider.setShouldFail(true);

      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      // Should fallback to medium provider
      expect(result.provider).toBe('medium-provider');

      // Find the successful attempt
      const successfulAttempt = result.attempts.find(a => a.success);
      expect(successfulAttempt).toBeDefined();
      expect(successfulAttempt!.success).toBe(true);

      // Should have one failed attempt (fast provider)
      const failedAttempts = result.attempts.filter(a => !a.success);
      expect(failedAttempts.length).toBe(1);
      expect(failedAttempts[0].provider).toBe('fast-provider');
    });

    it('should handle all providers failing', async () => {
      fastProvider.setShouldFail(true);
      mediumProvider.setShouldFail(true);
      slowProvider.setShouldFail(true);

      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      await expect(router.route(request)).rejects.toThrow('All providers failed');
    });
  });

  describe('Metrics Tracking', () => {
    it('should track speculative execution metrics', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      await router.route(request);

      const metrics = router.getMetrics();

      expect(metrics.speculativeExecutionMetrics).toBeDefined();
      expect(metrics.speculativeExecutionMetrics!.totalSpeculativeRequests).toBe(1);
      expect(metrics.speculativeExecutionMetrics!.avgCandidatesRaced).toBe(2);
    });

    it('should track time saved', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      await router.route(request);

      const metrics = router.getMetrics();

      expect(metrics.speculativeExecutionMetrics!.avgTimeSaved).toBeGreaterThan(0);
    });

    it('should track cost increase', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      await router.route(request);

      const metrics = router.getMetrics();

      // Should track additional cost from racing multiple providers
      expect(metrics.speculativeExecutionMetrics!.totalAdditionalCost).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use default config when not provided', async () => {
      const defaultRouter = new Router({
        strategy: 'speculative',
        providers: [fastProvider.config, mediumProvider.config],
        fallbackEnabled: true,
        maxRetries: 3,
        timeout: 10000,
      });

      defaultRouter.registerProvider(fastProvider);
      defaultRouter.registerProvider(mediumProvider);

      await defaultRouter.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await defaultRouter.route(request);

      expect(result.provider).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('should respect different candidate strategies', async () => {
      const qualityRouter = new Router({
        strategy: 'speculative',
        providers: [
          fastProvider.config,
          mediumProvider.config,
          slowProvider.config,
        ],
        fallbackEnabled: true,
        maxRetries: 3,
        timeout: 10000,
        speculativeConfig: {
          candidateCount: 2,
          candidateStrategy: 'quality',
          enableCostTracking: true,
          maxCostMultiplier: 150,
        },
      });

      qualityRouter.registerProvider(fastProvider);
      qualityRouter.registerProvider(mediumProvider);
      qualityRouter.registerProvider(slowProvider);

      await qualityRouter.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await qualityRouter.route(request);

      // Should select based on quality (priority)
      expect(result.provider).toBeDefined();
    });
  });

  describe('Routing Decision', () => {
    it('should include speculative strategy in decision', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      expect(result.routingDecision.strategy).toBe('speculative');
      expect(result.routingDecision.reasoning).toContain('speculative execution');
      expect(result.routingDecision.fallbackTriggered).toBe(false);
    });

    it('should list alternative providers', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      // Should have alternatives (other providers that weren't selected)
      expect(result.routingDecision.alternatives).toBeDefined();
      expect(result.routingDecision.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle provider timeout gracefully', async () => {
      // Create a very slow provider
      const verySlowProvider = new MockProvider(
        {
          id: 'very-slow-provider',
          name: 'Very Slow Provider',
          type: 'custom',
          enabled: true,
          priority: 10,
          maxTokens: 4000,
          costPerMillionTokens: 1,
          latency: 5000,
          availability: 0.5,
        },
        5000
      );

      router.registerProvider(verySlowProvider);

      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      // Should still complete quickly with fast provider
      const startTime = Date.now();
      const result = await router.route(request);
      const duration = Date.now() - startTime;

      expect(result.provider).toBe('fast-provider');
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cost Tracking', () => {
    it('should track total cost including speculative overhead', async () => {
      await router.initialize();

      const request: ChatRequest = {
        prompt: 'Test prompt',
      };

      const result = await router.route(request);

      // Total cost should be more than just the winner's cost
      // because multiple providers were raced
      const metrics = router.getMetrics();
      expect(result.totalCost).toBeGreaterThan(0);
      expect(metrics.speculativeExecutionMetrics!.totalAdditionalCost).toBeGreaterThan(0);
    });
  });
});
