import { PublicKey } from '@solana/web3.js';
import { u32, u16, u8, struct } from '@solana/buffer-layout';
import { publicKey, u64, bool, u128 } from "@solana/buffer-layout-utils";


// --------------------------------
// Pump.fun AMM: Sell
// --------------------------------
interface pumpSwapSell {
    discriminator: bigint;
    base_amount_in: bigint;
    min_quote_amount_out: bigint;
}
export const pumpSwapSellSchema = struct<pumpSwapSell>([
    u64("discriminator"),
    u64("base_amount_in"),
    u64("min_quote_amount_out"),     // Solana minimum attendu (protection contre le slippage)
])

// --------------------------------
// Pump.fun AMM: Buy
// --------------------------------
interface pumpSwapBuy {
    discriminator: bigint;
    base_amount_out: bigint;
    max_quote_amount_in: bigint;
}
export const pumpSwapBuySchema = struct<pumpSwapBuy>([
    u64("discriminator"),
    u64("base_amount_out"),
    u64("max_quote_amount_in"),     // Solana minimum attendu (protection contre le slippage)
])

// --------------------------------
// Cpi Log : Buy
// --------------------------------
interface pumpSwapCpiLogBuy {
    discriminator: bigint;           // U8[16] = 16 bytes
    timestamp: bigint;                           // U64 = 8 bytes
    baseAmountOut: bigint;                       // U64 = 8 bytes
    maxQuoteAmountIn: bigint;                    // U64 = 8 bytes
    userBaseTokenReserves: bigint;               // U64 = 8 bytes
    userQuoteTokenReserves: bigint;               // U64 = 8 bytes
    poolBaseTokenReserves: bigint;                // U64 = 8 bytes
    poolQuoteTokenReserves: bigint;               // U64 = 8 bytes
    quoteAmountIn: bigint;                       // U64 = 8 bytes
    lpFeeBasisPoints: bigint;                    // U64 = 8 bytes
    lpFee: bigint;                               // U64 = 8 bytes
    protocolFeeBasisPoints: bigint;              // U64 = 8 bytes
    protocolFee: bigint;                         // U64 = 8 bytes
    quoteAmountInWithLpFee: bigint;               // U64 = 8 bytes
    userQuoteAmountIn: bigint;                    // U64 = 8 bytes
    pool: PublicKey;                              // U8[32] = 32 bytes (PublicKey)
    user: PublicKey;                              // U8[32] = 32 bytes (PublicKey)
    userBaseTokenAccount: PublicKey;             // U8[32] = 32 bytes (PublicKey)
    userQuoteTokenAccount: PublicKey;             // U8[32] = 32 bytes (PublicKey)
    protocolFeeRecipient: PublicKey;              // U8[32] = 32 bytes (PublicKey)
    protocolFeeRecipientTokenAccount: PublicKey;  // U8[32] = 32 bytes (PublicKey)
    coinCreator: PublicKey;                       // U8[32] = 32 bytes (PublicKey)
    coinCreatorFeeBasisPoints: bigint;            // U64 = 8 bytes
    coinCreatorFee: bigint;                       // U64 = 8 bytes
    // trackVolume: boolean;                         // Bool = 1 byte
    // totalUnclaimedTokens: bigint;                 // U64 = 8 bytes
    // totalClaimedTokens: bigint;                   // U64 = 8 bytes
    // currentSolVolume: bigint;                     // U64 = 8 bytes
    // lastUpdateTimestamp: bigint;                  // U64 = 8 bytes
}

export const pumpSwapCpiLogBuySchema = struct<pumpSwapCpiLogBuy>([
    u128("discriminator"),
    u64("timestamp"),
    u64("baseAmountOut"),
    u64("maxQuoteAmountIn"),
    u64("userBaseTokenReserves"),
    u64("userQuoteTokenReserves"),
    u64("poolBaseTokenReserves"),
    u64("poolQuoteTokenReserves"),
    u64("quoteAmountIn"),
    u64("lpFeeBasisPoints"),
    u64("lpFee"),
    u64("protocolFeeBasisPoints"),
    u64("protocolFee"),
    u64("quoteAmountInWithLpFee"),
    u64("userQuoteAmountIn"),
    publicKey("pool"),
    publicKey("user"),
    publicKey("userBaseTokenAccount"),
    publicKey("userQuoteTokenAccount"),
    publicKey("protocolFeeRecipient"),
    publicKey("protocolFeeRecipientTokenAccount"),
    publicKey("coinCreator"),
    u64("coinCreatorFeeBasisPoints"),
    u64("coinCreatorFee"),
    // bool("trackVolume"),
    // u64("totalUnclaimedTokens"),
    // u64("totalClaimedTokens"),
    // u64("currentSolVolume"),
    // u64("lastUpdateTimestamp"),
])

