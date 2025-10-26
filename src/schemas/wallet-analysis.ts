import { sql } from 'drizzle-orm';
import { pgSchema, uuid, timestamp, jsonb, integer, text } from 'drizzle-orm/pg-core';

/**
 * Sendo Analyser schema for better isolation
 */
export const sendoAnalyserSchema = pgSchema('sendo_analyser');

/**
 * Wallet analysis cache table
 * Stores wallet analysis results for caching and historical tracking
 */
export const walletAnalysisCache = sendoAnalyserSchema.table('wallet_analysis_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull(),
  agentId: uuid('agent_id').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),

  // Cached data (JSONB)
  trades: jsonb('trades'),
  transactions: jsonb('transactions'),
  tokens: jsonb('tokens'),
  nfts: jsonb('nfts'),
  global: jsonb('global'),

  // Complete analysis
  completeAnalysis: jsonb('complete_analysis'),

  // Metadata
  executionTimeMs: integer('execution_time_ms'),
});

/**
 * LLM-generated insights table
 * Stores AI-generated insights about wallets
 */
export const walletInsights = sendoAnalyserSchema.table('wallet_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull(),
  agentId: uuid('agent_id').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),

  // LLM-generated insights (JSONB)
  tradingBehavior: jsonb('trading_behavior'),
  riskProfile: jsonb('risk_profile'),
  recommendations: jsonb('recommendations').notNull(),
  insights: jsonb('insights').notNull(),

  // Metadata
  modelUsed: text('model_used'),
  executionTimeMs: integer('execution_time_ms'),
});