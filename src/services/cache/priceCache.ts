import { eq, desc, lt, sql } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { tokenPriceCache, tokens } from '../../schemas/wallet-analysis';
import type { BirdeyeService } from '../api/birdeyes';

/**
 * Price Cache Module
 * Handles caching of token prices from BirdEye API
 * - Historical data (purchasePrice, athPrice) is immutable
 * - Current price expires after 1 hour
 */

const ONE_MINUTE = 60 * 1000; // 1 minute TTL for current price
const CACHE_TTL_DAYS = 30; // Keep price cache for 30 days

/**
 * Get cached price data for a token at a specific timestamp
 * Returns cached data if available and fresh (< 1 minute for current price)
 * Fetches symbol/name from tokens table via JOIN
 */
export async function getCachedPrice(db: any, mint: string, purchaseTimestamp?: number): Promise<any | null> {
  try {
    const [cached] = await db
      .select({
        // Price data from token_price_cache
        id: tokenPriceCache.id,
        mint: tokenPriceCache.mint,
        purchasePrice: tokenPriceCache.purchasePrice,
        currentPrice: tokenPriceCache.currentPrice,
        athPrice: tokenPriceCache.athPrice,
        athTimestamp: tokenPriceCache.athTimestamp,
        purchaseTimestamp: tokenPriceCache.purchaseTimestamp,
        lastUpdated: tokenPriceCache.lastUpdated,
        priceHistory: tokenPriceCache.priceHistory,
        // Metadata from tokens table
        symbol: tokens.symbol,
        name: tokens.name,
      })
      .from(tokenPriceCache)
      .leftJoin(tokens, eq(tokenPriceCache.mint, tokens.mint))
      .where(eq(tokenPriceCache.mint, mint))
      .orderBy(desc(tokenPriceCache.lastUpdated))
      .limit(1);

    if (!cached) return null;

    // Historical data is immutable (purchasePrice, athPrice at purchaseTimestamp)
    // Only currentPrice expires after 1 minute
    const isFresh = (Date.now() - cached.lastUpdated.getTime()) < ONE_MINUTE;

    // Check if price history covers the requested purchase timestamp
    // Cache covers from purchaseTimestamp to now, so it's valid for any timestamp >= cached.purchaseTimestamp
    const hasHistoryForTimestamp = !purchaseTimestamp ||
      (cached.purchaseTimestamp && cached.purchaseTimestamp <= purchaseTimestamp);

    return {
      ...cached,
      isFresh, // Indicates if currentPrice needs refresh
      hasHistoryForTimestamp, // Indicates if history covers the requested timestamp
    };
  } catch (error: any) {
    logger.error(`[GetCachedPrice] Error for ${mint}:`, error?.message);
    return null;
  }
}

/**
 * Cache price data for a token
 * Also upserts token metadata (symbol, name) into tokens table
 */
