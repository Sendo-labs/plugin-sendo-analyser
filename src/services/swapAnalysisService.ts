import { logger } from '@elizaos/core';
import type { HeliusService } from './api/helius.js';
import type { BirdeyeService } from './api/birdeyes.js';
import { decodeTxData } from '../utils/decoder/index.js';
import { extractBalances, type BalanceAnalysis, type TokenBalance, type SolBalance } from '../utils/decoder/extractBalances.js';

export interface SwapTransaction {
  signature: string;
  timestamp: number;
  blockTime: number;
  
  // Balance tracking (from decoder base)
  preBalance: string;        // SOL preBalance in lamports
  postBalance: string;      // SOL postBalance in lamports
  preTokenBalances: Array<{
    mint: string;
    owner: string;
    preAmount: string;
    preUiAmount: number;
    decimals: number;
  }>;
  postTokenBalances: Array<{
    mint: string;
    owner: string;
    postAmount: string;
    postUiAmount: number;
    decimals: number;
  }>;
  
  // Swap data (from decoder)
  swaps: Array<{
    programId: string;
    mintA: string;
    amountA: string | number;
    mintB: string;
    amountB: string | number;
    type?: 'buy' | 'sell' | 'swap';
  }>;
  
  // Volume calculation
  volumes: Array<{
    mint: string;
    volume: number;          // Exchange volume in token units
    volumeUSD?: number;      // Volume in USD (calculated after price lookup)
    timestamp: number;
  }>;
}

export interface SwapWithPriceAnalysis extends SwapTransaction {
  priceAnalysis: Array<{
    mint: string;
    purchasePrice: number;      // Price at transaction time
    currentPrice: number;        // Current price from Birdeye
    athPrice: number;            // All-time high between purchase and now
    athTimestamp: number;       // Timestamp of ATH
    purchaseTimestamp: number;   // Transaction timestamp
    gainLoss: number;            // Percentage gain/loss from purchase to current
    missedATH: number;           // Percentage missed by not selling at ATH
  }>;
}

/**
 * Check if a transaction contains a swap
 * Uses the decoder base architecture to detect swaps
 */
function hasSwap(decodedTx: any): boolean {
  // Method 1: Check if decoder found swaps in parsed array
  if (decodedTx.parsed && decodedTx.parsed.length > 0) {
    return true;
  }
  
  // Method 2: Check balance changes for token swaps
  if (decodedTx.balances) {
    const signerTokenBalances = decodedTx.balances.signerTokenBalances || [];
    // A swap typically involves multiple token balance changes
    const significantChanges = signerTokenBalances.filter((tb: TokenBalance) => 
      Math.abs(tb.uiChange) > 0.000001 // Very small threshold to catch all swaps
    );
    
    // If we have at least 2 token changes or 1 token change + SOL change, it's likely a swap
    if (significantChanges.length >= 1) {
      const solChange = decodedTx.balances.signerSolBalance;
      if (solChange && Math.abs(solChange.uiChange) > 0.001) {
        return true; // SOL + token change = swap
      }
      if (significantChanges.length >= 2) {
        return true; // Multiple token changes = swap
      }
    }
  }
  
  return false;
}

/**
 * Extract swap volumes from decoded transaction
 */
function extractSwapVolumes(decodedTx: any, timestamp: number): Array<{ mint: string; volume: number; timestamp: number }> {
  const volumes: Array<{ mint: string; volume: number; timestamp: number }> = [];
  
  // Extract from decoded swaps
  if (decodedTx.parsed && decodedTx.parsed.length > 0) {
    decodedTx.parsed.forEach((swap: any) => {
      // Volume is the absolute amount of tokens exchanged
      if (swap.mintA && swap.amountA) {
        const volumeA = typeof swap.amountA === 'string' ? parseFloat(swap.amountA) : swap.amountA;
        volumes.push({
          mint: swap.mintA,
          volume: Math.abs(volumeA),
          timestamp
        });
      }
      if (swap.mintB && swap.amountB) {
        const volumeB = typeof swap.amountB === 'string' ? parseFloat(swap.amountB) : swap.amountB;
        volumes.push({
          mint: swap.mintB,
          volume: Math.abs(volumeB),
          timestamp
        });
      }
    });
  }
  
  // Also extract from balance changes (fallback for swaps not decoded)
  if (decodedTx.balances && decodedTx.balances.signerTokenBalances) {
    decodedTx.balances.signerTokenBalances.forEach((tokenBalance: TokenBalance) => {
      if (Math.abs(tokenBalance.uiChange) > 0.000001) {
        volumes.push({
          mint: tokenBalance.mint,
          volume: Math.abs(tokenBalance.uiChange),
          timestamp
        });
      }
    });
  }
  
  return volumes;
}

/**
 * Main service class for swap analysis
 */
export class SwapAnalysisService {
  constructor(
    private heliusService: HeliusService,
    private birdeyeService: BirdeyeService
  ) {}

