# Shadow Implementation Plan

This document outlines the detailed implementation plan for building Shadow, a private copy trading platform on Yellow Network state channels.

## Project Timeline

**Total Duration:** 10 days
**Development Phases:** 4 main phases + 1 polish phase

---

## Phase 1: Foundation & Smart Contracts (Days 1-3)

### Day 1: Smart Contract Development

#### 1.1 ShadowRegistry.sol
**Purpose:** Manages leader registration and ENS integration

```solidity
// Core functions to implement:
- registerLeader(string ensName, uint256 performanceFeeRate, uint256 minCopierDeposit)
- updateLeaderTerms(uint256 performanceFeeRate, uint256 minCopierDeposit)
- getLeader(address leaderAddress) returns (LeaderInfo)
- isRegistered(address leaderAddress) returns (bool)
```

**Key Features:**
- Leader profile storage (ENS name, fee rate, minimum deposit, active copier count)
- Performance fee validation (max 30%)
- ENS integration for leader profiles
- Event emissions for indexing

**Files to create:**
- `packages/contracts/contracts/ShadowRegistry.sol`
- `packages/contracts/contracts/interfaces/IShadowRegistry.sol`

#### 1.2 ShadowFeeManager.sol
**Purpose:** Handles performance fee calculation and distribution

```solidity
// Core functions to implement:
- registerCopierSession(address leader, address copier, uint256 startValue)
- settleCopierSession(address leader, address copier, uint256 endValue)
- calculateFee(address leader, uint256 startValue, uint256 endValue) returns (uint256)
- withdrawFees(address leader)
```

**Key Features:**
- Track copier session start/end values
- Calculate performance fees (only on profits)
- Fee accumulation per leader
- Settlement with automatic fee transfer
- Integration with Yellow adjudicator for final state verification

**Files to create:**
- `packages/contracts/contracts/ShadowFeeManager.sol`
- `packages/contracts/contracts/interfaces/IShadowFeeManager.sol`

#### 1.3 Yellow Network Integration
**Purpose:** Interface with Yellow's custody and adjudicator contracts

**Files to create:**
- `packages/contracts/contracts/interfaces/IYellowAdjudicator.sol` (copied from Yellow docs)
- `packages/contracts/contracts/interfaces/IYellowCustody.sol`

### Day 2: Contract Testing & Deployment

#### 2.1 Unit Tests
**Test coverage for ShadowRegistry:**
- Leader registration with valid/invalid parameters
- Fee rate validation (reject > 30%)
- Minimum deposit validation
- Leader terms updates
- ENS name uniqueness

**Test coverage for ShadowFeeManager:**
- Copier session registration
- Fee calculation (profit scenarios)
- Fee calculation (loss scenarios - should be 0)
- Multiple copiers per leader
- Fee withdrawal

**Files to create:**
- `packages/contracts/test/ShadowRegistry.test.js`
- `packages/contracts/test/ShadowFeeManager.test.js`
- `packages/contracts/test/integration.test.js` (end-to-end flow)

#### 2.2 Deployment Scripts
**Purpose:** Deploy contracts to testnet and local network

**Files to create:**
- `packages/contracts/scripts/deploy.js`
- `packages/contracts/scripts/verify.js` (Etherscan verification)
- `packages/contracts/scripts/setup.js` (post-deployment setup)

**Deployment checklist:**
- [ ] Deploy ShadowRegistry
- [ ] Deploy ShadowFeeManager with Registry address
- [ ] Verify contracts on block explorer
- [ ] Save deployed addresses to `.env` and config file

### Day 3: Contract Finalization

#### 3.1 Gas Optimization
- Review contract functions for gas efficiency
- Use `calldata` instead of `memory` where applicable
- Pack struct variables efficiently
- Consider using events instead of storage for historical data

#### 3.2 Security Review
- Check for reentrancy vulnerabilities
- Validate all external inputs
- Ensure proper access control
- Add circuit breakers if needed
- Review fee calculation for edge cases (overflows, precision)

