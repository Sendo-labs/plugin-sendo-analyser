/**
 * Type definitions for plugin-sendo-analyser
 */

// Wallet data types
export type {
  TokenHolding,
  NftHolding,
  Trade,
  Transaction,
  DecodedInstruction,
  WalletOverview,
} from './wallet.js';

// Analysis results
export type {
  WalletAnalysisResult,
  TradingBehavior,
  RiskProfile,
  PortfolioAnalysis,
  TokenAllocation,
  MarketInsights,
} from './analysis.js';

// API types
export type {
  GetWalletAnalysisData,
  GetPortfolioAnalysisData,
  GetMarketInsightsData,
  AnalyzeWalletRequestBody,
  AnalyzeWalletData,
  GetAnalysesData,
  StoredAnalysis,
} from './api.js';

// Schemas for LLM validation
export {
  generateWalletAnalysisSchema,
  generatePortfolioAnalysisSchema,
  generateMarketInsightsSchema,
} from './schemas.js';
export type {
  GenerateWalletAnalysisResponse,
  GeneratePortfolioAnalysisResponse,
  GenerateMarketInsightsResponse,
} from './schemas.js';