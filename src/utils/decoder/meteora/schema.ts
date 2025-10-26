import { PublicKey } from '@solana/web3.js';
import { u32, u16, u8, struct, seq } from '@solana/buffer-layout';
import { publicKey, u64, bool, u128 } from "@solana/buffer-layout-utils";

// --------------------------------
// Meteora DAMM V2: Swap Parameters
// --------------------------------
export interface SwapParameters {
    amountIn: bigint;           // U64
    minimumAmountOut: bigint;    // U64
}

// --------------------------------
// Meteora DAMM V2: Swap Result
// --------------------------------
export interface SwapResult {
    outputAmount: bigint;        // U64
    nextSqrtPrice: bigint;       // U128
    lpFee: bigint;               // U64
    protocolFee: bigint;          // U64
    partnerFee: bigint;           // U64
    referralFee: bigint;          // U64
}

// --------------------------------
// Meteora DAMM V2: Swap Event
// --------------------------------
export interface EvtSwapEvent {
    discriminator: number[];     // U8[16] - 16 bytes discriminator
    pool: PublicKey;            // Pubkey = 32 bytes
    tradeDirection: number;      // U8 - 0 ou 1
    hasReferral: boolean;        // Bool
    params: SwapParameters;      // SwapParameters struct
    swapResult: SwapResult;      // SwapResult struct
    actualAmountIn: bigint;      // U64
    currentTimestamp: bigint;    // U64
}

// Schéma pour SwapParameters
export const swapParametersSchema = struct<SwapParameters>([
    u64("amountIn"),
    u64("minimumAmountOut"),
]);

// Schéma pour SwapResult
export const swapResultSchema = struct<SwapResult>([
    u64("outputAmount"),
    u128("nextSqrtPrice"),
    u64("lpFee"),
    u64("protocolFee"),
    u64("partnerFee"),
    u64("referralFee"),
]);

// Schéma principal pour EvtSwapEvent - Version simplifiée pour debug
export const evtSwapEventSchema = struct<EvtSwapEvent>([
    seq(u8(), 16, "discriminator"),     // U8[16] - 16 bytes discriminator
    publicKey("pool"),                  // Pubkey = 32 bytes
    u8("tradeDirection"),               // U8 - 0 ou 1
    bool("hasReferral"),                // Bool
    u64("actualAmountIn"),              // U64
    u64("currentTimestamp"),            // U64
]);

// Interface pour le schéma complet
export interface EvtSwapEventComplete {
    discriminator: number[];
    pool: PublicKey;
    tradeDirection: number;
    hasReferral: boolean;
    amountIn: bigint;
    minimumAmountOut: bigint;
    outputAmount: bigint;
    nextSqrtPrice: bigint;
    lpFee: bigint;
    protocolFee: bigint;
    partnerFee: bigint;
    referralFee: bigint;
    actualAmountIn: bigint;
    currentTimestamp: bigint;
}

// Schéma complet pour EvtSwapEvent - avec tous les champs dans l'ordre
export const evtSwapEventCompleteSchema = struct<EvtSwapEventComplete>([
    seq(u8(), 16, "discriminator"),     // U8[16] - 16 bytes discriminator
    publicKey("pool"),                  // Pubkey = 32 bytes
    u8("tradeDirection"),               // U8 - 0 ou 1
    bool("hasReferral"),                // Bool
    // SwapParameters inline
    u64("amountIn"),                    // U64
    u64("minimumAmountOut"),             // U64
    // SwapResult inline
    u64("outputAmount"),                 // U64
    u128("nextSqrtPrice"),               // U128
    u64("lpFee"),                       // U64
    u64("protocolFee"),                  // U64
    u64("partnerFee"),                   // U64
    u64("referralFee"),                  // U64
    u64("actualAmountIn"),              // U64
    u64("currentTimestamp"),            // U64
]);


// Base Fee Structure
export interface BaseFee {
    cliffFeeNumerator: bigint;
    feeSchedulerMode: number;
    padding0: number[];
    numberOfPeriod: number;
    periodFrequency: bigint;
    reductionFactor: bigint;
    padding1: bigint;
}

export const baseFeeSchema = struct<BaseFee>([
    u64("cliffFeeNumerator"),
    u8("feeSchedulerMode"),
    seq(u8(), 5, "padding0"),
    u16("numberOfPeriod"),
    u64("periodFrequency"),
    u64("reductionFactor"),
    u64("padding1"),
]);

// Dynamic Fee Structure
export interface DynamicFee {
    initialized: number;
    padding: number[];
    maxVolatilityAccumulator: number;
    variableFeeControl: number;
    binStep: number;
    filterPeriod: number;
    decayPeriod: number;
    reductionFactor: number;
    lastUpdateTimestamp: bigint;
    binStepU128: bigint;
    sqrtPriceReference: bigint;
    volatilityAccumulator: bigint;
    volatilityReference: bigint;
}

