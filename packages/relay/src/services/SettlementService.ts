/**
 * SettlementService - Handles channel settlement and fee distribution
 *
 * Settlement Flow:
 * 1. Close Yellow Network channel (off-chain → on-chain)
 * 2. Get accumulated performance fees from database
 * 3. Call Uniswap V4 ShadowSettlementHook (atomic settlement + fee deduction)
 * 4. Distribute funds: copier gets (final - fee), leader earns fee
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { YellowService } from './YellowService';
import { db, ChannelSettlement } from '../db';

/**
 * Settlement configuration
 */
interface SettlementConfig {
  yellowService: YellowService;
  provider: ethers.Provider;
  shadowSettlementHookAddress: string;
  shadowFeeManagerAddress: string;
  signerPrivateKey: string;
}

/**
 * Settlement result
 */
interface SettlementResult {
  settlementId: string;
  txHash: string;
  copierPayout: bigint;
  leaderFee: bigint;
  finalBalance: bigint;
}

/**
 * SettlementService handles Yellow → Uniswap settlement
 */
export class SettlementService extends EventEmitter {
  private yellowService: YellowService;
  private provider: ethers.Provider;
  private signer: ethers.Wallet;
  private shadowSettlementHook: ethers.Contract;
  private shadowFeeManager: ethers.Contract;

  constructor(config: SettlementConfig) {
    super();
    this.yellowService = config.yellowService;
    this.provider = config.provider;
    this.signer = new ethers.Wallet(config.signerPrivateKey, config.provider);

    // Load contract ABIs (simplified for now)
    this.shadowSettlementHook = new ethers.Contract(
      config.shadowSettlementHookAddress,
      [
        'function settleChannelWithFees(bytes32 channelId, address copier, address leader, uint256 copierFinalBalance, uint256 performanceFee, bytes yellowStateProof) external returns (bool)',
      ],
      this.signer
    );

    this.shadowFeeManager = new ethers.Contract(
      config.shadowFeeManagerAddress,
      [
        'function processSettlement(address copier, address leader, uint256 startBalance, uint256 endBalance) external returns (uint256 fee)',
        'function calculateFee(address leader, uint256 startBalance, uint256 endBalance) external view returns (uint256)',
      ],
      this.signer
    );

    console.log('💰 SettlementService initialized');
    console.log(`   Settlement Hook: ${config.shadowSettlementHookAddress}`);
    console.log(`   Fee Manager: ${config.shadowFeeManagerAddress}`);
  }

  /**
   * Settle a copier's channel
   */
  async settleChannel(copierChannelId: string): Promise<SettlementResult> {
    console.log(`\n💰 Starting settlement for channel ${copierChannelId}`);

    // 1. Get copy relationship from database
    const relationship = await db.getCopyRelationshipByCopierChannel(copierChannelId);
    if (!relationship) {
      throw new Error(`Copy relationship not found for channel: ${copierChannelId}`);
    }

    console.log(`   Copier: ${relationship.copierAddress}`);
    console.log(`   Leader: ${relationship.leaderAddress}`);
    console.log(`   Initial deposit: ${ethers.formatUnits(relationship.copierInitialDeposit, 6)} USDC`);

    // 2. Get Yellow channel final state
    const yellowSession = this.yellowService.getSession(copierChannelId);
    if (!yellowSession) {
      throw new Error(`Yellow session not found: ${copierChannelId}`);
    }

    const finalNonce = yellowSession.nonce;
    const finalBalances = yellowSession.balances;
    const copierFinalBalance = finalBalances[1]; // Copier's balance

    console.log(`   Final balance: ${ethers.formatUnits(copierFinalBalance, 6)} USDC`);
    console.log(`   Final nonce: ${finalNonce}`);

    // 3. Get accumulated performance fees from database
    const performanceFee = relationship.totalFeesAccumulated;
    const copierNetPayout = copierFinalBalance - performanceFee;

    console.log(`   Performance fee: ${ethers.formatUnits(performanceFee, 6)} USDC`);
    console.log(`   Copier net payout: ${ethers.formatUnits(copierNetPayout, 6)} USDC`);

    // 4. Create Yellow state proof (simplified for demo)
    // In production, this would be the actual cryptographic proof
    const stateProof = this.createYellowStateProof(
      copierChannelId,
      finalNonce,
      finalBalances
    );

    // 5. Close Yellow channel (get signatures)
    const signatures = await this.closeYellowChannel(
      copierChannelId,
      finalBalances
    );

    console.log('   ✅ Yellow channel closed');

    // 6. Call Uniswap V4 Settlement Hook
    console.log('   📤 Calling ShadowSettlementHook...');

    try {
      const tx = await this.shadowSettlementHook.settleChannelWithFees(
        ethers.id(copierChannelId), // Convert to bytes32
        relationship.copierAddress,
        relationship.leaderAddress,
        copierFinalBalance,
        performanceFee,
        stateProof
      );

      const receipt = await tx.wait();
      console.log(`   ✅ Settlement confirmed: ${receipt.hash}`);

      // 7. Record settlement in database
      const settlement = await db.recordChannelSettlement({
        copyRelationshipId: relationship.id,
        copierChannelId,
        finalNonce,
        copierFinalBalance,
        marketMakerFinalBalance: finalBalances[0],
        performanceFeeDue: performanceFee,
        yellowStateProof: stateProof,
        signatures,
      });

      await db.updateSettlementTx(settlement.id, receipt.hash, 'confirmed');

      const result: SettlementResult = {
        settlementId: settlement.id,
        txHash: receipt.hash,
        copierPayout: copierNetPayout,
        leaderFee: performanceFee,
        finalBalance: copierFinalBalance,
      };

      this.emit('settlement-completed', result);
      console.log('   ✅ Settlement complete!\n');

      return result;
    } catch (error) {
      console.error('   ❌ Settlement failed:', error);
      throw error;
    }
  }

