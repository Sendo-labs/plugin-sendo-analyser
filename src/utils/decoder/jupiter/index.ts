import { decodeB58Data, serializedBigInt } from "../index.js";
import { routePlanStepSchema, discriminatorSchema, routePlanLengthSchema, fixedFieldsSchema, swapEventSchema, jupiterSwapFixedSchema } from "./schema.js";
import { getSwapTypeName } from "./swapType.js";

// Export des types et fonctions utiles
export { SwapType, getSwapTypeName } from "./swapType.js";

// Fonction pour décoder manuellement l'array route_plan
const decodeRoutePlan = (buffer: Buffer, offset: number, length: number) => {
    const steps: any[] = [];
    let currentOffset = offset;
    
    for (let i = 0; i < length; i++) {
        const stepBuffer = buffer.slice(currentOffset, currentOffset + 4); // 4 bytes par step
        const step = routePlanStepSchema.decode(stepBuffer);
        
        // Résoudre le nom du type de swap
        const swapTypeName = getSwapTypeName(step.swap);
        
        steps.push({
            swap: step.swap,
            swap_type: swapTypeName, // Ajout du nom du type de swap
            percent: step.percent,
            input_index: step.input_index,
            output_index: step.output_index
        });
        currentOffset += 4;
    }
    
    return steps;
};

export const jupiterDecoder = (type: string, programId: string, instruction: any) => {
    const dataDecoded = decodeB58Data(instruction.data);
    const discriminator = dataDecoded[0];
    // console.log("jupiter", discriminator);

    try {
        switch (discriminator) {
            case 228:
                const swapEventDecoded = swapEventSchema.decode(Buffer.from(dataDecoded))
                // console.log(`📊 Swap Event decoded: ${JSON.stringify(serializedBigInt(swapEventDecoded))}`);
                return {
                    discriminator,
                    amm: swapEventDecoded.amm.toString(),
                    inputMint: swapEventDecoded.inputMint.toString(),
                    inputAmount: swapEventDecoded.inputAmount.toString(),
                    outputMint: swapEventDecoded.outputMint.toString(),
                    outputAmount: swapEventDecoded.outputAmount.toString(),
                };
            // Jupiter Swap
            case 229:
                const buffer = Buffer.from(dataDecoded);
                let offset = 0;
                
                // Décoder le discriminator (8 bytes)
                const discriminatorDecoded = discriminatorSchema.decode(buffer.slice(offset, offset + 8));
                offset += 8;
                
                // Décoder la longueur du route_plan (4 bytes)
                const routePlanLengthDecoded = routePlanLengthSchema.decode(buffer.slice(offset, offset + 4));
                offset += 4;
                            
                // Décoder les steps du route_plan
                const routePlanSteps = decodeRoutePlan(buffer, offset, routePlanLengthDecoded);
                offset += routePlanLengthDecoded * 4; // 4 bytes par step
                
                // Décoder les champs fixes avec le schéma
                const fixedFieldsDecoded = jupiterSwapFixedSchema.decode(buffer.slice(offset));

                // !!! warn struct : fix schema
                const jupiterSwapDecoded = {
                    discriminator: discriminatorDecoded[0], // juste le premier byte
                    route_plan: {
                        steps: routePlanSteps
                    },
                    in_amount: fixedFieldsDecoded.in_amount.toString(),
                    quoted_out_amount: fixedFieldsDecoded.quoted_out_amount.toString(),
                    slippage_bps: fixedFieldsDecoded.slippage_bps,
                    platform_fee_bps: fixedFieldsDecoded.platform_fee_bps,
                }

                // console.log(`📊 Jupiter Swap Event decoded: ${JSON.stringify(serializedBigInt(fixedFieldsDecoded))}`);
                
                return jupiterSwapDecoded;
            default:
                console.log(`❓ Unknown Jupiter discriminator: ${discriminator}`);
                return null
        }
    } catch (error) {
        console.log("❌ Error decoding Jupiter instruction:", error instanceof Error ? error.message : String(error));
        return null;
    }
}
