/**
 * Cascade Router - Core Router Engine
 *
 * Intelligent LLM routing with cost optimization, rate limiting, and fallback
 */

import type {
  Provider,
  ChatRequest,
  ChatResponse,
  RoutingConfig,
  RoutingResult,
  RoutingDecision,
  RoutingAttempt,
  RouterMetrics,
  RouterStatus,
} from '../types.js';
import {
  RouterError,
  BudgetExceededError,
  RateLimitError,
} from '../types.js';
import {
  TokenLimiter,
} from './limiter.js';
import { ProgressMonitor } from './monitor.js';

// ============================================================================
// ROUTING ENGINE
// ============================================================================

export class Router {
  private providers: Map<string, Provider> = new Map();
  private config: RoutingConfig;
  private limiter: TokenLimiter;
  private monitor: ProgressMonitor;
  private metrics: RouterMetrics;
  private initialized: boolean = false;

  constructor(config: RoutingConfig) {
    this.config = config;
    this.limiter = new TokenLimiter(
      config.budgetLimits,
      config.rateLimits
    );
    this.monitor = new ProgressMonitor(config.progressCheckpoints || []);
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Register a provider
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.id, provider);
    this.metrics.providerMetrics.set(provider.id, this.createEmptyProviderMetrics(provider.id));
  }

  /**
   * Initialize router (check provider availability)
   */
  async initialize(): Promise<void> {
    const availabilityChecks = Array.from(this.providers.values()).map(
      async (provider) => {
        const available = await provider.isAvailable();
        return { id: provider.id, available };
      }
    );

    const results = await Promise.all(availabilityChecks);

    for (const result of results) {
      if (!result.available) {
        console.warn(`Provider ${result.id} is not available`);
      }
    }

    this.initialized = true;
  }

  /**
   * Route a request to the best provider
   */
  async route(request: ChatRequest): Promise<RoutingResult> {
    if (!this.initialized) {
      throw new Error('Router not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const attempts: RoutingAttempt[] = [];
    let finalResponse: ChatResponse | null = null;
    let routingDecision: RoutingDecision | null = null;
    let totalCost = 0;

    // Check budget limits before routing
    const budgetCheck = this.limiter.checkBudget(request);
    if (!budgetCheck.allowed) {
      throw new BudgetExceededError(
        budgetCheck.reason || 'Budget exceeded',
        budgetCheck.budgetType || 'daily',
        budgetCheck.usage,
        budgetCheck.limit
      );
    }

    // Check rate limits
    const rateLimitCheck = this.limiter.checkRateLimits();
    if (!rateLimitCheck.allowed) {
      throw new RateLimitError(
        rateLimitCheck.reason || 'Rate limit exceeded',
        rateLimitCheck.provider || 'unknown',
        rateLimitCheck.retryAfter
      );
    }

    // Select provider based on strategy
    const selectedProviders = this.selectProviders(request);

    // Try each provider in order
    for (const providerId of selectedProviders) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      const attemptStart = Date.now();

      try {
        // Start progress monitoring
        this.monitor.start(providerId);

        // Execute the request
        const response = await this.executeWithMonitoring(
          provider,
          request
        );

        // Update metrics
        const duration = Date.now() - attemptStart;
        attempts.push({
          provider: providerId,
          success: true,
          duration,
        });

        this.updateMetrics(providerId, response, duration);
        this.limiter.recordUsage(response.tokens);

        finalResponse = response;
        totalCost = response.cost;
        // Fallback was triggered if we had previous failed attempts
        const fallbackTriggered = attempts.length > 0;
        routingDecision = this.createRoutingDecision(
          providerId,
          selectedProviders,
          fallbackTriggered
        );

        break; // Success, stop trying
      } catch (error) {
        const duration = Date.now() - attemptStart;
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';

        attempts.push({
          provider: providerId,
          success: false,
          duration,
          error: errorMsg,
        });

        this.updateFailureMetrics(providerId, duration);

        // If fallback is disabled, throw immediately
        if (!this.config.fallbackEnabled) {
          throw error;
        }

        // Otherwise, try next provider
        continue;
      } finally {
        this.monitor.end(providerId);
      }
    }

    // If all providers failed
    if (!finalResponse || !routingDecision) {
      throw new RouterError(
        'All providers failed',
        'ALL_PROVIDERS_FAILED',
        { attempts }
      );
    }

    const totalDuration = Date.now() - startTime;

    return {
      provider: routingDecision.selectedProvider,
      response: finalResponse,
      routingDecision,
      attempts,
      totalCost,
      totalDuration,
    };
  }

  /**
   * Route a streaming request
   */
  async routeStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<RoutingResult> {
    if (!this.initialized) {
      throw new Error('Router not initialized. Call initialize() first.');
    }

    // Similar to route() but uses chatStream
    const startTime = Date.now();
    const attempts: RoutingAttempt[] = [];
    const selectedProviders = this.selectProviders(request);

    for (const providerId of selectedProviders) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      const attemptStart = Date.now();

      try {
        const response = await provider.chatStream(request, onChunk);

        const duration = Date.now() - attemptStart;
        attempts.push({
          provider: providerId,
          success: true,
          duration,
        });

        this.updateMetrics(providerId, response, duration);
        this.limiter.recordUsage(response.tokens);

        return {
          provider: providerId,
          response,
          routingDecision: this.createRoutingDecision(
            providerId,
            selectedProviders,
            false
          ),
          attempts,
          totalCost: response.cost,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        const duration = Date.now() - attemptStart;
        attempts.push({
          provider: providerId,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (!this.config.fallbackEnabled) {
          throw error;
        }
      }
    }

    throw new RouterError(
      'All providers failed',
      'ALL_PROVIDERS_FAILED',
      { attempts }
    );
  }

  /**
   * Get router metrics
   */
  getMetrics(): RouterMetrics {
    return {
      ...this.metrics,
      providerMetrics: new Map(this.metrics.providerMetrics),
    };
  }

  /**
   * Get router status
   */
  async getStatus(): Promise<RouterStatus> {
    const providerStatusChecks = Array.from(this.providers.entries()).map(
      async ([id, provider]) => {
        const available = await provider.isAvailable();
        return { id, available };
      }
    );

    const statusResults = await Promise.all(providerStatusChecks);

    const availableProviders: string[] = [];
    const unavailableProviders: string[] = [];

    for (const result of statusResults) {
      if (result.available) {
        availableProviders.push(result.id);
      } else {
        unavailableProviders.push(result.id);
      }
    }

    const budgetUsage = this.limiter.getBudgetUsage();

    return {
      healthy: availableProviders.length > 0,
      availableProviders,
      degradedProviders: [], // Could add based on latency/error rates
      unavailableProviders,
      currentBudget: budgetUsage,
      activeRateLimits: [], // Could add based on active rate limits
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics();
    for (const [id] of this.providers) {
      this.metrics.providerMetrics.set(id, this.createEmptyProviderMetrics(id));
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private selectProviders(request: ChatRequest): string[] {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.config.enabled)
      .map(([id, _]) => id);

    if (availableProviders.length === 0) {
      throw new RouterError('No available providers', 'NO_PROVIDERS');
    }

    switch (this.config.strategy) {
      case 'cost':
        return this.sortByCost(availableProviders);
      case 'speed':
        return this.sortBySpeed(availableProviders);
      case 'quality':
        return this.sortByQuality(availableProviders);
      case 'balanced':
        return this.sortByBalanced(availableProviders, request);
      case 'priority':
        return this.sortByPriority(availableProviders);
      case 'fallback':
        return this.sortByPriority(availableProviders); // Same as priority
      default:
        return this.sortByPriority(availableProviders);
    }
  }

  private sortByCost(providerIds: string[]): string[] {
    return providerIds.sort((a, b) => {
      const providerA = this.providers.get(a)!;
      const providerB = this.providers.get(b)!;
      return (
        providerA.config.costPerMillionTokens -
        providerB.config.costPerMillionTokens
      );
    });
  }

  private sortBySpeed(providerIds: string[]): string[] {
    return providerIds.sort((a, b) => {
      const providerA = this.providers.get(a)!;
      const providerB = this.providers.get(b)!;
      return providerA.config.latency - providerB.config.latency;
    });
  }

  private sortByQuality(providerIds: string[]): string[] {
    // Higher priority = higher quality
    return providerIds.sort((a, b) => {
      const providerA = this.providers.get(a)!;
      const providerB = this.providers.get(b)!;
      return providerA.config.priority - providerB.config.priority;
    });
  }

  private sortByBalanced(providerIds: string[], _request: ChatRequest): string[] {
    // Score providers based on cost, speed, and quality
    const scores = providerIds.map((id) => {
      const provider = this.providers.get(id)!;
      const config = provider.config;

      // Normalize scores (0-1)
      const costScore = 1 - config.costPerMillionTokens / 100; // Lower is better
      const speedScore = 1 - config.latency / 10000; // Lower is better
      const qualityScore = 1 - config.priority / 100; // Lower is better
      const availabilityScore = config.availability;

      // Weighted average (adjust weights as needed)
      const score =
        costScore * 0.4 +
        speedScore * 0.3 +
        qualityScore * 0.2 +
        availabilityScore * 0.1;

      return { id, score };
    });

    return scores.sort((a, b) => b.score - a.score).map((s) => s.id);
  }

  private sortByPriority(providerIds: string[]): string[] {
    return providerIds.sort((a, b) => {
      const providerA = this.providers.get(a)!;
      const providerB = this.providers.get(b)!;
      return providerA.config.priority - providerB.config.priority;
    });
  }

  private async executeWithMonitoring(
    provider: Provider,
    request: ChatRequest
  ): Promise<ChatResponse> {
    return this.monitor.track(provider.id, async () => {
      return provider.chat(request);
    });
  }

  private createRoutingDecision(
    selectedProvider: string,
    allProviders: string[],
    fallbackTriggered: boolean
  ): RoutingDecision {
    return {
      selectedProvider,
      strategy: this.config.strategy,
      reasoning: this.getRoutingReason(selectedProvider),
      alternatives: allProviders.filter((p) => p !== selectedProvider),
      fallbackTriggered,
    };
  }

  private getRoutingReason(providerId: string): string {
    const provider = this.providers.get(providerId);
    if (!provider) return 'Unknown';

    const strategy = this.config.strategy;
    const config = provider.config;

    switch (strategy) {
      case 'cost':
        return `Selected for lowest cost ($${config.costPerMillionTokens}/M tokens)`;
      case 'speed':
        return `Selected for lowest latency (${config.latency}ms)`;
      case 'quality':
        return `Selected for highest quality (priority: ${config.priority})`;
      case 'balanced':
        return `Selected for balanced performance`;
      case 'priority':
      case 'fallback':
        return `Selected based on priority order (${config.priority})`;
      default:
        return 'Selected by routing strategy';
    }
  }

  private updateMetrics(
    providerId: string,
    response: ChatResponse,
    duration: number
  ): void {
    const providerMetrics = this.metrics.providerMetrics.get(providerId);
    if (!providerMetrics) return;

    providerMetrics.requestCount++;
    providerMetrics.successCount++;
    providerMetrics.totalTokens += response.tokens.total;
    providerMetrics.totalCost += response.cost;
    providerMetrics.lastUsed = Date.now();

    // Update average latency
    const totalLatency =
      providerMetrics.avgLatency * (providerMetrics.requestCount - 1) +
      duration;
    providerMetrics.avgLatency = totalLatency / providerMetrics.requestCount;

    // Update totals
    this.metrics.totalRequests++;
    this.metrics.totalCost += response.cost;
    this.metrics.totalTokens += response.tokens.total;
  }

  private updateFailureMetrics(providerId: string, _duration: number): void {
    const providerMetrics = this.metrics.providerMetrics.get(providerId);
    if (!providerMetrics) return;

    providerMetrics.requestCount++;
    providerMetrics.failureCount++;
  }

  private createEmptyMetrics(): RouterMetrics {
    return {
      totalRequests: 0,
      totalCost: 0,
      totalTokens: 0,
      providerMetrics: new Map(),
      budgetUsage: {
        dailyTokens: 0,
        dailyCost: 0,
        monthlyTokens: 0,
        monthlyCost: 0,
        dailyPercentage: 0,
        monthlyPercentage: 0,
      },
      rateLimitHits: 0,
      fallbackCount: 0,
    };
  }

  private createEmptyProviderMetrics(providerId: string) {
    return {
      providerId,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatency: 0,
      lastUsed: 0,
    };
  }
}
