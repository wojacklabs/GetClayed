# Clay Contracts V2 Migration Guide

## 현재 사용 중인 V2 컨트랙트 주소

```bash
# ClayLibrary Contract (V2)
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xe90BB6281B7Af6211519e5721A5b4985Ea693a49

# ClayRoyalty Contract (V2)
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x8a1EDFFD51E20E80cdBC4649f3c5790dd1E83D4a

# ClayMarketplace Contract (V2)
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x7f993C490aA7934A537950dB8b5f22F8B5843884
```

## Overview
This guide covers the migration from V1 to V2 contracts, which introduces hierarchical royalty distribution.

## Key Changes

### 1. ClayRoyalty.sol
- Added `isDirect` field to `LibraryDependency` struct
- New `projectDirectDependencies` mapping
- Updated `registerProjectRoyalties` to accept direct dependencies
- Modified `calculateTotalRoyalties` to only sum direct dependencies
- Updated `recordRoyalties` to auto-distribute to all dependencies
- Deprecated `distributeNestedRoyalties` function
- Removed `pendingDistributionsETH/USDC` mappings

### 2. ClayLibrary.sol  
- Added `libraryDependencies` mapping
- Updated `registerAsset` to accept dependency array
- Added minimum price validation based on dependencies
- New `getLibraryDependencies` function

### 3. ClayMarketplace.sol
- No changes required (already compatible)

## Deployment Steps

### 1. Compile Contracts
```bash
cd contracts
npx hardhat compile
```

### 2. Deploy New Contracts
```bash
npx hardhat run scripts/deployV2.js --network base
```

### 3. Update Environment Variables
Copy the new contract addresses from deployment output:
```env
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=<new_library_address>
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=<new_royalty_address>  
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=<new_marketplace_address>
```

### 4. Extract ABIs
```bash
npx hardhat run scripts/extractABIs.js
```

### 5. Update Frontend ABIs
The ABIs in `lib/abis/` should be automatically updated. Verify that:
- `lib/libraryService.ts` uses the new ABI with `getLibraryDependencies`
- `lib/royaltyService.ts` uses the new ABI with updated `registerProjectRoyalties`

### 6. Verify Contracts
```bash
npx hardhat run scripts/verifyContracts.js --network base
```

## Frontend Updates Required

### 1. Update ABI Imports
If using hardcoded ABIs, update them in:
- `lib/libraryService.ts`
- `lib/royaltyService.ts`
- `lib/royaltyClaimService.ts`

### 2. Update Function Calls
- `registerAsset` now requires dependency array parameter
- `registerProjectRoyalties` now requires direct dependencies array

## Testing Checklist

1. **Library Registration**
   - [ ] Can register library without dependencies
   - [ ] Can register library with dependencies
   - [ ] Minimum price validation works
   
2. **Royalty Registration**  
   - [ ] Direct dependencies marked correctly
   - [ ] Indirect dependencies included but not charged
   
3. **Royalty Distribution**
   - [ ] Direct dependencies receive payment
   - [ ] Auto-distribution to nested dependencies works
   - [ ] Library owner receives correct profit
   
4. **Edge Cases**
   - [ ] Deleted dependencies handled correctly
   - [ ] Price changes don't affect existing projects
   - [ ] No circular dependency issues

## Rollback Plan

If issues arise:
1. Keep old contract addresses in `.env.backup`
2. Frontend can switch back by updating env variables
3. No on-chain data migration needed

## Notes

- Existing projects will continue to work with old contracts
- New projects will use hierarchical distribution
- No migration of existing royalty data required
