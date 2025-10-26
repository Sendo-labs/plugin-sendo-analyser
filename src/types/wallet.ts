/**
 * Wallet analysis types based on sendo-api responses
 */

// Token holding information
export interface TokenHolding {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  price?: number;
  valueUsd?: number;
}

// NFT holding information
export interface NftHolding {
  mint: string;
  name: string;
  collection?: string;
  image?: string;
  attributes?: Record<string, any>;
}

// Decoded trade information
export interface Trade {
  signature: string;
  timestamp: number;
  type: 'buy' | 'sell';
  inputMint: string;
  inputSymbol: string;
  inputAmount: number;
  outputMint: string;
  outputSymbol: string;
  outputAmount: number;
  protocol: string;
  purchasePrice?: number;
  currentPrice?: number;
  athPrice?: number;
  profitLoss?: number;
  profitLossPercentage?: number;
}

// Transaction information
export interface Transaction {
  signature: string;
  timestamp: number;
  slot: number;
  type: string;
  instructions: DecodedInstruction[];
  fee: number;
}

// Decoded instruction
export interface DecodedInstruction {
  programId: string;
  type: string;
  data: any;
}

// Wallet global overview
export interface WalletOverview {
  address: string;
  solBalance: number;
  tokensCount: number;
  nftsCount: number;
  totalValueUsd: number;
  tokens: TokenHolding[];
  nfts: NftHolding[];
  recentTrades: Trade[];
}