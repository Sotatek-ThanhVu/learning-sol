// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./libraries/constants/Errors.sol";
import "./libraries/constants/Events.sol";
import "./libraries/GovernanceLib.sol";
import "./libraries/NftMarketplaceLib.sol";

import "./interfaces/INftMarketplace.sol";

import "./NftMarketplaceStorage.sol";

contract NftMarketplace is
    INftMarketplace,
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    NftMarketplaceStorage
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _initialOwner,
        address _treasury,
        uint16 _sellerFee,
        uint16 _buyerFee
    ) external initializer {
        __Ownable_init(_initialOwner);
        __ReentrancyGuard_init_unchained();

        GovernanceLib.initTreasury(_treasury, _sellerFee, _buyerFee);
    }

    // ==================== MODIFIER ====================

    modifier nonBlock(address _sender) {
        if (_blockList[_sender] == true) {
            revert Errors.UserNotApproved();
        }
        _;
    }

    // ==================== EXTERNAL WRITE ====================

    function blockUser(address _user) external onlyOwner {
        _blockUser(_user);
    }

    function unblockUser(address _user) external onlyOwner {
        _unblockUser(_user);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        GovernanceLib.setTreasury(_newTreasury);
    }

    function setTreasurySellerFee(
        uint16 _newTreasurySellerFee
    ) external onlyOwner {
        GovernanceLib.setTreasurySellerFee(_newTreasurySellerFee);
    }

    function setTreasuryBuyerFee(
        uint16 _newTreasuryBuyerFee
    ) external onlyOwner {
        GovernanceLib.setTreasuryBuyerFee(_newTreasuryBuyerFee);
    }

    function listNft721(
        address _nftContract,
        address _acceptToken,
        uint256 _nftId,
        uint256 _price,
        uint256 _deadline,
        Types.SellKind _sellKind
    ) external nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.listNft721(
            _nftId,
            _price,
            _listingCount,
            _deadline,
            _nftContract,
            _acceptToken,
            _sellKind
        );
        _listingCount++;
    }

    function listNft1155(
        address _nftContract,
        address _acceptToken,
        uint256 _nftId,
        uint256 _amount,
        uint256 _price,
        uint256 _deadline,
        Types.SellKind _sellKind
    ) external nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.listNft1155(
            _nftId,
            _price,
            _listingCount,
            _amount,
            _deadline,
            _nftContract,
            _acceptToken,
            _sellKind
        );
        _listingCount++;
    }

    function listNft(
        address _nftContract,
        address _acceptToken,
        uint256 _nftId,
        uint256 _amount,
        uint256 _price,
        uint256 _deadline,
        Types.NftKind _nftKind,
        Types.SellKind _sellKind
    ) external nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.listNft(
            _nftId,
            _price,
            _listingCount,
            _amount,
            _deadline,
            _nftContract,
            _acceptToken,
            _nftKind,
            _sellKind
        );
        _listingCount++;
    }

    function cancelListingNft(
        uint256 _listingId
    ) external nonBlock(msg.sender) {
        NftMarketplaceLib.cancelListingNft(_listingId);
    }

    function fakeListingStatus(
        uint256 _listingId,
        bool _status
    ) external onlyOwner {
        NftMarketplaceLib.fakeListingStatus(_listingId, _status);
    }

    function buyFixedPriceNftWithNativeToken(
        uint256 _listingId
    ) external payable nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.buyFixedPriceNftWithNativeToken(_listingId);
    }

    function buyAuctionNftWithNativeToken(
        uint256 _listingId
    ) external payable nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.buyAuctionNftWithNativeToken(_listingId);
    }

    function buyFixedPriceNftWithErc20Token(
        uint256 _listingId,
        uint256 _amount
    ) external nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.buyFixedPriceNftWithErc20Token(_listingId, _amount);
    }

    function buyAuctionNftWithErc20Token(
        uint256 _listingId,
        uint256 _amount
    ) external payable nonBlock(msg.sender) nonReentrant {
        NftMarketplaceLib.buyAuctionNftWithErc20Token(_listingId, _amount);
    }

    function releaseNft(uint256 _listingId) external nonReentrant {
        NftMarketplaceLib.releaseNft(_listingId);
    }

    function withdrawLockAmount() external nonReentrant {
        NftMarketplaceLib.withdrawLockAmount();
    }

    // ==================== EXTERNAL READ ====================

    function isBlocked() external view returns (bool) {
        return _blockList[msg.sender];
    }

    function isBlocked(address user) external view returns (bool) {
        return _blockList[user];
    }

    // function getListing(
    //     address nftContract,
    //     uint256 tokenId
    // ) external pure returns (uint256, address, bool) {
    //     return NftMarketplaceLib.getListing(nftContract, tokenId);
    // }

    // ==================== PRIVATE ====================

    function _blockUser(address user) private {
        _blockList[user] = true;
        emit Events.BlockUser(user, uint40(block.timestamp));
    }

    function _unblockUser(address user) private {
        _blockList[user] = false;
        emit Events.UnblockUser(user, uint40(block.timestamp));
    }
}
