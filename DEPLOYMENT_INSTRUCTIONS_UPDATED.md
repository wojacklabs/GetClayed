# 🚀 Updated Deployment Instructions (Security Fix Applied)

## ⚠️ IMPORTANT: Critical Security Fix

This deployment includes a **critical security fix** to prevent marketplace price manipulation.

### What Changed:
- `ClayMarketplace` constructor now requires **both** `libraryAddress` and `royaltyAddress`
- Marketplace validates listing prices against library royalty totals
- Prevents selling library-based projects below royalty cost

---

## 📋 Prerequisites

1. **Environment Setup**
   ```bash
   cd contracts
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   ```env
   PRIVATE_KEY=your_deployer_private_key_here
   BASE_RPC_URL=https://mainnet.base.org
   BASESCAN_API_KEY=your_basescan_api_key
   ```

3. **Fund Deployer Account**
   - Ensure deployer has enough ETH on Base Mainnet
   - Recommended: 0.05 ETH minimum

---

## 🔧 Deployment Steps

### Step 1: Deploy All Contracts

```bash
cd contracts
npx hardhat run scripts/deploy.js --network base
```

This will deploy in order:
1. ✅ ClayLibrary (with temporary zero royalty address)
2. ✅ ClayRoyalty (with library address)
3. ✅ Update ClayLibrary's royalty address
4. ✅ **ClayMarketplace (with library AND royalty addresses)** 🔒
5. ✅ Approve Marketplace in Library
6. ✅ Verify royalty contract in Marketplace

### Step 2: Save Contract Addresses

The script will output:
```
📋 Contract Addresses:
   ClayLibrary     : 0x...
   ClayRoyalty     : 0x...
   ClayMarketplace : 0x...

🔧 Environment Variables (add to .env):
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x...
```

**Copy these to your frontend `.env` file!**

### Step 3: Verify Contracts on Basescan

The script will provide verification commands:
```bash
npx hardhat verify --network base [LIBRARY_ADDRESS] 0x0000000000000000000000000000000000000000
npx hardhat verify --network base [ROYALTY_ADDRESS] [LIBRARY_ADDRESS]
npx hardhat verify --network base [MARKETPLACE_ADDRESS] [LIBRARY_ADDRESS] [ROYALTY_ADDRESS]
```

**Note**: Marketplace verification now requires **two** constructor arguments!

---

## 🔍 Testing After Deployment

### 1. Verify Security Fix

Test that marketplace rejects low prices:

```javascript
// In Hardhat console or test
const marketplace = await ethers.getContractAt("ClayMarketplace", MARKETPLACE_ADDRESS);
const library = await ethers.getContractAt("ClayLibrary", LIBRARY_ADDRESS);
const royalty = await ethers.getContractAt("ClayRoyalty", ROYALTY_ADDRESS);

// Create a test project with libraries
// Register royalties (e.g., 0.5 ETH total)
// Try to list on marketplace for 0.1 ETH
// Should FAIL with: "Price must be higher than total library royalties"
```

### 2. Verify Frontend Integration

1. Update frontend `.env` with new contract addresses
2. Test library registration
3. Test marketplace listing (should show minimum price)
4. Test buying

---

## 🆘 Troubleshooting

### Error: "Wrong number of constructor arguments"

**Problem**: Using old deployment script for updated contracts

**Solution**: 
- Make sure you're using the updated `deploy.js`
- ClayMarketplace requires 2 arguments: `(libraryAddress, royaltyAddress)`

### Error: "Price must be higher than total library royalties"

**This is expected!** The security fix is working.

**Solution**: 
- Check total royalties: `royalty.calculateTotalRoyalties(projectId)`
- List at a price **higher** than the royalty total

### Marketplace royalty contract is zero address

**Problem**: Marketplace deployed without royalty contract

**Solution**:
```bash
# Set royalty contract manually
npx hardhat console --network base
> const marketplace = await ethers.getContractAt("ClayMarketplace", MARKETPLACE_ADDRESS)
> await marketplace.setRoyaltyContract(ROYALTY_ADDRESS)
```

---

## 📝 Migration from Old Deployment

If you have an **existing ClayMarketplace** without royalty validation:

### Option 1: Redeploy (Recommended)
```bash
# Deploy new marketplace with security fix
npx hardhat run scripts/deployMarketplaceOnly.js --network base

# Update library to approve new marketplace
# ... (see approveMarketplace.js)
```

### Option 2: Manual Fix (If you can't redeploy)
```bash
# If your marketplace has setRoyaltyContract function
npx hardhat console --network base
> const marketplace = await ethers.getContractAt("ClayMarketplace", MARKETPLACE_ADDRESS)
> await marketplace.setRoyaltyContract(ROYALTY_ADDRESS)
```

**Note**: Option 2 only works if your deployed contract has the `setRoyaltyContract` function. If not, you **must** redeploy.

---

## ✅ Post-Deployment Checklist

- [ ] All 3 contracts deployed successfully
- [ ] Contract addresses saved to frontend `.env`
- [ ] Contracts verified on Basescan
- [ ] Marketplace has royalty contract set (verify: `marketplace.royaltyContract()`)
- [ ] Marketplace approved in library (verify: `library.approvedMarketplaces(MARKETPLACE_ADDRESS)`)
- [ ] Library has royalty contract set (verify: `library.royaltyContract()`)
- [ ] Frontend deployed with new addresses
- [ ] Test marketplace listing with low price (should fail)
- [ ] Test marketplace listing with adequate price (should succeed)

---

## 🔐 Security Features Enabled

After deployment, your system has:

1. ✅ **Price validation** - Marketplace rejects listings below royalty cost
2. ✅ **Pull pattern royalties** - Users claim, not automatic push
3. ✅ **ReentrancyGuard** - Protection against reentrancy attacks
4. ✅ **Ownable2Step** - Safe ownership transfer
5. ✅ **Approved marketplace system** - Only approved addresses can transfer
6. ✅ **Dynamic royalty calculation** - Excludes deleted/disabled libraries

---

## 📞 Support

If you encounter issues:

1. Check contract addresses are correct
2. Verify all contracts deployed successfully
3. Check Basescan for transaction errors
4. Review deployment logs for warnings

---

Generated: 2025-11-06
Updated for: Security Fix v1.1


