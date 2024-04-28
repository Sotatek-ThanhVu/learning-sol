// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

interface ISwapEvent {
    event CreateSwap(uint256 orderId);
    event CanceledRequest(uint256 orderId);
    event AcceptedRequest(uint256 orderId);
    event RejectedRequest(uint256 orderId);
    event UpdateTax(uint256 tax);
    event UpdateTreasury(address treasury);
}
