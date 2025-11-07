/**
 * Database schemas for the Sendo Analyser Plugin
 *
 * This module exports all database table schemas used by the plugin.
 * These schemas are automatically migrated by ElizaOS's dynamic migration system.
 */

export {
  walletAnalysisJobs,
  tokens,
  tokenPriceCache,
  transactionCache,
  tokenAnalysisResults,
  sendoAnalyserSchema
} from './wallet-analysis.js';