#### 3.3 Documentation
**Files to create:**
- `packages/contracts/README.md` (deployment guide)
- `packages/contracts/docs/ARCHITECTURE.md` (contract design)
- Inline NatSpec comments in all contracts

---

## Phase 2: Relay Service (Days 4-6)

### Day 4: Core Relay Infrastructure

#### 4.1 Yellow Network Integration
**Purpose:** Connect to Yellow Network and manage state channels

**Files to create:**
- `packages/relay/src/services/YellowService.ts`

```typescript
class YellowService {
  // Initialize connection to Yellow Network
  async connect(): Promise<void>

  // Create a new state channel session
  async createSession(participantAddress: string): Promise<SessionId>

  // Execute a trade in a session
  async executeTrade(sessionId: SessionId, trade: TradeIntent): Promise<StateUpdate>

  // Close a session and settle on-chain
  async closeSession(sessionId: SessionId): Promise<Transaction>

  // Listen for state updates
  onStateUpdate(callback: (update: StateUpdate) => void): void
}
```

**Key Features:**
- Yellow Nitrolite SDK integration
- Session lifecycle management (open, trade, close)
- State update signing and verification
- Error handling and retry logic

#### 4.2 Type Definitions
**Files to create:**
- `packages/relay/src/types/index.ts`

```typescript
// Define core types:
interface LeaderSession {
  sessionId: string;
  leaderAddress: string;
  ensName: string;
  depositAmount: bigint;
  copiers: string[]; // copier addresses
  isActive: boolean;
}

interface CopierSession {
  sessionId: string;
  copierAddress: string;
  leaderAddress: string;
  depositAmount: bigint;
  maxDrawdown: number; // percentage (e.g., 10 = 10%)
  isActive: boolean;
}

interface TradeIntent {
  action: 'BUY' | 'SELL';
  asset: string; // e.g., 'ETH', 'BTC'
  amount: bigint;
  price: bigint;
  timestamp: number;
}

interface StateUpdate {
  sessionId: string;
  newState: object;
  signature: string;
}
```

### Day 5: Trade Replication Engine

#### 5.1 Trade Replication Service
**Purpose:** Core logic to replicate leader trades to copiers

**Files to create:**
- `packages/relay/src/services/ReplicationService.ts`

```typescript
class ReplicationService {
  // When leader makes a trade, replicate to all copiers
  async replicateTrade(
    leaderSession: LeaderSession,
    trade: TradeIntent
  ): Promise<void> {
    // For each copier:
    // 1. Calculate proportional size
    // 2. Check risk limits (max drawdown)
    // 3. Execute trade in copier's session
    // 4. Emit events for frontend
  }

  // Calculate proportional trade size
  calculateProportionalSize(
    leaderDeposit: bigint,
    copierDeposit: bigint,
    leaderTradeAmount: bigint
  ): bigint {
    // ratio = copierDeposit / leaderDeposit
    // copierAmount = leaderTradeAmount * ratio
  }

  // Check if trade would breach risk limits
  checkRiskLimits(
    copierSession: CopierSession,
    proposedTrade: TradeIntent
  ): boolean {
    // Calculate if trade would exceed max drawdown
    // Return false if risk limit breached
  }
}
```

#### 5.2 Risk Management Module
**Purpose:** Enforce copier risk limits (max drawdown, position limits)

**Files to create:**
- `packages/relay/src/services/RiskManager.ts`

```typescript
class RiskManager {
  // Calculate current P&L for a copier session
  calculatePnL(session: CopierSession): bigint

  // Check if copier should be auto-unsubscribed (max drawdown hit)
  shouldUnsubscribe(session: CopierSession): boolean

  // Unsubscribe copier and close their session
  async unsubscribeCopier(session: CopierSession): Promise<void>
}
```

### Day 6: API & WebSocket Server

#### 6.1 REST API
**Purpose:** HTTP endpoints for frontend interaction

**Files to create:**
- `packages/relay/src/index.ts` (Express server)
- `packages/relay/src/routes/leaders.ts`
- `packages/relay/src/routes/copiers.ts`