export const dynamicFeeSchema = struct<DynamicFee>([
    u8("initialized"),
    seq(u8(), 7, "padding"),
    u32("maxVolatilityAccumulator"),
    u32("variableFeeControl"),
    u16("binStep"),
    u16("filterPeriod"),
    u16("decayPeriod"),
    u16("reductionFactor"),
    u64("lastUpdateTimestamp"),
    u128("binStepU128"),
    u128("sqrtPriceReference"),
    u128("volatilityAccumulator"),
    u128("volatilityReference"),
]);

// Pool Fees Structure
export interface PoolFees {
    baseFee: BaseFee;
    protocolFeePercent: number;
    partnerFeePercent: number;
    referralFeePercent: number;
    padding0: number[];
    dynamicFee: DynamicFee;
    padding1: bigint[];
}

export const poolFeesSchema = struct<PoolFees>([
    baseFeeSchema.replicate("baseFee"),
    u8("protocolFeePercent"),
    u8("partnerFeePercent"),
    u8("referralFeePercent"),
    seq(u8(), 5, "padding0"),
    dynamicFeeSchema.replicate("dynamicFee"),
    seq(u64(), 2, "padding1"),
]);

// Pool Metrics Structure
export interface PoolMetrics {
    totalLpAFee: bigint;
    totalLpBFee: bigint;
    totalProtocolAFee: bigint;
    totalProtocolBFee: bigint;
    totalPartnerAFee: bigint;
    totalPartnerBFee: bigint;
    totalPosition: bigint;
    padding: bigint;
}

export const poolMetricsSchema = struct<PoolMetrics>([
    u128("totalLpAFee"),
    u128("totalLpBFee"),
    u64("totalProtocolAFee"),
    u64("totalProtocolBFee"),
    u64("totalPartnerAFee"),
    u64("totalPartnerBFee"),
    u64("totalPosition"),
    u64("padding"),
]);

// Reward Info Structure
export interface RewardInfo {
    initialized: number;
    rewardTokenFlag: number;
    padding0: number[];
    padding1: number[];
    mint: PublicKey;
    vault: PublicKey;
    funder: PublicKey;
    rewardDuration: bigint;
    rewardDurationEnd: bigint;
    rewardRate: bigint;
    rewardPerTokenStored: number[];
    lastUpdateTime: bigint;
    cumulativeSecondsWithEmptyLiquidityReward: bigint;
}

export const rewardInfoSchema = struct<RewardInfo>([
    u8("initialized"),
    u8("rewardTokenFlag"),
    seq(u8(), 6, "padding0"),
    seq(u8(), 8, "padding1"),
    publicKey("mint"),
    publicKey("vault"),
    publicKey("funder"),
    u64("rewardDuration"),
    u64("rewardDurationEnd"),
    u128("rewardRate"),
    seq(u8(), 32, "rewardPerTokenStored"),
    u64("lastUpdateTime"),
    u64("cumulativeSecondsWithEmptyLiquidityReward"),
]);

// Pool Layout Structure
export interface PoolLayout {
    poolFees: PoolFees;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    tokenAVault: PublicKey;
    tokenBVault: PublicKey;
    whitelistedVault: PublicKey;
    partner: PublicKey;
    liquidity: bigint;
    padding: bigint;
    protocolAFee: bigint;
    protocolBFee: bigint;
    partnerAFee: bigint;
    partnerBFee: bigint;
    sqrtMinPrice: bigint;
    sqrtMaxPrice: bigint;
    sqrtPrice: bigint;
    activationPoint: bigint;
    activationType: number;
    poolStatus: number;
    tokenAFlag: number;
    tokenBFlag: number;
    collectFeeMode: number;
    poolType: number;
    version: number;
    padding0: number;
    feeAPerLiquidity: number[];
    feeBPerLiquidity: number[];
    permanentLockLiquidity: bigint;
    metrics: PoolMetrics;
    creator: PublicKey;
    padding1: bigint[];
    rewardInfos: RewardInfo[];
}

export const poolLayoutSchema = struct<PoolLayout>([
    // Skip 8 bytes padding at the beginning
    seq(u8(), 8), // Padding(8)
    poolFeesSchema.replicate("poolFees"),
    publicKey("tokenAMint"),
    publicKey("tokenBMint"),
    publicKey("tokenAVault"),
    publicKey("tokenBVault"),
    publicKey("whitelistedVault"),
    publicKey("partner"),
    u128("liquidity"),
    u128("padding"),
    u64("protocolAFee"),
    u64("protocolBFee"),
    u64("partnerAFee"),
    u64("partnerBFee"),
    u128("sqrtMinPrice"),
    u128("sqrtMaxPrice"),
    u128("sqrtPrice"),
    u64("activationPoint"),
    u8("activationType"),
    u8("poolStatus"),
    u8("tokenAFlag"),
    u8("tokenBFlag"),
    u8("collectFeeMode"),
    u8("poolType"),
    u8("version"), // Ajout du champ version
    u8("padding0"), // Renommage pour correspondre à Python
    seq(u8(), 32, "feeAPerLiquidity"),
    seq(u8(), 32, "feeBPerLiquidity"),
    u128("permanentLockLiquidity"),
    poolMetricsSchema.replicate("metrics"),
    publicKey("creator"),
    seq(u64(), 6, "padding1"),
    seq(rewardInfoSchema, 2, "rewardInfos"),
]);