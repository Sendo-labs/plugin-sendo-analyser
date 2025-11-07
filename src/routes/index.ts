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
// ASYNC ANALYSIS ROUTES
// ============================================

/**
 * POST /analysis/start
 * Start async wallet analysis job
 */
async function startAnalysisHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.body;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const result = await analyserService.startAsyncAnalysis(address);
    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('[Route] Failed to start analysis:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to start analysis', error.message);
  }
}

/**
 * GET /analysis/:address/status
 * Get analysis job status with summary (tokens aggregated)
 */
async function getAnalysisStatusHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const result = await analyserService.getAsyncAnalysisStatus(address);
    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('[Route] Failed to get analysis status:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get analysis status', error.message);
  }
}

/**
 * GET /analysis/:address/results?page=1&limit=50
 * Get paginated tokens from completed/ongoing analysis
 */
async function getAnalysisResultsHandler(req: any, res: any, runtime: IAgentRuntime): Promise<void> {
  const { address } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
  const analyserService = runtime.getService<SendoAnalyserService>('sendo_analyser');

  if (!analyserService) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'SendoAnalyserService not found');
  }

  if (!address) {
    return sendError(res, 400, 'INVALID_REQUEST', 'address is required');
  }

  try {
    const result = await analyserService.getAsyncAnalysisTokens(address, page, limit);
    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('[Route] Failed to get analysis results:', error);
    sendError(res, 500, 'ANALYSIS_ERROR', 'Failed to get analysis results', error.message);
  }
}

// ============================================
// ROUTE DEFINITIONS
// ============================================

export const sendoAnalyserRoutes: Route[] = [
  {
    type: 'POST',
    path: '/analysis/start',
    handler: startAnalysisHandler,
  },
  {
    type: 'GET',
    path: '/analysis/:address/status',
    handler: getAnalysisStatusHandler,
  },
  {
    type: 'GET',
    path: '/analysis/:address/results',
    handler: getAnalysisResultsHandler,
  },
];