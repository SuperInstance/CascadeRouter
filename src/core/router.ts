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

    // Handle speculative execution strategy
    if (this.config.strategy === 'speculative') {
      return this.routeWithSpeculativeExecution(request, selectedProviders);
    }

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
   * Route with speculative execution - race multiple providers
   */
  private async routeWithSpeculativeExecution(
    request: ChatRequest,
    availableProviders: string[]
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    const specConfig = this.config.speculativeConfig || {
      candidateCount: 2,
      candidateStrategy: 'speed',
      enableCostTracking: true,
      maxCostMultiplier: 150,
    };

    // Select candidates based on strategy
    const candidates = this.selectSpeculativeCandidates(
      availableProviders,
      specConfig.candidateStrategy,
      specConfig.candidateCount
    );

    if (candidates.length === 0) {
      throw new RouterError('No available providers for speculative execution', 'NO_PROVIDERS');
    }

    // Create AbortController for cancellation
    const abortController = new AbortController();
    const providers = candidates.map(id => this.providers.get(id)!);
    const promises: Array<{
      providerId: string;
      promise: Promise<ChatResponse>;
    }> = [];

    // Start all requests in parallel
    for (const provider of providers) {
      const promise = this.executeWithAbortControl(
        provider,
        request,
        abortController.signal
      );
      promises.push({ providerId: provider.id, promise });
    }

    const attempts: RoutingAttempt[] = [];
    let winner: { providerId: string; response: ChatResponse; duration: number } | null = null;
    let totalCost = 0;

    try {
      // Race all promises - we want the first SUCCESSFUL response
      const racePromises = promises.map(async (p) => {
        const attemptStart = Date.now();
        try {
          const response = await p.promise;
          const duration = Date.now() - attemptStart;
          return { providerId: p.providerId, response, duration, success: true };
        } catch (error) {
          const duration = Date.now() - attemptStart;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';

          // Don't record aborted requests as failures - they were cancelled by design
          if (!errorMsg.includes('aborted')) {
            attempts.push({
              provider: p.providerId,
              success: false,
              duration,
              error: errorMsg,
            });
          }

          // Re-throw so Promise.race can try the next one
          throw error;
        }
      });

      // Wait for first successful response
      // We use Promise.any instead of Promise.race because race fails on first error
      const result = await Promise.any(racePromises);

      winner = result;
      attempts.push({
        provider: result.providerId,
        success: true,
        duration: result.duration,
      });

      // Cancel other pending requests
      abortController.abort();

      totalCost = result.response.cost;
      this.updateMetrics(result.providerId, result.response, result.duration);
      this.limiter.recordUsage(result.response.tokens);

      // Update speculative execution metrics
      if (specConfig.enableCostTracking) {
        this.updateSpeculativeMetrics(
          candidates.length,
          result.duration,
          totalCost,
          specConfig.candidateStrategy
        );
      }
    } catch (error) {
      // All providers failed
      abortController.abort();

      // If we have no winner and all failed, throw error
      if (!winner) {
        throw new RouterError(
          'All providers failed in speculative execution',
          'ALL_PROVIDERS_FAILED',
          { attempts }
        );
      }
    }

    if (!winner) {
      throw new RouterError(
        'All providers failed in speculative execution',
        'ALL_PROVIDERS_FAILED',
        { attempts }
      );
    }

    const totalDuration = Date.now() - startTime;

    return {
      provider: winner.providerId,
      response: winner.response,
      routingDecision: this.createRoutingDecision(
        winner.providerId,
        candidates,
        false
      ),
      attempts,
      totalCost,
      totalDuration,
    };
  }

  /**
   * Execute request with abort control
   */
  private async executeWithAbortControl(
    provider: Provider,
    request: ChatRequest,
    signal: AbortSignal
  ): Promise<ChatResponse> {
    // Check if already aborted
    if (signal.aborted) {
      throw new Error('Request aborted');
    }

    // Wrap the provider's chat method with abort signal checking
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (signal.aborted) {
          reject(new Error('Request aborted'));
        }
      }, 100); // Check every 100ms

      provider.chat(request)
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));

      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Request aborted'));
      });
    });
  }

  /**
   * Select candidates for speculative execution
   */
  private selectSpeculativeCandidates(
    providers: string[],
    strategy: 'speed' | 'quality' | 'balanced',
    count: number
  ): string[] {
    let sorted: string[];

    switch (strategy) {
      case 'speed':
        sorted = this.sortBySpeed([...providers]);
        break;
      case 'quality':
        sorted = this.sortByQuality([...providers]);
        break;
      case 'balanced':
        sorted = this.sortByBalanced([...providers], { prompt: '' } as ChatRequest);
        break;
    }

    return sorted.slice(0, Math.min(count, sorted.length));
  }

  /**
   * Update speculative execution metrics
   */
  private updateSpeculativeMetrics(
    candidatesRaced: number,
    duration: number,
    cost: number,
    _strategy: string
  ): void {
    if (!this.metrics.speculativeExecutionMetrics) {
      this.metrics.speculativeExecutionMetrics = {
        totalSpeculativeRequests: 0,
        totalAdditionalCost: 0,
        avgTimeSaved: 0,
        avgCostIncrease: 0,
        fasterThanSequentialCount: 0,
        avgCandidatesRaced: 0,
      };
    }

    const metrics = this.metrics.speculativeExecutionMetrics;
    metrics.totalSpeculativeRequests++;

    // Estimate time saved (assuming second fastest would have taken ~80% of first's time)
    const estimatedSequentialTime = duration * 1.5;
    const timeSaved = estimatedSequentialTime - duration;
    metrics.avgTimeSaved =
      metrics.avgTimeSaved +
      (timeSaved - metrics.avgTimeSaved) / metrics.totalSpeculativeRequests;

    // Estimate additional cost (each additional candidate costs similar amount)
    const additionalCost = cost * (candidatesRaced - 1);
    metrics.totalAdditionalCost += additionalCost;
    metrics.avgCostIncrease =
      metrics.avgCostIncrease +
      (additionalCost - metrics.avgCostIncrease) / metrics.totalSpeculativeRequests;

    // Update average candidates raced
    metrics.avgCandidatesRaced =
      metrics.avgCandidatesRaced +
      (candidatesRaced - metrics.avgCandidatesRaced) / metrics.totalSpeculativeRequests;

    // Assume speculative is faster (in reality, we'd measure this)
    metrics.fasterThanSequentialCount++;
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
      case 'speculative':
        // For speculative, we'll handle it separately
        return availableProviders;
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
      case 'speculative':
        return `Selected as fastest response in speculative execution (latency: ${config.latency}ms)`;
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

    // Performance: Use incremental average calculation to avoid large number accumulation
    // New average = old average + (new value - old average) / count
    providerMetrics.avgLatency =
      providerMetrics.avgLatency +
      (duration - providerMetrics.avgLatency) / providerMetrics.requestCount;

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
