/**
 * PostgreSQL-based Queue Manager
 *
 * Simple queue system using the existing wallet_analysis_jobs table.
 * No external dependencies (Redis, BullMQ, etc.) - just PostgreSQL.
 *
 * Features:
 * - Limits concurrent jobs based on MAX_CONCURRENT_JOBS config
 * - Jobs start as 'pending', move to 'processing' when slot available
 * - Automatically processes next pending job when a job completes
 * - DynamicRateLimiter handles API rate limiting across all jobs
 *
 * IMPORTANT: Database Connection Handling
 * ----------------------------------------
 * The 'db' instance must be obtained from the PostgreSQL connection manager's pool
 * (via manager.getDatabase()), NOT from runtime.db directly.
 *
 * Why? runtime.db can point to a closed client after operations complete because
 * adapter.withDatabase() temporarily replaces adapter.db with individual clients
 * that get released back to the pool. Since QueueManager runs continuously,
 * it needs a stable reference to the pool-connected Drizzle instance.
 */

import { eq, sql, count as drizzleCount } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { walletAnalysisJobs } from '../../schemas/wallet-analysis.js';
import { processAnalysisJobAsync } from '../workers/analysisWorker.js';
import type { BirdeyeService } from '../api/birdeyes.js';
import type { HeliusService } from '../api/helius.js';

export class QueueManagerService {
  private db: any;
  private birdeyeService: BirdeyeService;
  private heliusService: HeliusService;
  private maxConcurrentJobs: number;
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    db: any,
    birdeyeService: BirdeyeService,
    heliusService: HeliusService,
    maxConcurrentJobs: number = 15
  ) {
    this.db = db;
    this.birdeyeService = birdeyeService;
    this.heliusService = heliusService;
    this.maxConcurrentJobs = maxConcurrentJobs;
  }

  /**
   * Start the queue processor
   * Checks every 10 seconds for available slots and pending jobs
   */
  async start() {
    if (this.processingInterval) {
      logger.warn('[QueueManager] Already started');
      return;
    }

    logger.info(`[QueueManager] Starting with max ${this.maxConcurrentJobs} concurrent jobs`);

    // Verify database connection before starting queue processor
    try {
      const result = await this.db
        .select({ count: drizzleCount() })
        .from(walletAnalysisJobs)
        .where(eq(walletAnalysisJobs.status, 'processing'));

      const processingCount = result[0]?.count || 0;
      logger.info(`[QueueManager] Database connection verified (${processingCount} jobs currently processing)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[QueueManager] Database connection failed:', errorMessage);
      logger.info('[QueueManager] Retrying in 2 seconds...');
      setTimeout(() => this.start(), 2000);
      return;
    }

    // Start processing immediately
    this.processQueue();

    // Then check every 10 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 10000);
  }

  /**
   * Stop the queue processor
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('[QueueManager] Stopped');
    }
  }

  /**
   * Check if the queue processor is running
   */
  isStarted(): boolean {
    return this.processingInterval !== null;
  }

  /**
   * Process the queue:
   * 1. Count currently processing jobs
   * 2. If < max, start next pending job(s)
   */
  private async processQueue() {
    if (this.isProcessing) {
      return; // Already processing, skip this tick
    }

    this.isProcessing = true;

    try {
      // Verify DB is available
      if (!this.db) {
        logger.error('[QueueManager] DB is not initialized');
        return;
      }

      // Count currently processing jobs
      // Use the standard query builder (works correctly with pgSchema)
      const result = await this.db
        .select({ count: drizzleCount() })
        .from(walletAnalysisJobs)
        .where(eq(walletAnalysisJobs.status, 'processing'));
      const processingCount = result[0]?.count || 0;

      const availableSlots = this.maxConcurrentJobs - processingCount;

      if (availableSlots <= 0) {
        // No slots available, wait for jobs to complete
        return;
      }

      logger.debug(
        `[QueueManager] ${processingCount}/${this.maxConcurrentJobs} jobs running, ${availableSlots} slots available`
      );

      // Get next pending jobs (ordered by creation time)
      const pendingJobs = await this.db
        .select()
        .from(walletAnalysisJobs)
        .where(eq(walletAnalysisJobs.status, 'pending'))
        .orderBy(walletAnalysisJobs.createdAt)
        .limit(availableSlots);

      if (pendingJobs.length === 0) {
        // No pending jobs
        return;
      }

      logger.info(`[QueueManager] Starting ${pendingJobs.length} pending job(s)`);

      // Start each pending job (fire and forget - they run in background)
      for (const job of pendingJobs) {
        this.startJob(job.id, job.walletAddress).catch((error) => {
          logger.error(`[QueueManager] Error starting job ${job.id}:`, error);
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      logger.error('[QueueManager] Error processing queue:', errorMessage);
      logger.error('[QueueManager] Stack trace:', errorStack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start a job (move from pending to processing and run the worker)
   */
  private async startJob(jobId: string, walletAddress: string) {
    try {
      // Mark job as processing
      await this.db
        .update(walletAnalysisJobs)
        .set({
          status: 'processing',
          startedAt: new Date(),
          lastHeartbeat: new Date(),
        })
        .where(eq(walletAnalysisJobs.id, jobId));

      logger.info(`[QueueManager] Started job ${jobId} for wallet ${walletAddress}`);

      // Run the worker (fire and forget)
      processAnalysisJobAsync(
        this.db,
        jobId,
        this.heliusService,
        this.birdeyeService
      ).catch((error: any) => {
        logger.error(`[QueueManager] Job ${jobId} failed:`, error);
      }).finally(() => {
        // After job completes (success or failure), trigger queue processing
        // This ensures the next pending job starts immediately
        logger.info(`[QueueManager] Job ${jobId} completed, checking queue for next job`);
        setTimeout(() => this.processQueue(), 1000);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[QueueManager] Error starting job ${jobId}:`, errorMessage);

      // Mark job as failed
      await this.db
        .update(walletAnalysisJobs)
        .set({
          status: 'failed',
          error: `Failed to start: ${error instanceof Error ? error.message : String(error)}`,
        })
        .where(eq(walletAnalysisJobs.id, jobId));
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [stats] = await this.db
      .select({
        pending: sql<number>`count(*) FILTER (WHERE status = 'pending')::int`,
        processing: sql<number>`count(*) FILTER (WHERE status = 'processing')::int`,
        completed: sql<number>`count(*) FILTER (WHERE status = 'completed')::int`,
        failed: sql<number>`count(*) FILTER (WHERE status = 'failed')::int`,
      })
      .from(walletAnalysisJobs);

    return {
      maxConcurrentJobs: this.maxConcurrentJobs,
      availableSlots: Math.max(0, this.maxConcurrentJobs - stats.processing),
      ...stats,
    };
  }
}