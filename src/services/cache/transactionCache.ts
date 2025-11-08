import { eq, lt, inArray } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { transactionCache } from '../../schemas/wallet-analysis';
import { decodeTxData } from '../../utils/decoder/index';
import { serializeBigInt } from '../../utils/serializeBigInt';
import { extractTrades } from '../../utils/extractTrades';
import type { HeliusService } from '../api/helius';

/**
 * Transaction Cache Module
 * Handles caching of transactions from Helius API
 * - Transactions are immutable once on blockchain
 * - Cache indefinitely, only cleanup very old entries (90 days)
 */

const CACHE_TTL_DAYS = 90; // Keep transaction cache for 90 days

/**
 * Get cached transaction data (OPTIMIZED - returns lightweight structure)
 * Returns { signature, blockTime, trades } if available
 */
export async function getCachedTransaction(db: any, signature: string): Promise<any | null> {
  try {
    const [cached] = await db
      .select()
      .from(transactionCache)
      .where(eq(transactionCache.signature, signature))
      .limit(1);

    if (!cached) return null;

    logger.debug(`[GetCachedTransaction] Cache HIT for signature ${signature.slice(0, 8)}...`);

    // Return lightweight structure
    return {
      signature: cached.signature,
      blockTime: cached.blockTime,
      solBalanceChange: cached.solBalanceChange ? Number(cached.solBalanceChange) : 0,
      trades: cached.trades || []
    };
  } catch (error: any) {
    logger.error(`[GetCachedTransaction] Error for ${signature}:`, error?.message);
    return null;
  }
}

/**
 * Cache transaction data (OPTIMIZED - lightweight trades only)
 * @param db - Database instance
 * @param signature - Transaction signature
 * @param walletAddress - Wallet address
 * @param blockTime - Transaction block time
 * @param trades - Calculated trades (lightweight array)
 */
export async function cacheTransaction(
  db: any,
  signature: string,
  walletAddress: string,
  blockTime: number,
  trades: any[],
  solBalanceChange?: number
): Promise<void> {
  try {
    // Serialize BigInt values in trades
    const serializedTrades = serializeBigInt(trades);

    await db.insert(transactionCache).values({
      signature,
      walletAddress,
      blockTime,
      solBalanceChange: solBalanceChange?.toString(),
      trades: serializedTrades,
    });

    logger.debug(`[CacheTransaction] Cached transaction ${signature.slice(0, 8)}... with ${trades.length} trade(s)`);
  } catch (error: any) {
    // Ignore duplicate key errors (transaction already cached)
    if (!error?.message?.includes('duplicate') && !error?.message?.includes('unique')) {
      logger.error(`[CacheTransaction] Error caching transaction ${signature}:`, error?.message);
    }
  }
}

/**
 * Get transactions with cache layer (OPTIMIZED)
 * Uses new getTransactionsForAddress endpoint (1 call instead of 50+)
 * Batch caching to minimize DB queries
 */