**API Endpoints:**
```
POST   /api/leaders/register          # Register as leader
GET    /api/leaders/:address          # Get leader info
GET    /api/leaders                   # Get all leaders (leaderboard)

POST   /api/copiers/subscribe         # Subscribe to leader
DELETE /api/copiers/unsubscribe       # Unsubscribe from leader
GET    /api/copiers/:address/sessions # Get copier's active sessions

POST   /api/trades                    # Leader submits trade (authenticated)
GET    /api/trades/:sessionId         # Get trade history for session
```

#### 6.2 WebSocket Server
**Purpose:** Real-time updates for trade replication

**Files to create:**
- `packages/relay/src/services/WebSocketService.ts`

```typescript
// WebSocket events:
- 'trade_executed' -> { leaderAddress, trade, timestamp }
- 'trade_replicated' -> { copierAddress, trade, timestamp }
- 'session_opened' -> { sessionId, address, type: 'leader' | 'copier' }
- 'session_closed' -> { sessionId, finalValue, feePaid }
- 'copier_unsubscribed' -> { copierAddress, reason: 'drawdown' | 'manual' }
```

#### 6.3 Testing
**Files to create:**
- `packages/relay/test/replication.test.ts`
- `packages/relay/test/risk.test.ts`
- `packages/relay/test/api.test.ts`

**Test scenarios:**
- Trade replication with 1:1 ratio
- Trade replication with different ratios (2:1, 10:1)
- Max drawdown trigger (copier auto-unsubscribe)
- Multiple copiers following one leader
- Leader closes session while copiers are active

---

## Phase 3: Frontend (Days 7-8)

### Day 7: Core UI Components

#### 7.1 Wallet Integration
**Files to create:**
- `packages/frontend/src/lib/wagmi.ts` (Wagmi config)
- `packages/frontend/src/components/ConnectWallet.tsx`

**Setup:**
- RainbowKit for wallet connection
- Configure Yellow testnet + Sepolia
- WalletConnect integration

#### 7.2 Leader Dashboard
**Files to create:**
- `packages/frontend/src/pages/LeaderDashboard.tsx`
- `packages/frontend/src/components/LeaderRegistration.tsx`
- `packages/frontend/src/components/LeaderStats.tsx`

**Features:**
- Registration form (ENS name, fee rate, min deposit)
- Open session (deposit USDC to Yellow state channel)
- Current session stats (active copiers, total AUM, fees earned)
- Trade execution form (asset, action, amount)
- Close session button

#### 7.3 Copier Dashboard
**Files to create:**
- `packages/frontend/src/pages/CopierDashboard.tsx`
- `packages/frontend/src/components/LeaderBrowser.tsx`
- `packages/frontend/src/components/CopierSubscription.tsx`

**Features:**
- Browse leaders (table with ENS, return %, Sharpe ratio, copier count)
- Leader profile page (detailed stats, historical trades)
- Subscribe form (deposit amount, max drawdown)
- Active subscriptions list (current P&L, leader ENS, unsubscribe button)

### Day 8: Charts & Real-Time Updates

#### 8.1 Performance Charts
**Files to create:**
- `packages/frontend/src/components/PerformanceChart.tsx` (Recharts)
- `packages/frontend/src/components/TradeHistory.tsx`

**Charts to implement:**
- Leader P&L over time (line chart)
- Copier P&L vs Leader P&L (comparison chart)
- Trade distribution (pie chart: BUY vs SELL, assets)

#### 8.2 Real-Time Updates
**Files to create:**
- `packages/frontend/src/hooks/useWebSocket.ts`
- `packages/frontend/src/hooks/useLeaderData.ts`
- `packages/frontend/src/hooks/useCopierData.ts`

**Real-time features:**
- WebSocket connection to relay
- Live trade notifications
- P&L updates every second
- Copier count updates for leaders

#### 8.3 Leaderboard
**Files to create:**
- `packages/frontend/src/pages/Leaderboard.tsx`

**Features:**
- Table of all leaders ranked by:
  - 60-day return %
  - Sharpe ratio
  - Total AUM
  - Copier count