  /**
   * Retrieve signatures from wallet and filter for swap transactions
   * Optimized: Uses Helius getTransactionsForAddress which is more efficient
   */
  async getSwapSignatures(
    address: string,
    limit: number = 100,
    before?: string
  ): Promise<{ signatures: string[]; hasMore: boolean; nextCursor?: string }> {
    logger.info(`[SwapAnalysisService] Fetching and filtering swap signatures for address: ${address}`);
    
    // Use getTransactionsForAddress which is more efficient than fetching signatures then transactions
    const result = await this.heliusService.getTransactionsForAddress(address, limit, before);
    const { transactions, paginationToken, hasMore } = result;
    
    // Filter transactions for swaps using decoder base
    const swapSignatures: string[] = [];
    
    // Process transactions in parallel to check for swaps
    const swapChecks = await Promise.all(
      transactions.map(async (tx: any) => {
        try {
          if (!tx || tx.meta?.err) {
            return null;
          }
          
          // Decode transaction using decoder base architecture
          const decodedTx = await decodeTxData(tx);
          
          if (hasSwap(decodedTx)) {
            return tx.transaction.signatures[0];
          }
          
          return null;
        } catch (error) {
          logger.error(`[SwapAnalysisService] Error checking transaction:`, error as string);
          return null;
        }
      })
    );
    
    swapSignatures.push(...swapChecks.filter((s): s is string => s !== null));
    
    logger.info(`[SwapAnalysisService] Found ${swapSignatures.length} swap transactions out of ${transactions.length} total`);
    
    return {
      signatures: swapSignatures,
      hasMore,
      nextCursor: paginationToken
    };
  }

  async analyzeSwapTransactions(
    address: string,
    limit: number = 100,
    before?: string
  ): Promise<SwapTransaction[]> {
    logger.info(`[SwapAnalysisService] Analyzing swap transactions for address: ${address}`);
    
    // Step 1: Retrieve signatures/transactions from wallet
    // Use getTransactionsForAddress which is more efficient (gets transactions directly)
    const result = await this.heliusService.getTransactionsForAddress(address, limit, before);
    // console.log("🚀 ~ SwapAnalysisService ~ analyzeSwapTransactions ~ result:", JSON.stringify(result))
    const { transactions } = result;
    
    if (transactions.length === 0) {
      return [];
    }
    
    logger.info(`[SwapAnalysisService] Retrieved ${transactions.length} transactions, filtering for swaps...`);
    
    // Step 2: Decode all transactions in parallel using decoder base architecture
    const decodedTxs = await Promise.all(
      transactions.map(async (tx: any) => {
        try {
          if (!tx || tx.meta?.err) {
            return null;
          }
          
          // Decode using decoder base architecture
          // This already extracts balances (preBalance, postBalance, preTokenBalance, postTokenBalance)
          const decodedTx = await decodeTxData(tx);
          
          // Step 3: Filter to keep only transactions with swaps
          if (!hasSwap(decodedTx)) {
            return null;
          }
          
          return { tx, decodedTx };
        } catch (error) {
          logger.error(`[SwapAnalysisService] Error decoding transaction:`, error as string);
          return null;
        }
      })
    );
    
    // Filter out null results and build swap transactions
    const swapTransactions: SwapTransaction[] = [];
    
    for (const result of decodedTxs) {
      if (!result) continue;
      
      const { tx, decodedTx } = result;
      const signature = tx.transaction.signatures[0];
      const timestamp = tx.blockTime ? (typeof tx.blockTime === 'string' ? parseInt(tx.blockTime) : tx.blockTime) : Date.now() / 1000;
      
      // Balance information is already extracted by decodeTxData via extractBalances
      // This provides: preBalance, postBalance, preTokenBalance, postTokenBalance
      const balanceAnalysis = decodedTx.balances;
      
      // Get signer SOL balance (preBalance, postBalance)
      const signerSolBalance = balanceAnalysis.signerSolBalance || 
        balanceAnalysis.solBalances.find((b: SolBalance) => b.accountIndex === 0);
      
      // Extract swap data from decoder (parsed array contains swap data from extractSwapData)
      const swaps: Array<any> = [];
      if (decodedTx.parsed && decodedTx.parsed.length > 0) {
        swaps.push(...decodedTx.parsed);
      }
      
      // Step 4: Calculate exchange volumes with timestamps
      const volumes = extractSwapVolumes(decodedTx, timestamp);
      
      // Build pre/post token balances (preTokenBalance, postTokenBalance)
      const preTokenBalances = balanceAnalysis.tokenBalances.map((tb: TokenBalance) => ({
        mint: tb.mint,
        owner: tb.owner,
        preAmount: tb.preAmount,
        preUiAmount: tb.preUiAmount,
        decimals: tb.decimals
      }));
      
      const postTokenBalances = balanceAnalysis.tokenBalances.map((tb: TokenBalance) => ({
        mint: tb.mint,
        owner: tb.owner,
        postAmount: tb.postAmount,
        postUiAmount: tb.postUiAmount,
        decimals: tb.decimals
      }));
      
      swapTransactions.push({
        signature,
        timestamp,
        blockTime: timestamp,
        preBalance: signerSolBalance?.preBalance || '0',
        postBalance: signerSolBalance?.postBalance || '0',
        preTokenBalances,
        postTokenBalances,
        swaps,
        volumes
      });
    }
    
    logger.info(`[SwapAnalysisService] Analyzed ${swapTransactions.length} swap transactions out of ${transactions.length} total`);
    return swapTransactions;
  }

