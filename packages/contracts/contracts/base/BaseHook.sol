// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IHooks} from "../interfaces/uniswap/IHooks.sol";
import {IPoolManager} from "../interfaces/uniswap/IPoolManager.sol";
import {BalanceDelta} from "../interfaces/uniswap/BalanceDelta.sol";

/**
 * @title BaseHook
 * @notice Base contract for Uniswap V4 hooks with default implementations
 */
abstract contract BaseHook is IHooks {
    error NotPoolManager();

    IPoolManager public immutable poolManager;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    modifier poolManagerOnly() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    function beforeInitialize(address, IPoolManager.PoolKey calldata, uint160, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, IPoolManager.PoolKey calldata, uint160, int24, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        return IHooks.afterInitialize.selector;
    }

    function beforeModifyLiquidity(address, IPoolManager.PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        return IHooks.beforeModifyLiquidity.selector;
    }

    function afterModifyLiquidity(
        address,
        IPoolManager.PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        bytes calldata
    ) external virtual returns (bytes4) {
        return IHooks.afterModifyLiquidity.selector;
    }

    function beforeSwap(address, IPoolManager.PoolKey calldata, IPoolManager.SwapParams calldata, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        return IHooks.beforeSwap.selector;
    }

    function afterSwap(
        address,
        IPoolManager.PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external virtual returns (bytes4) {
        return IHooks.afterSwap.selector;
    }

    function beforeDonate(address, IPoolManager.PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, IPoolManager.PoolKey calldata, uint256, uint256, bytes calldata)
        external
        virtual
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }
}
