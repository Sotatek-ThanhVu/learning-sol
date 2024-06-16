// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "../libraries/constants/Types.sol";

interface INftMarketplace {
    function blockUser(address user) external;

    function unblockUser(address user) external;

    function setTreasury(address treasury) external;

    function setTreasurySellerFee(uint16 newTreasurySellerFee) external;

    function setTreasuryBuyerFee(uint16 newTreasuryBuyerFee) external;

    function listNft721(
        address nftContract,
        address acceptToken,
        uint256 nftId,
        uint256 price,
        uint256 _deadline,
        Types.SellKind sellKind
    ) external;

    function listNft1155(
        address nftContract,
        address acceptToken,
        uint256 nftId,
        uint256 amount,
        uint256 price,
        uint256 _deadline,
        Types.SellKind sellKind
    ) external;

    function listNft(
        address _nftContract,
        address _acceptToken,
        uint256 _nftId,
        uint256 _amount,
        uint256 _price,
        uint256 _deadline,
        Types.NftKind _nftKind,
        Types.SellKind _sellKind
    ) external;

    function cancelListingNft(uint256 _listingId) external;

    function buyFixedPriceNftWithNativeToken(
        uint256 _listingId
    ) external payable;

    function buyAuctionNftWithNativeToken(uint256 _listingId) external payable;

    function buyFixedPriceNftWithErc20Token(
        uint256 _listingId,
        uint256 _amount
    ) external;

    function buyAuctionNftWithErc20Token(
        uint256 _listingId,
        uint256 _amount
    ) external payable;

    function isBlocked() external view returns (bool);

    function isBlocked(address user) external view returns (bool);
}
