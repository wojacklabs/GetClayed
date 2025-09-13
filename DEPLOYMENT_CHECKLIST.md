# Clay V2 Deployment Checklist

## Pre-Deployment

### 1. Code Review
- [ ] All contract changes reviewed
- [ ] Test cases pass
- [ ] No hardcoded addresses
- [ ] Gas optimizations considered

### 2. Environment Setup
- [ ] `.env` file has private key
- [ ] Base network RPC configured
- [ ] Sufficient ETH for deployment (~0.01 ETH)

## Deployment

### 3. Compile Contracts
```bash
cd contracts
npx hardhat compile
```
- [ ] Compilation successful
- [ ] No warnings

### 4. Deploy Contracts
```bash
npx hardhat run scripts/deployV2.js --network base
```
- [ ] Record new contract addresses:
  - Library: _______________________
  - Royalty: _______________________
  - Marketplace: _______________________

### 5. Verify Contract Links
```bash
node scripts/verifyContractLinks.js
```
- [ ] All links verified

### 6. Update Frontend Environment
```bash
# Update .env.local
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=<new_address>
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=<new_address>
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=<new_address>
```
- [ ] Frontend `.env.local` updated
- [ ] Old addresses backed up

### 7. Extract and Update ABIs
```bash
cd contracts
npx hardhat run scripts/extractABIs.js
```
- [ ] ABIs extracted to `lib/abis/`
- [ ] Frontend services use new ABIs

### 8. Verify on Basescan
```bash
npx hardhat verify --network base <library_address> 0x0000000000000000000000000000000000000000
npx hardhat verify --network base <royalty_address> <library_address>
npx hardhat verify --network base <marketplace_address> <library_address> <royalty_address>
```
- [ ] All contracts verified on Basescan

## Post-Deployment Testing

### 9. Frontend Testing
- [ ] Connect wallet works
- [ ] Can create project
- [ ] Can upload to library
- [ ] Can import library with dependencies
- [ ] Royalty distribution modal shows
- [ ] Payment processes correctly
- [ ] Receipt shows distribution

### 10. Contract Testing
- [ ] Register library with dependencies
- [ ] Verify minimum price enforcement
- [ ] Test royalty auto-distribution
- [ ] Verify direct/indirect marking
- [ ] Test deleted dependency handling

### 11. Integration Testing
- [ ] Create library A
- [ ] Create library B using A
- [ ] Create project using B
- [ ] Verify A receives royalties through B
- [ ] Check receipts and dashboard

## Monitoring

### 12. Post-Deployment Monitoring
- [ ] Monitor contract events
- [ ] Check gas usage
- [ ] Verify royalty distributions
- [ ] Monitor for errors

## Rollback Plan

### If Issues Arise:
1. [ ] Restore old contract addresses in `.env.local`
2. [ ] Restart frontend services
3. [ ] Announce maintenance if needed
4. [ ] Debug and fix issues
5. [ ] Re-deploy if necessary

## Communication

### 13. Announcements
- [ ] Notify team of deployment
- [ ] Update documentation
- [ ] Announce new features to users

## Notes
- Keep old contract addresses for reference
- Monitor first few transactions closely
- Be ready to provide support
