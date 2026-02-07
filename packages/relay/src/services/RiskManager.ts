/**
 * RiskManager - Manages risk limits and protects copiers
 * Enforces max drawdown, position limits, and auto-unsubscribe
 */

import { EventEmitter } from 'events';
import {
  CopierSession,
  TradeIntent,
  RiskLimits,
  RiskCheckResult,
  ExecutedTrade,
} from '../types';

/**
 * Position tracking for risk calculations
 */
interface Position {
  asset: string;
  tokenAddress: string;
  amount: bigint;
  entryPrice: bigint;
  currentPrice: bigint;
  unrealizedPnL: bigint;
}

/**
 * Daily loss tracking
 */
interface DailyLoss {
  date: string; // YYYY-MM-DD
  totalLoss: bigint;
  tradeCount: number;
}

/**
 * RiskManager monitors and enforces risk limits for copiers
 */
export class RiskManager extends EventEmitter {
  // Track positions for each copier session
  private positions: Map<string, Map<string, Position>> = new Map(); // sessionId -> asset -> Position

  // Track daily losses
  private dailyLosses: Map<string, DailyLoss> = new Map(); // sessionId -> DailyLoss

  // Track historical values for drawdown calculation
  private peakValues: Map<string, bigint> = new Map(); // sessionId -> peak value

  constructor() {
    super();
  }

  /**
   * Check if a trade would breach risk limits
   */
  async checkRiskLimits(
    session: CopierSession,
    trade: TradeIntent,
    limits: RiskLimits
  ): Promise<RiskCheckResult> {
    // 1. Check position size limit
    const tradeCost = (trade.amount * trade.price) / BigInt(10 ** 18);
    if (tradeCost > limits.maxPositionSize) {
      return {
        passed: false,
        reason: `Trade size ${tradeCost} exceeds max position size ${limits.maxPositionSize}`,
      };
    }

    // 2. Check max open positions
    const openPositions = this.getOpenPositions(session.sessionId);
    if (trade.action === 'BUY' && openPositions.length >= limits.maxOpenPositions) {
      return {
        passed: false,
        reason: `Max open positions (${limits.maxOpenPositions}) reached`,
      };
    }

    // 3. Check daily loss limit
    const dailyLoss = this.getDailyLoss(session.sessionId);
    if (dailyLoss >= limits.maxDailyLoss) {
      return {
        passed: false,
        reason: `Daily loss limit reached: ${dailyLoss}/${limits.maxDailyLoss}`,
      };
    }

    // 4. Calculate projected drawdown after trade
    const currentDrawdown = this.calculateDrawdown(session);
    const projectedDrawdown = await this.calculateProjectedDrawdown(session, trade, currentDrawdown);

    if (projectedDrawdown > session.maxDrawdown) {
      return {
        passed: false,
        reason: `Projected drawdown ${projectedDrawdown.toFixed(1)}% exceeds max ${session.maxDrawdown}%`,
        currentDrawdown,
        projectedDrawdown,
      };
    }

    return { passed: true, currentDrawdown, projectedDrawdown };
  }

  /**
   * Calculate current P&L for a copier session
   */
  calculatePnL(session: CopierSession): bigint {
    const openPositions = this.getOpenPositions(session.sessionId);

    let totalPnL = BigInt(0);
    for (const position of openPositions) {
      totalPnL += position.unrealizedPnL;
    }

    // Add realized P&L (current value - start value - unrealized PnL)
    const realizedPnL = session.currentValue - session.startValue - totalPnL;

    return realizedPnL + totalPnL;
  }

  /**
   * Calculate current drawdown percentage
   */
  calculateDrawdown(session: CopierSession): number {
    const peakValue = this.peakValues.get(session.sessionId) || session.startValue;

    // Update peak if current value is higher
    if (session.currentValue > peakValue) {
      this.peakValues.set(session.sessionId, session.currentValue);
      return 0;
    }

    // Drawdown = (Peak - Current) / Peak * 100
    const drawdown = Number(((peakValue - session.currentValue) * BigInt(10000)) / peakValue) / 100;
    return Math.max(0, drawdown);
  }

  /**
   * Calculate projected drawdown if trade is executed
   * Only restricts trades if portfolio is already in significant drawdown
   */
  private async calculateProjectedDrawdown(
    session: CopierSession,
    trade: TradeIntent,
    currentDrawdown: number
  ): Promise<number> {
    // If portfolio is healthy, allow normal trading
    if (currentDrawdown < session.maxDrawdown * 0.5) {
      return currentDrawdown;
    }

    const openPositions = this.getOpenPositions(session.sessionId);
    const existingPosition = openPositions.find(p => p.asset === trade.asset);

    // BUY: Allow up to 90% of max drawdown before restricting
    if (trade.action === 'BUY') {
      return Math.min(currentDrawdown * 1.1, session.maxDrawdown * 0.9);
    }

    // SELL: Check if selling at a loss
    if (existingPosition && trade.price < existingPosition.entryPrice) {
      const potentialLoss = ((existingPosition.entryPrice - trade.price) * trade.amount) / BigInt(10 ** 18);
      const peakValue = this.peakValues.get(session.sessionId) || session.startValue;
      const additionalDrawdown = Number((potentialLoss * BigInt(10000)) / peakValue) / 100;
      return currentDrawdown + additionalDrawdown;
    }

    return currentDrawdown;
  }

