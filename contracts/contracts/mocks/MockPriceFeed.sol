// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Settable Chainlink-style feed for tests.
contract MockPriceFeed {
    int256 public answer;
    uint8 public constant decimals = 8;
    uint256 public updatedAt;

    function setAnswer(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 _answer,
            uint256 startedAt,
            uint256 _updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, answer, block.timestamp, updatedAt, 1);
    }
}
