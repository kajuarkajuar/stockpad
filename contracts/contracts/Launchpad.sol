// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TokenFactory} from "./TokenFactory.sol";
import {StockPairFactory} from "./StockPairFactory.sol";
import {StockPair} from "./StockPair.sol";

/// @title Launchpad
/// @notice Core "fair-launch" flow:
///         1. creator picks name/symbol, total supply, and a Stock Token
///            (NVDA, AAPL, TSLA ... any ERC-20) to pair against;
///         2. contract deploys the coin, seeds 100% of supply + the creator's
///            Stock Tokens into a fresh AMM pool;
///         3. creator receives the LP tokens. No pre-sale, no team allocation.
contract Launchpad is Ownable, ReentrancyGuard {
    TokenFactory public immutable tokenFactory;
    StockPairFactory public immutable pairFactory;

    uint256 public creationFee; // ETH, withdrawable by owner

    struct Coin {
        address token;
        address pair;
        address stockToken; // the quote asset (e.g. NVDA Stock Token)
        address creator;
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 stockAmount; // how much of the Stock Token seeded the pool
        uint256 createdAt;
    }

    Coin[] public coins;
    mapping(address => bool) public isCoinToken; // token -> registered

    event CoinCreated(
        uint256 indexed id,
        address indexed token,
        address indexed pair,
        address stockToken,
        address creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 stockAmount
    );

    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(address tokenFactory_, address pairFactory_) Ownable(msg.sender) {
        tokenFactory = TokenFactory(tokenFactory_);
        pairFactory = StockPairFactory(pairFactory_);
    }

    function setCreationFee(uint256 fee_) external onlyOwner {
        emit CreationFeeUpdated(creationFee, fee_);
        creationFee = fee_;
    }

    function withdraw(address token_, uint256 amount_) external onlyOwner {
        if (token_ == address(0)) {
            payable(msg.sender).transfer(amount_);
        } else {
            IERC20(token_).transfer(msg.sender, amount_);
        }
    }

    /// @notice Create a coin and instantly provide liquidity against a Stock Token.
    /// @dev Creator must `approve` this contract for `stockAmount_` of `stockToken_`
    ///      and send `creationFee` in ETH (if any).
    function createCoin(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        address stockToken_,
        uint256 stockAmount_
    )
        external
        payable
        nonReentrant
        returns (address token, address pair, uint256 id)
    {
        require(msg.value >= creationFee, "LP: insufficient fee");
        require(stockToken_ != address(0), "LP: zero stock");
        require(totalSupply_ > 0 && stockAmount_ > 0, "LP: zero amount");

        // 1. deploy the coin; initial supply is minted to this contract
        token = tokenFactory.createToken(name_, symbol_, msg.sender, totalSupply_);

        // 2. create the AMM pool (coin / Stock Token)
        pair = pairFactory.createPair(token, stockToken_);

        // 3. seed liquidity: pull Stock Tokens from creator, push both sides to the pool
        IERC20(stockToken_).transferFrom(msg.sender, address(this), stockAmount_);
        IERC20(stockToken_).transfer(pair, stockAmount_);
        IERC20(token).transfer(pair, totalSupply_);

        // 4. mint LP tokens to the creator
        StockPair(pair).mint(msg.sender);

        id = coins.length;
        coins.push(
            Coin({
                token: token,
                pair: pair,
                stockToken: stockToken_,
                creator: msg.sender,
                name: name_,
                symbol: symbol_,
                totalSupply: totalSupply_,
                stockAmount: stockAmount_,
                createdAt: block.timestamp
            })
        );
        isCoinToken[token] = true;

        emit CoinCreated(id, token, pair, stockToken_, msg.sender, name_, symbol_, totalSupply_, stockAmount_);
    }

    function coinCount() external view returns (uint256) {
        return coins.length;
    }
}
