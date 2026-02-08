#!/bin/bash

echo "🔍 Shadow Platform - Demo Readiness Check"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0
SUCCESS=0

# Function to check if a process is running
check_process() {
    if pgrep -f "$1" > /dev/null; then
        echo -e "${GREEN}✓${NC} $2 is running"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}✗${NC} $2 is NOT running"
        echo -e "   ${YELLOW}→${NC} $3"
        ((ERRORS++))
        return 1
    fi
}

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Port $1 is in use ($2)"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}✗${NC} Port $1 is NOT in use ($2)"
        echo -e "   ${YELLOW}→${NC} $3"
        ((ERRORS++))
        return 1
    fi
}

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((SUCCESS++))
        return 0
    else
        echo -e "${RED}✗${NC} $2 NOT FOUND"
        echo -e "   ${YELLOW}→${NC} Path: $1"
        ((ERRORS++))
        return 1
    fi
}

# Function to check env variable
check_env() {
    if grep -q "^$1=" "$2" 2>/dev/null && [ -n "$(grep "^$1=" "$2" | cut -d'=' -f2)" ]; then
        echo -e "${GREEN}✓${NC} $1 is set"
        ((SUCCESS++))
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $1 is NOT set in $2"
        ((WARNINGS++))
        return 1
    fi
}

echo "📡 1. Checking Servers"
echo "----------------------"
check_port 3000 "Frontend" "Run: cd packages/frontend && npm run dev"
check_port 3001 "API Server" "Run: cd packages/relay && npm run dev:test"
echo ""

echo "📁 2. Checking Files"
echo "--------------------"
check_file "packages/frontend/.env" "Frontend .env file"
check_file "packages/contracts/deployed-addresses.json" "Deployed contracts addresses" || echo -e "   ${YELLOW}→${NC} Run deployment script if needed"
check_file "HACKATHON_DEMO_READY.md" "Demo guide"
check_file "YELLOW_NETWORK_INTEGRATION_SUMMARY.md" "Yellow Network guide"
check_file "ENS_INTEGRATION_SUMMARY.md" "ENS integration guide"
echo ""

echo "⚙️  3. Checking Environment Variables"
echo "--------------------------------------"
ENV_FILE="packages/frontend/.env"
if [ -f "$ENV_FILE" ]; then
    check_env "VITE_REGISTRY_ADDRESS" "$ENV_FILE"
    check_env "VITE_FEE_MANAGER_ADDRESS" "$ENV_FILE"
    check_env "VITE_SETTLEMENT_HOOK_ADDRESS" "$ENV_FILE"
    check_env "VITE_WALLETCONNECT_PROJECT_ID" "$ENV_FILE"
else
    echo -e "${RED}✗${NC} .env file not found at $ENV_FILE"
    ((ERRORS++))
fi
echo ""

echo "📦 4. Checking Contract Deployments"
echo "------------------------------------"
if [ -f "packages/contracts/deployed-addresses.json" ]; then
    REGISTRY=$(grep -o '"ShadowRegistry":"[^"]*' packages/contracts/deployed-addresses.json | cut -d'"' -f4)
    FEE_MANAGER=$(grep -o '"ShadowFeeManager":"[^"]*' packages/contracts/deployed-addresses.json | cut -d'"' -f4)
    SETTLEMENT_HOOK=$(grep -o '"ShadowSettlementHook":"[^"]*' packages/contracts/deployed-addresses.json | cut -d'"' -f4)

    if [ -n "$REGISTRY" ]; then
        echo -e "${GREEN}✓${NC} ShadowRegistry: $REGISTRY"
        ((SUCCESS++))
    else
        echo -e "${RED}✗${NC} ShadowRegistry address not found"
        ((ERRORS++))
    fi

    if [ -n "$FEE_MANAGER" ]; then
        echo -e "${GREEN}✓${NC} ShadowFeeManager: $FEE_MANAGER"
        ((SUCCESS++))
    else
        echo -e "${RED}✗${NC} ShadowFeeManager address not found"
        ((ERRORS++))
    fi

    if [ -n "$SETTLEMENT_HOOK" ]; then
        echo -e "${GREEN}✓${NC} ShadowSettlementHook: $SETTLEMENT_HOOK"
        ((SUCCESS++))
    else
        echo -e "${RED}✗${NC} ShadowSettlementHook address not found"
        ((ERRORS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} deployed-addresses.json not found"
    ((WARNINGS++))
fi
echo ""

echo "🌐 5. Testing API Endpoint"
echo "--------------------------"
if curl -s http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} API health endpoint responding"
    ((SUCCESS++))
else
    echo -e "${RED}✗${NC} API health endpoint not responding"
    echo -e "   ${YELLOW}→${NC} Make sure API server is running at port 3001"
    ((ERRORS++))
fi
echo ""

# Summary
echo "========================================"
echo "📊 Summary"
echo "========================================"
echo -e "${GREEN}Passed:${NC}   $SUCCESS"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Errors:${NC}   $ERRORS"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ System Ready for Demo! 🎉${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open http://localhost:3000/health in your browser for detailed checks"
    echo "2. Navigate to http://localhost:3000/leader for the demo"
    echo "3. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)"
    echo "4. Review HACKATHON_DEMO_READY.md for demo script"
    exit 0
elif [ $ERRORS -le 2 ] && [ $WARNINGS -ge 0 ]; then
    echo -e "${YELLOW}⚠️  System Partially Ready${NC}"
    echo "Some non-critical issues detected. Demo may have limited functionality."
    echo ""
    echo "Please fix the errors above and run this script again."
    exit 1
else
    echo -e "${RED}❌ Critical Issues Detected${NC}"
    echo "Please fix the errors above before proceeding with the demo."
    echo ""
    echo "Common fixes:"
    echo "  - Start frontend: cd packages/frontend && npm run dev"
    echo "  - Start API: cd packages/relay && npm run dev:test"
    echo "  - Set env vars: Copy .env.example to .env and fill in values"
    exit 1
fi
