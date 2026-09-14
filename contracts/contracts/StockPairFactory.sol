// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StockPair} from "./StockPair.sol";

/// @title StockPairFactory
/// @notice Deploys StockPair AMM pools via CREATE2 with a deterministic salt
///         (sorted token addresses), so getPair() is computed without storage lookups.
contract StockPairFactory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 length);

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "PF: identical");
        require(tokenA != address(0) && tokenB != address(0), "PF: zero");
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(getPair[t0][t1] == address(0), "PF: pair exists");

        bytes32 salt = keccak256(abi.encodePacked(t0, t1));
        pair = address(new StockPair{salt: salt}(t0, t1));

        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair;
        allPairs.push(pair);

        emit PairCreated(t0, t1, pair, allPairs.length);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}
