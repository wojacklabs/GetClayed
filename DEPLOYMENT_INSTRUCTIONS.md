# ClayRoyalty 재배포 가이드

## 수정된 버그

**ClayRoyalty.sol**: USDC transferFrom 누락 → 추가 완료 ✅

---

## 배포 방법

### 1. Private Key 설정

`.env` 파일에 추가:
```bash
DEPLOYER_PRIVATE_KEY=your_private_key_here
```

⚠️ **주의**: 
- Mainnet 배포이므로 실제 ETH가 필요합니다
- Private key는 절대 커밋하지 마세요
- 배포 후 삭제하거나 안전하게 보관하세요

### 2. 배포 실행

```bash
cd contracts
npx hardhat run scripts/deployRoyaltyMarketplace.js --network base
```

### 3. 배포 결과 확인

다음과 같이 출력됩니다:
```
🎉 DEPLOYMENT COMPLETE!
📋 Contract Addresses:
   ClayLibrary     : 0xFdF68975e992ca365aF4452f439A726522156Fb2
   ClayRoyalty     : 0x[새로운 주소]
   ClayMarketplace : 0x[새로운 주소]
```

### 4. 환경 변수 업데이트

`.env.local` 파일 수정:
```bash
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x[새로운 Royalty 주소]
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0x[새로운 Marketplace 주소]
```

### 5. Frontend 재빌드 및 배포

```bash
npm run build
# Vercel에 배포
```

---

## 배포 전 체크리스트

- [ ] DEPLOYER_PRIVATE_KEY가 `.env`에 설정됨
- [ ] 배포 계정에 Base ETH가 있음 (가스비용: ~0.001 ETH)
- [ ] ClayRoyalty.sol이 컴파일됨 (`npx hardhat compile`)
- [ ] 현재 LIBRARY_ADDRESS 확인: `0xFdF68975e992ca365aF4452f439A726522156Fb2`

---

## 배포 후 확인

### 새 컨트랙트 테스트:

```bash
# 1. Library 등록 (ETH 또는 USDC royalty 설정)
# 2. 다른 계정에서 library import하여 프로젝트 업로드
# 3. USDC 전송 확인
node scripts/checkUSDCBalance.js <payer-address>

# 예상 결과:
# Royalty Contract USDC Balance: 0.001 USDC ✅
# Payer Balance: 3.852484 USDC (0.001 감소) ✅

# 4. Claim 테스트
# Profile 페이지 → Claim USDC 버튼

# 예상 결과:
# Successfully claimed 0.0010 USDC ✅
```

---

## 기존 Pending Royalties

**기존 컨트랙트 (0x9C47413D...):**
- Pending: 0.001001 USDC
- 하지만 컨트랙트 잔액: 0.0 USDC
- **Claim 불가능**

**새 컨트랙트로 이전:**
- 기존 pending은 포기 (금액이 작음)
- 새로운 royalty부터 정상 작동

---

## 수동 배포 (Private Key 없이)

Private key를 코드에 넣고 싶지 않다면:

1. **Remix IDE 사용**:
   - https://remix.ethereum.org
   - ClayRoyalty.sol 복사
   - Base network 연결
   - Deploy with constructor: `0xFdF68975e992ca365aF4452f439A726522156Fb2`

2. **수동으로 설정**:
   - ClayLibrary의 `setRoyaltyContract()` 호출
   - ClayLibrary의 `setApprovedMarketplace()` 호출

---

## 배포 준비 완료

수정된 컨트랙트가 컴파일되었습니다!

```
✅ Compiled 1 Solidity file successfully
```

Private key를 설정하고 배포 명령어를 실행하세요!

