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
    hasMore: boolean;
  }>;
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
      const config: any = { limit };

      if (before) {
        config.before = before;
      }

      // Récupérer les signatures (1 seul appel rate limité)
      const signatures = await withRateLimit(async () => {
        return await helius.getSignaturesForAddress(address, config);
      });

      // Filtrer les signatures sans erreur (err === null ou err === undefined)
      const validSignatures = signatures.filter(sig => sig.err === null || sig.err === undefined);

      // Mapper uniquement les signatures valides en promise rate limitée
      // Chaque appel à getTransaction a son propre rate limit
      const transactionPromises = validSignatures.map(signatureObj =>
        withRateLimit(async () => {
          return helius.getTransaction(signatureObj.signature, {
            maxSupportedTransactionVersion: 0
          });
        })
      );

      // Exécuter TOUTES les transactions en parallèle
      // Le rate limiter contrôle automatiquement le flux
      const transactionResults = await Promise.all(transactionPromises);

      // Filtrer les null/undefined
      const transactions = transactionResults.filter(tx => tx !== null);

      return {
        transactions,
        signatures: signatures.map(s => s.signature),
        hasMore: signatures.length === limit
      };
    },
  };
}