- Search by ENS name
- Filter by minimum return, max fee rate

---

## Phase 4: Integration & Demo (Day 9)

### Day 9.1: End-to-End Testing

#### Integration Test Scenarios:
1. **Leader Flow:**
   - Connect wallet → Register → Open session → Make 3 trades → Close session → Withdraw fees

2. **Copier Flow:**
   - Connect wallet → Browse leaders → Subscribe to Alice → See trades replicate → Hit max drawdown → Auto-unsubscribe

3. **Multi-Copier:**
   - Alice has 3 copiers (different deposit sizes)
   - Alice makes 5 trades
   - All copiers see proportional replication
   - Close all sessions → Verify fees distributed correctly

#### Files to create:
- `docs/TESTING.md` (manual test checklist)
- `scripts/demo-setup.sh` (automated demo data generation)

### Day 9.2: Demo Preparation

#### Demo Script (4 minutes):
**[0:00-0:30] Problem Setup**
- Show split-screen: Traditional copy trading vs Shadow
- Traditional: Tx in mempool → MEV bot front-runs
- Shadow: Tx off-chain → No mempool exposure

**[0:30-1:00] Architecture**
- Show diagram: Yellow state channels + Shadow relay
- Explain: Leader-relay-copier session structure

**[1:00-2:30] Live Demo**
1. Alice registers as leader (alice.shadow.eth)
2. Bob subscribes (2,000 USDC, 10% max drawdown)
3. Alice makes 3 trades:
   - BUY 2 ETH @ $3,200 → Bob gets 0.4 ETH
   - SELL 1 ETH @ $3,300 → Bob sells 0.2 ETH
   - BUY 5,000 USDC of BTC → Bob gets 1,000 USDC of BTC
4. Show Bob's dashboard updating in real-time
5. Bob hits 9% drawdown → Trigger auto-unsubscribe
6. Alice closes session → Settlement on-chain → Fees distributed

**[2:30-3:30] Attack Demo**
- Show MEV bot trying to find Alice's trades in mempool → Not found
- Show attacker trying to steal from relay → Tx reverts (non-custodial)
- Show relay going offline → Alice/Bob can unilaterally close channels

**[3:30-4:00] Conclusion**
- "First non-custodial private copy trading platform"
- "Built on Yellow Network state channels"
- "Try it at: shadow-demo.vercel.app"

#### Demo Data Generation:
**Files to create:**
- `scripts/generate-demo-data.ts`

**What it does:**
- Deploy contracts to testnet
- Register 5 demo leaders with ENS names
- Create historical performance data (past 60 days)
- Generate realistic trade history
- Fund demo accounts with testnet tokens

---

## Phase 5: Polish & Deployment (Day 10)

### Day 10.1: UI/UX Polish

- [ ] Add loading states for all async operations
- [ ] Add error handling with user-friendly messages
- [ ] Add transaction confirmation toasts
- [ ] Improve mobile responsiveness
- [ ] Add dark mode toggle
- [ ] Add tooltips for complex features (max drawdown, Sharpe ratio)
- [ ] Add empty states ("No active subscriptions yet")

### Day 10.2: Performance Optimization

- [ ] Memoize expensive React components
- [ ] Debounce WebSocket updates
- [ ] Optimize contract calls (batch reads)
- [ ] Add loading skeletons for charts
- [ ] Compress assets (images, fonts)

### Day 10.3: Documentation

**Files to create/update:**
- `README.md` (comprehensive setup guide)
- `docs/ARCHITECTURE.md` (system design deep-dive)
- `docs/API.md` (relay API documentation)
- `docs/DEMO_GUIDE.md` (how to present the demo)
- Inline code comments for complex logic

### Day 10.4: Deployment

#### Smart Contracts:
- [ ] Deploy to Yellow testnet
- [ ] Verify on block explorer
- [ ] Save addresses to `.env.production`

#### Relay Service:
- [ ] Deploy to Railway/Render/Fly.io
- [ ] Configure production environment variables
- [ ] Set up WebSocket server with SSL
- [ ] Test API endpoints

