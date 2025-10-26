import { PublicKey } from '@solana/web3.js';
import { u32, u16, u8, struct, seq } from '@solana/buffer-layout';
import { publicKey, u64, bool, u128 } from "@solana/buffer-layout-utils";

// --------------------------------
// Cpi Log : Buy
// --------------------------------
interface raydiumSwap {
    discriminator: number;
    amountIn: bigint;
    minimumAmountOut: bigint;
}

export const raydiumSwapSchema = struct<raydiumSwap>([
    u8("discriminator"),
    u64("amountIn"),
    u64("minimumAmountOut"),
])

// --------------------------------
// Raydium Pool Structure
// --------------------------------
interface RaydiumPool {
    status: bigint;
    nonce: bigint;
    maxOrder: bigint;
    depth: bigint;
    baseDecimal: bigint;
    quoteDecimal: bigint;
    state: bigint;
    resetFlag: bigint;
    minSize: bigint;
    volMaxCutRatio: bigint;
    amountWaveRatio: bigint;
    baseLotSize: bigint;
    quoteLotSize: bigint;
    minPriceMultiplier: bigint;
    maxPriceMultiplier: bigint;
    systemDecimalValue: bigint;
    minSeparateNumerator: bigint;
    minSeparateDenominator: bigint;
    tradeFeeNumerator: bigint;
    tradeFeeDenominator: bigint;
    pnlNumerator: bigint;
    pnlDenominator: bigint;
    swapFeeNumerator: bigint;
    swapFeeDenominator: bigint;
    baseNeedTakePnl: bigint;
    quoteNeedTakePnl: bigint;
    quoteTotalPnl: bigint;
    baseTotalPnl: bigint;
    poolOpenTime: bigint;
    punishPcAmount: bigint;
    punishCoinAmount: bigint;
    orderbookToInitTime: bigint;
    swapBaseInAmount: bigint;
    swapQuoteOutAmount: bigint;
    swapBase2QuoteFee: bigint;
    swapQuoteInAmount: bigint;
    swapBaseOutAmount: bigint;
    swapQuote2BaseFee: bigint;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    lpMint: PublicKey;
    openOrders: PublicKey;
    marketId: PublicKey;
    marketProgramId: PublicKey;
    targetOrders: PublicKey;
    withdrawQueue: PublicKey;
    lpVault: PublicKey;
    owner: PublicKey;
    lpReserve: bigint;
    padding: bigint[];
}

export const raydiumPoolSchema = struct<RaydiumPool>([
    u64("status"),
    u64("nonce"),
    u64("maxOrder"),
    u64("depth"),
    u64("baseDecimal"),
    u64("quoteDecimal"),
    u64("state"),
    u64("resetFlag"),
    u64("minSize"),
    u64("volMaxCutRatio"),
    u64("amountWaveRatio"),
    u64("baseLotSize"),
    u64("quoteLotSize"),
    u64("minPriceMultiplier"),
    u64("maxPriceMultiplier"),
    u64("systemDecimalValue"),
    u64("minSeparateNumerator"),
    u64("minSeparateDenominator"),
    u64("tradeFeeNumerator"),
    u64("tradeFeeDenominator"),
    u64("pnlNumerator"),
    u64("pnlDenominator"),
    u64("swapFeeNumerator"),
    u64("swapFeeDenominator"),
    u64("baseNeedTakePnl"),
    u64("quoteNeedTakePnl"),
    u64("quoteTotalPnl"),
    u64("baseTotalPnl"),
    u64("poolOpenTime"),
    u64("punishPcAmount"),
    u64("punishCoinAmount"),
    u64("orderbookToInitTime"),
    u128("swapBaseInAmount"),  // BytesInteger(16) = u128
    u128("swapQuoteOutAmount"), // BytesInteger(16) = u128
    u64("swapBase2QuoteFee"),
    u128("swapQuoteInAmount"),  // BytesInteger(16) = u128
    u128("swapBaseOutAmount"),  // BytesInteger(16) = u128
    u64("swapQuote2BaseFee"),
    publicKey("baseVault"),
    publicKey("quoteVault"),
    publicKey("baseMint"),
    publicKey("quoteMint"),
    publicKey("lpMint"),
    publicKey("openOrders"),
    publicKey("marketId"),
    publicKey("marketProgramId"),
    publicKey("targetOrders"),
    publicKey("withdrawQueue"),
    publicKey("lpVault"),
    publicKey("owner"),
    u64("lpReserve"),
    seq(u64(), 3, "padding"),
]);