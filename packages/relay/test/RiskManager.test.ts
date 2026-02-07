/**
 * Comprehensive tests for RiskManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RiskManager } from '../src/services/RiskManager';
import {
  CopierSession,
  TradeIntent,
  TradeAction,
  ExecutedTrade,
  RiskLimits,
} from '../src/types';

describe('RiskManager', () => {
  let riskManager: RiskManager;
  let mockCopierSession: CopierSession;
  let mockRiskLimits: RiskLimits;

  beforeEach(() => {
    riskManager = new RiskManager();

    mockCopierSession = {
      sessionId: 'session-123',
      copierAddress: '0xCopier',
      leaderAddress: '0xLeader',
      depositAmount: BigInt(10000) * BigInt(10 ** 18), // 10,000 USDC
      maxDrawdown: 10, // 10%
      currentDrawdown: 0,
      yellowChannelId: 'yellow-channel-123',
      isActive: true,
      startValue: BigInt(10000) * BigInt(10 ** 18),
      currentValue: BigInt(10000) * BigInt(10 ** 18),
      startedAt: Date.now(),
    };

    mockRiskLimits = {
      maxDrawdown: 10,
      maxPositionSize: BigInt(2000) * BigInt(10 ** 18), // 2,000 USDC
      maxDailyLoss: BigInt(500) * BigInt(10 ** 18), // 500 USDC
      maxOpenPositions: 5,
    };
  });

  describe('checkRiskLimits', () => {
    it('should pass risk check for valid trade', async () => {
      const trade: TradeIntent = {
        tradeId: 'trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(5) * BigInt(10 ** 17), // 0.5 ETH
        price: BigInt(3000) * BigInt(10 ** 18), // $3,000 → $1,500 total cost
        timestamp: Date.now(),
        yellowChannelId: 'channel-1',
        signature: '0xsig',
      };

      const result = await riskManager.checkRiskLimits(
        mockCopierSession,
        trade,
        mockRiskLimits
      );

      expect(result.passed).toBe(true);
      expect(result.currentDrawdown).toBe(0);
      expect(result.projectedDrawdown).toBeDefined();
    });

    it('should reject trade exceeding max position size', async () => {
      const trade: TradeIntent = {
        tradeId: 'trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18), // 10 ETH (worth $30,000)
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'channel-1',
        signature: '0xsig',
      };

      const result = await riskManager.checkRiskLimits(
        mockCopierSession,
        trade,
        mockRiskLimits
      );

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('max position size');
    });

    it('should reject trade when max open positions reached', async () => {
      // Create 5 open positions
      for (let i = 0; i < 5; i++) {
        const executedTrade: ExecutedTrade = {
          tradeId: `trade-${i}`,
          originalTradeId: `original-${i}`,
          executorAddress: '0xCopier',
          action: TradeAction.BUY,
          asset: `ASSET${i}`,
          tokenAddress: `0xToken${i}`,
          amount: BigInt(100) * BigInt(10 ** 18),
          price: BigInt(10) * BigInt(10 ** 18),
          executedAt: Date.now(),
          yellowStateNonce: i,
        };
        riskManager.recordTrade(
          mockCopierSession.sessionId,
          executedTrade,
          BigInt(10) * BigInt(10 ** 18)
        );
      }

      const trade: TradeIntent = {
        tradeId: 'trade-6',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ASSET6',
        tokenAddress: '0xToken6',
        amount: BigInt(100) * BigInt(10 ** 18),
        price: BigInt(10) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'channel-1',
        signature: '0xsig',
      };

      const result = await riskManager.checkRiskLimits(
        mockCopierSession,
        trade,
        mockRiskLimits
      );

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Max open positions');
    });

    it('should reject trade exceeding projected drawdown', async () => {
      // Simulate portfolio already down 8%
      mockCopierSession.currentValue = BigInt(9200) * BigInt(10 ** 18);

      // Use smaller trade that passes position size but would worsen drawdown
      const trade: TradeIntent = {
        tradeId: 'trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.SELL,  // Selling at a loss
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(5) * BigInt(10 ** 17), // 0.5 ETH
        price: BigInt(1500) * BigInt(10 ** 18), // Sell at $1,500 ($750 cost, under $2,000 limit)
        timestamp: Date.now(),
        yellowChannelId: 'channel-1',
        signature: '0xsig',
      };

      // First create a position at higher price
      const buyTrade: ExecutedTrade = {
        tradeId: 'setup-trade',
        originalTradeId: 'setup',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(5) * BigInt(10 ** 17), // 0.5 ETH
        price: BigInt(3000) * BigInt(10 ** 18), // Bought at $3,000 ($1,500 cost)
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buyTrade,
        BigInt(3000) * BigInt(10 ** 18)
      );

      const result = await riskManager.checkRiskLimits(
        mockCopierSession,
        trade,
        mockRiskLimits
      );

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('drawdown');
    });
  });

  describe('calculatePnL', () => {
    it('should calculate zero P&L at start', () => {
      const pnl = riskManager.calculatePnL(mockCopierSession);
      expect(pnl).toBe(BigInt(0));
    });

    it('should calculate positive P&L', () => {
      mockCopierSession.currentValue = BigInt(12000) * BigInt(10 ** 18);
      const pnl = riskManager.calculatePnL(mockCopierSession);
      expect(pnl).toBe(BigInt(2000) * BigInt(10 ** 18));
    });

    it('should calculate negative P&L', () => {
      mockCopierSession.currentValue = BigInt(8000) * BigInt(10 ** 18);
      const pnl = riskManager.calculatePnL(mockCopierSession);
      expect(pnl).toBe(BigInt(-2000) * BigInt(10 ** 18));
    });
  });

  describe('calculateDrawdown', () => {
    it('should calculate zero drawdown at peak', () => {
      const drawdown = riskManager.calculateDrawdown(mockCopierSession);
      expect(drawdown).toBe(0);
    });

    it('should calculate 10% drawdown correctly', () => {
      mockCopierSession.currentValue = BigInt(9000) * BigInt(10 ** 18);
      const drawdown = riskManager.calculateDrawdown(mockCopierSession);
      expect(drawdown).toBeCloseTo(10, 1);
    });

    it('should calculate 25% drawdown correctly', () => {
      mockCopierSession.currentValue = BigInt(7500) * BigInt(10 ** 18);
      const drawdown = riskManager.calculateDrawdown(mockCopierSession);
      expect(drawdown).toBeCloseTo(25, 1);
    });

    it('should update peak value when portfolio increases', () => {
      // Increase value to new peak
      mockCopierSession.currentValue = BigInt(15000) * BigInt(10 ** 18);
      let drawdown = riskManager.calculateDrawdown(mockCopierSession);
      expect(drawdown).toBe(0);

      // Now drop from new peak
      mockCopierSession.currentValue = BigInt(13500) * BigInt(10 ** 18);
      drawdown = riskManager.calculateDrawdown(mockCopierSession);
      expect(drawdown).toBeCloseTo(10, 1); // 10% from 15,000
    });
  });

  describe('shouldUnsubscribe', () => {
    it('should not unsubscribe below max drawdown', () => {
      mockCopierSession.currentValue = BigInt(9100) * BigInt(10 ** 18); // 9% drawdown
      const should = riskManager.shouldUnsubscribe(mockCopierSession);
      expect(should).toBe(false);
    });

    it('should unsubscribe at max drawdown', () => {
      mockCopierSession.currentValue = BigInt(9000) * BigInt(10 ** 18); // 10% drawdown
      const should = riskManager.shouldUnsubscribe(mockCopierSession);
      expect(should).toBe(true);
    });

    it('should unsubscribe above max drawdown', () => {
      mockCopierSession.currentValue = BigInt(8000) * BigInt(10 ** 18); // 20% drawdown
      const should = riskManager.shouldUnsubscribe(mockCopierSession);
      expect(should).toBe(true);
    });

    it('should emit max-drawdown-breached event', () => {
      return new Promise<void>((resolve) => {
        mockCopierSession.currentValue = BigInt(9000) * BigInt(10 ** 18);

        riskManager.on('max-drawdown-breached', (data) => {
          expect(data.sessionId).toBe('session-123');
          expect(data.copierAddress).toBe('0xCopier');
          expect(data.currentDrawdown).toBeCloseTo(10, 1);
          expect(data.maxDrawdown).toBe(10);
          resolve();
        });

        riskManager.shouldUnsubscribe(mockCopierSession);
      });
    });
  });

  describe('recordTrade', () => {
    it('should record BUY trade and create position', () => {
      const trade: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };

      riskManager.recordTrade(
        mockCopierSession.sessionId,
        trade,
        BigInt(3100) * BigInt(10 ** 18) // Current price higher
      );

      const positions = riskManager.getOpenPositions(mockCopierSession.sessionId);
      expect(positions).toHaveLength(1);
      expect(positions[0].asset).toBe('ETH');
      expect(positions[0].amount).toBe(BigInt(1) * BigInt(10 ** 18));
      expect(positions[0].entryPrice).toBe(BigInt(3000) * BigInt(10 ** 18));
    });

    it('should record SELL trade and close position', () => {
      // First BUY
      const buyTrade: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buyTrade,
        BigInt(3000) * BigInt(10 ** 18)
      );

      // Then SELL
      const sellTrade: ExecutedTrade = {
        tradeId: 'trade-2',
        originalTradeId: 'original-2',
        executorAddress: '0xCopier',
        action: TradeAction.SELL,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3500) * BigInt(10 ** 18), // Profit
        executedAt: Date.now(),
        yellowStateNonce: 2,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        sellTrade,
        BigInt(3500) * BigInt(10 ** 18)
      );

      const positions = riskManager.getOpenPositions(mockCopierSession.sessionId);
      expect(positions).toHaveLength(0); // Position closed
    });

    it('should handle partial position close', () => {
      // BUY 2 ETH
      const buyTrade: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(2) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buyTrade,
        BigInt(3000) * BigInt(10 ** 18)
      );

      // SELL 1 ETH (partial)
      const sellTrade: ExecutedTrade = {
        tradeId: 'trade-2',
        originalTradeId: 'original-2',
        executorAddress: '0xCopier',
        action: TradeAction.SELL,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3200) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 2,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        sellTrade,
        BigInt(3200) * BigInt(10 ** 18)
      );

      const positions = riskManager.getOpenPositions(mockCopierSession.sessionId);
      expect(positions).toHaveLength(1);
      expect(positions[0].amount).toBe(BigInt(1) * BigInt(10 ** 18)); // 1 ETH remaining
    });

    it('should calculate average entry price on multiple buys', () => {
      // First BUY at $3000
      const buy1: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buy1,
        BigInt(3000) * BigInt(10 ** 18)
      );

      // Second BUY at $4000
      const buy2: ExecutedTrade = {
        tradeId: 'trade-2',
        originalTradeId: 'original-2',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(4000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 2,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buy2,
        BigInt(4000) * BigInt(10 ** 18)
      );

      const positions = riskManager.getOpenPositions(mockCopierSession.sessionId);
      expect(positions).toHaveLength(1);
      expect(positions[0].amount).toBe(BigInt(2) * BigInt(10 ** 18));
      // Average price should be $3,500
      expect(positions[0].entryPrice).toBe(BigInt(3500) * BigInt(10 ** 18));
    });
  });

  describe('getDailyLoss', () => {
    it('should return zero daily loss at start', () => {
      const loss = riskManager.getDailyLoss(mockCopierSession.sessionId);
      expect(loss).toBe(BigInt(0));
    });

    it('should track daily losses', () => {
      // Losing trade
      const buyTrade: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buyTrade,
        BigInt(3000) * BigInt(10 ** 18)
      );

      const sellTrade: ExecutedTrade = {
        tradeId: 'trade-2',
        originalTradeId: 'original-2',
        executorAddress: '0xCopier',
        action: TradeAction.SELL,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(2800) * BigInt(10 ** 18), // Loss of $200
        executedAt: Date.now(),
        yellowStateNonce: 2,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        sellTrade,
        BigInt(2800) * BigInt(10 ** 18)
      );

      const loss = riskManager.getDailyLoss(mockCopierSession.sessionId);
      expect(loss).toBeGreaterThan(BigInt(0));
    });
  });

  describe('updatePositionPrices', () => {
    it('should update position prices and unrealized P&L', () => {
      // Create position
      const buyTrade: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        buyTrade,
        BigInt(3000) * BigInt(10 ** 18)
      );

      // Update price to $3,500
      const prices = new Map([['ETH', BigInt(3500) * BigInt(10 ** 18)]]);
      riskManager.updatePositionPrices(mockCopierSession.sessionId, prices);

      const positions = riskManager.getOpenPositions(mockCopierSession.sessionId);
      expect(positions[0].currentPrice).toBe(BigInt(3500) * BigInt(10 ** 18));
      expect(positions[0].unrealizedPnL).toBeGreaterThan(BigInt(0));
    });
  });

  describe('getRiskMetrics', () => {
    it('should return complete risk metrics', () => {
      mockCopierSession.currentValue = BigInt(9000) * BigInt(10 ** 18);

      const metrics = riskManager.getRiskMetrics(mockCopierSession);

      expect(metrics.currentDrawdown).toBeCloseTo(10, 1);
      expect(metrics.openPositions).toBe(0);
      expect(metrics.dailyLoss).toBe(BigInt(0));
      expect(metrics.totalPnL).toBe(BigInt(-1000) * BigInt(10 ** 18));
      expect(metrics.peakValue).toBe(BigInt(10000) * BigInt(10 ** 18));
    });
  });

  describe('clearSession', () => {
    it('should clear all session data', () => {
      // Create some data
      const trade: ExecutedTrade = {
        tradeId: 'trade-1',
        originalTradeId: 'original-1',
        executorAddress: '0xCopier',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        executedAt: Date.now(),
        yellowStateNonce: 1,
      };
      riskManager.recordTrade(
        mockCopierSession.sessionId,
        trade,
        BigInt(3000) * BigInt(10 ** 18)
      );

      expect(riskManager.getOpenPositions(mockCopierSession.sessionId)).toHaveLength(1);

      // Clear session
      riskManager.clearSession(mockCopierSession.sessionId);

      expect(riskManager.getOpenPositions(mockCopierSession.sessionId)).toHaveLength(0);
      expect(riskManager.getDailyLoss(mockCopierSession.sessionId)).toBe(BigInt(0));
    });
  });
});
