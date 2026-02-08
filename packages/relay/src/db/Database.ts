/**
 * Database service for Shadow Copy Trading
 *
 * In-memory implementation for MVP
 * Can be replaced with PostgreSQL/MongoDB in production
 */

import { randomUUID } from 'crypto';
import {
  CopyRelationship,
  TradeReplication,
  FeeAccumulation,
  ChannelSettlement,
  LeaderStats,
  CopierPortfolio,
} from './schema';

export class Database {
  // In-memory storage
  private copyRelationships: Map<string, CopyRelationship> = new Map();
  private tradeReplications: Map<string, TradeReplication> = new Map();
  private feeAccumulations: Map<string, FeeAccumulation> = new Map();
  private channelSettlements: Map<string, ChannelSettlement> = new Map();
  private leaderStats: Map<string, LeaderStats> = new Map();

  // Indexes for fast lookups
  private relationshipsByLeader: Map<string, Set<string>> = new Map();
  private relationshipsByCopier: Map<string, Set<string>> = new Map();
  private relationshipsByLeaderChannel: Map<string, string> = new Map();
  private relationshipsByCopierChannel: Map<string, string> = new Map();

  /**
   * Create a new copy relationship
   */
  async createCopyRelationship(params: {
    leaderAddress: string;
    copierAddress: string;
    leaderChannelId: string;
    copierChannelId: string;
    performanceFeeRate: number;
    copierInitialDeposit: bigint;
    maxDrawdown: number;
  }): Promise<CopyRelationship> {
    const id = randomUUID();

    const relationship: CopyRelationship = {
      id,
      leaderAddress: params.leaderAddress,
      copierAddress: params.copierAddress,
      leaderChannelId: params.leaderChannelId,
      copierChannelId: params.copierChannelId,
      performanceFeeRate: params.performanceFeeRate,
      copierInitialDeposit: params.copierInitialDeposit,
      maxDrawdown: params.maxDrawdown,
      isActive: true,
      subscribedAt: Date.now(),
      lastTradeAt: null,
      totalFeesAccumulated: 0n,
      totalTradesReplicated: 0,
      copierTotalPnL: 0n,
      copierCurrentBalance: params.copierInitialDeposit,
    };

    this.copyRelationships.set(id, relationship);

    // Update indexes
    if (!this.relationshipsByLeader.has(params.leaderAddress)) {
      this.relationshipsByLeader.set(params.leaderAddress, new Set());
    }
    this.relationshipsByLeader.get(params.leaderAddress)!.add(id);

    if (!this.relationshipsByCopier.has(params.copierAddress)) {
      this.relationshipsByCopier.set(params.copierAddress, new Set());
    }
    this.relationshipsByCopier.get(params.copierAddress)!.add(id);

    this.relationshipsByLeaderChannel.set(params.leaderChannelId, id);
    this.relationshipsByCopierChannel.set(params.copierChannelId, id);

    // Initialize fee accumulation period
    await this.createFeeAccumulation({
      copyRelationshipId: id,
      periodStart: Date.now(),
    });

    return relationship;
  }

  /**
   * Get copy relationship by ID
   */
  async getCopyRelationship(id: string): Promise<CopyRelationship | null> {
    return this.copyRelationships.get(id) || null;
  }

  /**
   * Get all copy relationships for a leader
   */
  async getCopyRelationshipsForLeader(leaderAddress: string): Promise<CopyRelationship[]> {
    const ids = this.relationshipsByLeader.get(leaderAddress) || new Set();
    return Array.from(ids)
      .map((id) => this.copyRelationships.get(id))
      .filter((r): r is CopyRelationship => r !== undefined);
  }

  /**
   * Get all copy relationships for a copier
   */
  async getCopyRelationshipsForCopier(copierAddress: string): Promise<CopyRelationship[]> {
    const ids = this.relationshipsByCopier.get(copierAddress) || new Set();
    return Array.from(ids)
      .map((id) => this.copyRelationships.get(id))
      .filter((r): r is CopyRelationship => r !== undefined);
  }

  /**
   * Get copy relationship by copier channel ID
   */
  async getCopyRelationshipByCopierChannel(copierChannelId: string): Promise<CopyRelationship | null> {
    const id = this.relationshipsByCopierChannel.get(copierChannelId);
    if (!id) return null;
    return this.copyRelationships.get(id) || null;
  }

  /**
   * Get active copiers for a leader (for trade broadcasting)
   */
  async getActiveCopiers(leaderAddress: string): Promise<CopyRelationship[]> {
    const relationships = await this.getCopyRelationshipsForLeader(leaderAddress);
    return relationships.filter((r) => r.isActive);
  }

