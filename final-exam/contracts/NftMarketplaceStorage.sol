// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./libraries/constants/Types.sol";

abstract contract NftMarketplaceStorage {
    Types.TreasuryData public treasuryData; // SLOT 0
    mapping(address => bool) _blockList; // SLOT 1
    mapping(uint256 => Types.Listing) _listings; // SLOT 2
    mapping(uint256 => mapping(address => uint256)) _bids; // SLOT 3: listId -> bidder -> bid value
    mapping(address => uint256) _lockValue; // SLOT ;
    uint256 _listingCount; // SLOT 5
}
