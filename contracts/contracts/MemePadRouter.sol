// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StockPair} from "./StockPair.sol";
import {StockPairFactory} from "./StockPairFactory.sol";

/// @title MemePadRouter
/// @notice One-transaction helpers for adding/removing liquidity and swapping.
///         Paths are single-hop (token <-> Stock Token) in v1.
contract MemePadRouter {
    address public immutable factory;

    constructor(address factory_) {
        factory = factory_;
    }

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "R: expired");
        _;
    }

    function _pair(address tokenA, address tokenB) private view returns (StockPair pair) {
        pair = StockPair(StockPairFactory(factory).getPair(tokenA, tokenB));
        require(address(pair) != address(0), "R: no pair");
    }

    function _sort(address a, address b) private pure returns (address t0, address t1) {
        (t0, t1) = a < b ? (a, b) : (b, a);
    }

    function _quote(uint256 amountA, uint256 reserveA, uint256 reserveB)
        private
        pure
        returns (uint256 amountB)
    {
        require(amountA > 0 && reserveA > 0 && reserveB > 0, "R: invalid");
        amountB = (amountA * reserveB) / reserveA;
    }

    /// @notice Add liquidity with optimal amounts; refunds are unnecessary because
    ///         only the optimal amount is transferred. Approve `amountADesired`/`amountBDesired`.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (address t0, address t1) = _sort(tokenA, tokenB);
        StockPair pair = _pair(tokenA, tokenB);
        (uint112 r0, uint112 r1, ) = pair.getReserves();

        if (r0 == 0 && r1 == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = _quote(amountADesired, r0, r1);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "R: insufficient B");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = _quote(amountBDesired, r1, r0);
                require(amountAOptimal <= amountADesired, "R: excessive A");
                require(amountAOptimal >= amountAMin, "R: insufficient A");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        IERC20(t0).transferFrom(msg.sender, address(pair), amountA);
        IERC20(t1).transferFrom(msg.sender, address(pair), amountB);
        liquidity = pair.mint(to);
    }

    /// @notice Remove liquidity. Approve `liquidity` LP tokens first.
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        StockPair pair = _pair(tokenA, tokenB);
        (address t0, address t1) = _sort(tokenA, tokenB);

        IERC20(address(pair)).transferFrom(msg.sender, address(pair), liquidity);
        (uint256 a0, uint256 a1) = pair.burn(to);

        // pair returns amounts in (token0, token1) order
        amountA = tokenA == t0 ? a0 : a1;
        amountB = tokenB == t1 ? a1 : a0;
        require(amountA >= amountAMin, "R: insufficient A");
        require(amountB >= amountBMin, "R: insufficient B");
    }

    /// @notice Swap exact input for output (single hop). Approve `amountIn`.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address tokenIn,
        address tokenOut,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountOut) {
        StockPair pair = _pair(tokenIn, tokenOut);
        bool zeroForOne = pair.token0() == tokenIn;
        amountOut = pair.getAmountOut(amountIn, zeroForOne);
        require(amountOut >= amountOutMin, "R: slippage");

        IERC20(tokenIn).transferFrom(msg.sender, address(pair), amountIn);
        if (zeroForOne) {
            pair.swap(0, amountOut, to);
        } else {
            pair.swap(amountOut, 0, to);
        }
    }
}
