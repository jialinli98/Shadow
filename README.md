# Shadow

> **Private copy trading on Yellow Network state channels**

## The Problem

On-chain copy trading (Logearn, Copin, etc.) exposes traders' strategies in the mempool, allowing MEV bots to front-run and arbitrage, destroying alpha. Centralized platforms (eToro, Bybit) solve privacy but require custody and trust.

## The Solution

**Shadow** is the first non-custodial copy trading platform where leader trades stay private until settlement. All trading happens inside Yellow Network state channels—off-chain, gasless, and invisible to MEV bots.

## How It Works

1. **Leader Setup**: Alice registers as a leader, opens a Yellow state channel session
2. **Copier Subscribe**: Bob subscribes to Alice, deposits funds in his own state channel
3. **Trade Replication**: Alice's trades are replicated proportionally to Bob's session—all off-chain via the Shadow relay
4. **Settlement**: When sessions close, final states settle on-chain with performance fees distributed
5. **Privacy**: Only deposit/withdrawal appear on-chain. No one can reconstruct Alice's strategy.

## Architecture

```
┌─────────────────────────────────────────┐
│         ON-CHAIN (Ethereum)              │
│  ┌────────────────┐  ┌────────────────┐ │
│  │ Yellow         │  │ Shadow         │ │
│  │ Adjudicator    │  │ Registry       │ │
│  │ Contract       │  │ Fee Manager    │ │
│  └────────────────┘  └────────────────┘ │
└─────────────────────────────────────────┘
                    │
         (state channel protocol)
                    │
┌─────────────────────────────────────────┐
│     OFF-CHAIN (Shadow Relay)             │
│  ┌─────────────────────────────────┐    │
│  │ Trade Replication Engine        │    │
│  │ Risk Management Module          │    │
│  │ Yellow Network Integration      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
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

## Tech Stack

- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin
- **Relay Service**: TypeScript, Express, WebSocket, Yellow Nitrolite SDK
- **Frontend**: React, Vite, TailwindCSS, Wagmi, RainbowKit
- **State Channels**: Yellow Network (ERC-7824)
- **Identity**: ENS

## Roadmap

See [IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) for detailed development phases.

## License

MIT License - see [LICENSE](./LICENSE) file for details

---

*Trade without exposing your alpha.*
