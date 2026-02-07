/**
 * Metrics API Routes
 * Endpoints for system statistics and performance metrics
 */

import { Router, Request, Response } from 'express';
import { YellowService } from '../../services/YellowService';
import { ENSService } from '../../services/ENSService';
import { RiskManager } from '../../services/RiskManager';
import { ReplicationService } from '../../services/ReplicationService';

interface Services {
  yellowService: YellowService;
  ensService: ENSService;
  riskManager: RiskManager;
  replicationService: ReplicationService;
}

export function setupMetricsRoutes(router: Router, services: Services): void {
  const { replicationService, riskManager } = services;

  /**
   * GET /api/v1/metrics/overview
   * Get platform-wide metrics
   */
  router.get('/metrics/overview', async (req: Request, res: Response) => {
    try {
      console.log('📊 Fetching platform metrics');

      // Get all leaders and copiers
      const leaders = Array.from(replicationService.getLeaderSessions().values());
      const allCopiers = Array.from(replicationService.getCopierSessions().values()).flat();
      const activeCopiers = allCopiers.filter(c => c.isActive);

      // Calculate aggregate metrics
      const totalVolumeReplicated = leaders.reduce(
        (sum, l) => sum + l.totalVolumeReplicated,
        BigInt(0)
      );

      const totalFeesEarned = leaders.reduce(
        (sum, l) => sum + l.totalFeesEarned,
        BigInt(0)
      );

      const totalValueLocked = activeCopiers.reduce(
        (sum, c) => sum + c.currentValue,
        BigInt(0)
      );

      res.json({
        success: true,
        metrics: {
          totalLeaders: leaders.filter(l => l.isActive).length,
          totalCopiers: activeCopiers.length,
          totalSessions: activeCopiers.length,
          totalVolumeReplicated: totalVolumeReplicated.toString(),
          totalFeesEarned: totalFeesEarned.toString(),
          totalValueLocked: totalValueLocked.toString(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('❌ Error fetching metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/metrics/leaderboard
   * Get top leaders by performance
   */
  router.get('/metrics/leaderboard', async (req: Request, res: Response) => {
    try {
      const { sortBy = 'copiers', limit = 10 } = req.query;

      console.log('🏆 Fetching leaderboard:', { sortBy, limit });

      const leaders = Array.from(replicationService.getLeaderSessions().values())
        .filter(l => l.isActive);

      // Sort leaders
      const sorted = leaders.sort((a, b) => {
        switch (sortBy) {
          case 'copiers':
            return b.totalCopiers - a.totalCopiers;
          case 'volume':
            return Number(b.totalVolumeReplicated - a.totalVolumeReplicated);
          case 'fees':
            return Number(b.totalFeesEarned - a.totalFeesEarned);
          default:
            return b.totalCopiers - a.totalCopiers;
        }
      });

      const limitNum = parseInt(limit as string, 10);
      const topLeaders = sorted.slice(0, limitNum);

      // Get active copier counts
      const leaderboard = topLeaders.map((leader, index) => {
        const copiers = replicationService.getCopiersByLeader(leader.leaderAddress);
        const activeCopiers = copiers.filter((c: any) => c.isActive);

        return {
          rank: index + 1,
          leaderAddress: leader.leaderAddress,
          ensName: leader.ensName,
          totalCopiers: leader.totalCopiers,
          activeCopiers: activeCopiers.length,
          totalVolumeReplicated: leader.totalVolumeReplicated.toString(),
          totalFeesEarned: leader.totalFeesEarned.toString(),
          registeredAt: leader.registeredAt,
        };
      });

      res.json({
        success: true,
        sortBy,
        leaderboard,
      });
    } catch (error) {
      console.error('❌ Error fetching leaderboard:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/metrics/session/:sessionId
   * Get detailed session metrics
   */
  router.get('/metrics/session/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      console.log('📊 Fetching session metrics:', sessionId);

      // Find session (could be leader or copier)
      let session: any;
      let sessionType: 'leader' | 'copier' | undefined;

      // Check leader sessions
      for (const leader of replicationService.getLeaderSessions().values()) {
        if (leader.sessionId === sessionId) {
          session = leader;
          sessionType = 'leader';
          break;
        }
      }

      // Check copier sessions
      if (!session) {
        for (const copiers of replicationService.getCopierSessions().values()) {
          const copier = copiers.find(c => c.sessionId === sessionId);
          if (copier) {
            session = copier;
            sessionType = 'copier';
            break;
          }
        }
      }

      if (!session) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Session not found',
        });
      }

      // Get metrics based on session type
      let metrics;
      if (sessionType === 'copier') {
        const riskMetrics = riskManager.getRiskMetrics(session as any);
        const positions = riskManager.getOpenPositions(sessionId);

        metrics = {
          sessionId: session.sessionId,
          type: 'copier',
          copierAddress: (session as any).copierAddress,
          leaderAddress: (session as any).leaderAddress,
          depositAmount: (session as any).depositAmount.toString(),
          currentValue: (session as any).currentValue.toString(),
          maxDrawdown: (session as any).maxDrawdown,
          currentDrawdown: riskMetrics.currentDrawdown,
          openPositions: riskMetrics.openPositions,
          dailyLoss: riskMetrics.dailyLoss.toString(),
          totalPnL: riskMetrics.totalPnL.toString(),
          peakValue: riskMetrics.peakValue.toString(),
          positions: positions.map(p => ({
            asset: p.asset,
            amount: p.amount.toString(),
            entryPrice: p.entryPrice.toString(),
            currentPrice: p.currentPrice.toString(),
            unrealizedPnL: p.unrealizedPnL.toString(),
          })),
          startedAt: (session as any).startedAt,
        };
      } else {
        const stats = replicationService.getStats((session as any).leaderAddress);

        metrics = {
          sessionId: session.sessionId,
          type: 'leader',
          leaderAddress: (session as any).leaderAddress,
          ensName: (session as any).ensName,
          stats,
          registeredAt: (session as any).registeredAt,
        };
      }

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      console.error('❌ Error fetching session metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/metrics/performance/:address
   * Get performance metrics for a leader or copier
   */
  router.get('/metrics/performance/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const { period = '7d' } = req.query;

      console.log('📈 Fetching performance metrics:', { address, period });

      // Note: This would typically aggregate historical data from a database
      // For now, we'll return current snapshot
      res.json({
        success: true,
        address,
        period,
        performance: {
          // Placeholder for time-series data
          timestamps: [],
          values: [],
          pnl: [],
          drawdown: [],
        },
        summary: {
          totalTrades: 0,
          winRate: 0,
          averagePnL: '0',
          maxDrawdown: 0,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching performance:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
