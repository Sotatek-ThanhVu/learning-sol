// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

library Types {
    enum NftKind {
        ERC721,
        ERC1155
    }

    enum SellKind {
        FIXED,
        AUCTION
    }

    struct Listing {
        address nftContract;
        address seller;
        address acceptToken;
        address bidder;
        uint256 nftId;
        uint256 price;
        uint256 amount; // For ERC1155
        uint256 deadline; // For Auction
        bool isActive;
        NftKind nftKind;
        SellKind sellKind;
    }

    struct TreasuryData {
        address treasury;
        uint16 treasurySellerFeeBPS;
        uint16 treasuryBuyerFeeBPS;
    }
}