  /**
   * Add price analysis to swap transactions
   * Looks up purchase prices with Birdeye + ATH between purchase time and current price
   */
  async addPriceAnalysis(
    swapTransactions: SwapTransaction[]
  ): Promise<SwapWithPriceAnalysis[]> {
    logger.info(`[SwapAnalysisService] Adding price analysis for ${swapTransactions.length} swap transactions`);
    
    // Collect all unique mints with their timestamps
    const mintTimestamps = new Map<string, number>();
    
    swapTransactions.forEach(tx => {
      tx.volumes.forEach(vol => {
        const existing = mintTimestamps.get(vol.mint);
        if (!existing || vol.timestamp < existing) {
          mintTimestamps.set(vol.mint, vol.timestamp);
        }
      });
    });
    
    // Fetch price analysis for all mints
    const priceAnalysisMap = new Map<string, any>();
    
    const pricePromises = Array.from(mintTimestamps.entries()).map(async ([mint, purchaseTimestamp]) => {
      try {
        const priceAnalysis = await this.birdeyeService.getPriceAnalysis(
          mint,
          purchaseTimestamp
        );
        
        if (priceAnalysis) {
          priceAnalysisMap.set(mint, {
            ...priceAnalysis,
            purchaseTimestamp
          });
        }
      } catch (error) {
        logger.error(`[SwapAnalysisService] Error fetching price analysis for ${mint}:`, error as string);
      }
    });
    
    await Promise.all(pricePromises);
    
    // Add price analysis to each swap transaction
    const result: SwapWithPriceAnalysis[] = swapTransactions.map(tx => {
      const priceAnalysis: Array<any> = [];
      
      // Get unique mints from this transaction
      const uniqueMints = new Set<string>();
      tx.volumes.forEach(vol => uniqueMints.add(vol.mint));
      
      uniqueMints.forEach(mint => {
        const analysis = priceAnalysisMap.get(mint);
        if (analysis) {
          // Calculate volume in USD
          const volume = tx.volumes.find(v => v.mint === mint)?.volume || 0;
          const volumeUSD = volume * analysis.purchasePrice;
          
          // Update volume with USD
          const volumeIndex = tx.volumes.findIndex(v => v.mint === mint);
          if (volumeIndex >= 0) {
            tx.volumes[volumeIndex].volumeUSD = volumeUSD;
          }
          
          // Calculate gain/loss and missed ATH
          const gainLoss = analysis.currentPrice > 0 
            ? ((analysis.currentPrice - analysis.purchasePrice) / analysis.purchasePrice) * 100 
            : 0;
          
          const missedATH = analysis.athPrice > analysis.currentPrice
            ? ((analysis.athPrice - analysis.currentPrice) / analysis.currentPrice) * 100
            : 0;
          
          priceAnalysis.push({
            mint,
            purchasePrice: analysis.purchasePrice,
            currentPrice: analysis.currentPrice,
            athPrice: analysis.athPrice,
            athTimestamp: analysis.athTimestamp,
            purchaseTimestamp: analysis.purchaseTimestamp,
            gainLoss,
            missedATH
          });
        }
      });
      
      return {
        ...tx,
        priceAnalysis
      };
    });
    
    logger.info(`[SwapAnalysisService] Added price analysis to ${result.length} swap transactions`);
    return result;
  }

  /**
   * Complete swap analysis workflow
   * Combines all steps: retrieve signatures, filter swaps, calculate volumes, add price analysis
   */
  async analyzeWalletSwaps(
    address: string,
    limit: number = 100,
    before?: string
  ): Promise<SwapWithPriceAnalysis[]> {
    logger.info(`[SwapAnalysisService] Starting complete swap analysis for address: ${address}`);
    
    // Step 1: Analyze swap transactions
    const swapTransactions = await this.analyzeSwapTransactions(address, limit, before);
    
    if (swapTransactions.length === 0) {
      return [];
    }
    
    // Step 2: Add price analysis
    const swapsWithPrices = await this.addPriceAnalysis(swapTransactions);
    
    logger.info(`[SwapAnalysisService] Complete swap analysis finished: ${swapsWithPrices.length} swaps analyzed`);
    return swapsWithPrices;
  }
}

