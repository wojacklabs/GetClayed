# 배포 체크리스트 - Critical Fixes (2025-11-06)

## 🔴 긴급 배포 필요

### 배포 순서 (중요!)

#### 1단계: ClayRoyalty 컨트랙트 배포
```bash
cd contracts
npx hardhat run scripts/deployRoyaltyOnly.js --network base
```

**변경 사항**:
- ✅ `totalRoyaltiesPaidETH` mapping 추가
- ✅ `totalRoyaltiesPaidUSDC` mapping 추가
- ✅ `recordRoyalties` 함수 수정 (총액 저장)

**새로운 주소 기록**:
```
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=<새_주소>
```

---

#### 2단계: ClayMarketplace 컨트랙트 배포
```bash
npx hardhat run scripts/deployMarketplaceOnly.js --network base
```

**전제 조건**:
- ClayRoyalty 새 주소 필요
- ClayLibrary 주소 (기존)

**변경 사항**:
- ✅ `IClayRoyalty` 인터페이스 업데이트
- ✅ `listAsset` 가격 검증 로직 변경
- ✅ `cancelListing` offer 환불 추가

**새로운 주소 기록**:
```
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=<새_주소>
```

---

#### 3단계: ClayLibrary approvedMarketplace 설정
```bash
# ClayLibrary owner로 실행
npx hardhat run scripts/setApprovedMarketplace.js --network base
```

**스크립트 내용** (`scripts/setApprovedMarketplace.js`):
```javascript
const hre = require("hardhat");

async function main() {
  const LIBRARY_ADDRESS = process.env.LIBRARY_CONTRACT_ADDRESS;
  const NEW_MARKETPLACE_ADDRESS = process.env.MARKETPLACE_CONTRACT_ADDRESS;
  
  const library = await hre.ethers.getContractAt("ClayLibrary", LIBRARY_ADDRESS);
  
  console.log("Setting approved marketplace...");
  const tx = await library.setApprovedMarketplace(NEW_MARKETPLACE_ADDRESS, true);
  await tx.wait();
  
  console.log("✅ Marketplace approved!");
  console.log("Tx:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

---

#### 4단계: 프론트엔드 .env 업데이트
```bash
# Vercel 환경변수 업데이트
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=<1단계_주소>
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=<2단계_주소>
```

---

#### 5단계: 프론트엔드 배포
```bash
git add .
git commit -m "Critical fixes: marketplace safety, royalty tracking, USDC validation"
git push origin main
```

**Vercel 자동 배포 확인**

---

## 📋 배포 후 검증

### ClayRoyalty 검증
```javascript
// Hardhat console
const royalty = await ethers.getContractAt("ClayRoyalty", ROYALTY_ADDRESS);

// 1. 새 프로젝트 등록 및 로열티 지불
const tx1 = await royalty.registerProjectRoyalties("test-proj", ["lib1"]);
await tx1.wait();

const tx2 = await royalty.recordRoyalties("test-proj", 0, 0, { value: ethers.parseEther("0.001") });
await tx2.wait();

// 2. 저장된 총액 확인
const paidETH = await royalty.totalRoyaltiesPaidETH("test-proj");
console.log("Paid ETH:", ethers.formatEther(paidETH)); // 0.001 예상
```

### ClayMarketplace 검증
```javascript
const marketplace = await ethers.getContractAt("ClayMarketplace", MARKETPLACE_ADDRESS);

// 1. 가격 검증 테스트
// 0.001 ETH 로열티 지불한 프로젝트를 0.0005 ETH에 등록 시도
const tx = await marketplace.listAsset("test-proj", ethers.parseEther("0.0005"), 0);
// 예상: "Price must be higher than royalties paid" 에러

// 2. 정상 등록
const tx2 = await marketplace.listAsset("test-proj", ethers.parseEther("0.002"), 0);
await tx2.wait();
console.log("✅ Listed successfully");

// 3. Offer 생성
const tx3 = await buyer.sendTransaction({
  to: marketplace.address,
  data: marketplace.interface.encodeFunctionData("makeOffer", [
    "test-proj",
    ethers.parseEther("0.0015"),
    0, // ETH
    86400 // 24h
  ]),
  value: ethers.parseEther("0.0015")
});
await tx3.wait();

// 4. Listing 취소 → Offer 자동 환불 확인
const balanceBefore = await buyer.getBalance();
const tx4 = await marketplace.cancelListing("test-proj");
await tx4.wait();
const balanceAfter = await buyer.getBalance();

