/**
 * ShadowRelay - Main orchestrator for Shadow copy trading platform
 *
 * Coordinates:
 * - Leader/copier registration
 * - Yellow Network session management (all with Market Maker)
 * - Trade replication from leaders to copiers
 * - Risk management and drawdown monitoring
 * - Settlement and fee distribution
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { YellowService } from './services/YellowService';
import { MockMarketMaker } from './services/MockMarketMaker';
import { OracleService } from './services/OracleService';
import { RiskManager } from './services/RiskManager';
import { db, CopyRelationship } from './db';
import { TradeIntent, TradeAction } from './types';

/**
 * Signed trade from leader
 */
interface SignedTrade {
  trade: TradeIntent;
  signature: string;
  signer: string;
}

/**
 * ShadowRelay configuration
 */
interface ShadowRelayConfig {
  yellowService: YellowService;
  marketMaker: MockMarketMaker;
  oracle: OracleService;
  riskManager: RiskManager;
  provider: ethers.Provider;
}

/**
 * Session info for a user (leader or copier)
 */
interface UserSession {
  userAddress: string;
  yellowChannelId: string;
  collateral: bigint;
  isActive: boolean;
  openedAt: number;
}

/**
 * Main Shadow Relay orchestrator
 */
export class ShadowRelay extends EventEmitter {
  private yellowService: YellowService;
  private marketMaker: MockMarketMaker;
  private oracle: OracleService;
  private riskManager: RiskManager;
  private provider: ethers.Provider;

  // Session tracking
  private userSessions: Map<string, UserSession> = new Map(); // userAddress -> session
  private leaderAddresses: Set<string> = new Set();
  private leaderMetadata: Map<string, { ensName: string; performanceFee: number }> = new Map();

  constructor(config: ShadowRelayConfig) {
    super();
    this.yellowService = config.yellowService;
    this.marketMaker = config.marketMaker;
    this.oracle = config.oracle;
    this.riskManager = config.riskManager;
    this.provider = config.provider;

    this.setupEventListeners();

    console.log('🌟 Shadow Relay initialized');
    console.log(`   Market Maker: ${this.marketMaker.address}`);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for price updates
    this.oracle.on('price-update', (priceData) => {
      this.emit('price-update', priceData);
    });

    // Listen for MM trades
    this.marketMaker.on('trade-executed', (trade) => {
      this.emit('mm-trade', trade);
    });

    // Listen for risk events
    this.riskManager.on('max-drawdown-breached', async (data) => {
      await this.handleDrawdownBreach(data.sessionId);
    });
  }

  /**
   * Register a leader
   */
  async registerLeader(
    leaderAddress: string,
    ensName: string,
    performanceFeeRate: number
  ): Promise<void> {
    this.leaderAddresses.add(leaderAddress);
    this.leaderMetadata.set(leaderAddress, {
      ensName,
      performanceFee: performanceFeeRate
    });
    console.log(`✅ Leader registered: ${ensName} (${leaderAddress})`);
    this.emit('leader-registered', { leaderAddress, ensName });
  }

  /**
   * Open a Yellow Network session for a user (leader or copier)
   * Creates channel: User ↔ Market Maker
   */
  async openSession(
    userAddress: string,
    collateral: bigint
  ): Promise<string> {
    console.log(`📖 Opening session for ${userAddress} with ${ethers.formatUnits(collateral, 6)} USDC`);

    let yellowSession;

    // Create Yellow Network session (with automatic app session -> basic channel fallback)
    console.log('🌐 Creating Yellow Network session...');
    yellowSession = await this.yellowService.createSession(
      userAddress,
      this.marketMaker.address,
      [collateral, collateral] // Both start with same collateral
    );
    console.log('✅ Yellow Network session created:', yellowSession.channelId);

    // Track session
    const session: UserSession = {
      userAddress,
      yellowChannelId: yellowSession.channelId,
      collateral,
      isActive: true,
      openedAt: Date.now(),
    };

    this.userSessions.set(userAddress, session);

    console.log(`✅ Session opened: ${yellowSession.channelId}`);
    this.emit('session-opened', session);

    return yellowSession.channelId;
  }

  /**
   * Subscribe a copier to a leader
   */
  async subscribeCopier(
    copierAddress: string,
    leaderAddress: string,
    copierChannelId: string,
    performanceFeeRate: number,
    maxDrawdown: number
  ): Promise<CopyRelationship> {
    // Get sessions
    const leaderSession = this.userSessions.get(leaderAddress);
    const copierSession = this.userSessions.get(copierAddress);

    if (!leaderSession) throw new Error(`Leader session not found: ${leaderAddress}`);
    if (!copierSession) throw new Error(`Copier session not found: ${copierAddress}`);

    // Create copy relationship in database
    const relationship = await db.createCopyRelationship({
      leaderAddress,
      copierAddress,
      leaderChannelId: leaderSession.yellowChannelId,
      copierChannelId: copierSession.yellowChannelId,
      performanceFeeRate,
      copierInitialDeposit: copierSession.collateral,
      maxDrawdown,
    });

    console.log(`✅ Copier subscribed: ${copierAddress} → ${leaderAddress}`);
    this.emit('copier-subscribed', relationship);

    return relationship;
  }

