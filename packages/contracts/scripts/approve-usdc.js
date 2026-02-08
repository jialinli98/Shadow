const { ethers } = require("hardhat");

async function main() {
  const usdcAddress = "0x77eB3E04229C2D31d4D8637D18200a18Ff167B5B";
  const registryAddress = "0xaad7376A2B7D1a5C3615B969bFf0Ce46B6ac8C9d";

  console.log("📝 Approving USDC spending for Shadow Registry...\n");

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = MockERC20.attach(usdcAddress);

  // Approve unlimited USDC (common pattern)
  const maxApproval = ethers.MaxUint256;

  console.log("USDC:", usdcAddress);
  console.log("Spender (Registry):", registryAddress);
  console.log("Amount: Unlimited\n");

  console.log("Sending approval transaction...");
  const tx = await usdc.approve(registryAddress, maxApproval);
  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  await tx.wait();

  console.log("\n✅ Approval successful!");
  console.log("Shadow Registry can now spend your USDC");
  console.log("\nNow try subscribing in the frontend again!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