  /**
   * Record a trade replication
   */
  async recordTradeReplication(params: {
    copyRelationshipId: string;
    leaderChannelId: string;
    leaderTradeNonce: number;
    asset: string;
    side: 'BUY' | 'SELL';
    amount: string;
    price: string;
    timestamp: number;
    copierChannelId: string;
    copierTradeNonce: number;
    copierPnL: bigint;
    leaderStateHash: string;
    copierStateHash: string;
  }): Promise<TradeReplication> {
    const id = randomUUID();

    // Calculate performance fee if copier made profit
    const feeCalculated = params.copierPnL > 0n
      ? BigInt(Math.floor(Number(params.copierPnL) * (await this.getCopyRelationship(params.copyRelationshipId))!.performanceFeeRate))
      : 0n;

    const replication: TradeReplication = {
      id,
      copyRelationshipId: params.copyRelationshipId,
      leaderChannelId: params.leaderChannelId,
      leaderTradeNonce: params.leaderTradeNonce,
      asset: params.asset,
      side: params.side,
      amount: params.amount,
      price: params.price,
      timestamp: params.timestamp,
      copierChannelId: params.copierChannelId,
      copierTradeNonce: params.copierTradeNonce,
      copierPnL: params.copierPnL,
      feeCalculated,
      leaderStateHash: params.leaderStateHash,
      copierStateHash: params.copierStateHash,
      replicationStatus: 'executed',
    };

    this.tradeReplications.set(id, replication);

    // Update copy relationship stats
    const relationship = this.copyRelationships.get(params.copyRelationshipId);
    if (relationship) {
      relationship.totalTradesReplicated++;
      relationship.copierTotalPnL += params.copierPnL;
      relationship.totalFeesAccumulated += feeCalculated;
      relationship.lastTradeAt = params.timestamp;
      this.copyRelationships.set(params.copyRelationshipId, relationship);
    }

    // Update current fee accumulation period
    const activeFeeAccumulation = await this.getActiveFeeAccumulation(params.copyRelationshipId);
    if (activeFeeAccumulation) {
      activeFeeAccumulation.totalFeesOwed += feeCalculated;
      activeFeeAccumulation.feesUnsettled += feeCalculated;
      this.feeAccumulations.set(activeFeeAccumulation.id, activeFeeAccumulation);
    }

    return replication;
  }

  /**
   * Get trade history for a copy relationship
   */
  async getTradeHistory(copyRelationshipId: string): Promise<TradeReplication[]> {
    return Array.from(this.tradeReplications.values()).filter(
      (t) => t.copyRelationshipId === copyRelationshipId
    );
  }

  /**
   * Create a new fee accumulation period
   */
  async createFeeAccumulation(params: {
    copyRelationshipId: string;
    periodStart: number;
  }): Promise<FeeAccumulation> {
    const id = randomUUID();

    const accumulation: FeeAccumulation = {
      id,
      copyRelationshipId: params.copyRelationshipId,
      periodStart: params.periodStart,
      periodEnd: null,
      totalFeesOwed: 0n,
      feesSettled: 0n,
      feesUnsettled: 0n,
      isSettled: false,
      settlementTxHash: null,
      settledAt: null,
    };

    this.feeAccumulations.set(id, accumulation);
    return accumulation;
  }

  /**
   * Get active (unsettled) fee accumulation for a relationship
   */
  async getActiveFeeAccumulation(copyRelationshipId: string): Promise<FeeAccumulation | null> {
    return (
      Array.from(this.feeAccumulations.values()).find(
        (f) => f.copyRelationshipId === copyRelationshipId && !f.isSettled
      ) || null
    );
  }

  /**
   * Record channel settlement
   */
  async recordChannelSettlement(params: {
    copyRelationshipId: string;
    copierChannelId: string;
    finalNonce: number;
    copierFinalBalance: bigint;
    marketMakerFinalBalance: bigint;
    performanceFeeDue: bigint;
    yellowStateProof: string;
    signatures: string[];
  }): Promise<ChannelSettlement> {
    const id = randomUUID();

    const settlement: ChannelSettlement = {
      id,
      copyRelationshipId: params.copyRelationshipId,
      copierChannelId: params.copierChannelId,
      finalNonce: params.finalNonce,
      copierFinalBalance: params.copierFinalBalance,
      marketMakerFinalBalance: params.marketMakerFinalBalance,
      performanceFeeDue: params.performanceFeeDue,
      copierNetPayout: params.copierFinalBalance - params.performanceFeeDue,
      leaderFeePayout: params.performanceFeeDue,
      settlementTxHash: null,
      settlementStatus: 'initiated',
      initiatedAt: Date.now(),
      confirmedAt: null,
      yellowStateProof: params.yellowStateProof,
      signatures: params.signatures,
    };

    this.channelSettlements.set(id, settlement);

    // Mark copy relationship as inactive
    const relationship = this.copyRelationships.get(params.copyRelationshipId);
    if (relationship) {
      relationship.isActive = false;
      this.copyRelationships.set(params.copyRelationshipId, relationship);
    }

    return settlement;
  }

