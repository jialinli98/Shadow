/**
 * Shadow Relay API Server
 * Express.js REST API + Socket.io WebSocket server
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

import { YellowService } from '../services/YellowService';
import { ENSService } from '../services/ENSService';
import { RiskManager } from '../services/RiskManager';
import { ReplicationService } from '../services/ReplicationService';
import { config } from '../config';

import { setupLeaderRoutes } from './routes/leader';
import { setupCopierRoutes } from './routes/copier';
import { setupTradeRoutes } from './routes/trade';
import { setupMetricsRoutes } from './routes/metrics';
import { setupWebSocket } from './websocket';

dotenv.config();

/**
 * Shadow API Server
 * Coordinates all services and provides REST + WebSocket interfaces
 */
export class ShadowAPIServer {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;

  // Core services
  private yellowService: YellowService;
  private ensService: ENSService;
  private riskManager: RiskManager;
  private replicationService: ReplicationService;

  private port: number;
  private isRunning: boolean = false;

  constructor(port: number = 3001) {
    this.port = port;

    // Initialize Express app
    this.app = express();
    this.httpServer = createServer(this.app);

    // Initialize Socket.io
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Initialize services
    const yellowProvider = new ethers.JsonRpcProvider(config.ens.rpcUrl);
    this.yellowService = new YellowService({
      ...config.yellow,
      provider: yellowProvider,
      signerPrivateKey: process.env.RELAY_PRIVATE_KEY || ethers.Wallet.createRandom().privateKey,
    });
    this.ensService = new ENSService({
      provider: new ethers.JsonRpcProvider(config.ens.rpcUrl),
      ensRegistryAddress: process.env.ENS_REGISTRY_ADDRESS || '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e',
    });
    this.riskManager = new RiskManager();
    this.replicationService = new ReplicationService({
      yellowService: this.yellowService,
      riskManager: this.riskManager,
      defaultRiskLimits: {
        maxDrawdown: 10,
        maxPositionSize: BigInt(5000) * BigInt(10 ** 18), // 5,000 USDC
        maxDailyLoss: BigInt(1000) * BigInt(10 ** 18), // 1,000 USDC
        maxOpenPositions: 10,
      },
    });

    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`📥 ${req.method} ${req.path}`, {
        query: req.query,
        body: Object.keys(req.body).length > 0 ? req.body : undefined,
      });
      next();
    });

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          yellowNetwork: this.yellowService.isConnected(),
          replicationService: true,
        },
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    const services = {
      yellowService: this.yellowService,
      ensService: this.ensService,
      riskManager: this.riskManager,
      replicationService: this.replicationService,
    };

    // API versioning
    const apiV1 = express.Router();

    // Mount route handlers
    setupLeaderRoutes(apiV1, services);
    setupCopierRoutes(apiV1, services);
    setupTradeRoutes(apiV1, services);
    setupMetricsRoutes(apiV1, services);

    // Mount API router
    this.app.use('/api/v1', apiV1);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
      });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('❌ API Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    setupWebSocket(this.io, {
      replicationService: this.replicationService,
      riskManager: this.riskManager,
      yellowService: this.yellowService,
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Server already running');
      return;
    }

    try {
      // Connect to Yellow Network
      console.log('🌐 Connecting to Yellow Network...');
      await this.yellowService.connect();
      console.log('✅ Connected to Yellow Network');

      // Start HTTP server
      await new Promise<void>((resolve) => {
        this.httpServer.listen(this.port, () => {
          console.log(`🚀 Shadow Relay API Server running on port ${this.port}`);
          console.log(`📡 REST API: http://localhost:${this.port}/api/v1`);
          console.log(`🔌 WebSocket: ws://localhost:${this.port}`);
          console.log(`❤️ Health: http://localhost:${this.port}/health`);
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
      console.log('⚠️ Server not running');
      return;
    }

    console.log('🛑 Shutting down Shadow Relay API Server...');

    // Disconnect from Yellow Network
    await this.yellowService.disconnect();

    // Close WebSocket connections
    this.io.close();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.close(() => {
        console.log('✅ Server stopped');
        resolve();
      });
    });

    this.isRunning = false;
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get Socket.io server (for testing)
   */
  getIO(): SocketIOServer {
    return this.io;
  }
}

// Export singleton instance for convenience
let serverInstance: ShadowAPIServer | null = null;

export function getServerInstance(port?: number): ShadowAPIServer {
  if (!serverInstance) {
    serverInstance = new ShadowAPIServer(port);
  }
  return serverInstance;
}

// CLI entry point
if (require.main === module) {
  const port = parseInt(process.env.API_PORT || '3001', 10);
  const server = getServerInstance(port);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⚠️ SIGINT received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n⚠️ SIGTERM received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start server
  server.start().catch((error) => {
    console.error('❌ Fatal error starting server:', error);
    process.exit(1);
  });
}
