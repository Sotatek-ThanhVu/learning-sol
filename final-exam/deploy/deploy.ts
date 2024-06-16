import { ethers, upgrades } from "hardhat";
import { NftMarketplace } from "../types";

async function main() {
  const [owner, treasury] = await ethers.getSigners();
  console.log("Deploying contracts by:", owner.address);

  const NftMarketplaceFactory = await ethers.getContractFactory(
    "NftMarketplace"
  );
  const nftMarketplace = (await upgrades.deployProxy(NftMarketplaceFactory, [
    owner.address,
    treasury.address,
    15,
    15,
  ])) as unknown as NftMarketplace;
  await nftMarketplace.waitForDeployment();

  console.log(
    "NFT Marketplace deployed to:",
    await nftMarketplace.getAddress()
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
