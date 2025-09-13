# 🗑️ 프로젝트 삭제 시 로열티 처리 개선

## ✅ 수정 완료 (Option 1)

### 변경 사항

**ClayLibrary.getCurrentOwner() 수정**

#### 변경 전 ❌
```solidity
function getCurrentOwner(string memory projectId) external view returns (address) {
    return libraryAssets[projectId].currentOwner;
}
```

**문제점**:
- 삭제된 프로젝트도 owner 주소 반환
- 로열티가 계속 발생
- 삭제 효과 없음

#### 변경 후 ✅
```solidity
function getCurrentOwner(string memory projectId) external view returns (address) {
    LibraryAsset storage asset = libraryAssets[projectId];
    
    // ✅ 비활성화된 프로젝트는 address(0) 반환
    if (!asset.isActive) {
        return address(0);
    }
    
    return asset.currentOwner;
}
```

**효과**:
- deactivate된 프로젝트 → address(0) 반환
- recordRoyalties에서 자동 skip
- 로열티 발생 안 함 ✅

---

## 🔄 동작 시나리오

### Case 1: 정상 프로젝트 (삭제 안 함)

```
Alice "손 모델" Library 등록
  isActive = true
  currentOwner = Alice
  ↓
Bob이 손 모델 사용해서 "로봇" 제작
  ↓
Charlie가 Bob 로봇 구매
  ↓
recordRoyalties("robot", ...) {
    owner = getCurrentOwner("hand-model")
    → isActive = true
    → return Alice 주소 ✅
    
    if (owner != address(0)) {  // true
        pendingRoyaltiesUSDC[Alice] += 1 USDC  ✅
    }
}
  ↓
결과: Alice에게 로열티 발생 ✅
```

---

### Case 2: 프로젝트 삭제 (deactivate)

```
Alice "손 모델" Library 등록
  isActive = true
  currentOwner = Alice
  ↓
Bob이 손 모델 사용해서 "로봇" 제작
  ↓
Alice가 손 모델 삭제
  Library.deactivateAsset("hand-model")
  → isActive = false ✅
  → currentOwner = Alice (그대로, 소유권은 유지)
  ↓
Charlie가 Bob 로봇 구매
  ↓
recordRoyalties("robot", ...) {
    owner = getCurrentOwner("hand-model")
    → isActive = false
    → return address(0)  ✅
    
    if (owner != address(0)) {  // ✅ false!
        // 실행 안 됨
    }
}
  ↓
결과: Alice에게 로열티 안 감 ✅
      Bob은 정상 수익 ✅
      Charlie는 정상 구매 ✅
```

---

### Case 3: Marketplace 소유권 이전 후 삭제

```
Alice "손 모델" 제작 → Library 등록
  ↓
David가 Marketplace에서 소유권 구매
  currentOwner = David
  ↓
David가 프로젝트 삭제
  deactivateAsset("hand-model")
  → isActive = false
  → currentOwner = David (그대로)
  ↓
이후 로열티 발생 시:
  getCurrentOwner("hand-model") → address(0) ✅
  로열티 skip ✅
```

---

## 📊 수정 효과

| 상황 | 이전 | 수정 후 |
|------|------|---------|
| **정상 프로젝트** | 로열티 발생 ✅ | 로열티 발생 ✅ |
| **삭제된 프로젝트** | 로열티 발생 ❌ | 로열티 skip ✅ |
| **deactivate 후** | 로열티 발생 ❌ | 로열티 skip ✅ |
| **미등록 프로젝트** | address(0) ✅ | address(0) ✅ |

---

## 🎯 핵심 개선

### 1. 로열티 자동 skip
```
삭제된 프로젝트 의존성 → getCurrentOwner = address(0)
  ↓
recordRoyalties에서 if (owner != address(0)) 체크
  ↓
로열티 기록 안 됨 ✅
```

### 2. 코드 변경 최소
- ✅ ClayLibrary.getCurrentOwner만 수정
- ✅ ClayRoyalty 변경 불필요
- ✅ 기존 로직 그대로 활용

### 3. 가스비 변화 없음
- getCurrentOwner 내부에서만 체크
- 추가 컨트랙트 호출 없음
- 가스비 증가 거의 없음 (~2,000 gas 정도)

---

## ⚠️ 주의사항

### 1. 컨트랙트 재배포 필요

**수정된 컨트랙트**:
- ClayLibrary (getCurrentOwner 수정)

**재배포 절차**:
```bash
cd /Users/USER/web3/getclayed/contracts
npx hardhat run scripts/deploy.js --network base
```

**영향**:
- 기존 배포된 컨트랙트는 수정 불가 (불변)
- 새 주소로 재배포 필요
- 프론트엔드 환경변수 업데이트 필요

### 2. 호환성

**이전 컨트랙트와 차이**:
```
기존: getCurrentOwner → 항상 주소 반환
수정: getCurrentOwner → isActive = false면 address(0)
```

**영향**:
- ClayRoyalty: 자동 호환 ✅ (address(0) 체크 이미 있음)
- ClayMarketplace: 영향 없음 (getCurrentOwner 사용 안 함)

---

## 🚀 배포 준비

### 체크리스트
- [x] 코드 수정 완료
- [x] 컴파일 성공
- [ ] 새 지갑에 ETH 입금 (재배포용)
- [ ] 컨트랙트 재배포
- [ ] 환경변수 업데이트
- [ ] 프론트엔드 재배포

---

## 💡 추가 개선 (선택사항)

### deactivateAsset UI 추가

**프로젝트 상세 페이지**:
```
[Edit] [Delete] [Deactivate Library]
```

**효과**:
- Library에서만 제거 (Irys는 유지)
- 로열티만 중단
- 나중에 재활성화 가능

**구현 난이도**: 쉬움 (버튼 + 함수 호출)

---

**현재는 컨트랙트 수정만 완료! 재배포하시겠습니까?** 🚀

