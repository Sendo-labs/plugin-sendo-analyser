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

// GET /analysis/:address/results - Get paginated tokens
export interface AnalysisResultsResponse {
  tokens: any[];  // Array of token analysis results
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  analysisStatus: JobStatus;
  summary?: any;  // Overall summary stats
}