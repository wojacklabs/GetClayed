# Critical Security Fix Applied

## Date: 2025-11-06

## 🔴 CRITICAL Issue Fixed: Marketplace Price Validation

### Problem
The ClayMarketplace contract did not validate listing prices against library royalties, allowing sellers to:
- List library-based projects at prices lower than the total royalty cost
- Undermine the royalty system for original creators
- Sell projects at 0.0001 ETH even when library royalties total 0.5 ETH

### Impact
- **Severity**: 🔴 CRITICAL
- **Affected**: ClayMarketplace.sol
- **Attack Vector**: Direct contract interaction (bypassing frontend validation)

### Solution Applied

#### 1. Updated ClayMarketplace.sol

**Added IClayRoyalty interface:**
```solidity
interface IClayRoyalty {
    function calculateTotalRoyalties(string memory projectId) 
        external view returns (uint256 totalETH, uint256 totalUSDC);
}
```

**Added royalty contract reference:**
```solidity
contract ClayMarketplace is Ownable, ReentrancyGuard {
    IClayLibrary public libraryContract;
    IClayRoyalty public royaltyContract;  // NEW
    // ...
}
```

**Updated constructor:**
```solidity
constructor(address _libraryContract, address _royaltyContract) Ownable(msg.sender) {
    libraryContract = IClayLibrary(_libraryContract);
    royaltyContract = IClayRoyalty(_royaltyContract);  // NEW
    usdcToken = IERC20(USDC_ADDRESS);
}
```

**Added setRoyaltyContract function:**
```solidity
function setRoyaltyContract(address _royaltyContract) external onlyOwner {
    royaltyContract = IClayRoyalty(_royaltyContract);
}
```

**Enhanced listAsset function:**
```solidity
function listAsset(string memory projectId, uint256 price, PaymentToken paymentToken) external {
    require(price > 0, "Price must be greater than 0");
    require(!listings[projectId].isActive, "Asset already listed");
    
    // Existing ownership check...
    
    // NEW: Validate minimum price based on library royalties
    if (address(royaltyContract) != address(0)) {
        (uint256 minETH, uint256 minUSDC) = royaltyContract.calculateTotalRoyalties(projectId);
        
        if (paymentToken == PaymentToken.ETH) {
            require(price > minETH, "Price must be higher than total library royalties");
        } else {
            require(price > minUSDC, "Price must be higher than total library royalties");
        }
    }
    
    // ... rest of function
}
```

#### 2. Updated deploy-all.js

**Changed deployment:**
```javascript
// Before:
const clayMarketplace = await ClayMarketplace.deploy(clayLibrary.target);

// After:
const clayMarketplace = await ClayMarketplace.deploy(
    clayLibrary.target, 
    ethers.ZeroAddress  // Placeholder, set after royalty deployment
);
```

**Added royalty contract setup:**
```javascript
// 6. Set royalty contract in marketplace (SECURITY FIX)
console.log("\n6. Setting royalty contract in marketplace for price validation...");
const setRoyaltyTx = await clayMarketplace.setRoyaltyContract(clayRoyalty.target);
await setRoyaltyTx.wait();
console.log("Royalty contract set in marketplace");
```

### How It Works

1. **When listing an asset:**
   - Marketplace calls `royaltyContract.calculateTotalRoyalties(projectId)`
   - Gets minimum ETH and USDC royalties from dependencies
   - Only counts active libraries (not deleted/disabled)
   - Requires listing price to be **higher** than royalty total

2. **Example scenario:**
   - Project C uses Library A (0.2 ETH) + Library B (0.3 ETH)
   - calculateTotalRoyalties returns (0.5 ETH, 0 USDC)
   - Seller tries to list at 0.4 ETH → ❌ Rejected
   - Seller lists at 0.6 ETH → ✅ Accepted

3. **Edge cases handled:**
   - No dependencies: minETH = 0, minUSDC = 0 → any price accepted
   - Deleted libraries: excluded from calculation
   - Disabled royalties: excluded from calculation
   - Royalty contract not set: validation skipped (backward compatible)

### Testing Required

Before deployment, verify:

1. **Unit Tests:**
   ```bash
   cd contracts
   npx hardhat test test/ClayMarketplace.test.js
   ```

2. **Manual Testing:**
   - Deploy contracts to testnet
   - Create project with libraries
   - Register royalties
   - Try listing below minimum price → should fail
   - Try listing above minimum price → should succeed

3. **Integration Testing:**
   - Test with frontend
   - Verify error messages
   - Check price validation in UI

### Deployment Checklist

- [x] Code changes applied
- [ ] Unit tests passed
- [ ] Deployed to testnet
- [ ] Testnet verification complete
- [ ] Frontend updated with new contract addresses
- [ ] Deployed to mainnet
- [ ] Mainnet verification complete
- [ ] Documentation updated

### Additional Security Note

This fix works in conjunction with:
1. **ClayRoyalty.calculateTotalRoyalties()** - Excludes deleted/disabled libraries
2. **Frontend validation** - User-friendly price guidance
3. **Project signature system** - Prevents tampering with dependencies

Together, these create a robust defense-in-depth strategy against royalty circumvention.

---

## 🟡 MEDIUM Issue Fixed: USDC Balance Check

### Problem
When paying royalties in USDC, the system didn't check balance before attempting approval, leading to unclear error messages.

### Solution
Added balance check in `lib/royaltyService.ts`:

```typescript
// SECURITY FIX: Check USDC balance before approve
const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

const userAddress = await signer.getAddress();
const usdcBalance = await usdcContract.balanceOf(userAddress);

if (usdcBalance < royaltyUnits) {
    const balanceFormatted = ethers.formatUnits(usdcBalance, 6);
    const requiredFormatted = totalRoyaltyUSDC.toFixed(2);
    throw new Error(
        `Insufficient USDC balance. ` +
        `Required: ${requiredFormatted} USDC, ` +
        `Available: ${balanceFormatted} USDC. ` +
        `Please add USDC to your wallet first.`
    );
}
```

### Impact
- Better error messages for users
- Fails fast before wasting gas on approve transaction
- Clear guidance on how much USDC needed

---

## Remaining Issues for v2

### 🟡 MEDIUM: Marketplace Offer Refund Recovery
**Status**: Deferred to v2
**Reason**: Requires contract redesign, not critical for launch
**Mitigation**: Very rare edge case (contract wallet rejecting refund)

### 🟢 MINOR: Error Message Localization
**Status**: UX improvement
**Reason**: Can be added incrementally
**Mitigation**: Current English messages are functional

---

## Verification

Run the following to verify changes:
```bash
# Check contract changes
git diff contracts/ClayMarketplace.sol

# Check service changes
git diff lib/royaltyService.ts

# Check deployment script
git diff contracts/scripts/deploy-all.js
```

---

Generated: 2025-11-06
Status: ✅ Ready for Testing
Next Step: Deploy to testnet and verify











