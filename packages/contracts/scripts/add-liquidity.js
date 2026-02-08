const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Add liquidity to the Uniswap V4 pool
 * Uses the PositionManager contract to provide liquidity
 */
async function main() {
  console.log("💧 Adding Liquidity to Uniswap V4 Pool...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Account:", deployer.address);

  // Load deployment addresses
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, `${network.name}-latest.json`);
  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));

  if (!deployment.pool) {
    throw new Error("Pool not initialized! Run initialize-uniswap-pool.js first.");
  }

  const poolInfo = deployment.pool;
  const usdcAddress = deployment.contracts.MockERC20_USDC;

  // Uniswap V4 PositionManager on Sepolia
  const positionManagerAddress = "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4";

  console.log("📋 Pool Info:");
  console.log("  Currency0:", poolInfo.currency0);
  console.log("  Currency1:", poolInfo.currency1);
  console.log("  Fee:", poolInfo.fee);
  console.log();

  // Get token contracts
  const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
  ];

  const currency0Contract = new ethers.Contract(
    poolInfo.currency0,
    erc20ABI,
    deployer
  );
  const currency1Contract = new ethers.Contract(
    poolInfo.currency1,
    erc20ABI,
    deployer
  );

  // Check balances
  const balance0 = await currency0Contract.balanceOf(deployer.address);
  const balance1 = await currency1Contract.balanceOf(deployer.address);

  console.log("💰 Your Balances:");
  console.log("  Currency0:", ethers.formatUnits(balance0, 18));
  console.log("  Currency1:", ethers.formatUnits(balance1, 18));
  console.log();

  // Liquidity amounts (provide 1000 of each token)
  const amount0 = ethers.parseUnits("1000", 18);
  const amount1 = ethers.parseUnits("1000", 18);

  console.log("📝 Approving tokens...");

  // Approve PositionManager to spend tokens
  const approve0 = await currency0Contract.approve(positionManagerAddress, amount0);
  await approve0.wait();
  console.log("✅ Currency0 approved");

  const approve1 = await currency1Contract.approve(positionManagerAddress, amount1);
  await approve1.wait();
  console.log("✅ Currency1 approved");

  console.log();
  console.log("📝 Adding liquidity...");
  console.log("  Amount0:", ethers.formatUnits(amount0, 18));
  console.log("  Amount1:", ethers.formatUnits(amount1, 18));

  // PositionManager ABI (simplified)
  const positionManagerABI = [
    "function mint((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 amount0Max, uint256 amount1Max, address recipient, uint256 deadline) external returns (uint256 tokenId)",
  ];

  const positionManager = new ethers.Contract(
    positionManagerAddress,
    positionManagerABI,
    deployer
  );

  const poolKey = {
    currency0: poolInfo.currency0,
    currency1: poolInfo.currency1,
    fee: poolInfo.fee,
    tickSpacing: poolInfo.tickSpacing,
    hooks: poolInfo.hooks,
  };

  // Full range liquidity: min tick to max tick
  const tickLower = -887220; // Min tick for tick spacing 60
  const tickUpper = 887220;  // Max tick for tick spacing 60

  // Calculate liquidity (simplified)
  const liquidity = ethers.parseUnits("1000", 18);

  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  try {
    const tx = await positionManager.mint(
      poolKey,
      tickLower,
      tickUpper,
      liquidity,
      amount0,
      amount1,
      deployer.address,
      deadline
    );

    console.log("⏳ Transaction submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Liquidity added! Gas used:", receipt.gasUsed.toString());

    console.log("\n✨ Liquidity Addition Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("You can now perform swaps through the pool!");

  } catch (error) {
    console.error("\n❌ Liquidity addition failed!");
    console.error("Error:", error.message);

    if (error.message.includes("insufficient")) {
      console.log("\n💡 You may need to mint more test tokens first.");
      console.log("Run: npx hardhat run scripts/mint-usdc.js --network sepolia");
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
