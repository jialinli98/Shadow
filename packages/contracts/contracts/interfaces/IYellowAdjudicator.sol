// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IYellowAdjudicator
 * @notice Interface for Yellow Network's adjudicator contract
 * @dev Based on ERC-7824 state channel specification
 */
interface IYellowAdjudicator {
    struct ChannelState {
        address[] participants;
        uint256 nonce;
        bytes32 stateHash;
        uint256[] balances;
    }

    /**
     * @notice Get the current state of a channel
     * @param channelId The unique identifier of the channel
     * @return state The current channel state
     */
    function getChannelState(bytes32 channelId) external view returns (ChannelState memory state);

    /**
     * @notice Verify a state update signature
     * @param channelId The channel identifier
     * @param state The proposed state
     * @param signatures Array of participant signatures
     * @return valid True if all signatures are valid
     */
    function verifyState(
        bytes32 channelId,
        ChannelState memory state,
        bytes[] memory signatures
    ) external view returns (bool valid);

    /**
     * @notice Close a channel and settle final balances
     * @param channelId The channel identifier
     * @param finalState The final channel state
     * @param signatures Signatures from all participants
     */
    function closeChannel(
        bytes32 channelId,
        ChannelState memory finalState,
        bytes[] memory signatures
    ) external;

    /**
     * @notice Initiate a challenge period for disputed state
     * @param channelId The channel identifier
     * @param state The disputed state
     * @param signatures Participant signatures
     */
    function challengeState(
        bytes32 channelId,
        ChannelState memory state,
        bytes[] memory signatures
    ) external;

    event ChannelClosed(bytes32 indexed channelId, uint256[] finalBalances);
    event StateChallenged(bytes32 indexed channelId, uint256 nonce);
}
