/**
 * Cascade Router - Progress Monitor
 *
 * Tracks progress of requests with periodic check-ins and updates
 */

import type { ProgressCheckpoint, ProgressUpdate } from '../types.js';

export interface CheckpointConfig {
  tokenInterval: number;
  timeInterval: number;
  callback: (progress: ProgressUpdate) => void;
}

interface ActiveTracking {
  provider: string;
  startTime: number;
  startTokens: number;
  lastCheckpointTime: number;
  lastCheckpointTokens: number;
  callback?: (progress: ProgressUpdate) => void;
}

// ============================================================================
// PROGRESS MONITOR
// ============================================================================

export class ProgressMonitor {
  private checkpoints: Map<string, CheckpointConfig> = new Map();
  private activeTracking: Map<string, ActiveTracking> = new Map();
  private totalTokensUsed: number = 0;
  private totalCostIncurred: number = 0;

  constructor(checkpoints: ProgressCheckpoint[] = []) {
    // Register checkpoints
    for (let i = 0; i < checkpoints.length; i++) {
      const checkpoint = checkpoints[i];
      this.checkpoints.set(`checkpoint-${i}`, {
        tokenInterval: checkpoint.tokenInterval,
        timeInterval: checkpoint.timeInterval,
        callback: checkpoint.callback,
      });
    }
  }

  /**
   * Start tracking a request
   */
  start(providerId: string, callback?: (progress: ProgressUpdate) => void): void {
    this.activeTracking.set(providerId, {
      provider: providerId,
      startTime: Date.now(),
      startTokens: this.totalTokensUsed,
      lastCheckpointTime: Date.now(),
      lastCheckpointTokens: this.totalTokensUsed,
      callback,
    });
  }

  /**
   * End tracking a request
   */
  end(providerId: string): void {
    const tracking = this.activeTracking.get(providerId);
    if (!tracking) return;

    // Send final progress update
    const duration = Date.now() - tracking.startTime;
    const tokensUsed = this.totalTokensUsed - tracking.startTokens;

    if (tracking.callback) {
      tracking.callback({
        provider: providerId,
        tokensUsed,
        costIncurred: this.totalCostIncurred,
        duration,
        percentage: 100,
        status: 'complete',
      });
    }

    this.activeTracking.delete(providerId);
  }

  /**
   * Track an operation with automatic progress updates
   */
  async track<T>(
    providerId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const tracking = this.activeTracking.get(providerId);
      if (!tracking) {
        // No tracking, just run the operation
        operation().then(resolve).catch(reject);
        return;
      }

      // Set up interval for progress updates
      const interval = setInterval(() => {
        this.checkProgress(providerId);
      }, 1000); // Check every second

      operation()
        .then((result) => {
          clearInterval(interval);
          resolve(result);
        })
        .catch((error) => {
          clearInterval(interval);

          // Send error update
          if (tracking.callback) {
            const duration = Date.now() - tracking.startTime;
            const tokensUsed = this.totalTokensUsed - tracking.startTokens;

            tracking.callback({
              provider: providerId,
              tokensUsed,
              costIncurred: this.totalCostIncurred,
              duration,
              percentage: 0,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          reject(error);
        });
    });
  }

  /**
   * Manually update token usage
   */
  updateTokens(tokens: number, cost: number): void {
    this.totalTokensUsed += tokens;
    this.totalCostIncurred += cost;

    // Check all active tracking for progress updates
    for (const [providerId] of this.activeTracking) {
      this.checkProgress(providerId);
    }
  }

  /**
   * Get total statistics
   */
  getTotalStats(): {
    totalTokens: number;
    totalCost: number;
    activeRequests: number;
  } {
    return {
      totalTokens: this.totalTokensUsed,
      totalCost: this.totalCostIncurred,
      activeRequests: this.activeTracking.size,
    };
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.activeTracking.clear();
    this.totalTokensUsed = 0;
    this.totalCostIncurred = 0;
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private checkProgress(providerId: string): void {
    const tracking = this.activeTracking.get(providerId);
    if (!tracking || !tracking.callback) return;

    const now = Date.now();
    const duration = now - tracking.startTime;
    const tokensUsed = this.totalTokensUsed - tracking.startTokens;

    const timeSinceLastCheckpoint = now - tracking.lastCheckpointTime;
    const tokensSinceLastCheckpoint =
      this.totalTokensUsed - tracking.lastCheckpointTokens;

    let shouldNotify = false;

    // Check if we've hit any checkpoint intervals
    for (const [_, checkpoint] of this.checkpoints) {
      if (
        timeSinceLastCheckpoint >= checkpoint.timeInterval ||
        tokensSinceLastCheckpoint >= checkpoint.tokenInterval
      ) {
        shouldNotify = true;
        break;
      }
    }

    if (shouldNotify) {
      tracking.lastCheckpointTime = now;
      tracking.lastCheckpointTokens = this.totalTokensUsed;

      // Estimate percentage (rough estimate)
      // This could be improved with actual progress information from the provider
      const estimatedPercentage = Math.min(
        Math.round((tokensUsed / 1000) * 100),
        95
      );

      tracking.callback({
        provider: providerId,
        tokensUsed,
        costIncurred: this.totalCostIncurred,
        duration,
        percentage: estimatedPercentage,
        status: 'in-progress',
      });
    }
  }
}
