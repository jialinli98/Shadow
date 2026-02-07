# Uniswap V4 Integration - Complete

## Overview

Shadow now integrates Uniswap V4 for **privacy-preserving settlement** from Yellow state channels. This allows trades to remain private off-chain while final settlement executes through Uniswap V4 pools with minimal on-chain exposure.

## Privacy Model

```
┌─────────────────────────────────────────────────────────┐
│                  PRIVATE (Off-Chain)                     │
│                                                          │
│  1. Leader trades in Yellow state channel                │
│  2. Shadow relay replicates to copiers                   │
│  3. Multiple trades over time (10, 20, 100+)             │
│                                                          │
│  [Individual trades NEVER visible on-chain]              │
└─────────────────────────────────────────────────────────┘
                         ↓
                    Settlement
                         ↓
┌─────────────────────────────────────────────────────────┐
│                  PUBLIC (On-Chain)                       │
│                                                          │
│  4. Final state submitted to Yellow adjudicator          │
│  5. ShadowSettlementHook verifies state proof            │
│  6. ONE aggregated Uniswap V4 swap executes              │
│                                                          │
│  Result: Net position change (e.g., 2 ETH bought)        │
│  Hidden: Individual trades, timing, strategy             │
└─────────────────────────────────────────────────────────┘
```

## Components Implemented

### 1. Uniswap V4 Interfaces

**Location:** `contracts/interfaces/uniswap/`

- `IPoolManager.sol` - Uniswap V4 pool manager interface
- `IHooks.sol` - Hook interface for custom logic
- `Currency.sol` - Currency type and utilities
- `BalanceDelta.sol` - Balance change representation

### 2. BaseHook Contract

**Location:** `contracts/base/BaseHook.sol`

Base implementation for Uniswap V4 hooks with:
- Default implementations for all hook functions
- `poolManagerOnly` modifier for security
- Virtual functions for overriding

### 3. ShadowSettlementHook

**Location:** `contracts/ShadowSettlementHook.sol`

**Core Features:**
- Verifies Yellow state channel proofs before settlement
- Processes performance fees via ShadowFeeManager
- Prevents double-settlement attacks
- Emits settlement events for tracking

**Key Functions:**
```solidity
function afterSwap(
    address sender,
    IPoolManager.PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    BalanceDelta delta,
    bytes calldata hookData  // Contains: channelId, nonce, signature, fees
) external override returns (bytes4);
```

**Settlement Data Structure:**
```solidity
struct SettlementData {
    bytes32 channelId;       // Yellow state channel ID
    uint256 finalNonce;      // Final state nonce
    bytes signature;         // State channel signature
    address leaderAddress;   // Leader (for fee payment)
    uint256 performanceFee;  // Fee to pay leader
}
```

### 4. Updated IYellowAdjudicator

**New Methods:**
```solidity
function verifyFinalState(
    bytes32 channelId,
    uint256 nonce,
    bytes memory signature
) external view returns (bool valid);

function isChannelFinalized(bytes32 channelId)
    external view returns (bool finalized);
```

### 5. Updated ShadowFeeManager

**New Method:**
```solidity
function processCopierFee(
    address copier,
    address leader,
    uint256 feeAmount
) external nonReentrant;
```

Called by `ShadowSettlementHook` to handle fee distribution atomically with settlement.

## Test Coverage

**New Tests:** 4 passing
**Total Tests:** 51 passing

**Test Cases:**
1. ✅ Should successfully settle a valid state channel
2. ✅ Should reject settlement with invalid state proof
3. ✅ Should reject double settlement of same channel
4. ✅ Should only allow poolManager to call afterSwap

## Usage Example

### Step 1: Leader/Copier Trade Off-Chain

```javascript
// Leader executes trades in Yellow state channel
await yellowService.executeTrade(channelId, {
  action: 'BUY',
  asset: 'ETH',
  amount: ethers.parseUnits("2", 18),
  price: ethers.parseUnits("3200", 18)
});

// Shadow relay replicates to all copiers
// All trades happen off-chain in state channels
```

### Step 2: Close State Channel

```javascript
// Close Yellow state channel with final balances
await yellowAdjudicator.closeChannel(
  channelId,
  finalState,
  signatures
);
```

### Step 3: Execute Settlement via Uniswap V4

