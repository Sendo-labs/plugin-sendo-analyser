import { createHelius } from "helius-sdk";
import { RateLimiter } from "../../utils/rateLimiter.js";

export interface HeliusService {
  getAccountInfo(address: string, config?: any): Promise<any>;
  getBlock(address: string): Promise<any>;
  getSignaturesForAddress(address: string, config: any): Promise<readonly any[]>;
  getAssetsByOwner(config: { ownerAddress: string }): Promise<any>;
  getTokenAccounts(config: { owner: string }): Promise<any>;
  getBalance(address: string): Promise<any>;
  getTransaction(signature: string, config?: any): Promise<any>;
  getTransactionsForAddress(address: string, limit: number, before?: string): Promise<{
    transactions: any[];
    signatures: string[];
    paginationToken?: string;
    hasMore: boolean;
  }>;
  getTokenMetadataBatch(mints: string[]): Promise<Map<string, { symbol: string | null; name: string | null }>>;
}

/**
 * Creates a Helius service instance with rate limiting
 * @param apiKey - Helius API key
 * @param requestsPerSecond - Rate limit (default 50 RPS)
 * @returns HeliusService instance
 */
export function createHeliusService(apiKey: string, requestsPerSecond: number = 50): HeliusService {
  const helius = createHelius({ apiKey, network: "mainnet" });

  // Global rate limiter instance for Helius API
  const heliusLimiter = new RateLimiter({
    requestsPerSecond,
    burstCapacity: 100,
    adaptiveTiming: true
  });

  // Helper function to use rate limiting
  const withRateLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
    return heliusLimiter.schedule(fn);
  };

  return {
    getAccountInfo: async (address: string, config?: any) => {
      return withRateLimit(async () => {
        return helius.getAccountInfo(address, config || { encoding: "base64" });
      });
    },

    getBlock: async (address: string) => {
      return withRateLimit(async () => {
        return helius.getBlock(address);
      });
    },

    getSignaturesForAddress: async (address: string, config: any) => {
      return withRateLimit(async () => {
        return helius.getSignaturesForAddress(address, config);
      });
    },

    getAssetsByOwner: async (config: { ownerAddress: string }) => {
      return withRateLimit(async () => {
        return helius.getAssetsByOwner(config);
      });
    },

    getTokenAccounts: async (config: { owner: string }) => {
      return withRateLimit(async () => {
        return helius.getTokenAccounts(config);
      });
    },

    getBalance: async (address: string) => {
      return withRateLimit(async () => {
        return helius.getBalance(address);
      });
    },

    getTransaction: async (signature: string, config?: any) => {
      return withRateLimit(async () => {
        return helius.getTransaction(signature, config || { maxSupportedTransactionVersion: 0 });
      });
    },

    getTransactionsForAddress: async (address: string, limit: number, before?: string) => {
      // Use new Helius getTransactionsForAddress RPC method
      // This combines getSignaturesForAddress + getTransaction in 1 call!
      // Limit: max 100 transactions with full details

      return withRateLimit(async () => {
        const params: any = {
          transactionDetails: 'full',  // Get full transaction data
          limit: Math.min(limit, 100), // Max 100 with full details
        };

        // Add pagination token if provided
        if (before) {
          params.paginationToken = before;
        }

        // Make RPC call directly (helius-sdk doesn't expose this yet)
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransactionsForAddress',
            params: [address, params]
          })
        });

        const { result } = await response.json();

        if (!result || !result.data) {
          return {
            transactions: [],
            signatures: [],
            paginationToken: undefined,
            hasMore: false
          };
        }

        // Filter out failed transactions
        const validTransactions = result.data.filter((tx: any) =>
          tx.meta?.err === null || tx.meta?.err === undefined
        );

        return {
          transactions: validTransactions,
          signatures: validTransactions.map((tx: any) => tx.transaction.signatures[0]),
          paginationToken: result.paginationToken || undefined,
          hasMore: !!result.paginationToken
        };
      });
    },

    getTokenMetadataBatch: async (mints: string[]) => {
      // Use Helius DAS API getAssetBatch to fetch metadata for multiple tokens
      // This is MUCH more efficient than calling Birdeye token_overview for each token
      // Limit: up to 1000 tokens per request

      return withRateLimit(async () => {
        const metadataMap = new Map<string, { symbol: string | null; name: string | null }>();

        // Process in batches of 1000 (API limit)
        for (let i = 0; i < mints.length; i += 1000) {
          const batch = mints.slice(i, i + 1000);

          try {
            const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAssetBatch',
                params: {
                  ids: batch
                }
              })
            });

            const { result } = await response.json();

            if (result && Array.isArray(result)) {
              result.forEach((asset: any) => {
                if (asset && asset.id) {
                  // Extract symbol and name from metadata
                  const symbol = asset.content?.metadata?.symbol || asset.content?.json_uri?.symbol || null;
                  const name = asset.content?.metadata?.name || asset.content?.json_uri?.name || null;

                  metadataMap.set(asset.id, { symbol, name });
                }
              });
            }
          } catch (error) {
            console.error(`[Helius] getAssetBatch error for batch ${i}-${i + batch.length}:`, error);
            // Continue to next batch even if this one fails
          }
        }

        return metadataMap;
      });
    },
  };
}
