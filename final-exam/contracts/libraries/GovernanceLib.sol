// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./constants/Errors.sol";
import "./constants/Events.sol";
import "./constants/Types.sol";

import "./StorageLib.sol";

library GovernanceLib {
    uint16 internal constant BPS_MAX = 10000;

    function initTreasury(
        address treasury,
        uint16 sellerFee,
        uint16 buyerFee
    ) internal {
        if (
            treasury == address(0) ||
            sellerFee > BPS_MAX / 2 ||
            buyerFee > BPS_MAX / 2
        ) {
            revert Errors.InvalidParams();
        }

        Types.TreasuryData storage _treasuryData = StorageLib.getTreasuryData();
        _treasuryData.treasury = treasury;
        _treasuryData.treasurySellerFeeBPS = sellerFee;
        _treasuryData.treasuryBuyerFeeBPS = buyerFee;
    }

    function setTreasury(address newTreasury) internal {
        if (newTreasury == address(0)) {
            revert Errors.InvalidParams();
        }

        Types.TreasuryData storage _treasuryData = StorageLib.getTreasuryData();
        address prevTreasury = _treasuryData.treasury;
        _treasuryData.treasury = newTreasury;

        emit Events.TreasurySet(
            prevTreasury,
            newTreasury,
            uint40(block.timestamp)
        );
    }

    function setTreasurySellerFee(uint16 newTreasurySellerFee) internal {
        if (newTreasurySellerFee > BPS_MAX / 2) {
            revert Errors.InvalidParams();
        }

        Types.TreasuryData storage _treasuryData = StorageLib.getTreasuryData();
        uint16 prevTreasurySellerFee = _treasuryData.treasurySellerFeeBPS;
        _treasuryData.treasurySellerFeeBPS = newTreasurySellerFee;

        emit Events.TreasurySellerFeeSet(
            prevTreasurySellerFee,
            newTreasurySellerFee,
            block.timestamp
        );
    }

    function setTreasuryBuyerFee(uint16 newTreasuryBuyerFee) internal {
        if (newTreasuryBuyerFee > BPS_MAX / 2) {
            revert Errors.InvalidParams();
        }

        Types.TreasuryData storage _treasuryData = StorageLib.getTreasuryData();
        uint16 prevTreasuryBuyerFee = _treasuryData.treasuryBuyerFeeBPS;
        _treasuryData.treasuryBuyerFeeBPS = newTreasuryBuyerFee;

        emit Events.TreasuryBuyerFeeSet(
            prevTreasuryBuyerFee,
            newTreasuryBuyerFee,
            block.timestamp
        );
    }
}
