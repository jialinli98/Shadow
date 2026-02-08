const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Prepare tokens for adding liquidity:
 * 1. Mint test USDC to deployer
 * 2. Wrap ETH to WETH
 */
async function main() {
  console.log("💰 Preparing tokens for liquidity provision...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);

  // Load deployment
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const latestFile = path.join(deploymentsDir, `${network.name}-latest.json`);
  const deployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));

  const usdcAddress = deployment.contracts.MockERC20_USDC;
  const wethAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH on Sepolia

  console.log("  USDC:", usdcAddress);
  console.log("  WETH:", wethAddress);
  console.log();

  // ERC20 ABI
  const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function mint(address to, uint256 amount) external",
    "function deposit() payable external",
  ];

  // Step 1: Mint USDC
  console.log("📝 Step 1: Minting test USDC...");
  const usdc = new ethers.Contract(usdcAddress, erc20ABI, deployer);

  try {
    const mintAmount = ethers.parseUnits("10000", 18); // 10k USDC
    const mintTx = await usdc.mint(deployer.address, mintAmount);
    await mintTx.wait();
    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("✅ Minted USDC! Balance:", ethers.formatUnits(usdcBalance, 18));
  } catch (error) {
    console.log("⚠️  USDC mint failed (may not have mint function):", error.message);
    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("Current USDC balance:", ethers.formatUnits(usdcBalance, 18));
  }

  console.log();

  // Step 2: Wrap ETH to WETH
  console.log("📝 Step 2: Wrapping ETH to WETH...");
  const weth = new ethers.Contract(wethAddress, erc20ABI, deployer);

  try {
    const wrapAmount = ethers.parseEther("0.01"); // Wrap 0.01 ETH
    const wrapTx = await weth.deposit({ value: wrapAmount });
    await wrapTx.wait();
    const wethBalance = await weth.balanceOf(deployer.address);
    console.log("✅ Wrapped ETH! WETH Balance:", ethers.formatEther(wethBalance));
  } catch (error) {
    console.log("⚠️  WETH wrapping failed:", error.message);
    const wethBalance = await weth.balanceOf(deployer.address);
    console.log("Current WETH balance:", ethers.formatEther(wethBalance));
  }

  console.log();
  console.log("✨ Token preparation complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Show final balances
  const finalUsdcBalance = await usdc.balanceOf(deployer.address);
  const finalWethBalance = await weth.balanceOf(deployer.address);

  console.log("Final Balances:");
  console.log("  USDC:", ethers.formatUnits(finalUsdcBalance, 18));
  console.log("  WETH:", ethers.formatEther(finalWethBalance));
  console.log();
  console.log("📋 Next: Run add-liquidity-simple.js to add these tokens to the pool");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
