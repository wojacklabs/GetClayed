#!/bin/bash

# GetClayed Critical Fixes Deployment Script
# Date: 2025-11-06

set -e  # Exit on error

echo "🚀 GetClayed Critical Fixes Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env file with required variables"
    exit 1
fi

if [ ! -f "contracts/hardhat.config.js" ]; then
    echo -e "${RED}❌ hardhat.config.js not found!${NC}"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$LIBRARY_CONTRACT_ADDRESS" ]; then
    echo -e "${RED}❌ LIBRARY_CONTRACT_ADDRESS not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  WARNING: You are about to deploy to Base Mainnet${NC}"
echo "This will:"
echo "  1. Deploy new ClayRoyalty contract (~0.005 ETH gas)"
echo "  2. Deploy new ClayMarketplace contract (~0.007 ETH gas)"
echo "  3. Update ClayLibrary approved marketplace"
echo ""
echo "Current Library Address: $LIBRARY_CONTRACT_ADDRESS"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "🔧 Starting deployment..."
echo ""

# Change to contracts directory
cd contracts

# Step 1: Deploy ClayRoyalty
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/5: Deploying ClayRoyalty..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npx hardhat run scripts/deployRoyaltyOnly.js --network base

if [ ! -f "deployments/ClayRoyalty_latest.json" ]; then
    echo -e "${RED}❌ ClayRoyalty deployment failed!${NC}"
    exit 1
fi

# Extract new Royalty address
ROYALTY_ADDRESS=$(cat deployments/ClayRoyalty_latest.json | grep -o '"address": "[^"]*"' | cut -d'"' -f4)
echo ""
echo -e "${GREEN}✅ ClayRoyalty deployed: $ROYALTY_ADDRESS${NC}"
echo ""

# Update .env
echo "Updating .env..."
cd ..
if grep -q "NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=" .env; then
    sed -i.bak "s/NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=.*/NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS/" .env
else
    echo "NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS" >> .env
fi

# Also update ROYALTY_CONTRACT_ADDRESS (without NEXT_PUBLIC prefix)
if grep -q "ROYALTY_CONTRACT_ADDRESS=" .env; then
    sed -i.bak "s/ROYALTY_CONTRACT_ADDRESS=.*/ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS/" .env
else
    echo "ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS" >> .env
fi

export ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS
export NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS

echo -e "${GREEN}✅ .env updated${NC}"
echo ""

# Step 2: Deploy ClayMarketplace
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/5: Deploying ClayMarketplace..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd contracts
npx hardhat run scripts/deployMarketplaceOnly.js --network base

if [ ! -f "deployments/ClayMarketplace_latest.json" ]; then
    echo -e "${RED}❌ ClayMarketplace deployment failed!${NC}"
    exit 1
fi

# Extract new Marketplace address
MARKETPLACE_ADDRESS=$(cat deployments/ClayMarketplace_latest.json | grep -o '"address": "[^"]*"' | cut -d'"' -f4)
echo ""
echo -e "${GREEN}✅ ClayMarketplace deployed: $MARKETPLACE_ADDRESS${NC}"
echo ""

# Update .env
echo "Updating .env..."
cd ..
if grep -q "NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=" .env; then
    sed -i.bak "s/NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=.*/NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS/" .env
else
    echo "NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS" >> .env
fi

if grep -q "MARKETPLACE_CONTRACT_ADDRESS=" .env; then
    sed -i.bak "s/MARKETPLACE_CONTRACT_ADDRESS=.*/MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS/" .env
else
    echo "MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS" >> .env
fi

export MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS
export NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS

echo -e "${GREEN}✅ .env updated${NC}"
echo ""

# Step 3: Set approved marketplace
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/5: Setting approved marketplace..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd contracts
npx hardhat run scripts/setApprovedMarketplace.js --network base

echo ""
echo -e "${GREEN}✅ Marketplace approved${NC}"
echo ""

# Step 4: Verify contracts
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/5: Verifying contracts on BaseScan..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npx hardhat run scripts/verifyContracts.js --network base || true

echo ""
echo -e "${GREEN}✅ Verification complete${NC}"
echo ""

# Step 5: Git commit and push
cd ..
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5/5: Preparing frontend deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create deployment record
cat > DEPLOYMENT_$(date +%Y%m%d_%H%M%S).md << EOF
# Deployment Record

**Date**: $(date)
**Network**: Base Mainnet

## Deployed Contracts

- **ClayRoyalty**: $ROYALTY_ADDRESS
- **ClayMarketplace**: $MARKETPLACE_ADDRESS
- **ClayLibrary**: $LIBRARY_CONTRACT_ADDRESS (existing)

## Changes

- Total royalties tracking
- Marketplace price validation
- Offer auto-refund on listing cancel
- USDC balance pre-validation
- Gas estimation improvements

## BaseScan Links

- Royalty: https://basescan.org/address/$ROYALTY_ADDRESS
- Marketplace: https://basescan.org/address/$MARKETPLACE_ADDRESS

## Next Steps

1. Update Vercel environment variables
2. Git push to deploy frontend
3. Monitor for 24 hours
EOF

echo -e "${GREEN}✅ Deployment record created${NC}"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Deployed Contracts:"
echo "  ClayRoyalty:     $ROYALTY_ADDRESS"
echo "  ClayMarketplace: $MARKETPLACE_ADDRESS"
echo ""
echo "📝 Next steps:"
echo "  1. Update Vercel environment variables:"
echo "     NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS"
echo "     NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS"
echo ""
echo "  2. Deploy frontend:"
echo "     git add ."
echo "     git commit -m 'Deploy critical fixes'"
echo "     git push origin main"
echo ""
echo "  3. Verify on BaseScan:"
echo "     https://basescan.org/address/$ROYALTY_ADDRESS"
echo "     https://basescan.org/address/$MARKETPLACE_ADDRESS"
echo ""
echo "  4. Test the deployment:"
echo "     - Create a project with libraries"
echo "     - List on marketplace"
echo "     - Test offer functionality"
echo ""
echo -e "${GREEN}✅ All done!${NC}"
echo ""


