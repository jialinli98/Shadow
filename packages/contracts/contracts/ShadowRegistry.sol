// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IShadowRegistry.sol";

/**
 * @title ShadowRegistry
 * @notice Manages leader registration and profiles for Shadow copy trading platform
 * @dev Integrates with ENS for human-readable leader names
 */
contract ShadowRegistry is IShadowRegistry, Ownable {
    // Constants
    uint256 public constant MAX_PERFORMANCE_FEE = 3000; // 30% in basis points
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points

    // State variables
    mapping(address => LeaderInfo) private leaders;
    mapping(string => address) private ensToAddress;
    address public feeManager;

    uint256 public totalLeaders;

    modifier onlyFeeManager() {
        require(msg.sender == feeManager, "Only fee manager can call");
        _;
    }

    modifier onlyRegisteredLeader() {
        require(leaders[msg.sender].isActive, "Not a registered leader");
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set the fee manager contract address
     * @param _feeManager Address of the ShadowFeeManager contract
     */
    function setFeeManager(address _feeManager) external onlyOwner {
        require(_feeManager != address(0), "Invalid fee manager address");
        feeManager = _feeManager;
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function registerLeader(
        string calldata ensName,
        uint256 performanceFeeRate,
        uint256 minCopierDeposit
    ) external override {
        require(!leaders[msg.sender].isActive, "Already registered");
        require(performanceFeeRate <= MAX_PERFORMANCE_FEE, "Fee rate too high");
        require(bytes(ensName).length > 0, "ENS name required");
        require(ensToAddress[ensName] == address(0), "ENS name already taken");

        leaders[msg.sender] = LeaderInfo({
            leaderAddress: msg.sender,
            ensName: ensName,
            performanceFeeRate: performanceFeeRate,
            minCopierDeposit: minCopierDeposit,
            activeCopierCount: 0,
            totalFeesEarned: 0,
            registeredAt: block.timestamp,
            isActive: true
        });

        ensToAddress[ensName] = msg.sender;
        totalLeaders++;

        emit LeaderRegistered(msg.sender, ensName, performanceFeeRate);
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function updateLeaderTerms(
        uint256 performanceFeeRate,
        uint256 minCopierDeposit
    ) external override onlyRegisteredLeader {
        require(performanceFeeRate <= MAX_PERFORMANCE_FEE, "Fee rate too high");

        LeaderInfo storage leader = leaders[msg.sender];
        leader.performanceFeeRate = performanceFeeRate;
        leader.minCopierDeposit = minCopierDeposit;

        emit LeaderTermsUpdated(msg.sender, performanceFeeRate, minCopierDeposit);
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function deactivateLeader() external override onlyRegisteredLeader {
        LeaderInfo storage leader = leaders[msg.sender];
        require(leader.activeCopierCount == 0, "Cannot deactivate with active copiers");

        leader.isActive = false;
        delete ensToAddress[leader.ensName];
        totalLeaders--;

        emit LeaderDeactivated(msg.sender);
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function getLeader(address leaderAddress)
        external
        view
        override
        returns (LeaderInfo memory info)
    {
        return leaders[leaderAddress];
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function isRegistered(address leaderAddress)
        external
        view
        override
        returns (bool registered)
    {
        return leaders[leaderAddress].isActive;
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function incrementCopierCount(address leaderAddress)
        external
        override
        onlyFeeManager
    {
        require(leaders[leaderAddress].isActive, "Leader not active");
        leaders[leaderAddress].activeCopierCount++;
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function decrementCopierCount(address leaderAddress)
        external
        override
        onlyFeeManager
    {
        require(leaders[leaderAddress].activeCopierCount > 0, "No active copiers");
        leaders[leaderAddress].activeCopierCount--;
    }

    /**
     * @inheritdoc IShadowRegistry
     */
    function addFeesEarned(address leaderAddress, uint256 feeAmount)
        external
        override
        onlyFeeManager
    {
        require(leaders[leaderAddress].isActive, "Leader not active");
        leaders[leaderAddress].totalFeesEarned += feeAmount;
    }

    /**
     * @notice Get leader address by ENS name
     * @param ensName The ENS name to look up
     * @return leaderAddress The associated leader address
     */
    function getLeaderByENS(string calldata ensName)
        external
        view
        returns (address leaderAddress)
    {
        return ensToAddress[ensName];
    }
}
