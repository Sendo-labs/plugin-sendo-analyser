import { eq } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { walletAnalysisJobs } from '../../schemas/wallet-analysis';
import { getTransactionsWithCache } from '../cache/transactionCache';
import { batchFetchPricesOptimized } from '../cache/priceCache';
import { processNewTransactions } from './workerHelpers';
import { serializeBigInt } from '../../utils/serializeBigInt';
import { upsertTokenResults, getTokenResults } from '../analysis/tokenResults';
import type { HeliusService } from '../api/helius';
import type { BirdeyeService } from '../api/birdeyes';

/**
 * Analysis Worker Module
 * Background workers for processing wallet analysis jobs
 */

/**
 * Wrap a promise with a timeout
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout
 * @returns Promise that rejects if timeout is reached
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Main async worker to process full wallet analysis
 * Scans all transactions, calculates summary, and stores results
 * @param db - Database instance
 * @param jobId - Job ID to process
 * @param heliusService - Helius API service
 * @param cachedBirdeyeService - BirdEye service with cache layer
 */
export async function processAnalysisJobAsync(
  db: any,
  jobId: string,
  heliusService: HeliusService,
  cachedBirdeyeService: BirdeyeService
): Promise<void> {
  try {
    const [job] = await db
      .select()
      .from(walletAnalysisJobs)
      .where(eq(walletAnalysisJobs.id, jobId))
      .limit(1);

    if (!job) {
      logger.error(`[ProcessAnalysisJob] Job ${jobId} not found`);
      return;
    }

    // Mark as processing (only update startedAt if not already set - preserve for crash recovery)
    const updateData: any = { status: 'processing' };
    if (!job.startedAt) {
      updateData.startedAt = new Date();
    }

    await db.update(walletAnalysisJobs)
      .set(updateData)
      .where(eq(walletAnalysisJobs.id, jobId));

    const isResume = job.currentBatch && job.currentBatch > 0;
    logger.info(`[ProcessAnalysisJob] ${isResume ? 'Resuming' : 'Starting'} analysis for ${job.walletAddress}${isResume ? ` from batch ${job.currentBatch}` : ''}`);

    // Fetch NFT count at the start (snapshot of current holdings)
    let nftCount = 0;
    try {
      const nfts = await heliusService.getAssetsByOwner({ ownerAddress: job.walletAddress });
      nftCount = nfts?.total || nfts?.items?.length || 0;
      logger.debug(`[ProcessAnalysisJob] Wallet has ${nftCount} NFTs`);
    } catch (error: any) {
      logger.error(`[ProcessAnalysisJob] Failed to fetch NFT count:`, error?.message);
    }

    let cursor = job.paginationToken || undefined;
    let hasMore = true;
    let batch = job.currentBatch || 0;
    let tokensMap = new Map<string, any>();
    let totalTransactions = 0;
    let totalVolumeSOL = 0; // Volume in SOL (from balance changes)
    let totalMissedATH = 0;
    let totalPNL = 0; // Total Profit and Loss in USD
    let winningTrades = 0;
    let losingTrades = 0;
    let totalTrades = 0; // All detected trades, regardless of pricing
    let pricedTrades = 0; // Trades for which we successfully fetched price data
    let tradesMissingPrice = 0; // Trades skipped due to price lookup issues
    let firstSignature: string | null = null; // Track the first (most recent) signature
    let emptyBatchCount = 0; // Track consecutive empty batches to prevent infinite loops
    const MAX_EMPTY_BATCHES = 5; // Maximum consecutive empty batches before stopping

    // If this is a retry (currentBatch > 0), load existing data from DB to avoid losing progress
    if (batch > 0) {
      logger.info(`[ProcessAnalysisJob] Resuming from batch ${batch}, loading existing token data...`);

      try {
        const { tokens: existingTokens } = await getTokenResults(db, jobId, 1, 10000);

        // Map DB fields directly to in-memory tokensMap format
        // DB now stores all cumulative sums needed for accurate incremental calculations!
        tokensMap = new Map(existingTokens.map((t: any) => [t.mint, {
          mint: t.mint,
          symbol: t.symbol,
          name: t.name,
          tokenSymbol: t.symbol,
          totalVolumeUSD: Number(t.totalVolumeUSD || 0),
          totalVolumeSOL: Number(t.totalVolumeSOL || 0),
          totalMissedATH: Number(t.totalMissedATH || 0),
          totalGainLoss: Number(t.totalGainLoss || 0),
          totalPnlUSD: Number(t.totalPnlUSD || 0),
          tradeCount: Number(t.trades || 0),
          // Load cumulative sums directly from DB (no complex reconstruction needed!)
          sumAthPrice: Number(t.sumAthPrice || 0),
          sumPurchaseValue: Number(t.sumPurchaseValue || 0),
          sumTokensTraded: Number(t.sumTokensTraded || 0),
          totalTokensTraded: Number(t.totalTokensTraded || 0),
          tradesMissingPrice: 0, // Will be recounted in new batches
          pricedTrades: Number(t.trades || 0), // All loaded trades had prices
        }]));

        logger.info(`[ProcessAnalysisJob] Loaded ${tokensMap.size} existing tokens from previous batches`);

        // Restore metrics from currentResults if available
        if (job.currentResults) {
          totalTransactions = job.processedSignatures || 0;
          totalVolumeSOL = Number(job.currentResults.total_volume_sol || 0);
          totalPNL = Number(job.currentResults.total_pnl || 0);
          winningTrades = Number(job.currentResults.winning_trades || 0);
          losingTrades = Number(job.currentResults.losing_trades || 0);
          totalTrades = Number(job.currentResults.total_trades || 0);
          pricedTrades = Number(job.currentResults.priced_trades || 0);
          tradesMissingPrice = Number(job.currentResults.trades_missing_price || 0);
          totalMissedATH = Number(job.currentResults.total_missed_usd || 0);

          logger.info(`[ProcessAnalysisJob] Restored metrics: ${totalTransactions} txs, ${totalTrades} trades, ${tokensMap.size} tokens`);
        }
      } catch (error: any) {
        logger.warn(`[ProcessAnalysisJob] Failed to load existing data, starting fresh: ${error?.message}`);
      }
    }

    // Loop through batches
    while (hasMore) {
      batch++;
      logger.info(`[ProcessAnalysisJob] Processing batch ${batch} for ${job.walletAddress}`);

      // Fetch batch with cache layer with timeout (returns lightweight { signature, blockTime, trades })
      // Dynamic batch size based on number of active jobs for fair sharing
      const batchSize = (cachedBirdeyeService as any).getOptimalBatchSize?.() || 25;
      let result;
      try {
        result = await withTimeout(
          getTransactionsWithCache(db, heliusService, job.walletAddress, batchSize, cursor),
          120000, // 2 minutes timeout for fetching transactions
          `Transaction fetch timeout for batch ${batch}`
        );
      } catch (error: any) {
        logger.error(`[ProcessAnalysisJob] ${error.message} - stopping analysis`);
        throw error; // Will be caught by outer try/catch and mark job as failed
      }

      // Capture the first signature (most recent) on first batch
      if (batch === 1 && result.signatures.length > 0) {
        firstSignature = result.signatures[0];
      }

      // Count transactions
      totalTransactions += result.transactions.length;

      // Detect infinite loops: if we get multiple consecutive empty batches, stop
      if (result.transactions.length === 0) {
        emptyBatchCount++;
        logger.warn(`[ProcessAnalysisJob] Empty batch ${batch} (${emptyBatchCount}/${MAX_EMPTY_BATCHES}) - hasMore=${result.hasMore}, cursor=${cursor?.slice(0, 8) || 'null'}`);

        if (emptyBatchCount >= MAX_EMPTY_BATCHES) {
          logger.error(`[ProcessAnalysisJob] Stopping after ${MAX_EMPTY_BATCHES} consecutive empty batches - possible API issue or invalid cursor`);
          break;
        }
      } else {
        // Reset counter on successful batch
        emptyBatchCount = 0;
      }

      // Collect all unique mints with their timestamps for batch price analysis
      const mintsToAnalyze = new Map<string, { mint: string; timestamp: number; trades: any[] }>();

      result.transactions.forEach((tx: any) => {
        tx.trades?.forEach((trade: any) => {
          if (trade.mint && trade.amount > 0) {
            const blockTime = Number(tx.blockTime);
            const timestampHour = Math.floor(blockTime / 3600) * 3600;
            const key = `${trade.mint}-${timestampHour}`;

            if (!mintsToAnalyze.has(key)) {
              mintsToAnalyze.set(key, {
                mint: trade.mint,
                timestamp: blockTime,
                trades: []
              });
            }
            mintsToAnalyze.get(key)!.trades.push({ trade, tx });
          }
        });
      });

      // Step 1: Batch-fetch metadata with Helius (MUCH more efficient than Birdeye!)
      // Extract unique mints from all trades
      const uniqueMints = Array.from(new Set(Array.from(mintsToAnalyze.values()).map(({ mint }) => mint)));
      logger.info(`[ProcessAnalysisJob] Batch-fetching metadata for ${uniqueMints.length} tokens via Helius...`);

      let metadataMap = new Map<string, { symbol: string | null; name: string | null }>();
      try {
        metadataMap = await heliusService.getTokenMetadataBatch(uniqueMints);
        logger.info(`[ProcessAnalysisJob] Successfully fetched metadata for ${metadataMap.size}/${uniqueMints.length} tokens`);
      } catch (error: any) {
        logger.warn(`[ProcessAnalysisJob] Failed to batch-fetch metadata:`, error?.message || String(error));
        // Continue without metadata - will use fallback
      }

      // Step 2: Fetch price data using OPTIMIZED batch function with multi_price
      // This intelligently uses cache and batches current price fetches via multi_price API
      const tokensToFetch = Array.from(mintsToAnalyze.values()).map(({ mint, timestamp }) => ({
        mint,
        timestamp
      }));

      logger.info(`[ProcessAnalysisJob] Batch-fetching prices for ${tokensToFetch.length} unique token-timestamps...`);

      let priceMap = new Map<string, any>();
      try {
        // batchFetchPricesOptimized already returns Map with "mint-timestampHour" keys
        priceMap = await batchFetchPricesOptimized(db, cachedBirdeyeService, tokensToFetch);

        logger.info(`[ProcessAnalysisJob] Successfully fetched ${priceMap.size}/${tokensToFetch.length} price analyses`);
      } catch (error: any) {
        logger.error(`[ProcessAnalysisJob] Batch price fetch failed:`, error?.message || String(error));
        // Continue with empty priceMap - trades will be counted but without price data
      }

      // Calculate SOL volume from transaction balance changes
      result.transactions.forEach((tx: any) => {
        if (tx.solBalanceChange) {
          totalVolumeSOL += Math.abs(Number(tx.solBalanceChange));
        }
      });

      // First pass: Calculate total USD volume per transaction for proportional SOL distribution
      const txVolumeMap = new Map<string, number>();
      result.transactions.forEach((tx: any) => {
        let txTotalVolumeUSD = 0;
        tx.trades?.forEach((trade: any) => {
          if (trade.mint && trade.amount > 0) {
            const blockTime = Number(tx.blockTime);
            const timestampHour = Math.floor(blockTime / 3600) * 3600;
            const key = `${trade.mint}-${timestampHour}`;
            const priceAnalysis = priceMap.get(key);
            if (priceAnalysis) {
              const volumeUSD = Number(trade.amount) * Number(priceAnalysis.purchasePrice);
              txTotalVolumeUSD += volumeUSD;
            }
          }
        });
        if (txTotalVolumeUSD > 0) {
          txVolumeMap.set(tx.signature, txTotalVolumeUSD);
        }
      });

      // Process trades with enriched price data
      result.transactions.forEach((tx: any) => {
        tx.trades?.forEach((trade: any) => {
          if (!trade.mint || trade.amount === 0) return;

          totalTrades++;

          const blockTime = Number(tx.blockTime);
          const timestampHour = Math.floor(blockTime / 3600) * 3600;
          const key = `${trade.mint}-${timestampHour}`;
          const priceAnalysis = priceMap.get(key);

          let volume = 0;
          let volumeSOL = 0;  // SOL volume for this trade
          let missedATH = 0;
          let gainLoss = 0;
          let pnl = 0;

          // Get metadata from Helius (batch-fetched earlier)
          const metadata = metadataMap.get(trade.mint);
          let symbol = metadata?.symbol || trade.tokenSymbol;
          let name = metadata?.name || null;

          if (!priceAnalysis) {
            tradesMissingPrice++;
            logger.warn(
              `[ProcessAnalysisJob] Missing price for ${symbol || trade.mint.slice(0, 8)} ` +
              `(key: ${key}, timestamp: ${new Date(blockTime * 1000).toISOString()}) - SKIPPING trade`
            );
          }

          if (priceAnalysis) {
            const { purchasePrice, currentPrice, athPrice } = priceAnalysis;

            // Calculate USD volume for this trade
            volume = Number(trade.amount) * Number(purchasePrice);

            // Calculate proportional SOL volume for this trade
            // Formula: volumeSOL = (tradeVolumeUSD / txTotalVolumeUSD) × txSOLBalanceChange
            const txTotalVolumeUSD = txVolumeMap.get(tx.signature) || 0;
            const txSOLChange = tx.solBalanceChange ? Math.abs(Number(tx.solBalanceChange)) : 0;
            if (txTotalVolumeUSD > 0 && txSOLChange > 0) {
              volumeSOL = (volume / txTotalVolumeUSD) * txSOLChange;
            }

            // DATA VALIDATION: Filter aberrant prices (likely BirdEye bugs or rug pulls)
            // Skip trades with unrealistic prices (> $1M per token)
            const MAX_PRICE_USD = 1_000_000;
            const priceIsValid =
              purchasePrice <= MAX_PRICE_USD &&
              currentPrice <= MAX_PRICE_USD &&
              athPrice <= MAX_PRICE_USD;

            if (!priceIsValid) {
              logger.warn(
                `[ProcessAnalysisJob] Aberrant price detected for ${symbol || trade.mint.slice(0, 8)}: ` +
                `purchase=$${purchasePrice.toLocaleString()}, current=$${currentPrice.toLocaleString()}, ath=$${athPrice.toLocaleString()} - SKIPPING trade`
              );
              // Skip this trade entirely - don't count it
              return;
            }

            // Calculate missed ATH in USD (how much you would have made if you sold at ATH vs now)
            // This shows the opportunity cost of not selling at the peak
            const missedPerToken = athPrice > currentPrice ? athPrice - currentPrice : 0;
            missedATH = Number(trade.amount) * missedPerToken;

            gainLoss = purchasePrice > 0 ? Number(((currentPrice - purchasePrice) / purchasePrice) * 100) : 0;

            // Calculate PNL (Profit and Loss in USD)
            pnl = Number(trade.amount) * (Number(currentPrice) - Number(purchasePrice));

            // Additional validation: Skip trades with aberrant PNL (> $100k per trade)
            // This helps filter out corrupted price data while keeping most legitimate trades
            const MAX_PNL_PER_TRADE = 100_000;
            if (Math.abs(pnl) > MAX_PNL_PER_TRADE) {
              logger.warn(
                `[ProcessAnalysisJob] Aberrant PNL detected for ${symbol || trade.mint.slice(0, 8)}: ` +
                `$${pnl.toLocaleString()} (amount=${trade.amount}, price diff=${(currentPrice - purchasePrice).toFixed(6)}) - SKIPPING trade`
              );
              // Skip this trade
              return;
            }

            // Track winning/losing trades
            pricedTrades++;
            if (gainLoss > 0) {
              winningTrades++;
            } else if (gainLoss < 0) {
              losingTrades++;
            }
          }

          totalMissedATH = Number(totalMissedATH) + Number(missedATH);
          totalPNL = Number(totalPNL) + Number(pnl);

          if (tokensMap.has(trade.mint)) {
            const existing = tokensMap.get(trade.mint);
            tokensMap.set(trade.mint, {
              ...existing,
              totalVolumeUSD: Number(existing.totalVolumeUSD || 0) + Number(volume),
              totalVolumeSOL: Number(existing.totalVolumeSOL || 0) + Number(volumeSOL),
              totalMissedATH: Number(existing.totalMissedATH) + Number(missedATH),
              totalGainLoss: Number(existing.totalGainLoss) + Number(gainLoss),
              totalPnlUSD: Number(existing.totalPnlUSD || 0) + Number(pnl),
              tradeCount: Number(existing.tradeCount) + 1,
              // Track sums for average calculations
              sumPurchaseValue: Number(existing.sumPurchaseValue || 0) + (priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.purchasePrice) : 0),
              sumTradeValue: Number(existing.sumTradeValue || 0) + (priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.currentPrice) : 0),
              sumTokensTraded: Number(existing.sumTokensTraded || 0) + (priceAnalysis ? Number(trade.amount) : 0),
              sumAthPrice: Number(existing.sumAthPrice || 0) + (priceAnalysis ? Number(priceAnalysis.athPrice) : 0),
              totalTokensTraded: Number(existing.totalTokensTraded || 0) + Number(trade.amount),
              tradesMissingPrice: Number(existing.tradesMissingPrice || 0) + (priceAnalysis ? 0 : 1),
              pricedTrades: Number(existing.pricedTrades || 0) + (priceAnalysis ? 1 : 0),
            });
          } else {
            tokensMap.set(trade.mint, {
              mint: trade.mint,
              symbol,
              name,  // Store full token name
              totalVolumeUSD: Number(volume),
              totalVolumeSOL: Number(volumeSOL),
              totalMissedATH: Number(missedATH),
              totalGainLoss: Number(gainLoss),
              totalPnlUSD: Number(pnl),
              tradeCount: 1,
              // Initialize sums for average calculations
              sumPurchaseValue: priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.purchasePrice) : 0,
              sumTradeValue: priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.currentPrice) : 0,
              sumTokensTraded: priceAnalysis ? Number(trade.amount) : 0,
              sumAthPrice: priceAnalysis ? Number(priceAnalysis.athPrice) : 0,
              totalTokensTraded: Number(trade.amount),
              tradesMissingPrice: priceAnalysis ? 0 : 1,
              pricedTrades: priceAnalysis ? 1 : 0,
            });
          }
        });
      });

      // Light summary calculated from tokensMap (updated after each batch)
      const successRate = pricedTrades > 0 ? Number(((winningTrades / pricedTrades) * 100).toFixed(2)) : 0;

      // Calculate token distribution (in profit vs in loss)
      let tokensInProfit = 0;
      let tokensInLoss = 0;
      let bestPerformer: { mint: string; symbol: string | null; pnl_usd: number; volume_sol: number; } | null = null;
      let worstPerformer: { mint: string; symbol: string | null; pnl_usd: number; volume_sol: number; } | null = null;

      tokensMap.forEach((token) => {
        const pnlUsd = Number(token.totalPnlUSD || 0);
        const gainLossPct = Number(token.totalGainLoss || 0);

        // Determine profit/loss based on percentage (more reliable than USD for classification)
        if (gainLossPct > 0) tokensInProfit++;
        else if (gainLossPct < 0) tokensInLoss++;

        // Track best performer (by PNL in USD)
        if (!bestPerformer || pnlUsd > bestPerformer.pnl_usd) {
          bestPerformer = {
            mint: token.mint,
            symbol: token.symbol || token.tokenSymbol || null,
            pnl_usd: pnlUsd,
            volume_sol: Number(token.totalVolumeSOL || 0),
          };
        }

        // Track worst performer (by PNL in USD)
        if (!worstPerformer || pnlUsd < worstPerformer.pnl_usd) {
          worstPerformer = {
            mint: token.mint,
            symbol: token.symbol || token.tokenSymbol || null,
            pnl_usd: pnlUsd,
            volume_sol: Number(token.totalVolumeSOL || 0),
          };
        }
      });

      // Calculate top 3 pain points (tokens with highest missed gains at ATH)
      const topPainPoints = Array.from(tokensMap.values())
        .map((token) => {
          const missedUSD = Number(token.totalMissedATH || 0);

          // Calculate average ATH price from cumulative sums
          const athPrice = token.tradeCount > 0
            ? Number(token.sumAthPrice || 0) / token.tradeCount
            : 0;

          // Calculate weighted average trade price (price at moment of each trade)
          const sumTokensTraded = Number(token.sumTokensTraded || 0);
          const tradePrice = sumTokensTraded > 0
            ? Number(token.sumTradeValue || 0) / sumTokensTraded
            : 0;

          // Calculate percentage change from ATH to average trade price
          // Shows if user traded well (close to ATH) or poorly (far below ATH)
          let athChangePct = 0;
          if (athPrice > 0 && tradePrice > 0) {
            athChangePct = ((tradePrice - athPrice) / athPrice) * 100;
          }

          return {
            mint: token.mint,
            symbol: token.symbol || token.tokenSymbol || null,
            missed_usd: missedUSD,
            ath_price: athPrice,
            trade_price: tradePrice > 0 ? tradePrice : null,
            ath_change_pct: athChangePct,
          };
        })
        .sort((a, b) => b.missed_usd - a.missed_usd)
        .slice(0, 3);

      const lightSummary = {
        total_missed_usd: totalMissedATH,
        total_volume_sol: totalVolumeSOL,
        total_pnl: totalPNL,
        success_rate: successRate,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        total_trades: totalTrades,
        priced_trades: pricedTrades,
        trades_missing_price: tradesMissingPrice,
        tokens_discovered: tokensMap.size,
        total_transactions: totalTransactions,
        nft_count: nftCount, // Available from the start
        tokens_in_profit: tokensInProfit,
        tokens_in_loss: tokensInLoss,
        best_performer: bestPerformer,
        worst_performer: worstPerformer,
        top_pain_points: topPainPoints,
      };

      logger.info(
        `[ProcessAnalysisJob] Batch ${batch} summary: ` +
        `totalTrades=${totalTrades}, winningTrades=${winningTrades}, losingTrades=${losingTrades}, ` +
        `totalPNL=${totalPNL.toFixed(2)}, successRate=${successRate}%, ` +
        `volumeSOL=${totalVolumeSOL.toFixed(2)}, nftCount=${nftCount}`
      );

      // Always save the last signature processed (never null, to avoid incremental reprocessing)
      // Preserve existing lastSignature if current batch has no signatures
      const lastSignature = result.signatures.length > 0
        ? result.signatures[result.signatures.length - 1]
        : (cursor || job.lastSignature);

      logger.info(`[ProcessAnalysisJob] Checkpoint at batch ${batch} (${tokensMap.size} tokens, ${totalTransactions} txs)`);

      // Atomic transaction: save everything at each batch (simple & safe)
      await db.transaction(async (tx: any) => {
        // Save tokens (critical data)
        await upsertTokenResults(tx, jobId, tokensMap);

        // Save job metadata (progress, results, heartbeat)
        await tx.update(walletAnalysisJobs)
          .set({
            processedSignatures: totalTransactions,
            currentBatch: batch,
            currentResults: serializeBigInt(lightSummary),
            lastSignature: lastSignature,
            paginationToken: result.paginationToken,
            lastHeartbeat: new Date()
          })
          .where(eq(walletAnalysisJobs.id, jobId));
      });

      hasMore = result.hasMore;
      cursor = result.paginationToken;

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Validate results before marking as completed
    // Don't mark as completed if we have 0 transactions (likely an error)
    if (totalTransactions === 0 && batch > 1) {
      const errorMsg = `No transactions processed after ${batch} batches - likely API issue or invalid cursor`;
      logger.error(`[ProcessAnalysisJob] ${errorMsg}`);

      await db.update(walletAnalysisJobs)
        .set({
          status: 'failed',
          error: errorMsg
        })
        .where(eq(walletAnalysisJobs.id, jobId));

      throw new Error(errorMsg);
    }

    // Final save: ensure all tokens are written before marking complete
    logger.info(`[ProcessAnalysisJob] Writing final results (${tokensMap.size} tokens, ${totalTransactions} txs)`);

    await db.transaction(async (tx: any) => {
      // Final write of all token results
      await upsertTokenResults(tx, jobId, tokensMap);

      // Mark analysis as completed
      await tx.update(walletAnalysisJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalSignatures: totalTransactions,
          lastSignature: firstSignature,  // Save the first (most recent) signature
          paginationToken: null  // Clear pagination token (analysis is complete)
        })
        .where(eq(walletAnalysisJobs.id, jobId));
    });

    logger.info(`[ProcessAnalysisJob] Completed analysis for ${job.walletAddress} - ${totalTransactions} signatures, ${totalTrades} trades, ${nftCount} NFTs`);

  } catch (error: any) {
    logger.error(`[ProcessAnalysisJob] Failed:`, error);

    await db.update(walletAnalysisJobs)
      .set({
        status: 'failed',
        error: error.message
      })
      .where(eq(walletAnalysisJobs.id, jobId));
  }
}

