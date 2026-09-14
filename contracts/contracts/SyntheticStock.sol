// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IChainlinkFeed} from "./interfaces/IChainlinkFeed.sol";

/// @title SyntheticStock
/// @notice Optional building block: a collateral-backed ERC-20 that tracks the
///         USD price of a real stock via a Chainlink feed (for tickers that do
///         not yet have a native Robinhood Stock Token).
///
///         mint()  : deposit USDC -> receive 1:1 USD value in shares
///         redeem(): burn shares      -> receive USDC at the current price
///
///         NOTE (production): this is a simplified design for demonstration.
///         A production synthetic needs circuit breakers, market-hours handling,
///         staleness checks, and a liquidation/collateralisation framework.
contract SyntheticStock is ERC20, Ownable, ReentrancyGuard {
    IERC20 public immutable collateral; // USDC (6 decimals)
    uint8 private immutable collateralDecimals;

    IChainlinkFeed public feed; // USD price of 1 share, 8 decimals

    event Minted(address indexed user, uint256 collateralIn, uint256 sharesOut);
    event Redeemed(address indexed user, uint256 collateralOut, uint256 sharesIn);
    event FeedUpdated(address oldFeed, address newFeed);

    constructor(
        string memory name_,
        string memory symbol_,
        address collateral_,
        address feed_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        collateral = IERC20(collateral_);
        collateralDecimals = IERC20Metadata(collateral_).decimals();
        feed = IChainlinkFeed(feed_);
    }

    function setFeed(address feed_) external onlyOwner {
        require(feed_ != address(0), "SS: zero feed");
        emit FeedUpdated(address(feed), feed_);
        feed = IChainlinkFeed(feed_);
    }

    /// @notice Latest price in 8-decimal USD.
    function price() public view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
        require(answer > 0, "SS: bad price");
        require(block.timestamp - updatedAt < 1 days, "SS: stale price");
        return uint256(answer);
    }

    /// @notice shares (18dp) = collateralAmount * 10^(8+18-collateralDecimals) / price(8dp)
    function sharesFor(uint256 collateralAmount) public view returns (uint256) {
        uint256 p = price();
        return (collateralAmount * (10 ** (8 + 18 - collateralDecimals))) / p;
    }

    /// @notice collateralOut = shares * price * 10^collateralDecimals / 10^(8+18)
    function collateralFor(uint256 shares) public view returns (uint256) {
        uint256 p = price();
        return (shares * p * (10 ** collateralDecimals)) / (10 ** (8 + 18));
    }

    function mint(uint256 collateralAmount) external nonReentrant returns (uint256 shares) {
        shares = sharesFor(collateralAmount);
        require(shares > 0, "SS: zero shares");
        collateral.transferFrom(msg.sender, address(this), collateralAmount);
        _mint(msg.sender, shares);
        emit Minted(msg.sender, collateralAmount, shares);
    }

    function redeem(uint256 shares) external nonReentrant returns (uint256 collateralOut) {
        require(shares > 0, "SS: zero shares");
        collateralOut = collateralFor(shares);
        require(collateralOut > 0, "SS: dust");
        _burn(msg.sender, shares);
        collateral.transfer(msg.sender, collateralOut);
        emit Redeemed(msg.sender, collateralOut, shares);
    }
}
