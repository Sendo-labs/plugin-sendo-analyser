/**
 * Zod schemas for LLM response validation
 */

import { z } from 'zod';

// Schema for wallet analysis generation
export const generateWalletAnalysisSchema = z.object({
  tradingBehavior: z.object({
    totalTrades: z.number(),
    winRate: z.number().min(0).max(100),
    averageProfit: z.number(),
    totalProfitLoss: z.number(),
    preferredProtocols: z.array(z.string()),
    tradingFrequency: z.enum(['low', 'medium', 'high']),
    favoriteTokens: z.array(z.string()),
  }),
  riskProfile: z.object({
    riskLevel: z.enum(['low', 'medium', 'high']),
    concentration: z.number().min(0).max(1),
    volatility: z.number().min(0).max(1),
    liquidityRisk: z.number().min(0).max(1),
    factors: z.array(z.string()),
  }),
  recommendations: z.array(z.string()),
  insights: z.array(z.string()),
});

export type GenerateWalletAnalysisResponse = z.infer<typeof generateWalletAnalysisSchema>;

// Schema for portfolio analysis
export const generatePortfolioAnalysisSchema = z.object({
  totalValue: z.number(),
  allocation: z.array(z.object({
    mint: z.string(),
    symbol: z.string(),
    percentage: z.number(),
    valueUsd: z.number(),
  })),
  diversification: z.number().min(0).max(1),
  opportunities: z.array(z.string()),
});

export type GeneratePortfolioAnalysisResponse = z.infer<typeof generatePortfolioAnalysisSchema>;

// Schema for market insights
export const generateMarketInsightsSchema = z.object({
  trendingTokens: z.array(z.string()),
  marketSentiment: z.enum(['bullish', 'bearish', 'neutral']),
  warnings: z.array(z.string()),
});

export type GenerateMarketInsightsResponse = z.infer<typeof generateMarketInsightsSchema>;