/**
 * OracleService - Price oracle for asset pricing
 * Uses mock prices for hackathon demo
 * Production would integrate Chainlink or other oracle providers
 */

import { EventEmitter } from 'events';

/**
 * Asset price data
 */
interface PriceData {
  asset: string;
  price: bigint; // Price in USDC (6 decimals)
  timestamp: number;
  source: 'mock' | 'chainlink';
}

/**
 * Mock price configuration
 */
interface MockPriceConfig {
  basePrice: bigint;
  volatility: number; // Percentage (e.g., 0.02 = 2%)
  updateInterval: number; // Milliseconds
}

/**
 * OracleService provides asset pricing
 */
export class OracleService extends EventEmitter {
  private prices: Map<string, PriceData> = new Map();
  private mockConfigs: Map<string, MockPriceConfig> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeMockPrices();
  }

  /**
   * Initialize mock prices for common assets
   */
  private initializeMockPrices(): void {
    // ETH/USD
    this.setMockPrice('ETH', {
      basePrice: BigInt(3200) * BigInt(10 ** 6), // $3,200 USDC
      volatility: 0.02, // 2% volatility
      updateInterval: 5000, // Update every 5 seconds
    });

    // BTC/USD
    this.setMockPrice('BTC', {
      basePrice: BigInt(60000) * BigInt(10 ** 6), // $60,000 USDC
      volatility: 0.015, // 1.5% volatility
      updateInterval: 5000,
    });

    // USDC/USD (stablecoin)
    this.setMockPrice('USDC', {
      basePrice: BigInt(1) * BigInt(10 ** 6), // $1.00 USDC
      volatility: 0.0001, // 0.01% volatility
      updateInterval: 10000,
    });

    // SOL/USD
    this.setMockPrice('SOL', {
      basePrice: BigInt(100) * BigInt(10 ** 6), // $100 USDC
      volatility: 0.03, // 3% volatility
      updateInterval: 5000,
    });

    console.log('✅ Oracle initialized with mock prices');
    console.log('   ETH: $3,200');
    console.log('   BTC: $60,000');
    console.log('   SOL: $100');
    console.log('   USDC: $1.00');
  }

  /**
   * Set mock price configuration for an asset
   */
  private setMockPrice(asset: string, config: MockPriceConfig): void {
    this.mockConfigs.set(asset, config);

    // Set initial price
    this.prices.set(asset, {
      asset,
      price: config.basePrice,
      timestamp: Date.now(),
      source: 'mock',
    });

    // Start price updates
    this.startMockPriceUpdates(asset);
  }

  /**
   * Start periodic mock price updates with simulated volatility
   */
  private startMockPriceUpdates(asset: string): void {
    const config = this.mockConfigs.get(asset);
    if (!config) return;

    const interval = setInterval(() => {
      const currentPrice = this.prices.get(asset)!.price;

      // Generate random price change within volatility range
      const changePercent = (Math.random() - 0.5) * 2 * config.volatility;
      const priceChange = (currentPrice * BigInt(Math.floor(changePercent * 10000))) / BigInt(10000);
      const newPrice = currentPrice + priceChange;

      // Update price
      const priceData: PriceData = {
        asset,
        price: newPrice,
        timestamp: Date.now(),
        source: 'mock',
      };

      this.prices.set(asset, priceData);
      this.emit('price-update', priceData);
    }, config.updateInterval);

    this.updateIntervals.set(asset, interval);
  }

  /**
   * Get current price for an asset
   */
  async getPrice(asset: string): Promise<bigint> {
    const priceData = this.prices.get(asset);
    if (!priceData) {
      throw new Error(`Price not available for asset: ${asset}`);
    }
    return priceData.price;
  }

  /**
   * Get price data with timestamp
   */
  async getPriceData(asset: string): Promise<PriceData> {
    const priceData = this.prices.get(asset);
    if (!priceData) {
      throw new Error(`Price not available for asset: ${asset}`);
    }
    return priceData;
  }

  /**
   * Get prices for multiple assets
   */
  async getPrices(assets: string[]): Promise<Map<string, bigint>> {
    const prices = new Map<string, bigint>();
    for (const asset of assets) {
      try {
        prices.set(asset, await this.getPrice(asset));
      } catch (error) {
        console.warn(`Failed to get price for ${asset}:`, error);
      }
    }
    return prices;
  }

  /**
   * Get all available prices
   */
  getAllPrices(): Map<string, PriceData> {
    return new Map(this.prices);
  }

  /**
   * Format price for display (converts from 6 decimals to string)
   */
  formatPrice(price: bigint): string {
    const dollars = Number(price) / 10 ** 6;
    return dollars.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  /**
   * Calculate value of position in USDC
   */
  calculateValue(asset: string, amount: bigint): bigint {
    const price = this.prices.get(asset)?.price;
    if (!price) return 0n;

    // amount is in wei (18 decimals), price is in USDC (6 decimals)
    // Result should be in USDC (6 decimals)
    return (amount * price) / BigInt(10 ** 18);
  }

  /**
   * Stop all price updates
   */
  stopUpdates(): void {
    for (const interval of this.updateIntervals.values()) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();
    console.log('Oracle price updates stopped');
  }

  /**
   * Add a custom asset price
   */
  addAsset(asset: string, config: MockPriceConfig): void {
    console.log(`Adding custom asset: ${asset} at ${this.formatPrice(config.basePrice)}`);
    this.setMockPrice(asset, config);
  }

  /**
   * Manually set price (useful for testing)
   */
  setPrice(asset: string, price: bigint): void {
    this.prices.set(asset, {
      asset,
      price,
      timestamp: Date.now(),
      source: 'mock',
    });
    this.emit('price-update', { asset, price });
  }
}

// Export singleton instance
export const oracle = new OracleService();
