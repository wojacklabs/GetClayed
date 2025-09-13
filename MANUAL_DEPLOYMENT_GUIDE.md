# 수동 배포 가이드

배포 스크립트가 작동하지 않거나, 단계별로 수동 배포하고 싶은 경우 이 가이드를 따라주세요.

---

## 사전 준비

### 1. 환경 확인
```bash
# 프로젝트 디렉토리로 이동
cd /Users/USER/web3/getclayed

# Node.js 버전 확인 (v18 이상 권장)
node --version

# Hardhat 설치 확인
cd contracts
npx hardhat --version
```

### 2. .env 파일 확인
```bash
# 필수 환경변수
cat .env | grep -E "(PRIVATE_KEY|LIBRARY_CONTRACT_ADDRESS|BASE_RPC_URL)"
```

필수 변수:
- `PRIVATE_KEY` - 배포자 지갑 프라이빗 키 (0x 접두사 없이)
- `LIBRARY_CONTRACT_ADDRESS` - 기존 ClayLibrary 주소
- `BASE_RPC_URL` - Base 네트워크 RPC URL (기본값: https://mainnet.base.org)

### 3. 가스비 확인
```bash
# 배포자 지갑 잔액 확인 (최소 0.02 ETH 권장)
# Base 네트워크에서 확인
```

---

## Step 1: ClayRoyalty 배포

### 1-1. 배포 스크립트 실행
```bash
cd contracts
npx hardhat run scripts/deployRoyaltyOnly.js --network base
```

### 1-2. 출력 확인
```
✅ ClayRoyalty deployed to: 0x1234...5678
```

### 1-3. 주소 복사 및 저장
```bash
# 출력된 주소를 복사하여 메모장에 저장
ROYALTY_ADDRESS=0x1234...5678
```

### 1-4. .env 업데이트
```bash
cd ..
echo "NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS" >> .env
echo "ROYALTY_CONTRACT_ADDRESS=$ROYALTY_ADDRESS" >> .env
```

또는 직접 편집:
```bash
nano .env
# 다음 줄 추가:
# NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x...
# ROYALTY_CONTRACT_ADDRESS=0x...
```

---

## Step 2: ClayMarketplace 배포

### 2-1. 환경변수 다시 로드
```bash
export $(cat .env | grep -v '^#' | xargs)
```

### 2-2. 배포 스크립트 실행
```bash
cd contracts
npx hardhat run scripts/deployMarketplaceOnly.js --network base
```

### 2-3. 출력 확인
```
✅ ClayMarketplace deployed to: 0xabcd...efgh
```

### 2-4. 주소 저장
```bash
MARKETPLACE_ADDRESS=0xabcd...efgh
```

### 2-5. .env 업데이트
```bash
cd ..
echo "NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS" >> .env
echo "MARKETPLACE_CONTRACT_ADDRESS=$MARKETPLACE_ADDRESS" >> .env
```

---

## Step 3: ClayLibrary Marketplace 승인

### 3-1. 환경변수 다시 로드
```bash
export $(cat .env | grep -v '^#' | xargs)
```

### 3-2. 승인 스크립트 실행
```bash
cd contracts
npx hardhat run scripts/setApprovedMarketplace.js --network base
```

### 3-3. 출력 확인
```
✅ Marketplace approved successfully!
New approval status: true
```

---

## Step 4: BaseScan 검증 (선택사항)

### 4-1. 검증 스크립트 실행
```bash
npx hardhat run scripts/verifyContracts.js --network base
```

또는 수동 검증:
```bash
# ClayRoyalty 검증
npx hardhat verify --network base $ROYALTY_ADDRESS $LIBRARY_CONTRACT_ADDRESS

# ClayMarketplace 검증
npx hardhat verify --network base $MARKETPLACE_ADDRESS $LIBRARY_CONTRACT_ADDRESS $ROYALTY_ADDRESS
```

---

## Step 5: 프론트엔드 배포

### 5-1. Git 커밋
```bash
cd /Users/USER/web3/getclayed

git add .
git commit -m "Deploy critical fixes: royalty tracking, marketplace safety, USDC validation"
```

### 5-2. Git Push
```bash
git push origin main
```

### 5-3. Vercel 환경변수 업데이트

#### Option A: Vercel CLI
```bash
vercel env add NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS
# 프롬프트에 주소 입력: 0x...

vercel env add NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS
# 프롬프트에 주소 입력: 0x...
```

#### Option B: Vercel Dashboard
1. https://vercel.com 접속
2. 프로젝트 선택
3. Settings > Environment Variables
4. 추가:
   - `NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS` = `0x...`
   - `NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS` = `0x...`
5. Redeploy 클릭

---

## Step 6: 배포 검증

### 6-1. 컨트랙트 검증

#### ClayRoyalty 확인
```bash
npx hardhat console --network base
```

```javascript
const royalty = await ethers.getContractAt("ClayRoyalty", "ROYALTY_ADDRESS");

// Library contract 주소 확인
await royalty.libraryContract();
// 출력: LIBRARY_CONTRACT_ADDRESS와 일치해야 함

// Owner 확인
await royalty.owner();
// 출력: 배포자 주소
```

#### ClayMarketplace 확인
```javascript
const marketplace = await ethers.getContractAt("ClayMarketplace", "MARKETPLACE_ADDRESS");

// Library contract 확인
await marketplace.libraryContract();

// Royalty contract 확인
await marketplace.royaltyContract();

// Platform fee 확인
await marketplace.platformFeePercentage();
// 출력: 250 (2.5%)
```

#### ClayLibrary 확인
```javascript
const library = await ethers.getContractAt("ClayLibrary", "LIBRARY_CONTRACT_ADDRESS");

// Marketplace 승인 확인
await library.approvedMarketplaces("MARKETPLACE_ADDRESS");
// 출력: true

// Royalty contract 확인
await library.royaltyContract();
// 출력: ROYALTY_ADDRESS (필요시 업데이트)
```

### 6-2. 프론트엔드 검증

1. 배포된 사이트 접속
2. 개발자 도구 > Console 확인
3. 환경변수 확인:
```javascript
console.log(process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS);
console.log(process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS);
```

---

## Step 7: 기능 테스트

### 7-1. 라이브러리 등록 테스트
1. 프로젝트 생성
2. "Register as Library" 클릭
3. 가격 설정 (예: 0.001 ETH)
4. 트랜잭션 서명
5. 성공 확인

### 7-2. 로열티 지불 테스트
1. 다른 계정으로 로그인
2. 등록된 라이브러리 사용
3. 프로젝트 저장
4. 로열티 자동 지불 확인
5. `totalRoyaltiesPaid` 확인:
```javascript
const paid = await royalty.totalRoyaltiesPaidETH("PROJECT_ID");
console.log(ethers.formatEther(paid));
```

### 7-3. 마켓플레이스 테스트
1. 프로젝트를 마켓플레이스에 등록
2. 가격 검증 확인 (지불한 로열티보다 높아야 함)
3. Offer 생성
4. Listing 취소 → Offer 자동 환불 확인

---

## 문제 해결

### 에러: "LIBRARY_CONTRACT_ADDRESS not set"
```bash
# .env 파일에 추가
echo "LIBRARY_CONTRACT_ADDRESS=0x..." >> .env
export $(cat .env | grep -v '^#' | xargs)
```

### 에러: "insufficient funds for gas"
- 배포자 지갑에 ETH 추가 필요 (최소 0.02 ETH)

### 에러: "nonce too low"
```bash
# Hardhat 캐시 삭제
cd contracts
rm -rf cache artifacts
npx hardhat clean
```

### 에러: "contract verification failed"
- BaseScan API 키 확인
- 잠시 후 재시도 (BaseScan 서버 지연)

### Vercel 배포 실패
```bash
# 로그 확인
vercel logs

# 수동 재배포
vercel --prod
```

---

## 롤백 (문제 발생 시)

### 프론트엔드 롤백
```bash
# Vercel Dashboard에서 이전 배포로 롤백
# 또는
vercel rollback <deployment-url>
```

### 환경변수 복원
```bash
# .env 백업에서 복원
cp .env.bak .env

# Vercel 환경변수도 이전 값으로 복원
```

### 컨트랙트 롤백
❌ 불가능 - 컨트랙트는 immutable
✅ 대안: 이전 컨트랙트 주소로 프론트엔드 환경변수 변경

---

## 배포 완료 체크리스트

- [ ] ClayRoyalty 배포 완료
- [ ] ClayMarketplace 배포 완료
- [ ] ClayLibrary Marketplace 승인 완료
- [ ] BaseScan 검증 완료
- [ ] .env 파일 업데이트 완료
- [ ] Git 커밋 및 푸시 완료
- [ ] Vercel 환경변수 업데이트 완료
- [ ] 프론트엔드 배포 완료
- [ ] 컨트랙트 검증 완료
- [ ] 기능 테스트 완료

---

## 배포 정보 기록

배포 완료 후 다음 정보를 기록하세요:

```
배포 일시: 2025-11-06
네트워크: Base Mainnet

ClayRoyalty: 0x...
ClayMarketplace: 0x...
ClayLibrary: 0x... (기존)

BaseScan:
- https://basescan.org/address/0x... (Royalty)
- https://basescan.org/address/0x... (Marketplace)

배포자: 0x...
트랜잭션:
- Royalty: 0x...
- Marketplace: 0x...
- Approve: 0x...
```

---

문제가 발생하면 `DEPLOYMENT_CHECKLIST_CRITICAL_FIXES.md` 참조하세요.


