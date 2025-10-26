import * as borsh from "@coral-xyz/borsh"
import BN from "bn.js";

// --------------------------------
// setCompute Budget: SetComputeUnitLimit
interface setComputeUnitLimit {
    discriminator: BN;
    units: BN;
}
export const setComputeUnitLimitSchema = borsh.struct<setComputeUnitLimit>([
    borsh.u8("discriminator"),
    borsh.u32("units"),
])

// --------------------------------
//  setCompute Budget: SetComputeUnitPrice
interface setComputeUnitPrice {
    discriminator: BN;
    microLamports: BN;
}
export const setComputeUnitPriceSchema = borsh.struct<setComputeUnitPrice>([
    borsh.u8("discriminator"),
    borsh.u32("microLamports"),
])
