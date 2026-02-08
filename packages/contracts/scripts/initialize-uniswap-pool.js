const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Initialize a Uniswap V4 pool for Shadow settlement
 * This creates a USDC/WETH pool with your ShadowSettlementHook attached
 */
async function main() {
  console.log("🏊 Initializing Uniswap V4 Pool...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Account:", deployer.address);

  // Load deployment addresses
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, `${network.name}-latest.json`);
  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));

  const poolManagerAddress = deployment.contracts.UniswapV4PoolManager;
  const settlementHookAddress = deployment.contracts.ShadowSettlementHook;
  const usdcAddress = deployment.contracts.MockERC20_USDC;

  // WETH on Sepolia
  const wethAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

  console.log("📋 Contract Addresses:");
  console.log("  PoolManager:", poolManagerAddress);
  console.log("  Settlement Hook:", settlementHookAddress);
  console.log("  USDC:", usdcAddress);
  console.log("  WETH:", wethAddress);
  console.log();

  // PoolManager ABI (minimal for initialization)
  const poolManagerABI = [
    "function initialize((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96, bytes calldata hookData) external returns (int24)",
  ];

  const poolManager = new ethers.Contract(
    poolManagerAddress,
    poolManagerABI,
    deployer
  );

  // Sort tokens (currency0 < currency1)
  let currency0, currency1;
  if (usdcAddress.toLowerCase() < wethAddress.toLowerCase()) {
    currency0 = usdcAddress;
    currency1 = wethAddress;
  } else {
    currency0 = wethAddress;
    currency1 = usdcAddress;
  }

  console.log("🔄 Token Pair (sorted):");
  console.log("  Currency0:", currency0);
  console.log("  Currency1:", currency1);
  console.log();

  // Pool parameters
  const fee = 3000; // 0.3% fee tier
  const tickSpacing = 60; // Standard for 0.3% fee
  const hooks = settlementHookAddress;

  // Starting price: 1 USDC = 0.0003 ETH (approximately)
  // sqrtPriceX96 = sqrt(price) * 2^96
  // For USDC/WETH, price = WETH per USDC
  // If WETH is currency0: price = 1/3333 = 0.0003
  // sqrtPrice = sqrt(0.0003) ≈ 0.01732
  // sqrtPriceX96 = 0.01732 * 2^96 ≈ 1.37e24

  // Default: assume equal value (1:1 ratio for testing)
  const sqrtPriceX96 = "79228162514264337593543950336"; // sqrt(1) * 2^96

  console.log("🎯 Pool Parameters:");
  console.log("  Fee:", fee, "(0.3%)");
  console.log("  Tick Spacing:", tickSpacing);
  console.log("  Starting Price (sqrtPriceX96):", sqrtPriceX96);
  console.log("  Hooks:", hooks);
  console.log();

  // Create pool key
  const poolKey = {
    currency0: currency0,
    currency1: currency1,
    fee: fee,
    tickSpacing: tickSpacing,
    hooks: hooks,
  };

  console.log("📝 Initializing pool...");

  try {
    const tx = await poolManager.initialize(
      poolKey,
      sqrtPriceX96,
      "0x" // empty hookData for initialization
    );

    console.log("⏳ Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Pool initialized! Gas used:", receipt.gasUsed.toString());

    // Save pool info
    deployment.pool = {
      currency0,
      currency1,
      fee,
      tickSpacing,
      hooks,
      sqrtPriceX96,
      initialized: new Date().toISOString(),
    };

    const filename = `${network.name}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
    fs.writeFileSync(latestFile, JSON.stringify(deployment, null, 2));

    console.log("\n✨ Pool Initialization Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Pool Key:", JSON.stringify(poolKey, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("\n📋 Next Steps:");
    console.log("1. Add liquidity to the pool using PositionManager");
    console.log("2. Test swaps through the ShadowSettlementHook");
    console.log("3. Verify the hook is being called correctly");

  } catch (error) {
    console.error("\n❌ Pool initialization failed!");
    console.error("Error:", error.message);

    if (error.message.includes("PoolAlreadyInitialized")) {
      console.log("\n💡 This pool is already initialized.");
      console.log("You can start adding liquidity or performing swaps.");
    } else if (error.message.includes("InvalidHookAddress")) {
      console.log("\n💡 Hook address validation failed.");
      console.log("Make sure the hook address has the correct flags in its address.");
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
