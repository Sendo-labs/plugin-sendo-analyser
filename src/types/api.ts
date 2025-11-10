/**
 * API request/response types for plugin routes
 */

import type { WalletAnalysisResult, PortfolioAnalysis, MarketInsights } from './analysis.js';

// GET /wallet/:address/analysis
export interface GetWalletAnalysisData {
  analysis: WalletAnalysisResult;
}

// GET /wallet/:address/portfolio
export interface GetPortfolioAnalysisData {
  portfolio: PortfolioAnalysis;
}

// GET /wallet/:address/insights
export interface GetMarketInsightsData {
  insights: MarketInsights;
}

// POST /wallet/analyze
export interface AnalyzeWalletRequestBody {
  address: string;
  depth?: 'quick' | 'full'; // quick = basic overview, full = deep analysis with LLM
}

export interface AnalyzeWalletData {
  analysisId: string;
  analysis: WalletAnalysisResult;
  executionTimeMs: number;
}

// GET /analyses (paginated)
export interface GetAnalysesData {
  analyses: StoredAnalysis[];
  total: number;
  page: number;
  pageSize: number;
}

// Stored analysis record
export interface StoredAnalysis {
  id: string;
  walletAddress: string;
  analysis: WalletAnalysisResult;
  createdAt: Date;
  executionTimeMs: number;
}

// ============================================
// ASYNC ANALYSIS API TYPES (NEW)
// ============================================

// Job status enum
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'not_found';

// POST /analysis/start - Start async analysis
export interface StartAnalysisRequestBody {
  address: string;
}

export interface StartAnalysisResponse {
  job_id: string;
  wallet_address: string;
  status: JobStatus;
  is_incremental?: boolean;
}

// GET /analysis/:address/status - Get job status
export interface AnalysisStatusResponse {
  job_id?: string;
  wallet_address: string;
  status: JobStatus;
  message?: string;
  progress?: {
    processed: number;
    total: number | null;
    current_batch: number;
  };
  current_results?: any;  // Contains final results when status is 'completed'
  started_at?: Date;
  completed_at?: Date;
  last_heartbeat?: Date;  // Last time worker updated (for zombie detection)
  elapsed_seconds?: number;
  error?: string;
}

// Token analysis result from database
export interface TokenAnalysisResult {
  id: string;
  jobId: string;
  mint: string;
  symbol: string | null;
  name: string | null;
  totalVolumeUSD: string;
  totalVolumeSOL: string;
  totalGainLoss: string;      // Sum of percentages per token
  totalPnlUSD: string;         // Actual PNL in USD per token
  totalMissedATH: string;
  trades: number;
  averagePurchasePrice: string | null;
  averageAthPrice: string | null;
  totalTokensTraded: string;
  createdAt: string;
  updatedAt: string;
}

// Best/Worst performer stats
export interface PerformerStats {
  mint: string;
  symbol: string | null;
  pnl_sol: number;
  volume_sol: number;
}

// Top pain point stats
export interface PainPointStats {
  mint: string;
  symbol: string | null;
  missed_usd: number;
  ath_price: number;
  trade_price: number | null;  // Average price at which trades were executed
  ath_change_pct: number;  // Percentage change from ATH to average trade price
}

// Summary stats from analysis
export interface AnalysisSummary {
  total_missed_usd: number;
  total_volume_sol: number;
  total_pnl: number;
  success_rate: number;
  winning_trades: number;
  losing_trades: number;
  total_trades: number;
  priced_trades: number;
  trades_missing_price: number;
  tokens_discovered: number;
  total_transactions: number;
  nft_count: number;
  // Token distribution stats
  tokens_in_profit: number;
  tokens_in_loss: number;
  // Best/Worst performers
  best_performer: PerformerStats | null;
  worst_performer: PerformerStats | null;
  // Top 3 pain points (tokens with highest missed gains at ATH)
  top_pain_points: PainPointStats[];
}

// GET /analysis/:address/results - Get paginated tokens
export interface AnalysisResultsResponse {
  tokens: TokenAnalysisResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  analysisStatus: JobStatus;
  summary?: AnalysisSummary;
}

// ============================================
// LEADERBOARD API TYPES
// ============================================

// Badge types for leaderboard entries
export type LeaderboardBadge = 'diamond' | 'gold' | 'silver' | 'bronze';

// Time period filter
export type LeaderboardPeriod = 'all' | 'month' | 'week';

// Leaderboard entry
export interface LeaderboardEntry {
  wallet: string;
  total_missed_usd?: number;  // For Hall of Shame
  total_gains_usd?: number;   // For Hall of Fame (total_pnl when positive)
  rank: string;               // Humorous rank title
  badge?: LeaderboardBadge;   // Optional badge for top performers
  completed_at: Date;         // When the analysis was completed
  days_since_analysis: number; // Days since last analysis (for freshness indicator)
}

// GET /leaderboard/shame - Hall of Shame response
export interface ShameLeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  limit: number;
  period: LeaderboardPeriod;
}

// GET /leaderboard/fame - Hall of Fame response
export interface FameLeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  limit: number;
  period: LeaderboardPeriod;
}