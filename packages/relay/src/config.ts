/**
 * Configuration for Shadow Relay Service
 * Loads environment variables and validates configuration
 */

import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { RelayConfig } from './types';

// Load environment variables
dotenv.config();

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): RelayConfig {
  // Validate required environment variables
  const requiredVars = [
    'YELLOW_WS_URL',
    'YELLOW_CHAIN_ID',
    'YELLOW_ADJUDICATOR_ADDRESS',
    'ETHEREUM_RPC_URL',
    'SHADOW_REGISTRY_ADDRESS',
    'SHADOW_FEE_MANAGER_ADDRESS',
    'ENS_REGISTRY_ADDRESS',
    'RELAY_PRIVATE_KEY',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  const config: RelayConfig = {
    port: parseInt(process.env.PORT || '3001', 10),
    yellowNetwork: {
      wsUrl: process.env.YELLOW_WS_URL!,
      chainId: parseInt(process.env.YELLOW_CHAIN_ID!, 10),
      adjudicatorAddress: process.env.YELLOW_ADJUDICATOR_ADDRESS!,
      custodyAddress: process.env.YELLOW_CUSTODY_ADDRESS || ethers.ZeroAddress,
    },
    contracts: {
      registry: process.env.SHADOW_REGISTRY_ADDRESS!,
      feeManager: process.env.SHADOW_FEE_MANAGER_ADDRESS!,
    },
    ensRegistry: process.env.ENS_REGISTRY_ADDRESS!,
    rpcUrl: process.env.ETHEREUM_RPC_URL!,
  };

  // Validate addresses
  if (!ethers.isAddress(config.contracts.registry)) {
    throw new Error('Invalid SHADOW_REGISTRY_ADDRESS');
  }

  if (!ethers.isAddress(config.contracts.feeManager)) {
    throw new Error('Invalid SHADOW_FEE_MANAGER_ADDRESS');
  }

  if (!ethers.isAddress(config.yellowNetwork.adjudicatorAddress)) {
    throw new Error('Invalid YELLOW_ADJUDICATOR_ADDRESS');
  }

  if (!ethers.isAddress(config.ensRegistry)) {
    throw new Error('Invalid ENS_REGISTRY_ADDRESS');
  }

  console.log('✅ Configuration loaded successfully');
  console.log('📋 Config:', {
    port: config.port,
    yellowWsUrl: config.yellowNetwork.wsUrl,
    chainId: config.yellowNetwork.chainId,
    registryAddress: config.contracts.registry,
    feeManagerAddress: config.contracts.feeManager,
  });

  return config;
}

/**
 * Get relay service signer
 */
export function getRelaySigner(provider: ethers.Provider): ethers.Wallet {
  const privateKey = process.env.RELAY_PRIVATE_KEY!;

  if (!privateKey.startsWith('0x')) {
    throw new Error('RELAY_PRIVATE_KEY must start with 0x');
  }

  try {
    const signer = new ethers.Wallet(privateKey, provider);
    console.log('🔑 Relay signer address:', signer.address);
    return signer;
  } catch (error) {
    throw new Error('Invalid RELAY_PRIVATE_KEY');
  }
}

/**
 * Simple config export for API server
 */
export const config = {
  yellow: {
    wsUrl: process.env.YELLOW_WS_URL || 'wss://clearnet.yellow.com/ws',
    chainId: parseInt(process.env.YELLOW_CHAIN_ID || '60001', 10),
    adjudicatorAddress: process.env.YELLOW_ADJUDICATOR_ADDRESS || ethers.ZeroAddress,
    custodyAddress: process.env.YELLOW_CUSTODY_ADDRESS || ethers.ZeroAddress,
  },
  ens: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || '',
    chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
  },
};
