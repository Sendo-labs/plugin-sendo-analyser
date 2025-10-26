import { PublicKey } from '@solana/web3.js';
import { u32, u16, u8, struct } from '@solana/buffer-layout';
import { publicKey, u64, bool, u128 } from "@solana/buffer-layout-utils";

// --------------------------------
// Pump.fun: Sell
// --------------------------------

interface pfSell {
    discriminator: bigint;
    amount: bigint;
    minSolOutput: bigint;
}
export const pfSellSchema = struct<pfSell>([
    u64("discriminator"),
    u64("amount"),
    u64("minSolOutput"),
])

// --------------------------------
// Pump.fun: Buy
// --------------------------------
interface pfBuy {
    discriminator: bigint;
    amount: bigint;
    maxSolCost: bigint;
}
export const PfBuySchema = struct<pfBuy>([
    u64("discriminator"),
    u64("amount"),
    u64("maxSolCost"),     // Solana minimum attendu (protection contre le slippage)
])

// --------------------------------
// Cpi Log : Buy / Sell
// --------------------------------
interface pfCpiLogBuySell {
    discriminator: bigint;           // U8[16] = 16 bytes
    mint: PublicKey;                 // U8[32] = 32 bytes (PublicKey)
    solAmount: bigint;               // U64 = 8 bytes
    tokenAmount: bigint;             // U64 = 8 bytes
    isBuy: boolean;                  // Bool = 1 byte
    user: bigint;                    // U8[32] = 32 bytes (PublicKey)
    timestamp: bigint;               // U64 = 8 bytes
    virtualSolReserves: bigint;      // U64 = 8 bytes
    virtualTokenReserves: bigint;    // U64 = 8 bytes
    realSolReserves: bigint;         // U64 = 8 bytes
    realTokenReserves: bigint;       // U64 = 8 bytes
    feeRecipient: PublicKey;         // U8[32] = 32 bytes (PublicKey)
    feeBasisPoints: bigint;          // U64 = 8 bytes
    fee: bigint;                     // U64 = 8 bytes
    creator: PublicKey;              // U8[32] = 32 bytes (PublicKey)
    creatorFeeBasisPoints: bigint;   // U64 = 8 bytes
    creatorFee: bigint;              // U64 = 8 bytes
    // trackVolume: boolean;            // Bool = 1 byte
    // totalUnclaimedTokens: bigint;    // U64 = 8 bytes
    // totalClaimedTokens: bigint;      // U64 = 8 bytes
    // currentSolVolume: bigint;        // U64 = 8 bytes
    // lastUpdateTimestamp: bigint;     // U64 = 8 bytes
}
export const pfCpiLogBuySellSchema = struct<pfCpiLogBuySell>([
    u128("discriminator"),
    publicKey("mint"),
    u64("solAmount"),
    u64("tokenAmount"),
    bool("isBuy"),
    publicKey("user"),
    u64("timestamp"),
    u64("virtualSolReserves"),
    u64("virtualTokenReserves"),
    u64("realSolReserves"),
    u64("realTokenReserves"),
    publicKey("feeRecipient"),
    u64("feeBasisPoints"),
    u64("fee"),
    publicKey("creator"),
    u64("creatorFeeBasisPoints"),
    u64("creatorFee"),
    // bool("trackVolume"),
    // u64("totalUnclaimedTokens"),
    // u64("totalClaimedTokens"),
    // u64("currentSolVolume"),
    // u64("lastUpdateTimestamp"),
])

// --------------------------------
// Create (token)
// --------------------------------