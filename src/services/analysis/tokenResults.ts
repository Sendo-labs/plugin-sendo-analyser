/**
 * Token Analysis Results Module
 * Handles writing and updating token statistics in token_analysis_results table
 */

import { eq, desc, count, sql } from 'drizzle-orm';
import { logger } from '@elizaos/core';
import { tokenAnalysisResults, tokens } from '../../schemas/wallet-analysis';

/**
 * Upsert token analysis results (OPTIMIZED with batch operations)
 * Creates or updates a token's aggregated statistics for a job
 */
export async function upsertTokenResults(
  db: any,
  jobId: string,
  tokensMap: Map<string, any>
): Promise<void> {
  try {
    const tokensList = Array.from(tokensMap.values());
    if (tokensList.length === 0) return;

    const now = new Date();

    // Step 1: Batch upsert all token metadata (mint, symbol, name)
    // Use VALUES with multiple rows for single query
    // IMPORTANT: Chunk to avoid PostgreSQL 65k parameter limit
    const tokenMetadata = tokensList.map(token => ({
      mint: token.mint,
      symbol: token.symbol || token.tokenSymbol || null,
      name: token.name || null,
    }));

    // Chunk metadata into batches (max 50 tokens per query = ~150 params)
    const CHUNK_SIZE = 50;
    for (let i = 0; i < tokenMetadata.length; i += CHUNK_SIZE) {
      const chunk = tokenMetadata.slice(i, i + CHUNK_SIZE);

      await db.insert(tokens)
        .values(chunk)
        .onConflictDoUpdate({
          target: tokens.mint,
          set: {
            // Use SQL COALESCE to keep existing value if new is null
            symbol: sql`COALESCE(EXCLUDED.symbol, ${tokens.symbol})`,
            name: sql`COALESCE(EXCLUDED.name, ${tokens.name})`,
            updatedAt: now,
          }
        });
    }

    logger.debug(`[UpsertTokenResults] Batch upserted ${tokensList.length} token metadata in ${Math.ceil(tokensList.length / CHUNK_SIZE)} chunks`);

    // Step 2: Calculate averages and prepare batch upsert
    const analysisResults = tokensList.map(token => {
      // Calculate weighted average purchase price
      const sumTokensTraded = Number(token.sumTokensTraded || 0);
      const totalTokensTradedRaw = token.totalTokensTraded ?? sumTokensTraded;
      const totalTokensTraded = Number(totalTokensTradedRaw || 0);

      const averagePurchasePrice = sumTokensTraded > 0
        ? Number(token.sumPurchaseValue || 0) / sumTokensTraded
        : null;

      // Calculate average ATH price (simple average across trades)
      const averageAthPrice = token.tradeCount > 0
        ? Number(token.sumAthPrice || 0) / token.tradeCount
        : null;

      return {
        jobId,
        mint: token.mint,
        totalVolumeUSD: token.totalVolumeUSD || 0,
        totalVolumeSOL: token.totalVolumeSOL || 0,
        totalGainLoss: token.totalGainLoss || 0,
        totalMissedATH: token.totalMissedATH || 0,
        trades: token.tradeCount || 0,
        averagePurchasePrice,
        averageAthPrice,
        totalTokensTraded,
        updatedAt: now,
      };
    });

    // Batch INSERT with ON CONFLICT for all results
    // IMPORTANT: Chunk to avoid PostgreSQL 65k parameter limit
    for (let i = 0; i < analysisResults.length; i += CHUNK_SIZE) {
      const chunk = analysisResults.slice(i, i + CHUNK_SIZE);

      await db.insert(tokenAnalysisResults)
        .values(chunk)
        .onConflictDoUpdate({
          target: [tokenAnalysisResults.jobId, tokenAnalysisResults.mint],
          set: {
            totalVolumeUSD: sql`EXCLUDED.total_volume_usd`,
            totalVolumeSOL: sql`EXCLUDED.total_volume_sol`,
            totalGainLoss: sql`EXCLUDED.total_gain_loss`,
            totalMissedATH: sql`EXCLUDED.total_missed_ath`,
            trades: sql`EXCLUDED.trades`,
            averagePurchasePrice: sql`EXCLUDED.average_purchase_price`,
            averageAthPrice: sql`EXCLUDED.average_ath_price`,
            totalTokensTraded: sql`EXCLUDED.total_tokens_traded`,
            updatedAt: now,
          },
        });
    }

    logger.debug(`[UpsertTokenResults] Batch upserted ${tokensList.length} analysis results for job ${jobId.slice(0, 8)}... in ${Math.ceil(tokensList.length / CHUNK_SIZE)} chunks`);
  } catch (error: any) {
    logger.error(`[UpsertTokenResults] Error upserting tokens:`, error?.message);
    throw error;
  }
}

/**
 * Get token results for a job (paginated)
 * Joins with tokens table to get symbol and name
 */
export async function getTokenResults(
  db: any,
  jobId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ tokens: any[]; total: number }> {
  try {
    const offset = (page - 1) * limit;

    const tokensList = await db
      .select({
        // Essential fields from token_analysis_results
        id: tokenAnalysisResults.id,
        jobId: tokenAnalysisResults.jobId,
        mint: tokenAnalysisResults.mint,
        totalVolumeUSD: tokenAnalysisResults.totalVolumeUSD,
        totalVolumeSOL: tokenAnalysisResults.totalVolumeSOL,
        totalGainLoss: tokenAnalysisResults.totalGainLoss,
        totalMissedATH: tokenAnalysisResults.totalMissedATH,
        trades: tokenAnalysisResults.trades,
        averagePurchasePrice: tokenAnalysisResults.averagePurchasePrice,
        averageAthPrice: tokenAnalysisResults.averageAthPrice,
        totalTokensTraded: tokenAnalysisResults.totalTokensTraded,
        createdAt: tokenAnalysisResults.createdAt,
        updatedAt: tokenAnalysisResults.updatedAt,
        // Metadata from tokens table
        symbol: tokens.symbol,
        name: tokens.name,
      })
      .from(tokenAnalysisResults)
      .leftJoin(tokens, eq(tokenAnalysisResults.mint, tokens.mint))
      .where(eq(tokenAnalysisResults.jobId, jobId))
      .orderBy(desc(tokenAnalysisResults.totalMissedATH))  // Most painful first
      .limit(limit)
      .offset(offset);

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(tokenAnalysisResults)
      .where(eq(tokenAnalysisResults.jobId, jobId));

    return {
      tokens: tokensList,
      total: parseInt(totalCount as string) || 0,
    };
  } catch (error: any) {
    logger.error(`[GetTokenResults] Error fetching tokens:`, error?.message);
    throw error;
  }
}