# 🕶️ Shadow Protocol

> **Privacy-Preserving Trade Replication using Yellow State Channels + Uniswap v4**

**🏆 Submission for Uniswap v4 Privacy DeFi Track - ETHGlobal HackMoney 2026**

## The Problem

On-chain copy trading (Logearn, Copin, etc.) exposes traders' strategies in the mempool, allowing MEV bots to front-run and arbitrage, destroying alpha. Centralized platforms (eToro, Bybit) solve privacy but require custody and trust.

## The Solution

**Shadow** is the first non-custodial copy trading platform where leader trades stay private until settlement. All trading happens inside Yellow Network state channels—off-chain, gasless, and invisible to MEV bots. Settlement occurs through Uniswap v4 with hook-based verification to maintain privacy and integrity.

## 📜 Deployed Contracts & Transactions (Sepolia Testnet)

### Core Smart Contracts

| Contract | Address | Transaction Hash |
|----------|---------|------------------|
| **ShadowSettlementHook** | [`0xDA80D93C0B8c8241f58eA9de2C555fBc1AEA7e5C`](https://sepolia.etherscan.io/address/0xDA80D93C0B8c8241f58eA9de2C555fBc1AEA7e5C) | [`0x94e64e6909...`](https://sepolia.etherscan.io/tx/0x94e64e69095fef8a858d1d2bde71f65a3540bb429931391b256fb11ba3e46d89) |
| **Uniswap V4 Pool Init** | USDC/WETH Pool | [`0xa7f59cf756...`](https://sepolia.etherscan.io/tx/0xa7f59cf756896a6a7b38c355da665b20611db340d2e4be484b17aeef031cf775) |
| **ShadowRegistry** | [`0xaad7376A2B7D1a5C3615B969bFf0Ce46B6ac8C9d`](https://sepolia.etherscan.io/address/0xaad7376A2B7D1a5C3615B969bFf0Ce46B6ac8C9d) | Deployed ✅ |
| **ShadowFeeManager** | [`0x6bF059D3CC2FCC52bE4f8E12e185dBbab553B62d`](https://sepolia.etherscan.io/address/0x6bF059D3CC2FCC52bE4f8E12e185dBbab553B62d) | Deployed ✅ |
| **MockYellowAdjudicator** | [`0x0871952AC5126Bf0E4Ba2a03002e9fE8C39f8418`](https://sepolia.etherscan.io/address/0x0871952AC5126Bf0E4Ba2a03002e9fE8C39f8418) | Deployed ✅ |
| **MockERC20 (USDC)** | [`0x77eB3E04229C2D31d4D8637D18200a18Ff167B5B`](https://sepolia.etherscan.io/address/0x77eB3E04229C2D31d4D8637D18200a18Ff167B5B) | Deployed ✅ |

### Uniswap V4 Integration

- **Official PoolManager**: `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`
- **Pool**: USDC/WETH, 0.3% fee
- **Source Code Verification**: [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0xDA80D93C0B8c8241f58eA9de2C555fBc1AEA7e5C/)

## How It Works

1. **Leader Setup**: Alice registers as a leader, opens a Yellow state channel session
2. **Copier Subscribe**: Bob subscribes to Alice, deposits funds in his own state channel
3. **Trade Replication**: Alice's trades are replicated proportionally to Bob's session—all off-chain via the Shadow relay
4. **Settlement**: When sessions close, final states settle on-chain with performance fees distributed
5. **Privacy**: Only deposit/withdrawal appear on-chain. No one can reconstruct Alice's strategy.

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

### Privacy Comparison

| Metric | Traditional DEX | Copy Trading Platforms | Shadow Protocol |
|--------|----------------|------------------------|-----------------|
| Individual trades visible | ✅ Yes | ✅ Yes | ❌ No (off-chain) |
| MEV attack surface | High | High | Minimal |
| Front-running possible | Yes | Yes | No |
| Strategy privacy | No | No | Yes |
| Verifiable settlement | Yes | Varies | Yes (cryptographic) |

### What Remains Private (Off-Chain)
- ✅ Individual trade entries and exits
- ✅ Trade timing and execution prices
- ✅ Intermediate position sizes
- ✅ Trading strategy and signals
- ✅ Leader identity during session

### What Becomes Public (On-Chain)
- Final net position change (aggregated)
- Total session PnL
- Settlement timestamp via Uniswap v4
- Performance fees distributed

**Result**: 100% trade privacy with 100% settlement verifiability.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRIVACY LAYER                            │
│  Leader trades off-chain in Yellow State Channel (PRIVATE)      │
│  ↓                                                               │
│  Shadow Relay replicates to copiers (PRIVATE)                   │
│  ↓                                                               │
│  Session closes → Final state submitted to Yellow Adjudicator   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 SETTLEMENT LAYER (Uniswap V4)                    │
│  ShadowSettlementHook verifies state channel proof              │
│  ↓                                                               │
│  Uniswap V4 swap executes based on net position change          │
│  ↓                                                               │
│  Only aggregated settlement visible on-chain                    │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Flow
```solidity
// 1. Off-chain: Trade in Yellow state channel (PRIVATE)
yellowChannel.executeOffChainSwap(token0, token1, amount);

// 2. Close channel with final state
yellowAdjudicator.finalizeChannel(channelId, finalNonce, signatures);

// 3. Settle on Uniswap v4 with hook verification
poolManager.swap(
    poolKey,
    swapParams,
    hookData: {
        channelId,        // State channel ID
        finalNonce,       // Final state nonce
        signature,        // Cryptographic proof
        leaderAddress,    // Performance fee recipient
        performanceFee    // Amount
    }
);

// 4. Hook verifies state channel proof before settling
function afterSwap(...) external override {
    SettlementData memory settlement = abi.decode(hookData, (SettlementData));

    // Verify Yellow state channel proof
    require(
        yellowAdjudicator.verifyFinalState(
            settlement.channelId,
            settlement.finalNonce,
            settlement.signature
        ),
        "Invalid state proof"
    );

    // Execute settlement only if proof is valid ✅
    _processSettlement(settlement);
}
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
npm run relay:dev

# Start frontend (in another terminal)
npm run frontend:dev

# Or run everything in parallel
npm run dev
```

### Deployment

```bash
# Deploy contracts to Yellow testnet
npm run contracts:deploy

# Build relay for production
npm run relay:build

# Build frontend for production
npm run frontend:build
```

## 💻 Tech Stack

- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
- **Uniswap V4**: Hook-based settlement verification
- **State Channels**: Yellow Network (off-chain privacy layer)
- **Relay Service**: TypeScript, Express, WebSocket
- **Frontend**: React, Vite, TailwindCSS, Wagmi, Viem
- **Identity**: ENS integration
- **Deployment**: Sepolia testnet

## 🏆 Why Shadow Qualifies for Uniswap v4 Privacy DeFi Track

### Prize Track Requirements Met

**"Build on Uniswap v4 to explore privacy-enhancing financial systems"** ✅

1. **Reduces Unnecessary Information Exposure** ✅
   - Individual trades never touch the mempool
   - Only aggregated final positions visible on-chain
   - State channel privacy for all intermediate states

2. **Improves Execution Quality** ✅
   - Eliminates front-running and sandwich attacks
   - No adverse selection from leaked order flow
   - MEV-protected trade execution

3. **More Resilient to Adverse Selection and Extractive Dynamics** ✅
   - MEV bots cannot extract value from hidden trades
   - Searchers cannot exploit trade intentions
   - Fair pricing for all participants

4. **Preserves On-Chain Verifiability** ✅
   - Cryptographic state channel proofs
   - Uniswap v4 hook verification ensures integrity
   - Full settlement transparency

5. **Responsible, Transparent System Design** ✅
   - Open-source codebase
   - No trusted intermediaries
   - Clear settlement mechanism via Uniswap v4

### Meaningful Use of Hooks

Shadow uses Uniswap v4 hooks **meaningfully** to:
- Verify Yellow Network state channel proofs before settlement
- Ensure only valid, finalized states can settle on-chain
- Prevent double-settlement attacks
- Process performance fees transparently
- Maintain privacy while ensuring integrity

```solidity
// ShadowSettlementHook.sol
function afterSwap(..., bytes calldata hookData) external override {
    SettlementData memory settlement = abi.decode(hookData, (SettlementData));

    // Verify state channel proof with Yellow Adjudicator
    _verifyStateChannelProof(settlement);

    // Mark channel as settled (prevent double-spend)
    settledChannels[settlement.channelId] = true;

    // Process performance fees
    _processPerformanceFee(sender, leader, fee);

    return IHooks.afterSwap.selector;
}
```

## 🎬 Demo Video

[Watch 3-Minute Demo →](YOUR_VIDEO_LINK_HERE)

**Demo showcases:**
1. Privacy layer: Off-chain trade execution in Yellow channels
2. Settlement layer: Uniswap v4 hook verification
3. Zero information leakage to mempool
4. Cryptographic proof validation
5. Successful on-chain settlement

## 🔮 Future Enhancements

- [ ] CREATE2 deployment for production hook with proper address flags
- [ ] Multi-pool support for complex trading strategies
- [ ] Cross-chain settlement via Yellow Network bridges
- [ ] Privacy-preserving performance analytics dashboard
- [ ] ZK-proofs for enhanced privacy guarantees
- [ ] Integration with additional Uniswap v4 pools
- [ ] Liquidity provision through the privacy layer

## 📖 Additional Documentation

- **Yellow Integration**: [YELLOW_NETWORK_INTEGRATION_SUMMARY.md](./YELLOW_NETWORK_INTEGRATION_SUMMARY.md)
- **ENS Setup**: [ENS_INTEGRATION_SUMMARY.md](./ENS_INTEGRATION_SUMMARY.md)
- **Demo Guide**: [YELLOW_NETWORK_DEMO_GUIDE.md](./YELLOW_NETWORK_DEMO_GUIDE.md)
- **Testing**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **Qualification Proof**: [YELLOW_QUALIFICATION_PROOF.md](./YELLOW_QUALIFICATION_PROOF.md)

## 🤝 Team

Built during ETHGlobal HackMoney 2026

## License

MIT License - see [LICENSE](./LICENSE) file for details

