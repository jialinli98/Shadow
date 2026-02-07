/**
 * Comprehensive tests for ReplicationService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplicationService } from '../src/services/ReplicationService';
import { YellowService } from '../src/services/YellowService';
import { RiskManager } from '../src/services/RiskManager';
import {
  LeaderSession,
  CopierSession,
  TradeIntent,
  TradeAction,
  RiskLimits,
  YellowAppSession,
  YellowStateUpdate,
} from '../src/types';

// Mock YellowService
vi.mock('../src/services/YellowService');

describe('ReplicationService', () => {
  let replicationService: ReplicationService;
  let yellowService: YellowService;
  let riskManager: RiskManager;
  let mockLeaderSession: LeaderSession;
  let mockCopierSession1: CopierSession;
  let mockCopierSession2: CopierSession;
  let defaultRiskLimits: RiskLimits;

  beforeEach(() => {
    // Create mock services
    yellowService = new YellowService({
      wsUrl: 'ws://test',
      chainId: 1,
      adjudicatorAddress: '0xAdj',
      provider: {} as any,
      signerPrivateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    });

    riskManager = new RiskManager();

    defaultRiskLimits = {
      maxDrawdown: 20,
      maxPositionSize: BigInt(5000) * BigInt(10 ** 18),
      maxDailyLoss: BigInt(1000) * BigInt(10 ** 18),
      maxOpenPositions: 10,
    };

    replicationService = new ReplicationService({
      yellowService,
      riskManager,
      defaultRiskLimits,
    });

    // Mock leader session
    mockLeaderSession = {
      sessionId: 'leader-session-1',
      leaderAddress: '0xLeader',
      ensName: 'alice.shadow.eth',
      depositAmount: BigInt(100000) * BigInt(10 ** 18), // 100,000 USDC
      copiers: [],
      yellowChannelId: 'yellow-leader-channel',
      isActive: true,
      startedAt: Date.now(),
      performance: {
        totalTrades: 0,
        profitLoss: BigInt(0),
        winRate: 0,
        sharpeRatio: 0,
      },
    };

    // Mock copier sessions
    mockCopierSession1 = {
      sessionId: 'copier-session-1',
      copierAddress: '0xCopier1',
      leaderAddress: '0xLeader',
      depositAmount: BigInt(10000) * BigInt(10 ** 18), // 10,000 USDC (1:10 ratio)
      maxDrawdown: 10,
      currentDrawdown: 0,
      yellowChannelId: 'yellow-copier1-channel',
      isActive: true,
      startValue: BigInt(10000) * BigInt(10 ** 18),
      currentValue: BigInt(10000) * BigInt(10 ** 18),
      startedAt: Date.now(),
    };

    mockCopierSession2 = {
      sessionId: 'copier-session-2',
      copierAddress: '0xCopier2',
      leaderAddress: '0xLeader',
      depositAmount: BigInt(5000) * BigInt(10 ** 18), // 5,000 USDC (1:20 ratio)
      maxDrawdown: 15,
      currentDrawdown: 0,
      yellowChannelId: 'yellow-copier2-channel',
      isActive: true,
      startValue: BigInt(5000) * BigInt(10 ** 18),
      currentValue: BigInt(5000) * BigInt(10 ** 18),
      startedAt: Date.now(),
    };

    // Mock Yellow service methods
    vi.spyOn(yellowService, 'getSession').mockImplementation((sessionId) => {
      const mockYellowSession: YellowAppSession = {
        sessionId,
        channelId: sessionId,
        participants: ['0xLeader', '0xCopier1'],
        nonce: 0,
        balances: [BigInt(100000) * BigInt(10 ** 18), BigInt(10000) * BigInt(10 ** 18)],
        isActive: true,
        createdAt: Date.now(),
      };
      return mockYellowSession;
    });

    vi.spyOn(yellowService, 'executeTrade').mockResolvedValue({
      sessionId: 'test',
      nonce: 1,
      stateHash: '0xhash',
      balances: [BigInt(0), BigInt(0)],
      signatures: ['0xsig'],
      timestamp: Date.now(),
    } as YellowStateUpdate);
  });

  describe('registerLeaderSession', () => {
    it('should register leader session', () => {
      replicationService.registerLeaderSession(mockLeaderSession);

      const leader = replicationService.getLeaderSession('0xLeader');
      expect(leader).toBeDefined();
      expect(leader?.ensName).toBe('alice.shadow.eth');
    });

    it('should emit leader-registered event', () => {
      return new Promise<void>((resolve) => {
        replicationService.on('leader-registered', (session) => {
          expect(session.leaderAddress).toBe('0xLeader');
          resolve();
        });

        replicationService.registerLeaderSession(mockLeaderSession);
      });
    });
  });

  describe('registerCopierSession', () => {
    beforeEach(() => {
      replicationService.registerLeaderSession(mockLeaderSession);
    });

    it('should register copier session', () => {
      replicationService.registerCopierSession(mockCopierSession1);

      const copiers = replicationService.getCopiers('0xLeader');
      expect(copiers).toHaveLength(1);
      expect(copiers[0].copierAddress).toBe('0xCopier1');
    });

    it('should add copier to leader copiers array', () => {
      replicationService.registerCopierSession(mockCopierSession1);

      const leader = replicationService.getLeaderSession('0xLeader');
      expect(leader?.copiers).toHaveLength(1);
    });

    it('should emit copier-registered event', () => {
      return new Promise<void>((resolve) => {
        replicationService.on('copier-registered', (session) => {
          expect(session.copierAddress).toBe('0xCopier1');
          resolve();
        });

        replicationService.registerCopierSession(mockCopierSession1);
      });
    });
  });

  describe('calculateProportionalSize', () => {
    it('should calculate 1:10 ratio correctly', () => {
      const leaderDeposit = BigInt(100000) * BigInt(10 ** 18);
      const copierDeposit = BigInt(10000) * BigInt(10 ** 18);
      const leaderTradeAmount = BigInt(5) * BigInt(10 ** 18); // 5 ETH

      const copierAmount = replicationService.calculateProportionalSize(
        leaderDeposit,
        copierDeposit,
        leaderTradeAmount
      );

      expect(copierAmount).toBe(BigInt(5) * BigInt(10 ** 17)); // 0.5 ETH
    });

    it('should calculate 1:20 ratio correctly', () => {
      const leaderDeposit = BigInt(100000) * BigInt(10 ** 18);
      const copierDeposit = BigInt(5000) * BigInt(10 ** 18);
      const leaderTradeAmount = BigInt(10) * BigInt(10 ** 18); // 10 ETH

      const copierAmount = replicationService.calculateProportionalSize(
        leaderDeposit,
        copierDeposit,
        leaderTradeAmount
      );

      expect(copierAmount).toBe(BigInt(5) * BigInt(10 ** 17)); // 0.5 ETH
    });

    it('should calculate 1:1 ratio correctly', () => {
      const leaderDeposit = BigInt(10000) * BigInt(10 ** 18);
      const copierDeposit = BigInt(10000) * BigInt(10 ** 18);
      const leaderTradeAmount = BigInt(2) * BigInt(10 ** 18); // 2 ETH

      const copierAmount = replicationService.calculateProportionalSize(
        leaderDeposit,
        copierDeposit,
        leaderTradeAmount
      );

      expect(copierAmount).toBe(BigInt(2) * BigInt(10 ** 18)); // 2 ETH
    });

    it('should handle 2:1 ratio (copier has more)', () => {
      const leaderDeposit = BigInt(5000) * BigInt(10 ** 18);
      const copierDeposit = BigInt(10000) * BigInt(10 ** 18);
      const leaderTradeAmount = BigInt(1) * BigInt(10 ** 18); // 1 ETH

      const copierAmount = replicationService.calculateProportionalSize(
        leaderDeposit,
        copierDeposit,
        leaderTradeAmount
      );

      expect(copierAmount).toBe(BigInt(2) * BigInt(10 ** 18)); // 2 ETH
    });
  });

  describe('replicateTrade', () => {
    beforeEach(() => {
      replicationService.registerLeaderSession(mockLeaderSession);
      replicationService.registerCopierSession(mockCopierSession1);
      replicationService.registerCopierSession(mockCopierSession2);
    });

    it('should replicate trade to all copiers', async () => {
      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18), // 10 ETH
        price: BigInt(3000) * BigInt(10 ** 18), // $3,000
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      const results = await replicationService.replicateTrade(
        '0xLeader',
        leaderTrade
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should calculate proportional amounts correctly for each copier', async () => {
      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18), // 10 ETH
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      const results = await replicationService.replicateTrade(
        '0xLeader',
        leaderTrade
      );

      // Copier1: 10,000 / 100,000 * 10 = 1 ETH
      expect(results[0].executedTrade?.amount).toBe(BigInt(1) * BigInt(10 ** 18));

      // Copier2: 5,000 / 100,000 * 10 = 0.5 ETH
      expect(results[1].executedTrade?.amount).toBe(BigInt(5) * BigInt(10 ** 17));
    });

    it('should emit replication-complete event', () => {
      return new Promise<void>((resolve) => {
        const leaderTrade: TradeIntent = {
          tradeId: 'leader-trade-1',
          leaderAddress: '0xLeader',
          action: TradeAction.BUY,
          asset: 'ETH',
          tokenAddress: '0xETH',
          amount: BigInt(10) * BigInt(10 ** 18),
          price: BigInt(3000) * BigInt(10 ** 18),
          timestamp: Date.now(),
          yellowChannelId: 'yellow-leader-channel',
          signature: '0xsig',
        };

        replicationService.on('replication-complete', (data) => {
          expect(data.leaderAddress).toBe('0xLeader');
          expect(data.successCount).toBe(2);
          expect(data.failureCount).toBe(0);
          resolve();
        });

        replicationService.replicateTrade('0xLeader', leaderTrade);
      });
    });

    it('should emit trade-replicated event for each successful replication', () => {
      return new Promise<void>((resolve) => {
        const leaderTrade: TradeIntent = {
          tradeId: 'leader-trade-1',
          leaderAddress: '0xLeader',
          action: TradeAction.BUY,
          asset: 'ETH',
          tokenAddress: '0xETH',
          amount: BigInt(10) * BigInt(10 ** 18),
          price: BigInt(3000) * BigInt(10 ** 18),
          timestamp: Date.now(),
          yellowChannelId: 'yellow-leader-channel',
          signature: '0xsig',
        };

        let eventCount = 0;
        replicationService.on('trade-replicated', (data) => {
          eventCount++;
          expect(data.trade).toBeDefined();
          if (eventCount === 2) {
            resolve();
          }
        });

        replicationService.replicateTrade('0xLeader', leaderTrade);
      });
    });

    it('should call YellowService.executeTrade for each copier', async () => {
      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      await replicationService.replicateTrade('0xLeader', leaderTrade);

      expect(yellowService.executeTrade).toHaveBeenCalledTimes(2);
    });
  });

  describe('risk management integration', () => {
    beforeEach(() => {
      replicationService.registerLeaderSession(mockLeaderSession);
      replicationService.registerCopierSession(mockCopierSession1);
    });

    it('should reject trade that fails risk check', async () => {
      // Make copier session close to max drawdown
      mockCopierSession1.currentValue = BigInt(9100) * BigInt(10 ** 18);
      mockCopierSession1.currentDrawdown = 9;

      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(100) * BigInt(10 ** 18), // Huge trade
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      const results = await replicationService.replicateTrade(
        '0xLeader',
        leaderTrade
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    it('should update copier drawdown after trade', async () => {
      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      await replicationService.replicateTrade('0xLeader', leaderTrade);

      // Drawdown should be calculated
      expect(mockCopierSession1.currentDrawdown).toBeGreaterThanOrEqual(0);
    });
  });

  describe('unsubscribeCopier', () => {
    beforeEach(() => {
      replicationService.registerLeaderSession(mockLeaderSession);
      replicationService.registerCopierSession(mockCopierSession1);
    });

    it('should unsubscribe copier on manual request', async () => {
      await replicationService.unsubscribeCopier(mockCopierSession1, 'manual');

      expect(mockCopierSession1.isActive).toBe(false);
      const copiers = replicationService.getCopiers('0xLeader');
      expect(copiers).toHaveLength(0);
    });

    it('should unsubscribe copier on max drawdown breach', async () => {
      await replicationService.unsubscribeCopier(
        mockCopierSession1,
        'max-drawdown-breached'
      );

      expect(mockCopierSession1.isActive).toBe(false);
    });

    it('should emit copier-unsubscribed event', () => {
      return new Promise<void>((resolve) => {
        replicationService.on('copier-unsubscribed', (data) => {
          expect(data.copier).toBe('0xCopier1');
          expect(data.leader).toBe('0xLeader');
          expect(data.reason).toBe('manual');
          resolve();
        });

        replicationService.unsubscribeCopier(mockCopierSession1, 'manual');
      });
    });

    it('should clear risk tracking', async () => {
      // Create some position
      const trade: TradeIntent = {
        tradeId: 'trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(1) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      await replicationService.replicateTrade('0xLeader', trade);

      // Should have positions
      expect(riskManager.getOpenPositions(mockCopierSession1.sessionId).length).toBeGreaterThan(0);

      await replicationService.unsubscribeCopier(mockCopierSession1, 'manual');

      // Positions should be cleared
      expect(riskManager.getOpenPositions(mockCopierSession1.sessionId)).toHaveLength(0);
    });
  });

  describe('getActiveCopierCount', () => {
    beforeEach(() => {
      replicationService.registerLeaderSession(mockLeaderSession);
    });

    it('should return 0 when no copiers', () => {
      const count = replicationService.getActiveCopierCount('0xLeader');
      expect(count).toBe(0);
    });

    it('should count active copiers', () => {
      replicationService.registerCopierSession(mockCopierSession1);
      replicationService.registerCopierSession(mockCopierSession2);

      const count = replicationService.getActiveCopierCount('0xLeader');
      expect(count).toBe(2);
    });

    it('should not count inactive copiers', async () => {
      replicationService.registerCopierSession(mockCopierSession1);
      replicationService.registerCopierSession(mockCopierSession2);

      await replicationService.unsubscribeCopier(mockCopierSession1, 'manual');

      const count = replicationService.getActiveCopierCount('0xLeader');
      expect(count).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      replicationService.registerLeaderSession(mockLeaderSession);
      replicationService.registerCopierSession(mockCopierSession1);
      replicationService.registerCopierSession(mockCopierSession2);

      const stats = replicationService.getStats();

      expect(stats.totalLeaders).toBe(1);
      expect(stats.totalCopiers).toBe(2);
      expect(stats.activeCopiers).toBe(2);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      replicationService.registerLeaderSession(mockLeaderSession);
      replicationService.registerCopierSession(mockCopierSession1);
    });

    it('should handle Yellow service errors gracefully', async () => {
      vi.spyOn(yellowService, 'executeTrade').mockRejectedValue(
        new Error('Yellow Network error')
      );

      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xLeader',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      const results = await replicationService.replicateTrade(
        '0xLeader',
        leaderTrade
      );

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Yellow Network error');
    });

    it('should throw error for non-existent leader', async () => {
      const leaderTrade: TradeIntent = {
        tradeId: 'leader-trade-1',
        leaderAddress: '0xNonExistent',
        action: TradeAction.BUY,
        asset: 'ETH',
        tokenAddress: '0xETH',
        amount: BigInt(10) * BigInt(10 ** 18),
        price: BigInt(3000) * BigInt(10 ** 18),
        timestamp: Date.now(),
        yellowChannelId: 'yellow-leader-channel',
        signature: '0xsig',
      };

      await expect(
        replicationService.replicateTrade('0xNonExistent', leaderTrade)
      ).rejects.toThrow('Leader session not found');
    });
  });
});
