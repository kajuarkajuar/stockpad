// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title StockPair
/// @notice Minimal constant-product AMM (Uniswap V2 style) that can pair any
///         ERC-20 with any other ERC-20 — e.g. a freshly created coin against a
///         Robinhood Chain Stock Token (NVDA / AAPL / TSLA / ...).
///         The pair contract itself is the LP token.
contract StockPair is ERC20, ReentrancyGuard {
    uint256 public constant MINIMUM_LIQUIDITY = 1e3;
    uint256 public constant FEE_BPS = 30; // 0.30% swap fee -> LP

    address public immutable factory;
    address public immutable token0; // sorted: token0 < token1
    address public immutable token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );

    constructor(address tokenA, address tokenB) ERC20("MemePad LP", "MP-LP") {
        factory = msg.sender;
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "SP: forbidden");
        _;
    }

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    function getReserves()
        public
        view
        returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast)
    {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    /// @notice Quote helper (view) used by the UI and the Router.
    function getAmountOut(uint256 amountIn, bool zeroForOne) public view returns (uint256 amountOut) {
        require(amountIn > 0, "SP: zero in");
        (uint112 r0, uint112 r1, ) = getReserves();
        (uint256 reserveIn, uint256 reserveOut) = zeroForOne
            ? (uint256(r0), uint256(r1))
            : (uint256(r1), uint256(r0));
        require(reserveIn > 0 && reserveOut > 0, "SP: no liquidity");
        uint256 amountInWithFee = amountIn * (10000 - FEE_BPS);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 10000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /// @notice Mint LP shares. Caller must have transferred the token amounts
    ///         to this contract beforehand (Router / Launchpad do this).
    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        (uint112 r0, uint112 r1, ) = getReserves();
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = bal0 - r0;
        uint256 amount1 = bal1 - r1;

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY); // permanently lock
        } else {
            liquidity = Math.min((amount0 * _totalSupply) / r0, (amount1 * _totalSupply) / r1);
        }
        require(liquidity > 0, "SP: insufficient liquidity");

        _mint(to, liquidity);
        _update(bal0, bal1);
        emit Mint(msg.sender, amount0, amount1);
    }

    /// @notice Burn LP shares and return underlying. Caller must transfer LP
    ///         tokens to this contract first (Router does this).
    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        uint256 _totalSupply = totalSupply();
        amount0 = (liquidity * bal0) / _totalSupply;
        amount1 = (liquidity * bal1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "SP: insufficient liquidity");

        _burn(address(this), liquidity);
        IERC20(token0).transfer(to, amount0);
        IERC20(token1).transfer(to, amount1);

        bal0 = IERC20(token0).balanceOf(address(this));
        bal1 = IERC20(token1).balanceOf(address(this));
        _update(bal0, bal1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /// @notice Low-level swap. Caller transfers tokenIn first; specify the
    ///         desired output amount. Enforces the k-invariant with the fee.
    function swap(uint256 amount0Out, uint256 amount1Out, address to) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "SP: insufficient output");
        require(amount0Out < reserve0 && amount1Out < reserve1, "SP: insufficient liquidity");
        require(to != token0 && to != token1, "SP: invalid to");

        if (amount0Out > 0) IERC20(token0).transfer(to, amount0Out);
        if (amount1Out > 0) IERC20(token1).transfer(to, amount1Out);

        uint256 bal0 = IERC20(token0).balanceOf(address(this));
        uint256 bal1 = IERC20(token1).balanceOf(address(this));

        uint256 amount0In = bal0 > reserve0 - amount0Out ? bal0 - (reserve0 - amount0Out) : 0;
        uint256 amount1In = bal1 > reserve1 - amount1Out ? bal1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "SP: insufficient input");

        uint256 bal0Adj = bal0 * 10000 - amount0In * FEE_BPS;
        uint256 bal1Adj = bal1 * 10000 - amount1In * FEE_BPS;
        require(
            bal0Adj * bal1Adj >= uint256(reserve0) * uint256(reserve1) * (10000 ** 2),
            "SP: k"
        );

        _update(bal0, bal1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "SP: overflow");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        unchecked {
            blockTimestampLast = uint32(block.timestamp % 2 ** 32);
        }
    }
}
