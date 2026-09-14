// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MemeToken} from "./MemeToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TokenFactory
/// @notice Deterministically (CREATE2) deploys MemeToken contracts.
///         Only the launchpad may create tokens so that the launch flow
///         (mint supply -> fund LP -> return LP tokens to creator) is atomic.
contract TokenFactory is Ownable {
    address public launchpad;

    address[] public allTokens;
    mapping(address => bool) public isToken;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 supply
    );

    constructor() Ownable(msg.sender) {}

    /// @notice One-time wiring: point this factory at the Launchpad contract.
    function setLaunchpad(address launchpad_) external onlyOwner {
        require(launchpad_ != address(0), "TF: zero");
        require(launchpad == address(0), "TF: already set");
        launchpad = launchpad_;
    }

    modifier onlyLaunchpad() {
        require(msg.sender == launchpad, "TF: not launchpad");
        _;
    }

    /// @notice Deploys a new token, mints `supply_` to the launchpad,
    ///         and records it in the registry.
    function createToken(
        string calldata name_,
        string calldata symbol_,
        address creator,
        uint256 supply_
    ) external onlyLaunchpad returns (address token) {
        require(bytes(name_).length > 0 && bytes(symbol_).length > 0, "TF: empty");
        require(creator != address(0), "TF: zero creator");

        bytes32 salt = keccak256(abi.encodePacked(block.chainid, name_, symbol_, allTokens.length));
        token = address(
            new MemeToken{salt: salt}(name_, symbol_, creator, launchpad, supply_)
        );

        isToken[token] = true;
        allTokens.push(token);

        emit TokenCreated(token, creator, name_, symbol_, supply_);
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }
}
