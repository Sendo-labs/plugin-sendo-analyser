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
      if (!trade.mint || !trade.amount) return;

      const mint = trade.mint;
      const priceAnalysis = trade.priceAnalysis;

      // Calculate values (same logic as main worker)
      const volume = Number(trade.volume || 0);
      const missedATH = Number(trade.missedATH || 0);
      const pnl = priceAnalysis
        ? Number(trade.amount) * (Number(priceAnalysis.currentPrice) - Number(priceAnalysis.purchasePrice))
        : 0;
      const gainLoss = Number(trade.gainLoss || 0);

      if (tokensMap.has(mint)) {
        const existing = tokensMap.get(mint);
        tokensMap.set(mint, {
          ...existing,
          totalVolumeUSD: Number(existing.totalVolumeUSD || 0) + volume,
          totalMissedATH: Number(existing.totalMissedATH || 0) + missedATH,
          totalPnlUSD: Number(existing.totalPnlUSD || 0) + pnl,
          totalGainLoss: Number(existing.totalGainLoss || 0) + gainLoss,
          tradeCount: Number(existing.tradeCount || 0) + 1,
          // Update cumulative sums for accurate calculations
          sumAthPrice: Number(existing.sumAthPrice || 0) + (priceAnalysis ? Number(priceAnalysis.athPrice) : 0),
          sumPurchaseValue: Number(existing.sumPurchaseValue || 0) + (priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.purchasePrice) : 0),
          sumTradeValue: Number(existing.sumTradeValue || 0) + (priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.currentPrice) : 0),
          sumTokensTraded: Number(existing.sumTokensTraded || 0) + (priceAnalysis ? Number(trade.amount) : 0),
          totalTokensTraded: Number(existing.totalTokensTraded || 0) + Number(trade.amount),
          pricedTrades: Number(existing.pricedTrades || 0) + (priceAnalysis ? 1 : 0),
          tradesMissingPrice: Number(existing.tradesMissingPrice || 0) + (priceAnalysis ? 0 : 1),
        });
      } else {
        // New token
        tokensMap.set(mint, {
          mint,
          symbol: trade.tokenSymbol,
          name: null,
          tokenSymbol: trade.tokenSymbol,
          totalVolumeUSD: volume,
          totalVolumeSOL: 0, // SOL volume not available in parseTrade
          totalMissedATH: missedATH,
          totalPnlUSD: pnl,
          totalGainLoss: gainLoss,
          tradeCount: 1,
          // Initialize cumulative sums
          sumAthPrice: priceAnalysis ? Number(priceAnalysis.athPrice) : 0,
          sumPurchaseValue: priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.purchasePrice) : 0,
          sumTradeValue: priceAnalysis ? Number(trade.amount) * Number(priceAnalysis.currentPrice) : 0,
          sumTokensTraded: priceAnalysis ? Number(trade.amount) : 0,
          totalTokensTraded: Number(trade.amount),
          pricedTrades: priceAnalysis ? 1 : 0,
          tradesMissingPrice: priceAnalysis ? 0 : 1,
        });
      }
    });
  });
}

