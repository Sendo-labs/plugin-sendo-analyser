import { eq, desc } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { walletAnalysisJobs } from '../../schemas/wallet-analysis';
import { processAnalysisJobAsync, processIncrementalAnalysisAsync } from '../workers/analysisWorker';
import { getTokenResults } from './tokenResults';
import type { HeliusService } from '../api/helius';
import type { BirdeyeService } from '../api/birdeyes';
import type { StartAnalysisResponse, AnalysisStatusResponse, AnalysisResultsResponse } from '../../types/api';

/**
 * Analysis Jobs Module
 * CRUD operations and management for wallet analysis jobs
 */

/**
 * Start a new async wallet analysis job (or return existing)
 * @param db - Database instance
 * @param agentId - Agent ID
 * @param address - Wallet address to analyze
 * @param heliusService - Helius API service
 * @param cachedBirdeyeService - BirdEye service with cache layer
 * @returns Job info with job_id and status
 */
export async function startAnalysisJob(
  db: any,
  agentId: string,
  address: string,
  heliusService: HeliusService,
  cachedBirdeyeService: BirdeyeService
): Promise<StartAnalysisResponse> {
  try {
    // Check existing job
    const existing = await db
      .select()
      .from(walletAnalysisJobs)
      .where(eq(walletAnalysisJobs.walletAddress, address))
      .limit(1);

    if (existing.length > 0) {
      const job = existing[0];

      if (job.status === 'completed') {
        // Check for new transactions
        const latest = await heliusService.getSignaturesForAddress(address, { limit: 1 });
        const hasNew = latest[0]?.signature !== job.lastSignature;

        if (hasNew) {
          // Launch incremental scan
          await db.update(walletAnalysisJobs)
            .set({ status: 'processing', startedAt: new Date() })
            .where(eq(walletAnalysisJobs.id, job.id));

          processIncrementalAnalysisAsync(
            db,
            job.id,
            latest[0].signature,
            heliusService,
            cachedBirdeyeService
          ).catch(err => {
            logger.error(`[StartAnalysisJob] Incremental worker failed:`, err);
          });

          return {
            job_id: job.id,
            status: 'processing',
            wallet_address: address,
            is_incremental: true
          };
        }

        // No new transactions → cache HIT
        return {
          job_id: job.id,
          status: 'completed',
          wallet_address: address
        };
      }

      if (job.status === 'processing' || job.status === 'pending') {
        // Check if job is zombie (no heartbeat for more than 2 minutes)
        const TWO_MINUTES_MS = 2 * 60 * 1000;
        const lastBeat = job.lastHeartbeat || job.startedAt;
        const isZombie = lastBeat && (Date.now() - lastBeat.getTime()) > TWO_MINUTES_MS;

        if (isZombie) {
          const elapsedMinutes = Math.floor((Date.now() - lastBeat.getTime()) / 1000 / 60);
          logger.warn(`[StartAnalysisJob] Zombie job detected for ${address} (no heartbeat for ${elapsedMinutes} minutes). Retrying from last signature...`);

          // Retry from lastCursor instead of deleting (preserve history)
          await db.update(walletAnalysisJobs)
            .set({
              status: 'processing',
              startedAt: new Date(),
              lastHeartbeat: new Date(),
              retryCount: (job.retryCount || 0) + 1
            })
            .where(eq(walletAnalysisJobs.id, job.id));

          // Relaunch worker from where it left off
          processAnalysisJobAsync(db, job.id, heliusService, cachedBirdeyeService).catch(err => {
            logger.error(`[StartAnalysisJob] Retry worker failed:`, err);
          });

          return {
            job_id: job.id,
            status: 'processing',
            wallet_address: address
          };
        }

        // Job is still fresh, return existing
        return {
          job_id: job.id,
          status: job.status,
          wallet_address: address
        };
      }

      // Job is in failed state - delete it and create a new one
      if (job.status === 'failed') {
        logger.info(`[StartAnalysisJob] Deleting failed job for ${address}`);
        await db.delete(walletAnalysisJobs).where(eq(walletAnalysisJobs.id, job.id));
      }
    }

    // Create new job (old failed job deleted if existed)
    // The job starts as 'pending' and will be picked up by QueueManagerService
    const [newJob] = await db
      .insert(walletAnalysisJobs)
      .values({
        walletAddress: address,
        agentId: agentId,
        status: 'pending',
        processedSignatures: 0,
        currentBatch: 0
      })
      .returning();

    return {
      job_id: newJob.id,
      wallet_address: address,
      status: 'pending'
    };
  } catch (error: any) {
    logger.error('[StartAnalysisJob] Error:', error?.message || error);
    throw error;
  }
}

/**
 * Get analysis job status with progress and light summary
 * @param db - Database instance
 * @param address - Wallet address
 * @returns Job status with progress and light summary
 */
export async function getAnalysisStatus(db: any, address: string): Promise<AnalysisStatusResponse> {
  try {
    const [job] = await db
      .select()
      .from(walletAnalysisJobs)
      .where(eq(walletAnalysisJobs.walletAddress, address))
      .orderBy(desc(walletAnalysisJobs.createdAt))
      .limit(1);

    if (!job) {
      return {
        wallet_address: address,
        status: 'not_found',
        message: 'No analysis found for this address. Start a new analysis first.'
      };
    }

    // Calculate elapsed time: if completed, use completedAt, else use current time
    const elapsed = job.startedAt
      ? Math.floor(((job.completedAt || new Date()).getTime() - job.startedAt.getTime()) / 1000)
      : 0;

    // Return only light summary (currentResults is already optimized in worker)
    return {
      job_id: job.id,
      wallet_address: job.walletAddress,
      status: job.status,
      progress: {
        processed: job.processedSignatures,
        total: job.totalSignatures,
        current_batch: job.currentBatch
      },
      current_results: job.currentResults,  // Contains final results when status is 'completed'
      started_at: job.startedAt,
      completed_at: job.completedAt,
      last_heartbeat: job.lastHeartbeat,  // For zombie detection in frontend
      elapsed_seconds: elapsed,
      error: job.error
    };
  } catch (error: any) {
    logger.error('[GetAnalysisStatus] Error:', error?.message || error);
    throw error;
  }
}

/**
 * Get paginated tokens from analysis job (reads from token_analysis_results table)
 * @param db - Database instance
 * @param address - Wallet address
 * @param page - Page number (starts at 1)
 * @param limit - Number of tokens per page
 * @returns Paginated tokens with summary
 */
export async function getAnalysisTransactions(
  db: any,
  address: string,
  page: number = 1,
  limit: number = 50
): Promise<AnalysisResultsResponse> {
  try {
    const [job] = await db
      .select()
      .from(walletAnalysisJobs)
      .where(eq(walletAnalysisJobs.walletAddress, address))
      .orderBy(desc(walletAnalysisJobs.createdAt))
      .limit(1);

    if (!job) {
      return {
        tokens: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false
        },
        analysisStatus: 'not_found'
      };
    }

    // Read tokens from token_analysis_results table (optimized!)
    const { tokens, total } = await getTokenResults(db, job.id, page, limit);

    return {
      tokens,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      },
      analysisStatus: job.status,
      summary: job.currentResults  // Include light summary
    };
  } catch (error: any) {
    logger.error('[GetAnalysisTransactions] Error:', error?.message || error);
    throw error;
  }
}