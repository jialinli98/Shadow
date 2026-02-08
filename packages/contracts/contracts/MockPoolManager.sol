// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/uniswap/IPoolManager.sol";

/**
 * Mock Uniswap V4 PoolManager for testing
 * In production, would use the real Uniswap V4 PoolManager
 */
contract MockPoolManager is IPoolManager {
    mapping(address => bool) public isHook;

    function registerHook(address hook) external {
        isHook[hook] = true;
    }

    function swap(
        PoolKey memory,
        SwapParams memory,
        bytes calldata
    ) external pure override returns (BalanceDelta) {
        // Mock implementation - just return zero delta
        return BalanceDelta.wrap(0);
    }

    function modifyLiquidity(
        PoolKey memory,
        ModifyLiquidityParams memory,
        bytes calldata
    ) external pure override returns (BalanceDelta) {
        // Mock implementation - just return zero delta
        return BalanceDelta.wrap(0);
    }

    function initialize(
        PoolKey memory,
        uint160,
        bytes calldata
    ) external pure override returns (int24) {
        // Mock implementation - return default tick
        return 0;
    }

    function unlock(bytes calldata) external pure override returns (bytes memory) {
        // Mock implementation - return empty bytes
        return "";
    }
}