export async function getTransactionsWithCache(
  db: any,
  heliusService: HeliusService,
  address: string,
  limit: number,
  before?: string
): Promise<{ transactions: any[]; signatures: string[]; paginationToken?: string; hasMore: boolean }> {

  // Step 1: Fetch transactions using NEW getTransactionsForAddress endpoint
  // This replaces getSignaturesForAddress + getTransaction loop (50+ calls → 1 call!)
  logger.debug(`[GetTransactionsWithCache] Fetching up to ${limit} transactions for ${address.slice(0, 8)}... (cursor: ${before?.slice(0, 8) || 'null'})`);

  const { transactions: fetchedTransactions, signatures: fetchedSignatures, paginationToken, hasMore } =
    await heliusService.getTransactionsForAddress(address, limit, before);

  if (fetchedTransactions.length === 0) {
    logger.warn(
      `[GetTransactionsWithCache] API returned 0 transactions (hasMore=${hasMore}, paginationToken=${paginationToken?.slice(0, 8) || 'null'}) - ` +
      `this may indicate an API issue or end of history`
    );
    return {
      transactions: [],
      signatures: [],
      paginationToken,
      hasMore
    };
  }

  logger.info(`[GetTransactionsWithCache] Fetched ${fetchedTransactions.length} transactions in 1 API call`);

  // Step 2: Check cache for existing transactions (batch SELECT)
  const cachedTxs = await db
    .select()
    .from(transactionCache)
    .where(inArray(transactionCache.signature, fetchedSignatures));

  const cachedMap = new Map(cachedTxs.map((tx: any) => [tx.signature, tx]));

  logger.info(`[GetTransactionsWithCache] Cache HIT for ${cachedMap.size}/${fetchedTransactions.length} transactions`);

  // Step 3: Process all transactions (decode + extract trades in PARALLEL)
  const processedTransactions: any[] = [];
  const cacheEntries: any[] = [];

  // Separate cached and non-cached transactions
  const uncachedTransactions = fetchedTransactions.filter(
    tx => !cachedMap.has(tx.transaction.signatures[0])
  );

  // Add cached transactions first
  cachedMap.forEach(cached => processedTransactions.push(cached));

  if (uncachedTransactions.length > 0) {
    // Decode ALL transactions in parallel (6-15x faster!)
    const decodePromises = uncachedTransactions.map(async (transaction) => {
      const signature = transaction.transaction.signatures[0];

      // Decode transaction to extract trades
      const decoded = await decodeTxData(transaction);

      // Extract lightweight trades
      const trades = extractTrades(decoded);

      // Extract SOL balance change for volume calculation
      const solBalanceChange = decoded.balances?.solBalances?.reduce(
        (sum: number, balance: any) => sum + Math.abs(balance.uiChange || 0),
        0
      ) || 0;

      return {
        signature,
        blockTime: transaction.blockTime,
        solBalanceChange,
        trades
      };
    });

    // Wait for all decoding to complete
    const decodedResults = await Promise.all(decodePromises);

    // Add to results and prepare cache entries
    for (const result of decodedResults) {
      processedTransactions.push(result);

      cacheEntries.push({
        signature: result.signature,
        walletAddress: address,
        blockTime: result.blockTime,
        solBalanceChange: result.solBalanceChange?.toString(),
        trades: serializeBigInt(result.trades),
      });
    }

    logger.info(`[GetTransactionsWithCache] Decoded ${uncachedTransactions.length} transactions in parallel`);
  }

  // Step 4: Batch INSERT cache entries (1 query instead of N)
  if (cacheEntries.length > 0) {
    try {
      await db.insert(transactionCache).values(cacheEntries);
      logger.info(`[GetTransactionsWithCache] Batch cached ${cacheEntries.length} new transactions`);
    } catch (error: any) {
      // Ignore duplicate key errors (transactions already cached by concurrent job)
      if (!error?.message?.includes('duplicate') && !error?.message?.includes('unique')) {
        logger.error(`[GetTransactionsWithCache] Error batch caching:`, error?.message);
      }
    }
  }

  return {
    transactions: processedTransactions,
    signatures: fetchedSignatures,
    paginationToken,
    hasMore
  };
}

/**
 * Clean old transaction cache entries (older than CACHE_TTL_DAYS)
 * Should be called periodically (e.g., weekly cron job)
 * @returns Number of deleted entries
 */
export async function cleanOldTransactionCache(db: any): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(transactionCache)
      .where(lt(transactionCache.createdAt, cutoffDate))
      .returning();

    const deletedCount = result.length;
    logger.info(`[CleanTransactionCache] Deleted ${deletedCount} old transaction cache entries (older than ${CACHE_TTL_DAYS} days)`);

    return deletedCount;
  } catch (error: any) {
    logger.error('[CleanTransactionCache] Error cleaning old transaction cache:', error?.message);
    return 0;
  }
}