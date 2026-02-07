const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShadowFeeManager", function () {
  let ShadowRegistry, ShadowFeeManager, MockERC20, MockYellowAdjudicator;
  let registry, feeManager, feeToken, yellowAdjudicator;
  let owner, leader, copier1, copier2, addr1;

  const ENS_NAME = "alice.shadow.eth";
  const PERFORMANCE_FEE = 2000; // 20%
  const MIN_DEPOSIT = ethers.parseEther("100");
  const CHANNEL_ID = ethers.keccak256(ethers.toUtf8Bytes("test-channel-1"));

  beforeEach(async function () {
    [owner, leader, copier1, copier2, addr1] = await ethers.getSigners();

    // Deploy mock ERC20 token for fees
    MockERC20 = await ethers.getContractFactory("MockERC20");
    feeToken = await MockERC20.deploy("USDC", "USDC", 6);
    await feeToken.waitForDeployment();

    // Deploy mock Yellow Adjudicator
    MockYellowAdjudicator = await ethers.getContractFactory("MockYellowAdjudicator");
    yellowAdjudicator = await MockYellowAdjudicator.deploy();
    await yellowAdjudicator.waitForDeployment();

    // Deploy ShadowRegistry
    ShadowRegistry = await ethers.getContractFactory("ShadowRegistry");
    registry = await ShadowRegistry.deploy();
    await registry.waitForDeployment();

    // Deploy ShadowFeeManager
    ShadowFeeManager = await ethers.getContractFactory("ShadowFeeManager");
    feeManager = await ShadowFeeManager.deploy(
      await registry.getAddress(),
      await yellowAdjudicator.getAddress(),
      await feeToken.getAddress()
    );
    await feeManager.waitForDeployment();

    // Set fee manager in registry
    await registry.setFeeManager(await feeManager.getAddress());

    // Register leader
    await registry.connect(leader).registerLeader(ENS_NAME, PERFORMANCE_FEE, MIN_DEPOSIT);

    // Mint tokens to copiers and feeManager for testing
    await feeToken.mint(copier1.address, ethers.parseEther("10000"));
    await feeToken.mint(copier2.address, ethers.parseEther("10000"));
    await feeToken.mint(await feeManager.getAddress(), ethers.parseEther("10000"));
  });

  describe("Session Registration", function () {
    it("Should register a copier session successfully", async function () {
      const startValue = ethers.parseEther("1000");

      const tx = await feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID);
      const receipt = await tx.wait();

      // Check that event was emitted
      const event = receipt.logs.find(log => {
        try {
          const parsed = feeManager.interface.parseLog(log);
          return parsed && parsed.name === "SessionRegistered";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      // Check that copier count increased
      const leaderInfo = await registry.getLeader(leader.address);
      expect(leaderInfo.activeCopierCount).to.equal(1);
    });

    it("Should reject registration for non-registered leader", async function () {
      const startValue = ethers.parseEther("1000");

      await expect(
        feeManager.registerCopierSession(addr1.address, copier1.address, startValue, CHANNEL_ID)
      ).to.be.revertedWith("Leader not registered");
    });

    it("Should reject registration below minimum deposit", async function () {
      const startValue = ethers.parseEther("50"); // Below MIN_DEPOSIT

      await expect(
        feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID)
      ).to.be.revertedWith("Deposit below minimum");
    });

    it("Should reject registration with zero start value", async function () {
      await expect(
        feeManager.registerCopierSession(leader.address, copier1.address, 0, CHANNEL_ID)
      ).to.be.revertedWith("Invalid start value");
    });

    it("Should reject registration with invalid copier", async function () {
      const startValue = ethers.parseEther("1000");

      await expect(
        feeManager.registerCopierSession(leader.address, ethers.ZeroAddress, startValue, CHANNEL_ID)
      ).to.be.revertedWith("Invalid copier");
    });
  });

  describe("Fee Calculation", function () {
    it("Should calculate fee correctly on profit", async function () {
      const startValue = ethers.parseEther("1000");
      const endValue = ethers.parseEther("1500"); // 50% profit
      const expectedProfit = ethers.parseEther("500");
      const expectedFee = (expectedProfit * BigInt(PERFORMANCE_FEE)) / BigInt(10000); // 20% of 500 = 100

      const calculatedFee = await feeManager.calculateFee(leader.address, startValue, endValue);
      expect(calculatedFee).to.equal(expectedFee);
    });

    it("Should return zero fee on loss", async function () {
      const startValue = ethers.parseEther("1000");
      const endValue = ethers.parseEther("800"); // Loss

      const calculatedFee = await feeManager.calculateFee(leader.address, startValue, endValue);
      expect(calculatedFee).to.equal(0);
    });

    it("Should return zero fee on break-even", async function () {
      const startValue = ethers.parseEther("1000");
      const endValue = ethers.parseEther("1000"); // Break-even

      const calculatedFee = await feeManager.calculateFee(leader.address, startValue, endValue);
      expect(calculatedFee).to.equal(0);
    });

    it("Should calculate fee correctly for different fee rates", async function () {
      // Register new leader with 10% fee
      const lowFeeLeader = copier2;
      await registry.connect(lowFeeLeader).registerLeader("bob.shadow.eth", 1000, MIN_DEPOSIT);

      const startValue = ethers.parseEther("1000");
      const endValue = ethers.parseEther("2000"); // 100% profit
      const expectedProfit = ethers.parseEther("1000");
      const expectedFee = (expectedProfit * BigInt(1000)) / BigInt(10000); // 10% of 1000 = 100

      const calculatedFee = await feeManager.calculateFee(lowFeeLeader.address, startValue, endValue);
      expect(calculatedFee).to.equal(expectedFee);
    });
  });

  describe("Session Settlement", function () {
    beforeEach(async function () {
      const startValue = ethers.parseEther("1000");
      await feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID);
    });

    it("Should settle session with profit successfully", async function () {
      const endValue = ethers.parseEther("1500");
      const expectedFee = ethers.parseEther("100"); // 20% of 500 profit

      const tx = await feeManager.settleCopierSession(leader.address, copier1.address, endValue, CHANNEL_ID);
      const receipt = await tx.wait();

      // Check that event was emitted
      const event = receipt.logs.find(log => {
        try {
          const parsed = feeManager.interface.parseLog(log);
          return parsed && parsed.name === "SessionSettled";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      // Check accumulated fees
      const accumulatedFees = await feeManager.getAccumulatedFees(leader.address);
      expect(accumulatedFees).to.equal(expectedFee);

      // Check copier count decreased
      const leaderInfo = await registry.getLeader(leader.address);
      expect(leaderInfo.activeCopierCount).to.equal(0);
    });

    it("Should settle session with loss (zero fee)", async function () {
      const endValue = ethers.parseEther("800"); // Loss

      const tx = await feeManager.settleCopierSession(leader.address, copier1.address, endValue, CHANNEL_ID);
      const receipt = await tx.wait();

      // Check that event was emitted
      const event = receipt.logs.find(log => {
        try {
          const parsed = feeManager.interface.parseLog(log);
          return parsed && parsed.name === "SessionSettled";
        } catch {
          return false;
        }
      });
      expect(event).to.not.be.undefined;

      const accumulatedFees = await feeManager.getAccumulatedFees(leader.address);
      expect(accumulatedFees).to.equal(0);
    });

    it("Should reject settlement of non-existent session", async function () {
      await expect(
        feeManager.settleCopierSession(leader.address, copier2.address, ethers.parseEther("1000"), CHANNEL_ID)
      ).to.be.revertedWith("Active session not found");
    });

    it("Should reject double settlement", async function () {
      const endValue = ethers.parseEther("1500");
      await feeManager.settleCopierSession(leader.address, copier1.address, endValue, CHANNEL_ID);

      await expect(
        feeManager.settleCopierSession(leader.address, copier1.address, endValue, CHANNEL_ID)
      ).to.be.revertedWith("Active session not found");
    });
  });

  describe("Multiple Sessions", function () {
    it("Should handle multiple copiers for same leader", async function () {
      const startValue1 = ethers.parseEther("1000");
      const startValue2 = ethers.parseEther("2000");
      const channelId2 = ethers.keccak256(ethers.toUtf8Bytes("test-channel-2"));

      await feeManager.registerCopierSession(leader.address, copier1.address, startValue1, CHANNEL_ID);
      await feeManager.registerCopierSession(leader.address, copier2.address, startValue2, channelId2);

      const leaderInfo = await registry.getLeader(leader.address);
      expect(leaderInfo.activeCopierCount).to.equal(2);

      // Settle both sessions
      await feeManager.settleCopierSession(leader.address, copier1.address, ethers.parseEther("1500"), CHANNEL_ID);
      await feeManager.settleCopierSession(leader.address, copier2.address, ethers.parseEther("2400"), channelId2);

      // Check total accumulated fees
      const fee1 = ethers.parseEther("100"); // 20% of 500
      const fee2 = ethers.parseEther("80");  // 20% of 400
      const totalFees = await feeManager.getAccumulatedFees(leader.address);
      expect(totalFees).to.equal(fee1 + fee2);
    });
  });

  describe("Fee Withdrawal", function () {
    beforeEach(async function () {
      const startValue = ethers.parseEther("1000");
      await feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID);
      await feeManager.settleCopierSession(leader.address, copier1.address, ethers.parseEther("1500"), CHANNEL_ID);
    });

    it("Should allow leader to withdraw fees", async function () {
      const expectedFee = ethers.parseEther("100");
      const initialBalance = await feeToken.balanceOf(leader.address);

      await expect(feeManager.connect(leader).withdrawFees())
        .to.emit(feeManager, "FeesWithdrawn")
        .withArgs(leader.address, expectedFee);

      const finalBalance = await feeToken.balanceOf(leader.address);
      expect(finalBalance - initialBalance).to.equal(expectedFee);

      // Check accumulated fees reset to zero
      const accumulatedFees = await feeManager.getAccumulatedFees(leader.address);
      expect(accumulatedFees).to.equal(0);
    });

    it("Should reject withdrawal with no fees", async function () {
      await feeManager.connect(leader).withdrawFees(); // First withdrawal

      await expect(
        feeManager.connect(leader).withdrawFees() // Second attempt
      ).to.be.revertedWith("No fees to withdraw");
    });

    it("Should reject withdrawal from non-leader", async function () {
      await expect(
        feeManager.connect(copier1).withdrawFees()
      ).to.be.revertedWith("No fees to withdraw");
    });
  });

  describe("Query Functions", function () {
    it("Should get leader sessions", async function () {
      const startValue = ethers.parseEther("1000");
      await feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID);

      const sessions = await feeManager.getLeaderSessions(leader.address);
      expect(sessions.length).to.equal(1);
    });

    it("Should get copier sessions", async function () {
      const startValue = ethers.parseEther("1000");
      await feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID);

      const sessions = await feeManager.getCopierSessions(copier1.address);
      expect(sessions.length).to.equal(1);
    });

    it("Should get session details", async function () {
      const startValue = ethers.parseEther("1000");
      await feeManager.registerCopierSession(leader.address, copier1.address, startValue, CHANNEL_ID);

      const sessions = await feeManager.getCopierSessions(copier1.address);
      const sessionId = sessions[0];

      const sessionDetails = await feeManager.getCopierSession(sessionId);
      expect(sessionDetails.copier).to.equal(copier1.address);
      expect(sessionDetails.leader).to.equal(leader.address);
      expect(sessionDetails.startValue).to.equal(startValue);
      expect(sessionDetails.isSettled).to.be.false;
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to update fee token", async function () {
      const newToken = await MockERC20.deploy("USDT", "USDT", 6);
      await newToken.waitForDeployment();

      await feeManager.connect(owner).setFeeToken(await newToken.getAddress());
    });

    it("Should reject fee token update from non-owner", async function () {
      const newToken = await MockERC20.deploy("USDT", "USDT", 6);
      await newToken.waitForDeployment();

      await expect(
        feeManager.connect(addr1).setFeeToken(await newToken.getAddress())
      ).to.be.reverted;
    });

    it("Should reject zero address as fee token", async function () {
      await expect(
        feeManager.connect(owner).setFeeToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid token");
    });
  });
});
