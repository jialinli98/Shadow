// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IShadowFeeManager
 * @notice Interface for performance fee calculation and distribution
 */
interface IShadowFeeManager {
    struct CopierSession {
        address copier;
        address leader;
        uint256 startValue;
        uint256 endValue;
        uint256 feeAmount;
        uint256 startedAt;
        uint256 settledAt;
        bool isSettled;
    }

    /**
     * @notice Register a new copier session
     * @param leader The leader's address
     * @param copier The copier's address
     * @param startValue The initial deposit value
     * @param channelId The Yellow Network channel ID
     */
    function registerCopierSession(
        address leader,
        address copier,
        uint256 startValue,
        bytes32 channelId
    ) external;

    /**
     * @notice Settle a copier session and calculate fees
     * @param leader The leader's address
     * @param copier The copier's address
     * @param endValue The final portfolio value
     * @param channelId The Yellow Network channel ID
     */
    function settleCopierSession(
        address leader,
        address copier,
        uint256 endValue,
        bytes32 channelId
    ) external;

    /**
     * @notice Calculate performance fee for a session
     * @param leader The leader's address
     * @param startValue The starting portfolio value
     * @param endValue The ending portfolio value
     * @return feeAmount The calculated fee amount
     */
    function calculateFee(
        address leader,
        uint256 startValue,
        uint256 endValue
    ) external view returns (uint256 feeAmount);

    /**
     * @notice Get accumulated fees for a leader
     * @param leader The leader's address
     * @return totalFees The total accumulated fees
     */
    function getAccumulatedFees(address leader) external view returns (uint256 totalFees);

    /**
     * @notice Get copier session details
     * @param sessionId The session identifier
     * @return session The session details
     */
    function getCopierSession(bytes32 sessionId) external view returns (CopierSession memory session);

    /**
     * @notice Withdraw accumulated fees
     */
    function withdrawFees() external;

    event SessionRegistered(
        bytes32 indexed sessionId,
        address indexed leader,
        address indexed copier,
        uint256 startValue
    );
    event SessionSettled(
        bytes32 indexed sessionId,
        address indexed leader,
        address indexed copier,
        uint256 endValue,
        uint256 feeAmount
    );
    event FeesWithdrawn(address indexed leader, uint256 amount);
}
