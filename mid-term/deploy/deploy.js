const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deploying contracts by:", signer.address);

  const Token = await ethers.getContractFactory("Token");
  const SwapCenter = await ethers.getContractFactory("SwapCenter");

  const tokenA = await Token.connect(signer).deploy("TokenA", "TKA");
  console.log("TokenA deployed to Address:", await tokenA.getAddress());

  const tokenB = await Token.connect(signer).deploy("TokenB", "TKB");
  console.log("TokenB deployed to Address:", await tokenB.getAddress());

  const swapCenter = await SwapCenter.connect(signer).deploy(signer.address, 5);
  console.log(
    `SwapCenter deployed to Address: ${await swapCenter.getAddress()} with 5% tax and treasury address is ${
      signer.address
    }`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
