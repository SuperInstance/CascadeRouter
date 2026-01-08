/**
 * Cascade Router - Token Budget & Rate Limiter
 *
 * Manages token budgets and rate limits for cost optimization
 */

import type {
  BudgetLimits,
  RateLimits,
  ChatRequest,
} from '../types.js';

// ============================================================================
// LIMIT CHECK RESULTS
// ============================================================================

export interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  budgetType?: 'daily' | 'monthly';
  usage: number;
  limit: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  reason?: string;
  provider?: string;
  retryAfter?: number;
}

export interface BudgetUsage {
  dailyTokens: number;
  dailyCost: number;
  monthlyTokens: number;
  monthlyCost: number;
  dailyPercentage: number;
  monthlyPercentage: number;
}

export interface UsageRecord {
  tokens: number;
  cost: number;
  timestamp: number;
}

// ============================================================================
// TOKEN LIMITER
// ============================================================================

export class TokenLimiter {
  private budgetLimits?: BudgetLimits;
  private rateLimits?: RateLimits;
  private dailyUsage: UsageRecord[] = [];
  private monthlyUsage: UsageRecord[] = [];
  private requestHistory: number[] = []; // Timestamps of recent requests
  private tokenUsageHistory: Array<{ timestamp: number; tokens: number }> = [];

  constructor(budgetLimits?: BudgetLimits, rateLimits?: RateLimits) {
    this.budgetLimits = budgetLimits;
    this.rateLimits = rateLimits;
  }

  /**
   * Check if a request is allowed based on budget limits
   */
  checkBudget(request: ChatRequest): BudgetCheck {
    if (!this.budgetLimits) {
      return { allowed: true, usage: 0, limit: 0 };
    }

    // Estimate tokens for this request
    const estimatedTokens = this.estimateRequestTokens(request);
    const estimatedCost = this.estimateCost(estimatedTokens, request);

    // Check daily limits
    const dailyUsage = this.calculateDailyUsage();
    const dailyTokensAfter = dailyUsage.tokens + estimatedTokens;
    const dailyCostAfter = dailyUsage.cost + estimatedCost;

    if (this.budgetLimits.dailyTokens > 0) {
      if (dailyTokensAfter > this.budgetLimits.dailyTokens) {
        return {
          allowed: false,
          reason: `Daily token limit would be exceeded (${dailyTokensAfter} > ${this.budgetLimits.dailyTokens})`,
          budgetType: 'daily',
          usage: dailyTokensAfter,
          limit: this.budgetLimits.dailyTokens,
        };
      }
    }

    if (this.budgetLimits.dailyCost > 0) {
      if (dailyCostAfter > this.budgetLimits.dailyCost) {
        return {
          allowed: false,
          reason: `Daily cost limit would be exceeded ($${dailyCostAfter.toFixed(2)} > $${this.budgetLimits.dailyCost})`,
          budgetType: 'daily',
          usage: dailyCostAfter,
          limit: this.budgetLimits.dailyCost,
        };
      }
    }

    // Check monthly limits
    const monthlyUsage = this.calculateMonthlyUsage();
    const monthlyTokensAfter = monthlyUsage.tokens + estimatedTokens;
    const monthlyCostAfter = monthlyUsage.cost + estimatedCost;

    if (this.budgetLimits.monthlyTokens > 0) {
      if (monthlyTokensAfter > this.budgetLimits.monthlyTokens) {
        return {
          allowed: false,
          reason: `Monthly token limit would be exceeded (${monthlyTokensAfter} > ${this.budgetLimits.monthlyTokens})`,
          budgetType: 'monthly',
          usage: monthlyTokensAfter,
          limit: this.budgetLimits.monthlyTokens,
        };
      }
    }

    if (this.budgetLimits.monthlyCost > 0) {
      if (monthlyCostAfter > this.budgetLimits.monthlyCost) {
        return {
          allowed: false,
          reason: `Monthly cost limit would be exceeded ($${monthlyCostAfter.toFixed(2)} > $${this.budgetLimits.monthlyCost})`,
          budgetType: 'monthly',
          usage: monthlyCostAfter,
          limit: this.budgetLimits.monthlyCost,
        };
      }
    }

    return { allowed: true, usage: dailyCostAfter, limit: this.budgetLimits.dailyCost };
  }

  /**
   * Check rate limits
   */
  checkRateLimits(): RateLimitCheck {
    if (!this.rateLimits) {
      return { allowed: true };
    }

    const now = Date.now();

    // Check requests per minute
    if (this.rateLimits.requestsPerMinute > 0) {
      const oneMinuteAgo = now - 60000;
      const recentRequests = this.requestHistory.filter(
        (timestamp) => timestamp > oneMinuteAgo
      );

      if (recentRequests.length >= this.rateLimits.requestsPerMinute) {
        // Calculate when oldest request will expire
        const oldestRequest = recentRequests[0];
        const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);

        return {
          allowed: false,
          reason: `Rate limit exceeded: ${recentRequests.length} requests in last minute`,
          retryAfter,
        };
      }
    }

