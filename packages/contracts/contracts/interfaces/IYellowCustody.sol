// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IYellowCustody
 * @notice Interface for Yellow Network's custody contract
 * @dev Handles deposits and withdrawals for state channels
 */
interface IYellowCustody {
    /**
     * @notice Deposit tokens into a state channel
     * @param token The token address (address(0) for native currency)
     * @param amount The amount to deposit
     * @param channelId The channel to deposit into
     */
    function deposit(address token, uint256 amount, bytes32 channelId) external payable;

    /**
     * @notice Withdraw tokens from a closed channel
     * @param token The token address
     * @param amount The amount to withdraw
     * @param channelId The channel to withdraw from
     */
    function withdraw(address token, uint256 amount, bytes32 channelId) external;

    /**
     * @notice Get the balance of a token in a channel
     * @param token The token address
     * @param channelId The channel identifier
     * @return balance The token balance
     */
    function getBalance(address token, bytes32 channelId) external view returns (uint256 balance);

    event Deposited(address indexed user, address indexed token, uint256 amount, bytes32 channelId);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, bytes32 channelId);
}
