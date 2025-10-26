/**
 * Utilitaires pour l'analyse des trades sur Solana
 */

// 🪙 Tokens de base (référence pour déterminer buy/sell)
export const BASE_TOKENS = {
    WSOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
} as const;

/**
 * Vérifie si un token est un token de base (SOL, USDC, USDT)
 */
export const isBaseToken = (mint: string): boolean => {
    return Object.values(BASE_TOKENS).includes(mint as any);
};

/**
 * Détermine le type de trade (buy/sell) pour Meteora DLMM
 * @param tradeDirection - Direction du trade (0 = A→B, 1 = B→A)
 * @param tokenAMint - Adresse du token A
 * @param tokenBMint - Adresse du token B
 * @returns 'buy' ou 'sell'
 */
export const determineMeteoraTradeType = (
    tradeDirection: number,
    tokenAMint: string,
    tokenBMint: string
): 'buy' | 'sell' => {
    if (tradeDirection === 0) {
        // Token A → Token B
        return isBaseToken(tokenAMint) ? 'buy' : 'sell';
    } else {
        // Token B → Token A
        return isBaseToken(tokenBMint) ? 'buy' : 'sell';
    }
};

/**
 * Détermine les tokens input/output pour Meteora
 * @param tradeDirection - Direction du trade (0 = A→B, 1 = B→A)
 * @param tokenAMint - Adresse du token A
 * @param tokenBMint - Adresse du token B
 * @returns Objet avec inputToken et outputToken
 */
export const getMeteoraTokens = (
    tradeDirection: number,
    tokenAMint: string,
    tokenBMint: string
) => {
    if (tradeDirection === 0) {
        return {
            inputToken: tokenAMint,
            outputToken: tokenBMint
        };
    } else {
        return {
            inputToken: tokenBMint,
            outputToken: tokenAMint
        };
    }
};

/**
 * Interface pour les données de trade standardisées
 */
export interface StandardizedTrade {
    programId: string;
    signature: string;
    timestamp: string;
    mintA: string;
    amountA: string;
    mintB: string;
    amountB: string;
    type: 'buy' | 'sell';
}

/**
 * Crée un objet de trade standardisé pour Meteora
 */
export const createMeteoraTrade = (
    programId: string,
    signature: string,
    timestamp: string,
    tradeDirection: number,
    tokenAMint: string,
    tokenBMint: string,
    amountIn: string,
    amountOut: string
): StandardizedTrade => {
    const tradeType = determineMeteoraTradeType(tradeDirection, tokenAMint, tokenBMint);
    const tokens = getMeteoraTokens(tradeDirection, tokenAMint, tokenBMint);

    return {
        programId,
        signature,
        timestamp,
        mintA: tokens.inputToken,
        amountA: amountIn,
        mintB: tokens.outputToken,
        amountB: amountOut,
        type: tradeType
    };
};

/**
 * Détermine le type de trade pour Raydium (basé sur les tokens de base)
 * @param baseMint - Token de base (coin)
 * @param quoteMint - Token de quote (pc)
 * @param amountIn - Montant d'entrée
 * @param amountOut - Montant de sortie
 * @returns 'buy' ou 'sell'
 */
export const determineRaydiumTradeType = (
    baseMint: string,
    quoteMint: string,
    amountIn: string,
    amountOut: string
): 'buy' | 'sell' => {
    // Si on donne le token de base (SOL/USDC) → BUY
    // Si on donne le token de quote (memecoin) → SELL
    return isBaseToken(baseMint) ? 'buy' : 'sell';
};

/**
 * Crée un objet de trade standardisé pour Raydium
 */
export const createRaydiumTrade = (
    programId: string,
    signature: string,
    timestamp: string,
    baseMint: string,
    quoteMint: string,
    amountIn: string,
    amountOut: string
): StandardizedTrade => {
    const tradeType = determineRaydiumTradeType(baseMint, quoteMint, amountIn, amountOut);

    return {
        programId,
        signature,
        timestamp,
        mintA: baseMint,
        amountA: amountIn,
        mintB: quoteMint,
        amountB: amountOut,
        type: tradeType
    };
};
