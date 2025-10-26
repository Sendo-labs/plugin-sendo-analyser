/**
 * Analysis result types for wallet insights
 */

import type { Trade, TokenHolding } from './wallet.js';

// Wallet analysis result
export interface WalletAnalysisResult {
  walletAddress: string;
  tradingBehavior: TradingBehavior;
  riskProfile: RiskProfile;
  recommendations: string[];
  insights: string[];
  timestamp: number;
}

// Trading behavior analysis
export interface TradingBehavior {
  totalTrades: number;
  winRate: number;
  averageProfit: number;
  totalProfitLoss: number;
  preferredProtocols: string[];
  tradingFrequency: 'low' | 'medium' | 'high';
  favoriteTokens: string[];
}

// Risk assessment
export interface RiskProfile {
  riskLevel: 'low' | 'medium' | 'high';
  concentration: number; // Portfolio concentration (0-1)
  volatility: number; // Price volatility exposure
  liquidityRisk: number; // Illiquid positions exposure
  factors: string[];
}

// Portfolio analysis
export interface PortfolioAnalysis {
  totalValue: number;
  allocation: TokenAllocation[];
  diversification: number; // 0-1 score
  topHoldings: TokenHolding[];
  underperformers: TokenHolding[];
  opportunities: string[];
}

// Token allocation
export interface TokenAllocation {
  mint: string;
  symbol: string;
  percentage: number;
  valueUsd: number;
}

// Market insights
export interface MarketInsights {
  trendingTokens: string[];
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  recentOpportunities: Trade[];
  warnings: string[];
}