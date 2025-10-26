import { decodeB58Data, serializedBigInt } from "../index.js";
import { PfBuySchema, pfCpiLogBuySellSchema, pfSellSchema } from "./schema.js";

export const pfDecoder = (programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];
    // console.log("pumpfun", discriminator);
    try {
        switch (discriminator) {
            // Sells
            case 51:
                const pfSellDecoded = pfSellSchema.decode(Buffer.from(dataDecoded))
                // console.log(`📊 Sell Event decoded: ${JSON.stringify(serializedBigInt(pfSellDecoded))}`);
                return {
                    discriminator,
                    amount: pfSellDecoded.amount.toString(),
                    minSolOutput: pfSellDecoded.minSolOutput.toString(),
                };
            // Buy
            case 102:
                const pfBuyDecoded = PfBuySchema.decode(Buffer.from(dataDecoded))
                // console.log(`📊 Buy Event decoded: ${JSON.stringify(serializedBigInt(pfBuyDecoded))}`);
                return {
                    discriminator,
                    amount: pfBuyDecoded.amount.toString(),
                    minSolOutput: pfBuyDecoded.maxSolCost.toString(),
                };
            // CPI Log
            case 228:
                const pfCpiLogBuySellDecoded = pfCpiLogBuySellSchema.decode(Buffer.from(dataDecoded))
                // console.log(`📊 CPI Log Buy/Sell Event decoded: ${JSON.stringify(serializedBigInt(pfCpiLogBuySellDecoded))}`);
                return {
                    discriminator,
                    mint: pfCpiLogBuySellDecoded.mint,
                    solAmount: pfCpiLogBuySellDecoded.solAmount.toString(),
                    tokenAmount: pfCpiLogBuySellDecoded.tokenAmount.toString(),
                    isBuy: pfCpiLogBuySellDecoded.isBuy.toString(),
                    user: pfCpiLogBuySellDecoded.user.toString(),
                    timestamp: pfCpiLogBuySellDecoded.timestamp.toString(),
                    virtualSolReserves: pfCpiLogBuySellDecoded.virtualSolReserves.toString(),
                    virtualTokenReserves: pfCpiLogBuySellDecoded.virtualTokenReserves.toString(),
                    realSolReserves: pfCpiLogBuySellDecoded.realSolReserves.toString(),
                    realTokenReserves: pfCpiLogBuySellDecoded.realTokenReserves.toString(),
                    feeRecipient: pfCpiLogBuySellDecoded.feeRecipient.toString(),
                    feeBasisPoints: pfCpiLogBuySellDecoded.feeBasisPoints.toString(),
                    fee: pfCpiLogBuySellDecoded.fee.toString(),
                    creator: pfCpiLogBuySellDecoded.creator.toString(),
                    creatorFeeBasisPoints: pfCpiLogBuySellDecoded.creatorFeeBasisPoints.toString(),
                    creatorFee: pfCpiLogBuySellDecoded.creatorFee.toString(),
                    // trackVolume: pfCpiLogBuySellDecoded.trackVolume.toString(),
                    // totalUnclaimedTokens: pfCpiLogBuySellDecoded.totalUnclaimedTokens.toString(),
                    // totalClaimedTokens: pfCpiLogBuySellDecoded.totalClaimedTokens.toString(),
                    // currentSolVolume: pfCpiLogBuySellDecoded.currentSolVolume.toString(),
                    // lastUpdateTimestamp: pfCpiLogBuySellDecoded.lastUpdateTimestamp.toString(),
                };
            // case 231: // Close Account
        default:
            return null
        }
    } catch (error) {
        console.log("Error decoding Pump.fun instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}