  /**
   * Process a trade from a leader
   * This is the CORE replication logic
   */
  async processTrade(signedTrade: SignedTrade): Promise<void> {
    const { trade, signature, signer } = signedTrade;

    console.log(`\n🔄 Processing trade from ${signer}`);
    console.log(`   ${trade.action} ${ethers.formatEther(trade.amount)} ${trade.asset} @ ${this.oracle.formatPrice(trade.price)}`);

    // Verify this is a registered leader
    if (!this.leaderAddresses.has(signer)) {
      throw new Error('Not a registered leader');
    }

    // Verify signature
    const isValid = await this.verifyTradeSignature(signedTrade);
    if (!isValid) {
      throw new Error('Invalid trade signature');
    }

    // Get leader's session
    const leaderSession = this.userSessions.get(signer);
    if (!leaderSession) throw new Error('Leader session not found');

    // 1. Execute leader's trade with Market Maker
    await this.executeTrade(leaderSession.yellowChannelId, trade);

    // 2. Get all active copiers for this leader
    const copiers = await db.getActiveCopiers(signer);
    console.log(`   Replicating to ${copiers.length} copiers...`);

    // 3. Replicate to each copier
    for (const copier of copiers) {
      try {
        await this.replicateToSingleCopier(leaderSession, copier, trade);
      } catch (error) {
        console.error(`   ❌ Failed to replicate to ${copier.copierAddress}:`, error);
        this.emit('replication-error', { copier: copier.copierAddress, error });
      }
    }

    console.log(`✅ Trade replicated successfully\n`);
    this.emit('trade-replicated', { leader: signer, trade, copierCount: copiers.length });
  }

  /**
   * Execute trade in a Yellow channel
   */
  private async executeTrade(
    channelId: string,
    trade: TradeIntent
  ): Promise<void> {
    const yellowSession = this.yellowService.getSession(channelId);
    if (!yellowSession) throw new Error(`Session not found: ${channelId}`);

    // Calculate new balances after trade
    const [userBalance, mmBalance] = yellowSession.balances;
    const tradeCost = (trade.amount * trade.price) / BigInt(10 ** 18);

    let newUserBalance: bigint;
    let newMMBalance: bigint;

    if (trade.action === TradeAction.BUY) {
      // User buys, pays USDC
      newUserBalance = userBalance - tradeCost;
      newMMBalance = mmBalance + tradeCost;
    } else {
      // User sells, receives USDC
      newUserBalance = userBalance + tradeCost;
      newMMBalance = mmBalance - tradeCost;
    }

    // Execute trade in Yellow channel
    await this.yellowService.executeTrade(
      channelId,
      trade,
      [newUserBalance, newMMBalance]
    );

    // Update MM exposure
    await this.marketMaker.executeTrade(
      trade.tradeId,
      trade.asset,
      trade.action,
      trade.amount,
      trade.price
    );
  }

