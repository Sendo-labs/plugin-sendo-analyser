import { createHelius } from "helius-sdk";

export interface HeliusService {
  getAccountInfo(address: string, config?: any): Promise<any>;
  getBlock(address: string): Promise<any>;
  getSignaturesForAddress(address: string, config: any): Promise<readonly any[]>;
  getAssetsByOwner(config: { ownerAddress: string }): Promise<any>;
  getTokenAccounts(config: { owner: string }): Promise<any>;
  getBalance(address: string): Promise<any>;
  getTransaction(signature: string, config?: any): Promise<any>;
}

/**
 * Creates a Helius service instance
 * @param apiKey - Helius API key
 * @returns HeliusService instance
 */
export function createHeliusService(apiKey: string): HeliusService {
  const helius = createHelius({ apiKey, network: "mainnet" });

  return {
    getAccountInfo: async (address: string, config?: any) => {
      return helius.getAccountInfo(address, config || { encoding: "base64" });
    },

    getBlock: async (address: string) => {
      return helius.getBlock(address);
    },

    getSignaturesForAddress: async (address: string, config: any) => {
      return helius.getSignaturesForAddress(address, config);
    },

    getAssetsByOwner: async (config: { ownerAddress: string }) => {
      return helius.getAssetsByOwner(config);
    },

    getTokenAccounts: async (config: { owner: string }) => {
      return helius.getTokenAccounts(config);
    },

    getBalance: async (address: string) => {
      return helius.getBalance(address);
    },

    getTransaction: async (signature: string, config?: any) => {
      return helius.getTransaction(signature, config || { maxSupportedTransactionVersion: 0 });
    },
  };
}
