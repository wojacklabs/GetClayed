# 🎉 GetClayed v3.0 - Royalty Only 구조 전환 완료

배포 일시: 2025-10-21
주요 변경: Library = 로열티 정보만, Marketplace = 모든 거래

---

## ✅ 완료된 작업

### 1. 컨트랙트 재구조화 (3개 모두 수정)

#### ClayLibrary v3.0
- **주소**: `0xFdF68975e992ca365aF4452f439A726522156Fb2`
- **변경사항**:
  - ❌ `purchaseAssetWithETH()` 제거
  - ❌ `purchaseAssetWithUSDC()` 제거
  - ❌ `updateAssetPrice()` 제거
  - ❌ 플랫폼 수수료 제거
  - ✅ `royaltyPerImportETH/USDC` 추가
  - ✅ `updateRoyaltyFee()` 추가
  - ✅ `getRoyaltyFee()` 추가

#### ClayRoyalty v3.0
- **주소**: `0x9C47413D00799Bd82300131D506576D491EAAf90`
- **변경사항**:
  - ✅ Library에서 로열티 금액 직접 조회 (`getRoyaltyFee`)
  - ✅ 등록 시점 로열티 금액 고정 저장
  - ❌ 백분율 계산 제거 (10% 제거)

#### ClayMarketplace v3.0
- **주소**: `0xD773D9cB49a170c6C04A46f2C88b343664035511`
- **변경사항**: 없음 (이미 소유권 거래만 담당)

---

### 2. 서비스 레이어 수정

#### libraryService.ts
- ✅ `registerLibraryAsset()` - 파라미터 변경 (price → royalty)
- ✅ `updateLibraryRoyaltyFee()` - 신규 추가
- ✅ `deactivateLibraryAsset()` - 유지
- ❌ `purchaseLibraryAssetWithETH()` - 사용 중지
- ❌ `purchaseLibraryAssetWithUSDC()` - 사용 중지

---

### 3. UI 수정

#### AdvancedClay (Library 등록)
- ✅ "Price" → "Royalty Per Import"
- ✅ 설명 추가: "Users pay this amount each time they import"
- ✅ 파라미터 변경 (price → royalty)

---

## ⏳ 남은 작업 (UI만)

### Library 페이지
- [ ] 가격 표시 → 로열티 표시
- [ ] 구매 버튼 제거 (없음)
- [ ] "View on Marketplace" 링크 추가

### Marketplace 페이지
- [ ] 변경 없음 (이미 완성)

### 로열티 가격 업데이트 UI
- [ ] 프로젝트 상세 또는 프로필에 추가
- [ ] "Update Royalty Fee" 버튼

---

## 🎯 핵심 변경 요약

### 이전 (v2.1)
```
Library: 직접 라이센스 판매 (10 USDC)
  → 여러 명 구매 가능
  → currentOwner에게 수익
  
로열티: 가격 × 10% 자동 계산
  → 1 USDC
```

### 현재 (v3.0)
```
Library: 로열티 정보만 저장 (1 USDC)
  → 구매 기능 없음
  → Marketplace로 이동해야 함
  
로열티: 직접 설정 금액
  → 1 USDC (소유자가 직접 설정)
```

---

## 📋 새로운 플로우

### Alice "손 모델" 등록
```
1. Library 등록:
   - 이름: "손 모델"
   - 로열티: 1 USDC per import
   
2. Marketplace 리스팅:
   - 소유권 가격: 50 ETH
```

### Bob 구매 (Marketplace)
```
Marketplace에서 50 ETH 지불
  ↓
소유권 이전: Alice → Bob
  ↓
이후:
  - 로열티 수익 → Bob
  - Bob이 로열티 가격 변경 가능
```

### Charlie import
```
Charlie가 손 모델 import
  ↓
로열티 등록 (등록 시점 금액: 1 USDC)
  ↓
David가 Charlie 프로젝트 구매
  ↓
Bob에게 1 USDC 로열티 (현재 owner)
```

### Bob 로열티 가격 변경
```
Bob.updateRoyaltyFee(3 USDC)
  ↓
Charlie 프로젝트: 여전히 1 USDC (등록 시점 가격)
Eve 새 프로젝트: 3 USDC (새 가격)
```

---

## 🚀 Vercel 환경변수 (v3.0)

```
NEXT_PUBLIC_PRIVY_APP_ID=cmeweacxn014qlg0c61fthp1h
NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS=0xFdF68975e992ca365aF4452f439A726522156Fb2
NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS=0x9C47413D00799Bd82300131D506576D491EAAf90
NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS=0xD773D9cB49a170c6C04A46f2C88b343664035511
```

**핵심 완성! UI 마무리만 남았습니다!** 🎯

