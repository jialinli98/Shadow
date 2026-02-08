const { ethers } = require("hardhat");

async function main() {
  const registryAddress = "0xaad7376A2B7D1a5C3615B969bFf0Ce46B6ac8C9d";
  const yourAddress = "0xE3d560feAa5d3d62e648CD8047b275C4c658ff19";

  const registry = await ethers.getContractAt("ShadowRegistry", registryAddress);

  console.log("Checking if you're registered as a leader...\n");

  const isRegistered = await registry.isRegistered(yourAddress);
  console.log("Is Registered:", isRegistered);

  if (isRegistered) {
    console.log("\n✅ You ARE registered as a leader!\n");

    const profile = await registry.getLeaderProfile(yourAddress);
    console.log("Leader Profile:");
    console.log("  ENS Name:", profile.ensName);
    console.log("  Performance Fee:", profile.performanceFee.toString(), "bps (", profile.performanceFee / 100, "%)");
    console.log("  Min Copier Deposit:", ethers.formatUnits(profile.minCopierDeposit, 18), "USDC");
    console.log("  Is Active:", profile.isActive);
    console.log("  Total Copiers:", profile.totalCopiers.toString());
    console.log("  Total Volume:", ethers.formatUnits(profile.totalVolume, 18), "USDC");
    console.log("  Fees Earned:", ethers.formatUnits(profile.feesEarned, 18), "USDC");
  } else {
    console.log("\n❌ You are NOT registered as a leader");
    console.log("Did the transaction fail? Check Sepolia Etherscan:");
    console.log(`https://sepolia.etherscan.io/address/${yourAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
