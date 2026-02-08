/**
 * Shadow API Server (New Architecture)
 * Main entry point for Shadow Relay API
 * Uses ShadowRelay, SettlementService, Oracle, and Market Maker
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Import Shadow services
import { ShadowRelay } from '../ShadowRelay';
import { YellowService } from '../services/YellowService';
import { MockMarketMaker } from '../services/MockMarketMaker';
import { OracleService } from '../services/OracleService';
import { RiskManager } from '../services/RiskManager';
import { SettlementService } from '../services/SettlementService';

// Import API handlers
import { createRestAPI } from './rest';
import { setupWebSocket } from './websocket';

dotenv.config();

/**
 * Main Shadow API Server
 */
export class ShadowAPIServer {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;

  // Core services
  private shadowRelay: ShadowRelay;
  private yellowService: YellowService;
  private marketMaker: MockMarketMaker;
  private oracle: OracleService;
  private riskManager: RiskManager;
  private settlementService: SettlementService;

  private port: number;
  private isRunning: boolean = false;

  constructor(port: number = 3001) {
    this.port = port;

    console.log('\n🌟 Initializing Shadow API Server...\n');

    // Initialize Express app
    this.app = express();
    this.httpServer = createServer(this.app);

    // Initialize Socket.IO
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
    );

    // Initialize Oracle (mock prices)
    this.oracle = new OracleService();

    // Initialize Market Maker
    this.marketMaker = new MockMarketMaker(this.oracle);

    // Initialize Yellow Service
    this.yellowService = new YellowService({
      wsUrl: process.env.YELLOW_WS_URL || 'wss://clearnet.yellow.com/ws',
      chainId: parseInt(process.env.YELLOW_CHAIN_ID || '11155111'),
      adjudicatorAddress: process.env.YELLOW_ADJUDICATOR_ADDRESS || '0x0871952AC5126Bf0E4Ba2a03002e9fE8C39f8418',
      provider,
      signerPrivateKey: process.env.RELAY_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey,
    });

    // Initialize Risk Manager
    this.riskManager = new RiskManager();

    // Initialize Settlement Service
    this.settlementService = new SettlementService({
      yellowService: this.yellowService,
      provider,
      shadowSettlementHookAddress: process.env.SHADOW_PERFORMANCE_FEE_HOOK || '0xDA80D93C0B8c8241f58eA9de2C555fBc1AEA7e5C',
      shadowFeeManagerAddress: process.env.SHADOW_FEE_MANAGER_ADDRESS || '0x6bF059D3CC2FCC52bE4f8E12e185dBbab553B62d',
      signerPrivateKey: process.env.RELAY_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey,
    });

    // Initialize Shadow Relay (main orchestrator)
    this.shadowRelay = new ShadowRelay({
      yellowService: this.yellowService,
      marketMaker: this.marketMaker,
      oracle: this.oracle,
      riskManager: this.riskManager,
      provider,
    });

    // Setup middleware, routes, and WebSocket
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();

    console.log('✅ All services initialized\n');
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString();
      console.log(`📥 [${timestamp}] ${req.method} ${req.path}`);
      if (Object.keys(req.body).length > 0) {
        console.log(`   Body:`, req.body);
      }
      next();
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'Shadow Relay API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          leaders: '/api/leaders',
          sessions: '/api/sessions',
          copiers: '/api/copiers',
          trades: '/api/trades',
          prices: '/api/prices',
          marketMaker: '/api/market-maker',
        },
        websocket: `ws://localhost:${this.port}`,
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Create REST API router
    const apiRouter = createRestAPI(
      this.shadowRelay,
      this.settlementService,
      this.oracle,
      this.marketMaker
    );

    // Mount API routes
    this.app.use('/api', apiRouter);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} does not exist`,
        availableRoutes: [
          'GET /api/health',
          'POST /api/leaders/register',
          'GET /api/leaders/:address',
          'POST /api/sessions/open',
          'POST /api/copiers/subscribe',
          'POST /api/trades/execute',
          'GET /api/prices/:asset',
        ],
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('❌ API Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    setupWebSocket(
      this.io,
      this.shadowRelay,
      this.settlementService,
      this.oracle,
      this.marketMaker
    );
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Server is already running');
      return;
    }

    try {
      console.log('🚀 Starting Shadow API Server...\n');

      // Try to connect to Yellow Network (non-blocking)
      console.log('🌐 Attempting to connect to Yellow Network...');
      try {
        await Promise.race([
          this.yellowService.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
        ]);
        console.log('✅ Connected to Yellow Network');
      } catch (error) {
        console.log('⚠️  Yellow Network connection failed (will use mock mode)');
        console.log(`   ${error instanceof Error ? error.message : error}`);
      }

      // Start HTTP server
      await new Promise<void>((resolve) => {
        this.httpServer.listen(this.port, () => {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🌟 Shadow Relay API Server');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`📡 REST API:   http://localhost:${this.port}/api`);
          console.log(`🔌 WebSocket:  ws://localhost:${this.port}`);
          console.log(`❤️  Health:     http://localhost:${this.port}/api/health`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          console.log('📊 Services:');
          console.log(`   ✅ Oracle: ${this.oracle.getAllPrices().size} assets`);
          console.log(`   ✅ Market Maker: ${this.marketMaker.address}`);
          console.log(`   ✅ Yellow Network: ${this.yellowService.isConnected() ? 'Connected' : 'Mock Mode'}`);
          console.log(`   ✅ Settlement: Ready`);
          console.log('\n🎯 Ready to accept requests!\n');
          resolve();
        });
      });

      this.isRunning = true;
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️  Server is not running');
      return;
    }

    console.log('\n🛑 Shutting down Shadow API Server...');

    // Stop oracle price updates
    this.oracle.stopUpdates();

    // Disconnect from Yellow Network
    try {
      this.yellowService.disconnect();
      console.log('✅ Disconnected from Yellow Network');
    } catch (error) {
      console.log('⚠️  Error disconnecting from Yellow Network');
    }

    // Close WebSocket connections
    this.io.close();
    console.log('✅ WebSocket connections closed');

    // Close HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.close(() => {
        console.log('✅ HTTP server stopped');
        resolve();
      });
    });

    this.isRunning = false;
    console.log('✅ Shutdown complete\n');
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get Socket.IO server (for testing)
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Get ShadowRelay instance (for testing)
   */
  getShadowRelay(): ShadowRelay {
    return this.shadowRelay;
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3001', 10);
  const server = new ShadowAPIServer(port);

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION');
  });

  // Start server
  server.start().catch((error) => {
    console.error('❌ Fatal error starting server:', error);
    process.exit(1);
  });
}

// Export for testing
export default ShadowAPIServer;
