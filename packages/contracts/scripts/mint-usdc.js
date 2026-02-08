const { ethers } = require("hardhat");

async function main() {
  const usdcAddress = "0x77eB3E04229C2D31d4D8637D18200a18Ff167B5B";
  const copierAddress = "0x899D9B792a2A4E1166D058D68d17DC0Df33666C7";

  console.log("💵 Minting test USDC to copier wallet...\n");
  console.log("USDC Contract:", usdcAddress);
  console.log("Copier Address:", copierAddress);
  console.log("");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = MockERC20.attach(usdcAddress);

  // Mint 10,000 USDC (6 decimals)
  const amount = ethers.parseUnits("10000", 6);

  console.log("Minting 10,000 USDC...");
  const tx = await usdc.mint(copierAddress, amount);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  await tx.wait();

  console.log("\n✅ Success!");
  console.log("Minted 10,000 USDC to", copierAddress);

  // Check balance
  const balance = await usdc.balanceOf(copierAddress);
  console.log("New USDC balance:", ethers.formatUnits(balance, 6), "USDC");
  console.log("\n🎉 Your copier wallet now has test USDC!");
  console.log("Go back to the browser and try subscribing again!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
