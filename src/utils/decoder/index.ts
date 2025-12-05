// import { decodeBase64Data, serializedBigInt } from "./index.js";
import { computeBudgetDecoder } from "./computeBudget/index.js";
import { pfDecoder } from "./pumpfun/index.js";
import { pumpswapDecoder } from "./pumpswap/index.js";
import { jupiterDecoder } from "./jupiter/index.js";
import { meteoraDecoder } from "./meteora/index.js";
import { orcaDecoder } from "./orca/index.js";
import { whirlpoolDecoder } from "./whirlpool/index.js";
import { raydiumDecoder } from "./raydium/index.js";
import { getGlobalHeliusService } from "../../services/api/index.js";
import { poolKeysSchema } from "./pumpswap/schema.js";
import { poolLayoutSchema } from "./meteora/schema.js";
import { raydiumPoolSchema } from "./raydium/schema.js";
import { createMeteoraTrade, createRaydiumTrade } from "./tradingUtils.js";
import { BalanceAnalysis, extractBalances } from "./extractBalances";
import { HeliusTransaction, createHeliusService } from "../../services/api/helius";
import bs58 from "bs58";

export interface TxDecodeResult {
    signature: string;
    recentBlockhash: string;
    blockTime: number;
    fee: any;
    error: string;
    status: any;
    accounts: any[];
    decodedInstructions: any[];
    parsed: any[];
    balances: BalanceAnalysis;
    totalInstructions: number;
    totalAccountsKeys: number;
    totalWritableKeys: number;
    totalReadonlyKeys: number;
    totalInnerInstructions: any;
    successfullyDecoded: number;
}

export interface SolanaInstruction {
    programIdIndex: number;
    accounts: number[];
    data: string;
    stackHeight: number;
}

export interface InnerInstruction {
    index: number;
    instructions: SolanaInstruction[];
}

// --------------------------------
// Serializing big ints to strings
// --------------------------------
export const serializedBigInt = (data: any) => JSON.parse(JSON.stringify(data, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
));
// --------------------------------
// Decoding base58 data
// --------------------------------
export const decodeB58Data = (data: any) => {
    const b58Decoded = bs58.decode(data);
    return b58Decoded;
}
// --------------------------------
// Decoding base64 data
// --------------------------------
export const decodeBase64Data = (data: any) => {
    return Buffer.from(data, 'base64');
}

