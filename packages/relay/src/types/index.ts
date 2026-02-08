/**
 * Type definitions for Shadow relay service
 * Integrates with Yellow Network (ERC-7824), ENS, and Uniswap v4
 */

// ============================================================================
// Yellow Network Types
// ============================================================================

/**
 * Yellow Network app session for leader-copier pairs
 */
export interface YellowAppSession {
  sessionId: string; // Yellow state channel ID
  channelId: string; // Unique identifier
  participants: string[]; // [leader, copier]
  nonce: number; // Current state nonce
  balances: bigint[]; // Current balances in the channel
  isActive: boolean;
  createdAt: number;
  isAppSession?: boolean; // true if full app session, false if basic channel
}

/**
 * Yellow Network state update
 */
export interface YellowStateUpdate {
  sessionId: string;
  nonce: number;
  stateHash: string;
  balances: bigint[];
  signatures: string[];
  timestamp: number;
}

/**
 * Yellow WebSocket message types
 */
export enum YellowMessageType {
  CREATE_SESSION = 'create_session',
  UPDATE_STATE = 'update_state',
  CLOSE_SESSION = 'close_session',
  CHALLENGE = 'challenge',
  SETTLE = 'settle',
}

/**
 * Yellow RPC message
 */
export interface YellowRPCMessage {
  id: string;
  method: YellowMessageType;
  params: unknown;
}

/**
 * Yellow RPC response
 */
export interface YellowRPCResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// ============================================================================
// Shadow Session Types
// ============================================================================

/**
 * Leader trading session
 */
export interface LeaderSession {
  sessionId: string;
  leaderAddress: string;
  ensName: string; // ENS name from registry
  yellowChannelId: string; // Yellow Network channel ID
  isActive: boolean;
  copiers: string[]; // Array of copier addresses
  totalCopiers: number; // Total copiers ever (including inactive)
  totalVolumeReplicated: bigint; // Total volume replicated
  totalFeesEarned: bigint; // Total fees earned
  registeredAt: number; // Registration timestamp
}

/**
 * Copier session following a leader
 */
export interface CopierSession {
  sessionId: string;
  copierAddress: string;
  leaderAddress: string;
  depositAmount: bigint;
  maxDrawdown: number; // Percentage (e.g., 10 = 10%)
  currentDrawdown: number;
  yellowChannelId: string; // Yellow Network channel ID
  isActive: boolean;
  startValue: bigint;
  currentValue: bigint;
  startedAt: number;
}

// ============================================================================
// Trade Types
// ============================================================================

/**
 * Trade action types
 */
export enum TradeAction {
  BUY = 'BUY',
  SELL = 'SELL',
}

/**
 * Trade intent from leader
 */
export interface TradeIntent {
  tradeId: string;
  leaderAddress: string;
  action: TradeAction;
  asset: string; // Token symbol (e.g., 'ETH', 'BTC', 'USDC')
  tokenAddress: string; // ERC20 token address
  amount: bigint; // Amount in wei
  price: bigint; // Price in wei (USDC per token)
  timestamp: number;
  uniswapPoolAddress?: string; // Uniswap v4 pool if used
  yellowChannelId: string; // Yellow channel where trade executes
  signature: string; // Leader's signature
}

/**
 * Executed trade (replicated to copiers)
 */
export interface ExecutedTrade {
  tradeId: string;
  originalTradeId: string; // Leader's trade ID
  executorAddress: string; // Copier or leader address
  action: TradeAction;
  asset: string;
  tokenAddress: string;
  amount: bigint; // Proportional amount for copiers
  price: bigint;
  executedAt: number;
  yellowStateNonce: number; // Yellow state channel nonce
  txHash?: string; // On-chain tx hash if settled
}

/**
 * Trade replication result
 */
export interface ReplicationResult {
  success: boolean;
  copierAddress: string;
  executedTrade?: ExecutedTrade;
  error?: string;
  yellowChannelId: string;
}

// ============================================================================
// ENS Types
// ============================================================================

/**
 * ENS profile data for leaders
 */