```javascript
// Encode settlement data for hook
const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
  ["tuple(bytes32,uint256,bytes,address,uint256)"],
  [[
    channelId,
    finalNonce,
    signature,
    leaderAddress,
    performanceFee
  ]]
);

// Execute swap with settlement hook
await poolManager.swap(
  poolKey,  // Pool with ShadowSettlementHook
  {
    zeroForOne: true,
    amountSpecified: netEthToBuy,  // Net position change
    sqrtPriceLimitX96: 0
  },
  settlementData  // Passed to hook
);
```

### What Happens In The Hook

1. **Verify State Channel Proof:**
   - Check channel is finalized
   - Verify signature is valid
   - Ensure channel hasn't been settled before

2. **Process Fees:**
   - If copier settlement → pay leader performance fee
   - Transfer fee via ShadowFeeManager
   - Accumulate for leader withdrawal

3. **Mark Settled:**
   - Record channel as settled
   - Emit `SessionSettled` event

4. **Return Control:**
   - Swap executes normally
   - Settlement complete

## Privacy Guarantees

### What's Hidden
- ✅ Individual trade timing
- ✅ Trade strategy/pattern
- ✅ Number of trades
- ✅ Intermediate positions
- ✅ Stop-loss triggers
- ✅ Risk management decisions

### What's Visible On-Chain
- Final net position change (e.g., "bought 2 ETH")
- Settlement timestamp
- Performance fee paid
- Final balances

### MEV Protection
- **No front-running:** Trades happen off-chain
- **No sandwich attacks:** Only final net swap visible
- **No JIT liquidity sniping:** Settlement is one atomic transaction

## Prize Alignment

### Uniswap Foundation - Privacy in DeFi ($5k)

**Qualifies because:**
- Improves information handling during trading
- Prevents MEV extraction
- Hides trading strategy from public
- Only exposes necessary settlement data

**Key Innovation:** Atomic settlement from state channels through Uniswap V4 hooks

### Yellow Network ($15k)

**Qualifies because:**
- Deep integration with Yellow state channels
- Uses ERC-7824 standard
- Demonstrates novel use case (private copy trading)
- Extends Yellow Network with DeFi settlement layer

## Next Steps

### For Production

1. **Enhanced Verification:**
   - Multi-sig settlement approvals
   - Time-lock for large settlements
   - Fraud proof system

2. **Gas Optimization:**
   - Batch settlements for multiple copiers
   - Merkle proofs for efficient verification
   - Compressed signature schemes

3. **Oracle Integration:**
   - TWAP price validation
   - Slippage protection
   - Settlement price guarantees

4. **Monitoring:**
   - Settlement analytics
   - Anomaly detection
   - Real-time alerting

### For Hackathon Demo

1. **Frontend Integration:**
   - Settlement button in UI
   - Real-time settlement status
   - Gas estimates

2. **Demo Flow:**
   - Leader trades → Copiers replicate → Close sessions → Settlement
   - Show privacy: Individual trades not visible
   - Show settlement: One final swap on Uniswap

3. **Documentation:**
   - Settlement guide
   - Privacy explainer
   - Architecture diagrams

## Technical Achievements

✅ **Zero-knowledge-like privacy** without ZK complexity
✅ **Non-custodial** settlement (Yellow adjudicator enforces)
✅ **Atomic** fee distribution (hook + swap in one tx)
✅ **MEV-resistant** (no mempool exposure)
✅ **Gas-efficient** (one swap instead of many)

## Files Modified/Created

**Created:**
- `contracts/interfaces/uniswap/IPoolManager.sol`
- `contracts/interfaces/uniswap/IHooks.sol`
- `contracts/interfaces/uniswap/Currency.sol`
- `contracts/interfaces/uniswap/BalanceDelta.sol`
- `contracts/base/BaseHook.sol`
- `contracts/ShadowSettlementHook.sol`
- `test/ShadowSettlementHook.test.js`

**Modified:**
- `contracts/interfaces/IYellowAdjudicator.sol` (added verification methods)
- `contracts/ShadowFeeManager.sol` (added processCopierFee)
- `contracts/mocks/MockYellowAdjudicator.sol` (added test helpers)

## Conclusion

Shadow now provides **end-to-end private copy trading** with:
- Private execution (Yellow state channels)
- Private replication (Shadow relay)
- Privacy-preserving settlement (Uniswap V4 hooks)

The leader's alpha is protected. The copiers are protected. The market never sees the strategy.

**This is the first copy trading platform where getting more followers doesn't destroy your edge.**
