import type { IAgentRuntime } from '@elizaos/core';

/**
 * Configuration interface for Sendo Analyser plugin
 */
export interface SendoAnalyserConfig {
  heliusApiKey: string;
  birdeyeApiKey?: string;
  birdeyeRateLimit?: number; // requests per second
  heliusRateLimit?: number; // requests per second
  birdeyePriceTimeframe?: BirdEyeTimeframe; // historical price data granularity
  maxConcurrentJobs?: number; // maximum number of analysis jobs running in parallel
}

/**
 * BirdEye API Timeframe options for historical price data
 * - 1m, 5m, 15m, 30m: High precision but requires many API calls for long periods
 * - 1H, 4H: Balanced precision and API efficiency
 * - 1D: Best API efficiency (1000 days per request) - RECOMMENDED for ATH detection
 */
export type BirdEyeTimeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D';

/**
 * Default configuration values
 */
export const SENDO_ANALYSER_DEFAULTS = {
  BIRDEYE_MAX_RPS: 50,     // Your BirdEye subscription: 50 RPS, 1000 RPM
  HELIUS_MAX_RPS: 200,     // Your Helius subscription: 200 RPS
  API_USAGE_PERCENT: 80,   // Use 80% of available RPS for safety margin (applied to both APIs)
  BIRDEYE_API_BASE: 'https://public-api.birdeye.so/defi',
  HELIUS_NETWORK: 'mainnet' as const,
  // Price history timeframe: '1D' = daily candles (best for ATH, ~1 API call per year of data)
  // Alternative: '1H' = hourly (more precise but ~9 API calls per year)
  BIRDEYE_PRICE_TIMEFRAME: '1D' as BirdEyeTimeframe,
  // Job queue: Maximum number of concurrent analysis jobs (based on 4GB RAM / ~227MB per job)
  MAX_CONCURRENT_JOBS: 15,
};

/**
 * Extracts Sendo Analyser configuration from runtime settings
 * @param runtime - ElizaOS agent runtime instance
 * @returns Sendo Analyser service configuration or null if required keys are missing
 */
export function getSendoAnalyserConfig(runtime: IAgentRuntime): SendoAnalyserConfig | null {
  const heliusApiKey = runtime.getSetting('HELIUS_API_KEY') as string;

  if (!heliusApiKey || heliusApiKey.trim() === '') {
    console.error('[ERROR getSendoAnalyserConfig] HELIUS_API_KEY is empty or null');
    return null;
  }

  const birdeyeApiKey = runtime.getSetting('BIRDEYE_API_KEY') as string;
  const birdeyePriceTimeframe = (runtime.getSetting('BIRDEYE_PRICE_TIMEFRAME') as BirdEyeTimeframe) || SENDO_ANALYSER_DEFAULTS.BIRDEYE_PRICE_TIMEFRAME;
  const maxConcurrentJobs = parseInt(runtime.getSetting('MAX_CONCURRENT_JOBS') as string || String(SENDO_ANALYSER_DEFAULTS.MAX_CONCURRENT_JOBS));

  // Calculate rate limits with API_USAGE_PERCENT (80% of max by default)
  const apiUsagePercent = parseInt(runtime.getSetting('API_USAGE_PERCENT') as string || String(SENDO_ANALYSER_DEFAULTS.API_USAGE_PERCENT));
  const birdeyeMaxRps = parseInt(runtime.getSetting('BIRDEYE_MAX_RPS') as string || String(SENDO_ANALYSER_DEFAULTS.BIRDEYE_MAX_RPS));
  const heliusMaxRps = parseInt(runtime.getSetting('HELIUS_MAX_RPS') as string || String(SENDO_ANALYSER_DEFAULTS.HELIUS_MAX_RPS));

  const birdeyeRateLimit = Math.floor(birdeyeMaxRps * apiUsagePercent / 100);
  const heliusRateLimit = Math.floor(heliusMaxRps * apiUsagePercent / 100);

  return {
    heliusApiKey,
    birdeyeApiKey: birdeyeApiKey || undefined,
    birdeyeRateLimit,
    heliusRateLimit,
    birdeyePriceTimeframe,
    maxConcurrentJobs,
  };
}

/**
 * Solana program addresses mapping
 */
export const programs = {
  // System Programs
  '11111111111111111111111111111111': 'System',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
  'ComputeBudget111111111111111111111111111111': 'Compute Budget',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': 'Associated Token',
  // DEX Programs
  // Pump.fun
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'Pump.fun',
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA': 'Pump.fun AMM',
  // OKX DEX
  '6m2CDdhRgxpH4WjvdzxAYbGxwdGUz5MziiL5jek2kBma': 'OKX DEX V2',
  // Jupiter
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'Jupiter V4',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter V6',
  // Raydium
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h': 'Raydium Stable Swap AMM',
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium CPMM',
  'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'Raydium LaunchLab',
  'WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh': 'Raydium Launchpad Authority',
  // DFlow
  'DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH': 'DFlow V4',
  // Axiom Trading
  'AxiomfHaWDemCFBLBayqnEnNwE6b7B2Qz3UmzMpgbMG6': 'Axiom Trading 1',
  'AxiomxSitiyXyPjKgJ9XSrdhsydtZsskZTEDam3PxKcC': 'Axiom Trading 2',
  // Photon
  'BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW': 'Photon',
  // Meteora
  'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'Meteora DAMM V2',
  'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN': 'Meteora CPMM Dynamic Bonding Curve',
  // Whirlpool
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Whirlpool V2',
  // Orca
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'Orca V2',
};