export interface ENSProfile {
  ensName: string;
  address: string;
  avatar?: string; // IPFS or HTTP URL
  bio?: string;
  strategy?: string; // Trading strategy description
  twitter?: string;
  discord?: string;
  performance?: {
    roi60d: number; // 60-day ROI percentage
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

/**
 * ENS text record keys for Shadow
 */
export enum ENSTextRecordKey {
  BIO = 'com.shadow.bio',
  STRATEGY = 'com.shadow.strategy',
  TWITTER = 'com.shadow.twitter',
  DISCORD = 'com.shadow.discord',
  PERFORMANCE = 'com.shadow.performance',
}

// ============================================================================
// Uniswap v4 Types
// ============================================================================

/**
 * Uniswap v4 pool info
 */
export interface UniswapV4Pool {
  poolAddress: string;
  token0: string;
  token1: string;
  fee: number;
  hookAddress: string; // ShadowPerformanceFeeHook address
  liquidity: bigint;
}

/**
 * Uniswap v4 swap params
 */
export interface UniswapV4SwapParams {
  poolAddress: string;
  zeroForOne: boolean; // Direction of swap
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
  hookData: string; // Custom data for Shadow hook
}

/**
 * Performance fee distribution from Uniswap hook
 */
export interface PerformanceFeeDistribution {
  leaderAddress: string;
  copierAddress: string;
  feeAmount: bigint;
  token: string;
  distributedAt: number;
  txHash: string;
}

// ============================================================================
// Risk Management Types
// ============================================================================

/**
 * Risk limits for copiers
 */
export interface RiskLimits {
  maxDrawdown: number; // Percentage
  maxPositionSize: bigint; // Max size per trade
  maxDailyLoss: bigint; // Max loss per day
  maxOpenPositions: number;
}

/**
 * Risk check result
 */
export interface RiskCheckResult {
  passed: boolean;
  reason?: string;
  currentDrawdown?: number;
  projectedDrawdown?: number;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

/**
 * Events emitted to frontend via WebSocket
 */
export enum WebSocketEvent {
  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_CLOSED = 'session_closed',

  // Trade events
  TRADE_EXECUTED = 'trade_executed',
  TRADE_REPLICATED = 'trade_replicated',

  // Risk events
  DRAWDOWN_WARNING = 'drawdown_warning',
  COPIER_UNSUBSCRIBED = 'copier_unsubscribed',

  // Yellow Network events
  YELLOW_CHANNEL_OPENED = 'yellow_channel_opened',
  YELLOW_CHANNEL_CLOSED = 'yellow_channel_closed',
  YELLOW_STATE_UPDATE = 'yellow_state_update',

  // Performance events
  PERFORMANCE_UPDATE = 'performance_update',
  FEE_DISTRIBUTED = 'fee_distributed',
}

/**
 * WebSocket message payload
 */
export interface WebSocketMessage<T = unknown> {
  event: WebSocketEvent;
  data: T;
  timestamp: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Leader registration request
 */
export interface RegisterLeaderRequest {
  address: string;
  ensName: string;
  performanceFeeRate: number; // Basis points
  minCopierDeposit: string; // Wei string
  signature: string;
}

/**
 * Copier subscription request
 */
export interface SubscribeCopierRequest {
  copierAddress: string;
  leaderAddress: string;
  depositAmount: string; // Wei string
  maxDrawdown: number; // Percentage
  signature: string;
}

/**
 * Trade submission request
 */
export interface SubmitTradeRequest {
  leaderAddress: string;
  action: TradeAction;
  asset: string;
  tokenAddress: string;
  amount: string; // Wei string
  price: string; // Wei string
  uniswapPoolAddress?: string;
  signature: string;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  address: string;
  ensName: string;
  ensAvatar?: string;
  performance: {
    roi60d: number;
    sharpeRatio: number;
    totalAUM: string; // Wei string
    copierCount: number;
    totalFeesEarned: string; // Wei string
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Yellow Network configuration
 */
export interface YellowNetworkConfig {
  wsUrl: string; // e.g., wss://clearnet.yellow.com/ws
  chainId: number;
  adjudicatorAddress: string;
  custodyAddress: string;
}

/**
 * Relay service configuration
 */
export interface RelayConfig {
  port: number;
  yellowNetwork: YellowNetworkConfig;
  contracts: {
    registry: string;
    feeManager: string;
  };
  ensRegistry: string;
  rpcUrl: string;
}
