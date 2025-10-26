// Jupiter Swap Types - Basé sur l'enum Rust de Carbon
// Correspondance exacte avec l'enum Swap du protocole Jupiter

export enum SwapType {
    Saber = 0,
    SaberAddDecimalsDeposit = 1,
    SaberAddDecimalsWithdraw = 2,
    TokenSwap = 3,
    Sencha = 4,
    Step = 5,
    Cropper = 6,
    Raydium = 7,
    Crema = 8,
    Lifinity = 9,
    Mercurial = 10,
    Cykura = 11,
    Serum = 12,
    MarinadeDeposit = 13,
    MarinadeUnstake = 14,
    Aldrin = 15,
    AldrinV2 = 16,
    Whirlpool = 17,
    Invariant = 18,
    Meteora = 19,
    GooseFX = 20,
    DeltaFi = 21,
    Balansol = 22,
    MarcoPolo = 23,
    Dradex = 24,
    LifinityV2 = 25,
    RaydiumClmm = 26,
    Openbook = 27,
    Phoenix = 28,
    Symmetry = 29,
    TokenSwapV2 = 30,
    HeliumTreasuryManagementRedeemV0 = 31,
    StakeDexStakeWrappedSol = 32,
    StakeDexSwapViaStake = 33,
    GooseFXV2 = 34,
    Perps = 35,
    PerpsAddLiquidity = 36,
    PerpsRemoveLiquidity = 37,
    MeteoraDlmm = 38,
    OpenBookV2 = 39,
    RaydiumClmmV2 = 40,
    StakeDexPrefundWithdrawStakeAndDepositStake = 41,
    Clone = 42,
    SanctumS = 43,
    SanctumSAddLiquidity = 44,
    SanctumSRemoveLiquidity = 45,
    RaydiumCP = 46,
    WhirlpoolSwapV2 = 47,
    OneIntro = 48,
    PumpWrappedBuy = 49,
    PumpWrappedSell = 50,
    PerpsV2 = 51,
    PerpsV2AddLiquidity = 52,
    PerpsV2RemoveLiquidity = 53,
    MoonshotWrappedBuy = 54,
    MoonshotWrappedSell = 55,
    StabbleStableSwap = 56,
    StabbleWeightedSwap = 57,
    Obric = 58,
    FoxBuyFromEstimatedCost = 59,
    FoxClaimPartial = 60,
    SolFi = 61,
    SolayerDelegateNoInit = 62,
    SolayerUndelegateNoInit = 63,
    TokenMill = 64,
    DaosFunBuy = 65,
    DaosFunSell = 66,
    ZeroFi = 67,
    StakeDexWithdrawWrappedSol = 68,
    VirtualsBuy = 69,
    VirtualsSell = 70,
    Perena = 71,
    PumpSwapBuy = 72,
    PumpSwapSell = 73,
    Gamma = 74,
    MeteoraDlmmSwapV2 = 75,
    Woofi = 76,
    MeteoraDammV2 = 77,
    MeteoraDynamicBondingCurveSwap = 78,
    StabbleStableSwapV2 = 79,
    StabbleWeightedSwapV2 = 80,
    RaydiumLaunchlabBuy = 81,
    RaydiumLaunchlabSell = 82,
    BoopdotfunWrappedBuy = 83,
    BoopdotfunWrappedSell = 84,
    Plasma = 85,
    GoonFi = 86,
    HumidiFi = 87,
    MeteoraDynamicBondingCurveSwapWithRemainingAccounts = 88,
    TesseraV = 89,
    PumpWrappedBuyV2 = 90,
    PumpWrappedSellV2 = 91,
    PumpSwapBuyV2 = 92,
    PumpSwapSellV2 = 93,
    Heaven = 94,
    SolFiV2 = 95,
    Aquifer = 96,
    PumpWrappedBuyV3 = 97,
    PumpWrappedSellV3 = 98,
    PumpSwapBuyV3 = 99,
    PumpSwapSellV3 = 100,
    JupiterLendDeposit = 101,
    JupiterLendRedeem = 102,
    DefiTuna = 103,
    AlphaQ = 104,
    RaydiumV2 = 105,
    // Types supplémentaires pour les valeurs manquantes
    Unknown106 = 106,
    Unknown107 = 107,
    MeteoraDammV2WithRemainingAccounts = 108, // Votre exemple
    Unknown109 = 109,
    Unknown110 = 110,
    // Continuez selon vos besoins...
}

// Fonction pour obtenir le nom du type de swap à partir de l'index
export const getSwapTypeName = (swapIndex: number): string => {
    const swapTypeName = Object.keys(SwapType).find(key => SwapType[key as keyof typeof SwapType] === swapIndex);
    return swapTypeName || `Unknown${swapIndex}`;
};

// Fonction pour obtenir l'index à partir du nom du type de swap
export const getSwapTypeIndex = (swapTypeName: string): number | null => {
    const index = Object.keys(SwapType).find(key => key === swapTypeName);
    return index ? SwapType[index as keyof typeof SwapType] : null;
};

// Fonction pour vérifier si un index de swap est valide
export const isValidSwapType = (swapIndex: number): boolean => {
    return swapIndex in SwapType;
};

// Fonction pour obtenir tous les types de swap disponibles
export const getAllSwapTypes = (): { index: number; name: string }[] => {
    return Object.entries(SwapType)
        .filter(([key, value]) => typeof value === 'number')
        .map(([name, index]) => ({ index: index as number, name }));
};
