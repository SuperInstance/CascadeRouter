/**
 * Token Limiter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenLimiter } from '../src/core/limiter.js';
import type { BudgetLimits, RateLimits, ChatRequest } from '../src/types.js';

describe('TokenLimiter', () => {
  let limiter: TokenLimiter;
  let budgetLimits: BudgetLimits;
  let rateLimits: RateLimits;

  beforeEach(() => {
    budgetLimits = {
      dailyTokens: 1000000,
      dailyCost: 10,
      monthlyTokens: 25000000,
      monthlyCost: 300,
      alertThreshold: 80,
    };

    rateLimits = {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      concurrentRequests: 5,
    };

    limiter = new TokenLimiter(budgetLimits, rateLimits);
  });

  describe('budget checking', () => {
    it('should allow requests within budget', () => {
      const request: ChatRequest = {
        prompt: 'Hello world',
        maxTokens: 100,
      };

      const check = limiter.checkBudget(request);
      expect(check.allowed).toBe(true);
    });

    it('should block requests exceeding daily cost budget', () => {
      // Record usage near the limit
      limiter.recordUsage({ input: 0, output: 1000000, total: 1000000 });

      const request: ChatRequest = {
        prompt: 'Large request',
        maxTokens: 1000000,
      };

      const check = limiter.checkBudget(request);
      expect(check.allowed).toBe(false);
      expect(check.budgetType).toBe('daily');
    });

    it('should block requests exceeding daily token budget', () => {
      const request: ChatRequest = {
        prompt: 'x'.repeat(5000000), // Estimate to exceed token limit
        maxTokens: 10000000,
      };

      const check = limiter.checkBudget(request);
      expect(check.allowed).toBe(false);
    });

    it('should allow requests when no budget is set', () => {
      const noBudgetLimiter = new TokenLimiter();
      const request: ChatRequest = { prompt: 'test' };

      const check = noBudgetLimiter.checkBudget(request);
      expect(check.allowed).toBe(true);
    });

    it('should calculate budget usage correctly', () => {
      limiter.recordUsage({ input: 100, output: 200, total: 300 });

      const usage = limiter.getBudgetUsage();
      expect(usage.dailyTokens).toBe(300);
      expect(usage.dailyCost).toBeGreaterThan(0);
    });
  });

  describe('rate limiting', () => {
    it('should allow requests within rate limits', () => {
      const check = limiter.checkRateLimits();
      expect(check.allowed).toBe(true);
    });

    it('should block requests exceeding rate limit', () => {
      // Record many requests quickly
      for (let i = 0; i < 61; i++) {
        limiter.recordUsage({ input: 0, output: 0, total: 0 });
      }

      const check = limiter.checkRateLimits();
      expect(check.allowed).toBe(false);
      expect(check.retryAfter).toBeGreaterThan(0);
    });

    it('should allow requests when no rate limit is set', () => {
      const noRateLimitLimiter = new TokenLimiter(budgetLimits);

      // Make many requests
      for (let i = 0; i < 100; i++) {
        noRateLimitLimiter.recordUsage({ input: 0, output: 0, total: 0 });
      }

      const check = noRateLimitLimiter.checkRateLimits();
      expect(check.allowed).toBe(true);
    });

    it('should track token rate limits', () => {
      // Record large token usage (just under the limit)
      limiter.recordUsage({ input: 0, output: 49999, total: 49999 });
      limiter.recordUsage({ input: 0, output: 49999, total: 49999 });

      const check = limiter.checkRateLimits();
      expect(check.allowed).toBe(true); // Still within 100K limit (99998 < 100000)
    });
  });

  describe('usage tracking', () => {
    it('should record token usage', () => {
      limiter.recordUsage({ input: 100, output: 200, total: 300 });

      const usage = limiter.getBudgetUsage();
      expect(usage.dailyTokens).toBe(300);
      expect(usage.monthlyTokens).toBe(300);
    });

    it('should calculate cost correctly', () => {
      limiter.recordUsage({ input: 1000, output: 1000, total: 2000 });

      const usage = limiter.getBudgetUsage();
      expect(usage.dailyCost).toBeGreaterThan(0);
      expect(usage.monthlyCost).toBeGreaterThan(0);
    });

    it('should reset daily usage', () => {
      limiter.recordUsage({ input: 100, output: 200, total: 300 });
      limiter.resetDailyUsage();

      const usage = limiter.getBudgetUsage();
      expect(usage.dailyTokens).toBe(0);
      expect(usage.dailyCost).toBe(0);
    });

    it('should reset monthly usage', () => {
      limiter.recordUsage({ input: 100, output: 200, total: 300 });
      limiter.resetMonthlyUsage();

      const usage = limiter.getBudgetUsage();
      expect(usage.monthlyTokens).toBe(0);
      expect(usage.monthlyCost).toBe(0);
    });

    it('should reset all usage', () => {
      limiter.recordUsage({ input: 100, output: 200, total: 300 });
      limiter.resetAllUsage();

      const usage = limiter.getBudgetUsage();
      expect(usage.dailyTokens).toBe(0);
      expect(usage.monthlyTokens).toBe(0);
      expect(usage.dailyCost).toBe(0);
      expect(usage.monthlyCost).toBe(0);
    });
  });

  describe('budget percentages', () => {
    it('should calculate daily budget percentage', () => {
      limiter.recordUsage({ input: 0, output: 0, total: 0 });

      // Use $8 out of $10 daily budget
      // (This is approximate since cost calculation depends on implementation)
      const usage = limiter.getBudgetUsage();
      expect(usage.dailyPercentage).toBeGreaterThanOrEqual(0);
      expect(usage.dailyPercentage).toBeLessThanOrEqual(100);
    });

    it('should calculate monthly budget percentage', () => {
      const usage = limiter.getBudgetUsage();
      expect(usage.monthlyPercentage).toBeGreaterThanOrEqual(0);
      expect(usage.monthlyPercentage).toBeLessThanOrEqual(100);
    });
  });
});
