#!/bin/bash

# Shadow Platform Quick Deployment Script
# This script helps automate the deployment process

set -e  # Exit on error

echo "🚀 Shadow Platform Deployment Script"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env files exist
check_env_file() {
    if [ ! -f "$1" ]; then
        echo -e "${RED}❌ Error: $1 not found${NC}"
        echo -e "${YELLOW}Please create it from $1.example and fill in the values${NC}"
        exit 1
    fi
}

# Step 1: Check environment files
echo "Step 1: Checking environment files..."
check_env_file "packages/contracts/.env"
echo -e "${GREEN}✅ Contract .env found${NC}"

# Step 2: Compile contracts
echo ""
echo "Step 2: Compiling contracts..."
cd packages/contracts
npm run compile
echo -e "${GREEN}✅ Contracts compiled${NC}"

# Step 3: Run tests (optional)
read -p "Run contract tests? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm test
    echo -e "${GREEN}✅ Tests passed${NC}"
fi

# Step 4: Deploy contracts
echo ""
echo "Step 4: Deploying contracts to Sepolia..."
read -p "Deploy to Sepolia? This will cost gas. (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx hardhat run scripts/deploy.js --network sepolia
    echo -e "${GREEN}✅ Contracts deployed${NC}"

    # Deploy settlement hook
    echo ""
    echo "Deploying settlement hook..."
    npx hardhat run scripts/deploy-settlement-hook.js --network sepolia
    echo -e "${GREEN}✅ Settlement hook deployed${NC}"

    # Read deployment addresses
    DEPLOYMENT_FILE="deployments/sepolia-latest.json"
    if [ -f "$DEPLOYMENT_FILE" ]; then
        echo ""
        echo "📋 Deployment Addresses:"
        cat $DEPLOYMENT_FILE | grep -A 10 '"contracts"'

        # Extract addresses for easy copying
        REGISTRY_ADDR=$(cat $DEPLOYMENT_FILE | grep "ShadowRegistry" | cut -d'"' -f4)
        FEE_MANAGER_ADDR=$(cat $DEPLOYMENT_FILE | grep "ShadowFeeManager" | cut -d'"' -f4)
        SETTLEMENT_HOOK_ADDR=$(cat $DEPLOYMENT_FILE | grep "ShadowSettlementHook" | cut -d'"' -f4)
        ADJUDICATOR_ADDR=$(cat $DEPLOYMENT_FILE | grep "MockYellowAdjudicator" | cut -d'"' -f4)

        echo ""
        echo -e "${YELLOW}Copy these addresses to your .env files:${NC}"
        echo "REGISTRY_ADDRESS=$REGISTRY_ADDR"
        echo "FEE_MANAGER_ADDRESS=$FEE_MANAGER_ADDR"
        echo "SETTLEMENT_HOOK_ADDRESS=$SETTLEMENT_HOOK_ADDR"
        echo "YELLOW_ADJUDICATOR_ADDRESS=$ADJUDICATOR_ADDR"
    fi
else
    echo "Skipping deployment. Using existing contracts."
fi

cd ../..

# Step 5: Setup API
echo ""
echo "Step 5: Setting up API server..."
cd packages/api

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  API .env not found. Creating from example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit packages/api/.env with deployed contract addresses${NC}"
    read -p "Press enter when ready to continue..."
fi

npm install
echo -e "${GREEN}✅ API dependencies installed${NC}"

cd ../..

# Step 6: Setup Frontend
echo ""
echo "Step 6: Setting up frontend..."
cd packages/frontend

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Frontend .env not found. Creating from example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}Please edit packages/frontend/.env with:${NC}"
    echo "  - Contract addresses"
    echo "  - WalletConnect Project ID (get from cloud.walletconnect.com)"
    read -p "Press enter when ready to continue..."
fi

npm install
echo -e "${GREEN}✅ Frontend dependencies installed${NC}"

cd ../..

# Step 7: Start services
echo ""
echo "Step 7: Ready to start services!"
echo ""
echo "To start the platform:"
echo "  1. Terminal 1: cd packages/api && npm start"
echo "  2. Terminal 2: cd packages/frontend && npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"
echo ""
echo -e "${GREEN}🎉 Deployment setup complete!${NC}"
echo ""
echo "See DEPLOYMENT_GUIDE.md for detailed instructions"
