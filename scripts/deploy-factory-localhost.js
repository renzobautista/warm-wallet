const hre = require("hardhat");

async function main() {
  const chainId = 1337;
  const fee = hre.ethers.utils.parseUnits("1.0"); // 1 eth fee
  const WarmWalletFactory = await hre.ethers.getContractFactory("WarmWalletFactory");
  const factory = await WarmWalletFactory.deploy(chainId, fee);

  await factory.deployed();

  console.log("WarmWalletFactory deployed to:", factory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
