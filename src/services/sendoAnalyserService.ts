import {
  Service,
  IAgentRuntime,
  logger,
} from '@elizaos/core';
import { createHeliusService, setGlobalHeliusService, setGlobalBirdeyeService, getBirdeyeService } from './api/index.js';
import { decodeTxData, serializedBigInt } from '../utils/decoder/index.js';
import { parseTransactionsWithPriceAnalysis, calculateGlobalSummary } from '../utils/parseTrade.js';
import { getSendoAnalyserConfig, SENDO_ANALYSER_DEFAULTS, type SendoAnalyserConfig } from '../config/index.js';
import { createCachedBirdeyeService } from './cache/priceCache';
import { runCacheCleanup } from './cache';
import { startAnalysisJob, getAnalysisStatus, getAnalysisTransactions } from './analysis';
import type { HeliusService } from './api/helius.js';
import type { BirdeyeService } from './api/birdeyes.js';

export const SENDO_ANALYSER_SERVICE_NAME = 'sendo_analyser';

export class SendoAnalyserService extends Service {
  static serviceType = SENDO_ANALYSER_SERVICE_NAME;
  private serviceConfig: SendoAnalyserConfig;
  private heliusService: HeliusService;
  private birdeyeService: BirdeyeService;

  get capabilityDescription(): string {
    return 'Sendo Analyser service that provides Solana wallet analysis, trades, tokens, NFTs, and transactions decoding';
  }

  constructor(runtime: IAgentRuntime) {
    super(runtime);

    const config = getSendoAnalyserConfig(runtime);

    if (!config) {
      throw new Error('HELIUS_API_KEY is required in environment variables');
    }

    this.serviceConfig = config;
    this.heliusService = createHeliusService(
      config.heliusApiKey,
      config.heliusRateLimit || SENDO_ANALYSER_DEFAULTS.HELIUS_RATE_LIMIT
    );

    // BirdEye service will be initialized in initialize() after runtime.db is available
    // Temporary placeholder that will be replaced
    this.birdeyeService = null as any;

    // Set global Helius service
    setGlobalHeliusService(this.heliusService);

    logger.info(`Sendo Analyser service initialized with Helius network: ${SENDO_ANALYSER_DEFAULTS.HELIUS_NETWORK}`);
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('[SendoAnalyserService] Initializing...');
    this.runtime = runtime;

    // Create BirdEye service with DynamicRateLimiter (uses global counter for fair sharing)
    this.birdeyeService = getBirdeyeService(
      this.serviceConfig.birdeyeApiKey
    ) as any;

    // Set global BirdEye service
    setGlobalBirdeyeService(this.birdeyeService);

    logger.info('[SendoAnalyserService] Initialized successfully with DynamicRateLimiter');
    logger.info(`[SendoAnalyserService] BirdEye RPS: ${SENDO_ANALYSER_DEFAULTS.BIRDEYE_MAX_RPS}, Usage: ${SENDO_ANALYSER_DEFAULTS.API_USAGE_PERCENT}%`);
  }

  async stop(): Promise<void> {
    logger.info('[SendoAnalyserService] Stopping...');
  }

  static async start(runtime: IAgentRuntime): Promise<SendoAnalyserService> {
    logger.info('Starting Sendo Analyser service');
    const service = new SendoAnalyserService(runtime);
    await service.initialize(runtime);
    return service;
  }

