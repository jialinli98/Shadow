const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ShadowRegistry", function () {
  let ShadowRegistry;
  let registry;
  let owner, leader1, leader2, feeManager, addr1;

  const ENS_NAME_1 = "alice.shadow.eth";
  const ENS_NAME_2 = "bob.shadow.eth";
  const PERFORMANCE_FEE = 1000; // 10%
  const MIN_DEPOSIT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, leader1, leader2, feeManager, addr1] = await ethers.getSigners();

    ShadowRegistry = await ethers.getContractFactory("ShadowRegistry");
    registry = await ShadowRegistry.deploy();
    await registry.waitForDeployment();

    // Set fee manager
    await registry.setFeeManager(feeManager.address);
  });

  describe("Leader Registration", function () {
    it("Should register a leader successfully", async function () {
      await expect(
        registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT)
      )
        .to.emit(registry, "LeaderRegistered")
        .withArgs(leader1.address, ENS_NAME_1, PERFORMANCE_FEE);

      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.leaderAddress).to.equal(leader1.address);
      expect(leaderInfo.ensName).to.equal(ENS_NAME_1);
      expect(leaderInfo.performanceFeeRate).to.equal(PERFORMANCE_FEE);
      expect(leaderInfo.minCopierDeposit).to.equal(MIN_DEPOSIT);
      expect(leaderInfo.isActive).to.be.true;
      expect(leaderInfo.activeCopierCount).to.equal(0);
    });

    it("Should reject registration with fee rate > 30%", async function () {
      const INVALID_FEE = 3001; // 30.01%
      await expect(
        registry.connect(leader1).registerLeader(ENS_NAME_1, INVALID_FEE, MIN_DEPOSIT)
      ).to.be.revertedWith("Fee rate too high");
    });

    it("Should reject duplicate ENS names", async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);

      await expect(
        registry.connect(leader2).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT)
      ).to.be.revertedWith("ENS name already taken");
    });

    it("Should reject empty ENS name", async function () {
      await expect(
        registry.connect(leader1).registerLeader("", PERFORMANCE_FEE, MIN_DEPOSIT)
      ).to.be.revertedWith("ENS name required");
    });

    it("Should reject re-registration of same leader", async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);

      await expect(
        registry.connect(leader1).registerLeader(ENS_NAME_2, PERFORMANCE_FEE, MIN_DEPOSIT)
      ).to.be.revertedWith("Already registered");
    });

    it("Should increment total leaders count", async function () {
      expect(await registry.totalLeaders()).to.equal(0);

      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
      expect(await registry.totalLeaders()).to.equal(1);

      await registry.connect(leader2).registerLeader(ENS_NAME_2, PERFORMANCE_FEE, MIN_DEPOSIT);
      expect(await registry.totalLeaders()).to.equal(2);
    });
  });

  describe("Leader Terms Update", function () {
    beforeEach(async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
    });

    it("Should update leader terms successfully", async function () {
      const NEW_FEE = 2000; // 20%
      const NEW_MIN_DEPOSIT = ethers.parseEther("200");

      await expect(
        registry.connect(leader1).updateLeaderTerms(NEW_FEE, NEW_MIN_DEPOSIT)
      )
        .to.emit(registry, "LeaderTermsUpdated")
        .withArgs(leader1.address, NEW_FEE, NEW_MIN_DEPOSIT);

      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.performanceFeeRate).to.equal(NEW_FEE);
      expect(leaderInfo.minCopierDeposit).to.equal(NEW_MIN_DEPOSIT);
    });

    it("Should reject update with invalid fee rate", async function () {
      const INVALID_FEE = 5000; // 50%
      await expect(
        registry.connect(leader1).updateLeaderTerms(INVALID_FEE, MIN_DEPOSIT)
      ).to.be.revertedWith("Fee rate too high");
    });

    it("Should reject update from non-registered leader", async function () {
      await expect(
        registry.connect(leader2).updateLeaderTerms(PERFORMANCE_FEE, MIN_DEPOSIT)
      ).to.be.revertedWith("Not a registered leader");
    });
  });

  describe("Leader Deactivation", function () {
    beforeEach(async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
    });

    it("Should deactivate leader successfully", async function () {
      await expect(registry.connect(leader1).deactivateLeader())
        .to.emit(registry, "LeaderDeactivated")
        .withArgs(leader1.address);

      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.isActive).to.be.false;
      expect(await registry.totalLeaders()).to.equal(0);
    });

    it("Should reject deactivation with active copiers", async function () {
      // Simulate adding a copier
      await registry.connect(feeManager).incrementCopierCount(leader1.address);

      await expect(
        registry.connect(leader1).deactivateLeader()
      ).to.be.revertedWith("Cannot deactivate with active copiers");
    });

    it("Should free up ENS name after deactivation", async function () {
      await registry.connect(leader1).deactivateLeader();

      // Should be able to register with same ENS name
      await registry.connect(leader2).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
      const leaderInfo = await registry.getLeader(leader2.address);
      expect(leaderInfo.ensName).to.equal(ENS_NAME_1);
    });
  });

  describe("Copier Count Management", function () {
    beforeEach(async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
    });

    it("Should increment copier count", async function () {
      await registry.connect(feeManager).incrementCopierCount(leader1.address);
      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.activeCopierCount).to.equal(1);
    });

    it("Should decrement copier count", async function () {
      await registry.connect(feeManager).incrementCopierCount(leader1.address);
      await registry.connect(feeManager).decrementCopierCount(leader1.address);
      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.activeCopierCount).to.equal(0);
    });

    it("Should reject increment from non-fee-manager", async function () {
      await expect(
        registry.connect(addr1).incrementCopierCount(leader1.address)
      ).to.be.revertedWith("Only fee manager can call");
    });

    it("Should reject decrement when count is zero", async function () {
      await expect(
        registry.connect(feeManager).decrementCopierCount(leader1.address)
      ).to.be.revertedWith("No active copiers");
    });
  });

  describe("Fees Tracking", function () {
    beforeEach(async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
    });

    it("Should add fees earned", async function () {
      const feeAmount = ethers.parseEther("10");
      await registry.connect(feeManager).addFeesEarned(leader1.address, feeAmount);

      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.totalFeesEarned).to.equal(feeAmount);
    });

    it("Should accumulate multiple fees", async function () {
      const fee1 = ethers.parseEther("10");
      const fee2 = ethers.parseEther("5");

      await registry.connect(feeManager).addFeesEarned(leader1.address, fee1);
      await registry.connect(feeManager).addFeesEarned(leader1.address, fee2);

      const leaderInfo = await registry.getLeader(leader1.address);
      expect(leaderInfo.totalFeesEarned).to.equal(fee1 + fee2);
    });
  });

  describe("Utility Functions", function () {
    beforeEach(async function () {
      await registry.connect(leader1).registerLeader(ENS_NAME_1, PERFORMANCE_FEE, MIN_DEPOSIT);
    });

    it("Should check if address is registered", async function () {
      expect(await registry.isRegistered(leader1.address)).to.be.true;
      expect(await registry.isRegistered(leader2.address)).to.be.false;
    });

    it("Should get leader by ENS name", async function () {
      const address = await registry.getLeaderByENS(ENS_NAME_1);
      expect(address).to.equal(leader1.address);
    });

    it("Should return zero address for unknown ENS", async function () {
      const address = await registry.getLeaderByENS("unknown.shadow.eth");
      expect(address).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set fee manager", async function () {
      const newFeeManager = addr1.address;
      await registry.connect(owner).setFeeManager(newFeeManager);
      // No direct getter, but we can verify by trying to use it
    });

    it("Should reject setting fee manager from non-owner", async function () {
      await expect(
        registry.connect(addr1).setFeeManager(addr1.address)
      ).to.be.reverted;
    });

    it("Should reject zero address as fee manager", async function () {
      await expect(
        registry.connect(owner).setFeeManager(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid fee manager address");
    });
  });
});
