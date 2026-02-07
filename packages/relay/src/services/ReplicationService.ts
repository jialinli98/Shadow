/**
 * ReplicationService - Core trade replication engine
 * Replicates leader trades to copiers using Yellow Network state channels
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import {
  LeaderSession,
  CopierSession,
  TradeIntent,
  ExecutedTrade,
  ReplicationResult,
  RiskLimits,
  TradeAction,
} from '../types';
import { YellowService } from './YellowService';
import { RiskManager } from './RiskManager';

/**
 * ReplicationService Configuration
 */
interface ReplicationServiceConfig {
  yellowService: YellowService;
  riskManager: RiskManager;
  defaultRiskLimits: RiskLimits;
}

/**
 * ReplicationService handles trade copying from leaders to copiers
 */
export class ReplicationService extends EventEmitter {
  private yellowService: YellowService;
  private riskManager: RiskManager;
  private defaultRiskLimits: RiskLimits;

  // Track active sessions
  private leaderSessions: Map<string, LeaderSession> = new Map(); // leaderAddress -> LeaderSession
  private copierSessions: Map<string, CopierSession[]> = new Map(); // leaderAddress -> CopierSession[]

  constructor(config: ReplicationServiceConfig) {
    super();
    this.yellowService = config.yellowService;
    this.riskManager = config.riskManager;
    this.defaultRiskLimits = config.defaultRiskLimits;

    // Listen for max drawdown breaches
    this.riskManager.on('max-drawdown-breached', (data) => {
      this.handleMaxDrawdownBreach(data.sessionId, data.copierAddress);
    });
  }

  /**
   * Register a leader session
   */
  registerLeaderSession(session: LeaderSession): LeaderSession {
    this.leaderSessions.set(session.leaderAddress, session);
    this.emit('leader-registered', session);
    return session;
  }

  /**
   * Register a copier session
   */
  registerCopierSession(copier: CopierSession): CopierSession {
    // Add to copier list for this leader
    const copiers = this.copierSessions.get(copier.leaderAddress) || [];
    copiers.push(copier);
    this.copierSessions.set(copier.leaderAddress, copiers);

    // Update leader stats
    const leader = this.leaderSessions.get(copier.leaderAddress);
    if (leader) {
      leader.copiers.push(copier.copierAddress);
      leader.totalCopiers++;
    }

    this.emit('copier-registered', copier);
    return copier;
  }

  /**
   * Main method: Replicate a leader's trade to all their copiers
   */
  async replicateTrade(leaderAddress: string, trade: TradeIntent): Promise<ReplicationResult[]> {
    const leaderSession = this.leaderSessions.get(leaderAddress);
    if (!leaderSession) throw new Error(`Leader session not found: ${leaderAddress}`);

    const copiers = this.copierSessions.get(leaderAddress) || [];

    // Replicate to all copiers in parallel
    const results = await Promise.all(
      copiers.map((copier) => this.replicateToSingleCopier(leaderSession, copier, trade))
    );

    this.emit('replication-complete', {
      leaderAddress,
      trade,
      results,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
    });

    return results;
  }

