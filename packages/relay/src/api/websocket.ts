/**
 * Shadow Relay WebSocket Server
 * Real-time updates for trades, risk alerts, and performance metrics
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { ReplicationService } from '../services/ReplicationService';
import { RiskManager } from '../services/RiskManager';
import { YellowService } from '../services/YellowService';

interface Services {
  replicationService: ReplicationService;
  riskManager: RiskManager;
  yellowService: YellowService;
}

interface ClientSubscription {
  type: 'leader' | 'copier' | 'observer';
  address?: string;
  leaders?: string[];
}

/**
 * Setup WebSocket server with real-time event broadcasting
 */
export function setupWebSocket(io: SocketIOServer, services: Services): void {
  const { replicationService, riskManager, yellowService } = services;
  const subscriptions = new Map<string, ClientSubscription>();

  // Connection handler
  io.on('connection', (socket: Socket) => {
    // Client subscription
    socket.on('subscribe', (data: ClientSubscription) => {
      subscriptions.set(socket.id, data);

      // Join rooms based on subscription type
      if (data.type === 'leader' && data.address) {
        socket.join(`leader:${data.address}`);
        socket.emit('subscribed', { type: 'leader', address: data.address });
      } else if (data.type === 'copier' && data.address) {
        socket.join(`copier:${data.address}`);
        socket.emit('subscribed', { type: 'copier', address: data.address });

        // Subscribe to leader rooms
        if (data.leaders) {
          data.leaders.forEach(leader => socket.join(`leader:${leader}:copiers`));
        }
      } else if (data.type === 'observer') {
        socket.join('observers');
        socket.emit('subscribed', { type: 'observer' });
      }
    });

    socket.on('unsubscribe', () => {
      const sub = subscriptions.get(socket.id);
      if (sub) {
        socket.rooms.forEach(room => {
          if (room !== socket.id) socket.leave(room);
        });
        subscriptions.delete(socket.id);
      }
    });

    socket.on('disconnect', () => {
      subscriptions.delete(socket.id);
    });
  });

  // ReplicationService Events

  // Leader registered
  replicationService.on('leader-registered', (session) => {
    io.to('observers').emit('leader-registered', {
      address: session.leaderAddress,
      ensName: session.ensName,
      timestamp: new Date().toISOString(),
    });
  });

  // Copier registered
  replicationService.on('copier-registered', (session) => {
    io.to(`leader:${session.leaderAddress}`).emit('copier-joined', {
      copierAddress: session.copierAddress,
      depositAmount: session.depositAmount.toString(),
      maxDrawdown: session.maxDrawdown,
      timestamp: new Date().toISOString(),
    });

    io.to(`copier:${session.copierAddress}`).emit('subscription-confirmed', {
      leaderAddress: session.leaderAddress,
      sessionId: session.sessionId,
      yellowChannelId: session.yellowChannelId,
      timestamp: new Date().toISOString(),
    });

    io.to('observers').emit('copier-registered', {
      copierAddress: session.copierAddress,
      leaderAddress: session.leaderAddress,
      depositAmount: session.depositAmount.toString(),
      maxDrawdown: session.maxDrawdown,
    });
  });

  // Trade replicated to copier
  replicationService.on('trade-replicated', (result) => {
    io.to(`copier:${result.copierAddress}`).emit('trade-executed', {
      tradeId: result.executedTrade?.tradeId,
      asset: result.executedTrade?.asset,
      action: result.executedTrade?.action,
      amount: result.executedTrade?.amount.toString(),
      price: result.executedTrade?.price.toString(),
      success: result.success,
      timestamp: new Date().toISOString(),
      riskCheck: result.riskCheck,
    });

    if (result.success && result.executedTrade) {
      const session = replicationService['copierSessions'].get(result.executedTrade.executorAddress);
      if (session && session[0]) {
        io.to(`leader:${session[0].leaderAddress}:copiers`).emit('trade-replicated', {
          copierAddress: result.copierAddress,
          tradeId: result.executedTrade.tradeId,
          asset: result.executedTrade.asset,
          amount: result.executedTrade.amount.toString(),
        });
      }
    }
  });

  // Replication complete
  replicationService.on('replication-complete', (data) => {
    io.to(`leader:${data.leaderAddress}`).emit('trade-broadcast-complete', {
      tradeId: data.trade.tradeId,
      asset: data.trade.asset,
      successCount: data.results.filter((r: any) => r.success).length,
      failureCount: data.results.filter((r: any) => !r.success).length,
      totalCopiers: data.results.length,
      timestamp: new Date().toISOString(),
    });
  });

  // Copier unsubscribed
  replicationService.on('copier-unsubscribed', (data) => {
    io.to(`copier:${data.copierAddress}`).emit('unsubscribed', {
      leaderAddress: data.leaderAddress,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    });

    io.to(`leader:${data.leaderAddress}`).emit('copier-left', {
      copierAddress: data.copierAddress,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    });
  });

  // RiskManager Events

  // Max drawdown breached
  riskManager.on('max-drawdown-breached', (data) => {
    io.to(`copier:${data.copierAddress}`).emit('risk-alert', {
      type: 'max-drawdown-breached',
      severity: 'critical',
      sessionId: data.sessionId,
      currentDrawdown: data.currentDrawdown,
      maxDrawdown: data.maxDrawdown,
      message: `Max drawdown reached: ${data.currentDrawdown.toFixed(1)}% / ${data.maxDrawdown}%`,
      timestamp: new Date().toISOString(),
    });
  });
}