// --------------------------------
// Cpi Log : Sell
// --------------------------------
interface pumpSwapCpiLogSell {
    discriminator: bigint;           // U8[16] = 16 bytes
    timestamp: bigint;                           // U64 = 8 bytes
    baseAmountIn: bigint;                        // U64 = 8 bytes
    minQuoteAmountOut: bigint;                   // U64 = 8 bytes
    userBaseTokenReserves: bigint;               // U64 = 8 bytes
    userQuoteTokenReserves: bigint;               // U64 = 8 bytes
    poolBaseTokenReserves: bigint;                // U64 = 8 bytes
    poolQuoteTokenReserves: bigint;               // U64 = 8 bytes
    quoteAmountOut: bigint;                       // U64 = 8 bytes
    lpFeeBasisPoints: bigint;                    // U64 = 8 bytes
    lpFee: bigint;                               // U64 = 8 bytes
    protocolFeeBasisPoints: bigint;              // U64 = 8 bytes
    protocolFee: bigint;                         // U64 = 8 bytes
    quoteAmountOutWithoutLpFee: bigint;           // U64 = 8 bytes
    userQuoteAmountOut: bigint;                   // U64 = 8 bytes
    pool: PublicKey;                              // U8[32] = 32 bytes (PublicKey)
    user: PublicKey;                              // U8[32] = 32 bytes (PublicKey)
    userBaseTokenAccount: PublicKey;             // U8[32] = 32 bytes (PublicKey)
    userQuoteTokenAccount: PublicKey;             // U8[32] = 32 bytes (PublicKey)
    protocolFeeRecipient: PublicKey;              // U8[32] = 32 bytes (PublicKey)
    protocolFeeRecipientTokenAccount: PublicKey;  // U8[32] = 32 bytes (PublicKey)
    coinCreator: PublicKey;                       // U8[32] = 32 bytes (PublicKey)
    coinCreatorFeeBasisPoints: bigint;            // U64 = 8 bytes
    coinCreatorFee: bigint;                       // U64 = 8 bytes
    // trackVolume: boolean;                         // Bool = 1 byte
    // totalUnclaimedTokens: bigint;                 // U64 = 8 bytes
    // totalClaimedTokens: bigint;                   // U64 = 8 bytes
    // currentSolVolume: bigint;                     // U64 = 8 bytes
    // lastUpdateTimestamp: bigint;                  // U64 = 8 bytes
}

export const pumpSwapCpiLogSellSchema = struct<pumpSwapCpiLogSell>([
    u128("discriminator"),
    u64("timestamp"),
    u64("baseAmountIn"),
    u64("minQuoteAmountOut"),
    u64("userBaseTokenReserves"),
    u64("userQuoteTokenReserves"),
    u64("poolBaseTokenReserves"),
    u64("poolQuoteTokenReserves"),
    u64("quoteAmountOut"),
    u64("lpFeeBasisPoints"),
    u64("lpFee"),
    u64("protocolFeeBasisPoints"),
    u64("protocolFee"),
    u64("quoteAmountOutWithoutLpFee"),
    u64("userQuoteAmountOut"),
    publicKey("pool"),
    publicKey("user"),
    publicKey("userBaseTokenAccount"),
    publicKey("userQuoteTokenAccount"),
    publicKey("protocolFeeRecipient"),
    publicKey("protocolFeeRecipientTokenAccount"),
    publicKey("coinCreator"),
    u64("coinCreatorFeeBasisPoints"),
    u64("coinCreatorFee"),
    // bool("trackVolume"),
    // u64("totalUnclaimedTokens"),
    // u64("totalClaimedTokens"),
    // u64("currentSolVolume"),
    // u64("lastUpdateTimestamp"),
])
interface poolKeys {
    discriminator: bigint;
    pool_bump: number;
    index: number;
    creator: PublicKey;
    base_mint: PublicKey;
    quote_mint: PublicKey;
    lp_mint: PublicKey;
    pool_base_token_account: PublicKey;
    pool_quote_token_account: PublicKey;
    lp_supply: bigint;
    coin_creator: PublicKey;
}

export const poolKeysSchema = struct<poolKeys>([
    u64("discriminator"),
    u8("pool_bump"),
    u16("index"),
    publicKey("creator"),
    publicKey("base_mint"),
    publicKey("quote_mint"),
    publicKey("lp_mint"),
    publicKey("pool_base_token_account"),
    publicKey("pool_quote_token_account"),
    u64("lp_supply"),
    publicKey("coin_creator"),
])