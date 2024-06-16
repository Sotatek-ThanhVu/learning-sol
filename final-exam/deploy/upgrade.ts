import { NftMarketplace } from "../types";

const { ethers, upgrades } = require("hardhat");

const NFT_MARKETPLACE_ADDRESS = "0xDb3D51b116AFbfFf0d0C21eb69bA412E126FCc14";
async function main() {
  const NftMarketplaceFactoryV2 = await ethers.getContractFactory(
    "NftMarketplace"
  );
  const nftMarketplace = (await upgrades.upgradeProxy(
    NFT_MARKETPLACE_ADDRESS,
    NftMarketplaceFactoryV2
  )) as NftMarketplace;
  await nftMarketplace.waitForDeployment();
  console.log("NFT Marketplace upgraded");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
