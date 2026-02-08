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
  // State signing and hashing
  getChannelId as sdkGetChannelId,
  getStateHash,
  getPackedState,
  verifySignature,
  // RPC message builders
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,
  createGetAppSessionsMessage,
  // Signer classes
  SessionKeyStateSigner,
  // Types
  type Channel,
  type UnsignedState,
  type State,
  type StateIntent,
  type ChannelId,
  type Allocation,
} from '@erc7824/nitrolite';

/**
 * Calculate channel ID using Yellow SDK
 */
function calculateChannelId(participants: string[], chainId: number, adjudicator: string): string {
  const channel: Channel = {
    participants: participants as `0x${string}`[],
    adjudicator: adjudicator as `0x${string}`,
    challenge: BigInt(0),
    nonce: BigInt(Math.floor(Math.random() * 1000000)),
  };
  return sdkGetChannelId(channel, chainId);
}

/**
 * Sign state using Yellow SDK's proper state signing
 */
async function signState(
  signer: ethers.Signer,
  channelId: string,
  state: UnsignedState
): Promise<string> {
  // Get the state hash using Yellow SDK
  const stateHash = getStateHash(channelId as `0x${string}`, state);

  // Sign the state hash with the signer
  const signature = await signer.signMessage(ethers.getBytes(stateHash));

  return signature;
}

/**
 * Create state update message using Yellow SDK
 */
function createStateUpdateMessage(
  channelId: string,
  state: UnsignedState,
  signature: string
): State {
  // Return properly formatted State object with signature
  return {
    ...state,
    sigs: [signature as `0x${string}`],
  };
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

    // Convert balances to allocations (Yellow SDK format)
    const allocations: Allocation[] = [
      {
        destination: session.participants[0] as `0x${string}`,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`, // ETH
        amount: newBalances[0],
      },
      {
        destination: session.participants[1] as `0x${string}`,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`, // ETH
        amount: newBalances[1],
      },
    ];

    // Create unsigned state using Yellow SDK format
    const unsignedState: UnsignedState = {
      intent: 0 as StateIntent, // OPERATE
      version: BigInt(newNonce),
      data: ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(appData))) as `0x${string}`,
      allocations,
    };

    // Sign the state using Yellow SDK
    const signature = await signState(this.signer, sessionId, unsignedState);

    // Create signed state message
    const signedState = createStateUpdateMessage(sessionId, unsignedState, signature);

    // Calculate state hash for tracking
    const stateHash = getStateHash(sessionId as `0x${string}`, unsignedState);

    // Send to Yellow Network using SDK message builder
    await this.sendRPC(YellowMessageType.UPDATE_STATE, signedState);

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

    // Create final allocations
    const allocations: Allocation[] = [
      {
        destination: session.participants[0] as `0x${string}`,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        amount: finalBalances[0],
      },
      {
        destination: session.participants[1] as `0x${string}`,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        amount: finalBalances[1],
      },
    ];

    // Create final unsigned state
    const finalUnsignedState: UnsignedState = {
      intent: 3 as StateIntent, // FINALIZE
      version: BigInt(finalNonce),
      data: ethers.hexlify(ethers.toUtf8Bytes('final')) as `0x${string}`,
      allocations,
    };

    // Create final state hash
    const finalStateHash = getStateHash(sessionId as `0x${string}`, finalUnsignedState);

    // Create close session message using Yellow SDK
    // Note: In production, you'd use createCloseAppSessionMessage from the SDK
    // For now, send raw close message
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
