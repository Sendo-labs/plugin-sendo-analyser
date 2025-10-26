import { decodeB58Data, serializedBigInt } from "../index.js";
import { whirlpoolSwapSchema } from "./schema.js";

export const whirlpoolDecoder = (programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];
    // console.log("whirlpool", discriminator);

    try {
        switch (discriminator) {
            case 248:
                const meteoraSwapDecoded = whirlpoolSwapSchema.decode(Buffer.from(dataDecoded));
                // console.log(`📊 Swap Event decoded: ${JSON.stringify(serializedBigInt(meteoraSwapDecoded))}`);

                return {
                    discriminator,
                    amount: meteoraSwapDecoded.amount.toString(),
                    otherAmountThreshold: meteoraSwapDecoded.otherAmountThreshold.toString(),
                    sqrtPriceLimit: meteoraSwapDecoded.sqrtPriceLimit.toString(),
                    amountSpecifiedIsInput: meteoraSwapDecoded.amountSpecifiedIsInput,
                    aToB: meteoraSwapDecoded.aToB,
                };
            default:
                console.log(`❓ Unknown Meteora discriminator: ${discriminator}`);
                return null;
        }
    } catch (error) {
        console.log("❌ Error decoding Meteora instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}