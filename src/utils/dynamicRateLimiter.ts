/**
 * Dynamic Rate Limiter with Fair Sharing
 * Automatically adjusts delays based on number of active jobs
 *
 * Formula:
 *   effectiveRPS = (maxRPS × usagePercent / 100) / activeJobs
 *   delayMs = 1000 / effectiveRPS
 */

// Global counter for active jobs (shared across all rate limiter instances)
let globalActiveJobs = 0;

export interface DynamicRateLimiterConfig {
  maxRPS: number;           // Max RPS from API provider (e.g., 100 for BirdEye Business)
  usagePercent: number;     // Target usage percentage (80 = 80%)
  minDelay?: number;        // Minimum delay in ms (default: 1)
  maxDelay?: number;        // Maximum delay in ms (default: 5000)
}

interface QueuedTask<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
}

export class DynamicRateLimiter {
  private readonly queue: QueuedTask<any>[] = [];
  private readonly maxRPS: number;
  private readonly usagePercent: number;
  private readonly minDelay: number;
  private readonly maxDelay: number;
  private isProcessing = false;

  constructor(config: DynamicRateLimiterConfig) {
    this.maxRPS = config.maxRPS;
    this.usagePercent = config.usagePercent;
    this.minDelay = config.minDelay || 1;
    this.maxDelay = config.maxDelay || 5000;
  }

  /**
   * Schedule a task with dynamic rate limiting
   */
  async schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        timestamp: Date.now()
      });
      this.processQueue();
    });
  }

  /**
   * Process queue sequentially with dynamic delays
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Increment global counter when starting to process
    globalActiveJobs++;

    try {
      while (this.queue.length > 0) {
        // Process one request at a time
        const { task, resolve, reject } = this.queue.shift()!;

        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }

        // Wait before next request with dynamic delay
        if (this.queue.length > 0) {
          const delay = this.calculateDynamicDelay();
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } finally {
      // Decrement global counter when done processing
      globalActiveJobs = Math.max(0, globalActiveJobs - 1);
      this.isProcessing = false;
    }
  }

  /**
   * Calculate dynamic delay based on active jobs
   *
   * Formula:
   *   effectiveRPS = (maxRPS × usagePercent / 100) / activeJobs
   *   delay = 1000 / effectiveRPS = (1000 × activeJobs) / (maxRPS × usagePercent / 100)
   */
  private calculateDynamicDelay(): number {
    const activeJobs = Math.max(1, globalActiveJobs); // Minimum 1
    const effectiveRPS = (this.maxRPS * this.usagePercent / 100);
    const rpsPerJob = effectiveRPS / activeJobs;
    const delay = 1000 / rpsPerJob;

    // Clamp between min and max
    return Math.max(this.minDelay, Math.min(delay, this.maxDelay));
  }

  /**
   * Get current statistics
   */
  getStats() {
    const activeJobs = Math.max(1, globalActiveJobs);
    const effectiveRPS = (this.maxRPS * this.usagePercent / 100);
    const rpsPerJob = effectiveRPS / activeJobs;
    const currentDelay = this.calculateDynamicDelay();

    return {
      queueLength: this.queue.length,
      activeJobs,
      maxRPS: this.maxRPS,
      usagePercent: this.usagePercent,
      effectiveRPS,
      rpsPerJob: rpsPerJob.toFixed(2),
      currentDelay: Math.round(currentDelay),
    };
  }

  /**
   * Calculate recommended timeout for a batch
   *
   * Formula:
   *   batchTime = (tokensPerBatch × callsPerToken) / rpsPerJob + overhead
   *   timeout = batchTime × safetyFactor
   *
   * @param tokensPerBatch - Number of tokens to process
   * @param callsPerToken - Number of API calls per token (default: 2)
   * @param overhead - Fixed overhead in seconds (default: 0.5)
   * @param safetyFactor - Safety margin multiplier (default: 2)
   */
  calculateRecommendedTimeout(
    tokensPerBatch: number = 50,
    callsPerToken: number = 2,
    overhead: number = 0.5,
    safetyFactor: number = 2
  ): number {
    const activeJobs = Math.max(1, globalActiveJobs);
    const effectiveRPS = (this.maxRPS * this.usagePercent / 100);
    const rpsPerJob = effectiveRPS / activeJobs;

    const totalCalls = tokensPerBatch * callsPerToken;
    const batchTime = (totalCalls / rpsPerJob) + overhead;
    const timeout = batchTime * safetyFactor;

    // Return in milliseconds, minimum 1 second
    return Math.max(1000, Math.round(timeout * 1000));
  }

  /**
   * Calculate optimal batch size based on active jobs and global rate limits
   *
   * Strategy:
   *   - Keep batches SHORT (fewer tokens)
   *   - But allow LONGER timeouts (proportional to load)
   *   - Target: ~60 seconds max per batch, regardless of load
   *   - This ensures regular progress updates even with 200+ concurrent jobs
   *
   * Formula (based on BirdEye global limit):
   *   timePerBatch = (tokensPerBatch × callsPerToken) / rpsPerJob
   *   timePerBatch = (tokensPerBatch × callsPerToken × activeJobs) / maxRPS
   *
   *   Target: timePerBatch <= 60s
   *   tokensPerBatch <= (60 × maxRPS) / (callsPerToken × activeJobs)
   *   tokensPerBatch <= (60 × 40) / (2 × activeJobs) = 1200 / activeJobs
   *
   * Examples:
   *   - 1 job:   1200 tokens → capped at 50 (max) → 2.5s per batch
   *   - 10 jobs: 120 tokens → capped at 50 (max) → 25s per batch
   *   - 30 jobs: 40 tokens → 60s per batch
   *   - 100 jobs: 12 tokens → 60s per batch
   *   - 200 jobs: 6 tokens → 60s per batch
   *
   * @param targetBatchTime - Target max time per batch in seconds (default: 60)
   * @param callsPerToken - API calls per token (default: 2)
   * @returns Optimal batch size (clamped between 5 and 50)
   */
  calculateOptimalBatchSize(
    targetBatchTime: number = 60,
    callsPerToken: number = 2
  ): number {
    const activeJobs = Math.max(1, globalActiveJobs);
    const effectiveRPS = (this.maxRPS * this.usagePercent / 100);

    // Calculate batch size that keeps batch time under target
    // Formula: batchSize = (targetTime × effectiveRPS) / (callsPerToken × activeJobs)
    const optimalTokens = Math.floor((targetBatchTime * effectiveRPS) / (callsPerToken * activeJobs));

    // Clamp between 5 and 50 for practical reasons
    // Minimum 5 to ensure some progress even with 500+ concurrent jobs
    // Maximum 50 to keep batches manageable
    return Math.max(5, Math.min(50, optimalTokens));
  }
}