  /**
   * Replicate trade to a single copier
   */
  private async replicateToSingleCopier(
    leaderSession: LeaderSession,
    copier: CopierSession,
    leaderTrade: TradeIntent
  ): Promise<ReplicationResult> {
    try {
      // 1. Calculate proportional trade size
      const leaderBaseDeposit = BigInt(100000) * BigInt(10 ** 18); // Assume 100k USDC leader capital
      const proportionalAmount = this.calculateProportionalSize(
        leaderBaseDeposit,
        copier.depositAmount,
        leaderTrade.amount
      );

      // 2. Create copier's trade intent
      const copierTrade: TradeIntent = {
        ...leaderTrade,
        tradeId: `${leaderTrade.tradeId}-copier-${copier.copierAddress}`,
        amount: proportionalAmount,
      };

      // 3. Check risk limits
      const riskLimits: RiskLimits = {
        maxDrawdown: copier.maxDrawdown,
        maxPositionSize: this.defaultRiskLimits.maxPositionSize,
        maxDailyLoss: this.defaultRiskLimits.maxDailyLoss,
        maxOpenPositions: this.defaultRiskLimits.maxOpenPositions,
      };

      const riskCheck = await this.riskManager.checkRiskLimits(copier, copierTrade, riskLimits);

      if (!riskCheck.passed) {
        return {
          success: false,
          copierAddress: copier.copierAddress,
          error: riskCheck.reason,
          yellowChannelId: copier.yellowChannelId,
        };
      }

      // 4. Calculate new balances after trade
      const newBalances = this.calculateNewBalances(copier, copierTrade);

      // 5. Execute trade in copier's Yellow state channel
      const stateUpdate = await this.yellowService.executeTrade(copier.yellowChannelId, copierTrade, newBalances);

      // 6. Create executed trade record
      const executedTrade: ExecutedTrade = {
        tradeId: copierTrade.tradeId,
        originalTradeId: leaderTrade.tradeId,
        executorAddress: copier.copierAddress,
        action: copierTrade.action,
        asset: copierTrade.asset,
        tokenAddress: copierTrade.tokenAddress,
        amount: proportionalAmount,
        price: copierTrade.price,
        executedAt: Date.now(),
        yellowStateNonce: stateUpdate.nonce,
      };

      // 7. Update copier session value
      copier.currentValue = newBalances[1];

      // 8. Record trade for risk tracking
      this.riskManager.recordTrade(copier.sessionId, executedTrade, copierTrade.price);

      // 9. Update copier drawdown
      copier.currentDrawdown = this.riskManager.calculateDrawdown(copier);

      // 10. Check if copier should be auto-unsubscribed
      if (this.riskManager.shouldUnsubscribe(copier)) {
        await this.unsubscribeCopier(copier, 'max-drawdown-breached');
      }

      this.emit('trade-replicated', {
        copier: copier.copierAddress,
        trade: executedTrade,
        newDrawdown: copier.currentDrawdown,
      });

      return {
        success: true,
        copierAddress: copier.copierAddress,
        executedTrade,
        yellowChannelId: copier.yellowChannelId,
      };
    } catch (error) {
      return {
        success: false,
        copierAddress: copier.copierAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
        yellowChannelId: copier.yellowChannelId,
      };
    }
  }

  /**
   * Calculate proportional trade size based on deposit ratio
   */
  calculateProportionalSize(leaderDeposit: bigint, copierDeposit: bigint, leaderTradeAmount: bigint): bigint {
    // CopierAmount = leaderTradeAmount * (copierDeposit / leaderDeposit)
    return (leaderTradeAmount * copierDeposit) / leaderDeposit;
  }

  /**
   * Calculate new balances after trade execution
   */
  private calculateNewBalances(copier: CopierSession, trade: TradeIntent): [bigint, bigint] {
    const yellowSession = this.yellowService.getSession(copier.yellowChannelId);
    if (!yellowSession) throw new Error(`Yellow session not found: ${copier.yellowChannelId}`);

    const [leaderBalance, copierBalance] = yellowSession.balances;
    const tradeCost = (trade.amount * trade.price) / BigInt(10 ** 18);

    // BUY: Decrease balance, SELL: Increase balance
    const newCopierBalance = trade.action === TradeAction.BUY
      ? copierBalance - tradeCost
      : copierBalance + tradeCost;

    return [leaderBalance, newCopierBalance];
  }

  private async handleMaxDrawdownBreach(sessionId: string, copierAddress: string): Promise<void> {
    const copier = this.findCopierSession(sessionId);
    if (copier) await this.unsubscribeCopier(copier, 'max-drawdown-breached');
  }

