// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {TokenFactory} from "./TokenFactory.sol";
import {StockPairFactory} from "./StockPairFactory.sol";
import {StockPair} from "./StockPair.sol";

/// @title Launchpad (pons.family-style economics on a bonding curve)
/// @notice Fair-launch flow:
///         1. creator pays a flat launch fee in ETH (default 0.0005 ETH) and picks
///            a quote token (e.g. NVDA Stock Token);
///         2. a 1B-supply coin is minted onto a constant-product bonding curve —
///            no upfront liquidity, no team allocation, no pre-sale;
///         3. anyone buys/sells on the curve (1% fee each side). A configurable
///            share of that fee accrues to the creator (fee split fixed at launch);
///         4. once the curve collects the graduation target in quote tokens, the
///            remaining supply + collected quote migrate to an AMM pool and the
///            LP is burned (liquidity locked forever).
///         An optional dev buy lets the creator (or anyone) buy in the same tx —
///         there is never a free allocation.
contract Launchpad is Ownable, ReentrancyGuard {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18; // 1B, fixed
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_073_000_000e18; // curve math seed
    uint256 public constant FEE_BPS = 100; // 1% per buy & sell
    uint256 public constant BPS = 10000;
    uint256 public constant MAX_CREATOR_FEE_BPS = 10000; // creator can take up to 100% of the fee
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    TokenFactory public immutable tokenFactory;
    StockPairFactory public immutable pairFactory;

    uint256 public launchFee; // ETH (native), owner-configurable — pons-style flat fee

    struct Curve {
        address token;
        address quote; // quote ERC-20 (e.g. NVDA Stock Token)
        address creator;
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 quoteDecimals;
        uint256 virtualTokenReserve;
        uint256 virtualQuoteReserve;
        uint256 realTokenReserve; // tokens still on the curve
        uint256 realQuoteReserve; // quote collected on the curve (towards graduation)
        uint256 graduationTarget; // raw quote units -> graduate
        uint256 createdAt;
        bool graduated;
        address pair; // AMM pool after graduation
        uint256 creatorFeeBps; // creator's share of the 1% trading fee (bps of the fee)
        uint256 creatorAccrued; // quote tokens owed to the creator
    }

    Curve[] public curves;
    mapping(address => uint256) private curveIndexByToken; // token -> index + 1

    event Launched(
        uint256 indexed index,
        address indexed token,
        address quote,
        address creator,
        string name,
        string symbol,
        uint256 graduationTarget,
        uint256 creatorFeeBps
    );
    event Buy(uint256 indexed index, address indexed buyer, uint256 quoteIn, uint256 tokenOut, uint256 fee);
    event Sell(uint256 indexed index, address indexed seller, uint256 tokenIn, uint256 quoteOut, uint256 fee);
    event Graduated(uint256 indexed index, address token, address pair, uint256 quoteMigrated, uint256 tokensMigrated);
    event CreatorFeesClaimed(uint256 indexed index, address creator, uint256 amount);
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);

    constructor(address tokenFactory_, address pairFactory_) Ownable(msg.sender) {
        tokenFactory = TokenFactory(tokenFactory_);
        pairFactory = StockPairFactory(pairFactory_);
        launchFee = 0.0005 ether; // pons-style flat fee
    }

    function setLaunchFee(uint256 fee_) external onlyOwner {
        emit LaunchFeeUpdated(launchFee, fee_);
        launchFee = fee_;
    }

    function withdraw(address token_, uint256 amount_) external onlyOwner {
        if (token_ == address(0)) {
            payable(msg.sender).transfer(amount_);
        } else {
            IERC20(token_).transfer(msg.sender, amount_);
        }
    }

    /// @notice Launch a new coin onto its bonding curve. Paid in ETH.
    /// @param seedQuote_        virtual quote reserve at launch (sets the initial price).
    /// @param graduationTarget_ quote units the curve must collect before graduating.
    /// @param creatorFeeBps_    creator's share of the 1% trading fee (0..10000 bps).
    function launch(
        string calldata name_,
        string calldata symbol_,
        address quote_,
        uint256 seedQuote_,
        uint256 graduationTarget_,
        uint256 creatorFeeBps_
    ) external payable nonReentrant returns (uint256 index) {
        require(msg.value >= launchFee, "LP: insufficient fee");
        require(quote_ != address(0), "LP: zero quote");
        require(seedQuote_ > 0, "LP: zero seed");
        require(graduationTarget_ > seedQuote_, "LP: bad target");
        require(creatorFeeBps_ <= MAX_CREATOR_FEE_BPS, "LP: bad fee share");

        address token = tokenFactory.createToken(name_, symbol_, msg.sender, TOTAL_SUPPLY);

        uint256 qDec = IERC20Metadata(quote_).decimals();

        index = curves.length;
        curves.push(
            Curve({
                token: token,
                quote: quote_,
                creator: msg.sender,
                name: name_,
                symbol: symbol_,
                totalSupply: TOTAL_SUPPLY,
                quoteDecimals: qDec,
                virtualTokenReserve: VIRTUAL_TOKEN_RESERVE,
                virtualQuoteReserve: seedQuote_,
                realTokenReserve: TOTAL_SUPPLY,
                realQuoteReserve: 0,
                graduationTarget: graduationTarget_,
                createdAt: block.timestamp,
                graduated: false,
                pair: address(0),
                creatorFeeBps: creatorFeeBps_,
                creatorAccrued: 0
            })
        );
        curveIndexByToken[token] = index + 1;

        emit Launched(index, token, quote_, msg.sender, name_, symbol_, graduationTarget_, creatorFeeBps_);
    }

    // ── curve math (views) ──────────────────────────────────────────────────

    function curveOf(address token) public view returns (uint256 index) {
        index = curveIndexByToken[token];
        require(index != 0, "LP: not a curve token");
        index -= 1;
    }

    /// @notice tokens out for a given quote input (fee applied).
    function getBuyQuote(uint256 index, uint256 quoteIn)
        public
        view
        returns (uint256 tokenOut, uint256 fee)
    {
        Curve storage c = curves[index];
        require(!c.graduated, "LP: graduated");
        fee = (quoteIn * FEE_BPS) / BPS;
        uint256 net = quoteIn - fee;
        tokenOut = (c.virtualTokenReserve * net) / (c.virtualQuoteReserve + net);
    }

    /// @notice quote out for a given token input (fee applied).
    function getSellQuote(uint256 index, uint256 tokenIn)
        public
        view
        returns (uint256 quoteOut, uint256 fee)
    {
        Curve storage c = curves[index];
        require(!c.graduated, "LP: graduated");
        quoteOut = (c.virtualQuoteReserve * tokenIn) / (c.virtualTokenReserve + tokenIn);
        fee = (quoteOut * FEE_BPS) / BPS;
    }

    /// @notice implied price in quote units per token (18-dec normalized).
    function priceOf(uint256 index) public view returns (uint256) {
        Curve storage c = curves[index];
        if (c.graduated) return 0; // use AMM reserves after graduation
        return (c.virtualQuoteReserve * 1e18) / c.virtualTokenReserve;
    }

    /// @notice implied market cap (price × total supply) in raw quote units.
    function marketCapOf(uint256 index) public view returns (uint256) {
        Curve storage c = curves[index];
        if (c.graduated) return 0;
        return (c.virtualQuoteReserve * c.totalSupply) / c.virtualTokenReserve;
    }

    /// @notice graduation progress, 0..1e18 (capped at 1e18).
    function progressOf(uint256 index) public view returns (uint256) {
        Curve storage c = curves[index];
        if (c.graduated) return 1e18;
        uint256 p = (c.realQuoteReserve * 1e18) / c.graduationTarget;
        return p > 1e18 ? 1e18 : p;
    }

    // ── trading ──────────────────────────────────────────────────────────────

    /// @notice Buy with the quote token (Stock Token). Auto-graduates when full.
    function buy(uint256 index, uint256 quoteIn, uint256 minTokenOut)
        external
        nonReentrant
        returns (uint256 tokenOut)
    {
        Curve storage c = curves[index];
        require(!c.graduated, "LP: graduated");
        require(quoteIn > 0, "LP: zero in");

        uint256 fee;
        (tokenOut, fee) = getBuyQuote(index, quoteIn);
        require(tokenOut >= minTokenOut, "LP: slippage");

        IERC20(c.quote).transferFrom(msg.sender, address(this), quoteIn);

        uint256 net = quoteIn - fee;
        _accrueFee(c, fee);

        c.realQuoteReserve += net;
        c.realTokenReserve -= tokenOut;
        c.virtualQuoteReserve += net;
        c.virtualTokenReserve -= tokenOut;

        IERC20(c.token).transfer(msg.sender, tokenOut);

        emit Buy(index, msg.sender, quoteIn, tokenOut, fee);
        _maybeGraduate(index);
    }

    /// @notice Sell back into the curve for the quote token.
    function sell(uint256 index, uint256 tokenIn, uint256 minQuoteOut)
        external
        nonReentrant
        returns (uint256 quoteNet)
    {
        Curve storage c = curves[index];
        require(!c.graduated, "LP: graduated");
        require(tokenIn > 0, "LP: zero in");

        uint256 quoteOut;
        uint256 fee;
        (quoteOut, fee) = getSellQuote(index, tokenIn);
        quoteNet = quoteOut - fee;
        require(quoteNet >= minQuoteOut, "LP: slippage");

        IERC20(c.token).transferFrom(msg.sender, address(this), tokenIn);

        c.realTokenReserve += tokenIn;
        c.realQuoteReserve -= quoteOut;
        c.virtualTokenReserve += tokenIn;
        c.virtualQuoteReserve -= quoteOut;

        _accrueFee(c, fee);

        IERC20(c.quote).transfer(msg.sender, quoteNet);

        emit Sell(index, msg.sender, tokenIn, quoteOut, fee);
    }

    /// @notice Creator withdraws their accrued fee share.
    function claimFees(uint256 index) external nonReentrant {
        Curve storage c = curves[index];
        require(msg.sender == c.creator, "LP: not creator");
        uint256 amt = c.creatorAccrued;
        require(amt > 0, "LP: nothing");
        c.creatorAccrued = 0;
        IERC20(c.quote).transfer(msg.sender, amt);
        emit CreatorFeesClaimed(index, msg.sender, amt);
    }

    // ── graduation ───────────────────────────────────────────────────────────

    function _accrueFee(Curve storage c, uint256 fee) internal {
        uint256 creatorCut = (fee * c.creatorFeeBps) / BPS;
        c.creatorAccrued += creatorCut; // protocol's share stays in the contract
    }

    function _maybeGraduate(uint256 index) internal {
        Curve storage c = curves[index];
        if (c.graduated) return;
        if (c.realQuoteReserve < c.graduationTarget) return;

        c.graduated = true;
        uint256 tokensOut = c.realTokenReserve;
        uint256 quoteOut = c.realQuoteReserve;
        c.realTokenReserve = 0;
        c.realQuoteReserve = 0;

        address pair = pairFactory.createPair(c.token, c.quote);
        c.pair = pair;

        // migrate: unsold tokens + collected quote become the AMM's initial LP
        IERC20(c.token).transfer(pair, tokensOut);
        IERC20(c.quote).transfer(pair, quoteOut);
        uint256 lp = StockPair(pair).mint(address(this));
        StockPair(pair).transfer(DEAD, lp); // burn LP — liquidity locked forever

        emit Graduated(index, c.token, pair, quoteOut, tokensOut);
    }

    /// @notice Manual graduation trigger (e.g. if auto-graduation was not reached
    ///         in a buy tx, or after sells changed the state).
    function graduate(uint256 index) external nonReentrant {
        require(curves[index].realQuoteReserve >= curves[index].graduationTarget, "LP: not ready");
        _maybeGraduate(index);
    }

    function curveCount() external view returns (uint256) {
        return curves.length;
    }
}