export const routerDecoderInstructionsData = (type: string, programId: string, instruction: SolanaInstruction) => {
    try {
        switch (programId) {
            // COMPUTE_BUDGET_PROGRAM_ID
            case "ComputeBudget111111111111111111111111111111":
                return computeBudgetDecoder(programId, instruction)
            // PUMP.FUN_PROGRAM_ID
            case "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P":
                return pfDecoder(programId, instruction);
            // PUMP.FUN_AMM_PROGRAM_ID
            case "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA":
                return pumpswapDecoder(programId, instruction);
            // PROGRAM_RAYDIUM_AMM
            case "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8":
                return raydiumDecoder(programId, instruction);
            // PROGRAM ORCA V2
            case "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE":
                return orcaDecoder(programId, instruction);
            // PROGRAM WHIRLPOOL V2
            case "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc":
                return whirlpoolDecoder(programId, instruction);
            // PROGRAM_METEORA_DAMM_V2
            case "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG":
                return meteoraDecoder(type, programId, instruction);
            // PROGRAM_JUPITER_V6
            case "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4":
                return jupiterDecoder(instruction);
            default:
                return null;
        }
    } catch (error) {
        console.log("Error decoding instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Extrait un format standardisé de swap si le decoded correspond à un échange
 */
export const extractSwapData = async (programId: string, decoded: any, tx: any) => {
    // 🪙 Jupiter
    if (programId === "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" && decoded.inputMint && decoded.outputMint) {
        return {
            programId,
            signature: tx.transaction.signatures[0],
            timestamp: serializedBigInt(tx.blockTime),
            mintA: decoded.inputMint,
            amountA: decoded.inputAmount,
            mintB: decoded.outputMint,
            amountB: decoded.outputAmount,
        };
    }

    // 🪙 Raydium
    // !!! Pas de token amount correct
    if (programId === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" && decoded.amountIn && decoded.minimumAmountOut) {
        const heliusService = getGlobalHeliusService();
        const accountInfo = await heliusService.getAccountInfo(tx.transaction.message.accountKeys[2]);
        if (!accountInfo.value) {
            return null;
        }
        const dataDecoded = decodeBase64Data(accountInfo.value.data[0]);
        const poolKeysRaydium = raydiumPoolSchema.decode(dataDecoded);
        const balances = await extractBalances(tx);

        return createRaydiumTrade(
            programId,
            tx.transaction.signatures[0],
            serializedBigInt(tx.blockTime),
            poolKeysRaydium.baseMint.toString(),
            poolKeysRaydium.quoteMint.toString(),
            decoded.amountIn,
            decoded.minimumAmountOut
        );
    }

    // 🪙 Pumpfun AMM
    if (programId === "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA" && (decoded.baseAmountOut || decoded.baseAmountIn) && (decoded.maxQuoteAmountIn || decoded.minQuoteAmountOut)) {
        const heliusService = getGlobalHeliusService();
        const accountInfo = await heliusService.getAccountInfo(decoded.pool);
        if (!accountInfo.value) {
            return null;
        }
        const dataDecoded = decodeBase64Data(accountInfo.value.data[0]);
        const poolKeys = poolKeysSchema.decode(dataDecoded);

        return {
            programId,
            signature: tx.transaction.signatures[0],
            timestamp: serializedBigInt(tx.blockTime),
            mintA: poolKeys.base_mint.toString() ?? decoded.pool ?? null,
            amountA: decoded.baseAmountOut || decoded.baseAmountIn,
            mintB: poolKeys.quote_mint.toString() ?? null,
            amountB: decoded.maxQuoteAmountIn || decoded.minQuoteAmountOut
        };
    }

    // 🪙 Pumpfun
    if (programId === "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" && decoded.mint && decoded.tokenAmount && decoded.solAmount) {
        return {
            programId,
            signature: tx.transaction.signatures[0],
            timestamp: serializedBigInt(tx.blockTime),
            mintA: decoded.mint,
            amountA: decoded.tokenAmount,
            mintB: 'So11111111111111111111111111111111111111112',
            amountB: decoded.solAmount,
            type: decoded.isBuy === 'true' ? 'buy' : 'sell'
        };
    }

    // 🪙 Meteora (DLMM)
    if (programId === "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG" && decoded.params?.amountIn && decoded.pool && decoded.swapResult?.outputAmount) {
        const heliusService = getGlobalHeliusService();
        const accountInfo = await heliusService.getAccountInfo(decoded.pool);
        if (!accountInfo.value) {
            return null;
        }
        const dataDecoded = decodeBase64Data(accountInfo.value.data[0]);
        const poolKeys = poolLayoutSchema.decode(dataDecoded);

        return createMeteoraTrade(
            programId,
            tx.transaction.signatures[0],
            serializedBigInt(tx.blockTime),
            decoded.tradeDirection,
            poolKeys.tokenAMint.toString(),
            poolKeys.tokenBMint.toString(),
            decoded.params.amountIn,
            decoded.swapResult.outputAmount
        );
    }

    return null;
};

export const decodeTxData = async (tx: HeliusTransaction): Promise<TxDecodeResult | undefined> => {

    // Guard: vérifier que la transaction a la structure minimale requise
    if (!tx || !tx.signature || !tx.blockTime) {
        // Retourner une structure vide pour les transactions invalides (skip silencieusement)
        return {
            signature: '',
            recentBlockhash: '',
            blockTime: 0,
            fee: 0,
            error: 'INVALID_STRUCTURE',
            status: { Err: 'Invalid transaction structure' },
            accounts: [],
            decodedInstructions: [],
            parsed: [],
            balances: {
                solBalances: [],
                tokenBalances: [],
                signerAddress: '',
                signerSolBalance: null,
                signerTokenBalances: [],
                significantChanges: { solChanges: [], tokenChanges: [] },
                traders: []
            },
            totalInstructions: 0,
            totalAccountsKeys: 0,
            totalWritableKeys: 0,
            totalReadonlyKeys: 0,
            totalInnerInstructions: 0,
            successfullyDecoded: 0
        };
    }
    const heliusService = createHeliusService(process.env.HELIUS_API_KEY || '', 10);
    try {
        const transactionInfo = await heliusService.getTransaction(tx.signature);

        // Extraire les balances avec le nouveau module
        const balanceAnalysis = await extractBalances(transactionInfo);
        const instructions: SolanaInstruction[] = transactionInfo.transaction.message.instructions;
        const innerInstructions: InnerInstruction[] | undefined = transactionInfo.meta.innerInstructions;
        
        const accounts: string[] = [
            ...transactionInfo.transaction.message.accountKeys,
            ...(transactionInfo.meta?.loadedAddresses?.writable ?? []),
            ...(transactionInfo.meta?.loadedAddresses?.readonly ?? [])
        ];
        const decodedInstructions: any[] = [];
        const parsed: any[] = [];

        // Process main instructions
        for (const instruction of instructions) {
            try {
                const programId = accounts[instruction.programIdIndex];
                const decoded = routerDecoderInstructionsData('instruction', programId, instruction);

                if (decoded) {
                    decodedInstructions.push({
                        programId,
                        type: "main",
                        instruction,
                        decoded
                    });
                    // Si c’est un swap Jupiter, Pumpfun, Orca, etc.
                    const swap = await extractSwapData(programId, decoded, transactionInfo);
                    if (swap) parsed.push(swap);
                }
            } catch (error) {
                console.log("Error processing instruction:", error instanceof Error ? error.message : String(error));
            }
        }

        // Process inner instructions
        if (innerInstructions) {
            for (const innerInst of innerInstructions) {
                for (const instruction of innerInst.instructions) {
                    try {
                        const programId = accounts[instruction.programIdIndex];
                        const decoded = routerDecoderInstructionsData('instruction', programId, instruction);

                        if (decoded) {
                            decodedInstructions.push({
                                programId,
                                type: "inner",
                                instruction,
                                decoded
                            });
                            const swap = await extractSwapData(programId, decoded, transactionInfo);
                            if (swap) parsed.push(swap);
                        }
                    } catch (error) {
                        console.log("Error processing inner instruction:", error instanceof Error ? error.message : String(error));
                    }
                }
            }
        }

        return {
            signature: transactionInfo.transaction.signatures,
            recentBlockhash: transactionInfo.transaction.recentBlockhash,
            blockTime: serializedBigInt(transactionInfo.blockTime),
            fee: transactionInfo.transaction.fee,
            error: transactionInfo.meta.err ? 'FAILED' : 'SUCCESS',
            status: transactionInfo.meta.status,
            accounts: accounts,
            decodedInstructions,
            parsed,
            balances: balanceAnalysis,
            totalInstructions: instructions.length,
            totalAccountsKeys: transactionInfo.transaction.message.accountKeys.length,
            totalWritableKeys: transactionInfo.meta?.loadedAddresses?.writable.length,
            totalReadonlyKeys: transactionInfo.meta?.loadedAddresses?.readonly.length,
            totalInnerInstructions: innerInstructions ? innerInstructions.reduce((sum: number, inst: InnerInstruction) => sum + inst.instructions.length, 0) : 0,
            successfullyDecoded: decodedInstructions.length
        }
    } catch (error) {
        console.log("Error getting transaction info:", error instanceof Error ? error.message : String(error));
        return undefined;
    }
}