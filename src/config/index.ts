import type { IAgentRuntime } from '@elizaos/core';

/**
 * Configuration interface for Sendo Analyser plugin
 */
export interface SendoAnalyserConfig {
  heliusApiKey: string;
  birdeyeApiKey?: string;
  birdeyeRateLimit?: number; // requests per second
  heliusRateLimit?: number; // requests per second
}

/**
 * Default configuration values
 */
export const SENDO_ANALYSER_DEFAULTS = {
  BIRDEYE_RATE_LIMIT: 1, // 1 request per second by default
  HELIUS_RATE_LIMIT: 50, // 50 requests per second by default
  BIRDEYE_API_BASE: 'https://public-api.birdeye.so/defi',
  HELIUS_NETWORK: 'mainnet' as const,
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
  const birdeyeRateLimit = parseInt(runtime.getSetting('BIRDEYE_RATE_LIMIT') as string || String(SENDO_ANALYSER_DEFAULTS.BIRDEYE_RATE_LIMIT));
  const heliusRateLimit = parseInt(runtime.getSetting('HELIUS_RATE_LIMIT') as string || String(SENDO_ANALYSER_DEFAULTS.HELIUS_RATE_LIMIT));

  return {
    heliusApiKey,
    birdeyeApiKey: birdeyeApiKey || undefined,
    birdeyeRateLimit: birdeyeRateLimit || SENDO_ANALYSER_DEFAULTS.BIRDEYE_RATE_LIMIT,
    heliusRateLimit: heliusRateLimit || SENDO_ANALYSER_DEFAULTS.HELIUS_RATE_LIMIT,
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