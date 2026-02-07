// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPoolManager} from "./IPoolManager.sol";
import {BalanceDelta} from "./BalanceDelta.sol";

/**
 * @title IHooks
 * @notice Interface for Uniswap V4 Hooks
 */
interface IHooks {
    function beforeInitialize(address sender, IPoolManager.PoolKey calldata key, uint160 sqrtPriceX96, bytes calldata hookData)
        external
        returns (bytes4);

    function afterInitialize(address sender, IPoolManager.PoolKey calldata key, uint160 sqrtPriceX96, int24 tick, bytes calldata hookData)
        external
        returns (bytes4);

    function beforeModifyLiquidity(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4);

    function afterModifyLiquidity(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4);

    function beforeSwap(address sender, IPoolManager.PoolKey calldata key, IPoolManager.SwapParams calldata params, bytes calldata hookData)
        external
        returns (bytes4);

    function afterSwap(
        address sender,
        IPoolManager.PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4);

    function beforeDonate(address sender, IPoolManager.PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata hookData)
        external
        returns (bytes4);

    function afterDonate(address sender, IPoolManager.PoolKey calldata key, uint256 amount0, uint256 amount1, bytes calldata hookData)
        external
        returns (bytes4);
}