  /**
   * Update settlement with transaction hash
   */
  async updateSettlementTx(settlementId: string, txHash: string, status: 'pending' | 'confirmed' | 'failed'): Promise<void> {
    const settlement = this.channelSettlements.get(settlementId);
    if (settlement) {
      settlement.settlementTxHash = txHash;
      settlement.settlementStatus = status;
      if (status === 'confirmed') {
        settlement.confirmedAt = Date.now();
      }
      this.channelSettlements.set(settlementId, settlement);

      // If confirmed, mark fee accumulation as settled
      if (status === 'confirmed') {
        const feeAccumulation = await this.getActiveFeeAccumulation(settlement.copyRelationshipId);
        if (feeAccumulation) {
          feeAccumulation.isSettled = true;
          feeAccumulation.periodEnd = Date.now();
          feeAccumulation.feesSettled = feeAccumulation.totalFeesOwed;
          feeAccumulation.feesUnsettled = 0n;
          feeAccumulation.settlementTxHash = txHash;
          feeAccumulation.settledAt = Date.now();
          this.feeAccumulations.set(feeAccumulation.id, feeAccumulation);
        }
      }
    }
  }

  /**
   * Get leader statistics
   */
  async getLeaderStats(leaderAddress: string): Promise<LeaderStats> {
    const relationships = await this.getCopyRelationshipsForLeader(leaderAddress);

    const totalFeesAccumulated = relationships.reduce(
      (sum, r) => sum + r.totalFeesAccumulated,
      0n
    );

    const settledFees = Array.from(this.channelSettlements.values())
      .filter((s) => {
        const rel = this.copyRelationships.get(s.copyRelationshipId);
        return rel?.leaderAddress === leaderAddress && s.settlementStatus === 'confirmed';
      })
      .reduce((sum, s) => sum + s.leaderFeePayout, 0n);

    const claimableFees = Array.from(this.channelSettlements.values())
      .filter((s) => {
        const rel = this.copyRelationships.get(s.copyRelationshipId);
        return rel?.leaderAddress === leaderAddress && s.settlementStatus === 'confirmed';
      })
      .reduce((sum, s) => sum + s.leaderFeePayout, 0n);

    const totalTrades = relationships.reduce((sum, r) => sum + r.totalTradesReplicated, 0);

    const totalVolume = Array.from(this.tradeReplications.values())
      .filter((t) => {
        const rel = this.copyRelationships.get(t.copyRelationshipId);
        return rel?.leaderAddress === leaderAddress;
      })
      .reduce((sum, t) => {
        // Calculate volume as float, then convert to USDC base units (6 decimals)
        const volumeFloat = parseFloat(t.amount) * parseFloat(t.price);
        const volumeUsdc = Math.floor(volumeFloat * 1000000); // Convert to integer
        return sum + BigInt(volumeUsdc);
      }, 0n);

    const averageCopierROI =
      relationships.length > 0
        ? relationships.reduce((sum, r) => {
            const roi = Number(r.copierTotalPnL) / Number(r.copierInitialDeposit);
            return sum + roi;
          }, 0) / relationships.length
        : 0;

    const stats: LeaderStats = {
      leaderAddress,
      totalCopiers: relationships.length,
      activeCopiers: relationships.filter((r) => r.isActive).length,
      totalTrades,
      totalVolume,
      totalFeesAccumulated,
      totalFeesSettled: settledFees,
      totalFeesClaimable: claimableFees,
      averageCopierROI,
      lastUpdated: Date.now(),
    };

    this.leaderStats.set(leaderAddress, stats);
    return stats;
  }

  /**
   * Get copier portfolio
   */
  async getCopierPortfolio(copierAddress: string): Promise<CopierPortfolio> {
    const relationships = await this.getCopyRelationshipsForCopier(copierAddress);

    const totalDeposited = relationships.reduce(
      (sum, r) => sum + r.copierInitialDeposit,
      0n
    );

    const totalCurrentValue = relationships.reduce(
      (sum, r) => sum + r.copierCurrentBalance,
      0n
    );

    const totalPnL = relationships.reduce((sum, r) => sum + r.copierTotalPnL, 0n);

    const totalFeesOwed = relationships.reduce(
      (sum, r) => sum + r.totalFeesAccumulated,
      0n
    );

    return {
      copierAddress,
      relationships,
      totalDeposited,
      totalCurrentValue,
      totalPnL,
      totalFeesOwed,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.copyRelationships.clear();
    this.tradeReplications.clear();
    this.feeAccumulations.clear();
    this.channelSettlements.clear();
    this.leaderStats.clear();
    this.relationshipsByLeader.clear();
    this.relationshipsByCopier.clear();
    this.relationshipsByLeaderChannel.clear();
    this.relationshipsByCopierChannel.clear();
  }
}

// Export singleton instance
export const db = new Database();