/**
 * Incremental analysis worker - only processes new transactions since last scan
 * @param db - Database instance
 * @param jobId - Job ID to process
 * @param latestSignature - Latest signature detected on chain
 * @param heliusService - Helius API service
 * @param cachedBirdeyeService - BirdEye service with cache layer
 */
export async function processIncrementalAnalysisAsync(
  db: any,
  jobId: string,
  latestSignature: string,
  heliusService: HeliusService,
  cachedBirdeyeService: BirdeyeService
): Promise<void> {
  try {
    const [job] = await db
      .select()
      .from(walletAnalysisJobs)
      .where(eq(walletAnalysisJobs.id, jobId))
      .limit(1);

    if (!job) {
      logger.error(`[ProcessIncrementalAnalysis] Job ${jobId} not found`);
      return;
    }

    logger.info(`[ProcessIncrementalAnalysis] Starting incremental scan for ${job.walletAddress}`);

    // Load existing tokens from token_analysis_results table with proper mapping
    const { tokens: existingTokens } = await getTokenResults(db, jobId, 1, 10000);

    // Map DB fields to in-memory tokensMap format (same as recovery logic)
    const tokensMap = new Map<string, any>(existingTokens.map((t: any) => [t.mint, {
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      tokenSymbol: t.symbol,
      totalVolumeUSD: Number(t.totalVolumeUSD || 0),
      totalVolumeSOL: Number(t.totalVolumeSOL || 0),
      totalMissedATH: Number(t.totalMissedATH || 0),
      totalGainLoss: Number(t.totalGainLoss || 0),
      totalPnlUSD: Number(t.totalPnlUSD || 0),
      tradeCount: Number(t.trades || 0),
      // Load cumulative sums directly from DB
      sumAthPrice: Number(t.sumAthPrice || 0),
      sumPurchaseValue: Number(t.sumPurchaseValue || 0),
      sumTradeValue: Number(t.sumTradeValue || 0),
      sumTokensTraded: Number(t.sumTokensTraded || 0),
      totalTokensTraded: Number(t.totalTokensTraded || 0),
      tradesMissingPrice: 0,
      pricedTrades: Number(t.trades || 0),
      // Load pre-calculated averages as fallback (for recovery from corrupted sums)
      averageTradePrice: Number(t.averageTradePrice || 0),
      averageAthPrice: Number(t.averageAthPrice || 0),
      averagePurchasePrice: Number(t.averagePurchasePrice || 0),
    }]));

    // Scan new transactions
    let cursor = undefined;
    let hasMore = true;
    let newTransactionsCount = 0;
    const lastCachedSig = job.lastSignature;

    while (hasMore) {
      const result = await getTransactionsWithCache(db, heliusService, job.walletAddress, 25, cursor);

      // Check if reached cached data
      const reachedCached = result.signatures.includes(lastCachedSig);

      if (reachedCached) {
        const lastCachedIndex = result.signatures.indexOf(lastCachedSig);
        const newTransactions = result.transactions.slice(0, lastCachedIndex);

        if (newTransactions.length > 0) {
          await processNewTransactions(newTransactions, tokensMap, cachedBirdeyeService);
          newTransactionsCount += newTransactions.length;
        }

        hasMore = false;
      } else {
        await processNewTransactions(result.transactions, tokensMap, cachedBirdeyeService);
        newTransactionsCount += result.transactions.length;
        cursor = result.paginationToken;
        hasMore = result.hasMore;
      }
    }

    // Write updated tokens back to token_analysis_results
    await upsertTokenResults(db, jobId, tokensMap);

    // Calculate updated light summary - preserve existing metrics if available
    const tokens = Array.from(tokensMap.values());
    const existingSummary = job.currentResults || {};

    // Recalculate token distribution and performers
    let tokensInProfit = 0;
    let tokensInLoss = 0;
    let bestPerformer: { mint: string; symbol: string | null; pnl_usd: number; volume_sol: number; } | null = null;
    let worstPerformer: { mint: string; symbol: string | null; pnl_usd: number; volume_sol: number; } | null = null;

    tokens.forEach((token: any) => {
      const pnlUsd = Number(token.totalPnlUSD || 0);
      const gainLossPct = Number(token.totalGainLoss || 0);

      // Determine profit/loss based on percentage (more reliable than USD for classification)
      if (gainLossPct > 0) tokensInProfit++;
      else if (gainLossPct < 0) tokensInLoss++;

      // Track best performer (by PNL in USD)
      if (!bestPerformer || pnlUsd > bestPerformer.pnl_usd) {
        bestPerformer = {
          mint: token.mint,
          symbol: token.symbol || null,
          pnl_usd: pnlUsd,
          volume_sol: Number(token.totalVolumeSOL || 0),
        };
      }

      // Track worst performer (by PNL in USD)
      if (!worstPerformer || pnlUsd < worstPerformer.pnl_usd) {
        worstPerformer = {
          mint: token.mint,
          symbol: token.symbol || null,
          pnl_usd: pnlUsd,
          volume_sol: Number(token.totalVolumeSOL || 0),
        };
      }
    });

    // Calculate top 3 pain points (tokens with highest missed gains at ATH)
    const topPainPoints = tokens
      .map((token: any) => {
        const missedUSD = Number(token.totalMissedATH || 0);

        // Calculate average ATH price from cumulative sums
        // Fallback to pre-calculated value if sums are corrupted
        const sumAthPrice = Number(token.sumAthPrice || 0);
        const athPrice = token.tradeCount > 0 && sumAthPrice > 0
          ? sumAthPrice / token.tradeCount
          : Number(token.averageAthPrice || 0);

        // Calculate weighted average trade price from cumulative sums
        // Fallback to pre-calculated value if sums are corrupted (sumTokensTraded > 0 but sumTradeValue = 0)
        const sumTokensTraded = Number(token.sumTokensTraded || 0);
        const sumTradeValue = Number(token.sumTradeValue || 0);
        const tradePrice = sumTokensTraded > 0 && sumTradeValue > 0
          ? sumTradeValue / sumTokensTraded
          : Number(token.averageTradePrice || 0);

        // Calculate percentage change from ATH to average trade price
        // Shows if user traded well (close to ATH) or poorly (far below ATH)
        let athChangePct = 0;
        if (athPrice > 0 && tradePrice > 0) {
          athChangePct = ((tradePrice - athPrice) / athPrice) * 100;
        }

        return {
          mint: token.mint,
          symbol: token.symbol || null,
          missed_usd: missedUSD,
          ath_price: athPrice,
          trade_price: tradePrice > 0 ? tradePrice : null,
          ath_change_pct: athChangePct,
        };
      })
      .sort((a: any, b: any) => b.missed_usd - a.missed_usd)
      .slice(0, 3);

    const updatedSummary = {
      total_missed_usd: tokens.reduce((sum, t) => Number(sum) + Number(t.totalMissedATH || 0), 0),
      total_volume_sol: existingSummary.total_volume_sol || 0,  // Preserve from full analysis
      total_pnl: existingSummary.total_pnl || 0,  // Preserve from full analysis
      success_rate: existingSummary.success_rate || 0,  // Preserve from full analysis
      winning_trades: existingSummary.winning_trades || 0,  // Preserve from full analysis
      losing_trades: existingSummary.losing_trades || 0,  // Preserve from full analysis
      total_trades: existingSummary.total_trades || 0,  // Preserve from full analysis
      priced_trades: existingSummary.priced_trades || 0,  // Preserve from full analysis
      trades_missing_price: existingSummary.trades_missing_price || 0,  // Preserve from full analysis
      tokens_discovered: tokens.length,
      total_transactions: (job.processedSignatures || 0) + newTransactionsCount,
      nft_count: existingSummary.nft_count || 0,  // Preserve from full analysis
      tokens_in_profit: tokensInProfit,
      tokens_in_loss: tokensInLoss,
      best_performer: bestPerformer,
      worst_performer: worstPerformer,
      top_pain_points: topPainPoints,
    };

    // Update job
    await db.update(walletAnalysisJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        currentResults: serializeBigInt(updatedSummary),
        processedSignatures: (job.processedSignatures || 0) + newTransactionsCount,
        totalSignatures: (job.processedSignatures || 0) + newTransactionsCount,
        lastSignature: latestSignature
      })
      .where(eq(walletAnalysisJobs.id, jobId));

    logger.info(`[ProcessIncrementalAnalysis] Completed - Added ${newTransactionsCount} new transactions`);

  } catch (error: any) {
    logger.error(`[ProcessIncrementalAnalysis] Failed:`, error);

    await db.update(walletAnalysisJobs)
      .set({ status: 'failed', error: error.message })
      .where(eq(walletAnalysisJobs.id, jobId));
  }
}