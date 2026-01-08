/**
 * Progress Monitor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressMonitor } from '../src/core/monitor.js';
import type { ProgressCheckpoint } from '../src/types.js';

describe('ProgressMonitor', () => {
  let monitor: ProgressMonitor;
  let checkpoints: ProgressCheckpoint[];

  beforeEach(() => {
    checkpoints = [
      {
        tokenInterval: 100,
        timeInterval: 1000,
        callback: vi.fn(),
      },
    ];

    monitor = new ProgressMonitor(checkpoints);
  });

  describe('tracking', () => {
    it('should start tracking a request', () => {
      monitor.start('provider-1');
      expect(monitor['activeTracking'].has('provider-1')).toBe(true);
    });

    it('should end tracking and send complete status', async () => {
      const callback = vi.fn();
      monitor.start('provider-1', callback);

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.end('provider-1');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'complete',
          percentage: 100,
        })
      );
    });

    it('should track async operations', async () => {
      const callback = vi.fn();
      monitor.start('provider-1', callback);

      const result = await monitor.track('provider-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      });

      expect(result).toBe('success');
      // Note: callback won't be called unless checkpoints are configured
      // The track method calls end() which triggers callback with status 'complete'
      monitor.end('provider-1');
      expect(callback).toHaveBeenCalled();
    });

    it('should handle errors in tracked operations', async () => {
      const callback = vi.fn();
      monitor.start('provider-1', callback);

      await expect(
        monitor.track('provider-1', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: 'Test error',
        })
      );
    });

    it('should handle tracking without callback', () => {
      monitor.start('provider-1');
      expect(() => monitor.end('provider-1')).not.toThrow();
    });
  });

  describe('token updates', () => {
    it('should track token usage', () => {
      monitor.updateTokens(100, 0.01);
      monitor.updateTokens(200, 0.02);

      const stats = monitor.getTotalStats();
      expect(stats.totalTokens).toBe(300);
      expect(stats.totalCost).toBe(0.03);
    });

    it('should trigger callbacks on token interval', async () => {
      const callback = vi.fn();
      const monitorWithCallback = new ProgressMonitor([
        {
          tokenInterval: 50,
          timeInterval: 10000,
          callback,
        },
      ]);

      monitorWithCallback.start('provider-1', callback);
      monitorWithCallback.updateTokens(100, 0.01);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should return total statistics', () => {
      monitor.updateTokens(1000, 0.1);
      monitor.start('provider-1');
      monitor.start('provider-2');

      const stats = monitor.getTotalStats();
      expect(stats.totalTokens).toBe(1000);
      expect(stats.totalCost).toBe(0.1);
      expect(stats.activeRequests).toBe(2);
    });

    it('should reset all tracking', () => {
      monitor.updateTokens(100, 0.01);
      monitor.start('provider-1');
      monitor.reset();

      const stats = monitor.getTotalStats();
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.activeRequests).toBe(0);
    });
  });

  describe('progress updates', () => {
    it('should send progress updates during tracking', async () => {
      const callback = vi.fn();
      monitor.start('provider-1', callback);

      // Update tokens multiple times
      for (let i = 0; i < 10; i++) {
        monitor.updateTokens(100, 0.01);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      monitor.end('provider-1');

      // Should have received multiple updates
      expect(callback.mock.calls.length).toBeGreaterThan(1);
    });

    it('should include correct progress information', async () => {
      const callback = vi.fn();
      monitor.start('provider-1', callback);

      monitor.updateTokens(500, 0.05);
      await new Promise((resolve) => setTimeout(resolve, 100));

      monitor.end('provider-1');

      const calls = callback.mock.calls;
      const lastCall = calls[calls.length - 1][0];

      expect(lastCall).toHaveProperty('provider', 'provider-1');
      expect(lastCall).toHaveProperty('tokensUsed');
      expect(lastCall).toHaveProperty('costIncurred');
      expect(lastCall).toHaveProperty('duration');
      expect(lastCall).toHaveProperty('percentage');
      expect(lastCall).toHaveProperty('status');
    });
  });
});
