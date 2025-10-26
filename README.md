# @sendo-labs/plugin-sendo-analyser

**Sendo Analyser Plugin** - A comprehensive Solana wallet analysis plugin that provides real-time transaction decoding, trade analysis, token/NFT holdings, and price performance tracking.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview

The Sendo Analyser plugin transforms ElizaOS agents into Solana blockchain analysts by:
- **Decoding** Solana transactions from multiple DEXs (Jupiter, Raydium, Orca, Meteora, Pumpfun, etc.)
- **Analyzing** trades with real-time and historical price data
- **Tracking** token and NFT holdings
- **Calculating** performance metrics (P&L, ATH missed, win rate)
- **Paginating** results efficiently with cursor-based navigation

**Key principle**: Real-time blockchain data analysis with comprehensive DEX support and price tracking via Helius and Birdeye APIs.

---

## ✨ Features

### 🔍 Transaction Decoding
- Multi-DEX support: Jupiter, Raydium, Orca, Meteora, Pumpfun, Pumpswap, Whirlpool
- Automatic protocol detection and instruction parsing
- Balance change tracking (SOL and SPL tokens)
- Fee and compute budget extraction

### 📊 Trade Analysis
- Real-time price data from Birdeye API
- Historical price tracking at transaction time
- ATH (All-Time High) analysis
- Trade categorization (buy/sell/no_change)
- Performance metrics per trade and per token

### 💰 Portfolio Tracking
- Token holdings with balances
- NFT collection tracking
- SOL balance monitoring
- Global portfolio overview

### 🔄 Cursor-Based Pagination
- Efficient navigation through transaction history
- Configurable page size (1-50 results)
- Pagination metadata with `hasMore`, `nextCursor`, `currentCursor`
- Pass-through to Helius for real-time data freshness

---

## 📦 Installation

```bash
npm install @sendo-labs/plugin-sendo-analyser
```

or with Bun:

```bash
bun add @sendo-labs/plugin-sendo-analyser
```

---

## 🚀 Usage

### Basic Setup

```typescript
import { sendoAnalyserPlugin } from '@sendo-labs/plugin-sendo-analyser';

const agent = {
  plugins: [
    sendoAnalyserPlugin,
    // ... your other plugins
  ],
};
```

### Environment Variables

```bash
HELIUS_API_KEY=your_helius_api_key
BIRDEYE_API_KEY=your_birdeye_api_key
```

### REST API Endpoints

The plugin exposes REST endpoints for wallet analysis:

#### Get Transaction Signatures
```bash
GET /signatures/:address?limit=5&cursor=signature
```

Returns paginated transaction signatures for a wallet.

