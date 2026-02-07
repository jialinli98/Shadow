const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShadowSettlementHook", function () {
  let settlementHook;
  let yellowAdjudicator;
  let feeManager;
  let registry;
  let feeToken;
  let poolManager;
  let leader;
  let copier;
  let owner;

  const CHANNEL_ID = ethers.keccak256(ethers.toUtf8Bytes("test-channel-1"));
  const FINAL_NONCE = 10;
  const PERFORMANCE_FEE = ethers.parseUnits("100", 18); // 100 USDC
  const SIGNATURE = "0x" + "00".repeat(65);

  beforeEach(async function () {
    [owner, poolManager, leader, copier] = await ethers.getSigners();

    // Deploy mock fee token
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    feeToken = await MockERC20Factory.deploy("USDC", "USDC", 18);

    // Deploy ShadowRegistry
    const ShadowRegistryFactory = await ethers.getContractFactory("ShadowRegistry");
    registry = await ShadowRegistryFactory.deploy();

    // Deploy MockYellowAdjudicator
    const MockYellowAdjudicatorFactory = await ethers.getContractFactory("MockYellowAdjudicator");
    yellowAdjudicator = await MockYellowAdjudicatorFactory.deploy();

    // Deploy ShadowFeeManager
    const ShadowFeeManagerFactory = await ethers.getContractFactory("ShadowFeeManager");
    feeManager = await ShadowFeeManagerFactory.deploy(
      await registry.getAddress(),
      await yellowAdjudicator.getAddress(),
      await feeToken.getAddress()
    );

    // Deploy ShadowSettlementHook
    const ShadowSettlementHookFactory = await ethers.getContractFactory("ShadowSettlementHook");
    settlementHook = await ShadowSettlementHookFactory.deploy(
      poolManager.address,
      await yellowAdjudicator.getAddress(),
      await feeManager.getAddress()
    );

    // Register leader
    await registry.connect(leader).registerLeader(
      "leader.shadow.eth",
      1500, // 15% fee
      ethers.parseUnits("500", 18) // 500 USDC min
    );

    // Set fee manager
    await registry.setFeeManager(await feeManager.getAddress());

    // Mint fee tokens to copier
    await feeToken.mint(copier.address, ethers.parseUnits("10000", 18));

    // Approve feeManager to spend copier's tokens
    await feeToken.connect(copier).approve(await feeManager.getAddress(), ethers.MaxUint256);
  });

  describe("Settlement Flow", function () {
    it("Should successfully settle a valid state channel", async function () {
      // Mock Yellow adjudicator to return channel as finalized
      await yellowAdjudicator.setChannelFinalized(CHANNEL_ID, true);
      await yellowAdjudicator.setStateValid(CHANNEL_ID, FINAL_NONCE, true);

      const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32,uint256,bytes,address,uint256)"],
        [[CHANNEL_ID, FINAL_NONCE, SIGNATURE, leader.address, PERFORMANCE_FEE]]
      );

      const poolKey = {
        currency0: await feeToken.getAddress(),
        currency1: ethers.ZeroAddress,
        fee: 3000,
        tickSpacing: 60,
        hooks: await settlementHook.getAddress()
      };

      const swapParams = {
        zeroForOne: true,
        amountSpecified: ethers.parseUnits("1000", 18),
        sqrtPriceLimitX96: 0
      };

      const delta = 0;

      // Call afterSwap as poolManager
      await expect(
        settlementHook.connect(poolManager).afterSwap(
          copier.address,
          poolKey,
          swapParams,
          delta,
          settlementData
        )
      ).to.emit(settlementHook, "SessionSettled")
        .withArgs(CHANNEL_ID, copier.address, FINAL_NONCE, swapParams.amountSpecified, PERFORMANCE_FEE);

      // Verify channel is marked as settled
      expect(await settlementHook.isChannelSettled(CHANNEL_ID)).to.be.true;
    });

    it("Should reject settlement with invalid state proof", async function () {
      // Mock Yellow adjudicator to return invalid state
      await yellowAdjudicator.setChannelFinalized(CHANNEL_ID, true);
      await yellowAdjudicator.setStateValid(CHANNEL_ID, FINAL_NONCE, false);

      const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32,uint256,bytes,address,uint256)"],
        [[CHANNEL_ID, FINAL_NONCE, SIGNATURE, leader.address, PERFORMANCE_FEE]]
      );

      const poolKey = {
        currency0: await feeToken.getAddress(),
        currency1: ethers.ZeroAddress,
        fee: 3000,
        tickSpacing: 60,
        hooks: await settlementHook.getAddress()
      };

      const swapParams = {
        zeroForOne: true,
        amountSpecified: ethers.parseUnits("1000", 18),
        sqrtPriceLimitX96: 0
      };

      await expect(
        settlementHook.connect(poolManager).afterSwap(
          copier.address,
          poolKey,
          swapParams,
          0,
          settlementData
        )
      ).to.be.revertedWithCustomError(settlementHook, "InvalidStateProof");
    });

    it("Should reject double settlement of same channel", async function () {
      // Mock Yellow adjudicator
      await yellowAdjudicator.setChannelFinalized(CHANNEL_ID, true);
      await yellowAdjudicator.setStateValid(CHANNEL_ID, FINAL_NONCE, true);

      const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32,uint256,bytes,address,uint256)"],
        [[CHANNEL_ID, FINAL_NONCE, SIGNATURE, leader.address, PERFORMANCE_FEE]]
      );

      const poolKey = {
        currency0: await feeToken.getAddress(),
        currency1: ethers.ZeroAddress,
        fee: 3000,
        tickSpacing: 60,
        hooks: await settlementHook.getAddress()
      };

      const swapParams = {
        zeroForOne: true,
        amountSpecified: ethers.parseUnits("1000", 18),
        sqrtPriceLimitX96: 0
      };

      // First settlement should succeed
      await settlementHook.connect(poolManager).afterSwap(
        copier.address,
        poolKey,
        swapParams,
        0,
        settlementData
      );

      // Second settlement should fail
      await expect(
        settlementHook.connect(poolManager).afterSwap(
          copier.address,
          poolKey,
          swapParams,
          0,
          settlementData
        )
      ).to.be.revertedWithCustomError(settlementHook, "InvalidSession");
    });

    it("Should only allow poolManager to call afterSwap", async function () {
      const settlementData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(bytes32,uint256,bytes,address,uint256)"],
        [[CHANNEL_ID, FINAL_NONCE, SIGNATURE, leader.address, PERFORMANCE_FEE]]
      );

      const poolKey = {
        currency0: await feeToken.getAddress(),
        currency1: ethers.ZeroAddress,
        fee: 3000,
        tickSpacing: 60,
        hooks: await settlementHook.getAddress()
      };

      const swapParams = {
        zeroForOne: true,
        amountSpecified: ethers.parseUnits("1000", 18),
        sqrtPriceLimitX96: 0
      };

      await expect(
        settlementHook.connect(copier).afterSwap(
          copier.address,
          poolKey,
          swapParams,
          0,
          settlementData
        )
      ).to.be.revertedWithCustomError(settlementHook, "NotPoolManager");
    });
  });
});
