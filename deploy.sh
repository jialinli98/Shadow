#!/bin/bash

# Shadow Platform Deployment Script
# Interactive guide to deploy your platform

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║   Shadow Platform Deployment Wizard       ║"
echo "║   Privacy-Preserving Copy Trading         ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Step 1: Check MetaMask private key
echo -e "${YELLOW}Step 1: Configure your MetaMask private key${NC}"
echo ""
echo "To deploy contracts, I need your MetaMask private key."
echo ""
echo -e "${GREEN}How to get it:${NC}"
echo "1. Open MetaMask"
echo "2. Click the 3 dots (⋮) next to your account"
echo "3. Select 'Account Details'"
echo "4. Click 'Show Private Key'"
echo "5. Enter your password"
echo "6. Copy the private key"
echo ""
echo -e "${RED}⚠️  NEVER share this key or commit it to git!${NC}"
echo ""
read -p "Press Enter when you have your private key ready..."

# Open the .env file for editing
echo ""
echo "Opening packages/contracts/.env for you to paste your private key..."
echo "Replace 'your_private_key_here' with your actual key (without 0x prefix)"
echo ""
read -p "Press Enter to open the file..."

# Use the default editor or nano
if [[ "$OSTYPE" == "darwin"* ]]; then
    open -e packages/contracts/.env
else
    ${EDITOR:-nano} packages/contracts/.env
fi

echo ""
read -p "Have you added your private key? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please add your private key and run this script again${NC}"
    exit 1
fi

# Step 2: Check Sepolia ETH balance
echo ""
echo -e "${YELLOW}Step 2: Check your Sepolia ETH balance${NC}"
echo ""
echo "You need Sepolia ETH to deploy contracts (about 0.1 ETH)"
echo ""
echo -e "${GREEN}Get free Sepolia ETH from:${NC}"
echo "🔗 https://sepoliafaucet.com/"
echo "🔗 https://www.alchemy.com/faucets/ethereum-sepolia"
echo ""
read -p "Do you have Sepolia ETH? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please get some Sepolia ETH and run this script again"
    echo "Opening faucet in your browser..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open https://sepoliafaucet.com/
    fi
    exit 0
fi

# Step 3: Compile contracts
echo ""
echo -e "${YELLOW}Step 3: Compiling smart contracts${NC}"
echo ""
cd packages/contracts
npm install --silent
echo "Running: npm run compile"
npm run compile

# Step 4: Deploy contracts
echo ""
echo -e "${YELLOW}Step 4: Deploying contracts to Sepolia${NC}"
echo ""
echo "This will deploy:"
echo "  ✓ ShadowRegistry"
echo "  ✓ ShadowFeeManager"
echo "  ✓ MockYellowAdjudicator (for testing)"
echo "  ✓ MockERC20 (test USDC)"
echo ""
read -p "Deploy to Sepolia? This will cost gas. (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "🚀 Deploying contracts..."
npx hardhat run scripts/deploy.js --network sepolia

# Deploy settlement hook
echo ""
echo "🚀 Deploying Uniswap V4 settlement hook..."
npx hardhat run scripts/deploy-settlement-hook.js --network sepolia

echo ""
echo -e "${GREEN}✅ Contracts deployed successfully!${NC}"

# Step 5: Update .env files
cd ../..
echo ""
echo -e "${YELLOW}Step 5: Updating environment files${NC}"
echo ""
node scripts/update-env-files.js

# Step 6: Get WalletConnect Project ID
echo ""
echo -e "${YELLOW}Step 6: Get WalletConnect Project ID${NC}"
echo ""
echo "The frontend needs a WalletConnect Project ID (it's free!)"
echo ""
echo -e "${GREEN}How to get it:${NC}"
echo "1. Go to https://cloud.walletconnect.com"
echo "2. Sign up (free)"
echo "3. Create a new project"
echo "4. Copy the Project ID"
echo ""
read -p "Press Enter to open WalletConnect Cloud in your browser..."

if [[ "$OSTYPE" == "darwin"* ]]; then
    open https://cloud.walletconnect.com
fi

echo ""
read -p "Paste your WalletConnect Project ID: " walletconnect_id

# Update frontend .env with WalletConnect ID
if [ ! -z "$walletconnect_id" ]; then
    sed -i.bak "s/VITE_WALLETCONNECT_PROJECT_ID=.*/VITE_WALLETCONNECT_PROJECT_ID=$walletconnect_id/" packages/frontend/.env
    rm packages/frontend/.env.bak 2>/dev/null || true
    echo -e "${GREEN}✅ WalletConnect Project ID saved${NC}"
fi

# Step 7: Install dependencies
echo ""
echo -e "${YELLOW}Step 7: Installing dependencies${NC}"
echo ""

echo "Installing API dependencies..."
cd packages/api
npm install --silent

echo "Installing frontend dependencies..."
cd ../frontend
npm install --silent
cd ../..

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Summary
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════╗"
echo "║          🎉 Deployment Complete!          ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}📋 Deployed Contracts:${NC}"
cat packages/contracts/deployments/sepolia-latest.json | grep -A 10 '"contracts"' | grep -E '(Shadow|Mock)' | sed 's/[",]//g'
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo ""
echo "Open 2 terminals and run:"
echo ""
echo -e "${YELLOW}Terminal 1 - Backend:${NC}"
echo "  cd packages/api && npm start"
echo ""
echo -e "${YELLOW}Terminal 2 - Frontend:${NC}"
echo "  cd packages/frontend && npm run dev"
echo ""
echo "Then open: ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}📖 For detailed instructions:${NC}"
echo "  See START_HERE.md"
echo ""
