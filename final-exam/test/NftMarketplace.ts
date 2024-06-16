import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ContractFactory, ZeroAddress, parseEther } from "ethers";
import { ethers, upgrades } from "hardhat";
import { MyToken1155, MyToken20, MyToken721, NftMarketplace } from "../types";

describe("NFT Marketplace", function() {
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let userBlocked: SignerWithAddress;
  let users: SignerWithAddress[];

  let NftMarketplaceFactory: ContractFactory;
  let nftMarketplace: NftMarketplace;

  async function deployNftMarketplace() {
    NftMarketplaceFactory = await ethers.getContractFactory("NftMarketplace");
    nftMarketplace = (await upgrades.deployProxy(NftMarketplaceFactory, [
      owner.address,
      treasury.address,
      15,
      15,
    ])) as unknown as NftMarketplace;
    nftMarketplace = await nftMarketplace.waitForDeployment();
  }

  before(async function() {
    [owner, treasury, userBlocked, ...users] = await ethers.getSigners();
  });

  describe("Deployment", function() {
    it("Should deploy", async function() {
      NftMarketplaceFactory = await ethers.getContractFactory("NftMarketplace");

      // Should revert with InvalidParams message because invalid treasury address
      try {
        await upgrades.deployProxy(NftMarketplaceFactory, [
          owner.address,
          ZeroAddress,
          15,
          15,
        ]);
      } catch (err) {
        expect(err.message).to.contain("InvalidParams");
      }

      // Should revert with InvalidParams message because invalid seller fee address
      try {
        await upgrades.deployProxy(NftMarketplaceFactory, [
          owner.address,
          treasury.address,
          5001, // 50,01%
          15,
        ]);
      } catch (err) {
        expect(err.message).to.contain("InvalidParams");
      }

      // Should revert with InvalidParams message because invalid buyer fee address
      try {
        await upgrades.deployProxy(NftMarketplaceFactory, [
          owner.address,
          treasury.address,
          15,
          5001, // 50,01%
        ]);
      } catch (err) {
        expect(err.message).to.contain("InvalidParams");
      }

      nftMarketplace = (await upgrades.deployProxy(NftMarketplaceFactory, [
        owner.address,
        treasury.address,
        15, // seller fee -> 0.15%
        15, // buyer fee -> 0.15%
      ])) as unknown as NftMarketplace;
      nftMarketplace = await nftMarketplace.waitForDeployment();

      const [treasuryAddress, sellerFee, buyerFee] =
        await nftMarketplace.treasuryData();
      expect(treasuryAddress).to.eq(treasury.address);
      expect(sellerFee).to.eq(15);
      expect(buyerFee).to.eq(15);
    });
  });

  describe("Upgrade", function() {
    this.beforeEach(async function() {
      await loadFixture(deployNftMarketplace);
    });

    it("Should keep storage correctly", async function() {
      nftMarketplace = (await upgrades.upgradeProxy(
        await nftMarketplace.getAddress(),
        NftMarketplaceFactory,
        { unsafeAllow: ["delegatecall"] }
      )) as unknown as NftMarketplace;
      const [treasuryAddress, sellerFee, buyerFee] =
        await nftMarketplace.treasuryData();
      expect(treasuryAddress).to.eq(treasury.address);
      expect(sellerFee).to.eq(15);
      expect(buyerFee).to.eq(15);
    });

    it("Should success for multiple upgrades", async function() {
      nftMarketplace = (await upgrades.upgradeProxy(
        await nftMarketplace.getAddress(),
        NftMarketplaceFactory,
        { unsafeAllow: ["delegatecall"] }
      )) as unknown as NftMarketplace;
      nftMarketplace = (await upgrades.upgradeProxy(
        await nftMarketplace.getAddress(),
        NftMarketplaceFactory,
        { unsafeAllow: ["delegatecall"] }
      )) as unknown as NftMarketplace;
      nftMarketplace = (await upgrades.upgradeProxy(
        await nftMarketplace.getAddress(),
        NftMarketplaceFactory,
        { unsafeAllow: ["delegatecall"] }
      )) as unknown as NftMarketplace;
    });

    it("Should change admin", async function() {
      const newOwner = users[0];
      await nftMarketplace.connect(owner).transferOwnership(newOwner.address);
      expect(await nftMarketplace.owner()).to.equal(newOwner.address);

      // const NewNftMarketplaceFactory = await ethers.getContractFactory(
      //   "NftMarketplace",
      //   newOwner
      // );
      // nftMarketplaceContract = (await upgrades.upgradeProxy(
      //   await nftMarketplaceContract.getAddress(),
      //   NewNftMarketplaceFactory,
      //   { unsafeAllow: ["delegatecall"] }
      // )) as unknown as NftMarketplace;
      // expect(await nftMarketplaceContract.owner()).to.equal(newOwner.address);
    });
  });

  describe("Admin methods", function() {
    this.beforeEach(async function() {
      await loadFixture(deployNftMarketplace);
    });

    it("Should block", async function() {
      const userGetBlocked = users[0];

      // Should revert with normal address
      await expect(
        nftMarketplace.connect(users[10]).blockUser(userGetBlocked.address)
      )
        .to.revertedWithCustomError(
          nftMarketplace,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(users[10].address);

      // Should success with owner address
      await expect(nftMarketplace.blockUser(userGetBlocked.address))
        .to.emit(nftMarketplace, "BlockUser")
        .withArgs(userGetBlocked.address, (await time.latest()) + 1);
    });

    it("Should unblock", async function() {
      const userGetBlocked = users[0];
      await nftMarketplace.blockUser(userGetBlocked.address);

      // Should revert with normal address
      await expect(
        nftMarketplace.connect(users[10]).unblockUser(userGetBlocked.address)
      )
        .to.revertedWithCustomError(
          nftMarketplace,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(users[10].address);

      // Should success with owner address
      await expect(nftMarketplace.unblockUser(userGetBlocked.address))
        .to.emit(nftMarketplace, "UnblockUser")
        .withArgs(userGetBlocked.address, (await time.latest()) + 1);
    });

    it("Should change treasury address", async function() {
      // Should revert with normal address
      await expect(nftMarketplace.connect(users[10]).setTreasury(ZeroAddress))
        .to.revertedWithCustomError(
          nftMarketplace,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(users[10].address);

      // Should revert with genesis address
      await expect(
        nftMarketplace.setTreasury(ZeroAddress)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidParams");

      // Should success with normal address
      const newTreasury = users[10];
      await expect(nftMarketplace.setTreasury(newTreasury.address))
        .to.emit(nftMarketplace, "TreasurySet")
        .withArgs(
          treasury.address,
          newTreasury.address,
          (await time.latest()) + 1
        );
    });

    it("Should change treasury seller fee BPS", async function() {
      // Should revert with normal address
      await expect(nftMarketplace.connect(users[10]).setTreasurySellerFee(5001))
        .to.revertedWithCustomError(
          nftMarketplace,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(users[10].address);

      // Should revert with BPF over 50% (BPS_MAX / 2 = 10000 / 2 = 5000)
      await expect(
        nftMarketplace.setTreasurySellerFee(5001)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidParams");

      // Should success with normal seller fee
      await expect(nftMarketplace.setTreasurySellerFee(10)) // 0.1%
        .to.emit(nftMarketplace, "TreasurySellerFeeSet")
        .withArgs(15, 10, (await time.latest()) + 1);
    });

    it("Should change treasury buyer fee BPS", async function() {
      // Should revert with normal address
      await expect(nftMarketplace.connect(users[10]).setTreasuryBuyerFee(5001))
        .to.revertedWithCustomError(
          nftMarketplace,
          "OwnableUnauthorizedAccount"
        )
        .withArgs(users[10].address);

      // Should revert with BPF over 50% (BPS_MAX / 2 = 10000 / 2 = 5000)
      await expect(
        nftMarketplace.setTreasuryBuyerFee(5001)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidParams");

      // Should success with normal seller fee
      await expect(nftMarketplace.setTreasuryBuyerFee(10)) // 0.1%
        .to.emit(nftMarketplace, "TreasuryBuyerFeeSet")
        .withArgs(15, 10, (await time.latest()) + 1);
    });
  });

  describe("User methods", function() {
    let erc20: MyToken20;
    let erc721: MyToken721;
    let erc1155: MyToken1155;

    // const NFT_ID = { user0: [0, 1], user1: [2, 3] };
    const SELL_KIND = { FIXED: 0, AUCTION: 1 };
    const NFT_KIND = { ERC721: 0, ERC1155: 1 };

    async function deployTokens() {
      const ERC20 = await ethers.getContractFactory("MyToken20");
      erc20 = await ERC20.deploy(owner.address);
      erc20 = await erc20.waitForDeployment();

      const ERC721 = await ethers.getContractFactory("MyToken721");
      erc721 = await ERC721.deploy(owner.address);
      erc721 = await erc721.waitForDeployment();

      const ERC1155 = await ethers.getContractFactory("MyToken1155");
      erc1155 = await ERC1155.deploy(owner.address);
      erc1155 = await erc1155.waitForDeployment();
    }

    this.beforeEach(async function() {
      await loadFixture(deployNftMarketplace);
      await loadFixture(deployTokens);

      // Mint ERC-20, ERC-721 & ERC-1155 for users[0]
      // await erc20.mint(users[0], ethers.parseEther("1"));
      await expect(
        erc721.connect(users[0]).safeMint(users[0].address)
      ).to.revertedWithCustomError(erc721, "OwnableUnauthorizedAccount");
      await erc721.safeMint(users[0].address); // ERC721 TOKEN-ID = 0
      await expect(
        erc1155.connect(users[0]).mint(users[0].address, 0, 2)
      ).to.revertedWithCustomError(erc1155, "OwnableUnauthorizedAccount");
      await erc1155.mint(users[0].address, 0, 2);

      // Mint ERC-20, ERC-721 & ERC-1155 for users[1]
      await expect(
        erc20.connect(users[0]).mint(users[0], parseEther("1"))
      ).to.revertedWithCustomError(erc20, "OwnableUnauthorizedAccount");
      await erc20.mint(users[1], parseEther("2.003"));
      await erc721.safeMint(users[1].address); // ERC721 TOKEN-ID = 1
      await erc1155.mint(users[1].address, 0, 2);

      // Fake block user
      await nftMarketplace.blockUser(userBlocked.address);
    });

    it("Should get block information", async function() {
      // From owner call isBlock for self, users[0] and userBlocked
      expect(await nftMarketplace["isBlocked()"]()).to.eq(false);
      expect(
        await nftMarketplace["isBlocked(address)"](users[0].address)
      ).to.eq(false);
      expect(
        await nftMarketplace["isBlocked(address)"](userBlocked.address)
      ).to.eq(true);

      // From users[0] call isBlock for self and userBlocked
      expect(await nftMarketplace.connect(users[0])["isBlocked()"]()).to.eq(
        false
      );
      expect(
        await nftMarketplace
          .connect(users[0])
        ["isBlocked(address)"](userBlocked.address)
      ).to.eq(true);

      // From userBlocked call isBlock for self and users[0]
      expect(await nftMarketplace.connect(userBlocked)["isBlocked()"]()).to.eq(
        true
      );
      expect(
        await nftMarketplace
          .connect(userBlocked)
        ["isBlocked(address)"](users[0].address)
      ).to.eq(false);
    });

    it("List ERC721", async function() {
      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft721(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            parseEther("1"),
            0,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      // Should revert because not own the nft
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft721(
            await erc721.getAddress(),
            ZeroAddress,
            1,
            parseEther("1"),
            0,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "InvalidOwner");

      // Should revert because this marketplace doesn't approved
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft721(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            parseEther("1"),
            0,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "MarketplaceNotApproved");

      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await erc721
        .connect(users[1])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);

      // User0 accept native token with fixed price sell kind
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft721(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            parseEther("1"),
            0,
            SELL_KIND.FIXED
          )
      )
        .to.emit(nftMarketplace, "ListNft")
        .withArgs(
          users[0].address,
          await erc721.getAddress(),
          ZeroAddress,
          0,
          parseEther("1"),
          1,
          0,
          NFT_KIND.ERC721,
          SELL_KIND.FIXED
        );

      // User1 accept ERC20 with auction sell kind
      await expect(
        nftMarketplace
          .connect(users[1])
          .listNft721(
            await erc721.getAddress(),
            await erc20.getAddress(),
            1,
            parseEther("1"),
            0,
            SELL_KIND.AUCTION
          )
      )
        .to.emit(nftMarketplace, "ListNft")
        .withArgs(
          users[1].address,
          await erc721.getAddress(),
          await erc20.getAddress(),
          1,
          parseEther("1"),
          1,
          1,
          NFT_KIND.ERC721,
          SELL_KIND.AUCTION
        );
    });

    it("List ERC1155", async function() {
      const deadline = 7 * 24 * 60 * 60; // 7 days
      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft1155(
            await erc1155.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            deadline,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      // Should revert because user not own the NFT
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft1155(
            await erc1155.getAddress(),
            ZeroAddress,
            1,
            1,
            1,
            deadline,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "InvalidOwner");

      // Should revert because this marketplace doesn't approved
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft1155(
            await erc1155.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            deadline,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "MarketplaceNotApproved");

      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await erc1155
        .connect(users[1])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);

      // User0 list 1 ERC1155, accept native token with fixed price sell kind
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft1155(
            await erc1155.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            0,
            SELL_KIND.FIXED
          )
      )
        .to.emit(nftMarketplace, "ListNft")
        .withArgs(
          users[0].address,
          await erc1155.getAddress(),
          ZeroAddress,
          0,
          parseEther("1"),
          1,
          0,
          NFT_KIND.ERC1155,
          SELL_KIND.FIXED
        );

      // User1 list 2 ERC1155, accept ERC20 with auction sell kind
      await expect(
        nftMarketplace
          .connect(users[1])
          .listNft1155(
            await erc1155.getAddress(),
            await erc20.getAddress(),
            0,
            2,
            parseEther("1"),
            deadline,
            SELL_KIND.AUCTION
          )
      )
        .to.emit(nftMarketplace, "ListNft")
        .withArgs(
          users[1].address,
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          parseEther("1"),
          2,
          1,
          NFT_KIND.ERC1155,
          SELL_KIND.AUCTION
        );
    });

    it("List NFT", async function() {
      const deadline = 7 * 24 * 60 * 60;

      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            0,
            NFT_KIND.ERC721,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await erc721
        .connect(users[1])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await erc1155
        .connect(users[1])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);

      // User0 list ERC721, accept native token with fixed sell kind
      await expect(
        nftMarketplace
          .connect(users[0])
          .listNft(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            0,
            parseEther("1"),
            0,
            NFT_KIND.ERC721,
            SELL_KIND.FIXED
          )
      )
        .to.emit(nftMarketplace, "ListNft")
        .withArgs(
          users[0].address,
          await erc721.getAddress(),
          ZeroAddress,
          0,
          parseEther("1"),
          1,
          0,
          NFT_KIND.ERC721,
          SELL_KIND.FIXED
        );

      // User1 list 2 ERC1155, accept ERC20 with auction sell kind
      await expect(
        nftMarketplace
          .connect(users[1])
          .listNft(
            await erc1155.getAddress(),
            await erc20.getAddress(),
            0,
            2,
            parseEther("1"),
            deadline,
            NFT_KIND.ERC1155,
            SELL_KIND.AUCTION
          )
      )
        .to.emit(nftMarketplace, "ListNft")
        .withArgs(
          users[1].address,
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          parseEther("1"),
          2,
          1,
          NFT_KIND.ERC1155,
          SELL_KIND.AUCTION
        );
    });

    it("Cancel Listing NFT", async function() {
      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft(
          await erc721.getAddress(),
          ZeroAddress,
          0,
          0,
          parseEther("1"),
          0,
          NFT_KIND.ERC721,
          SELL_KIND.FIXED
        );

      // Should revert since not own this listing
      await expect(
        nftMarketplace.connect(users[1]).cancelListingNft(0)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidOwner");

      await nftMarketplace.fakeListingStatus(0, false);
      await expect(
        nftMarketplace.connect(users[0]).cancelListingNft(0)
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");

      await nftMarketplace.fakeListingStatus(0, true);
      await expect(nftMarketplace.connect(users[0]).cancelListingNft(0))
        .to.emit(nftMarketplace, "CancelListNft")
        .withArgs(users[0].address, await erc721.getAddress(), 0);
    });

    it("Buy Fixed price NFT by native token", async function() {
      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            0,
            NFT_KIND.ERC721,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      // User0 list ERC721 & ERC1155
      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft721(
          await erc721.getAddress(),
          ZeroAddress,
          0,
          parseEther("1"),
          0,
          SELL_KIND.FIXED
        );
      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          ZeroAddress,
          0,
          1,
          parseEther("1"),
          0,
          SELL_KIND.AUCTION
        );
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          ZeroAddress,
          0,
          1,
          parseEther("1"),
          0,
          SELL_KIND.FIXED
        );
      const listingErc721Id = 0;
      const listingErc1155IdRevert = 1;
      const listingErc1155IdSuccess = 2;

      // Should revert since nft is not active
      await expect(
        nftMarketplace
          .connect(users[0])
          .fakeListingStatus(listingErc721Id, false)
      ).to.revertedWithCustomError(
        nftMarketplace,
        "OwnableUnauthorizedAccount"
      );
      await nftMarketplace.fakeListingStatus(listingErc721Id, false);
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithNativeToken(listingErc721Id)
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");

      // Should revert since buy owned nft
      await nftMarketplace.fakeListingStatus(listingErc721Id, true);
      await expect(
        nftMarketplace
          .connect(users[0])
          .buyFixedPriceNftWithNativeToken(listingErc721Id)
      ).to.revertedWithCustomError(nftMarketplace, "BuySelfNft");

      // Should revert since buy wrong kind listing
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithNativeToken(listingErc1155IdRevert)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidSellKind");

      // Should revert since insufficient funds
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithNativeToken(listingErc721Id, {
            value: parseEther("1"),
          })
      ).to.revertedWithCustomError(nftMarketplace, "InsufficientFunds");

      // Should success buy ERC721
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithNativeToken(listingErc721Id, {
            value: parseEther("1.0015"),
          })
      )
        .to.emit(nftMarketplace, "BuyNft")
        .withArgs(
          users[1].address,
          users[0].address,
          await erc721.getAddress(),
          0,
          0,
          parseEther("1")
        );

      // Should success buy ERC1155
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithNativeToken(listingErc1155IdSuccess, {
            value: parseEther("1.0015"),
          })
      )
        .to.emit(nftMarketplace, "BuyNft")
        .withArgs(
          users[1].address,
          users[0].address,
          await erc1155.getAddress(),
          0,
          1,
          parseEther("1")
        );

      const delta = parseEther("0.001");
      expect(await erc721.ownerOf(0)).to.eq(users[1].address);
      expect(await erc1155.balanceOf(users[1].address, 0)).to.eq(3);
      expect(await ethers.provider.getBalance(treasury)).to.approximately(
        parseEther("10000.006"),
        delta
      );
      expect(await ethers.provider.getBalance(users[0])).to.approximately(
        parseEther("10001.997"),
        delta
      );
      expect(await ethers.provider.getBalance(users[1])).to.approximately(
        parseEther("9997.997"),
        delta
      );
    });

    it("Buy Auction NFT by native token", async function() {
      const deadline = 7 * 24 * 60 * 60;

      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            0,
            NFT_KIND.ERC721,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      // User0 list ERC721 & ERC1155
      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft721(
          await erc721.getAddress(),
          ZeroAddress,
          0,
          parseEther("1"),
          deadline,
          SELL_KIND.AUCTION
        );
      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          ZeroAddress,
          0,
          1,
          parseEther("1"),
          0,
          SELL_KIND.FIXED
        );
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          ZeroAddress,
          0,
          1,
          parseEther("1"),
          deadline,
          SELL_KIND.AUCTION
        );
      const listingErc721Id = 0;
      const listingErc1155IdRevert = 1;
      const listingErc1155IdSuccess = 2;

      // Should revert since nft is not active
      await expect(
        nftMarketplace
          .connect(users[0])
          .fakeListingStatus(listingErc721Id, false)
      ).to.revertedWithCustomError(
        nftMarketplace,
        "OwnableUnauthorizedAccount"
      );
      await nftMarketplace.fakeListingStatus(listingErc721Id, false);
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithNativeToken(listingErc721Id)
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");

      // Should revert since buy owned nft
      await nftMarketplace.fakeListingStatus(listingErc721Id, true);
      await expect(
        nftMarketplace
          .connect(users[0])
          .buyAuctionNftWithNativeToken(listingErc721Id)
      ).to.revertedWithCustomError(nftMarketplace, "BuySelfNft");

      // Should revert since buy wrong kind listing
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithNativeToken(listingErc1155IdRevert)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidSellKind");

      // Should revert since bid lower or equal starting price
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithNativeToken(listingErc721Id, {
            value: parseEther("1"),
          })
      )
        .to.revertedWithCustomError(nftMarketplace, "BidLowerPrice")
        .withArgs(
          await erc721.getAddress(),
          0,
          parseEther("1"),
          parseEther("1")
        );

      // Should success bid with 1.1 tokens
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithNativeToken(listingErc721Id, {
            value: parseEther("1.1"),
          })
      )
        .to.emit(nftMarketplace, "PlaceBidNft")
        .withArgs(
          ZeroAddress,
          users[1].address,
          await erc721.getAddress(),
          0,
          0,
          parseEther("1"),
          parseEther("1.1")
        );

      // Should revert since nft is close
      await time.increase(8 * 24 * 60 * 60); // 8 days
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithNativeToken(listingErc1155IdSuccess, {
            value: parseEther("1"),
          })
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");
    });

    it("Buy Fixed price NFT by ERC20 token", async function() {
      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft(
            await erc721.getAddress(),
            await erc20.getAddress(),
            0,
            1,
            parseEther("1"),
            0,
            NFT_KIND.ERC721,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      // User0 list ERC721 & ERC1155
      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft721(
          await erc721.getAddress(),
          await erc20.getAddress(),
          0,
          parseEther("1"),
          0,
          SELL_KIND.FIXED
        );
      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          1,
          parseEther("1"),
          0,
          SELL_KIND.AUCTION
        );
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          1,
          parseEther("1"),
          7 * 24 * 60 * 60,
          SELL_KIND.FIXED
        );
      const listingErc721Id = 0;
      const listingErc1155IdRevert = 1;
      const listingErc1155IdSuccess = 2;

      // Should revert since nft is not active
      await expect(
        nftMarketplace
          .connect(users[0])
          .fakeListingStatus(listingErc721Id, false)
      ).to.revertedWithCustomError(
        nftMarketplace,
        "OwnableUnauthorizedAccount"
      );
      await nftMarketplace.fakeListingStatus(listingErc721Id, false);
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithErc20Token(listingErc721Id, parseEther("1.0015"))
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");

      // Should revert since buy owned nft
      await nftMarketplace.fakeListingStatus(listingErc721Id, true);
      await expect(
        nftMarketplace
          .connect(users[0])
          .buyFixedPriceNftWithErc20Token(listingErc721Id, parseEther("1.0015"))
      ).to.revertedWithCustomError(nftMarketplace, "BuySelfNft");

      // Should revert since buy wrong kind listing
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithErc20Token(
            listingErc1155IdRevert,
            parseEther("1.0015")
          )
      ).to.revertedWithCustomError(nftMarketplace, "InvalidSellKind");

      // Should revert since insufficient funds
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithErc20Token(listingErc721Id, parseEther("1"))
      ).to.revertedWithCustomError(nftMarketplace, "InsufficientFunds");

      await erc20
        .connect(users[1])
        .approve(nftMarketplace, parseEther("2.003"));
      // Should success buy ERC721
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithErc20Token(listingErc721Id, parseEther("1.0015"))
      )
        .to.emit(nftMarketplace, "BuyNft")
        .withArgs(
          users[1].address,
          users[0].address,
          await erc721.getAddress(),
          0,
          0,
          parseEther("1")
        );

      // Should success buy ERC1155
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyFixedPriceNftWithErc20Token(
            listingErc1155IdSuccess,
            parseEther("1.0015")
          )
      )
        .to.emit(nftMarketplace, "BuyNft")
        .withArgs(
          users[1].address,
          users[0].address,
          await erc1155.getAddress(),
          0,
          1,
          parseEther("1")
        );

      expect(await erc721.ownerOf(0)).to.eq(users[1].address);
      expect(await erc1155.balanceOf(users[1].address, 0)).to.eq(3);
      expect(await erc20.balanceOf(treasury)).to.eq(parseEther("0.006"));
      expect(await erc20.balanceOf(users[0])).to.eq(parseEther("1.997"));
      expect(await erc20.balanceOf(users[1])).to.eq(parseEther("0"));
    });

    it("Buy Auction NFT by ERC20 Token", async function() {
      const deadline = 7 * 24 * 60 * 60;

      // Should revert because blocked
      await expect(
        nftMarketplace
          .connect(userBlocked)
          .listNft(
            await erc721.getAddress(),
            ZeroAddress,
            0,
            1,
            parseEther("1"),
            0,
            NFT_KIND.ERC721,
            SELL_KIND.FIXED
          )
      ).to.revertedWithCustomError(nftMarketplace, "UserNotApproved");

      // User0 list ERC721 & ERC1155
      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft721(
          await erc721.getAddress(),
          await erc20.getAddress(),
          0,
          parseEther("1"),
          deadline,
          SELL_KIND.AUCTION
        );
      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          1,
          parseEther("1"),
          deadline,
          SELL_KIND.FIXED
        );
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          1,
          parseEther("1"),
          deadline,
          SELL_KIND.AUCTION
        );
      const listingErc721Id = 0;
      const listingErc1155IdRevert = 1;
      const listingErc1155IdSuccess = 2;

      // Should revert since nft is not active
      await expect(
        nftMarketplace
          .connect(users[0])
          .fakeListingStatus(listingErc721Id, false)
      ).to.revertedWithCustomError(
        nftMarketplace,
        "OwnableUnauthorizedAccount"
      );
      await nftMarketplace.fakeListingStatus(listingErc721Id, false);
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithErc20Token(listingErc721Id, parseEther("1"))
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");

      // Should revert since buy owned nft
      await nftMarketplace.fakeListingStatus(listingErc721Id, true);
      await expect(
        nftMarketplace
          .connect(users[0])
          .buyAuctionNftWithErc20Token(listingErc721Id, parseEther("1"))
      ).to.revertedWithCustomError(nftMarketplace, "BuySelfNft");

      // Should revert since buy wrong kind listing
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithErc20Token(listingErc1155IdRevert, parseEther("1"))
      ).to.revertedWithCustomError(nftMarketplace, "InvalidSellKind");

      // Should revert since bid lower or equal starting price
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithErc20Token(listingErc721Id, parseEther("1"))
      )
        .to.revertedWithCustomError(nftMarketplace, "BidLowerPrice")
        .withArgs(
          await erc721.getAddress(),
          0,
          parseEther("1"),
          parseEther("1")
        );

      // Should success bid with 1.1 tokens
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithErc20Token(listingErc721Id, parseEther("1.1"))
      )
        .to.emit(nftMarketplace, "PlaceBidNft")
        .withArgs(
          ZeroAddress,
          users[1].address,
          await erc721.getAddress(),
          0,
          0,
          parseEther("1"),
          parseEther("1.1")
        );

      // Should revert since nft is close
      await time.increase(8 * 24 * 60 * 60); // 8 days
      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithErc20Token(listingErc1155IdSuccess, parseEther("1"))
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");
    });

    it("Should release NFT", async function() {
      const deadline = 7 * 24 * 60 * 60; // 7 days
      // User0 list ERC721 & ERC1155
      await erc721
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft721(
          await erc721.getAddress(),
          ZeroAddress,
          0,
          parseEther("1"),
          deadline,
          SELL_KIND.AUCTION
        );
      await erc1155
        .connect(users[0])
        .setApprovalForAll(await nftMarketplace.getAddress(), true);
      await nftMarketplace
        .connect(users[0])
        .listNft1155(
          await erc1155.getAddress(),
          await erc20.getAddress(),
          0,
          1,
          parseEther("1"),
          deadline,
          SELL_KIND.AUCTION
        );
      const listingErc721Id = 0;
      const listingErc1155Id = 1;

      await nftMarketplace
        .connect(users[1])
        .buyAuctionNftWithNativeToken(listingErc721Id, {
          value: parseEther("1.1"),
        });
      await nftMarketplace
        .connect(users[2])
        .buyAuctionNftWithNativeToken(listingErc721Id, {
          value: parseEther("1.2"),
        });
      await nftMarketplace
        .connect(users[3])
        .buyAuctionNftWithNativeToken(listingErc721Id, {
          value: parseEther("1.3"),
        });
      await nftMarketplace
        .connect(users[2])
        .buyAuctionNftWithNativeToken(listingErc721Id, {
          value: parseEther("0.2"),
        });

      await time.increase(3 * 24 * 60 * 60);
      await expect(nftMarketplace.connect(users[0]).releaseNft(listingErc721Id))
        .to.emit(nftMarketplace, "BuyNft")
        .withArgs(
          users[2].address,
          users[0],
          await erc721.getAddress(),
          0,
          0,
          parseEther("1.4")
        );
      expect(await ethers.provider.getBalance(users[0])).to.approximately(
        parseEther("10001.3979"),
        parseEther("0.001")
      );
      expect(await ethers.provider.getBalance(treasury)).to.eq(
        parseEther("10000.0021")
      );
      expect(await erc721.balanceOf(users[2])).to.eq(1);

      await expect(
        nftMarketplace.connect(users[0]).withdrawLockAmount()
      ).to.revertedWithCustomError(nftMarketplace, "InsufficientFunds");
      await expect(nftMarketplace.connect(users[1]).withdrawLockAmount())
        .to.emit(nftMarketplace, "WithdrawLockAmount")
        .withArgs(users[1], parseEther("1.1"));

      await expect(
        nftMarketplace
          .connect(users[1])
          .buyAuctionNftWithNativeToken(listingErc721Id, {
            value: parseEther("1.1"),
          })
      ).to.revertedWithCustomError(nftMarketplace, "NftIsNotListedForSale");
      await erc20.mint(users[1], parseEther("10"));
      await erc20.mint(users[2], parseEther("10"));
      await erc20.mint(users[3], parseEther("10"));

      await erc20.connect(users[1]).approve(nftMarketplace, parseEther("1.1"));
      await nftMarketplace
        .connect(users[1])
        .buyAuctionNftWithErc20Token(listingErc1155Id, parseEther("1.1"));

      await erc20.connect(users[2]).approve(nftMarketplace, parseEther("1.2"));
      await nftMarketplace
        .connect(users[2])
        .buyAuctionNftWithErc20Token(listingErc1155Id, parseEther("1.2"));

      await erc20.connect(users[3]).approve(nftMarketplace, parseEther("1.3"));
      await nftMarketplace
        .connect(users[3])
        .buyAuctionNftWithErc20Token(listingErc1155Id, parseEther("1.3"));

      await erc20.connect(users[2]).approve(nftMarketplace, parseEther("1.4"));
      await nftMarketplace
        .connect(users[2])
        .buyAuctionNftWithErc20Token(listingErc1155Id, parseEther("0.2"));

      await time.increase(4 * 24 * 60 * 60);
      await expect(
        nftMarketplace.connect(users[1]).releaseNft(listingErc1155Id)
      ).to.revertedWithCustomError(nftMarketplace, "InvalidOwner");
      await expect(
        nftMarketplace.connect(users[0]).releaseNft(listingErc1155Id)
      )
        .to.emit(nftMarketplace, "BuyNft")
        .withArgs(
          users[2].address,
          users[0],
          await erc1155.getAddress(),
          0,
          1,
          parseEther("1.4")
        );
      expect(await erc20.balanceOf(users[0])).to.eq(parseEther("1.3979"));
      expect(await erc20.balanceOf(treasury)).to.eq(parseEther("0.0021"));
      expect(await erc1155.balanceOf(users[2], 0)).to.eq(1);
    });
  });
});
