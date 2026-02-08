const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Add liquidity to Uniswap V4 pool using PoolModifyLiquidityTest
 * Simpler approach for testing
 */
async function main() {
  console.log("💧 Adding Liquidity to Pool...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // Load deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, `${network.name}-latest.json`);
  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));

  if (!deployment.poolNoHook) {
    throw new Error("Pool not found! Run initialize-pool-no-hook.js first.");
  }

  const poolInfo = deployment.poolNoHook;
  const poolManagerAddress = deployment.contracts.UniswapV4PoolManager;

  // PoolModifyLiquidityTest on Sepolia
  const modifyLiquidityTestAddress = "0x0c478023803a644c94c4ce1c1e7b9a087e411b0a";

  console.log("📋 Setup:");
  console.log("  PoolManager:", poolManagerAddress);
  console.log("  ModifyLiquidityTest:", modifyLiquidityTestAddress);
  console.log("  Currency0:", poolInfo.currency0);
  console.log("  Currency1:", poolInfo.currency1);
  console.log();

  // Token contracts
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
  ];

  const currency0 = new ethers.Contract(poolInfo.currency0, erc20ABI, deployer);
  const currency1 = new ethers.Contract(poolInfo.currency1, erc20ABI, deployer);

  // Check balances
  const balance0 = await currency0.balanceOf(deployer.address);
  const balance1 = await currency1.balanceOf(deployer.address);

  console.log("💰 Your Balances:");
  console.log("  Currency0:", ethers.formatUnits(balance0, 18));
  console.log("  Currency1:", ethers.formatUnits(balance1, 18));
  console.log();

  if (balance0 === 0n || balance1 === 0n) {
    console.error("❌ Insufficient token balance!");
    console.log("Run: npx hardhat run scripts/prepare-liquidity-tokens.js --network sepolia");
    process.exit(1);
  }

  // Approve PoolManager to spend tokens (PoolManager needs approval, not the test contract)
  const approveAmount = ethers.parseUnits("1000", 18);

  console.log("📝 Approving tokens for PoolManager...");

  try {
    const approve0Tx = await currency0.approve(poolManagerAddress, approveAmount);
    await approve0Tx.wait();
    console.log("✅ Currency0 approved");

    const approve1Tx = await currency1.approve(poolManagerAddress, approveAmount);
    await approve1Tx.wait();
    console.log("✅ Currency1 approved");
  } catch (error) {
    console.error("❌ Approval failed:", error.message);
    throw error;
  }

  console.log();

  // PoolModifyLiquidityTest ABI
  const modifyLiquidityABI = [
    "function modifyLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt) params, bytes hookData) external payable returns (bytes memory)",
  ];

  const modifyLiquidityTest = new ethers.Contract(
    modifyLiquidityTestAddress,
    modifyLiquidityABI,
    deployer
  );

  // Pool key from deployment
  const poolKey = {
    currency0: poolInfo.currency0,
    currency1: poolInfo.currency1,
    fee: poolInfo.fee,
    tickSpacing: poolInfo.tickSpacing,
    hooks: poolInfo.hooks,
  };

  // Liquidity params - full range
  const MIN_TICK = -887220;
  const MAX_TICK = 887220;
  const liquidityDelta = ethers.parseUnits("100", 18); // Add 100 units of liquidity

  const params = {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityDelta,
    salt: ethers.ZeroHash,
  };

  console.log("📝 Adding liquidity...");
  console.log("  Tick Range:", MIN_TICK, "to", MAX_TICK);
  console.log("  Liquidity Delta:", ethers.formatUnits(liquidityDelta, 18));
  console.log();

  try {
    // Send some ETH in case it's needed for native token handling
    const tx = await modifyLiquidityTest.modifyLiquidity(
      poolKey,
      params,
      "0x", // empty hookData
      { value: ethers.parseEther("0.001") } // small amount for gas/native handling
    );

    console.log("⏳ Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Liquidity added! Gas used:", receipt.gasUsed.toString());

    console.log("\n✨ Liquidity Addition Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("You can now perform swaps in the pool!");
    console.log("\n📋 Pool Details:");
    console.log("  Pair: USDC/WETH");
    console.log("  Fee: 0.3%");
    console.log("  Hooks: None (testing)");

  } catch (error) {
    console.error("\n❌ Liquidity addition failed!");
    console.error("Error:", error.message);

    if (error.message.includes("insufficient")) {
      console.log("\n💡 You may need more tokens.");
    } else if (error.message.includes("CurrencyNotSettled")) {
      console.log("\n💡 Currency settlement issue. This is a Uniswap V4 internal state problem.");
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
