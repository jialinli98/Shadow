// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseHook} from "./base/BaseHook.sol";
import {IPoolManager} from "./interfaces/uniswap/IPoolManager.sol";
import {IHooks} from "./interfaces/uniswap/IHooks.sol";
import {BalanceDelta} from "./interfaces/uniswap/BalanceDelta.sol";
import {IYellowAdjudicator} from "./interfaces/IYellowAdjudicator.sol";
import {ShadowFeeManager} from "./ShadowFeeManager.sol";

/**
 * @title ShadowSettlementHook
 * @notice Uniswap V4 hook for privacy-preserving settlement from Yellow state channels
 *
 * How it works:
 * 1. Leader trades off-chain in Yellow state channel (PRIVATE)
 * 2. Shadow relay replicates to copiers (PRIVATE)
 * 3. Session closes → final state submitted to Yellow adjudicator
 * 4. This hook verifies the state channel proof
 * 5. Uniswap swap executes based on net position change
 * 6. Only aggregated settlement visible on-chain (PRIVACY PRESERVED)
 *
 * Privacy guarantee: Individual trades never hit mempool, only final net settlement
 */
contract ShadowSettlementHook is BaseHook {
    error InvalidStateProof();
    error InvalidSession();
    error SettlementFailed();
    error UnauthorizedCaller();

    event SessionSettled(
        bytes32 indexed channelId,
        address indexed settler,
        uint256 nonce,
        int256 swapAmount,
        uint256 feesPaid
    );

    struct SettlementData {
        bytes32 channelId;       // Yellow state channel ID
        uint256 finalNonce;      // Final state nonce
        bytes signature;         // State channel signature
        address leaderAddress;   // Leader who generated trades
        uint256 performanceFee;  // Fee to pay leader (if copier)
    }

    IYellowAdjudicator public immutable yellowAdjudicator;
    ShadowFeeManager public immutable feeManager;

    // Track settled channels to prevent double-settlement
    mapping(bytes32 => bool) public settledChannels;

    constructor(
        IPoolManager _poolManager,
        IYellowAdjudicator _yellowAdjudicator,
        ShadowFeeManager _feeManager
    ) BaseHook(_poolManager) {
        yellowAdjudicator = _yellowAdjudicator;
        feeManager = _feeManager;
    }

    /**
     * @notice Hook called after swap execution
     * @dev Verifies Yellow state channel proof and processes settlement
     */
    function afterSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override poolManagerOnly returns (bytes4) {
        // Decode settlement data from hookData
        if (hookData.length == 0) {
            return IHooks.afterSwap.selector;
        }

        SettlementData memory settlement = abi.decode(hookData, (SettlementData));

        // Verify this is a legitimate Yellow state channel settlement
        _verifyStateChannelProof(settlement);

        // Mark channel as settled
        settledChannels[settlement.channelId] = true;

        // Process performance fees if this is a copier settlement
        if (settlement.performanceFee > 0 && settlement.leaderAddress != address(0)) {
            _processPerformanceFee(sender, settlement.leaderAddress, settlement.performanceFee);
        }

        emit SessionSettled(
            settlement.channelId,
            sender,
            settlement.finalNonce,
            params.amountSpecified,
            settlement.performanceFee
        );

        return IHooks.afterSwap.selector;
    }

    /**
     * @notice Verify Yellow state channel proof
     * @dev Ensures the settlement is from a valid, finalized state channel
     */
    function _verifyStateChannelProof(SettlementData memory settlement) internal view {
        // Check channel hasn't been settled before
        if (settledChannels[settlement.channelId]) {
            revert InvalidSession();
        }

        // Verify state channel is finalized and signature is valid
        // This ensures the settlement reflects the true final state
        bool isValid = yellowAdjudicator.verifyFinalState(
            settlement.channelId,
            settlement.finalNonce,
            settlement.signature
        );

        if (!isValid) {
            revert InvalidStateProof();
        }

        // Verify channel is actually closed (not just paused)
        require(
            yellowAdjudicator.isChannelFinalized(settlement.channelId),
            "Channel not finalized"
        );
    }

    /**
     * @notice Process performance fee payment to leader
     * @dev Called when a copier settles their position
     */
    function _processPerformanceFee(
        address copier,
        address leader,
        uint256 feeAmount
    ) internal {
        // Transfer fee to ShadowFeeManager for distribution
        // FeeManager handles the actual leader payment and platform fee split
        try feeManager.processCopierFee(copier, leader, feeAmount) {
            // Fee processed successfully
        } catch {
            revert SettlementFailed();
        }
    }

    /**
     * @notice Get settlement status for a channel
     */
    function isChannelSettled(bytes32 channelId) external view returns (bool) {
        return settledChannels[channelId];
    }
}
