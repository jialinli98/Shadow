/**
 * Database schema for Shadow Copy Trading
 *
 * Tracks:
 * - Copy relationships between leaders and copiers
 * - Yellow Network channel mappings
 * - Off-chain fee accumulation
 * - Trade replication history
 */

export interface CopyRelationship {
  id: string; // UUID

  // Participants
  leaderAddress: string; // Leader's wallet address
  copierAddress: string; // Copier's wallet address

  // Yellow Network Channels
  // Each participant has their own channel with the market maker
  leaderChannelId: string; // Leader ↔ Market Maker channel
  copierChannelId: string; // Copier ↔ Market Maker channel

  // Configuration
  performanceFeeRate: number; // e.g., 0.20 for 20%
  copierInitialDeposit: bigint; // How much copier deposited
  maxDrawdown: number; // Maximum allowed drawdown (%)

  // Status
  isActive: boolean;
  subscribedAt: number; // Timestamp
  lastTradeAt: number | null; // Last replicated trade timestamp

  // Off-chain fee tracking
  totalFeesAccumulated: bigint; // Total fees owed to leader (not yet settled)

  // Stats
  totalTradesReplicated: number;
  copierTotalPnL: bigint; // Copier's total P&L from trades
  copierCurrentBalance: bigint; // Current balance in copier's channel
}

export interface TradeReplication {
  id: string; // UUID
  copyRelationshipId: string; // FK to CopyRelationship

  // Leader's original trade
  leaderChannelId: string;
  leaderTradeNonce: number; // Nonce in leader's channel when trade executed

  // Trade details
  asset: string; // "ETH", "BTC", etc.
  side: 'BUY' | 'SELL';
  amount: string; // Amount traded
  price: string; // Execution price
  timestamp: number;

  // Copier's replicated trade
  copierChannelId: string;
  copierTradeNonce: number; // Nonce in copier's channel after replication

  // P&L tracking (off-chain)
  copierPnL: bigint; // Copier's profit/loss from this trade
  feeCalculated: bigint; // Performance fee for this trade (if copierPnL > 0)

  // Verification
  leaderStateHash: string; // State hash from leader's channel
  copierStateHash: string; // State hash from copier's channel

  // Status
  replicationStatus: 'pending' | 'executed' | 'failed';
  errorMessage?: string;
}

export interface FeeAccumulation {
  id: string; // UUID
  copyRelationshipId: string; // FK to CopyRelationship

  // Accumulation period
  periodStart: number; // Timestamp
  periodEnd: number | null; // null if still accumulating

  // Fee tracking
  totalFeesOwed: bigint; // Total fees accumulated in this period
  feesSettled: bigint; // Fees that have been settled on-chain
  feesUnsettled: bigint; // Fees still off-chain

  // Settlement
  isSettled: boolean;
  settlementTxHash: string | null; // On-chain transaction hash
  settledAt: number | null;
}

export interface ChannelSettlement {
  id: string; // UUID
  copyRelationshipId: string; // FK to CopyRelationship

  // Channel info
  copierChannelId: string;
  finalNonce: number; // Final nonce before settlement

  // Final balances (before fee deduction)
  copierFinalBalance: bigint;
  marketMakerFinalBalance: bigint;

  // Fee settlement
  performanceFeeDue: bigint; // Total fee owed to leader
  copierNetPayout: bigint; // copierFinalBalance - performanceFeeDue
  leaderFeePayout: bigint; // Fee paid to leader

  // Settlement transaction
  settlementTxHash: string | null;
  settlementStatus: 'initiated' | 'pending' | 'confirmed' | 'failed';

  // Timestamps
  initiatedAt: number;
  confirmedAt: number | null;

  // Yellow Network proof
  yellowStateProof: string; // Final channel state proof
  signatures: string[]; // Signatures from both parties
}

/**
 * Leader statistics (aggregated from all copiers)
 */
export interface LeaderStats {
  leaderAddress: string;

  // Copier counts
  totalCopiers: number;
  activeCopiers: number;

  // Trading stats
  totalTrades: number;
  totalVolume: bigint;

  // Fee earnings
  totalFeesAccumulated: bigint; // Off-chain fees
  totalFeesSettled: bigint; // On-chain settled fees
  totalFeesClaimable: bigint; // Fees waiting to be claimed

  // Performance
  averageCopierROI: number; // Average return for copiers

  // Updated timestamp
  lastUpdated: number;
}

/**
 * Copier portfolio view
 */
export interface CopierPortfolio {
  copierAddress: string;

  // All copy relationships for this copier
  relationships: CopyRelationship[];

  // Aggregated stats
  totalDeposited: bigint;
  totalCurrentValue: bigint;
  totalPnL: bigint;
  totalFeesOwed: bigint;

  // Updated timestamp
  lastUpdated: number;
}
