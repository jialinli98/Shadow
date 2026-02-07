/**
 * ENSService - Deep integration with Ethereum Name Service
 * Handles leader profiles, text records, avatars, and reverse resolution
 */

import { ethers } from 'ethers';
import { ENSProfile, ENSTextRecordKey } from '../types';

/**
 * ENS Service Configuration
 */
interface ENSServiceConfig {
  provider: ethers.Provider;
  ensRegistryAddress: string; // ENS registry contract address
}

/**
 * ENSService provides comprehensive ENS functionality
 */
export class ENSService {
  private provider: ethers.Provider;
  private ensRegistryAddress: string;

  constructor(config: ENSServiceConfig) {
    this.provider = config.provider;
    this.ensRegistryAddress = config.ensRegistryAddress;
  }

  /**
   * Resolve ENS name to Ethereum address
   */
  async resolveNameToAddress(ensName: string): Promise<string | null> {
    try {
      return await this.provider.resolveName(ensName);
    } catch {
      return null;
    }
  }

  async resolveENSName(ensName: string): Promise<string | null> {
    return this.resolveNameToAddress(ensName);
  }

  /**
   * Reverse resolve Ethereum address to ENS name
   */
  async resolveAddressToName(address: string): Promise<string | null> {
    try {
      return await this.provider.lookupAddress(address);
    } catch {
      return null;
    }
  }

  /**
   * Get ENS avatar for an address or name
   */
  async getAvatar(ensNameOrAddress: string): Promise<string | null> {
    try {
      const isAddress = ethers.isAddress(ensNameOrAddress);
      const ensName = isAddress ? await this.resolveAddressToName(ensNameOrAddress) : ensNameOrAddress;
      if (!ensName) return null;

      const provider = this.provider as ethers.JsonRpcProvider;
      const avatar = await provider.getAvatar(ensName);
      return avatar || null;
    } catch {
      return null;
    }
  }

  /**
   * Get ENS text record
   */
  async getTextRecord(ensName: string, key: ENSTextRecordKey | string): Promise<string | null> {
    try {
      const provider = this.provider as ethers.JsonRpcProvider;
      const resolver = await provider.getResolver(ensName);
      if (!resolver) return null;

      const value = await resolver.getText(key);
      return value || null;
    } catch {
      return null;
    }
  }

  /**
   * Get complete ENS profile for a leader
   */
  async getLeaderProfile(ensNameOrAddress: string): Promise<ENSProfile | null> {
    try {
      // Resolve to ENS name if address provided
      const isAddress = ethers.isAddress(ensNameOrAddress);
      let ensName: string | null;
      let address: string;

      if (isAddress) {
        address = ensNameOrAddress;
        ensName = await this.resolveAddressToName(address);
        if (!ensName) return null;
      } else {
        ensName = ensNameOrAddress;
        const resolvedAddress = await this.resolveNameToAddress(ensName);
        if (!resolvedAddress) return null;
        address = resolvedAddress;
      }

      // Get all text records in parallel
      const [avatar, bio, strategy, twitter, discord, performanceJson] = await Promise.all([
        this.getAvatar(ensName),
        this.getTextRecord(ensName, ENSTextRecordKey.BIO),
        this.getTextRecord(ensName, ENSTextRecordKey.STRATEGY),
        this.getTextRecord(ensName, ENSTextRecordKey.TWITTER),
        this.getTextRecord(ensName, ENSTextRecordKey.DISCORD),
        this.getTextRecord(ensName, ENSTextRecordKey.PERFORMANCE),
      ]);

      // Parse performance JSON if available
      let performance;
      if (performanceJson) {
        try {
          performance = JSON.parse(performanceJson);
        } catch {}
      }

      return {
        ensName,
        address,
        avatar: avatar || undefined,
        bio: bio || undefined,
        strategy: strategy || undefined,
        twitter: twitter || undefined,
        discord: discord || undefined,
        performance,
      };
    } catch {
      return null;
    }
  }

  async setTextRecord(
    ensName: string,
    key: ENSTextRecordKey | string,
    value: string,
    signer: ethers.Signer
  ): Promise<boolean> {
    try {
      const provider = this.provider as ethers.JsonRpcProvider;
      const resolver = await provider.getResolver(ensName);
      if (!resolver) throw new Error(`No resolver found for ${ensName}`);

      const resolverWithSigner = (resolver as any).connect(signer);
      const tx = await resolverWithSigner.setText(key, value);
      await tx.wait();

      return true;
    } catch {
      return false;
    }
  }

  async updateLeaderPerformance(
    ensName: string,
    performance: { roi60d: number; sharpeRatio: number; maxDrawdown: number },
    signer: ethers.Signer
  ): Promise<boolean> {
    try {
      return await this.setTextRecord(ensName, ENSTextRecordKey.PERFORMANCE, JSON.stringify(performance), signer);
    } catch {
      return false;
    }
  }

  async searchLeadersBySubdomain(parentDomain: string): Promise<ENSProfile[]> {
    return [];
  }

  async validateOwnership(ensName: string, expectedOwner: string): Promise<boolean> {
    try {
      const provider = this.provider as ethers.JsonRpcProvider;
      const resolver = await provider.getResolver(ensName);
      if (!resolver) return false;

      const resolvedAddress = await resolver.getAddress();
      return resolvedAddress?.toLowerCase() === expectedOwner.toLowerCase();
    } catch {
      return false;
    }
  }

  async getContentHash(ensName: string): Promise<string | null> {
    try {
      const provider = this.provider as ethers.JsonRpcProvider;
      const resolver = await provider.getResolver(ensName);
      if (!resolver) return null;

      const contentHash = await resolver.getContentHash();
      return contentHash || null;
    } catch {
      return null;
    }
  }

  async batchResolveNames(ensNames: string[]): Promise<Map<string, string | null>> {
    const results = await Promise.all(
      ensNames.map(async (name) => ({ name, address: await this.resolveNameToAddress(name) }))
    );

    const resultMap = new Map<string, string | null>();
    results.forEach(({ name, address }) => resultMap.set(name, address));
    return resultMap;
  }

  async batchGetProfiles(addresses: string[]): Promise<Map<string, ENSProfile | null>> {
    const results = await Promise.all(
      addresses.map(async (address) => ({ address, profile: await this.getLeaderProfile(address) }))
    );

    const resultMap = new Map<string, ENSProfile | null>();
    results.forEach(({ address, profile }) => resultMap.set(address, profile));
    return resultMap;
  }
}
