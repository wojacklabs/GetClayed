# 🚀 GetClayed 새 배포 정보 (2025-10-20)

## ✅ 배포 완료!

배포 일시: 2025-10-20
네트워크: Base Mainnet (Chain ID: 8453)

---

## 📋 배포된 스마트 컨트랙트

### ClayLibrary (v3.0 - 2025-11-11)
- **주소**: `0xC27812Eee59FFC15A947efBd55Fc7131eb05DA20`
- **Explorer**: https://basescan.org/address/0xC27812Eee59FFC15A947efBd55Fc7131eb05DA20
- **기능**:
  - Library 에셋 등록 (사용 라이센스 판매)
  - ETH/USDC로 구매
  - 소유권 관리 (currentOwner vs originalCreator)
  - Marketplace 승인 시스템
  - 플랫폼 수수료 징수 (2.5%)
  - 가격 덤핑 방지 (로열티 검증)

### ClayRoyalty
- **주소**: `0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784`
- **Explorer**: https://basescan.org/address/0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784
- **기능**:
  - Pull Pattern 로열티 시스템
  - 의존성 추적 및 로열티 기록
  - 실시간 소유권 기반 분배
  - Claim 기능 (ETH/USDC)
  - DoS 공격 방어
  - 고정 로열티 (등록 시점 원가 기준 10%)

### ClayMarketplace
- **주소**: `0x1509b7F1F6FE754C16E9d0875ed324fad0d43779`
- **Explorer**: https://basescan.org/address/0x1509b7F1F6FE754C16E9d0875ed324fad0d43779
- **기능**:
  - 소유권 거래 (1:1)
  - 고정가 리스팅
  - 오퍼 시스템
  - 가격 업데이트 기능
  - 자동 소유권 이전
  - 승인 시스템 (Library 연동)

---

## 💼 배포 지갑

- **주소**: `0x356c5AB9D3D71C59a17f42aDfA4B7342EDCFaD00`
- **권한**: 
  - 컨트랙트 Owner (Ownable2Step)
  - 플랫폼 수수료 출금 가능
  - Owner 권한 양도 가능 (안전)
- **보안**: 
  - ✅ Private Key는 `.env` 파일로 관리
  - ✅ 절대 코드에 하드코딩 안 함
  - ✅ `.gitignore` 처리됨

---

## 🆕 주요 업그레이드

### 1. Pull Pattern (Claim 방식)
- **이전**: Push (자동 전송, DoS 취약)
- **현재**: Pull (Claim, 안전)
- **효과**: 
  - DoS 공격 완벽 차단
  - 가스비 최적화
  - 확장성 무한

### 2. 실시간 소유권 기반 로열티
- **이전**: 로열티가 원작자에게 고정
- **현재**: 현재 소유자에게 동적 분배
- **효과**: 
  - Marketplace 소유권 거래 의미 있음
  - 로열티 수익권도 함께 이전

### 3. 고정 로열티 (원가 기준)
- **이전**: 판매가의 10% (버그)
- **현재**: 의존성 원가의 10% (고정)
- **효과**: 
  - 경제 논리 정상
  - 예측 가능한 로열티

### 4. Marketplace 승인 시스템
- **이전**: 작동 안 함 (버그)
- **현재**: 승인 시스템으로 정상 작동
- **효과**: 
  - 소유권 거래 가능
  - 안전한 권한 관리

### 5. Ownable2Step
- **이전**: Owner 권한 이전 불가
- **현재**: 2단계 양도 (안전)
- **효과**: 
  - 실수 방지
  - 권한 분실 복구 가능

### 6. 가격 덤핑 방지
- **이전**: 가격 변경 시 검증 없음
- **현재**: 로열티 최소가 강제
- **효과**: 
  - 덤핑 차단
  - 경제 보호

---

## 🔧 사용 방법

