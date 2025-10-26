import {
  Service,
  IAgentRuntime,
  logger,
} from '@elizaos/core';
import { getTransactionsForAddress, getTokensForAddress, getNftsForAddress, getBalanceForAddress, getSignaturesForAddress } from './helius.js';
import { decodeTxData, serializedBigInt } from '../utils/decoder/index.js';
import { getPriceAnalysis } from './birdeyes.js';
import { getSignerTrades } from '../utils/decoder/extractBalances.js';

export class SendoAnalyserService extends Service {
  static serviceType = 'sendo_analyser';

  get capabilityDescription(): string {
    return 'Sendo Analyser service that provides Solana wallet analysis, trades, tokens, NFTs, and transactions decoding';
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('[SendoAnalyserService] Initializing...');
    this.runtime = runtime;
    logger.info('[SendoAnalyserService] Initialized successfully');
  }

  async stop(): Promise<void> {
    logger.info('[SendoAnalyserService] Stopping...');
  }

  static async start(runtime: IAgentRuntime): Promise<SendoAnalyserService> {
    const service = new SendoAnalyserService(runtime);
    await service.initialize(runtime);
    return service;
  }

  /**
   * Get the Drizzle database instance from runtime
   */
  private getDb(): any {
    const db = (this.runtime as any).db;
    if (!db) {
      throw new Error('Database not available in runtime');
    }
    return db;
  }

  // ============================================
  // WALLET ANALYSIS METHODS
  // ============================================

  /**
   * Get trades for a wallet address with price analysis
   * @param address - Solana wallet address
   * @param limit - Number of transactions to fetch (default: 5)
   * @returns Array of trades with price analysis
   */
  async getTradesForAddress(address: string, limit: number = 5): Promise<any[]> {
    try {
      logger.info(`[SendoAnalyserService] Fetching trades for address: ${address}`);

      const transactions = await getTransactionsForAddress(address, limit);
      const parsedTransactionsArray: any[] = [];

      for (const transaction of transactions) {
        const tx = await decodeTxData(transaction);

        if (tx.error === 'SUCCESS') {
          // Detect all signer trades
          const signerTrades = getSignerTrades(tx.balances);

          if (signerTrades.length > 0) {
            // Analyze price for each token trade
            const trades: any[] = [];

            for (const tokenTrade of signerTrades) {
              try {
                logger.debug(`Analyzing price for token: ${tokenTrade.mint} (${tokenTrade.changeType})`);
                const priceAnalysis = await getPriceAnalysis(tokenTrade.mint, tx.blockTime);

                if (priceAnalysis) {
                  trades.push({
                    mint: tokenTrade.mint,
                    tokenBalance: tokenTrade,
                    tradeType: tokenTrade.changeType,
                    priceAnalysis: {
                      purchasePrice: priceAnalysis.purchasePrice,
                      currentPrice: priceAnalysis.currentPrice,
                      athPrice: priceAnalysis.athPrice,
                      athTimestamp: priceAnalysis.athTimestamp,
                      priceHistoryPoints: priceAnalysis.priceHistory.length
                    }
                  });
                } else {
                  trades.push({
                    mint: tokenTrade.mint,
                    tokenBalance: tokenTrade,
                    tradeType: tokenTrade.changeType,
                    priceAnalysis: null
                  });
                }
              } catch (error: any) {
                logger.error(`Error analyzing price for ${tokenTrade.mint}:`, error?.message || error);
                trades.push({
                  mint: tokenTrade.mint,
                  tokenBalance: tokenTrade,
                  tradeType: tokenTrade.changeType,
                  priceAnalysis: null
                });
              }
            }

            parsedTransactionsArray.push({
              signature: tx.signature,
              recentBlockhash: tx.recentBlockhash,
              blockTime: tx.blockTime,
              fee: tx.fee,
              error: tx.error,
              status: tx.status,
              accounts: tx.accounts,
              balances: {
                signerAddress: tx.balances.signerAddress,
                solBalance: tx.balances.signerSolBalance,
                tokenBalances: tx.balances.signerTokenBalances,
              },
              trades: trades
            });
          }
        }
      }

      return serializedBigInt(parsedTransactionsArray);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting trades:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get signatures for a wallet address
   * @param address - Solana wallet address
   * @param limit - Number of signatures to fetch (default: 5)
   * @returns Array of transaction signatures
   */
  async getSignaturesForAddress(address: string, limit: number = 5): Promise<any[]> {
    try {
      logger.info(`[SendoAnalyserService] Fetching signatures for address: ${address}`);
      const signatures = await getSignaturesForAddress(address, limit);
      return serializedBigInt(signatures);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting signatures:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get transactions for a wallet address (decoded)
   * @param address - Solana wallet address
   * @param limit - Number of transactions to fetch (default: 5)
   * @returns Array of decoded transactions
   */
  async getTransactionsForAddress(address: string, limit: number = 5): Promise<any[]> {
    try {
      logger.info(`[SendoAnalyserService] Fetching transactions for address: ${address}`);

      const transactions = await getTransactionsForAddress(address, limit);
      const parsedTransactionsArray: any[] = [];

      for (const transaction of transactions) {
        const tx = await decodeTxData(transaction);
        parsedTransactionsArray.push(tx);
      }

      return serializedBigInt(parsedTransactionsArray);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting transactions:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get token holdings for a wallet address
   * @param address - Solana wallet address
   * @returns Token holdings information
   */
  async getTokensForAddress(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching tokens for address: ${address}`);
      const tokens = await getTokensForAddress(address);
      return serializedBigInt(tokens);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting tokens:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get NFT holdings for a wallet address
   * @param address - Solana wallet address
   * @returns NFT holdings information
   */
  async getNftsForAddress(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching NFTs for address: ${address}`);
      const nfts = await getNftsForAddress(address);
      return serializedBigInt(nfts);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting NFTs:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get wallet balance and global overview
   * @param address - Solana wallet address
   * @returns Wallet balance and overview
   */
  async getGlobalForAddress(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching global info for address: ${address}`);
      const balance = await getBalanceForAddress(address);
      return {
        balance: serializedBigInt(balance)
      };
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting global info:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get complete wallet analysis (combines all data)
   * @param address - Solana wallet address
   * @returns Complete wallet analysis
   */
  async getCompleteWalletAnalysis(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching complete analysis for address: ${address}`);

      const [balance, tokens, nfts, trades] = await Promise.all([
        this.getGlobalForAddress(address),
        this.getTokensForAddress(address),
        this.getNftsForAddress(address),
        this.getTradesForAddress(address, 10), // Get more trades for analysis
      ]);

      return {
        address,
        balance,
        tokens,
        nfts,
        trades,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting complete analysis:', error?.message || error);
      throw error;
    }
  }
}