  /**
   * Unsubscribe a copier from their leader
   */
  async unsubscribeCopier(copier: CopierSession, reason: 'manual' | 'max-drawdown-breached'): Promise<void> {
    copier.isActive = false;

    // Remove from copier list
    const copiers = this.copierSessions.get(copier.leaderAddress) || [];
    const index = copiers.findIndex((c) => c.sessionId === copier.sessionId);
    if (index !== -1) {
      copiers.splice(index, 1);
      this.copierSessions.set(copier.leaderAddress, copiers);
    }

    // Remove from leader's copier array
    const leader = this.leaderSessions.get(copier.leaderAddress);
    if (leader) {
      const leaderCopierIndex = leader.copiers.findIndex((addr) => addr === copier.copierAddress);
      if (leaderCopierIndex !== -1) leader.copiers.splice(leaderCopierIndex, 1);
    }

    // Clear risk tracking
    this.riskManager.clearSession(copier.sessionId);

    this.emit('copier-unsubscribed', {
      copier: copier.copierAddress,
      leader: copier.leaderAddress,
      reason,
      sessionId: copier.sessionId,
    });
  }

  /**
   * Find copier session by sessionId
   */
  private findCopierSession(sessionId: string): CopierSession | undefined {
    for (const copiers of this.copierSessions.values()) {
      const copier = copiers.find((c) => c.sessionId === sessionId);
      if (copier) {
        return copier;
      }
    }
    return undefined;
  }

  /**
   * Get leader session
   */
  getLeaderSession(leaderAddress: string): LeaderSession | undefined {
    return this.leaderSessions.get(leaderAddress);
  }

  /**
   * Get all copiers for a leader
   */
  getCopiers(leaderAddress: string): CopierSession[] {
    return this.copierSessions.get(leaderAddress) || [];
  }

  /**
   * Get active copier count for a leader
   */
  getActiveCopierCount(leaderAddress: string): number {
    const copiers = this.copierSessions.get(leaderAddress) || [];
    return copiers.filter((c) => c.isActive).length;
  }

  /**
   * Update copier session values (e.g., after price updates)
   */
  updateCopierValue(
    sessionId: string,
    newValue: bigint,
    prices: Map<string, bigint>
  ): void {
    const copier = this.findCopierSession(sessionId);
    if (!copier) {
      return;
    }

    copier.currentValue = newValue;
    copier.currentDrawdown = this.riskManager.calculateDrawdown(copier);

    // Update position prices
    this.riskManager.updatePositionPrices(sessionId, prices);

    // Check if should unsubscribe
    if (this.riskManager.shouldUnsubscribe(copier)) {
      this.unsubscribeCopier(copier, 'max-drawdown-breached');
    }
  }

  /**
   * Get replication statistics
   * If leaderAddress is provided, returns stats for that leader
   * Otherwise returns global stats
   */
  getStats(leaderAddress?: string): {
    totalLeaders?: number;
    totalCopiers: number;
    activeCopiers: number;
    totalVolumeReplicated?: string;
    totalFeesEarned?: string;
  } {
    if (leaderAddress) {
      // Return leader-specific stats
      const copiers = this.copierSessions.get(leaderAddress) || [];
      const leader = this.leaderSessions.get(leaderAddress);

      return {
        totalCopiers: copiers.length,
        activeCopiers: copiers.filter((c) => c.isActive).length,
        totalVolumeReplicated: leader?.totalVolumeReplicated.toString() || '0',
        totalFeesEarned: leader?.totalFeesEarned.toString() || '0',
      };
    }

    // Return global stats
    const totalLeaders = this.leaderSessions.size;
    let totalCopiers = 0;
    let activeCopiers = 0;

    for (const copiers of this.copierSessions.values()) {
      totalCopiers += copiers.length;
      activeCopiers += copiers.filter((c) => c.isActive).length;
    }

    return {
      totalLeaders,
      totalCopiers,
      activeCopiers,
    };
  }

  /**
   * Public getter for leader sessions (for API routes)
   */
  getLeaderSessions(): Map<string, LeaderSession> {
    return this.leaderSessions;
  }

  /**
   * Public getter for copier sessions (for API routes)
   */
  getCopierSessions(): Map<string, CopierSession[]> {
    return this.copierSessions;
  }

  /**
   * Get copiers by leader address (alias for getCopierSessions().get())
   */
  getCopiersByLeader(leaderAddress: string): CopierSession[] {
    return this.copierSessions.get(leaderAddress) || [];
  }
}
