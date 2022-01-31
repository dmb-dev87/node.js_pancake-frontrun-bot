const hre = require("hardhat");

async function main() {
  const Trigger = await hre.ethers.getContractFactory("Trigger");
  const trigger = await Trigger.deploy();

  await trigger.deployed();

  console.log("Trigger deployed to:", trigger.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
