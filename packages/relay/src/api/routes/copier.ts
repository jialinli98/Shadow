/**
 * Copier API Routes
 * Endpoints for copiers to subscribe to leaders and manage their subscriptions
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

export function setupCopierRoutes(router: Router, services: Services): void {
  const { yellowService, replicationService, riskManager } = services;

  /**
   * POST /api/v1/copiers/subscribe
   * Subscribe a copier to a leader
   */
  router.post('/copiers/subscribe', async (req: Request, res: Response) => {
    try {
      const {
        copierAddress,
        leaderAddress,
        depositAmount,
        maxDrawdown = 10,
      } = req.body;

      if (!copierAddress || !leaderAddress || !depositAmount) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'copierAddress, leaderAddress, and depositAmount are required',
        });
      }

      console.log('📝 Subscribing copier:', {
        copier: copierAddress,
        leader: leaderAddress,
        deposit: depositAmount,
        maxDrawdown,
      });

      // Verify leader exists
      const leaderSession = replicationService.getLeaderSessions().get(leaderAddress);
      if (!leaderSession) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Leader not found',
        });
      }

      // Create Yellow Network session for copier
      const yellowSession = await yellowService.createSession(
        leaderAddress,
        copierAddress,
        [BigInt(depositAmount), BigInt(depositAmount)]
      );

      // Register copier session
      const copierSession = replicationService.registerCopierSession({
        sessionId: `copier-${Date.now()}`,
        copierAddress,
        leaderAddress,
        depositAmount: BigInt(depositAmount),
        maxDrawdown,
        currentDrawdown: 0,
        yellowChannelId: yellowSession.channelId,
        isActive: true,
        startValue: BigInt(depositAmount),
        currentValue: BigInt(depositAmount),
        startedAt: Date.now(),
      });

      res.status(201).json({
        success: true,
        session: {
          sessionId: copierSession.sessionId,
          copierAddress: copierSession.copierAddress,
          leaderAddress: copierSession.leaderAddress,
          depositAmount: copierSession.depositAmount.toString(),
          maxDrawdown: copierSession.maxDrawdown,
          yellowChannelId: copierSession.yellowChannelId,
          startedAt: copierSession.startedAt,
        },
        yellowSession: {
          sessionId: yellowSession.sessionId,
          channelId: yellowSession.channelId,
          participants: yellowSession.participants,
        },
      });
    } catch (error) {
      console.error('❌ Error subscribing copier:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/copiers/unsubscribe
   * Unsubscribe a copier from a leader
   */
  router.post('/copiers/unsubscribe', async (req: Request, res: Response) => {
    try {
      const { copierAddress, leaderAddress } = req.body;

      if (!copierAddress || !leaderAddress) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'copierAddress and leaderAddress are required',
        });
      }

      console.log('🚫 Unsubscribing copier:', {
        copier: copierAddress,
        leader: leaderAddress,
      });

      // Find the copier session
      const copiers = replicationService.getCopiersByLeader(leaderAddress);
      const copierSession = copiers.find(c => c.copierAddress === copierAddress);

      if (!copierSession) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Copier subscription not found',
        });
      }

      await replicationService.unsubscribeCopier(copierSession, 'manual');

      res.json({
        success: true,
        message: 'Copier unsubscribed successfully',
      });
    } catch (error) {
      console.error('❌ Error unsubscribing copier:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/copiers/:address
   * Get copier subscriptions and performance
   */
  router.get('/copiers/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      console.log('🔍 Fetching copier info:', address);

      // Get all copier sessions for this address
      const allCopiers = Array.from(replicationService.getCopierSessions().values()).flat();
      const copierSessions = allCopiers.filter(
        c => c.copierAddress === address && c.isActive
      );

      if (copierSessions.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No active subscriptions found for this copier',
        });
      }

      // Get risk metrics for each session
      const subscriptions = copierSessions.map(session => {
        const metrics = riskManager.getRiskMetrics(session);
        const leaderSession = replicationService.getLeaderSessions().get(session.leaderAddress);

        return {
          sessionId: session.sessionId,
          leaderAddress: session.leaderAddress,
          leaderEnsName: leaderSession?.ensName,
          depositAmount: session.depositAmount.toString(),
          currentValue: session.currentValue.toString(),
          startValue: session.startValue.toString(),
          maxDrawdown: session.maxDrawdown,
          currentDrawdown: metrics.currentDrawdown,
          openPositions: metrics.openPositions,
          dailyLoss: metrics.dailyLoss.toString(),
          totalPnL: metrics.totalPnL.toString(),
          peakValue: metrics.peakValue.toString(),
          startedAt: session.startedAt,
        };
      });

      res.json({
        success: true,
        copierAddress: address,
        subscriptions,
      });
    } catch (error) {
      console.error('❌ Error fetching copier:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/copiers/:address/risk
   * Get copier risk metrics
   */
  router.get('/copiers/:address/risk', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      console.log('📊 Fetching copier risk metrics:', address);

      // Get all copier sessions for this address
      const allCopiers = Array.from(replicationService.getCopierSessions().values()).flat();
      const copierSessions = allCopiers.filter(
        c => c.copierAddress === address && c.isActive
      );

      if (copierSessions.length === 0) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'No active subscriptions found',
        });
      }

      const riskMetrics = copierSessions.map(session => ({
        sessionId: session.sessionId,
        leaderAddress: session.leaderAddress,
        metrics: riskManager.getRiskMetrics(session),
        positions: riskManager.getOpenPositions(session.sessionId).map(p => ({
          asset: p.asset,
          amount: p.amount.toString(),
          entryPrice: p.entryPrice.toString(),
          currentPrice: p.currentPrice.toString(),
          unrealizedPnL: p.unrealizedPnL.toString(),
        })),
      }));

      res.json({
        success: true,
        copierAddress: address,
        risk: riskMetrics,
      });
    } catch (error) {
      console.error('❌ Error fetching risk metrics:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
