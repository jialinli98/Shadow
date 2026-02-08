/**
 * Shadow API server with Yellow Network hybrid integration
 * - Real Yellow Network connection for session creation
 * - Mock channels for smooth demo experience
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { YellowService } from '../services/YellowService';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Mock data storage
const leaders: any[] = [];
const copiers: any[] = [];
const trades: any[] = [];
const stateChannels: Map<string, any> = new Map(); // channelId -> channel data

// ===== YELLOW NETWORK INTEGRATION (HYBRID MODE) =====
// Real Yellow Network connection for demonstrating SDK integration
let yellowService: YellowService | null = null;
let yellowConnected = false;

// Initialize Yellow Network connection
async function initializeYellowNetwork() {
  try {
    console.log('🔄 Connecting to Yellow Network...');
    console.log('📍 Broker:', process.env.YELLOW_WS_URL || 'wss://clearnet.yellow.com/ws');

    const provider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'
    );

    yellowService = new YellowService({
      wsUrl: process.env.YELLOW_WS_URL || 'wss://clearnet.yellow.com/ws',
      chainId: parseInt(process.env.YELLOW_CHAIN_ID || '11155111'),
      adjudicatorAddress: process.env.YELLOW_ADJUDICATOR_ADDRESS || '0x0871952AC5126Bf0E4Ba2a03002e9fE8C39f8418',
      provider,
      signerPrivateKey: process.env.RELAY_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    });

    await yellowService.connect();
    yellowConnected = true;

    console.log('✅ Connected to Yellow Network!');
    console.log('🎯 Hybrid Mode: Real Yellow sessions + Mock channels for demo');

    // Listen for Yellow Network events
    yellowService.on('session-created', (session) => {
      console.log('📢 Yellow session created:', session.sessionId);
      io.emit('yellow-session-created', session);
    });

    yellowService.on('state-updated', (update) => {
      console.log('📢 Yellow state updated:', update.sessionId, 'nonce:', update.nonce);
      io.emit('yellow-state-updated', update);
    });

    yellowService.on('session-closed', (sessionId) => {
      console.log('📢 Yellow session closed:', sessionId);
      io.emit('yellow-session-closed', sessionId);
    });

    yellowService.on('error', (error) => {
      console.error('⚠️  Yellow Network error:', error);
    });

    yellowService.on('disconnected', () => {
      console.log('⚠️  Yellow Network disconnected');
      yellowConnected = false;
    });

  } catch (error) {
    console.error('❌ Failed to connect to Yellow Network:', error);
    console.log('⚠️  Running in mock-only mode');
    yellowConnected = false;
  }
}

// Start connection in background
initializeYellowNetwork();

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Shadow API Server (Hybrid Mode)',
    yellowNetwork: {
      connected: yellowConnected,
      broker: process.env.YELLOW_WS_URL || 'wss://testnet.clearnet.yellow.com/ws',
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Shadow API Server (Hybrid Mode)',
    timestamp: Date.now(),
    yellowNetwork: {
      connected: yellowConnected,
      broker: process.env.YELLOW_WS_URL || 'wss://testnet.clearnet.yellow.com/ws',
      activeSessions: yellowService ? yellowService.getAllSessions().length : 0,
    },
    mockChannels: stateChannels.size,
  });
});

// Leader endpoints
app.get('/api/leaders', (req, res) => {
  res.json(leaders);
});

app.get('/api/leaders/:address', (req, res) => {
  const leader = leaders.find(l => l.address.toLowerCase() === req.params.address.toLowerCase());
  if (!leader) {
    return res.status(404).json({ error: 'Leader not found' });
  }
  res.json(leader);
});

app.post('/api/leaders/register', (req, res) => {
  const { address, ensName, performanceFee, minDeposit } = req.body;

  const leader = {
    address,
    ensName,
    performanceFee,
    minDeposit,
    totalCopiers: 0,
    totalVolume: '0',
    feesEarned: '0',
    roi: 0,
    maxDrawdown: 0,
    winRate: 0,
    totalTrades: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  leaders.push(leader);

  io.emit('leader-registered', { address, ensName, timestamp: new Date().toISOString() });

  res.json(leader);
});

// Copier endpoints
app.get('/api/copiers/:address', (req, res) => {
  const copier = copiers.find(c => c.copierAddress.toLowerCase() === req.params.address.toLowerCase());
  if (!copier) {
    return res.status(404).json({ error: 'Copier not found' });
  }
  res.json(copier);
});

app.get('/api/copiers/by-leader/:leaderAddress', (req, res) => {
  const leaderCopiers = copiers.filter(
    c => c.leaderAddress.toLowerCase() === req.params.leaderAddress.toLowerCase()
  );
  res.json(leaderCopiers);
});

app.post('/api/copiers/subscribe', (req, res) => {
  const { copierAddress, leaderAddress, deposit, maxDrawdown } = req.body;

  const leader = leaders.find(l => l.address.toLowerCase() === leaderAddress.toLowerCase());
  if (!leader) {
    return res.status(404).json({ error: 'Leader not found' });
  }

  const copier = {
    copierAddress,
    leaderAddress,
    leaderEns: leader.ensName,
    deposit,
    maxDrawdown,
    currentPnL: 0,
    currentDrawdown: 0,
    currentPositionSize: 0,
    maxPositionSize: (BigInt(deposit) / 2n).toString(),
    dailyDrawdown: 0,
    maxDailyDrawdown: 5,
    openPositions: 0,
    maxOpenPositions: 10,
    isActive: true,
    recentTrades: [],
    subscribedAt: new Date().toISOString(),
  };

  copiers.push(copier);
  leader.totalCopiers++;

  io.emit('copier-subscribed', { copierAddress, leaderAddress, timestamp: new Date().toISOString() });

  res.json(copier);
});

// Trade endpoints
app.post('/api/trades/execute', (req, res) => {
  const { leaderAddress, asset, side, amount, price } = req.body;

  const trade = {
    id: trades.length + 1,
    leaderAddress,
    asset,
    side,
    amount,
    price,
    timestamp: new Date().toISOString(),
  };

  trades.push(trade);

  // Broadcast to connected clients
  io.emit('trade-executed', trade);

  res.json(trade);
});

app.get('/api/trades/:channelId', (req, res) => {
  const channelTrades = trades.filter(t => t.channelId === req.params.channelId);
  res.json(channelTrades);
});

// State Channel endpoints (Yellow Network)
app.get('/api/state-channels/:leaderAddress', (req, res) => {
  const leaderAddress = req.params.leaderAddress.toLowerCase();

  // Update seed channels with leader address if they don't have one
  stateChannels.forEach((channel, channelId) => {
    if (!channel.leaderAddress || channel.leaderAddress === '') {
      channel.leaderAddress = req.params.leaderAddress;
      stateChannels.set(channelId, channel);
    }
  });

  const leaderChannels = Array.from(stateChannels.values()).filter(
    channel => channel.leaderAddress.toLowerCase() === leaderAddress
  );
  res.json(leaderChannels);
});

// Open mock channel (for smooth demo experience)
app.post('/api/state-channels/open', (req, res) => {
  const { leaderAddress, copierAddress, initialBalance } = req.body;

  const channelId = '0x' + Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  const channel = {
    channelId,
    leaderAddress,
    copierAddress,
    status: 'active',
    trades: 0,
    volume: 0,
    leaderBalance: initialBalance || 50000,
    copierBalance: initialBalance || 50000,
    openedAt: Date.now(),
    lastUpdate: Date.now(),
    nonce: 0,
    tradeHistory: [],
    isReal: false, // Mock channel
  };

  stateChannels.set(channelId, channel);

  io.emit('channel-opened', channel);

  res.json(channel);
});

// Open REAL Yellow Network session (demonstrates actual SDK integration)
app.post('/api/state-channels/open-real', async (req, res) => {
  const { leaderAddress, copierAddress, initialBalance } = req.body;

  if (!yellowConnected || !yellowService) {
    return res.status(503).json({
      error: 'Yellow Network not connected',
      fallback: 'Use /api/state-channels/open for mock channels'
    });
  }

  try {
    console.log('🔥 Creating REAL Yellow Network session...');
    console.log('   Leader:', leaderAddress);
    console.log('   Copier:', copierAddress);
    console.log('   Initial Balance:', initialBalance);

    // Create real Yellow Network session using SDK
    const session = await yellowService.createSession(
      leaderAddress,
      copierAddress,
      [BigInt(initialBalance || 50000), BigInt(initialBalance || 50000)]
    );

    console.log('✅ Real Yellow session created:', session.sessionId);

    // Convert to API format for frontend
    const channel = {
      channelId: session.channelId,
      leaderAddress,
      copierAddress,
      status: 'active',
      trades: 0,
      volume: 0,
      leaderBalance: Number(session.balances[0]),
      copierBalance: Number(session.balances[1]),
      openedAt: session.createdAt,
      lastUpdate: session.createdAt,
      nonce: Number(session.nonce),
      tradeHistory: [],
      isReal: true, // Real Yellow Network session
      yellowSessionId: session.sessionId,
    };

    // Store locally for dashboard queries
    stateChannels.set(channel.channelId, channel);

    io.emit('channel-opened', channel);

    res.json(channel);
  } catch (error: any) {
    console.error('❌ Failed to create Yellow session:', error);
    res.status(500).json({
      error: 'Failed to create Yellow Network session',
      message: error.message,
      fallback: 'Use /api/state-channels/open for mock channels'
    });
  }
});

app.post('/api/state-channels/:channelId/trade', (req, res) => {
  const { channelId } = req.params;
  const { asset, side, amount, price } = req.body;

  const channel = stateChannels.get(channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const tradeValue = amount * price;
  const pnl = side === 'BUY' ? tradeValue * 0.02 : tradeValue * -0.01; // Simulated P&L

  // Update channel state
  channel.trades++;
  channel.volume += tradeValue;
  channel.nonce++;
  channel.leaderBalance += pnl;
  channel.copierBalance -= pnl;
  channel.lastUpdate = Date.now();

  const trade = {
    id: channel.tradeHistory.length + 1,
    asset,
    side,
    amount,
    price,
    timestamp: Date.now()
  };

  channel.tradeHistory.push(trade);

  stateChannels.set(channelId, channel);

  io.emit('channel-updated', channel);

  res.json({ channel, trade });
});

app.post('/api/state-channels/:channelId/settle', (req, res) => {
  const { channelId } = req.params;

  const channel = stateChannels.get(channelId);
  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  channel.status = 'settling';
  channel.lastUpdate = Date.now();

  stateChannels.set(channelId, channel);

  // Simulate settlement delay
  setTimeout(() => {
    channel.status = 'closed';
    stateChannels.set(channelId, channel);
    io.emit('channel-settled', channel);
  }, 3000);

  io.emit('channel-settling', channel);

  res.json(channel);
});

// Initialize with some seed channels for demo
function initializeSeedChannels() {
  // Only add seed channels if none exist
  if (stateChannels.size === 0) {
    const seedChannels = [
      {
        channelId: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        leaderAddress: '',  // Will be set when first leader registers
        copierAddress: '0x899D9B792a2A4E1166D058D68d17DC0Df33666C7',
        status: 'active',
        trades: 47,
        volume: 125000,
        leaderBalance: 52000,
        copierBalance: 73000,
        openedAt: Date.now() - 3600000,
        lastUpdate: Date.now() - 300000,
        nonce: 47,
        tradeHistory: []
      },
      {
        channelId: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3',
        leaderAddress: '',
        copierAddress: '0x1234567890123456789012345678901234567890',
        status: 'active',
        trades: 23,
        volume: 68000,
        leaderBalance: 31000,
        copierBalance: 37000,
        openedAt: Date.now() - 7200000,
        lastUpdate: Date.now() - 120000,
        nonce: 23,
        tradeHistory: []
      }
    ];

    seedChannels.forEach(channel => {
      stateChannels.set(channel.channelId, channel);
    });

    console.log('✅ Initialized 2 seed state channels');
  }
}

// Stats endpoints
app.get('/api/stats/platform', (req, res) => {
  res.json({
    totalLeaders: leaders.length,
    totalCopiers: copiers.length,
    totalVolume: leaders.reduce((sum, l) => sum + parseFloat(l.totalVolume || '0'), 0),
    totalTrades: trades.length,
  });
});

app.get('/api/stats/leaderboard', (req, res) => {
  const sortedLeaders = [...leaders].sort((a, b) => b.roi - a.roi);
  res.json(sortedLeaders);
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('leave-room', (room) => {
    socket.leave(room);
    console.log(`Socket ${socket.id} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
// Initialize seed data
initializeSeedChannels();

httpServer.listen(PORT, () => {
  console.log('');
  console.log('🚀 Shadow API Server (Test Mode)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
  console.log(`🔌 WebSocket server ready`);
  console.log('');
  console.log('⚠️  Running in TEST MODE (Yellow Network disabled)');
  console.log('   Contract interactions will use on-chain data only');
  console.log('');
  console.log('📝 API Endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/leaders`);
  console.log(`   POST http://localhost:${PORT}/api/leaders/register`);
  console.log(`   GET  http://localhost:${PORT}/api/copiers/:address`);
  console.log(`   POST http://localhost:${PORT}/api/copiers/subscribe`);
  console.log('');
});
