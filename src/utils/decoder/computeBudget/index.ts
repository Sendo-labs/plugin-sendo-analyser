import { decodeB58Data, serializedBigInt } from "../index.js";
import { setComputeUnitLimitSchema, setComputeUnitPriceSchema } from "./schema.js";

export const computeBudgetDecoder = (programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];

    try {
        switch (discriminator) {
            case 2:
                // console.log(`📊 Set Compute Unit Limit Event decoded: ${JSON.stringify(serializedBigInt(setComputeUnitLimitSchema.decode(Buffer.from(dataDecoded))))}`);
                return setComputeUnitLimitSchema.decode(Buffer.from(dataDecoded));
            case 3:
                // console.log(`📊 Set Compute Unit Price Event decoded: ${JSON.stringify(serializedBigInt(setComputeUnitPriceSchema.decode(Buffer.from(dataDecoded))))}`);
                return setComputeUnitPriceSchema.decode(Buffer.from(dataDecoded));

        default:
            return null
        }
    } catch (error) {
        console.log("Error decoding Pump.fun instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}