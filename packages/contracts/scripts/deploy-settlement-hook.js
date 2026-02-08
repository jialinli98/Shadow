const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying ShadowSettlementHook...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Load latest deployment to get other contract addresses
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, `${network.name}-latest.json`);

  let registryAddress, feeManagerAddress, adjudicatorAddress;

  if (fs.existsSync(latestFile)) {
    const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));
    registryAddress = deployment.contracts.ShadowRegistry;
    feeManagerAddress = deployment.contracts.ShadowFeeManager;
    adjudicatorAddress = deployment.contracts.MockYellowAdjudicator;

    console.log("📋 Using deployed contracts:");
    console.log("  Registry:", registryAddress);
    console.log("  FeeManager:", feeManagerAddress);
    console.log("  Adjudicator:", adjudicatorAddress);
    console.log();
  } else {
    throw new Error("No deployment found! Run deploy.js first.");
  }

  // Use official Uniswap V4 PoolManager on Sepolia
  const poolManagerAddress = "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543";
  console.log("📝 Using official Uniswap V4 PoolManager:", poolManagerAddress);

  // Deploy ShadowSettlementHook
  console.log("\n📝 Deploying ShadowSettlementHook...");
  const ShadowSettlementHook = await ethers.getContractFactory("ShadowSettlementHook");
  const settlementHook = await ShadowSettlementHook.deploy(
    poolManagerAddress,
    adjudicatorAddress,
    feeManagerAddress
  );
  await settlementHook.waitForDeployment();
  const settlementHookAddress = await settlementHook.getAddress();
  console.log("✅ ShadowSettlementHook deployed to:", settlementHookAddress);

  // Update deployment info
  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));
  deployment.contracts.ShadowSettlementHook = settlementHookAddress;
  deployment.contracts.UniswapV4PoolManager = poolManagerAddress;
  deployment.timestamp = new Date().toISOString();

  // Save updated deployment
  const filename = `${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
  fs.writeFileSync(latestFile, JSON.stringify(deployment, null, 2));

  console.log("\n📄 Deployment info updated:", latestFile);

  console.log("\n✨ Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ShadowSettlementHook:", settlementHookAddress);
  console.log("Uniswap V4 PoolManager:", poolManagerAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n📋 Next Steps:");
  console.log("1. Update backend .env with SETTLEMENT_HOOK_ADDRESS");
  console.log("2. Update frontend .env with VITE_SETTLEMENT_HOOK_ADDRESS");
  console.log("3. Start the API server and frontend");

  console.log("\n🎉 Settlement hook deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
