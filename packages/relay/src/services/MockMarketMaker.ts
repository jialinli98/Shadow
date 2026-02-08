/**
 * MockMarketMaker - Provides counterparty liquidity for Shadow trading
 *
 * The MM takes the opposite side of all trades:
 * - User BUYs → MM SELLs (goes short)
 * - User SELLs → MM BUYs (goes long)
 *
 * Tracks net exposure across all positions
 * For hackathon: simplified logic, production would manage risk/hedging
 */

import { EventEmitter } from 'events';
import { OracleService } from './OracleService';

/**
 * Market Maker position for a single asset
 */
interface MMPosition {
  asset: string;
  netPosition: bigint; // Positive = long, negative = short (in wei)
  entryPrice: bigint; // Weighted average entry price (USDC, 6 decimals)
  totalVolume: bigint; // Total volume traded (USDC)
  tradeCount: number;
  lastUpdate: number;
}

/**
 * Trade executed with MM
 */
interface MMTrade {
  tradeId: string;
  asset: string;
  side: 'BUY' | 'SELL'; // From user's perspective
  amount: bigint; // In wei
  price: bigint; // In USDC (6 decimals)
  timestamp: number;
  mmSide: 'BUY' | 'SELL'; // MM's opposite side
}

/**
 * MockMarketMaker provides liquidity for all trades
 */
export class MockMarketMaker extends EventEmitter {
  public readonly address: `0x${string}`;
  private oracle: OracleService;

  // Exposure tracking
  private positions: Map<string, MMPosition> = new Map();
  private tradeHistory: MMTrade[] = [];

  // Risk parameters
  private readonly spreadBps: bigint = 10n; // 0.1% spread (10 basis points)
  private readonly maxExposure: bigint = BigInt(1000000) * BigInt(10 ** 18); // 1M tokens per asset

  constructor(oracle: OracleService, mmAddress?: string) {
    super();
    this.oracle = oracle;
    this.address = (mmAddress || '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF') as `0x${string}`;

    console.log('🏦 Mock Market Maker initialized');
    console.log(`   Address: ${this.address}`);
    console.log(`   Spread: ${Number(this.spreadBps) / 100}%`);
  }

  /**
   * Quote a price for a trade (with spread)
   */
  async quote(
    asset: string,
    amount: bigint,
    side: 'BUY' | 'SELL'
  ): Promise<bigint> {
    const midPrice = await this.oracle.getPrice(asset);

    if (side === 'BUY') {
      // User buys → MM sells → quote ask (higher)
      return midPrice + (midPrice * this.spreadBps / 10000n);
    } else {
      // User sells → MM buys → quote bid (lower)
      return midPrice - (midPrice * this.spreadBps / 10000n);
    }
  }

  /**
   * Execute trade with MM (MM takes opposite side)
   */
  async executeTrade(
    tradeId: string,
    asset: string,
    side: 'BUY' | 'SELL',
    amount: bigint,
    price: bigint
  ): Promise<MMTrade> {
    // Check exposure limits
    const currentPosition = this.positions.get(asset);
    const currentExposure = currentPosition?.netPosition || 0n;

    // Calculate new exposure after trade
    const mmSide = side === 'BUY' ? 'SELL' : 'BUY';
    const exposureChange = mmSide === 'BUY' ? amount : -amount;
    const newExposure = currentExposure + exposureChange;

    if (newExposure > this.maxExposure || newExposure < -this.maxExposure) {
      throw new Error(`Trade exceeds MM risk limits for ${asset}`);
    }

    // Update MM position
    this.updatePosition(asset, mmSide, amount, price);

    // Record trade
    const mmTrade: MMTrade = {
      tradeId,
      asset,
      side,
      amount,
      price,
      timestamp: Date.now(),
      mmSide,
    };

    this.tradeHistory.push(mmTrade);
    this.emit('trade-executed', mmTrade);

    console.log(`🔄 MM executed: ${mmSide} ${this.formatAmount(amount)} ${asset} @ ${this.oracle.formatPrice(price)}`);

    return mmTrade;
  }

