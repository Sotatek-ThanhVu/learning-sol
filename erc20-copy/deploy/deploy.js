const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deploying contracts by:", signer.address);

  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy(
    "VMTpld",
    "VPD",
    "0xDeb9Ae22146BA4989504581F204883c05167d43B",
  );
  console.log("Contract Deployed to Address:", await myToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
