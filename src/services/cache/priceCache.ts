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
export async function getCachedPrice(db: any, mint: string): Promise<any | null> {
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

    return {
      ...cached,
      isFresh, // Indicates if currentPrice needs refresh
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

    // Then insert price data (without symbol/name)
    await db.insert(tokenPriceCache).values({
      mint: priceData.mint,
      purchasePrice: priceData.purchasePrice?.toString(),
      currentPrice: priceData.currentPrice.toString(),
      athPrice: priceData.athPrice?.toString(),
      athTimestamp: priceData.athTimestamp,
      purchaseTimestamp: priceData.purchaseTimestamp,
      priceHistory: priceData.priceHistory,
    });

    logger.debug(`[CachePrice] Cached price for ${priceData.symbol || priceData.mint}`);
  } catch (error: any) {
    logger.error(`[CachePrice] Error caching price for ${priceData.mint}:`, error?.message);
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
          symbol: cached.symbol,
          name: cached.name,
        };
      }

      // Case 2: Stale cache but has metadata - reuse metadata, only update prices
      if (cached && (cached.symbol || cached.name)) {
        logger.debug(`[CachedBirdEye] Cache HIT (metadata only) for ${mint} - updating prices`);

        // Fetch only price data (metadata already known)
        const priceData = await birdeyeService.getPriceAnalysis(mint, timestamp);

        if (priceData) {
          // Merge: keep existing metadata, update prices
          const mergedData = {
            purchasePrice: priceData.purchasePrice,
            currentPrice: priceData.currentPrice,
            athPrice: priceData.athPrice,
            athTimestamp: priceData.athTimestamp,
            priceHistory: priceData.priceHistory,
            symbol: priceData.symbol || cached.symbol,  // Prefer new, fallback to cached
            name: priceData.name || cached.name,
          };

          // Update cache with new prices
          await cachePrice(db, {
            mint,
            symbol: mergedData.symbol,
            name: mergedData.name,
            purchasePrice: mergedData.purchasePrice,
            currentPrice: mergedData.currentPrice,
            athPrice: mergedData.athPrice,
            athTimestamp: mergedData.athTimestamp,
            purchaseTimestamp: timestamp,
            priceHistory: mergedData.priceHistory,
          });

          return mergedData;
        }
      }

      // Case 3: Complete cache MISS - fetch everything
      logger.debug(`[CachedBirdEye] Cache MISS (full) for ${mint} - fetching all data`);
      const priceData = await birdeyeService.getPriceAnalysis(mint, timestamp);

      if (priceData) {
        // Store complete data in cache
        await cachePrice(db, {
          mint,
          symbol: priceData.symbol,
          name: priceData.name,
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