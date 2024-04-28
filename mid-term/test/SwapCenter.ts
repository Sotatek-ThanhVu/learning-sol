import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { SwapCenter, Token } from "../typechain-types";

enum OrderStatus {
  WAITING,
  ACCEPTED,
  REJECTED,
  CANCELED,
}

describe("SwapCenter", function () {
  let admin: SignerWithAddress;
  let user_1: SignerWithAddress;
  let user_2: SignerWithAddress;
  let treasury: SignerWithAddress;
  let treasury1: SignerWithAddress;

  let tokenA: Token;
  let tokenAAddr: string;
  let tokenB: Token;
  let tokenBAddr: string;
  let swapCenter: SwapCenter;
  let swapCenterAddr: string;

  const TOKEN_A = {
    name: "TokenA",
    symbol: "TKA",
    balance: "500000000000000000000", // 500 tokenA
  };
  const TOKEN_B = {
    name: "TokenB",
    symbol: "TKB",
    balance: "500000000000000000000", // 500 tokenB
  };

  const TAX = 5;
  const NEW_TAX = 6;
  const SUCCESS_ORDER = {
    tokenAAmount: "10000000000000000000",
    tokenBAmount: "20000000000000000000",
    orderId: 1,
  };
  const FAIL_ORDER = {
    tokenAAmount: "20000000000000000000",
    tokenBAmount: "10000000000000000000",
    orderId: 2,
  };

  const DEFAULT_ADDRESS = "0x0000000000000000000000000000000000000000";
  const DEFAULT_VALUE = 0;

  before(async () => {
    const signers = await hre.ethers.getSigners();

    admin = signers[0];
    user_1 = signers[1];
    user_2 = signers[2];
    treasury = signers[3];
    treasury1 = signers[4];
  });

  async function fixture() {
    // Deploy Token
    const Token = await hre.ethers.getContractFactory("Token");

    const tokenA = await Token.connect(admin).deploy(
      TOKEN_A.name,
      TOKEN_A.symbol
    );
    await tokenA.waitForDeployment();
    const tokenAAddr = await tokenA.getAddress();

    const tokenB = await Token.connect(admin).deploy(
      TOKEN_B.name,
      TOKEN_B.symbol
    );
    await tokenB.waitForDeployment();
    const tokenBAddr = await tokenB.getAddress();

    // Deploy SwapCenter
    const SwapCenter = await hre.ethers.getContractFactory("SwapCenter");
    const swapCenter = await SwapCenter.connect(admin).deploy(
      treasury.address,
      TAX
    );
    await swapCenter.waitForDeployment();
    const swapCenterAddr = await swapCenter.getAddress();

    return {
      tokenA,
      tokenAAddr,
      tokenB,
      tokenBAddr,
      swapCenter,
      swapCenterAddr,
    };
  }

  beforeEach(async () => {
    const data = await loadFixture(fixture);
    tokenA = data.tokenA;
    tokenAAddr = data.tokenAAddr;
    tokenB = data.tokenB;
    tokenBAddr = data.tokenBAddr;
    swapCenter = data.swapCenter;
    swapCenterAddr = data.swapCenterAddr;

    await tokenA.connect(admin).mint(user_1.address, TOKEN_A.balance);
    await tokenB.connect(admin).mint(user_2.address, TOKEN_B.balance);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await tokenA.owner()).to.equal(admin.address);
      expect(await tokenB.owner()).to.equal(admin.address);
      expect(await swapCenter.owner()).to.equal(admin.address);
    });

    it("Should receive and store the fund to wallet", async function () {
      expect(await tokenA.balanceOf(user_1)).to.equal(TOKEN_A.balance);
      expect(await tokenA.balanceOf(user_2)).to.equal(0);
      expect(await tokenB.balanceOf(user_1)).to.equal(0);
      expect(await tokenB.balanceOf(user_2)).to.equal(TOKEN_B.balance);
    });

    it("Should set the right tax and treasury address", async function () {
      expect(await swapCenter.tax()).to.equal(TAX);
      expect(await swapCenter.treasury()).to.equal(treasury.address);
    });
  });

  describe("Swap", function () {
    const createFirstSwapRequest = async () => {
      await tokenA
        .connect(user_1)
        .approve(swapCenterAddr, SUCCESS_ORDER.tokenAAmount);
      await swapCenter
        .connect(user_1)
        .swap(
          user_2.address,
          tokenAAddr,
          tokenBAddr,
          SUCCESS_ORDER.tokenAAmount,
          SUCCESS_ORDER.tokenBAmount,
          SUCCESS_ORDER.orderId
        );
    };

    describe("Create swap request", function () {
      it("Should emit created order", async function () {
        await tokenA
          .connect(user_1)
          .approve(swapCenterAddr, SUCCESS_ORDER.tokenAAmount);
        await expect(
          swapCenter
            .connect(user_1)
            .swap(
              user_2.address,
              tokenAAddr,
              tokenBAddr,
              SUCCESS_ORDER.tokenAAmount,
              SUCCESS_ORDER.tokenBAmount,
              SUCCESS_ORDER.orderId
            )
        )
          .emit(swapCenter, "CreateSwap")
          .withArgs(SUCCESS_ORDER.orderId);
      });

      it("Should revert exists order", async function () {
        // User_1 { 10 tokenA } -> User_2 { 20 token B } (1)
        await tokenA
          .connect(user_1)
          .approve(swapCenterAddr, SUCCESS_ORDER.tokenAAmount);
        await swapCenter
          .connect(user_1)
          .swap(
            user_2.address,
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            SUCCESS_ORDER.tokenAAmount,
            SUCCESS_ORDER.tokenBAmount,
            SUCCESS_ORDER.orderId
          );

        // User_2 { 20 tokenA } -> User_1 { 10 tokenB } (1)
        await tokenA
          .connect(user_2)
          .approve(swapCenterAddr, FAIL_ORDER.tokenAAmount);
        await expect(
          swapCenter
            .connect(user_2)
            .swap(
              user_1.address,
              tokenAAddr,
              tokenBAddr,
              FAIL_ORDER.tokenAAmount,
              FAIL_ORDER.tokenBAmount,
              SUCCESS_ORDER.orderId
            )
        ).revertedWith("Order already exists");
      });

      it("Should revert insufficient balance", async function () {
        // User_1 { 10 tokenB } -> User_2 { 20 tokenA } (1)
        await tokenB
          .connect(user_1)
          .approve(swapCenterAddr, FAIL_ORDER.tokenBAmount);
        await expect(
          swapCenter
            .connect(user_1)
            .swap(
              user_2.address,
              tokenBAddr,
              tokenAAddr,
              FAIL_ORDER.tokenBAmount,
              FAIL_ORDER.tokenAAmount,
              FAIL_ORDER.orderId
            )
        )
          .revertedWithCustomError(tokenB, "ERC20InsufficientBalance")
          .withArgs(user_1.address, DEFAULT_VALUE, FAIL_ORDER.tokenBAmount);
      });
    });

    describe("Get swap request", function () {
      beforeEach(createFirstSwapRequest);

      it("Should get the first order", async function () {
        const order = await swapCenter.getOrder(SUCCESS_ORDER.orderId);
        expect(order.sourceAddr).to.equal(user_1.address);
        expect(order.desAddr).to.equal(user_2.address);
        expect(order.sourceToken).to.equal(tokenAAddr);
        expect(order.desToken).to.equal(tokenBAddr);
        expect(order.sourceAmount).to.equal(SUCCESS_ORDER.tokenAAmount);
        expect(order.desAmount).to.equal(SUCCESS_ORDER.tokenBAmount);
      });

      it("Should get the empty order", async function () {
        const order = await swapCenter.getOrder(FAIL_ORDER.orderId);
        expect(order.sourceAddr).to.equal(DEFAULT_ADDRESS);
        expect(order.desAddr).to.equal(DEFAULT_ADDRESS);
        expect(order.sourceToken).to.equal(DEFAULT_ADDRESS);
        expect(order.desToken).to.equal(DEFAULT_ADDRESS);
        expect(order.sourceAmount).to.equal(DEFAULT_VALUE);
        expect(order.desAmount).to.equal(DEFAULT_VALUE);
      });
    });

    describe("Fulfill swap request", function () {
      beforeEach(createFirstSwapRequest);

      it("Should reject wrong order receiver", async function () {
        await expect(
          swapCenter
            .connect(user_1)
            .fulfillOrder(SUCCESS_ORDER.orderId, OrderStatus.ACCEPTED)
        ).revertedWith("Order can be fulfilled only by its receiver");
      });

      it("Should reject random order status", async function () {
        await expect(
          swapCenter.connect(user_2).fulfillOrder(SUCCESS_ORDER.orderId, 5) // Random status
        ).revertedWithoutReason();
      });

      it("Should reject wrong order status", async function () {
        await expect(
          swapCenter
            .connect(user_2)
            .fulfillOrder(SUCCESS_ORDER.orderId, OrderStatus.CANCELED) // Random status
        ).revertedWith("Only ACCEPTED or REJECTED are allowed");
      });

      it("Should reject wrong owner to cancel order", async function () {
        await expect(
          swapCenter.connect(user_2).cancelOrder(SUCCESS_ORDER.orderId)
        ).revertedWith("Order can be canceled only by its owner");
      });

      it("Should emit cancel order", async function () {
        await expect(
          swapCenter.connect(user_1).cancelOrder(SUCCESS_ORDER.orderId)
        )
          .emit(swapCenter, "CanceledRequest")
          .withArgs(SUCCESS_ORDER.orderId);
      });

      it("Should emit accept order", async function () {
        await tokenB
          .connect(user_2)
          .approve(swapCenterAddr, SUCCESS_ORDER.tokenBAmount);
        await expect(
          swapCenter
            .connect(user_2)
            .fulfillOrder(SUCCESS_ORDER.orderId, OrderStatus.ACCEPTED)
        )
          .emit(swapCenter, "AcceptedRequest")
          .withArgs(SUCCESS_ORDER.orderId);

        expect(await tokenA.balanceOf(user_1)).equal("490000000000000000000");
        expect(await tokenA.balanceOf(user_2)).equal("9500000000000000000");
        expect(await tokenB.balanceOf(user_1)).equal("19000000000000000000");
        expect(await tokenB.balanceOf(user_2)).equal("480000000000000000000");
      });

      it("Should emit reject order", async function () {
        await expect(
          swapCenter
            .connect(user_2)
            .fulfillOrder(SUCCESS_ORDER.orderId, OrderStatus.REJECTED)
        )
          .emit(swapCenter, "RejectedRequest")
          .withArgs(SUCCESS_ORDER.orderId);
        expect(await tokenA.balanceOf(user_1)).equal(TOKEN_A.balance);
        expect(await tokenA.balanceOf(user_2)).equal(DEFAULT_VALUE);
        expect(await tokenB.balanceOf(user_1)).equal(DEFAULT_VALUE);
        expect(await tokenB.balanceOf(user_2)).equal(TOKEN_B.balance);
      });

      it("Should reject modify done order", async function () {
        await swapCenter
          .connect(user_2)
          .fulfillOrder(SUCCESS_ORDER.orderId, OrderStatus.REJECTED);
        await expect(
          swapCenter
            .connect(user_2)
            .fulfillOrder(SUCCESS_ORDER.orderId, OrderStatus.ACCEPTED)
        ).revertedWith("Only waiting order can be modified");
      });
    });
  });

  describe("Tax", function () {
    it("Should emit event set new tax", async function () {
      await expect(swapCenter.connect(admin).setTax(NEW_TAX))
        .emit(swapCenter, "UpdateTax")
        .withArgs(NEW_TAX);
    });

    it("Should revert wrong owner when set new tax", async function () {
      await expect(swapCenter.connect(user_1).setTax(NEW_TAX))
        .revertedWithCustomError(swapCenter, "OwnableUnauthorizedAccount")
        .withArgs(user_1.address);
    });
  });

  describe("Treasury", function () {
    it("Should emit event set new treasury address", async function () {
      await expect(swapCenter.connect(admin).setTreasury(treasury1.address))
        .emit(swapCenter, "UpdateTreasury")
        .withArgs(treasury1.address);
    });

    it("Should revert wrong owner when set new treasury address", async function () {
      await expect(swapCenter.connect(user_1).setTreasury(treasury1.address))
        .revertedWithCustomError(swapCenter, "OwnableUnauthorizedAccount")
        .withArgs(user_1.address);
    });
  });
});