console.log("Refund:", ethers.formatEther(balanceAfter - balanceBefore)); // 0.0015 예상
```

### 프론트엔드 검증

#### 1. USDC 잔액 사전 체크
1. USDC 잔액 0인 지갑으로 로그인
2. USDC 로열티 필요한 라이브러리 사용
3. 프로젝트 저장 시도
4. **예상**: "Insufficient USDC balance" 에러 즉시 표시
5. registerProjectRoyalties 호출 전에 차단 확인

#### 2. 삭제된 프로젝트 구매 차단
1. 프로젝트 A를 마켓플레이스에 등록
2. 다른 브라우저에서 구매 페이지 열기
3. 원래 브라우저에서 프로젝트 A 삭제
4. 구매 브라우저에서 "Buy Now" 클릭
5. **예상**: "This project has been deleted..." 에러

#### 3. 리스팅 취소 시 Offer 환불
1. 프로젝트 A 마켓플레이스 등록 (판매자)
2. Offer 생성 (구매자 1, 2, 3)
3. 판매자가 listing 취소
4. **예상**: 구매자 1, 2, 3 모두 자동 환불

#### 4. 가격 검증 (삭제된 라이브러리)
1. Library A (0.001 ETH), B (0.002 ETH) 사용 프로젝트 생성
2. 총 0.003 ETH 로열티 지불
3. Library A 삭제
4. 프로젝트를 마켓플레이스에 0.0025 ETH로 등록 시도
5. **예상**: "Price must be higher than royalties paid (0.003 ETH)" 에러
6. 0.004 ETH로 등록
7. **예상**: 성공

---

## 🔧 롤백 계획

### 문제 발생 시
1. Vercel에서 이전 배포로 롤백
2. .env에서 이전 컨트랙트 주소로 복원
3. 사용자에게 공지

### 컨트랙트 롤백
- **불가능**: 컨트랙트는 immutable
- 대안: 새로운 버전 배포

---

## 📊 모니터링

### 배포 후 24시간 모니터링
- [ ] 프로젝트 저장 성공률
- [ ] USDC 로열티 지불 실패 건수
- [ ] 마켓플레이스 구매 실패 건수
- [ ] 가스비 변화 추이

### 예상 가스비 변화
- **recordRoyalties**: +40,000 gas (~$0.002 on Base)
- **cancelListing** (offer 3개): +150,000 gas (~$0.007 on Base)

---

## ⚠️ 주의사항

### 1. 기존 프로젝트 마이그레이션
- **문제**: 이전에 저장된 프로젝트는 totalRoyaltiesPaid = 0
- **영향**: 마켓플레이스 등록 가능 (가격 검증 통과)
- **해결**: 
  - Option A: 마이그레이션 스크립트로 기존 데이터 채우기
  - Option B: totalRoyaltiesPaid = 0이면 calculateTotalRoyalties 사용

```solidity
// ClayMarketplace.sol listAsset 수정안
uint256 paidETH = royaltyContract.totalRoyaltiesPaidETH(projectId);

// 마이그레이션: 저장된 값 없으면 현재 계산값 사용
if (paidETH == 0) {
    (paidETH, ) = royaltyContract.calculateTotalRoyalties(projectId);
}
```

### 2. USDC 승인 (Approval)
- 사용자가 USDC approve를 이미 한 경우 allowance 확인
- 부족하면 추가 approve 필요

### 3. 네트워크 혼잡
- Base 네트워크가 혼잡하면 가스비 급등 가능
- 배포 시점: 한국 시간 오전 (미국 심야) 권장

---

## 📞 문제 발생 시 연락처

### Critical 이슈
- Contract 배포 실패
- 기존 기능 중단
→ 즉시 롤백 및 재배포

### High 이슈
- 가스비 예상보다 높음
- 일부 트랜잭션 실패
→ 24시간 모니터링 후 판단

### Low 이슈
- UI 버그
- 에러 메시지 개선 필요
→ 다음 배포에 포함

---

## ✅ 완료 체크리스트

### 배포 전
- [ ] 로컬 테스트 완료
- [ ] Hardhat 테스트 통과
- [ ] 가스 추정 확인
- [ ] 롤백 계획 수립

### 배포 중
- [ ] ClayRoyalty 배포
- [ ] ClayMarketplace 배포
- [ ] approvedMarketplace 설정
- [ ] .env 업데이트
- [ ] 프론트엔드 배포

### 배포 후
- [ ] ClayRoyalty 검증
- [ ] ClayMarketplace 검증
- [ ] 프론트엔드 검증
- [ ] 가스비 모니터링
- [ ] 사용자 피드백 수집

---

## 예상 일정

**총 소요 시간**: ~2시간

- ClayRoyalty 배포: 10분
- ClayMarketplace 배포: 10분
- 설정 및 검증: 30분
- 프론트엔드 배포: 10분
- 검증 및 모니터링: 1시간

**권장 배포 시간**: 
- 평일 오전 10-11시 (한국 시간)
- 트래픽 적은 시간대
- 개발자 대기 가능 시간


