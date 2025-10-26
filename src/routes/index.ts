import type { Route, IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { SendoAnalyserService } from '../services/sendoAnalyserService.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

function sendSuccess(res: any, data: any, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, data }));
}

function sendError(res: any, status: number, code: string, message: string, details?: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: { code, message, details } }));
}

// ============================================
// ROUTE HANDLERS
// ============================================

/**
 * GET /trades/:address?limit=5&cursor=signature
 * Get trades for a wallet address with price analysis
 */
async function getTradesHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  // Parse limit from query params
  const limitParam = req.query?.limit;
  let limit = 5; // default

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return sendError(res, 400, 'INVALID_LIMIT', 'limit must be a positive integer');
    }
    limit = Math.min(parsedLimit, 50); // max 50
  }

  // Parse cursor from query params
  const cursor = req.query?.cursor as string | undefined;

  try {
    const result = await analyserService.getTradesForAddress(address, limit, cursor);
    sendSuccess(res, { address, ...result });
  } catch (error: any) {
    logger.error('[Route] Failed to get trades:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get trades', error.message);
  }
}

/**
 * GET /signatures/:address?limit=5&cursor=signature
 * Get transaction signatures for a wallet address
 */
async function getSignaturesHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  // Parse limit from query params
  const limitParam = req.query?.limit;
  let limit = 5; // default

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return sendError(res, 400, 'INVALID_LIMIT', 'limit must be a positive integer');
    }
    limit = Math.min(parsedLimit, 50); // max 50
  }

  // Parse cursor from query params
  const cursor = req.query?.cursor as string | undefined;

  try {
    const result = await analyserService.getSignaturesForAddress(address, limit, cursor);
    sendSuccess(res, { address, ...result });
  } catch (error: any) {
    logger.error('[Route] Failed to get signatures:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get signatures', error.message);
  }
}

/**
 * GET /transactions/:address?limit=5&cursor=signature
 * Get decoded transactions for a wallet address
 */
async function getTransactionsHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  // Parse limit from query params
  const limitParam = req.query?.limit;
  let limit = 5; // default

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return sendError(res, 400, 'INVALID_LIMIT', 'limit must be a positive integer');
    }
    limit = Math.min(parsedLimit, 50); // max 50
  }

  // Parse cursor from query params
  const cursor = req.query?.cursor as string | undefined;

  try {
    const result = await analyserService.getTransactionsForAddress(address, limit, cursor);
    sendSuccess(res, { address, ...result });
  } catch (error: any) {
    logger.error('[Route] Failed to get transactions:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get transactions', error.message);
  }
}

/**
 * GET /tokens/:address
 * Get token holdings for a wallet address
 */
async function getTokensHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const tokens = await analyserService.getTokensForAddress(address);
    sendSuccess(res, { address, tokens });
  } catch (error: any) {
    logger.error('[Route] Failed to get tokens:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get tokens', error.message);
  }
}

/**
 * GET /nfts/:address
 * Get NFT holdings for a wallet address
 */
async function getNftsHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const nfts = await analyserService.getNftsForAddress(address);
    sendSuccess(res, { address, nfts });
  } catch (error: any) {
    logger.error('[Route] Failed to get NFTs:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get NFTs', error.message);
  }
}

/**
 * GET /global/:address
 * Get wallet balance and global overview
 */
async function getGlobalHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const global = await analyserService.getGlobalForAddress(address);
    sendSuccess(res, { address, global });
  } catch (error: any) {
    logger.error('[Route] Failed to get global info:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get global info', error.message);
  }
}

/**
 * GET /wallet/:address
 * Get complete wallet analysis (all data combined)
 */
async function getCompleteWalletHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const analysis = await analyserService.getCompleteWalletAnalysis(address);
    sendSuccess(res, { analysis });
  } catch (error: any) {
    logger.error('[Route] Failed to get complete wallet analysis:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get complete wallet analysis', error.message);
  }
}

// ============================================
// ROUTE DEFINITIONS
// ============================================

export const sendoAnalyserRoutes: Route[] = [
  {
    type: 'GET',
    path: '/signatures/:address',
    handler: getSignaturesHandler,
  },
  {
    type: 'GET',
    path: '/trades/:address',
    handler: getTradesHandler,
  },
  {
    type: 'GET',
    path: '/transactions/:address',
    handler: getTransactionsHandler,
  },
  {
    type: 'GET',
    path: '/tokens/:address',
    handler: getTokensHandler,
  },
  {
    type: 'GET',
    path: '/nfts/:address',
    handler: getNftsHandler,
  },
  {
    type: 'GET',
    path: '/global/:address',
    handler: getGlobalHandler,
  },
  {
    type: 'GET',
    path: '/wallet/:address',
    handler: getCompleteWalletHandler,
  },
];