import { Plugin, logger } from '@elizaos/core';
import { SendoAnalyserService } from './services/sendoAnalyserService.js';
import { sendoAnalyserRoutes } from './routes/index.js';
import * as schema from './schemas/index.js';

export * from './types/index.js';
export * from './schemas/index.js';
export { SendoAnalyserService };

/**
 * Sendo Analyser plugin for ElizaOS
 *
 * Provides Solana wallet analysis, transaction decoding, and blockchain insights.
 *
 * **Components**:
 * - `SendoAnalyserService`: Manages all wallet analysis operations
 * - REST API Routes: 6 endpoints for wallet data retrieval
 * - Database: Automatic migrations via Drizzle ORM schemas
 * - Transaction Decoders: Support for Jupiter, Raydium, Pump.fun, Orca, Meteora, Whirlpool
 *
 * **Database Tables**:
 * - `wallet_analysis_cache`: Caches wallet data (trades, tokens, NFTs, transactions)
 * - `wallet_insights`: Stores LLM-generated insights and recommendations
 *
 * **API Endpoints**:
 * - GET /trades/:address - Get wallet trades with price analysis
 * - GET /transactions/:address - Get decoded transactions
 * - GET /tokens/:address - Get token holdings
 * - GET /nfts/:address - Get NFT holdings
 * - GET /global/:address - Get wallet balance and overview
 * - GET /wallet/:address - Get complete wallet analysis
 *
 * **Supported Protocols**:
 * - Jupiter V6 (DEX Aggregator)
 * - Raydium (AMM)
 * - Pump.fun (Token Launcher)
 * - Orca (Fair-price AMM)
 * - Meteora (Dynamic DLMM)
 * - Whirlpool (Concentrated Liquidity)
 *
 * **Required Environment Variables**:
 * - `HELIUS_API_KEY`: Required - Helius API key for Solana blockchain data
 * - `BIRDEYE_API_KEY`: Optional - Birdeye API key for token price data
 * - `BIRDEYE_RATE_LIMIT`: Optional - Rate limit for Birdeye API (requests per second, default: 1)
 */
export const sendoAnalyserPlugin: Plugin = {
  name: 'plugin-sendo-analyser',
  description: 'Sendo Analyser provides comprehensive Solana wallet analysis, transaction decoding, and blockchain insights with multi-protocol support',

  actions: [],
  providers: [],
  evaluators: [],
  services: [SendoAnalyserService],
  routes: sendoAnalyserRoutes,

  // Export schema for automatic database migrations
  schema,

  init: async (_config: Record<string, string>): Promise<void> => {
    logger.info('Initializing Sendo Analyser plugin');
    // Note: API key validation is done in the Service constructor via runtime.getSetting()
    // The init function doesn't have access to character secrets, only process.env
    logger.info('Sendo Analyser plugin initialized successfully');
  },
};

export default sendoAnalyserPlugin;