export async function cachePrice(
  db: any,
  priceData: {
    mint: string;
    symbol?: string | null;
    name?: string | null;
    purchasePrice?: number;
    currentPrice: number;
    athPrice?: number;
    athTimestamp?: number;
    purchaseTimestamp: number;
    priceHistory?: any[];
  }
): Promise<void> {
  try {
    // First, upsert token metadata into tokens table
    // Always insert the mint, even without symbol/name (to satisfy foreign key)
    await db.insert(tokens)
      .values({
        mint: priceData.mint,
        symbol: priceData.symbol || null,
        name: priceData.name || null,
      })
      .onConflictDoUpdate({
        target: tokens.mint,
        set: {
          // Only update if we have new data (don't overwrite with null)
          ...(priceData.symbol ? { symbol: priceData.symbol } : {}),
          ...(priceData.name ? { name: priceData.name } : {}),
          updatedAt: new Date(),
        }
      });

    // Then upsert price data - keep the earliest purchaseTimestamp to maximize cache coverage
    // Use Drizzle with sql template for LEAST/CASE expressions
    await db.insert(tokenPriceCache)
      .values({
        mint: priceData.mint,
        purchasePrice: priceData.purchasePrice?.toString() || null,
        currentPrice: priceData.currentPrice.toString(),
        athPrice: priceData.athPrice?.toString() || null,
        athTimestamp: priceData.athTimestamp || null,
        purchaseTimestamp: priceData.purchaseTimestamp,
        priceHistory: priceData.priceHistory || [],
      })
      .onConflictDoUpdate({
        target: tokenPriceCache.mint,
        set: {
          currentPrice: sql`EXCLUDED.current_price`,
          lastUpdated: sql`NOW()`,
          // Keep the EARLIEST purchaseTimestamp (maximize cache coverage)
          purchaseTimestamp: sql`LEAST("sendo_analyser"."token_price_cache"."purchase_timestamp", EXCLUDED.purchase_timestamp)`,
          // Update ATH if new value is higher
          athPrice: sql`CASE
            WHEN COALESCE(EXCLUDED.ath_price, '0')::numeric > COALESCE("sendo_analyser"."token_price_cache"."ath_price", '0')::numeric
            THEN EXCLUDED.ath_price
            ELSE "sendo_analyser"."token_price_cache"."ath_price"
          END`,
          athTimestamp: sql`CASE
            WHEN COALESCE(EXCLUDED.ath_price, '0')::numeric > COALESCE("sendo_analyser"."token_price_cache"."ath_price", '0')::numeric
            THEN EXCLUDED.ath_timestamp
            ELSE "sendo_analyser"."token_price_cache"."ath_timestamp"
          END`,
        }
      });

    logger.debug(`[CachePrice] Cached price for ${priceData.symbol || priceData.mint}`);
  } catch (error: any) {
    logger.error(`[CachePrice] Error caching price for ${priceData.mint}:`, error?.message);
    if (error?.cause) {
      logger.error(`[CachePrice] Error cause:`, error.cause);
    }
    if (error?.stack) {
      logger.error(`[CachePrice] Error stack:`, error.stack);
    }
  }
}

/**
 * Create a cached wrapper for BirdEye service
 * Returns a proxy that checks DB cache before calling BirdEye API
 */
export function createCachedBirdeyeService(db: any, birdeyeService: BirdeyeService): BirdeyeService {
  return {
    ...birdeyeService,
    getPriceAnalysis: async (mint: string, timestamp: number) => {
      // Check cache first
      const cached = await getCachedPrice(db, mint);

      // Case 1: Fresh cache (< 1 minute) - use everything from cache
      if (cached && cached.isFresh) {
        logger.debug(`[CachedBirdEye] Cache HIT (fresh) for ${mint}`);
        return {
          purchasePrice: parseFloat(cached.purchasePrice || '0'),
          currentPrice: parseFloat(cached.currentPrice),
          athPrice: parseFloat(cached.athPrice || '0'),
          athTimestamp: cached.athTimestamp,
          priceHistory: cached.priceHistory || [],
        };
      }

      // Case 2: Stale cache but has history - only update current price via multi_price (handled in worker)
      if (cached && cached.priceHistory) {
        logger.debug(`[CachedBirdEye] Cache HIT (stale) for ${mint} - re-fetching for fresh price`);

        // Fetch fresh price data
        const priceData = await birdeyeService.getPriceAnalysis(mint, timestamp);

        if (priceData) {
          // Update cache with new prices
          await cachePrice(db, {
            mint,
            purchasePrice: priceData.purchasePrice,
            currentPrice: priceData.currentPrice,
            athPrice: priceData.athPrice,
            athTimestamp: priceData.athTimestamp,
            purchaseTimestamp: timestamp,
            priceHistory: priceData.priceHistory,
          });

          return priceData;
        }
      }

      // Case 3: Complete cache MISS - fetch everything
      logger.debug(`[CachedBirdEye] Cache MISS (full) for ${mint} - fetching all data`);
      const priceData = await birdeyeService.getPriceAnalysis(mint, timestamp);

      if (priceData) {
        // Store complete data in cache
        await cachePrice(db, {
          mint,
          purchasePrice: priceData.purchasePrice,
          currentPrice: priceData.currentPrice,
          athPrice: priceData.athPrice,
          athTimestamp: priceData.athTimestamp,
          purchaseTimestamp: timestamp,
          priceHistory: priceData.priceHistory,
        });
      }

      return priceData;
    },
  } as BirdeyeService;
}

