# 빠른 배포 가이드

## 현재 상황
- 기존 ClayLibrary: `0xA742D5B85DE818F4584134717AC18930B6cAFE1e`
- 배포 지갑: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`

## 필요한 것
1. `.env` 파일에 `DEPLOYER_PRIVATE_KEY` 설정
2. 배포 지갑에 가스비 (약 0.02 ETH)

## 1단계: .env 파일 확인

```bash
# .env 파일 편집
nano .env

# 다음 내용이 있는지 확인:
DEPLOYER_PRIVATE_KEY=여기에_기존_배포_지갑의_프라이빗_키
LIBRARY_CONTRACT_ADDRESS=0xA742D5B85DE818F4584134717AC18930B6cAFE1e
```

## 2단계: 배포 실행

```bash
# ClayRoyalty 배포
cd contracts
npx hardhat run scripts/deployRoyaltyOnly.js --network base

# 출력에서 새 주소 확인 → ROYALTY_ADDRESS

# ClayMarketplace 배포  
ROYALTY_CONTRACT_ADDRESS=<위에서_받은_주소> \
npx hardhat run scripts/deployMarketplaceOnly.js --network base

# 출력에서 새 주소 확인 → MARKETPLACE_ADDRESS

# Marketplace 승인
MARKETPLACE_CONTRACT_ADDRESS=<위에서_받은_주소> \
npx hardhat run scripts/setApprovedMarketplace.js --network base
```

## 3단계: .env 업데이트

```bash
cd ..
echo "NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=<새_로열티_주소>" >> .env
echo "NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=<새_마켓플레이스_주소>" >> .env
```

## 4단계: Git 배포

```bash
git add .
git commit -m "Deploy critical fixes"
git push origin main
```

Vercel이 자동으로 배포하고, 환경변수도 수동으로 업데이트하세요.

---

## 문제 해결

### "DEPLOYER_PRIVATE_KEY not found"
→ .env 파일에 `DEPLOYER_PRIVATE_KEY=...` 추가

### "insufficient funds"
→ 배포 지갑 (0x356c5AB...) 에 ETH 추가

### "factory runner does not support sending transactions"
→ DEPLOYER_PRIVATE_KEY가 제대로 로드되지 않음. .env 파일 확인