  static async stop(_runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping Sendo Analyser service');
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

  /**
   * Create cached BirdEye service wrapper
   */
  private getCachedBirdeyeService(): BirdeyeService {
    return createCachedBirdeyeService(this.getDb(), this.birdeyeService);
  }

  // ============================================
  // PRIVATE HELPER METHODS FOR API CALLS
  // ============================================

  /**
   * Internal method to get transactions data from Helius (without cache)
   * Used by legacy endpoints
   */
  private async getTransactionsData(address: string, limit: number, before?: string): Promise<any> {
    const transactions: any[] = [];
    const config: any = { limit };

    if (before) {
      config.before = before;
    }

    const signatures = await this.heliusService.getSignaturesForAddress(address, config);

    for (let i = 0; i < signatures.length; i++) {
      const signature = signatures[i];
      const transaction = await this.heliusService.getTransaction(signature.signature, {
        maxSupportedTransactionVersion: 0
      });

      if (transaction) {
        transactions.push(transaction);
      }

      // Add delay between requests (except for the last one)
      if (i < signatures.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      transactions,
      signatures: signatures.map(s => s.signature),
      hasMore: signatures.length === limit
    };
  }

  // ============================================
  // LEGACY WALLET ANALYSIS METHODS
  // These methods are kept for backward compatibility
  // New code should use async analysis endpoints instead
  // ============================================

  /**
   * Get trades for a wallet address with price analysis (LEGACY)
   * @deprecated Use async analysis endpoints instead for better performance
   */
  async getTradesForAddress(address: string, limit: number = 50, cursor?: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching trades for address: ${address}`);

      // Fetch transactions from Helius
      const result = await this.heliusService.getTransactionsForAddress(address, limit, cursor);
      const { transactions, signatures, hasMore } = result;

      // Fetch additional address data in parallel
      const [nfts, tokens, balance] = await Promise.all([
        this.heliusService.getAssetsByOwner({ ownerAddress: address }),
        this.heliusService.getTokenAccounts({ owner: address }),
        this.heliusService.getBalance(address)
      ]);

      // Parse transactions and analyze prices (optimized with caching and deduplication)
      const parsedTransactionsArray = await parseTransactionsWithPriceAnalysis(transactions, this.birdeyeService);

      // Calculate global summary
      const globalSummary = calculateGlobalSummary(parsedTransactionsArray);

      // Build pagination info
      const pagination = {
        limit: limit,
        hasMore: hasMore,
        nextCursor: signatures.length > 0 ? signatures[signatures.length - 1] : null,
        currentCursor: cursor || null,
        totalLoaded: transactions.length
      };

      // Return response
      return {
        message: 'Transactions retrieved successfully',
        version: '1.0.0',
        summary: globalSummary,
        pagination: pagination,
        global: {
          signatureCount: signatures.length,
          balance: serializedBigInt(balance),
          nfts: nfts,
          tokens: tokens,
        },
        trades: serializedBigInt(parsedTransactionsArray),
      };
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting trades:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get signatures for a wallet address (LEGACY)
   */
  async getSignaturesForAddress(address: string, limit: number = 5, cursor?: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching signatures for address: ${address}`);
      const config: any = { limit };
      if (cursor) {
        config.before = cursor;
      }
      const signatures = await this.heliusService.getSignaturesForAddress(address, config);

      const pagination = {
        limit: limit,
        hasMore: signatures.length === limit,
        nextCursor: signatures.length > 0 ? signatures[signatures.length - 1].signature : null,
        currentCursor: cursor || null,
        totalLoaded: signatures.length
      };

      return {
        signatures: serializedBigInt(signatures),
        pagination
      };
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting signatures:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get transactions for a wallet address (decoded) (LEGACY)
   */
  async getTransactionsForAddress(address: string, limit: number = 5, cursor?: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching transactions for address: ${address}`);

      const result = await this.getTransactionsData(address, limit, cursor);
      const transactions = result.transactions;
      const signatures = result.signatures;
      const hasMore = result.hasMore;
      const parsedTransactionsArray: any[] = [];

      for (const transaction of transactions) {
        const tx = await decodeTxData(transaction);
        parsedTransactionsArray.push(tx);
      }

      const pagination = {
        limit: limit,
        hasMore: hasMore,
        nextCursor: signatures.length > 0 ? signatures[signatures.length - 1] : null,
        currentCursor: cursor || null,
        totalLoaded: parsedTransactionsArray.length
      };

      return {
        transactions: serializedBigInt(parsedTransactionsArray),
        pagination
      };
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting transactions:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get token holdings for a wallet address (LEGACY)
   */
  async getTokensForAddress(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching tokens for address: ${address}`);
      const tokens = await this.heliusService.getTokenAccounts({ owner: address });
      return serializedBigInt(tokens);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting tokens:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get NFT holdings for a wallet address (LEGACY)
   */
  async getNftsForAddress(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching NFTs for address: ${address}`);
      const nfts = await this.heliusService.getAssetsByOwner({ ownerAddress: address });
      return serializedBigInt(nfts);
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting NFTs:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get wallet balance and global overview (LEGACY)
   */
  async getGlobalForAddress(address: string): Promise<any> {
    try {
      logger.info(`[SendoAnalyserService] Fetching global info for address: ${address}`);
      const balance = await this.heliusService.getBalance(address);
      return {
        balance: serializedBigInt(balance)
      };
    } catch (error: any) {
      logger.error('[SendoAnalyserService] Error getting global info:', error?.message || error);
      throw error;
    }
  }

  /**
   * Get complete wallet analysis (combines all data) (LEGACY)
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

  // ============================================
  // ASYNC ANALYSIS METHODS (NEW)
  // These are the new optimized endpoints with caching
  // ============================================

  /**
   * Start async wallet analysis job (or return existing)
   * @param address - Solana wallet address
   * @returns Job info with job_id and status
   */
  async startAsyncAnalysis(address: string): Promise<any> {
    const db = this.getDb();
    const cachedBirdeyeService = this.getCachedBirdeyeService();
    return startAnalysisJob(db, this.runtime.agentId, address, this.heliusService, cachedBirdeyeService);
  }

  /**
   * Get analysis job status with progress
   * @param address - Solana wallet address
   * @returns Job status with progress and results
   */
  async getAsyncAnalysisStatus(address: string): Promise<any> {
    const db = this.getDb();
    return getAnalysisStatus(db, address);
  }

  /**
   * Get paginated transactions from analysis job
   * @param address - Solana wallet address
   * @param page - Page number (starts at 1)
   * @param limit - Number of transactions per page
   * @returns Paginated transactions
   */
  async getAsyncAnalysisTokens(address: string, page: number = 1, limit: number = 50): Promise<any> {
    const db = this.getDb();
    return getAnalysisTransactions(db, address, page, limit);
  }

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  /**
   * Run cache cleanup (prices, transactions, jobs)
   * Should be scheduled to run periodically (e.g., daily cron)
   */
  async runCacheCleanup(): Promise<void> {
    const db = this.getDb();
    await runCacheCleanup(db);
  }
}