**Query Parameters:**
- `limit` (optional): Number of results (1-50, default: 5)
- `cursor` (optional): Signature to paginate from

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "wallet_address",
    "signatures": [...],
    "pagination": {
      "limit": 5,
      "hasMore": true,
      "nextCursor": "signature_xyz",
      "currentCursor": null,
      "totalLoaded": 5
    }
  }
}
```

#### Get Decoded Transactions
```bash
GET /transactions/:address?limit=5&cursor=signature
```

Returns decoded transactions with balance changes and protocol detection.

#### Get Trades with Price Analysis
```bash
GET /trades/:address?limit=5&cursor=signature
```

Returns trades with comprehensive price analysis:
- Purchase price at transaction time
- Current price
- ATH price and timestamp
- Gain/Loss percentage
- Missed ATH opportunity

**Response includes:**
- Trade categorization (increase/decrease/no_change)
- Token balance changes
- Price analysis per trade
- Global summary statistics

#### Get Token Holdings
```bash
GET /tokens/:address
```

Returns current token holdings for the wallet.

#### Get NFT Holdings
```bash
GET /nfts/:address
```

Returns current NFT holdings for the wallet.

#### Get Global Overview
```bash
GET /global/:address
```

Returns wallet balance and global metrics.

#### Get Complete Wallet Analysis
```bash
GET /wallet/:address
```

Returns comprehensive analysis combining all data:
- Balance
- Tokens
- NFTs
- Recent trades (last 10)

---

## 🏗️ Architecture

### Service Layer

**SendoAnalyserService** (`src/services/sendoAnalyserService.ts`)

Main analysis service with these key methods:

- `getSignaturesForAddress()` - Paginated signature retrieval
- `getTransactionsForAddress()` - Decoded transactions with pagination
- `getTradesForAddress()` - Trade analysis with price tracking
- `getTokensForAddress()` - Current token holdings
- `getNftsForAddress()` - Current NFT holdings
- `getGlobalForAddress()` - Wallet overview
- `getCompleteWalletAnalysis()` - Combined analysis

### Helius Integration

**helius.ts** (`src/services/helius.ts`)

Helius API wrapper with cursor-based pagination:
- `getSignaturesForAddress()` - Signature retrieval with `before` cursor
- `getTransactionsForAddress()` - Transaction fetching with pagination metadata
- `getTokensForAddress()` - SPL token account data
- `getNftsForAddress()` - NFT/compressed NFT data
- `getBalanceForAddress()` - SOL balance

### Birdeye Integration

**birdeyes.ts** (`src/services/birdeyes.ts`)

Price analysis service:
- `getPriceAnalysis()` - Historical and current price with ATH tracking
- OHLCV data fetching
- Price history analysis

### Transaction Decoders

**decoders/** (`src/utils/decoder/`)

Protocol-specific decoders:
- `jupiter/` - Jupiter aggregator swaps
- `raydium/` - Raydium AMM and CLMM
- `orca/` - Orca pools
- `meteora/` - Meteora DLMM
- `pumpfun/` - Pump.fun bonding curves
- `pumpswap/` - Pumpswap pools
- `whirlpool/` - Whirlpool concentrated liquidity
- `computeBudget/` - Compute budget instructions

---

## 🛠️ Development

### Prerequisites

- Node.js 18+ or Bun
- Helius API key
- Birdeye API key

### Build

```bash
bun run build
```

### Watch Mode

```bash
bun run dev
```

### Type Checking

```bash
bun run typecheck
```

---

## 📁 Project Structure

```
plugin-sendo-analyser/
├── src/
│   ├── services/          # SendoAnalyserService, Helius, Birdeye
│   ├── routes/            # REST API endpoints
│   ├── utils/
│   │   └── decoder/       # Protocol-specific transaction decoders
│   ├── config/            # Helius client config
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Plugin export
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## 🎯 Supported DEXs & Protocols

- **Jupiter** - Aggregator swaps
- **Raydium** - AMM and CLMM pools
- **Orca** - Standard and Whirlpool pools
- **Meteora** - DLMM (Dynamic Liquidity Market Maker)
- **Pump.fun** - Bonding curve token launches
- **Pumpswap** - Pump token swaps
- **Compute Budget** - Priority fees and compute limits

---

## 📊 Price Analysis Features

- **Purchase Price**: Price at transaction time (via OHLCV data)
- **Current Price**: Real-time price from Birdeye
- **ATH Price**: All-time high with timestamp
- **Gain/Loss**: Percentage change from purchase to current
- **Missed ATH**: Percentage from current price to ATH

---

## 🔄 Pagination Flow

```
Page 1: GET /trades/:address?limit=5
→ Returns 5 trades + nextCursor

Page 2: GET /trades/:address?limit=5&cursor=<nextCursor>
→ Returns next 5 trades + new nextCursor

Last Page: hasMore=false, nextCursor=null
```

**Pass-through pagination**: Each request fetches fresh data from Helius (no server-side caching).

---

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing patterns
- TypeScript types are correct
- Documentation is updated
- Decoder schemas are properly typed with Zod

---

## 📄 License

MIT

---

## 🔗 Related

- **ElizaOS**: https://github.com/elizaos/eliza
- **Sendo Labs**: https://github.com/Sendo-labs
- **Helius**: https://helius.dev
- **Birdeye**: https://birdeye.so

---

**Built with ❤️ by Sendo Labs**
