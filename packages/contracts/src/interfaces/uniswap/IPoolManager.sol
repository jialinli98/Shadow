// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Currency} from "./Currency.sol";
import {BalanceDelta} from "./BalanceDelta.sol";

/**
 * @title IPoolManager
 * @notice Interface for Uniswap V4 Pool Manager
 */
interface IPoolManager {
    struct PoolKey {
        Currency currency0;
        Currency currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
    }

    function swap(PoolKey memory key, SwapParams memory params, bytes calldata hookData)
        external
        returns (BalanceDelta);

    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes calldata hookData
    ) external returns (BalanceDelta);

    function initialize(PoolKey memory key, uint160 sqrtPriceX96, bytes calldata hookData)
        external
        returns (int24);

    function unlock(bytes calldata data) external returns (bytes memory);
}
