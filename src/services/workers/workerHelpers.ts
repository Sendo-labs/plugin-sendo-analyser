import { parseTransactionsWithPriceAnalysis } from '../../utils/parseTrade';
import type { BirdeyeService } from '../api/birdeyes';

/**
 * Worker Helper Functions
 * Shared utilities for analysis workers
 */

/**
 * Process new transactions and merge with existing tokens map
 * @param transactions - New transactions to process
 * @param tokensMap - Existing tokens map (will be mutated)
 * @param birdeyeService - BirdEye service for price analysis
 */
export async function processNewTransactions(
  transactions: any[],
  tokensMap: Map<string, any>,
  birdeyeService: BirdeyeService
): Promise<void> {
  const parsed = await parseTransactionsWithPriceAnalysis(transactions, birdeyeService);

  parsed.forEach((tx: any) => {
    tx.trades?.forEach((trade: any) => {
      const mint = trade.mint;

      if (tokensMap.has(mint)) {
        const existing = tokensMap.get(mint);
        // Handle both 'tradeCount' (in-memory) and 'trades' (from DB)
        const currentTradeCount = existing.tradeCount || existing.trades || 0;
        tokensMap.set(mint, {
          ...existing,
          totalVolume: Number(existing.totalVolume || 0) + Number(trade.volume || 0),
          totalMissedATH: Number(existing.totalMissedATH || 0) + Number(trade.missedATH || 0),
          tradeCount: Number(currentTradeCount) + 1
        });
      } else {
        tokensMap.set(mint, {
          mint,
          symbol: trade.tokenSymbol,
          totalVolume: trade.volume || 0,
          totalMissedATH: trade.missedATH || 0,
          tradeCount: 1
        });
      }
    });
  });
}

/**
 * Build final results object from tokens map
 * @param tokensMap - Map of token mint addresses to token data
 * @param allTransactions - All processed transactions
 * @returns Final results object
 */
export function buildFinalResults(tokensMap: Map<string, any>, allTransactions: any[]): any {
  const tokens = Array.from(tokensMap.values());

  return {
    total_missed_usd: tokens.reduce((sum, t) => sum + t.totalMissedATH, 0),
    total_volume: tokens.reduce((sum, t) => sum + t.totalVolume, 0),
    tokens_discovered: tokens.length,
    tokens: tokens,
    transactions: allTransactions
  };
}