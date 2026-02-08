const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Wallet address:", signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Sepolia ETH balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.log("\n❌ You have 0 Sepolia ETH!");
    console.log("Get free Sepolia ETH from: https://sepoliafaucet.com/");
    console.log("Paste your address:", signer.address);
    process.exit(1);
  } else {
    console.log("\n✅ You have enough ETH to deploy!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
