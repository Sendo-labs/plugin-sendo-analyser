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