    // Check tokens per minute
    if (this.rateLimits.tokensPerMinute > 0) {
      const oneMinuteAgo = now - 60000;
      const recentTokens = this.tokenUsageHistory
        .filter((record) => record.timestamp > oneMinuteAgo)
        .reduce((sum, record) => sum + record.tokens, 0);

      if (recentTokens >= this.rateLimits.tokensPerMinute) {
        return {
          allowed: false,
          reason: `Token rate limit exceeded: ${recentTokens} tokens in last minute`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record usage after a successful request
   */
  recordUsage(tokens: { input: number; output: number; total: number }): void {
    const now = Date.now();
    const cost = this.estimateCost(tokens.total);

    // Record the request timestamp
    this.requestHistory.push(now);

    // Record token usage
    this.tokenUsageHistory.push({
      timestamp: now,
      tokens: tokens.total,
    });

    // Record in daily usage
    this.dailyUsage.push({
      tokens: tokens.total,
      cost,
      timestamp: now,
    });

    // Record in monthly usage
    this.monthlyUsage.push({
      tokens: tokens.total,
      cost,
      timestamp: now,
    });

    // Clean up old records
    this.cleanupOldRecords();
  }

  /**
   * Get current budget usage
   */
  getBudgetUsage(): BudgetUsage {
    const daily = this.calculateDailyUsage();
    const monthly = this.calculateMonthlyUsage();

    return {
      dailyTokens: daily.tokens,
      dailyCost: daily.cost,
      monthlyTokens: monthly.tokens,
      monthlyCost: monthly.cost,
      dailyPercentage: this.budgetLimits
        ? (daily.cost / this.budgetLimits.dailyCost) * 100
        : 0,
      monthlyPercentage: this.budgetLimits
        ? (monthly.cost / this.budgetLimits.monthlyCost) * 100
        : 0,
    };
  }

  /**
   * Reset daily usage
   */
  resetDailyUsage(): void {
    this.dailyUsage = [];
  }

  /**
   * Reset monthly usage
   */
  resetMonthlyUsage(): void {
    this.monthlyUsage = [];
  }

  /**
   * Reset all usage
   */
  resetAllUsage(): void {
    this.dailyUsage = [];
    this.monthlyUsage = [];
    this.requestHistory = [];
    this.tokenUsageHistory = [];
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private estimateRequestTokens(request: ChatRequest): number {
    // Estimate tokens for prompt
    let totalTokens = this.estimateTextTokens(request.prompt);

    // Add tokens for messages
    if (request.messages) {
      for (const message of request.messages) {
        totalTokens += this.estimateTextTokens(message.content);
      }
    }

    // Add estimated output tokens
    if (request.maxTokens) {
      totalTokens += request.maxTokens;
    } else {
      // Default estimate
      totalTokens += 500;
    }

    return totalTokens;
  }

  private estimateTextTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private estimateCost(tokens: number, _request?: ChatRequest): number {
    // Default cost: $0.001 per 1K tokens (adjust based on provider)
    const costPerMillion = 1; // $1 per million tokens
    return (tokens / 1000000) * costPerMillion;
  }

  private calculateDailyUsage(): { tokens: number; cost: number } {
    const oneDayAgo = Date.now() - 86400000; // 24 hours

    const recentDaily = this.dailyUsage.filter(
      (record) => record.timestamp > oneDayAgo
    );

    return {
      tokens: recentDaily.reduce((sum, record) => sum + record.tokens, 0),
      cost: recentDaily.reduce((sum, record) => sum + record.cost, 0),
    };
  }

  private calculateMonthlyUsage(): { tokens: number; cost: number } {
    const oneMonthAgo = Date.now() - 2592000000; // 30 days

    const recentMonthly = this.monthlyUsage.filter(
      (record) => record.timestamp > oneMonthAgo
    );

    return {
      tokens: recentMonthly.reduce((sum, record) => sum + record.tokens, 0),
      cost: recentMonthly.reduce((sum, record) => sum + record.cost, 0),
    };
  }

  private cleanupOldRecords(): void {
    const oneDayAgo = Date.now() - 86400000;
    const oneMonthAgo = Date.now() - 2592000000;
    const oneMinuteAgo = Date.now() - 60000;

    // Clean daily usage
    this.dailyUsage = this.dailyUsage.filter(
      (record) => record.timestamp > oneDayAgo
    );

    // Clean monthly usage
    this.monthlyUsage = this.monthlyUsage.filter(
      (record) => record.timestamp > oneMonthAgo
    );

    // Clean request history
    this.requestHistory = this.requestHistory.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );

    // Clean token usage history
    this.tokenUsageHistory = this.tokenUsageHistory.filter(
      (record) => record.timestamp > oneMinuteAgo
    );
  }
}
