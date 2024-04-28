// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./ISwapEvent.sol";

contract SwapCenter is ISwapEvent, Ownable {
    using SafeERC20 for IERC20;

    enum OrderStatus {
        WAITING,
        ACCEPTED,
        REJECTED,
        CANCELED
    }

    struct Order {
        address sourceAddr;
        address desAddr;
        address sourceToken;
        address desToken;
        uint256 sourceAmount;
        uint256 desAmount;
        OrderStatus status;
    }

    address public treasury;
    uint256 public tax;
    mapping(uint256 => Order) private _orders;

    constructor(address treasury_, uint256 tax_) Ownable(_msgSender()) {
        treasury = treasury_;
        tax = tax_;
    }

    modifier onlyWaitingOrder(uint256 orderId) {
        require(
            OrderStatus.WAITING == _orders[orderId].status,
            "Only waiting order can be modified"
        );
        _;
    }

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }

    function swap(
        address desAddr,
        address sourceToken,
        address desToken,
        uint256 sourceAmount,
        uint256 desAmount,
        uint256 orderId
    ) external {
        require(
            _orders[orderId].sourceAddr == address(0),
            "Order already exists"
        );

        IERC20(sourceToken).transferFrom(
            _msgSender(),
            address(this),
            sourceAmount
        );
        _orders[orderId] = Order(
            _msgSender(),
            desAddr,
            sourceToken,
            desToken,
            sourceAmount,
            desAmount,
            OrderStatus.WAITING
        );

        emit CreateSwap(orderId);
    }

    function cancelOrder(uint256 orderId) external onlyWaitingOrder(orderId) {
        require(
            _msgSender() == _orders[orderId].sourceAddr,
            "Order can be canceled only by its owner"
        );

        IERC20(_orders[orderId].sourceToken).approve(
            address(this),
            _orders[orderId].sourceAmount
        );
        IERC20(_orders[orderId].sourceToken).transfer(
            _msgSender(),
            _orders[orderId].sourceAmount
        );
        _orders[orderId].status = OrderStatus.CANCELED;

        emit CanceledRequest(orderId);
    }

    function fulfillOrder(
        uint256 orderId,
        OrderStatus status
    ) external onlyWaitingOrder(orderId) {
        require(
            _msgSender() == _orders[orderId].desAddr,
            "Order can be fulfilled only by its receiver"
        );
        require(
            OrderStatus.ACCEPTED == status || OrderStatus.REJECTED == status,
            "Only ACCEPTED or REJECTED are allowed"
        );

        if (OrderStatus.ACCEPTED == status) _acceptOrder(orderId);
        else _rejectOrder(orderId);
    }

    function _acceptOrder(uint256 orderId) private {
        // Transfer `desAmount` tokens `desToken` from `desAddr` to `this`
        IERC20(_orders[orderId].desToken).transferFrom(
            _msgSender(),
            address(this),
            _orders[orderId].desAmount
        );

        // Transfer `_tax`% tokens `sourceToken` from `this` to treasury address
        IERC20(_orders[orderId].sourceToken).approve(
            address(this),
            (_orders[orderId].sourceAmount / 100) * tax
        );
        IERC20(_orders[orderId].sourceToken).transfer(
            treasury,
            (_orders[orderId].sourceAmount / 100) * tax
        );

        // Transfer token `sourceToken` left from `this` to `desAddr`
        IERC20(_orders[orderId].sourceToken).approve(
            address(this),
            (_orders[orderId].sourceAmount / 100) * (100 - tax)
        );
        IERC20(_orders[orderId].sourceToken).transfer(
            _msgSender(),
            (_orders[orderId].sourceAmount / 100) * (100 - tax)
        );

        // Transfer `_tax`% tokens `desToken` from `this` to treasury address
        IERC20(_orders[orderId].desToken).approve(
            address(this),
            (_orders[orderId].desAmount / 100) * tax
        );
        IERC20(_orders[orderId].desToken).transfer(
            treasury,
            (_orders[orderId].desAmount / 100) * tax
        );

        // Transfer token `desToken` left from `this` to `sourceAddr`
        IERC20(_orders[orderId].desToken).approve(
            address(this),
            (_orders[orderId].desAmount / 100) * (100 - tax)
        );
        IERC20(_orders[orderId].desToken).transfer(
            _orders[orderId].sourceAddr,
            (_orders[orderId].desAmount / 100) * (100 - tax)
        );

        _orders[orderId].status = OrderStatus.ACCEPTED;
        emit AcceptedRequest(orderId);
    }

    function _rejectOrder(uint256 orderId) private {
        // Transfer `sourceAmount` tokens `sourceToken` from `this` back to `sourceAddr`
        IERC20(_orders[orderId].sourceToken).approve(
            address(this),
            _orders[orderId].sourceAmount
        );
        IERC20(_orders[orderId].sourceToken).transfer(
            _orders[orderId].sourceAddr,
            _orders[orderId].sourceAmount
        );

        _orders[orderId].status = OrderStatus.REJECTED;
        emit RejectedRequest(orderId);
    }

    function setTax(uint256 tax_) external onlyOwner {
        tax = tax_;
        emit UpdateTax(tax);
    }

    function setTreasury(address treasury_) external onlyOwner {
        treasury = treasury_;
        emit UpdateTreasury(treasury);
    }
}
