import { decodeB58Data, serializedBigInt } from "../index.js";
import { raydiumSwapSchema } from "./schema.js";

export const raydiumDecoder = (programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];
    // console.log("raydium", discriminator);

    try {

        switch (discriminator) {
            case 9:
                const raydiumSwapDecoded = raydiumSwapSchema.decode(Buffer.from(dataDecoded));
                // console.log(`📊 Swap Event decoded: ${JSON.stringify(serializedBigInt(raydiumSwapDecoded))}`);

                return {
                    discriminator,
                    amountIn: raydiumSwapDecoded.amountIn.toString(),
                    minimumAmountOut: raydiumSwapDecoded.minimumAmountOut.toString(),
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