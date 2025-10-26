import { decodeTxData } from '../utils/decoder/index.js';
import { helius } from '../config/index.js';
import { serializedBigInt } from '@/utils/decoder/index.js';

export const getAccountInfo = async (address: string) => {
    const account = await helius.getAccountInfo(address, {
        "encoding": "base64"
    });
    return account;
};

export const getBlock = async (address: string) => {
    const account = await helius.getBlock(address);
    return account;
};

export const getSignaturesForAddress = async (address: string, limit: number) => {
    const signatures = await helius.getSignaturesForAddress(
        address,
        { limit }
    );
    return signatures;
};

export const getNftsForAddress = async (address: string) => {
    const nfts = await helius.getAssetsByOwner({ ownerAddress: address });
    return nfts;
};

export const getTokensForAddress = async (address: string) => {
    const tokens = await helius.getTokenAccounts({ owner: address });
    return tokens;
};

export const getBalanceForAddress = async (address: string) => {
    const balance = await helius.getBalance(address);
    return balance;
};

export const getTransactionsForAddress = async (address: string, limit: number) => {
    const transactions: any[] = [];
    const signatures = await getSignaturesForAddress(address, limit);

    for (let i = 0; i < signatures.length; i++) {
        const signature = signatures[i];
        const transaction = await helius.getTransaction(signature.signature, {
            maxSupportedTransactionVersion: 0
        });

        if (transaction) {
            transactions.push(transaction);
        }

        // Ajouter un délai de 1000ms entre chaque requête (sauf pour la dernière)
        if (i < signatures.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return transactions;
};

export const getTransactionBySignature = async (signature: string) => {
    const transaction = await helius.getTransaction(signature, {
        maxSupportedTransactionVersion: 0
    });
    return transaction;
};