  shouldUnsubscribe(session: CopierSession): boolean {
    const currentDrawdown = this.calculateDrawdown(session);
    const shouldUnsubscribe = currentDrawdown >= session.maxDrawdown;

    if (shouldUnsubscribe) {
      this.emit('max-drawdown-breached', {
        sessionId: session.sessionId,
        copierAddress: session.copierAddress,
        currentDrawdown,
        maxDrawdown: session.maxDrawdown,
      });
    }

    return shouldUnsubscribe;
  }

  /**
   * Record a trade execution for position tracking
   */
  recordTrade(sessionId: string, trade: ExecutedTrade, currentPrice: bigint): void {
    let sessionPositions = this.positions.get(sessionId);
    if (!sessionPositions) {
      sessionPositions = new Map();
      this.positions.set(sessionId, sessionPositions);
    }

    const existingPosition = sessionPositions.get(trade.asset);

    if (trade.action === 'BUY') {
      if (existingPosition) {
        // Average entry price calculation
        const totalCost = existingPosition.amount * existingPosition.entryPrice + trade.amount * trade.price;
        const totalAmount = existingPosition.amount + trade.amount;
        const avgPrice = totalCost / totalAmount;

        existingPosition.amount = totalAmount;
        existingPosition.entryPrice = avgPrice;
        existingPosition.currentPrice = currentPrice;
        existingPosition.unrealizedPnL = this.calculatePositionPnL(totalAmount, avgPrice, currentPrice);
      } else {
        // New position
        sessionPositions.set(trade.asset, {
          asset: trade.asset,
          tokenAddress: trade.tokenAddress,
          amount: trade.amount,
          entryPrice: trade.price,
          currentPrice,
          unrealizedPnL: BigInt(0),
        });
      }
    } else if (existingPosition) {
      // SELL - reduce or close position
      if (trade.amount >= existingPosition.amount) {
        sessionPositions.delete(trade.asset);
        const realizedPnL = this.calculatePositionPnL(existingPosition.amount, existingPosition.entryPrice, trade.price);
        this.recordRealizedPnL(sessionId, realizedPnL);
      } else {
        // Partial close
        existingPosition.amount -= trade.amount;
        existingPosition.currentPrice = currentPrice;
        existingPosition.unrealizedPnL = this.calculatePositionPnL(existingPosition.amount, existingPosition.entryPrice, currentPrice);
        const realizedPnL = this.calculatePositionPnL(trade.amount, existingPosition.entryPrice, trade.price);
        this.recordRealizedPnL(sessionId, realizedPnL);
      }
    }
  }

  /**
   * Calculate P&L for a position
   */
  private calculatePositionPnL(amount: bigint, entryPrice: bigint, currentPrice: bigint): bigint {
    return (amount * (currentPrice - entryPrice)) / BigInt(10 ** 18);
  }

  /**
   * Record realized P&L and update daily loss tracking
   */
  private recordRealizedPnL(sessionId: string, realizedPnL: bigint): void {
    if (realizedPnL >= 0) return; // Only track losses

    const today = new Date().toISOString().split('T')[0];
    let dailyLoss = this.dailyLosses.get(sessionId);

    if (!dailyLoss || dailyLoss.date !== today) {
      dailyLoss = { date: today, totalLoss: BigInt(0), tradeCount: 0 };
      this.dailyLosses.set(sessionId, dailyLoss);
    }

    dailyLoss.totalLoss += -realizedPnL;
    dailyLoss.tradeCount++;
  }

  getDailyLoss(sessionId: string): bigint {
    const today = new Date().toISOString().split('T')[0];
    const dailyLoss = this.dailyLosses.get(sessionId);
    return (!dailyLoss || dailyLoss.date !== today) ? BigInt(0) : dailyLoss.totalLoss;
  }

  getOpenPositions(sessionId: string): Position[] {
    const sessionPositions = this.positions.get(sessionId);
    return sessionPositions ? Array.from(sessionPositions.values()) : [];
  }

  updatePositionPrices(sessionId: string, prices: Map<string, bigint>): void {
    const sessionPositions = this.positions.get(sessionId);
    if (!sessionPositions) return;

    for (const [asset, position] of sessionPositions) {
      const newPrice = prices.get(asset);
      if (newPrice) {
        position.currentPrice = newPrice;
        position.unrealizedPnL = this.calculatePositionPnL(position.amount, position.entryPrice, newPrice);
      }
    }
  }

  clearSession(sessionId: string): void {
    this.positions.delete(sessionId);
    this.dailyLosses.delete(sessionId);
    this.peakValues.delete(sessionId);
  }

  getRiskMetrics(session: CopierSession) {
    return {
      currentDrawdown: this.calculateDrawdown(session),
      openPositions: this.getOpenPositions(session.sessionId).length,
      dailyLoss: this.getDailyLoss(session.sessionId),
      totalPnL: this.calculatePnL(session),
      peakValue: this.peakValues.get(session.sessionId) || session.startValue,
    };
  }
}
