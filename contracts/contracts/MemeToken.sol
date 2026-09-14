// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MemeToken
/// @notice ERC-20 token minted by users through the MemePad launchpad.
///         The creator owns the token (can mint more up to MAX_SUPPLY, set up
///         future tokenomics, etc.) while the initial supply is used for LP.
contract MemeToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18; // 1B tokens

    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        address initialMintTo_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        require(initialSupply_ <= MAX_SUPPLY, "MT: exceeds max supply");
        _mint(initialMintTo_, initialSupply_);
    }

    /// @notice Creator-only mint, capped at MAX_SUPPLY.
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "MT: exceeds max supply");
        _mint(to, amount);
    }

    /// @notice Anyone can burn their own tokens.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
