import axios from 'axios';
import { RateLimiter } from '../../utils/rateLimiter.js';
import { SENDO_ANALYSER_DEFAULTS } from '../../config/index.js';

// BirdEye price data interface
export interface BirdEyePriceData {
  unixTime: number;
  value: number;
}

export interface BirdEyeResponse {
  success: boolean;
  data: {
    isScaledUiToken: boolean;
    items: BirdEyePriceData[];
  };
}

export interface BirdeyeService {
  getHistoricalPrices(
    mint: string,
    fromTimestamp: number,
    toTimestamp: number,
    timeframe?: '1m' | '3m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '8H' | '12H' | '1D' | '3D' | '1W' | '1M'
  ): Promise<BirdEyePriceData[]>;

  getFullHistoricalPrices(
    mint: string,
    fromTimestamp: number,
    toTimestamp: number,
    timeframe?: '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D'
  ): Promise<BirdEyePriceData[]>;

  getPriceAnalysis(
    mint: string,
    purchaseTimestamp: number
  ): Promise<{
    purchasePrice: number;
    currentPrice: number;
    athPrice: number;
    athTimestamp: number;
    priceHistory: BirdEyePriceData[];
  } | null>;
}

/**
 * Creates a Birdeye service instance
 * @param apiKey - Optional Birdeye API key
 * @param requestsPerSecond - Rate limit (requests per second)
 * @returns BirdeyeService instance
 */
export function getBirdeyeService(apiKey?: string, requestsPerSecond: number = 1): BirdeyeService {
  const birdEyeLimiter = new RateLimiter({
    requestsPerSecond,
    burstCapacity: 50,
    adaptiveTiming: true
  });
  const BIRDEYE_API_BASE = SENDO_ANALYSER_DEFAULTS.BIRDEYE_API_BASE;

  /**
   * Fetch price history for a token between two timestamps.
   */
  const getHistoricalPrices = async (
    mint: string,
    fromTimestamp: number,
    toTimestamp: number,
    timeframe: '1m' | '3m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | '6H' | '8H' | '12H' | '1D' | '3D' | '1W' | '1M' = '30m'
  ): Promise<BirdEyePriceData[]> => {
    return birdEyeLimiter.schedule(async () => {
      try {
        const response = await axios.get<BirdEyeResponse>(`${BIRDEYE_API_BASE}/history_price`, {
          params: {
            address: mint,
            address_type: 'token',
            type: timeframe,
            time_from: fromTimestamp,
            time_to: toTimestamp,
            ui_amount_mode: 'raw'
          },
          headers: {
            'accept': 'application/json',
            'x-chain': 'solana',
            ...(apiKey && { 'X-API-KEY': apiKey })
          },
          timeout: 5000
        });

        if (response.data.success && response.data.data.items) {
          return response.data.data.items;
        }
        return [];
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          console.warn(`Rate limit hit for ${mint}, retrying in 1s...`);
          await new Promise((r) => setTimeout(r, 1000));
          return [];
        }
        console.error(`BirdEye error for ${mint}:`, axios.isAxiosError(error) ? `${error.response?.status} - ${error.message}` : (error instanceof Error ? error.message : String(error)));
        return [];
      }
    });
  };

  /**
   * Fetch full price history between two timestamps with pagination.
   */
  const getFullHistoricalPrices = async (
    mint: string,
    fromTimestamp: number,
    toTimestamp: number,
    timeframe: '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' = '1m'
  ): Promise<BirdEyePriceData[]> => {
    let allPrices: BirdEyePriceData[] = [];
    let currentStart = fromTimestamp;

    while (currentStart < toTimestamp) {
      const chunk = await getHistoricalPrices(mint, currentStart, toTimestamp, timeframe);

      if (!chunk.length) break;

      allPrices = [...allPrices, ...chunk];

      const lastTimestamp = chunk[chunk.length - 1].unixTime;

      if (lastTimestamp <= currentStart) break;

      currentStart = lastTimestamp + 1;
    }

    // Deduplicate by unixTime
    return allPrices.filter((v, i, self) =>
      i === self.findIndex((t) => t.unixTime === v.unixTime)
    );
  };

  /**
   * Analyze price from purchase to now and compute ATH.
   */
  const getPriceAnalysis = async (
    mint: string,
    purchaseTimestamp: number
  ) => {
    const now = Math.floor(Date.now() / 1000);

    // Use 1H timeframe for balanced performance and data
    const priceHistory = await getFullHistoricalPrices(mint, purchaseTimestamp, now, '1H');

    if (!priceHistory.length) return null;

    const purchasePrice = priceHistory[0].value;
    const currentPrice = priceHistory[priceHistory.length - 1].value;

    let athPrice = purchasePrice;
    let athTimestamp = purchaseTimestamp;

    for (const price of priceHistory) {
      if (price.value > athPrice) {
        athPrice = price.value;
        athTimestamp = price.unixTime;
      }
    }

    return { purchasePrice, currentPrice, athPrice, athTimestamp, priceHistory };
  };

  return {
    getHistoricalPrices,
    getFullHistoricalPrices,
    getPriceAnalysis,
  };
}
