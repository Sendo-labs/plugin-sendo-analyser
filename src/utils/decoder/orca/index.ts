import { decodeB58Data, serializedBigInt } from "../index.js";
import { evtSwapEventCompleteSchema } from "./schema.js";

export const orcaDecoder = (programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];
    // console.log("orca", discriminator);

    try {

        switch (discriminator) {
            case 228:
                const meteoraSwapDecoded = evtSwapEventCompleteSchema.decode(Buffer.from(dataDecoded));
                // console.log(`📊 Swap Event decoded: ${JSON.stringify(serializedBigInt(meteoraSwapDecoded))}`);

                return {
                    discriminator,
                    pool: meteoraSwapDecoded.pool.toString(),
                    tradeDirection: meteoraSwapDecoded.tradeDirection,
                    hasReferral: meteoraSwapDecoded.hasReferral,
                    params: {
                        amountIn: meteoraSwapDecoded.amountIn.toString(),
                        minimumAmountOut: meteoraSwapDecoded.minimumAmountOut.toString(),
                    },
                    swapResult: {
                        outputAmount: meteoraSwapDecoded.outputAmount.toString(),
                        nextSqrtPrice: meteoraSwapDecoded.nextSqrtPrice.toString(),
                        lpFee: meteoraSwapDecoded.lpFee.toString(),
                        protocolFee: meteoraSwapDecoded.protocolFee.toString(),
                        partnerFee: meteoraSwapDecoded.partnerFee.toString(),
                        referralFee: meteoraSwapDecoded.referralFee.toString(),
                    },
                    actualAmountIn: meteoraSwapDecoded.actualAmountIn.toString(),
                    currentTimestamp: meteoraSwapDecoded.currentTimestamp.toString(),
                };
            default:
                // console.log(`❓ Unknown Orca discriminator: ${discriminator}`);
                return null;
        }
    } catch (error) {
        console.log("❌ Error decoding Meteora instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}