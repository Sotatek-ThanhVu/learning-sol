// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

library Errors {
    // Param section
    error InvalidParams();

    // Authorize section
    error InvalidOwner();
    error MarketplaceNotApproved();
    error UserNotApproved();

    // NFT section
    error NftIsNotListedForSale();
    error BuySelfNft();
    error InvalidSellKind();

    // Balance section
    error InsufficientFunds();
    error BidLowerPrice(
        address nftContract,
        uint256 nftId,
        uint256 bid,
        uint256 highestBid
    );
}
