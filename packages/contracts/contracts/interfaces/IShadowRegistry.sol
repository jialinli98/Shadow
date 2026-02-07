// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IShadowRegistry
 * @notice Interface for Shadow leader registration and management
 */
interface IShadowRegistry {
    struct LeaderInfo {
        address leaderAddress;
        string ensName;
        uint256 performanceFeeRate; // Basis points (e.g., 1000 = 10%)
        uint256 minCopierDeposit; // Minimum deposit required in wei
        uint256 activeCopierCount;
        uint256 totalFeesEarned;
        uint256 registeredAt;
        bool isActive;
    }

    /**
     * @notice Register as a leader
     * @param ensName The ENS name for the leader profile
     * @param performanceFeeRate Performance fee in basis points (max 3000 = 30%)
     * @param minCopierDeposit Minimum deposit required from copiers
     */
    function registerLeader(
        string calldata ensName,
        uint256 performanceFeeRate,
        uint256 minCopierDeposit
    ) external;

    /**
     * @notice Update leader terms (fee rate and minimum deposit)
     * @param performanceFeeRate New performance fee rate
     * @param minCopierDeposit New minimum deposit requirement
     */
    function updateLeaderTerms(uint256 performanceFeeRate, uint256 minCopierDeposit) external;

    /**
     * @notice Deactivate leader profile
     */
    function deactivateLeader() external;

    /**
     * @notice Get leader information
     * @param leaderAddress The address of the leader
     * @return info The leader's information
     */
    function getLeader(address leaderAddress) external view returns (LeaderInfo memory info);

    /**
     * @notice Check if an address is a registered leader
     * @param leaderAddress The address to check
     * @return registered True if the address is a registered leader
     */
    function isRegistered(address leaderAddress) external view returns (bool registered);

    /**
     * @notice Increment active copier count for a leader
     * @param leaderAddress The leader's address
     */
    function incrementCopierCount(address leaderAddress) external;

    /**
     * @notice Decrement active copier count for a leader
     * @param leaderAddress The leader's address
     */
    function decrementCopierCount(address leaderAddress) external;

    /**
     * @notice Add fees earned by a leader
     * @param leaderAddress The leader's address
     * @param feeAmount The fee amount to add
     */
    function addFeesEarned(address leaderAddress, uint256 feeAmount) external;

    event LeaderRegistered(address indexed leader, string ensName, uint256 performanceFeeRate);
    event LeaderTermsUpdated(address indexed leader, uint256 performanceFeeRate, uint256 minCopierDeposit);
    event LeaderDeactivated(address indexed leader);
}
