/**
 * Leaderboard analysis module
 * Queries completed wallet analyses and ranks them by various metrics
 */

import { eq, desc, sql, and, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { walletAnalysisJobs } from '../../schemas/wallet-analysis.js';
import type {
  LeaderboardEntry,
  LeaderboardBadge,
  LeaderboardPeriod,
  ShameLeaderboardResponse,
  FameLeaderboardResponse,
} from '../../types/api.js';

/**
 * Get Hall of Shame leaderboard (top wallets by missed ATH gains)
 */
export async function getShameLeaderboard(
  db: NodePgDatabase<any>,
  limit: number = 20,
  period: LeaderboardPeriod = 'all',
): Promise<ShameLeaderboardResponse> {
  // Build WHERE conditions
  const conditions = [eq(walletAnalysisJobs.status, 'completed')];

  // Add time period filter if not 'all'
  if (period === 'month') {
    conditions.push(
      gte(walletAnalysisJobs.completedAt, sql`NOW() - INTERVAL '30 days'`),
    );
  } else if (period === 'week') {
    conditions.push(
      gte(walletAnalysisJobs.completedAt, sql`NOW() - INTERVAL '7 days'`),
    );
  }

  // Query top wallets by total_missed_usd (from JSONB field)
  const results = await db
    .select({
      walletAddress: walletAnalysisJobs.walletAddress,
      currentResults: walletAnalysisJobs.currentResults,
      completedAt: walletAnalysisJobs.completedAt,
    })
    .from(walletAnalysisJobs)
    .where(and(...conditions))
    .orderBy(
      desc(
        sql`(${walletAnalysisJobs.currentResults}->>'total_missed_usd')::numeric`,
      ),
    )
    .limit(limit);

  // Transform to leaderboard entries with badges and ranks
  const entries: LeaderboardEntry[] = results.map((row, index) => {
    const summary = row.currentResults as any;
    const totalMissedUsd = summary?.total_missed_usd || 0;

    // Calculate days since analysis
    const daysSince = row.completedAt
      ? Math.floor(
          (Date.now() - new Date(row.completedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return {
      wallet: row.walletAddress,
      total_missed_usd: totalMissedUsd,
      rank: getShameRankTitle(index, totalMissedUsd),
      badge: getShameBadge(totalMissedUsd),
      completed_at: row.completedAt || new Date(),
      days_since_analysis: daysSince,
    };
  });

  return {
    entries,
    total: entries.length,
    limit,
    period,
  };
}

/**
 * Get Hall of Fame leaderboard (top wallets who lose the least)
 */
export async function getFameLeaderboard(
  db: NodePgDatabase<any>,
  limit: number = 20,
  period: LeaderboardPeriod = 'all',
): Promise<FameLeaderboardResponse> {
  // Build WHERE conditions - only wallets with negative PnL (losses)
  const conditions = [
    eq(walletAnalysisJobs.status, 'completed'),
    sql`(${walletAnalysisJobs.currentResults}->>'total_pnl')::numeric < 0`,
  ];

  // Add time period filter if not 'all'
  if (period === 'month') {
    conditions.push(
      gte(walletAnalysisJobs.completedAt, sql`NOW() - INTERVAL '30 days'`),
    );
  } else if (period === 'week') {
    conditions.push(
      gte(walletAnalysisJobs.completedAt, sql`NOW() - INTERVAL '7 days'`),
    );
  }

  // Query top wallets by total_pnl descending (least negative = best performers)
  // Example: -100, -500, -1000 -> we want -100 first (closest to 0)
  const results = await db
    .select({
      walletAddress: walletAnalysisJobs.walletAddress,
      currentResults: walletAnalysisJobs.currentResults,
      completedAt: walletAnalysisJobs.completedAt,
    })
    .from(walletAnalysisJobs)
    .where(and(...conditions))
    .orderBy(
      desc(sql`(${walletAnalysisJobs.currentResults}->>'total_pnl')::numeric`),
    )
    .limit(limit);

  // Transform to leaderboard entries with badges and ranks
  const entries: LeaderboardEntry[] = results.map((row, index) => {
    const summary = row.currentResults as any;
    const totalPnl = summary?.total_pnl || 0;
    // Show the absolute value of losses
    const lossAmount = Math.abs(totalPnl);

    // Calculate days since analysis
    const daysSince = row.completedAt
      ? Math.floor(
          (Date.now() - new Date(row.completedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return {
      wallet: row.walletAddress,
      total_gains_usd: lossAmount,
      rank: getFameRankTitle(index, lossAmount),
      badge: getFameBadge(lossAmount),
      completed_at: row.completedAt || new Date(),
      days_since_analysis: daysSince,
    };
  });

  return {
    entries,
    total: entries.length,
    limit,
    period,
  };
}

/**
 * Get badge for Hall of Shame based on missed USD
 */
function getShameBadge(missedUsd: number): LeaderboardBadge | undefined {
  if (missedUsd >= 50000) return 'diamond';
  if (missedUsd >= 30000) return 'gold';
  if (missedUsd >= 15000) return 'silver';
  if (missedUsd >= 5000) return 'bronze';
  return undefined;
}

/**
 * Get badge for Hall of Fame based on loss amount (lower is better)
 */
function getFameBadge(lossAmount: number): LeaderboardBadge | undefined {
  // Lower losses = better badges
  if (lossAmount <= 1000) return 'diamond';  // Lost $1k or less
  if (lossAmount <= 5000) return 'gold';     // Lost $5k or less
  if (lossAmount <= 10000) return 'silver';  // Lost $10k or less
  if (lossAmount <= 20000) return 'bronze';  // Lost $20k or less
  return undefined;
}

/**
 * Get humorous rank title for Hall of Shame
 */
function getShameRankTitle(index: number, missedUsd: number): string {
  const titles = [
    '🐳 Elite of Pain',
    '💀 Certified Bagholder',
    '💎 Diamond Hands (Wrong Way)',
    '🎯 Master of Mistiming',
    '📉 Professional Holder',
    '🤡 Clown Prince',
    '🚀 Rocket to the Ground',
    '💸 Money Burner',
    '🎰 Casino Enthusiast',
    '🔥 Burn Master',
  ];

  return titles[index] || '😭 Pain Apprentice';
}

/**
 * Get humorous rank title for Hall of Fame
 */
function getFameRankTitle(index: number, gainsUsd: number): string {
  const titles = [
    '👑 Exit Legend',
    '🎯 Perfect Timer',
    '💰 Profit Master',
    '🚀 Moon Walker',
    '⚡ Lightning Seller',
    '🧠 Big Brain',
    '🎪 Circus Master',
    '💎 Diamond Hands (Right Way)',
    '🏆 Champion',
    '🌟 Star Player',
  ];

  return titles[index] || '✨ Rising Star';
}