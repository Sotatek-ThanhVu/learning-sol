// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./Types.sol";

library Events {
    event BlockUser(address indexed user, uint40 timestamp);

    event UnblockUser(address indexed user, uint40 timestamp);

    event TreasurySet(
        address indexed prevTreasury,
        address indexed newTreasury,
        uint40 timestamp
    );

    event ListNft(
        address indexed owner,
        address indexed nftContract,
        address indexed acceptToken,
        uint256 nftId,
        uint256 price,
        uint256 amount,
        uint256 listingCount,
        Types.NftKind nftKind,
        Types.SellKind sellKind
    );

    event CancelListNft(
        address indexed owner,
        address indexed nftContract,
        uint256 nftId
    );

    event PlaceBidNft(
        address indexed oldBidder,
        address indexed newBidder,
        address indexed nftContract,
        uint256 nftId,
        uint256 amount,
        uint256 oldBid,
        uint256 newBid
    );

    event BuyNft(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256 nftId,
        uint256 amount,
        uint256 price
    );

    event TreasurySellerFeeSet(
        uint16 prevTreasurySellerFee,
        uint16 newTreasurySellerFee,
        uint256 timestamp
    );

    event TreasuryBuyerFeeSet(
        uint16 prevTreasuryBuyerFee,
        uint16 newTreasuryBuyerFee,
        uint256 timestamp
    );

    event WithdrawLockAmount(address indexed caller, uint256 value);
}
