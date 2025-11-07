import { sql } from 'drizzle-orm';
import { pgSchema, uuid, timestamp, jsonb, integer, text, numeric, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * Sendo Analyser schema for better isolation
 */
export const sendoAnalyserSchema = pgSchema('sendo_analyser');

/**
 * Wallet analysis jobs table
 * Tracks asynchronous wallet analysis jobs
 */
export const walletAnalysisJobs = sendoAnalyserSchema.table('wallet_analysis_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull(),
  agentId: uuid('agent_id').notNull(),

  // Status: pending | processing | completed | failed
  status: text('status').notNull().default('pending'),

  // Progression
  totalSignatures: integer('total_signatures'),
  processedSignatures: integer('processed_signatures').default(0),
  currentBatch: integer('current_batch').default(0),

  // Timestamps
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  lastHeartbeat: timestamp('last_heartbeat'),  // Updated every 30s during processing to detect crashes

  // Results
  currentResults: jsonb('current_results'),  // Results updated after each batch (final when completed)
  allTransactions: jsonb('all_transactions'), // All transactions for server-side pagination

  // Error handling
  error: text('error'),
  lastCursor: text('last_cursor'),           // For resuming on error
  retryCount: integer('retry_count').default(0),
});

/**
 * Tokens table
 * Stores permanent token metadata (symbol, name) to avoid duplication
 */
export const tokens = sendoAnalyserSchema.table('tokens', {
  // Identification (mint is the primary key)
  mint: text('mint').primaryKey(),
  symbol: text('symbol'),
  name: text('name'),

  // Timestamps
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
});

/**
 * Token price cache table
 * Caches token prices to avoid redundant BirdEye API calls
 * References tokens table for metadata (symbol, name)
 */
export const tokenPriceCache = sendoAnalyserSchema.table('token_price_cache', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identification (foreign key to tokens table)
  mint: text('mint').notNull().references(() => tokens.mint, { onDelete: 'cascade' }),

  // Prices
  purchasePrice: numeric('purchase_price'),  // Price at purchase time
  currentPrice: numeric('current_price').notNull(),
  athPrice: numeric('ath_price'),            // All-Time High
  athTimestamp: integer('ath_timestamp'),

  // Timestamps
  purchaseTimestamp: integer('purchase_timestamp').notNull(),
  lastUpdated: timestamp('last_updated').default(sql`now()`).notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),

  // Complete price history (JSONB array)
  priceHistory: jsonb('price_history'),  // Array of { unixTime, value }
});

/**
 * Transaction cache table (OPTIMIZED - lightweight)
 * Caches only essential transaction data and calculated trades
 */
export const transactionCache = sendoAnalyserSchema.table('transaction_cache', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identification
  signature: text('signature').notNull().unique(),
  walletAddress: text('wallet_address').notNull(),

  // Essential metadata only
  blockTime: integer('block_time').notNull(),
  solBalanceChange: numeric('sol_balance_change'),  // SOL balance change for volume calculation

  // Calculated trades (lightweight JSONB)
  // Array of { type, mint, tokenSymbol, amount, priceUSD, volumeUSD, athPriceUSD, missedATH, gainLoss }
  trades: jsonb('trades').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
});

/**
 * Token analysis results table
 * Stores per-token aggregated statistics for each analysis job
 * Enables pagination and incremental updates during processing
 */
export const tokenAnalysisResults = sendoAnalyserSchema.table('token_analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Foreign key to job
  jobId: uuid('job_id').notNull().references(() => walletAnalysisJobs.id, { onDelete: 'cascade' }),

  // Token identification (foreign key to tokens table)
  mint: text('mint').notNull().references(() => tokens.mint, { onDelete: 'cascade' }),

  // Aggregated statistics
  totalVolumeUSD: numeric('total_volume_usd').notNull().default('0'),
  totalVolumeSOL: numeric('total_volume_sol').notNull().default('0'),
  totalGainLoss: numeric('total_gain_loss').notNull().default('0'),
  totalMissedATH: numeric('total_missed_ath').notNull().default('0'),
  trades: integer('trades').notNull().default(0),

  // Price statistics
  averagePurchasePrice: numeric('average_purchase_price'),
  averageAthPrice: numeric('average_ath_price'),

  // Token quantities
  totalTokensTraded: numeric('total_tokens_traded').notNull().default('0'),

  // Timestamps
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  // Unique constraint: one row per (job_id, mint)
  jobMintIdx: uniqueIndex('token_results_job_mint_idx').on(table.jobId, table.mint),
  // Index for pagination queries
  jobIdIdx: index('token_results_job_id_idx').on(table.jobId),
  // Index for sorting by missed ATH (most painful first)
  missedAthIdx: index('token_results_missed_ath_idx').on(table.jobId, table.totalMissedATH),
}));