  /**
   * Update MM's position for an asset
   */
  private updatePosition(
    asset: string,
    mmSide: 'BUY' | 'SELL',
    amount: bigint,
    price: bigint
  ): void {
    let position = this.positions.get(asset);

    if (!position) {
      // New position
      position = {
        asset,
        netPosition: mmSide === 'BUY' ? amount : -amount,
        entryPrice: price,
        totalVolume: (amount * price) / BigInt(10 ** 18),
        tradeCount: 1,
        lastUpdate: Date.now(),
      };
    } else {
      // Update existing position
      const oldPosition = position.netPosition;
      const positionChange = mmSide === 'BUY' ? amount : -amount;
      const newPosition = oldPosition + positionChange;

      // Update weighted average entry price
      if ((oldPosition > 0n && positionChange > 0n) || (oldPosition < 0n && positionChange < 0n)) {
        // Adding to existing position
        const oldValue = (oldPosition > 0n ? oldPosition : -oldPosition) * position.entryPrice;
        const newValue = (positionChange > 0n ? positionChange : -positionChange) * price;
        const totalValue = oldValue + newValue;
        const totalSize = (oldPosition > 0n ? oldPosition : -oldPosition) +
                          (positionChange > 0n ? positionChange : -positionChange);
        position.entryPrice = totalValue / totalSize;
      }
      // If reducing/flipping position, keep old entry price for P&L calc

      position.netPosition = newPosition;
      position.totalVolume += (amount * price) / BigInt(10 ** 18);
      position.tradeCount++;
      position.lastUpdate = Date.now();
    }

    this.positions.set(asset, position);
  }

  /**
   * Get MM's current position for an asset
   */
  getPosition(asset: string): MMPosition | null {
    return this.positions.get(asset) || null;
  }

  /**
   * Get all MM positions
   */
  getAllPositions(): MMPosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Calculate MM's unrealized P&L for an asset
   */
  async calculatePnL(asset: string): Promise<bigint> {
    const position = this.positions.get(asset);
    if (!position || position.netPosition === 0n) return 0n;

    const currentPrice = await this.oracle.getPrice(asset);
    const entryPrice = position.entryPrice;

    // P&L = (currentPrice - entryPrice) * position
    // For short positions (negative), this will be negative when price increases
    const pnlPerUnit = currentPrice - entryPrice;
    const totalPnL = (pnlPerUnit * position.netPosition) / BigInt(10 ** 18);

    return totalPnL;
  }

  /**
   * Get total P&L across all positions
   */
  async getTotalPnL(): Promise<bigint> {
    let totalPnL = 0n;

    for (const position of this.positions.values()) {
      if (position.netPosition !== 0n) {
        const pnl = await this.calculatePnL(position.asset);
        totalPnL += pnl;
      }
    }

    return totalPnL;
  }

  /**
   * Get MM exposure summary
   */
  async getExposureSummary(): Promise<{
    positions: MMPosition[];
    totalPnL: bigint;
    totalVolume: bigint;
    tradeCount: number;
  }> {
    const positions = this.getAllPositions();
    const totalPnL = await this.getTotalPnL();
    const totalVolume = positions.reduce((sum, p) => sum + p.totalVolume, 0n);
    const tradeCount = this.tradeHistory.length;

    return {
      positions,
      totalPnL,
      totalVolume,
      tradeCount,
    };
  }

  /**
   * Get trade history
   */
  getTradeHistory(limit?: number): MMTrade[] {
    const history = [...this.tradeHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear all positions (for testing)
   */
  clearPositions(): void {
    this.positions.clear();
    this.tradeHistory = [];
    console.log('MM positions cleared');
  }

  /**
   * Format amount for display
   */
  private formatAmount(amount: bigint): string {
    return (Number(amount) / 10 ** 18).toFixed(4);
  }

  /**
   * Get MM statistics
   */
  async getStats(): Promise<{
    address: string;
    openPositions: number;
    totalVolume: string;
    totalTrades: number;
    totalPnL: string;
    largestPosition: { asset: string; size: string } | null;
  }> {
    const positions = this.getAllPositions();
    const openPositions = positions.filter(p => p.netPosition !== 0n).length;
    const totalVolume = positions.reduce((sum, p) => sum + p.totalVolume, 0n);
    const totalPnL = await this.getTotalPnL();

    let largestPosition: { asset: string; size: string } | null = null;
    let maxSize = 0n;
    for (const pos of positions) {
      const absSize = pos.netPosition > 0n ? pos.netPosition : -pos.netPosition;
      if (absSize > maxSize) {
        maxSize = absSize;
        largestPosition = {
          asset: pos.asset,
          size: this.formatAmount(absSize),
        };
      }
    }

    return {
      address: this.address,
      openPositions,
      totalVolume: this.oracle.formatPrice(totalVolume),
      totalTrades: this.tradeHistory.length,
      totalPnL: this.oracle.formatPrice(totalPnL),
      largestPosition,
    };
  }
}
