/**
 * YellowService - Integration with Yellow Network (ERC-7824)
 * Handles state channel creation, management, and trading operations
 */

import WebSocket from 'ws';
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import {
  YellowAppSession,
  YellowStateUpdate,
  YellowMessageType,
  YellowRPCMessage,
  YellowRPCResponse,
  TradeIntent,
} from '../types';

// Import Yellow Network SDK
import {
  createAppSessionMessage,
  parseAnyRPCResponse as parseRPCResponse,
  // Note: Some functions may not be exported, using fallback implementations
} from '@erc7824/nitrolite';

// Fallback implementations for missing exports
function calculateChannelId(participants: string[], chainId: number, adjudicator: string): string {
  // Simple channel ID calculation (use actual implementation from SDK when available)
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address[]', 'uint256', 'address'],
      [participants, chainId, adjudicator]
    )
  );
}

function signState(signer: ethers.Signer, ...args: any[]): Promise<string> {
  // Placeholder - implement actual signing logic
  // Takes signer and variable number of state parameters
  return Promise.resolve('0x');
}

function createStateUpdateMessage(params: any): any {
  // Placeholder - implement actual state update message creation
  return params;
}

/**
 * Yellow Network Service Configuration
 */
interface YellowServiceConfig {
  wsUrl: string; // Yellow Network WebSocket endpoint
  chainId: number;
  adjudicatorAddress: string;
  provider: ethers.Provider;
  signerPrivateKey: string; // Relay service signer
}

/**
 * YellowService manages all interactions with Yellow Network
 */
export class YellowService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: YellowServiceConfig;
  private signer: ethers.Wallet;
  private activeSessions: Map<string, YellowAppSession> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(config: YellowServiceConfig) {
    super();
    this.config = config;
    this.signer = new ethers.Wallet(config.signerPrivateKey, config.provider);
  }

  /**
   * Connect to Yellow Network
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('error', (error) => {
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.emit('disconnected');
          this.attemptReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to Yellow Network
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('max-reconnect-attempts');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect().catch(() => {});
    }, this.reconnectDelay);
  }

  /**
   * Handle incoming messages from Yellow Network
   */
  private handleMessage(data: string): void {
    try {
      const response = parseRPCResponse(data) as unknown as YellowRPCResponse;

      // Handle pending request responses
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
        this.pendingRequests.delete(response.id);
        return;
      }

      // Handle unsolicited messages (events, state updates)
      this.emit('message', response);
    } catch {}
  }

  private async sendRPC(method: YellowMessageType, params: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: YellowRPCMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(message));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Create a new app session (state channel) for leader-copier pair
   */
  async createSession(
    leaderAddress: string,
    copierAddress: string,
    initialDeposits: [bigint, bigint]
  ): Promise<YellowAppSession> {
    const participants = [leaderAddress, copierAddress];

    // Calculate channel ID using Yellow SDK
    const channelId = calculateChannelId(participants, this.config.chainId, this.config.adjudicatorAddress);

    // Create app session message
    const sessionMessage = (createAppSessionMessage as any)({
      participants,
      chainId: this.config.chainId,
      adjudicator: this.config.adjudicatorAddress,
      initialBalances: initialDeposits.map((d) => d.toString()),
      appData: ethers.toUtf8Bytes(JSON.stringify({
        type: 'shadow-copy-trading',
        leader: leaderAddress,
        copier: copierAddress,
      })),
    });

    // Send to Yellow Network
    await this.sendRPC(YellowMessageType.CREATE_SESSION, sessionMessage);

    const session: YellowAppSession = {
      sessionId: channelId,
      channelId,
      participants,
      nonce: 0,
      balances: initialDeposits,
      isActive: true,
      createdAt: Date.now(),
    };

    this.activeSessions.set(channelId, session);
    this.emit('session-created', session);

    return session;
  }

  /**
   * Execute a trade in a Yellow state channel
   */
  async executeTrade(
    sessionId: string,
    trade: TradeIntent,
    newBalances: [bigint, bigint]
  ): Promise<YellowStateUpdate> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    // Increment nonce for new state
    const newNonce = session.nonce + 1;

    // Create state update with trade data
    const appData = {
      type: 'trade',
      tradeId: trade.tradeId,
      action: trade.action,
      asset: trade.asset,
      amount: trade.amount.toString(),
      price: trade.price.toString(),
      timestamp: trade.timestamp,
    };

    // Calculate new state hash
    const stateHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256[]', 'bytes'],
        [newNonce, newBalances.map((b) => b.toString()), ethers.toUtf8Bytes(JSON.stringify(appData))]
      )
    );

    // Sign the state update
    const signature = await signState(this.signer, sessionId, newNonce, stateHash);

    // Create state update message
    const stateUpdateMessage = createStateUpdateMessage({
      channelId: sessionId,
      nonce: newNonce,
      balances: newBalances.map((b) => b.toString()),
      appData: ethers.toUtf8Bytes(JSON.stringify(appData)),
      signature,
    });

    // Send to Yellow Network
    await this.sendRPC(YellowMessageType.UPDATE_STATE, stateUpdateMessage);

    // Update local session state
    session.nonce = newNonce;
    session.balances = newBalances;

    const stateUpdate: YellowStateUpdate = {
      sessionId,
      nonce: newNonce,
      stateHash,
      balances: newBalances,
      signatures: [signature],
      timestamp: Date.now(),
    };

    this.emit('state-updated', stateUpdate);

    return stateUpdate;
  }

  /**
   * Close a Yellow state channel and settle on-chain
   */
  async closeSession(
    sessionId: string,
    finalBalances: [bigint, bigint],
    signatures: [string, string]
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const finalNonce = session.nonce + 1;

    // Create final state hash
    const finalStateHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256[]', 'bytes'],
        [finalNonce, finalBalances.map((b) => b.toString()), ethers.toUtf8Bytes('final')]
      )
    );

    // Send close message to Yellow Network
    await this.sendRPC(YellowMessageType.CLOSE_SESSION, {
      channelId: sessionId,
      finalNonce,
      finalBalances: finalBalances.map((b) => b.toString()),
      finalStateHash,
      signatures,
    });

    // Mark session as inactive
    session.isActive = false;
    this.activeSessions.delete(sessionId);

    this.emit('session-closed', sessionId);
  }

  /**
   * Get active session by ID
   */
  getSession(sessionId: string): YellowAppSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): YellowAppSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get sessions for a specific participant
   */
  getSessionsForParticipant(address: string): YellowAppSession[] {
    return Array.from(this.activeSessions.values()).filter((session) =>
      session.participants.includes(address)
    );
  }

  /**
   * Disconnect from Yellow Network
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.activeSessions.clear();
    this.pendingRequests.clear();
  }

  /**
   * Check if connected to Yellow Network
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
