import { eq, lt, sql } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { walletAnalysisJobs } from '../../schemas/wallet-analysis';

/**
 * Job Cache Module
 * Handles cleanup of completed analysis jobs
 * - Completed jobs are kept for 7 days for fast re-access
 * - Failed jobs are kept for 1 day for debugging
 */

const COMPLETED_JOB_TTL_DAYS = 7;
const FAILED_JOB_TTL_DAYS = 1;

/**
 * Clean old completed analysis jobs (older than COMPLETED_JOB_TTL_DAYS)
 * Should be called periodically (e.g., daily cron job)
 * @returns Number of deleted entries
 */
export async function cleanOldCompletedJobs(db: any): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - COMPLETED_JOB_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(walletAnalysisJobs)
      .where(
        sql`${walletAnalysisJobs.status} = 'completed' AND ${walletAnalysisJobs.completedAt} < ${cutoffDate}`
      )
      .returning();

    const deletedCount = result.length;
    logger.info(`[CleanCompletedJobs] Deleted ${deletedCount} old completed jobs (older than ${COMPLETED_JOB_TTL_DAYS} days)`);

    return deletedCount;
  } catch (error: any) {
    logger.error('[CleanCompletedJobs] Error cleaning old completed jobs:', error?.message);
    return 0;
  }
}

/**
 * Clean old failed analysis jobs (older than FAILED_JOB_TTL_DAYS)
 * Should be called periodically (e.g., daily cron job)
 * @returns Number of deleted entries
 */
export async function cleanOldFailedJobs(db: any): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - FAILED_JOB_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(walletAnalysisJobs)
      .where(
        sql`${walletAnalysisJobs.status} = 'failed' AND ${walletAnalysisJobs.createdAt} < ${cutoffDate}`
      )
      .returning();

    const deletedCount = result.length;
    logger.info(`[CleanFailedJobs] Deleted ${deletedCount} old failed jobs (older than ${FAILED_JOB_TTL_DAYS} days)`);

    return deletedCount;
  } catch (error: any) {
    logger.error('[CleanFailedJobs] Error cleaning old failed jobs:', error?.message);
    return 0;
  }
}

/**
 * Run all cache cleanup tasks
 * Should be called periodically (e.g., daily cron job)
 * @returns Total number of deleted entries
 */
export async function cleanAllCaches(db: any): Promise<{
  completedJobs: number;
  failedJobs: number;
  total: number;
}> {
  logger.info('[CleanAllCaches] Starting cache cleanup...');

  const completedJobs = await cleanOldCompletedJobs(db);
  const failedJobs = await cleanOldFailedJobs(db);

  const total = completedJobs + failedJobs;

  logger.info(`[CleanAllCaches] Cleanup completed - Total deleted: ${total} entries`);

  return {
    completedJobs,
    failedJobs,
    total
  };
}