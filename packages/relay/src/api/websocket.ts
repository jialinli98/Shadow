/**
 * WebSocket API for Shadow copy trading platform
 * Provides real-time updates via Socket.IO
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { ShadowRelay } from '../ShadowRelay';
import { SettlementService } from '../services/SettlementService';
import { OracleService } from '../services/OracleService';
import { MockMarketMaker } from '../services/MockMarketMaker';

/**
 * Setup WebSocket event handlers
 */
export function setupWebSocket(
  io: SocketIOServer,
  shadowRelay: ShadowRelay,
  settlementService: SettlementService,
  oracle: OracleService,
  marketMaker: MockMarketMaker
): void {
  console.log('🔌 Setting up WebSocket handlers...');

  // ============================================================================
  // SHADOW RELAY EVENTS
  // ============================================================================

  // Leader registered
  shadowRelay.on('leader-registered', (data) => {
    console.log('📢 Broadcasting: leader-registered');
    io.emit('leader-registered', {
      type: 'leader-registered',
      data: {
        leaderAddress: data.leaderAddress,
        ensName: data.ensName,
        timestamp: Date.now(),
      },
    });
  });

  // Session opened
  shadowRelay.on('session-opened', (data) => {
    console.log('📢 Broadcasting: session-opened');
    io.emit('session-opened', {
      type: 'session-opened',
      data: {
        userAddress: data.userAddress,
        yellowChannelId: data.yellowChannelId,
        collateral: data.collateral.toString(),
        timestamp: data.openedAt,
      },
    });
  });

  // Copier subscribed
  shadowRelay.on('copier-subscribed', (data) => {
    console.log('📢 Broadcasting: copier-subscribed');
    io.emit('copier-subscribed', {
      type: 'copier-subscribed',
      data: {
        copierAddress: data.copierAddress,
        leaderAddress: data.leaderAddress,
        performanceFeeRate: data.performanceFeeRate,
        maxDrawdown: data.maxDrawdown,
        timestamp: Date.now(),
      },
    });

    // Also emit to leader's room
    io.to(`leader-${data.leaderAddress}`).emit('new-copier', {
      type: 'new-copier',
      data: {
        copierAddress: data.copierAddress,
        timestamp: Date.now(),
      },
    });
  });

  // Trade replicated
  shadowRelay.on('trade-replicated', (data) => {
    console.log('📢 Broadcasting: trade-replicated');
    io.emit('trade-replicated', {
      type: 'trade-replicated',
      data: {
        leader: data.leader,
        trade: {
          action: data.trade.action,
          asset: data.trade.asset,
          amount: data.trade.amount.toString(),
          price: data.trade.price.toString(),
        },
        copierCount: data.copierCount,
        timestamp: Date.now(),
      },
    });

    // Emit to leader's room
    io.to(`leader-${data.leader}`).emit('trade-confirmed', {
      type: 'trade-confirmed',
      data: {
        trade: data.trade,
        copierCount: data.copierCount,
        timestamp: Date.now(),
      },
    });
  });

  // Replication error
  shadowRelay.on('replication-error', (data) => {
    console.log('📢 Broadcasting: replication-error');
    io.emit('replication-error', {
      type: 'replication-error',
      data: {
        copier: data.copier,
        error: data.error.message || String(data.error),
        timestamp: Date.now(),
      },
    });
  });

  // Drawdown breach
  shadowRelay.on('drawdown-breach', (data) => {
    console.log('📢 Broadcasting: drawdown-breach');
    io.emit('drawdown-breach', {
      type: 'drawdown-breach',
      data: {
        copierAddress: data.copierAddress,
        leaderAddress: data.leaderAddress,
        currentDrawdown: data.currentDrawdown || 0,
        maxDrawdown: data.maxDrawdown,
        timestamp: Date.now(),
      },
    });

    // Emit to copier's room
    io.to(`copier-${data.copierAddress}`).emit('drawdown-alert', {
      type: 'drawdown-alert',
      data: {
        currentDrawdown: data.currentDrawdown,
        maxDrawdown: data.maxDrawdown,
        timestamp: Date.now(),
      },
    });
  });

  // ============================================================================
  // SETTLEMENT EVENTS
  // ============================================================================

  settlementService.on('settlement-completed', (data) => {
    console.log('📢 Broadcasting: settlement-completed');
    io.emit('settlement-completed', {
      type: 'settlement-completed',
      data: {
        settlementId: data.settlementId,
        txHash: data.txHash,
        copierPayout: data.copierPayout.toString(),
        leaderFee: data.leaderFee.toString(),
        finalBalance: data.finalBalance.toString(),
        timestamp: Date.now(),
      },
    });
  });

  // ============================================================================
  // ORACLE EVENTS
  // ============================================================================

  oracle.on('price-update', (priceData) => {
    // Price updates are frequent, so we broadcast them
    io.emit('price-update', {
      type: 'price-update',
      data: {
        asset: priceData.asset,
        price: priceData.price.toString(),
        formatted: oracle.formatPrice(priceData.price),
        timestamp: priceData.timestamp,
      },
    });
  });

  // ============================================================================
  // MARKET MAKER EVENTS
  // ============================================================================

  marketMaker.on('trade-executed', (trade) => {
    io.emit('mm-trade', {
      type: 'mm-trade',
      data: {
        tradeId: trade.tradeId,
        asset: trade.asset,
        side: trade.side,
        mmSide: trade.mmSide,
        amount: trade.amount.toString(),
        price: trade.price.toString(),
        timestamp: trade.timestamp,
      },
    });
  });

  // ============================================================================
  // CLIENT CONNECTION HANDLING
  // ============================================================================

  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Send current state on connection
    socket.emit('connection-established', {
      type: 'connection-established',
      data: {
        socketId: socket.id,
        timestamp: Date.now(),
      },
    });

    // Subscribe to leader updates
    socket.on('subscribe-leader', (leaderAddress: string) => {
      if (!leaderAddress) {
        socket.emit('error', { message: 'Invalid leader address' });
        return;
      }

      socket.join(`leader-${leaderAddress}`);
      console.log(`🔔 Client ${socket.id} subscribed to leader: ${leaderAddress}`);

      socket.emit('subscribed', {
        type: 'subscribed',
        data: { leaderAddress, timestamp: Date.now() },
      });
    });

    // Unsubscribe from leader updates
    socket.on('unsubscribe-leader', (leaderAddress: string) => {
      socket.leave(`leader-${leaderAddress}`);
      console.log(`🔕 Client ${socket.id} unsubscribed from leader: ${leaderAddress}`);

      socket.emit('unsubscribed', {
        type: 'unsubscribed',
        data: { leaderAddress, timestamp: Date.now() },
      });
    });

    // Subscribe to copier updates
    socket.on('subscribe-copier', (copierAddress: string) => {
      if (!copierAddress) {
        socket.emit('error', { message: 'Invalid copier address' });
        return;
      }

      socket.join(`copier-${copierAddress}`);
      console.log(`🔔 Client ${socket.id} subscribed to copier: ${copierAddress}`);

      socket.emit('subscribed', {
        type: 'subscribed',
        data: { copierAddress, timestamp: Date.now() },
      });
    });

    // Unsubscribe from copier updates
    socket.on('unsubscribe-copier', (copierAddress: string) => {
      socket.leave(`copier-${copierAddress}`);
      console.log(`🔕 Client ${socket.id} unsubscribed from copier: ${copierAddress}`);

      socket.emit('unsubscribed', {
        type: 'unsubscribed',
        data: { copierAddress, timestamp: Date.now() },
      });
    });

    // Subscribe to price updates for specific asset
    socket.on('subscribe-price', (asset: string) => {
      if (!asset) {
        socket.emit('error', { message: 'Invalid asset' });
        return;
      }

      socket.join(`price-${asset}`);
      console.log(`🔔 Client ${socket.id} subscribed to price: ${asset}`);

      // Send current price immediately
      oracle.getPriceData(asset).then((priceData) => {
        socket.emit('price-update', {
          type: 'price-update',
          data: {
            asset: priceData.asset,
            price: priceData.price.toString(),
            formatted: oracle.formatPrice(priceData.price),
            timestamp: priceData.timestamp,
          },
        });
      }).catch(() => {
        socket.emit('error', { message: `Price not available for ${asset}` });
      });
    });

    // Unsubscribe from price updates
    socket.on('unsubscribe-price', (asset: string) => {
      socket.leave(`price-${asset}`);
      console.log(`🔕 Client ${socket.id} unsubscribed from price: ${asset}`);
    });

    // Request current stats
    socket.on('get-stats', async () => {
      try {
        const sessions = shadowRelay.getAllSessions();
        const mmStats = await marketMaker.getStats();

        socket.emit('stats', {
          type: 'stats',
          data: {
            activeSessions: sessions.length,
            marketMaker: mmStats,
            timestamp: Date.now(),
          },
        });
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`⚠️  Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ WebSocket handlers ready');
}
