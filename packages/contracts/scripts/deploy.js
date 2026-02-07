const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting Shadow contract deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy ShadowRegistry
  console.log("📝 Deploying ShadowRegistry...");
  const ShadowRegistry = await ethers.getContractFactory("ShadowRegistry");
  const registry = await ShadowRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ ShadowRegistry deployed to:", registryAddress);

  // Deploy Mock Yellow Adjudicator (for testing)
  // In production, this would be the actual Yellow Network adjudicator address
  console.log("\n📝 Deploying MockYellowAdjudicator (for testing)...");
  const MockYellowAdjudicator = await ethers.getContractFactory("MockYellowAdjudicator");
  const yellowAdjudicator = await MockYellowAdjudicator.deploy();
  await yellowAdjudicator.waitForDeployment();
  const adjudicatorAddress = await yellowAdjudicator.getAddress();
  console.log("✅ MockYellowAdjudicator deployed to:", adjudicatorAddress);

  // Deploy Mock ERC20 (USDC) for testing
  console.log("\n📝 Deploying MockERC20 (USDC)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const feeToken = await MockERC20.deploy("USD Coin", "USDC", 6);
  await feeToken.waitForDeployment();
  const feeTokenAddress = await feeToken.getAddress();
  console.log("✅ MockERC20 (USDC) deployed to:", feeTokenAddress);

  // Deploy ShadowFeeManager
  console.log("\n📝 Deploying ShadowFeeManager...");
  const ShadowFeeManager = await ethers.getContractFactory("ShadowFeeManager");
  const feeManager = await ShadowFeeManager.deploy(
    registryAddress,
    adjudicatorAddress,
    feeTokenAddress
  );
  await feeManager.waitForDeployment();
  const feeManagerAddress = await feeManager.getAddress();
  console.log("✅ ShadowFeeManager deployed to:", feeManagerAddress);

  // Set fee manager in registry
  console.log("\n🔗 Setting fee manager in registry...");
  const tx = await registry.setFeeManager(feeManagerAddress);
  await tx.wait();
  console.log("✅ Fee manager set successfully");

  // Save deployment addresses
  const deploymentInfo = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ShadowRegistry: registryAddress,
      ShadowFeeManager: feeManagerAddress,
      MockYellowAdjudicator: adjudicatorAddress,
      MockERC20_USDC: feeTokenAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  // Also save as latest
  const latestFilepath = path.join(deploymentsDir, `${network.name}-latest.json`);
  fs.writeFileSync(latestFilepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n📄 Deployment info saved to:", filepath);
  console.log("📄 Latest deployment saved to:", latestFilepath);

  console.log("\n✨ Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", network.name);
  console.log("Chain ID:", deploymentInfo.chainId);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ShadowRegistry:", registryAddress);
  console.log("ShadowFeeManager:", feeManagerAddress);
  console.log("MockYellowAdjudicator:", adjudicatorAddress);
  console.log("MockERC20 (USDC):", feeTokenAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n📋 Next Steps:");
  console.log("1. Verify contracts on block explorer (run: npm run verify)");
  console.log("2. Update frontend .env with contract addresses");
  console.log("3. Update relay .env with contract addresses");
  console.log("4. Fund test accounts with mock USDC (if testing)");

  // If on testnet, mint some USDC to deployer for testing
  if (network.name !== "mainnet") {
    console.log("\n💵 Minting test USDC to deployer...");
    const mintAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
    const mintTx = await feeToken.mint(deployer.address, mintAmount);
    await mintTx.wait();
    console.log("✅ Minted", ethers.formatUnits(mintAmount, 6), "USDC to", deployer.address);
  }

  console.log("\n🎉 Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
