import { PublicKey } from '@solana/web3.js';
import { u32, u16, u8, struct, seq } from '@solana/buffer-layout';
import { publicKey, u64, bool, u128 } from "@solana/buffer-layout-utils";

// --------------------------------
// Jupiter Router - Route Plan Step
// --------------------------------
export interface RoutePlanStep {
    swap: number;                    // U8 = 1 byte (enum index)
    percent: number;                 // U8 = 1 byte
    input_index: number;             // U8 = 1 byte
    output_index: number;            // U8 = 1 byte
}

// --------------------------------
// Jupiter Router - Main Structure
// --------------------------------
interface JupiterSwap {
    discriminator: Uint8Array;       // [u8; 8] = 8 bytes
    route_plan: RoutePlanStep[];     // Vec<RoutePlanStep>
    in_amount: bigint;               // U64 = 8 bytes
    quoted_out_amount: bigint;       // U64 = 8 bytes
    slippage_bps: number;            // U16 = 2 bytes
    platform_fee_bps: number;       // U8 = 1 byte
}

export const routePlanStepSchema = struct<RoutePlanStep>([
    u8("swap"),                      // U8 = 1 byte (enum index)
    u8("percent"),                   // U8 = 1 byte
    u8("input_index"),               // U8 = 1 byte
    u8("output_index"),              // U8 = 1 byte
])

// Schéma pour le discriminator (8 bytes)
export const discriminatorSchema = seq(u8(), 8, "discriminator");

// Schéma pour la longueur du Vec<RoutePlanStep>
export const routePlanLengthSchema = u32("route_plan_length");

// Interface pour les champs fixes
interface FixedFields {
    in_amount: bigint;
    quoted_out_amount: bigint;
    slippage_bps: number;
    platform_fee_bps: number;
}

// Schéma pour les montants et autres champs fixes
export const fixedFieldsSchema = struct<FixedFields>([
    u64("in_amount"),
    u64("quoted_out_amount"),
    u16("slippage_bps"),
    u8("platform_fee_bps"),
])

// Schéma pour les champs fixes seulement (sans route_plan)
export const jupiterSwapFixedSchema = struct<FixedFields>([
    u64("in_amount"),
    u64("quoted_out_amount"),
    u16("slippage_bps"),
    u8("platform_fee_bps"),
])

// Interface pour les champs fixes
interface SwapEvent {
    discriminator: number[];  // Changer en number[] pour correspondre à seq()
    amm: PublicKey;
    inputMint: PublicKey;
    inputAmount: bigint;
    outputMint: PublicKey;
    outputAmount: bigint;
}

// Schéma pour les montants et autres champs fixes
export const swapEventSchema = struct<SwapEvent>([
    seq(u8(), 16, "discriminator"),  // 16 bytes comme en Python
    publicKey("amm"),
    publicKey("inputMint"),
    u64("inputAmount"),
    publicKey("outputMint"),
    u64("outputAmount"),
])
