# 🕶️ Shadow Protocol

> **Privacy-Preserving Copy Trading using Yellow Network State Channels + ENS**


## The Problem

**On-chain copy trading** (Logearn, Copin) exposes every trade to MEV bots, enabling front-running and strategy exploitation. **Centralized platforms** (eToro, Bybit) solve privacy but require custody, trust, and store trader profiles in centralized databases vulnerable to hacks and censorship.

## The Solution

**Shadow** is a non-custodial copy trading platform built on two key technologies:

1. **Yellow Network State Channels**: All trades execute off-chain with instant finality - gasless, private, and invisible to MEV bots
2. **ENS Text Records**: Trader profiles, performance metrics, and achievements stored on-chain - fully decentralized, no centralized database

## Integration 

### Yellow Network Integration 

- Official Yellow Network Clearnode
- Nitrolite state channels
- EIP-712 signed challenges
- Live state channel operations in relay logs

### ENS Integration ✅

- **Text Records Used**:
  - `trading.winrate` - Win rate percentage
  - `trading.roi` - Return on investment
  - `trading.totalTrades` - Total number of trades
  - `trading.avgReturn` - Average return per trade
  - `trading.sharpeRatio` - Risk-adjusted return
  - `trading.achievements` - Badges and milestones
  - `trading.strategy` - Trading strategy description
  - `trading.risk` - Risk level classification
  - `trading.assets` - Preferred assets
  - `description`, `com.twitter`, `com.discord`, `url` - Standard ENS fields

- `packages/frontend/src/components/ENSMetadata.tsx`
- Real ENS text record fetching via wagmi/viem publicClient

