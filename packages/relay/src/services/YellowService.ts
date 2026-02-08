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
  createCreateChannelMessage,
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  // Signer helpers
  createECDSAMessageSigner,
  // Signer classes
  SessionKeyStateSigner,
  // Types
  type Channel,
  type UnsignedState,
  type State,
  type StateIntent,
  type ChannelId,
  type Allocation,
  type MessageSigner,
  type AuthChallengeResponse,
  RPCMethod,
} from '@erc7824/nitrolite';

// Import viem for EIP-712 signing
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

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
/**
 * Generate a random session key
 */
function generateSessionKey(): { address: `0x${string}`; privateKey: `0x${string}` } {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address as `0x${string}`,
    privateKey: wallet.privateKey as `0x${string}`,
  };
}

export class YellowService extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: YellowServiceConfig;
  private signer: ethers.Wallet;
  private messageSigner: MessageSigner;
  private sessionKey: { address: `0x${string}`; privateKey: `0x${string}` };
  private sessionSigner: MessageSigner;
  private walletClient: any; // viem WalletClient
  private isAuthenticated = false;
  private authPending = false;
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

    // Create MessageSigner for Yellow Network SDK using private key
    // Ensure private key has 0x prefix
    const privateKey = config.signerPrivateKey.startsWith('0x')
      ? config.signerPrivateKey
      : `0x${config.signerPrivateKey}`;
    this.messageSigner = createECDSAMessageSigner(privateKey as `0x${string}`);

    // Generate session key for Yellow Network authentication
    this.sessionKey = generateSessionKey();
    this.sessionSigner = createECDSAMessageSigner(this.sessionKey.privateKey);

    // Create viem wallet client for EIP-712 signing (needed for auth)
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    this.walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });
  }

  /**
   * Connect to Yellow Network
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.on('open', async () => {
          this.reconnectAttempts = 0;
          this.emit('connected');

          // Start authentication flow
          await this.authenticate();

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
          this.isAuthenticated = false;
          this.emit('disconnected');
          this.attemptReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Authenticate with Yellow Network
   */
  private async authenticate(): Promise<void> {
    if (this.authPending) return;

    this.authPending = true;
    console.log('🔐 Starting Yellow Network authentication...');

    try {
      const sessionExpireTimestamp = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      // Match working example exactly, but use empty allowances for sandbox
      const authMessage = await createAuthRequestMessage({
        address: this.signer.address as `0x${string}`,
        session_key: this.sessionKey.address,
        application: 'Shadow Trading',  // Use display name like working example
        allowances: [],  // Try empty allowances for sandbox
        expires_at: sessionExpireTimestamp,
        scope: 'shadow.app',  // Match working example pattern
      });

      console.log('📤 Sending auth request...');
      console.log('   Wallet:', this.signer.address);
      console.log('   Session Key:', this.sessionKey.address);
      this.ws!.send(authMessage);
    } catch (error) {
      console.error('❌ Authentication error:', error);
      this.authPending = false;
    }
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
  private async handleMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);
      console.log('📨 Yellow Network message:', message);

      // Yellow Network format: { res: [reqId, method, params, timestamp], sig: [...] }
      if (message.res && Array.isArray(message.res)) {
        const [reqId, method, params, timestamp] = message.res;

        // Convert to standard format for all handlers
        const standardMessage = {
          id: reqId,
          method,
          params,
          timestamp,
          sig: message.sig,
        };

        switch (method) {
          case 'auth_challenge':
            // Convert Yellow's format to SDK's expected format
            const authChallengeMessage = {
              id: reqId,
              method: RPCMethod.AuthChallenge,
              params: {
                challengeMessage: params.challenge_message, // Convert snake_case to camelCase
              },
              timestamp,
              sig: message.sig,
            };
            await this.handleAuthChallenge(authChallengeMessage as AuthChallengeResponse);
            return;

          case 'auth_verify':
            await this.handleAuthVerify(standardMessage);
            return;

          case 'assets':
            console.log('📋 Available assets on Yellow Network:', params.assets);
            if (params.assets && params.assets.length > 0) {
              console.log('   First asset:', params.assets[0]);
            }
            this.emit('assets', params.assets);
            return;

          case 'error':
            console.error('❌ Yellow Network error:', params);
            this.emit('error', standardMessage);
            return;

          case 'session_created':
          case 'create_app_session':
            // Handle session creation responses
            this.emit('message', standardMessage);
            return;

          default:
            console.log(`📝 Unhandled Yellow method: ${method}`);
            this.emit('message', standardMessage);
            break;
        }
        return;
      }

      // Handle RPC method-based responses (standard format)
      if (message.method) {
        switch (message.method) {
          case RPCMethod.AuthChallenge:
            await this.handleAuthChallenge(message as AuthChallengeResponse);
            return;

          case RPCMethod.AuthVerify:
            await this.handleAuthVerify(message);
            return;

          default:
            // Handle other method-based messages
            break;
        }
      }

      // Try parsing as RPC response for backwards compatibility
      const response = message as YellowRPCResponse;

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
    } catch (error) {
      console.error('❌ Failed to handle Yellow Network message:', error);
    }
  }

  /**
   * Handle authentication challenge from Yellow Network
   */
  private async handleAuthChallenge(challenge: AuthChallengeResponse): Promise<void> {
    console.log('🔐 Received auth challenge:', challenge.params.challengeMessage);

    try {
      const sessionExpireTimestamp = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

      // CRITICAL: Match working example - use wallet.address as application in challenge response!
      const authParams = {
        scope: 'shadow.app',  // Match request scope
        application: this.signer.address,  // Use WALLET ADDRESS (not app name) - this is key!
        participant: this.sessionKey.address,  // Session key as participant
        expire: sessionExpireTimestamp,
        allowances: [],  // Empty for sandbox
        session_key: this.sessionKey.address,
        expires_at: sessionExpireTimestamp,
      };

      console.log('📝 Creating EIP-712 signer with params:', {
        scope: authParams.scope,
        application: authParams.application,
        participant: authParams.participant,
        allowances: authParams.allowances,
      });

      const eip712Signer = createEIP712AuthMessageSigner(
        this.walletClient,
        authParams,
        { name: 'Shadow Trading' }  // EIP-712 domain name
      );

      console.log('📝 Signing auth challenge with EIP-712...');

      const authVerifyMessage = await createAuthVerifyMessage(eip712Signer, challenge);

      console.log('📤 Sending auth verification...');
      this.ws!.send(authVerifyMessage);
    } catch (error) {
      console.error('❌ Auth challenge handling failed:', error);
      this.authPending = false;
    }
  }

  /**
   * Handle authentication verification response
   */
  private async handleAuthVerify(message: any): Promise<void> {
    this.authPending = false;

    if (message.params?.success) {
      console.log('✅ Yellow Network authentication successful!');
      this.isAuthenticated = true;
      this.emit('authenticated');
    } else {
      console.error('❌ Yellow Network authentication failed:', message.params);
      this.isAuthenticated = false;
    }
  }

  private async sendRPC(method: YellowMessageType, params: unknown): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Yellow Network');
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message: YellowRPCMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      // Use custom replacer to handle BigInt serialization
      this.ws!.send(JSON.stringify(message, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Create basic channel as fallback when app sessions not supported
   */
  private async createBasicChannelFallback(
    userAddress: string,
    marketMakerAddress: string,
    initialDeposits: [bigint, bigint]
  ): Promise<YellowAppSession> {
    const YELLOW_TEST_TOKEN = '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb';

    const channelMessage = await createCreateChannelMessage(this.sessionSigner, {
      chain_id: this.config.chainId,
      token: YELLOW_TEST_TOKEN as `0x${string}`,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Basic channel creation timeout'));
      }, 30000);

      const handler = (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.res && Array.isArray(message.res)) {
            const [reqId, method, params] = message.res;

            if (method === 'create_channel' || method === 'channel') {
              console.log('✅ Basic channel created (with app state tracking)');
              clearTimeout(timeout);
              this.ws!.removeListener('message', handler);

              const channelId = params.channelId || params.channel_id || `channel-${Date.now()}`;
              const session: YellowAppSession = {
                sessionId: channelId,
                channelId: channelId,
                participants: [userAddress, marketMakerAddress],
                nonce: 0,
                balances: initialDeposits,
                isActive: true,
                createdAt: Date.now(),
                isAppSession: false, // Basic channel, not app session
              };

              this.activeSessions.set(channelId, session);
              this.emit('session-created', session);
              resolve(session);
            } else if (method === 'error') {
              clearTimeout(timeout);
              this.ws!.removeListener('message', handler);
              reject(new Error(params.error || 'Basic channel creation failed'));
            }
          }
        } catch (err) {
          // Ignore
        }
      };

      this.ws!.on('message', handler);
      console.log('📤 Creating basic channel...');
      this.ws!.send(channelMessage);
    });
  }

  /**
   * Create a new app session (state channel) between user and market maker
   *
   * IMPORTANT: In Shadow's architecture:
   * - Leader creates channel: Leader ↔ Market Maker
   * - Copier creates channel: Copier ↔ Market Maker
   * - NOT: Leader ↔ Copier (that would be wrong!)
   */
  async createSession(
    userAddress: string,
    marketMakerAddress: string,
    initialDeposits: [bigint, bigint]
  ): Promise<YellowAppSession> {
    // Wait for authentication if pending
    if (!this.isAuthenticated) {
      console.log('⏳ Waiting for Yellow Network authentication...');

      // Wait up to 30 seconds for authentication
      const maxWait = 30000;
      const startTime = Date.now();

      while (!this.isAuthenticated && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!this.isAuthenticated) {
        throw new Error('Yellow Network authentication required but not completed');
      }
    }

    console.log('✅ Yellow Network authenticated, creating app session...');

    const participants = [userAddress, marketMakerAddress];

    // Calculate channel ID
    const channelId = calculateChannelId(
      participants,
      this.config.chainId,
      this.config.adjudicatorAddress
    );

    console.log('🔧 Creating Nitro app session for Shadow copy trading...');
    console.log('   Channel ID:', channelId);
    console.log('   Participants:', participants);
    console.log('   Adjudicator:', this.config.adjudicatorAddress);

    // Create app session using Nitro protocol
    // This creates a state channel that can handle custom app logic
    const sessionMessage = await createAppSessionMessage(this.sessionSigner, {
      participants: participants as [`0x${string}`, `0x${string}`],
      chainId: this.config.chainId,
      adjudicator: this.config.adjudicatorAddress as `0x${string}`,
      challenge: 3600, // 1 hour challenge period
      nonce: Date.now(),
      // App definition for custom Shadow trading logic
      appDefinition: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      appData: ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify({
        type: 'shadow-copy-trading',
        protocol: 'nitro-v1', // Specify Nitro protocol
        user: userAddress,
        marketMaker: marketMakerAddress,
        initialDeposits: initialDeposits.map(d => d.toString()),
        version: '1.0.0',
      }))) as `0x${string}`,
    });

    // Send directly via WebSocket
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('❌ Yellow Network channel creation timed out after 30s');
        reject(new Error('Channel creation timeout'));
      }, 30000);

      // Set up one-time listener for channel creation response
      const handler = (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 Received message during channel creation:', JSON.stringify(message, null, 2));

          // Yellow Network format: { res: [reqId, method, params, timestamp], sig: [...] }
          if (message.res && Array.isArray(message.res)) {
            const [reqId, method, params] = message.res;

            // Check for "unsupported protocol" error first - trigger fallback to basic channel
            if (method === 'error' && params.error && params.error.includes('unsupported protocol')) {
              console.log('⚠️  App sessions not supported by this Yellow Network instance');
              console.log('🔄 Falling back to basic channel with local app state tracking...');
              clearTimeout(timeout);
              this.ws!.removeListener('message', handler);

              // Create basic channel instead
              this.createBasicChannelFallback(userAddress, marketMakerAddress, initialDeposits)
                .then(resolve)
                .catch(reject);
              return; // Exit handler
            }

            // Handle successful app session creation
            if (method === 'create_app_session' || method === 'app_session' || method === 'session') {
              console.log('✅ App session created!');
              clearTimeout(timeout);
              this.ws!.removeListener('message', handler);

              const sessionId = params.sessionId || params.session_id || params.channelId || params.channel_id || channelId;
              const session: YellowAppSession = {
                sessionId: sessionId,
                channelId: sessionId,
                participants: [userAddress, marketMakerAddress],
                nonce: 0,
                balances: initialDeposits,
                isActive: true,
                createdAt: Date.now(),
                isAppSession: true, // Real app session
              };

              this.activeSessions.set(sessionId, session);
              this.emit('session-created', session);

              resolve(session);
            } else if (method === 'error') {
              // Other errors
              console.error('❌ Yellow Network error:', params);
              clearTimeout(timeout);
              this.ws!.removeListener('message', handler);
              reject(new Error(params.error || 'App session creation failed'));
            }
          }
        } catch (err) {
          console.log('⚠️  Failed to parse Yellow Network message:', err);
        }
      };

      this.ws!.on('message', handler);
      console.log('📤 Sending app session creation message to Yellow Network...');
      this.ws!.send(sessionMessage);
    });
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
    // SDK expects number, not BigInt
    const allocations: Allocation[] = [
      {
        destination: session.participants[0] as `0x${string}`,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`, // ETH
        amount: Number(newBalances[0]), // Convert BigInt to number
      },
      {
        destination: session.participants[1] as `0x${string}`,
        token: '0x0000000000000000000000000000000000000000' as `0x${string}`, // ETH
        amount: Number(newBalances[1]), // Convert BigInt to number
      },
    ];

    // Create unsigned state using Yellow SDK format
    const unsignedState: UnsignedState = {
      intent: 0 as StateIntent, // OPERATE
      version: Number(newNonce), // Convert to number for SDK
      data: ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(appData))) as `0x${string}`,
      allocations,
    };

    // Sign the state using Yellow SDK
    const signature = await signState(this.signer, sessionId, unsignedState);

    // Create signed state with signature
    const signedState: State = {
      ...unsignedState,
      sigs: [signature as `0x${string}`],
    };

    // Calculate state hash for tracking
    const stateHash = getStateHash(sessionId as `0x${string}`, unsignedState);

    // Send app state update ONLY if this is a real app session
    // Basic channels track state locally
    if (session.isAppSession) {
      console.log('📤 Sending app state update to Yellow Network...');
      console.log('   Session:', sessionId);
      console.log('   Nonce:', newNonce);
      console.log('   New balances:', newBalances.map(b => b.toString()));

      try {
        const stateUpdateMessage = await createSubmitAppStateMessage(
          this.sessionSigner,
          sessionId as `0x${string}`,
          signedState
        );
        this.ws!.send(stateUpdateMessage);
        console.log('✅ App state update sent to Yellow Network');
      } catch (error) {
        console.warn('⚠️  Failed to send state update to Yellow Network:', error);
        console.log('   State tracked locally, will sync on settlement');
      }
    } else {
      console.log('✅ Trade executed - state tracked locally (basic channel)');
      console.log('   Session:', sessionId);
      console.log('   Nonce:', newNonce);
      console.log('   New balances:', newBalances.map(b => b.toString()));
    }

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
