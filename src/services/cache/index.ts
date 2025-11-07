/**
 * Cache Module Exports
 * Centralized caching layer for Sendo Analyser
 *
 * - Price Cache: BirdEye token prices (TTL: 30 days)
 * - Transaction Cache: Helius transactions (TTL: 90 days)
 * - Job Cache: Analysis jobs (TTL: 7 days for completed, 1 day for failed)
 */

export * from './priceCache';
export * from './transactionCache';
export * from './jobCache';

import { logger } from '@elizaos/core';
import { cleanOldPriceCache } from './priceCache';
import { cleanOldTransactionCache } from './transactionCache';
import { cleanAllCaches as cleanJobCaches } from './jobCache';

/**
 * Run all cache cleanup operations
 * Should be scheduled to run daily via cron or similar
 */
export async function runCacheCleanup(db: any): Promise<void> {
  logger.info('[CacheCleanup] Starting scheduled cache cleanup...');

  try {
    const [pricesCleaned, transactionsCleaned, jobsCleaned] = await Promise.all([
      cleanOldPriceCache(db),
      cleanOldTransactionCache(db),
      cleanJobCaches(db)
    ]);

    const total = pricesCleaned + transactionsCleaned + jobsCleaned.total;

    logger.info(`[CacheCleanup] Cleanup completed successfully:
      - Price cache: ${pricesCleaned} entries
      - Transaction cache: ${transactionsCleaned} entries
      - Completed jobs: ${jobsCleaned.completedJobs} entries
      - Failed jobs: ${jobsCleaned.failedJobs} entries
      - Total: ${total} entries deleted`);
  } catch (error: any) {
    logger.error('[CacheCleanup] Error during cache cleanup:', error?.message);
  }
}