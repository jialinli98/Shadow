#!/usr/bin/env node

/**
 * Script to automatically update .env files with deployed contract addresses
 */

const fs = require('fs');
const path = require('path');

// Read deployment file
const deploymentFile = path.join(__dirname, '../packages/contracts/deployments/sepolia-latest.json');

if (!fs.existsSync(deploymentFile)) {
  console.error('❌ No deployment found at:', deploymentFile);
  console.error('Run: cd packages/contracts && npx hardhat run scripts/deploy.js --network sepolia');
  process.exit(1);
}

const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
const contracts = deployment.contracts;

console.log('📋 Reading deployed contract addresses...\n');
console.log('ShadowRegistry:', contracts.ShadowRegistry);
console.log('ShadowFeeManager:', contracts.ShadowFeeManager);
console.log('ShadowSettlementHook:', contracts.ShadowSettlementHook || 'Not deployed yet');
console.log('MockYellowAdjudicator:', contracts.MockYellowAdjudicator);
console.log();

// Update API .env
const apiEnvPath = path.join(__dirname, '../packages/api/.env');
const apiEnvExamplePath = path.join(__dirname, '../packages/api/.env.example');

if (!fs.existsSync(apiEnvPath)) {
  console.log('📝 Creating packages/api/.env from example...');
  fs.copyFileSync(apiEnvExamplePath, apiEnvPath);
}

let apiEnv = fs.readFileSync(apiEnvPath, 'utf8');

// Replace addresses in API .env
apiEnv = apiEnv.replace(/REGISTRY_ADDRESS=.*/g, `REGISTRY_ADDRESS=${contracts.ShadowRegistry}`);
apiEnv = apiEnv.replace(/FEE_MANAGER_ADDRESS=.*/g, `FEE_MANAGER_ADDRESS=${contracts.ShadowFeeManager}`);
apiEnv = apiEnv.replace(/YELLOW_ADJUDICATOR_ADDRESS=.*/g, `YELLOW_ADJUDICATOR_ADDRESS=${contracts.MockYellowAdjudicator}`);

if (contracts.ShadowSettlementHook) {
  apiEnv = apiEnv.replace(/SETTLEMENT_HOOK_ADDRESS=.*/g, `SETTLEMENT_HOOK_ADDRESS=${contracts.ShadowSettlementHook}`);
}

fs.writeFileSync(apiEnvPath, apiEnv);
console.log('✅ Updated packages/api/.env');

// Update Frontend .env
const frontendEnvPath = path.join(__dirname, '../packages/frontend/.env');
const frontendEnvExamplePath = path.join(__dirname, '../packages/frontend/.env.example');

if (!fs.existsSync(frontendEnvPath)) {
  console.log('📝 Creating packages/frontend/.env from example...');
  fs.copyFileSync(frontendEnvExamplePath, frontendEnvPath);
}

let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');

// Replace addresses in frontend .env
frontendEnv = frontendEnv.replace(/VITE_REGISTRY_ADDRESS=.*/g, `VITE_REGISTRY_ADDRESS=${contracts.ShadowRegistry}`);
frontendEnv = frontendEnv.replace(/VITE_FEE_MANAGER_ADDRESS=.*/g, `VITE_FEE_MANAGER_ADDRESS=${contracts.ShadowFeeManager}`);

if (contracts.ShadowSettlementHook) {
  frontendEnv = frontendEnv.replace(/VITE_SETTLEMENT_HOOK_ADDRESS=.*/g, `VITE_SETTLEMENT_HOOK_ADDRESS=${contracts.ShadowSettlementHook}`);
}

fs.writeFileSync(frontendEnvPath, frontendEnv);
console.log('✅ Updated packages/frontend/.env');

console.log('\n🎉 Environment files updated!\n');
console.log('⚠️  Still need to configure manually:');
console.log('  - packages/contracts/.env (PRIVATE_KEY, SEPOLIA_RPC)');
console.log('  - packages/api/.env (RPC_URL, YELLOW_BROKER_URL, CORS_ORIGIN)');
console.log('  - packages/frontend/.env (VITE_WALLETCONNECT_PROJECT_ID)');
console.log();