### Smart Contracts (Sepolia Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **ShadowRegistry** | [`0xaad7376A2B7D1a5C3615B969bFf0Ce46B6ac8C9d`](https://sepolia.etherscan.io/address/0xaad7376A2B7D1a5C3615B969bFf0Ce46B6ac8C9d) | Leader/copier registration |
| **ShadowFeeManager** | [`0x6bF059D3CC2FCC52bE4f8E12e185dBbab553B62d`](https://sepolia.etherscan.io/address/0x6bF059D3CC2FCC52bE4f8E12e185dBbab553B62d) | Performance fee distribution |

## How It Works

### Step-by-Step Flow

**1. Leader Registration**
- Alice connects her wallet and navigates to the Leader Dashboard
- She registers with her ENS name (e.g., "shadowleader.eth") and sets her performance fee (15%)
- She deposits initial collateral (e.g., 10,000 USDC) which opens a Yellow Network state channel
- The Shadow relay creates an off-chain session: `Alice ↔ Market Maker`

**2. Copier Subscription**
- Bob discovers Alice on the Browse Leaders page (showing her win rate, ROI from ENS metadata)
- He subscribes to Alice by depositing his own collateral (e.g., 5,000 USDC)
- The Shadow relay creates Bob's state channel: `Bob ↔ Market Maker`
- A copy relationship is established in the relay's database

**3. Private Trade Execution**
- Alice executes a trade (BUY 0.01 ETH @ $3,200) through the trade executor
- Her wallet signs the trade with EIP-712 signature
- The trade executes **off-chain** in her Yellow state channel (nonce increments)
- **Zero on-chain footprint** - no mempool exposure, no MEV risk

**4. Automatic Replication**
- The Shadow relay receives Alice's signed trade
- It verifies the signature and checks Alice is a registered leader
- It calculates Bob's proportional position: `(Bob's deposit / Alice's deposit) × Trade size`
- Bob's trade executes in his state channel automatically
- **All happens off-chain** - still completely private

**5. Decentralized Profiles via ENS**
- Leader's trading metrics update in ENS text records (trading.winrate, trading.roi, etc.)
- Copiers discover leaders by viewing their on-chain ENS profiles
- No centralized database - all profile data stored in ENS
- Censorship-resistant and verifiable

**Privacy Guarantee**: During trading, all trades happen in Yellow Network state channels - completely off-chain. No blockchain observer can see individual trades, position sizes, or strategy patterns. Only the participants and Shadow relay have visibility.

**Decentralization Guarantee**: All trader profiles stored in ENS text records on-chain. No centralized database, no single point of failure, no trusted intermediary for identity.

## 🔐 Privacy-Enhancing Mechanisms

### Information Exposure Reduction ✅

**Traditional On-Chain Copy Trading Problems:**
- Individual trade intentions exposed in mempool → Front-running
- Position sizes visible → Adverse selection
- Trading frequency leaked → Strategy exploitation
- Real-time order flow → MEV extraction

**Shadow's Privacy Solution:**
1. **Off-Chain Execution**: All trades happen in Yellow state channels (invisible to blockchain)
2. **Aggregated Settlement**: Only final net positions settle through Uniswap v4
3. **Cryptographic Proofs**: State channel signatures verify authenticity without revealing details
4. **Hook-Based Verification**: Smart contracts validate proofs without exposing trade history


### What Remains Private (Off-Chain)
- Individual trade entries and exits
- Trade timing and execution prices
- Intermediate position sizes
- Trading strategy and signals
- Leader identity during session

### What Becomes Public (On-Chain)
- Final net position change (aggregated)
- Total session PnL
- Settlement timestamp via Uniswap v4
- Performance fees distributed


### Technical Flow

**Yellow Network Integration (Off-Chain Trading):**
```typescript
// 1. Leader executes trade in Yellow state channel
const trade = {
  asset: 'ETH',
  side: 'BUY',
  amount: '0.01',
  price: getCurrentPrice(),
  channelId: leaderChannel.id
};

// 2. Sign with EIP-712 and execute off-chain
const signature = await wallet.signTypedData(trade);
await yellowChannel.executeSwap(trade, signature);

// 3. Shadow relay replicates proportionally to copiers
const copierTrade = {
  ...trade,
  amount: (copierDeposit / leaderDeposit) * trade.amount,
  channelId: copierChannel.id
};
await copierYellowChannel.executeSwap(copierTrade);

```

**ENS Integration (Decentralized Profiles):**
```typescript
// Store trader metrics in ENS text records
await ensRegistry.setTextRecord(
  'shadowleader.eth',
  'trading.winrate',
  '73.5%'
);
await ensRegistry.setTextRecord(
  'shadowleader.eth',
  'trading.roi',
  '+284%'
);
await ensRegistry.setTextRecord(
  'shadowleader.eth',
  'trading.totalTrades',
  '1247'
);

// Copiers discover leaders via ENS (fully on-chain)
const winRate = await ensRegistry.getTextRecord(
  'shadowleader.eth',
  'trading.winrate'
);

```

## Project Structure

```
Shadow/
├── packages/
│   ├── contracts/          # Solidity smart contracts
│   │   ├── contracts/
│   │   │   ├── ShadowRegistry.sol
│   │   │   └── ShadowFeeManager.sol
│   │   ├── scripts/        # Deployment scripts
│   │   └── test/           # Contract tests
│   │
│   ├── relay/              # Off-chain relay service
│   │   ├── src/
│   │   │   ├── services/   # Trade replication, risk management
│   │   │   ├── types/      # TypeScript types
│   │   │   └── utils/      # Helper functions
│   │   └── test/
│   │
│   └── frontend/           # React web interface
│       ├── src/
│       │   ├── components/ # UI components
│       │   ├── pages/      # Page components
│       │   ├── hooks/      # Custom React hooks
│       │   └── utils/      # Frontend utilities
│       └── public/
│
├── docs/                   # Documentation
│   └── IMPLEMENTATION_PLAN.md
└── README.md
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/jialinli98/Shadow.git
cd Shadow

# Install dependencies for all packages
npm install

# Copy environment files
cp packages/contracts/.env.example packages/contracts/.env
cp packages/relay/.env.example packages/relay/.env
cp packages/frontend/.env.example packages/frontend/.env

# Edit .env files with your configuration
```

### Development

```bash
# Build smart contracts
npm run contracts:build

# Run tests
npm run contracts:test

# Start relay service (in development mode)
cd packages/relay
npm run dev:shadow

# Start frontend (in another terminal)
cd packages/frontend
npm run dev

# The application will be available at:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001/api
```

### Running the Demo

**Prerequisites:**
- Two browser profiles or incognito windows (one for leader, one for copier)
- MetaMask wallets connected to Sepolia testnet
- Some test ETH for gas

### Deployment

```bash
# Deploy contracts to Yellow testnet
npm run contracts:deploy

# Build relay for production
npm run relay:build

# Build frontend for production
npm run frontend:build
```

## Tech Stack

- **Yellow Network**: Nitrolite protocol for off-chain state channels (instant, private execution)
- **ENS**: Text records for decentralized profile storage (trading.*, achievements, social)
- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
- **Deployment**: Connected to Yellow clearnode + ENS mainnet/testnet

## License

MIT License - see [LICENSE](./LICENSE) file for details