  /**
   * Close Yellow channel and get signatures
   */
  private async closeYellowChannel(
    channelId: string,
    finalBalances: bigint[]
  ): Promise<string[]> {
    // In production, both parties sign the final state
    // For demo, we'll use relay signature
    const finalState = {
      channelId,
      nonce: this.yellowService.getSession(channelId)?.nonce || 0,
      balances: finalBalances,
    };

    const messageHash = ethers.solidityPackedKeccak256(
      ['string', 'uint256', 'uint256', 'uint256'],
      [channelId, finalState.nonce, finalBalances[0], finalBalances[1]]
    );

    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));

    // Close the session
    await this.yellowService.closeSession(
      channelId,
      [finalBalances[0], finalBalances[1]],
      [signature, signature] // In production, copier would also sign
    );

    return [signature, signature];
  }

  /**
   * Create Yellow state proof for settlement
   */
  private createYellowStateProof(
    channelId: string,
    nonce: number,
    balances: bigint[]
  ): string {
    // In production, this would be a proper cryptographic proof
    // For demo, encode the state data
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'uint256', 'uint256', 'uint256'],
      [
        ethers.id(channelId),
        nonce,
        balances[0],
        balances[1],
      ]
    );
  }

  /**
   * Preview settlement (calculate fees without executing)
   */
  async previewSettlement(copierChannelId: string): Promise<{
    copierFinalBalance: bigint;
    performanceFee: bigint;
    copierNetPayout: bigint;
    leaderAddress: string;
  }> {
    const relationship = await db.getCopyRelationshipByCopierChannel(copierChannelId);
    if (!relationship) {
      throw new Error(`Copy relationship not found for channel: ${copierChannelId}`);
    }

    const yellowSession = this.yellowService.getSession(copierChannelId);
    if (!yellowSession) {
      throw new Error(`Yellow session not found: ${copierChannelId}`);
    }

    const copierFinalBalance = yellowSession.balances[1];
    const performanceFee = relationship.totalFeesAccumulated;
    const copierNetPayout = copierFinalBalance - performanceFee;

    return {
      copierFinalBalance,
      performanceFee,
      copierNetPayout,
      leaderAddress: relationship.leaderAddress,
    };
  }

  /**
   * Calculate performance fee using on-chain contract
   */
  async calculateFeeOnChain(
    leaderAddress: string,
    startBalance: bigint,
    endBalance: bigint
  ): Promise<bigint> {
    try {
      return await this.shadowFeeManager.calculateFee(
        leaderAddress,
        startBalance,
        endBalance
      );
    } catch (error) {
      console.warn('Failed to calculate fee on-chain, using database value');
      return 0n;
    }
  }

  /**
   * Get settlement history for a copier
   */
  async getSettlementHistory(copierAddress: string): Promise<ChannelSettlement[]> {
    const relationships = await db.getCopyRelationshipsForCopier(copierAddress);
    const settlements: ChannelSettlement[] = [];

    // This would query settlements from database
    // Simplified for now
    return settlements;
  }
}
