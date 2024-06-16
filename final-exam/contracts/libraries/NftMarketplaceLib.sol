// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./constants/Errors.sol";
import "./constants/Events.sol";
import "./constants/Types.sol";

import "./StorageLib.sol";
import "./GovernanceLib.sol";

import "../NftMarketplaceStorage.sol";

library NftMarketplaceLib {
    using SafeERC20 for IERC20;

    function listNft721(
        uint256 _nftId,
        uint256 _price,
        uint256 _listingId,
        uint256 _deadline,
        address _nftContract,
        address _acceptToken,
        Types.SellKind _sellKind
    ) internal {
        // check if caller owns the NFT
        if (IERC721(_nftContract).ownerOf(_nftId) != msg.sender) {
            revert Errors.InvalidOwner();
        }

        // check if NFT approved this marketplace
        if (
            IERC721(_nftContract).isApprovedForAll(msg.sender, address(this)) ==
            false
        ) {
            revert Errors.MarketplaceNotApproved();
        }

        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        _listing.nftContract = _nftContract;
        _listing.seller = msg.sender;
        _listing.acceptToken = _acceptToken;
        _listing.nftId = _nftId;
        _listing.price = _price;
        if (_sellKind == Types.SellKind.AUCTION) {
            _listing.deadline = block.timestamp + _deadline;
        }
        _listing.isActive = true;
        _listing.nftKind = Types.NftKind.ERC721;
        _listing.sellKind = _sellKind;

        emit Events.ListNft(
            msg.sender,
            _nftContract,
            _acceptToken,
            _nftId,
            _price,
            1,
            _listingId,
            Types.NftKind.ERC721,
            _sellKind
        );
    }

    function listNft1155(
        uint256 _nftId,
        uint256 _price,
        uint256 _listingId,
        uint256 _amount,
        uint256 _deadline,
        address _nftContract,
        address _acceptToken,
        Types.SellKind _sellKind
    ) internal {
        // check if caller owns the NFT
        if (IERC1155(_nftContract).balanceOf(msg.sender, _nftId) == 0) {
            revert Errors.InvalidOwner();
        }

        // check if NFT approved this marketplace
        if (
            IERC1155(_nftContract).isApprovedForAll(
                msg.sender,
                address(this)
            ) == false
        ) {
            revert Errors.MarketplaceNotApproved();
        }

        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        _listing.nftContract = _nftContract;
        _listing.seller = msg.sender;
        _listing.acceptToken = _acceptToken;
        _listing.nftId = _nftId;
        _listing.price = _price;
        if (_sellKind == Types.SellKind.AUCTION) {
            _listing.deadline = block.timestamp + _deadline;
        }
        _listing.amount = _amount;
        _listing.isActive = true;
        _listing.nftKind = Types.NftKind.ERC1155;
        _listing.sellKind = _sellKind;

        emit Events.ListNft(
            msg.sender,
            _nftContract,
            _acceptToken,
            _nftId,
            _price,
            _amount,
            _listingId,
            Types.NftKind.ERC1155,
            _sellKind
        );
    }

    function listNft(
        uint256 _nftId,
        uint256 _price,
        uint256 _listingId,
        uint256 _amount,
        uint256 _deadline,
        address _nftContract,
        address _acceptToken,
        Types.NftKind _nftKind,
        Types.SellKind _sellKind
    ) internal {
        if (Types.NftKind.ERC721 == _nftKind)
            listNft721(
                _nftId,
                _price,
                _listingId,
                _deadline,
                _nftContract,
                _acceptToken,
                _sellKind
            );
        else
            listNft1155(
                _nftId,
                _price,
                _listingId,
                _amount,
                _deadline,
                _nftContract,
                _acceptToken,
                _sellKind
            );
    }

    function cancelListingNft(uint256 _listingId) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        if (msg.sender != _listing.seller) {
            revert Errors.InvalidOwner();
        }
        if (_listing.isActive == false) {
            revert Errors.NftIsNotListedForSale();
        }
        _listing.isActive = false;
        emit Events.CancelListNft(
            msg.sender,
            _listing.nftContract,
            _listing.nftId
        );
    }

    function fakeListingStatus(uint256 _listingId, bool _status) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        _listing.isActive = _status;
    }

    function buyFixedPriceNftWithNativeToken(uint256 _listingId) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        address sender = msg.sender;
        address seller = _listing.seller;
        address bidder = _listing.bidder;
        address nftContract = _listing.nftContract;
        address acceptToken = _listing.acceptToken;
        uint256 nftId = _listing.nftId;
        uint256 amount = _listing.amount;
        uint256 price = _listing.price;
        Types.SellKind sellKind = _listing.sellKind;
        Types.NftKind nftKind = _listing.nftKind;

        _validateListing(
            seller,
            _listing.deadline,
            _listing.isActive,
            sellKind,
            Types.SellKind.FIXED
        );
        _listing.isActive = false;
        _receiveToken(acceptToken, seller, bidder, msg.value, price, sellKind); // Transfer native token for seller and treasury
        _transferNft(nftContract, seller, sender, nftId, amount, nftKind); // Transfer NFT for buyer
        emit Events.BuyNft(sender, seller, nftContract, nftId, amount, price);
    }

    function buyAuctionNftWithNativeToken(uint256 _listingId) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        address sender = msg.sender;
        address seller = _listing.seller;
        address nftContract = _listing.nftContract;
        uint256 nftId = _listing.nftId;
        uint256 amount = msg.value;
        Types.SellKind sellKind = _listing.sellKind;

        _validateListing(
            seller,
            _listing.deadline,
            _listing.isActive,
            sellKind,
            Types.SellKind.AUCTION
        );

        address oldBidder = _listing.bidder;
        uint256 newBidValue = amount +
            StorageLib.getBidValue(_listingId, sender);
        uint256 currentBidValue = _listing.price;
        if (newBidValue <= currentBidValue) {
            revert Errors.BidLowerPrice(
                nftContract,
                nftId,
                newBidValue,
                currentBidValue
            );
        }
        StorageLib.setLockValue(sender, newBidValue);

        _listing.price = newBidValue;
        _listing.bidder = sender;
        StorageLib.setBidValue(sender, _listingId, newBidValue);

        emit Events.PlaceBidNft(
            oldBidder,
            sender,
            nftContract,
            nftId,
            _listing.amount,
            currentBidValue,
            newBidValue
        );
    }

    function buyFixedPriceNftWithErc20Token(
        uint256 _listingId,
        uint256 _amount
    ) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        address sender = msg.sender;
        address seller = _listing.seller;
        address bidder = _listing.bidder;
        address nftContract = _listing.nftContract;
        address acceptToken = _listing.acceptToken;
        uint256 nftId = _listing.nftId;
        uint256 amount = _listing.amount;
        uint256 price = _listing.price;
        Types.SellKind sellKind = _listing.sellKind;
        Types.NftKind nftKind = _listing.nftKind;

        _validateListing(
            seller,
            _listing.deadline,
            _listing.isActive,
            sellKind,
            Types.SellKind.FIXED
        );
        _listing.isActive = false;
        _receiveToken(acceptToken, seller, bidder, _amount, price, sellKind); // Transfer native token for seller and treasury
        _transferNft(nftContract, seller, sender, nftId, amount, nftKind); // Transfer NFT for buyer
        emit Events.BuyNft(sender, seller, nftContract, nftId, amount, price);
    }

    function buyAuctionNftWithErc20Token(
        uint256 _listingId,
        uint256 _amount
    ) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        address sender = msg.sender;
        address seller = _listing.seller;
        address nftContract = _listing.nftContract;
        uint256 nftId = _listing.nftId;
        Types.SellKind sellKind = _listing.sellKind;

        _validateListing(
            seller,
            _listing.deadline,
            _listing.isActive,
            sellKind,
            Types.SellKind.AUCTION
        );

        address oldBidder = _listing.bidder;
        uint256 newBidValue = _amount +
            StorageLib.getBidValue(_listingId, sender);
        uint256 currentBidValue = _listing.price;
        if (newBidValue <= currentBidValue) {
            revert Errors.BidLowerPrice(
                nftContract,
                nftId,
                newBidValue,
                currentBidValue
            );
        }

        _listing.price = newBidValue;
        _listing.bidder = sender;
        StorageLib.setBidValue(sender, _listingId, newBidValue);

        emit Events.PlaceBidNft(
            oldBidder,
            sender,
            nftContract,
            nftId,
            _listing.amount,
            currentBidValue,
            newBidValue
        );
    }

    function releaseNft(uint256 _listingId) internal {
        Types.Listing storage _listing = StorageLib.getListings(_listingId);
        address seller = _listing.seller;
        address bidder = _listing.bidder;
        address acceptToken = _listing.acceptToken;
        address nftContract = _listing.nftContract;
        uint256 nftId = _listing.nftId;
        uint256 amount = _listing.amount;
        uint256 price = _listing.price;
        Types.SellKind sellKind = _listing.sellKind;
        Types.NftKind nftKind = _listing.nftKind;

        if (seller != msg.sender) revert Errors.InvalidOwner();
        _listing.isActive = false;
        _receiveToken(acceptToken, seller, bidder, price, price, sellKind);
        _transferNft(nftContract, seller, bidder, nftId, amount, nftKind);

        emit Events.BuyNft(bidder, seller, nftContract, nftId, amount, price);
    }

    function withdrawLockAmount() internal {
        address sender = msg.sender;
        uint256 value = StorageLib.getLockValue(sender);
        if (value == 0) {
            revert Errors.InsufficientFunds();
        }

        payable(sender).transfer(value);
        StorageLib.setLockValue(sender, 0);

        emit Events.WithdrawLockAmount(sender, value);
    }

    function _validateListing(
        address _seller,
        uint256 _deadline,
        bool _isActive,
        Types.SellKind _listingSellKind,
        Types.SellKind _sellKind
    ) private view {
        if (_listingSellKind != _sellKind) {
            revert Errors.InvalidSellKind();
        }
        if (_seller == msg.sender) revert Errors.BuySelfNft();
        if (
            _isActive == false ||
            (_sellKind == Types.SellKind.AUCTION &&
                _deadline <= block.timestamp)
        ) {
            revert Errors.NftIsNotListedForSale();
        }
    }

    function _getActualValue(
        uint256 _listingPrice,
        uint256 _amount,
        Types.SellKind _sellKind
    ) private pure returns (address, uint256, uint256) {
        Types.TreasuryData memory _treasuryData = StorageLib.getTreasuryData();

        uint256 BPS_MAX = GovernanceLib.BPS_MAX;

        uint256 actualSend;
        if (_sellKind == Types.SellKind.FIXED) {
            actualSend =
                (_listingPrice *
                    (_treasuryData.treasuryBuyerFeeBPS + BPS_MAX)) /
                BPS_MAX;
            if (_amount < actualSend) {
                revert Errors.InsufficientFunds();
            }
        } else {
            actualSend = _listingPrice;
        }
        uint256 actualReceive = (_listingPrice *
            (BPS_MAX - _treasuryData.treasurySellerFeeBPS)) / BPS_MAX;

        return (
            _treasuryData.treasury,
            actualReceive,
            actualSend - actualReceive
        );
    }

    function _receiveToken(
        address _acceptToken,
        address _seller,
        address _bidder,
        uint256 _amount,
        uint256 _price,
        Types.SellKind _sellKind
    ) private {
        address payer = _sellKind == Types.SellKind.FIXED
            ? msg.sender
            : _bidder;
        (
            address treasury,
            uint256 sellerAmount,
            uint256 treasuryAmount
        ) = _getActualValue(_price, _amount, _sellKind);

        if (_acceptToken == address(0)) {
            payable(_seller).transfer(sellerAmount);
            payable(treasury).transfer(treasuryAmount);
        } else {
            IERC20(_acceptToken).safeTransferFrom(payer, _seller, sellerAmount);
            IERC20(_acceptToken).safeTransferFrom(
                payer,
                treasury,
                treasuryAmount
            );
        }
    }

    function _transferNft(
        address _nftContract,
        address _seller,
        address _receiver,
        uint256 _nftId,
        uint256 _amount,
        Types.NftKind _nftKind
    ) private {
        if (_nftKind == Types.NftKind.ERC721) {
            IERC721(_nftContract).safeTransferFrom(_seller, _receiver, _nftId);
        } else {
            IERC1155(_nftContract).safeTransferFrom(
                _seller,
                _receiver,
                _nftId,
                _amount,
                ""
            );
        }
    }
}
