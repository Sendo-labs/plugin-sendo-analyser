import { decodeB58Data, serializedBigInt } from "../index.js";
import { pumpSwapBuySchema, pumpSwapSellSchema, pumpSwapCpiLogBuySchema, pumpSwapCpiLogSellSchema } from "./schema.js";

export const pumpswapDecoder = (programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];
    // console.log("pumpswap", discriminator);

    try {
        switch (discriminator) {
            // Sells
            case 51:
                const pfSellDecoded = pumpSwapSellSchema.decode(Buffer.from(dataDecoded))
                // console.log(`📊 Sell Event decoded: ${JSON.stringify(serializedBigInt(pfSellDecoded))}`);
                return {
                    discriminator,
                    amount: pfSellDecoded.base_amount_in.toString(),
                    minSolOutput: pfSellDecoded.min_quote_amount_out.toString(),
                };
            // Buy
            case 102:
                const pfBuyDecoded = pumpSwapBuySchema.decode(Buffer.from(dataDecoded))
                // console.log(`📊 Buy Event decoded: ${JSON.stringify(serializedBigInt(pfBuyDecoded))}`);
                return {
                    discriminator,
                    amount: pfBuyDecoded.base_amount_out.toString(),
                    minSolOutput: pfBuyDecoded.max_quote_amount_in.toString(),
                };
            // CPI Log
            case 228:
                // Buy
                if (dataDecoded[8] === 103) {
                    const pfCpiLogBuyDecoded = pumpSwapCpiLogBuySchema.decode(Buffer.from(dataDecoded))
                    // console.log(`📊 CPI Log Buy Event decoded: ${JSON.stringify(serializedBigInt(pfCpiLogBuyDecoded))}`);
                    return {
                        discriminator,
                        timestamp: pfCpiLogBuyDecoded.timestamp.toString(),
                        baseAmountOut: pfCpiLogBuyDecoded.baseAmountOut.toString(),
                        maxQuoteAmountIn: pfCpiLogBuyDecoded.maxQuoteAmountIn.toString(),
                        userBaseTokenReserves: pfCpiLogBuyDecoded.userBaseTokenReserves.toString(),
                        userQuoteTokenReserves: pfCpiLogBuyDecoded.userQuoteTokenReserves.toString(),
                        poolBaseTokenReserves: pfCpiLogBuyDecoded.poolBaseTokenReserves.toString(),
                        poolQuoteTokenReserves: pfCpiLogBuyDecoded.poolQuoteTokenReserves.toString(),
                        quoteAmountIn: pfCpiLogBuyDecoded.quoteAmountIn.toString(),
                        lpFeeBasisPoints: pfCpiLogBuyDecoded.lpFeeBasisPoints.toString(),
                        lpFee: pfCpiLogBuyDecoded.lpFee.toString(),
                        protocolFeeBasisPoints: pfCpiLogBuyDecoded.protocolFeeBasisPoints.toString(),
                        protocolFee: pfCpiLogBuyDecoded.protocolFee.toString(),
                        quoteAmountInWithLpFee: pfCpiLogBuyDecoded.quoteAmountInWithLpFee.toString(),
                        userQuoteAmountIn: pfCpiLogBuyDecoded.userQuoteAmountIn.toString(),
                        pool: pfCpiLogBuyDecoded.pool.toString(),
                        user: pfCpiLogBuyDecoded.user.toString(),
                        userBaseTokenAccount: pfCpiLogBuyDecoded.userBaseTokenAccount.toString(),
                        userQuoteTokenAccount: pfCpiLogBuyDecoded.userQuoteTokenAccount.toString(),
                        protocolFeeRecipient: pfCpiLogBuyDecoded.protocolFeeRecipient.toString(),
                        protocolFeeRecipientTokenAccount: pfCpiLogBuyDecoded.protocolFeeRecipientTokenAccount.toString(),
                        coinCreator: pfCpiLogBuyDecoded.coinCreator.toString(),
                        coinCreatorFeeBasisPoints: pfCpiLogBuyDecoded.coinCreatorFeeBasisPoints.toString(),
                        coinCreatorFee: pfCpiLogBuyDecoded.coinCreatorFee.toString(),
                        // trackVolume: pfCpiLogBuyDecoded.trackVolume,
                        // totalUnclaimedTokens: pfCpiLogBuyDecoded.totalUnclaimedTokens.toString(),
                        // totalClaimedTokens: pfCpiLogBuyDecoded.totalClaimedTokens.toString(),
                        // currentSolVolume: pfCpiLogBuyDecoded.currentSolVolume.toString(),
                        // lastUpdateTimestamp: pfCpiLogBuyDecoded.lastUpdateTimestamp.toString(),
                    };
                } 
                // Sell
                else if (dataDecoded[8] === 62) {
                    const pfCpiLogSellDecoded = pumpSwapCpiLogSellSchema.decode(Buffer.from(dataDecoded))
                    // console.log(`📊 CPI Log Sell Event decoded: ${JSON.stringify(serializedBigInt(pfCpiLogSellDecoded))}`);
                    return {
                        discriminator,
                        timestamp: pfCpiLogSellDecoded.timestamp.toString(),
                        baseAmountIn: pfCpiLogSellDecoded.baseAmountIn.toString(),
                        minQuoteAmountOut: pfCpiLogSellDecoded.minQuoteAmountOut.toString(),
                        userBaseTokenReserves: pfCpiLogSellDecoded.userBaseTokenReserves.toString(),
                        userQuoteTokenReserves: pfCpiLogSellDecoded.userQuoteTokenReserves.toString(),
                        poolBaseTokenReserves: pfCpiLogSellDecoded.poolBaseTokenReserves.toString(),
                        poolQuoteTokenReserves: pfCpiLogSellDecoded.poolQuoteTokenReserves.toString(),
                        quoteAmountOut: pfCpiLogSellDecoded.quoteAmountOut.toString(),
                        lpFeeBasisPoints: pfCpiLogSellDecoded.lpFeeBasisPoints.toString(),
                        lpFee: pfCpiLogSellDecoded.lpFee.toString(),
                        protocolFeeBasisPoints: pfCpiLogSellDecoded.protocolFeeBasisPoints.toString(),
                        protocolFee: pfCpiLogSellDecoded.protocolFee.toString(),
                        quoteAmountOutWithoutLpFee: pfCpiLogSellDecoded.quoteAmountOutWithoutLpFee.toString(),
                        userQuoteAmountOut: pfCpiLogSellDecoded.userQuoteAmountOut.toString(),
                        pool: pfCpiLogSellDecoded.pool.toString(),
                        user: pfCpiLogSellDecoded.user.toString(),
                        userBaseTokenAccount: pfCpiLogSellDecoded.userBaseTokenAccount.toString(),
                        userQuoteTokenAccount: pfCpiLogSellDecoded.userQuoteTokenAccount.toString(),
                        protocolFeeRecipient: pfCpiLogSellDecoded.protocolFeeRecipient.toString(),
                        protocolFeeRecipientTokenAccount: pfCpiLogSellDecoded.protocolFeeRecipientTokenAccount.toString(),
                        coinCreator: pfCpiLogSellDecoded.coinCreator.toString(),
                        coinCreatorFeeBasisPoints: pfCpiLogSellDecoded.coinCreatorFeeBasisPoints.toString(),
                        coinCreatorFee: pfCpiLogSellDecoded.coinCreatorFee.toString(),
                        // trackVolume: pfCpiLogSellDecoded.trackVolume,
                        // totalUnclaimedTokens: pfCpiLogSellDecoded.totalUnclaimedTokens.toString(),
                        // totalClaimedTokens: pfCpiLogSellDecoded.totalClaimedTokens.toString(),
                        // currentSolVolume: pfCpiLogSellDecoded.currentSolVolume.toString(),
                        // lastUpdateTimestamp: pfCpiLogSellDecoded.lastUpdateTimestamp.toString(),
                    };
                }
            // case 231: // Close Account
        default:
            return null
        }
    } catch (error) {
        console.log("Error decoding Pump.fun instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}