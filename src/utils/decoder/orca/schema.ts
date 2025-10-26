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

// {12 items
//     pool:
//     "J2s7qLUqXwa8y4JPZy9wC2Pg3JjBm2Ykj4thonEkKG2Y"
//     tradeDirection:
//     0
//     collectFeeMode:
//     1
//     hasReferral:
//     false
//     params:{3 items
//     amount0:
//     "3830662017693"
//     amount1:
//     "0"
//     swapMode:
//     0
//     }
//     swapResult:{9 items
//     includedFeeInputAmount:
//     "3830662017693"
//     excludedFeeInputAmount:
//     "3830662017693"
//     amountLeft:
//     "0"
//     outputAmount:
//     "132430755"
//     nextSqrtPrice:
//     "109558250453593597"
//     tradingFee:
//     "2162136"
//     protocolFee:
//     "540534"
//     partnerFee:
//     "0"
//     referralFee:
//     "0"
//     }
//     includedTransferFeeAmountIn:
//     "3830662017693"
//     includedTransferFeeAmountOut:
//     "132430755"
//     excludedTransferFeeAmountOut:
//     "132430755"
//     currentTimestamp:
//     "1760280106"
//     reserveAAmount:
//     "43531579550980686"
//     reserveBAmount:
//     "1535518808879"
//     }