### Library 에셋 등록
```solidity
// 의존성 없는 경우
registerAsset(projectId, name, description, priceETH, priceUSDC)

// 의존성 있는 경우 (먼저 로열티 등록)
royaltyContract.registerProjectRoyalties(
    projectId,
    ["dep1", "dep2"],           // 의존성 프로젝트 IDs
    [10_000000, 8_000000],      // 의존성 ETH 원가
    [10_000000, 8_000000],      // 의존성 USDC 원가
    [1000, 1000]                // 각 10%
)

// 그 다음 Library 등록
registerAsset(projectId, name, description, priceETH, priceUSDC)
```

### Library 구매 (라이센스)
```solidity
// ETH로 구매
purchaseAssetWithETH(projectId) payable
// → currentOwner에게 수익
// → 로열티 pending에 누적
// → 구매자는 사용 권한만

// USDC로 구매
purchaseAssetWithUSDC(projectId)
// → USDC approve 먼저 필요
```

### 로열티 Claim
```solidity
// ETH 로열티 인출
claimRoyaltiesETH()

// USDC 로열티 인출
claimRoyaltiesUSDC()

// Pending 확인
getPendingRoyalties(address)
```

### Marketplace 거래
```solidity
// 리스팅
listAsset(projectId, price, paymentToken)

// 구매 (소유권 이전)
buyAsset(projectId)

// 가격 변경 (신규!)
updateListingPrice(projectId, newPrice)
```

---

## 🎨 프론트엔드 업데이트

### 새로 추가된 UI
1. **로열티 대시보드** (프로필 페이지)
   - Pending royalties 표시
   - Claim ETH/USDC 버튼
   - 상세 내역 팝업

2. **알림 시스템** (헤더)
   - 벨 아이콘 + 배지
   - 드롭다운 알림
   - View All 모달

3. **로열티 트리** (프로젝트 상세)
   - 의존성 표시
   - 접었다 펼치기

4. **소유권 배지** (프로젝트 카드)
   - "Created" 표시

---

## ⚠️ 남은 작업

### Marketplace 승인 완료 필요

**옵션 1: 조금 더 입금 후 스크립트 실행**
```bash
# 0.001 ETH 입금 후:
cd /Users/USER/web3/getclayed/contracts
npx hardhat run scripts/approveMarketplace.js --network base
```

**옵션 2: 프론트엔드에서 Owner로 승인**
```typescript
// Owner 지갑 연결 후
const library = new ethers.Contract(LIBRARY_ADDRESS, ABI, signer);
await library.setApprovedMarketplace(MARKETPLACE_ADDRESS, true);
```

**옵션 3: 일단 Library만 사용**
- Library 기능은 100% 작동
- Marketplace는 승인 후 사용 가능

---

## 🔗 유용한 링크

### BaseScan
- ClayLibrary: https://basescan.org/address/0xA742D5B85DE818F4584134717AC18930B6cAFE1e
- ClayRoyalty: https://basescan.org/address/0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784
- ClayMarketplace: https://basescan.org/address/0x1509b7F1F6FE754C16E9d0875ed324fad0d43779

### Verification Commands
```bash
npx hardhat verify --network base 0xA742D5B85DE818F4584134717AC18930B6cAFE1e 0x0000000000000000000000000000000000000000

npx hardhat verify --network base 0x4bbCE17F043EAEA81a221B8E64D7608f5F1d7784 0xA742D5B85DE818F4584134717AC18930B6cAFE1e

npx hardhat verify --network base 0x1509b7F1F6FE754C16E9d0875ed324fad0d43779 0xA742D5B85DE818F4584134717AC18930B6cAFE1e
```

---

## 🎯 다음 단계

1. ✅ 컨트랙트 배포 완료
2. ✅ 환경변수 업데이트 완료
3. ⏳ Marketplace 승인 (조금 더 ETH 입금 필요)
4. 📝 프론트엔드 테스트
5. 🚀 프로덕션 배포

**거의 완성! Marketplace 승인만 하면 끝!** 🎉

