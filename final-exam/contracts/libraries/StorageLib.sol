// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./constants/Types.sol";

library StorageLib {
    uint256 constant TREASURY_DATA_SLOT = 0;
    uint256 constant LISTINGS_SLOT = 2;
    uint256 constant BIDS_SLOT = 3;
    uint256 constant LOCK_VALUE_SLOT = 4;

    function getTreasuryData()
        internal
        pure
        returns (Types.TreasuryData storage _treasuryData)
    {
        assembly {
            _treasuryData.slot := TREASURY_DATA_SLOT
        }
    }

    function getListings(
        uint256 _listingId
    ) internal pure returns (Types.Listing storage _listings) {
        assembly {
            mstore(0x0, _listingId)
            mstore(0x20, LISTINGS_SLOT)
            _listings.slot := keccak256(0x0, 0x40)
        }
    }

    function getBidValue(
        uint256 _listingId,
        address _bidder
    ) internal view returns (uint256 _bidValue) {
        assembly {
            mstore(0x0, _listingId)
            mstore(0x20, BIDS_SLOT)
            mstore(0x0, keccak256(0x0, 0x40))
            mstore(0x20, _bidder)
            _bidValue := sload(keccak256(0x0, 0x40))
        }
    }

    function setBidValue(
        address _bidder,
        uint256 _listingId,
        uint256 _bidValue
    ) internal {
        assembly {
            mstore(0x0, _listingId)
            mstore(0x20, BIDS_SLOT)
            mstore(0x0, keccak256(0x0, 0x40)) // _listings[_listingId]
            mstore(0x20, _bidder)
            sstore(keccak256(0x0, 0x40), _bidValue) // _listings[_listingId][_bidder]
        }
    }

    function getLockValue(address _caller) internal view returns (uint256 _lockValue) {
        assembly {
            mstore(0x0, _caller)
            mstore(0x20, LOCK_VALUE_SLOT)
            _lockValue := sload(keccak256(0x0, 0x40))
        }
    }

    function setLockValue(address _caller, uint256 _value) internal {
        assembly {
            mstore(0x0, _caller)
            mstore(0x20, LOCK_VALUE_SLOT)
            sstore(keccak256(0x0, 0x40), _value)
        }
    }

    // function getListingCount() internal view returns (uint256 _listingCount) {
    //     assembly {
    //         _listingCount := sload(LISTING_COUNT_SLOT)
    //     }
    // }
}
