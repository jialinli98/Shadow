// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IYellowAdjudicator.sol";

/**
 * @title MockYellowAdjudicator
 * @notice Mock Yellow Network adjudicator for testing
 */
contract MockYellowAdjudicator is IYellowAdjudicator {
    mapping(bytes32 => ChannelState) private channels;
    mapping(bytes32 => bool) private channelClosed;

    function setChannelState(
        bytes32 channelId,
        address[] memory participants,
        uint256 nonce,
        bytes32 stateHash,
        uint256[] memory balances
    ) external {
        channels[channelId] = ChannelState({
            participants: participants,
            nonce: nonce,
            stateHash: stateHash,
            balances: balances
        });
    }

    function getChannelState(bytes32 channelId)
        external
        view
        override
        returns (ChannelState memory state)
    {
        return channels[channelId];
    }

    function verifyState(
        bytes32 channelId,
        ChannelState memory state,
        bytes[] memory signatures
    ) external view override returns (bool valid) {
        // Mock implementation always returns true
        return true;
    }

    function closeChannel(
        bytes32 channelId,
        ChannelState memory finalState,
        bytes[] memory signatures
    ) external override {
        require(!channelClosed[channelId], "Channel already closed");

        channels[channelId] = finalState;
        channelClosed[channelId] = true;

        emit ChannelClosed(channelId, finalState.balances);
    }

    function challengeState(
        bytes32 channelId,
        ChannelState memory state,
        bytes[] memory signatures
    ) external override {
        channels[channelId] = state;
        emit StateChallenged(channelId, state.nonce);
    }

    function isChannelClosed(bytes32 channelId) external view returns (bool) {
        return channelClosed[channelId];
    }
}
