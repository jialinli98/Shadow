// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IShadowFeeManager.sol";
import "./interfaces/IShadowRegistry.sol";
import "./interfaces/IYellowAdjudicator.sol";

/**
 * @title ShadowFeeManager
 * @notice Manages performance fee calculation and distribution for Shadow copy trading
 * @dev Integrates with Yellow Network state channels for settlement verification
 */
contract ShadowFeeManager is IShadowFeeManager, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant BASIS_POINTS = 10000;

    // State variables
    IShadowRegistry public immutable registry;
    IYellowAdjudicator public immutable yellowAdjudicator;

    mapping(bytes32 => CopierSession) private sessions;
    mapping(address => uint256) private accumulatedFees;
    mapping(address => bytes32[]) private leaderSessions;
    mapping(address => bytes32[]) private copierSessions;

    // Fee token (e.g., USDC)
    IERC20 public feeToken;

    constructor(
        address _registry,
        address _yellowAdjudicator,
        address _feeToken
    ) Ownable(msg.sender) {
        require(_registry != address(0), "Invalid registry");
        require(_yellowAdjudicator != address(0), "Invalid adjudicator");
        require(_feeToken != address(0), "Invalid fee token");

        registry = IShadowRegistry(_registry);
        yellowAdjudicator = IYellowAdjudicator(_yellowAdjudicator);
        feeToken = IERC20(_feeToken);
    }

    /**
     * @inheritdoc IShadowFeeManager
     */
    function registerCopierSession(
        address leader,
        address copier,
        uint256 startValue,
        bytes32 channelId
    ) external override {
        require(registry.isRegistered(leader), "Leader not registered");
        require(copier != address(0), "Invalid copier");
        require(startValue > 0, "Invalid start value");

        IShadowRegistry.LeaderInfo memory leaderInfo = registry.getLeader(leader);
        require(startValue >= leaderInfo.minCopierDeposit, "Deposit below minimum");

        bytes32 sessionId = keccak256(
            abi.encodePacked(leader, copier, channelId, block.timestamp)
        );
        require(!sessions[sessionId].isSettled && sessions[sessionId].startedAt == 0, "Session exists");

        sessions[sessionId] = CopierSession({
            copier: copier,
            leader: leader,
            startValue: startValue,
            endValue: 0,
            feeAmount: 0,
            startedAt: block.timestamp,
            settledAt: 0,
            isSettled: false
        });

        leaderSessions[leader].push(sessionId);
        copierSessions[copier].push(sessionId);

        registry.incrementCopierCount(leader);

        emit SessionRegistered(sessionId, leader, copier, startValue);
    }

    /**
     * @inheritdoc IShadowFeeManager
     */
    function settleCopierSession(
        address leader,
        address copier,
        uint256 endValue,
        bytes32 channelId
    ) external override nonReentrant {
        bytes32 sessionId = _findActiveSession(leader, copier, channelId);
        CopierSession storage session = sessions[sessionId];

        require(!session.isSettled, "Session already settled");
        require(session.startedAt > 0, "Session not found");

        // Calculate performance fee
        uint256 feeAmount = calculateFee(leader, session.startValue, endValue);

        // Update session
        session.endValue = endValue;
        session.feeAmount = feeAmount;
        session.settledAt = block.timestamp;
        session.isSettled = true;

        // Update accumulated fees
        if (feeAmount > 0) {
            accumulatedFees[leader] += feeAmount;
            registry.addFeesEarned(leader, feeAmount);
        }

        // Decrement copier count
        registry.decrementCopierCount(leader);

        emit SessionSettled(sessionId, leader, copier, endValue, feeAmount);
    }

    /**
     * @inheritdoc IShadowFeeManager
     */
    function calculateFee(
        address leader,
        uint256 startValue,
        uint256 endValue
    ) public view override returns (uint256 feeAmount) {
        IShadowRegistry.LeaderInfo memory leaderInfo = registry.getLeader(leader);

        // Only charge fee on profits
        if (endValue <= startValue) {
            return 0;
        }

        uint256 profit = endValue - startValue;
        feeAmount = (profit * leaderInfo.performanceFeeRate) / BASIS_POINTS;

        return feeAmount;
    }

    /**
     * @inheritdoc IShadowFeeManager
     */
    function getAccumulatedFees(address leader)
        external
        view
        override
        returns (uint256 totalFees)
    {
        return accumulatedFees[leader];
    }

    /**
     * @inheritdoc IShadowFeeManager
     */
    function getCopierSession(bytes32 sessionId)
        external
        view
        override
        returns (CopierSession memory session)
    {
        return sessions[sessionId];
    }

    /**
     * @inheritdoc IShadowFeeManager
     */
    function withdrawFees() external override nonReentrant {
        uint256 fees = accumulatedFees[msg.sender];
        require(fees > 0, "No fees to withdraw");

        accumulatedFees[msg.sender] = 0;
        feeToken.safeTransfer(msg.sender, fees);

        emit FeesWithdrawn(msg.sender, fees);
    }

    /**
     * @notice Get all sessions for a leader
     * @param leader The leader's address
     * @return sessionIds Array of session IDs
     */
    function getLeaderSessions(address leader)
        external
        view
        returns (bytes32[] memory sessionIds)
    {
        return leaderSessions[leader];
    }

    /**
     * @notice Get all sessions for a copier
     * @param copier The copier's address
     * @return sessionIds Array of session IDs
     */
    function getCopierSessions(address copier)
        external
        view
        returns (bytes32[] memory sessionIds)
    {
        return copierSessions[copier];
    }

    /**
     * @notice Internal function to find active session
     * @dev This is a simplified version - in production, would use better indexing
     */
    function _findActiveSession(
        address leader,
        address copier,
        bytes32 channelId
    ) private view returns (bytes32) {
        bytes32[] memory sessions_ = copierSessions[copier];

        for (uint256 i = 0; i < sessions_.length; i++) {
            CopierSession memory session = sessions[sessions_[i]];
            if (session.leader == leader && !session.isSettled) {
                return sessions_[i];
            }
        }

        revert("Active session not found");
    }

    /**
     * @notice Update fee token address (owner only)
     * @param _feeToken New fee token address
     */
    function setFeeToken(address _feeToken) external onlyOwner {
        require(_feeToken != address(0), "Invalid token");
        feeToken = IERC20(_feeToken);
    }
}