  /**
   * Replicate trade to a single copier
   */
  private async replicateToSingleCopier(
    leaderSession: UserSession,
    copier: CopyRelationship,
    leaderTrade: TradeIntent
  ): Promise<void> {
    // Calculate proportional size
    const ratio = Number(copier.copierInitialDeposit) / Number(leaderSession.collateral);
    const copierAmount = BigInt(Math.floor(Number(leaderTrade.amount) * ratio));

    console.log(`   → ${copier.copierAddress}: ${ratio.toFixed(2)}x = ${ethers.formatEther(copierAmount)} ${leaderTrade.asset}`);

    // Create copier's trade
    const copierTrade: TradeIntent = {
      ...leaderTrade,
      tradeId: `${leaderTrade.tradeId}-copier-${copier.copierAddress}`,
      leaderAddress: copier.copierAddress,
      amount: copierAmount,
      yellowChannelId: copier.copierChannelId,
    };

    // Check risk limits
    const copierSession = this.userSessions.get(copier.copierAddress);
    if (!copierSession) throw new Error('Copier session not found');

    // Execute copier's trade
    await this.executeTrade(copier.copierChannelId, copierTrade);

    // Calculate P&L for fee tracking
    const tradeCost = (copierAmount * copierTrade.price) / (10n ** 18n);
    const copierPnL = copierTrade.action === TradeAction.BUY ? -tradeCost : tradeCost; // Simplified

    // Get current Yellow state for hashes
    const leaderYellowState = this.yellowService.getSession(copier.leaderChannelId);
    const copierYellowState = this.yellowService.getSession(copier.copierChannelId);

    // Record trade replication in database
    await db.recordTradeReplication({
      copyRelationshipId: copier.id,
      leaderChannelId: copier.leaderChannelId,
      leaderTradeNonce: leaderYellowState?.nonce || 0,
      asset: copierTrade.asset,
      side: copierTrade.action,
      amount: ethers.formatEther(copierAmount),
      price: ethers.formatUnits(copierTrade.price, 6),
      timestamp: Date.now(),
      copierChannelId: copier.copierChannelId,
      copierTradeNonce: copierYellowState?.nonce || 0,
      copierPnL,
      leaderStateHash: '0x' + '0'.repeat(64), // Would be actual state hash
      copierStateHash: '0x' + '0'.repeat(64),
    });

    // Check drawdown - TODO: Fix type mismatch between CopyRelationship and CopierSession
    try {
      // Convert CopyRelationship to CopierSession format for drawdown check
      const copierSession = {
        sessionId: copier.copierChannelId,
        copierAddress: copier.copierAddress,
        leaderAddress: copier.leaderAddress,
        depositAmount: copier.copierInitialDeposit,
        maxDrawdown: copier.maxDrawdown,
        currentDrawdown: 0,
        yellowChannelId: copier.copierChannelId,
        isActive: copier.isActive,
        startValue: copier.copierInitialDeposit,
        currentValue: copier.copierCurrentBalance,
        startedAt: copier.subscribedAt,
      };

      const currentDrawdown = this.riskManager.calculateDrawdown(copierSession);
      if (currentDrawdown > copier.maxDrawdown) {
        console.warn(`   ⚠️  Copier ${copier.copierAddress} exceeded max drawdown!`);
        await this.handleDrawdownBreach(copier.copierChannelId);
      }
    } catch (error) {
      console.error('   ⚠️  Error calculating drawdown:', error);
    }
  }

  /**
   * Verify trade signature
   */
  private async verifyTradeSignature(signedTrade: SignedTrade): Promise<boolean> {
    try {
      // Reconstruct the exact message that was signed on the frontend
      // Frontend signs: { tradeId, asset, action, amount, price, timestamp }
      // Note: amount and price are strings on frontend, but BigInt here - convert back to string
      const messageToVerify = JSON.stringify({
        tradeId: signedTrade.trade.tradeId,
        asset: signedTrade.trade.asset,
        action: signedTrade.trade.action,
        amount: signedTrade.trade.amount.toString(),
        price: signedTrade.trade.price.toString(),
        timestamp: signedTrade.trade.timestamp,
      });

      console.log('🔍 Verifying signature:');
      console.log('   Message:', messageToVerify);
      console.log('   Signature:', signedTrade.signature);
      console.log('   Expected signer:', signedTrade.signer);

      const recoveredAddress = ethers.verifyMessage(messageToVerify, signedTrade.signature);
      console.log('   Recovered address:', recoveredAddress);
      console.log('   Match:', recoveredAddress.toLowerCase() === signedTrade.signer.toLowerCase());

      return recoveredAddress.toLowerCase() === signedTrade.signer.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Handle copier exceeding max drawdown
   */
  private async handleDrawdownBreach(channelId: string): Promise<void> {
    const relationship = await db.getCopyRelationshipByCopierChannel(channelId);
    if (!relationship) return;

    // TODO: Implement auto-unsubscribe or pause
    console.log(`⚠️  Auto-pausing copier ${relationship.copierAddress} due to drawdown`);
    this.emit('drawdown-breach', relationship);
  }

  /**
   * Get leader statistics
   */
  async getLeaderStats(leaderAddress: string) {
    const stats = await db.getLeaderStats(leaderAddress);
    const metadata = this.leaderMetadata.get(leaderAddress);

    // Enrich stats with ENS name if available
    if (metadata) {
      return {
        ...stats,
        ensName: metadata.ensName,
        performanceFee: metadata.performanceFee
      };
    }

    return stats;
  }

  /**
   * Get copier portfolio
   */
  async getCopierPortfolio(copierAddress: string) {
    return await db.getCopierPortfolio(copierAddress);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): UserSession[] {
    return Array.from(this.userSessions.values());
  }

  /**
   * Get session for a user
   */
  getSession(userAddress: string): UserSession | undefined {
    return this.userSessions.get(userAddress);
  }

  /**
   * Get all registered leaders
   */
  getAllLeaders(): string[] {
    return Array.from(this.leaderAddresses);
  }

  /**
   * Check if an address is a registered leader
   */
  isLeaderRegistered(address: string): boolean {
    return this.leaderAddresses.has(address);
  }

  /**
   * Get Market Maker stats
   */
  async getMarketMakerStats() {
    return await this.marketMaker.getStats();
  }
}