#### Frontend:
- [ ] Build production bundle
- [ ] Deploy to Vercel
- [ ] Configure environment variables
- [ ] Test all features on production

#### Final Checks:
- [ ] All links in README work
- [ ] Demo video uploaded and linked
- [ ] All tests passing
- [ ] No console errors in production
- [ ] Mobile experience tested
- [ ] Submission form completed

---

## Development Best Practices

### Git Workflow
```bash
# Feature branches for each component
git checkout -b feat/shadow-registry
git checkout -b feat/relay-replication
git checkout -b feat/frontend-dashboard

# Commit frequently with clear messages
git commit -m "feat(contracts): add ShadowRegistry with ENS integration"
git commit -m "fix(relay): handle edge case in proportional sizing"
git commit -m "ui(frontend): add real-time trade notifications"

# Merge to main when feature is complete and tested
git checkout main
git merge feat/shadow-registry
```

### Code Quality
- Use TypeScript strict mode
- Write unit tests for critical functions
- Run linter before committing (`npm run lint`)
- Document complex algorithms with comments
- Use meaningful variable names

### Performance Targets
- Frontend initial load: < 3 seconds
- Trade replication latency: < 500ms
- API response time: < 200ms
- WebSocket message latency: < 100ms

---

## Success Criteria

### Minimum Viable Demo (Must Have):
- [ ] Smart contracts deployed and verified
- [ ] Leader can register and open session
- [ ] Copier can subscribe to leader
- [ ] Trade replication works (1 leader → 1 copier)
- [ ] Sessions can be closed and fees distributed
- [ ] Frontend shows real-time updates
- [ ] Demo video (2-4 minutes)

### Enhanced Demo (Should Have):
- [ ] Multiple copiers per leader
- [ ] Max drawdown enforcement (auto-unsubscribe)
- [ ] ENS integration for leader profiles
- [ ] Performance charts (P&L over time)
- [ ] Leaderboard with ranking
- [ ] Attack demo (MEV bot failing)

### Stretch Goals (Nice to Have):
- [ ] Uniswap v4 hook for settlement
- [ ] Arc integration for cross-chain copying
- [ ] AI agent mode (strategy-based copying)
- [ ] Mobile app (React Native)
- [ ] Telegram bot for notifications

---

## Risk Mitigation

### Technical Risks:
1. **Yellow Network SDK issues**
   - Mitigation: Mock Yellow SDK if unavailable, use local state channels

2. **State channel complexity**
   - Mitigation: Start with simplified 2-party channels, add complexity incrementally

3. **Real-time sync issues**
   - Mitigation: Use WebSocket with fallback to polling

4. **ENS integration**
   - Mitigation: ENS is optional, can use addresses if integration is complex

### Schedule Risks:
1. **Falling behind**
   - Mitigation: Focus on MVP first, add enhancements only if time permits

2. **Scope creep**
   - Mitigation: Stick to the plan, defer non-critical features

3. **Debugging time**
   - Mitigation: Allocate Day 9-10 as buffer for unexpected issues

---

## Daily Standup Questions

### What did I complete yesterday?
### What am I working on today?
### What blockers do I have?

Use this framework to track progress and stay on schedule.

---

## Resources

### Yellow Network:
- [Yellow Docs](https://docs.yellow.org)
- [Nitrolite SDK](https://github.com/layer-3/nitrolite)
- [ERC-7824 Spec](https://eips.ethereum.org/EIPS/eip-7824)

### ENS:
- [ENS Contracts](https://docs.ens.domains/contract-api-reference/overview)
- [ENS Integration Guide](https://docs.ens.domains/dapp-developer-guide/ens-as-nft)

### Frontend:
- [Wagmi Docs](https://wagmi.sh)
- [RainbowKit](https://www.rainbowkit.com)
- [Recharts](https://recharts.org)

---

**End of Implementation Plan**

This plan provides a structured roadmap for building Shadow. Adjust as needed based on progress and findings during development.
