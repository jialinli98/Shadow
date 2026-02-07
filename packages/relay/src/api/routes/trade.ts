/**
 * Trade API Routes
 * Endpoints for trade execution and replication
 */

import { Router, Request, Response } from 'express';
import { YellowService } from '../../services/YellowService';
import { ENSService } from '../../services/ENSService';
import { RiskManager } from '../../services/RiskManager';
import { ReplicationService } from '../../services/ReplicationService';
import { TradeIntent, TradeAction } from '../../types';

interface Services {
  yellowService: YellowService;
  ensService: ENSService;
  riskManager: RiskManager;
  replicationService: ReplicationService;
}

export function setupTradeRoutes(router: Router, services: Services): void {
  const { replicationService } = services;

  /**
   * POST /api/v1/trades/replicate
   * Replicate a leader's trade to all copiers
   */
  router.post('/trades/replicate', async (req: Request, res: Response) => {
    try {
      const {
        leaderAddress,
        action,
        asset,
        tokenAddress,
        amount,
        price,
        yellowChannelId,
        signature,
      } = req.body;

      // Validation
      if (!leaderAddress || !action || !asset || !tokenAddress || !amount || !price) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields',
        });
      }

      if (!['BUY', 'SELL'].includes(action)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'action must be BUY or SELL',
        });
      }

      console.log('🔄 Replicating trade:', {
        leader: leaderAddress,
        action,
        asset,
        amount,
      });

      // Create trade intent
      const trade: TradeIntent = {
        tradeId: `trade-${Date.now()}`,
        leaderAddress,
        action: action as TradeAction,
        asset,
        tokenAddress,
        amount: BigInt(amount),
        price: BigInt(price),
        timestamp: Date.now(),
        yellowChannelId: yellowChannelId || '',
        signature: signature || '0x',
      };

      // Replicate to all copiers
      const results = await replicationService.replicateTrade(
        leaderAddress,
        trade
      );

      // Aggregate results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        trade: {
          tradeId: trade.tradeId,
          leaderAddress: trade.leaderAddress,
          action: trade.action,
          asset: trade.asset,
          amount: trade.amount.toString(),
          price: trade.price.toString(),
          timestamp: trade.timestamp,
        },
        replication: {
          totalCopiers: results.length,
          successCount,
          failureCount,
          results: results.map(r => ({
            copierAddress: r.copierAddress,
            success: r.success,
            error: r.error,
            executedTrade: r.executedTrade ? {
              tradeId: r.executedTrade.tradeId,
              amount: r.executedTrade.amount.toString(),
              price: r.executedTrade.price.toString(),
            } : null,
          })),
        },
      });
    } catch (error) {
      console.error('❌ Error replicating trade:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/v1/trades/execute
   * Execute a direct trade (non-replicated)
   */
  router.post('/trades/execute', async (req: Request, res: Response) => {
    try {
      const {
        executorAddress,
        action,
        asset,
        tokenAddress,
        amount,
        price,
        yellowChannelId,
      } = req.body;

      if (!executorAddress || !action || !asset || !tokenAddress || !amount || !price || !yellowChannelId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields',
        });
      }

      console.log('💰 Executing trade:', {
        executor: executorAddress,
        action,
        asset,
        amount,
      });

      // Create trade intent
      const tradeIntent: TradeIntent = {
        tradeId: `trade-${Date.now()}`,
        leaderAddress: executorAddress,
        action: action as TradeAction,
        asset,
        tokenAddress,
        amount: BigInt(amount),
        price: BigInt(price),
        timestamp: Date.now(),
        yellowChannelId,
        signature: '0x',
      };

      // For direct execution, we need to calculate new balances
      // This is a simplified version - in production, get actual balances from Yellow
      const currentBalances: [bigint, bigint] = [BigInt(10000) * BigInt(10 ** 18), BigInt(10000) * BigInt(10 ** 18)];
      const tradeCost = (tradeIntent.amount * tradeIntent.price) / BigInt(10 ** 18);

      let newBalances: [bigint, bigint];
      if (action === 'BUY') {
        newBalances = [
          currentBalances[0] - tradeCost,
          currentBalances[1] + tradeIntent.amount
        ];
      } else {
        newBalances = [
          currentBalances[0] + tradeCost,
          currentBalances[1] - tradeIntent.amount
        ];
      }

      // Execute trade on Yellow Network
      const result = await services.yellowService.executeTrade(
        yellowChannelId,
        tradeIntent,
        newBalances
      );

      res.json({
        success: true,
        trade: {
          sessionId: yellowChannelId,
          nonce: result.nonce,
          balances: result.balances.map(b => b.toString()),
          timestamp: result.timestamp,
        },
      });
    } catch (error) {
      console.error('❌ Error executing trade:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/trades/history/:address
   * Get trade history for an address (leader or copier)
   */
  router.get('/trades/history/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      console.log('📜 Fetching trade history:', {
        address,
        limit,
        offset,
      });

      // Note: This would typically query a database
      // For now, we'll return empty array as placeholder
      res.json({
        success: true,
        address,
        trades: [],
        pagination: {
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
          total: 0,
        },
      });
    } catch (error) {
      console.error('❌ Error fetching trade history:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