/**
 * Batch fetch prices with intelligent cache usage and multi_price optimization
 * This is the main optimization: classify tokens by cache status and use multi_price for current prices
 *
 * @param db Database instance
 * @param birdeyeService Birdeye service
 * @param tokensToFetch Array of {mint, timestamp} to fetch
 * @returns Map of "mint-timestampHour" -> price analysis
 */
export async function batchFetchPricesOptimized(
  db: any,
  birdeyeService: BirdeyeService,
  tokensToFetch: Array<{ mint: string; timestamp: number }>
): Promise<Map<string, any>> {
  const resultMap = new Map<string, any>();

  // Helper to create cache key
  const getCacheKey = (mint: string, timestamp: number) => {
    const timestampHour = Math.floor(timestamp / 3600) * 3600;
    return `${mint}-${timestampHour}`;
  };

  // Step 1: Check cache for all tokens in parallel
  const cacheChecks = await Promise.all(
    tokensToFetch.map(async ({ mint, timestamp }) => {
      const cached = await getCachedPrice(db, mint, timestamp);
      return { mint, timestamp, cached };
    })
  );

  // Step 2: Classify tokens by cache status
  const fullyCached: Array<{ mint: string; timestamp: number; cached: any }> = [];
  const needCurrentPrice: Array<{ mint: string; timestamp: number; cached: any }> = [];
  const needFullFetch: Array<{ mint: string; timestamp: number }> = [];

  cacheChecks.forEach(({ mint, timestamp, cached }) => {
    if (cached && cached.isFresh && cached.hasHistoryForTimestamp) {
      // Fully cached and fresh
      fullyCached.push({ mint, timestamp, cached });
    } else if (cached && cached.hasHistoryForTimestamp && !cached.isFresh) {
      // Has history but current price is stale
      needCurrentPrice.push({ mint, timestamp, cached });
    } else {
      // No cache or history doesn't cover timestamp
      needFullFetch.push({ mint, timestamp });
    }
  });

  logger.info(
    `[BatchFetchOptimized] Total: ${tokensToFetch.length} | Cached: ${fullyCached.length} | NeedCurrent: ${needCurrentPrice.length} | NeedFull: ${needFullFetch.length}`
  );

  // Step 3: Use fully cached data
  fullyCached.forEach(({ mint, timestamp, cached }) => {
    const key = getCacheKey(mint, timestamp);
    resultMap.set(key, {
      purchasePrice: parseFloat(cached.purchasePrice || '0'),
      currentPrice: parseFloat(cached.currentPrice),
      athPrice: parseFloat(cached.athPrice || '0'),
      athTimestamp: cached.athTimestamp,
      priceHistory: cached.priceHistory || [],
    });
  });

  // Step 4: Batch fetch current prices for stale cache (OPTIMIZATION!)
  if (needCurrentPrice.length > 0) {
    try {
      const mints = needCurrentPrice.map((t) => t.mint);
      const currentPrices = await birdeyeService.getMultiPrice(mints);

      logger.info(`[BatchFetchOptimized] Fetched ${currentPrices.size} current prices via multi_price (1 API call for ${mints.length} tokens)`);

      // Update result map and cache with fresh current prices
      for (const { mint, timestamp, cached } of needCurrentPrice) {
        const key = getCacheKey(mint, timestamp);
        const freshCurrentPrice = currentPrices.get(mint);
        if (freshCurrentPrice) {
          const result = {
            purchasePrice: parseFloat(cached.purchasePrice || '0'),
            currentPrice: freshCurrentPrice,
            athPrice: parseFloat(cached.athPrice || '0'),
            athTimestamp: cached.athTimestamp,
            priceHistory: cached.priceHistory || [],
          };
          resultMap.set(key, result);

          // Update cache with fresh current price (async, don't wait)
          cachePrice(db, {
            mint,
            purchasePrice: result.purchasePrice,
            currentPrice: result.currentPrice,
            athPrice: result.athPrice,
            athTimestamp: result.athTimestamp,
            purchaseTimestamp: cached.purchaseTimestamp,
            priceHistory: result.priceHistory,
          }).catch((err) => logger.warn(`[BatchFetchOptimized] Failed to update cache for ${mint}:`, err?.message));
        } else {
          // Fallback to stale cache if multi_price failed
          resultMap.set(key, {
            purchasePrice: parseFloat(cached.purchasePrice || '0'),
            currentPrice: parseFloat(cached.currentPrice),
            athPrice: parseFloat(cached.athPrice || '0'),
            athTimestamp: cached.athTimestamp,
            priceHistory: cached.priceHistory || [],
          });
        }
      }
    } catch (error: any) {
      logger.warn(`[BatchFetchOptimized] multi_price failed, falling back to stale cache:`, error?.message);
      // Fallback: use stale cache
      needCurrentPrice.forEach(({ mint, timestamp, cached }) => {
        const key = getCacheKey(mint, timestamp);
        resultMap.set(key, {
          purchasePrice: parseFloat(cached.purchasePrice || '0'),
          currentPrice: parseFloat(cached.currentPrice),
          athPrice: parseFloat(cached.athPrice || '0'),
          athTimestamp: cached.athTimestamp,
          priceHistory: cached.priceHistory || [],
        });
      });
    }
  }

  // Step 5: Full fetch for cache misses (still need history)
  if (needFullFetch.length > 0) {
    const fullFetchResults = await Promise.allSettled(
      needFullFetch.map(async ({ mint, timestamp }) => {
        const analysis = await birdeyeService.getPriceAnalysis(mint, timestamp);
        if (analysis) {
          // Cache the result
          await cachePrice(db, {
            mint,
            purchasePrice: analysis.purchasePrice,
            currentPrice: analysis.currentPrice,
            athPrice: analysis.athPrice,
            athTimestamp: analysis.athTimestamp,
            purchaseTimestamp: timestamp,
            priceHistory: analysis.priceHistory,
          });
        } else {
          logger.warn(
            `[BatchFetchOptimized] Birdeye returned null for ${mint.slice(0, 8)}... ` +
            `(timestamp: ${new Date(timestamp * 1000).toISOString()}) - likely new/rugged token`
          );
        }
        return { mint, timestamp, analysis };
      })
    );

    fullFetchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.analysis) {
        const key = getCacheKey(result.value.mint, result.value.timestamp);
        resultMap.set(key, result.value.analysis);
      }
    });
  }

  return resultMap;
}

/**
 * Clean old price cache entries (older than CACHE_TTL_DAYS)
 * Should be called periodically (e.g., daily cron job)
 * @returns Number of deleted entries
 */
export async function cleanOldPriceCache(db: any): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(tokenPriceCache)
      .where(lt(tokenPriceCache.createdAt, cutoffDate))
      .returning();

    const deletedCount = result.length;
    logger.info(`[CleanPriceCache] Deleted ${deletedCount} old price cache entries (older than ${CACHE_TTL_DAYS} days)`);

    return deletedCount;
  } catch (error: any) {
    logger.error('[CleanPriceCache] Error cleaning old price cache:', error?.message);
    return 0;
  }
}