import { PublicKey } from '@solana/web3.js';
import { u32, u16, u8, struct, seq } from '@solana/buffer-layout';
import { publicKey, u64, bool, u128 } from "@solana/buffer-layout-utils";

// --------------------------------
// Cpi Log : Buy
// --------------------------------
interface whirlpoolSwap {
    discriminator: number;
    amount: bigint;
    otherAmountThreshold: bigint;
    sqrtPriceLimit: bigint;
    amountSpecifiedIsInput: boolean;
    aToB: boolean;
}

export const whirlpoolSwapSchema = struct<whirlpoolSwap>([
    u64("discriminator"),
    u64("amount"),
    u64("otherAmountThreshold"),
    u128("sqrtPriceLimit"),
    bool("amountSpecifiedIsInput"),
    bool("aToB"),
])
