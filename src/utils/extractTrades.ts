/**
 * Extract lightweight trade data from a decoded transaction
 * This replaces storing the full transaction with just the essential trade info
 */

import { getSignerTrades, type TokenBalance } from './decoder/extractBalances.js';

export interface LightweightTrade {
  type: 'buy' | 'sell' | 'swap';
  mint: string;
  tokenSymbol?: string;
  amount: number;
  priceUSD?: number;
  volumeUSD?: number;
  athPriceUSD?: number;
  missedATH?: number;
  gainLoss?: number;
}

/**
 * Convert TokenBalance to LightweightTrade
 * Determines trade type based on balance change direction
 */
function convertBalanceToTrade(balance: TokenBalance): LightweightTrade {
  // Determine trade type based on balance change
  let type: 'buy' | 'sell' | 'swap' = 'swap';
  if (balance.changeType === 'increase') {
    type = 'buy';
  } else if (balance.changeType === 'decrease') {
    type = 'sell';
  }

  return {
    type,
    mint: balance.mint,
    tokenSymbol: undefined, // Will be enriched later with price data
    amount: Math.abs(balance.uiChange),
    priceUSD: undefined,
    volumeUSD: undefined,
    athPriceUSD: undefined,
    missedATH: undefined,
    gainLoss: undefined,
  };
}

/**
 * Extract trades from a parsed transaction
 * Returns lightweight trade objects with only essential data
 *
 * IMPORTANT: Extracts trades from BALANCE CHANGES, not decoded instructions
 * This ensures we capture ALL trades, even from DEXs we don't have decoders for
 */
export function extractTrades(parsedTransaction: any): LightweightTrade[] {
  if (!parsedTransaction || !parsedTransaction.balances) {
    return [];
  }

  // Extract signer trades from balance analysis
  const signerTrades = getSignerTrades(parsedTransaction.balances);

  if (signerTrades.length === 0) {
    return [];
  }

  // Convert TokenBalance[] to LightweightTrade[]
  return signerTrades.map(convertBalanceToTrade);
}